module.exports = function (RED) {
  // Helper resolver: obtain mcuHelper only when running under Node-RED MCU
  function getMcuHelper() {
    try {
      // Preferred: injected on globalThis in MCU runtime
      if (typeof globalThis !== "undefined" && globalThis.mcuHelper) return globalThis.mcuHelper;
      // Fallback: if user exposed it via functionGlobalContext
      const fgc = RED?.settings?.functionGlobalContext;
      if (fgc && fgc.mcuHelper) return fgc.mcuHelper;
    } catch (_) {}
    return null;
  }

  function Roller485Node(config) {
    RED.nodes.createNode(this, config);
    const node = this;

    // Config from editor
    node.name = config.name;
    node.addr = parseInt(config.addr || 0x64); // default 0x64
    node.speed = parseInt(config.speed || 0); // logical speed for motion, unit depends on device
    node.options = config.options || { bus: "default" };
  node.moddable_manifest = config.moddable_manifest || { include: ["nodes/manifest.json"] };

    // ECMA-419 I2C constants from Roller docs
    const REG = {
      MODE: 0x01,
      OUTPUT: 0x00,
      POS: 0x80,
      POS_MAX_CURRENT: 0x20,
      SPEED: 0x40,
    };

    const MODE_POSITION = 2;

    // Open I2C on first message to avoid holding hardware when idle
    let i2c = null;
    let warnedNoMcu = false;
    function ensureI2C() {
      if (i2c) return i2c;
      const mcuHelper = getMcuHelper();
      if (!mcuHelper || typeof mcuHelper.openIO !== "function") {
        // Graceful: in non-MCU Node-RED, warn and mark status, but do not throw
        try {
          if (!warnedNoMcu) {
            if (typeof node?.status === "function") {
              node.status({ fill: "red", shape: "ring", text: "MCU runtime not found" });
            }
            if (typeof node?.warn === "function") {
              node.warn("This node requires Node-RED MCU runtime (mcuHelper not found)");
            }
            warnedNoMcu = true;
          }
        } catch (_) {}
        return null;
      }
      // mcuHelper provides openIO based on editor options
      const opts = Object.assign({}, node.options || {}, { address: node.addr });
      i2c = mcuHelper.openIO("I2C", opts);
      return i2c;
    }

    function writeReg(addr, reg, bytes) {
      const hw = ensureI2C();
      if (!hw) return false;
      const tx = new Uint8Array(1 + bytes.length);
      tx[0] = reg;
      tx.set(bytes, 1);
      try {
        // Prefer ECMA-419 style: address set at open, write(buffer)
        if (hw.write.length <= 1) {
          hw.write(tx);
        } else {
          hw.write(addr, tx);
        }
        return true;
      } catch (e1) {
        try {
          // Fallback to alternate signature
          hw.write(addr, tx);
          return true;
        } catch (e2) {
          try {
            // Last resort: try buffer-only
            hw.write(tx);
            return true;
          } catch (e3) {
            node.status({ fill: "red", shape: "ring", text: `I2C write error: ${e3?.message || e2?.message || e1?.message}` });
            if (!warnedNoMcu && typeof node?.warn === "function") {
              node.warn(`I2C write failed (addr=0x${addr.toString(16)}, reg=0x${reg.toString(16)})`);
            }
            return false;
          }
        }
      }
    }

    function int32ToBytes(val) {
      // Little-endian as per library (Arduino memcpy of int32)
      const b = new Uint8Array(4);
      let v = val | 0;
      b[0] = v & 0xFF;
      b[1] = (v >> 8) & 0xFF;
      b[2] = (v >> 16) & 0xFF;
      b[3] = (v >> 24) & 0xFF;
      return b;
    }

    function toScaled100(x) {
      // device expects value * 100 for position/speed/current
      const scaled = Math.round(Number(x) * 100);
      return int32ToBytes(scaled);
    }

    function setModePosition() {
      // MODE=2 (Position), OUTPUT=1 enable
      writeReg(node.addr, REG.MODE, new Uint8Array([MODE_POSITION]));
      writeReg(node.addr, REG.OUTPUT, new Uint8Array([1]));
    }

    function setSpeedIfConfigured() {
      if (Number.isFinite(node.speed) && node.speed !== 0) {
        const bytes = toScaled100(node.speed);
        writeReg(node.addr, REG.SPEED, bytes);
      }
    }

    node.on("input", (msg, send, done) => {
      try {
        // Ensure runtime is ready
        if (!ensureI2C()) {
          // No-op on desktop Node-RED; don't crash the flow
          return done();
        }
        const degree = msg?.payload;
        if (degree === undefined || degree === null || isNaN(Number(degree))) {
          throw new Error("msg.payload に角度[deg]を数値で入れてね");
        }

        // Configure once per message (idempotent)
        setModePosition();
        setSpeedIfConfigured();

        // Write target position in degrees
        const bytes = toScaled100(Number(degree));
        writeReg(node.addr, REG.POS, bytes);

        node.status({ fill: "green", shape: "dot", text: `deg:${Number(degree)} addr:0x${node.addr.toString(16)}` });
        send(msg);
        done();
      } catch (err) {
        node.status({ fill: "red", shape: "ring", text: err.message });
        done(err);
      }
    });

    node.on("close", () => {
      try {
        if (i2c && i2c.close) i2c.close();
      } catch (e) {}
      i2c = null;
    });
  }

  RED.nodes.registerType("mcu_roller485", Roller485Node);
};
