/* lxqw 普通材料(离线) —— 两条来源(用户表 2026-09-16):
 *   ① 嘟嘟商店: 普通材料 **20 草/件**, 每次到访随机刷新几种(一次买 4 个左右够用);
 *   ② 旅行带回: 归来时概率带回松木/楠竹/砂石/灯芯草/粗布/毛边纸/铜块, **自动放到工作台材料行**。
 * 特殊材料(type 11)只能在嘟嘟那儿买(200 草), 旅行不带回。
 * 工作台: 台面 10 格 = 前 5 格工具(type 12) + 后 5 格材料(此处只放普通材料, 特殊材料由玩家自己拖)。
 */
(function () {
  var st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  function log(m) { try { console.log('[MOCK] 材料: ' + m); } catch (e) {} }
  function save() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function push(name, d, t) { setTimeout(function () { try { window.MockServer.dispatch(name, (typeof d === 'function' ? d() : d)); } catch (e) {} }, t || 60); }
  var MATS = [10001, 10002, 10003, 10004, 10005, 10006, 10007];   /* 松木 楠竹 砂石 灯芯草 粗布 毛边纸 铜块 */
  var PRICE = 20, PER_VISIT = 4, BENCH_MAT_FROM = 5;               /* 台面第 6~10 格是材料行(0 基) */
  function matName(id) { try { var r = Tabikaeru.DataManager.instance().ItemDB.get(num(id)); return r ? r.name : ('#' + id); } catch (e) { return '#' + id; } }
  function addHouse(id, n) {
    st.house = arr(st.house);
    for (var i = 0; i < st.house.length; i++) if (num(st.house[i].item_id) === num(id)) { st.house[i].count = num(st.house[i].count) + n; return; }
    st.house.push({ item_id: num(id), count: n });
  }
  /* ---- ② 自动放到工作台材料行(第 6~10 格) ---- */
  function placeOnBench(ids) {
    var f = st.furniture = st.furniture || {};
    if (!Array.isArray(f.bench) || f.bench.length < 10) { var b = []; for (var k = 0; k < 10; k++) b.push(f.bench && f.bench[k] !== undefined ? num(f.bench[k]) : -1); f.bench = b; }
    var placed = [];
    for (var i = 0; i < ids.length; i++) {
      var slot = -1;
      for (var j = BENCH_MAT_FROM; j < 10; j++) if (num(f.bench[j]) < 0) { slot = j; break; }
      if (slot < 0) break;                                    /* 材料行满了: 留在仓库 */
      f.bench[slot] = num(ids[i]); placed.push(ids[i]);
    }
    if (placed.length) save();
    return placed;
  }
  /* ---- ① 商店: 每次到访随机上架 PER_VISIT 种普通材料(20 草/件) ---- */
  (function () {
    var prev = S['furniture_load_furniture'];
    if (typeof prev !== 'function') return;
    S['furniture_load_furniture'] = function () {
      var r = prev.apply(this, arguments) || {};
      try {
        r.shop = r.shop || {};
        r.shop.shop_list = arr(r.shop.shop_list);
        var visitKey = num(r.shop.start_time);
        if (num(st.matVisit) !== visitKey || !arr(st.matPick).length) {          /* 每次到访重掷一次 */
          st.matVisit = visitKey;
          var pool = MATS.slice(), pick = [];
          while (pick.length < PER_VISIT && pool.length) pick.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
          st.matPick = pick; save();
          log('嘟嘟到访: 普通材料上架 ' + pick.map(function (x) { return matName(x); }).join('/') + ' (' + PRICE + ' 草/件)');
        }
        var kept = [], i;
        for (i = 0; i < r.shop.shop_list.length; i++) if (MATS.indexOf(num(r.shop.shop_list[i] && r.shop.shop_list[i].item_id)) < 0) kept.push(r.shop.shop_list[i]);
        r.shop.shop_list = kept;
        var getBuy = {}; try { var f = (window.MOCK_STATE.furniture || {}); var bl = arr(f.bought); for (i = 0; i < bl.length; i++) if (bl[i] && num(bl[i].shop_id) >= 9100) getBuy[num(bl[i].shop_id)] = (getBuy[num(bl[i].shop_id)] || 0) + 1; } catch (e) {}
        for (i = 0; i < arr(st.matPick).length; i++) {
          var sid = 9101 + i;                                                      /* 专用 shop_id 段, 不会被别的商品撞 */
          r.shop.shop_list.push({ shop_id: sid, item_id: num(st.matPick[i]), price: PRICE, limit: 5, shop_limit: 0,
                                  num: Math.max(0, 5 - num(getBuy[sid])), order: 940, sign: 3, type: 9999, has_item: 0, name: '', info: '' });
        }
      } catch (e) {}
      return r;
    };
  })();
  /* ---- ② 旅行带回 1~3 件普通材料 + 自动放工作台 ---- */
  (function () {
    var prev = window.MOCK_STORY_ROLL;
    window.MOCK_STORY_ROLL = function () {
      var r = (typeof prev === 'function') ? prev.apply(this, arguments) : null;
      try {
        var n = 1 + Math.floor(Math.random() * 3), got = [], i;
        for (i = 0; i < n; i++) { var id = MATS[Math.floor(Math.random() * MATS.length)]; addHouse(id, 1); got.push(id); }
        var placed = placeOnBench(got);
        save();
        try { if (window.MOCK_PLANS && window.MOCK_PLANS.progress) window.MOCK_PLANS.progress('MATERIAL_BACK', got.length, {}); } catch (e) {}
        push('item_load_items', S['item_load_items'] ? S['item_load_items']() : null, 70);
        push('furniture_load_furniture', null, 90);
        log('旅行带回普通材料 ' + got.map(function (x) { return matName(x); }).join('/') +
            ' | 自动放上台面 ' + placed.length + ' 件(材料行余 ' + (10 - BENCH_MAT_FROM - placed.length) + ' 格)');
      } catch (e) {}
      return r;
    };
  })();
  window.MOCK_MATERIALS = {
    list: function () { return MATS.slice(); }, price: PRICE, perVisit: PER_VISIT,
    name: matName, placeOnBench: placeOnBench,
    benchMaterials: function () { var f = st.furniture || {}; return arr(f.bench).slice(BENCH_MAT_FROM, 10).map(num); },
    /* GM/测试: 手动补一批到工作台 */
    fill: function (n) { var ids = [], i; for (i = 0; i < (num(n) || 3); i++) ids.push(MATS[i % MATS.length]); for (i = 0; i < ids.length; i++) addHouse(ids[i], 1); save(); return placeOnBench(ids); },
    current: function () { return { visit: num(st.matVisit), pick: arr(st.matPick) }; }
  };
  log('就绪: 普通材料 ' + MATS.length + ' 种(' + PRICE + ' 草/件, 每次到访上架 ' + PER_VISIT + ' 种), 旅行归来 1~3 件并自动放台面');
})();
