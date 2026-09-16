/* composeloop: 合成(开工) 的死循环回归测试。
 *
 * 背景(2026-09-14 真机事故): 客户端 BoxCraftView.updateView() 在"三组材料都 >0"时会自动
 * req_compose(5502), 而 req_compose 的回包回调里又跑一次 updateView —— 自我重触发。
 * 只要服务端不真的扣材料, 客户端就会一直发: 那次连发了 2997 次, 界面卡死 -> 崩溃,
 * save 里还堆了 2997 个待确认盒子。
 *
 * 本测试用一个假客户端把这个循环复现出来(它只看自己缓存的 house, 缓存来自 item_load_items 推送):
 *   1) 正常情况: 5 套材料 -> 合成 5 次就停, 每样扣到 0, 奖励入 house;
 *   2) 缓存滞后(推送慢): 循环仍要有界, 不能失控;
 *   3) 没材料时: 只回空表, 不扣不发;
 *   4) 硬闸: 材料很多时也不超过 COMPOSE_MAX_OK(30) 次。
 */
const { BASE, ok, boot, fails } = require('./_harness.js');
const fs = require('fs');

const ITEMS = JSON.parse(fs.readFileSync(BASE + '/tables/Item_json.json', 'utf8'));
const byId = {};
ITEMS.forEach(function (it) { byId[Number(it.id)] = it; });

function mkBoot(setHouse) {
  boot({ stubs: function (g) {
    g.Tabikaeru.DataType = { ItemType: { COMPOSE: 16 } };
    g.Tabikaeru.Define = { ComposeId: 5502 };
    g.Tabikaeru.DataManager = { instance: function () { return { ItemDB: { get: function (id) { return byId[Number(id)] || null; }, list: function () { return ITEMS; } } }; } };
  } });
  const st = global.MOCK_STATE || (global.MOCK_STATE = {});
  /* 关掉开机补发(kit/新手礼包)的定时器, 否则它们会在测试中途往 house 里塞材料 */
  st.kitV2 = 1; st.kitV3 = 1; st.kitV4 = 1; st.kitV5 = 1; st.kitGranted = 1;
  st.house = setHouse.map(function (x) { return { item_id: x[0], count: x[1] }; });
  return { st: st, S: global.MOCK_SEMANTIC, M: global.MockServer };
}
function groups(h) {
  const t = [0, 0, 0];
  h.forEach(function (it) {
    const d = byId[Number(it.item_id)];
    if (!d || Number(d.type) !== 16) return;
    const s = Number(d.sub_type);
    if (s >= 1 && s <= 3) t[s - 1] += Number(it.count) || 0;
  });
  return t;
}
function countOf(h, id) {
  let n = 0;
  h.forEach(function (it) { if (Number(it.item_id) === id) n += Number(it.count) || 0; });
  return n;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async function () {
  /* --- 1) 正常: 5 套材料 --- */
  let e = mkBoot([[8501, 5], [8502, 5], [8503, 5]]);
  let cache = e.st.house.map(x => ({ item_id: x.item_id, count: x.count }));
  let pushes = 0;
  const real = e.M.dispatch;
  e.M.dispatch = function (name, data) {
    if (name === 'item_load_items' && data && Array.isArray(data.house)) { cache = data.house.map(x => ({ item_id: x.item_id, count: x.count })); pushes++; }
    return real.apply(this, arguments);
  };
  const open = () => { const t = groups(cache); return t[0] > 0 && t[1] > 0 && t[2] > 0; };
  let calls = 0, popups = 0;
  while (open() && calls < 300) { const r = e.S['pray_compose']({ id: 5502 }); calls++; popups += (r && r.item_list ? r.item_list.length : 0); await sleep(45); }
  const t = groups(e.st.house);
  ok(calls === 5, '5 套材料 = 正好合成 5 次 (实际 ' + calls + ')');
  ok(!open(), '合成后客户端的 s 变 false (循环终止)');
  ok(t[0] === 0 && t[1] === 0 && t[2] === 0, '三组材料各扣到 0 (实际 ' + t.join('/') + ')');
  ok(countOf(e.st.house, 8000) === 5, '奖励 8000 x5 落进 house (实际 ' + countOf(e.st.house, 8000) + ')');
  ok(pushes >= 5, '每次都推了 item_load_items (实际 ' + pushes + ')');
  ok(popups === 5, '回包里的 item_list 只发 5 次 (实际 ' + popups + ')');

  /* --- 2) 刷新延迟(推送晚到 150ms): 循环仍必须有界并最终停下 --- */
  e = mkBoot([[8501, 5], [8502, 5], [8503, 5]]);
  let pendingHouse = null;
  e.M.dispatch = function (name, data) {
    if (name === 'item_load_items' && data && Array.isArray(data.house)) {
      const snap = data.house.map(x => ({ item_id: x.item_id, count: x.count }));
      setTimeout(function () { cache = snap; }, 150);       /* 推送晚到 */
    }
    return undefined;
  };
  cache = e.st.house.map(x => ({ item_id: x.item_id, count: x.count }));
  calls = 0;
  const open2 = () => { const t = groups(cache); return t[0] > 0 && t[1] > 0 && t[2] > 0; };
  const t1 = Date.now();
  while (open2() && calls < 300 && Date.now() - t1 < 5000) { e.S['pray_compose']({ id: 5502 }); calls++; await sleep(45); }
  const t2 = groups(e.st.house);
  ok(!open2(), '推送晚到时循环最终停下 (调用 ' + calls + ' 次)');
  ok(calls <= 20, '调用次数有界 (实际 ' + calls + ')');
  ok(t2[0] === 0 && t2[1] === 0 && t2[2] === 0, '材料扣得刚刚好 (' + t2.join('/') + ')');
  ok(countOf(e.st.house, 8000) === 5, '只成功 5 次, 之后是空回包 (8000 = ' + countOf(e.st.house, 8000) + ')');

  /* --- 3) 没材料: 只回空表 --- */
  e = mkBoot([]);
  let r = e.S['pray_compose']({ id: 5502 });
  ok(Array.isArray(r.item_list) && r.item_list.length === 0, '没材料时回 {item_list: []}');
  ok(countOf(e.st.house, 8000) === 0, '没材料时不发奖');

  /* --- 4) 硬闸: 100 套材料最多合成 30 次 --- */
  e = mkBoot([[8501, 100], [8502, 100], [8503, 100]]);
  e.M.dispatch = function () { return undefined; };
  calls = 0;
  for (let i = 0; i < 120; i++) { e.S['pray_compose']({ id: 5502 }); calls++; }
  const t4 = groups(e.st.house);
  ok(countOf(e.st.house, 8000) === 30, '硬闸生效: 最多 30 次 (实际 ' + countOf(e.st.house, 8000) + ')');
  ok(t4[0] === 70 && t4[1] === 70 && t4[2] === 70, '只扣了 30 套 (剩余 ' + t4.join('/') + ')');

  /* --- 5) 熔断: 就算客户端真的疯了一样重发, 回包也会被切断 --- */
  e = mkBoot([[8501, 50], [8502, 50], [8503, 50]]);
  global.ProtocolList.protocolList['pray_compose'] = [['id'], true];
  await sleep(120);                                  /* 等 install() 挂上 send 覆盖 */
  let cbs = 0;
  const SM = global.core.SocketManage.prototype;
  for (let i = 0; i < 120; i++) { try { SM.send('pray_compose', function () { cbs++; }, 5502); } catch (err) { ok(false, 'send 抛异常: ' + err.message); break; } }
  await sleep(200);
  ok(SM.send && SM.send.__x !== 1, 'SocketManage.send 已被 mock 覆盖');
  ok(cbs > 0 && cbs <= 41, '熔断生效: 120 次发送只回了 ' + cbs + ' 次(阈值 40)');
  ok(countOf(e.st.house, 8000) <= 41, '熔断后服务端不再被扣料 (8000 = ' + countOf(e.st.house, 8000) + ')');

  console.log(fails() === 0 ? 'ALL COMPOSE-LOOP CHECKS PASSED' : (fails() + ' CHECK(S) FAILED'));
  process.exit(fails() === 0 ? 0 : 1);
})();
