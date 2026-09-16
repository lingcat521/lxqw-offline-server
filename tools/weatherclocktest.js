/* weatherclocktest: 时间层(季节/时段/天气)必须跟真实本地时钟对齐。
   以前 ENV 写死 {season:3,hours_type:2,weather:0} -> 窗户的灯不亮、屋里永远白天、季节永远秋天。 */
const { BASE, ok, boot, fails } = require('./_harness.js');

boot({});
const M = global.MockServer, ENV = global.MOCK_ENV, st = global.MOCK_STATE || (global.MOCK_STATE = {});
const at = (y, mo, d, h) => new Date(y, mo - 1, d, h, 30, 0);
/* 把"现在"临时冻结在给定时刻: 客户端契约里的 weather_load 是按真实时钟算的 */
function withTime(date, fn) {
  const Real = global.Date;
  global.Date = class extends Real {
    constructor(...a) { if (a.length === 0) super(date.getTime()); else super(...a); }
    static now() { return date.getTime(); }
  };
  try { return fn(); } finally { global.Date = Real; }
}

ok(!!M.clockEnv && !!ENV, 'mock.js 暴露了 clockEnv / MOCK_ENV');
ok(typeof window.MOCK_CLOCK === 'function', '时间层装上了 window.MOCK_CLOCK');

const cases = [
  [at(2026, 9, 14, 8),  3, 1, '9月8点 = 秋·白天'],
  [at(2026, 9, 14, 17), 3, 2, '9月17点 = 秋·傍晚'],
  [at(2026, 9, 14, 20), 3, 3, '9月20点 = 秋·夜晚(窗户灯亮)'],
  /* 用户给的时段表: 清晨 05:00-08:00(hours_type 4) / 白天 08:00-17:00(1) / 黄昏 17:00-19:00(2) / 夜晚 19:00-05:00(3) */
  [at(2026, 9, 14, 1),  3, 3, '9月1点 = 秋·夜晚(19:00-05:00)'],
  [at(2026, 9, 14, 6),  3, 4, '9月6点 = 秋·清晨(05:00-08:00)'],
  [at(2026, 9, 14, 10), 3, 1, '9月10点 = 秋·白天(08:00-17:00)'],
  [at(2026, 9, 14, 18), 3, 2, '9月18点 = 秋·黄昏(17:00-19:00)'],
  [at(2026, 9, 14, 21), 3, 3, '9月21点 = 秋·夜晚'],
  [at(2026, 1, 10, 12), 4, 1, '1月12点 = 冬·白天'],
  [at(2026, 4, 5, 12),  1, 1, '4月12点 = 春·白天'],
  [at(2026, 7, 20, 12), 2, 1, '7月12点 = 夏·白天']
];
cases.forEach(function (c) {
  const e = withTime(c[0], function () { return M.clockEnv(); });
  ok(e.season === c[1] && e.hours_type === c[2], c[3] + ' [' + e.season + '/' + e.hours_type + ']');
  const p = withTime(c[0], function () { return M.handle('weather_load', {}); });
  ok(p.season === c[1] && p.hours_type === c[2], c[3] + ' weather_load 下发一致');
  ok(p.weather >= 1 && p.weather <= 9, c[3] + ' weather 是合法值 [' + p.weather + ']');
});

/* weather 覆盖(测试/GM 用) */
st.weather = 3;
ok(withTime(at(2026, 9, 14, 8), function () { return M.handle('weather_load', {}).weather; }) === 3, 'st.weather=3 覆盖生效');
delete st.weather;
ok(withTime(at(2026, 9, 14, 8), function () { return M.handle('weather_load', {}).weather; }) === 1, '没覆盖时默认 sunny(1)');

/* seasonKey 必须落在 APK 里真实存在的 16 个资源组里 */
const KEYS = ['11','12','13','14','21','22','23','24','31','32','33','34','41','42','43','44'];
let badKeys = [];
[[3, 8], [6, 12], [9, 17], [12, 20], [1, 1], [4, 14], [7, 21], [10, 23]].forEach(function (mo) {
  [8, 17, 20, 1].forEach(function (h) {
    const e = withTime(at(2026, mo[0], 10, h), function () { return M.clockEnv(); });
    const key = e.season + '' + e.hours_type;
    if (KEYS.indexOf(key) < 0) badKeys.push(key);
  });
});
ok(badKeys.length === 0, '32 种(月×时段)组合的 seasonKey 全部落在 season11..season44 [' + (badKeys.join(',') || 'ok') + ']');

/* 跨段推送 */
(async function () {
  let pushed = 0, seen = null;
  const real = M.dispatch;
  M.dispatch = function (name, data) { if (name === 'weather_load') { pushed++; seen = data; } return real.apply(this, arguments); };
  await withTime(at(2026, 9, 14, 20), async function () {
    M.clockEnv(); window.MOCK_CLOCK.check();
    const before = pushed;
    await withTime(at(2026, 9, 14, 8), async function () {
      M.clockEnv(); window.MOCK_CLOCK.check();
      await new Promise(r => setTimeout(r, 80));
      ok(pushed > before, '跨段时推了一次 weather_load (pushed=' + pushed + ')');
      ok(seen && seen.hours_type === 1, '推的是新时段 [' + (seen && seen.hours_type) + ']');
    });
  });
  M.dispatch = real;
  console.log(fails() === 0 ? 'ALL CLOCK CHECKS PASSED' : (fails() + ' CHECK(S) FAILED'));
  process.exit(fails() === 0 ? 0 : 1);
})();
