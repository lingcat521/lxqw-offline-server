/* lxqw 旅行地图 / 地点图鉴(离线) —— new/maploc.js
 *   用户表(2026-09-16): 地图分区域(南/北/西南/东部…), 每个区域下若干景点;
 *   初始全灰(未知) -> 青蛙**到达该地点或寄回该地明信片**时点亮 -> 显示 已解锁/总数 进度;
 *   与相册联动: 点已解锁地点能看到该地拍到的照片。
 *   表: new/map_locations.js(由 GoalNumber 38 个目的地生成, 带 region/坐标/关联照片)
 *   解锁时机: 旅行归来(TRAVEL_BACK) 拿 st.tripRoute.place; 收明信片时按照片的 place 解锁。
 */
(function () {
  var st = window.MOCK_STATE || (window.MOCK_STATE = {});
  function log(m) { try { console.log('[MOCK] 地图: ' + m); } catch (e) {} }
  function save() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function push(name, d, t) { setTimeout(function () { try { window.MockServer.dispatch(name, (typeof d === 'function' ? d() : d)); } catch (e) {} }, t || 60); }
  function L() { return window.MOCK_MAP_LOCATIONS || { locations: [] }; }
  function PATHS() { return window.MOCK_MAP_PATHS || { nodes: {}, edges: [], region_mapping: {} }; }
  /* 区内链式图: 从起点 0 到某城市的路径(经过的中间城市一起解锁) —— 用用户表的 from/to 边做 BFS */
  function pathTo(cityPlaceId) {
    var P = PATHS(), nodes = P.nodes || {}, edges = P.edges || [];
    var target = null, k;
    for (k in nodes) if (Number(nodes[k].place_id) === Number(cityPlaceId)) target = k;
    if (!target) return [];
    var adj = {}, i;
    for (i = 0; i < edges.length; i++) {
      var e = edges[i];
      (adj[e.from] = adj[e.from] || []).push({ to: e.to, e: e });
      (adj[e.to] = adj[e.to] || []).push({ to: e.from, e: e });
    }
    var prev = { '0': null }, q = ['0'], seen = { '0': 1 };
    while (q.length) {
      var cur = q.shift();
      if (cur === target) break;
      var nb = adj[cur] || [];
      for (i = 0; i < nb.length; i++) if (!seen[nb[i].to]) { seen[nb[i].to] = 1; prev[nb[i].to] = cur; q.push(nb[i].to); }
    }
    var out = [], c = target;
    while (c && c !== '0') { var n = nodes[c]; if (n && Number(n.place_id)) out.unshift(Number(n.place_id)); c = prev[c]; }
    return out;
  }
  function unlocked() { st.mapUnlocked = arr(st.mapUnlocked); return st.mapUnlocked; }
  function loc(id) {
    var a = L().locations || [];
    for (var i = 0; i < a.length; i++) if (num(a[i].id) === num(id)) return a[i];
    return null;
  }
  function photosOf(place) {
    var out = [], ps = arr(st.photos);
    for (var i = 0; i < ps.length; i++) {
      var pid = num(ps[i] && (ps[i].pic_id !== undefined ? ps[i].pic_id : ps[i].id));
      try {
        var row = Tabikaeru.DataManager.instance().PictureDB.get(pid);
        if (row && num(row.place) === num(place)) out.push(pid);
      } catch (e) {}
    }
    return out;
  }
  function unlock(id, why) {
    var l = loc(id);
    if (!l) return null;
    if (unlocked().indexOf(num(id)) >= 0) return null;
    unlocked().push(num(id));
    save();
    log('点亮 ' + l.name + '(' + l.region_cn + ') [' + (why || '') + '] -> 进度 ' + unlocked().length + '/' + (L().locations || []).length);
    push('map_load', load(), 70);
    /* 增量包(用户表): 只带 {location_id,x,y,region} —— 客户端只需把灰度点亮点, 零渲染压力 */
    push('map_unlock', { location_id: num(id), x: num(l.x), y: num(l.y), region: l.region, name: l.name }, 90);
    return l;
  }
  function load() {
    var all = L().locations || [], out = [], i;
    for (i = 0; i < all.length; i++) {
      var u = unlocked().indexOf(num(all[i].id)) >= 0;
      out.push({ id: num(all[i].id), name: all[i].name, region: all[i].region, region_cn: all[i].region_cn,
                 x: num(all[i].x), y: num(all[i].y), unlocked: u ? 1 : 0, photos: u ? photosOf(all[i].id).length : 0 });
    }
    return { locations: out, unlocked: unlocked().length, total: all.length, regions: (L().regions || []) };
  }
  /* 归来: 解锁本次目的地 + 顺手按本次明信片解锁(寄回照片也算) */
  (function () {
    var prev = window.MOCK_STORY_ROLL;
    window.MOCK_STORY_ROLL = function () {
      var r = (typeof prev === 'function') ? prev.apply(this, arguments) : null;
      try {
        var place = num(st.tripRoute && st.tripRoute.place);
        if (place) unlock(place, '旅行到达 ' + ((st.tripRoute && st.tripRoute.placeName) || ''));
        /* 相册里最近 N 张照片的 place 也算点亮(明信片寄回) */
        var ps = arr(st.photos).slice(-3);
        for (var i = 0; i < ps.length; i++) {
          try {
            var row = Tabikaeru.DataManager.instance().PictureDB.get(num(ps[i].pic_id !== undefined ? ps[i].pic_id : ps[i].id));
            if (row && num(row.place)) unlock(num(row.place), '明信片寄回');
          } catch (e) {}
        }
      } catch (e) {}
      return r;
    };
  })();
  /* ---- 补记: 存档里已经有 86 张明信片、placeVisited 也有记录, 但 mapUnlocked 是空的 ----
     上线时按已有数据把"该亮的"补上: ①照片的 place ②placeVisited 的键 ③最近一趟的目的地。 */
  function backfill(why) {
    var n = 0, k;
    try {
      var ps = arr(st.photos);
      for (var i = 0; i < ps.length; i++) {
        var pid = num(ps[i] && (ps[i].pic_id !== undefined ? ps[i].pic_id : ps[i].id));
        var row = null;
        try { row = Tabikaeru.DataManager.instance().PictureDB.get(pid); } catch (e) {}
        if (row && num(row.place)) { if (unlock(num(row.place), '已有明信片')) n++; }
      }
      var pv = st.placeVisited || {};
      for (k in pv) if (num(k)) { if (unlock(num(k), '去过的地点')) n++; }
      if (num(st.tripRoute && st.tripRoute.place)) { if (unlock(num(st.tripRoute.place), '最近一趟')) n++; }
    } catch (e) {}
    var pr = window.MOCK_MAP.progress();
    log('补记地图点亮: 新增 ' + n + ' 个 -> ' + pr.unlocked + '/' + pr.total + ' [' + (why || '') + ']');
    return n;
  }
  window.MOCK_MAP = {
    backfill: backfill,
    paths: PATHS, pathTo: pathTo,
    /* 地图页要的 11 区口径(用户表) */
    regions11: function () {
      var P = PATHS(), rm = P.region_mapping || {}, cn = P.region_cn || {}, out = [], r;
      for (r in rm) {
        var ids = rm[r].map(function (x) { return Number((P.nodes[x] || {}).place_id); }).filter(Boolean);
        var un = ids.filter(function (x) { return unlocked().indexOf(x) >= 0; }).length;
        out.push({ key: r, name: cn[r] || r, total: ids.length, unlocked: un, places: ids });
      }
      return out;
    },
    load: load, unlock: unlock, unlocked: function () { return unlocked().slice(); },
    location: loc, photosOf: photosOf,
    regions: function () {
      var a = L().regions || [], out = [], i, j;
      for (i = 0; i < a.length; i++) {
        var ls = (L().locations || []).filter(function (x) { return x.region === a[i].key; });
        var un = ls.filter(function (x) { return unlocked().indexOf(num(x.id)) >= 0; }).length;
        out.push({ key: a[i].key, name: a[i].name, total: ls.length, unlocked: un, locations: ls });
      }
      return out;
    },
    progress: function () { var all = (L().locations || []).length; return { unlocked: unlocked().length, total: all }; },
    reset: function () { st.mapUnlocked = []; save(); return 0; }
  };
  setTimeout(function () { try { backfill('启动补记'); } catch (e) {} }, 1600);
  var p = window.MOCK_MAP.progress();
  log('地点图鉴就绪: ' + p.total + ' 个地点 / 已解锁 ' + p.unlocked + ' (旅行到达或明信片寄回都会点亮)');
})();
