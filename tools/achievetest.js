/* achievetest: 称号(成就)。用户报「称号…没有做」。
   契约: client_load_role.frog = {achieves:[id], achieves_time:[{id,time}], cur_achieve};
   client_set_achieve{id} 必须落库(否则称号存不住); 新达成要 push client_load_role 才会弹"首次获得称号"。 */
const { BASE, ok, boot, fails } = require('./_harness.js');
const fs = require('fs');
const ACH = JSON.parse(fs.readFileSync(BASE + '/tables/Achieve_json.json', 'utf8'));
const ITEMS = JSON.parse(fs.readFileSync(BASE + '/tables/Item_json.json', 'utf8'));
const achRows = Array.isArray(ACH) ? ACH : Object.keys(ACH).map(k => ACH[k]);
const byId = {}; ITEMS.forEach(i => byId[Number(i.id)] = i);
let pushedRole = 0;
boot({ stubs: g => {
  g.Tabikaeru.DataManager = { instance: () => ({
    ItemDB: { get: id => byId[Number(id)] || null, list: () => ITEMS },
    AchieveDB: { get: id => achRows.filter(r => Number(r.id) === Number(id))[0] || null, list: () => achRows }
  }) };
}});
const st = global.MOCK_STATE || (global.MOCK_STATE = {});
const S = global.MOCK_SEMANTIC, M = global.MockServer;
const realDispatch = M.dispatch;
M.dispatch = function (n) { if (n === 'client_load_role') pushedRole++; return realDispatch.apply(this, arguments); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async function () {
  st.kitV2 = st.kitV3 = st.kitV4 = st.kitV5 = st.kitGranted = 1;
  st.party = { started: 0, guest: -1, ends: 0 }; st.partyLast = Math.floor(Date.now() / 1000);
  st.achieves = []; st.achieveId = 0; st.clover = 0; st.travelCount = 0; st.collections = [];
  st.gacha = []; st.house = []; st.frog = { status: 0, traveling: false, returnAt: 0 };
  st.tripLog = [];

  const role = S['client_load_role']();
  ok(Array.isArray(role.frog.achieves), 'client_load_role.frog.achieves 是数组 [' + JSON.stringify(role.frog.achieves) + ']');
  ok(Array.isArray(role.frog.achieves_time), 'achieves_time 是数组(空 = 全部永久)');
  ok(typeof role.frog.cur_achieve === 'number', 'cur_achieve 是数字');

  /* --- 老存档首次追认: 静默(不弹窗), 但照样入账 --- */
  st.travelCount = 10;
  const got = window.MOCK_ACHIEVE.evaluate('单测');
  ok(got >= 1, '旅行达到 10 次 -> 达成至少 1 个称号 [' + got + ']');
  const id10 = achRows.filter(r => r.info === '旅行达到10次')[0].id;
  ok(window.MOCK_ACHIEVE.state().owns.indexOf(id10) >= 0, '拿到 id=' + id10 + '「' + achRows.filter(r => r.id === id10)[0].name + '」');
  await sleep(250);
  ok(pushedRole === 0, '首次追认是静默的: 不 push client_load_role(否则客户端一次弹 N 个、要连点) [' + pushedRole + ']');
  ok((st.clientSettings.achieveList || []).indexOf(id10) >= 0, '静默的称号被写进 clientSettings.achieveList(客户端据此判定"已提示")');
  ok(S['client_load_role']().frog.achieves.indexOf(id10) >= 0, 'roleData 里带上了新称号(界面里看得到)');

  /* --- 之后玩出来的新称号: 进队列, 受间隔节流 --- */
  st.clover = 120000;
  window.MOCK_ACHIEVE.evaluate('单测');
  const rich0 = achRows.filter(r => r.info === '拥有超过10万棵三叶草')[0].id;
  ok(window.MOCK_ACHIEVE.pending().indexOf(rich0) >= 0, '新称号先进"待播报"队列 [' + window.MOCK_ACHIEVE.pending().length + ']');
  ok(pushedRole === 0, '还没到间隔就不推 [' + pushedRole + ']');
  ok(window.MOCK_ACHIEVE.publish(true) === 1, 'publish(force) 放行一个');
  await sleep(250);
  ok(pushedRole === 1, '放行后才 push client_load_role(客户端弹"恭喜获得称号") [' + pushedRole + ']');

  const rich = rich0;
  ok(window.MOCK_ACHIEVE.state().owns.indexOf(rich) >= 0, '三叶草 12 万 -> 拿到财富称号');

  /* 物品数量类: 「双皮奶超过10个」 */
  const milk = ITEMS.filter(i => String(i.name) === '双皮奶')[0];
  ok(!!milk, 'Item 表里有双皮奶 (id=' + (milk && milk.id) + ')');
  st.house = [{ item_id: Number(milk.id), count: 12 }];
  window.MOCK_ACHIEVE.evaluate('单测');
  const milkAch = achRows.filter(r => r.info === '双皮奶超过10个')[0].id;
  ok(window.MOCK_ACHIEVE.state().owns.indexOf(milkAch) >= 0, '仓库 12 个双皮奶 -> 拿到对应称号');

  /* 道具解锁那 3 条不自动发 */
  const spec = achRows.filter(r => r.is_special);
  ok(spec.length >= 1 && spec.every(r => window.MOCK_ACHIEVE.state().owns.indexOf(Number(r.id)) < 0), 'is_special(道具解锁)不会被自动发出 [' + spec.length + ' 条]');

  /* 选称号 */
  ok(S['client_set_achieve']({ id: id10 }).code === 0, '已拥有的称号可以佩戴');
  ok(Number(st.achieveId) === Number(id10), '佩戴落库 st.achieveId [' + st.achieveId + ']');
  ok(S['client_set_achieve']({ id: 7777 }).code === 1, '没拥有的称号不能佩戴');
  ok(Number(S['client_load_role']().frog.cur_achieve) === Number(id10), '下次 client_load_role 回同一个 cur_achieve(存得住)');

  /* ---- 称号完整效果表(目标②): 每类称号都要真的改点东西 ---- */
  const T = window.MOCK_TITLE;
  const cases = [
    { info: '旅行达到10次',           why: '旅行家 -> 照片偏风景/少动物',      chk: e => e.photo === 'scenery' },
    { info: '出发不到30分钟就回家',   why: '散步好天气 -> 短途 + 照片偏风景',  chk: e => e.trip === 0.6 && e.photo === 'scenery' && e.jitter },
    { info: '出发超过24小时还没回家', why: '一只不回家的蛙 -> 时长 ×1.35',     chk: e => e.trip === 1.35 },
    { info: '拥有超过10万棵三叶草',   why: '蛙与三叶草 -> 三叶草 ×1.5',        chk: e => e.clover === 1.5 },
    { info: '双皮奶超过10个',         why: '美食收集类 -> 照片偏道具(超过10个)', chk: e => e.photo === 'props' },
    { info: '获得20种特产',           why: '特产类 -> 多带一份特产',           chk: e => e.gift === 2 },
    { info: '获得15种纪念品',         why: '纪念品类 -> 更容易多带一件',       chk: e => e.gift === 1.6 },
    { info: '获得所有特产食材',       why: '鉴赏名家 -> 稀有度 ×1.5',          chk: e => e.rare === 1.5 },
    { info: '旅行地图中全国所有城市都有照片', why: '走遍全国 -> 稀有度 ×1.35',  chk: e => e.rare === 1.35 },
    { info: '（默认）',               why: '默认称号 -> 什么都不改',           chk: e => e.trip === 1 && e.clover === 1 && e.gift === 1 && e.rare === 1 && !e.photo }
  ];
  let rows = null;
  try { rows = global.Tabikaeru.DataManager.instance().AchieveDB.list(); } catch (e) {}
  ok(Array.isArray(rows) && rows.length > 0, '称号表可用 [' + (rows ? rows.length : 0) + ' 条]');
  let effBad = [];
  cases.forEach(c => {
    const row = (rows || []).filter(r => String(r.info) === c.info)[0];
    if (!row) { effBad.push(c.info + '(表里没有这条)'); return; }
    st.achieveId = Number(row.id);
    const e = T.effects();
    if (!c.chk(e)) effBad.push(c.info + ' -> ' + JSON.stringify(e));
  });
  ok(effBad.length === 0, '称号效果表逐条生效: ' + cases.map(c => c.why).join(' / ') + (effBad.length ? (' | 不符: ' + effBad.join(' ; ')) : ''));
  st.achieveId = 0;

  console.log(fails() === 0 ? 'ALL ACHIEVE CHECKS PASSED' : (fails() + ' CHECK(S) FAILED'));
  process.exit(fails() === 0 ? 0 : 1);
})();
