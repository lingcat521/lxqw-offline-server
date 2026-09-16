/* lxqw 时间层: 把 mock.js 的 ENV(season/hours_type/weather) 跟真实本地时钟对齐, 并在跨段时推 weather_load。
 *
 * 为什么需要: 以前 ENV 写死 {"season":3,"hours_type":2,"weather":0} —— 即"秋天傍晚"永远不变:
 *   · MainOutView.update_season(): imgLightCover(窗户的灯罩) 只在 hours_type==3||4 时赋值 → 永远不亮
 *   · MainInView.updateSeason(): hours_type 1/2 用白天底图 mainin_ch_bt*, 3/4 用夜晚底图 mainin_ch_hy*
 *     并给 [bgGroup, c_player_bed, c_player_out, frogCap] 套 SeasonInColorMatrix 的 light 矩阵 → 屋里永远白天
 *   · seasonKey = season+hours_type 决定资源组(season11..season44, APK 里 16 组都在) → 季节永远秋天
 * 客户端不会自己算这些(真实服务器下发), 所以我们按本地时间算:
 *   season: 3-5月=1春 / 6-8月=2夏 / 9-11月=3秋 / 12-2月=4冬   (Tabikaeru.Define.Season)
 *   hours_type: 6:00-16:00=1白天 / 16-19=2傍晚 / 19-23=3夜晚 / 23-6=4深夜 (Tabikaeru.Define.HoursType)
 *   weather: 默认 1 sunny(合法值, 以前是 0 这个不存在的值); st.weather 可覆盖
 * 每 60 秒核对一次, 跨段时 dispatch("weather_load") —— 场景在下次进入时会用新值渲染。
 * 手动: window.MOCK_CLOCK() 立刻核对并打印; window.MOCK_CLOCK(8) 用"本地 8 点"试算。
 */
(function () {
  /* 用户给的天气概率表(WeatherType: 1晴 2阴 3小雨 4暴雨 8小雪 9大雪; 这里把"雨/雪"落成具体档位):
     春 晴50/雨30/阴20 ; 夏 晴40/雨40/暴雨10/阴10 ; 秋 晴50/阴30/雨20 ; 冬 晴40/雪40/阴20 */
  var SEASON_WEATHER = {
    1: [[1, 50], [3, 30], [2, 20]],
    2: [[1, 40], [3, 30], [4, 10], [2, 10]],
    3: [[1, 50], [2, 30], [3, 20]],
    4: [[1, 40], [8, 30], [9, 10], [2, 20]]
  };
  function rollWeather(season) {
    var t = SEASON_WEATHER[Number(season) || 1] || SEASON_WEATHER[1], tot = 0, i;
    for (i = 0; i < t.length; i++) tot += t[i][1];
    var r = Math.random() * tot;
    for (i = 0; i < t.length; i++) { r -= t[i][1]; if (r <= 0) return t[i][0]; }
    return t[0][0];
  }
  var M = window.MockServer, S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  var st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var SEASON = { 1: '春', 2: '夏', 3: '秋', 4: '冬' };
  var HOURS = { 1: '白天', 2: '傍晚', 3: '夜晚', 4: '深夜' };
  function log(m) { try { console.log('[MOCK] 时间: ' + m); } catch (e) {} }
  function sig(e) { return e.season + '/' + e.hours_type + '/' + e.weather; }
  function desc(e) { return SEASON[e.season] + '季·' + HOURS[e.hours_type] + ' (seasonKey=' + (e.season + '' + e.hours_type) + ', weather=' + e.weather + ')'; }
  function payload() { try { return M.handle('weather_load', {}); } catch (e) { return window.MOCK_ENV; } }
  function pushWeather(why) {
    var data = payload();          /* 现在就取值, 别等 30ms 后重算(那期间可能又跨段了) */
    setTimeout(function () {
      try {
        if (M.dispatch) M.dispatch('weather_load', data);
        log('推送 weather_load (' + why + ') -> ' + desc(data));
      } catch (e) {}
    }, 30);
  }
  var last = '';
  function check(manual) {
    var env = payload();
    var now = sig(env);
    if (manual || now !== last) {
      if (last) log('跨段: ' + last + ' -> ' + now + ' | ' + desc(env) + (manual ? ' [手动]' : ''));
      else log('初始: ' + desc(env) + ' | 本地时间 ' + new Date().toLocaleString());
      last = now;
      if (!manual) pushWeather('跨段');
    }
    return env;
  }
  window.MOCK_CLOCK = function (hour) {
    if (typeof hour === 'number') {
      var d = new Date(); d.setHours(hour, 30, 0, 0);
      var e = (M.clockEnv ? M.clockEnv(d) : window.MOCK_ENV);
      log('试算 本地' + hour + '点 -> ' + desc(e));
      return e;
    }
    return check(true);
  };
  window.MOCK_CLOCK.check = check;          /* 测试钩子: 立刻核对一次(跨段会推 weather_load) */
  try { check(); } catch (e) {}
  setInterval(function () { try { check(); } catch (e) {} }, 60000);
  window.MOCK_WEATHER = { roll: rollWeather, table: SEASON_WEATHER };
  log('时间层就绪(真实时钟对齐, 每 60 秒核对; st.weather=' + (typeof st.weather === 'number' ? st.weather : '未设') + ')');
})();
