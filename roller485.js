/*
 * Node-RED MCU Edition node for M5Stack Roller485 Unit
 * Controls Roller485 motor via I2C interface
 */

// Roller485のI2Cアドレス
const ROLLER485_ADDR = 0x64;

// レジスタアドレス
const REG_MODE = 0x00;           // モード設定レジスタ
const REG_ANGLE = 0x10;          // 角度制御レジスタ(32bit)
const REG_SPEED = 0x20;          // 速度設定レジスタ
const REG_CURRENT_ANGLE = 0x30;  // 現在角度読み取りレジスタ(32bit)

// モード定義
const MODE_ANGLE = 0x00;         // 角度制御モード
const MODE_SPEED = 0x01;         // 速度制御モード

class Roller485Node extends Node {
    onStart(config) {
        super.onStart(config);
        
        // I2C設定を構築
        const i2cOptions = {
            address: ROLLER485_ADDR
        };
        
        // Busタブの設定
        if (config.busName && config.busName !== "default") {
            i2cOptions.bus = config.busName;
        }
        
        // Pinsタブの設定
        if (config.usePins) {
            if (config.sda !== undefined && config.sda !== "") {
                i2cOptions.sda = parseInt(config.sda);
            }
            if (config.scl !== undefined && config.scl !== "") {
                i2cOptions.scl = parseInt(config.scl);
            }
            if (config.hz !== undefined && config.hz !== "") {
                i2cOptions.hz = parseInt(config.hz);
            }
        }
        
        try {
            // I2Cインスタンスを作成
            this.i2c = new device.io.I2C(i2cOptions);
            
            this.status({fill: "green", shape: "dot", text: "connected"});
            
            // 角度制御モードに設定
            this.i2c.write(Uint8Array.of(REG_MODE, MODE_ANGLE));
            
        } catch (e) {
            this.status({fill: "red", shape: "ring", text: "error"});
            trace(`I2C初期化エラー: ${e}\n`);
            return;
        }
    }
    
    onMessage(msg) {
        if (!this.i2c) {
            return;
        }
        
        try {
            let angle = msg.payload;
            
            // 数値チェック
            if (typeof angle !== 'number' || isNaN(angle)) {
                trace("msg.payloadは数値である必要があります\n");
                return;
            }
            
            // 角度を-360〜360度の範囲に制限
            angle = Math.max(-360, Math.min(360, angle));
            
            // 角度をRoller485に送信
            this.setAngle(angle);
            
            this.status({
                fill: "green", 
                shape: "dot", 
                text: `angle: ${angle.toFixed(1)}°`
            });
            
            // 成功メッセージを出力
            msg.payload = {
                angle: angle,
                status: "ok"
            };
            this.send(msg);
            
        } catch (e) {
            this.status({fill: "red", shape: "ring", text: "error"});
            trace(`制御エラー: ${e}\n`);
        }
    }
    
    // 角度を設定する関数
    setAngle(angle) {
        // 角度を整数に変換(内部では100倍した値を使用)
        const angleValue = Math.round(angle * 100);
        
        // 32bitの角度値をバイト配列に変換(リトルエンディアン)
        const bytes = new Uint8Array(5);
        bytes[0] = REG_ANGLE;
        bytes[1] = angleValue & 0xFF;
        bytes[2] = (angleValue >> 8) & 0xFF;
        bytes[3] = (angleValue >> 16) & 0xFF;
        bytes[4] = (angleValue >> 24) & 0xFF;
        
        // レジスタに書き込み
        this.i2c.write(bytes);
    }
    
    // 現在の角度を読み取る関数
    getCurrentAngle() {
        this.i2c.write(Uint8Array.of(REG_CURRENT_ANGLE));
        const bytes = this.i2c.read(4);
        const angleValue = bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24);
        return angleValue / 100.0;
    }
    
    onStop() {
        if (this.i2c) {
            try {
                // モーターを停止
                this.setAngle(0);
                this.i2c.close();
            } catch (e) {
                trace(`クローズエラー: ${e}\n`);
            }
        }
    }
    
    static type = "roller485";
    static {
        RED.nodes.registerType(this.type, this);
    }
}
