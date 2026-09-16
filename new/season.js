/* lxqw 季节 / 昼夜 / 节气 总调度(离线) —— new/season.js
 *
 * 用户给的配置表(2026-09-16):
 *   季节(Asia/Shanghai month): 3-5 春(snow_melt/spring_bloom) / 6-8 夏(summer_flower, 20:00-04:00 萤火虫) /
 *                              9-11 秋(autumn_leaves, 商店上秋芦荻) / 12-2 冬(snow_covered)
 *   昼夜: 05-08 清晨(晨光/起床) / 08-17 白天 / 17-19 黄昏(暖色) / 19-05 夜晚(蜡烛/睡觉/萤火虫+虫鸣)
 *   天气权重: 春 晴50 雨30 阴20 / 夏 晴40 雨40 暴雨10 阴10 / 秋 晴50 阴30 雨20 / 冬 晴40 雪40 阴20
 *   节气: 每月 2 个(约 15 天一换), 当月限定食物 375 草(嘟嘟每日刷新); 节气照片需 2~3 周烹饪任务
 *   限定家具: 8-10 月森之国度 3 件 / 11-12 月古琴展 2 件
 *
 * 这一层不重复实现别的层: 它只做**总调度与对外一个口径**
 *   · 季节/时段/节气/天气权重 的唯一算法;
 *   · 把"当前该上什么"广播给已有层(weatherclock / furniture / solarphoto / activities);
 *   · 节气活动窗口(默认 21 天)与进度(st.solarTask) —— 烹饪任务用它算周期。
 */
(function () {
  var st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  function log(m) { try { console.log('[MOCK] 季节: ' + m); } catch (e) {} }
  function save() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function push(name, d, t) { setTimeout(function () { try { window.MockServer.dispatch(name, (typeof d === 'function' ? d() : d)); } catch (e) {} }, t || 60); }
  function nowD() { return new Date(); }

  var SEASONS = { 1: 'spring', 2: 'summer', 3: 'autumn', 4: 'winter' };
  var SEASON_CN = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };
  var VISUAL = { spring: 'snow_melt+spring_bloom', summer: 'summer_flower', autumn: 'autumn_leaves', winter: 'snow_covered' };
  /* 天气权重(用户表): 1晴 2阴 3小雨 4暴雨 8小雪 9大雪 */
  var WEATHER_W = {
    spring: [[1, 50], [3, 30], [2, 20]],
    summer: [[1, 40], [3, 40], [4, 10], [2, 10]],
    autumn: [[1, 50], [2, 30], [3, 20]],
    winter: [[1, 40], [8, 40], [2, 20]]
  };
  var HOURS = [
    { key: 4, name: '清晨', from: 5, to: 8 },   /* HoursType 4 = 清晨/凌晨 */
    { key: 1, name: '白天', from: 8, to: 17 },
    { key: 2, name: '黄昏', from: 17, to: 19 },
    { key: 3, name: '夜晚', from: 19, to: 5 }
  ];
  function seasonOf(d) {
    var m = (d || nowD()).getMonth() + 1;
    return m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter';
  }
  function seasonKeyOf(d) { var s = seasonOf(d); return s === 'spring' ? 1 : s === 'summer' ? 2 : s === 'autumn' ? 3 : 4; }
  function hoursOf(d) {
    var h = (d || nowD()).getHours(), i;
    for (i = 0; i < HOURS.length; i++) {
      var t = HOURS[i];
      if (t.from < t.to ? (h >= t.from && h < t.to) : (h >= t.from || h < t.to)) return t;
    }
    return HOURS[1];
  }
  /* 节气: 每月两个(1 日 / 16 日 换), 名字用 new/stories.js 的表, 这里只算窗口 */
  function solarTerm(d) {
    d = d || nowD();
    var s = (window.MOCK_STORIES && window.MOCK_STORIES.solar) ? window.MOCK_STORIES.solar() : null;
    var day = d.getDate();
    return { name: (s && (s.name || s.term)) || '', index: (s && num(s.term)) || 0, half: day < 16 ? 1 : 2,
             start: day < 16 ? 1 : 16, end: day < 16 ? 15 : new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() };
  }
  /* 节气活动窗口(用户: 烹饪任务 2~3 周 = 14~21 天): 默认 21 天, 从本节气首日开始 */
  function solarTaskWindow(d) {
    d = d || nowD();
    var days = num(st.solarTaskDays) > 0 ? num(st.solarTaskDays) : 21;
    var st0 = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
    var end = new Date(st0.getTime() + days * 86400000);
    return { start: Math.floor(st0.getTime() / 1000), end: Math.floor(end.getTime() / 1000), days: days };
  }
  function weatherWeights(d) { return WEATHER_W[seasonOf(d)] || WEATHER_W.spring; }
  /* 用户给的限定家具档期(和 furniture.js 里那套一致, 这里给出"当前该有什么") */
  function limitedFurniture(d) {
    var m = (d || nowD()).getMonth() + 1, out = [];
    if (m >= 8 && m <= 10) out.push({ name: '森之国度', draw: [10313, 10315, 10323] });
    if (m === 11 || m === 12) out.push({ name: '古琴展', draw: [10312, 10326] });
    return out;
  }
  function snapshot(d) {
    d = d || nowD();
    var s = seasonOf(d), h = hoursOf(d), term = solarTerm(d), tw = solarTaskWindow(d);
    return { season: s, season_cn: SEASON_CN[s], season_key: seasonKeyOf(d), visual: VISUAL[s],
             hours: h.key, hours_name: h.name, night: h.key === 3,
             fireflies: (s === 'summer' && (d.getHours() >= 20 || d.getHours() < 4)) ? 1 : 0,
             month: d.getMonth() + 1, solar: term, solar_task: { start: tw.start, end: tw.end, days: tw.days,
             active: (Math.floor(d.getTime() / 1000) >= tw.start && Math.floor(d.getTime() / 1000) < tw.end) ? 1 : 0 },
             weather_weights: weatherWeights(d), limited_furniture: limitedFurniture(d),
             solar_food_price: 375 };
  }
  /* 变化就广播(指纹判定, 零代价): 季节/时段/节气/活动档期 任一变化 -> 推一次 weather_load */
  var lastSig = '';
  function tick(force) {
    try {
      var s = snapshot(), sig = [s.season, s.hours, s.solar.half, (s.limited_furniture[0] || {}).name || '-'].join('|');
      st.season = s.season; st.seasonKey = s.season_key;
      if (!force && sig === lastSig) return 0;
      lastSig = sig; save();
      push('weather_load', null, 40);
      log('当前: ' + s.season_cn + '季(' + s.visual + ') ' + s.hours_name + ' 节气' + (s.solar.half === 1 ? '上半月' : '下半月') +
          ' | 萤火虫 ' + s.fireflies + ' | 限定家具 ' + (s.limited_furniture.map(function (x) { return x.name; }).join('/') || '无') +
          ' | 天气权重 ' + JSON.stringify(s.weather_weights));
      return 1;
    } catch (e) { return 0; }
  }
  /* ---------- 节气闭环(用户: 烹饪任务 2~3 周 -> 当月限定食物 -> 带出门 -> 四动物同框节气照) ----------
     ① 烹饪任务窗口 = solarTaskWindow()(默认 21 天), 进度记在 st.solarTask;
     ② 任务做完(cooking_complete_task) 就发**当月两种节气食物**(new/solarphoto.js 的 MONTH_FOOD);
     ③ 带上它出门 -> solarphoto.pick() 出当月/双月节气照(那层已实现, 概率 55%)。 */
  function monthFoods(month) {
    try { if (window.MOCK_SOLARPHOTO && window.MOCK_SOLARPHOTO.foods) return arr2(window.MOCK_SOLARPHOTO.foods(month)); } catch (e) {}
    return [];
  }
  function arr2(v) { return Array.isArray(v) ? v : []; }
  function solarTask() {
    var w = solarTaskWindow(), now2 = Math.floor(nowD().getTime() / 1000);
    st.solarTask = st.solarTask || {};
    var s = st.solarTask;
    if (num(s.start) !== w.start) { s.start = w.start; s.end = w.end; s.done = 0; s.granted = 0; save(); }
    s.active = (now2 >= w.start && now2 < w.end) ? 1 : 0;
    return s;
  }
  function grantSolarFood(why) {
    var m = nowD().getMonth() + 1, foods = monthFoods(m), s = solarTask();
    if (num(s.granted)) return [];
    if (!foods.length) { log('当月没有配节气食物(month=' + m + ')'); return []; }
    st.house = arr2(st.house);
    var got = [];
    for (var i = 0; i < foods.length; i++) {
      var id = num(foods[i]), f = null;
      for (var h = 0; h < st.house.length; h++) if (num(st.house[h].item_id) === id) f = st.house[h];
      if (f) f.count = num(f.count) + 1; else st.house.push({ item_id: id, count: 1 });
      got.push(id);
    }
    s.granted = 1; save();
    push('item_load_items', (S['item_load_items'] ? S['item_load_items']() : null), 60);
    log('节气闭环: 本月烹饪任务做完 -> 发放当月限定食物 ' + got.join('/') + ' [' + (why || '') + ']' +
        ' (带上它出门就有机会拿节气照)');
    return got;
  }
  /* 包一层烹饪任务完成: 攒够 st.solarTaskNeed(默认 3) 个任务 -> 发食物 */
  (function () {
    var prev = S['cooking_complete_task'];
    if (typeof prev !== 'function') { log('烹饪层没装, 节气闭环只保留窗口与发放入口'); return; }
    S['cooking_complete_task'] = function (p) {
      var r = prev.apply(this, arguments);
      try {
        if (r && r.code === 0) {
          var s = solarTask(), need = num(st.solarTaskNeed) > 0 ? num(st.solarTaskNeed) : 3;
          s.done = num(s.done) + 1;
          log('节气闭环: 烹饪任务进度 ' + s.done + '/' + need);
          if (num(s.done) >= need) grantSolarFood('烹饪任务完成 ' + s.done + ' 个');
        }
      } catch (e) {}
      return r;
    };
  })();
  /* 烹饪任务跟着 21 天节气窗走: 换窗(每月 1 日)就重排一批 —— 由 cooking 层按它自己的表重建 */
  function syncCookingWindow() {
    var s = solarTask();
    if (num(st.cookingWindowStart) === num(s.start)) return 0;
    st.cookingWindowStart = num(s.start);
    try { if (st.cooking) { st.cooking.tasks = []; st.cooking.monthPro = 0; st.cooking.select = 1; } } catch (e) {}
    save();
    try { if (S['cooking_load']) S['cooking_load']({}); } catch (e) {}
    try { push('cooking_task_update', { task: { id: 0, pro: 0, complete: 0 } }, 80); } catch (e) {}
    log('节气换窗: 烹饪任务重排(本窗 ' + new Date(num(s.start) * 1000).toLocaleDateString() + ' 起 ' + num(st.solarTaskDays) + ' 天)');
    return 1;
  }
  try { var _st0 = solarTask; solarTask = function () { var r = _st0.apply(this, arguments); try { syncCookingWindow(); } catch (e) {} return r; }; } catch (e) {}
  /* 窗口外的刷新请求直接拒掉(免得玩家手动刷出下一节气的任务) */
  (function () {
    var prev = S['cooking_refresh_task'];
    if (typeof prev !== 'function') return;
    S['cooking_refresh_task'] = function (p) {
      var s = solarTask();
      if (!num(s.active)) { log('节气任务窗已过, 拒绝刷新'); return { task: null, code: 4 }; }
      return prev.apply(this, arguments);
    };
  })();
  S['season_load'] = function () { return snapshot(); };
  window.MOCK_SEASON = {
    snapshot: snapshot, seasonOf: seasonOf, hoursOf: hoursOf, solarTerm: solarTerm,
    solarTaskWindow: solarTaskWindow, weatherWeights: weatherWeights, limitedFurniture: limitedFurniture,
    tick: tick, seasons: SEASONS, visuals: VISUAL,
    solarTask: solarTask, grantSolarFood: grantSolarFood, monthFoods: monthFoods, syncCookingWindow: syncCookingWindow
  };
  tick(true);
  setInterval(function () { try { tick(false); } catch (e) {} }, 60000);   /* 每分钟看一眼, 变了才推 */
  log('调度就绪(季节/昼夜/节气/限定档期); 每分钟检查一次, 变化才推 weather_load');
})();
