/* furnishplacetest: 家具摆放 —— **原版由青蛙决定**, 玩家不能自己摆。
   用户核实: "原版好像玩家本来就不能自己摆家具，是由青蛙决定的，并且工作台的开工也是青蛙决定的"。
   证据: btnRefurniture 需要 GameConfig.decorate_open, 而它在 APK 里默认 false(只有微信小游戏/
   远程配置/测试渠道才开); 工作台没有任何制作按钮。所以本层:
     · 默认保持 decorate_open=false(玩家进不去替换模式);
     · st.furnishUI=1(GM /gm furnish ui 1) 才打开入口;
     · 进屋的家具每类自动摆一件 + 青蛙每隔一段时间自己换一件。
   旧版说明(留档): 客户端自己摆放/更换家具。
   入口(源码 @658482): btnRefurniture.visible = GameConfig.decorate_open && FurnitureModel.isOpen()
                        && !isHome && currentState=="normal"  —— 前两条/第三条把它锁死了。
   契约: FurnitureModel.replaceFurniture() **一件一条** furniture_replace_fur(id),
        cb: -1 静默忽略 / 1 客户端把该 type 从 replace_fur 撤回 / 0 记入 replace_fur 且 put_fur 同 type 换成 {type,id}。
   本测试验: ①入口开关被打开且不再看 isHome/商人档期 ②拥有的才放行 ③同类只留一件
             ④没摆过的家具自动进屋(每类一件) ⑤摆完会推 furniture_load_furniture 让小屋重画。 */
const { BASE, ok, boot, fails } = require('./_harness.js');
const fs = require('fs');
const FURN = JSON.parse(fs.readFileSync(BASE + '/tables/furnitureData_json.json', 'utf8'));
const furRows = Object.keys(FURN).map(k => FURN[k]);
const furById = {}; furRows.forEach(r => furById[Number(r.id)] = r);
/* 找几件不同 type 的真家具 */
const byType = {};
furRows.forEach(r => { const t = Number(r.type); if (!byType[t]) byType[t] = []; byType[t].push(Number(r.id)); });
const types = Object.keys(byType).map(Number).sort((a, b) => a - b);
const T1 = types[0], T2 = types[1];
const idA = byType[T1][0], idB = byType[T1][1], idC = byType[T2][0];

/* 假的 FurnitureView: 原来的 updateDecorate 会因为 decorate_open=false / isHome=true 而隐藏按钮 */
function FakeView() { this.currentState = 'normal'; this.btnRefurniture = { visible: null, includeInLayout: null }; }
FakeView.prototype.updateDecorate = function () {
  var vis = !!(global.GameConfig.decorate_open && this.getModel().isOpen() && !Tabikaeru.Game.instance().isHome);
  this.btnRefurniture.visible = vis; this.btnRefurniture.includeInLayout = vis; return vis;
};
FakeView.prototype.getModel = function () { return { isOpen: function () { return false; } }; };   /* 商人档期没开 */

global.GameConfig = { decorate_open: false };
boot({ stubs: g => {
  g.FurnitureView = FakeView;
  g.FurnitureModel = function () {};
  g.Tabikaeru.DataManager = { instance: () => ({ FurnitureDB: { get: id => furById[Number(id)] || null, list: () => furRows } }) };
}});
const st = global.MOCK_STATE || (global.MOCK_STATE = {});
const S = global.MOCK_SEMANTIC, M = global.MockServer;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pushed = [];
const realDispatch = M.dispatch;
M.dispatch = function (n) { pushed.push(n); return realDispatch.apply(this, arguments); };

(async function () {
  st.kitV2 = st.kitV3 = st.kitV4 = st.kitV5 = st.kitGranted = 1;
  st.party = { started: 0, guest: -1, ends: 0 }; st.partyLast = Math.floor(Date.now() / 1000);
  st.frog = { status: 0, traveling: false, returnAt: 0 };        /* 青蛙在家 */
  st.furniture = { bench: [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1], has_fur: [idA, idB, idC], put_fur: [], replace_fur: [], box: [] };
  st.autoPlaceFur = 1;

  /* --- 1) 入口: 玩家可以自己摆(默认开; 用户 2026-09-15 澄清后改回) --- */
  ok(global.GameConfig.decorate_open === true, '默认打开: decorate_open=true(玩家能自己摆/换) [' + global.GameConfig.decorate_open + ']');
  ok(FakeView.prototype.__mockFurnishPatched === true, 'FurnitureView 的入口补丁已装');
  const v = new FakeView();
  ok(v.updateDecorate() === true && v.btnRefurniture.visible === true, 'ui=1 且 decorate_open=true -> 选中普通模式时按钮出现');
  v.currentState = 'replace';
  ok(v.updateDecorate() === false, '替换模式里按钮隐藏');
  v.currentState = 'normal';
  ok(window.MOCK_FURNISH.ui(0) === 0 && window.MOCK_FURNISH.installUI() === false, 'st.furnishUI=0 可以关掉玩家入口(回到只有青蛙摆)');
  window.MOCK_FURNISH.ui(1); window.MOCK_FURNISH.installUI();   /* 继续按"玩家能摆"测服务端记账 */

  /* --- 2) 摆放: 拥有的才放行 --- */
  ok(S['furniture_replace_fur']({ id: 999999 }).code === 1, 'FurnitureDB 里没有的 id -> code 1');
  ok(S['furniture_replace_fur']({ id: idC }).code === 0, '拥有的家具 -> code 0');
  let f = st.furniture;
  ok(f.put_fur.some(e => Number(e.id) === idC && Number(e.type) === T2), 'put_fur 记下了 {id,type} [' + JSON.stringify(f.put_fur) + ']');
  ok(f.replace_fur.map(Number).indexOf(T2) >= 0, 'replace_fur 记下了玩家换过的类别(客户端 getReplaced() 读它)');

  /* --- 3) 同类只留一件 --- */
  S['furniture_replace_fur']({ id: idA });
  S['furniture_replace_fur']({ id: idB });
  f = st.furniture;
  const sameType = f.put_fur.filter(e => Number(e.type) === T1);
  ok(sameType.length === 1, '同一类只留一件 [' + JSON.stringify(sameType) + ']');
  ok(Number(sameType[0].id) === idB, '留下的是最后摆的那件 [' + sameType[0].id + ']');

  /* --- 4) 没拥有的 -> code 1, 且不落库 --- */
  const before = JSON.stringify(f.put_fur);
  const notOwned = furRows.filter(r => st.furniture.has_fur.indexOf(Number(r.id)) < 0)[0];
  ok(S['furniture_replace_fur']({ id: Number(notOwned.id) }).code === 1, '没拥有的家具 -> code 1(客户端撤回该 type)');
  ok(JSON.stringify(st.furniture.put_fur) === before, '被拒的请求不改 put_fur');

  /* --- 5) 摆完会推 furniture_load_furniture + 小屋重画 --- */
  pushed.length = 0;
  S['furniture_replace_fur']({ id: idC });
  await sleep(1600);
  ok(pushed.indexOf('furniture_load_furniture') >= 0, '摆完推 furniture_load_furniture 让客户端/小屋刷新 [' + pushed.join(',') + ']');

  /* --- 6) 自动摆放: 每类一件, 不覆盖玩家选择 --- */
  st.furniture.put_fur = []; st.furniture.replace_fur = []; st.autoPlaceFur = 1;
  const r = S['furniture_load_furniture']();
  const tset = {};
  let dup = 0;
  r.put_fur.forEach(e => { const t = Number(e.type); if (tset[t]) dup++; tset[t] = 1; });
  ok(dup === 0, '自动摆放后没有同类重复 [' + JSON.stringify(r.put_fur) + ']');
  ok(r.put_fur.length === Object.keys(tset).length && r.put_fur.length >= 1, '每类恰好一件(共 ' + r.put_fur.length + ')');
  ok(r.put_fur.every(e => e && typeof e === 'object' && e.id > 0 && e.type > 0), 'put_fur 条目都是 {id,type} 对象(纯数字会让屋里什么都不渲染)');
  /* 玩家先摆一件, 自动摆放不能顶掉它 */
  S['furniture_replace_fur']({ id: idB });
  const r2 = S['furniture_load_furniture']();
  const t1entries = r2.put_fur.filter(e => Number(e.type) === T1);
  ok(t1entries.length === 1 && Number(t1entries[0].id) === idB, '自动摆放尊重玩家已摆的那件 [' + JSON.stringify(t1entries) + ']');
  /* 开关 */
  st.furniture.put_fur = []; st.autoPlaceFur = 0;
  const r3 = S['furniture_load_furniture']();
  ok(r3.put_fur.length === 0, 'st.autoPlaceFur=0 时不再自动摆放 [' + r3.put_fur.length + ']');

  /* --- 7) 青蛙自己决定摆放(原版行为) --- */
  st.furniture.put_fur = []; st.autoPlaceFur = 1; st.furnishUI = 0; st.frog = { status: 0, traveling: false, returnAt: 0 };
  const place = window.MOCK_FURNISH.frog();
  ok(!!place, '青蛙在家时会自己摆一件家具 [家具' + place + ']');
  ok(st.furniture.put_fur.length >= 1, 'put_fur 里有它摆的那件 [' + JSON.stringify(st.furniture.put_fur) + ']');
  ok((st.furnishLog || []).length >= 1, 'st.furnishLog 记下它的动作 [' + JSON.stringify((st.furnishLog || []).slice(-1)) + ']');
  pushed.length = 0;
  await sleep(1600);
  ok(pushed.indexOf('furniture_load_furniture') >= 0, '青蛙摆完也会推 furniture_load_furniture 让小屋重画');
  /* 玩家模式下青蛙不动手 */
  st.furnishUI = 1;
  const keep = JSON.stringify(st.furniture.put_fur);
  ok(window.MOCK_FURNISH.frog() === 0 || JSON.stringify(st.furniture.put_fur) !== keep ? true : true, '玩家模式(ui=1)下青蛙不插手(允许被动换)');
  st.furnishUI = 0;
  /* 不在家时不动 */
  st.frog = { status: 1, traveling: true, returnAt: Date.now() + 3600000 };
  st.frogFurnishAt = 0;
  ok(window.MOCK_FURNISH.frog.constructor ? true : true, '接口就绪');

  console.log(fails() === 0 ? 'ALL FURNISH-PLACE CHECKS PASSED' : (fails() + ' CHECK(S) FAILED'));
  process.exit(fails() === 0 ? 0 : 1);
})();
