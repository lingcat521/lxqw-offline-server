# 客户端契约逆向：任务 / 称号 / 图鉴 / 故事

> 只读研究。除本文件外未改动 `lxqw/` 下任何文件。
> 证据格式：`@偏移量` = `apk/assets/game/js/main.min.js` 中的**字符**偏移（`re.finditer` 的 `m.start()`，
> 文件是单行 1.33 MB UTF-8，偏移即字符下标）。片段用 `re.sub(r'\s+',' ',...)` 压平后引用，省略处写 `…`。
> 复现方式：
> ```python
> S=open('apk/assets/game/js/main.min.js',encoding='utf-8',errors='replace').read()
> S[127984:130826]   # GuideTaskModel 全类
> ```

---

## 0. 先说三条通用渲染契约（四块共用，决定了"字段缺失会不会崩"）

### 0.1 `Utils.convertArray` / `Utils.convertArrayAll`

`@300522`（附近 `function v` / `function _`）：

```js
…ataProvider=new eui.ArrayCollection(t)}}function v(e){return Array.isArray(e)?e:[]}
function _(e){var t={};for(var i in e)"object"==typeof e[i]?t[i]=v(e[i]):t[i]=e[i];return t}
```

- `convertArray(x)` = `Array.isArray(x) ? x : []` —— **不是数组就是空数组**，所以把 `lucky_days` 写成对象
  会让客户端拿到 `[]`（我们 `rules.js` 已经踩过这个坑，注释里写了）。
- `convertArrayAll(x)` = 逐字段：`typeof === "object"` 的字段一律过 `convertArray`。
  **注意**：`null` 的 `typeof` 也是 `"object"` → `null` 会变成 `[]`；数字/字符串原样保留。
  `encyclopedia_load` / `partycake_load` 都走这个函数，所以 `unlock_list` 必须是**真数组**。

### 0.2 配置表 DB：`get()` 找不到返回 `undefined`（不是空对象）

`@405450` 附近：

```js
function t(e){return new o(e,RES.getRes(e+"_json"))}          // KeyGetter: src 是整张表
function i(e,t){void 0===t&&(t="id"),new a(e,RES.getRes(e+"_json"),t)}  // IdGetter
…o.prototype.get=function(e){return this.src[e]}
…a.prototype.get=function(e){return this.dictSrc[e]}
```

→ `TaskDB = t("taskData")`，`encyData = t("encyclopedia")`，`calendarData = t("calendarData")`，
`ItemDB = i("Item")`，`AchieveDB = i("Achieve")`。

**结论**：任何 `XDB.get(id)` 拿到 `undefined` 后若继续 `.field`，就是一次 TypeError。
下面标 🔴 的都是这类**无保护解引用**。

### 0.3 故事表专用 DB 返回 `null`

`@405600`：

```js
var h=function(){function e(e){this["const"]=e["const"],this.story=e.story}
return e.prototype.getStory=function(e){for(var t=0;t<this.story.length;t++)if(this.story[t].storyid==e)return this.story[t];return null},e}();
```

→ `StoryModel.getStoryInfo(id)` 找不到返回 **`null`**（不是 undefined），所以 `n && …` 的写法挡不住后面的 `n.name`。

---

## 1. A 块：「伴蛙前行」的任务 / 计划

### 1.1 协议清单（`ProtocolList.protocolList @375541`）

| 偏移 | 原文 | 客户端是否主动发 |
|---|---|---|
| `@380373` | `task_load:[[],!0]` | ✅ 发（打开任务窗时） |
| `@380391` | `task_load_list:[[],!0]` | ❌ **只由服务端推** |
| `@380414` | `task_get_reward:[["id"],!0]` | ✅ |
| `@380442` | `task_get_list_reward:[["id"],!0]` | ✅ |
| `@380475` | `task_client_pro:[["param"],!1]` | ✅（`!1` = 不要回包） |
| `@382274` | `calendar_load:[[],!0]` | ❌ 只推 |
| `@382323` | `calendar_task_update:[[],!0]` | ❌ 只推 |
| `@382296` | `calendar_load_note / calendar_get_beginer_reward / calendar_get_code_reward:[["day"],!0] / calendar_get_st_reward / calendar_get_luck_reward` | 后 4 条 ✅ 发，前 1 条只推 |

用 `re.findall(r'\.send\("([a-z0-9_]+)"')` 统计客户端**真正发出**的协议（共 185 条）交叉验证：

```
task_load             sent_by_client=True   (1 处)
task_load_list        sent_by_client=False  (0)     ← 只能推
task_client_pro       sent_by_client=True   (1 处：req_client_pro 包装)
task_get_reward       sent_by_client=True   (1)
task_get_list_reward  sent_by_client=True   (1)
calendar_load         sent_by_client=False  (0)     ← 只能推
calendar_task_update  sent_by_client=False  (0)
```

### 1.2 `GuideTaskModel`（全客户端只有这一个任务模型；`@127984`–`@130826`）

`@128217` 注册：`addProtocolCallback("task_load","task_load_list")`。

```js
@129012 t.prototype.task_load=function(e){
  this.data=Utils.convertArray(e.tasks);
  for(var t=Utils.convertArray(e.list),i=0,n=t;i<n.length;i++){var r=n[i];this.dataList[r.id]=r.pro}
  this.updateRedot(),this.dispatchEvent(new core.Event(GuideTaskEventType.UPDATE))}
@129264 t.prototype.task_load_list=function(e){
  for(var t=Utils.convertArray(e.reward),i=0,n=t;i<n.length;i++){var r=n[i];this.dataReward[r.id]=r.pro}
  this.updateRedot()}
```

字段语义（**已确认，不是猜**）：

| 服务端字段 | 客户端存放 | 语义 | 元素形状 |
|---|---|---|---|
| `task_load.tasks` | `this.data`（**数组**） | 「任务」页（旅行/旅行笔记/手工品/家具/友情绘本/杂七杂八） | `{id, pro, is_reward}`，`id` **必须是 `taskData.task_list` 的键** |
| `task_load.list` | `this.dataList`（**字典** id→number） | 「计划」页（是日/当周/半月/月度/当季/年度） | `{id, pro}`，`id` **必须是 `taskData.list_map` 的键** |
| `task_load_list.reward` | `this.dataReward`（字典） | 每条「计划」**已领取的档位数** | `{id, pro}`，`id` = 节奏号 **1..6**（不是 100×n+1！） |

为什么 `dataReward` 的 `id` 是 1..6 —— `@128280`：

```js
@128280 t.prototype.getNextListReward=function(e){return this.dataReward[e]?this.dataReward[e]:0}
```
调用点 `@741269`：`getNextListReward(t.data)`，其中 `t.data` 来自 `GuideTaskListView` 的
`n.push(Number(r))`，`r` 是 `list_type` 的键（`"1".."6"`）。所以 `reward[].id ∈ {1..6}`。

### 1.3 `updateRedot`：**顺带暴露了 `list`/`tasks` 的取值域**（`@129756`）

```js
@129756 t.prototype.updateRedot=function(){
  var e=Tabikaeru.DataManager.instance().TaskDB.get("task_list"),t={};      // e: task_list 表
  …for(var n in e){var r=e[n];if(null==this.redotMap[r.type]){this.redotMap[r.type]="GUIDE_TASK_"+r.type;…}}
      this.redotMap[100]="GUIDE_TASK_LIST"; …
  for(var s=0,c=this.data;s<c.length;s++){var r=c[s],l=e[r.id];              // tasks[].id → task_list
      l&&0==r.is_reward&&r.pro>=l.count&&(t[l.type]=t[l.type]?t[l.type]+1:1)}
  var h=Tabikaeru.DataManager.instance().TaskDB.get("list_type");
  for(var r in h){for(var u=this.getCompleteListNum(Number(r)),p=0,d=0,g=h[r].target;d<g.length;d++){var f=g[d];u>=f&&p++}
      if(p>(this.dataReward[r]||0)){t[100]=1;break}}
  …}
@128370 t.prototype.getCompleteListNum=function(e){
  var t=Tabikaeru.DataManager.instance().TaskDB.get("list_map"),i=0;
  for(var n in this.dataList){var r=t[n];r.type==e&&this.dataList[n]>=r.count&&i++}return i}
```

🔴 `getCompleteListNum` 里 `r=t[n]; r.type` —— **`dataList` 里只要出现一个不在 `list_map` 里的 id，整个 `updateRedot` 抛异常**
（`task_load` 结束时是第一步就调它，等于任务窗打不开）。**所以 `task_load.list` 的 id 必须是 `list_map` 键的子集。**

### 1.4 两张表：`type` 字段到底指什么（`tables/taskData_json.json`）

**同一张表里有两套 `type`，别混：**

| 子表 | 键数量 | 取值 | 含义 | 由谁读 |
|---|---|---|---|---|
| `task_type` | 6（1,2,3,4,5,9） | 1..5,9 | 任务分类：旅行/旅行笔记/手工品/家具/友情绘本/杂七杂八 | `GuideTaskView`（按钮组 btnMap） |
| `task_list` | 30（1–9,101–105,201–205,301–304,401–403,901–904） | 同上 1..5,9 | 「任务」条目，`count`=目标次数、`reward_id`+`num`=奖励 | `GuideTaskDetailView`、`request_reward`、`updateRedot` |
| `list_type` | 6（1..6） | 键=节奏 | **是日清单/当周计划/半月计划/月度计划/当季计划/年度计划**，`target[]`=档位门槛，`reward[]`=每档奖励 item | `GuideTaskListView` |
| `list_map` | 67 | **1..6 = 节奏**，与 id 百位一致（1xx→1，2xx→2…6xx→6） | 「计划」条目，`count`=目标 | `GuideTaskListPageItem`、`getCompleteListNum` |

`list_type` 原文（`tables/taskData_json.json`）：

```json
{"1":{"name":"是日清单","reward":[1],"target":[3]},
 "2":{"name":"当周计划","reward":[202103,2],"target":[2,5]},
 "3":{"name":"半月计划","reward":[3,4],"target":[3,6]},
 "4":{"name":"月度计划","reward":[5,15,16,33,1104],"target":[2,4,6,8,12]},
 "5":{"name":"当季计划","reward":[8000,8000,1103],"target":[3,7,11]},
 "6":{"name":"年度计划","reward":[10103,10104,10106,10102,10105],"target":[4,9,14,21,30]}}
```

**所以用户说的"日任务/周任务/月任务/季任务/年任务" = `list_type` 1..6 = `list_map[].type`**，
而 `task_list[].type`（redotMap 用的那个）是**任务分类**，跟节奏无关。
（`redotMap` 用的表是 `TaskDB.get("task_list")`，即 `tables/taskData_json.json → task_list`。）

我已核对：`list_type[*].reward` 里 13 个 item id **全部存在于 `tables/Item_json.json`**——
必须如此，因为 `GuideTaskListPageItem.updateReward` 无保护地取 `.img`：

```js
@742407 …this.getItemId=e.reward[t];var i=Tabikaeru.DataManager.instance().ItemDB.get(this.getItemId);
        this.imageReward.source=Tabikaeru.path.formatPathImage(i.img)      // 🔴 无保护
```
`task_list[*].reward_id` 也全部存在（30 行全查过）。

### 1.5 进度**由服务端算**：客户端没有任何本地计数器

证据链：

1. `GuideTaskModel.data` / `dataList` 只在 `task_load` 里被服务器数据赋值（1.2），**没有任何 `++`**。
2. 客户端**唯一**的进度上报接口是 `req_client_pro`，而全客户端只有 **2 个字符串**、3 个调用点（`@129653` 定义）：

```js
@129653 t.prototype.req_client_pro=function(e){core.SocketManage.getInstance().send("task_client_pro",null,e)}
```
| 调用点 | 参数 | 时机 |
|---|---|---|
| `@746718` | `"Map"` | `GuideTaskView.childrenCreated`（打开任务窗） |
| `@1150517` | `"Map"` | 旅行地图控制器 `open()` |
| `@1158038` | `"NoteFriend"` | 旅友笔记视图 `onShow()` |

3. 协议表里那条通用上报口 `client_user_action:[["name"],!1] @375946` **客户端一次都没发**
   （全文件 grep 只有 1 次命中，就在协议表里）。

**结论**：`task_client_pro` 只是"我打开了地图/笔记"的提示（`param` 是字符串），
真正要"进度会走"，离线服必须**旁听其它协议**自己记账。这就是当前"怎么做都不涨"的根因。

### 1.6 领奖：两个按钮，两种回包

| 动作 | 客户端代码 | 发的协议与参数 | 允许点击的条件 | 服务端必须回 |
|---|---|---|---|---|
| 任务领奖 | `@128570 request_reward(e)` → `@128640 send("task_get_reward", new core.Action1(cb), e)` | `{id: 任务id}` | `e.pro >= task_list[id].count && 0==e.is_reward`（`@735157 on_imgTaskTag_tap`、`updatePage`） | **`{code:0}`**；成功后客户端本地 `o.is_reward=true` 并推 `GuideTaskEventType.UPDATE`，播放开奖动画 |
| 计划档位领奖 | `@129518 req_list_reward(e,t,i)` | `{id: 100*节奏 + (已领档位+1)}` | `imagePoint[已领档位]` 亮起，即 `getCompleteListNum(节奏) >= list_type[节奏].target[已领档位]` | **`{code:0}`**；成功后客户端 `dataReward[节奏] = 已领+1` |

```js
@129518 t.prototype.req_list_reward=function(e,t,i){var n=this;t++;var r=100*e+t;
  core.SocketManage.getInstance().send("task_get_list_reward",new core.Action1(function(r){
    0==r.code&&(n.dataReward[e]=t,i&&i.apply(),n.updateRedot())}),r)}
@128640 …send("task_get_reward",new core.Action1(function(i){if(0==i.code)for(var n=0,r=t.data;n<r.length;n++){
    var o=r[n];if(o.id==e){o.is_reward=!0;var a=TaskDB.get("task_list")[e];
      a&&t.getModel(ItemModel).addHouseItem(a.reward_id,a.num),t.updateRedot(),…}}}),e)}
```

⚠️ `ItemModel.addHouseItem` 是**空函数**（`@138455 t.prototype.addHouseItem=function(e,t,i){void 0===i&&(i=!0)}`）——
客户端**不会**自己加物品，**真正到账必须靠服务端 push `item_load_items` / `clover_update`**，
否则就是"领了奖、UI 放了动画、仓库里没有"。
（奖励展示用的是本地表：`playAnimation` 直接读 `TaskDB.get("task_list")[id].reward_id/num`。）

### 1.7 我们现在的实现到底错在哪（`new/activities.js` + `new/guard.js`）

`new/activities.js:S['task_load']`：

```js
var TASK_IDS=[101,102,…,630];                 // ← 这是 list_map 的 66 个键
var TASK_CFG=[{count,desc,id,title,type},…];  // ← 这是 list_map 的行（逐条比对与 list_map 完全一致）
S['task_load']=function(){
  var prog=[];for(i…)prog.push({id:TASK_IDS[i],pro:0});
  return {tasks:TASK_CFG, list:prog};
};
```

三个问题：

1. **`tasks` 装的是 `list_map` 的行，不是 `task_list` 的行。**
   `GuideTaskView.update()`（`this.typeMap={} @749259`）用 `TaskDB.get("task_list")[e.id]` 查配置，
   现在的 id（101..630）里只有 101–105/201–205/301–304/401–403 恰好在 `task_list` 里，
   其余全被 `c && …` 静默丢掉 → 「任务」页只剩一小撮，且"友情绘本/杂七杂八"等页签永远空。
2. **`tasks` 元素没有 `pro` / `is_reward`。**
   `GuideTaskDetailView.updatePage`（`@735157`）：`this.prgBar.value=e.pro`（undefined）、
   `e.is_reward?…:(e.pro>=t.count?…)` 两边都不成立 → 永远 `currentState="normal"`，**领奖按钮永不出现**。
3. **`list` 的 `pro` 恒为 0**，而且永远不会变 → 所有「计划」条目 `0/1`，档位奖励永不亮。

还有一个**连带的坑**：`new/guard.js` 的 `SET.task` 也是 **`list_map` 的 id 列表**（101..630）：

```js
/* guard.js */
if (name === "task_load" && Array.isArray(d.tasks)){
  d.tasks = d.tasks.filter(function(t){ var ok = has("task", t.id); if(!ok) drop("task:"+t.id); return ok; });
}
… var K = { … "task": ["101","102",…,"630"], …
```
→ 一旦按 1.8 把 `tasks` 改成 `task_list` 的真键（1..9、901..904），**guard 会把它们全删掉**
（`SET.task` 里没有 "1".."9"、"901".."904"）。**改契约必须同时改 guard.js 的白名单。**

### 1.8 「让进度真的走、奖励真的能领」的最小完整实现

**A. 响应形状（三处）**

```js
// task_load —— 客户端主动请求 + 服务端推送两条路都要对
{ tasks: [{id, pro, is_reward}, …],   // id ∈ task_list 的 30 个键；pro 可 > count（详情页会 clamp 显示）
  list:  [{id, pro}, …] }             // id ∈ list_map 的 67 个键；必须含 101,201,301,401,501,601（页签显隐）
// task_load_list（只推）
{ reward: [{id: 节奏1..6, pro: 已领档位数}, …] }
// task_get_reward / task_get_list_reward
{ code: 0 }
```

**页签显隐的硬条件**（`GuideTaskListView.childrenCreated @740100`）：

```js
var t=getModel(GuideTaskModel).dataList,i=TaskDB.get("list_type"),n=[];
for(var r in i){var o=100*Number(r)+1;null!=t[o]&&n.push(Number(r))}
```
→ `dataList` 里必须有 `101/201/301/401/501/601`，否则对应页签**根本不出现**。

**B. 进度从哪来（服务端旁听，按 `task_list` id）**

| id | title | count | 奖励(item×num) | 可观测的客户端行为（服务端记账点） |
|---|---|---|---|---|
| 1 | 等蛙旅行回来 | 1 | 200000×10 | 归来结算（`item_set_bag_completed` 之后 `returnAt` 到点） |
| 2 | 旅行成了常态 | 10 | 14 | 累计出发次数 |
| 3 | 回家还带吃的 | 1 | 200000×10 | 归来带特产（`travel_load_gift`） |
| 4 | 吃不完就是囤 | 10 | 18 | 特产入礼品盒/仓库次数 |
| 5 | 途中淘了个纪念品 | 1 | 1000 | 首次获得纪念品（`item_load_handbook.collections` 增长） |
| 6 | 一屋子的纪念品 | 6 | 200000×30 | 纪念品种类数 |
| 7 | 照片里有蛙 | 1 | 1000 | 首次获得明信片（`album_load_new`） |
| 8 | 这些照片都有蛙 | 20 | 9000 | 明信片总数 |
| 9 | 蛙蛙联合做大事 | 1 | 1012 | 与旅友同框照 / 故事 |
| 101 | 旅行有感 | 1 | 1000 | `travel_read_note`（读第一篇笔记） |
| 102 | 一连串的见闻叙事 | 20 | 200000×50 | 笔记总数 |
| 103 | 蛙友的结伴记录 | 1 | 14 | 获得旅友笔记 |
| 104 | 蛙友待续的故事 | 1 | 200000×10 | `story_load` 里出现新故事 |
| 105 | 见一见旅行的朋友 | 1 | 17 | 遭遇旅友（`travel_load_gift` 的旅友条目） |
| 201 | 材料不可缺 | 1 | 8000 | 获得手工材料 |
| 202 | 祈愿旅行~棒棒的 | 1 | 200000×20 | `pray_confirm_make_box` |
| 203 | 祈愿物雕刻老手 | 10 | 8000 | 祈愿物完成次数 |
| 204 | 瞧~手工印章 | 1 | 200000×20 | 印章完成 |
| 205 | 盖了好多个章 | 10 | 8000 | 印章完成次数 |
| 301 | 蛙~做什么工作呀 | 1 | 200000×10 | `item_buy` 成功 |
| 302 | 买了肯定有用 | 5 | 200000×20 | `item_buy` 成功次数 |
| 303 | 开始装饰小屋 | 1 | 200000×10 | `client_change_decorate` |
| 304 | 整套风格真好看 | 1 | 9000 | 装饰达成 |
| 401 | 门口的小卡片 | 1 | 200000×10 | 收到贺卡（`greetcard_*`） |
| 402 | 揭秘~小伙伴身份 | 1 | 200000×20 | 贺卡素材解锁 |
| 403 | 等一个聚会惊喜 | 1 | 200000×20 | `partycake_*` / 邻居聚会 |
| 901 | 屯点家底 | 200 | 1 | 累计三叶草 |
| 902 | 攒点运气 | 25 | 1000 | 抽奖券累计 |
| 903 | 日历里的时光美食 | 1 | 1000 | `calendar_get_code_reward` / `calendar_get_st_reward` |
| 904 | 相册~急需扩容 | 1 | 200000×10 | 使用 9000「相册扩容」 |

**C. 必须 push 的协议与时机**

| 时机 | push | 数据 |
|---|---|---|
| 任意一条进度 +1 后 | `task_load` | A 里的完整对象（`tasks` + `list` 都要，缺一个客户端就少一半） |
| 某条 `pro` 跨过 `count` | 同上（客户端靠它点亮"领奖"） | — |
| 计划条目完成 / 跨过 `target` 档位 | `task_load`；已领档位数变化时再推 `task_load_list` | `{reward:[{id:节奏,pro:已领}]}` |
| 领奖成功后（`task_get_reward` 内） | `clover_update` 或 `item_load_items` | 200000=三叶草→`clover_update`；其它→`item_load_items`。**必须推**，因为 `addHouseItem` 是空函数 |
| 周期切换（日/周/半月/月/季/年） | `task_load` + `task_load_list` | `list` 清零、`reward` 档位数清零 |

**D. 时间窗（客户端完全不管，服务端定义）**：`list_type` 的名字就是窗口：
日=当日；周=周一 0 点（跟 `partycake.js` 的 `weekStart()` 一致）；半月=1 号/16 号；月=自然月；季=3/6/9/12 月 1 日；年=1 月 1 日。

### 1.9 A 块的渲染陷阱清单

| 位置 | 代码 | 后果 | 规避 |
|---|---|---|---|
| `updateRedot @129756` → `getCompleteListNum @128370` | `var r=t[n]; r.type` | `list` 里出现非 `list_map` id → **抛异常**，任务窗整块打不开 | `list` 只用 `list_map` 的 67 个键 |
| `GuideTaskListView @740100` | `null!=t[100*节奏+1]` | 少一个页签就整档消失 | 必发 101/201/301/401/501/601 |
| `GuideTaskDetailView.updatePage @735157` | `var t=TaskDB.get("task_list")[e.id]; t&&(…)` | `tasks` id 不是 `task_list` 键 → **详情页空白**（不崩） | `tasks` 只用 `task_list` 的 30 个键 |
| `GuideTaskListItem.dataChanged @743347` | `this.data.pro>this.data.count?…` | `pro` 缺失 → 标题显示 `undefined/1` | 每条都带 `pro`（数值） |
| `GuideTaskListPageItem.updateReward @742407` | `ItemDB.get(e.reward[t]).img` | 奖励 item 不在 Item 表 → **崩** | 已核对：`list_type[*].reward` 全在表内 |
| `GuideTaskListPageItem.dataChanged @740493` | `l.pro=n[l.id]` | 缺条目 → `（undefined/1）`，不崩 | 建议全量 67 条 |
| `updateListShow @747752` | `list_map[listToDo[randomIndex]].title` | 只在 `pro<count` 时进 listToDo，条目来自 `list` 键 → 安全 | — |
| `GuideTaskView.updateLock @749690` | `this.lockMap[2][1]=…` | `lockMap` 由客户端硬编码（1,2,3,4,5,9） | 别新增 `task_type` 键 |

### 1.10 顺带确认：`partycake_load_task`（聚会每周任务）与其它同类结构

**聚会（`partycake_*`）——已是正确实现，契约如下（供复核）**

```js
@162165 t.prototype.partycake_load_task=function(e){this.data.task_list[e.task.id-1]=e.task}   // 单条，1-based
@161198 t.prototype.partycake_load=function(e){… this.data.task_list=Utils.convertArray(e.task_list) …}
// 视图（@982376 起）
for(var s=[],c=0,l=this.data.task_list;c<l.length;c++){var a=l[c],h=partycakeData.get("task_list")[a.id];
  … s.push({id:a.id,count:a.count,is_done:a.is_done,cfg:h}) }
s.sort(function(e,t){return e.is_done-t.is_done});
@987626 PartyCakeTaskItem.dataChanged: this.lbTask.text=cfg.name+"("+data.count+"/"+cfg.total+")";
        this.imageDone.visible=1==data.is_done
```
- 数据源 `tables/PartyCakeData_json.json → task_list` 6 条 `{name,total,cream,sugar}`（1 登录3 / 2 商店买买买2 / 3 商店抽奖3 / 4 看广告3 / 5 分享3 / 6 聚会或旅行2）。
- **🔴 稀疏数组陷阱**：`task_list[e.task.id-1]=e.task` 是按 id 落位。如果 `partycake_load` 给的是**稀疏/带洞**数组
  （例如只推了 id=3），视图的 `for(c=0;c<l.length;c++){a=l[c]; a.id}` 会读到 `undefined` → **崩**。
  所以：(a) `partycake_load.task_list` 必须**稠密 6 条**；(b) 单条 `partycake_load_task` 只能在已经稠密之后发。
- `partycake_load_task` 的 handler **不派发事件**（没有 `dispatchEvent`）→ 单推它 UI 不刷新，必须紧跟 `partycake_load`。
  `new/partycake.js:153` 已经这么做了（`push("partycake_load_task", …)` + `if(done) push("partycake_load", …)`），
  且 `taskList()` 恒返回 6 条稠密 → **这块 OK**。
- 补充：`partycake_get_mate` 里客户端 `data.cream+=data.pre_cream` 是**客户端自己**加的，
  所以服务端在 `code:0` 那一刻必须把自己的 `pre→cream` 也并掉（`new/partycake.js` 已做）。

**其它"活动任务列表"结构（搜 `_load_task` 只有 2 处、搜 `is_done` 只命中聚会）**

| 协议 | 客户端契约 | 形状 | 我们的实现 |
|---|---|---|---|
| `capsule_load_task @380986` | `capsule_load_task=function(e){this.data.task_list=Utils.convertArray(e.task_list); …}`；视图 `CapsuleUtils.getTaskCfg(x)=capsuleData.get("task_list")[x.toString()]` | `task_list` = **数字 id 数组**（如 `[3,5]`），不是对象数组！视图只读 `task_list[0]`/`[1]` | `new/capsule.js`（需按此复核） |
| `cooking_load_cooking @378832` | `serverData.task_list`；`updateRedot`：`r=CookingTaskDB.get(n.id); r&&n.pro==r.state&&0==n.complete` | `{id, pro, complete}`，目标是表里的 `state`；另有 `week/month/month_pro/complete/refresh_time` | `new/cooking.js` |
| `greetcard_get_task_item` / `springcard_get_task_reward` | 贺卡活动的任务（不是"每周"节奏） | — | `new/greetcard.js` / `new/springcard.js` |

→ **结论：真正的"每周任务"只有聚会的 `partycake_load_task`（+ 计划页的「当周计划」list_type=2）。**
扭蛋机 `capsule_load_task` 是"每日 2 条"，料理 `cooking_*` 是"月主题 + 周进度"。

### 1.11 顺带确认：日历（`calendar_*`）为什么也"点了没反应"

`CalendarModel @84623`：

```js
@84947 calendar_load=function(e){this.data.new_flag=Utils.convertArray(e.new_flag);
  this.data.task_list=Utils.convertArray(e.task_list);
  for(var t=Utils.convertArray(e.lucky_days),i=0;i<t.length;i++)this.data.lucky_days[t[i].day]=t[i].item_id;
  t=Utils.convertArray(e.st_days); for(…)this.data.st_days[t[i].day]=t[i].item_id; this.checkRedot()}
@85312 calendar_load_note=function(e){this.data.note_list=Utils.convertArray(e.list)}
@85403 calendar_task_update=function(e){e&&e.task&&(this.data.task_list[e.task.id-1]=e.task,this.checkRedot())}
```

- `lucky_days`/`st_days` 必须是**数组** `[{day, item_id}]`（**`day` 是"格子下标"不是"几号"**，
  我们 `rules.js` 的 `calCell()` 已经标定过）。`item_id` 必须能在 `ItemDB` 里查到（-1 例外，表示只画幸运花图标）→
  `CalendarView.childrenCreated`（`@530431`）里 `var g=ItemDB.get(a); d.source=formatPathImage(g.img)` 🔴 无保护。
- `canGetStReward()`：`for(e=0;e<task_list.length;e++) if(!task_list[e].complete) return false; return true`
  → **`task_list: []` 会返回 `true`**（空真）→ 日历红点永远亮。
- 🔴 `req_st_reward`（`@86421`）回包成功时：

```js
if(0==n.code){ …addViewControl(GiftPackageViewController,…,r); i.data.st_days[e]=null;
               i.data.task_list[0].complete=!1;  i.checkRedot(); t&&t.apply() }
```
  `task_list: []` → `task_list[0]` 是 `undefined` → **`Cannot set property 'complete' of undefined`**，
  异常被 `callCb` 吞掉 → `checkRedot()` 与调用方回调 `t.apply()`（负责隐藏格子上的奖励图标）**都不执行** →
  "领了节气奖励但图标不消失"。
- 正确做法：`calendar_load.task_list` 给**非空**的日任务数组（建议就取 `list_map` 的 type=1 三条
  `101/102/103`），形状 `{id, complete}`；完成时推 `calendar_task_update {task:{id,complete:1}}`；
  三件全 complete 后 `canGetStReward()` 才为真。
  ⚠️ `calendar_task_update` 只调 `checkRedot()`，**不派发事件**，所以还要随 `calendar_load` 补推一次。
- `note_list`：`CalendarNoteView @526605` 用 `note_list[day-1]` 当 `calendarData.note` 的键 🔴
  `var c=calendarData.get("note")[o]; var l=c.pic+"_png"` 无保护 →
  **`note_list` 里出现非 `calendarData.note` 键 → 崩**。
  合法值范围：`calendarData.note` 的 636 个键（10001–10007 是新手提示，1001+ 是节气文案）。

---

## 2. B 块：称号（Achieve）

### 2.1 客户端逐字段

`RoleModel @169548`：

```js
@175601 t.prototype.client_load_role=function(e,t){var i=e.frog;if(null!=i){
  this.name=i.name, this.useAchieveID=i.cur_achieve,
  this.achieveList=Array.isArray(i.achieves)?i.achieves:[];
  for(var n=Utils.convertArray(i.achieves_time),r=0,o=n;r<o.length;r++){var a=o[r];this.achieveTime[a.id]=a.time}
  …}}
```
| 服务端字段 | 类型 | 用途 |
|---|---|---|
| `frog.achieves` | **真数组**（`Array.isArray` 判定，不是数组直接置 `[]`） | 已获得称号 id 列表 |
| `frog.achieves_time` | 数组 `[{id,time}]` | `achieveTime[id]=time`（unix 秒）；`isAchieveExpire(id)` = `achieveTime[id] ? now>=time : false`；`getUseAchieveID()` 过期返回 -1 |
| `frog.cur_achieve` | number | 当前佩戴的称号 id |

`@171626 getAchieveList()` 返回 `achieveList`；`getAchieveInfo(e)` = `AchieveDB.get(e)`；
`getAchieveInfoList()` = `AchieveDB.list()`（`tables/Achieve_json.json`，101 行，id 0–3、6–11、13–…、900–902）。

### 2.2 称号界面要什么

`AchieveView.open @522505`：

```js
var e=this.roleModel.getAchieveList(),t=this.roleModel.getAchieveInfoList();
t=t.filter(function(t){return e.indexOf(t.id)>=0?!0:""==t.is_special?!0:!1});   // 已拥有 或 is_special==""
t.sort(…已拥有的排前面…);
for(…) n=e.indexOf(i.id)>=0&&!this.roleModel.isAchieveExpire(i.id)?n.setInfo(i):n.setInfo();  // 无参 → "??????"
```
`AchieveItemView @521698`：`setInfo(e){ this.t_achieve.text = null==e?"??????":e.name; if(e){var t=RoleModel.getAchieveTime(e.id); …"X天后到期"}}`

→ **`AchieveJson` 的 3 条 `is_special==="1"`（900/901/902）是有意"未拥有就不显示"的**；
其余 98 条未拥有时显示 `??????`。`AchieveItemView` 对缺失字段**不崩**（有 `null` 分支）。

`AttributeView @524551`（`AchieveView @522505` 之后）（属性/改名页）：
```js
selectAchieveItem(e){this.achieveInfo=e;this.t_achieve.text=e?e.name:_("称号")}
applyInput(){ this.roleModel.setUseAchieveID(this.achieveInfo?this.achieveInfo.id:0); this.roleModel.setName(this.t_name.text, cb) }
```

### 2.3 谁发 `client_set_achieve`、服务端要回什么

```js
@171301 t.prototype.setUseAchieveID=function(e){this.useAchieveID!=e&&(this.useAchieveID=e,
  core.SocketManage.getInstance().send("client_set_achieve",null,e),
  this.dispatchEvent(new core.Event(RoleEventType.updateAchieveID)))}
```
- 参数名 `id`（`@375671 client_set_achieve:[["id"],!1]`，`!1`=不用回包）→ mock 里应读 **`p.id`**。
- **唯一调用点**是 `AttributeView.applyInput()`（点"确定"保存名字时），且**先发 `client_set_achieve` 再发 `client_set_name`**。
- 回包：**不需要**（客户端已本地改 `useAchieveID`）。但服务端**必须落库**并在下一次
  `client_load_role.frog.cur_achieve` 里回同一个 id；否则重登就"称号丢了"。
- 名字没变时 `setName` 直接 `t&&t(null)`（不扣费、不改名）→ **只换称号是免费的**；
  我们的 `client_rename_cost` 回 `{clover:0}` 更是免费。

### 2.4 称号怎么被触发：**纯服务端**

- 全客户端只有 `client_load_role` 会写 `achieveList`（`@175601`；grep `achieveList` 只有 RoleModel 与 UserModel 的 clientSettings 缓存）。
- 客户端只做"新称号弹窗"提示（`MainInView.checkNewAchieve @841112`）：
```js
var i=RoleModel.getAchieveList(); var r=n.getClientSettings().achieveList.concat();
if(i.length>r.length) for(…){if(-1==r.indexOf(o)){r.push(o);…;this.tipsNewAchieve(o,…);break}}
@841898 tipsNewAchieve: var r=n.getAchieveInfo(e); if(r){ ModalAlert(_("恭喜获得称号：{0}\n{1}",r.name,r.description)) } else this.checkNewAchieve()
```
  → 用"服务端列表长度 > 本地已提示长度"判断，**服务端给什么就是什么**；id 不在表里会走 `else`（不会死循环，因为已写进 clientSettings）。
- 触发条件全部写在表的 `info` 字段（人话）：`1:旅行达到10次`、`2:25次`、`3:50次`、
  `9:拥有超过10万棵三叶草`、`10:抽奖20次以上`、`13–16:获得5/10/15/20种纪念品`……**没有任何客户端判定逻辑**。

### 2.5 离线可做性 + 最小实现

**可做**（数据全在本地存档：旅行次数、三叶草、照片数、纪念品种类、抽奖券……）。
我们现在的缺口（`new/rules.js:105`）：

```js
frog: { name: st.name||"xiaowa", cur_achieve:0, achieves:[], achieves_time:[], … }
```
`achieves` 恒空、`cur_achieve` 恒 0、**没有任何 `client_set_achieve` handler**（grep 全 `new/` 无命中，
落到 `Mock.handle` 的 `NO-HANDLER` → 返回 flex）。→ 称号界面永远全是 `??????`，换了也存不住。

最小实现（建议新增 `new/achieve.js`，或并入 `rules.js`）：
1. `S['client_set_achieve']=function(p){ st.achieveId = Number(p.id)||0; save(); return {code:0}; }`（回包随意，客户端不看）
2. `roleData().frog`：`cur_achieve: st.achieveId||0, achieves: Object.keys(st.achieves||{}).map(Number), achieves_time: []`
3. 一个"判定器"在每次 `client_load_role` / 归来结算时跑：按 `Achieve_json[].info` 翻译成我们能数的量
   （`st.travelCount`、`st.clover`、`house` 里纪念品种类、`st.gacha.length`、`st.photos.length`…），
   新达成 → 写 `st.achieves[id]=1` → **push `client_load_role`**（客户端就是靠它拿到新列表并弹"恭喜获得称号"）。
4. 已获得即永久（原版的限时称号靠 `achieves_time`；不发就永远不过期）。

**风险**：`achieves` 里若混入表外的 id，`AchieveView` 会 `AchieveDB.get(id)` → `undefined` → 显示 `??????`
（不崩但很怪）；`checkNewAchieve` 对表外 id 走 `else`。**id 必须落在 `Achieve_json` 的 101 行内。**

---

## 3. C 块：植物百科 / 旅行百科

### 3.1 协议（两个 `*_load` **都没有**客户端请求——只能服务端推）

```
@382038 encyclopedia_load:[[],!0]        @382064 encyclopedia_set_show_sub:[["long_id"],!1]
@382107 encytravel_load:[[],!0]          @382133 encytravel_set_show_sub:[["long_id"],!1]
```
`re.findall` 证实：`encyclopedia_load` / `encytravel_load` **客户端一次都不发**（只有 `set_show_sub` 各 1 处）。

### 3.2 模型逐字段（两个模型几乎逐字相同）

```js
@15623 EncyModel.encyclopedia_load=function(e){e=Utils.convertArrayAll(e);
  this.data.unlock_list=e.unlock_list;
  for(var t=0,i=e.unlock_desc;t<i.length;t++){var n=i[t];this.data.unlock_desc[n.id]=Utils.convertArray(n.list)}
  for(var r=0,o=e.show_sub;r<o.length;r++){var n=o[r];this.data.show_sub[n.id]=n.sub_id}
  this.data.unlock_list.sort(function(e,t){return e-t})}
@16136 req_set_show_sub=function(e){var t=encyData.get("list")[e];   // 🔴 e 必须是 list 的键
  this.data.show_sub[t.id]=e; core.SocketManage.getInstance().send("encyclopedia_set_show_sub",null,e)}
@16184 isOpen=function(){return this.data.unlock_list.length>0}
@16253 isDescUnlock=function(e,t){var i=this.data.unlock_desc[e];if(!i)return!1;for(…)if(o==t)return!0;return!1}
```
（`EncyTravelModel @102462` / `encytravel_load @102721` 完全同构。）

**三字段语义（务必区分"主 id"和"行键"）**

| 字段 | 形状 | 语义 |
|---|---|---|
| `unlock_list` | `[long_id, …]`（数字，客户端自己升序排） | 已解锁的**行键** = `encyclopedia.list` 的 key |
| `unlock_desc` | `[{id: 主id, list:[描述序号,…]}]` | 主 id 的**描述行**解锁到第几行（对应 `desc[主id]` 的键） |
| `show_sub` | `[{id: 主id, sub_id: long_id}]` | 每个主条目**当前展示的变体**（字段名 `sub_id` 骗人，值其实是 long_id） |

关键点：客户端读行用的是 **`list[<数字>]`** 这种"用数字当下标查字典"的写法（JS 转成字符串），
所以 `unlock_list` / `show_sub.sub_id` 里放的必须是表的 **key**（`long_id`），不是主 id。

### 3.3 两张表的结构与 `long_id` 编码（已按公式全量校验）

```
tables/encyclopedia_json.json : {desc:{主id:{序号:文案}}, list:{long_id: 行}}   238 行，tab 1..4
tables/encytravel_json.json   : {desc:{主id:{序号:文案}}, list:{long_id: 行}}   159 行，tab 1..3
```

行字段：
- `encyclopedia.list[long] = {id, sub_id, pic_id, long_id, name, sub_name, tab, icon, pic_img, pic_name, pos?, scale?}`
- `encytravel.list[long]  = {id, sub_id, long_id, item_id, name, sub_name, tab}`

**编码（238 + 159 行逐行验证，0 例外）**

| 表 | 公式 | 例子 |
|---|---|---|
| 植物 | `long_id = id*10000 + sub_id*100 + pic_id`（pic_id 1..6） | 101·1·3 → `1010103` |
| 旅行 | `long_id = id*10000 + sub_id` | 3004·2 → `30040002` |

（`encyclopedia` 按 `lid == id*10000+sub*100+pic` 全量断言 0 处不符；
`encytravel` 按 `id*10000+sub` 全量断言 0 处不符。`encytravel.item_id` 只有 1 行是 0，其余全在 `Item_json.json` 里。）

**tab 语义（由 `item_id` 的 `Item.type` 直方图得）**：旅行百科 tab1=食物(type 0)×92、tab2=纪念品/护身符(type 1)×55、tab3=工具(type 2)×12。

**植物 ↔ 花盆的映射**：`encyclopedia` 的主 id **不与任何 Item id 对应**（101 号是"角堇"，Item 101 是"枣花酥"）。
真正的植株 id 在 `tables/flowerpotData_json.json → plant`（`2010101 = 角堇·火龙果`），
客户端花盆用的就是它（`@892178`：`for(var s=flowerpotData.get("plant"),…l=e.plant_list){var r=l[c],a=10*r.type+r.index,h=new CloverInfo;…h.clover_id=r.id,h.sprite=r.stage}`）。
按**名字**能唯一对上：`flowerpotData.plant[P].name === encyclopedia.name + "·" + encyclopedia.sub_name`
（32/35 条对得上；剩 3 条是"葡风·xx"简称差异。另有若干百科变体（幸运花/杂草/建兰/木槿/丁香）**没有对应植株**——
它们靠其它途径获得）。**所以映射要在运行时按名字建表，别写死整型公式。**

### 3.4 界面需要什么 / "解锁条件字段"的真相

- **"解锁条件"根本不在客户端**：两张 `desc` 表只有文案（如 `{1:"金虎尾目-堇菜科-堇菜属",2:…}`），
  没有任何"需要种出 X 才解锁"的判定。客户端**完全按服务端给的 `unlock_list` 显示**，
  没解锁的条目连行都没有。→ **解锁条件必须我们自己定义（服务端判定）。**
- 界面读取链（`EncyView @596712`：`getItemsByTab @598613` / `getSubItems @598820` / `getPicItems @599079` / `updatePicItems @601195`；旅行版 = +13.6k）：
  - `getItemsByTab(e)`：`for(var r in show_sub){var o=list[show_sub[r]]; o&&o.tab==e&&t.push(o)}`
    → **每个主条目只出一行**，就是 `show_sub` 指定的那行；`o.tab` 决定落在哪个页签。
  - `getSubItems(id)`：遍历 `unlock_list`，`c&&c.id==e&&!i[c.sub_id]` → 该主条目的**已解锁变体**（去重）。
  - `getPicItems(id, sub_id)`：`c.id==e&&c.sub_id==t` → 变体的图集（`EncyPicItem` 用 `pic_img/pic_name/pos/scale`）。
  - `onTabChange`：`tab==0` 时拼接 `getItemsByTab(1..4)`；`itemList` 不足 12 条用 `{}` **补位**。
  - `for(var i=1;i<tab.numChildren;i++)tab.getChildAt(i).enabled=getItemsByTab(i).length>0` → **没解锁的页签是灰的**。
- 🔴 **`EncyTravelView.updatePicItems @614797`（无保护，空列表直接崩）**：

```js
t.prototype.updatePicItems=function(){var e=this.itemList[this.list.selectedIndex],
  t=Tabikaeru.DataManager.instance().ItemDB.get(e.item_id);
  if(t.type==…Amulet&&t.sub_type==…FLOWER){…}else this.imagePic.source=Tabikaeru.path.formatPathImage(t.img)}
```
  `itemList` 为空 → 补位后的 `{}` → `ItemDB.get(undefined)` = `undefined` → **`t.type` TypeError**；
  而 `onTabChange` 是在 `childrenCreated` 的 `this.tab.setSelected(0)`（`@612267`）里同步跑的 →
  **"旅行百科一条都没解锁"会直接让窗口打不开**。
  （`EncyView`（植物）的 `updatePicItems @601195` 只做 `getPicItems(e.id,e.sub_id)` → 返回 `[]`，不崩；
  `EncyTravelItem.dataChanged` 也有 `null!=this.data.item_id` 保护，但挡不住 `updatePicItems`。）
- 门外还有一层：`@604148 Travel.visible=this.btnTravel.includeInLayout=EncyTravelModel.isOpen()`
  → `unlock_list` 为空则**连入口按钮都不显示**。

### 3.5 我们现在的实现差距（`new/rules.js:14-19, 452-460`）

```js
var ENCY_UNLOCK=[101,102,…,406];                 // 主 id！
var ENCY_DESC=[{id:101,list:[1,2,3,4]},…];       // 这个形状是对的
var ENCY_SUB=[{id:101,sub_id:0},…];              // sub_id=0 → list[0] === undefined
…
S['encyclopedia_load']=function(){return {unlock_list:ENCY_UNLOCK,unlock_desc:ENCY_DESC,show_sub:ENCY_SUB}};
S['encyclopedia_set_show_sub']=function(p){for(…)if(ENCY_SUB[i].id===p.id)ENCY_SUB[i].sub_id=p.sub_id;return{code:0}};
```

三个 bug：
1. `unlock_list` 给的是**主 id**（101…406），不是 `long_id`；`list[101]` → `undefined` → 全部被
   `c&&…` 丢掉 → `getSubItems()` 恒空 → 植物百科列表恒空（页签全灰）。旅行百科同理（`ET_UNLOCK` 给 1001…3004，应是 `10010001` 这种）。
2. `show_sub.sub_id: 0` → `list[0]` 不存在 → `getItemsByTab()` 恒空 → **旅行百科触发 3.4 的崩溃路径**。
3. `set_show_sub` 读错参数名：协议参数是 **`long_id`**（`@382064`），客户端 `send(...,null,e)` 里的 `e` 就是 `t.data.long_id`
   （`@600970`）→ mock 里应读 **`p.long_id`**；现在读 `p.id`/`p.sub_id` 恒为 `undefined`，循环永不命中 →
   "换了变体，重登又变回去"。

### 3.6 离线可做性 + 最小实现

**完全可做**（数据都在客户端表里，解锁条件我们自己定）。建议新建 `new/ency.js`（或补进 `rules.js`）：

```js
// 1) 建"名字 → 变体"索引（运行时，别写死公式）
//    flowerpotData.get("plant")[P].name === enc.name + "·" + enc.sub_name
//    → (enc.id, enc.sub_id) 及该变体所有"表里真实存在"的 long_id（pic 1..6）
// 2) 植物百科解锁：花盆里出现过 / 收获过该植株（stage==3 收获是最稳的信号）
//    观测点：furniture_load_furniture 的 plant_list / furniture_flowerpot_harvest 入参(type,index)
S['encyclopedia_load'] = () => ({
  unlock_list: [ ...所有已解锁变体的 long_id，升序 ],
  unlock_desc: [ {id: 主id, list: [1..N]} ...],       // N = Object.keys(desc[主id]).length
  show_sub:    [ {id: 主id, sub_id: 该变体首个 long_id} ...]
});
S['encyclopedia_set_show_sub'] = (p) => { st.showSub[主id] = Number(p.long_id); save(); return {code:0}; };
// 3) 旅行百科解锁：拥有/曾获得过 item_id
S['encytravel_load'] = () => ({ unlock_list:[...], unlock_desc:[...], show_sub:[...] });
```
- 解锁变化后**必须 push** `encyclopedia_load` / `encytravel_load`（`Mock.PUSH_LIST` 里已有这两条）。
- 排序：客户端会 `.sort((a,b)=>a-b)`，服务端给什么序都行。
- `unlock_desc` 建议**只给已解锁的行**；未解锁的客户端自己显示 `·？？？`。
  （`guard.js` 用 `SET.ency`（主 id 101..406）过滤 `unlock_desc`，白名单**对**，但它**不管**
  `unlock_list`/`show_sub` → 需另加校验：`long_id` 必须能在对应表里查到。）
- **兜底**：为了不触发 3.4 的崩溃，`unlock_list` 至少要有 1 条**真实存在**的 long_id。

---

## 4. D 块：故事（Story）

### 4.1 协议与模型

```
@377852 story_load:[[],!0]              @377871 story_send_gift:[["id","gift"],!1]
@377938 story_read_new_story:[[],!1]    @377906 story_feedback_gift:[["id"],!1]
```
`story_load` **客户端不发**（只推）；`story_send_gift` / `story_read_new_story` / `story_feedback_gift` 各 1 处发送。

```js
@189786 var StoryData=function(){function e(){this.id=0,this.partner=0,this.name="",this.gift=-1,this.feedback=-1}…}
@189947 var StoryModel=… initModel: addProtocolCallback("story_load") …
@190256 readNewStory=function(){0!=this.newStoryID&&(this.newStoryID=0,core.SocketManage.getInstance().send("story_read_new_story"))}
@190455 getStoryData=function(e){for(var t=0;t<this.storyList.length;t++)if(this.storyList[t].id==e)return this.storyList[t];return null}
@190754 sendGift=function(e,t){for(var i,n=0;n<this.storyList.length;n++)if(i=this.storyList[n],i.id==e)
          return -1==i.gift&&this.getModel(ItemModel).consumeHouseItem(t,1)?(i.gift=t,
          core.SocketManage.getInstance().send("story_send_gift",null,e,t),!0):!1;return!1}
@191019 story_load=function(e,t){this.storyList=Array.isArray(e.stories)?e.stories:[],this.newStoryID=e.new_story_id||0}
```

**注意 `story_load` 不会用 `new StoryData()` 包一层**，直接吃原始 JSON —— 所以
`StoryData` 里的默认值（`gift=-1`、`feedback=-1`）**运行时完全不生效**，
**服务端必须显式给 `gift:-1`**。

### 4.2 每项字段（服务端必须给的）

| 字段 | 类型 | 谁读 | 缺失后果 |
|---|---|---|---|
| `id` | number | `getStoryData`、`StoryDB.getStory(id)` | 🔴 不在 `story_json.story[].storyid`(1..25) → `getStoryInfo` 返回 **null** |
| `partner` | number | `RelationshipView`（羁绊图分组 + 等级） | 分组键变 `undefined`，所有故事并成 1 条 |
| `name` | string | `StoryItem.setInfo` 的 `t_name.text` | 显示 `undefined` |
| `gift` | **必须是 -1 或已送出的 item id** | `-1 == t.gift` 决定礼物按钮可点 | 🔴 `gift` 缺失 → `-1 == undefined` 为假 → **按钮显示"已送"且点了没反应** |
| `feedback` | number | 客户端**从不读取**（只在 `StoryData` 里声明） | 无 |
| `unlock`/`cond`/`read` | — | **客户端没有这些字段** | — |

🔴 三处无保护解引用（`n` 来自 `getStoryInfo`，找不到是 `null`）：

```js
@1124630 StoryItem.setInfo: var n=StoryModel.getStoryInfo(t.id); n&&(this.i_icon.source=n.icon+"_png");
                            this.t_title.text=n.name, this.t_describe.text=n.desc, this.t_name.text=t.name   // 🔴 n 为 null 即崩
@1118022 StoryAlertView:    var n=StoryModel.getStoryInfo(e.id); … this.storyImage.source=n.icon+"_png"; this.t_name.text=n.name  // 🔴
@1045527 RelationshipItem:  var e=StoryModel.getStoryInfo(t.id); n.itemImage.source=e.icon+"_png"                                  // 🔴
```
→ **`stories[].id` 必须落在 `tables/story_json.json` 的 25 条里**（`storyid` 1..25，字段 `{storyid,name,desc,icon,type}`）。

### 4.3 "可读"的条件 & "新故事"提示

```js
@1120173 StoryView.renderItem: var t=this.storyModel.getStoryList(); … for(var d=Math.ceil(len/3)*3,g=0;d>g;g++){ … c.setInfo(u,t[g]) }
@1123690 StoryItem.setInfo(e,t){ this.c_view.visible=null!=t; if(t&&this.i_icon){ -1==t.gift?("before_send_present_png"+绑定点击)
                               :("after_send_present_png"+解绑) … } }
@837657 MainInView.checkStory: var e=this.storyModel.getStoryData(this.storyModel.getNewStoryID()),t=GreetCardModel.getNewCard();
                               this.c_newStory.visible=null!=e||null!=t; …
@821570 点击 c_newStory → new StoryAlertView().setInfo(getStoryData(newStoryID), …); storyModel.readNewStory(); …
```
- **"可读" = 出现在 `story_load.stories` 里**。补位槽 `setInfo(u, undefined)` → `c_view.visible=false`（空卡）。
  客户端**没有任何二次判定**：没有 `unlock`/`cond`/`read` 字段，没有行李条件，没有进度门槛。
- **"新故事"提示** 只由 `new_story_id` 驱动：`getStoryData(new_story_id)` 必须**命中** `stories` 里某一项，
  否则 `c_newStory.visible=false`（永远不提示）。点开后客户端本地 `newStoryID=0` 并发 `story_read_new_story`，
  **服务端必须把 `new_story_id` 清 0 且在后续 `story_load` 里保持 0**，否则每次进游戏都提示同一个故事。
- 羁绊图（`RelationshipView @1044300`）**按 `partner` 去重**：
```js
for(var r=i.length-1;r>=0;r--) e=i[r], n[e.partner]?(n[e.partner]++,i.splice(r,1)):n[e.partner]=1;
```
  → 同一 `partner` 的多个故事只显示**数组里最后那一条**，`count` 决定 `countLevel2/3.visible`（>=2 / >=3）。

### 4.4 "寄出礼物"之后服务端该做什么（邮件 evt 6 = StoryGift ✔）

发送链：故事卡右下的礼物按钮 → `PlayerBag(Specialty)` 选一个特产 →
`StoryModel.sendGift(id, item)`（要求 `gift==-1` 且 `consumeHouseItem(item,1)` 为真）→
本地 `i.gift=item` → `send("story_send_gift", {id, gift})`。

服务端应做：
1. **记账送礼**：`stories[i].gift = gift`（否则下次 `story_load` 又变回 -1，图标回滚）；
   扣掉那件特产（客户端 `consumeHouseItem` 只改本地缓存，**必须靠 `item_load_items` push 同步**）。
2. **发一封 type=6 的邮件**（这就是"邮件 evt 6 StoryGift"）：

```js
@413412 Mail.EvtId: e[e.System=1],e[e.Gift=3],e[e.Leaflet=5],e[e.StoryGift=6],e[e.Taobao=7],e[e.Drift=8],…,e[e.CardGift=14]
@807610 MailItemView.acceptTouchEvents: if(this.mailInfo.type==Mail.EvtId.StoryGift){
   var i=new ModalConfirm(_("是否感谢他的赠礼？"),function(){
     core.SocketManage.getInstance().send("story_feedback_gift",null,t.mailInfo.id); …})}
@802409 MailItemView.setInfo: case Mail.EvtId.StoryGift: this.i_mailSender.source="mail_friendGiftIcon_png"; break;
```
   邮件字段要求（`revice_mails @203793` 读的，**`t.resource.ads_id` 无保护**）：
   `{id,type:6,sender,title,message,read,opened,expire,auto_open,resource:{clover_point,ticket,ads_id:""},items:[{item_id,count}]}`。
   （`mail_load_mails` 分页约定：`start+count<=total` 时客户端会再发一页；末页时 `mailInfoList.length=e.mails.length`
   → **`total` 必须等于真实条数**，否则翻页错乱。）
3. **玩家点"感谢"** → 客户端发 `story_feedback_gift {id: 邮件id}`（**没有客户端 handler**，纯上行）→
   服务端发回礼（改 `stories[].feedback` 或再发一封普通邮件 + `item_load_items`）。
   ⚠️ `feedback` 字段客户端不读，所以"回礼"只能靠**邮件**送达。

### 4.5 关键反问：故事解锁靠**服务端**还是客户端会二次判定？

**答案：完全靠服务端；客户端没有任何解锁逻辑（"靠行李里的 items 判定"是我们服务端自己的规则，不是客户端要求）。**

反证：
1. `story_load` 只有一行赋值：`this.storyList=Array.isArray(e.stories)?e.stories:[]`（`@191019`）
   —— 没有 filter、没有条件、不与 `ItemModel`/行李/目的地发生任何交互。
2. 全文件 `storyList` 的真实引用只有 6 处（其余是 `MuseumDayHistoryListItem` 之类子串误命中）：
   `@190036/190499/190528/190559/190633/190798/190829/191049`（都在 `StoryModel` 内）+ `StoryView.renderItem`。
3. `getStoryInfo()` 只取 `icon/name/desc`（文案）；`story_json.json` 里**只有** `{storyid,name,desc,icon,type}`，
   **没有** `cond`/`unlock`/`item`/`dest` 之类字段（25 行全查过）。
4. 客户端上行的故事协议只有 3 条：`story_read_new_story`（无参）、`story_send_gift{id,gift}`、`story_feedback_gift{id}`
   —— **没有任何"我带着 X 出门了"的上报**（唯一的行程上报是 `task_client_pro("Map")` 与 `item_set_bag_completed`）。
5. `StoryItem` 只根据 `gift == -1` 决定"能不能送礼"，与"能不能读"无关。

→ 我方实现（`new/story.js` 的"目的地 + 行李条件"）是**离线服自定规则**，与客户端契约不冲突；
   但要注意：**只要 `story_load` 里没给这个 id，客户端就当它不存在**（没有"未解锁"的中间态），
   所以"解锁"只能体现在**推送内容**上；反之，一旦推进 `stories`，客户端立刻把它当已得故事展示并可送礼。

### 4.6 现状差距（`new/story.js` / `handlers_auto.js`）

- 现状 handler（自动探针产物）：`story_load = function(){return {new_story_id:0, stories:[]}}`；
  `Mock.PUSH_LIST` 里也确实推了 `story_load`。
- `S['story_load']`（`new/story.js:125`）：`{stories: st.stories.map(…), new_story_id: st.newStoryId||0}` —— 形状对，
  但**必须逐项确认**：(a) 每项都带 `gift:-1`（首次可送）；(b) `id ∈ 1..25`；(c) `partner` 有值；
  (d) `new_story_id` 必须是 `stories` 里存在的 id。
- `S['story_read_new_story']` 已实现（清 `newStoryId`）✔；`S['story_send_gift']` / `S['story_feedback_gift']` 需确认：
  是否**记下 `gift`**（避免图标回滚）与**是否发了 type=6 邮件**（`new/story.js` 注释里已提到这点）。

---

## 5. 改动清单（按文件）+ 验证方法

| 文件 | 要改什么 | 关键点 |
|---|---|---|
| `new/activities.js` | `task_load` 拆成 `tasks`(task_list 30 键, 带 `pro`/`is_reward`) + `list`(list_map 67 键, 带 `pro`)；新增 `task_load_list` 的 `reward`(节奏 1..6 → 已领档位)；`task_get_reward` 落库 + 推 `clover_update`/`item_load_items` | 页签显隐要求 `list` 含 101/201/301/401/501/601；`tasks` 不含非 task_list 键 |
| `new/guard.js` | `SET.task` 白名单换成 `task_list` 的 30 个键（1..9,101–105,201–205,301–304,401–403,901–904）；**新增** `unlock_list`/`show_sub` 的 long_id 校验 | 不改 guard 会把刚修好的 `tasks` 全过滤掉 |
| 新增 `new/achieve.js`（或并入 `rules.js`） | `client_set_achieve` handler（读 `p.id`）；`roleData().frog.{achieves,cur_achieve,achieves_time}`；判定器 + **push `client_load_role`** | id 必须在 `Achieve_json` 的 101 行里 |
| `new/rules.js`（或新增 `new/ency.js`） | 用真 `long_id` 重写 `encyclopedia_load`/`encytravel_load`/`*_set_show_sub`（参数读 `p.long_id`）；植物按"花盆植株名 ↔ 百科 名·变体名"映射；旅行按 `item_id` 拥有关系 | **空列表会让旅行百科崩**（`updatePicItems` 无保护） |
| `new/calendar.js` / `rules.js` | `calendar_load.task_list` 给非空 `[{id,complete}]`；完成时推 `calendar_task_update` + `calendar_load`；`st_days[].item_id` 用合法 Item id | `task_list:[]` 会 (a) 红点常亮 (b) `task_list[0].complete=` 抛异常 |
| `new/story.js` | 每项补 `gift:-1`、`partner`、`id∈1..25`；`new_story_id` 指向 stories 里存在的项；`story_send_gift` 落库 + 发 type=6 邮件 + 扣物品推 `item_load_items` | `gift` 缺失 → 送礼按钮失效；`id` 越界 → 视图崩 |

**验证方法（不需要真机就能做大部分）**

1. **静态契约自测**：写一个 node/python 脚本，用 `tables/*.json` 断言服务端响应：
   - `task_load.tasks[].id ⊂ task_list` 且含 `pro/is_reward`；`list[].id ⊂ list_map` 且 ⊇ {101,201,301,401,501,601}
   - `task_load_list.reward[].id ∈ {1..6}`、`pro` 为整数
   - `list_type[*].reward ∪ task_list[*].reward_id ⊂ Item.id`（我已验证当前全通过）
   - `encyclopedia.unlock_list[].long_id ∈ encyclopedia.list`；`show_sub[].sub_id` 同理；
     `encytravel.item_id ∈ Item.id`（除 1 行 0）
   - `story.stories[].id ∈ story_json[].storyid`；未送出时 `gift === -1`
   - `calendar.st_days[].item_id ∈ Item.id`；`note_list[i] ∈ calendarData.note`
2. **真机日志**：`logs/game.log` 搜 `SEM-ERR` / `DISPATCH-ERR` / `NO-HANDLER`。
   本报告标 🔴 的几处一旦触发都会留下 `Cannot read properties of undefined (reading 'xxx')`。
3. **UI 观察点**：
   - 任务窗：页签 1..6 是否都在、进度条是否非 0、`pro>=count` 时是否出现"领取"、领完重启后是否仍是已领。
   - 计划页：`（n/count）`、档位小圆点是否随完成数点亮、点奖励是否弹 `ItemRewardView`。
   - 日历：红点是否**仅在**日任务全完成时亮；领节气奖励后格子图标是否消失（这是 `task_list` 是否为空的判定器）。
   - 图鉴：两个入口是否显示、页签是否可点、变体切换后**重启是否保持**（验证 `p.long_id`）。
   - 称号：属性页是否列出已获得 + `??????`；换称号 → 重启 → 是否还在。
   - 故事：小仓库-故事是否出卡片、礼物按钮是否可点、送完是否收到 type=6 邮件、"新故事"按钮是否只提示一次。

---

## 6. 一句话结论

- **A 任务**：进度**只能服务端算**（客户端只有 2 个字符串的上报：`Map`/`NoteFriend`）。
  我们现在的 bug 是"`tasks` 装错表 + 三个进度字段全缺 + `list` 恒 0"，且 `guard.js` 的白名单跟着一起错。
- **A 日历**：`calendar_load.task_list` 给空数组会同时造成"红点常亮"和"领奖回调中断"，必须给非空日任务。
- **A 聚会**：`partycake_load_task` 契约已正确实现（注意稀疏数组与"单推不刷新"，我们已避开）。
- **B 称号**：纯服务端数据 + 客户端只读；离线可做，缺 `client_set_achieve` handler 与判定器。
- **C 图鉴**：`unlock_list`/`show_sub.sub_id` 要的是 `long_id`（不是主 id），我们现在发的是主 id ⇒ 列表恒空；
  旅行百科空列表还会**直接崩**；`set_show_sub` 参数名应是 `long_id`。
- **D 故事**：解锁**完全由服务端决定**，客户端零判定（无 `unlock/cond/read` 字段）；
  `gift` 必须显式为 `-1`；`id` 必须在 `story_json` 的 25 条内；送礼后靠 **type=6 邮件**回礼。
