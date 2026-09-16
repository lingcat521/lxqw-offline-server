/* lxqw offline drawing: 绘纸/邻居来画画 (guest_*) — additive layer.
 *
 * Client contract (DrawingModel):
 *   data = { state, guest, bag[], pages[], colls[], show_coll, pen_motion }
 *     DrawingState = { wait:0, invite:1, accept:2, lock:3, visit:4 }
 *     isOpen() = ItemModel.getHouseItemCount(Tabikaeru.ItemID.DRAWING_BOOK = 7001) > 0
 *   guest_load_drawing is a SERVER PUSH (the client never sends it) and replaces data wholesale,
 *   so every key has to be present.
 *   guest_accept_invit(is_accept) -> {code:0}   (true -> state accept(2), false -> wait(0))
 *   guest_lock_bag()              -> {code:0}   (accept(2) -> lock(3); unlock goes back)
 *   guest_putin_bag(pos,id) / guest_takeout_bag(pos) -> {code:0}   (bag[pos-1])
 *   guest_confirm(id) / guest_serve(id,item) / guest_finish() / guest_set_expire_time(t) -> no reply
 * Page ids come from the client's DrawingPage table and collectibles from DrawingCollect.
 */
(function () {
  var M = window.MockServer, st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  function log(m) { try { console.log("[MOCK] " + m); } catch (e) {} }
  var DS = { wait: 0, invite: 1, accept: 2, lock: 3, visit: 4 };
  var DRAWING_BOOK = 7001, INVITE_EVERY = 4 * 60 * 1000, BAG_SLOTS = 4;
  /* 聚会(= 出门画绘纸)的时长: 原版没有官方固定值, 按玩家案例反推 —— 一次过夜或大半天的行程。
     这里 6~18 小时(偏向 12~16 小时), 10% 概率延长到最多 24 小时, 硬上限 30 小时
     ("否则玩家会感觉蛙蛙失踪了")。st.partySeconds 可覆盖(测试/GM)。
     注意与"访客来家里做客的停留时间"(180~270 分钟, new/guestfeed.js)是两件事。 */
  function partyMs() {
    var ov = Number(st.partySeconds);
    if (isFinite(ov) && ov > 0) return ov * 1000;
    var h;
    if (Math.random() < 0.10) h = 18 + Math.random() * 6;          /* 过夜加长: 18~24 小时 */
    else if (Math.random() < 0.5) h = 12 + Math.random() * 4;      /* 偏向体感: 12~16 小时 */
    else h = 6 + Math.random() * 12;                               /* 其余均布 6~18 小时 */
    h = Math.max(6, Math.min(30, h));
    return Math.round(h * 3600 * 1000);
  }

  function dm() { try { return Tabikaeru.DataManager.instance(); } catch (e) { return null; } }
  function idsOf(prop) {
    try {
      var d = dm(), t = d ? d[prop] : null;
      if (t && t.list) { var l = t.list(), o = []; for (var i = 0; i < l.length; i++) o.push(Number(l[i].id)); if (o.length) return o; }
    } catch (e) {}
    return null;
  }
  function pageIds() { return idsOf("DrawingPage") || [1, 101, 102]; }
  function collIds() { return idsOf("DrawingCollect") || [1, 101, 102]; }
  /* 只能是 0/1/2: 客户端 invite_wugui/maotouying/songshu_png[guest]、out_invite_*[guest]、
     DrawView.guest_pages=[[],[],[]] 都是三元素 —— guest=3 会取到 undefined 渲染崩溃 */
  var BAG_SLOTS = 4;
  function guests() { return [0, 1, 2]; }                /* 困困 / 胖胖 / 跳跳 */

  function ds() {
    var x = st.drawing;
    if (!x || typeof x !== "object") x = st.drawing = {};
    if (typeof x.state !== "number") x.state = DS.wait;
    if (typeof x.guest !== "number") x.guest = -1;
    if (!Array.isArray(x.bag)) x.bag = [];
    while (x.bag.length < BAG_SLOTS) x.bag.push(-1);       /* 客户端 Souvenir.update() 读 bag.length, 缺了会崩 */
    if (x.bag.length > BAG_SLOTS) x.bag = x.bag.slice(0, BAG_SLOTS);
    if (!Array.isArray(x.pages)) x.pages = [];
    if (!Array.isArray(x.colls)) x.colls = [];
    if (typeof x.showColl !== "number") x.showColl = 0;
    if (typeof x.penMotion !== "string") x.penMotion = "write";
    if (typeof x.nextInvite !== "number") x.nextInvite = Date.now() + 30000;
    if (typeof x.lockUntil !== "number") x.lockUntil = 0;
    return x;
  }
  function save() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
  function pushDraw(d) { setTimeout(function () { try { M.dispatch("guest_load_drawing", data()); } catch (e) {} }, d || 40); }
  function data() {
    var x = ds();
    return { state: x.state, guest: x.guest, bag: x.bag.slice(), pages: x.pages.slice(),
             colls: x.colls.slice(), show_coll: x.showColl, pen_motion: x.penMotion };
  }
  /* the activity needs the 友情绘本 in the house, otherwise DrawingModel.isOpen() is false */
  function unlock() {
    if (!Array.isArray(st.house)) st.house = [];
    for (var i = 0; i < st.house.length; i++) if (st.house[i] && Number(st.house[i].item_id) === DRAWING_BOOK) return;
    st.house.push({ item_id: DRAWING_BOOK, count: 1 });
    save();
    setTimeout(function () { try { M.dispatch("item_load_items", (typeof S["item_load_items"] === "function" ? S["item_load_items"]() : null)); } catch (e) {} }, 40);
    log("绘纸: 获得友情绘本 (7001), 绘纸玩法开启");
  }

  S["guest_load_drawing"] = function () { return data(); };
  /* guest_load_drawing 是**纯推送**(客户端从不主动要它), 所以启动后必须补推一次 ——
     否则重启后 pages/colls 虽然在存档里, 客户端 DrawingModel.data 却是空的 -> 绘本界面又是空的
     (用户: "刚才做的绘本也没有弄持久化" —— 其实存了, 是没推)。
     每次启动只推这一条(零代价)。 */
  setTimeout(function () { try { M.dispatch("guest_load_drawing", data()); } catch (e) {} }, 1200);
  S["guest_accept_invit"] = function (p) {
    var x = ds();
    /* 客户端发的是**裸布尔**: send("guest_accept_invit", Action2, true/false)。
       多数情况下 APK 侧的加载器会按协议声明的参数名包成 {is_accept:true}, 但不能指望它 ——
       这里两种形状都认, 免得"点了同意"被当成"婉拒"(那样邀约槽里永远没有卡片, 也就永远出发不了)。 */
    var ok;
    if (p === true || p === 1 || p === 'true' || p === '1') ok = true;
    else if (p === false || p === 0 || p === 'false' || p === '0' || p === undefined || p === null) ok = false;
    else if (typeof p === 'object') ok = !!(p.is_accept !== undefined ? p.is_accept : (p.accept !== undefined ? p.accept : p.value));
    else ok = !!p;
    if (ok) { x.state = DS.accept; x.acceptAt = Date.now(); log("绘纸: 接受了第 " + (x.guest + 1) + " 位邻居的邀请(请到小屋准备手信)"); }
    else { x.state = DS.wait; x.guest = -1; x.nextInvite = Date.now() + INVITE_EVERY; log("绘纸: 婉拒了邀请"); }
    save(); pushDraw(30);
    return { code: 0 };
  };
  S["guest_putin_bag"] = function (p) {
    var x = ds(), pos = Number(p && p.pos) - 1;
    if (!(pos >= 0 && pos < BAG_SLOTS)) return { code: 1 };
    x.bag[pos] = Number(p.id);
    save(); log("绘纸: 包里第 " + (pos + 1) + " 格放入 " + p.id);
    return { code: 0 };
  };
  S["guest_takeout_bag"] = function (p) {
    var x = ds(), pos = Number(p && p.pos) - 1;
    if (!(pos >= 0 && pos < BAG_SLOTS)) return { code: 1 };
    x.bag[pos] = -1;
    save(); log("绘纸: 包里第 " + (pos + 1) + " 格取出");
    return { code: 0 };
  };
  S["guest_lock_bag"] = function () {
    var x = ds();
    if (x.state !== DS.accept && x.state !== DS.lock) return { code: 1 };
    if (x.state === DS.lock) { x.state = DS.accept; save(); pushDraw(30); log("绘纸: 解锁包裹"); return { code: 0 }; }
    /* 原版: 邀约卡片在"手信面板的邀约槽"里 + 放好手信(bag[0]) + 点「准备」才出发。
       客户端自己在 bag[0]==-1 时就不发这条协议(会提示"快把手信准备好吧"), 这里再兜一层。 */
    if (!(Number(x.bag[0]) >= 0)) {
      log('绘纸: 还没放手信(bag[0] 空) -> 不出发, 先把伴手礼放进手信格');
      return { code: 1 };
    }
    x.state = DS.lock;
    var __ms = partyMs();
    x.lockUntil = Date.now() + __ms;
    save();
    /* 手信锁定 = 玩家把伴手礼准备好 -> 青蛙出发赴约(原版: 接受邀请 + 备好手信 之后它才去) */
    try { if (window.MOCK_PARTY) window.MOCK_PARTY.start('赴约:手信已备好', { guest: x.guest, ends: x.lockUntil }); } catch (e) {}
    log("绘纸: 手信锁定 -> 青蛙出发赴约 (" + (Math.round(__ms / 360000) / 10) + " 小时后带着绘纸回来)");
    return { code: 0 };
  };
  S["guest_confirm"] = function (p) { ds().confirmedId = Number(p && p.id); save(); log("绘纸: 邻居确认 id=" + ds().confirmedId); return {}; };
  /* 旅友投喂(在绘纸层内扩展, 不另起层抢协议): 记录口味偏好 + 真实扣库存 */
  function guestTaste(partner, item) {
    st.taste = st.taste || {};
    var t = st.taste[partner] = st.taste[partner] || { last: 0, same: 0 };
    t.same = (Number(t.last) === Number(item)) ? (Number(t.same) || 0) + 1 : 1;
    t.last = Number(item);
    return t;
  }
  function guestTakeHouse(item) {
    if (!Array.isArray(st.house)) st.house = [];
    for (var i = 0; i < st.house.length; i++) {
      var h = st.house[i];
      if (h && Number(h.item_id) === Number(item) && (Number(h.count) || 0) > 0) { h.count -= 1; return true; }
    }
    return false;
  }
  function guestSettle() {
    var x = ds(), tasted = (x.served && x.served.item) ? guestTaste(x.guest, x.served.item) : null;
    var like = !!(tasted && Number(tasted.same) >= 2);
    var clover = like ? 30 : 10, ticket = like ? 2 : 1;
    st.clover = (Number(st.clover) || 0) + clover;
    st.ticket = (Number(st.ticket) || 0) + ticket;
    try { push("clover_update", { clover: st.clover }, 30); } catch (e) {}
    try { push("item_update_ticket", { ticket: st.ticket }, 60); } catch (e) {}
    log("旅友: 回礼 " + (like ? "(爱吃, 翻倍) " : "") + "三叶草+" + clover + " 抽奖券+" + ticket);
  }
  S["guest_serve"] = function (p) {
    var x = ds();
    var __item = Number(p && (p.item !== undefined ? p.item : (p.item_id !== undefined ? p.item_id : 0)));
    if (__item) guestTakeHouse(__item);
    x.served = { id: Number(p && p.id), item: __item };
    save(); log("绘纸: 招待邻居 id=" + x.served.id + " 用 " + x.served.item);
    return {};
  };
  S["guest_finish"] = function () {
    try { guestSettle(); } catch (e) {}
    var x = ds();
    x.state = DS.wait; x.guest = -1; x.bag = [-1, -1, -1, -1]; x.lockUntil = 0;
    x.nextInvite = Date.now() + INVITE_EVERY;
    save(); pushDraw(30); log("绘纸: 邻居离开");
    return {};
  };
  S["guest_set_expire_time"] = function (p) { var t = Number(p && p.expire_time !== undefined ? p.expire_time : p); if (t) ds().expireTime = t; save(); return {}; };

  /* 邀请 -> 画画 -> 产出绘纸/收藏 的循环 */
  function tick() {
    var x = ds(), now = Date.now();
    if (x.state === DS.wait && now >= (x.nextInvite || 0)) {
      var g = guests();
      x.guest = g[Math.floor(Math.random() * g.length)];
      x.state = DS.invite; x.autoAcceptAt = now + 180000;
      save(); pushDraw(30);
      log("绘纸: 第 " + (x.guest + 1) + " 位邻居来邀请一起画画");
      return;
    }
    /* 邀请卡片**一直挂着**等玩家点(原版: 你自己点卡片选"是")。
       以前这里 3 分钟没点就自动接受 —— 结果状态被推到 accept, invite() 又要求 state==wait,
       于是"访客离开后门口再也不会出现新卡片"(用户报的问题)。 */
    if (x.state === DS.accept && now - Number(x.acceptAt || 0) > 12 * 3600 * 1000) {
      log('绘纸: 上一次接受邀请后 12 小时都没准备手信 -> 卡片作废, 重新等邀请');
      x.state = DS.wait; x.guest = -1; x.acceptAt = 0;
      save(); pushDraw(30);
      return;
    }
    if (x.state === DS.lock && now >= (x.lockUntil || 0)) {
      var pgs = pageIds(), cls = collIds();
      var guestN = Number(x.guest);                 /* 先把邻居号存下来: 下面会把 x.guest 复位成 -1 */
      var page = null, coll = null;
      for (var i = 0; i < pgs.length; i++) if (x.pages.indexOf(pgs[i]) < 0) { page = pgs[i]; break; }
      if (page === null) page = pgs[Math.floor(Math.random() * pgs.length)];
      for (var j = 0; j < cls.length; j++) if (x.colls.indexOf(cls[j]) < 0) { coll = cls[j]; break; }
      if (coll === null) coll = cls[Math.floor(Math.random() * cls.length)];
      x.pages.push(page);
      x.colls.push(coll);
      if (!Array.isArray(st.collections)) st.collections = [];
      if (st.collections.indexOf(Number(coll)) < 0) st.collections.push(Number(coll));   /* 图鉴 */
      x.state = DS.wait; x.guest = -1; x.bag = [-1, -1, -1, -1]; x.lockUntil = 0;
      x.nextInvite = Date.now() + INVITE_EVERY;
      save();
      pushDraw(30);
      pushDraw(0);
      setTimeout(function () { try { M.dispatch("item_load_handbook", (typeof S["item_load_handbook"] === "function" ? S["item_load_handbook"]() : null)); } catch (e) {} }, 80);
      /* 原版聚会奖励: 主要是**绘纸/友情绘本**(就是这里的 page/coll), 也可能带回家具、道具。
         先用 MOCK_PARTY.finish 让青蛙回到小屋(它在外面待了一整场聚会), 再发 PartyResult(24)
         —— 客户端靠事件 24 打开绘本结果页(DrawView); 事件 7(Gift) 在客户端是空操作。 */
      try { if (window.MOCK_PARTY) window.MOCK_PARTY.finish('聚会归来:拿到绘纸'); } catch (e) {}
      var extra = [];
      try {
        if (Math.random() < 0.45 && window.MOCK_ADD_MAIL === undefined) { /* 占位, 见下 */ }
        /* 惊喜: 45% 一件道具/家具(从客户端自己的表里挑) */
        if (Math.random() < 0.45) {
          var dmx = Tabikaeru.DataManager.instance();
          var pool = [];
          try {
            var fdbx = dmx && (dmx.FurnitureDB || dmx.furnitureDB);
            var fl = (fdbx && typeof fdbx.list === 'function') ? fdbx.list() : null;
            if (fl) for (var fi = 0; fi < fl.length && fi < 400; fi++) { var fid = Number(fl[fi] && fl[fi].id); if (fid) pool.push({ t: 'fur', id: fid }); }
          } catch (e) {}
          try {
            var idb = dmx && dmx.ItemDB;
            var il = (idb && typeof idb.list === 'function') ? idb.list() : null;
            if (il) for (var ii = 0; ii < il.length; ii++) { var it = il[ii], tid = Number(it && it.id), tt = Number(it && it.type); if (tid && tt === 2) pool.push({ t: 'item', id: tid }); }
          } catch (e) {}
          if (pool.length) {
            var pickx = pool[Math.floor(Math.random() * pool.length)];
            if (pickx.t === 'fur') {
              st.furniture = st.furniture || {}; st.furniture.has_fur = Array.isArray(st.furniture.has_fur) ? st.furniture.has_fur : [];
              if (st.furniture.has_fur.map(Number).indexOf(pickx.id) < 0) st.furniture.has_fur.push(pickx.id);
              extra = [pickx.id, 1];
              setTimeout(function () { try { M.dispatch('furniture_load_furniture', (typeof S['furniture_load_furniture'] === 'function') ? S['furniture_load_furniture']() : null); } catch (e) {} }, 120);
              log('聚会惊喜: 邻居送了家具 ' + pickx.id);
            } else {
              st.house = Array.isArray(st.house) ? st.house : [];
              var hf = null;
              for (var hi = 0; hi < st.house.length; hi++) if (st.house[hi] && Number(st.house[hi].item_id) === pickx.id) hf = st.house[hi];
              if (hf) hf.count = (Number(hf.count) || 0) + 1; else st.house.push({ item_id: pickx.id, count: 1 });
              extra = [pickx.id, 1];
              setTimeout(function () { try { M.dispatch('item_load_items', (typeof S['item_load_items'] === 'function') ? S['item_load_items']() : null); } catch (e) {} }, 120);
              log('聚会惊喜: 邻居送了道具 ' + pickx.id);
            }
            save();
          }
        }
      } catch (e) {}
      try {
        if (window.MOCK_EVENT) {
          window.MOCK_EVENT(24, [Number(page) || 0, Number(coll) || 0, -1, 0].concat(extra), { evt_id: guestN >= 0 ? guestN : 0, evt_pic: [] });
        }
      } catch (e) {}
      if (st.frog && Number(st.frog.party)) { /* 万一聚会状态还在, 兜底放它回来 */ try { window.MOCK_PARTY.finish('绘纸完成兜底'); } catch (e) {} }
      log("绘纸: 画好了! 绘纸 " + page + " (共 " + x.pages.length + "), 收藏 " + coll + " (共 " + x.colls.length + ")");
    }
  }
  setInterval(tick, 3000);

  /* 请邻居送邀请卡片(原版: 朋友串门离开后, 门口留下邀请卡片) */
  function invite(guestId, why) {
    var x = ds();
    if (x.state === DS.accept) { log('绘纸: 门口没有新卡片 —— 上一张已经被接受了, 还在等你准备手信 [' + (why || '') + ']'); return false; }
    if (x.state === DS.lock) { log('绘纸: 门口没有新卡片 —— 青蛙正带着手信在外面 [' + (why || '') + ']'); return false; }
    if (x.state !== DS.wait && x.state !== DS.invite) return false;
    var g = Number(guestId);
    if (!isFinite(g) || g < 0 || g > 2) g = guests()[Math.floor(Math.random() * guests().length)];
    x.guest = g; x.state = DS.invite; x.autoAcceptAt = 0; x.acceptAt = 0;
    x.nextInvite = Date.now() + INVITE_EVERY;
    save(); pushDraw(30);
    log('绘纸: 门口的邀请卡片出现了 (邻居 ' + g + ') [' + (why || '') + ']');
    return true;
  }
  window.MOCK_DRAWING = {
    invite: invite,
    state: function () { var x = ds(); return { state: x.state, guest: x.guest, pages: x.pages.length, colls: x.colls.length, bag: x.bag.slice(), acceptAt: x.acceptAt || 0 }; },
    /* 卡片被卡住/想重新来一次: 回到"等邀请" */
    reset: function (why) { var x = ds(); x.state = DS.wait; x.guest = -1; x.bag = [-1, -1, -1, -1]; x.lockUntil = 0; x.acceptAt = 0; x.nextInvite = Date.now() + INVITE_EVERY; save(); pushDraw(30); log('绘纸: 状态已重置为"等邀请" [' + (why || '') + ']'); return true; },
    /* 手动把整套流程跑完(测试/GM) */
    accept: function () { return S['guest_accept_invit']({ is_accept: 1 }); },
    lock: function () { return S['guest_lock_bag']({}); },
    finish: function () { var x = ds(); x.lockUntil = Date.now() - 1; try { tick(); } catch (e) {} return window.MOCK_DRAWING.state(); },
    partyMs: partyMs                              /* 这一趟聚会的时长(毫秒) */
  };

  unlock();
  ds();
  log("drawing ready: 状态 " + ds().state + ", 绘纸 " + ds().pages.length + ", 收藏 " + ds().colls.length);
  /* 诊断: 打印客户端图纸模型(DrawingModel)的真实字段, 用于按它的存储位置发放图纸 */
  (function () {
    var n = 0;
    var iv = setInterval(function () {
      n++; if (n > 10) { clearInterval(iv); return; }
      try {
        var C = window.DrawingModel;
        if (typeof C === 'function') {
          var m = core.ModelManage.getInstance().getModel(C), d = m && m.data;
          if (d) console.log('[MOCK] DRAWMODEL keys=' + Object.keys(d).join(',') + ' sample=' + JSON.stringify(d).slice(0, 220));
        }
      } catch (e) {}
    }, 4000);
  })();
  /* 家具图纸(103xx)是**物品**, 属于家具制作(见 new/furnituremake.js 的 ownedDrawings()),
     不该写进绘纸模型的 colls —— colls 的语义是 drawingCollectData 的 id(1..308), 而且 guard.js
     的 has("coll",c) 也只会放行这一批。以前这里把 10301..10327 塞进去, 结果是"图纸看着有、
     重启就没了"(用户原话) + 绘纸收藏栏里出现不存在的条目。 */

  /* guest_load_drawing: 绘纸(画画)的加载协议 —— 客户端用它填充 DrawingModel.pages/colls */
  (function () {
    S['guest_load_drawing'] = function () {
      var x = ds();
      var colls = Array.isArray(x.colls) ? x.colls : [];
      try {
        var dm = Tabikaeru.DataManager.instance(), db = dm && dm.DrawingCollectData;
        if (db && typeof db.list === 'function') {
          var all = db.list() || [];
          for (var i = 0; i < all.length && colls.length < 60; i++) {
            var id = Number(all[i] && all[i].id);
            if (id && colls.indexOf(id) < 0) colls.push(id);
          }
        }
      } catch (e) {}
      x.colls = colls; save();
      try { console.log('[MOCK] guest_load_drawing -> pages=' + (x.pages || []).length + ' colls=' + colls.length); } catch (e) {}
      return { state: x.state, guest: x.guest, bag: x.bag || [], pages: x.pages || [], colls: colls, show_coll: x.show_coll || 0, pen_motion: x.pen_motion || 'write' };
    };
  })();
})();
