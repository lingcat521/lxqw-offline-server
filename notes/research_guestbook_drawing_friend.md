# 绘本指南 / 旅友 / 屋内箱子 —— 客户端契约逆向报告

调查对象：`apk/assets/game/js/main.min.js`（1,333,997 B，Egret H5 压缩 JS）
证据格式：`[offset]` = 命中片段在 main.min.js 中的字符绝对偏移；片段已用 `re.sub(r'\s+',' ')` 压平（仅空白被压缩，内容逐字来自原文）。
旁证：`tables/*.json`、`new/*.js`、`save/state.json`、`logs/game.log`（现场实测日志）。

---

## 0. 结论速览

| 症状 | 代码判定 | 一句话 |
|---|---|---|
| 没有绘本（绘本入口不出现） | 需要 `item_load_items.house` 含 **item_id 7001（友情绘本）** | `DrawingModel.isOpen()` 只认仓库里的 7001；放背包不算 |
| 投喂完没有手信 | `guest_serve` **没有任何客户端奖励表现**；"回礼"只能走 **邮件(type=3 Gift)** 或 **事件 16 VisitFriend** | 事件 7(Gift)/6(Guest) 在事件分发器里是**空操作** |
| 蛙蛙手里没东西（手信格空） | 手信格 = `Souvenir.itemGift` ← `DrawingModel.data.bag[0]`；面板只在 `state==accept(2)/lock(3)` 出现 | 服务端只要 `guest_putin_bag -> {code:0}`，格子由**客户端本地**填 |
| 没有绘纸页 | 绘本页 = `DrawingModel.data.pages`，**只能由服务端 push `guest_load_drawing`**；客户端从不发这个协议 | 页 id 必须存在于 `drawingPageData_json.json`，否则**崩** |
| 旅友栏空 | `travel_load_note.note_list` 里必须有 `Note_json.json` 中 **type==2** 的 id（2000-2026） | 现在服务端只发 1000-1029（type 1） |
| 屋内箱子（礼品盒）不可用 | `GiftBoxModel.isOpen()` 要求 note_list 含 `TravelFriends_json.visitOpen`（2000/2001/2002） | 与旅友同源，一个条件解锁两处 |

---

## A. 绘纸 / 绘本 + 投喂邻居

### A.1 协议清单（`protocolList` @375541）

```js
guest_load:[[],!0], guest_confirm:[["id"],!1], guest_serve:[["id","item_id"],!1],
guest_set_expire_time:[["time"],!1], guest_finish:[[],!1],
guest_load_drawing:[[],!0], guest_accept_invit:[["is_accept"],!0],
guest_putin_bag:[["pos","id"],!0], guest_takeout_bag:[["pos"],!0], guest_lock_bag:[[],!0],
travel_load_gift:[[],!0], travel_load_note:[[],!0], item_load_handbook:[[],!0]
```
注意：**没有 `drawing_load` / `drawing_page` / `drawing_lock` 这类协议**。整个"绘纸"系统挂在 `guest_*` 上，绘本数据只有 `guest_load_drawing` 一个入口。

**`guest_load_drawing` 客户端从不发送**（全文 `send("guest_load_drawing")` 0 命中），它是纯服务端 push。实测 `grep 'HANDLE guest_load_drawing' logs/game.log` -> 0 命中。

### A.2 `DrawingModel`（@96183，类结束 @98695）

```js
var DrawingModel=function(e){ ... t.prototype.initModel=function(){                 // @96183
  this.addProtocolCallback("guest_load_drawing","guest_accept_invit","guest_putin_bag","guest_takeout_bag"),
  this.data={state:DrawingState.accept, guest:-1, bag:[], pages:[], colls:[], show_coll:0, pen_motion:"write"}},
t.prototype.guest_load_drawing=function(e){                                         // @97051
  this.data=e,                                   /* 整对象替换！缺键就是 undefined */
  this.data.pages=Utils.convertArray(e.pages),   /* 只有 pages/colls 被兜底成 [] */
  this.data.colls=Utils.convertArray(e.colls);
  this.getModel(UserModel).getClientSettings(); this.dispatchEvent(new core.Event(DrawingEventType.UPDATE))},
t.prototype.lockBag=function(e){ ... send("guest_lock_bag",new core.Action1(function(i){ i&&0==i.code&&(t.data.state=DrawingState.lock, ...) })) },  /* @97900 */
t.prototype.isOpen=function(){ return this.getModel(ItemModel).getHouseItemCount(Tabikaeru.ItemID.DRAWING_BOOK)>0 },  /* @98527 */
t}(core.Model);

/* @417445 */ e[e.DRAWING_BOOK=7001]="DRAWING_BOOK", e[e.WATAR=7002], e[e.FERTILIZER=7003], ...
```

`DrawingState`（@580271）：`{wait:0, invite:1, accept:2, lock:3, visit:4}`

**服务端必须回的 `guest_load_drawing` 字段（7 个，缺一不可）**：

| 字段 | 类型 | 缺了会怎样 |
|---|---|---|
| `state` | 0-4 | `Souvenir.update()` 的 `state==accept\|\|lock` 判定失败 -> 屋内手信面板不出现；`MainOutView.update_invite()` 不显示邀请 |
| `guest` | **0/1/2** | 索引 `["invite_wugui_png","invite_maotouying_png","invite_songshu_png"][guest]`（@1255125）与 `["out_invite_*"][guest]`（@890083）-> 3 及以上取到 `undefined` 图标 |
| `bag` | **数组** | **没有 `Utils.convertArray` 兜底**！`Souvenir.update()` 里 `e.data.bag.length`（@1255151）-> `Cannot read properties of undefined (reading 'length')` |
| `pages` | 数组 | 有兜底；但绘本列表全空 |
| `colls` | 数组 | 有兜底；图鉴"souvenir"页进度全 0 |
| `show_coll` | 数字 | 屋内摆件 / `updateCollects()` 通知不触发 |
| `pen_motion` | 字符串 `"write"` | 书桌动画回退 `\|\|"write"`，安全 |

**`isOpen()` 只认仓库**：`ItemModel.getHouseItemCount`（@136906）读的是 `itemDataAll`，只由 **`item_load_items.house`** 或 **`item_update`** 填充。

**「友情绘本」就是 item 7001，type=7（HandCraftTool），`tables/Item_json.json`**：
```json
{"info":"绘有小伙伴的空画本 似乎藏着什么大惊喜","sub_type":"","name":"友情绘本",
 "img":{"index":"goods_60","src":"Icon/goods"},"price":0,"own_num":1,"spend":0,"type":7,"id":7001}
```
**它同时也是商店商品**：`tables/shopData_json.json` -> `{"id":35,"itemId":7001,"limit":1,"name":"友情绘本","price":1000,...}`
-> 正规获取链：`item_buy(shop_id=35)` -> 进 **背包**（rules.js `st.bag[slot]=iid`）-> 玩家从背包"取出" -> 进 **house** -> `isOpen()` 才为 true。
**只给 bag 不给 house = 绘本入口永远不出现。**

绘本入口按钮（@795949 `Lumberroom.update`）：
```js
this.drawBtn.visible=this.drawBtn.includeInLayout=this.getModel(DrawingModel).isOpen(),
```
`LumberroomViewControl.open()`（@800779）每次都 `this.view.update()` -> 每次打开"物品间"都重算。

### A.3 "手信"到底是什么（三种呈现，逐一定位）

**(1) 准备手信（玩家付出）** — `Souvenir` 组件（@1253520）

```js
t.prototype.update=function(){                                                                   /* @1254852 */
  var e=core.ModelManage.getInstance().getModel(DrawingModel);
  (e.data.state==DrawingState.accept||e.data.state==DrawingState.lock)
     &&(this.itemInvite.source=["invite_wugui_png","invite_maotouying_png","invite_songshu_png"][e.data.guest]);
  for(var t=[],i=0;i<e.data.bag.length;i++) -1==e.data.bag[i]?t.push(null):t.push({item_id:e.data.bag[i],count:1});
  this.itemGift.dataProvider=new eui.ArrayCollection([t[0]]),          /* <- 手信格（永远 1 格） */
  this.listSpecialty.dataProvider=new eui.ArrayCollection(t.slice(1)), /* <- 特产格（背包 1..n） */
  e.data.state==DrawingState.lock?(this.group.filters=Utils.getDisableFilter(),
     this.group.touchEnabled=this.group.touchChildren=!1, this.btnComplete.filters=Utils.getDisableFilter())
   :(this.group.filters=null,this.group.touchEnabled=this.group.touchChildren=!0,this.btnComplete.filters=null); ...}

t.prototype.on_btnComplete_tap=function(){                                                        /* @1256491 */
  var e=core.ModelManage.getInstance().getModel(DrawingModel);
  e.data.state==DrawingState.lock ? e.unlockBag(new core.Action(this.update,this))
    : -1==e.data.bag[0] ? GuideHelpView.getInstance().show(_("快把手信准备好吧"),null,...)
    : e.lockBag(new core.Action(this.update,this)), this.eventComplete.dispatch()}
```
外观（`SouvenirSkin.exml`，default.thm.js）：`itemInvite` 是邻居邀请卡 x=43,y=48；`itemGift` 是 100x100 的**手信格** x=263,y=48；`listSpecialty` 是横向列表 x=34,y=227,w=338。
-> 用户说的"蛙蛙手里也没东西"就是 **`itemGift` 那一格空**，即 `bag[0]` 未设置。

**(2) 手信填写：客户端本地写，服务端只需 `{code:0}`**

```js
t.prototype.changeItem=function(e,t,i){ var n=this; e>=0&&(                                             /* @97300 */
  this.data.bag[e]==t&&(t=-1),
  -1!=this.data.bag[e]&&send("guest_takeout_bag",new core.Action1(function(r){ 0==r.code
      &&(n.getModel(ItemModel).addHouseItem(n.data.bag[e],1), n.data.bag[e]=t, ..., i&&i.apply()) }), e+1),
  -1!=t&&send("guest_putin_bag",new core.Action1(function(r){ 0==r.code
      &&(n.data.bag[e]=t, n.getModel(ItemModel).consumeHouseItem(t,1), ..., i&&i.apply()) }), e+1, t))}
```
`bag` 是**客户端自己的 data**；回调 `i.apply()` = `new core.Action(this.update,this)` -> 重画 `Souvenir`。
所以服务端 `guest_putin_bag(pos,id)` 返回 `{code:0}` 格子就会亮；返回其他 code 则**什么都不会发生**。

`pos` 语义：客户端发 `e+1`（e 是槽下标，0=手信），服务端要 `pos-1`。当前 `new/drawing.js` 用 `BAG_SLOTS=4`（1 手信 + 3 特产）。

手信候选物品：`drawingCommonData_json.json` -> `{"food":{"id":"food","value1":[0],"value2":["0,16"],"value3":["1,15"],"value4":["2,33"]}}`，
`openPlayerBagForSouvenirGift`（@428169）取的是**逗号后面那个数**：
```js
var e=DataManager.instance().DrawingCommon.get("food"),
    t=[e.value2[0],e.value3[0],e.value4[0]].map(function(e){return Number(e.split(",")[1])}),   /* -> [16,15,33] */
    r=t.map(function(e){var t=i.get(e); return t.stock=n.getHouseItemCount(e), t}); return r
```
-> **手信格的可选清单 = item 16 / 15 / 33**（彩椒烙蛋饼 / 桂花蒸米糕 / 水果沙拉，都是 type 0）。特产格走 `getPlayerBagItems(ItemType.Specialty)`（type=3）。

**(3) 手信/回礼的"结果"表现 —— 只有三种**

| 载体 | 触发 | 证据 |
|---|---|---|
| `PartyResultView`（聚会结果弹窗） | 旅行事件 `evt_type=24 PartyResult` | @585991 / dataChanged @586497 |
| `VisitReturnGiftView`（旅友回礼） | 旅行事件 `evt_type=16 VisitFriend` | @921673 |
| 邮件（邻居来信） | `mail type=3 (Mail.EvtId.Gift)`，`sender=0/1/2` | @803139 / @413267 |

```js
/* PartyResultView.dataChanged @586497 */
t.prototype.dataChanged=function(){ e.prototype.dataChanged.call(this),
  this.data.page?(this.imgGift.visible=!0, this.imgGift.source=["gift_from_wugui_png","gift_from_maotouying_png","gift_from_songshu_png"][this.data.guest])
                :this.imgGift.visible=!1,
  this.data.coll? (t=DrawingCollect.get(this.data.coll)) ? (this.imgColl.visible=!0,this.imgColl.source=formatPathImage(t.show)) : this.imgColl.visible=!1
                : this.imgColl.visible=!1;
  this.data.guest>=0&&(this.imgGuest.source=["neighbor_back_wugui_png","neighbor_back_maotouying_png","neighbor_back_songshu_png"][this.data.guest]);
  var i=[]; this.data.clover>=0&&i.push({item_id:1e5,count:this.data.clover,type:DropType.RESOURCE}),
            this.data.ticket>=0&&i.push({item_id:100001,count:this.data.ticket,type:DropType.RESOURCE});
  for(var n=this.data.items, ...) i.push({item_id:a,count:1});
  i.length<4&&(i.length=4), this.listItem.dataProvider=new eui.ArrayCollection(i)}

/* PartyResultView.on_btnConfirm_tap @587653  -> 绘纸 -> 绘本 */
t.prototype.on_btnConfirm_tap=function(){ var e=this;
  this.data.page>0&&Result.customEvent.push(function(t){
    core.PageManage.getInstance().addViewControl(DrawNewPaperViewControl,WindowLayer,null,
      {guest:e.data.guest, callback:function(){ t(), core.PageManage.getInstance().addViewControl(DrawViewControl,WindowLayer,HideBefore) }})}),
  this.data&&this.data.onClose(), this.close()}
```
`Result.customEvent` 就是事件分发器里的 `e.customEvent`（@901667 `var D=function(t){var i=e.customEvent.shift(); i?i(D):...}`）-> 弹窗关闭后自动"新绘纸"-> 打开绘本。**整条"喂食->拿到绘纸->绘本里出现一页"的最短路径就是这一个事件。**

**事件分发器**（@902100 起，`TimerEvent` @416406）：
```js
case TimerEvent.Type.Picture: case TimerEvent.Type.Gift: case TimerEvent.Type.Guest: p(); break;   /* @905883-905938 */
case TimerEvent.Type.Visitor: ... var K=_("{0}在庭院里小憩了一会",g.evt_string[0]), $=new r; $.notify(...); break;   /* @903496 */
case TimerEvent.Type.VisitFriend:                                                                  /* @907557 */
  var Ct=g.evt_value[0], Mt=Utils.convertArray(g.evt_value).slice(1), Et=g.evt_pic;
  var bt=new VisitReturnGiftView; bt.data={friendId:Ct,rewardArr:Mt,pictures:Et,onConfirm:...}; c.addChild(bt); break;
case TimerEvent.Type.PartyGo:  ... notify(_("{0}出去聚会了"))                                       /* @908291 */
case TimerEvent.Type.PartyResult:                                                                  /* @908482 */
  var e=g.evt_id, t=Utils.convertArray(g.evt_value);
  addViewControl(PartyResultViewControl,NoticeLayer,Retain,
    {guest:e, page:t[0], coll:t[1], clover:t[2], ticket:t[3], items:t.splice(4), onClose:function(){ v.AddCloverTween(t[2]), p() }}); break;
```
`TimerEvent.Type`（@416406）：`Gift=7, Guest=6, Visitor=11, NewNote=15, VisitFriend=16, PartyGo=23, PartyResult=24`。

> **结论：事件 7（Gift）是空操作，推了没有任何表现。事件 11（Visitor）只弹一句"在庭院里小憩了一会"。**

**邮件契约**（`Mail.EvtId` @413267：`NONE=0, System=1, Gift=3, Leaflet=5, StoryGift=6, Taobao=7, Drift=8, Captcha=9, ShareURL=10, NewPicture=11, Explor=12, SpecPicture=13, CardGift=14, Notice=15`）：
```js
case Mail.EvtId.Gift: switch(t.sender){ case 0:this.i_mailSender.source="mail_wugui_png";break;
  case 1:...="mail_maotouying_png";break; case 2:...="mail_songshu_png";break; default:this.i_mailSender.visible=!1 }   /* @803139 */
```
`tables/MailEvent_json.json` 的两条就是 Gift 邮件模板：`{CloverPoint,id,itemId,itemStock,mailEvt:3,senderCharaId,ticket,title,message}`。
-> **"邻居回礼"最省事的做法：`MOCK_ADD_MAIL({type:3, sender:<0|1|2>, title:"困困的来信", items:[{item_id,count}], resource:{clover_point,ticket,reward_gacha,ads_id:"",share_id:""}})`**。

### A.4 `MainOutView.update_invite()` 与首个邀请（@890018）

```js
t.prototype.update_invite=function(){
  this.getModel(DrawingModel).data.state==DrawingState.invite
    ?(this.inviteBtn.icon=["out_invite_wugui_png","out_invite_maotouying_png","out_invite_songshu_png"][this.getModel(DrawingModel).data.guest],
      this.inviteBtn.visible=!0,this.inviteBtnMask.visible=!0)
    :(this.inviteBtn.visible=!1,this.inviteBtnMask.visible=!1), this.checkDrawingGuide()}
```
`DrawingEventType.UPDATE` 只被 MainOutController 消费（@850200 `case DrawingEventType.UPDATE:this.view.update_invite();break;`）。
**MainInController 不监听 `DrawingEventType.UPDATE`**（@816494 只监听 `ItemEventType.updateDesk/updateBag/DrawingEventType.ITEM_CHANGE`）-> 服务端推 `guest_load_drawing` 时**屋内不会立刻重建手信面板**；面板要等 `updateBagState()`（@831184，由 updateDesk/updateBag/ITEM_CHANGE 触发）或场景重建。

`checkDrawingGuide`（@893017）：
```js
if(this.getModel(DrawingModel).data.state==DrawingState.invite){
  var t=this.userModel.getClientSettings();
  if(t.guideStep==GuideStep.Complete)
    if(t.guideDrawing>1==0){                       /* guideDrawing <= 1 -> 首次引导 */
      this.disabledOrEnableUI(!1), this.c_friend&&(this.c_friend.visible=!1);
      var i=new GuideDrawView(function(t){ ... setClientSettings("guideDrawing",1), t&&addViewControl(InviteViewControl,...,{guest:...drawing.guest, callback:...}) }); this.c_guide.addChild(i)}
    else 2==t.guideDrawing&&(this.disabledOrEnableUI(!1,!0,this.houseBtn), GuideFingerView.getInstance().show(this.houseBtn,FingerOrientation.Right,!0))}
```
-> 邀请按钮在**屋外**；`InviteView` 确认后客户端自己 `request_accept_invit()` 并发 `guest_accept_invit(is_accept=true)`，同时弹 **"请到小屋内准备手信吧"**（@585132）。

### A.5 「绘纸/绘本」界面需要什么（`DrawView` @581258）

```js
t.prototype.onShow=function(){ var e=this.getModel(DrawingModel).data.pages;                       /* @582260 */
  this.tips.visible=e.length<=0, this.groupTitle.visible=!this.tips.visible, this.guest_pages=[[],[],[]];
  for(var t=0,i=e;t<i.length;t++){ var n=i[t], r=Tabikaeru.DataManager.instance().DrawingPage.get(n);   /* ★ 无 !r 保护 */
    null==this.guest_pages[r.guest]&&(this.guest_pages[r.guest]=[]), this.guest_pages[r.guest].unshift(n) }
  for(var o=0,a=0;2>=a;a++) this.btn_list[a].visible=!1, this.guest_pages[a].length>0&&(...visible=!0...)}   /* 只有 3 本书(0/1/2) */

t.prototype.on_btnBook_tap=function(e){ ... this.list.dataProvider=new eui.ArrayCollection(this.guest_pages[this.cur_index]), ... }  /* @582900 */
t.prototype.updatePages=function(){ ... this.currentPage.text=this.scroller.selectedIndex+1+"", this.maxPage.text=this.guest_pages[this.cur_index].length+"" }

var DrawListItem=function(e){ ... t.prototype.dataChanged=function(){ ... var t=DataManager.instance().DrawingPage.get(this.data);
  t&&(this.img.source=Tabikaeru.path.formatPathImage(t.pic)) } }                                   /* @583691（有 t&& 保护） */
```
**渲染陷阱（历史 bug "reading 'guest'" 的同类）**：`pages` 里的每个 id **必须**存在于 `tables/drawingPageData_json.json`（id 1-7 / 101-107 / 201-207，guest 0/1/2），否则 `r` 为 `undefined` -> `r.guest` 抛 TypeError，**整个绘本窗口崩**。
`harden.js` 的 `DEFAULTS` **不含 DrawingPage / DrawingCollect**，所以没有任何兜底。

`DrawingPage` 表还决定按钮/book 归属：
```
guest 0 -> [1,2,3,4,5,6,7]   guest 1 -> [101..107]   guest 2 -> [201..207]
```
`DrawingCollect`（@549505 / @550550 / @586729 使用）的 id 是 `1,2,3,4,5, 101..105, 201..204, 301..308`，其中 `guest:-1` 的 301-308 是"无主收藏"；`scene`/`position` 非空（能在屋里摆出来）的只有 **1 和 201**。

### A.6 「从投喂到绘本出现一页」完整时序（服务端要做的每一步）

| # | 触发 | 服务端动作 | 关键点 |
|---|---|---|---|
| 0 | 开机/常驻 | `item_load_items` 的 `house` 里含 `{item_id:7001,count:1}` | 否则 `drawBtn` 永远隐藏 |
| 1 | 服务端定时 | push `guest_load_drawing` = `{state:1(invite), guest:0\|1\|2, bag:[], pages:[...已有], colls:[...已有], show_coll:-1, pen_motion:"write"}` | 屋外出现邀请卡 |
| 2 | 玩家点邀请卡 -> `InviteView` 确认 | 客户端发 `guest_accept_invit(is_accept=true)`；服务端回 `{code:0}` **并 push** `state:2(accept)` | 客户端自己把本地 state 改 2 |
| 3 | 玩家进小屋 -> 打开背包 | 客户端在此刻才 `updateBagState()`；服务端 push 一次 `guest_load_drawing(state=2)` 更稳 | 出现手信面板 |
| 4 | 选手信/特产 | `guest_putin_bag{pos:1..4,id}` -> 回 `{code:0}`；`guest_takeout_bag{pos}` -> `{code:0}` | 只需 code 0 |
| 5 | 点"完成" | `guest_lock_bag{}` -> `{code:0}`；服务端置 `state=lock` 并 push | 客户端自己也会置 lock |
| 6 | 到点/立即 | push `notify_new_event` = `{event:{id, evt_type:23(PartyGo), evt_value:[0], evt_id:0, evt_string:[], evt_pic:[]}}` | 弹"出去了" |
| 7 | 归来 | push `notify_new_event` = `{event:{id, evt_type:24(PartyResult), **evt_id: guest**, **evt_value:[page, coll, clover, ticket, ...itemIds]**, evt_string:[], evt_pic:[]}}` | `page` 属于 DrawingPage 表，`coll` 属于 DrawingCollect 表 |
| 8 | 玩家点确认 | 客户端自己串：`DrawNewPaperView` -> `DrawViewControl` | 无需服务端参与 |
| 9 | 可选 | `item_load_handbook` 的 `collections` 加上 `coll`；`show_coll` 设为该 `coll` | 图鉴 +1、屋内摆件、`"屋内似乎多了些东西"` 通知 |

`updateCollects()`（@823427，MainOut）：
```js
var e=this.getModel(DrawingModel).data.show_coll, t=...getClientSettings();
0==...show_coll ? setClientSettings("noticeDrawing",-1)
  : 0!=t.noticeDrawing && t.noticeDrawing!=...show_coll && setClientSettings("noticeDrawing",0);
0==t.noticeDrawing && (setClientSettings("noticeDrawing",e), Music.play("SE_Popup"),
  var i=_("屋内似乎多了些东西"), n=new Result.MainOutNotification; n.notify(...))
```
`MainInView.updateDrawingCollect()`（@842669）：
```js
var e=...data.show_coll, t="DrawingCollect", i=this.groupScene.getChildByName(t); i&&i.parent.removeChild(i);
if(e>=0){ var n=DataManager.instance().DrawingCollect.get(e); if(n){ ... r.source=formatPathImage(n.scene);
  var o=n.position.split(",").map(Number); r.horizontalCenter=o[0], r.verticalCenter=o[1], r.zIndex=o[2]; ... } }}
```
-> `show_coll` 建议给 **1 或 201**（只有它们有 `scene`）；给 -1/0 则不摆（`get(0)` 为 undefined，有 `if(n)` 保护）。

### A.7 投喂邻居（`guest_serve`）—— 为什么"没有手信"

```js
/* GuestData @191192 —— guest_load 的全部字段 */
var GuestData=function(){ function e(e){
  if(this.id=-1,this.confirmed=!1,this.served=!1,this.expire_time=0,this.pos=0,e)
    for(var t=0,i=Object.keys(e);t<i.length;t++){ var n=i[t];
      null!=this[n]?this[n]=e[n]:(BaseChannel.getInstance().jf_commit(!0,"js.error",{reason:"warning",
        message:core.String.format("GuestData 数据合并错误，{0} 属性不存在",n)}), core.Log.warning(...)) }}
  return e}();
/* -> 只有 5 个键：id / confirmed / served / expire_time / pos。没有"礼物/回礼"字段。
      多传一个键就会被客户端上报 js.error。 */

/* TravelModel @192719 */
t.prototype.sendGuestServed=function(e){ this.guestData&&!this.guestData.served
  &&this.getModel(ItemModel).consumeHouseItem(e,1)
  &&(this.guestData.served=!0, core.SocketManage.getInstance().send("guest_serve",null,this.guestData.id,e))}   /* @194438 */
/* MainInView.friendClick @886345 -> friendFeedBack @887363：喂完只弹"口味反应"弹窗，没有任何奖励 UI */
```
**结论**：投喂邻居后客户端**不期待**任何回礼数据。要出现"手信/回礼"必须由服务端另开一条通道：
`Mail(type=3 Gift)` 或 `notify_new_event(evt_type=16 VisitFriend)` 或 `notify_new_event(evt_type=24 PartyResult)`。
`guest_load` 里塞任何额外字段 -> 触发 `GuestData 数据合并错误` 上报（且被忽略）。

### A.8 我们现在实现的差距

`new/guestfeed.js`（**确实被加载**：`new/mock.js:427` 的 `extra` 数组末尾含 `"guestfeed.js"`；`build/mock.bundle.js` 是过期产物，不含它）：
- 五个字段严格对齐；`guest_load` push 正确。
- **回礼只给"数字"**：`clover_update` + `item_update_ticket` + 25% 一件特产进 `st.house`。没有邮件、没有事件 -> 玩家看不到"手信"。
  ```js
  var gift=0; if(Math.random()<0.25){ gift=3000+Math.floor(Math.random()*22); houseAdd(gift,1); push('item_load_items'); }
  ```
  建议追加：`window.MOCK_ADD_MAIL({title:"<邻居名>的来信", type:3, sender:g.id, items:[{item_id:gift,count:1}], resource:{clover_point:clover,ticket:ticket,reward_gacha:0,ads_id:"",share_id:""}})`。
- `S['guest_serve']` 与 `new/drawing.js` 重复定义；按 `extra` 顺序 **guestfeed.js 后加载 -> 它赢**（drawing.js 的版本是死代码）。改协议时别改错文件。

`new/drawing.js`：
- 认识 `DRAWING_BOOK=7001` 并 `unlock()` 写进 `st.house`（实测 `save/state.json` -> `house` 里确有 `{"item_id":7001,"count":20}`）。
- `data()` 返回全部 7 个键。
- **`guests()` 返回 `[0,1,2,3]`** —— `drawingPageData` / `Souvenir` / `out_invite_*` 的图片数组都只有 3 项（下标 0/1/2）。索引 3 会得到 `undefined` 图标（`DrawView.btn_list` 更只有 0..2）。**必须改成 `[0,1,2]`**。
- **`grantDrawings()` 把家具图纸 id（10301-10327）写进 `x.colls`** —— 实测 `save/state.json`：`"colls":[10301,...,10327]`。`colls` 的语义是 **`drawingCollectData` 的 id**（1-5,101-105,201-204,301-308），103xx 全部非法，会被 `guard.js` 的 `has("coll", c)` 过滤掉 -> 图鉴"souvenir"页永远 0，且 `pages` 也永远空。**这是"没有绘本内容"的直接原因之一。**
- **从不产生 `PartyResult` 事件**：`tick()` 只是把 `state` 复位成 `wait` 并本地 push 页/收藏。客户端因此**永远不会**弹 `PartyResultView`、不会打开 `DrawView`。应改为：
  ```js
  window.MOCK_EVENT(24, [page, coll, clover, ticket].concat(itemIds))   /* 还需要 evt_id = guest */
  ```
  注意 `new/travel2.js` 的 `addEvent(type,value)` 现在固定 `evt_id:0` —— `PartyResult` 用 `g.evt_id` 当 `guest`，所以 `addEvent` 需要支持第三个参数（evt_id），否则 `guest` 恒为 0（还能跑，但图会错）。
- **从不产生 `PartyGo` 事件**（23），也没有"完成"提示。
- 只有 `guest_lock_bag` 会推进到产出；而玩家**必须先接受邀请**才有 `state=accept`。实测 `logs/game.log` 中 `guest_accept_invit` / `guest_lock_bag` / `guest_putin_bag` 的 **HANDLE 记录 0 条**；`save/state.json` 里 `"drawing":{"state":1,...}` 长期卡在 invite。
  -> 建议：邀请 push 后若玩家 X 秒未响应，服务端自动 `state=accept`（离线体验更稳），或给一个 GM 按钮直接触发。

---

## B. 旅行笔记 / 旅友 / 友情绘本

### B.1 `travel_load_note` 契约（`TravelNoteModel` @207913）

```js
t.prototype.initModel=function(){ this.addProtocolCallback("travel_load_note") },                       /* @207913 */
t.prototype.loadNote=function(e){ send("travel_load_note", new core.Action2(function(t){e&&e()})) },    /* @208287（客户端会发） */
t.prototype.getNoteList=function(){ return this.travelNodeList },
t.prototype.getNoteListByType=function(e){ return this.travelNodeList.filter(function(t){return t.config.type==e}) },   /* @208426 */
t.prototype.getNoteMaxByType=function(e){ if(this.noteCountMax[e])return this.noteCountMax[e];
  for(var t=DataManager.instance().TravelNoteDB.list(),i=0,n=0,r=t;n<r.length;n++){var o=r[n]; o.type==e&&i++} return this.noteCountMax[e]=i,i },  /* @208541 */
t.prototype.getNoteNumsByType=function(e){ for(var t=0,i=0,n=this.travelNodeList;i<n.length;i++){var r=n[i]; r.config.type==e&&t++} return t },
t.prototype.getAttachNote=function(e){ for(...) if(n.config.attach==e) return n },                     /* 找 attach == 母笔记 id 的那条 */
t.prototype.isOpen=function(){ for(var e=0,t=this.travelNodeList;e<t.length;e++){var i=t[e]; if(!i.config.attach) return !0} return !1 },  /* @209873 */
t.prototype.travel_load_note=function(e,t){ var i=[];                                                  /* @210003 */
  if(Array.isArray(e.note_list)) for(var n=DataManager.instance().TravelNoteDB, r=0,o=e.note_list;r<o.length;r++){
    var a=o[r], s=n.get(a.id);
    if(s){ var c=new TravelNoteData; c.id=a.id, c.read=a.read, c.timestamp=a.timestamp, c.config=n.get(a.id), i.push(c) }}
  this.travelNodeList=i, this.updateRedot() }
```
**`note_list` 每项只读三个字段：`id`、`read`、`timestamp`（秒）。**
- `id` 必须能在 `tables/Note_json.json` 里查到，否则会被 `if(s)` 丢掉 —— 但注意 `harden.js` 把 `TravelNoteDB` 也做了兜底，`get()` 会返回 `{id:0,info:"",quality:1,type:0,...,__missing:1}`（**truthy**），于是非法 id 会被保留但 `type=0`，**两个 tab 都不显示**（不是崩溃，是"隐身"）。
- `timestamp` **单位是秒**：`TravelNoteItem.update`（@1155421）`core.DateFormat.format(1e3*e.timestamp, ...)`。
- 产生这些条目的地方：`TravelNoteModel.loadNote` 被 `TravelNoteController.open()` 调用（@1154225）。

### B.2 「旅友」这一栏为什么不解锁（`TravelNoteView` @1157331）

```js
t.prototype.onSelectGroupChange=function(){ this.currentType=0==this.selectGroup.selectedIndex?1:2;    /* @1158137 */
  this.scroller.viewport.scrollV=0, this.scroller.stopAnimation(), this.updateList() },
t.prototype.updateCount=function(){                                                                    /* @1158701 */
  var e=this.travelNoteModel.getNoteMaxByType(1), t=this.travelNoteModel.getNoteMaxByType(2),
      i=this.travelNoteModel.getNoteNumsByType(1), n=this.travelNoteModel.getNoteNumsByType(2);
  this.type1Btn.t_cur.text=String(i), this.type1Btn.t_max.text=String(e),
  this.type2Btn.t_cur.text=String(n), this.type2Btn.t_max.text=String(t) },
t.prototype.updateList=function(){ var e=this, t=this.travelNoteModel.getNoteListByType(this.currentType), ...   /* @1159119 */
  n.sort(function(e,t){return t.data.timestamp-e.data.timestamp}),
  this.l_note.dataProvider=new eui.ArrayCollection(n) },
t.prototype.switchType=function(e){ this.selectGroup.selectedIndex=e, this.disabledRedot[e]=!0, this.updateRedot() }
```
`TravelNote.exml`（default.thm.js @1363xxx）：`type1Btn`(x=0) 与 `type2Btn`(x=287) 都是 `enabled=true`，**永远可点**。
-> **"旅友不解锁" = type2 列表为空**（`n/27` 的 `n` 恒为 0），因为服务端 `note_list` 里从来没有 `type==2` 的 id。

`tables/Note_json.json`（191 条）id 分段：

| id 段 | 条数 | 结构 |
|---|---|---|
| 1000-1136 | 137 | `type:1`，`factorType:"Drop"`，有 `img/info/quality`，**无 `attach`** |
| 2000-2026 | 27 | `type:2`，`factorType:"Drop"`, `factorType2:"Friends"`, `factorData2: 0/1/2`（旅友下标） |
| 20000-20260 | 27 | **附件笔记**：`attach: 2000..2026`，`factorType:"Own_Note"`, `factorType2:"Visit_Min"` |

-> **"旅友栏解锁" = `note_list` 里出现 id 属于 [2000..2026]。**
（顺带：`isOpen()` 要求至少一条 `config.attach` 为假的笔记；type1/type2 都满足，附件笔记不满足 —— 所以 `travelNoteBtn` 一直可见是正常的。）

每行渲染（`TravelNoteItem.update` @1155421 / `updateAttach` @1156097）：
```js
t.prototype.update=function(){ if(this.data){ ... var e=this.data.data;
  this.i_redot.visible=!e.read,
  this.t_date.text=core.DateFormat.format(1e3*e.timestamp,core.DateFormater["YYYY.MM.DD"]);
  var t=e.config;
  if(t){ this.c_bg.currentState=1==t.quality?"quality1":"quality2",
    this.i_photo.source=Tabikaeru.path.formatPathImage(t.img);
    var i=this.getModel(TravelNoteModel).getAttachNote(t.id);
    i?(this.data.onShow&&this.data.onShow(i), 0==i.read&&(this.i_redot.visible=!0), this.updateAttach(i))
     :this.updateAttach(),
    this.c_text.setSourceFlow(TravelNoteUtils.convertContent2Sources(t.info)) } else this.i_photo.source="" }
t.prototype.updateAttach=function(e){ if(e){ this.i_attachIcon.source=formatPathImage(e.config.img);
  var t=TravelNoteUtils.convertContent2Sources(e.config.info); this.c_attachText.setSourceFlow(t); this.currentState="hasAttach" }
  else this.currentState="default" }
```
`TravelNoteUtils.convertContent2Sources`（@1157331 前）按 `\n` -> `,` 切 `info`，逐字查 `TravelNoteWordDB.get(parseInt(word))`，`u && s.push({source:formatPathImage(u.img), width:1==u.type?40:20})` —— **有 `u&&` 保护，词表缺 id 不会崩**（只是少个字）。

### B.3 `item_load_handbook` 契约（"收集进度 +1"）

客户端**从不发**这个协议（`send("item_load_handbook")` 0 命中），纯 push。

```js
/* ItemModel @134242 */
t.prototype.item_load_handbook=function(e,t){                                                          /* @145260 */
  this.collectionsList=Array.isArray(e.collections)?e.collections:[],
  this.specialtysList=Array.isArray(e.specialtys)?e.specialtys:[],
  this.dispatchEvent(new core.Event(ItemEventType.updateHandbookList)) },
t.prototype.getCollectionsList=function(){ return this.collectionsList },
t.prototype.getSpecialtysList=function(){ return this.specialtysList },

/* Tabikaeru.Game 的派生列表（@440900 起） */
Object.defineProperty(t.prototype,"collectionList",{get:function(){
  for(var t,i=DataManager.instance(),n=this.itemModel.getCollectionsList(),r=[],o=0;o<i.CollectDB.count();o++)
    t=i.CollectDB.index(o), n.indexOf(t.id)>=0 ? r.push({cfg:t,count:1}) : r.push({cfg:t,count:0});
  return r.sort(function(e,t){return t.cfg.type-e.cfg.type||e.cfg.id-t.cfg.id}),r}}),
Object.defineProperty(t.prototype,"specialtyList",{get:function(){
  for(var t,i=DataManager.instance(),n=this.itemModel.getSpecialtysList(),r=[],o=0;o<i.SpecialtyDB.count();o++)
    t=i.SpecialtyDB.index(o), n.indexOf(t.itemId)>=0 ? r.push(t) : r.push(-1);
  return r}}),
```
`tables/Collection_json.json` = **数组**（62 条，`id` 0..61）；`tables/Specialty_json.json` = 数组（64 条，`itemId` 3000..4xxx）。

> **"收集进度 +1"的精确含义**：
> - `collections` = **Collection 行的 `id`（0..61）** -> 命中即 `count=1`（图鉴"典藏/纪念品"格点亮）。
> - `specialtys` = **Specialty 行的 `itemId`（即对应 Item 的 id，type 必须是 3）** -> 命中即该格显示实物。
> 两者都用 `indexOf` 线性查数组，**ids 必须存在于客户端表里**，否则那格永远亮不了。

还有一个**客户端本地 +1** 的路径（不需要服务端）：
```js
t.prototype.doAddHouseItem=function(e,t,i){ ... if(n.type==Tabikaeru.DataType.ItemType.Specialty && -1==this.specialtysList.indexOf(n.id)
  &&(this.specialtysList.push(n.id), this.dispatchEvent(new core.Event(ItemEventType.updateHandbookList))) ... }   /* @138516 */
```
`ItemType`（@409011）：`NONE=-1, LunchBox=0, Amulet=1, Tools=2, **Specialty=3**, Gift=5, **HandCraftTool=7**, HandCraftStuff=8, Other=9, FURNITURE_RESOURCE=10, FURNITURE_ITEM=11, FURNITURE_TOOL=12, FURNITURE_PAPER=13, RESOURCE=14, Courtyard=15, COMPOSE=16`。

**重要**：`ItemModel.prototype.addHouseItem=function(e,t,i){void 0===i&&(i=!0)}` 是**空函数**（@138445）。
真正写模型的是 `doAddHouseItem`（@138516），全文只有两个调用点：`item_load_items`（@144762）和 `item_update`（@142947）。
-> **规律：客户端物品模型是"服务端权威"。任何发奖之后都必须补一次 `item_load_items`（或 `item_update`）push，否则玩家看不到。**

### B.4 「友情绘本」= item 7001（type 7），不是图鉴里的收藏

- `友情绘本` 在 `Item_json.json` 里是 `{id:7001, type:7 (HandCraftTool), own_num:1, spend:0, price:0}`。
- 它**不属于** `collections`（CollectDB）也**不属于** `specialtys`（SpecialtyDB）—— 所以它**不会**让图鉴收集进度 +1。
- 它的唯一作用是 **`DrawingModel.isOpen()` 的开关**（见 A.2），顺带解锁图鉴的第 4 个 tab：
  ```js
  this.souvenir.visible=this.souvenir.includeInLayout=this.getModel(DrawingModel).isOpen(),   /* @548828 */
  ```
  该 tab 的内容来自 `DrawingCollect.list()` 与 `DrawingModel.data.colls`：
  ```js
  case"souvenir": var n=DataManager.instance().DrawingCollect.list(), r=this.getModel(DrawingModel).data.colls,
    o=n.map(function(e){ var t=Utils.createObejctBy(e); return -1!=r.indexOf(e.id)?t.count=1:t.count=0, t });
    this.renderItem(o), i=this.souvenir     /* @549505 */
  ```
  （`Utils.createObejctBy = function(e){var t={}; return t.__proto__=e, t}` @300657 —— 原型继承，`"guest" in e` 为 true -> `isDrawingCollect` 判定 @551692 `return "guest" in e`。）
- **`collections` != `colls`**：前者是图鉴 Collection 表 id（0..61），后者是 `DrawingModel.data.colls` = `drawingCollectData` id（1..5,101..105,201..204,301..308）。**千万别混用**。

### B.5 客户端什么时候重新拉手册

- `item_load_handbook` **从不主动请求**。
- 服务端 push `item_load_handbook` -> `ItemEventType.updateHandbookList` -> `CollectionController`（@546023）：
  ```js
  t.prototype.totalCustomEvents=function(e){ switch(e.getEventType()){ case ItemEventType.updateHandbookList: this.view&&this.view.switchType(this.view.getCurrentSelectType()) } }
  ```
  -> 若图鉴窗口开着就**当场重画**；没开则下次打开时读新数据。
- 另外：`MainInView.updateCollects()`/`updateDrawingCollect()` 只在 `updateAllItemInfo`/`onSyncComplete` 等时机跑，**不监听 `updateHandbookList`**。
- 结论：**每次改变 collections/specialtys 之后 push 一次 `item_load_handbook` 即可**（旅行结束、博物馆领奖、邮件领取、`item_buy` 之后都应补）。

### B.6 我们现在实现的差距

`new/rules.js`（B 的真正源头）：
```js
var NOTE_IDS = [1000,1001,...,1029];                       /* 全是 type 1 */
st.notes = NOTE_IDS.slice(0,3).map(function(id,i){ return {id:id, read:i===0?1:0, timestamp:...} });
S['travel_load_note'] = function(){ return { note_list: st.notes } };   /* @298 */
```
- **永远没有 type 2 的 note** -> 旅友栏永远空、礼物盒永远锁。
  ```js
  var FRIEND_NOTES  = [2000,2001,2002];        /* travelFriends.visitOpen 对应的 id */
  var ATTACH_NOTES  = [20000,20010,20020];     /* 2000->20000 / 2001->20010 / 2002->20020 */
  /* 首次来访(或首次喂食)后 push 母笔记 + 对应附件笔记 */
  ```
  附件笔记让 `TravelNoteItem` 进入 `hasAttach` 状态（@1156097），母笔记 id 必须是 2000/2001/2002 之一，`attach` 必须等于它。
- `new/handbook.js`：
  - `COLL_IDS = [0..61]` 与 `Collection_json.json` 的 id 完全一致。
  - `specialtys` 用 `itemId`（`ownSpecialtys()` 合并 `st.gifts`）。
  - `awardTrip()` 依赖 `st.travelCount`，该计数器由 `rules.js:135` 的 `depart()` 维护（`st.travelCount=(st.travelCount||0)+1`），**工作正常**：实测 `save/state.json` `travelCount=6` 且 `collections=[0,1,2,3,4,5]` —— 一次旅行解锁 1 件，62 件要 62 次旅行，**进度太慢**才是问题（可改成每次旅行解锁 2-3 件，或按三叶草/特产数量一次性补齐）。
  - 第二段 wrapper（文件尾）把 `103xx`（家具图纸）塞进 `collections`：`Collection_json.json` 的 id 只到 61，`indexOf` 永远不命中 -> 无害但也无用（客户端不会崩）。真正的"图纸"属于 `FurnitureModel`/`has_fur`，不是图鉴。
- `new/mail.js`：
  - 已有 `normMail()` 强制补齐 `resource{clover_point,ticket,reward_gacha,ads_id,share_id}` / `items` / `pictures` —— **这是必须的**，见下。
  - `MOCK_ADD_MAIL` 默认 `type:3`（Gift）。
  - 默认 `sender:-1`。要让来信带头像（`mail_wugui_png` 等），`sender` 必须是 **0/1/2**。
  - `mail_open` 已经把附件放进 `st.bag` 或 `st.house` 并 push `item_load_items`；但**没有 push `item_load_handbook`** —— 若附件是特产（type 3），图鉴不会立刻刷新。
- `new/story.js`：
  - `story_load` 返回 `{stories:[{id,partner,gift,feedback}], new_story_id}`，id 1..25 与 `tables/story_json.json` 的 `storyid` 一致。
  - **渲染陷阱**：`RelationshipView.renderItem`（@1044107）-> `RelationshipItem`（@1045527）：
    ```js
    var e=core.ModelManage.getInstance().getModel(StoryModel).getStoryInfo(t.id); n.itemImage.source=e.icon+"_png";
    ```
    `getStoryInfo` -> `StoryDB.getStory(id)`（`StoryInfo` 类 @4045xx）**未命中返回 null**，而 `StoryDB` **不在 `harden.js` 的 DEFAULTS 里** -> `e.icon` **抛 TypeError**。所以 `stories[].id` **必须**是 1..25。
  - `RelationshipItem` 还用 `t.name`（`StoryData.name` 默认 `""`）-> 名字为空。建议 `stories[]` 里补 `name`（`StoryModel.story_load` 只做 `this.storyList=e.stories`，多余字段会被保留，可以直接带上 `name`）。
  - `partner` 决定分组：`n[e.partner]?(n[e.partner]++,i.splice(r,1)):n[e.partner]=1`，且 `countLevel2.visible = r>=2 / countLevel3.visible = r>=3`。现在 `story.js` 用 `i%3`（0/1/2）—— **只有一个 partner 能到 3 级**，其它永远停在 2。若要三只都升到 3 级，需要至少 9 条故事（每只 3 条）。

---

## C. 阁楼上的屋内箱子（礼品盒）为什么点不动

`GiftBoxModel`（@116530）：
```js
t.prototype.initModel=function(){ this.addProtocolCallback("travel_load_gift","") },
t.prototype.requestData=function(){ core.SocketManage.getInstance().send("travel_load_gift") },
t.prototype.isOpen=function(){                                                                        /* @119633 */
  if(!this.isOpenCache){
    var e=Tabikaeru.DataManager.instance().TravelFriendsDB.list(), t=[];
    for(var i in e) t.push(e[i].visitOpen);
    for(var n=this.getModel(TravelNoteModel).getNoteList(), r=0,o=n;r<o.length;r++){ var i=o[r]; t.indexOf(i.id)>=0&&(this.isOpenCache=!0) }}
  return this.isOpenCache },
t.prototype.travel_load_gift=function(e,t){                                                           /* @119948 */
  this.pictureList.source=Array.isArray(e.pictures)?e.pictures:[];
  for(var i=Array.isArray(e.specialtys)?e.specialtys:[],n=i.length-1;n>=0;n--){ var r=i[n].item_id,o=i[n].count;
    if(o>1){ i.splice(n,1); for(var a=0;o>a;a++) i.splice(n,0,{item_id:r,count:1}) } }
  this.specialityList.source=i, this.specialityList.refresh(), this.pictureList.refresh(),
  this.dispatchEvent(new core.Event(GiftBoxEventType.updateGiftBox)) },
t.prototype.getSpecialtyList=function(){ return this.specialityList },
t.prototype.getPictureList=function(){ return this.pictureList },
```
入口（`Lumberroom.update` @795949）：
```js
var i=this.getModel(GiftBoxModel).isOpen();
this.giftBoxBtn.visible=this.giftBoxBtn.includeInLayout=i,
```

**判定：礼品盒"点不动" = 按钮整个被隐藏，而不是点进去没内容。**

必要条件（缺一不可）：

1. **`TravelNoteModel.getNoteList()` 里必须出现 id 属于 `TravelFriends_json.visitOpen`** ——
   `tables/TravelFriends_json.json`：
   ```json
   {"0":{"id":0,"name":"壁虎","visitOpen":2000,"img_src":"Scene/Note/Friends/bh"},
    "1":{"id":1,"name":"刺猬","visitOpen":2001,"img_src":"Scene/Note/Friends/cw"},
    "2":{"id":2,"name":"萤火虫","visitOpen":2002,"img_src":"Scene/Note/Friends/yhc"}}
   ```
   -> 和 B.2 是**同一个条件**：`note_list` 里要有 2000/2001/2002。
   现在 `rules.js` 只发 1000-1029 -> `isOpen()` 恒为 false -> `giftBoxBtn.visible=false`。
2. **`isOpenCache` 是单向闩锁**：初始 false，一旦置 true 就再也不回 false（源码里没有任何地方复位）。所以位置很关键 —— `travel_load_note` 必须先于玩家打开物品间到达。
3. **`travel_load_gift` 的返回必须是 `{pictures:[...], specialtys:[{item_id,count}]}`**：
   - `specialtys` 里 `count>1` 会被展开成多份单项（每份 `count:1`）；
   - `pictures` 每项走 `PictureItemRender`（@1227607）-> `this.data.id`，以及 `Tabikaeru.getPictureTexture(e)`（用 `pic_id`/`layers`）-> **至少要有 `{id, pic_id}`**。
4. 界面细节：
   - `GiftBoxAlbumView.update()` -> `e.length>0 ? currentState="normal" : "empty"`（空盒子显示 empty 态，能开但没内容）；
   - `GiftBoxSpecialtyView.update()` -> `e.length>0 ? "normal" : "empty"`；
   - `GiftBoxSpecialtyItem.dataChanged` -> `var t=ItemDB.get(this.data.item_id); if(!t) return;`（ItemDB 已被 harden，安全）；
   - 按钮交互：`gift_to_bag(item_id)` / `gift_to_album([picture_id])`，回 `{code:0}`；相册满回 **101**（`a&&101==a.code` -> 弹"相册满了"），礼盒满回 **100**（rules.js 已实现）。
5. **`item_load_select_gift` / `item_select_gift` 与礼品盒无关**（`ItemModel.item_load_select_gift` @143600：`this.selectGiftList=Utils.convertArray(e.list); ... check_select_gift() -> new GiftSelectView(e.num, e.items)`，是"购买时选赠品"的弹窗，条目结构是 `{num, items}`）。**别拿它当礼品盒。**
   同理 `furniture_putin_box`/`box_list` 是**堆肥箱**（`FurnitureModel.compostData`，@104262），也不是屋内箱子。

**实测**：`logs/game.log` 里 `HANDLE travel_load_gift params={}` 有记录（客户端确实在请求），但按钮不可见，因为 `isOpen()` 为 false。

---

## D. 渲染陷阱汇总（照这个清单自检）

| 陷阱 | 触发条件 | 后果 | 规避 |
|---|---|---|---|
| `r.guest` on undefined | `pages` 里含非 `drawingPageData` 的 id | 绘本窗口崩（`Cannot read properties of undefined (reading 'guest')`）| 页 id 白名单 1-7/101-107/201-207 |
| `e.data.bag.length` | `guest_load_drawing` 缺 `bag` | 手信面板崩 | 7 个键一个都不能少，`bag` 必须是数组 |
| `["..._png"][guest]` -> undefined | `guest` 不属于 {0,1,2} | 图标空 / `img.source=undefined` | `guest` 必须属于 {0,1,2}（`drawing.js` 现在的 `[0,1,2,3]` 有问题） |
| `e.pictures.length` | 邮件的 `items`、`resource` 都空 且缺 `pictures` | `checkMailItemType` 抛 TypeError | `new/mail.js` 的 `normMail` 已覆盖 |
| `t.resource.ads_id` | 邮件缺 `resource` | `revice_mails` 抛 TypeError | 同上 |
| `e.icon` on null | `story_load.stories[].id` 不属于 1..25 | `RelationshipView` 崩 | id 用 `story_json.storyid` |
| `e.data.bag[0]` 语义 | 服务端只想给 1 格 | `t[0]` undefined -> `ArrayCollection([undefined])` | 至少保证 `bag=[-1,-1,-1,-1]` |
| `collectionList` 长度 | `Collection/Specialty` 是**数组**不是字典 | `index(o)` 越界得 undefined -> `t.id`/`t.itemId` 崩 | 别改这两张表的结构 |
| 列表格数不匹配 | `listSpecialty` 宽 338、格 100+gap18 -> 3 格；`itemGift` 恒 1 格 | 超出只有滚动/裁剪 | `bag` 长度 = 4 |

---

## E. 建议改动清单（按文件）

| 文件 | 改什么 | 优先级 |
|---|---|---|
| `new/drawing.js` | (1) `guests()` 去掉 3 -> `[0,1,2]`；(2) 删掉/改写 `grantDrawings()`（别往 `colls` 塞 103xx），只写 `drawingCollectData` 的合法 id；(3) 锁定结束后用 `MOCK_EVENT(24, [page, coll, clover, ticket, ...items], guest)`；(4) 加 `PartyGo`(23) 提示；(5) 给邀请加"超时自动 accept"或 GM 按钮 | 高 |
| `new/travel2.js` | `addEvent(type,value)` 增加第三个参数 `evt_id`，`MOCK_EVENT(type, value, evt_id)` | 高 |
| `new/guestfeed.js` | `guest_serve` 结算后追加一封 `Mail(type:3, sender:g.id, items:[{item_id,count}], resource:{...})`（可选再加 `evt_type:16` 事件） | 高 |
| `new/rules.js` | `NOTE_IDS` 之外补 `FRIEND_NOTES=[2000,2001,2002]` + `ATTACH_NOTES=[20000,20010,20020]`；首次旅友事件/首次投喂后 push 一条母笔记（`{id:2000,read:0,timestamp:秒}`）+ 对应附件笔记 | 高 |
| `new/handbook.js` | `awardTrip()` 每次旅行只 +1，62 件要 62 次旅行 —— 调快发放速度；邮件领取后补 push `item_load_handbook` | 中 |
| `new/mail.js` | `MOCK_ADD_MAIL` 支持显式 `sender:0/1/2`；`mail_open` 发放特产时补 push `item_load_handbook` | 中 |
| `new/story.js` | `stories[]` 补 `name`；确认 `partner` 分布能到 3 级（每 partner >=3 条） | 低 |

### E.1 验证方法（改完后照做）

1. 打开控制台：
   - `JSON.stringify(core.ModelManage.getInstance().getModel(DrawingModel).data)` -> 应见 `state/guest/bag/pages/colls/show_coll/pen_motion` 全在，`bag.length===4`。
   - `core.ModelManage.getInstance().getModel(DrawingModel).isOpen()` -> 期望 `true`（需 `item_load_items.house` 含 7001）。
   - `core.ModelManage.getInstance().getModel(ItemModel).getHouseItemCount(7001)` -> 期望 `>0`。
   - `core.ModelManage.getInstance().getModel(TravelNoteModel).getNoteNumsByType(2)` -> 期望 `>0`。
   - `core.ModelManage.getInstance().getModel(GiftBoxModel).isOpen()` -> 期望 `true`。
2. 界面：物品间 -> 应出现「绘纸/绘本」按钮（`drawBtn`）与「礼品盒」按钮（`giftBoxBtn`）；绘本点开应有 >=1 本书、>=1 页。
3. 旅行笔记 -> 切到第 2 个 tab（旅友），`t_cur/t_max` 应为 `n/27`，列表非空。
4. 日志自检：`grep -a "DISPATCH-ERR\|SEM-ERR\|NO-HANDLER" logs/game.log | tail` —— 不应出现 `guest_load_drawing` / `travel_load_note` / `item_load_handbook`。
5. 页面控制台 `MOCK_GUARD_DROPS()` —— `coll:*` 与 `note:*` 应为空。
6. `save/state.json` 复核：`drawing.pages` 应增长；`drawing.colls` 只含合法 collect id；`notes` 里应出现 2000/2001/2002。
