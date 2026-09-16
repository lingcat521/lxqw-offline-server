/* lxqw offline cooking: 每月料理 (cooking_*) — additive layer.
 *
 * Client contract (CookingModel):
 *   serverData = { month, month_pro, week, complete, select, refresh_time, task_list }
 *   task entry = { id, pro, complete }   CookingTaskDB.get(id) = {dec, state, type}
 *     pgb_task.maximum = state, value = pro   ->  progress bar
 *     red dot fires while (pro == state && complete == 0)
 *   cooking_load_cooking  -> serverData
 *   cooking_complete_task(id) -> {code:0}  (client then sets complete + month_pro++)
 *   cooking_refresh_task(id)  -> {task}    (replaces that entry)
 *   cooking_start_cooking     -> {code:0}  (client marks the month complete and adds the dish)
 *   cooking_select(index)     -> {code:0}
 *   cooking_look_ad / cooking_share -> progress bumps for the matching task types
 * Task types (cookingTaskData): 1 登录 2 看广告 3 喂养访客 4 累计三叶草 5 旅行 6 照片
 *                               7 抽奖兑换 8 分享 — the counters we can really observe
 * are read live from MOCK_STATE, so the list tracks what the player actually did.
 */
(function () {
  var M = window.MockServer, st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  function log(m) { try { console.log("[MOCK] " + m); } catch (e) {} }
  /* tables/cookingTaskData_json.json */
  var TASK = {
    1: { type: 1, state: 1 }, 2: { type: 2, state: 1 }, 3: { type: 3, state: 1 }, 4: { type: 4, state: 80 },
    5: { type: 5, state: 1 }, 6: { type: 6, state: 1 }, 7: { type: 7, state: 1 }, 8: { type: 8, state: 1 }
  };
  var MONTH_TASKS = 6;                       /* cookingData[month].task_num */
  var MONTHS = 12;                           /* cookingData has 24 rows (2 cycles) */

  function nowSec() { return Math.floor(Date.now() / 1000); }
  function weekKey() { var d = new Date(); var onejan = new Date(d.getFullYear(), 0, 1); return d.getFullYear() * 100 + Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7); }
  function arr(v) { return Object.prototype.toString.call(v) === "[object Array]" ? v : []; }
  function save() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
  function counter(type) {
    switch (type) {
      case 4: return Number(st.clover) || 0;
      case 5: return Number(st.travelCount) || 0;
      case 6: return arr(st.photos).length;
      case 7: return arr(st.redeemed).length;
      case 3: return Number(st.visitorFeeds) || 0;
      default: return null;
    }
  }
  function cs() {
    var c = st.cooking;
    var month = new Date().getMonth() + 1;
    if (!c || typeof c !== "object" || c.month !== month) {
      c = st.cooking = { month: month, monthPro: 0, week: weekKey(), complete: false, select: 1,
                         refreshTime: nextMonday(), tasks: [], base: {}, claimed: {}, ad: 0, share: 0 };
      for (var i = 1; i <= MONTH_TASKS; i++) c.tasks.push({ id: i, pro: 0, complete: 0 });
      log("料理: 新的一月 " + month + " 月, 任务 " + MONTH_TASKS + " 个");
    }
    if (!c.base || typeof c.base !== "object") c.base = {};
    if (!c.claimed || typeof c.claimed !== "object") c.claimed = {};   /* 本窗已领过的任务 id */

    if (!Array.isArray(c.tasks) || !c.tasks.length) {
      c.tasks = [];
      for (var j = 1; j <= MONTH_TASKS; j++) c.tasks.push({ id: j, pro: 0, complete: 0 });
    }
    if (typeof c.week !== "number") c.week = weekKey();
    return c;
  }
  function nextMonday() { var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return Math.floor(d.getTime() / 1000); }

  function sync() {
    var c = cs(), wk = weekKey(), changed = false;
    if (c.week !== wk) { c.week = wk; c.ad = 0; c.share = 0; changed = true; }
    for (var i = 0; i < c.tasks.length; i++) {
      var t = c.tasks[i], cfg = TASK[t.id];
      if (!cfg) continue;
      if (t.complete) { if (t.pro !== cfg.state) { t.pro = cfg.state; changed = true; } continue; }
      var pro = t.pro;
      if (cfg.type === 1) pro = cfg.state;                      /* 每周登录: 打开即达成 */
      else if (cfg.type === 2) pro = Math.min(cfg.state, c.ad || 0);
      else if (cfg.type === 8) pro = Math.min(cfg.state, c.share || 0);
      else {
        var cur = counter(cfg.type);
        if (cur !== null) {
          if (typeof c.base[t.id] !== "number") { c.base[t.id] = cur; changed = true; }
          pro = Math.min(cfg.state, cur - c.base[t.id]);
        }
      }
      if (pro < 0) pro = 0;
      if (pro !== t.pro) { t.pro = pro; changed = true; }
    }
    if (changed) save();
    return c;
  }
  function data() {
    var c = sync();
    return { month: c.month, month_pro: c.monthPro, week: c.week, complete: c.complete,
             select: c.select, refresh_time: c.refreshTime,
             task_list: c.tasks.map(function (t) { return { id: t.id, pro: t.pro, complete: t.complete }; }) };
  }

  S["cooking_load_cooking"] = function () { return data(); };
  S["cooking_select"] = function (p) {
    var c = cs(), idx = Number(p && p.index);
    if (!(idx >= 1 && idx <= 2)) return { code: 1 };
    c.select = idx; save(); log("料理: 切换到 " + idx + " 号菜谱");
    return { code: 0 };
  };
  S["cooking_complete_task"] = function (p) {
    var c = sync(), id = Number(p && p.id);
    for (var i = 0; i < c.tasks.length; i++) {
      var t = c.tasks[i];
      if (t.id !== id) continue;
      var cfg = TASK[id];
      /* 去重: 换节气窗会重排任务(complete 被清), 没有这一层就能反复领同一档 */
      if (c.claimed[id]) { log("料理: 任务 " + id + " 本窗已领过, 拒绝重复"); return { code: 1 }; }
      if (cfg && t.pro >= cfg.state && !t.complete) {
        t.complete = 1; c.claimed[id] = 1; c.monthPro++;
        save(); log("料理: 任务 " + id + " 完成 (" + c.monthPro + ")");
        setTimeout(function () { try { M.dispatch("cooking_task_update", { task: { id: id, pro: cfg.state, complete: 1 } }); } catch (e) {} }, 30);
        return { code: 0 };
      }
      return { code: 1 };
    }
    return { code: 1 };
  };
  S["cooking_refresh_task"] = function (p) {
    var c = cs(), id = Number(p && p.id);
    for (var i = 0; i < c.tasks.length; i++) {
      if (c.tasks[i].id !== id) continue;
      c.tasks[i].pro = 0; c.tasks[i].complete = 0;
      var cur = counter((TASK[id] || {}).type);
      if (cur !== null) c.base[id] = cur;
      save(); log("料理: 刷新任务 " + id);
      return { task: { id: id, pro: 0, complete: 0 } };
    }
    return { task: null };
  };
  S["cooking_start_cooking"] = function () {
    var c = sync();
    var done = 0;
    for (var i = 0; i < c.tasks.length; i++) if (c.tasks[i].complete) done++;
    if (done < c.tasks.length) { log("料理: 还有 " + (c.tasks.length - done) + " 个任务没完成"); return { code: 1 }; }
    if (c.complete) return { code: 0 };
    c.complete = true;
    var dish = null;
    try {
      var dm = Tabikaeru.DataManager.instance();
      var cfg = dm && dm.CookingDB ? dm.CookingDB.get(c.month) : null;
      if (cfg && typeof cfg.item_id === "number") dish = cfg.item_id;
    } catch (e) {}
    save(); log("料理: " + c.month + " 月料理完成" + (dish !== null ? ", 获得菜品 item_id=" + dish : ""));
    return { code: 0, item_id: dish === null ? 0 : dish };
  };
  S["cooking_look_ad"] = function () { var c = cs(); c.ad = (c.ad || 0) + 1; save(); sync(); return { code: 0 }; };
  S["cooking_share"] = function () { var c = cs(); c.share = (c.share || 0) + 1; save(); sync(); return { code: 0 }; };

  setInterval(function () { var c = sync(); if (c && c.tasks && c.tasks.length) { /* keep counters fresh */ } }, 5000);
  sync();
  log("cooking ready: " + cs().month + " 月, " + cs().tasks.length + " 个任务");
})();
