/* lxqw offline handcraft: 祈愿物/印章 手工 (pray_load_grays / pray_compose) — additive.
 *
 * Client contract (HandCraftModel + PrayCraftPageView.updateList):
 *   pray_load_grays(e): prayCraftList  = e.wishs    // [{id,state,body,paper,make_time,u_id}]
 *                       stampCraftList = e.stamps   // [{id,time,u_id}]  (red dot reads .time)
 *                       boxCraftList   = e.boxes
 *                       makingPraycraft = e.wish_new, makingStampcraft = e.stamp_new
 *   PrayCraftPageView groups rows by  id_stateIndex  ->  PrayCraftDB.get(id).wood_body / .paper
 *   the red dot fires while  now > make_time / time  (a finished craft waiting to be seen)
 *   pray_compose(id) -> {item_list:[{item_id,count}]}   (合成盒子, 由 BoxCraft UI 调用)
 *   pray_confirm_make_box -> the client clears boxCraftList and just tells the server
 *
 * The game's own fiction (see the 年度回顾 text) is that the frog carves stamps and
 * finishes wishes AT HOME while the player is away - so that is exactly what this
 * layer implements: while frog.status == 0 the frog works on one craft at a time.
 */
(function () {
  var M = window.MockServer, st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  function log(m) { try { console.log("[MOCK] " + m); } catch (e) {} }
  var PRAY_IDS = [1, 2, 3, 4, 5, 6, 7];                       /* tables/prayData_json.json */
  var STAMP_IDS = [1, 101, 102, 103, 104, 105, 106, 107];      /* tables/stampData_json.json */
  /* 手工品界面的渲染契约(用户报「手工品有 NaN 的 bug」, 截图里大字是 NaN.NaN.NaN):
       PrayCraftDetailRender.dataChanged:
         this.l_date.text = core.DateFormat.format(1e3 * entry.stamp_time, "YYYY.MM.DD")   ← 没有 stamp_time 就是 NaN.NaN.NaN
         var t = PrayCraftNoteDB.get(entry.content)     ← 祈愿物上刻的字
         if (entry.stamp && 0 != entry.stamp_time) { StampCraftDB.get(entry.stamp) ... }
       PrayCraftItemRender 读 body / paper -> HandCraftUtils.getLayerSource = PrayCraftBodyDB.get(id).pray_pic
       PrayCraftPageView 按 id/body/paper 分组、按 make_time 排序, 并读 state(1..4)
       → 所以每条祈愿物必须有 make_time / stamp_time / content / body / paper / state / u_id, 且都是合法值。
     这里做两件事: 建单时补齐, 以及**出口统一清洗**(老存档里的脏数据也能立刻修好)。 */
  function dbRows(name) {
    try {
      var dm = Tabikaeru.DataManager.instance(), db = dm && (dm[name] || dm[name.charAt(0).toLowerCase() + name.slice(1)]);
      if (db && typeof db.list === 'function') { var l = db.list(); if (l && l.length) return l; }
    } catch (e) {}
    return null;
  }
  function bodyIds() {
    var l = dbRows('PrayCraftBodyDB');
    return (l && l.length) ? l.map(function (r) { return Number(r.id); }) : [101, 102, 103, 104, 105, 106];
  }
  function noteIds() {
    var l = dbRows('PrayCraftNoteDB');
    return (l && l.length) ? l.map(function (r) { return Number(r.id); })
                           : [1, 2, 3, 4, 5, 11, 12, 13, 14, 15, 21, 22, 23, 24, 25, 31, 32, 33, 34, 35, 41, 42, 43, 44, 45, 51, 52, 53, 54, 55];
  }
  function stampCraftIds() {
    var l = dbRows('StampCraftDB');
    return (l && l.length) ? l.map(function (r) { return Number(r.id); }) : [1, 101, 102, 103, 104, 105, 106, 107];
  }
  function prayRow(id) {
    var l = dbRows('PrayCraftDB');
    if (l) { for (var i = 0; i < l.length; i++) if (Number(l[i].id) === Number(id)) return l[i]; }
    return null;
  }
  function pickOne(list, seed) { return list[Math.abs(Math.floor(seed)) % list.length]; }
  /* 把一条祈愿物/印章补齐到"客户端画得出、不算出 NaN"的样子 */
  function fixWish(w, seq) {
    if (!w || typeof w !== 'object') return w;
    var now = nowSec();
    w.id = Number(w.id) || 1;
    w.u_id = Number(w.u_id) || (seq || 1);
    w.state = Number(w.state) || 1;
    if (w.state < 1 || w.state > 4) w.state = 1;
    var row = prayRow(w.id);
    var bodies = bodyIds();
    if (!Number(w.body)) {
      var b = null;
      try { b = row && row.wood_body ? String(row.wood_body[w.state - 1] || '').split(',')[0] : null; } catch (e) {}
      w.body = Number(b) || pickOne(bodies, w.id + w.state);
    }
    if (!Number(w.paper)) {
      var pp = null;
      try { pp = row && row.paper ? String(row.paper[w.state - 1] || '').split(',')[0] : null; } catch (e) {}
      w.paper = Number(pp) || pickOne(bodies, w.id * 7 + w.state);
    }
    w.make_time = Number(w.make_time) || now;
    /* ★ 关键: 客户端直接 format(1e3*stamp_time) —— 0/undefined 就是 NaN.NaN.NaN */
    w.stamp_time = Number(w.stamp_time) || w.make_time;
    w.content = Number(w.content) || pickOne(noteIds(), w.u_id * 3 + w.id);
    w.stamp = Number(w.stamp) || 0;                /* 0 = 还没盖章(客户端据此跳过印章图) */
    w.stamp_state = Number(w.stamp_state) || 0;
    return w;
  }
  function fixStamp(st) {
    if (!st || typeof st !== 'object') return st;
    var now = nowSec();
    st.id = Number(st.id) || 1;
    st.u_id = Number(st.u_id) || 1;
    st.state = Number(st.state) || 1;
    st.time = Number(st.time) || now;              /* updateRedot 读 .time(完成时刻) */
    st.make_time = Number(st.make_time) || st.time;
    return st;
  }
  var CRAFT_SECONDS = 90;    /* one craft takes this long */
  var MAX_KEPT = 30;

  function cs() {
    var c = st.craft;
    if (!c || typeof c !== "object") c = st.craft = {};
    if (!Array.isArray(c.wishes)) c.wishes = [];
    if (!Array.isArray(c.stamps)) c.stamps = [];
    if (!Array.isArray(c.boxes)) c.boxes = [];
    if (typeof c.seq !== "number") c.seq = 0;
    if (!c.wishNew || typeof c.wishNew !== "object") c.wishNew = null;
    if (!c.stampNew || typeof c.stampNew !== "object") c.stampNew = null;
    return c;
  }
  function nowSec() { return Math.floor(Date.now() / 1000); }
  /* 手工消耗: 每开一单要 1 件手工品制作工具(7000) + 1 件手工品材料(8000)。
     以前祈愿物/印章每 90 秒白送一件, 什么都不扣 —— 清单 §9"制作消耗: 扣图纸、工具、材料"里手工那一半。 */
  var COST_TOOL = 7000, COST_MAT = 8000;
  function house() { return Array.isArray(st.house) ? st.house : (st.house = []); }
  function houseCount(id) { var h = house(); for (var i = 0; i < h.length; i++) if (h[i] && Number(h[i].item_id) === Number(id)) return Number(h[i].count) || 0; return 0; }
  function houseTake(id, n) {
    var h = house();
    for (var i = 0; i < h.length; i++) if (h[i] && Number(h[i].item_id) === Number(id)) {
      if ((Number(h[i].count) || 0) < n) return false;
      h[i].count = Number(h[i].count) - n;
      if (h[i].count <= 0) h.splice(i, 1);
      return true;
    }
    return false;
  }
  function houseAdd(id, n) {
    var h = house();
    for (var i = 0; i < h.length; i++) if (h[i] && Number(h[i].item_id) === Number(id)) { h[i].count = (Number(h[i].count) || 0) + n; return; }
    h.push({ item_id: Number(id), count: n });
  }
  var saidCost = false;
  function payCraftCost(kind) {
    if (houseCount(COST_TOOL) < 1 || houseCount(COST_MAT) < 1) {
      if (!saidCost) { saidCost = true; log('手工: 材料不足, 暂停开工 (需要 ' + COST_TOOL + 'x1 + ' + COST_MAT + 'x1; 现有 ' + houseCount(COST_TOOL) + '/' + houseCount(COST_MAT) + ')'); }
      return false;
    }
    houseTake(COST_TOOL, 1); houseTake(COST_MAT, 1);
    saidCost = false;
    push('item_load_items', null, 60);
    log('手工: ' + kind + ' 消耗 ' + COST_TOOL + 'x1 + ' + COST_MAT + 'x1 (剩 ' + houseCount(COST_TOOL) + '/' + houseCount(COST_MAT) + ')');
    return true;
  }
  function save() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
  function push(name, d) { setTimeout(function () { try { M.dispatch(name, (typeof S[name] === "function" ? S[name]() : S[name])); } catch (e) {} }, d || 30); }
  function home() { return !(st.frog && st.frog.status === 1); }
  function pick(list, used) {
    var free = [];
    for (var i = 0; i < list.length; i++) if (used.indexOf(list[i]) < 0) free.push(list[i]);
    if (!free.length) free = list.slice();
    return free[Math.floor(Math.random() * free.length)];
  }
  function usedIds(arr) { var o = []; for (var i = 0; i < arr.length; i++) o.push(arr[i].id); return o; }

  /* the frog works on one wish and one stamp at a time while it is home */
  function pump() {
    var c = cs(), now = nowSec(), changed = false;
    if (c.wishNew && c.wishNew.make_time <= now) {
      c.wishes.push(c.wishNew);
      log("手工: 祈愿物完成 id=" + c.wishNew.id + " (共 " + c.wishes.length + ")");
      c.wishNew = null; changed = true;
    }
    if (c.stampNew && c.stampNew.time <= now) {
      c.stamps.push(c.stampNew);
      log("手工: 印章刻好 id=" + c.stampNew.id + " (共 " + c.stamps.length + ")");
      c.stampNew = null; changed = true;
    }
    if (!c.wishNew && c.wishes.length < MAX_KEPT && home() && payCraftCost('祈愿物')) {
      var wid = pick(PRAY_IDS, usedIds(c.wishes));
      c.wishNew = fixWish({ id: wid, u_id: ++c.seq, state: 1, body: 0, paper: 0, stamp_time: 0, content: 0,
                            make_time: now + CRAFT_SECONDS }, ++c.seq);
      log("手工: 青蛙开始做祈愿物 id=" + wid + " (" + CRAFT_SECONDS + "秒)");
      changed = true;
    }
    if (!c.stampNew && c.stamps.length < MAX_KEPT && home() && payCraftCost('印章')) {
      var sid = pick(STAMP_IDS, usedIds(c.stamps));
      c.stampNew = fixStamp({ id: sid, u_id: ++c.seq, state: 1, time: now + CRAFT_SECONDS });
      log("手工: 青蛙开始刻印章 id=" + sid + " (" + CRAFT_SECONDS + "秒)");
      changed = true;
    }
    if (changed) save();
    return changed;
  }

  S["pray_load_grays"] = function () {
    pump();
    var c = cs(), i;
    for (i = 0; i < c.wishes.length; i++) fixWish(c.wishes[i], i + 1);     /* 老存档里的脏数据在这里就地修好 */
    for (i = 0; i < c.stamps.length; i++) fixStamp(c.stamps[i]);
    if (c.wishNew) fixWish(c.wishNew, c.seq);
    if (c.stampNew) fixStamp(c.stampNew);
    return {
      wishs: c.wishes.slice(),
      stamps: c.stamps.slice(),
      boxes: c.boxes.slice(),
      wish_new: c.wishNew || 0,
      stamp_new: c.stampNew || 0
    };
  };

  /* ---- 合成(开工) ------------------------------------------------------------
   * 客户端 BoxCraftView.updateView() 是**自我重触发**的:
   *   三组材料(COMPOSE 16 的 sub_type 1/2/3)都 >0 -> s=true -> 自动 req_compose(5502),
   *   而 req_compose 的回包里 t.apply() 又会再跑一次 updateView。
   * 所以服务端**必须真的扣材料并把新的 item_load_items 推回客户端**, 否则就是死循环。
   * 2026-09-14 的事故: 上一版只发奖不扣料 -> 客户端连发 2997 次 -> 界面卡死 -> 崩溃。
   * 规则:
   *   1) 每次合成扣 sub_type 1/2/3 各 1 件(扣 st.house, 也就是客户端看到的那份数据);
   *   2) 缺任一组 -> 不发奖, 并立刻推 item_load_items(客户端 t[] 才会归零 -> s=false -> 循环停);
   *   3) 成功 -> 奖励进 house, 同样推 item_load_items;
   *   4) 两道硬闸: 一局最多 COMPOSE_MAX_OK 次成功、COMPOSE_MAX_REJECT 次拒绝, 之后只回空表。
   * 奖励 id 目前沿用 8000(手工品材料); 真实产物的 id 未知, 要改就改 COMPOSE_REWARD 一个常量。
   */
  var COMPOSE_REWARD = 8000, COMPOSE_MAX_OK = 30, COMPOSE_MAX_REJECT = 60;
  var composeOk = 0, composeReject = 0;
  function composeSubType(id) {
    try {
      var d = Tabikaeru.DataManager.instance().ItemDB.get(Number(id));
      if (d && Number(d.type) === 16) return Number(d.sub_type) || 0;
    } catch (e) {}
    return ({ 8501: 1, 8502: 2, 8503: 3 })[Number(id)] || 0;   /* Item 表兜底 */
  }
  function composeLeft() {
    var t = [0, 0, 0], house = Array.isArray(st.house) ? st.house : [];
    for (var i = 0; i < house.length; i++) {
      var it = house[i]; if (!it) continue;
      var g = composeSubType(it.item_id);
      if (g >= 1 && g <= 3) t[g - 1] += Number(it.count) || 0;
    }
    return t;
  }
  function composeTake(group) {
    var house = Array.isArray(st.house) ? st.house : [];
    for (var i = 0; i < house.length; i++) {
      var it = house[i]; if (!it) continue;
      if (composeSubType(it.item_id) !== group) continue;
      if ((Number(it.count) || 0) <= 0) continue;
      it.count = Number(it.count) - 1;
      if (it.count <= 0) house.splice(i, 1);          /* 扣到 0 就删行: 留着会让"三拼"红点永远消不掉 */
      return Number(it.item_id);
    }
    return 0;
  }
  function addHouse(id, n) {
    var house = Array.isArray(st.house) ? st.house : (st.house = []);
    for (var i = 0; i < house.length; i++) {
      if (Number(house[i].item_id) === Number(id)) { house[i].count = (Number(house[i].count) || 0) + n; return; }
    }
    house.push({ item_id: Number(id), count: n });
  }
  S["pray_compose"] = function (p) {
    var t = composeLeft();
    var enough = t[0] > 0 && t[1] > 0 && t[2] > 0;
    if (!enough || composeOk >= COMPOSE_MAX_OK || composeReject > COMPOSE_MAX_REJECT) {
      composeReject++;
      if (composeReject <= 3 || composeReject % 20 === 0) {
        log("手工: 合成拒绝(材料 " + t.join("/") + ", 已合成 " + composeOk + ", 拒绝 " + composeReject + ")");
      }
      push("item_load_items");            /* 关键: 让客户端的 t[] 归零, 自动循环才有终止条件 */
      return { item_list: [] };
    }
    var took = [composeTake(1), composeTake(2), composeTake(3)];
    addHouse(COMPOSE_REWARD, 1);
    composeOk++;
    save();
    push("item_load_items");
    log("手工: 合成 #" + composeOk + " 消耗 " + took.join("+") + " -> " + COMPOSE_REWARD + "; 剩余材料 " + composeLeft().join("/"));
    return { item_list: [{ item_id: COMPOSE_REWARD, count: 1 }] };
  };
  S["pray_confirm_make_box"] = function () { cs().boxes = []; save(); log("手工: 盒子已确认收下"); return {}; };

  /* push an update whenever a craft finishes, so the red dot appears without a manual reload */
  var lastSig = "";
  setInterval(function () {
    var c = cs();
    var sig = c.wishes.length + "/" + c.stamps.length + "/" + (c.wishNew ? c.wishNew.make_time : 0) + "/" + (c.stampNew ? c.stampNew.time : 0);
    if (pump()) { lastSig = ""; return; }
    if (sig !== lastSig) return;
  }, 3000);

  pump();
  log("handcraft ready: 祈愿 " + cs().wishes.length + ", 印章 " + cs().stamps.length);
  /* 诊断: 打开工作台时, 打印手工模型(FurnitureModel/HandCraftModel)里与"配方/开工"相关的状态, */
  /* 用于判定客户端到底缺哪个字段才会显示开工按钮。 */
  (function () {
    var n = 0;
    var iv = setInterval(function () {
      n++; if (n > 12) { clearInterval(iv); return; }
      try {
        var out = [];
        function dump(label, C) {
          if (typeof C !== 'function') return;
          try {
            var m = core.ModelManage.getInstance().getModel(C), d = m && (m.serverData || m.data);
            if (d) out.push(label + '{' + Object.keys(d).slice(0, 12).join(',') + '}');
          } catch (e) {}
        }
        dump('Fur', window.FurnitureModel);
        dump('Craft', window.HandCraftModel);
        if (typeof window.HandCraftModel === 'function') {
          try {
            var hm = core.ModelManage.getInstance().getModel(window.HandCraftModel);
            if (hm) out.push('pray=' + (hm.prayCraftList || []).length + ' stamp=' + (hm.stampCraftList || []).length + ' box=' + (hm.boxCraftList || []).length);
          } catch (e) {}
        }
        console.log('[MOCK] CRAFTSTATE ' + out.join(' | '));
      } catch (e) {}
    }, 4000);
  })();
})();
