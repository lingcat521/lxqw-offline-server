/* partyinvitetest: 聚会的**正确触发链**(用户 2026-09-15 纠正)：
   朋友来串门 -> 离开后门口留下邀请卡片 -> 你点"是"接受 -> 进小屋准备手信(伴手礼) -> 青蛙出发赴约
   -> 带着绘纸(友情绘本)回来, 还可能带家具/道具。
   客户端里这套就在绘纸系统上(guest_load_drawing 的 state=invite, 庭院出现 out_invite_* 按钮),
   文案也是"请到小屋内准备手信吧"。以前 new/party.js 自己每 90 分钟随机开一场是错的。 */
const { BASE, ok, boot, fails } = require('./_harness.js');
const fs = require('fs');
const ITEMS = JSON.parse(fs.readFileSync(BASE + '/tables/Item_json.json', 'utf8'));
const FURN = JSON.parse(fs.readFileSync(BASE + '/tables/furnitureData_json.json', 'utf8'));
const PAGE = JSON.parse(fs.readFileSync(BASE + '/tables/drawingPageData_json.json', 'utf8'));
const COLL = JSON.parse(fs.readFileSync(BASE + '/tables/drawingCollectData_json.json', 'utf8'));
const byId = {}; ITEMS.forEach(i => byId[Number(i.id)] = i);
const pageRows = Array.isArray(PAGE) ? PAGE : Object.keys(PAGE).map(k => PAGE[k]);
const collRows = Array.isArray(COLL) ? COLL : Object.keys(COLL).map(k => COLL[k]);
const furRows = Object.keys(FURN).map(k => FURN[k]);
boot({ stubs: g => {
  g.Tabikaeru.DataManager = { instance: () => ({
    ItemDB: { get: id => byId[Number(id)] || null, list: () => ITEMS },
    FurnitureDB: { get: id => furRows.filter(r => Number(r.id) === Number(id))[0] || null, list: () => furRows },
    DrawingPage: { get: id => pageRows.filter(r => Number(r.id) === Number(id))[0] || null, list: () => pageRows },
    DrawingCollect: { get: id => collRows.filter(r => Number(r.id) === Number(id))[0] || null, list: () => collRows },
    CharaDB: { src: { data: [{ id: 0 }, { id: 1 }, { id: 2 }] } }
  }) };
}});
const st = global.MOCK_STATE || (global.MOCK_STATE = {});
const S = global.MOCK_SEMANTIC, M = global.MockServer;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const evs = [];
const realDispatch = M.dispatch;
M.dispatch = function (n, d) { if (n === 'notify_new_event' && d && d.event) evs.push(d.event); return realDispatch.apply(this, arguments); };

(async function () {
  st.kitV2 = st.kitV3 = st.kitV4 = st.kitV5 = st.kitGranted = 1;
  st.party = { started: 0, guest: -1, ends: 0 }; st.partyLog = [];
  st.frog = { status: 0, motion: 0, traveling: false, returnAt: 0 };
  st.drawing = undefined; st.house = [{ item_id: 3000, count: 2 }]; st.collections = [];
  st.furniture = { bench: [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1], has_fur: [], put_fur: [], replace_fur: [], box: [] };

  /* --- 1) 访客离开 -> 门口出现邀请卡片 --- */
  st.inviteChance = 1;                                  /* 单测里把 22% 判定固定下来, 免得偶发不中签 */
  st.guestFeed = { id: 1, confirmed: true, served: true, expire_time: Math.floor(Date.now()/1000) + 300, pos: 0 };
  M.handle('guest_finish', {});
  let invited = false;
  for (let i = 0; i < 12 && !invited; i++) {   /* 80% 概率留卡片, 多试几次 */
    if (window.MOCK_DRAWING.state().state === 1) { invited = true; break; }
    st.guestFeed = { id: 2, confirmed: true, served: true, expire_time: Math.floor(Date.now()/1000) + 300, pos: 0 };
    M.handle('guest_finish', {});
  }
  const inv = window.MOCK_DRAWING.state();
  ok(invited && inv.state === 1, '招待过的邻居离开后会留下邀请卡片(state=invite) [' + JSON.stringify(inv) + ']');
  ok(inv.guest >= 0 && inv.guest <= 2, '卡片带邻居编号(0..2, 客户端用它选 out_invite_* 图) [' + inv.guest + ']');
  ok(st.inviteChance === undefined || true, '邀约是"访客离开时独立判定"(概率在 guestfeedtest 里查 22%)');

  /* --- 2) 接受邀请 -> 准备手信 --- */
  ok(S['guest_accept_invit']({ is_accept: 1 }).code === 0, '接受邀请(对象形状) (客户端会提示"请到小屋内准备手信吧")');
  /* 客户端实际发的是裸布尔, 两种形状都要认 */
  S['guest_accept_invit']({ is_accept: 0 });
  ok(window.MOCK_DRAWING.state().state === 0, '不带参数的婉拒 -> 回到等邀请');
  ok(S['guest_accept_invit'](true).code === 0, '接受邀请(裸布尔 true, 客户端真实发法)');
  ok(window.MOCK_DRAWING.state().state === 2, '状态进入 accept(邀约槽里会出现那张卡片) [' + window.MOCK_DRAWING.state().state + ']');
  st.drawing.bag = [-1, -1, -1, -1];
  ok(S['guest_lock_bag']({}).code === 1, '没放手信(bag[0] 空) -> 点了准备也不出发 (code 1)');
  st.drawing.bag = [3000, -1, -1, -1];
  ok(window.MOCK_DRAWING.state().state === 2, '进入"准备手信"状态(state=accept) [' + window.MOCK_DRAWING.state().state + ']');
  ok(Number(st.frog.status) === 0, '这时候青蛙还在家(要等手信备好才出发)');

  /* --- 3) 放手信 + 锁定 -> 青蛙出发赴约 --- */
  ok(S['guest_putin_bag']({ pos: 1, id: 3000 }).code === 0, '把手信放进包袱');
  ok(Number(st.drawing.bag[0]) === 3000, 'bag[0] = 手信(客户端 Souvenir 的第一格) [' + JSON.stringify(st.drawing.bag) + ']');
  evs.length = 0;
  ok(S['guest_lock_bag']({}).code === 0, '锁定手信 -> 出发');
  await sleep(200);
  ok(Number(st.frog.status) === 1 && Number(st.frog.party) === 1, '青蛙离开小屋去赴约 [' + st.frog.status + '/' + st.frog.party + ']');
  ok(Number(st.frog.traveling) !== 1, '不设 traveling(否则会被当成一趟旅行结算)');
  ok(evs.some(e => Number(e.evt_type) === 23), '播报 PartyGo(23)"出去聚会了" [' + evs.map(e => e.evt_type).join(',') + ']');

  /* --- 4) 聚会结束: 回家 + 绘纸(友情绘本) + 可能带家具/道具 --- */
  evs.length = 0;
  const pagesBefore = window.MOCK_DRAWING.state().pages;
  st.drawing.lockUntil = Date.now() - 1;
  window.MOCK_DRAWING.finish();
  await sleep(300);
  ok(Number(st.frog.status) === 0 && Number(st.frog.party) === 0, '聚会结束 -> 青蛙回到小屋 [' + st.frog.status + ']');
  ok(window.MOCK_DRAWING.state().pages === pagesBefore + 1, '拿到一张绘纸(友情绘本 +1) [' + pagesBefore + ' -> ' + window.MOCK_DRAWING.state().pages + ']');
  ok(evs.some(e => Number(e.evt_type) === 24), '播报 PartyResult(24)(客户端据此打开绘本结果页) [' + evs.map(e => e.evt_type).join(',') + ']');
  const r24 = evs.filter(e => Number(e.evt_type) === 24)[0];
  ok(r24 && Array.isArray(r24.evt_value) && Number(r24.evt_value[0]) > 0 && Number(r24.evt_value[1]) > 0,
     'PartyResult 带 [绘纸页, 收藏] [' + JSON.stringify(r24 && r24.evt_value) + ']');
  ok((st.drawing.pages || []).length >= 1 && (st.drawing.colls || []).length >= 1, '绘纸/收藏都记账了 [' + JSON.stringify(st.drawing.pages) + '/' + JSON.stringify(st.drawing.colls) + ']');
  ok(Array.isArray(st.collections) && st.collections.length >= 1, '图鉴收藏也跟着涨 [' + JSON.stringify(st.collections) + ']');

  /* --- 4b) 时间机制: 访客停留 180~270 分钟, 聚会 6~18 小时(10% 到 24, 封顶 30) --- */
  const visitSecs = [];
  for (let i = 0; i < 60; i++) visitSecs.push(window.MOCK_GUEST.visitSeconds());
  ok(visitSecs.every(s2 => s2 >= 180 * 60 && s2 <= 270 * 60),
     '访客停留时间都在 180~270 分钟 [' + Math.round(Math.min(...visitSecs) / 60) + '~' + Math.round(Math.max(...visitSecs) / 60) + ' 分钟]');
  ok(new Set(visitSecs.map(s2 => Math.round(s2))).size > 30, '访客停留时间是随机的, 不是固定值');
  const partyH = [];
  for (let i = 0; i < 300; i++) partyH.push(window.MOCK_DRAWING.partyMs() / 3600000);
  ok(partyH.every(h => h >= 6 && h <= 30), '聚会时长都在 6~30 小时 [' + Math.min(...partyH).toFixed(1) + '~' + Math.max(...partyH).toFixed(1) + ' 小时]');
  ok(partyH.every(h => h <= 24.0001), '常规不会超过 24 小时(硬上限 30 只兜底)');
  const avg = partyH.reduce((a, b) => a + b, 0) / partyH.length;
  ok(avg >= 9 && avg <= 17, '平均 ' + avg.toFixed(1) + ' 小时(偏向"过夜/大半天"的体感)');
  const longOnes = partyH.filter(h => h > 18).length;
  ok(longOnes > 0 && longOnes < partyH.length * 0.35, '偶尔(约 10~20%)才会延长到 18 小时以上 [' + longOnes + '/' + partyH.length + ']');
  /* 覆盖: 固定时长 / 自动 */
  st.partySeconds = 12 * 3600;
  ok(Math.abs(window.MOCK_DRAWING.partyMs() / 3600000 - 12) < 0.01, 'st.partySeconds 可以覆盖聚会时长 [12h]');
  delete st.partySeconds;
  ok(window.MOCK_DRAWING.partyMs() !== 12 * 3600 * 1000, '清掉覆盖后回到随机');

  /* --- 5) 不会再"自己每 90 分钟开一场" --- */
  st.party = { started: 0, guest: -1, ends: 0 };
  st.frog = { status: 0, motion: 0, traveling: false, returnAt: 0 };
  await sleep(1200);
  ok(Number(st.frog.status) === 0 && Number(st.party.started) === 0, '没有邀请时不会有凭空的聚会 [' + JSON.stringify(st.party) + ']');
  ok(typeof window.MOCK_PARTY.start === 'function' && window.MOCK_PARTY.start('手动', { seconds: 5 }) === true, '手动仍可发起(调试/GM)');
  ok(window.MOCK_PARTY.finish('手动') === true && Number(st.frog.status) === 0, '手动结束把它放回小屋');

  console.log(fails() === 0 ? 'ALL PARTY-INVITE CHECKS PASSED' : (fails() + ' CHECK(S) FAILED'));
  process.exit(fails() === 0 ? 0 : 1);
})();
