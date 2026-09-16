/* lxqw 聚会（赴约）—— **原版的触发方式是"朋友来串门离开后留下邀请卡片"**，不是定时器。
 *
 * 用户 2026-09-15 纠正: "青蛙去别人家聚会，不需要你提前准备行李或满足特定条件，而是由朋友主动发出邀请。
 *   朋友来你家串门离开后，会在门口留下邀请卡片，你点击接受，青蛙就会出发去聚会。"
 *   · 接收邀请: 门口出现邀请卡片(带颜色代表不同朋友) -> 点它选"是"
 *   · 准备手信: 接受后进小屋准备伴手礼(绘纸流程里的 Souvenir: bag[0] 手信 + bag[1..] 特产)
 *   · 聚会奖励: 主要是**友情绘本/绘纸**, 也可能带回家具、道具
 * 客户端里的对应实现就在**绘纸系统**上(不是另开一套):
 *   guest_load_drawing(state=invite) -> 庭院出现 out_invite_* 邀请按钮
 *   客户端文案也是这么写的: "请到小屋内准备手信吧" / "留意门口的小卡片，准备好伴手礼，小青蛙就会去找小伙伴聚会啦！"
 *   年度回顾里的字段就叫 visit_num(聚会次数) 与 page_num(绘纸张数)。
 *
 * 所以本层只做**一件事**: "青蛙正在别人家聚会"这个状态(frog.status=1 + party=1 + PartyGo 播报),
 * 以及归来时把它放回小屋。邀请/手信/奖励/PartyResult 全部由 new/drawing.js 的绘纸流程负责
 * (DRAW_MS 就是这一趟聚会的时长)。以前这层自己每 90 分钟随机开一场 + 送明信片/特产/抽奖券,
 * 那是错的(没有邀请、也没手信)。
 */
(function () {
  var M = window.MockServer, st = window.MOCK_STATE || (window.MOCK_STATE = {});
  function log(m) { try { console.log('[MOCK] 聚会: ' + m); } catch (e) {} }
  function nowSec() { return Math.floor(Date.now() / 1000); }
  function save() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

  function busy() { return !!(st.party && st.party.started); }
  /* 出发赴约: 青蛙离开小屋 + 播报 PartyGo(23)"精力充沛地出去聚会了" */
  function start(why, opts) {
    opts = opts || {};
    if (busy()) return false;
    var guest = (opts.guest !== undefined && num(opts.guest) >= 0) ? num(opts.guest) : Math.floor(Math.random() * 3);
    var ends = opts.ends || (Date.now() + num(opts.seconds || 150) * 1000);
    st.party = { started: nowSec(), guest: guest, ends: Math.floor(ends / 1000), why: why || '' };
    /* 真的让它出门(status=1): travel2 的状态观察器会把 MOCK_REFRESH_ROOM 递到小屋视图上,
       青蛙立刻从屋里消失; **不设 traveling** —— 那是旅行结算的标志, 会被 rules.js 的泵按旅行结账。 */
    if (st.frog) { st.frog.status = 1; st.frog.party = 1; st.frog.motion = 0; st.frog.motionSince = 0; }
    save();
    try {
      if (window.MOCK_NOTICE) window.MOCK_NOTICE(23, [1], { evt_id: guest }, 'partygo');
      else if (window.MOCK_EVENT) window.MOCK_EVENT(23, [1], { evt_id: guest });
    } catch (e) {}
    log('出发赴约(邻居 ' + guest + ', ' + Math.round((ends - Date.now()) / 1000) + ' 秒) [' + (why || '') + ']');
    return true;
  }
  /* 聚会结束: 青蛙回到小屋(PartyResult 由绘纸流程发) */
  function finish(why) {
    if (!busy()) return false;
    var guest = num(st.party && st.party.guest);
    st.partyLog = Array.isArray(st.partyLog) ? st.partyLog : [];
    st.partyLog.push({ guest: guest, kind: 'visit', why: why || '', time: Date.now() });
    if (st.partyLog.length > 60) st.partyLog = st.partyLog.slice(-60);
    st.party = { started: 0, guest: -1, ends: 0 };
    if (st.frog) { st.frog.status = 0; st.frog.party = 0; st.frog.returnAt = 0; st.frog.traveling = false; }
    save();
    log('聚会归来(邻居 ' + guest + ') [' + (why || '') + '] -> 青蛙回到小屋');
    return true;
  }
  window.MOCK_PARTY = {
    start: function (why, opts) { return start(why || '手动', opts); },
    finish: function (why) { return finish(why || '手动'); },
    state: function () { return st.party || { started: 0, guest: -1, ends: 0 }; },
    log: function () { return (st.partyLog || []).slice(); },
    busy: busy,
    /* 兼容旧测试/GM: 手动来一场(150 秒) */
    manual: function () { return start('手动', { seconds: 150 }); }
  };
  /* 兜底: 万一绘纸流程没接管(比如客户端没装绘纸入口), 到点也要把青蛙放回来 */
  setInterval(function () {
    try {
      if (busy() && nowSec() >= num(st.party.ends)) { log('到点但绘纸流程没接管 -> 直接放它回来'); finish('兜底到点'); }
    } catch (e) {}
  }, 30000);
  log('聚会层就绪(重写): 聚会由"访客离开 -> 门口邀请卡片 -> 准备手信 -> 出发"触发, 见 new/drawing.js; ' +
      '本层只负责青蛙在不在家, 现在 party=' + (busy() ? '进行中' : '无'));
})();
