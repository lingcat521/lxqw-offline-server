/* lxqw offline activity calendar: the original server decided WHEN each 限时活动 runs;
 * our mock used to keep every activity open forever (endTime = now + 7 days whenever it
 * expired), so a 春节 event popped up in September.  This layer maps the real-world
 * calendar onto the activities and hands each layer an authoritative end time.
 *
 * Contract used by the activity layers (verified in main.min.js):
 *   every 限时活动 payload carries end_time and the client does
 *   isOpen() = getServerTime() in [1, end_time]  ->  end_time 0 hides the activity.
 *
 * Windows (real world, device clock):
 *   春卡 springcard  : 春节前 7 天 ~ 元宵节 (春节 +15 天)
 *   贺卡 greetcard   : 12-20 ~ 次年 01-10 (圣诞/元旦)
 *   博物馆日 museumday: 05-10 ~ 05-31 (国际博物馆日 5/18)
 *   everything else  : always open (常驻玩法: 扭蛋/许愿/绘纸/抽奖/蛋糕派对)
 *
 * new/calendar.json can override for testing:
 *   { "force": ["springcard"], "disable": ["museumday"] }
 */
(function () {
  var BASE = "http://127.0.0.1:8089/";
  function lg(m) { try { console.log("[MOCK] " + m); } catch (e) {} }
  var CFG = { force: [], disable: [] };
  try {
    var x = new XMLHttpRequest();
    x.open("GET", BASE + "calendar.json?t=" + Date.now(), false);
    x.send(null);
    if (x.responseText && x.responseText.indexOf("not found") < 0 && x.responseText.indexOf("<!DOCTYPE") < 0) {
      var j = JSON.parse(x.responseText);
      if (Array.isArray(j.force)) CFG.force = j.force.map(String);
      if (Array.isArray(j.disable)) CFG.disable = j.disable.map(String);
      lg("calendar.json: force=" + JSON.stringify(CFG.force) + " disable=" + JSON.stringify(CFG.disable));
    }
  } catch (e) {}

  /* 农历春节的公历日期(到 2032 年) */
  var SPRING_FESTIVAL = {
    2025: [1, 29], 2026: [2, 17], 2027: [2, 6], 2028: [1, 26],
    2029: [2, 13], 2030: [2, 3], 2031: [1, 23], 2032: [2, 11]
  };
  function sec(d) { return Math.floor(d.getTime() / 1000); }
  function at(y, m, d, h) { return new Date(y, m - 1, d, h || 0, 0, 0); }
  function when(now) {
    var y = now.getFullYear(), m = now.getMonth() + 1, day = now.getDate();
    var sf = SPRING_FESTIVAL[y] || [2, 1];
    /* the new-year window starts in December, so in early January it belongs to y-1 */
    var inJan = (m === 1);
    return {
      springcard: { name: "春卡(春节)", start: sec(at(y, sf[0], sf[1] - 7)), end: sec(at(y, sf[0], sf[1] + 15, 23)) },
      greetcard: { name: "贺卡(圣诞/元旦)",
                   start: sec(at(inJan ? y - 1 : y, 12, 20)),
                   end: sec(at(inJan ? y : y + 1, 1, 10, 23)) },
      museumday: { name: "博物馆日", start: sec(at(y, 5, 10)), end: sec(at(y, 5, 31, 23)) }
    };
  }
  function iso(t) { try { return new Date(t * 1000).toISOString().slice(0, 10); } catch (e) { return "?"; } }
  function activity(name, nowDate) {
    var now = nowDate || new Date();
    var t = sec(now);
    if (CFG.disable.indexOf(name) >= 0) return { active: false, end: 0, name: name, reason: "calendar.json disable" };
    if (CFG.force.indexOf(name) >= 0) return { active: true, end: t + 7 * 86400, name: name, reason: "calendar.json force" };
    var w = when(now)[name];
    if (!w) return { active: true, end: t + 7 * 86400, name: name, reason: "常驻" };
    if (t < w.start) return { active: false, end: 0, name: w.name, reason: "未开始 (" + iso(w.start) + ")" };
    if (t > w.end) return { active: false, end: 0, name: w.name, reason: "已结束 (" + iso(w.end) + ")" };
    return { active: true, end: w.end, name: w.name, reason: "进行中, 到 " + iso(w.end) };
  }
  window.MOCK_CALENDAR = {
    cfg: CFG, activity: activity, windows: when,
    report: function (nowDate) {
      var out = [], names = ["springcard", "greetcard", "museumday"];
      for (var i = 0; i < names.length; i++) {
        var a = activity(names[i], nowDate);
        out.push(a.name + "=" + (a.active ? "开启(" + a.reason + ")" : "未开启 " + a.reason));
      }
      return out.join("; ");
    }
  };
  lg("活动日历 " + new Date().toISOString().slice(0, 10) + ": " + window.MOCK_CALENDAR.report());

  /* 日历页的「2023 / 癸卯兔年」不是硬编码(客户端 JS 里 2023 = 0 次), 来自 calendarData.note 文案;
     运行时改写成当前真实年份 + 干支 + 生肖。 */
  function ganzhi(y) { var s = '甲乙丙丁戊己庚辛壬癸', b = '子丑寅卯辰巳午未申酉戌亥'; return s[(y - 4) % 10] + b[(y - 4) % 12]; }
  function zodiac(y) { var z = '鼠牛虎兔龙蛇马羊猴鸡狗猪'; return z[(y - 4) % 12]; }
  function patchCalendarNotes() {
    try {
      var dm = Tabikaeru.DataManager.instance(), t = dm && dm.calendarData;
      if (!t || typeof t.get !== 'function') return false;
      var note = t.get('note');
      if (!note) return false;
      var y = new Date().getFullYear(), gz = ganzhi(y), zo = zodiac(y), n = 0;
      for (var k in note) {
        var it = note[k]; if (!it || !Array.isArray(it.desc_list)) continue;
        for (var i = 0; i < it.desc_list.length; i++) {
          var d = String(it.desc_list[i].desc || '');
          if (d.indexOf('2023') >= 0 || d.indexOf('癸卯') >= 0 || d.indexOf('兔年') >= 0) {
            it.desc_list[i].desc = d.replace(/2023/g, String(y)).replace(/癸卯/g, gz).replace(/兔年/g, zo + '年');
            n++;
          }
        }
      }
      lg('日历文案: 改写 ' + n + ' 条为 ' + y + ' ' + gz + zo + '年');
      return true;
    } catch (e) { return false; }
  }
  if (!patchCalendarNotes()) { var ct = 0, civ = setInterval(function () { if (patchCalendarNotes() || ++ct > 40) clearInterval(civ); }, 500); }

  /* 诊断: 打印日历协议的真实应答, 用来定位"领不到奖励"到底缺哪个字段 */
  (function () {
    var M = window.MockServer;
    if (!M || typeof M.handle !== 'function') return;
    var orig = M.handle;
    M.handle = function (name, p) {
      var r = orig.call(M, name, p);
      try { if (String(name).indexOf('calendar_') === 0) console.log('[MOCK] RESP ' + name + ' = ' + JSON.stringify(r).slice(0, 200)); } catch (e) {}
      return r;
    };
  })();

  /* 诊断2: 打印客户端 CalendarModel 的完整状态, 看它认为哪天可领 */
  (function () {
    var n = 0;
    var iv = setInterval(function () {
      n++;
      try {
        var C = window.CalendarModel;
        if (typeof C === 'function') {
          var m = core.ModelManage.getInstance().getModel(C);
          var d = m && m.data;
          if (d) {
            console.log('[MOCK] CALMODEL new_flag=' + JSON.stringify(d.new_flag).slice(0, 80) +
              ' lucky=' + JSON.stringify(d.lucky_days).slice(0, 120) +
              ' st=' + JSON.stringify(d.st_days).slice(0, 120) +
              ' tasks=' + (Array.isArray(d.task_list) ? d.task_list.length : 'n/a') +
              ' beginnerDay=' + JSON.stringify(d.beginner_day));
          }
        }
      } catch (e) {}
      if (n > 24) clearInterval(iv);
    }, 5000);
  })();
})();
