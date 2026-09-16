/* lxqw 植物百科 / 旅行百科 — additive layer.
 *
 * 用户报：「植物百科，旅行百科没有做」。
 * 契约(notes/research_task_achieve_ency_story.md §3):
 *   encyclopedia_load / encytravel_load 客户端**从不主动请求**, 只能服务端 push;
 *   模型字段: unlock_list = [long_id...]（**长 id 行键**, 不是主 id!）
 *             unlock_desc = [{id:主id, list:[描述序号]}]
 *             show_sub    = [{id:主id, sub_id:long_id}]
 *   长 id 编码: 植物 = id*10000 + sub_id*100 + pic_id; 旅行 = id*10000 + sub_id。
 *   set_show_sub 的请求参数名是 **long_id**（以前我们读 p.id/p.sub_id -> 永远存不上）。
 *   ⚠️ 旅行百科 unlock_list 为空会**崩**: EncyTravelView.updatePicItems 对补位 {} 调
 *      ItemDB.get(undefined).type（它在 childrenCreated->setSelected(0) 里同步跑 = 窗口打不开）。
 *   所以两个列表都从客户端自己的表(list 的键)里生成, 永远不是空的, 也不可能出现非法长 id。
 *   解锁条件客户端根本没有(两张 desc 表只有文案), 于是由我们定:
 *     · 旅行百科: 曾经拥有/带出门过的 item_id 对应的条目(sub_id=1 主条目) + 保底第一条;
 *     · 植物百科: 种过/收获过的植物(st.flowerLog, 由种植层写入)对应的条目 + 保底第一条。
 */
(function () {
  var M = window.MockServer, st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  function log(m) { try { console.log('[MOCK] 百科: ' + m); } catch (e) {} }
  function save() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function dm() { try { return Tabikaeru.DataManager.instance(); } catch (e) { return null; } }
  function table(prop) {
    try { var d = dm(), t = d && (d[prop] || d[prop.charAt(0).toLowerCase() + prop.slice(1)]); return t || null; } catch (e) { return null; }
  }
  function rows(prop) {
    var t = table(prop); if (!t || typeof t.get !== 'function') return [];
    var l = t.get('list'); if (!l) return [];
    var o = [];
    for (var k in l) { var r = l[k]; if (r) { if (r.long_id === undefined) r.long_id = num(k); o.push(r); } }
    return o;
  }
  function descRows(prop) {
    var t = table(prop); if (!t || typeof t.get !== 'function') return [];
    var d = t.get('desc'); if (!d) return [];
    var o = [];
    for (var id in d) { var list = []; for (var k in d[id]) list.push(num(k)); o.push({ id: num(id), list: list }); }
    return o;
  }
  /* 玩家"见过"的物品: 仓库/背包/桌子 + 出行带过 + 商店买过 */
  function seenItems() {
    var seen = {};
    function add(id) { id = num(id); if (id > 0) seen[id] = 1; }
    var h = arr(st.house); for (var i = 0; i < h.length; i++) add(h[i] && h[i].item_id);
    arr(st.bag).forEach(add); arr(st.desk).forEach(add);
    var trip = arr(st.tripLog);
    for (var j = 0; j < trip.length; j++) arr(trip[j] && trip[j].items).forEach(add);
    var bought = arr(st.purchased); for (var k = 0; k < bought.length; k++) add(bought[k] && (bought[k].item_id !== undefined ? bought[k].item_id : bought[k].id));
    var gifts = arr(st.gifts); for (var g = 0; g < gifts.length; g++) add(gifts[g] && gifts[g].item_id);
    return seen;
  }
  function plantedPlants() {
    var out = {};
    var log = arr(st.flowerLog);
    for (var i = 0; i < log.length; i++) { var p = num(log[i] && (log[i].plant !== undefined ? log[i].plant : log[i].id)); if (p) out[p] = 1; }
    arr(st.flowerSeeds).forEach(function (p) { if (num(p)) out[num(p)] = 1; });
    return out;
  }
  function pickShow(key, id) {
    if (!st.encyShow || typeof st.encyShow !== 'object') st.encyShow = {};
    if (!st.encyShow[key] || typeof st.encyShow[key] !== 'object') st.encyShow[key] = {};
    return st.encyShow[key][num(id)] || 0;
  }
  function build(prop, unlockSet, showKey, minRow) {
    var all = rows(prop);
    var unlock = [], show = {}, desc = descRows(prop);
    var byMain = {};
    for (var i = 0; i < all.length; i++) {
      var r = all[i], lid = num(r.long_id);
      if (!lid) continue;
      if (!byMain[num(r.id)]) byMain[num(r.id)] = lid;                 /* 每条主 id 的兜底条目 */
      if (unlockSet[String(lid)] || (r.sub_id === 1 && unlockSet['main:' + num(r.id)])) {
        unlock.push(lid);
        var cur = pickShow(showKey, r.id);
        show[num(r.id)] = cur ? cur : lid;                              /* 没有选择就默认第一条解锁的 */
      }
    }
    if (!unlock.length && minRow) {                                     /* 保底: 绝不给空数组(旅行百科会崩) */
      for (var j = 0; j < minRow.length; j++) { if (minRow[j]) { unlock.push(num(minRow[j])); } }
      if (minRow.length && all.length) { var f = all[0]; show[num(f.id)] = num(f.long_id); }
      if (!unlock.length && all.length) unlock.push(num(all[0].long_id));
    }
    var showArr = [];
    for (var id in show) showArr.push({ id: num(id), sub_id: num(show[id]) });
    return { unlock_list: unlock, unlock_desc: desc, show_sub: showArr };
  }
  function travelUnlock() {
    var all = rows('encyTravelData'), seen = seenItems(), set = {};
    for (var i = 0; i < all.length; i++) {
      var r = all[i], iid = num(r.item_id);
      if (iid > 0 && seen[iid]) { set[String(num(r.long_id))] = 1; set['main:' + num(r.id)] = 1; }
    }
    return set;
  }
  function plantUnlock() {
    var all = rows('encyData'), planted = plantedPlants(), set = {};
    for (var i = 0; i < all.length; i++) {
      var r = all[i];
      /* 植物表的 sub_id 是"品种序号", 名字形如 「角堇·火龙果」; 种植层按主 id 记(log.plant=101) 就整株解锁 */
      if (planted[num(r.id)] || (r.item_id && planted[num(r.item_id)])) set[String(num(r.long_id))] = 1;
    }
    return set;
  }
  var lastSig = '';
  function payload(kind) {
    if (kind === 'travel') return build('encyTravelData', travelUnlock(), 'travel', [firstLong('encyTravelData')]);
    return build('encyData', plantUnlock(), 'plant', [firstLong('encyData')]);
  }
  function firstLong(prop) { var all = rows(prop); return all.length ? num(all[0].long_id) : 0; }
  S['encyclopedia_load'] = function () { return payload('plant'); };
  S['encytravel_load'] = function () { return payload('travel'); };
  function setShow(kind, p) {
    var lid = num(p && (p.long_id !== undefined ? p.long_id : (p.sub_id !== undefined ? p.sub_id : p.id)));
    if (!lid) { log('set_show_sub 缺少 long_id'); return { code: 1 }; }
    var prop = kind === 'travel' ? 'encyTravelData' : 'encyData';
    var all = rows(prop), hit = null;
    for (var i = 0; i < all.length; i++) if (num(all[i].long_id) === lid) hit = all[i];
    if (!hit) { log('set_show_sub: 表里没有 long_id ' + lid); return { code: 1 }; }
    if (!st.encyShow || typeof st.encyShow !== 'object') st.encyShow = {};
    var key = kind === 'travel' ? 'travel' : 'plant';
    if (!st.encyShow[key] || typeof st.encyShow[key] !== 'object') st.encyShow[key] = {};
    st.encyShow[key][num(hit.id)] = lid;
    save();
    log('切换展示 ' + (kind === 'travel' ? '旅行' : '植物') + '百科 id=' + hit.id + ' -> long_id ' + lid + ' (' + hit.sub_name + ')');
    return { code: 0 };
  }
  S['encyclopedia_set_show_sub'] = function (p) { return setShow('plant', p); };
  S['encytravel_set_show_sub'] = function (p) { return setShow('travel', p); };

  /* 解锁面变化就 push(客户端两个 *Data.load 都只在 push 时刷新) */
  function tick() {
    try {
      var a = payload('plant'), b = payload('travel');
      var sig = a.unlock_list.length + '/' + b.unlock_list.length + '/' + JSON.stringify(a.show_sub) + JSON.stringify(b.show_sub);
      if (sig === lastSig) return;
      var first = !lastSig;
      var hasData = a.unlock_list.length > 0 || b.unlock_list.length > 0;
      lastSig = sig;
      /* 层加载时客户端表还没就绪(日志里出现过"植物 0/0 条"), 拿到真实数据后要立刻补推一次 ——
         旅行百科 unlock_list 为空会让窗口直接打不开, 不能等"第二次变化" */
      if (first && !hasData) return;
      try { M.dispatch('encyclopedia_load', a); } catch (e) {}
      try { M.dispatch('encytravel_load', b); } catch (e) {}
      log('图鉴' + (first ? '首次' : '更新') + ' -> 植物 ' + a.unlock_list.length + ' 条 / 旅行 ' + b.unlock_list.length + ' 条');
    } catch (e) {}
  }
  setInterval(tick, 2500);   /* 前几秒就绪后尽快补推(见上) */
  window.MOCK_ENCY = { plant: function () { return payload('plant'); }, travel: function () { return payload('travel'); }, rows: rows, setShow: setShow };
  var p0 = payload('plant'), t0 = payload('travel');
  log('图鉴层就绪: 植物 ' + p0.unlock_list.length + '/' + rows('encyData').length + ' 条, 旅行 ' + t0.unlock_list.length + '/' + rows('encyTravelData').length + ' 条');
})();
