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

### 非MCU環境（通常のNode-RED）での挙動
- このノードはNode-RED MCU Edition専用。MCUランタイム（mcuHelper）が見つからない場合は処理をスキップし、ノードのステータスに「MCU runtime not found」、ログにWarningを出すだけでフローを止めない。
- 実機制御は行われないので、動作確認は必ずNode-RED MCU環境で実施してね。

### 開発メモ（mcuHelperの解決順）
- ランタイム側は以下の順でmcuHelperを解決する：
	1. `globalThis.mcuHelper`
	2. `RED.settings.functionGlobalContext.mcuHelper`
- エディタUI側は `window.mcuHelper` があればI2CのBus/Pins UIを表示、無ければ簡易ヘルプのみ表示。

### Wi‑Fiなしでの利用について
- このノードはI2Cのみを使用するから、Wi‑Fi設定は不要だよ。オフラインでも普通に使える。
- MCUのログに「No Wi‑Fi SSID」みたいなメッセが出ても、ネット通信を使わないなら無視してOK。
- 本ノードが要求するmanifestはI2Cのみ（`$(NODEREDMCU)/nodes/mcu/i2c/manifest.json`）。もしプロジェクト全体からWi‑Fi関連を完全に外したい場合は、MCU側プロジェクトのmanifestからWi‑Fiモジュールを外してビルドしてね。


