/*
 * Node-RED MCU Edition node for M5Stack Roller485 Unit
 * This file runs on the MCU device
 */

import { Node } from "nodered";

// Roller485のI2Cアドレス
const ROLLER485_ADDR = 0x64;

// レジスタアドレス (M5Stack公式プロトコルに準拠)
const REG_OUTPUT = 0x00;         // モーターON/OFFレジスタ (0:OFF, 1:ON)
const REG_MODE = 0x01;           // モード設定レジスタ (1:Speed, 2:Position, 3:Current, 4:Encoder)
const REG_SPEED = 0x40;          // 速度設定レジスタ (32bit int, -127〜127)
const REG_POS = 0x80;            // 位置設定レジスタ (32bit int)
const REG_POS_READBACK = 0x90;   // 位置読み取りレジスタ (32bit int)

// モード定義
const MODE_SPEED = 0x01;         // 速度制御モード
const MODE_POSITION = 0x02;      // 位置制御モード (角度制御)

// モーター制御
const MOTOR_OFF = 0x00;          // モーターOFF
const MOTOR_ON = 0x01;           // モーターON

let i2cCache = null;

class Roller485Node extends Node {
    #i2c = null;
    #i2cInstance = null;

    onStart(config) {
        super.onStart(config);
        
        try {
            this.#i2c = this.#initializeI2C();
            if (!this.#i2c) {
                this.status({fill: "red", shape: "dot", text: "no I2C support"});
                return;
            }
            
            // I2Cインスタンスを作成
            const i2cOptions = {
                data: Number(this.#i2c.data) ?? 21,
                clock: Number(this.#i2c.clock) ?? 22,
                address: ROLLER485_ADDR,
                hz: 100000
            };
            this.#i2cInstance = new this.#i2c.io(i2cOptions);
            
            // モーターをONにする (レジスタアドレス + データ)
            this.#writeRegister(REG_OUTPUT, Uint8Array.of(MOTOR_ON));
            
            // 速度制御モードに設定 (ゆっくり動かすため)
            this.#writeRegister(REG_MODE, Uint8Array.of(MODE_SPEED));
            
            this.status({fill: "green", shape: "dot", text: "connected"});
            
        } catch (e) {
            this.status({fill: "red", shape: "ring", text: "error"});
            trace(`I2C初期化エラー: ${e}\n`);
        }
    }
    
    #initializeI2C() {
        if (i2cCache) return i2cCache;
        
        try {
            if (globalThis.device?.I2C?.default) {
                i2cCache = globalThis.device.I2C.default;
                return i2cCache;
            }
            return null;
        } catch (e) {
            trace(`I2C initialization error: ${e}\n`);
            return null;
        }
    }
    
    onMessage(msg, done) {
        if (!this.#i2cInstance) {
            done?.();
            return;
        }
        
        try {
            let angle = msg.payload;
            
            // 数値チェック
            if (typeof angle !== 'number' || isNaN(angle)) {
                trace("msg.payloadは数値である必要があります\n");
                done?.();
                return;
            }
            
            // 角度を速度に変換 (-127〜127の範囲、符号で方向決定)
            // 正の値: 時計回り、負の値: 反時計回り
            let speed = Math.max(-127, Math.min(127, Math.round(angle / 3)));
            
            // 速度をRoller485に送信
            this.#setSpeed(speed);
            
            this.status({
                fill: "green", 
                shape: "dot", 
                text: `speed: ${speed}`
            });
            
            // 成功メッセージを出力
            this.send({
                payload: {
                    speed: speed,
                    status: "ok"
                }
            });
            
        } catch (e) {
            this.status({fill: "red", shape: "ring", text: "error"});
            trace(`制御エラー: ${e}\n`);
        }
        
        done?.();
    }
    
    #writeRegister(reg, data) {
        // レジスタアドレスとデータを結合
        const buffer = new Uint8Array(1 + data.length);
        buffer[0] = reg;
        buffer.set(data, 1);
        this.#i2cInstance.write(buffer);
    }
    
    #setSpeed(speed) {
        // 速度を設定 (-127〜127)
        // 負の値の場合は符号付き32bit整数として扱う
        const speedValue = speed < 0 ? (0xFFFFFFFF + speed + 1) : speed;
        
        // 32bitの速度値をバイト配列に変換(リトルエンディアン)
        const speedBytes = new Uint8Array(4);
        speedBytes[0] = speedValue & 0xFF;
        speedBytes[1] = (speedValue >> 8) & 0xFF;
        speedBytes[2] = (speedValue >> 16) & 0xFF;
        speedBytes[3] = (speedValue >> 24) & 0xFF;
        
        // レジスタに書き込み
        this.#writeRegister(REG_SPEED, speedBytes);
    }
    
    onStop() {
        if (this.#i2cInstance) {
            try {
                // モーターを停止(速度を0にする)
                this.#setSpeed(0);
                // モーターをOFFにする
                this.#writeRegister(REG_OUTPUT, Uint8Array.of(MOTOR_OFF));
                this.#i2cInstance.close();
            } catch (e) {
                trace(`クローズエラー: ${e}\n`);
            }
        }
        this.#i2cInstance = null;
    }
    
    static type = "mcu_roller485";
    static {
        RED.nodes.registerType(this.type, this);
    }
}
