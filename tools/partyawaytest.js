/* partyawaytest: 聚会时青蛙必须离开小屋(用户报「出去聚会以后怎么还渲染在家里」),
   以及旅行笔记的 27 篇旅友笔记(带对应特产出门才解锁)。 */
const { BASE, ok, boot, fails } = require('./_harness.js');
const fs = require('fs');
const ITEMS = JSON.parse(fs.readFileSync(BASE + '/tables/Item_json.json', 'utf8'));
const NOTES = JSON.parse(fs.readFileSync(BASE + '/tables/Note_json.json', 'utf8'));
const byId = {}; ITEMS.forEach(i => byId[Number(i.id)] = i);
const noteRows = Array.isArray(NOTES) ? NOTES : Object.keys(NOTES).map(k => NOTES[k]);
const friendNotes = noteRows.filter(r => Number(r.type) === 2);
boot({ stubs: g => {
  g.Tabikaeru.DataManager = { instance: () => ({
    ItemDB: { get: id => byId[Number(id)] || null, list: () => ITEMS },
    TravelNoteDB: { get: id => noteRows.filter(r => Number(r.id) === Number(id))[0] || null, list: () => noteRows }
  }) };
}});
const st = global.MOCK_STATE || (global.MOCK_STATE = {});
const S = global.MOCK_SEMANTIC, M = global.MockServer;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pulled = [];
const realDispatch = M.dispatch;
M.dispatch = function (n) { pulled.push(n); return realDispatch.apply(this, arguments); };

(async function () {
  st.kitV2 = st.kitV3 = st.kitV4 = st.kitV5 = st.kitGranted = 1;
  st.partyLast = Math.floor(Date.now() / 1000);
  st.party = { started: 0, guest: -1, ends: 0 };
  st.frog = { status: 0, motion: 0, traveling: false, returnAt: 0 };
  st.photos = []; st.nextPhoto = 1; st.ticket = 0; st.house = []; st.notes = []; st.travelCount = 0;

  /* --- 1) 聚会出门/回家 --- */
  ok(window.MOCK_PARTY.start() === true, '能发起一场聚会');
  ok(Number(st.frog.status) === 1, '聚会时青蛙离开小屋 (status=1, 小屋里不再渲染它) [' + st.frog.status + ']');
  ok(Number(st.frog.traveling) !== 1, '但没有设 traveling(否则会被 rules.js 的旅行结算泵当成一趟旅行结账)');
  await sleep(1600);
  ok(pulled.indexOf('client_load_role') >= 0, '离开时会推 client_load_role(小屋重画)');
  st.party.ends = Math.floor(Date.now() / 1000) - 1;
  window.MOCK_PARTY.finish();
  ok(Number(st.frog.status) === 0, '聚会结束 -> 青蛙重新出现在屋里 [' + st.frog.status + ']');
  ok(Number(st.frog.party) === 0, 'party 标记清掉');
  ok((st.partyLog || []).length >= 1, '聚会结果照样记账 [' + (st.partyLog || []).length + ']');

  /* --- 2) 27 篇旅友笔记 --- */
  ok(friendNotes.length === 27, 'Note 表里 type2(旅友笔记) 共 27 篇 [' + friendNotes.length + ']');
  const group = k => friendNotes.filter(r => String(Number(r.factorData)) === String(k)).map(r => Number(r.id));
  ok(group(100).length === 3 && group(35).length === 21 && group(15).length === 3,
     '掉落分组: 初次相遇 3 篇 / 枣泥核桃糖(35) 21 篇 / 桂花蒸米糕(15) 3 篇 [' + group(35).length + ']');
  const st2 = () => st;
  /* 走真实入口: 准备(items 当行李) -> 到点 -> rules.js 的 comeBack 结算 */
  function comeBackWith(items) {
    st2().bag = items.slice(); st2().desk = [-1,-1,-1,-1,-1,-1,-1,-1];
    st2().frog = { status: 0, motion: 0, traveling: false, returnAt: 0 };
    st2().gifts = []; st2().photos = st2().photos || []; st2().nextPhoto = st2().nextPhoto || 1;
    st2().ticket = st2().ticket || 0; st2().clover = st2().clover || 0;
    st2().notes = st2().notes || [];
    M.handle('item_set_bag_completed', { completed: true }); window.MOCK_FORCE_DEPART();     /* depart: 记 lastTripItems + travelCount++ */
    return new Promise(res => { window.MOCK_COME_HOME(); setTimeout(res, 30); });
  }
  const ids = () => (st.notes || []).map(n => Number(n.id));
  /* 头三趟把"初次相遇"三篇拿全(不带东西也给) */
  for (let i = 0; i < 3; i++) { st.frog = { status: 0, motion: 0, traveling: false, returnAt: 0 }; await comeBackWith([0]); st.frog.status = 0; st.frog.traveling = false; }
  const firsts = ids().filter(id => id >= 2000 && id <= 2002);
  ok(firsts.length === 3, '前几趟先给"初次相遇"三篇(旅友栏/礼品盒因此解锁) [' + firsts.join(',') + ']');
  /* 带枣泥核桃糖(35) -> 解锁 35 组里的新一篇 */
  st.frog = { status: 0, motion: 0, traveling: false, returnAt: 0 };
  await comeBackWith([35, 0]); st.frog.status = 0; st.frog.traveling = false;
  const n35 = ids().filter(id => group(35).indexOf(id) >= 0);
  ok(n35.length >= 1, '带枣泥核桃糖出门 -> 解锁 35 组旅友笔记 [' + n35.join(',') + ']');
  /* 带桂花蒸米糕(15) -> 解锁 15 组 */
  st.frog = { status: 0, motion: 0, traveling: false, returnAt: 0 };
  await comeBackWith([15, 0]); st.frog.status = 0; st.frog.traveling = false;
  const n15 = ids().filter(id => group(15).indexOf(id) >= 0);
  ok(n15.length >= 1, '带桂花蒸米糕出门 -> 解锁 15 组旅友笔记 [' + n15.join(',') + ']');
  /* 不带对应特产 -> 不会再白送 */
  const before = ids().filter(id => id >= 2000 && id <= 2026).length;
  st.frog = { status: 0, motion: 0, traveling: false, returnAt: 0 };
  await comeBackWith([0]); st.frog.status = 0; st.frog.traveling = false;
  const after = ids().filter(id => id >= 2000 && id <= 2026).length;
  ok(after === before, '没带对应特产就不给新的旅友笔记 [' + before + ' -> ' + after + ']');
  /* 反复带 35 -> 能补齐整组(21 篇) */
  for (let i = 0; i < 25; i++) {
    st.frog = { status: 0, motion: 0, traveling: false, returnAt: 0 };
    await comeBackWith([35, 0]); st.frog.status = 0; st.frog.traveling = false;
  }
  const got35 = ids().filter(id => group(35).indexOf(id) >= 0).length;
  ok(got35 === 21, '反复带枣泥核桃糖能把 35 组 21 篇补齐 [' + got35 + '/21]');
  const total = ids().filter(id => id >= 2000 && id <= 2026).length;
  ok(total >= 25, '旅友笔记总收集 ' + total + '/27');

  console.log(fails() === 0 ? 'ALL PARTY-AWAY/NOTE-27 CHECKS PASSED' : (fails() + ' CHECK(S) FAILED'));
  process.exit(fails() === 0 ? 0 : 1);
})();
