/* lxqw 旅行结算引擎(走路径) —— new/pathengine.js
 *   用户表(2026-09-16): 旅行 = 在 28 城路径图上从起点走到目的地;
 *     · 总耗时 = 基础耗时(食物决定) + Σ(地形系数 × 边长), 截断在 6~72 小时;
 *     · 体力 100 起, 每条边 -20 - 地形额外; <0 则休息 3 小时并回满 100;
 *     · 特产 = 经过的点数(每个点最多一个, 上限 10); 纪念品 15%;
 *     · **每条边最多一张照片**(按边的 photo_ids 逐条判定, 发过即标记, 不重复);
 *     · 千纸鹤限区域抽签(绿=东...), 其余护身符全 28 城加权; 抽签前打理论概率日志;
 *     · 归来点亮沿途城市(map_unlock 增量: 只带 location_id/x/y/region)。
 */
(function () {
  var st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  function log(m) { try { console.log('[MOCK] 路径: ' + m); } catch (e) {} }
  function save() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function push(name, d, t) { setTimeout(function () { try { window.MockServer.dispatch(name, (typeof d === 'function' ? d() : d)); } catch (e) {} }, t || 60); }
  function P() { return window.MOCK_MAP_PATHS || { nodes: {}, edges: [] }; }
  var TERRAIN_HOURS = { NONE: 0, Mountain: 0.75, Sea: 0.5, Cave: 1.0 };   /* 小时/单位长度 */
  var STAMINA_EDGE = 20, REST_HOURS = 3, HOUR_MIN = 6, HOUR_MAX = 72, SOUVENIR_CHANCE = 0.15, SPECIALTY_MAX = 10;

  function nodeOf(k) { return (P().nodes || {})[k] || null; }
  function placeIdOf(k) { return num(nodeOf(k) && nodeOf(k).place_id); }
  function keyOfPlace(pid) { var n = P().nodes || {}, k; for (k in n) if (num(n[k].place_id) === num(pid)) return k; return null; }
  function edgesBetween(a, b) {
    var es = P().edges || [];
    for (var i = 0; i < es.length; i++) if ((es[i].from === a && es[i].to === b) || (es[i].from === b && es[i].to === a)) return es[i];
    return null;
  }
  /* 起点 -> 目的地: 走 maploc.pathTo 的城市序列, 再取出对应的边 */
  function routeTo(placeId) {
    var chain = (window.MOCK_MAP && window.MOCK_MAP.pathTo) ? window.MOCK_MAP.pathTo(placeId) : [];
    var keys = ['0'], i;
    for (i = 0; i < chain.length; i++) { var k = keyOfPlace(chain[i]); if (k) keys.push(k); }
    var out = [];
    for (i = 0; i + 1 < keys.length; i++) { var e = edgesBetween(keys[i], keys[i + 1]); if (e) out.push(e); }
    return { keys: keys, edges: out, cities: chain };
  }
  /* 结论: 耗时/体力/是否休息 */
  function plan(placeId, baseSeconds) {
    var r = routeTo(placeId), hours = 0, stam = 100, rests = 0, i;
    for (i = 0; i < r.edges.length; i++) {
      var e = r.edges[i], mult = num(TERRAIN_HOURS[e.terrain] === undefined ? 0 : TERRAIN_HOURS[e.terrain]);
      hours += mult * Math.max(1, num(e.length));
      stam -= STAMINA_EDGE + (mult > 0 ? 10 : 0);
      if (stam < 0) { rests++; hours += REST_HOURS; stam = 100; }
    }
    var baseH = num(baseSeconds) / 3600, total = Math.max(HOUR_MIN, Math.min(HOUR_MAX, baseH + hours));
    return { cities: r.cities, edges: r.edges.length, terrainHours: Number(hours.toFixed(2)), rests: rests,
             staminaLeft: stam, baseHours: Number(baseH.toFixed(2)), totalHours: Number(total.toFixed(2)),
             totalSeconds: Math.round(total * 3600) };
  }
  /* ---- 奖励: 特产(经过点数, ≤10) + 纪念品 15% + **每条边最多一张照片** ---- */
  function settle(placeId, why) {
    var r = routeTo(placeId), got = { specialty: 0, souvenir: 0, photos: [], cities: r.cities.length };
    st.edgePhotos = arr(st.edgePhotos);
    var i;
    var points = r.cities.length;                       /* 经过的路径点(含终点) */
    got.specialty = Math.min(SPECIALTY_MAX, points);
    /* 每条边逐条判定照片(未解锁的才有机会, 发过即标记) */
    for (i = 0; i < r.edges.length; i++) {
      var e = r.edges[i], ids = arr(e.photo_ids);
      if (!ids.length) continue;
      var pid = num(ids[0]);
      if (st.edgePhotos.indexOf(pid) >= 0) continue;     /* 同一条边只发一次 */
      if (Math.random() < 0.45) {
        st.edgePhotos.push(pid);
        got.photos.push(pid);
        try {
          st.photos = arr(st.photos);
          var photo = { id: num(st.nextPhoto) || (st.photos.length + 1), pic_id: pid };
          st.nextPhoto = num(photo.id) + 1; st.photos.push(photo);
          push('album_load_new', { pictures: [photo], has_ads: false, is_share: false, visted_pic: [] }, 80);
        } catch (err) {}
      }
    }
    if (Math.random() < SOUVENIR_CHANCE) got.souvenir = 1;
    save();
    log('路径结算[' + (why || '') + ']: 经过 ' + points + ' 个点 -> 特产 ' + got.specialty +
        ' / 纪念品 ' + got.souvenir + ' / 沿路照片 ' + got.photos.length + ' 张(' + got.photos.join(',') + ')' +
        ' | 累计已解锁边照 ' + st.edgePhotos.length);
    return got;
  }
  /* ---- 归来: 结算 + 沿途城市点亮 ---- */
  (function () {
    var prev = window.MOCK_STORY_ROLL;
    window.MOCK_STORY_ROLL = function () {
      var r = (typeof prev === 'function') ? prev.apply(this, arguments) : null;
      try {
        var place = num(st.tripRoute && st.tripRoute.place);
        if (place) {
          var p = plan(place, st.tripSeconds);              /* 这一趟按路径算一遍(耗时/体力/休息) */
          st.lastPathPlan = p;
          log('这一趟走路径: ' + (p.cities.join(' -> ') || '(起点)') + ' | 地形额外 ' + p.terrainHours + 'h, 休息 ' + p.rests +
              ' 次, 合计 ' + p.totalHours + 'h(基础 ' + p.baseHours + 'h)');
          var chain = (window.MOCK_MAP && window.MOCK_MAP.pathTo) ? window.MOCK_MAP.pathTo(place) : [];
          for (var i = 0; i < chain.length; i++) { try { if (window.MOCK_MAP.unlock) window.MOCK_MAP.unlock(chain[i], '经过'); } catch (e) {} }
          settle(place, '旅行归来');
        }
      } catch (e) {}
      return r;
    };
  })();
  /* ---- 千纸鹤限区域抽签(其余护身符全 28 城加权) + 概率日志 ---- */
  (function () {
    var R = window.MOCK_ROUTE;
    if (!R || typeof R.choosePlace !== 'function') { log('明信片路线层没装, 跳过护身符限区'); return; }
    var CR = { blue_crane: ['north'], green_crane: ['east', 'taiwan'], red_crane: ['south1'], white_crane: ['northwest', 'southwest1', 'southwest2'] };
    var CRANE_ITEM = { 1007: 'green_crane', 1008: 'white_crane', 1009: 'red_crane', 1010: 'blue_crane' };
    window.MOCK_PATHS = {
      plan: plan, routeTo: routeTo, settle: settle,
      charmRegionOf: function (items) {
        var it = arr(items);
        for (var i = 0; i < it.length; i++) { var c = CRANE_ITEM[num(it[i])]; if (c) return { charm: c, regions: CR[c] }; }
        return null;
      },
      /* 限区抽签: 返回 28 城里的候选(带权重), 并打理论概率 */
      candidates: function (items) {
        var P2 = P(), nodes = P2.nodes || {}, rm = P2.region_mapping || {}, c = window.MOCK_PATHS.charmRegionOf(items);
        var out = [], k, r;
        if (c) {
          for (r = 0; r < c.regions.length; r++) {
            var ids = arr(rm[c.regions[r]]);
            for (var j = 0; j < ids.length; j++) out.push({ key: ids[j], place: placeIdOf(ids[j]) });
          }
          log('护身符 ' + c.charm + ' 限定区域 ' + c.regions.join('+') + ' -> 候选 ' + out.length + ' 城, 单城理论概率 ' +
              (out.length ? (100 / out.length).toFixed(2) : '0') + '%');
        } else {
          for (k in nodes) { if (num(nodes[k].place_id)) out.push({ key: k, place: num(nodes[k].place_id) }); }
          log('没有限区护身符 -> 全 ' + out.length + ' 城加权抽签, 单城理论概率 ' + (out.length ? (100 / out.length).toFixed(2) : '0') + '%');
        }
        return out;
      }
    };
    var origChoose = R.choosePlace;
    R.choosePlace = function (env, budget) {
      try {
        var items = (env && env.items) ? env.items : arr(st.lastTripItems);
        var cand = window.MOCK_PATHS.candidates(items);
        if (cand.length && cand.length < 28 && !env.lock) {
          var pick = cand[Math.floor(Math.random() * cand.length)];
          if (pick && pick.place) { log('限区抽签 -> ' + pick.place); return pick.place; }
        }
      } catch (e) {}
      return origChoose.apply(this, arguments);
    };
  })();
  log('引擎就绪: 地形系数 ' + JSON.stringify(TERRAIN_HOURS) + ', 体力 ' + STAMINA_EDGE + '/边(不足休息 ' + REST_HOURS + 'h), 截断 ' + HOUR_MIN + '~' + HOUR_MAX + 'h');
})();
