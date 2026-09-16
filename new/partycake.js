/* lxqw offline partycake: 蛋糕派对 (限时活动, partycake_*) — additive layer.
 *
 * Client contract (PartyCakeModel + PartyCakeView):
 *   data = { end_time, cream, sugar, pre_cream, pre_sugar, cur_state, part, layers[],
 *            task_list[], guest, wrong, answer[], reward[], share_get[] }
 *   isOpen() = now in [1, end_time]        -> end_time 0 hides the activity
 *   PartyCakeState = { making:0, make_reward:1, qa:2, qa_reward:3, light:4, light_reward:5, complete:6 }
 *   req_make(layer)        : client accepts the answer only when cur_state != state, so a
 *                            successful make answers state = make_reward(1)
 *   req_reward_make()      : claim the layer reward; state goes back to making(0) (or on to
 *                            qa(2) once every part is done) and the client runs checkMakePart()
 *   req_answer / req_light : qa(2) -> qa_reward(3) -> light(4) -> light_reward(5) -> complete(6)
 *   Layer ids, costs (cream/sugar) and the items they produce all come from the client's own
 *   partycakeData table ("cake" -> part -> layers), the candle reward from light_reward.
 *
 * 每周任务(用户报「娃娃的聚会活动中，每周任务无法正常完成」):
 *   面板标题是 "*每周一0点刷新任务"，数据来自客户端表 partycakeData.task_list:
 *     1 登录游戏(3) | 2 商店买买买(2) | 3 商店抽奖一次(3) | 4 看一次广告(3)
 *     5 完成一次分享(3) | 6 聚会或是旅行(2)      括号里是 total(次数)，奖励 cream/sugar
 *   客户端**不做任何本地判定**：
 *     my.min.js: this.data.task_list[e.task.id-1] = e.task        (partycake_load_task push)
 *     PartyCakeView: s.push({id:a.id, count:a.count, is_done:a.is_done, cfg:表[ id ]})
 *     PartyCakeTaskItem: imageDone.visible = (1 == data.is_done) ... 目标值读 cfg.total
 *   所以次数与完成标记**必须由服务端算并推**，以前我们 taskList() 永远回 {count:0,is_done:0}
 *   -> 玩家怎么做任务都不会动(用户看到的 bug)。
 *   奖励同样由服务端给：完成后记到 pre_cream/pre_sugar，客户端视图每次 LOAD 时若
 *   (pre_cream>0||pre_sugar>0) 就自动 req_get_mate() 领取并弹 ItemRewardView(200006 奶油/200007 糖)；
 *   partycake_get_mate 的应答 code==0 时客户端会自己把 pre 并进 cream/sugar，
 *   我们必须在那一刻**同步自己的状态**(pre -> cream)，否则下次 partycake_load 又变回去。
 *   任务 4「看一次广告」离线做不了(本包 client_set_ads support=false)，客户端也把它过滤掉；
 *   任务 3「商店抽奖一次」虽然名字带商店，但客户端在 supportAds()==false 时**仍会显示**，
 *   所以照常计数。
 *   计数来源: 1=收到 client_load_role 请求(每次进游戏记一次) 2=item_buy 成功
 *             3=item_gacha 成功(抽奖) 4=(广告, 无渠道) 5=partycake_reward_share / share_get_reward
 *             6=出发(item_set_bag_completed 后真的在旅行) 或 发起聚会(MOCK_PARTY.start)
 *   周一 0 点(本地时间)整周重置：ks() 发现 week 变了就把次数清零。
 */
(function () {
  var M = window.MockServer, st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  function log(m) { try { console.log("[MOCK] " + m); } catch (e) {} }
  var ST = { making: 0, make_reward: 1, qa: 2, qa_reward: 3, light: 4, light_reward: 5, complete: 6 };
  var OPEN_DAYS = 7, TASKS = 6;
  /* 表读不到时的兜底(值取自 tables/PartyCakeData_json.json 的 task_list) */
  var TASK_FALLBACK = {
    1: { total: 3, cream: 1, sugar: 0, name: "登录游戏" },
    2: { total: 2, cream: 2, sugar: 0, name: "商店买买买" },
    3: { total: 3, cream: 2, sugar: 2, name: "商店抽奖一次" },
    4: { total: 3, cream: 2, sugar: 2, name: "看一次广告" },
    5: { total: 3, cream: 2, sugar: 2, name: "完成一次分享" },
    6: { total: 2, cream: 2, sugar: 1, name: "聚会或是旅行" }
  };

  function table(key) {
    try { var dm = Tabikaeru.DataManager.instance(); return (dm && dm.partycakeData) ? dm.partycakeData.get(key) : null; } catch (e) { return null; }
  }
  function cake() { var c = table("cake"); return c || null; }
  function parts() { var c = cake(); if (!c) return []; var o = []; for (var k in c) o.push(k); o.sort(function (a, b) { return Number(a) - Number(b); }); return o; }
  function layerCfg(part, layer) {
    var c = cake();
    if (!c || !c[part] || !c[part].layers) return null;
    return c[part].layers[layer] || null;
  }
  function layerCount(part) { var c = cake(); if (!c || !c[part] || !c[part].layers) return 0; var n = 0; for (var k in c[part].layers) n++; return n; }
  function totalCost() {
    var c = cake(), cream = 0, sugar = 0;
    if (!c) return { cream: 60, sugar: 60 };
    for (var p in c) { var ls = c[p].layers || {}; for (var l in ls) { cream += Number(ls[l].cream) || 0; sugar += Number(ls[l].sugar) || 0; } }
    return { cream: cream + 10, sugar: sugar + 10 };
  }
  function taskCfg(id) {
    var t = table("task_list"), row = t ? t[String(id)] : null;
    if (row && Number(row.total) > 0) {
      return { total: Number(row.total), cream: Number(row.cream) || 0, sugar: Number(row.sugar) || 0, name: row.name || "" };
    }
    return TASK_FALLBACK[id] || { total: 1, cream: 0, sugar: 0, name: "" };
  }
  /* 周一 00:00(本地时间)所在的那一秒 —— 用它做"本周"的 key */
  function weekStart(sec) {
    var d = new Date((sec || Math.floor(Date.now() / 1000)) * 1000);
    var back = (d.getDay() + 6) % 7;                 /* 0=周一 .. 6=周日 */
    var mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - back, 0, 0, 0, 0);
    return Math.floor(mon.getTime() / 1000);
  }

  function ks() {
    var k = st.cake, now = Math.floor(Date.now() / 1000);
    if (!k || typeof k !== "object") k = st.cake = {};
    var need = totalCost();
    if (!Array.isArray(k.layers)) k.layers = [];
    if (typeof k.part !== "number" || k.part < 1) k.part = 1;
    if (typeof k.curState !== "number") k.curState = ST.making;
    /* supplies are granted once, then really get consumed; a drained pot is refilled
       on demand inside partycake_make so the activity can never soft-lock */
    if (typeof k.cream !== "number") k.cream = need.cream;
    if (typeof k.sugar !== "number") k.sugar = need.sugar;
    if (!Array.isArray(k.shareGet)) k.shareGet = [];
    if (typeof k.endTime !== "number" || k.endTime <= now) k.endTime = now + OPEN_DAYS * 86400;
    if (typeof k.preCream !== "number") k.preCream = 0;
    if (typeof k.preSugar !== "number") k.preSugar = 0;
    var wk = weekStart(now);
    if (!k.tasks || typeof k.tasks !== "object") k.tasks = { week: wk, c: {}, done: {} };
    if (k.tasks.week !== wk) {
      log("每周任务: 新的一周(" + new Date(wk * 1000).toISOString().slice(0, 10) + "), 次数清零, 上周完成 " +
          Object.keys(k.tasks.done || {}).length + " 个");
      k.tasks = { week: wk, c: {}, done: {} };
    }
    if (!k.tasks.c || typeof k.tasks.c !== "object") k.tasks.c = {};
    if (!k.tasks.done || typeof k.tasks.done !== "object") k.tasks.done = {};
    return k;
  }
  function save() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
  /* push(协议名, 数据(=对象/函数, 省略或 null 就用 S[协议名]()), 延迟ms) */
  function push(name, d, delay) {
    setTimeout(function () {
      try {
        var payload = (d === undefined || d === null)
          ? (typeof S[name] === 'function' ? S[name]() : S[name])
          : (typeof d === 'function' ? d() : d);
        M.dispatch(name, payload);
      } catch (e) {}
    }, delay || 40);
  }
  function grantHouseItem(itemId, num) {
    if (!Array.isArray(st.house)) st.house = [];
    for (var i = 0; i < st.house.length; i++) if (st.house[i] && st.house[i].item_id === itemId) { st.house[i].count = (st.house[i].count || 0) + num; push("item_load_items", null, 60); return; }
    st.house.push({ item_id: itemId, count: num });
    push("item_load_items", null, 60);
  }

  /* ---------- 每周任务 ---------------------------------------------------- */
  function taskObj(id) {
    var k = ks(), cfg = taskCfg(id), c = Number(k.tasks.c[id]) || 0;
    return { id: id, pro: c, count: c, complete: cfg.total, is_done: (c >= cfg.total) ? 1 : 0 };
  }
  function taskList() { var o = []; for (var i = 1; i <= TASKS; i++) o.push(taskObj(i)); return o; }
  /* 进度 +1: 完成时把奖励挂到 pre_cream/pre_sugar, 并推 partycake_load(视图开着会自动领奖) */
  function pro(id, n) {
    if (!(id >= 1 && id <= TASKS)) return false;
    var k = ks(), cfg = taskCfg(id), c = Number(k.tasks.c[id]) || 0;
    if (k.tasks.done[id] || c >= cfg.total) return false;
    c += (n || 1);
    k.tasks.c[id] = c;
    var done = c >= cfg.total;
    if (done) {
      k.tasks.done[id] = 1;
      k.preCream += cfg.cream; k.preSugar += cfg.sugar;
      log("每周任务 " + id + "「" + cfg.name + "」完成 (" + c + "/" + cfg.total + ") -> 奶油+" + cfg.cream + " 糖+" + cfg.sugar + " 待领");
    } else {
      log("每周任务 " + id + "「" + cfg.name + "」 " + c + "/" + cfg.total);
    }
    save();
    push("partycake_load_task", { task: taskObj(id) });
    if (done) push("partycake_load", function () { return data(); });
    return true;
  }
  function taskState() {
    var k = ks(), o = { week: k.tasks.week, weekDate: new Date(k.tasks.week * 1000).toISOString(), preCream: k.preCream, preSugar: k.preSugar, tasks: [] };
    for (var i = 1; i <= TASKS; i++) {
      var cfg = taskCfg(i), t = taskObj(i);
      o.tasks.push({ id: i, name: cfg.name, count: t.count, total: cfg.total, is_done: t.is_done, reward: { cream: cfg.cream, sugar: cfg.sugar } });
    }
    return o;
  }
  /* 测试/GM 用: 整周重置 */
  function resetTasks() { var k = ks(); k.tasks = { week: weekStart(), c: {}, done: {} }; save(); return taskState(); }

  function data() {
    var k = ks();
    return { end_time: k.endTime, cream: k.cream, sugar: k.sugar, pre_cream: k.preCream, pre_sugar: k.preSugar,
             cur_state: k.curState, part: k.part, layers: k.layers.slice(),
             task_list: taskList(), share_get: k.shareGet.slice() };
  }

  S["partycake_load"] = function () { return data(); };
  S["partycake_load_mate"] = function () { var k = ks(); return { pre_cream: k.preCream, pre_sugar: k.preSugar }; };
  /* 客户端 req_get_mate 的应答: code 0 时它自己把 pre 并进 cream/sugar, 我们这里同步状态 */
  S["partycake_get_mate"] = function () {
    var k = ks();
    if (k.preCream > 0 || k.preSugar > 0) {
      log("每周任务奖励到账: 奶油+" + k.preCream + " 糖+" + k.preSugar);
      k.cream += k.preCream; k.sugar += k.preSugar;
      k.preCream = 0; k.preSugar = 0; save();
    }
    return { code: 0, cream: k.cream, sugar: k.sugar };
  };
  S["partycake_load_task"] = function () { var l = taskList(); return { task: l[0] || null, list: l }; };
  S["partycake_load_qa"] = function () { return { guest: 0, wrong: 0, answer: [], reward: [] }; };
  S["partycake_reward_share"] = function () { var k = ks(); k.shareGet.push(1); save(); pro(5, 1); return { code: 0 }; };
  S["partycake_reward_qa"] = function () { var k = ks(); if (k.curState !== ST.qa_reward) return { state: k.curState }; k.curState = ST.light; save(); log("蛋糕: 问答完成 -> 点蜡烛"); return { state: k.curState }; };
  S["partycake_reward_light"] = function () {
    var k = ks();
    if (k.curState !== ST.light_reward) return { state: k.curState };
    k.curState = ST.complete;
    var rw = table("light_reward");
    if (rw && rw.item_id) grantHouseItem(Number(rw.item_id), Number(rw.item_num) || 1);
    save(); log("蛋糕: 点亮完成, 派对结束" + (rw ? " 奖励 item " + rw.item_id : ""));
    return { state: k.curState };
  };
  S["partycake_light"] = function () {
    var k = ks();
    if (k.curState !== ST.light) return { state: k.curState };
    k.curState = ST.light_reward; save(); log("蛋糕: 蜡烛点亮 -> 领奖");
    return { state: k.curState };
  };
  S["partycake_answer"] = function (p) {
    var k = ks();
    if (k.curState !== ST.qa) return { state: k.curState };
    k.curState = ST.qa_reward; save(); log("蛋糕: 答题 " + JSON.stringify(p || {}) + " -> 领奖");
    return { state: k.curState };
  };
  S["partycake_reward_make"] = function () {
    var k = ks();
    if (k.curState !== ST.make_reward) return { state: k.curState };
    var cfg = layerCfg(k.part, k.layers.length ? k.layers[k.layers.length - 1] : 1);
    if (cfg && cfg.item_id) grantHouseItem(Number(cfg.item_id), Number(cfg.item_num) || 1);
    k.curState = ST.making;
    /* 客户端 checkMakePart(): 本层做满就进位到下一部分 */
    if (k.layers.length >= layerCount(k.part)) {
      k.part += 1;
      k.layers = [];
      if (layerCount(k.part) === 0) { k.curState = ST.qa; log("蛋糕: 全部完成 -> 问答环节"); }
    }
    save();
    if (k.curState === ST.making) log("蛋糕: " + (cfg ? cfg.l_name : "一层") + " 收下, 共 " + k.layers.length + "/" + layerCount(k.part) + " 层 (第 " + k.part + " 部分)");
    return { state: k.curState };
  };
  S["partycake_make"] = function (p) {
    var k = ks(), layer = Number(p && p.layer !== undefined ? p.layer : p && p.id);
    if (k.curState !== ST.making) { log("蛋糕: 现在不是制作阶段 (state=" + k.curState + ")"); return { state: k.curState }; }
    var cfg = layerCfg(k.part, layer);
    if (!cfg) { log("蛋糕: 第 " + k.part + " 部分没有第 " + layer + " 层"); return { state: k.curState }; }
    if (k.cream < cfg.cream || k.sugar < cfg.sugar) {
      var need = totalCost();
      log("蛋糕: 材料不够 (奶油 " + k.cream + "/" + cfg.cream + ", 糖 " + k.sugar + "/" + cfg.sugar + ") -> 补给到 " + need.cream + "/" + need.sugar);
      k.cream = need.cream; k.sugar = need.sugar;
    }
    k.cream -= Number(cfg.cream) || 0;
    k.sugar -= Number(cfg.sugar) || 0;
    k.layers.push(layer);
    k.curState = ST.make_reward;         /* 必须与客户端当前 state 不同, 客户端才会记下这一层 */
    save();
    log("蛋糕: 做出 " + cfg.l_name + " (剩 奶油 " + k.cream + " 糖 " + k.sugar + ")");
    return { state: k.curState };
  };

  /* ---------- 计数来源 ----------------------------------------------------
     统一包在 Mock.handle 上: 只有玩家真的做了那件事(应答成功/状态真的变了)才计数。
     item_gacha 定义在 raffle.js(本层之后加载) —— 包 handle 而不是包协议函数, 顺序就无所谓了。 */
  var loginCounted = false;
  var prevHandle = M.handle;
  M.handle = function (name, params) {
    var r = prevHandle.apply(this, arguments);
    try {
      if (name === "client_load_role") {
        if (!loginCounted) { loginCounted = true; pro(1, 1); }
      } else if (name === "item_buy") {
        if (r && Number(r.code) === 0) pro(2, 1);
      } else if (name === "item_gacha") {
        if (r && Number(r.ticket) !== -1) pro(3, 1);       /* raffle.js: 券不够回 {ticket:-1} */
      } else if (name === "share_get_reward" || name === "client_share_publicity") {
        if (!r || r.code === undefined || Number(r.code) === 0) pro(5, 1);
      }
    } catch (e) { try { console.log("[MOCK] 每周任务计数出错 " + name + ": " + (e && e.message || e)); } catch (e2) {} }
    return r;
  };

  /* 其它层(party.js 发起聚会)与测试/GM 的入口 */
  window.MOCK_CAKE_TASK = {
    pro: pro,
    state: taskState,
    reset: resetTasks,
    weekStart: weekStart,
    data: data
  };

  var first = ks();
  log("partycake ready: 有效至 " + new Date(first.endTime * 1000).toISOString().slice(0, 10) + ", " + parts().length + " 个部分, 每周任务 " +
      new Date(first.tasks.week * 1000).toISOString().slice(0, 10) + " 起 " + TASKS + " 个");
})();
