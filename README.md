これはRoller485をNode-RED MCU Editionで使うためのノードです。
# 参考のサイト
## Roller485
公式のドキュメント
https://docs.m5stack.com/ja/unit/Unit-Roller485
Arduinoの例
https://github.com/m5stack/M5Unit-Roller

## Node-REDのノードの作り方
https://nodered.org/docs/creating-nodes/first-node

## Node-RED MCU Edition
https://github.com/phoddie/node-red-mcu/

## MCU用のノード例
https://github.com/404background/node-red-contrib-mcu-m5units
https://github.com/phoddie/node-red-mcu/tree/main/nodes

# ノードの機能
msg.payloadで角度(degree)を受け取りRollerをその角度を回転させます。
プロパティでI2Cのアドレスが入力できるようにしてください。
プロパティで速度を設定できるようにしてください。

# 他
コードはJavaScript（Moddable SDK）で作る必要があります。
