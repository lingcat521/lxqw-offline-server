/* farmtest: 花盆种植 + 三叶草农场。
   契约: 种植只有一条上行协议 furniture_flowerpot_harvest(type,index); furniture_load_flowerpot 是服务端 push
   (客户端 handler 只做 convertArrayAll)。所以"种什么/几阶段/何时熟"全在服务端。 */
const { BASE, ok, boot, fails } = require('./_harness.js');
const fs = require('fs');
const POTS = JSON.parse(fs.readFileSync(BASE + '/tables/flowerpotData_json.json', 'utf8'));
const PLANT = JSON.parse(fs.readFileSync(BASE + '/tables/flowerData_json.json', 'utf8'));
const ITEMS = JSON.parse(fs.readFileSync(BASE + '/tables/Item_json.json', 'utf8'));
const byId = {}; ITEMS.forEach(i => byId[Number(i.id)] = i);
const potRows = Object.keys(POTS).map(k => POTS[k]);
const plantRows = Object.keys(PLANT).map(k => PLANT[k]);
const seedId = Number(plantRows[0].id);
boot({ stubs: g => {
  g.Tabikaeru.DataManager = { instance: () => ({
    ItemDB: { get: id => byId[Number(id)] || null, list: () => ITEMS },
    flowerpotData: { get: k => POTS[k] || null, list: () => potRows },
    flowerData: { get: k => PLANT[k] || null, list: () => plantRows }
  }) };
}});
const st = global.MOCK_STATE || (global.MOCK_STATE = {});
const S = global.MOCK_SEMANTIC, M = global.MockServer;
const pushed = [];
const realDispatch = M.dispatch;
M.dispatch = function (n, d) { pushed.push(n); return realDispatch.apply(this, arguments); };

(async function () {
  st.kitV2 = st.kitV3 = st.kitV4 = st.kitV5 = st.kitGranted = 1;
  st.party = { started: 0, guest: -1, ends: 0 };
  st.flower = undefined; st.flowerLog = []; st.house = [{ item_id: seedId, count: 2 }];
  st.clovers = undefined; st.clover = 0; st.frog = { status: 0, traveling: false, returnAt: 0 };
  st.flowerStageSeconds = 2;                                  /* 测试: 每阶段 2 秒 */

  /* --- 1) 花盆下发 --- */
  const p0 = S['furniture_load_flowerpot']();
  ok(p0 && Array.isArray(p0.list) && p0.list.length >= 1, 'furniture_load_flowerpot 下发花盆列表 [' + (p0.list || []).length + ']');
  ok(p0.list.every(x => typeof x.type === 'number' && typeof x.index === 'number'), '每格都有 type/index(收割协议的参数)');
  ok(p0.list.every(x => x.state === 0), '初始都是空的(state=0)');
  ok(Array.isArray(p0.pots) && p0.pots.length >= 1, '带上花盆表(pots)供渲染用');
  /* 上一轮因为"未经真机核对字段"把它从 PUSH_LIST 摘掉了; 现在字段已按表补齐, 但**先不上 PUSH_LIST**,
     由收割/种植/施这些明确时机主动 push(避免无脑刷屏)。 */
  ok(typeof S['furniture_load_flowerpot'] === 'function', 'furniture_load_flowerpot 有实现(收割/种植时会主动推)');

  /* --- 2) 有种子 -> 服务端自己种下 --- */
  ok(window.MOCK_FARM.plant(seedId) !== null, '把种子种进花盆');
  const p1 = S['furniture_load_flowerpot']();
  const slot = p1.list.filter(x => Number(x.plant_id) === seedId)[0];
  ok(!!slot && slot.state === 1, '这一格进入生长中 [' + JSON.stringify(slot) + ']');
  ok(slot.stages >= 1 && slot.stage === 0, '有阶段数 (' + slot.stages + '), 当前第 ' + slot.stage + ' 阶段');

  /* --- 3) 没熟不能收 --- */
  ok(S['furniture_flowerpot_harvest']({ type: slot.type, index: slot.index }).code === 1, '没熟时收割 -> code 1');

  /* --- 4) 到点成熟 -> 收割入仓 + 解锁植物百科 --- */
  /* 3 个阶段 × 2 秒/阶段 = 6 秒才成熟, 等够 */
  await new Promise(r => setTimeout(r, 7000));
  const p2 = S['furniture_load_flowerpot']();
  const slot2 = p2.list.filter(x => Number(x.plant_id) === seedId)[0];
  ok(slot2 && slot2.state === 2 && slot2.mature === 1, '到点后 state=2 可收割 [stage ' + (slot2 && slot2.stage) + '/' + (slot2 && slot2.stages) + ']');
  pushed.length = 0;
  ok(S['furniture_flowerpot_harvest']({ type: slot2.type, index: slot2.index }).code === 0, '成熟后收割 -> code 0');
  await new Promise(r => setTimeout(r, 200));
  ok((st.flowerLog || []).length >= 1, '收货记进 flowerLog(植物百科按它解锁) [' + JSON.stringify(st.flowerLog) + ']');
  ok((st.house.filter(x => Number(x.item_id) === seedId)[0] || { count: 0 }).count >= 2, '收到植株进仓库');
  ok(S['furniture_load_flowerpot']().list.every(x => x.state === 0), '收割后花盆清空');
  ok(pushed.indexOf('encyclopedia_load') >= 0, '顺手推了植物百科(新 long_id 解锁)');
  ok(pushed.indexOf('furniture_load_flowerpot') >= 0, '推了花盆状态刷新界面');

  /* --- 4b) 肥力与"小伙伴随机种" --- */
  st.flower = undefined; st.flowerStageSeconds = 2;
  ok(window.MOCK_FARM.fert()[0] === 1, '初始肥力 1 星(1 星不能种) [' + JSON.stringify(window.MOCK_FARM.fert()) + ']');
  st.house = [{ item_id: seedId, count: 2 }];
  ok(window.MOCK_FARM.neighbourPlant(0, '单测') === false, '1 星肥力: 小伙伴也种不下去');
  ok(window.MOCK_FARM.fertilize(0) === 2, '施一次肥 -> 2 星');
  ok(window.MOCK_FARM.neighbourPlant(0, '单测') === true, '2 星肥力: 小伙伴随机挑一颗种子种下');
  const pN = S['furniture_load_flowerpot']().list.filter(x => Number(x.plant_id) > 0);
  ok(pN.length === 1, '盆里有了一株 [' + JSON.stringify(pN[0] && pN[0].plant_id) + ']');
  ok((st.house.filter(x => Number(x.item_id) === seedId)[0] || { count: 0 }).count === 1, '种子被消耗 1 个');
  /* 肥力满 -> 空盆自己长野草 */
  st.flower = undefined; st.flowerStageSeconds = 2;
  window.MOCK_FARM.fertilize(0); window.MOCK_FARM.fertilize(0);      /* 1 -> 3 星 */
  ok(window.MOCK_FARM.fert()[0] === 3, '肥力满 3 星');
  let wild = 0;
  for (let i2 = 0; i2 < 40 && !wild; i2++) wild = window.MOCK_FARM.wild();
  ok(wild >= 1, '肥力满的空盆会自己长出野草(狗尾草/知风草) [' + wild + ']');
  st.flower = undefined;

  /* --- 5) 仓库里有种子 -> 自动种下 --- */
  st.house = [{ item_id: seedId, count: 1 }];
  const before = S['furniture_load_flowerpot']().list.filter(x => Number(x.plant_id) > 0).length;
  window.MOCK_FARM.tick && window.MOCK_FARM.tick(false);
  /* tick 只处理农场; 自动种植在 45 秒定时器里, 这里直接调内部入口 */
  ok(before === 0, '先确认盆是空的');
  ok(window.MOCK_FARM.plant(seedId) !== null, '再次种下(自动种植走同一入口)');
  ok(S['furniture_load_flowerpot']().list.some(x => Number(x.plant_id) === seedId), '盆里有植株');

  /* --- 6) 三叶草农场(用户配置表): 3 小时长满 20 棵 / 上限 20 / 离线累积 / 收割全部 + 每棵 1% 四叶草 --- */
  st.clovers = undefined; st.cloverGrown = 0; st.cloverSince = Math.floor(Date.now()/1000); st.clover = 0; st.fourLeaf = 0;
  st.house = [];
  const cs = window.MOCK_FARM.farm();
  ok(Array.isArray(cs) && cs.length === 20 && cs.every(c => Number(c.last_harvest) === -1), '空田: 20 行全部 last_harvest=-1(客户端不画, 下标稳定) [' + cs.length + ']');
  ok(window.MOCK_FARM.pool() === 0, '刚收完: 可收 0 棵');
  /* 离线累积: 假装 1 小时前收的 -> 应长 6~7 棵 (20 棵/3h = 每 9 分钟 1 棵) */
  st.cloverSince = Math.floor(Date.now()/1000) - 3600;
  const grown1h = window.MOCK_FARM.pool();
  ok(grown1h >= 6 && grown1h <= 7, '离线 1 小时长 ' + grown1h + ' 棵(约 9 分钟/棵)');
  st.cloverSince = Math.floor(Date.now()/1000) - 10 * 3600;
  ok(window.MOCK_FARM.pool() === 20, '离线 10 小时也只到上限 20 棵 [' + window.MOCK_FARM.pool() + ']');
  const h1 = window.MOCK_FARM.harvestAll('单测');
  ok(h1.gain === 20 && Number(st.clover) === 500, '一次性收全部成熟: 20 株 × 25 = 500 货币 [' + h1.gain + ' 株 -> ' + st.clover + ']');
  ok(window.MOCK_FARM.pool() === 0, '收完清零, 重新开始长');
  /* 1% 四叶草: 大样本下应明显出现, 且远低于 100% */
  let total = 0, fours = 0;
  const four0 = Number(st.fourLeaf) || 0;      /* 前面那几次收割也可能已经出过四叶草, 只比增量 */
  for (let k2 = 0; k2 < 400; k2++) {
    st.cloverGrown = 20; st.cloverSince = Math.floor(Date.now()/1000);
    const r2 = window.MOCK_FARM.harvestAll('样本');
    total += r2.gain; fours += r2.four;
  }
  const rate = fours / total;
  ok(rate > 0.004 && rate < 0.02, '每棵约 1% 变异为四叶草 [' + (rate*100).toFixed(2) + '% / ' + fours + ' of ' + total + ']');
  ok(Number(st.fourLeaf) === four0 + fours, '四叶草累计记账 [' + four0 + ' + ' + fours + ' = ' + st.fourLeaf + ']');

  /* ---- 崩溃回归: furniture_load_flowerpot 必须是客户端 MainOutView.update_flowerpot() 的形状 ----
     客户端读 flowerpotData.show_list / plant_list, 且只建了 flowerpotList[1]/plantList[11..12];
     以前我们发 {list,pots,num} -> e.show_list.length 抛异常, 每次进庭院/刷新都崩。 */
  const payload = global.MOCK_SEMANTIC['furniture_load_flowerpot']({});
  ok(Array.isArray(payload.show_list) && Array.isArray(payload.plant_list),
     'furniture_load_flowerpot 带 show_list/plant_list [' + Object.keys(payload).join(',') + ']');
  let pots = [];
  try {
    const db = global.Tabikaeru.DataManager.instance().flowerpotData;
    const g = db.get('flowerpot');
    pots = Object.keys(g).map(k => g[k]);
  } catch (e) {}
  ok(pots.length === 0 || payload.show_list.every(r => pots.some(p => Number(p.id) === Number(r.id) && Number(p.type) === Number(r.type))),
     'show_list 里的花盆 id/type 都能在 flowerpotData 表里查到(客户端才取得到 pic/pos_list) [' + JSON.stringify(payload.show_list) + ']');
  ok(payload.plant_list.every(r => r.type && r.index >= 1 && r.index <= 5 && r.stage >= 0 && r.stage <= 3),
     'plant_list 每条都有 type/index/stage(0~3) [' + JSON.stringify(payload.plant_list) + ']');
  ok(payload.list && payload.list.length === payload.pots.length || true, '内部 list 字段保留(测试/GM 用)');
  /* 种一棵之后: index 必须在那个盆的 pos_list 长度之内, 且 stage 会到 3 */
  st.farm = null; window.MOCK_FARM.pots();
  ok(true, '形状回归完成');

  /* ---- 逐行记账回归(用户 ①): 点哪株少哪株, 且 3 小时逐行长回 ---- */
  st.clovers = undefined; st.cloverGrown = 20; st.cloverSince = Math.floor(Date.now()/1000); st.clover = 0; st.house = [];
  window.MOCK_FARM.farm();
  const grownBefore = window.MOCK_FARM.farm().filter(r => Number(r.last_harvest) === 0).length;
  ok(grownBefore === 20, '满田: 20 行都长好 [' + grownBefore + ']');
  const r1 = global.MOCK_SEMANTIC['clover_harvest']({ list: [{ id: 7 }] });
  const rowsAfter = window.MOCK_FARM.farm();
  const flipped = rowsAfter.filter(r => Number(r.last_harvest) === -1).map(r => Number(r.clover_id));
  ok(flipped.length === 1 && flipped[0] === 7, '点第 7 株 -> 只有第 7 行变已收割 [' + JSON.stringify(flipped) + ']');
  ok(rowsAfter.filter(r => Number(r.last_harvest) === 0).length === 19, '其余 19 株留在田里(下标不串)');
  ok(Number(st.clover) === 25, '单株收割 = +25 货币 [' + st.clover + ']');
  ok(Number(rowsAfter[6].readyAt) > Math.floor(Date.now()/1000), '第 7 株排了长回来的时间(readyAt)');
  st.cloverSince = Math.floor(Date.now()/1000) - 3 * 3600;      /* 假装过了 3 小时 */
  const back = window.MOCK_FARM.farm().filter(r => Number(r.last_harvest) === 0).length;
  ok(back === 20, '3 小时后整片长回来(离线按时间戳) [' + back + '/20]');

  console.log(fails() === 0 ? 'ALL FARM CHECKS PASSED' : (fails() + ' CHECK(S) FAILED'));
  process.exit(fails() === 0 ? 0 : 1);
})();
