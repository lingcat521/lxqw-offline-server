/* materialtest: 普通材料的两个来源(new/materials.js) —— 嘟嘟 20 草/件 + 旅行带回自动放工作台 */
const { BASE, ok, boot, fails } = require('./_harness.js');
boot({});
const st = global.MOCK_STATE || (global.MOCK_STATE = {});
const S = global.MOCK_SEMANTIC, M2 = window.MOCK_MATERIALS;

(async function () {
  ok(!!M2, '材料层装上了 MOCK_MATERIALS');
  ok(M2.list().length === 7 && M2.price === 20, '7 种普通材料, 单价 20 草 [' + M2.list().join(',') + ']');

  /* ① 商店: 每次到访上架 4 种, 价格 20, 可买 5 个 */
  st.furniture = st.furniture || {}; st.matVisit = null; st.matPick = [];
  const pay1 = S['furniture_load_furniture']({});
  const rows = (pay1.shop.shop_list || []).filter(x => M2.list().indexOf(Number(x.item_id)) >= 0);
  ok(rows.length === 4, '嘟嘟到访时上架 4 种普通材料 [' + rows.map(r => r.item_id).join(',') + ']');
  ok(rows.every(r => Number(r.price) === 20 && Number(r.limit) === 5), '单价 20 草 / 每次可买 5 个 [' + JSON.stringify(rows[0]) + ']');
  const pick1 = M2.current().pick.slice().join(',');
  st.furniture.bought = []; st.matVisit = null;                 /* 下一次到访 */
  const pay2 = S['furniture_load_furniture']({});
  ok(M2.current().pick.length === 4, '下一次到访重新掷一批 [' + pick1 + ' -> ' + M2.current().pick.join(',') + ']');

  /* ② 旅行带回: 1~3 件进仓库 + 自动放到工作台材料行 */
  st.house = []; st.furniture.bench = [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1];
  window.MOCK_STORY_ROLL();
  const bench = M2.benchMaterials().filter(x => x >= 0);
  ok(bench.length >= 1, '旅行归来把材料自动放上台面材料行 [' + JSON.stringify(bench) + ']');
  ok(bench.every(id => M2.list().indexOf(Number(id)) >= 0), '台面材料行里都是普通材料(type 10)');
  const houseMat = (st.house || []).filter(h => M2.list().indexOf(Number(h.item_id)) >= 0);
  ok(houseMat.length >= 1, '同时也进了仓库(台面满了也不会丢) [' + JSON.stringify(houseMat) + ']');
  /* 材料行只有 5 格: 塞满后再带回就只进仓库 */
  st.furniture.bench = [-1, -1, -1, -1, -1, 10001, 10002, 10003, 10004, 10005];
  const placed2 = M2.placeOnBench([10006, 10007]);
  ok(placed2.length === 0 && M2.benchMaterials().filter(x => x >= 0).length === 5, '材料行满了就不再往上放(留在仓库)');

  /* ③ 制作会消耗 1 普通 + 1 特殊 */
  st.house = []; st.furniture.bench = [-1, -1, -1, -1, -1, 10001, -1, -1, -1, -1];
  M2.fill(1);                                                    /* 保证有料 */
  ok(M2.benchMaterials().filter(x => x >= 0).length >= 1, '补料后材料行有货 [' + JSON.stringify(M2.benchMaterials()) + ']');

  console.log(fails() === 0 ? 'ALL MATERIAL CHECKS PASSED' : ('MATERIAL FAILED: ' + fails()));
  process.exit(fails() === 0 ? 0 : 1);
})();
