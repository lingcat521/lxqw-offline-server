/* lxqw offline handbook: 图鉴/收藏 (item_load_handbook) — additive layer.
 *
 * Client contract (ItemModel.item_load_handbook + Tabikaeru.Game getters):
 *   collections: array of CollectDB ids the player owns
 *        Game.collectionList = CollectDB rows mapped to {cfg, count: indexOf(id)>=0 ? 1 : 0}
 *   specialtys : array of SpecialtyDB itemIds the player owns
 *        Game.specialtyList  = SpecialtyDB rows mapped to  row / -1
 * Both are plain id arrays searched with indexOf(), so the ids must exist in the
 * client tables. 62 collections / 64 specialties come from the real tables.
 */
(function () {
  var M = window.MockServer, st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  function log(m) { try { console.log("[MOCK] " + m); } catch (e) {} }
  function num(v) { return (typeof v === "number" && isFinite(v)) ? v : null; }

  /* CollectDB ids, 0-based (tables/Collection_json.json has 62 rows) */
  var COLL_IDS = [];
  for (var i = 0; i < 62; i++) COLL_IDS.push(i);

  function arr(v) { return Object.prototype.toString.call(v) === "[object Array]" ? v : []; }
  st.collections = arr(st.collections);
  st.specialtys = arr(st.specialtys);

  function ownSpecialtys() {          /* anything sitting in the gift box counts */
    var out = st.specialtys.slice();
    var gifts = arr(st.gifts);
    for (var i = 0; i < gifts.length; i++) {
      var id = num(gifts[i] && gifts[i].item_id);
      if (id !== null && out.indexOf(id) < 0) out.push(id);
    }
    return out;
  }
  function save() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }

  S["item_load_handbook"] = function () {
    var sp = ownSpecialtys();
    if (sp.length !== st.specialtys.length) { st.specialtys = sp; save(); }
    return { collections: st.collections.slice(), specialtys: sp };
  };

  /* 兑奖: the client fires this and forgets it (wants = false) */
  S["item_redeem_prize"] = function (p) {
    st.redeemed = arr(st.redeemed);
    var id = num(p && p.prize_id);
    if (id !== null) st.redeemed.push(id);
    save();
    log("兑奖 prize_id=" + id + " (累计 " + st.redeemed.length + ")");
    return {};
  };

  /* Every trip the frog completes unlocks the next 纪念品/典藏 (离线沙盒: 一次旅行一件).
     Detected by watching the trip counter, so nothing in rules.js has to change. */
  var lastTrips = num(st.travelCount) || 0;
  /* 珍品解锁进度(用户表): 同一件珍品要带回家约 **3 次**才算真正解锁 —— 第一次只给黑色轮廓,
     集齐后盖红章。用 st.collReturns[itemId] 计数, 归来的每一件新特产/纪念品 +1。 */
  var RETURN_NEED = 3;
  function returns() { st.collReturns = (st.collReturns && typeof st.collReturns === 'object') ? st.collReturns : {}; return st.collReturns; }
  function bumpReturns(id, n) {
    id = Number(id); if (!id) return 0;
    var r = returns(), key = String(id);
    r[key] = Number(r[key] || 0) + (n || 1);
    if (r[key] > RETURN_NEED) r[key] = RETURN_NEED;
    return r[key];
  }
  function awardTrip() {
    var trips = num(st.travelCount) || 0;
    if (trips <= lastTrips) return;
    var gained = 0;
    while (lastTrips < trips) {
      lastTrips++;
      for (var i = 0; i < COLL_IDS.length; i++) {
        if (st.collections.indexOf(COLL_IDS[i]) < 0) { st.collections.push(COLL_IDS[i]); gained++; break; }
      }
    }
    if (gained) {
      /* 这一趟带回来的纪念品也算一次"带回" */
      for (var gi = 0; gi < st.collections.length; gi++) { }
      try { bumpReturns(st.collections[st.collections.length - 1]); } catch (e) {}
      save();
      log("图鉴: 解锁 " + gained + " 件纪念品 (共 " + st.collections.length + "/" + COLL_IDS.length + ")");
      setTimeout(function () { try { M.dispatch("item_load_handbook", S["item_load_handbook"]()); } catch (e) {} }, 40);
    }
  }
  setInterval(awardTrip, 1500);
  log("handbook ready: collections " + st.collections.length + "/" + COLL_IDS.length + ", specialtys " + st.specialtys.length);
  /* 注意(契约逆向结论): item_load_handbook.collections 的元素必须是 **Collection 表的行 id(0..61)**
     (CollectionController: n.indexOf(t.id)>=0 ? 命中 : 未命中), specialtys 才是 Item 的 itemId(type3)。
     以前这里把家具图纸 103xx 塞进 collections —— 语义不对, 而且被 guard.js 的 has("coll",c) 全部丢掉。
     图纸/绘纸属于绘纸系统(DrawingModel.data.colls, drawingCollectData id 1..308), 见 new/drawing.js。 */
  (function () {
    var prev = S['item_load_handbook'];
    /* 每条 collections/specialtys 都带 return_count(0..3), 客户端画"轮廓/红章"时可用 */
    function withProgress(r) {
      try {
        var rr = returns();
        r.collection_returns = {}; r.specialty_returns = {};
        for (var i = 0; i < (r.collections || []).length; i++) { var id = Number(r.collections[i]); r.collection_returns[id] = Number(rr[String(id)] || 0); }
        for (var j = 0; j < (r.specialtys || []).length; j++) { var sid = Number(r.specialtys[j]); r.specialty_returns[sid] = Number(rr[String(sid)] || 0); }
        r.return_need = RETURN_NEED;
      } catch (e) {}
      return r;
    }
    S['item_load_handbook'] = function () {
      var r = (typeof prev === 'function') ? (prev() || {}) : (prev || {});
      try {
        if (Array.isArray(r.collections)) {
          r.collections = r.collections.filter(function (id) { var n = Number(id); return n >= 0 && n <= 61; });
        }
      } catch (e) {}
      return r;
    };
  })();
  window.MOCK_RETURNS = { bump: bumpReturns, all: returns, need: RETURN_NEED };
})();

/* 珍品解锁进度(用户表: 同一件带回约 3 次才真正解锁): 出口统一挂上 return_count。
   放在文件最后再包一层, 保证作用域与外层一致。 */
(function () {
  var prev = window.MOCK_SEMANTIC['item_load_handbook'];
  function cntMap(ids) {
    var r = (window.MOCK_RETURNS && window.MOCK_RETURNS.all) ? window.MOCK_RETURNS.all() : {};
    var o = {}, k;
    for (k in r) if (Number(r[k]) > 0) o[k] = Number(r[k]);            /* 所有计过数的都下发(不只是已解锁的) */
    for (var i = 0; i < (ids || []).length; i++) { var id = Number(ids[i]); if (o[id] === undefined) o[id] = Number(r[String(id)] || 0); }
    return o;
  }
  window.MOCK_SEMANTIC['item_load_handbook'] = function () {
    var r = (typeof prev === 'function') ? (prev() || {}) : (prev || {});
    try {
      r.collection_returns = cntMap(r.collections);
      r.specialty_returns = cntMap(r.specialtys);
      r.return_need = (window.MOCK_RETURNS && window.MOCK_RETURNS.need) || 3;
    } catch (e) {}
    return r;
  };
})();
