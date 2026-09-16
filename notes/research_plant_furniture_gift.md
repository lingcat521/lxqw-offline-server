# 客户端契约逆向：种子/花盆 · 家具摆放 · 阁楼礼品盒

> 只读研究。除本文件外未修改 `lxqw/` 下任何文件。
> 证据文件：`apk/assets/game/js/main.min.js`（下称 **main**，字符偏移均为 `open(...).read()` 后的
> Python 字符下标，已 `re.sub(r'\s+',' ')` 压平）、`apk/assets/game/js/default.thm.js`（下称 **thm**，
> 编译后的 exml/皮肤，能直接读出控件树）、`tables/*.json`、`new/*.js`、`logs/game.log`、`save/state.json`。
>
> 复现脚本（我用的）：
> ```python
> SRC = open('apk/assets/game/js/main.min.js', encoding='utf-8', errors='replace').read()
> flat = lambda s: re.sub(r'\s+', ' ', s)
> ```

---

## 0. 结论速览

| # | 功能 | 能否离线做 | 现状 | 关键阻塞（带证据） |
|---|------|-----------|------|------------------|
| A | 花盆/种植 | **能**（种植纯服务端决定，客户端没有种植协议） | 未实现：`furniture_load_flowerpot` 返回空且**不在 PUSH_LIST**；harvest 是垃圾桩 | 无协议缺口；缺的是服务端自己"种" |
| B | 客户端主动换/摆家具 | **能，但入口被 `isHome` 挡住** | `new/furniture.js` 已实现大部分 | `btnRefurniture.visible = decorate_open && isOpen() && **!isHome** && currentState=="normal"`；`isHome = frogStatus==0`，而存档 `frog.status=0` |
| C1 | 礼品盒入口（菜单 + 屋内箱子） | **能** | 未实现 | `GiftBoxModel.isOpen()` 要求笔记 id ∈ `TravelFriends.visitOpen = {2000,2001,2002}`，我们的 `NOTE_IDS=[1000..1029]`（`new/rules.js:8`），存档里全是 1000~100x |
| C2 | 礼品盒相册页渲染 | **能，但必须先造 `layers`** | 会崩 | `travel_load_gift.pictures[i]` 缺 `layers` → `PictureRender.getPictureTexture()` 里 `e.layers.length` **无守卫** → TypeError |
| C3 | 礼盒容量提示（100/101/102） | 需先修 `getErrorInfo` | 被 mock 屏蔽 | `mock.js patchSDK()` 把 `MessageModel.getErrorInfo` 固定返回 `{code:0}`，客户端所有 `code` 判定都走成功分支 |

---

## A. 种子与种植（花盆）

### A.1 协议清单：只有 1 条，且没有 plant/water/load

`protocolList={...}` 起始于 **main@375541**。把所有 245 条协议按关键词过滤后，与"种植"有关的只有：

```
main@379447  furniture_flowerpot_harvest:[["type","index"],!0]
```
（对照：`recharge_water` main@380235 是充值协议，与浇水无关。）

穷举验证（关键证据）：

```
[plant: 36 处]   —— 全部 36 处里没有一处是协议名或请求发送
[flowerpot: 29 处] —— 其中 2 处是 protocolList 附近，其余全是渲染/模型
```

`furniture_load_flowerpot` **不在 protocolList 里**，但客户端注册了它的回调（服务端 push 专用）：

```
main@103715  FurnitureModel.initModel  （FurnitureModel 类体范围 main@103566~115175）
prototype.initModel=function(){this.addProtocolCallback("furniture_load_furniture","furniture_buy_shop","
furniture_putin_bench","furniture_takeout_bench","furniture_load_tumbler","furniture_load_pocket",
"furniture_load_compost","furniture_load_flowerpot"),this.serverData={shop:{start_time:0,leave_time:0,
shop_list:[]},mood:0,bench_lock:!1,bench:[],put_fur:[],has_fur:[],mate_list:[],replace_fur:[]},...}
```

**结论：客户端不存在任何"种植 / 播种 / 浇水 / 施肥"的上行协议。** 玩家能做的只有"点成熟植株收割"。
所以"种什么、什么时候种、长几阶段"**完全由服务端决定**，这是离线服可以自由实现的空白区。

### A.2 客户端协议处理器逐字段

**(1) `furniture_load_flowerpot(e)` —— 服务端 push，无回包**

```
main@106012
prototype.furniture_load_flowerpot=function(e){e&&(this.flowerpotData=Utils.convertArrayAll(e))}
```
- `e` 必须是非空对象（`e&&` 守住了 null）。
- `Utils.convertArrayAll` 实现在 main@300565：`function _(e){var t={};for(var i in e)"object"==typeof e[i]?t[i]=v(e[i]):t[i]=e[i];return t}`，
  而 `v(e) = Array.isArray(e)?e:[]`（main@300522）。即**顶层对象字段若不是数组会被换成 `[]`**。
  所以 `show_list` / `plant_list` / `list` 必须是真数组。
- 默认初值：`main@104380  this.flowerpotData={show_list:[],list:[],plant_list:[]}`
- **注意：这个 handler 不派发任何事件**（对比同文件 `furniture_load_pocket` main@105800 会
  `dispatchEvent(FurnitureEventType.UPDATE_POCKET)`）。`FurnitureEventType` 枚举里也**没有** FLOWERPOT 项：
  ```
  main@1196781  var FurnitureEventType=... e.UPDATE="FURNITUREEVENTTYPE_UPDATE",e.UPDATE_TUMBER=...,
                e.UPDATE_BENCH=...,e.UPDATE_COMPOST=...,e.UPDATE_POCKET=...
  ```
  → **push `furniture_load_flowerpot` 只改数据，不会重画界面。**

**(2) `furniture_flowerpot_harvest(type, index)` —— 唯一上行**

```
main@113850
prototype.req_flowerpot_harvest=function(e,t,i){var n=this;core.SocketManage.getInstance().send(
"furniture_flowerpot_harvest",new core.Action2(function(r){if(r.item_list){for(var o=0;o<n.flowerpotData.
plant_list.length;o++){var a=n.flowerpotData.plant_list[o];if(e==a.type&&t==a.index){n.flowerpotData.
plant_list.splice(o,1);break}}if(r.item_list.length>0){for(var s=[],c=0,l=r.item_list;c<l.length;c++){var o=l[c];
s.push({item_id:o.item_id,count:o.num,type:Tabikaeru.DataType.DropType.ITEM})}
core.PageManage.getInstance().addViewControl(GiftPackageViewController,core.ViewLayerType.NoticeLayer,null,s)}
i()}}),e,t)}
```
逐字段：
- 上行 `type` = 花盆类型（见 A.3，只能是 `1`）；`index` = 槽位序号（`1` / `2`）。两者都是 **Action2 的第 2/3 个参数**，`Mock.handle` 用 `protocolList` 的参数名映射成 `{type, index}`。
- 回包**必须**有 `item_list`（数组，可以为空 `[]`）。**若 `item_list` 缺失/为 falsy，完成回调 `i()` 永不执行** →
  收割动画、本地 `plant_list.splice`、按钮状态全部不更新（界面卡死在这一帧）。
- `item_list[i]` 字段：`item_id`（奖励物品 id，**必须存在于 ItemDB**）+ `num`（数量，映射成 `count`）。

### A.3 种子是哪个物品

`tables/Item_json.json`（411 行）里 **type 15 = `ItemType.Courtyard`（庭院）**，id 段 `20001..20111`：

- `sub_type = 1`，id `20001..20006`：一号~三号水溶肥 / 缓释肥一号~三号（肥料）
- `sub_type = 2`，id `20101..20111`：**种子/种球**（角堇、葡萄风信子、拇指萝卜、风信子、网脉鸢尾、郁金香、樱桃萝卜、樱桃番茄、草莓、迷你南瓜、铃兰）

type 15 的中文名在 main@421977：`f[e.DataType.ItemType.Courtyard]="工具栏-庭院"`。

表结构示例（`tables/Item_json.json`）：
```json
{"info":"草本植物的种子 来访的邻居似乎很感兴趣","sub_type":2,"name":"种子·角堇",
 "img":{"index":"seed_jiaojin","src":"icon/courtyard"},"spend":1,"type":15,"id":20101}
```

**播种物品 → 植株 id 的换算**（从表推出来的唯一自洽解）：
`tables/flowerpotData_json.json` 的 `plant` 表 key = `2010101`，即 `种子id × 100 + 品系序号`：
`20101 → 2010101/2010102/2010103`，…，`20105 → 2010501..2010504`。

### A.4 玩家从哪里得到种子

**不在 `Shop_json.json` / `shopData_json.json`**（grep `20101` 均为 false）。在**嘟嘟的家具店**
`tables/furnitureShopData_json.json`：

```
6001..6006  type 6   item_id 20001..20006  price 100/200/300   （肥料）
6007..6016  type 6   item_id 20101..20110  price 50
6019        type 6   item_id 20111         price 150
7001..7012  type 998 item_id 20001/20004/20101..20110  sign=3  （分享解锁）
8022/8023   type 8   item_id 20003/20006   price 300 sign=1
```

购买走 `furniture_buy_shop(shop_id)`（main@378984），客户端 `FurnitureModel.requestBuy`（main@104464）。

**离线现状（重要）**：`new/furniture.js` 把 `shop_list` 填成 `FurnitureShopDB.list().slice(0,12)`，
而这 12 行是 `furnitureShopData_json` 的**文件顺序前 12 个 key**（`1,1001..1009,101,1010`），
**根本不含 6007~6019 的种子**。而且这些行只有 `id` 没有 `shop_id`：

```
semantic.js: "shop_list":[{"has_item":0,"id":1,"info":"","item_id":5001,"limit":1,...}]
```
客户端渲染/点选读的是 `shop_id`：
```
main@652397 FurnitureShopItem.dataChanged: var t=FurnitureShopDB.get(this.data.shop_id); ...
                                        this.lblCount.text=_("剩{0}个",this.data.num)
main@647973 FurnitureShopView.updateSelect: var e=FurnitureShopDB.get(this.curSelectedItem.shop_id),
             t=ItemDB.get(this.curSelectedItem.item_id), i=(e.info||t.info).split(" ");
```
→ `FurnitureShopDB.get(undefined)` 为 undefined → **`e.info` 抛 `Cannot read properties of undefined (reading 'info')`**（点一下商品就崩）。
**好消息**：`save/state.json` 里玩家其实**已经有全部种子**（`house` 中有 `20101..20111` 各 20 个，
来自 starterkit），所以不修商店也能种。

### A.5 花盆/田地 UI：类名、所需数据、格子数

**视图类 = `MainOutView`（室外场景），不是独立的花盆 View。** 三个成员：

```
main@851531  t.flowerpotList={},t.plantList={},...
             t.flowerpotList[1]=t.flowerpot1,
             t.plantList[11]=new CloverView,t.plantList[12]=new CloverView;
             var i=new CloverInfo; i.element=4;
             t.plantList[11].setInfo(i), t.plantList[12].setInfo(i),
             t.groupPot1.addChild(t.plantList[11]), t.groupPot1.addChild(t.plantList[12]);
```
控件来自编译后的 exml（**thm@786646**）：
`groupPot1` 内含 `flowerpot1`（eui.Image，默认 `source="flowerpot_1_1_png"`）、`plant1_1`、`plant1_2`（source=""）。
`plantList[11/12]` 是运行时 new 出来的 `CloverView`，叠在 `groupPot1` 上。另有 `btnPot1`（thm@768838 控件名表）。

**渲染函数（唯一入口）**：
```
main@891639  prototype.update_flowerpot=function(){
  for(var e=this.getModel(FurnitureModel).flowerpotData,
          t=Tabikaeru.DataManager.instance().flowerpotData.get("flowerpot"),
          i=0,n=e.show_list;i<n.length;i++){ var r=n[i];
      this.flowerpotList[r.type].source=t[r.id].pic+"_png";
      for(var o=1;o<=t[r.id].pos_list.length;o++){ var a=10*r.type+o;
          this.plantList[a].horizontalCenter=t[r.id].pos_list[o-1][0];
          this.plantList[a].verticalCenter=t[r.id].pos_list[o-1][1]; } }
  this.btnPot1.visible=!0;
  for(var s=Tabikaeru.DataManager.instance().flowerpotData.get("plant"),c=0,l=e.plant_list;c<l.length;c++){
      var r=l[c], a=10*r.type+r.index, h=new CloverInfo; h.element=4;
      s[r.id]&&(h.clover_id=r.id,h.sprite=r.stage), this.plantList[a].setInfo(h);
      3==h.sprite&&(this.btnPot1.visible=!1) } }
```
**唯一调用点**（`grep update_flowerpot` 全文件只有 2 处，1 处是定义）：
```
main@888455  MainOutView.reset(...) 里 this.update_flowerpot()
```
而 `reset()` 只被两处触发：
```
main@848501  MainOutController.open(): null==this.view&&(this.view=new MainOutView,e=!0),
             this.getParent().addChild(this.view), e||this.view.reset()
main@848667  MainOutController.totalCustomEvents: case RoleEventType.loadRole: this.view&&this.view.reset()
```
→ **要让花盆界面刷新，必须 push `client_load_role`（或让玩家重进场景）。**

数据契约（字段/长度/空槽约定）：

| 字段 | 类型 | 客户端读法 | 约束 |
|---|---|---|---|
| `show_list` | 数组 | `for i<show_list.length` → `flowerpotList[r.type].source = flowerpot[r.id].pic+"_png"` | 每项 `{type, id}`；**`type` 只能是 1**；`id` 必须在 `flowerpot` 表中（当前只有 `23001`，`type:1`，`pos_list:[[-30,-40],[27,28]]`） |
| `list` | 数组 | **从不读取**（全文件 grep `flowerpotData.list` 无命中） | 保留 `[]` 即可 |
| `plant_list` | 数组 | `for i<plant_list.length` → `a=10*r.type+r.index`，`plantList[a].setInfo(...)` | 每项 `{type, index, id, stage}`；`type` 必须 1；`index` ∈ {1,2}；`id` 必须是 `plant` 表 key；`stage` ∈ {1,2,3} |

**空槽约定：没有 `-1` 约定。** 空槽 = 该 `{type,index}` **不在 `plant_list` 里**。
（带 `-1` 约定的是别处：`item_load_items` 的 `bag`/`desk`、`FurnitureModel.serverData.bench`，见 B.3。）
另外 `update_flowerpot` **不会清空"这次没出现在 plant_list 里的槽"** —— 槽位残留旧 `CloverInfo` 是客户端行为。

### A.6 点击收割的命中判定

```
main@892382  prototype.flowerpotTouchEvents=function(e){ ... var i=function(i){
   if(n.plantList[i].info.sprite<3)return"continue";              // 未成熟 → 不响应
   if(!n.plantList[i].hitTestPoint(e.stageX,e.stageY))return"continue";
   var r=Number(i);
   return n.getModel(FurnitureModel).req_flowerpot_harvest(Math.floor(r/10),r%10,function(){
       t.plantList[i].harvest(), t.plantList[i].info.clover_id=0, t.plantList[i].info.sprite=0;
       ... 重新计算 btnPot1.visible ... }),"break"};
   for(var r in this.plantList){ var o=i(r); if("break"===o)break } }
```
→ 只有 `sprite(stage) == 3`（成熟）才可点，点完客户端**本地**从 `plant_list` 里 splice 掉那条。
`btnPot1` 自身只是个提示按钮（main@856294：`for(var e in t.plantList) if(t.plantList[e].info.sprite>0) 弹"呱~再等等" else 弹"呱~空的"`）。

植株美术（`CloverView.setInfo`，main@450088 `case 4:`）：
```
case 4:var a=Tabikaeru.DataManager.instance().flowerpotData.get("plant")[e.clover_id];
   if(a){var s=a.pic[e.sprite-1]+"_png"; core.LoadingManage.getInstance().loadResource([s],...) }
   else this.i_view.source=""
```
- `sprite` 必须是 1/2/3；`sprite=0` → `pic[-1]` → `"undefined_png"`；`sprite>3` → 同样越界。
- `clover_id` 不在 `plant` 表 → `i_view.source=""`（不崩，但空白）。
- 已验证 11 个种子对应的 **全部 36 个植株美术** 都在 `resource/China/default.res.json` 里
  （`zhongzhi_my_*` / `zhongzhi_jiaojin_*` 等）。

### A.7 我们 `new/*.js` 的现状与差距

```
new/defaults.js:10   S["furniture_load_flowerpot"] = function(){ return { show_list:[], list:[], plant_list:[] }; };
new/handlers_auto.js:61 / new/mock.js:174
                     Mock.handlers["furniture_flowerpot_harvest"] = function(){ return {"item_list":[{ "item_id": 0, "num": 0 }]}; };
new/mock.js:295      Mock.PUSH_LIST = [... "furniture_load_compost","furniture_load_furniture",
                     "furniture_load_pocket","furniture_load_tumbler","greetcard_load" ...]   ← 没有 furniture_load_flowerpot
```

差距清单：
1. `Mock.PUSH_LIST` **缺 `furniture_load_flowerpot`** → 登录/归来时永远不会下发 → `flowerpotData` 永远是空数组。
2. `defaults.js` 的 handler 永远返回空列表 → 即使补进 PUSH_LIST 也是空盆。
3. `furniture_flowerpot_harvest` 是自动生成的垃圾桩：`item_id:0`（= 奶油华夫饼！）`num:0`
   → 收割会弹出一个"0 个华夫饼"的奖励框。
4. 没有种子消耗 / 成熟计时 / 服务端"种植"逻辑。
5. **没有刷新路径**：即使 push 了 `furniture_load_flowerpot`，客户端因为不派发事件、`update_flowerpot`
   只在 `reset()` 里跑，界面也不会变。必须再 push `client_load_role`（`new/rules.js` 已有 `roleData()`）。

### A.8 建议实现（新建 `new/flowerpot.js`，挂到 `mock.js` 的 `extra` 列表）

服务端状态：
```js
st.flowerpot = { pot: { type:1, id:23001 },
                 slots: [ {index:1, plantId:2010101, stage:1, plantedAt:ts, growSec:1800},
                          {index:2, plantId:null } ] };
```
- `S['furniture_load_flowerpot']` 返回
  `{show_list:[{type:1,id:23001}], list:[], plant_list: slots.filter(有植株).map(s=>({type:1,index:s.index,id:s.plantId,stage:s.stage}))}`
  —— **字段一个都不能少**；`index` 只能是 1/2；`stage` 只能 1..3。
- 种植时机（服务端自由）：空槽 + 玩家 `house` 里有种子(`20101..20111`) → 消耗 1 个 → 生成
  `plantId = 种子id*100 + 随机品系`，`stage=1`。可用品系数见 `tables/flowerpotData_json.json.plant`。
- 成熟：定时把 `stage` 推到 3，然后 `push('furniture_load_flowerpot', payload, 30)` **再**
  `push('client_load_role', roleData(), 60)` 触发 `MainOutView.reset()`。
- 收割：`furniture_flowerpot_harvest` 校验槽位 `stage==3` → 清空该槽 → 返回
  `{code:0, item_list:[{item_id:<幸运花 1201..1215>, num:1}]}`（**`item_list` 必须存在，可为 `[]`**）→ 同样两连推。
- 收割奖励建议用 `Item type 1 / sub_type 1 = ItemAmuletType.FLOWER` 的 `1201..1215 幸运花`
  （`Item_json` 已确认存在，`flowerData_json` 有对应美术，客户端会走 `FlowerTextureFactory` 特殊渲染）。

**渲染陷阱（必须遵守）**
- `show_list[i].type != 1` → `this.flowerpotList[type]` undefined → **`Cannot set property 'source' of undefined`**。
- `plant_list[i].index > 2` 或 `type != 1` → `this.plantList[10*type+index]` undefined → `.horizontalCenter` / `.setInfo` 崩。
- 同一 `{type,index}` 出现两条 → 后者覆盖前者（不崩，但只显示最后一条）。
- `stage` 只能 1/2/3。
- **隐患**：`CloverView.harvest()` 600ms 后调用 `destroy()`，而 `destroy` 会
  `this.parent&&this.parent.removeChild(this)`（main@448873 类内）。`update_flowerpot` 从不 `addChild` 回
  `groupPot1`，所以**同一槽位收割过一次后，本次运行内再种也不会显示**（视图已被摘掉）。
  验证：收割后重进场景，看新植株是否出现；不出现就是该 bug。

**验证方法**
1. 改 `save/state.json` 让 `st.flowerpot.slots[0] = {index:1, plantId:2010101, stage:3}`。
2. push 两个协议后 `android_ui_dump` + 截图确认 `groupPot1` 位置出现植株。
3. 点它 → 看日志 `HANDLE furniture_flowerpot_harvest params={"type":1,"index":1}` 与奖励弹窗图标。
4. 控制台看有没有 `Cannot set property 'source' of undefined` / `reading 'length'`。
