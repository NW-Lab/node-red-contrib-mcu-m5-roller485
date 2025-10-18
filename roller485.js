/*
 * Node-RED MCU Edition node for M5Stack Roller485 Unit
 * Controls Roller485 motor via I2C interface
 */

import I2C from "pins/i2c";
import Timer from "timer";

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

export default function(RED) {
    function Roller485Node(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        // I2C設定
        const i2cConfig = {
            sda: config.sda || 21,  // デフォルトSDAピン
            scl: config.scl || 22,  // デフォルトSCLピン
            address: ROLLER485_ADDR,
            hz: 100000  // 100kHz
        };
        
        let i2c;
        
        try {
            i2c = new I2C(i2cConfig);
            node.status({fill: "green", shape: "dot", text: "connected"});
            
            // 角度制御モードに設定
            i2c.write(REG_MODE, MODE_ANGLE);
            
        } catch (e) {
            node.error("I2C初期化エラー: " + e.message);
            node.status({fill: "red", shape: "ring", text: "error"});
            return;
        }
        
        // メッセージ受信時の処理
        node.on('input', function(msg) {
            try {
                let angle = msg.payload;
                
                // 数値チェック
                if (typeof angle !== 'number' || isNaN(angle)) {
                    node.warn("msg.payloadは数値である必要があります");
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
                node.send(msg);
                
            } catch (e) {
                node.error("制御エラー: " + e.message, msg);
                node.status({fill: "red", shape: "ring", text: "error"});
            }
        });
        
        // ノード終了時の処理
        node.on('close', function() {
            if (i2c) {
                try {
                    // モーターを停止
                    setAngle(i2c, 0);
                    i2c.close();
                } catch (e) {
                    node.error("クローズエラー: " + e.message);
                }
            }
        });
    }
    
    // 角度を設定する関数
    function setAngle(i2c, angle) {
        // 角度を整数に変換(内部では100倍した値を使用)
        const angleValue = Math.round(angle * 100);
        
        // 32bitの角度値をバイト配列に変換(リトルエンディアン)
        const bytes = new Uint8Array(4);
        bytes[0] = angleValue & 0xFF;
        bytes[1] = (angleValue >> 8) & 0xFF;
        bytes[2] = (angleValue >> 16) & 0xFF;
        bytes[3] = (angleValue >> 24) & 0xFF;
        
        // レジスタに書き込み
        i2c.write(REG_ANGLE, bytes[0], bytes[1], bytes[2], bytes[3]);
    }
    
    // 現在の角度を読み取る関数
    function getCurrentAngle(i2c) {
        const bytes = i2c.read(REG_CURRENT_ANGLE, 4);
        const angleValue = bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24);
        return angleValue / 100.0;
    }
    
    RED.nodes.registerType("roller485", Roller485Node);
}
