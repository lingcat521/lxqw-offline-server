/* partytest: 聚会状态机(new/party.js 重写后) —— 聚会本身由"访客离开 -> 门口邀请卡片 ->
   准备手信 -> 出发"触发(见 tools/partyinvitetest.js), 本文件只验这一层:
   青蛙真的离开小屋(status=1, party=1), 不设 traveling(不被当成旅行结算), 归来时回到小屋,
   PartyGo(23) 播报, 并且**不再**有"每 90 分钟自己开一场"。 */
const { BASE, ok, boot, fails } = require('./_harness.js');
const fs = require('fs');
const ITEMS = JSON.parse(fs.readFileSync(BASE + '/tables/Item_json.json', 'utf8'));
const byId = {}; ITEMS.forEach(i => byId[Number(i.id)] = i);
boot({ stubs: g => {
  g.Tabikaeru.DataManager = { instance: () => ({ ItemDB: { get: id => byId[Number(id)] || null, list: () => ITEMS },
                                                 CharaDB: { src: { data: [{ id: 0 }, { id: 1 }, { id: 2 }] } } }) };
}});
const st = global.MOCK_STATE || (global.MOCK_STATE = {});
const M = global.MockServer;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const evs = [];
const realDispatch = M.dispatch;
M.dispatch = function (n, d) { if (n === 'notify_new_event' && d && d.event) evs.push(d.event); return realDispatch.apply(this, arguments); };

(async function () {
  st.kitV2 = st.kitV3 = st.kitV4 = st.kitV5 = st.kitGranted = 1;
  st.party = { started: 0, guest: -1, ends: 0 }; st.partyLog = [];
  st.frog = { status: 0, motion: 0, traveling: false, returnAt: 0 };
  st.photos = []; st.nextPhoto = 1; st.ticket = 0; st.house = [];

  ok(window.MOCK_PARTY.start('单测', { guest: 2, seconds: 5 }) === true, '能发起一场聚会(赴约)');
  ok(Number(st.frog.status) === 1 && Number(st.frog.party) === 1, '青蛙离开小屋 [' + st.frog.status + '/' + st.frog.party + ']');
  ok(Number(st.frog.traveling) !== 1, '不设 traveling(聚会奖励由绘纸流程发, 不走旅行结算)');
  ok(window.MOCK_PARTY.start('重复', {}) === false, '同一时间只能有一场聚会');
  await sleep(200);
  const go = evs.filter(e => Number(e.evt_type) === 23)[0];
  ok(!!go, '播报 PartyGo(23)');
  ok(go && Number(go.evt_id) >= 0 && Number(go.evt_id) <= 2, 'evt_id 是邻居编号(客户端据此选图) [' + (go && go.evt_id) + ']');
  ok(Number(st.party.guest) === 2, '记住了是哪位邻居 [' + st.party.guest + ']');
  ok(window.MOCK_PARTY.finish('单测') === true, '聚会结束');
  ok(Number(st.frog.status) === 0 && Number(st.frog.party) === 0, '青蛙回到小屋 [' + st.frog.status + ']');
  ok((st.partyLog || []).length === 1 && Number(st.partyLog[0].guest) === 2, '记了一笔聚会日志 [' + JSON.stringify(st.partyLog) + ']');
  ok(window.MOCK_PARTY.finish('再来一次') === false, '没在聚会时 finish 返回 false');
  await sleep(300);
  ok(Number(st.frog.status) === 0, '没有邀请时它就一直待在家(不再每 90 分钟自己开一场)');

  console.log(fails() === 0 ? 'ALL PARTY CHECKS PASSED' : (fails() + ' CHECK(S) FAILED'));
  process.exit(fails() === 0 ? 0 : 1);
})();
