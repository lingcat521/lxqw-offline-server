/* caketasktest: 聚会活动(蛋糕派对)的**每周任务**。
   用户报: "在娃娃的聚会活动中，每周任务无法正常完成"。
   客户端 main.min.js: this.data.task_list[e.task.id-1] = e.task (partycake_load_task push),
   PartyCakeView 读 {id,count,is_done} + 表里 cfg.total, PartyCakeTaskItem 画 is_done 的对勾 ——
   进度与完成标记**全部由服务端算**, 我们以前永远回 {count:0,is_done:0}。
   奖励: 完成后服务端记 pre_cream/pre_sugar, 客户端视图 LOAD 时自动 req_get_mate() 领,
   partycake_get_mate 回 code 0 时客户端把 pre 并进 cream/sugar, 服务端必须同步自己的状态。 */
const { BASE, ok, boot, fails } = require('./_harness.js');
const fs = require('fs');

const ITEMS = JSON.parse(fs.readFileSync(BASE + '/tables/Item_json.json', 'utf8'));
const CAKE = JSON.parse(fs.readFileSync(BASE + '/tables/PartyCakeData_json.json', 'utf8'));
const byId = {}; ITEMS.forEach(i => byId[Number(i.id)] = i);

boot({ stubs: g => {
  g.Tabikaeru.DataManager = { instance: () => ({
    ItemDB: { get: id => byId[Number(id)] || null, list: () => ITEMS },
    partycakeData: { get: k => CAKE[k] || null }
  }) };
  g.Tabikaeru.Define = { RAFFEL_NEEDTICKETS: 5 };
}});
const st = global.MOCK_STATE || (global.MOCK_STATE = {});
const S = global.MOCK_SEMANTIC, M = global.MockServer;
const T = () => window.MOCK_CAKE_TASK;
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 录下服务端 push 出去的协议 */
const pushed = [];
const realDispatch = M.dispatch;
M.dispatch = function (n, d) { pushed.push({ name: n, data: d }); return realDispatch.apply(this, arguments); };

function taskOf(id) { return (S['partycake_load']().task_list || []).filter(t => t.id === id)[0]; }
function reset() {
  st.cake = undefined;
  st.ticket = 20; st.clover = 5000;
  st.house = [{ item_id: 1000, count: 1 }];
  st.bag = [0, -1, -1, -1]; st.desk = [-1, -1, -1, -1, -1, -1, -1, -1];
  st.frog = { status: 0, motion: 0, traveling: false, returnAt: 0 };
  st.events = [];
  pushed.length = 0;
  T();                                   /* 触发 ks() 建状态 */
}

(async function () {
  reset();

  /* --- 1) 表里 6 个任务, 初始都为 0 --- */
  const d0 = S['partycake_load']();
  ok(Array.isArray(d0.task_list) && d0.task_list.length === 6, 'partycake_load 回 6 个每周任务 [' + (d0.task_list || []).length + ']');
  ok(d0.task_list.every(t => t.count === 0 && t.is_done === 0), '初始次数 0 / 未完成');
  ok(d0.task_list.every(t => t.complete === Number(CAKE.task_list[String(t.id)].total)), 'complete 字段 = 表里的 total');
  ok(d0.pre_cream === 0 && d0.pre_sugar === 0, 'pre_cream/pre_sugar 在应答里(客户端读完会自己 req_get_mate)');

  /* --- 2) 登录任务: 每次进游戏记一次(不重复计) --- */
  M.handle('client_load_role', {});
  M.handle('client_load_role', {});
  ok(taskOf(1).count === 1, '「登录游戏」进游戏记 1 次, 同一会话不重复 [' + taskOf(1).count + ']');

  /* --- 3) 商店买买买: 只看成功的购买 --- */
  st.clover = 5000;
  const buyOk = M.handle('item_buy', { shop_id: 0 });
  ok(buyOk && Number(buyOk.code) === 0, 'item_buy 成功 (code=' + (buyOk && buyOk.code) + ')');
  ok(taskOf(2).count === 1, '「商店买买买」+1 [' + taskOf(2).count + ']');
  const cloverKeep = st.clover; st.clover = 0;
  const buyBad = M.handle('item_buy', { shop_id: 0 });
  st.clover = cloverKeep;
  ok(buyBad && Number(buyBad.code) !== 0, '没钱时 item_buy 失败 (code=' + (buyBad && buyBad.code) + ')');
  ok(taskOf(2).count === 1, '失败的购买不计进度 [' + taskOf(2).count + ']');

  /* --- 4) 商店抽奖: 券够才计 --- */
  const g1 = M.handle('item_gacha', {});
  ok(g1 && Number(g1.ticket) !== -1, 'item_gacha 抽到 rank ' + (g1 && g1.ticket));
  ok(taskOf(3).count === 1, '「商店抽奖一次」+1 [' + taskOf(3).count + ']');
  st.ticket = 0;
  const g2 = M.handle('item_gacha', {});
  ok(g2 && Number(g2.ticket) === -1, '券不足回 {ticket:-1}');
  ok(taskOf(3).count === 1, '券不足的抽奖不计进度 [' + taskOf(3).count + ']');
  st.ticket = 20;

  /* --- 5) 分享 --- */
  S['partycake_reward_share']({ index: 1 });
  ok(taskOf(5).count === 1, '「完成一次分享」+1 [' + taskOf(5).count + ']');

  /* --- 6) 聚会或是旅行: 真的出发才计 --- */
  M.handle('item_set_bag_completed', { completed: true }); window.MOCK_FORCE_DEPART();
  ok(st.frog.traveling === true, '准备后真的出发了');
  ok(taskOf(6).count === 1, '「聚会或是旅行」+1 [' + taskOf(6).count + ']');

  /* --- 7) 做满次数 -> is_done + 奖励进 pre, 并推 partycake_load_task --- */
  await sleep(80);
  ok(pushed.some(p => p.name === 'partycake_load_task'), '进度变化会 push partycake_load_task 给客户端');
  ok(pushed.some(p => p.name === 'partycake_load_task' && p.data && p.data.task && p.data.task.id === 6),
     'push 的 task 就是刚变化的那一条 (id=6)');
  reset(); st.frog = { status: 0, traveling: false };
  T().pro(1, 3);                                  /* 登录任务 total=3 */
  const t1 = taskOf(1);
  ok(t1.count === 3 && t1.is_done === 1, '做满 3 次 -> count=3 is_done=1 [' + JSON.stringify(t1) + ']');
  const cfg1 = CAKE.task_list['1'];
  const before = S['partycake_load']();
  ok(before.pre_cream === Number(cfg1.cream) && before.pre_sugar === Number(cfg1.sugar),
     '完成后奖励记到 pre (' + before.pre_cream + '/' + before.pre_sugar + ')');
  ok(T().pro(1, 1) === false, '已完成的每日任务不再重复计数');
  const creamBefore = Number(before.cream) || 0;
  const gm = S['partycake_get_mate']();
  const after = S['partycake_load']();
  ok(gm && gm.code === 0, 'partycake_get_mate 回 code 0 (客户端据此弹奖励并自己加 cream)');
  ok(after.pre_cream === 0 && after.pre_sugar === 0, '领取后 pre 清零');
  ok(after.cream === creamBefore + Number(cfg1.cream), '服务端同步把奶油并进 cream (' + creamBefore + ' -> ' + after.cream + ')');
  await sleep(80);
  ok(pushed.some(p => p.name === 'partycake_load'), '完成时还会 push partycake_load(视图开着就自动领奖)');

  /* --- 8) 周一 0 点刷新 --- */
  const wk = T().weekStart();
  T().pro(2, 1);
  ok(taskOf(2).count === 1, '先记一次进度');
  st.cake.tasks.week = wk - 7 * 86400;             /* 假装存档是上周的 */
  const after2 = S['partycake_load']();
  ok(after2.task_list.every(t => t.count === 0 && t.is_done === 0), '跨周后次数清零(每周一0点刷新任务)');
  ok(T().state().week === wk, '新的周 key = 本周一 00:00');

  /* --- 9) 表读不到时用内联兜底, 不能崩 --- */
  const savedGet = CAKE.task_list;
  CAKE.task_list = null;
  const fb = S['partycake_load']().task_list;
  CAKE.task_list = savedGet;
  ok(fb.length === 6 && fb[0].complete > 0, '表缺失时仍有 6 个任务与目标次数(内联兜底)');

  console.log(fails() === 0 ? 'ALL CAKE-TASK CHECKS PASSED' : (fails() + ' CHECK(S) FAILED'));
  process.exit(fails() === 0 ? 0 : 1);
})();
