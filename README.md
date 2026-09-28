# DormMate 宿舍环境监测系统
nova‑dormmate‑final‑2026
NOVA C01 DormMate Final Challenge

## 项目简介
本项目为NOVA低年级综合挑战C01的DormMate‑Final项目，实现宿舍环境监测Web系统。
整体开发顺序：M1 → M2 → M3 → M4 → M5，严格遵循任务书统一环境判断规则，使用原生HTML/CSS/JavaScript、Python，浏览器原生媒体API，不引入大型第三方框架。

> 统一环境判断规则（全模块共用）
> 1. temperature < 18 → 偏冷
> 2. 否则 temperature ≥30 → 偏热
> 3. 否则 humidity ≥75 → 偏湿（前提：18 ≤ temperature <30）
> 4. 其余情况 → 正常

## ✨ 模块开发过程 M1‑M5
### M1｜Web主应用：输入、校验、判断、历史记录
目标：搭建整个系统Web基础入口。
产出文件：`web/index.html`、`web/style.css`、`web/script.js`

实现过程：
1. 搭建静态页面：标题、温度输入框、湿度输入框、【分析环境】按钮、状态展示区、建议区、历史记录列表。
2. 输入校验逻辑：拦截空输入、非数字字符、数值越界；非法输入不执行状态计算，状态与建议位置显示 `--`，页面布局不会塌陷跳动。
3. 封装独立函数 `getStatus(temperature, humidity)`，实现任务书规定的环境状态判断逻辑。
4. 每次合法分析生成本地时间戳，将 {time,temperature,humidity,status,advice} 存入内存数组，历史记录**追加不覆盖旧记录**，至少产生5条运行记录。
5. 内存存储历史，页面刷新后历史清空，不使用数据库、localStorage持久化。
6. 自定义CSS样式，完成页面美化。

M1验收完成点：
- 三组标准测试用例输出正确；非法输入拦截生效。
- 可以定位代码三处关键点：读取输入位置、getStatus判断函数、历史数组push追加代码。

### M2｜离线数据分析与报告，打通离线链路
目标：打通离线链路：`Web历史记录 → 导出CSV → Python分析 → trend.png → report.html`

实现过程：
1. 在M1网页新增【导出CSV】按钮，JS读取页面内存history数组，通过Blob生成CSV文件下载。
2. CSV表头固定为 `time,temperature,humidity,status`，数据来自网页真实运行产生的历史，禁止手动修改预制CSV。
3. 新建`analysis.py`脚本（项目根目录）；依赖 matplotlib。
4. Python读取dormmate.csv，完成统计：总记录数、最高/最低温湿度，统计四类环境状态数量，提取需要关注的异常记录。
5. matplotlib绘制双Y轴温湿度趋势图，输出`trend.png`，处理中文乱码。
6. Python字符串模板自动生成`report.html`报告，包含统计摘要、异常记录、数据表格、嵌入趋势图片。
7. 硬性验证：更换一份全新导出的CSV，重新运行脚本，统计结果、图片、报告全部自动重新生成，禁止硬编码结果。

M2验收完成点：
- Web可正常导出CSV；Python脚本可完整生成趋势图与HTML报告；完整跑通离线数据链路。

### M3｜本机交互 + Git/GitHub版本记录
目标：浏览器媒体能力（Camera摄像头快照、ASR语音识别、TTS语音朗读）；建立完整版本管理。
> 注意：摄像头、麦克风、ASR语音识别API，**必须通过Live Server以localhost访问，直接双击html文件会权限报错**。

实现过程：
1. **Camera摄像头快照**
    - 页面新增摄像头控制区域：开启摄像头、拍照、关闭摄像头、图片预览。
    - 使用`getUserMedia`获取摄像头媒体流，video标签实时预览画面。
    - 点击拍照，将video画面绘制到canvas画布，生成PNG快照图片，页面预览。
    - 关闭摄像头时停止媒体流，释放硬件；权限拒绝给出页面友好提示。

2. **ASR语音识别 + TTS语音合成**
    - 使用浏览器原生Web Speech API `webkitSpeechRecognition`实现ASR语音识别。
    - 识别的文字实时展示在页面；设置固定语音指令：`朗读当前状态`。
    - 当识别命中固定指令，触发TTS语音朗读；朗读内容跟随页面当前状态动态变化。
    - 若当前状态为`--`（非法输入），也会朗读对应提示；增加异常捕获，避免页面崩溃。

3. **Git & GitHub版本管理**
    - 项目独立Git仓库，不与其他项目仓库嵌套。
    - 生成多次有意义的commit提交，每一次提交对应真实功能改动：
      - commit1：M2完整可运行版本
      - commit2：新增摄像头拍照快照功能
      - commit3：新增ASR语音识别、TTS语音朗读交互
      - commit4：新增README.md项目说明文档
    - 推送到GitHub仓库：`nova‑dormmate‑final‑2026`；网页端可以查看全部Challenge期间commit历史。

M3验收完成点：
- Camera快照、ASR识别、TTS朗读可现场运行；固定语音指令可以真实触发功能。
- 本地git log可查看提交历史，GitHub仓库可见全部提交记录；README文档完善。

### M4｜微信小程序版宿舍监测
目标：将 M1 的环境监测能力迁移到微信小程序端。
产出文件：`miniapp/`（app.js、app.json、app.wxss、pages/index/ 等）

实现过程：
1. 小程序 index 页面复用 M1 的输入校验与 `getStatus` 环境判定规则，实现温湿度输入、非法拦截、状态与建议展示。
2. 历史记录以表格形式展示（时间 / 温度 / 湿度 / 状态），状态列带颜色标识。
3. 使用 `wx.setStorageSync` 将历史持久化到本地缓存，关闭小程序后记录不丢失（区别于 M1 纯内存存储）。
4. 提供【清空记录】按钮，带二次确认弹窗，一键清空全部历史。

M4验收完成点：
- 小程序可正常输入、判定、展示历史；历史记录本地缓存持久化，重启小程序不丢失。

### M5｜MQTT 实时监控面板
目标：通过 MQTT Broker 实现宿舍环境数据的实时上报与网页监控。
产出文件：`mosquitto.conf`、`mqtt-m5/`（index.html、style.css、app.js）

实现过程：
1. 配置 Mosquitto Broker，同时开启 TCP 1883（MQTTX 接入）与 WebSocket 9001（浏览器 mqtt.js 接入），允许匿名访问。
2. 使用 mqtt.js 通过 `ws://127.0.0.1:9001` 连接 Broker，订阅主题 `dormmate/+/env`。
3. 三个宿舍节点 dorm-a / dorm-b / dorm-c 各自独立卡片，实时展示温度、湿度、状态。
4. `status` 由前端根据温湿度复用 M1 规则计算，不使用 MQTT 消息中的 status 字段。
5. 使用 Chart.js 绘制温湿度双折线图，下拉框切换查看不同节点趋势。
6. 全局历史记录列表，每条消息逐条追加、不删除旧记录。
7. 断线自动重连；非法 JSON、错误 topic 捕获异常、页面不崩溃。

M5验收完成点：
- MQTTX 发布消息，网页无需刷新实时更新卡片、图表与历史记录。

## 🛠️ 运行方法
1. **Web(M1/M3)运行**
    使用VS Code插件Live Server，以localhost打开 `web/index.html`，浏览器授权摄像头、麦克风权限。

2. **M2离线分析运行**
    1. Web页面生成历史，点击导出CSV；
    2. 将下载得到的 `dormmate.csv`放到项目根目录（与 analysis.py 同目录）；
    3. 安装依赖：
    ```bash
    pip install matplotlib
    ```

## ✨ 一、主要功能
1. **M1 环境输入与状态判断**
   - 温湿度输入框，对输入做合法性校验，拦截空值、非数字、越界数值。
   - 根据温湿度自动判定宿舍环境状态，给出文字建议。
   - 保存历史记录列表，页面实时展示多条历史数据。

2. **M2 离线数据分析与报表生成**
   - 网页导出CSV历史数据文件。
   - Python脚本读取CSV，完成数据统计、绘制温湿度趋势图。
   - 自动生成HTML分析报告，包含统计摘要、异常记录、趋势图片。

3. **M3 摄像头快照 + 语音交互**
   - 调用浏览器摄像头，拍摄宿舍现场快照并预览。
   - ASR语音识别：麦克风收音，实时转文字，页面展示识别结果。
   - 固定语音指令触发功能，示例指令：`朗读当前状态`。
   - TTS动态语音合成，朗读环境结果，实现语音交互闭环。

4. **M4 微信小程序宿舍监测**
   - 小程序端温湿度输入、校验、环境状态判定与建议。
   - 历史记录表格展示，状态带颜色标识。
   - 本地缓存持久化历史，重启小程序不丢失。

5. **M5 MQTT 实时监控面板**
   - Mosquitto Broker + mqtt.js 实时收发宿舍环境数据。
   - 三个节点卡片实时展示温度、湿度、前端计算的状态。
   - Chart.js 温湿度趋势图 + 全局历史记录。

## 🛠️ 二、运行方式
### 1. Web前端（M1、M3页面）
1. 使用VS Code的Live Server插件，**以localhost协议打开 `web/index.html`**。
2. 浏览器弹出权限申请，允许摄像头、麦克风权限。
3. 在页面输入温湿度，点击分析；可开启摄像头拍照、开启语音识别进行语音指令交互。

> ⚠️ 重要：直接双击html文件打开（file协议），摄像头、麦克风、ASR语音API都会权限报错，**必须localhost**。

### 2. Python离线分析（M2模块）
1. 在Web页面产生多条历史记录，点击导出CSV文件。
2. 将下载的 `dormmate.csv` 放到项目根目录（与 analysis.py 同目录）。
3. 安装依赖包：
```bash
pip install matplotlib
python analysis.py
```

### 3. 微信小程序（M4模块）
1. 使用微信开发者工具导入 `miniapp/` 目录。
2. 编译运行，输入温湿度、点击分析，查看状态、建议与历史记录。

### 4. MQTT 实时监控（M5模块）
1. 启动 Broker（需监听 1883 TCP + 9001 WebSocket）：
```bash
mosquitto -c mosquitto.conf -v
```
2. 用 Live Server 打开 `mqtt-m5/index.html`，页面连接 `ws://127.0.0.1:9001`。
3. 用 MQTTX 连接 `mqtt://127.0.0.1:1883`，向 `dormmate/<nodeId>/env` 发布 JSON 消息，网页实时更新。

⚠️ 三、已知限制
1:浏览器媒体 API（摄像头、麦克风、ASR）仅支持localhost，本地直接打开 html 文件无法调用硬件。
2:Web Speech ASR 语音识别仅支持 Chrome、Edge 浏览器，Firefox、Safari 不支持该接口。
3:页面历史数据保存在 JS 内存，刷新页面后历史记录全部丢失，没有持久化存储（无数据库 /localStorage）。
4:TTS 语音播报能力依赖浏览器内置语音引擎，部分精简版浏览器缺少语音包会播报失败。
5:Python 绘图生成中文趋势图，需要提前配置 matplotlib 中文字体，否则中文会显示方框乱码。