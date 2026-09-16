/* calendartest: 限时活动按真实日历开启 (new/calendar.js)
 *
 * The reported bug: "现在是9月份却弹出了春节贺卡的活动".
 * The client hides an activity when its payload carries end_time = 0
 * (isOpen() = getServerTime() in [1, end_time]), but the activity layers used to do
 *   endTime = now + 7 days     whenever it had expired -> every 限时活动 was open forever.
 */
const H = require('./_harness.js');
const fs = H.fs, BASE = H.BASE, ok = H.ok;
H.boot();
const M = global.MockServer;
const CAL = window.MOCK_CALENDAR;
const D = (y, m, d) => new Date(y, m - 1, d, 12, 0, 0);

(async function () {
  ok(!!CAL, 'new/calendar.js exposes window.MOCK_CALENDAR');

  /* ---- the real calendar decides ---- */
  const sep = CAL.activity('springcard', D(2026, 9, 13));
  ok(sep.active === false && sep.end === 0, '2026-09-13: 春卡 is closed (' + sep.reason + ')');
  ok(CAL.activity('greetcard', D(2026, 9, 13)).active === false, '2026-09-13: 贺卡 is closed');
  ok(CAL.activity('museumday', D(2026, 9, 13)).active === false, '2026-09-13: 博物馆日 is closed');

  const sf = CAL.activity('springcard', D(2026, 2, 17));      /* 2026 春节 = 02-17 */
  ok(sf.active === true && sf.end > Math.floor(D(2026, 2, 17).getTime() / 1000),
     '2026-02-17 (春节当天): 春卡 open until ' + new Date(sf.end * 1000).toISOString().slice(0, 10));
  ok(CAL.activity('springcard', D(2026, 1, 20)).active === false, '2026-01-20: 春卡 not open yet');
  ok(CAL.activity('springcard', D(2026, 3, 20)).active === false, '2026-03-20: 春卡 already over (春节+15 天)');
  ok(CAL.activity('greetcard', D(2026, 12, 25)).active === true, '2026-12-25: 贺卡 open');
  ok(CAL.activity('greetcard', D(2027, 1, 3)).active === true, '2027-01-03: 贺卡 still open (窗口跨年)');
  ok(CAL.activity('greetcard', D(2027, 1, 20)).active === false, '2027-01-20: 贺卡 closed again');
  ok(CAL.activity('museumday', D(2027, 5, 18)).active === true, '2027-05-18 (国际博物馆日): open');
  ok(CAL.activity('museumday', D(2027, 6, 1)).active === false, '2027-06-01: 博物馆日 closed');

  /* 常驻玩法不受日历限制 */
  ok(CAL.activity('partycake', D(2026, 9, 13)).active === true, '常驻玩法(蛋糕派对) 一直开启');

  /* ---- the activity layers must honour it ---- */
  const spring0 = M.handle('springcard_load', {});
  ok(spring0 && spring0.end_time !== undefined, 'springcard_load answers an end_time');
  ok(spring0.end_time === 0, '2026-09 设备时间下 springcard_load.end_time = 0 (活动隐藏)');
  const greet0 = M.handle('greetcard_load', {});
  ok(greet0.end_time === 0, '2026-09 device time: greetcard_load.end_time = 0');
  const mus0 = M.handle('museumday_load', {});
  ok(mus0.end_time === 0, '2026-09 device time: museumday_load.end_time = 0');

  /* force / disable overrides from calendar.json (or set at runtime for testing) */
  CAL.cfg.force = ['springcard'];
  const forced = M.handle('springcard_load', {});
  ok(forced.end_time > Math.floor(Date.now() / 1000), 'calendar.json force makes 春卡 open again (end_time ' + forced.end_time + ')');
  CAL.cfg.force = [];
  CAL.cfg.disable = ['museumday'];
  ok(M.handle('museumday_load', {}).end_time === 0, 'calendar.json disable keeps an activity closed');

  console.log(H.fails() ? '\ncalendartest: ' + H.fails() + ' FAILED' : '\ncalendartest: all checks passed');
  process.exit(H.fails() ? 1 : 0);
})();
