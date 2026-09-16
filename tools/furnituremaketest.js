/* furnituremaketest: 工作台"开工"(青蛙在家做家具) + 商人库存持久化 的回归测试。
   背景见 new/furnituremake.js 顶部：客户端工作台没有制作按钮，制作是服务端的事
   (官方引导图: "要有足够的材料和工具，蛙蛙才会做家具哦")，我们以前完全没做。 */
const { BASE, ok, boot, fails } = require('./_harness.js');
const fs = require('fs');

const ITEMS = JSON.parse(fs.readFileSync(BASE + '/tables/Item_json.json', 'utf8'));
const FURN = JSON.parse(fs.readFileSync(BASE + '/tables/furnitureData_json.json', 'utf8'));
const SHOP = JSON.parse(fs.readFileSync(BASE + '/tables/furnitureShopData_json.json', 'utf8'));
const byId = {}; ITEMS.forEach(i => byId[Number(i.id)] = i);
const furRows = Object.keys(FURN).map(k => FURN[k]);
const furById = {}; furRows.forEach(r => furById[Number(r.id)] = r);
const shopRows = Object.keys(SHOP).map(k => SHOP[k]);

boot({ stubs: g => {
  g.Tabikaeru.DataType = { ItemType: { FURNITURE_RESOURCE: 10, FURNITURE_ITEM: 11, FURNITURE_TOOL: 12, FURNITURE_PAPER: 13, COMPOSE: 16 } };
  g.Tabikaeru.Define = { ComposeId: 5502 };
  g.Tabikaeru.DataManager = { instance: () => ({
    ItemDB: { get: id => byId[Number(id)] || null, list: () => ITEMS },
    FurnitureDB: { get: id => furById[Number(id)] || null, list: () => furRows },
    FurnitureShopDB: { get: id => SHOP[String(id)] || null, list: () => shopRows }
  }) };
}});
const st = global.MOCK_STATE || (global.MOCK_STATE = {});
const S = global.MOCK_SEMANTIC, M = global.MockServer;
/* 关掉开机补发定时器, 免得它们往 house/家具里塞东西 */
st.kitV2 = 1; st.kitV3 = 1; st.kitV4 = 1; st.kitV5 = 1; st.kitGranted = 1;
st.furnitureUnlockAll = 0;                       /* 真循环 */

function setup() {
  st.furniture = { bench: [10201, -1, -1, -1, -1, 10102, -1, -1, -1, -1], has_fur: [], put_fur: [], box: [] };
  st.house = [
    { item_id: 10301, count: 1 },               /* 图纸(墙壁粉刷图册) */
    { item_id: 10201, count: 1 },               /* 工具 简易锯子 type12 */
    { item_id: 10102, count: 2 },               /* 特殊材料 正丹纸 type11 */
    { item_id: 10001, count: 20 }               /* 普通材料 松木 type10 */
  ];
  st.frog = { status: 0 };
  st.clover = 5000;
}
const cnt = id => (st.house.filter(x => x.item_id === id)[0] || { count: 0 }).count;

(async function run() {
  /* --- 1) 商人库存: 买了就是 0, 而且只按 24 小时内的购买算 --- */
  setup();
  st.clover = 5000;                                 /* 商人买东西要三叶草 */
  st.furniture.bought = [];
  let r = S['furniture_load_furniture']();
  const row4001 = r.shop.shop_list.filter(x => Number(x.shop_id) === 4001)[0];
  ok(!!row4001, '商人列表里有 shop_id=4001 (图纸 10301)');
  ok(row4001 && row4001.num === 1, '没买过时 num=1 (剩1个)  [' + (row4001 && row4001.num) + ']');
  /* 新作息(用户表): 嘟嘟每天下午/晚上到访一次, **每次到访重新上架** —— 测试里把"本次到访"设成现在,
     否则 start_time=0(还没到访) 时商品本来就该是"不在架上"。 */
  st.merchantVisit = { day: (function(){var d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();})(), start: Math.floor(Date.now()/1000) - 60 };
  S['furniture_buy_shop']({ shop_id: 4001 });
  r = S['furniture_load_furniture']();
  const row2 = r.shop.shop_list.filter(x => Number(x.shop_id) === 4001)[0];
  ok(row2 && row2.num === 0, '买过之后 num=0 -> 客户端显示售罄 [' + (row2 && row2.num) + ']');
  ok(cnt(10301) === 2, '图纸进包 (10301 = ' + cnt(10301) + ')');
  st.furniture.bought[0].time = Date.now() - 90000000;   /* 25 小时前 -> 过期 */
  r = S['furniture_load_furniture']();
  const row3 = r.shop.shop_list.filter(x => Number(x.shop_id) === 4001)[0];
  ok(row3 && row3.num === 1, '超过 24 小时后商人补货 num=1 [' + (row3 && row3.num) + ']');

  /* --- 1b) 嘟嘟卖的 type14 物品(家具礼袋/花种)必须进物品栏, 不能塞进 has_fur --- */
  (function () {
    const SHOP2 = JSON.parse(fs.readFileSync(BASE + '/tables/furnitureShopData_json.json', 'utf8'));
    const rows2 = Object.keys(SHOP2).map(k => SHOP2[k]);
    /* 找一条卖"type14(RESOURCE) 物品"且该物品**不是**家具的商店行 —— 例如 shop_id 4 卖 204001 周年庆·家具礼袋 */
    const resRow = rows2.filter(function (r) {
      const it = byId[Number(r.item_id)];
      return it && Number(it.type) === 14 && !FURN[String(r.item_id)];
    })[0];
    ok(!!resRow, '商店里有 type14 的非家具商品 [shop_id=' + (resRow && resRow.id) + ' item=' + (resRow && resRow.item_id) + ']');
    if (resRow) {
      st.clover = 999999;
      st.furniture.has_fur = []; st.furniture.bought = [];
      st.house = st.house.filter(x => x.item_id !== Number(resRow.item_id));
      const r = S['furniture_buy_shop']({ shop_id: resRow.id });
      ok(r.code === 0, '购买成功 (code=' + r.code + ')');
      ok(st.furniture.has_fur.indexOf(Number(resRow.item_id)) < 0, '没有塞进 has_fur(家具表里没有它)');
      ok(cnt(resRow.item_id) > 0, '进了物品栏 house [' + resRow.item_id + '=' + cnt(resRow.item_id) + ']');
      const after = S['furniture_load_furniture']();
      ok((after.has_fur || []).indexOf(Number(resRow.item_id)) < 0, '下发里 has_fur 不含它(重启也不会被剔除逻辑干掉)');
    }
  })();

  /* --- 2) 工作台开工 --- */
  setup();
  let p = S['furniture_load_furniture']();
  ok(Array.isArray(p.has_fur) && p.has_fur.length === 0, 'unlockAll=0 时 has_fur 只保留做出来的 (空)');
  ok(Array.isArray(p.mate_list) && p.mate_list.length === 0, '还没开工时 mate_list 为空');
  window.MOCK_MAKE.tick();
  const mk = st.furniture.make;
  ok(mk && mk.id > 0, '条件满足 -> 开工 (家具 ' + (mk && mk.id) + ')');
  const cand = furById[mk.id];
  ok(cand && Number(cand.drawing) === 10301, '做的正是图纸 10301 对应的家具 (' + (cand && cand.name) + ')');
  ok(mk.mat === 10102 && mk.tool === 10201, '用的是台面上的材料/工具 [' + mk.mat + '/' + mk.tool + ']');
  p = S['furniture_load_furniture']();
  ok(p.mate_list.indexOf(10102) >= 0 && p.mate_list.indexOf(10001) >= 0, '制作期间 mate_list 占用材料 [' + p.mate_list.join(',') + ']');

  /* --- 2b) 干活要有动画: 庭院专属工序动画(5..9 锯/刷/敲/编/裁), 居家状态机不许顶掉它 --- */
  /* 用**室内**动作 3(sagyou_ie 做手工): 5..9 那套庭院工序动画每次重画都会新建精灵, 累积后会盖住场景
     (用户: "拖不动场景 + 日历/聚会按钮被遮挡"), 所以改成室内动作。 */
  ok(Number(st.frog.motion) === 3 && Number(st.frog.crafting) === 1,
     '开工时播室内"做手工"动作 motion=3 crafting=' + st.frog.crafting);
  ok(Number(st.furniture.make.sessions) >= 1 && Number(st.furniture.make.sessions) <= 3,
     '一件家具分 ' + st.furniture.make.sessions + ' 段做完(原版 1~3 次)');
  ok(Number(st.furniture.make.seconds) === 90, '每段动画 ' + st.furniture.make.seconds + ' 秒(原版实测约 1 分 30 秒)');
  const mBefore = Number(st.frog.motion);
  window.MOCK_FROGSTATE.next();
  ok(Number(st.frog.motion) === mBefore, '干活期间居家状态机不换动作 [' + st.frog.motion + ']');

  /* --- 3) 分段做完 -> 出家具 --- */
  st.sessionSeconds = 1; st.pauseSeconds = 1;              /* 测试里把每段/间歇缩到 1 秒 */
  const furBefore = st.furniture.has_fur.length;
  window.MOCK_MAKE.finish();          /* 把剩下的段一次做完 */
  ok(Number(st.frog.crafting) === 0, '干完了: 松开干活动画 [' + st.frog.crafting + ']');

  ok(st.furniture.bench[5] === 10102 || cnt(10102) === 0, '材料还有剩就保留台面格子(用光才清) [' + st.furniture.bench[5] + '/剩' + cnt(10102) + ']');
  p = S['furniture_load_furniture']();
  ok(p.mate_list.length === 0, '完成后 mate_list 清空');
  ok(p.has_fur.indexOf(mk.id) >= 0, '下发里也带着这件家具');

  st.furniture.bench = [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1];   /* 先别让它自动开下一单 */

  /* --- 4) 材料用光 -> 停止开工, 并清掉台面那一格 --- */
  st.furniture.bench = [10201,-1,-1,-1,-1,10102,-1,-1,-1,-1];   /* 台面再摆一份材料 */
  window.MOCK_MAKE.tick();                       /* 开第二单 */
  window.MOCK_MAKE.finish();                     /* 一次做完 */
  ok(cnt(10102) === 0, '第二件做完 10102 = 0');
  ok(st.furniture.bench[5] === -1, '材料用光后台面那一格被清掉 [' + st.furniture.bench[5] + ']');
  window.MOCK_MAKE.tick();
  ok(!st.furniture.make.id, '没有材料就不开工 (make.id=' + st.furniture.make.id + ')');

  /* --- 5) 青蛙出门 -> 不开工 --- */
  setup();
  st.frog.status = 1;
  window.MOCK_MAKE.tick();
  ok(!st.furniture.make.id, '青蛙旅行中不开工');

  /* --- 6) unlockAll=1 回到旧行为 --- */
  setup();
  st.furnitureUnlockAll = 1;
  p = S['furniture_load_furniture']();
  ok(p.has_fur.length === furRows.length, 'unlockAll=1 时 has_fur = 家具表全量 (' + p.has_fur.length + '/' + furRows.length + ')');

  /* --- 6b) 家具做好/摆放要发 TimerEvent(客户端才有播报) --- */
  await (async function () {
    const evs = [];
    const realD = M.dispatch;
    M.dispatch = function (n, d) { if (n === 'notify_new_event' && d && d.event) evs.push(d.event); return realD.apply(this, arguments); };
    setup();
    st.furnitureUnlockAll = 0;
    window.MOCK_MAKE.tick();
    const fid = st.furniture.make.id;
    window.MOCK_MAKE.finish();               /* 分段制作: 直接把这一单做完 */
    await new Promise(r => setTimeout(r, 200));            /* MOCK_EVENT 是 setTimeout(60) 推送 */
    const fin = evs.filter(e => e.evt_type === 21)[0];
    ok(!!fin, '家具做好 -> TimerEvent.FurnitureFinish(21) 已发出');
    ok(fin && Number(fin.evt_id) === Number(fid), 'FurnitureFinish 的 evt_id 是家具 id [' + (fin && fin.evt_id) + ']');
    const put = S['furniture_replace_fur']({ id: fid });
    ok(put.code === 0, '摆放家具成功');
    await new Promise(r => setTimeout(r, 200));
    const putEv = evs.filter(e => e.evt_type === 22)[0];
    ok(!!putEv, '摆放 -> TimerEvent.FurniturePut(22) 已发出');
    M.dispatch = realD;
  })();

  /* --- 7) 工作台状态: 默认**不锁**(用户报"青蛙不让我补充工作台");
         st.benchLock=1 才恢复原版"制作中/出门 -> 锁住(呱~不许动)" --- */
  setup();
  st.furnitureUnlockAll = 0;
  function lockOf() { return S['furniture_load_furniture']().bench_lock; }
  /* 默认: 正在做家具就锁(客户端台面变灰 + "呱~不许动"); st.benchLock=0 才完全不锁 */
  st.benchLock = undefined; st.frog = { status: 0, traveling: false };
  st.furniture.make = { id: 0, drawing: 0, started: 0, tool: 0, mat: 0, res: 0 };
  ok(lockOf() === false, '空闲: 台面不锁');
  st.furniture.make = { id: 1234, drawing: 10301, started: 0, tool: 10201, mat: 10102, res: 0 };
  ok(lockOf() === true, '默认: 正在做家具 -> 台面锁住(呱~不许动)');
  st.benchLock = 0;
  ok(lockOf() === false, 'st.benchLock=0: 完全不锁(能随时补充材料)');
  st.benchLock = 1;
  st.furniture.make = { id: 0, drawing: 0, started: 0, tool: 0, mat: 0, res: 0 };
  st.frog = { status: 0, traveling: false };
  ok(lockOf() === false, '空闲且在家: 台面不锁');
  window.MOCK_MAKE.tick();
  ok(!!st.furniture.make.id, '开工中 (家具 ' + st.furniture.make.id + ')');
  ok(lockOf() === true, '制作中: 台面锁住(客户端弹"呱~不许动")');
  st.furniture.make = { id: 0, drawing: 0, started: 0, tool: 0, mat: 0, res: 0 };
  st.frog.status = 1;
  ok(lockOf() === false, '青蛙出门但没在做家具: 不锁(能补充材料)');
  st.benchLock = 2;
  ok(lockOf() === true, 'st.benchLock=2: 连出门也锁(旧行为)');
  st.benchLock = 1;
  st.frog.status = 0;
  st.mood = 4;
  ok(Number(S['furniture_load_furniture']().mood) === 4, 'st.mood 可覆盖(very_angry 罢工图调试用)');
  delete st.mood;

  console.log(fails() === 0 ? 'ALL FURNITURE-MAKE CHECKS PASSED' : (fails() + ' CHECK(S) FAILED'));
  process.exit(fails() === 0 ? 0 : 1);
})();
