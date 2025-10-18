/*
 * Node-RED MCU Edition node for M5Stack Roller485 Unit
 * Controls Roller485 motor via I2C interface
 */

// Roller485のI2Cアドレス
const ROLLER485_ADDR = 0x64;

// レジスタアドレス (M5Stack公式プロトコルに準拠)
const REG_OUTPUT = 0x00;         // モーターON/OFFレジスタ (0:OFF, 1:ON)
const REG_MODE = 0x01;           // モード設定レジスタ (1:Speed, 2:Position, 3:Current, 4:Encoder)
const REG_POS = 0x80;            // 位置設定レジスタ (32bit int)
const REG_POS_READBACK = 0x90;   // 位置読み取りレジスタ (32bit int)
const REG_SPEED = 0x40;          // 速度設定レジスタ (32bit int)
const REG_CURRENT = 0xB0;        // 電流設定レジスタ (32bit int)

// モード定義
const MODE_SPEED = 0x01;         // 速度制御モード
const MODE_POSITION = 0x02;      // 位置制御モード (角度制御)
const MODE_CURRENT = 0x03;       // 電流制御モード
const MODE_ENCODER = 0x04;       // エンコーダーモード

// モーター制御
const MOTOR_OFF = 0x00;          // モーターOFF
const MOTOR_ON = 0x01;           // モーターON

module.exports = function(RED) {
    function Roller485Node(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
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
        
        let i2c;
        
        try {
            // I2Cインスタンスを作成
            i2c = new device.io.I2C(i2cOptions);
            
            node.status({fill: "green", shape: "dot", text: "connected"});
            
            // モーターをONにする
            i2c.write(Uint8Array.of(REG_OUTPUT, MOTOR_ON));
            
            // 位置制御モード(角度制御)に設定
            i2c.write(Uint8Array.of(REG_MODE, MODE_POSITION));
            
        } catch (e) {
            node.status({fill: "red", shape: "ring", text: "error"});
            node.error(`I2C初期化エラー: ${e}`);
            return;
        }
        
        // メッセージ受信時の処理
        node.on('input', function(msg, send, done) {
            if (!i2c) {
                if (done) done();
                return;
            }
            
            try {
                let angle = msg.payload;
                
                // 数値チェック
                if (typeof angle !== 'number' || isNaN(angle)) {
                    node.warn("msg.payloadは数値である必要があります");
                    if (done) done();
                    return;
                }
                
                // 角度を-360〜360度の範囲に制限
                angle = Math.max(-360, Math.min(360, angle));
                
                // 角度をRoller485に送信
                setAngle(i2c, angle);
                
                node.status({
                    fill: "green", 
                    shape: "dot", 
                    text: `angle: ${angle.toFixed(1)}°`
                });
                
                // 成功メッセージを出力
                msg.payload = {
                    angle: angle,
                    status: "ok"
                };
                
                send = send || function() { node.send.apply(node, arguments); };
                send(msg);
                
                if (done) done();
                
            } catch (e) {
                node.status({fill: "red", shape: "ring", text: "error"});
                node.error(`制御エラー: ${e}`, msg);
                if (done) done(e);
            }
        });
        
        // ノード終了時の処理
        node.on('close', function() {
            if (i2c) {
                try {
                    // モーターを停止(位置を0にリセット)
                    setAngle(i2c, 0);
                    // モーターをOFFにする
                    i2c.write(Uint8Array.of(REG_OUTPUT, MOTOR_OFF));
                    i2c.close();
                } catch (e) {
                    node.error(`クローズエラー: ${e}`);
                }
            }
        });
    }
    
    // 角度を設定する関数
    function setAngle(i2c, angle) {
        // 角度を位置(ポジション)として設定
        // Roller485では位置は int32 (4バイト) で指定
        const position = Math.round(angle);
        
        // 32bitの位置値をバイト配列に変換(リトルエンディアン)
        const bytes = new Uint8Array(5);
        bytes[0] = REG_POS;  // 位置設定レジスタ
        bytes[1] = position & 0xFF;
        bytes[2] = (position >> 8) & 0xFF;
        bytes[3] = (position >> 16) & 0xFF;
        bytes[4] = (position >> 24) & 0xFF;
        
        // レジスタに書き込み
        i2c.write(bytes);
    }
    
    // 現在の角度を読み取る関数
    function getCurrentAngle(i2c) {
        i2c.write(Uint8Array.of(REG_POS_READBACK));
        const bytes = i2c.read(4);
        const position = bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24);
        return position;
    }
    
    RED.nodes.registerType("roller485", Roller485Node);
}
