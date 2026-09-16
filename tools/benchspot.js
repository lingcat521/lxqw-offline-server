/* benchspot: "小屋的桌子点不动" 的回归测试。
   客户端 MainOutView.updateFurniture() 把 btn_enterFurnitureBench.visible 设成 FurnitureModel.isOpen(),
   而它只在 childrenCreated 和 FurnitureEventType.UPDATE 时跑; UPDATE 又只在"嘟嘟收摊"时由模型自己派发
   -> 开机时序不对(场景先建、shop 数据后到)热区就永远 hidden。
   这里用假的 MainOut 视图 + 假模型复现: 补派 UPDATE 后热区必须按 isOpen() 变可见。 */
const { BASE, ok, boot, fails } = require('./_harness.js');

const logs = [];
const realLog = console.log;
console.log = function () {                       /* 既收集又照常打印(否则 ok() 的 PASS/FAIL 会被吞掉) */
  const s = Array.prototype.slice.call(arguments).join(' ');
  logs.push(s); realLog(s);
};

let dispatched = 0;
const view = {
  btn_enterFurnitureBench: { visible: false, touchEnabled: true },
  updateFurniture: function () { view.btn_enterFurnitureBench.visible = model.isOpen(); }
};
const model = {
  shop: { start_time: 0, leave_time: 0 },
  isOpen: function () { return model.shop.start_time > 0; },
  dispatchEvent: function (ev) { dispatched++; if (ev && ev.type === 'FURNITUREEVENTTYPE_UPDATE') view.updateFurniture(); }
};

function MainOutController() {}
boot({ stubs: function (g) {
  g.FurnitureEventType = { UPDATE: 'FURNITUREEVENTTYPE_UPDATE', UPDATE_BENCH: 'FURNITUREEVENTTYPE_UPDATE_BENCH' };
  g.FurnitureModel = function FurnitureModel() {};      /* 客户端真实的模型类名, 层里用它取 model */
  g.MainOutController = MainOutController;
  g.core.ViewLayerType = { SceneLayer: 'scene', WindowLayer: 'window' };
  g.core.ModelManage = { getInstance: function () { return { getModel: function () { return model; } }; } };
  g.core.PageManage = { getInstance: function () { return { getControl: function (C) { return C === MainOutController ? { getView: function () { return view; } } : null; } }; } };
  g.Tabikaeru.DataType = { ItemType: { FURNITURE_RESOURCE: 10, FURNITURE_ITEM: 11, FURNITURE_TOOL: 12, FURNITURE_PAPER: 13 } };
  const ITEMS = JSON.parse(require('fs').readFileSync(BASE + '/tables/Item_json.json', 'utf8'));
  const FURN = JSON.parse(require('fs').readFileSync(BASE + '/tables/furnitureData_json.json', 'utf8'));
  const byId = {}; ITEMS.forEach(i => byId[Number(i.id)] = i);
  const rows = Object.keys(FURN).map(k => FURN[k]);
  g.Tabikaeru.DataManager = { instance: function () { return {
    ItemDB: { get: id => byId[Number(id)] || null, list: () => ITEMS },
    FurnitureDB: { get: id => FURN[String(id)] || null, list: () => rows },
    FurnitureShopDB: { get: () => null, list: () => [] }
  }; } };
}});
const S = global.MOCK_SEMANTIC, st = global.MOCK_STATE || (global.MOCK_STATE = {});
st.kitV2 = st.kitV3 = st.kitV4 = st.kitV5 = st.kitGranted = 1;

/* 场景先建、数据后到: 建场景时 start_time 还是 0 -> 热区隐藏 */
view.updateFurniture();
ok(view.btn_enterFurnitureBench.visible === false, '场景先建时热区是隐藏的(复现 bug 现场)');

(async function () {
  /* 数据到达: 我们的家具层会补派 FurnitureEventType.UPDATE */
  /* 嘟嘟新作息(用户表): 每天 14~19 点到访一次 —— 测试里把"本次到访"设成已开始, 否则 start_time=0(不在城) */
  st.merchantVisit = { day: (function(){var d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();})(), start: Math.floor(Date.now()/1000) - 60 };
  st.shopDay = undefined;

  const payload = S['furniture_load_furniture']();
  ok(payload.shop && payload.shop.start_time > 0, '商人块把 shop.start_time 写成 >0 [' + (payload.shop && payload.shop.start_time) + ']');
  model.shop = payload.shop;                            /* 模拟客户端模型收到这份数据 */
  view.updateFurniture();
  await new Promise(r => setTimeout(r, 1200));
  ok(dispatched > 0, '数据下发后补派了 FurnitureEventType.UPDATE (共 ' + dispatched + ' 次)');
  ok(view.btn_enterFurnitureBench.visible === true, '热区变成可见 -> 桌子可以点了');

  /* 反向: 商人不在时应该是隐藏的(isOpen()=false) */
  model.shop.start_time = 0;
  window.MOCK_BENCH_SPOT('test');
  await new Promise(r => setTimeout(r, 1200));
  ok(view.btn_enterFurnitureBench.visible === false, '商人不在(start_time=0)时热区隐藏, 状态自洽');

  const line = logs.filter(l => /工作台热区/.test(l)).pop();
  ok(!!line, '日志里有热区诊断行: ' + (line || '').replace('[MOCK] ', ''));
  console.log(fails() === 0 ? 'ALL BENCH-SPOT CHECKS PASSED' : (fails() + ' CHECK(S) FAILED'));
  process.exit(fails() === 0 ? 0 : 1);
})();
