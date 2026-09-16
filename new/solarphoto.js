/* lxqw 节气照片(离线) —— "四动物同框"的当月/双月限定照
 *
 * 需求(目标⑤): 节气活动里"节气照片"; 用户表: 当月 1 日上架当月节气食物(375 草), 带上它出门更容易
 *   拿到**当月那张"四动物同框"限定照**(青蛙 + 3 位小伙伴)。
 *
 * 全部来自本机表:
 *   PictureTag_json: u_month<N>(当月照) / u_two_month<N>(那双月照) -> picNames ['month8'] / ['two_month8']
 *   Picture_json   : name -> id   (u_month8 -> 3055, u_two_month8 -> 3075)
 *   Item_json      : 24 种节气食物 (嘟嘟 375 草上架): 20~31 / 35~46, 每月两种(一个节气一种)
 *
 * 客户端契约: 明信片就是相册里的一张图(rules.js comeBack -> MOCK_PICK_PHOTO -> album_load_new),
 *   所以"节气照片"只要**抽到那张图的 id** 就会出现; 本层只负责判定, 不动渲染。
 */
(function () {
  var st = window.MOCK_STATE || (window.MOCK_STATE = {});
  function log(m) { try { console.log('[MOCK] 节气照: ' + m); } catch (e) {} }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function arr(v) { return Array.isArray(v) ? v : []; }

  /* 每月两种节气食物(按 Item_json.info 里的"大寒/立春/惊蛰…"文案排的) */
  var MONTH_FOOD = {
    1: [20, 35],   /* 腊八粥(大寒) / 枣泥核桃糖(小寒) */
    2: [21, 36],   /* 三鲜素春卷(立春) / 泡椒春笋 */
    3: [22, 37],   /* 银耳炖雪梨(惊蛰) / 桃花酥 */
    4: [23, 38],   /* 香椿拌豆腐(谷雨) / 艾草青团(清明) */
    5: [24, 39],   /* 蜜渍枇杷(小满) / 立夏饭 */
    6: [25, 40],   /* 蒜蓉蒸丝瓜(夏至) / 芒种梅 */
    7: [26, 41],   /* 西瓜冰沙(大暑) / 烧仙草(小暑) */
    8: [27, 42],   /* 地三鲜(立秋) / 莲子百合糕(处暑) */
    9: [28, 43],   /* 野苋菜汤(秋分) / 桂花糯米藕(白露) */
    10: [29, 44],  /* 蓝莓山药泥(霜降) / 冰糖葫芦(寒露) */
    11: [30, 45],  /* 甘蔗马蹄水(立冬) / 红糖糍粑(小雪) */
    12: [31, 46]   /* 白玉蒸蛋(大雪) / 南瓜排叉素饺子(冬至) */
  };
  var TERM = { 1: '小寒·大寒', 2: '立春·雨水', 3: '惊蛰·春分', 4: '清明·谷雨', 5: '立夏·小满', 6: '芒种·夏至',
               7: '小暑·大暑', 8: '立秋·处暑', 9: '白露·秋分', 10: '寒露·霜降', 11: '立冬·小雪', 12: '大雪·冬至' };

  function monthNow() {
    try { var m = num(window.MOCK_ENV && window.MOCK_ENV.month); if (m >= 1 && m <= 12) return m; } catch (e) {}
    return new Date().getMonth() + 1;
  }
  function solarActive() {
    try { if (window.MOCK_ENV && window.MOCK_ENV.solar !== undefined) return num(window.MOCK_ENV.solar) > 0; } catch (e) {}
    try { if (window.MOCK_STORIES && window.MOCK_STORIES.solar) return !!num(window.MOCK_STORIES.solar().term); } catch (e) {}
    return false;
  }
  function foods(month) { return (MONTH_FOOD[month || monthNow()] || []).slice(); }
  /* 行李里有没有"这个月的节气食物" */
  function hasFood(items, month) {
    var list = arr(items), want = foods(month);
    for (var i = 0; i < list.length; i++) if (want.indexOf(num(list[i])) >= 0) return true;
    return false;
  }
  /* 标签 -> 有图层的照片 id (与 postroute 同一套解析) */
  var TAGMAP = null;
  function tagMap() {
    if (TAGMAP) return TAGMAP;
    TAGMAP = {};
    try {
      var dm = Tabikaeru.DataManager.instance();
      var tags = (dm.PictureTagDB && dm.PictureTagDB.list()) || [];
      var pics = (dm.PictureDB && dm.PictureDB.list()) || [];
      var nameToId = {}, i, j, L = window.MOCK_PICTURES || {}, hasL = Object.keys(L).length > 0;
      for (i = 0; i < pics.length; i++) { var p = pics[i]; if (!p) continue; nameToId[String(p.name)] = num(p.id); }
      for (i = 0; i < tags.length; i++) {
        var tg = tags[i]; if (!tg) continue;
        var names = arr(tg.picNames);
        for (j = 0; j < names.length; j++) {
          var id = num(nameToId[String(names[j])]);
          if (id && (!hasL || L[String(id)])) { TAGMAP[String(tg.Tag)] = id; break; }
        }
      }
    } catch (e) {}
    return TAGMAP;
  }
  function picByTag(tag) {
    var out = num(tagMap()[String(tag)]);
    if (out) return out;
    try {
      var dm = Tabikaeru.DataManager.instance();
      var tags = (dm.PictureTagDB && dm.PictureTagDB.list()) || [];
      var pics = (dm.PictureDB && dm.PictureDB.list()) || [];
      var names = null, i, j;
      for (i = 0; i < tags.length; i++) if (tags[i] && String(tags[i].Tag) === String(tag)) { names = arr(tags[i].picNames); break; }
      if (!names) return 0;
      for (i = 0; i < pics.length; i++) {
        var p = pics[i]; if (!p) continue;
        for (j = 0; j < names.length; j++) if (String(p.name) === String(names[j])) {
          var id = num(p.id), L = window.MOCK_PICTURES || {};
          if (!Object.keys(L).length || L[String(id)]) return id;
        }
      }
    } catch (e) {}
    return out;
  }
  /* 兜底: 与 id 段一致(u_month<N> = 3048+N-1, u_two_month<N> = 3067+N) */
  function fallbackId(tag) {
    var m = /^u_month(\d+)$/.exec(tag), t = /^u_two_month(\d+)$/.exec(tag);
    return m ? 3047 + num(m[1]) : t ? 3067 + num(t[1]) : 0;
  }
  function tagFor(month, two) { return (two ? 'u_two_month' : 'u_month') + (month || monthNow()); }
  function picFor(month, two) {
    var tag = tagFor(month, two), id = picByTag(tag) || fallbackId(tag);
    return { tag: tag, id: num(id) };
  }
  /* 抽一张节气照; 条件: 带上当月的节气食物(或今天是节气) */
  function pick(items, opts) {
    opts = opts || {};
    var m = monthNow(), food = hasFood(items, m), act = solarActive();
    if (!food && !act) return null;
    var chance = food ? 0.55 : 0.25;                       /* 带了当月节气食物更容易出 */
    if (opts.chance !== undefined) chance = num(opts.chance);
    if (Math.random() >= chance) return null;
    var two = Math.random() < 0.35;                        /* 双月照少一些 */
    var p = picFor(m, two);
    if (!p.id) return null;
    st.solarPhoto = { month: m, term: TERM[m] || '', tag: p.tag, pic: p.id, food: food ? 1 : 0, at: Math.floor(Date.now() / 1000) };
    log('拿到节气照 ' + p.tag + ' id=' + p.id + ' (' + (TERM[m] || '') + ', ' + (food ? '带了当月节气食物' : '今天是节气') + ')');
    return p.id;
  }

  window.MOCK_SOLARPHOTO = {
    month: monthNow, term: function () { return TERM[monthNow()] || ''; },
    months: function () { return MONTH_FOOD; }, foods: foods, hasFood: hasFood, active: solarActive,
    tagFor: tagFor, picFor: picFor, pick: pick, fallbackId: fallbackId,
    last: function () { return st.solarPhoto || null; }
  };
  var p8 = picFor(8, 0), p8b = picFor(8, 1);
  log('节气照就绪: 当月 ' + monthNow() + ' 月(' + (TERM[monthNow()] || '') + ') 食物 ' + JSON.stringify(foods()) +
      ' | 示例 8 月照 ' + p8.tag + '=' + p8.id + ' / ' + p8b.tag + '=' + p8b.id);
})();
