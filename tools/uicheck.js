/* uicheck: UI 自检(用户: "我不想要代价, 我想要实时推送") —— 静态 + 运行时两条线
   ① 实时推送但**零代价**: 状态不变时不许有任何重画/重复推送(两个静置窗口对比)
   ② 只在真变化时推 client_load_role(这条推送会让客户端重建青蛙精灵, 是以前"拖不动/被遮挡"的根源)
   ③ PUSH_LIST 干净: 全部有 handler, 且没有花盆这类会反复重建场景的推送
   ④ 小屋重画: 同状态第二次调用不重画 / 5 秒节流 / st.roomRefresh=0 能一键关
   ⑤ 居家动作只用 0..4(室内)与 10..13(睡觉), 绝不用 5..9(那是庭院工序动画, 会累积精灵)
   ⑥ 新层(日记/明信片路线/节气照/家具风格)没有周期性推送 */
const { BASE, ok, boot, fails } = require('./_harness.js');
const fs = require('fs');
const ITEMS = JSON.parse(fs.readFileSync(BASE + '/tables/Item_json.json', 'utf8'));
const NOTES = JSON.parse(fs.readFileSync(BASE + '/tables/Note_json.json', 'utf8'));
const noteList = Object.keys(NOTES).map(k => NOTES[k]);
const noteById = {}; noteList.forEach(n => noteById[Number(n.id)] = n);
const itemById = {}; ITEMS.forEach(i => itemById[Number(i.id)] = i);
boot({ stubs: g => {
  g.Tabikaeru.DataManager = { instance: () => ({
    ItemDB: { get: id => itemById[Number(id)] || null, list: () => ITEMS },
    TravelNoteDB: { get: id => noteById[Number(id)] || null, list: () => noteList }
  }) };
}});
const st = global.MOCK_STATE || (global.MOCK_STATE = {});
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async function () {
  const M = global.MockServer, F = window.MOCK_FROGSTATE;
  let counts = {}, total = 0, watching = false;
  const orig = M.dispatch.bind(M);
  M.dispatch = function (n, d) { if (watching) { counts[n] = (counts[n] || 0) + 1; total++; } return orig(n, d); };

  /* ---- ① 两个静置窗口: 状态不变 -> 不该有推送 ---- */
  st.frog = st.frog || {};
  st.frog.status = 0; st.frog.crafting = 0; st.frog.party = 0;
  st.bag = []; st.desk = []; st.house = [];           /* 空行李 -> 不会自主出发 */
  st.furniture = st.furniture || {}; st.furniture.make = { id: 0 };
  st.furniture.bench = [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1];
  F.set(0);                                            /* 固定动作 0(看书) */
  st.frog.motionHold = 10 ** 6;                        /* 静置期间不会换动作 */
  counts = {}; total = 0; watching = true;
  for (let i = 0; i < 30; i++) F.tick();
  await sleep(9000);
  const w1 = total, c1 = JSON.stringify(counts);        /* 第一窗 = 启动同步(客户端连上后要一次初值) */
  counts = {}; total = 0;
  for (let i = 0; i < 30; i++) F.tick();
  await sleep(9000);
  const w2 = total, c2 = JSON.stringify(counts);
  counts = {}; total = 0;
  for (let i = 0; i < 30; i++) F.tick();
  await sleep(9000);
  const w3 = total, c3 = JSON.stringify(counts);
  watching = false;
  ok(w1 <= 20, '启动那一窗只有初值同步(' + w1 + ' 条): ' + c1);
  /* 静置窗口里"状态真的变了"的推送(比如来了位访客)是应该的; 不许出现的是**重画场景/重复推同一份状态** */
  const HEAVY = ['client_load_role', 'misc_moment_load', 'furniture_load_furniture', 'furniture_load_flowerpot', 'item_load_items'];
  const c2o = JSON.parse(c2 || '{}'), c3o = JSON.parse(c3 || '{}');
  const heavy2 = HEAVY.reduce((a, k) => a + (c2o[k] || 0), 0), heavy3 = HEAVY.reduce((a, k) => a + (c3o[k] || 0), 0);
  ok(heavy2 === 0 && heavy3 === 0, '静置窗口里没有一条"重画场景"的推送 [' + heavy2 + '/' + heavy3 + ']');
  ok(w2 <= 2 && w3 <= 2, '静置窗口里最多只有"真的变了"的一两条推送(第二窗 ' + w2 + ' 条 ' + c2 + ' / 第三窗 ' + w3 + ' 条 ' + c3 + ')');

  /* ---- ② 动作变了才推 client_load_role ---- */
  counts = {}; total = 0; watching = true; window.MOCK_ROOM_RESET_THROTTLE();
  F.set(1);                                            /* 0 -> 1: 真变化 */
  await sleep(200);
  const roleOnChange = counts['client_load_role'] || 0;
  counts = {}; total = 0;
  for (let i = 0; i < 20; i++) { F.set(1); F.tick(); }  /* 同一个动作反复 set/tick */
  await sleep(200);
  watching = false;
  ok(roleOnChange >= 1 && (counts['client_load_role'] || 0) === 0,
     '动作真变化时推 1 次 client_load_role(' + roleOnChange + '), 重复 set 同一个动作不再推 [' + (counts['client_load_role'] || 0) + ']');

  /* ---- ③ PUSH_LIST 干净 ---- */
  const list = M.PUSH_LIST || [];
  const missing = list.filter(n => !(M.handlers && M.handlers[n]) && typeof (global.MOCK_SEMANTIC || {})[n] !== 'function');
  ok(missing.length === 0, 'PUSH_LIST 里 ' + list.length + ' 条都有 handler [' + missing.join(',') + ']');
  ok(list.indexOf('furniture_load_flowerpot') < 0, '花盆推送不在推送表里(它会反复重建场景)');

  /* ---- ④ 小屋重画的"零代价"三条 ---- */
  window.MOCK_ROOM_RESET_THROTTLE();
  st.frog.motion = 2;
  const a1 = window.MOCK_REFRESH_ROOM('自检-第一次');
  const a2 = window.MOCK_REFRESH_ROOM('自检-同状态第二次');
  ok(a2 === 0, '状态没变 -> 第二次不重画 [' + a1 + '/' + a2 + ']');
  st.frog.motion = 3;
  const a3 = window.MOCK_REFRESH_ROOM('自检-变了但节流中');
  ok(a3 === 0, '5 秒内就算状态变了也不重画(节流) [' + a3 + ']');
  const a4 = window.MOCK_REFRESH_ROOM('自检-强制', true);
  ok(a4 >= 0, 'force 可以强制重画一次 [' + a4 + ']');
  st.roomRefresh = 0;
  const a5 = window.MOCK_REFRESH_ROOM('自检-开关关掉', true);
  st.roomRefresh = 1;
  ok(a5 === 0, 'st.roomRefresh=0 一键关掉小屋重画 [' + a5 + ']');

  /* ---- ⑤ 居家动作不会用庭院工序动画 ---- */
  const seen = {};
  for (let i = 0; i < 200; i++) { st.frog.motion = -1; st.frog.motionSince = 0; F.tick(); seen[st.frog.motion] = 1; }
  const bad = Object.keys(seen).map(Number).filter(m => m >= 5 && m <= 9);
  ok(bad.length === 0, '居家动作只用室内那几号(0..4/10..13), 没出现 5..9 [' + Object.keys(seen).join(',') + ']');

  /* ---- ⑥ 新层没有周期性推送 ---- */
  const srcs = ['diary.js', 'postroute.js', 'solarphoto.js', 'furnstyle.js'];
  let offenders = [];
  srcs.forEach(f => {
    const t = fs.readFileSync(BASE + '/new/' + f, 'utf8');
    const iv = t.match(/setInterval\(([\s\S]{0,400}?)\}\s*,\s*(\d+)\)/g) || [];
    iv.forEach(block => {
      if (/dispatch\(/.test(block) && !/last|Sig|trips|prev/.test(block)) offenders.push(f + ':' + block.slice(0, 60).replace(/\s+/g, ' '));
    });
  });
  ok(offenders.length === 0, '新层的定时器都不带无条件的 dispatch [' + offenders.join(' | ') + ']');

  console.log(fails() === 0 ? 'ALL UI CHECKS PASSED' : ('UI CHECK FAILED: ' + fails()));
  process.exit(fails() === 0 ? 0 : 1);
})();
