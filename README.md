Roller485をNode-RED MCU Editionで使うためのノードを作成します。

# Node作成の参考のサイト
https://qiita.com/NWLab/items/58089fe4340dc3dad70d

## Roller485
公式のドキュメント
https://docs.m5stack.com/ja/unit/Unit-Roller485
Arduinoの例から、パラメータを理解してください
https://github.com/m5stack/M5Unit-Roller

# ノードの機能
msg.payloadで角度(degree)を受け取りRollerをその角度を回転させます。
プロパティでI2Cのアドレスが入力できるようにしてください。
プロパティで速度を設定できるようにしてください。


## できあがったノードについて

- ノード名: `mcu_roller485` (カテゴリ: MCU)
- 入力: `msg.payload` に角度[度] (Number)。例: 90, -45
- 設定:
	- I2C Address: 既定 0x64 (100)
	- Speed: 任意。0なら未設定のまま。単位はデバイス仕様に準拠し、内部では×100で送信
	- I/O: Bus/Pins からI2Cのバス or ピン指定 (Node-RED MCUのmcuHelper UI準拠)

ノードは以下のI2Cレジスタに従って制御するよ。
- MODE(0x01) = 2 で位置制御モードへ
- OUTPUT(0x00) = 1 で出力有効
- POS(0x80) に 角度×100 を little-endian 32bit で書き込み
- Speed設定が0以外なら SPEED(0x40) に 速度×100 を little-endian 32bit で書き込み

参考: 公式I2C仕様およびArduinoライブラリ
- I2Cアドレス: 0x64
- レジスタ定義: https://raw.githubusercontent.com/m5stack/M5Unit-Roller/main/src/unit_roller_common.hpp

## インストールと使い方

1. 本リポジトリをNode-RED MCUのユーザノードとして配置
2. Node-RED MCUを起動してパレットから「MCU > Roller485」をフローに追加
3. ノードのプロパティで I2C Address, Speed, I/O(BusまたはPins) を設定
4. `inject` ノードなどから数値の角度を `msg.payload` で入力

最小例:
- Inject: `msg.payload=90`
- mcu_roller485: Address=0x64, Speed=0 (未設定)

## 注意
- 角度・速度・電流等は内部的に×100スケールで送信されるため、度は実数でOKだよ
- 速度の単位はデバイス仕様に依存（Arduinoライブラリ/ドキュメント準拠）
- モード/出力は毎回設定しても冪等で問題ない構成にしてる

