/* lxqw offline museumday: 博物馆日/春游探索 (限时活动, museumday_*) — additive layer.
 *
 * Client contract (MuseumDayModel):
 *   data = { end_time, inspire_num, inspire_time, museum_list, cur_museum, compass, task_num,
 *            frog, next, left_num, desc_id, pic_id, items[], get_items[], log_list[], path[] }
 *     isOpen() = now in [1, end_time]; checkRedot() fires while path.length != next && compass > 0
 *   museumday_start_advance(id) -> {code:0}  (client pays clover then re-requests the load)
 *   museumday_dir_compass(dir)  -> {code:0}
 *   museumday_random_compass()  -> {next, inspire}      (applied only when next changed)
 *   museumday_inspire()         -> {next}               (same rule)
 *   museumday_get_items()       -> {code:0}             (client moves items -> get_items)
 *   museumday_refresh()         -> {left_num} (-1 = unchanged)
 *   museumday_arrive()          -> {} (fire and forget)
 *   museumday_info()            -> {compass, task_num}
 * Museum ids/pic/collection ids come from the client's museumDayData + museumData tables, and
 * collecting a piece also unlocks it in the 图鉴 (st.collections, see handbook.js).
 */
(function () {
  var M = window.MockServer, st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  function log(m) { try { console.log("[MOCK] " + m); } catch (e) {} }
  var OPEN_DAYS = 7, MOVES = 12;

  function dm() { try { return Tabikaeru.DataManager.instance(); } catch (e) { return null; } }
  function table(name, key) {
    try { var d = dm(); var t = d ? d[name] : null; return (t && t.get) ? t.get(key) : null; } catch (e) { return null; }
  }
  function museumIds() {
    var o = [];
    try {
      var d = dm(), t = d && d.MuseumDayData;
      if (t && t.list) { var l = t.list(); for (var i = 0; i < l.length; i++) o.push(Number(l[i].id)); }
    } catch (e) {}
    if (!o.length) o = [1, 2, 3, 4];
    return o;
  }
  function museumCfg(id) {
    try {
      var d = dm(), t = d && d.MuseumData;
      if (t && t.get) return t.get(id);
    } catch (e) {}
    return null;
  }
  function collectionIds(museumId) {
    var cfg = museumCfg(museumId);
    if (cfg && cfg.collection_id) return String(cfg.collection_id).split(",").map(function (x) { return Number(x); });
    return [34, 35, 36, 37];
  }

  function ms() {
    var m = st.museumday, now = Math.floor(Date.now() / 1000);
    if (!m || typeof m !== "object") m = st.museumday = {};
    if (!Array.isArray(m.museumList) || !m.museumList.length) m.museumList = museumIds();
    if (typeof m.curMuseum !== "number" || !m.curMuseum) m.curMuseum = m.museumList[0];
    if (typeof m.compass !== "number") m.compass = 1;
    if (typeof m.next !== "number" || m.next < 1) m.next = 1;
    if (!Array.isArray(m.path)) m.path = [];
    if (!Array.isArray(m.items)) m.items = [];
    if (!Array.isArray(m.getItems)) m.getItems = [];
    if (!Array.isArray(m.logList)) m.logList = [];
    if (typeof m.leftNum !== "number") m.leftNum = MOVES;
    if (typeof m.inspireNum !== "number") m.inspireNum = Number((table("MuseumDayCommonData", "inspire") || {}).v1) || 3;
    if (typeof m.inspireTime !== "number") m.inspireTime = 0;
    if (typeof m.taskNum !== "number") m.taskNum = 0;
    if (typeof m.frog !== "number") m.frog = 0;
    /* 限时活动只在真实日历窗口内开启: 客户端 isOpen() = now in [1, end_time],
       end_time = 0 即隐藏活动(以前这里无条件 now+7 天, 所以 9 月也会弹春节活动) */
    var __win = window.MOCK_CALENDAR ? window.MOCK_CALENDAR.activity('museumday') : null;
    if (__win && !__win.active) { m.endTime = 0; return m; }
    if (typeof m.endTime !== "number" || m.endTime <= now || (__win && __win.end && m.endTime > __win.end))
      m.endTime = (__win && __win.end) ? __win.end : now + OPEN_DAYS * 86400;
    return m;
  }
  function save() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
  function push(name, d) { setTimeout(function () { try { M.dispatch(name, (typeof S[name] === "function" ? S[name]() : S[name])); } catch (e) {} }, d || 40); }
  function rollTile() {
    var m = ms();
    var ids = collectionIds(m.curMuseum);
    var pick = null;
    for (var i = 0; i < ids.length; i++) {
      var owned = false;
      for (var j = 0; j < m.getItems.length; j++) if (Number(m.getItems[j].item_id) === ids[i]) owned = true;
      if (!owned) { pick = ids[i]; break; }
    }
    m.items = (pick === null) ? [] : [{ item_id: pick, num: 1 }];
    return m.items.length;
  }
  function data() {
    var m = ms();
    return { end_time: m.endTime, inspire_num: m.inspireNum, inspire_time: m.inspireTime,
             museum_list: m.museumList.slice(), cur_museum: m.curMuseum, compass: m.compass,
             task_num: m.taskNum, frog: m.frog, next: m.next, left_num: m.leftNum,
             desc_id: 0, pic_id: 0, items: m.items.slice(), get_items: m.getItems.slice(),
             log_list: m.logList.slice(), path: m.path.slice() };
  }

  S["museumday_load"] = function () { return data(); };
  S["museumday_info"] = function () { var m = ms(); return { compass: m.compass, task_num: m.taskNum }; };
  S["museumday_arrive"] = function () { var m = ms(); m.taskNum += 1; save(); log("博物馆: 到达 " + m.curMuseum + " 号馆 (第 " + m.taskNum + " 次)"); return {}; };
  S["museumday_dir_compass"] = function (p) {
    var m = ms(), dir = Number(p && p.dir);
    m.compass = dir || 1;
    save(); log("博物馆: 罗盘指向 " + m.compass);
    return { code: 0 };
  };
  S["museumday_random_compass"] = function () {
    var m = ms();
    advance(false);
    save(); log("博物馆: 随机罗盘 -> next=" + m.next + " (剩余 " + m.inspireNum + ")");
    return { next: m.next, inspire: m.inspireNum };
  };
  S["museumday_inspire"] = function () {
    var m = ms();
    if (m.inspireNum <= 0) { log("博物馆: 灵感用完了"); return { next: m.next }; }
    m.inspireNum -= 1;
    advance(false);
    save(); log("博物馆: 使用灵感 -> next=" + m.next + " (剩 " + m.inspireNum + ")");
    return { next: m.next };
  };
  S["museumday_start_advance"] = function (p) {
    var m = ms();
    if (m.leftNum <= 0) { log("博物馆: 探索次数用完了"); return { code: 1 }; }
    advance(true);
    save(); log("博物馆: 前进到第 " + m.next + " 格 (剩余 " + m.leftNum + " 步)");
    return { code: 0 };
  };
  function advance(costMove) {
    var m = ms();
    if (costMove) m.leftNum = Math.max(0, m.leftNum - 1);
    m.path.push(m.next);
    m.next = m.next + 1;
    var n = rollTile();
    log("博物馆: 第 " + m.next + " 格" + (n ? " 发现纪念品 " + m.items[0].item_id : " 空手而归"));
  }
  S["museumday_get_items"] = function () {
    var m = ms(), got = 0;
    for (var i = 0; i < m.items.length; i++) {
      var it = m.items[i];
      m.getItems.push({ item_id: it.item_id, num: it.num });
      got++;
      if (!Array.isArray(st.collections)) st.collections = [];
      if (st.collections.indexOf(Number(it.item_id)) < 0) st.collections.push(Number(it.item_id));   /* 图鉴 */
      if (Number(it.item_id) !== 200002) {
        if (!Array.isArray(st.house)) st.house = [];
        var found = false;
        for (var k = 0; k < st.house.length; k++) if (st.house[k] && Number(st.house[k].item_id) === Number(it.item_id)) { st.house[k].count = (st.house[k].count || 0) + it.num; found = true; }
        if (!found) st.house.push({ item_id: Number(it.item_id), count: it.num });
      }
    }
    m.items = [];
    save();
    if (got) { push("item_load_items", null, 40); push("item_load_handbook", null, 60); }
    log("博物馆: 收下 " + got + " 件纪念品 (共 " + m.getItems.length + " 件, 图鉴 " + (st.collections || []).length + ")");
    return { code: 0 };
  };
  S["museumday_refresh"] = function () {
    var m = ms();
    m.leftNum = MOVES;
    save(); log("博物馆: 刷新探索次数 -> " + m.leftNum);
    return { left_num: m.leftNum };
  };

  rollTile();
  log("museumday ready: " + ms().museumList.length + " 个博物馆, 有效至 " + new Date(ms().endTime * 1000).toISOString().slice(0, 10));
})();
