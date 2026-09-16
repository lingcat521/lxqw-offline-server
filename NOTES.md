# lxqw 离线模拟服 — 工作笔记

## 目标
《旅行青蛙·中国之旅》com.aligames.lxqw.hhb v1.0.20，Egret HTML5 + WebView 套壳。
要在 APK 内部的 JS 里实现单机模拟服，使除联网功能外完全可离线还原玩法。

## 关键事实(已实测确认)
- 游戏本体 100% 本地: assets/game/ 4404 个文件(含 resource/China 全部美术/动画/音效)。
- 请求通道: core.SocketManage.prototype.send(name,...) 组装 {name, params} → egret.HttpRequest POST 到 GameConfig.serverURL。
- 回包(HTTP): onGetComplete 解析 JSON {name, params} → ServiceDispatcher.dispatchEvent(new core.Event(name, params))。
- 回包(WS 推送): AnalysisProtocol 解析 JSON {cmd, data} 或 {session, data}。
- 推送通道: egret.WebSocket → GameConfig.serverList[0]；**连接成功(ConnectionSucceed)才会设置 serverURL 并继续登录**，
  所以模拟层必须伪造 socket 连接成功。
- 协议表: ProtocolList.protocolList = 245 条协议(命令名 + 参数名数组)，其中 78 条有客户端 handler。
  handler 方法名 == 协议名 (addProtocolCallback → protocolCallback → this[eventType](params))。
- 登录链: client_hello → hall_gen_token → hall_login → hall_reconnect → hall_enter_game → client_load_role → notify_reload
- 账号门: Ejoy SDK 走 lua/native: sdk.Login({server,platform}) 需返回 {code:0, token, game_token, pinfo}。
  全局: window.ALISDK (LoginSDK/Platform.FTGameSDK/AnnSDK)，另有 EjoySDK.instance()。
- 原包已被前人改过(v11)且**启动是坏的**: index.html 有两个连续 <script> 开标签，导致 shim 与 boot 代码都变成纯文本。

## 目录
- 工作区: /data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw
  - apk/            从 APK 无损解出的 181 个 js/html/json (main.min.js = 1333997 B)
  - new/            我生成的新 index.html / manifest.json / mock.min.js
  - tools/ctx.py    安全上下文搜索(避免 grep 打印 1.3MB 单行)
  - tools/spec.py   从 handler 提取每条协议所需字段 → protocol_spec.json
  - logs/game.log   游戏内 console 日志(经 __log shim POST 到 127.0.0.1:8088)
- MT 工作区: workspaceId=vu4zm3ss, editSessionId=8e6fdf07
- 产出 APK: /storage/emulated/0/MT2/mcp/lxqw_offline_v12.apk (313603213 B, 已签名, 与原包同证书)

## v12 做了什么
1. 修复 index.html: 去掉重复 <script>，shim 与 boot 各成一块；shim 用 text/plain POST 到 127.0.0.1:8088/__log。
2. manifest.json 的 game 列表追加 js/mock.min.js，version → 1002。
3. 新增 assets/game/js/mock.min.js v0.1.0:
   - 覆盖 SocketManage.prototype.send → MockServer.handle(name,params) → setTimeout 后按 HTTP 回包路径 dispatch。
   - 伪造 core.Socket.prototype.connect/connectByUrl → socket_Connect() 触发 ConnectionSucceed。
   - 覆写 SDK Login / jsInvokeLua / jsInvokeLuaUseLongCallback 返回假成功。
   - 已实现: client_hello, hall_gen_token, hall_login, hall_reconnect, hall_enter_game, client_load_role。
   - 其它协议先返回 {} 并打 NO-HANDLER 日志。

## 下一步
1. 真机安装 v12 并启动，读 logs/game.log 看跑到哪一步停。
2. 按日志补齐协议 handler(优先 *_load 系列 + notify_reload)。
3. spec.py 输出的 protocol_spec.json 是字段依据；逐条实现。


## 【关键】v11 的坑之二:首页地址被改到外部服务器(这才是"只显示 ok")
- com.Aligames.lxqw.MainActivity 的 onCreate 里:
    const-string v2, "http://127.0.0.1:8088/"   →   WebView.loadUrl(v2)
  上一个改包人把 WebView 首页指到一个本该外部运行的本地服务器(8088)。
  于是 APK 内的 assets/game 从未被加载;我的日志服务器恰好占着 8088 并对任何请求回 "ok" → 屏幕只显示 ok。
- 实测证据: logserver 记录到 GET / 和 GET /favicon.ico(浏览器导航),且没有收到页面 shim 的 BOOT(说明加载的不是 assets 页面)。
- 好消息: 该处 WebSettings 用 const/4 v2,0x1 开启了
  setAllowFileAccess / setAllowFileAccessFromFileURLs / setAllowUniversalAccessFromFileURLs = true,
  所以 file:// 页面可以 XHR 读本地 manifest.json,也可以 POST 到 127.0.0.1:8088(日志通道有效)。
- v13 修复: 把该 const-string 改为 "file:///android_asset/game/index.html"。
  已在构建出的 APK 里用 dex_strings 复核:android_asset/game 命中,127.0.0.1:8088 已消失。

## 版本
- v12: 修 index.html + mock v0.1(参数偏移错、不回调) → 装上去只显示 ok(实为 MainActivity 问题)
- v13: MainActivity 首页改回 assets + mock v0.2(见下)
  mock v0.2 修正:
   * SocketManage.send(name, callback, ...args) → 参数从 arguments[2] 起(原来错用了 [1])
   * 按 ProtocolList.protocolList[name][1] 判断是否需要响应;有 callback 则回调
   * dispatchEvent(new core.Event(name, resp, sentParams)) → handler(resp, sent)
   * 新增 30+ 条启动期协议(login 链、*_load 系列等)按 handler 契约返回正确结构
   * 未实现的协议返回"万能容错值"flex(任意属性可达、可当 0/""/[]/{} 用),避免 undefined.length 崩溃


## v0.6:契约自动提取 + 自动生成 mock(不再依赖设备迭代)
思路:客户端 handler 的源码就是接口契约。把每个 handler 抽出来,用**记录属性访问的 Proxy**当参数在 Node 里执行,
它读什么就精确记下什么(循环体里的嵌套字段也能记到),再据此自动生成响应。

工具链(都在 tools/):
- probe2.js  执行所有 handler,记录字段路径 / 数组标记 / 是否依赖第 2 个参数(请求参数)
  要点:with(scope) 的 Proxy 必须让 Symbol.unscopables 返回 undefined,否则作用域全部失效;
        自定义 Array.isArray 与 Utils.convertArray 用于反推"这个字段是数组"。
- gen.py     把 probe_out.json 变成 new/handlers_auto.js(含类型推断)+ pushlist.json
- smoke.js   桩环境加载 mock,逐个调用所有 handler + 跑登录链与推送,验证 0 报错
- 产物:new/mock.js 由 [plumbing] + [auto handlers] + [manual overrides] + [push] 组装而成
- 已用 warden: 8089 devserver 提供 new/mock.js,APK 内只放 1KB loader → 改 mock 无需重装

结果:78 条协议被探到,63 条生成 handler,0 个调用错误;
      3 条协议依赖请求参数(rank_load / rank_get_intro / mail_load_mails)→ 不能推送;
      推送列表 45 条(数据驱动,自动生成)。
离线端到端自测:登录链 + 推送 → 51 个 dispatch,0 条推送无人接收。

## 仍待补齐(语义层,不是结构层)
生成出来的值结构正确但**语义为空**(空列表/0)。要"完全还原"还需按玩法填真实内容:
道具/家具 id、旅行带回物、商店、抽卡池、邮件等 —— 数据来源只能从客户端资源(TravelNoteDB、
item 表、furniture 表等客户端内置配置)反推,后续从 default.res.json / eab / 客户端 DB 里挖。


## v0.7:破解配置容器 → 语义数据自动化
关键突破:游戏的数据表全在 assets/game/resource/China/eab/config.eab 里,是**加密 EAB**(头部第7字节 0x1B)。
- 格式:[8B header 89 45 41 42 0d 0a 1b 0a][XXTEA 密文]
- 密钥:Utils.simpleEncrypt("r]|lnf\x80X\x81U\x82aq_r",13)(偶数位-13/奇数位+13)→ **ejoyassetbundle**
- 解密后:[uint32LE metaLen][meta JSON: [{n,f,s,t}]][各条目数据]
- 注意:读源码取密钥字符串必须按**字符**(UTF-8 文件里 \x80 是两字节),否则密钥错、长度校验失败
- 工具:tools/eabdec.py(解密+导出)→ tools/dumptables.py(导出 61 张表到 tables/)
- 另一套普通 EAB(0x1A)用 decodeEAB(FILE_HEADER/META_LENGTH=4)直接解,见 tools/eabdump.py

导出结果(61 张表):Item 411 件、Note 191 条、furnitureData 324、furnitureShopData、Shop 22、
encyclopedia/encytravel、story 25、taskData、calendarData、Collection 62、Specialty 64、
lotteryData、visitors、step、drawing*、cook/museum/partyCake/pray/tumbler/pocket 等。
客户端映射:DataManager 里 ItemDB=i("Item")、TravelNoteDB=i("Note")、CollectDB=i("Collection")…

语义层:
- tools/gensem.py 读 tables/ 生成 new/semantic.js(真实 id 回填 14 条协议:
  item_load_items(bag=[0,1,2,3])、travel_load_note(1000-1002)、furniture_load_furniture(真实家具店)、
  item_load_shop_info(22 商店位)、lottery_load、story_load、task_load、encyclopedia_load、visit_load 等)
- mock.js v0.7 在启动时同步拉取 8089/semantic.js,eval 后 MOCK_SEMANTIC 优先于自动 handler
  → 改语义只改 new/semantic.js,重开 app 即生效,仍然不用重装

当前产物链:new/handlers_auto.js(结构) + new/semantic.js(真实数据) + new/mock.js(引擎) → 8089 devserver


## v0.8:补上「发送+回调」型协议(改名卡住的根因)
现象:真机日志里 client_set_name / client_rename_cost 反复 NO-HANDLER + NO-LISTENER,用户改名一直失败。
根因:probe2 只提取**注册了 handler 的**协议(addProtocolCallback),而这类协议是
      send("X", new core.Action2(function(响应数据, 请求参数){...})) —— 没有 handler 方法,只靠回调。
新增 tools/probe3.js:扫描所有 .send("NAME") 调用点,用括号配对取出实参,把其中的
      Action 回调函数也用记录 Proxy 跑一遍 → 得到响应字段契约。
      结果:185 个调用点,103 条协议拿到回调契约(如 lottery_open → {open_item:{count,item_id}, extra_item})。
契约合并:probe_out.json(推送/监听) ∪ probe_callbacks.json(回调) → gen2.py → 163 条 handler(原 63)。

Action 语义(已核实源码):
  Action1.prototype.apply=function(e){return this.call(e)}; Action2=call(e,t); Action3=call(e,t,i)
  原版 AnalysisProtocol 用 s.apply(r.data, o.data) → 回调收到 (响应数据, 请求参数)
  mock 的 callCb 做同样的 cb.apply(resp, sent) → 行为一致(已用 faithful Action shim 离线验证)

另一个坑:errcode_json 表**不在 APK 里**,getErrorInfo() 返回 undefined,
  rename 里 "a && 0==a.code" 判定失败 → 不更名。已在 mock 启动时给 MessageModel.prototype.getErrorInfo
  打补丁返回 {code,msg}。

改名契约:client_rename_cost → {clover:N}(N>0 会弹确认框);client_set_name → {code:0,lucky:0}
已离线验证:client_rename_cost→{clover:0}; client_set_name→{code:0,lucky:0}; 回调收到正确的 respData


## v0.9:有状态玩法模型(rules.js)
发现:交互类协议(item_buy / item_putin_* / clover_harvest 等)**回调字段基本为空** ——
      真服务器是「请求→ack→再推送更新后的状态」。所以 mock 必须是**有状态**的。

新增 new/rules.js(tools/genrules.py 生成):
- 状态 window.MOCK_STATE = {clover, ticket, bag[], desk[], house[], notes[], furnitureShopBought[]}
- ITEM_PRICE(411 件价格)、SHOP_ITEM(22 商店位→itemId)、NOTE_IDS 从 tables/ 生成
- 已实现:
  item_buy(扣三叶草→入背包→推 item_load_items/clover_update)
  item_putin_bag / item_takeout_bag / item_putin_desk / item_takeout_desk(背包↔桌子)
  item_load_items / item_load_shop_info / item_select_gift
  lottery_open(随机道具入包) / lottery_select
  task_get_reward / task_get_list_reward(加三叶草)
  travel_load_note / travel_read_note(已读标记)
  clover_harvest / clover_update / furniture_buy_shop
  client_rename_cost / client_set_name
- 状态变更后通过 window.MockServer.dispatch 推送新状态(与真服务器同路径)

mock v0.9:启动时依次加载 semantic.js + rules.js(都在 8089,热更新,无需重装)

离线验证:buy(shop_id=0) → clover 1000→990、bag 不变(已有 item0);
          putin_desk(0) → bag [0,1,2,3]→[1,2,3]、desk []→[0];
          lottery_open → {open_item:{item_id,count}}; travel_load_note → 真实笔记


## v0.10:修复「整体替换」型协议的完整性问题
真机日志(v0.9 session)报:
  DISPATCH-ERR furniture_load_furniture : Cannot read properties of undefined (reading 'length')
根因:该 handler 是 this.serverData = e **整体替换**。我们只回 {shop,replace_fur,...},
      缺 put_fur → getHomeFurnitures() 返回 undefined → loadFurnitureRes 里 e.length 抛错。
      (task_load 的 'type' 同类:dataList 与 TaskDB.list_map 不匹配)
系统化修法:tools/defaults.py 扫出模型里所有 this.X={...} 默认容器,得到完整字段集:
  FurnitureModel.serverData={shop{start_time,leave_time,shop_list},mood,bench_lock,bench[],put_fur[],has_fur[],mate_list[],replace_fur[]}
  tumblerData / compostData / pocketData / flowerpotData ...
新增 new/defaults.js 覆盖这族协议,返回**完整对象**;并给出初始院子套装 put_fur(家具 type 1..8 的基本款)。

另外:
- rules.js 里 furniture_buy_shop 把对象当函数调用 → 已改为 (typeof f==='function'? f() : f)
- mock 现在依次加载 semantic.js → defaults.js → rules.js(后者优先)
- !wants && !hasCb 的协议不再调用 handle(减少无意义日志与开销)
- 家具商店 172 条(furnitureShopData,引用 item_id 指向 furnitureData)

验证:furniture resp keys = shop,mood,bench_lock,bench,put_fur,has_fur,mate_list,replace_fur;
      put_fur = 8 件基础家具;shop_list = 172;四层文件语法全部通过


## v0.11:旅行循环(核心玩法)
语义确认:RoleModel.isHome = (0 == getFrogStatus()) → **frogStatus 0=在家,非0=出门**;
          TravelEventInfo={id,evt_type,evt_id,evt_value[],evt_string[],evt_pic[]}
实现(rules.js):
- MOCK_STATE.frog={status,motion,todayStep,traveling,returnAt,nextNote}
- item_putin_desk 放入**食物**(Item.type==0)且未在旅行 → depart():
    status=1,motion=1,returnAt=now+90s,推送 client_load_role
- setInterval(4s) 检查到点 → comeBack():
    挑一条**未拥有**的真实 Note id 加入笔记(去重)、随机特产入 gifts、三叶草 +30,
    推送 client_load_role + travel_load_note + clover_update
- client_load_role 移入 rules.js(frog.status/motion 反映当前状态),优先级高于 mock 手写版
- 新增 travel_load_gift / travel_gift_to_bag / travel_bag_to_gift / travel_depart_now(调试用)

离线端到端验证:
  role status=0,notes=3 → putin_desk(item0,type0) → desk=[0], status=1,traveling=true
  → 到点后 status=0, notes=4(1000,1001,1002,**1003**), clover 1000→1030, gifts=1
  → dispatch: item_load_items, client_load_role×2, travel_load_note, clover_update
修复:新笔记去重逻辑(原来总是取 NOTE_IDS[0],已有则跳过 → 永远不新增),改为向后找未拥有的 id
TRAVEL_SECONDS=90(测试用,真游戏是小时级)


## v0.13:修崩溃(背包渲染板式)+ 存档 + 免费内购
### 崩溃根因(用户报"点击准备后崩溃")
日志:点商店购买按钮(this.selectedId1 0)3.5s 后开始逐帧
  EXC: Cannot read properties of undefined (reading 'image') @main.min.js:13
源码:
  this.itemModel.getBagDataList().forEach(function(t,i){ ... e.items[i].image.source = ... })
  同文件里:this.items.splice(2,2)   // 引导到 GuideStep.OpenBag 时 UI 格子被砍到 2 个
根因:我给的初始背包是 [0,1,2,3] **4 个**,UI 只有 2 个格子 → e.items[2] undefined → 每帧崩。
    并且客户端用 **-1 表示空槽**(if (-1 !== t) / setBagData(e,-1)),我用的 null 也不对。
修复:bag/desk 改为**固定 8 槽**(SLOTS()),空槽 -1;新手背包**初始为空**(真游戏也是空的,先买);
     item_buy 放入第一个空槽;putIn/takeout 做边界检查,数组永不增长。
    ★这正是用户提醒的"渲染板式必须与服务器一致":数组长度==UI 格子数,空槽值==客户端约定。

### 另一处板式错误
item_load_shop_info 客户端读的是 e.purchased → purchasedMap[item_id]=count(已购数量);
商品列表用的是客户端自带 ShopDataDB,服务器不提供列表。原来返回 {list: SHOP} 完全被忽略 → 已改为 {purchased:[]}。

### 存档持久化(v0.12 起,已验证)
- devserver 增加 POST /save(落盘) 与 GET /load
- new/persist.js:启动时 GET /load 合并进 MOCK_STATE;包装 MockServer.handle 后每次调用触发 1s 防抖保存;每 8s 兜底保存
- 真机日志已验证: "save restored: clover=980 notes=3 bag=[0,1,2,3]" (旧状态,已清)
- 存档文件: lxqw/save/state.json

### 免费内购(v0.12 起)
- new/iap.js:接管 RechargeModel.prototype.pay → 直接按 recharge_json 发放三叶草(400/1000/1800…),
  推送 clover_update + recharge_update_num,不再走原生 IAP
- 另实现 recharge_load / recharge_load_gift / recharge_update_num / recharge_water / recharge_change /
  recharge_ready_pay / recharge_cancel_pay

### 本轮同时修复
- 白屏(季节):pushEarly 改为**先推 weather_load 再推 client_load_role**;并给 WeatherModel.getSeasonKey
  打兜底补丁(数据缺失时返回 ENV),已离线验证 seasonKey=32
- 访客洪水:visit_load 不再返回 visitor(省份名必须命中 provinceList 键),acquire 改为**省份名**数组;
  新增 visitor_invite 用合法 province+actionList 组合


## v0.14:响应校验器 + 图鉴真实数据
### tools/validate.js(防"板式不一致"的系统化工具)
思路:把**我们 mock 返回的每条响应**,喂给**客户端自己的 handler** 在 Node 里真实执行,捕获:
  - 抛出的异常(handlers[i].image / .length / .toString 之类)
  - 客户端自己的告警(core.Log.warning:"返回的协议 X 中的 Y 属性不存在")
做法:抽取 prototype.<协议>=function(...){body}(只取 protocolList 里的 245 个名字),
      with(autoProxy) 作用域 + 自动 this + 捕获 Log.warning。
结果:78 条 handler 型协议全部执行,**CLIENT WARNINGS = 0**,仅 rank_get_intro 抛错
      (它依赖请求参数 t,单测必然缺 t,属预期)。
用法:node tools/validate.js > logs/v.out(注意:mock 的 setInterval 会让进程不退出,用 timeout 包一下)

### 该工具的边界(重要)
它只能覆盖 **handler 层**的数据形状;而之前的两次崩溃属于 **view 层**约束:
  - 背包:UI 格子数(this.items.splice(2,2))必须 ≥ 服务器数组长度;空槽必须是 -1
  - 季节:主场景在构造时**一次性**取 seasonKey(必须先推 weather_load)
这类约束没有通用检测法,已在 NOTES 里逐条记录。

### 图鉴(encyclopedia / encytravel)真实数据
从 config.eab 的 encyclopedia_json / encytravel_json 的 desc 生成:
  unlock_list=id 列表;unlock_desc=[{id,list:[4 行说明]}];show_sub=[{id,sub_id}]
  encyclopedia 23 条(金虎尾目-堇菜科…/花语…),encytravel 98 条
新增 encyclopedia_set_show_sub / encytravel_set_show_sub

### 修复
genrules.py 因缺少 eau/ead/eas 定义而生成失败(静默,上次 rules.js 未更新)→ 已补定义,重新生成成功


## v0.13: 邮件系统 + 渲染一致性审计
### tools/audit.js (静态渲染审计, 零噪声)
对每个 ItemRenderer 静态抽取它读的 this.data.<path>, 与我们 payload 的键对照, 输出 MISSING 表.
抓到并修复的真实板式错误:
  FurnitureShopItem 读 this.data.{shop_id, num, item_id}; 我们原来直接返回 furnitureShopData 原样
  (只有 id/item_id/limit/price, 没有 shop_id/num) -> 家具店显示 剩 undefined 个, 价格查不到.
  修: FUR_SHOP 每条映射为 {shop_id, num(库存), item_id, ...原字段}
  RechargeFieldItem 还读 this.data.total -> 田地槽补 total:100
现状: 所有真实渲染器 MISSING=none (RechargeMerch/RechargeGiftPage/CalendarNoteView 是空列表或映射噪声)
### 充值界面 (按 RechargeModel 契约填真数据)
  recharge_load -> {water, change, field:[{id,grow,total}], sack:[{id,goods:[{id,num}],price}]}
  field[i].id 用于 pay(); sack[i].goods 用于展示; RechargeMerchItem 读 this.data.image
  field/sack 由 recharge_json 6 档 (400/1000/1800/2800 三叶草) 生成; recharge_merch -> {list:[]}
### 邮件系统 (new/mail.js, 真实 MailEvent 表)
  MailEvent 第一封: 恭喜您完成教程! + 500 三叶草 (用户问的新手教程三叶草就在这里)
  硬约束: 客户端 revice_mails 里 var n = t.resource.ads_id; 没有 null 检查
  => 每条邮件必须带 resource:{clover_point,ticket,ads_id}
  条目: {id,title,message,type,read,opened,resource,items:[{item_id,count}]}
  mail_load / mail_load_mails / mail_open(发奖并入背包) / mail_read
  mail_open 必须真加三叶草并推 clover_update, 否则客户端本地加了会被我们下次推送覆盖
### 存档迁移
  persist.js 恢复时 norm8(): 旧存档非 8 槽的 bag/desk 规整为 8 槽 (-1 空槽)
### 验证
  node tools/validate.js -> 78 协议, CLIENT WARNINGS=0, 仅 rank_get_intro 预期异常
  node tools/audit.js    -> 真实渲染器 MISSING=none
## v0.14: 全界面渲染一致性审计 + 活动层
### tools/catalog.js
自动编目客户端 **54 个条目渲染器** 及其读取的 this.data.* 字段(从 dataChanged 方法体静态抽取).
### audit.js 扩展到 23 组 渲染器<->协议 映射
抓到并修复的真实字段名错误(与之前 shop_info 同类):
  **museum_load**: 客户端读 e.museum_list, 我们返回 {list:[...]} -> 已改为 {museum_list:[...]}
  **wishingpool_load**: 客户端 this.data=convertArrayAll(e) 后读 end_time/coin/items; 我们返回 {wish_list:[]} -> 已改为 {end_time,coin,items}
  **partycake_load**: 客户端读 end_time/cream/sugar/pre_cream/pre_sugar/cur_state/part/layers/task_list/share_get -> 已按此结构返回
  item_select_gift: 补 is_selected
### new/activities.js (v0.14)
  museum_list 来自 museumData(5 条真实展品); cooking theme 24 个; cake 5 个
### 当前审计结论
  23 组映射中 7 组 MISSING=none; 其余全部是**空列表**导致(活动未开启/还没旅行, 没有条目可渲染), 非板式错误
### 真机验证(18:15 那次会话)
  0 异常; 存档槽位自动规整 bag=[0,1,2,3,-1,-1,-1,-1]; 三层(persist/iap/mail)加载正常
  之前 18:15:35 之前的 .image 报错属于上一会话(旧 rules), 安装 v0.13 之后不再出现
## v0.18: 崩溃根因(商店)与三层防护
### 真机证据
  18:48:35 this.selectedId1 0 (点商店购买) -> 18:48:38 EXC reading 'image' (逐帧)
  18:37:34 点购买 -> 18:37:38 崩; 两次都是点商店购买触发, 与访客无关(访客是误判)
### 客户端商店列表的真实来源(读源码)
  ShopView.getAllItem(): for (n=0;n<ShopDataDB.count();n++){ r=ShopDataDB.index(n);
      o = ItemDB.get(r.itemId).img   // <-- 无 null 检查!
      shopItemsData.push({id,itemId,img,price,info,name,soldout,order}) }
  ShopItem.update(e): itemName.text=e.name; price.text=e.price.toString(); img.source=formatPathImage(e.img)
  => 列表完全由客户端自带表构建, 服务器只通过 purchased 影响限购; 但 ItemDB 查不到就直接取 .img 会崩
  isShopItemBuyLimit(e): purchasedMap[e] 的 key 是**商店 id**(我们原来用了道具 id) -> 已修
### 三层防护(本轮新增)
  1) guard.js   : 我们发出的引用型 id 先与客户端表核对, 非法则丢弃/替换(道具/笔记/省份/家具/任务/收藏/图鉴)
  2) harden.js  : 给 DataManager 各表 get/getValue 包一层, 查不到返回**结构完整占位对象**(ItemDB/ShopDataDB/
                  FurnitureDB/FurnitureShopDB/FlowerData/rechargeDB...), 从根上消除 'DB.get(x).field' 崩溃
                  (验证: ItemDB.get(999).img.index -> 'goods_1'; 真实数据仍透传)
  3) diag.js    : 捕获未处理异常的**完整调用栈**并上报(__log), 附带最近 12 条协议名 -> 下次崩溃可直接定位函数
### 长度对齐(背包)
  Bag 视图 this.items=[item1,item2,item3] => **只有 3 格**; OpenBag 引导步 splice(2,2) 减到 2 格;
  client 用 bagDataList.forEach((t,i)=> items[i].image) => 服务器数组长度必须 <= 格子数
  修: 背包=3 槽, 桌子=8 槽; settings.client 设 guideStep='Complete' 避免格子被砍到 2;
      persist 迁移 normN(bag,3)/normN(desk,8); guard 强制 clampSlots
### 层清单(v0.18, 8089)
  semantic -> defaults -> rules -> persist -> iap -> mail -> activities -> visitor -> guard -> diag -> harden
## v0.19: 崩溃点精确定位(靠调用栈)——背包 renderItem
### diag.js 拿到的调用栈(决定性)
  Cannot read properties of undefined (reading 'image')
    at main.min.js:13:6946 <= Array.forEach <= t.renderItem (13:6498) <= t.onAddToStage (13:4181)
  按列号切出代码,确认就是 Bag.renderItem:
    this.items=[item0,item1,item2,item3];                  // 背包 UI = **4 格**(不是我先前以为的 3)
    if (guideStep==GuideStep.OpenBag) this.items.splice(2,2); // 引导那步 -> **只剩 2 格**
    getBagDataList().forEach((t,i)=>{ ... e.items[i].image ... })   // 数组长度>格子数 -> 崩
### 修法(动态格子数)
  guard.js 新增 bagCap(): 直接读客户端实时状态 core.ModelManage...getClientSettings().guideStep
    guideStep=='OpenBag' -> 2 格, 否则 4 格; 按此裁剪 bag 数组长度
  背包默认 4 槽, 桌子 8 槽; persist 迁移 normN(bag,4)/normN(desk,8)
### 兜底(通用视图护盾)
  harden.js 增加 shieldMethods(): 扫描 window 上所有带 renderItem/onAddToStage/dataChanged 的类,
  统一包 try/catch -> 即使还有未知的索引错位, 也**不会再逐帧崩溃**(每方法最多打 3 条告警)
  验证: 注入一个必抛的 Bag.renderItem -> 被拦截, 不再抛出
### 经验(写给以后的自己)
  · 客户端里 '服务器数组下标 -> 固定 UI 格子' 的写法只在 renderItem/onAddToStage 里, 必须长度对齐
  · 格子数不是猜的: 直接读类里的 this.items=[...] 初始化, 或读运行时 guideStep 之类的状态
  · 先拿调用栈再动手(diag.js), 不要靠日志行号猜
## v0.19: 邮件领取不入账 -> 刷新死循环(根因: 我自己的跳过优化)
### 现象(用户反馈)
  新手教程后送 500 三叶草 -> 领取 -> 需要刷新 -> 刷新后数据全没 -> 又回到新手教程(死循环)
### 证据
  devserver: SAVE/LOAD 一直在正常跑(每 8s 一次, 重开能恢复) -> 存档本身没问题
  但存档里 mailTaken: []  -> **领取从未被记录**, 所以三叶草从未真正入账
### 根因(mock.js 自身 bug)
  我之前为减少日志噪音写成:  var resp = (wants || hasCb) ? Mock.handle(...) : null;
  mail_open 的协议定义是 [[id],!1] —— 不需要响应, 于是 handle() 被整个跳过;
  而 mail_open/mail_read/client_set_client/guest_confirm 这些**正是要改服务器状态的**。
  状态没改 -> 没入账 -> 刷新后回到原点 -> 无限循环。
### 修法
  handle() 永远执行(状态该改就改), 只是 wants=false 且无回调时不回包。
  验证: mail_load 2 封 -> send('mail_open', null, 0) -> clover 1000->1500, mailTaken=[0], 邮件剩 1 封
### 附带(本轮同时完成)
  · 客户端固定格子数全量扫描(tools/cells.py): 只有 Bag=4 格(OpenBag 时 2 格)、Table=8 格、Item=4/8 格
    -> 服务器数组只有 bag/desk 与之耦合, 均已按动态格子数裁剪
  · guard.bagCap() 读不到客户端状态时保守取 2
  · 视图护盾: renderItem/onAddToStage/dataChanged 全部包 try/catch, 不再逐帧崩
## v0.20: 用客户端真实 renderItem 离线复现崩溃 + 验证修复
### 工具 tools/reprobag2.js(可回归)
  从客户端源码里扫描所有 renderItem=function(){...}, 挑出 body 含 getBagDataList 的那个(Bag 的),
  用桩环境(this.item0..item3 = 图片元素, DataManager/ItemDB/Tabikaeru.path 等)直接执行它,
  喂入不同 (guideStep, UI 格子数, 服务器背包长度) 组合。
### 结果(与真机报错一字不差)
  WITHOUT shield:
    Complete, 4 cells, bag=4 -> no throw
    OpenBag , 2 cells, bag=4 -> Cannot read properties of undefined (reading 'image')   <-- 真机崩溃复现
    OpenBag , 2 cells, bag=2 -> no throw          (bagCap 修复生效)
  WITH shield:
    OpenBag , 2 cells, bag=4 -> SHIELDED: ...     (护盾兜住)
### 结论
  崩溃根因确认 = Bag.renderItem 里 'this.items'(UI 格子, OpenBag 时 2 格) 与
                 'getBagDataList()'(服务器数组) 长度不匹配。
  修复双层: (a) 按客户端实时 guideStep 动态裁剪数组长度 (b) renderItem 全部包 try/catch。
  这两个修复已在离线用真实客户端代码验证。
## v0.20+: 全量自动审计 + 一键回归脚本
### tools/audit3.js(全自动配对)
  扫描全部 54 个 ItemRenderer 的 this.data.* 读取, 与 36 个真实 payload 条目形状按字段重合度自动配对。
  抓到缺口: **GuideTaskListItem 读 data.pro** —— task_load 的进度来自 list:[{id,pro}], 我一直发空数组。
  修: activities.js 内嵌 67 条真实任务配置 + 67 条 {id,pro} 进度。
### tools/verify.sh(一键全量回归, 每轮都跑)
  1) 12 层语法   2) 8089 全部 200   3) handler 契约校验(validate.js)
  4) 渲染器<->payload 审计(audit.js)  5) 用客户端真实 renderItem 复现崩溃(reprobag2.js)
  6) 动态背包格子数(captest.js)
  当前结果: 语法全 ok / 服务全 200 / 78 协议 0 告警 / 崩溃复现确认双向修复 / OpenBag->2格 Complete->4格
### 待办
  · 真机确认三步(重开): 领500三叶草 -> 刷新保留 -> 商店购买不崩
  · 空列表活动(祈愿/贺卡/相册照片)按同法补语义
 ## v0.21: 新手教程死循环 —— 真根因(不在存档, 在 pushEarly 绕过语义层)
 ### 现象
   教程过完 -> 领 500 三叶草 -> 刷新 -> 又回到新手教程, 感觉"存档没存"。
   存档其实一直在(bag/desk/notes/mailTaken 都对), 丢的是**客户端设置**。
 ### 关键事实(读客户端 main.min.js 得到)
   UserModel.client_load_role(e,t) 里:
     var r = e.settings;
     if (r != null) { var o = r.client; if (!isNullOrEmpty(o)) JSON.parse(o) 逐键并入 this.clientSettings; ... }
     else warning("返回的协议 client_load_role 中的 settings 属性不存在…")
   即 **guideStep(教程进度)不在本地, 就是服务器 settings.client 这个 JSON 串**;
   玩家每次 setClientSettings 都通过 client_set_client(client=<json>) 回传服务器。
 ### 真根因
   mock.js 的 Mock.pushEarly() 写的是:
     dispatch("client_load_role", Mock.handlers["client_load_role"]({}));
   它**直接调桩表 handler**, 绕过了 Mock.handle() 的 "MOCK_SEMANTIC 优先" 逻辑,
   于是每次启动都发 settings.client="{}" (桩值), 客户端 guideStep 保持默认 New
   -> 每次刷新都从新手教程开始。rules.js 里那段 "guideStep":"Complete" 从来没被发出去过。
   (顺带: 桩里 res.clover_point 用的是 Mock.state.clover=1000, 不是存档值。)
 ### 修法(两处)
   1) mock.js pushEarly 改走 Mock.handle("weather_load"/"client_load_role") -> 语义层生效;
      版本 0.19.0 -> 0.20.0
   2) rules.js / genrules.py 新增 client_set_client 处理 + DEFAULT_CLIENT_SETTINGS,
      角色包 settings.client = JSON.stringify(ensureClientSettings())
      · ensureClientSettings() 每次 role 推送前补齐缺键(旧存档/部分存档自动修复)
      · roleSent 守卫: 角色包发出前的 client_set_client 一律忽略
        (那时客户端只有 SettingsInfo 默认值 New, 接受它会把存档打回新手教程)
      => guideStep 现在真正走 /save /load 持久化(与三叶草同一条路)。
 ### 回归 tools/tuttest.js(已并入 verify.sh 第7步, 11 项)
   用真实层文件跑, 并模拟"刷新"(persist 恢复 MOCK_STATE -> 重新 eval 所有层):
     [1] pushEarly 推的 guideStep=Complete / clover_point 是存档值 / 不再走桩
     [2] client_set_client 后 guideStep=OpenBag, 刷新后仍是 OpenBag, 三叶草=存档
     [3] 角色包之前的写入不会覆盖存档
     [4] 缺 guideStep 的旧存档被修成 Complete, 已存键保留
   反向验证: 把 pushEarly 改回旧写法 -> [1] 立即 FAIL(guideStep undefined), 证明测试抓得住该 bug。
 ### 附
   · 本轮改动全是 new/*.js 热更新, 无需重装 APK; 重启游戏(WebView 重新加载)即可生效。
 ### 端到端回归 tools/e2eclaim.js(verify.sh 第8步, 16 项)
   完全按真机启动路径模拟: 只手工 eval mock.js, 其余层由 mock.js 自己的 XHR 加载器加载,
   persist.js 直连假 dev server(GET /load, POST /save)。
   流程: 首启 -> 推送 role(guideStep=Complete, clover=存档值) -> 领 500 -> 等 debounce 1s 落盘
        -> "刷新"(persist 真实 /load 恢复) -> 三叶草/邮件/教程进度三项全部保留。
   16 项全过。
 ### 附2
   · 现存档(clover=840, notes=3)不动即兼容: 老存档没有 clientSettings 字段,
     ensureClientSettings() 会在首次推送前补上 guideStep=Complete;
     之前启动时界面上的三叶草会显示桩值 1000, 现在是存档值 840。

 ## v0.23: 契约审计器 + 全事件探针 + 屏幕适配/充值/undefined 修复
 ### 1) tools/contract.js —— 把"年度回顾 undefined"变成一类可自动发现的问题
   做法: 从 main.min.js 里按协议名抓出客户端的响应处理器 <proto>=function(e,t){...},
        收集它对第一个参数 e.<字段> 的读取(剔除 JS 内建名与嵌套 function 内的读取),
        再与 M.handle(proto,{}) 的实际返回逐字段对比。
   结果: 62 个有真实处理器的协议, 首次运行报 8 处缺字段 -> 其中 5 处是真 bug:
     · pray_load_grays   (祈愿/印章)  客户端读 boxes/stamps/wishs/stamp_new/wish_new
       而我们返回 {list:[]} -> 整个祈愿印章界面全空 + Redot 逻辑拿不到数据
     · partycake_load_qa (蛋糕答题)  客户端读 guest/wrong/answer/reward -> 同样全空
     · museumday_info    (博物馆日)  客户端读 compass/task_num -> 同样
     · item_buy          (商店购买)  客户端还读 ticket/ads_id/share_id(分享换券路径)
     · lottery_load      (兑换券抽奖) 客户端只在 e.phase 为真时整体替换 data,
       旧数据只有 {list,select_list} 没有 phase -> 抽奖页永远停在默认态
   另外 3 处经核查是嵌套作用域误报(wx.checkIsAddedToMyMiniProgram 的 success(e) 等),
   已加入 nestedRanges() 过滤; 现在 contract.js 输出 0 missing。
 ### 2) tools/annualtest.js —— 用客户端自己的文案生成器验证年度回顾
   直接从 main.min.js 抠出 AnnualReviewChatPage.childrenCreated() 的函数体, 在沙箱里
   用我们的 annual_load 返回值真实执行一遍, 断言 12 条文案里没有 undefined/NaN/{0}。
   反向验证: 把旧的 {is_share:false,list:[]} 喂进去 -> 复现
   "一共雕刻了undefined个印章，完成了undefined个祈愿物" —— 证明测试抓得住。
   新增 new/annual.js: 17 个字段全部由存档推导(travel_num/pic_num/stamp_num/wish_num/
   fur_num/note_num/spe_num/col_num/first_col/story_num/clover/visit_num/page_num/
   first_guest/login_day/create_time/is_share), first_col/first_guest 保证落在客户端
   自己的 id/下标范围内。
 ### 3) new/probe.js —— 全事件探针(按你的建议)
   ① egret.TextField.prototype.text  → 任何标签画出 undefined/NaN 立刻带栈上报
   ② i18n _()                        → 在格式化源头抓, 还能抓没被替换的 {0}
   ③ Mock.handle                     → 返回值里显式 undefined 的字段
   ④ core.ServiceDispatcher.dispatchEvent → 服务器发出的每一个协议事件都留一行形状
     指纹(每个事件名前两次 + 任何 UNDEFINED/空对象/占位 Proxy), 没有处理器的协议
     会被点名(PLACEHOLDER-PROXY)。日志走 console.error -> 8088 日志服。
 ### 4) 充值界面(图一)三处
   · "多了一行三叶草": default.res.json 只声明了 btn_pay_1/3/6/18/25_png 五个价格图,
     recharge_json 里的 ¥12 档(id 2)没有对应图标, 那一行渲染出来没有价格牌 =
     多出来的那一行。服务器数据必须"客户端画得出来", 故 field/sack 只发 5 档。
   · 浇水内购: 客户端 onWater 读的是 model.data.field[].grow, 而不是响应体, 所以
     服务器必须在"回答之前"推一份新的 recharge_load —— 现在是这样做的:
       浇水 -> water-1, 每块田 +25, 长满则产出货物(进 sack.goods) -> 推 recharge_load
       兑换 -> 把货物换成三叶草 -> 推 clover_update + recharge_load
       点价格 -> 免付费直接入账(pay 补丁) + 推三叶草/充值数据
     并且 water/change 是"次数"计数器(旧代码把三叶草数量填进 change, 按钮会显示 840次)。
   · tools/rechargetest.js: 20 项断言, 含"recharge_load 必须先于回调"的顺序检查,
     以及"每一行的 money 必须在 default.res.json 里有 btn_pay 图标"。
 ### 5) 屏幕适配(图二 准备键偏移 ~100px)
   实测推导: index.html 是 data-scale-mode="fixedHeight", GameConfig.fullScreen=false,
   于是 Main.updateStageSize() 直接 return, egret 用 FIXED_HEIGHT:
     stage宽 = 1136 * (屏宽/屏高)。本机 CSS 视口约 540x1128 -> stage = 544x1136,
     比 640 的设计宽少 96px —— 正好是"准备键偏移100px"和右侧内容被切掉的原因。
   new/screen.js 在引擎启动前把 GameConfig.fullScreen 打开, 走游戏自带的适配:
     竖屏 -> FIXED_WIDTH, stage = 640 x (640*屏高/屏宽), 再按 maxWidth/maxHeight
     (854x1420) 收敛 -> 本机 640x1338, 一个像素都不裁。
   参数放在 new/screen.json(contentWidth/Height 可当缩放旋钮), 改完重开游戏即可, 不用重装。
   tools/screentest.js 直接用 egret 真实的 calculateStageSize() + 游戏自己的模式选择
   逻辑跑四种视口, 17 项断言(含 "差值≈96px" 与 "fullScreen 后正好 640 宽")。
 ### 回归
   verify.sh 现在 13 步: 语法/服务/handler契约/渲染器审计/崩溃复现/格子数/教程循环/
   端到端领奖/充值/年度回顾/屏幕适配/协议契约/guard —— 需重开客户端才能看到设备侧效果。

 ### v0.24 修正(玩家提问："recharge_json 有6档，但玩家现在只有3档内容？")
   结论: **是 3 档**, 而且有硬证据, 之前"只删掉¥12"修得不够干净。
   证据链(全部来自客户端自身, 不是推测):
     · RechargeFieldItem 里那张手工调过的三叶草摆位表 t.points 只有三个键:
         {1:[...], 3:[...], 4:[...]} —— 正是 ¥6(400) / ¥18(1800) / ¥25(2800) 三块田,
         每档一套独立的草株坐标; 其它 id 只能 fallback 到 points[1]。
     · default.res.json 只声明了 btn_pay_1/3/6/18/25_png; ¥12(id 2) 在任何资源里都
       没有图标(整个 APK 只有 exml 里那一处皮肤默认值 btn_pay_12_png), 即该档不卖。
     · ¥1/¥3 两档名字是"充值特惠X元好礼", 属于礼包页: RechargeGiftPage.updateGift(e)
       读 e.id/e.water/e.change/e.goods/e.time, 且 switchGift() 只在 (time-1 > 服务器时间)
       时展示该行 —— time 必须是未来时间, 否则整页遮罩。
   因此正确的服务器数据是:
     三叶草田 field[] = 3 档 {id:1,3,4} (每档含 grow/total)
     货物 sack[]      = 同样 3 档 (goods 容器)
     礼包 gift[]      = 2 档 {id:5,6, water, change, goods, time=now+7天}
   这正是"多了一行三叶草"的真正原因: 我们原来发了 6 行。
   顺带把礼包做成真的有用: 买特惠礼包 = 三叶草 + 浇水次数 + 兑换次数。
   rechargetest.js 现在会先从 main.min.js 里解析出 points 的键, 再断言 field[] 的 id
   与之完全一致(19 项断言), 所以以后再有人改动档位, 测试会立刻失败。

 ## v0.26: 核心玩法路线图 + 出行闭环修复 + 家具摆放补齐
 ### A. 真机日志定位到的两个"没做"的核心玩法(已修)
   1) 青蛙不能出行: 客户端**唯一的出发触发器**是 准备 按钮
        Bag.setImageLock -> ItemModel.setBagLock(true) -> send("item_set_bag_completed", null, true)
      (ProtocolList 里没有任何 travel_depart* 协议), 而日志里刷了一屏
        [MOCK] NO-HANDLER item_set_bag_completed
      -> 服务器从没开始过旅程。
      修: rules.js 新增 S['item_set_bag_completed'] -> depart(); bag_completed 随之上锁,
          item_load_items.bag_completed 现在来自 st.bagCompleted (原来恒为 0),
          回家时解锁并推 item_load_items/client_load_role/album_load_new/travel_load_note/clover_update/travel_load_gift。
      验证: tools/traveltest.js 21 项(出发->旅行中->回家->笔记/明信片/三叶草 + 笔记内容可渲染)。
   2) 旅行笔记内容: 笔记正文 = Note.info 里的词 id -> Word 表(word_N 图) 逐字贴图,
      客户端本地表齐全, 服务器只需保证 note id 在 Note 表、词 id 在 Word 表。
      traveltest 逐个校验了这两件事(还顺带抓出 harden.js 里 TravelNoteWordDB 的桩
      只给了 {id,word}, 而客户端读的是 u.img/u.type —— 已记入待办)。
      另外加了 3 个笔记路径探针(列表/逐条渲染/RES.getRes 缺图), 下次真机日志能直接看到。
   3) 顺带: probe 在真机抓到 GameConfig.version = "undefined.1002"(window.appVersion
      来自原生 SDK, 离线不存在) -> 已在 mock.js 里补 window.appVersion="1.0.20";
      task_client_pro(客户端任务进度上报) 原来 NO-HANDLER, 现在记录进存档。
   4) 屏幕适配在真机确认生效: [SCREEN] win=384x826 stage=640x1378 scaleMode=fixedWidth
      (修复前是 1136*384/826≈528 宽, 比 640 设计宽少 ~112px)。
 ### B. 家具摆放(核心装饰玩法的最后一块空白, 已补)
   日志/覆盖审计显示 furniture_putin_bench / takeout_bench / putin_box / takeout_box
   四个协议全无处理器 = 工具架、家具位、储物箱都放不了东西。
   新增 new/furniture.js(纯追加, 不重写任何现有层):
     · bench 10 槽(前 5 工具 / 后 5 家具, 线上 pos 从 1 开始), box 6 槽, put_fur 小屋家具
     · furniture_replace_fur(id): 用客户端自己的 FurnitureDB 查 type, 同 type 顶替, 返回 {code:0}
     · 包住原来的 furniture_load_furniture / furniture_load_compost, 把实时状态并进去
     · 全部走 /save 持久化
   验证: tools/furnituretest.js 21 项(含"刷新后仍在")。
 ### C. 玩法审计与优先级(roadmap, 覆盖审计工具 tools/coverage.js)
   核心循环(玩家每次上线都会碰) —— 现状:
     P0 出行闭环 ............ 已修(准备->出发->回家->明信片/笔记/特产)
     P0 背包/桌子 ........... 已可用(动态格子数 + guard 守卫)
     P0 商店/三叶草经济 ..... 已可用(买/收/背包装填)
     P0 相册 ................ 可用(回家推 album_load_new; 照片 id 来自 Picture 表)
     P0 旅行笔记 ............ 已修(列表 + 正文可渲染)
     P0 家具摆放 ............ 本次补齐(bench/box/put_fur)
     P0 访客串门 ............ 已可用(visitor.js)
     P0 邮件/领奖 ........... 已可用(mail.js, 含教程 500 三叶草)
   待补(按优先级):
     P1 图鉴/收藏 item_load_handbook(现为全空, Collections 62 + Specialty 表已有真实数据)
     P1 相册管理 album_load_by_id_list / album_recover / album_save_new(取回、另存)
     P1 小屋装饰 client_load_decorate / client_change_decorate(墙面地板)
     P1 harden.js 的 TravelNoteWordDB 桩形状(应为 {id,img,type})
     P2 兑奖 item_redeem_prize、travel_gift_delete_album、clover_harvest_resend
     P2 限时活动: 贺卡 greetcard / 春卡 springcard / 许愿池 wishingpool / 蛋糕派对 partycake /
        料理 cooking / 绘纸 drawing / 祈愿印章 pray / 扭蛋 capsule / 抽奖 lottery / 博物馆日 museumday
     P3 排行 rank_load、动态 misc_moment、分享 share、故事 story(已有真实故事表)
   原则: 只做增量层(新文件)或包住旧处理器, 不动已跑通的模块; 每块都配离线专项测试。

 ### v0.27 续: 图鉴/收藏(P1) + 兑奖
   · item_load_handbook 原来是 {collections:[],specialtys:[]} 全空。
     客户端契约(Game.collectionList / specialtyList)其实是两个**id 数组**:
       collections: CollectDB 的 id(0..61), specialtys: SpecialtyDB 的 itemId
     新增 new/handbook.js(纯追加): 从存档给真 id; 每次旅行回家解锁下一件纪念品;
     礼品盒里的特产自动计入 specialtys; 顺带补上 item_redeem_prize(原来 NO-HANDLER)。
   · tools/handbooktest.js 11 项(含"id 必须真实存在于表里"与刷新持久化)。
   待办(P1 剩余): 相册管理 album_load_by_id_list/album_recover/album_save_new、
     小屋装饰 client_load_decorate/client_change_decorate、
     harden.js 的 TravelNoteWordDB 桩形状 {id,img,type}。

 ### v0.28: P1 全部完成
   · 相册管理 new/album.js(追加层): album_load_recover / album_delete / album_recover /
     album_save_new / album_delete_new / album_load_by_id_list。
     客户端这几个答复都要过 MessageModel.getErrorInfo(code), 所以必须回 {code:0} 或 {code:1};
     删掉的明信片进 deletedPhotos(可找回), 保存/丢弃只动 st.photos。
     (album_load_by_id_list 的 layers 是明信片分层叠加数据, 格式未知, 故保守回空表
      —— 明信片本身仍按 pic_id/PictureDB 正常渲染, 不猜美术资源。)
   · 小屋装饰 new/decorate.js(追加层): client_load_decorate 给出真实 decoration 表的 3 种起始装饰
     ({id,num}), client_change_decorate 校验拥有关系后切换 put_id/status 并持久化;
     另外把 client_load_role.frog.decoration 同步成同一份列表(用包住旧处理器的方式, 没改 rules.js)。
     每完成 3 次旅行再解锁一种装饰。
   · harden.js 修正: TravelNoteWordDB 的兜底桩从 {id,word} 改成 {id,type,img}
     (客户端 TravelNoteUtils 读的是 u.img/u.type, 缺词时原来会渲染空字)。
   · tools/albumtest.js 22 项全部通过(含"装饰 id 必须真实存在于 decoration 表")。
   P1 完成; 下一批按路线图进 P2 限时/常驻活动。

 ### v0.29: P2 第一块 —— 祈愿物/印章 手工(常驻, 主界面可见入口)
   · new/handcraft.js(追加层), 契约来自 HandCraftModel + PrayCraftPageView.updateList:
       pray_load_grays -> {wishs, stamps, boxes, wish_new, stamp_new}
       祈愿条目 {id(=prayData id), state, body, paper, make_time, u_id}
       印章条目 {id(=stampData id), state, time, u_id}   (红点读 .time/.make_time)
       pray_compose(id) -> {item_list:[{item_id,count}]}  (合成盒子, BoxCraft UI 调用)
       pray_confirm_make_box -> 客户端清空 boxCraftList, 只需记下
   · 玩法逻辑照游戏自己的设定(年度回顾原文: 一个人在家的时候小青蛙也在认真做手工):
     青蛙在家(status=0)时一次做一件祈愿物 + 一件印章, 90 秒完成, 完成后进 wishs/stamps,
     红点出现; 出门旅行时不新开工。盒子合成走真物品(8000 手工品材料)。
   · tools/handcrafttest.js 18 项(含"id 必须真实存在于 prayData/stampData 表")。
   P2 进度: 祈愿/印章 ✅ | 待办: 料理 cooking、博物馆日 museumday、绘纸 drawing、
     贺卡 greetcard、春卡 springcard、蛋糕派对 partycake、许愿池 wishingpool、
     扭蛋 capsule、抽奖 lottery(这些多为限时活动, 需要把 end_time 放到未来才可见)。

 ### v0.30: P2 第二块 —— 每月料理 (cooking_*, 常驻, 主界面可见入口)
   · 契约来自 CookingModel: serverData = {month,month_pro,week,complete,select,refresh_time,task_list},
     任务条目 {id,pro,complete}, 渲染读 CookingTaskDB.get(id)={dec,state,type}
     (进度条 maximum=state, value=pro; 红点条件 pro==state && !complete)。
   · new/cooking.js(追加层) 让任务进度**跟着玩家真实行为走**(可观测的计数器):
       type1 每周登录 -> 打开即达成(按周重置)   type2 看广告 -> cooking_look_ad
       type3 喂养访客 -> st.visitorFeeds         type4 累计三叶草 -> st.clover 增量(目标80)
       type5 出门旅行 -> st.travelCount          type6 获得照片 -> st.photos 数量
       type7 抽奖兑换 -> st.redeemed             type8 分享 -> cooking_share
     任务 id 全部取自真表 cookingTaskData; 月份取当前真实月份, 换月自动重置;
     cooking_complete_task 只在 pro>=state 时给 code 0; 全部完成后 cooking_start_cooking
     才成功, 并用客户端自己的 CookingDB 取当月 item_id 发菜品(测试里与真表比对一致)。
   · tools/cookingtest.js 29 项全部通过。
   P2 进度: 祈愿/印章 ✅ 料理 ✅ | 待办: 博物馆日 museumday、绘纸 drawing、贺卡 greetcard、
     春卡 springcard、蛋糕派对 partycake、许愿池 wishingpool、扭蛋 capsule、抽奖 lottery。
     这些多是**限时活动**, 可见的前提是把 end_time 放到未来(客户端用 now<end_time 判断开放)。

 ### v0.31: P2 第三块 —— 许愿池(限时活动的第一个)
   · 之前 wishingpool_load 回 end_time:0, 客户端 isOpen()= now<end_time 判定为关闭,
     所以庭院里根本看不到许愿池 —— 这就是"限时活动没做"的典型症状: 不是没数据, 是活动没开。
   · new/wishing.js(追加层): data = {end_time(未来7天), coin(10), items:[{id,num,limit}]};
     奖品 id 取自真 Item 表; wishingpool_wish 返回 {id}>0(客户端据此减 coin/limit 并发奖),
     次数或库存耗尽时回 id 0(客户端安全); 过期自动续期, 活动不会消失。
   · tools/wishtest.js 13 项全部通过(含"奖品 id 必须在真 Item 表里")。
   P2 进度: 祈愿/印章 ✅ 料理 ✅ 许愿池 ✅ | 待办: 博物馆日、绘纸、贺卡、春卡、蛋糕派对、扭蛋、抽奖。
   模式已固定: 限时活动 = 真实表数据 + end_time 放到未来 + 状态机可被玩家操作推进。

 ### v0.32: P2 第四块 —— 扭蛋机 (capsule_*, 限时活动)
   · 与许愿池同一套模式: end_time 在未来(isOpen 判定 now 在 [1,end_time] 之间),
     coin>0 才能扭, reward_list 满 16 次客户端自己会拦("没有可扭的次数了")。
   · new/capsule.js(追加层) 的奖励表**直接读客户端自己的 capsuleData**:
       reward -> reward_id (真表 30 个: 101-110/201-209/301-311)
       num_reward -> 第 3/7/12 次的里程碑(item_id/item_num), 由服务器发到小屋(house)并推 item_load_items
     patch_num 固定 0, 否则客户端会因为 (patch_num>0 && task_list 为空) 反复自动请求 capsule_patch。
   · tools/capsuletest.js 20 项全部通过(含"reward_id 必须存在于真 capsuleData.reward"与里程碑发货)。
   P2 进度: 许愿池 ✅ 料理 ✅ 祈愿印章 ✅ 扭蛋 ✅ | 待办: 博物馆日、绘纸、贺卡、春卡、蛋糕派对、抽奖。
   P3 待办: 排行 rank_load、动态 misc_moment、分享 share。

 ### v0.33: P2 第五块 —— 贺卡 (greetcard_*, 限时活动)
   · 契约来自 GreetCardModel: data = {end_time, card_info:{bg,bless,tags[3]}, send_list, get_list,
     items[{item_id,num}], task_login, task_share, task_item, can_reward, global_num, new_index, stock_num};
     isOpen() 仍是 end_time 模式(0 = 活动不可见)。
   · new/greetcard.js(追加层): 背景/祝福 id 与价格**直接读客户端 greetCardData 表**
     (bg_list/bg_price/bless), 用三叶草购买背景 -> change_bg/change_bless/put_tags 组合 ->
     greetcard_send 寄出(can_reward=true) -> greetcard_get_reward 收回礼(+500 三叶草)。
     stock_num 递增与 greetcard_load_count 的 global_num 也照客户端预期走。
     邻居回卡: 每 3 分钟来一张, pop 到 get_list 并推 greetcard_load(这样收件箱不会永远空的)。
   · tools/greetcardtest.js 33 项全部通过。
   P2 进度: 许愿池 ✅ 料理 ✅ 祈愿印章 ✅ 扭蛋 ✅ 贺卡 ✅ | 待办: 博物馆日、绘纸、春卡、蛋糕派对、抽奖。

 ### v0.34: P2 第六块 —— 春卡 (springcard_*, 限时活动)
   · 与贺卡同构但多了"礼盒/分享"两层: springcard_buy() 无参, 服务器回 {tags_id} 随机贴纸并扣
     tags_price; 集齐 背景+3贴纸 才能 springcard_send, 按用了几张贴纸给 小盒/大盒
     (small_box_id 200009 / big_box_id 200010); springcard_get_reward 开盒给奖励
     (客户端用 {id,num}, num>0 才记入 reward_list); springcard_share_tags 发 share_code,
     springcard_get_share_tags 受 tags_share_limit(3) 限制。
   · 贴纸/背景/礼盒 id 与价格全部读客户端 springCardData 真表(bg_list/tags/tags_price/small_box_id/big_box_id)。
   · tools/springcardtest.js 33 项全部通过(含"大盒 id 必须等于真表 big_box_id"与分享上限=3)。
   P2 进度: 许愿池 ✅ 料理 ✅ 祈愿印章 ✅ 扭蛋 ✅ 贺卡 ✅ 春卡 ✅
     | 待办: 蛋糕派对 partycake、抽奖 lottery、博物馆日 museumday、绘纸 drawing。

 ### v0.35: P2 第七块 —— 蛋糕派对 (partycake_*, 限时活动)
   · 状态机取自客户端 Define.PartyCakeState = {making:0, make_reward:1, qa:2, qa_reward:3,
     light:4, light_reward:5, complete:6}; 关键点: req_make 只在 cur_state != 返回 state 时
     才记下这一层, 所以"成功做出某层"必须回 make_reward, 领奖(reward_make)再回 making ——
     这条不搞清楚, 客户端点了制作按钮会毫无反应。
   · 层 id/材料消耗(奶油/糖)/产出物品全部读客户端 partycakeData.cake[part].layers 真表;
     5 个部分共 14 层(蛋糕胚2/装饰2/小房子1/翻糖8/蜡烛1), 做完自动进问答 -> 点蜡烛 ->
     领 light_reward(真表 203004)。材料初始按真表总消耗给足, 用光时自动补给并写日志(不会卡死)。
   · tools/partycaketest.js 全流程驱动 14 层 + 问答/点烛, 断言材料真的被扣(78/51 -> 10/10)、
     产出的 house item 与真表一致、蜡烛奖励入账。
   P2 进度: 许愿池 ✅ 料理 ✅ 祈愿印章 ✅ 扭蛋 ✅ 贺卡 ✅ 春卡 ✅ 蛋糕派对 ✅
     | 待办: 抽奖 lottery、博物馆日 museumday、绘纸 drawing。

 ### v0.36: P2 第八块 —— 抽奖 (lottery_*)
   · 关键点: LotteryModel.lottery_load 只在 **e.phase 为真**时才整体替换 data —— 之前的默认
     形状把 phase 写成 0, 于是整个抽奖页永远停在默认态(又是"看起来没做")。
     LotteryState = {Open:0, Select:1, Complete:2, Reward:3}; 界面用的邻居是从客户端自己的
     lotteryData.select_list 里按 n=(last_phase-1)%4+1 取的, 结算文案取 settle_desc[对几个]
     (egg_num==5 时再叠 extra_desc[邻居][..])。
   · new/lottery.js(追加层): lottery_open 送出一件真物品(1000 四叶草)并进入 Select;
     lottery_select 记录所挑(最多 5 样, right_flag 全对) -> Complete; lottery_confirm_reward
     结算 +200 三叶草、清空 answer、phase+1(下一期换邻居/背景)并推 lottery_load。
   · tools/lotterytest.js 30 项全部通过。
   P2 进度: 许愿池 ✅ 料理 ✅ 祈愿印章 ✅ 扭蛋 ✅ 贺卡 ✅ 春卡 ✅ 蛋糕派对 ✅ 抽奖 ✅
     | 待办: 博物馆日 museumday、绘纸 drawing。
   P3: 排行 rank、动态 misc_moment、分享 share。

 ### v0.37: P2 第九块 —— 博物馆日/春游探索 (museumday_*, 限时活动)
   · 契约: data = {end_time, inspire_num, inspire_time, museum_list, cur_museum, compass, task_num,
     frog, next, left_num, desc_id, pic_id, items[], get_items[], log_list[], path[]};
     checkRedot() 条件 = path.length != next && compass > 0(所以初始状态要有"待前进"的钩子);
     museumday_random_compass/museumday_inspire 只有 **next 变化**时客户端才采纳;
     museumday_refresh 用 left_num(-1 = 不变); museumday_start_advance 回 {code:0} 后客户端会重新拉 load。
   · new/museumday.js(追加层): 4 个真博物馆(museumDayData), 每前进一步 roll 一格,
     纪念品 id 取自 museumData[cur].collection_id(34,35,36,37 / 38..41 / ...);
     museumday_get_items 收下后 **同时解锁图鉴**(st.collections)并入小屋库存 —— 与 handbook.js 打通。
     罗盘指向/灵感/刷新次数/到达次数都按客户端语义走。
   · tools/museumdaytest.js 37 项全部通过(含"纪念品 id 必须来自 museumData.collection_id"
     与"收集后图鉴+1、小屋+1")。
   P2 进度: 许愿池 ✅ 料理 ✅ 祈愿印章 ✅ 扭蛋 ✅ 贺卡 ✅ 春卡 ✅ 蛋糕派对 ✅ 抽奖 ✅ 博物馆日 ✅
     | 仅剩: 绘纸 drawing(依赖访客/事件系统)。

 ### v0.38: P2 第十块 —— 绘纸/邻居来画画 (guest_*) => **P2 全部完成 10/10**
   · 契约要点: DrawingModel.data = {state, guest, bag[], pages[], colls[], show_coll, pen_motion};
     DrawingState = {wait:0, invite:1, accept:2, lock:3, visit:4};
     **guest_load_drawing 是服务器推送**(客户端从不主动发), 且客户端整份替换 data, 所以每个键都得有;
     isOpen() 取决于小屋里有友情绘本(Tabikaeru.ItemID.DRAWING_BOOK = 7001)。
   · new/drawing.js(追加层): 首次进入发一本友情绘本开启玩法; 每 4 分钟一位邻居来邀请 ->
     guest_accept_invit(true/false) -> guest_putin_bag/takeout_bag 装包 -> guest_lock_bag 锁包,
     60 秒后产出**真表绘纸(DrawingPage)与收藏(DrawingCollect)**, 收藏同时解锁图鉴;
     guest_confirm/guest_serve/guest_finish/guest_set_expire_time 按客户端语义记录。
   · tools/drawingtest.js 26 项全部通过(含"绘纸/收藏 id 必须来自真表"与"婉拒回到 wait")。
   P2 完成度: 许愿池 ✅ 料理 ✅ 祈愿印章 ✅ 扭蛋 ✅ 贺卡 ✅ 春卡 ✅ 蛋糕派对 ✅ 抽奖 ✅ 博物馆日 ✅ 绘纸 ✅
   下一步(P3 边角料): 排行 rank_load、动态 misc_moment_load、分享 share_load/share_get_reward。

 ### v0.39: 相机两个 bug(玩家实测反馈)
   A) 全景模式跟屏幕模式没区别
      MainIn/MainOut.getCameraTexture(full, rect) 里 full 分支把裁剪框**写死**成 854x1420
      (MainIn 是 1152x1420)。只有 stage 恰好等于设计框时才等于"整个场景"; 自适应适配后
      stage 是 640x1378(键盘弹出时甚至 830x1136), 于是全景框要么超出场景、要么和视口差不多。
      修: new/camera.js 包住 getCameraTexture —— full 且无裁切框时, 无条件按**场景容器真实尺寸
      (不小于 stage)** 重拍一次; 屏幕模式/裁切模式不受影响; 两种模式的尺寸都写进日志。
   B) 无法保存图片
      CameraView.onSaveBtnTap -> BaseChannel.check_permission("album") -> save_texture_to_album()
      -> e ? "保存成功" : "保存失败"。我们的渠道是 Test(channelType=1), TestChannel **没有重写**
      这两个方法, 继承到 BaseChannel 的桩: check_permission=true, save_texture_to_album=**null**
      -> 永远"保存失败"(真机日志里能看到这条路径)。
      修: 给当前渠道 prototype 装真实实现 —— textureToCanvas -> toDataURL -> ①试原生
      PlatformFile.writeFile + save_to_album ②POST 到 8089/shot; 服务器的 /shot 会把图片写到
      **/storage/emulated/0/Pictures/lxqw_<时间>.jpg**(相册可见) 并在工作区留一份。
   · tools/cameratest.js 13 项全部通过(含"全景 900x1500 != 屏幕 640x1378"与"保存返回 true")。

 ### v0.40: 浇水免次数 + 准备按钮布局探针
   · 玩家反馈"浇水依然消耗次数": recharge_water 每次 -1。已改为**免费**: water 不再扣减
     (保持在水位上限, 只作显示), 需要恢复消耗感把 iap.js 里的 FREE_WATER 改成 false 即可。
   · 准备按钮偏移: 真机 stage 已经是 640x1378(fixedWidth) 且稳定, 但玩家仍觉得偏。相机探针顺手
     量到**场景容器是 854x1420** —— 比 stage 宽 214, 说明 UI 是按 854x1420 的画布排的, 而可见窗口
     只有中间 640。为定位到底偏在哪一层, screen.js 新增 [LAYOUT] 探针: 每次 relayout 时打印
     view/scene/outBtn(准备按钮) 的 x,y,w,h,anchor、父容器尺寸、stage 与 Main 容器尺寸。
     下一次真机日志即可判断是"按钮相对父容器错位"还是"父容器相对舞台居中造成的整体位移"。

 ### v0.41: 感叹号点不掉 + 百科没内容(两个真根因) + 探针修正
   A) 旅行笔记感叹号点不掉
      TravelNoteView.onClose -> sendReadNote(ids) -> send("travel_read_note", null, **ids 数组**),
      协议定义是 [["id"],!1] —— 所以 p.id 是一个数组。我们老实现按单值比较 st.notes[i].id === p.id,
      永远不匹配 -> 服务器从不把笔记标记已读 -> 下次 travel_load_note 又推未读 -> 感叹号永远在。
      修: travel_read_note 同时接受单值和数组。
   B) 百科没有内容
      EncyModel.isDescUnlock(id, 下标) 是拿**下标**去 this.data.unlock_desc[id] 里 indexOf 的;
      正文由客户端自己的 encyclopedia/encytravel 表提供。我们原来把**正文文本**当 list 发过去了,
      于是 isDescUnlock 永远 false -> 百科条目一条都不显。
      修: genrules 生成的 ENCY_DESC / ET_DESC 改成"已解锁的下标数组"([1,2,3,4] 等, 与客户端表键一致)。
   C) 事件探针修正: ServiceDispatcher 的 dispatchEvent 是**单例实例上的自有方法**(原型上没有),
      所以上一版的事件探针一条都没打出来; 现在原型和实例两处都包。
   D) 布局探针加强: [LAYOUT] 现在还会列出视图的所有直接子节点(name + x,y,wxh),
      便于定位"底左那个准备按钮"到底是哪个元素、几何如何。

 ### v0.42: 卡住的引导(手指高亮/感叹号气泡) + 存档迁移
   · 玩家截图里"准备按钮被白框高亮 + 旁边一个 ! 气泡"其实是**引导**没走完:
       guideFurniture 是阶段数字 1->2->3->4->5, 3 那一步正是
         GuideFingerView.show(this.outBtn, FingerOrientation.Right, ...)  ← 在按钮上画引导手指
       我们 DEFAULT_CLIENT_SETTINGS 早先给的是 1, 于是每次启动都从头开始这段引导;
       guideDrawing 同理(1->2->3->4, 1 会在邀请弹窗上画手指)。
   · 修: 默认值改成终态 guideFurniture=5 / guideDrawing=4 / noticeDrawing=-1;
     并对**老存档**做迁移(1..4 -> 5, 1..3 -> 4, 0 -> -1), 只升不降。
   · 按钮美术本身没动过: 我们从不改图片/皮肤, 只改服务器数据(8089)与相机保存桥。

 ### v0.43: 每次启动弹"淘宝版物品已导入"
   · 客户端 eventSystem() 里:
       if (guideStep == Complete) { var m = RoleModel.drawTaobaoData(); if (m) { 打开淘宝导入界面 … } }
     而 RoleModel.taobaoData 来自 client_load_role 的 frog.taobao_data —— 我们以前发的是 **{}**,
     空对象在 JS 里是**真值** -> 每次进游戏都判定"有淘宝物品待导入"并弹窗;
     点保存后 client_draw_taobao 的桩又回了 flex 代理(同样真值) -> 再弹"淘宝版物品已导入"。
   · 修: frog.taobao_data 改成 null; 并补 client_draw_taobao -> {ok:false},
     client_taobao_import -> {collections:[], pictures:0}(没有可导入的东西就说没有)。
   · 顺带修正 misc.picture_cnt: 以前发的是 notes.length(日记数), 应该是 photos.length(明信片数)。

## v0.44: 明信片图层(崩溃根因) + 出发/回来提示 + 故事系统

用户报的三个 bug 与一次崩溃，一次修完（并做成离线可验证的回归）。

### 1) 崩溃根因: 明信片没有 layers
设备日志: 2026-09-13T05:14:22Z v0.43.0
  EXC: Uncaught TypeError: Cannot read properties of undefined (reading 'length') @ main.min.js:12
  STACK: Object.i [as loadPicture] (12:9911) <- t.onComplete (28:2905) -> begin reload
定位:
- main.min.js:12 `loadPicture(e)` 直接 `for(var r=e.layers; n<r.length; n++)`，**没有判空**。
- 28:2905 是 PostcardView.onComplete；调用方是 frog_back 提示流:
  `var Gt=T.getFirstNewPictureInfo(); if(Gt){ var e=new i(Gt); ... }`
  —— 即"新明信片"弹窗直接拿 `newPictureInfoList` 里的对象去 loadPicture。
- `newPictureInfoList` 来自 `album_load_new`，我们之前推的是 `{id,pic_id}`，**没有 layers** → 崩溃 → 自动 reload。
- 而客户端本来有补齐机制: `getFullPictures()` 发现 `null==pic.layers` 就发 `album_load_by_id_list`；
  我们的 album.js 当时返回 `{pic_list: []}` → `a.layers = n[a.id].shift().layers` 永远不执行 → 依旧是 undefined。
修复(new/postcard.js + new/pictures.js):
- 用客户端自己的两张表生成 343 张明信片的分层合成:
  `tables/Picture_json.json`(底图名/frogPose/frogPos/travelerPose/travelerPos) +
  `tables/resources_json.json`(资源 id → Picture/xxx/name) → 每层 `[rid,x,y]`。
  坐标是**画布中心系**(frogPos 范围 ±200/±162)，换算 `x = 250+px-w/2`；
  全幅底图(≥440x280) 放 (0,0)，小物件按类定向摆放(鸟/萤火虫在天上、树/屋顶贴地、全景条居中)。
  `tools/genpictures.py` 生成 `new/pictures.js`；`tools/preview_picture.py` 可把任意 pic_id
  合成成 PNG 人工看一眼(screenshots/preview_*.png)。
- `album_load_by_id_list` 现在按 id 回 `{pic_list:[{id,pic_id,layers:[{layer:[rid,x,y]}]}]}`；
  未知 id 也回兜底图层，**绝不返回 layers=undefined**。
- `album_load_new` 同时是**推送**(rules.js 给新照片)和**请求**(客户端登录问还有什么新的)，
  现在维护 `st.newPhotos` 队列 + 每个 picture 都带 layers；`album_save_new/album_delete_new` 出队。
- 生成时顺手把每张照片用到的纹理 `RES.getResAsync(basename+"_png")` 预载，
  这样客户端同步的 `renderPicture()` 能命中缓存(它用 `RES.getRes`，取不到就 return null)。

### 2) 出发/回来没有提示 + 出门了青蛙还在屋里 + 日记一直在更新
- 客户端提示走 **TimerEvent**: `client_load_events`(登录队列) + `notify_new_event`(实时推送)，
  `GoTravel=1` → "{0}出去旅行了"，`Return=5` → "{0}回来了。"；我们之前 `client_load_events` 返回空数组 → 永远没提示。
- 小屋只在 `Game.isHome`(=`RoleModel.getFrogStatus()==0`) 时画青蛙，而视图只监听 `RoleEventType.loadRole`，
  所以在途状态变化必须**再推一次 client_load_role**才会重跑 `MainInView.updateFlogStatus()`。
- 旧 rules.js 还有两个坑: ①固定 90 秒来回 → 日记刷得飞快；②`item_putin_desk` 放个食物就自动出发。
修复(new/travel2.js, 纯增量: 不重写 rules.js，只包一层):
- 状态机监视器(1s)：status 变化 → 写 TimerEvent 队列 + `notify_new_event` 推给客户端 + 连推两次 client_load_role。
- `client_load_events` / `client_confirm_event`(弹完即出队)。
- 旅行时长: `st.travelSeconds` 未配置时每次随机 180~420s(存档里可改 travelMin/travelMax)。
- 放桌上食物不再出发；只有"准备"(`item_set_bag_completed`)才出发。
- 探针: 若 `Tabikaeru.MainInView` 可达就包 `updateFlogStatus` 打 isHome/status/motion。

### 3) 故事/羁绊 (story.txt)
story.txt 给的是一套 Express+SQLite 的 HTTP 服务；但客户端只会说 `SocketManage` 的 JSON 协议，
HTTP 接口它根本不会请求，所以按客户端**真实协议**落地，数据模型照抄 story.txt:
- 池子 = 客户端自带 `tables/story_json.json`(25 条 故事/羁绊: id/name/desc/icon/type)。
- 条件 = 目的地(按携带食物权重推出 9 大地区之一) + 必需物品(果汁+千纸鹤) + 可选物品(花生/铃铛/帆船，加权 +5)，
  7 的倍数 id 是稀有(需要"心意风铃"1100)。
- `story_load` → `{stories:[{id,partner,gift,feedback}], new_story_id}`；
  partner=id%3 (0 壁虎/1 刺猬/2 萤火虫) 供"关系"页分组；gift/feedback 默认 -1 (客户端 StoryData 默认值)。
- 回到家的那次 roll 命中 → 入池 + `new_story_id` → 推 `story_load` + 一个 `Story(8)` 事件("好像有故事发生")，
  弹窗由客户端 `checkStory()` → `StoryAlertView` 显示 story_json 的图/文。
- `story_read_new_story` 清 new_story_id；`story_send_gift` 记礼物；`story_feedback_gift` 记回礼。

### 回归
- 新增 tools/postcardtest.js(16) / tools/noticetest.js(10) / tools/storytest.js(16)，verify.sh 加到 31 步。
- 公共 harness 抽到 tools/_harness.js(假 XHR 直接读 new/*.js，无需起 8089)。
- mock 版本 0.43.0 → **0.44.0**(设备日志里"[MOCK] installed vX"用来确认跑的是哪一版)。

### v0.44 补丁(同轮): 顺手修掉 3 个既有问题
- **存档 starvation**: persist.js 的 1 秒防抖会被各层自己的定时器 save() 无限推迟，
  /save 实际只在 8 秒兜底定时器上落盘(handcrafttest 因此一直红)。
  改成"防抖但最多推 4 秒必落盘"(SAVE_MAX_DELAY=4000)，测试改用 5.2s 窗口 + 同时断言内存态。
- **validate.js 的 rank_get_intro 异常**: 客户端 handler 会读请求参数 t.duration+t.type+t.uid.toString()，
  校验器之前传空对象 → 抛异常(假警报)。现在传一个具体参数对象(不能传 auto 代理，会让循环不终止)。
- **rechargetest 浇水断言** 还停在"扣一次次数"的旧行为上；浇水已按用户要求做成内购免费，断言更新为不扣次数。
## v0.45: 布局对齐(准备按钮偏移) + 活动日历 + 笔记底图预载

### 1) 准备按钮偏移 ~107px 的根因
- 小屋场景 `MainIn/MainIn.exml` 是按 **854** 宽画的；我们的视口 `Main.stageWidth` 只有 640。
- 客户端自己有居中逻辑: `MainInView.center_scroller()` →
  `scroller.viewport.scrollH = 0.5*(854 - this.width)`，只在 `onComplete()`/`on_resize()` 里调用。
- 视图在我们改过 stage 尺寸之前就建好了(或皮肤根宽度还是 854) → scrollH 停在 0 →
  场景左对齐、内容整体右偏 (854-640)/2 = **107px** —— 正是用户截图里那个偏移。
- 修法(不搬任何东西，复用客户端自己的代码): `new/screen.js` 新增 `recenterScenes()`：
  ① 向 stage 派发一次 `egret.Event.RESIZE`(视图控制器的 `changeViewFrameSize` 监听它)；
  ② 遍历显示树，对任何带 `center_scroller` 的节点直接调用它。
  t2/t5/t10/t20 各跑一次，之后每 15s 巡检，只有 scrollH 真的变化才重新居中并打日志。
- LAYOUT 探针顺带多打印 `scrollH <当前>/<视口宽>`，真机日志可一眼确认。

### 2) 活动时间校准(9 月不该弹春节活动)
- 客户端判定: 每个限时活动 payload 带 `end_time`，`isOpen() = now in [1, end_time]`；**end_time=0 即隐藏**。
- 我们的活动层以前一律 `endTime = now + 7 天`(过期就续) → 所有活动永远开着。
- 新增 `new/calendar.js` + `new/calendar.json`:
  - 春卡 = 春节前 7 天 ~ 春节+15 天(农历春节公历表到 2032)；贺卡 = 12-20 ~ 次年 01-10；博物馆日 = 05-10 ~ 05-31；
  - 其它常驻玩法(扭蛋/许愿/绘纸/抽奖/蛋糕派对)不受限；
  - calendar.json 里 `force`/`disable` 可以临时开/关某个活动(测试用)。
- greetcard/springcard/museumday 三个层改为向日历要 end_time(季外返回 0 → 客户端自动隐藏)。

### 3) 旅行笔记底图纹理
- 日记用**同步** `RES.getRes("pic_<id>_png")`，按需加载必然先 miss 一次(设备日志里的 res-miss)。
- `new/pictures.js` 现在额外导出 `window.MOCK_NOTE_IDS`(客户端 Note 表全部 197 个 id)；
  `new/postcard.js` 开机 3 秒后先预载自己已有的笔记，再把剩下的按 4 张/600ms 排队预载，
  这样等玩家打开日记时纹理已经在缓存里。
## v0.46: 庭院三叶草(看不见的 bug) + 笔记预载更早

### 1) 庭院里一丛三叶草都看不见 —— rules.js 自己的 bug
- 客户端可见规则: `last_harvest == -1` 或 `(last_harvest > 0 && last_harvest + rebirth_span <= now)`。
- 我们之前播种的是 `last_harvest: 0` → 两个分支都不满足 → **永远不画**，玩家在庭院里根本采不到三叶草。
- 修(不去重写，直接修原来那段): 播种改 `-1`；读档时把遗留的 `0/undefined` 迁移成 `-1`；
  收割后写 `last_harvest = now` + `rebirth_span = 90~420s`(真实再生长)，并按客户端本地发奖镜像服务端:
  `element 0` → 三叶草 +1，`element 1` → 四叶草道具 1000，`element 2` → 直接给 `sprite` 道具；
  回包 `{clover_id}` 让客户端清掉它的 resend 队列。rules.js 与 tools/genrules.py 同步改，避免重生成丢失。
- 新增 tools/clovertest.js(14 项)，verify.sh 第 33 步。

### 2) 笔记底图预载提前
- 设备日志(v0.44 会话)仍有 6 次 `res-miss :: pic_100x_png` —— 预载是开机 3 秒后才跑，玩家抢先打开日记就 miss。
- 改成: 开机先立刻预载已有笔记，之后 1s/3s/6s 各重试一次，再把 Note 表其余 190+ 张按 4 张/600ms 排队。
## v0.52.x 追加：工作台/合成（开工）调查记录（未闭环，供后续接手）　→ 后续见文末 **v0.53: 视图探针 VP**
- **协议**：工作台"开工" = `HandCraftModel.req_compose()` → 发 `pray_compose`（已实现，成功回 `{item_list:[...]}` 逐个弹奖励）。
- **客户端判定**（main.min.js，合成视图 updateView）：
  `t=[0,0,0]`；`getHouseItemsByType(ItemType.COMPOSE)`；按 `ItemDB.get(item_id).sub_type` 1..3 记数量；
  三组都 >0 才 `s=true`，才允许 req_compose；否则图标 `getBlackFilter()` 且不显示开工。
- **类型枚举**：COMPOSE=16、HandCraftTool=7、HandCraftStuff=8、FURNITURE_RESOURCE=10、FURNITURE_ITEM=11、FURNITURE_TOOL=12、FURNITURE_PAPER=13。
- **配方表**：`prayData_json`（7 条：type/state[1..4]/paper[1001..4004]/wood_body[101..]）、`prayNoteData_json`(35)、`benchData_json`(327: {id,type})、`drawingCollectData_json`(22，绘纸收藏)、`furnitureData_json`(324，`drawing`=图纸 id 103xx)。
- **合成材料**：type 16 全表仅 3 件 = **8501/8502/8503**（木制护符 1/2/3 号木片，sub_type 1/2/3）。
- **已补发**：kitv2(11/12/13)、kitv3(1001-1004/2001-…/7000-7001/8000-8004)、kitV5(8501-8503 ×5)；均落 `st.house` 并存档；kitv4.js 内含探针（COMPOSE 双侧对比、BYTYPE 钩子、强制刷新 `ItemEventType.updateAllItemInfo`）。
- **实测证据**：`COMPOSE probe: srv[8501=5,8502=5,8503=5] cli len3 [8501=5,8502=5,8503=5]`；`BYTYPE type=16 -> len3 [...]`×13 ⇒ 数据侧无误。
- **剩余问题**：界面三格/开工仍未出现（视图层），且工具栏"庭院/其他"页签不可点。后续方向：给合成视图类与页签点击挂探针，打印其内部计数与使能标志 `s`（`window.__probeView`）。
- 说明：用户看到的"博物馆通票数量 0"= item **1104（type 1 道具）**，与合成无关。
- 其它已修并验证：商人时间窗/购买持久化（图纸 103xx 进 `house`、`item_load_handbook.collections` 合并）、台面两行（`bench[0..4]`=工具 type12/7、`bench[5..9]`=材料 type11/8）、商人小摊售罄自愈、购买入栏、桌子满、邮件手信、回家明信片崩溃（dispatch 出口补 layers）。

## v0.53: 视图探针 VP —— 给所有 craft/bench/tool 视图挂探针（本轮，等真机一次即闭环）
上一轮那条"给合成视图类与页签挂探针"的后续。先把三个前提纠正掉（都读自 main.min.js，可复核）：

1. **合成的入口 id 是 5502，不是 8500**：`Tabikaeru.Define.ComposeId = 5502`（@421485）。
   背包格 `BagItemRender.dataChanged` 里 `btnCompose.visible = (item_id == ComposeId)`（@1009393），
   `ToolBagView.updatePage` 的"其他"页签也把 COMPOSE 类物品聚合成 `{item_id: 5502, count: Σ}`。
   8501/8502/8503 只是**材料**（type 16, sub_type 1/2/3）。
2. **用户说的"工作台"（工具行/材料行）= `FurnitureBenchView`**：房间里的桌子美术 `imgFurnitureBench`
   + 隐形热区 `btn_enterFurnitureBench`（MainOut.exml）点开；皮肤 `Furniture/FurnitureBenchViewSkin.exml`。
   三行: `listTool`=工具行 `bench[0..4]`、`listItem`=材料行 `bench[5..9]`、`listResource`=10001..10007。
   它的使能条件只有 `!isLockBench()`（`bench_lock != 1`），**没有"开工"按钮**。
   "开工" = `BoxCraftView`（合成箱）: `group1..3` + `lbNum1..3`，COMPOSE(16) 的 sub_type 1/2/3 三组都 >0 → `s=true`
   → **自动** `req_compose(5502)`（pray_compose），也没有按钮（@751844 的 updateView 就这么写的）。
3. `chips_1_2_3_png` **在资源表里不存在**（version.json 只有 chips_1 / 1_2 / 1_3 / 2 / 2_3 / 3）——
   三组齐时客户端偏偏赋这个 source，所以"开工图"必然不显示。
4. 工具栏"庭院/其他"页签点不动 = **设计如此**，不是 bug：从台面格子进 `ToolBagView` 时带 `param.tabFilter`，
   `commitProperties` 把不匹配的页签 `enabled=false`，`onTabTap` 弹"这里不能放其他物品哦"。
   想要四个页签全亮，得从不带 param 的地方打开工具栏。
5. **合成的路怎么走**（三处 `ToolBagViewController` 打开点，@623479/@624467 是台面格子、@1200883 才是主界面 on_tool）：
   工具栏按钮 `on_tool` 打开的工具栏 **不带 param ⇒ 四个页签全亮**；"其他"页签(case 3)会把 COMPOSE 类物品
   聚合成一行 `{item_id: 5502, count: Σ}`，点它的 `btnCompose` → `new BoxCraftView` 直接挂到 notice 层。
   从台面格子进的那个工具栏才带 `tabFilter`（页签被禁用）。5502 在 ItemDB 里 type=5(Gift)、sub_type=2，
   名字"木制护符的三拼技巧"，8501/8502/8503 是它的三块木片。
6. 上一轮实测证据：日志里 **0 条 BOXCRAFT**（kitv4 里那个 BoxCraftView 探针从未触发）⇒ 用户当时**没进过合成视图**；
   他其实在 `FurnitureBenchView` 里点格子 —— `furniture_putin_bench pos=10 id=11001`，以及 type=12/11 的
   `getHouseItemsByType`（那是台面格子的选择列表）。

本轮新增 `new/vprobe.js`（已加进 `new/mock.js` 的 extra 列表，版本 v0.53.0，**重开游戏即生效**）:
- **A 类清单**: 启动就打一行"哪些 craft/bench/tool/bag 类在 window 上存在/缺失"。
- **B addChild 钩子**: `egret.DisplayObjectContainer.prototype.addChild/addChildAt` 包一层 ——
  子节点是界面类且父节点是 `*Layer`，或父子任一命中关键词时打 `[VP] OPEN 父 <- 子`（= 用户打开了哪一屏）。
- **C 显示树扫描**: 0.8s × 40 次，之后每 3s；界面类集合一变就打一行 `界面变化: 当前界面类=[...]`；
  命中类的实例 → `FOUND #n 类 | 尺寸/父链` + 立刻挂 D + 打一次状态。
- **D 方法探针**: 命中类原型上的 `updateView/update/updateBench/updateList/updatePage/updateRedot/setParam/
  commitProperties/dataChanged/onComplete/childrenCreated/open/close/各 tap` 全包一层 →
  `[VP] CALL 类.方法(...)`，刷新类方法跑完再打一次状态（每方法限 6 次）。
- 每个状态块固定 5 行: `类 状态 | WxH @x,y vis parent skin` / `.行`（所有带 dataProvider 的属性:
  listTool/listItem/listResource/tab/list，逐项 item_id[×count][(锁)]）/ `.文本` / `.标志` /
  `.数据`（台面: bench 数组 + 工具行 + 材料行 + 锁；合成: COMPOSE 明细 + t[] + **s** + chips img + ComposeId + 背包有）。
- 手动: `window.__vp()`（重扫重打，解除静默）/ `window.__vpDump('FurnitureBenchView')`。
- 离线 harness 安全: 检测不到 egret 显示树就只打类清单、不启动定时器（tools/furnituretest.js 结果与改动前一致）。

**看结果**: `python3 tools/vreport.py`（只摘最后一次 boot 之后的 [VP] 行；`--full` 带时间戳）。
一次真机流程就够: 重开游戏 → 房间点桌子(工作台) → 点工具行/材料行各一格（会弹工具栏，看 `.页签` 那行）→
关掉 → 打开背包翻到 5502 点 `btnCompose`（进合成）→ 关掉。

## v0.54: 合成(开工) 死循环事故 —— 卡死+崩溃的根因与修复（2026-09-14 00:30）
**事故**: 玩家进"工具栏 → 其他 → 木制护符的三拼技巧 → 合成"后, 界面立刻开始无限弹
"获得物品，由勤劳蛙蛙手工拼成", 十几秒内卡死, 随后崩溃。

**根因（我们自己的 mock bug，客户端无责）**: `BoxCraftView.updateView()` 是**自我重触发**的 ——
三组材料都 >0 时自动 `req_compose(5502)`, 而 `req_compose` 的回包回调里 `t.apply()` 又跑一次
`updateView`。而 v0.52 那版 `pray_compose` **只发奖、不扣材料**（还把每次合成 push 成一个"待确认盒子"）,
于是客户端的 `t=[5,5,5]` 永远不变 → 无限循环。
证据: `logs/game.log` 里 `HANDLE pray_compose` 连发 **≈3200 次**(16:30:49 起), `待确认` 计数涨到 **3208**,
日志从 38k 行涨到 58k 行, 最后一次 save 里 `craft.boxes` = **3208** 个（下次开机客户端会把这 3208 个
盒子逐个弹奖励 -> 又一次卡死, 所以必须一起清）。

**修（三层）**:
1. `new/handcraft.js` `pray_compose`: 按 `ItemDB.type==16` 的 `sub_type 1/2/3` **各扣 1 件**(扣 `st.house`,
   就是客户端看到的那份), 缺任一组就只回 `{item_list: []}`; 成功才发奖(常量 `COMPOSE_REWARD`, 暂沿用 8000);
   **每次调用都推 `item_load_items`** —— 客户端的 `t[]` 才会归零, `s=false`, 循环才有终止条件;
   两道硬闸 `COMPOSE_MAX_OK=30` / `COMPOSE_MAX_REJECT=60`; 不再堆"待确认盒子"。
2. `new/mock.js` 加**协议级熔断**: `SocketManage.send` 里每个协议名一个 2 秒滑窗, 同一条协议
   2 秒内超过 **40 次**就**连回包都不发**(客户端的回调链直接断掉, 循环立刻停), 只吼一次
   `RATE-TRIP <name>`。正常 UI 不可能触发; 这是这类"客户端自我重触发"事故的总兜底。
3. 数据修复: `save/state.json` 的 `craft.boxes` 3208 → 0（原件备份在 `logs/bak/state.2997boxes.json`）。

**回归测试**: 新增 `tools/composeloop.js`（17 项, 已接进 `tools/verify.sh` 第 37 步）: 用一个假客户端
复现"缓存来自 item_load_items 推送"的循环 —— 断言 5 套材料正好合成 5 次、三组各扣到 0、奖励入 house、
推送晚到 150ms 时 8 次调用内停、没材料只回空表、硬闸 30、熔断把 120 次发送砍到 40 次。
`tools/handcrafttest.js` 同步改成新契约（19 项全过）。

**真机复验方法**: 重开游戏 → 合成界面 → 应该只弹 5 次(材料各 5 件), 三格数字 5→0, 然后停住;
日志里能看到 `手工: 合成 #1..#5 ... 剩余材料 4/4/4 ...` 与 `合成拒绝(材料 0/0/0 ...)`,
若再出现疯跑则会有 `RATE-TRIP pray_compose`。

**遗留(客户端自身的, 不改客户端就无解)**: 三组齐时客户端把 `imageShow.source` 设成资源表里
不存在的 `chips_1_2_3_png`（只有 chips_1 / 1_2 / 1_3 / 2 / 2_3 / 3）—— 恰好那一刻它就自动开工了,
所以"开工图"不显示只是观感问题。

## v0.55: 工作台"开工"（青蛙做家具）+ 商人库存/图纸购买持久化
用户两问：①"为什么还是不能使用工作台弄家具与开工" ②"嘟嘟商店买的图纸下次进游戏就不见了"。查完的结论与修法：

### ① 工作台本身没有制作按钮 —— 制作是**服务端**的事，我们从来没实现
- 客户端 `FurnitureBenchView` 只有三行：`listTool`(工具 type12) / `listItem`(特殊材料 type11) /
  `listResource`(普通材料 type10 松木楠竹砂石灯芯草粗布毛边纸铜块)，**没有任何制作/开工按钮**。
- 官方新手引导图就是说明书（已导出到 `logs/guides/`，可直接看）：
  `guide_furniture_4.png` =「帮蛙蛙把材料和工具都放到工作台上吧 / 要有足够的材料和工具 / 蛙蛙才会做家具哦」；
  `guide_furniture_5.png` =「锤子，小刀…等工具」(上行) /「岩纹石…等特殊材料」(下行) /「多放一些准没错」。
  → 玩家只负责摆，**青蛙在家时自己开工做家具**。
- 我们以前完全没做这一步，所以摆满了也不会有任何事发生 —— 这就是"用不了工作台"的根因。
- 附带的两个坑：`furniture_load_furniture` 里那句"全部解锁"把家具表 324 件全塞进 `has_fur`
  （就算做了也没有新家具可出）；而存档里的 `has_fur` 其实是 `[10311,10305]` —— 两个**图纸 id**，
  是早期购买处理写错的（客户端会把它们当坏家具渲染）。
- 修：新增 `new/furnituremake.js`（已进 `new/mock.js` 层清单，最后加载）：
  青蛙在家 + 台面有工具(type12，台面空就用家里的) + 特殊材料(type11) + 玩家拥有对应家具的图纸
  (`furnitureData.drawing` = 103xx 在 house 且 count>0) → **开工**；选"图纸命中且还没拥有"里 id 最小的家具；
  做一件 60 秒，期间 `mate_list` = 正在消耗的材料（台面资源行会显示占用），完成后家具进 `has_fur`、
  扣 1 特殊材料 + 1 普通材料（材料用光就把台面那格清掉），推 `furniture_load_furniture` + `item_load_items`。
  调试钩子：`window.MOCK_MAKE.tick()/state()/finish()`。
- "全部解锁"改成开关 `st.furnitureUnlockAll`，**默认关 = 真循环（做出来才归你）**；设 1 恢复旧行为。
  玩家存档里 27 张图纸 + 一堆材料 + 工具齐全、青蛙在家 → 重开游戏几秒后就会开始做，60 秒一件。

### ② 丢的不是图纸本身，是**购买状态**（商人库存字段 `num`）
- 商人列表 `furniture_load_furniture.shop.shop_list` 的每行需要 `num`（客户端用它显示
  "剩N个/仅N个"，`num==0` 才切 soldout 状态 + 禁用购买按钮）。我们直接透传客户端 DB 行，
  **DB 行里根本没有 num**；`f.bought` 虽然记了购买，却没有任何地方用它扣库存。
- 于是：买的一瞬间客户端本地 `s.num--`（显示售罄），一重启服务端又发一份满库存的列表
  → 同一张图纸又能买（存档里 10303、10305 各买了两次就是证据）。
  用户看到的"买的图纸下次进游戏就消失"= 这次购买/售罄状态没了。
- 修（`new/furniture.js` 商人块）：`num = max(0, (limit || shop_limit) - 24 小时内该 shop_id 的购买次数)`；
  买过即 0，重启后仍是 0；超过 24 小时商人补货（`f.bought` 里的旧记录自动作废）。
  顺带把 `has_fur` 里的非家具 id 剔掉（见上）。
- 注意：图纸**物品**本身一直是进 `st.house` 并存档的（`st.house` 里 10301-10327 都在），
  客户端的图纸页 = `家具 → 图纸` 页签（`FurniturePaperPage` → `getHouseItemsByType(13)`），日志里从来
  没出现过 `BYTYPE type=13`，说明那一页一直没被打开过。

### 本轮回归
- 新增 `tools/furnituremaketest.js`（21 项，已接进 `tools/verify.sh` 第 38 步）：商人 num 的三态
  （没买=1 / 买过=0 / 超 24 小时补货=1）、真循环下 has_fur 只留做出来的、开工选中的正是图纸对应的家具、
  制作期间 mate_list 占用、60 秒后入库并扣料、材料用光清台面格、青蛙出门不开工、unlockAll=1 回到全解锁。
- 视图探针 `new/vprobe.js` 的命中类扩到 `Furniture|Paper|Book|Cargo|Shop`，并会打印
  家具视图的 has_fur/put_fur/图纸数 与 商人前 12 行的 `shop_id:item_id:num` —— 下次真机日志可直接对照。

## v0.56: 真实时钟（季节/时段/天气）+ 层加载自检（对应清单第十四节"窗户的灯"）
用户清单第十四节点名了一批渲染问题，先修其中可离线验证的一条：**窗户的灯**。根因不在美术，在时间。

### 发现
- `new/mock.js` 的 `ENV` 一直写死 `{season:3, hours_type:2, weather:0}` —— 永远是"秋天傍晚"：
  · `MainOutView.update_season()` 只在 `hours_type==3||4` 时才给 `imgLightCover` 赋
    `mainout_season<seasonKey>_light_cover_png` → **窗户的灯永远不亮**；
  · `MainInView.updateSeason()` 用 1/2 走白天底图 `mainin_ch_bt*`、3/4 走夜晚底图 `mainin_ch_hy*`
    并给 `[bgGroup,c_player_bed,c_player_out,frogCap]` 套 `SeasonInColorMatrix` 的 light 矩阵
    → **屋里永远白天**；
  · `seasonKey = season+hours_type` 决定资源组 `season11..season44`（APK 里 16 组 eab 都在）
    → **季节永远秋天**；
  · `weather:0` 甚至不是合法 WeatherType（1..9）。
- 客户端不会自己算这些（真实服务器下发），所以要我们算。
- 另：`new/mail.js` 第 92 行调了未定义的 `log()` → 整个文件 eval 抛错，mock.js 只记一行
  `load fail mail.js: log is not defined`，真机日志刷了 75 次（`logs/game.log` 16:28–16:49）。

### 修
1. `new/mock.js`：`ENV` 改为跟**真实本地时钟**对齐的 `clockEnv()`，并挂到 `Mock.clockEnv`：
   season 3-5月=1春/6-8=2夏/9-11=3秋/12-2=4冬；hours_type 6-16=1白天/16-19=2傍晚/19-23=3夜晚/23-6=4深夜
   （对得上 `Tabikaeru.Define.Season` / `.HoursType`）；weather 默认 1(sunny)，`st.weather` 可覆盖。
   ⚠️ 坑：`var Mock` 在文件后面才定义，`Mock.clockEnv = ...` 必须写在 `var Mock = {...}` 之后
   （写在前面会因为 var 提升拿到 undefined，整个 IIFE 中断 → **MockServer 根本建不起来，游戏去连真服**）。
2. 新增 `new/weatherclock.js`：每 60 秒核对一次，跨段时 `dispatch("weather_load")`（推送时**先取快照**再
   定时发，避免 30ms 内又跨段）；`window.MOCK_CLOCK()` 手动核对、`window.MOCK_CLOCK(8)` 试算本地 8 点。
3. `new/mail.js`：补本地 `log()` 定义（功能本来没坏，文件却整层被判失败）。

### 回归
- `tools/layerloadtest.js`（新，verify.sh 第 39 步）：录下 boot 期间所有 `console.warn`，断言
  **没有任何 "load fail"**、没有 HANDLER-ERR、MockServer/MOCK_SEMANTIC/MOCK_STATE 都在
  —— 这次 mail.js 与"Mock.clockEnv 写早了"这两类事故以后都会被它当场抓住。
- `tools/weatherclocktest.js`（新，verify.sh 第 40 步，28 项）：冻结时间断言 7 个时点/月份的
  season+hours_type、weather_load 下发一致、weather 合法且可覆盖、32 种(月×时段)组合的 seasonKey
  都落在真实存在的 `season11..season44` 里、跨段会推 weather_load 且带新时段。
- 其余回归：furnituremaketest 21 / handcrafttest 19 / composeloop 17 / servicetest 7 / consumetest 6 /
  mailtest 10 全过；furnituretest 仍是改前那 3 个存档 POST 断言。

## v0.57: 清单第一次冲刺 —— 桌子点不动 / 抽奖券 / 商店键 / 兑换码 / 礼盒 / 调试通道
按 `旅行青蛙.txt` 立了 goal，两个只读审计子代理把 1–7 节与 8–13 节逐条判了状态（结论已并入本节与下方"仍缺"）。
本轮落地 9 项，全部有离线回归并接进 `tools/verify.sh`（步骤 39–43）：

### 1) "小屋的桌子还点不动" —— 客户端刷新时机问题（verify 41, benchspot 6 项）
- `MainOutView.updateFurniture()` 里 `btn_enterFurnitureBench.visible = FurnitureModel.isOpen()`（= `shop.start_time>0`），
  而它只在 **(a) 场景 childrenCreated、(b) `FurnitureEventType.UPDATE`** 时被调用；UPDATE 又只在"嘟嘟收摊"那一刻
  由 `FurnitureModel.furniture_load_furniture` 自己派发（`setTimeout(leave_time-now)` 里）。
- 开机时序一旦"先建场景、后到 shop 数据"，热区就永远 hidden ⇒ 点桌子没反应。
- 修：`new/furniture.js` 在数据下发后（+ boot+4s/+10s）补派一次 UPDATE（节流），并打
  `[MOCK] 工作台热区: isOpen=.. visible=.. touchEnabled=..`。手动 `window.MOCK_BENCH_SPOT()`。

### 2) 窗户的灯 / 屋里昼夜 / 季节（verify 40, weatherclocktest 28 项）—— 见 v0.56。

### 3) 层加载自检（verify 39, layerloadtest 6 项）—— 见 v0.56（顺带修掉 mail.js 的 load fail）。

### 4) 调试/GM 通道（清单第一节"存档重置/调试接口" + 第十八节"时间倍率"，verify 42, gmtest 33 项）
- `tools/devserver2.js` 新增 `POST /gm`（JSON 或纯文本）与 `GET /gm`（取走并清空队列）；
  `new/gm.js` 每 3 秒轮询并执行：`say/clover/ticket/give/take/clearbag/home/away/settime/offset/timescale/weather/dump/reset/reload/help`。
- 用法：`curl -s -X POST -d 'clover 9999' http://127.0.0.1:8089/gm`；客户端侧 `window.MOCK_GM.cmd('give',[8501,5])`。
- `settime/offset/timescale` 同时改 `Date.now` 与 `core.Time.getServerTime()` —— 这就是"服务器时间 + 倍率"的离线等价物，
  旅行倒计时/日历/活动窗都会跟着走。`reset` 清空 MOCK_STATE 后重载页面。

### 5) 商店 `purchased` 键错位 + 服务端不限购（servicetest +7 项）
- 客户端 `getShopItemBuynums(sid) = purchasedMap[sid]`，而 `purchasedMap` 由 `item_load_shop_info.purchased`
  以 **`o.item_id` = 商店行 id** 回填；`isShopItemBuyLimit(sid)` 用 `ShopDataDB.get(sid).limit`。
- 我们以前push的是**物品 id** ⇒ 客户端限购永远看到 0：相册扩容 2..12、"手工品材料"永不出现，
  而"相册扩容·1"能反复买（真机日志：同一 shop_id 反复购买、每次 -1000 三叶草）。
- 修：`item_buy` 记 `{item_id: sid}` 并按 `ShopDataDB.get(sid).limit` 服务端拦截（回 code 3）。

### 6) 兑换码成功必须回 `code:200`（servicetest 断言同步改）
- 客户端 `CdkeyView`: `if(200==e.code)` 才显示"礼包码兑换成功"，否则按 1..4 报"分享码无效/已被兑换过/…"。
- 我们两处实现都回 `{code:0}` ⇒ 玩家看到的是失败提示（虽然奖励加了）。现在成功回 200。

### 7) 嘟嘟商店 type14 商品买完即丢（furnituremaketest +4 项）
- 以前 `itype===14 → has_fur.push(itemId)`；而 type14 恰恰是"周年庆·家具礼袋/蜡梅/木槿…"这些**物品**，
  下一次下发又被"剔除非家具 id"清掉 ⇒ 重启凭空消失（客户端那边却是 addHouseItem 进物品栏）。
- 修：只有 **FurnitureDB 里有的 id** 才进 `has_fur`，其余一律进 `st.house`。

### 8) 抽奖券无限抽（verify 43, raffletest 23 项）
- 客户端 `RaffleView.raffle()` 用 `Tabikaeru.Define.RAFFEL_NEEDTICKETS`(=5) 只**判定不扣**（`consumeTicket` 只读），
  扣减是服务端的事；而 `item_gacha` 以前只有自动存根 `{ticket:0}` ⇒ 券永不减少、无限抽、永远白球。
- 修：新增 `new/raffle.js`：`item_gacha` 扣 5 张券 + 权重掷 rank(0..5) + 记录 `st.gacha` + 推 `item_update_ticket`，
  券不足回 `{ticket:-1}`（客户端把手恢复不播动画）；`item_redeem_prize` 按 `tables/Prize_json.json` 真发货
  （itemId>0 进仓库，rank0 的券奖加券）。`window.MOCK_RAFFLE` 可查次数/历史/奖品。

### 9) 归来结算三缺 + 礼盒搬运空实现（同 verify 43）
- `comeBack()` 以前只给 笔记+特产+三叶草+明信片 ⇒ 补：抽奖券 +1~2（推 `item_update_ticket`）、
  70% 生成一封"旅友来信"（`mail.js` 新增动态邮件 `window.MOCK_ADD_MAIL` + 推 `notify_new_mail`，
  客户端会把邮件插到列表头并亮红点）、50% 触发访客 `window.MOCK_SPAWN_VISITOR()`。
- `travel_gift_to_bag`/`travel_bag_to_gift` 以前只回 `{code:0}`（`st.gifts` 只增不减 ⇒ 特产永远拿不出来）：
  现在真搬运 + 上限 30 满时回 **102**（客户端弹"礼品盒满了"）。

### 本轮同时修掉的自身事故
- `mock.js` 里 `Mock.clockEnv = ...` 写在 `var Mock = {...}` 之前（var 提升 ⇒ Mock 为 undefined ⇒
  整个 IIFE 中断 ⇒ MockServer 建不起来、游戏去连真服）。审计子代理当场按行号抓出并复现，已挪进对象字面量，
  `tools/layerloadtest.js` 会守住这一类。

### 审计已确认、仍未做的缺口（下一轮清单，按优先级）
1. **明信片池覆盖**：`rules.js` 的 `PIC_IDS` 对客户端 `Picture_json.json` 的 Goal(151 张)/Unique(133 张) 覆盖 = 0
   ⇒ 目的地照与稀有照永远不掉；无权重/稀有度。
2. **`guest_load` 从不推送** ⇒ 客户端 `getGuestData().id>=0` 永远不成立，旅友投喂/回礼整条链不可达；
   `new/guest.js` 甚至没进 mock.js 的 extra 列表（死文件），且其 GuestData 字段与真实 {id,confirmed,served,expire_time,pos} 不符。
3. **旅友笔记 2000-2002 永不发放**（`NOTE_IDS` 只到 1000..1029）⇒ 客户端 `GiftModel.isOpen()` 永远 false、"礼品盒"打不开。
4. **手工产出不消耗材料**：`handcraft.js` 的祈愿物/印章每 90 秒白送一件，不扣 7000 制作工具/8000 材料。
5. **工作台状态未用**：`bench_lock`/`mood` 恒 0 ⇒ 客户端"呱~不许动"与 very_angry 罢工图永不出现。
6. **邮件过期**未实现（`normMail` 把 expire 归零）；**商品刷新**写进 `ans.list` 而客户端只读 `e.purchased`；
   春节正丹纸/周年庆织彩带没有按日历上下架。
7. 初始存档不发食物/四叶草（新档第一次出门必须先买食物）；`lottery_open` 固定给 1000、结算固定 +200。
8. 相册 `album_load` 忽略 start/count（现在靠客户端按我们回的 start 前缀填充侥幸可用）。

## v0.58: 清单第二次冲刺 —— 明信片池 / 邻居投喂 / 旅友笔记与回礼 / 手工消耗 / 起步包
审计（1–7 节、8–13 节）给出的缺口里，本轮再落地 5 项，全部有回归并接进 verify（步骤 44–47）：

### 1) 明信片池按类型/目的地/行李加权（verify 44, postcardtest 14 项）
- 以前 `rules.js` 是 `PIC_IDS[随机]`（60 个 id 均匀）⇒ 客户端表 351 张里
  **Goal(目的地照) 151 张、Unique(稀有/旅友) 133 张覆盖率 = 0**，目的地照与稀有照永远不掉。
- 新增 `new/postcardpool.js`：只从 **有图层** 的 id 里抽（343 张，客户端 `loadPicture` 读 `layers.length`，没图层会崩）；
  每次旅行随机定一个目的地（Goal 照片的 `place`，记进 `st.tripPlace`），权重 普通42/道具13/目的地30/稀有10%，
  **每带 1 件护身符(type 1 道具) 稀有率 +7%，上限 45%**（清单 §10"携带特定道具提高合照概率"）。
- 实测 3000 次：普通 1307 / 目的地 939 / 道具 415 / 稀有 339，稀有率 11% →（带 4 件护符）30%，目的地照 100% 与 `st.tripPlace` 一致。

### 2) 邻居（旅友投喂）（verify 45, guesttest 19 项）
- 审计根因：服务端**从不推 `guest_load`** ⇒ 客户端 `getGuestData().id` 永远 -1 ⇒ 点小伙伴只弹"小伙伴已经离开了"。
- 新增 `new/guestfeed.js`：开机 6 秒后来一位（id 必须是客户端 CharaDB 的 0/1/2），之后每 90 秒 35%（青蛙在家时）；
  payload **只带 GuestData 的五个键** `{id,confirmed,served,expire_time,pos}`（多一个键客户端会上报"数据合并错误"）；
  实现 `guest_confirm` / `guest_set_expire_time` / `guest_finish` / `guest_serve`：
  收下特产（服务端也扣仓库，客户端已本地扣）、按 CharaDB 口味给回礼（三叶草 = 20+口味/5、口味≥75 再 +1 抽奖券、25% 送特产），
  6 秒后送客。`window.MOCK_GUEST.spawn/clear/state/log` 可手动控制。

### 3) 旅友笔记 + StoryGift 回礼邮件（verify 46, friendtest 12 项）
- 客户端 `GiftModel.isOpen()` = 笔记列表里有 `TravelFriendsDB.visitOpen`（2000 壁虎/2001 刺猬/2002 萤火虫）；
  而 `rules.js` 的 `NOTE_IDS` 只有 1000..1029 ⇒ 这三张永不发 ⇒ **礼品盒永远打不开**。
  修：故事解锁时按 `partner` 补发 `2000+partner` 旅友笔记（去重、推 `travel_load_note`）。
- 客户端 `story_feedback_gift` 只能在 `Mail.EvtId.StoryGift(6)` 那封信上点出来，而以前没有任何地方产生它；
  修：`story_send_gift` 后 8 秒用 `window.MOCK_ADD_MAIL` 发一封 type=6 回礼信（三叶草 50 + 抽奖券 1）。

### 4) 手工消耗（清单 §9"制作消耗"）+ 5) 新档起步包（清单 §1）（verify 47, startertest 9 项）
- `handcraft.js` 的祈愿物/印章以前每 90 秒白送一件；现在每开一单消耗 **7000 手工品制作工具 x1 + 8000 手工品材料 x1**，
  材料不足就停手并打一次日志（`handcrafttest` 同步加断言：开一单扣 2 件、用光后停手）。
- 新档 `house` 以前是空的（bag/desk 全 -1，第一次出门必须先跑去商店）：现在给 3 份食物 + 1 个四叶草护身符。
  注意这只影响**全新存档**（`reset` 后），老存档原样。

### 下一轮仍缺（按优先级）
1. **邮件过期**（`normMail` 把 expire 归零；客户端只在 expire>0 时自动拆信）。
2. **商品刷新**：`rules.js` 的轮换写进 `ans.list`，而客户端 `item_load_shop_info` 只读 `e.purchased`；
   春节正丹纸(10102)/周年庆织彩带(10108) 没有按日历上下架（`furnitureShopData` 里有行，但窗口是死的）。
3. **工作台状态**：`bench_lock`/`mood` 恒 0 ⇒ 客户端"呱~不许动"与 very_angry 罢工图永不出现。
4. **相册 `album_load` 忽略 start/count**（现在靠客户端按我们回的 start 前缀填充侥幸可用）。
5. `lottery_open` 固定给 item 1000、结算固定 +200 三叶草（无奖池/无抽中记录）。
6. 照片进出礼盒（`travel_album_to_gift` / `travel_gift_to_album`）仍是空实现；`guest.js` 是没挂载的死文件（应删）。
7. 聚会（`TimerEvent.PartyGo=23/PartyResult=24`）没有独立流程；图鉴缺"道具/旅友收集进度"；道具没有使用效果（无 item_use 协议）。

## v0.59: 清单第三次冲刺 —— 邮件过期 / 相册分页 / 季节商品 / 工作台状态
（verify 第 48 步 mailseason 21 项；furnituremaketest 扩到 31 项）

### 1) 邮件过期（清单 §11"邮件附件: 领取、过期"）
- 客户端 `revice_mails`/`notify_new_mail` 的逻辑是：`expire>0 && expire<=now` 且这封信带不了的东西
  → 自己 `openMailInfo()` 自动拆信领奖；我们以前 `MOCK_ADD_MAIL` 恒 `expire=0`，永不过期。
- 修：`MOCK_ADD_MAIL` 默认 **7 天后过期**（可传 `expire` 覆盖）；新增 `sweepExpired()`，
  在每次 `mail_load` 前 + 每 60 秒扫一遍，把已过期未领取的邮件**服务端也入账**（三叶草/抽奖券/附件进仓库）
  并推 `clover_update`/`item_update_ticket`/`item_load_items` —— 与客户端行为对齐，且幂等。
  `window.MOCK_MAIL_SWEEP()` 可手动触发。

### 2) 相册分页（清单 §6"相册列表：分页"）
- 客户端 `album_load(start,count)` 用 `pictureInfoList[e.start+n-1] = i[n]` 填**绝对下标**；
  我们以前忽略 start/count、永远回全部 + `start:1`（靠前缀填充侥幸能用）。
- 修：`rules.js` 的 `S['album_load']` 现在按 `start/count` 切片并回正确的 `start/total`（越界只回剩下的）。

### 3) 季节商品（清单 §8"特殊刷新：春节正丹纸、周年庆织彩带"）
- 正丹纸(10102)/织彩带(10108) 平时就混在嘟嘟的常驻列表里（furnitureShopData id 3 / id 7），窗口是死的。
- 修：跟着 `MOCK_CALENDAR` 的真实日历走 —— **春节(springcard) 才上正丹纸、年末/周年庆(greetcard) 才上织彩带**，
  过季下架（日志里会写"过季下架 …"），到季至少给 1 件库存（`num`），买了照样售罄。
  于是"9 月不该出现春节商品"这条同时成立。

### 4) 工作台状态（清单 §9"工作台状态：空闲、制作中、完成"）
- 客户端只有两个状态通道：`isLockBench()=bench_lock`（点格子会弹"呱~不许动"）与 `mood`（very_angry 罢工图）。
  我们以前 `bench_lock` 恒 false、`mood` 恒 0。
- 修：**正在做家具 或 青蛙出门 → bench_lock = true**（台面锁住，符合"制作中不该乱动"）；
  `st.mood` 可覆盖（GM 调试用的罢工图）。`furnituremaketest` 加了 5 条断言。

### 仍未做（下一轮）
1. `lottery_open` 固定送 item 1000×1、结算固定 +200 三叶草（无奖池/无抽中记录）。
2. 照片进出礼盒（`travel_album_to_gift`/`travel_gift_to_album`）仍是空实现；`guest.js` 是没挂载的死文件（应删）。
3. 聚会（`TimerEvent.PartyGo=23/PartyResult=24`）没有独立流程；图鉴缺"道具/旅友收集进度"；道具无使用效果（客户端没有 item_use 协议）。
4. `rules.js` 里那套"商店每日轮换"写进 `ans.list`，而客户端 `item_load_shop_info` 只读 `e.purchased` —— 纯死代码，要么删要么改语义（每日重置 `purchased` 已经实现）。
5. 离线结算只补一趟旅行（没有按时长累计多趟）。
6. 客户端表里**不存在**清单 §10 点名的"猫咪/蚂蚁/蜗牛/蜜蜂"旅友（`TravelFriends_json.json` 只有壁虎/刺猬/萤火虫）—— 这一条属于"客户端不支持"，无法凭空补。

## v0.60: 清单第四次冲刺 —— 照片进出礼品盒 + 死代码清理
（verify 第 49 步 giftboxtest 15 项）

### 1) 照片在相册 <-> 礼品盒之间真的搬得动（清单 §6"删除/分享"与 §7 礼盒）
- 客户端 `AlbumView.onPutBtn` → `travel_album_to_gift(picture_id)`，`GiftBoxView.gift_to_album` →
  `travel_gift_to_album(picture_id)`；错误码 **100 = 礼品盒满了**、**101 = 相册满了**（客户端就是按这两个码弹提示）。
- 我们以前：两个协议只回 `{code:0}`（点了没反应），而 `travel_load_gift.pictures` 回的是"相册全部照片的 id"
  ⇒ 礼盒永远清不空、也搬不动。
- 修：`st.giftPhotos` 成为**独立**于相册的照片盒（存完整照片对象，含 `pic_id`，才搬得回去），
  `travel_load_gift.pictures` 回盒内照片；两个搬运协议真搬 + 容量校验（盒 30 / 相册 60）；
  `postcard.js` 的分发出口也顺带给 `travel_load_gift.pictures` 补 `layers`（客户端渲染照片会读 `layers.length`，
  没有就崩 —— 这是之前那次崩溃的同一类坑）。

### 2) 死代码清理（审计点名）
- `rules.js` 里那套"按天轮换一份 list 塞进 item_load_shop_info 回包"的逻辑**删掉**：客户端
  `item_load_shop_info` 只读 `e.purchased`，`list` 从来没人消费。真正的"每日刷新" = 每天把 `purchased` 清零
  （早已实现，servicetest 覆盖）；页面上商品的显示与解锁由客户端自己的 ShopDataDB + `before_buy` 链决定。
- 顺带删掉 `shopStock()` / `ORIG_SHOP` 与 `S['travel_depart_now']`（后者不在客户端 245 条 ProtocolList 里，
  永远收不到；"强制出发"请用 GM 通道 `curl -X POST -d 'away' http://127.0.0.1:8089/gm`）。
- 删掉 `new/guest.js`：它从来没进过 `mock.js` 的 extra 列表（死文件），而且它注释里的 GuestData 字段
  （partner/name/city/gift/carpet）与客户端真实的 `{id,confirmed,served,expire_time,pos}` 不符 ——
  多传键会触发客户端 `jf_commit js.error` 上报。旅友投喂已由 `new/guestfeed.js` 正确实现。

### 3) 一条"刻意不做"的清单项
清单 §3 写"离线结算：服务器启动时补算已归来的旅行"。当前实现是：启动时若青蛙已过归来时间，
下一次 4 秒 tick 就结算**这一趟**。**不做"多趟累计补算"** —— 原版玩法是"出门一次、回来要玩家再送出门"，
自动补算多趟等于凭空发奖励，与客户端叙事（日记/明信片一条条来）也不一致。这一条按"设计如此"记录。

### 仍未做（下一轮）
1. 聚会（`TimerEvent.PartyGo=23 / PartyResult=24`）：客户端有播报与文案，我们从不发这两个事件，
   需要一条"出门聚会→带回照片/物品"的独立流程（要先把 `evt_value` 的约定从客户端代码里读清楚）。
2. 抽奖奖池/记录：`lottery_open` 固定送 item 1000×1、结算固定 +200 三叶草（流程可用，缺权重奖池与抽中记录）。
3. 图鉴缺"道具/旅友收集进度"（`item_load_handbook` 只下发 collections/specialtys 两个 id 数组）。
4. 客户端表里没有清单 §10 点名的猫咪/蚂蚁/蜗牛/蜜蜂旅友 —— 属"客户端不支持"。

## v0.61: 清单第五次冲刺 —— 聚会(PartyGo/PartyResult) + 家具 TimerEvent + 抽中记录
（verify 第 50 步 partytest 23 项；furnituremaketest 扩到 35 项）

### 1) 聚会系统（清单 §10"聚会系统：青蛙参加聚会、带回照片、物品"）
客户端契约（逐字核对 main.min.js）：
- `TimerEvent.PartyGo(23)`：`evt_value[0] > 0 ? "{0}精力充沛地出去聚会了" : "{0}出去聚会了"`（Yellow_Friend 播报）。
- `TimerEvent.PartyResult(24)`：播报"{0}回来了。"，点掉后开 `PartyResultView`，参数是
  `{guest: evt_id, page: v[0], coll: v[1], clover: v[2], ticket: v[3], items: v.splice(4)}`。
  坑：`TravelModel.filtrateEvent()` 会把 `evt_value[2]` 当**花费**从客户端三叶草里扣掉，
  而 PartyResultView 又拿同一格当"获得的三叶草"显示 —— 为避免开机重放事件时重复扣，
  **我们传 -1**（不显示、不扣），三叶草走 `clover_update` 绝对值推送。
- 新增 `new/party.js`：青蛙在家且没有出门、距上次聚会 > 12 分钟时按概率发起，一场 150 秒；
  回来带回 1 张明信片（走 postcard 池、带 1 件护身符 → 稀有/合照概率更高）+ 1~2 件特产 + 1 张抽奖券，
  全部服务端记账并推 `album_load_new`/`item_load_items`/`item_update_ticket`。
  `window.MOCK_PARTY.start()/finish()/state()/log()` 可手动控制；开关机 20 秒后若从没聚会过会先来一场。
- `travel2.js` 的 `MOCK_EVENT(type, value, extra)` 增加第三参（聚会结果需要 `evt_id = 小伙伴 id`）。

### 2) 家具的两个 TimerEvent（客户端本来就有播报，我们从来不发的）
- `FurnitureFinish(21)`：`evt_id` = 家具 id → 客户端播报"获得新家具"。`furnituremake.js` 完成一件就发。
- `FurniturePut(22)`：摆放家具后播报"小屋好像发生了一点变化"。`furniture_replace_fur` 成功后发。

### 3) 抽中记录（清单 §2"奖池、抽中物品、记录"）
- `lottery.js` 的 `lottery_confirm_reward()` 现在把每次结算写进 `st.lotteryLog`
  （phase / answer / egg_num / right / clover / time，最多留 100 条）。
- 注：扭蛋抽奖的**权重奖池**已在 `raffle.js`（rank 权重 + `st.gacha`/`st.prizes` 记录）实现；
  周末抽奖(帮忙挑选)的奖池来自客户端自己的 `lotteryData` 表，服务端只负责发奖与记账。

### 4) 一条审计结论的更正
审计说"图鉴缺道具/旅友收集进度" —— 实际 `rules.js:452` 早就用 `config.eab` 解出的真数据实现了
`encyclopedia_load`/`encyclravel_load`（unlock_list/unlock_desc/show_sub），而客户端 `item_load_handbook`
只读 `collections`/`specialtys` 两个数组，没有"道具/旅友进度"的协议口子。这一条按"客户端不支持更多"记录。

### 仍未做 / 做不到
- 客户端表里**没有**清单 §10 点名的猫咪/蚂蚁/蜗牛/蜜蜂旅友（`TravelFriends_json.json` 只有壁虎/刺猬/萤火虫）。
- 多趟离线结算：按设计不做（原版一次只出一趟）。
- 联网类：分享/广告/内购/账号/排行/公告/淘宝/官方码池/真签名 —— 见 v0.57 的联网清单。

## v0.62: 清单第六次冲刺（收尾）—— 墙上的地图(离线) + 抽奖奖池 + 全量回归
（verify 第 51 步 travelmaptest 11 项；lotterytest 扩到 31 项；见 logs/verify_all.out 全量报告）

### 1) 墙上的地图 —— 用户点名的最后一项（离线半实现）
- 根因：`MainInView.on_enterTravelMap_tap()` 要求 `ActivityModel.getActivity("travelmap").params.isOpen`，
  这个活动来自**渠道公告** `BaseChannel.getAnnInfo({type:"activity",tags:["travelmap"]})`（HTTP，离线拿不到）
  ⇒ 点地图没反应。
- 修：新增 `new/travelmap.js` —— 把当前渠道**单例**的 `getAnnInfo` 包一层，只劫持 `tags` 含 `travelmap`
  的那次调用，返回 `{anns:[{url:"http://127.0.0.1:8089/travelmap.html", isOpen:1}]}`；其它公告（维护/防沉迷）原样透传。
- 新增 `new/travelmap.html`：页面自己 `GET /load` 读本机存档，显示三叶草/抽奖券/明信片/日记/故事/家具/物品/旅行次数
  + "走过的地方"（按 `st.tripPlace` 点亮）。
- `tools/devserver2.js` 增加 `.html -> text/html` 分支（以前所有文件都发 `application/javascript`）。
- 说明：真正把网页弹出来要靠原生 WebView；若原生层不响应，行为与以前一致（点了没反应），**不会有副作用**。

### 2) 抽奖"奖池"（清单 §2 最后一块）
- `new/lottery.js` 的开局奖励以前固定四叶草×1；现在从 7 条**真实物品**权重池里抽（四叶草 40 / 特产 18/14/12 /
  道具 8/5 / 稀有道具 3），并写进 `st.lotteryLog`（`kind:"open"`），与结算记录共用一本账（最多 100 条）。
- 扭蛋抽奖的权重奖池与记录在 `raffle.js`（rank 权重 + `st.gacha`/`st.prizes`），周末抽奖的邻居偏好表在客户端
  `lotteryData` 里（服务端不复制，只发奖记账）。

### 3) 一处回归的修复
`raffle.js` 接走 `item_redeem_prize` 后，`st.redeemed`（handbook.js 早先的记账，handbooktest 断言依赖）没写 →
全量回归时第 16 步 `handbooktest` 报 1 条 FAIL。已修：领奖时 `st.prizes` 与 `st.redeemed` **两本账都记**。

### 4) 交付物
- `做不了的功能清单.md`（新）：**必须联网的 10 类** + **客户端本身不支持的 6 类** + **刻意不做的 3 类** +
  **仍可做的低优先级 4 项**，每条都带客户端依据。
- `logs/verify_all.out`：51 步全量回归报告（唯一失败是 `furnituretest` 那 3 条 **改前就有**的
  harness 存档 POST 断言，与本次改动无关，属已知基线）。

## v0.63: 收尾 —— furnituretest 的"3 条基线失败"其实是测试等太短（现已全绿）
- `tools/furnituretest.js` 最后一段要验"家具状态被 POST 到 /save 并能被重开恢复", 只等了 **1300ms**;
  而 `persist.js` 的 `MOCK_SAVE` 是"去抖 1 秒 + **4 秒强制 flush**"(`SAVE_MAX_DELAY=4000`), 且
  `travel2.js`/`handcraft.js` 等层每秒都会调一次 `M.handle` -> persist 的 handle 包装每次都刷新去抖计时器,
  于是 1300ms 内根本轮不到 POST。这三条 FAIL 从项目早期一直挂着, 被当成"已知基线"。
- 修: 等待时间改成 **4600ms**(> SAVE_MAX_DELAY), 三条断言全过 —— `furnituretest` 现在 21/21。
  顺带证明家具状态**确实会持久化**(设备上的 `save/state.json` 里也一直有 `furniture.bench`)。
- 结论: 全量 `tools/verify.sh`（51 步）现在**没有任何 FAIL**。

## v0.64: 崩溃排查 —— 日志链路断了 6 小时 + APK 内置兜底是旧 mock
用户报"崩溃"。查完的结论（都可在本文件的日志/进程/APK 里复核）：

### 1) 排查时发现的两个基础设施故障（已修复）
- **8088 日志服挂了**：`logs/game.log` 从 `2026-09-13T17:28:29Z`（= 01:28 本地）之后**一行都没有**；
  进程扫描发现 logserver 已不存在、`curl 127.0.0.1:8088` 连接失败。已重启（现在 200）。
- **8089 devserver 也挂了**：最后一条服务记录是 `17:37:57Z`（01:37 本地）。已重启（现在 200）。
  ⇒ 也就是说：**01:37 之后启动游戏，mock 会回落到 APK 内置的旧快照**（见下），而且**崩溃也写不进日志**。

### 2) 崩溃最可能的原因：APK 内置兜底 = 10 天前的 v0.51.0
`assets/game/js/mock.min.js` 的加载顺序是 `http://127.0.0.1:8089/` → 失败则 `file:///android_asset/game/js/new/`，
而 **APK 里确实打包了 `assets/game/js/new/*`（36 个 js）**：
| 文件 | APK 内置 | 当前 | 关键差异 |
|---|---|---|---|
| `mock.js` | v0.51.0, 27.6KB | v0.54.0, 30.1KB | 之后新增了 vprobe/furnituremake/weatherclock/gm/raffle/postcardpool/guestfeed/party/travelmap 等 15 个层 |
| `handcraft.js` | 5.3KB | 10.6KB | **没有**"合成要扣材料+推刷新"的修复 → 就是 00:30 那次卡死崩溃的那版 |
| `furniture.js` | 5.2KB | 25.4KB | 没有工作台制作/商店库存/季节商品等全部修复 |
所以"8089 挂着的时候启动游戏 + 点开工/合成"= 直接跑回**已知会无限循环卡死的那版**。这与"崩溃"完全吻合。
（另外 06:00 那次日志显示游戏 22:00:07 启动 → 22:00:28 进后台 → 22:00:30 又重启一次；这趟没有 JS 异常。）

### 3) 日志里唯一的启动期异常（已修）
`DISPATCH-ERR item_load_items : Cannot read properties of null (reading 'getFile')`
出现在 04:22 / 17:21 / 22:00 三次启动 —— 登录瞬间我们就把物品数据推给客户端，而 Egret 的
`AssetManager`（`assetsmanager.min.js`）还没建好；异常被 `dispatch()` 的 try/catch 兜住（所以不死），
但那一次刷新丢了。修：`mock.js` 的 `dispatch()` 识别 `getFile/AssetManager` 类错误，在 400ms/1200ms 后
**有限次重投**同一份数据，并打上 `[资源管理器未就绪 -> 稍后重投]` / `DISPATCH-RETRY 成功`。
测试 `tools/dispracetest.js`（verify 第 52 步）。

### 4) 历史崩溃类型（都在本次冲刺里修掉了）
`grep -o "EXC: ..." logs/game.log` 统计：**2745 次** `reading 'image'`（`main.min.js:13 renderItem` forEach）、
10 次 `reading 'length'`（`loadPicture` 读 `pic.layers.length`）、2 次 `reading 'duration'`、
邮件 `fillItems` 读 `items.length`。最后一次 `EXC:` 是 2026-09-13T09:24:00Z，之后（含最近两次启动）没有新的 EXC。

## v0.65 用户 bug.txt 第一批(2026-09-15): 聚会每周任务 / 小屋即时刷新 / 弹窗刷屏 / 旅行时长 + 任务计划 / 称号 / 百科 / 旅友礼品盒 / 故事送礼

### 1. 聚会活动「每周任务」做不了 (bug.txt #7)
- 客户端 `PartyCakeModel`: `data.task_list[e.task.id-1] = e.task`;面板标题 `*每周一0点刷新任务`,
  表 `PartyCakeData.task_list` = 6 条(登录游戏3 / 商店买买买2 / 商店抽奖一次3 / 看一次广告3 / 完成一次分享3 / 聚会或是旅行2),
  视图读 `{id,count,is_done}` + `cfg.total`,**完全由服务端算**。以前 `taskList()` 恒 `{count:0,is_done:0}`。
- `new/partycake.js` 重写任务部分: 真实计数(登录/购买/抽奖/分享/出发/聚会)、完成时奖励进 `pre_cream/pre_sugar`
  (客户端视图 LOAD 时自动 `req_get_mate` 领,服务端在那一刻把 pre 并进 cream)、`partycake_load_task` + `partycake_load` 推送、
  周一 0 点整周重置。计数统一包在 `Mock.handle` 上(协议函数加载顺序无关)。
- 回归: `tools/caketasktest.js` (verify 53)。

### 2. 准备出发后小屋里青蛙不立即更新 (bug.txt #9)
- 根因(源码证据): `MainInController` **没有**监听 `RoleEventType.loadRole`;唯一决定"屋里有蛙"的
  `MainInView.updateFlogStatus()` 只在 `childrenCreated` 与 `reset()`(重新进小屋)时调用,
  所以 push `client_load_role` 只更新外面场景 -> 要出门再进屋才变。
- 新增 `new/roompatch.js`: `MOCK_REFRESH_ROOM()` 从 `PageManage` 场景层控制列表(兜底: 舞台树)
  找到带 `updateFlogStatus` 的视图直接调用, 顺带 `updateFurnitureAni()` / `updateBagState()`;
  `travel2.js` 的状态观察器在出发/回家时调用(各推一次 + 700ms 补刷)。
- 回归: `tools/roomrefreshtest.js` (verify 54)。

### 3. 弹窗刷屏 / 莫名"获得新家具" (bug.txt #10 #21)
- 家具制作 60 秒一件 -> 一晚上弹十几次。现在普通 600 秒、大件(墙壁/地面/阁楼/栏杆/窗户/仓门, type 1..6) 1800 秒,
  `st.makeSeconds` 可覆盖(`/gm make 120`)。
- 新增播报策略 `MOCK_NOTICE(type,value,extra,tag)`: 页面可见时把播报**挂起**(同一 tag 只留最新一条),
  `visibilitychange` 或 `/gm flush` 时补播;`st.noticeMode = auto|always|never`(`/gm notice always` 回原版)。
  用于 FurnitureFinish(21) / FurniturePut(22) / PartyGo(23) / PartyResult(24);数据推送不受影响。
- 聚会间隔 12 分钟 -> 90 分钟(概率 25%->20%)。
- 回归: `tools/noticespamtest.js` (verify 55)。

### 4. 旅行过于频繁 + 原版时长 (bug.txt #11~#17)
- 以前固定 90 秒(后来 3~7 分钟)一趟。现在按**行李**算: 食物(type0)按 price 分档
  (<=20 -> 1.5h, <=40 -> 2.5h, <=60 -> 6h, <=90 -> 9h, 更高 -> 14h) + 道具(type2) 每件 +3h +
  护身符(type1) 每枚 +1.5h, 乘 0.85~1.35 抖动, 夹在 0.5~72 小时;没带吃的只晃半小时。
  `st.travelSeconds` 仍是显式覆盖(GM `/gm trip 3`), 且**不再黏住**下一趟;`st.tripSeconds`/`st.tripPlan` 记录这一趟。
- 回归: `tools/tripdurationtest.js` (verify 56), `noticetest.js` 的时长断言同步更新。

### 5. 「伴蛙前行」任务/计划(日/周/半月/月/季/年) (bug.txt #20)
- 客户端零计数器: `task_load = {tasks:[{id,pro,is_reward}], list:[{id,pro}]}`(id 必须分别是
  `task_list`(30 键)与 `list_map`(67 键)的键, list 还必须含 101/201/301/401/501/601 否则页签不出现;
  出现非 list_map id 会让 `updateRedot -> getCompleteListNum` 抛异常, 任务窗整块打不开);
  `task_load_list = {reward:[{id:节奏1..6, pro:已领档位数}]}`;`task_get_reward` / `task_get_list_reward`
  必须回 `{code:0}` 且**奖励要我们推**(`ItemModel.addHouseItem` 是空函数)。
- 新增 `new/tasks.js`: 从存档状态推导 28 个累计指标(旅行/照片/笔记/旅友笔记/故事/特产/纪念品/三叶草峰值/
  抽奖券峰值/购买/祈愿物/印章/家具/聚会/贺卡/投喂/装饰/日历/分享/抽奖…), 计划进度 = 各节奏窗口内的增量
  (日/周一0点/半月/月/季/年); 关键词映射 list_map 行 -> 指标; 领奖真发奖并落库; 定期推送。
- `new/activities.js` 里那份错误的 `task_load` 删除(**它把 list_map 当 task_list 发**),
  `new/guard.js` 的 `SET.task` 白名单从 list_map id 换成真实 task_list 键(否则 guard 会把任务全删掉)。
- 回归: `tools/taskplantest.js` (verify 57)。

### 6. 日历「当日任务 / 节气奖励」点了没反应 (bug.txt #21 同类)
- 客户端 `req_st_reward` 成功回调里有 `data.task_list[0].complete=!1` —— `task_list` 为空数组会抛异常,
  于是 `checkRedot()` 与隐藏图标的回调都不执行(红点常亮/图标不消失);`canGetStReward()` 空真也导致红点常亮。
- `calendar_load.task_list` = 客户端写死的那三条(观看广告或完成分享 / 累计获得三叶草 / 商店抽奖兑换),
  带 `pro` 与 `complete`(当日增量, 由 tasks.js 提供);`st_days` 的键改回**当月第几天**
  (客户端 `o = imageList.length`, 以前发 `calCell(today)` 键永远对不上 -> 点格子什么都不发);
  当天已领过就不再发 `st_days`, 并 `calendar_task_update` 推送变化。
- 回归: `tools/caltasktest.js` (verify 58)。

### 7. 旅友笔记 / 阁楼礼品盒 / 投喂手信 (bug.txt #22 #23)
- `GiftBoxModel.isOpen()` 与旅行笔记"旅友"栏**同一个条件**: `note_list` 里要有
  `TravelFriends.visitOpen = [2000,2001,2002]`(Note 表 type2)。以前 `NOTE_IDS` 只有 1000..1029(type1)。
- `rules.js`: 新增 `FRIEND_NOTE_IDS` 与"第一次回家必给一封旅友笔记"的挑选逻辑。
- 投喂回礼: 客户端三条回礼通道里事件 7 是空操作, 现在补一封 `type=3(Gift) + sender=0..2` 的邻居回礼邮件(带特产)。
- `handbook.js`: `item_load_handbook.collections` 只发 Collection 表 id(0..61)(以前把 103xx 图纸塞进去,
  既语义不对又被 guard 丢掉);`mail.js` 领附件后补推图鉴。
- 回归: `tools/friendgifttest.js` (verify 59)。

### 8. 称号(成就) (bug.txt #19)
- 客户端只在 `client_load_role` 写称号: `frog = {achieves:[id], achieves_time:[{id,time}](time 是到期时间),
  cur_achieve}`;`client_set_achieve{id}` 必须落库(以前 NO-HANDLER + 硬编码空数组 -> 界面永远 ??????)。
- 新增 `new/achieve.js`: 解析 `Achieve_json.info` 文本条件(旅行次数/纪念品种类/特产种类/三叶草/抽奖次数/
  登录天数/某物品超过 N 个/短途/长途/连续带果汁)自动达成, 新达成 push `client_load_role`
  (客户端据此弹"首次获得称号");3 条 `is_special`(道具解锁)不自动发。
- 回归: `tools/achievetest.js` (verify 60)。

### 9. 植物百科 / 旅行百科 (bug.txt #19)
- `unlock_list` 必须是 **long_id**(植物 `id*10000+sub*100+pic`, 旅行 `id*10000+sub`),
  以前发主 id -> 客户端查表 undefined 全丢 -> 列表恒空;**旅行百科空列表会让窗口直接打不开**
  (`EncyTravelView.updatePicItems` 对补位 `{}` 取 `ItemDB.get(undefined).type`)。
- 新增 `new/ency.js`: 从客户端自己的表生成 long_id 列表(绝不为空), `show_sub.sub_id` 也用 long_id,
  `set_show_sub` 读 `long_id` 参数(以前读 `p.id` -> 切换存不上); 解锁条件由我们定
  (旅行按"拥有/带过该 item", 植物按种过/收获过的植株), 变化时 push。
- 回归: `tools/encytest.js` (verify 61)。

### 10. 故事送礼 (bug.txt #19)
- `story_send_gift` 现在真的扣礼物(仓库/礼品盒/背包三种来源), 一个故事只能送一次,
  之后发 `type=6(StoryGift)` 回礼邮件(sender = 伙伴 0..2, resource 带 ads_id)。
- 回归: `tools/storygifttest.js` (verify 62)。

### 11. 绘纸/绘本链路 (bug.txt #22 的邻居侧)
- `new/drawing.js`: 邻居白名单 `[0,1,2,3]` -> `[0,1,2]`(客户端三处三元素索引, 3 会崩);
  `bag` 固定 4 格(客户端 `Souvenir.update()` 读 `bag.length`); 画完发 `PartyGo(23)` + `PartyResult(24)`
  (客户端打开绘本结果页靠事件 24; 事件 7 是空操作); 邀请挂 3 分钟没人理 -> 自动接受;
  去掉把家具图纸 103xx 写进绘纸 `colls` 的逻辑(语义错误且被 guard 丢掉)。

> 测试总数: verify.sh 62 步;本轮新增 10 个测试文件(caketask/roomrefresh/noticespam/tripduration/taskplan/caltask/friendgift/achieve/ency/storygift)。

### 12. 称号弹窗连点 (用户截图反馈: 「这样的弹窗太多了，需要一直点」)
- 客户端 `checkNewAchieve()` 一次只弹**一个** `ModalAlert("恭喜获得称号：…")`, 点掉后的回调里再调一次,
  直到 `achieves.length == clientSettings.achieveList.length` —— 所以"一次追认 N 个称号"就是 N 连点。
  实测老存档第一次启动时一次追认 **41 个** (日志: `称号: 本轮新达成 41 个 [启动]`)。
- `new/achieve.js` 改成:
  · **老存档首次追认 -> 全部静默**: 把已拥有的 id 预写进 `clientSettings.achieveList`(客户端据此认为"弹过了"),
    一个弹窗都不出, 称号照常出现在称号界面;
  · 之后玩出来的新称号进 `st.achieveQueue`, 每 `st.achieveGap`(默认 **300 秒**)最多放行一个 -> 一次一个;
  · `S['client_set_client']` 包一层: `achieveList` **只增不减**(客户端只回传它弹过的, 覆盖掉会复活弹窗链);
  · GM: `/gm achieve now|silent|gap 40|list`。
- 回归: `tools/achievetest.js` 补了"首次静默 / 队列节流 / 放行后才推送"三条断言。

### 13. 图鉴层补推时机
- 层加载时客户端表还没就绪(真机日志: `图鉴层就绪: 植物 0/0 条`), 而旅行百科 `unlock_list` 为空会让
  窗口直接打不开。现在 tick 缩到 2.5 秒, 并且**拿到真实数据的第一次也补推**(`图鉴首次 -> 植物 1 条 / 旅行 14 条`)。

### 14. 手工品界面 NaN.NaN.NaN (用户截图反馈)
- 客户端 `PrayCraftDetailRender.dataChanged`:
  `this.l_date.text = core.DateFormat.format(1e3*entry.stamp_time, "YYYY.MM.DD")` —— 我们的祈愿物条目
  以前只有 `{id,u_id,state,body,paper,make_time}`, **没有 stamp_time** -> `1e3*undefined = NaN` ->
  界面上就是大字 `NaN.NaN.NaN`。
- 同一条目还必须有: `content`(PrayCraftNoteDB id, 刻在祈愿物上的字, `get(id).info`)、
  `body`/`paper`(PrayCraftBodyDB id, `HandCraftUtils.getLayerSource` 取 `pray_pic`)、
  `state`(1..4 分组)、`make_time`(排序); 印章条目要有 `time`(红点判定)。
- `new/handcraft.js`: 新增 `fixWish()`/`fixStamp()` —— 建单时补齐字段, 并且 `pray_load_grays` **出口统一清洗**
  (老存档里的脏数据下一次读就修好, 不用等重新做)。
- 回归: `tools/handcrafttest.js` (verify 63)。

## v0.66 按 /storage/emulated/0/new.txt 实现「青蛙状态机」(2026-09-15)

new.txt 把原版青蛙整理成 居家/旅行/社交/特殊 四类状态 + 11 个称号。本轮落地:

### 15. 居家状态机 (new/frogstate.js)
- 动作表**直接用客户端自己的**: `Tabikaeru.Define.Frogpattern`(0..2 三套序列)、`FrogMotionNum{doku:0,doku_s:1,write:2,make:3,eat:4}`、
  `FrogMotionName`(dokusyo_ie 看书 / inemuri_ie 打瞌睡 / hikki_ie 写信 / sagyou_ie 手工 / syokuzi_ie 吃饭 / sleep_1..4)。
  每 3~12 分钟换一个动作, 推 `client_load_role` + `MOCK_REFRESH_ROOM()` 让小屋重画, 并解锁对应的小动作图鉴
  (`momentData` type=1 → `misc_moment_load`)。**注意绝不能发 5..9**(saw/brush/knock/knit/cut 是外面场景的动画, 屋里 `updateFlogStatus` 会直接 return 不画青蛙)。
- 收拾行囊: 回家后把桌上的备用品默默收进背包(真搬运 + 推 `item_load_items`)。
- 饥饿等待 / 饿晕: 背包+桌子都没有吃的就记 `emptySince`; 超过 2 小时改成一直睡觉(sleep_1..4)。
- 离家出走: 空行李持续 `st.runawaySeconds`(默认 10 小时) → status=1 且 `returnAt` 推到一年后(不会自己回来),
  必须在**桌上**放吃的才会消气回家(回到 rules.js 的结算泵)。
- 自主出发(旅行状态"是否出门由它自己决定"): 背包里有吃的 + 在家待够 30~180 分钟 + 手上没有没做完的家具 → 自己走
  (走客户端的 `item_set_bag_completed`, 与 `/gm away` 同一条路)。
- 回归: `tools/frogstatetest.js` (verify 65)。

### 16. 社交: 庭院访客排期 (new/guestfeed.js)
- new.txt: "旅行 2 次后蜗牛到访, 5 次后蜜蜂, 8 次后乌龟, 之后每隔 3 次一位访客"。
  映射到中国版三位邻居(困困/胖胖/跳跳 = CharaDB 0/1/2), 命中排期点立刻来一位(不等随机), 同一趟只触发一次;
  `window.MOCK_GUEST.schedule()` 可手动跑一次。

### 17. 称号效果 (new/achieve.js 的 `MOCK_TITLE`)
- "佩戴不同称号会影响后续旅行" —— 按称号表 `info` 文案归类:
  「出发超过24小时…」/「旅行达到50|100次」→ 旅行时间 ×1.35; 「出发不到30分钟…」→ ×0.6;
  「…三叶草…」→ 带回三叶草 ×1.5; 「…超过10个」→ 照片偏向道具(`photoBias`, 供明信片池后续使用)。
- 挂钩: `new/travel2.js` 的 `planTrip()`(时长)、`new/rules.js` 的 `comeBack()`(三叶草)。

### 18. 口径修正
- 用户澄清: 先前"原版玩家不能自己摆家具、由青蛙决定"**作废** → `new/furnishplace.js` 的玩家入口(`重新布置`)
  **默认开启**(`st.furnishUI=0` 可关); 青蛙的自动摆放(每类一件 + 偶尔换一件)保留作为兜底。
- 「开工」仍由玩家的准备动作决定: 台面摆好 工具(type12)+特殊材料(type11)+拥有图纸 → 青蛙立刻开工(`new/furnituremake.js`)。

### 19. 聚会时青蛙不离开小屋 (用户报) + 27 篇旅友笔记
- **聚会**: `new/party.js` 的 `start()` 以前只发 PartyGo 播报, `frog.status` 没动 -> 小屋照旧画着它。
  现在真的让它出门: `status=1` + `party=1`(但**不设 traveling** —— 那是旅行结算的标志, 会被 rules.js
  的泵按旅行结账: 笔记/特产/明信片); 到点 `finish()` 里 `status=0` 让它重新出现。
  `new/travel2.js` 的状态观察器在 `party` 标记下只推 role + 重画小屋, 不再重复发"出去旅行了/回来了"
  (聚会自己发 23/24)。
- **27 篇旅友笔记**: Note 表 type=2 共 27 篇, 掉落分组 = `factorData`:
  100 -> 2000/2001/2002(初次相遇三位旅友, 前三趟一定给全)、35 枣泥核桃糖 -> 2003..2020+2024..2026(21 篇)、
  15 桂花蒸米糕 -> 2021/2022/2023(3 篇)。`new/rules.js` 的 `comeBack()` 先看这一趟行李
  (`st.lastTripItems`)能不能解锁新的那一篇, 不然给"初次相遇", 再不行才给普通见闻; 运行时读客户端
  `TravelNoteDB` 建分组(读不到用内联兜底)。
  旅友栏与阁楼礼品盒的解锁条件(2000/2001/2002)因此稳定成立。
- 顺带: `window.MOCK_COME_HOME()` = 立刻结算一次"旅行归来"(与 4 秒泵同一条路, 测试/GM 用)。
- 回归: `tools/partyawaytest.js` (verify 66)。

### 20. 出发时机与「背包/桌子」的分工 (用户按原版澄清)
- **「准备」不再等于出发**: 备好行囊只是"提升它出门的想法"。`S['item_set_bag_completed']` 现在写
  `frog.bagPrepared` + `frog.desire += 0.35`(并打日志"准备完成: 出门的想法 +0.35"), **不再 depart()**。
  想立刻验证用 `/gm away` 或 `window.MOCK_FORCE_DEPART()`(新增)。
- **心情模型**(`new/frogstate.js`): 不是定时器, 而是每 45 秒按概率掷一次:
  `desire = 0.35(背包里有吃的) + 0.10/护身符 + 0.08/道具 + min(0.35, 按过准备)`(没有吃的 desire=0),
  `p = 0.010 + 0.030*desire` → 只有便当约 3~4 小时, 配齐护身符/道具后约 1 小时上下, 且每次都不确定。
  刚回家 20 分钟内、或手上有没做完的家具 → 不走。
- **背包 vs 桌子**: `depart()` 现在**只带走背包**; 桌上的东西留着, 回家后由 `packDesk()` 收进背包,
  为下一次旅行做准备(原版语义)。日志会打"带上背包里的 N 件东西 (桌上留着 M 件备用)"。
- 聚会每周任务 6「聚会或是旅行」的计数改挂在**真正 depart()** 上(准备不再触发)。
- GM 新增 `/gm desire` 看"出门的想法/背包/桌子/是否饿着"。

### 21. 聚会重写: 由"访客离开 -> 门口邀请卡片 -> 准备手信 -> 赴约"触发 (用户按原版纠正)
- 原版: 聚会**不是**定时/随机开的, 也不需要提前准备行李; 是**朋友来串门、离开后在门口留下邀请卡片**
  (带颜色代表不同朋友), 你点卡片接受 -> 进小屋准备**手信(伴手礼)** -> 青蛙才出发;
  奖励以**友情绘本/绘纸**为主, 也可能带回家具、道具。
- 客户端里这套就在**绘纸系统**上(不是另开一套): `guest_load_drawing state=invite` 时庭院出现
  `out_invite_wugui/maotouying/songshu_png` 邀请按钮; 客户端文案 "请到小屋内准备手信吧"、
  "留意门口的小卡片，准备好伴手礼，小青蛙就会去找小伙伴聚会啦！"; 年度回顾字段就叫 `visit_num`(聚会次数)/`page_num`(绘纸张数)。
- 改动:
  · `new/party.js` **重写**为"青蛙正在别人家聚会"的状态机(离开小屋 status=1 + party=1 + PartyGo(23);
    归来放回小屋), 去掉自己每 90 分钟随机开一场 + 送明信片/特产/抽奖券(那是错的)。
  · `new/guestfeed.js`: 访客离开(`guest_finish`/超时/送客)时, 招待过的 80%(没招待 40%)概率
    由 `window.MOCK_DRAWING.invite(guestId)` **在门口挂出邀请卡片**。
  · `new/drawing.js`: 新增 `MOCK_DRAWING.invite()`; `guest_lock_bag`(手信锁定)时调用
    `MOCK_PARTY.start(...)` 让青蛙出发赴约(聚会时长 = 画画时长 DRAW_MS); 归来先 `MOCK_PARTY.finish()`
    再发 PartyResult(24) = [绘纸页, 收藏, -1, 0, ...惊喜], 并 45% 概率额外送一件家具或道具(从客户端表里挑)。
- 回归: `tools/partyinvitetest.js` (verify 67); `tools/partytest.js` 重写为状态机测试。

### 22. 「工具栏-其他」红点消不掉 (用户截图: 木制护符的三拼技巧 + 其他页签红点)
- 客户端 `HandCraftModel.updateComposeRedot()`:
  `t = ItemModel.getHouseItemsByType(ItemType.COMPOSE/*16*/); t.length >= 3 && (e = 1)` —— 红点只看
  **这个 type 桶里有几个 key, 不看数量**; 而 `getHouseItemsByType()` 对每个 key 都 push(不筛 count)。
  我们的合成(`pray_compose`)把三片扣到 0 却**留着 count:0 的行** -> `t.length` 恒 >= 3 -> 红点永远在;
  存档里还积了 21 条 count:0 的幽灵行(截图里 5502 显示 0 就是它)。
- 修法:
  · `new/handcraft.js` 的 `composeTake()` 扣到 0 就 `splice` 删行;
  · `new/rules.js` 的 `S['item_load_items']` **出口统一剔除 count<=0 的行**(客户端永远收不到幽灵行, 红点随之灭);
  · GM 新增 `/gm clean` 立刻清理并重推。真机存档实测清掉 **21 条**幽灵行。
- 回归: `tools/handcrafttest.js` 补了"三片 -> 合成 -> 碎片条目不残留 / 没有 0 数量行"。

### 23. 聚会与来访的时间机制 (用户给出参考值)
- **访客停留 180~270 分钟(3~4.5 小时)** —— `new/guestfeed.js` 的 `visitSeconds()`(`st.visitSeconds` 可覆盖,
  旧值是 30 分钟)。
- **聚会(出门画绘纸)6~18 小时**, 偏向 12~16 小时; 10% 概率延长到 18~24 小时; 硬上限 30 小时
  ("否则玩家会觉得蛙蛙失踪了") —— `new/drawing.js` 的 `partyMs()`(`st.partySeconds` 可覆盖)。
  注意这与"访客来家里做客的停留时间"是两件事。
- GM: `party` / `party end` / `party h 12` / `party auto`、`visit [0|1|2] [分钟]`。

### 24. 投喂邻居的回礼数值 + 邀约概率 + 邮箱保管上限 (用户按社区实测给出)
- **反应等级**(口味值, 客户端 CharaDB.taste: 15/30/75/99): >=90 感觉十分满意 / >=60 感觉很高兴 /
  >=20 一般(只给 1~10 三叶草) / <20 不喜欢 -> **没有回礼**。
- **回礼表**(中国版三位邻居按序号映射: 0→蜗牛档, 1→蜜蜂档, 2→乌龟档):
  蜗牛 1~30 / 30~50, 蜜蜂 10~60 / 50~100, 乌龟 10~100 / 100~200 三叶草; 抽奖券 2~4(乌龟 2~6);
  约一半概率附一枚四叶草(1000)。
- **稀有 FLAG 加成**: 表的 Item 里没有这个字段 -> 用"高价特产"(price >= 100)当等价物: 额外 +20 三叶草 与 1~4 张券。
- **连续投喂惩罚**: 最近三次喂过同一种 -> 三叶草减半。
- **回礼改到"访客离开时"以邮件寄出**(`Mail.EvtId.Gift=3` + `sender=0..2` → 邻居头像; 三叶草/券写在
  resource 里, 玩家开信时由 mail.js 入账; 附件是那件特产) —— 与原版"离开后通过邮箱寄回礼物"一致。
  不投喂 => 它自己走, 没有任何回礼。
- **邀约概率与是否喂食无关**(用户: "喂食不会直接保证获得邀约"): 离开时独立判定, 默认 **22%**,
  `st.inviteChance` 可覆盖(原来写成"招待过 80%/没招待 40%", 不对)。
- **邮箱保管上限 100 封**(`new/mail.js`): 未领取超过 100 时丢最旧的一封, **三叶草/券自动收取**,
  附件作废(与原版"旧物品会被自动删除, 三叶草会自动收取"一致)。
- 顺带修掉一个 id=0 的坑: `guest_serve` 以前用 `if (!item)` 判空, 而 **id 0 = 奶油华夫饼是合法食物**
  -> 喂华夫饼会被当成"没带东西"(code 3)。
- 回归: `tools/guestfeedtest.js` (verify 68)。

### 25. 商店"剩-1个" + 工作台被锁 (用户截图)
- **商人库存显示"剩-1个"**: 客户端 `lblCount.text = _("剩{0}个", this.data.num)` 是**直接显示**我们的 num。
  现在 `furniture_load_furniture` 出口统一把 `shop_list[].num` 夹到 >= 0(非有限值/-1 一律记 0 并打日志),
  同时对 `f.bought`(24 小时窗口的购买记录)按 `shop_id@秒` 去重, 防止重复记录把库存算成负数。
- **"呱~不许动" 不让补充工作台**: 客户端 `isLockBench() = serverData.bench_lock`;我们的
  `bench_lock = making || away` 让它几乎一直锁着(10~30 分钟开一次工 + 出门几小时)。现在**默认不锁**
  (`st.benchLock = 1` 恢复原版: 制作中/出门才锁)。
- 回归: `tools/furnituremaketest.js` 补了"默认台面不锁" + 原版锁定行为两条。

### 26. 造家具时屋里要有"干活"动画 (用户: "青蛙造家具干活不给提示, 我也不知道它在不在造")
- 客户端屋里能渲染的动作就是 `FrogMotionName` 里那几个, 其中 **3 = "sagyou_ie"(做手工/削木头)**,
  `MainInView.updateFlogStatus()` 里 case "sagyou_ie"/"syokuzi_ie" 都是坐在椅子上做 —— 这就是"干活"的样子。
  (5..9 的 saw/brush/knock/knit/cut 是**外面场景**的动画, 屋里发这些会直接 return 不画青蛙。)
- `new/furnituremake.js`: 开工时把 `frog.motion` 钉在 3、`frog.crafting = 1`、`motionHold = 这一单的秒数`,
  推 `client_load_role` + `MOCK_REFRESH_ROOM('开工干活')`(小屋里立刻换成干活动作);
  完成时 `crafting = 0`、`motionSince = 0` 让居家状态机接着随机换动作。
- `new/frogstate.js`: 只要 `furniture.make.id > 0` 就 return(或清掉残留的 crafting 标记), 不抢动作/不收行囊/不出发。
- 回归: `tools/furnituremaketest.js` 补了"开工 -> motion=3 + crafting=1 + 状态机不顶掉 + 完成松开"四条。

### 27. 做家具改成分段 + 庭院专属工序动画 (用户按原版纠正)
- 用户: "青蛙做家具的动画是在**庭院**里进行的……动画约 1 分 30 秒, 会按工序变(锯/刷/敲/编/裁),
  工作台会变灰无法操作, 一件家具分 1~3 次做完, 每次重新播动画"。
- 客户端契约: `FrogMotionName` 5..9 = saw/brush/knock/knit/cut —— **外面场景(MainOutView)** 的专属动画;
  屋里 `updateFlogStatus` 对这五个是 `default: return`(不画青蛙)。所以设成这些 motion 时,
  青蛙自然从小屋消失、在庭院里开工 —— 正好是原版的样子。
- `new/furnituremake.js` 重写制作流程:
  · 一件家具 = `sessions`(1~3, `st.sessions` 可覆盖) 段; 每段 `SESSION_SECONDS`(默认 90 秒);
  · 每段按家具类型挑工序动画(墙壁/地面→刷漆、石作风格→敲打、地毯/帘幕/门/照明→编织、栏杆/窗户/镜→裁剪、其余→锯木头),
    开工时把 `frog.motion` 钉在这个动画上并推 `client_load_role` + `MOCK_REFRESH_ROOM`(庭院立刻播);
  · 一段做完 -> `phase='pause'`、歇 `st.pauseSeconds`(默认 2~8 分钟), 工作台恢复可操作; 歇完自动开下一段;
  · 最后一段做完才出家具(has_fur + 播报 21)。
- 工作台灰化(`bench_lock`): 默认**只在干活那一段**锁(原版"开始制作后工作台变灰");
  歇工/出门都不锁(用户此前报过"不让我补充工作台")。`st.benchLock = 0` 永不锁; `= 2` 恢复旧的"连出门也锁"。
- `MOCK_MAKE.finish()` 现在把剩下所有段一次跑完(测试/GM 用)。
- 回归: `tools/furnituremaketest.js` 补了"工序动画 5..9 / 每段 90 秒 / 1~3 段 / 状态机不抢动作 / 完成松开"
  等断言。

### 28. 「呱~不许动」补回 + 没材料就停手不播动画 (用户)
- **台面锁定恢复原版**: 默认 `bench_lock = 正在做家具`(客户端台面变灰 + 弹"呱~不许动", 原版行为);
  `st.benchLock = 0` 完全不锁(此前"不让我补充材料"的临时方案), `= 2` 连青蛙出门也锁(更早的旧行为)。
  上一轮我把默认写成"不锁"是错的(用户: "把呱！不许动补上去")。
- **没材料就不弄、也不播动画**: `new/furnituremake.js` 两处补上 ——
  · 结算时材料被别处花掉 -> 作废时**同时**清 `frog.crafting`/动作并重画小屋(以前动画会一直演下去);
  · 一段做完歇工后, 开下一段之前再确认 `houseCount(mk.mat) > 0`, 没材料 -> 作废 + 停手 + 不播动画。
- 回归: `tools/furnituremaketest.js` 更新为"默认制作中锁 / benchLock=0 不锁 / =2 连出门也锁"。

### 29. 花盆种植 + 三叶草农场 (用户: "把农场与耕作做起来")
- **契约**(逆向报告 §A): 种植只有**一条上行协议** `furniture_flowerpot_harvest:[["type","index"]]`(点成熟植株收割);
  `furniture_load_flowerpot` **不在 protocolList** 里, 但客户端注册了回调, 处理器只有
  `this.flowerpotData = Utils.convertArrayAll(e)` —— 纯服务端 push。所以"种什么/几阶段/何时熟"全由服务端决定。
  表: `flowerpotData`(花盆: id/name/pic/pos_list/type)、`flowerData`(植株: id/res[3 段贴图]/angle)。
- 新增 `new/flowerpot.js`:
  · 花盆状态(`st.flower` 的 slots, 按 `type/index` 定位 —— 正好是收割协议的参数);
  · 服务端计时生长: 每阶段 `st.flowerStageSeconds`(默认 20 分钟) × `flowerData[id].res.length` 个阶段,
    到顶即成熟; 下发字段给了 `{type,index,plant_id,item_id,state(0空/1生长/2可收),stage,stages,planted_at,stage_at,stage_time,mature}` + `pots`;
  · 种子 = 仓库里 id 属于 `flowerData` 的物品; 有种子就自动种下(45 秒检查一次), 消耗 1 个;
  · 收割: 成熟 -> 植株进仓库 + 记 `st.flowerLog`(植物百科 `new/ency.js` 就是按它解锁 long_id) + 推花盆/物品/百科;
  · `furniture_load_flowerpot` 已加进 `PUSH_LIST`(以前不在, 所以永远不推 = 花盆永远空)。
- **三叶草农场**: 补齐成熟节奏与掉落 —— `clovers()` 给每块地算 `grown`(0~1)/`mature`, 到点重推
  `clover_load_clovers`; 采集(`clover_harvest` 包装 + `MOCK_FARM.collect`)给 3~8 株三叶草并掉落
  `element`/`sprite`, 推 `clover_update`; 一分钟巡检一次。
- `window.MOCK_FARM` = { pots, plant, harvest, farm, collect, tick } 供 GM/测试。
- 回归: `tools/farmtest.js` (verify 69): 花盆下发/种植/未熟拒收/成熟收割/收货入仓+百科解锁/农场长满+采集掉落+防连采。

### 30. 拖不动场景 + 活动按钮被遮挡 (用户, 游戏界面)
- 症状: **能点按钮、拖不动场景**; 日历/聚会等活动按钮图标**被遮住** —— 典型的"有个东西夹在场景层和按钮层之间"。
- 最可能的原因: 我上一轮把做家具的动作改成了**庭院工序动画**(motion 5..9)。`MainOutView.updateFlogStatus()`
  播这类动作时会**新建一个动画精灵**; 而我们的"场景重画"(开工/每段/居家动作/季节切换/守夜人)会反复调用它
  -> 精灵累积, 一层层盖在场景上: 挡住拖动手势, 同时把高层的活动按钮压住(所以按钮还能点)。
- 修法:
  · `new/furnituremake.js`: 做家具时回到**室内动作 3(sagyou_ie 做手工)** —— 室内动作不新建额外精灵;
  · `new/roompatch.js`: `MOCK_REFRESH_ROOM` 加 **10 秒节流**(`force=true` 可绕过; `MOCK_ROOM_RESET_THROTTLE()` 给测试),
    避免频繁重画累积精灵、也不在你拖动时反复重排;
  · 花盆推送 `furniture_load_flowerpot` 也已从 `PUSH_LIST` 摘掉(字段还没在真机核对过)。
- 回归: `tools/furnituremaketest.js`(motion=3) 与 `tools/roomrefreshtest.js`(含"10 秒内重复调用被节流")都更新并通过。

### 31. 季节/昼夜/天气按用户给的配置表校准
- **昼夜四段**(用户表): 清晨 05:00-08:00 -> `hours_type 4`(天没亮, 用深夜美术) / 白天 08:00-17:00 -> 1 /
  黄昏 17:00-19:00 -> 2 / 夜晚 19:00-05:00 -> 3(蜡烛点亮、盖被子睡觉)。改在 `new/mock.js` 的 `clockEnv()`。
- **天气引擎**(用户表, 按季节加权): 春 晴50/雨30/阴20; 夏 晴40/雨30/暴雨10/阴10; 秋 晴50/阴30/雨20;
  冬 晴40/雪30+大雪10/阴20。`new/weatherclock.js` 里 `MOCK_WEATHER.roll(season)`, **每天/换季重掷一次**
  (`st.weatherRollDay`), 变天时照常推 `weather_load`。
- **四季生态**: 季节本来就按真实月份走(3-5/6-8/9-11/12-2) -> 客户端自己切 spring_bloom / summer_flower /
  autumn_leaves / snow_covered 美术与夜晚萤火虫; 我们只需要下发正确的 season + hours_type + weather(已做到)。
- 回归: `tools/weatherclocktest.js` 补了 06/10/18/21 点四个新边界用例(全绿)。
- 待做(下一轮, 用户表里剩下的): 天气×道具交互(雪天+辣葱饼 -10% 归期、暴雨贝壳、雨天纸伞走更远+雨照)、
  节气食物每日上架(375 草)、节气照片(烹饪任务 2-3 周)、限定家具档期(8-10 月森之国度 3 件 / 11-12 月古琴展 2 件)、
  嘟嘟"每天下午/晚上到访并刷新一次"的细化。

### 32. 天气 × 道具 交互 (用户表, 第 1 项)
- `new/travel2.js` 的 `planTrip()`:
  · **雪天(+大雪) + 辣葱饼**(Item id 4 香葱烤包子 / 16 彩椒烙蛋饼) -> 归期 **-10%**;
  · **雨天(小雨/暴雨) + 纸伞**(2003 朴素 / 2004 自然 / 2005 水墨) -> 时长 **+25%**(走得更远);
  · 行程里记 `st.tripWeather` 与 `st.tripWeatherFx = {spicy, umbrella}` 便于排查;
  · 顺带修掉 travel2.js 里 `num()` 缺失(上一轮加天气代码时引用了未定义函数 -> planTrip 抛异常、时长变 NaN)。
- `new/rules.js` 的 `comeBack()`: **暴雨天** 50% 概率带回"贝壳一类"海边特产(4000~4020 段, 进 `st.gifts`)。
- 回归: `tools/tripdurationtest.js` 第 11 组(各取 5 次平均抵掉抖动): 雪+辣葱饼更短 / 雨天带伞更远 / tripWeatherFx 记录。

### 33. 花盆改按原版机制: 玩家备种子/肥料, **小伙伴随机帮你种** (用户)
- 用户: "玩家可以种花盆, 但不能完全自己决定种什么 —— 准备种子和肥料, 具体种哪一颗由来串门的小伙伴随机决定;
  土壤肥力 1~3 星(1 星不能种), 用堆肥提升, 肥力满会自己长出狗尾草/知风草; 种子主要从嘟嘟商店买;
  成熟后可以插花装饰屋子 + 解锁百科(集齐 15 种); 青蛙旅行回来也可能自己换花瓶里的花, 手插会丢弃原来的花。"
- `new/flowerpot.js` 改动:
  · 每格加 **肥力 `fert` 1~3 星**(默认 1); `fertilize()` 施肥; `useFertilizer()` 每 90 秒把仓库里的
    "堆肥"类物品消耗掉给第一个没满的盆施肥(`st.fertItem` 可指定具体物品 id);
  · **删掉"服务端定时自己种"**, 改成 `neighbourPlant(guestId)`: 小伙伴随机挑一颗**你仓库里的种子**种下
    (1 星肥力拒绝, 没种子拒绝), 消耗 1 个种子并记 `byGuest`;
  · `new/guestfeed.js`: 访客**离开时** 50% 概率顺手帮你种一颗(`window.MOCK_FARM.neighbourPlant`);
  · **肥力满(3 星)的空盆**每 2 分钟有 15% 概率自己长出野草(狗尾草 202103 / 知风草 202104) —— 免费的花;
  · 收割流程不变(成熟才 code 0 -> 植株进仓库 + 记 `flowerLog` -> 植物百科解锁, 15 种花就是百科那条线);
  · `furniture_load_flowerpot` **暂不放进 PUSH_LIST**(上一轮它被怀疑是"遮挡 UI"的同伙), 只在种植/施肥/收割/野草
    这些明确时机主动 push。
- `window.MOCK_FARM` 扩展: `{ pots, plant, harvest, farm, collect, tick, fertilize, neighbourPlant, wild, fert }`。
- 回归: `tools/farmtest.js` 补了"初始 1 星 / 1 星种不下 / 施肥到 2 星后小伙伴种下并消耗种子 / 3 星长野草"。

### 34. 三叶草农场按用户配置表重写 (20 棵 / 3 小时 / 每棵 1% 四叶草)
- 旧实现是"3 块地 × rebirth_span 1800 秒 + 一次 3~8 棵", 与配置表不符, 已重写为**池子模型**:
  · **容量上限 20 棵**, 从 0 长满约 **3 小时** -> `CLOVER_PER_SEC = 20 / 10800`(约 **9 分钟/棵**);
  · **离线生长**: 按 `st.cloverSince` 时间戳算累积(`min(20, (now-since)/540)`), 满了停止;
  · **收割**: 一次收**全部成熟**(单次最多 20 棵), `clover_harvest` 被包一层换成这个语义, 回包带 `{clover,gain,four_leaf}`;
  · **四叶草**: **每棵独立 1%** 掷骰 -> 收割时变异成一次性护身符(item 1000), 满 20 棵整体约 20%;
    实测 8000 棵样本 1.05% ✓;
  · `clover_load_clovers` 的每块地照旧带 `grown`(0~1)/`mature`/`count`, 供客户端画长满度。
- `window.MOCK_FARM` 的农场接口: `farm()`(地块) / `pool()`(可收棵数) / `collect()` / `harvestAll()`。
- 回归: `tools/farmtest.js` 第 6 组(1 小时 -> 6~7 棵 / 10 小时封顶 20 / 一次收 20 / 1% 四叶草大样本)。

### 35. 嘟嘟改成"每天下午/晚上到访 1 次 + 每次重新上架" (用户表 §6)
- 以前 `shop.start_time = now - 3600 / leave_time = now + 86400` = **全天营业、永不刷新**, 售罄按"24 小时窗口内的购买"算。
- 现在(`new/furniture.js`): 每天挑一个 **14:00~19:00** 的到访时刻(存 `st.merchantVisit.day/start`),
  **营业 5 小时**; 到点前 `start_time = 0`(商人不在, 客户端 `isOpen()=start_time>0` 会自己收起来);
  **每次新的到访开始时清空 `furniture.bought`**(= 重新上架/重掷库存); 购买计数只在"本次到访"内累计
  (`cut = max(now-24h, 本次到访开始)`)。
- 价格/上限维持用户表: 工具 750 / 图纸 500 / 特殊材料 200(`furnitureShopData` 表里的 price 为准)。
- 回归: `tools/furnituremaketest.js` 里"没买过 num=1 / 买过 num=0 / 24 小时后补货"三条改为在
  "本次到访已开始"的前提下断言(先把 `st.merchantVisit.start` 设为 1 分钟前)。

## v0.66~0.68 目标批次(2026-09-15 早): 故事双板块 / 明信片路线 / 呱呱日记 / 节气照 / 家具风格校验

### 36. 「故事」界面双板块(目标⑧) —— `new/stories.js`
- `STORIES` 10 条: 6 条**旅行趣事**(type `travel`) + 4 条**节日趣闻**(type `festival`, 带 `chance` 0.2~0.25);
  结构 = `{id,type,title,content,unlock_condition,related_item_id}` 的离线版(`id/type/title/cond/chance`)。
- 触发: `MOCK_STORY_ROLL`(旅行归来/收到明信片) -> 条件匹配(旅行次数/图鉴收集/旅友笔记/天气/时段/携带道具/
  节日/节气限定食物) -> 节日类再过一次 15%~30% 概率; 与称号、图鉴、节气食物联动。
- 回归: `tools/storiestest.js`(verify 步 70)。

### 37. 明信片路径模拟(目标③) —— `new/postroute.js`(四区域图 + Dijkstra + 逐节点分级)
- 数据全来自本机表: `GoalNumber`(38 目的地) / `Picture`(351 张, `type` = Normal/Goal/Unique/Tools,
  `place` = GoalNumber.id) / `PictureTag`(200 个风格标签) / `Item`(食物/道具/护符)。
- 图: `home`(START) -> 四区域入口(东/南/西/北) -> 分岔口 -> 38 个目的地节点; 另有每区一个 DETOUR(岔路)
  与一个稀有节点; 区域之间也有边(所以最短路可能真的"穿过另一个区域")。`shortest()` = 标准 Dijkstra。
- 谁去哪: 食物 101~134 是**目的地指向性食物**(吃一口就想进京/入川/来渝… -> 直接锁定目的地);
  4/5/15/16/33 是"在某地吃更佳"(沙漠/海边/水乡/雪地/山丘 -> 风格偏好); 护符 type1 里
  1004~1010(铃铛/千纸鹤)指方向(东/南/西/北, 1006 = 没去过的新地方); 预算 km 由 `st.tripPlan.hours`
  (已含食物价格/道具/护符/天气/称号)换算 —— 走不动就改判最近的目的地("抵达不了太远的远方")。
- 逐节点分级: 途经=Normal(按区域风格挑真实底图, 如西部 `n_field/n_panda`) / 目的地=Goal(按 `place` 取图) /
  岔路=Tools / 隐藏=Unique; 预算够会绕一次 DETOUR(绕路时里程也记进 `st.tripRoute`), 护符多还可能再深一层。
- 接管 `MOCK_PICK_PHOTO`(在 postcardpool 之后包装), 失败自动回落旧池子; 落盘 `st.tripRoute`/`st.placeVisited`
  给日记与故事用。GM: `/gm route`(图统计 + 试跑 60 次)。
- 回归: `tools/postroutetest.js`(verify 步 71): 图结构 / 38 条最短路 / 预算 / 目的地指向性食物 / 风格 /
  四方向护符 / 400 次模拟全部有图层 / 景点照 place 对得上 / DETOUR 不超预算 / 无表不崩。

### 38. 呱呱日记(目标④) —— `new/diary.js` + `new/frogstate.js` 长动作
- 居家动作 2(写信/写日记)**不可打断**: `MOCK_LONGACTION[2] = {hold: 18~40 分钟, done: 写一篇}`,
  frogstate 在"长动作未到点"时直接 return(不收拾行囊、不换动作、不出门), 到点先收尾(写完)再回普通循环。
- 日记内容表 31 条(第一次出门/雨天/雪天/绕路/隐藏处/走了很远/海边/水乡/沙地/山上/博物馆/城里/新地方/
  第五个·第十个地方/旅友来信/聚会/客人/手工/三叶草/节气/过节/称号/雨停/平常的一天), 按优先级与上下文挑**没写过**的。
- 落在客户端**真实笔记页**上: `Note_json` type=1 的 137 张(quality 1 普通 / 2 精华), 走 `travel_load_note`
  的 `{id,read,timestamp}` -> 客户端按 type 分栏(小仓库·笔记), 未读亮 `NEW_NOTE` 红点;
  客户端 `travel_read_note`(rules.js 已实现)负责已读。旅行归来 2.5 秒轮询到"旅行次数 +1"就自动写这一趟。
- GM: `/gm diary [write|reset]`。回归: `tools/diarytest.js`(verify 步 72)。

### 39. 节气照(四动物同框) + 限定家具档期 + 家具风格/材料总量校验(目标⑤⑦)
- `new/solarphoto.js`: 每月两种节气食物(Item 20~31/35~46, 嘟嘟 375 草) -> 带上它出门(或当天就是节气)
  就有 55%(25%)机会抽到当月/双月的 **月照**(`PictureTag u_month<N>` -> pic 3048+N-1, `u_two_month<N>` -> 3067+N),
  即"四动物同框"; 判定接在 postroute 里(判级 `seasonal`), 落盘 `st.solarPhoto`。
- `new/furnstyle.js`: 家具风格与材料总量校验 —— `furnitureData` 里 **1~11 号风格各 27 件, 种类 1..27 各一件**
  (= "一套室内 27 个"); 6 号博古风格 +2 件古琴(书桌·古琴/衣柜·古琴); 100/101 是联动/活动风格。
  **8 种特殊材料**(Item type11: 10101 岩纹石/10102 正丹纸/10103 棕榈叶/10104 海螺贝/10105 紫檀木/
  10106 细篷布/10107 秋芦荻/10108 织彩带, 各 200 草)决定能做什么风格; `MOCK_FURNSTYLE.validate()/total()/canMake()`。
  `new/furnituremake.js` 用它挡掉"材料与风格不符"的开工(台面没放特殊材料时不拦, 保持旧行为)。
- `new/furniture.js`: 限定图纸按档期上下架 —— 8~10 月森之国度 3 件(10313/10315/10323),
  11~12 月古琴展 2 件(10312/10326), 其它月份下架(与季节商品同一套"过季下架/到季补库存"逻辑)。
- 回归: `tools/solarfurntest.js`(verify 步 73)。

### 40. UI 自检(用户: "我不想要代价, 我想要实时推送") —— `tools/uicheck.js`(verify 步 74)
- ① 静置窗口: 启动那一窗只有初值同步(12 条), 之后每个 9 秒窗口里**没有一条"重画场景"的推送**
  (client_load_role / misc_moment_load / furniture_load_furniture / furniture_load_flowerpot / item_load_items),
  真的变了(比如来客人)也最多一两条;
- ② 只有动作真变化时才推 `client_load_role`(它是重建青蛙精灵的那条, 反复推就是以前"拖不动/被遮挡"的根源);
- ③ `PUSH_LIST` 45 条全部有 handler, 且不含 `furniture_load_flowerpot`;
- ④ 小屋重画: 同状态第二次不重画 / 5 秒节流 / `st.roomRefresh=0` 一键关 / `force` 才强制;
- ⑤ 居家动作只用 0..4 与 10..13, 200 次抽样没出现 5..9(庭院工序动画, 会累积精灵);
- ⑥ 新层(日记/路线/节气照/家具风格)的定时器都不带无条件的 dispatch。

## v0.69~0.70 「故事」系统按用户给的机制重做(2026-09-15)

### 41. 为什么截图里是 0/0(两个硬伤)
- `story_load` 只下发**已解锁**的 story_json 25 条, 而解锁条件要求"带对行李(果汁+千纸鹤…)";
  设备存档 `travelCount=7 / stories=0` -> 一条都没有, 页签就是 `0 / 0`(StoryView.renderItem 的 t_currentPage/t_maxPage)。
- 自研那 10 条靠 `MOCK_STORY_UNLOCK(id)` 合流进客户端列表 —— **这个函数当时根本不存在** -> 合流是空操作。

### 42. `new/stories.js` 按用户指定字段重写
- 表结构 = `{id, type('travel'|'festival'), title, content, unlock_condition(JSON), related_item_id}`
  (另有 `client_id` 用于合流到 story.js 的 25 条, `chance` 是节日类概率)。
  样例已导出: `tables/stories_local.json`(18 条, 关联物名字也解析好)。
- `unlock_condition` 支持: trips/places/collections/friend_notes/weather[]/hours[]/items[]/place/flavor/region/
  **titles[]**(称号联动, 例: 鉴赏名家)/festival/solar_food/any_month。
- 触发点: ①**旅行归来**(包 `MOCK_STORY_ROLL`) ②**寄回明信片**(新钩子 `MOCK_POSTCARD_HOME`)。
- 节日类再过 **15%~30%** 概率; 关联纪念品/明信片按 **15%** 给(带对道具的旅行类直接给);
  节日类的关联物改成**节日明信片**(中秋 mid_autumn 3080 / 端午 duanwu 3024 / 春节 chunjie_tu 3086 / 当月 u_monthN)。
- 联调: 解锁时 `MOCK_STORY_UNLOCK(client_id)` 变成客户端"旅行趣事"页签的一张卡;
  称号用 `achievelist` + Achieve 表反查名字; 图鉴用 `st.collections`。

### 43. 旅途中寄回明信片(mid-trip) —— travel2.js
原版"旅途中会随机给你寄回照片(明信片)"以前没做: 现在按行程进度 **35% / 70%** 两个点各掷一次(80%),
抽一张明信片推 `album_load_new` 并调用 `MOCK_POSTCARD_HOME()`(故事判定时机之一)。60 秒轮询, 只在 status=1 且非聚会时工作。

### 44. 回归
`tools/storiestest.js` 扩到 **31 条断言**: 表结构/JSON 可序列化/称号联动/关联纪念品/寄回明信片钩子/老存档补记/
story_load 有卡片且带 name; `tools/storytest.js`(客户端 25 条)与 `tools/traveltest.js` 同步更新。
