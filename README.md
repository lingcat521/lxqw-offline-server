# lxqw 离线模拟服（服务端源码）

《旅行青蛙·中国之旅》(`com.aligames.lxqw.hhb` v1.0.20，Egret HTML5 + WebView 套壳) 的**离线单机模拟服务端**。

游戏本体的美术、动画、音效、配置表全部在 APK 的 `assets/game/` 里，只有"服务端协议"是联网的。
本项目实现了这些协议，让游戏在完全离线的状态下游玩除联网功能以外的全部玩法。

> **本仓库只包含服务端源码（协议实现 + 工具 + 笔记）。**
> 不含 APK、不含任何游戏美术/音频资源、不含从客户端提取的数据表。请使用你自己合法持有的游戏安装包。
>
> 许可证：**MIT**（见 [LICENSE](LICENSE)）

## 工作原理

1. 客户端每个请求最终都走 `core.SocketManage.prototype.send(name, params)`，组装 `{name, params}` POST 到 `GameConfig.serverURL`。
2. 改写 APK 内 `assets/game/index.html` 的启动 loader，让它从本地服务 `http://127.0.0.1:8089/<层>.js` 同步取回每一层 JS 并 `eval`。
3. 每个层文件把自己注册进 `window.MOCK_SEMANTIC[name]`，由 `new/mock.js` 的 `Mock.handle(name, params)` 统一分发。
   回包既支持 HTTP 应答，也支持 WebSocket 推送（`{cmd,data}`），与真实服务端形态一致。
4. 存档走 `POST /save` / `GET /load` ↔ `save/state.json`，写盘做了 4s 防抖 + `MOCK_SAVE_NOW()` 立即落盘。

## 目录

```
new/                 协议实现层(按功能切分, 由 mock.js 的层列表决定加载顺序)
  mock.js            入口: 版本、层列表、Mock.handle、推送、存档防抖
  rules.js           协议到语义的映射与基础规则
  flowerpot.js       三叶草田/花盆(逐株状态、四叶草、收获)
  materials.js       普通材料(嘟嘟 20 草/件 + 旅行带回自动上工作台)
  plans.js           伴蛙前行任务引擎(周期窗口/惰性重置/加权抽签/领奖)
  plan_templates.js  任务模板(86 条候选, 数据文件, 改它即改任务)
  planhooks.js       动作出口挂钩 + 界面开启协议观测 + 全协议观测
  season.js          季节/节气/天气/烹饪->节气食物链路
  maploc.js          地点解锁、照片归属、地理进度
  map_paths.js/.json 地点图(29 节点/28 条边/地形/里程)
  pathengine.js      路线结算(时间/体力/特产/明信片/伴手礼)
  mapview.js         游戏内地图界面(Egret 覆盖层)
  cdkey.js           兑换码(每码每用户一次)
  clickfx.js         点击特效
  gm.js              GM 指令实现
  index.html         APK 内 loader 的改写版本(指向本地服务)
tools/               开发与验证工具
  devserver2.js      静态层服务 + /save /load /gm /shot(默认 8089)
  logserver.js       客户端日志收集(默认 8088 -> logs/game.log)
  _harness.js        Node 测试壳(假 XHR + 假 Egret, 直接跑协议层)
  *test.js           各功能测试; verify.sh 汇总(80+ 步)
NOTES.md             逆向/实现过程的工作笔记(协议、坑、实测结论)
protocol_spec.json   实测协议签名表
spec_auto.json       从客户端反解出的协议参数表
做不了的功能清单.md   明确不做/做不到的联网功能与原因
联网功能清单.md       需要服务端但本模拟服未实现的联网功能
```

## 跑起来

```bash
# 1) 静态层服务 + 存档 + GM(8089)
setsid nohup node tools/devserver2.js > logs/devserver2.out 2>&1 < /dev/null &

# 2) 客户端日志服务(8088 -> logs/game.log)
setsid nohup node tools/logserver.js   > logs/logserver.out   2>&1 < /dev/null &
```

客户端侧：把你自己的 APK 内 `assets/game/index.html` 换成 `new/index.html`（里面是从 `127.0.0.1:8089` 拉层并 eval 的 loader），
重新签名安装即可。注意 APK 的 `resources.arsc` 必须保持**不压缩且 4 字节对齐**，否则安装或签名校验会失败。

## GM 调试通道

```bash
curl -s -X POST -d 'plan keys' http://127.0.0.1:8089/gm   # 任务/客户端上报 key/协议观测/覆盖审计
curl -s -X POST -d 'farm full'  http://127.0.0.1:8089/gm   # 三叶草田长满
curl -s -X POST -d 'pot list'   http://127.0.0.1:8089/gm   # 花盆
curl -s -X POST -d 'map open'   http://127.0.0.1:8089/gm   # 打开游戏内地图
curl -s -X POST -d 'cdkey'      http://127.0.0.1:8089/gm   # 兑换码列表
curl -s -X POST -d 'fx'         http://127.0.0.1:8089/gm   # 点击特效
```

指令由客户端每约 3 秒轮询一次（**只在 WebView 处于前台时**；切后台后 JS 计时器会被冻结）。

## 测试

```bash
bash tools/verify.sh          # 80+ 步, 全部走 Node 假壳, 不需要设备
node tools/planstest.js       # 单个功能
```

测试壳需要一个从你自己 APK 里取出的资源目录（仓库不含）：

```
apk/assets/game/resource/China/default.res.json
tables/resources_json.json
```

## 任务系统的一点说明

`new/plan_templates.json` 是纯数据：每个周期（日/周/半月/月/季/年）一份候选任务池。
新增任务时必须保证该任务的事件**真的有出口**，为此内置了覆盖审计：

- 服务端事件 → 必须登记在 `plans.js` 的 `EVENT_SRC` 并在 `planhooks.js` 挂钩；
- 客户端行为任务（`CLIENT_*`）→ 必须能对上一个**协议观测到的界面 key**
  （`planhooks.js` 观测 20+ 个界面开启协议，另外还有一层"全协议计数"）；
- 两者都没有 = 这条任务永远做不完，`/gm plan keys` 与 `planstest` 的审计断言会直接报出来。

## 已知限制

- 只做单机：排行榜、充值、真实好友/分享、活动公告等联网功能不实现（见 `联网功能清单.md`）。
- 存档是本机 JSON，不是真实服务端数据库，删掉即重开。
- 版本跟随 v1.0.20 客户端协议；客户端更新后协议可能需要重新对齐。

## 许可证

**MIT** —— 本仓库全部内容（`new/` 协议实现、`tools/` 工具链、数据文件、`protocol_spec.json` / `spec_auto.json` 协议说明、笔记文档）均以 MIT 协议开源，全文见 [LICENSE](LICENSE)。

## 版权与免责

- 本项目仅供个人学习、研究与交流，使用本项目产生的任何后果由使用者自行承担，请支持正版。
- 仓库内不含游戏安装包、美术资源、音频与数据表；《旅行青蛙·中国之旅》及其全部内容的著作权归原厂商所有，
  MIT 协议**仅覆盖本仓库自有代码**，不涉及任何游戏内容。
