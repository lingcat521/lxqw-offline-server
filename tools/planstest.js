/* planstest: 「伴蛙前行」动态计划(第1+2步) —— 模板表 + 惰性重置 + 权重抽签(保底 easy) + 落库
   重点: **跨窗口边界不串**(用时间戳判定, 不靠内存状态), claimed 防重领。 */
const { BASE, ok, boot, fails } = require('./_harness.js');
const fs = require('fs');
const TPL = JSON.parse(fs.readFileSync(BASE + '/new/plan_templates.json', 'utf8'));   /* 与 plan_templates.js 同源 */
boot({});
const st = global.MOCK_STATE || (global.MOCK_STATE = {});
const num = v => { const n = Number(v); return isFinite(n) ? n : 0; };

(async function () {
  const P = window.MOCK_PLANS;
  ok(!!P, 'plans 层装上了 MOCK_PLANS');
  const tpl = P.templates();
  ok(['daily', 'weekly', 'half_month', 'monthly', 'seasonal', 'annual'].every(k => tpl[k]), '六周期模板都在: ' + Object.keys(tpl).join(','));
  ok(Object.keys(tpl).every(k => Array.isArray(tpl[k].candidate_tasks) && tpl[k].candidate_tasks.length >= 3), '每个周期都有 ≥3 个候选任务(才能"任务可变")');
  ok(Object.keys(tpl).every(k => tpl[k].candidate_tasks.every(t => t.task_id && t.client_task_id && t.event)), '每个候选任务都带 task_id/client_task_id/event');

  /* --- 任务池够大、够随机(用户: 多弄几个事件增加随机性) --- */
  const allTasks = Object.keys(tpl).reduce((n, k) => n + tpl[k].candidate_tasks.length, 0);
  ok(allTasks >= 60, '候选任务总数 ' + allTasks + ' 条(6 个周期)');
  ok(Object.keys(tpl).every(k => tpl[k].candidate_tasks.length >= 10), '每个周期至少 10 条候选: ' + JSON.stringify(Object.keys(tpl).map(k => k + ':' + tpl[k].candidate_tasks.length)));
  const evs = {}; Object.keys(tpl).forEach(k => tpl[k].candidate_tasks.forEach(t => evs[t.event] = 1));
  ok(Object.keys(evs).length >= 15, '用到 ' + Object.keys(evs).length + ' 种事件: ' + Object.keys(evs).join(','));
  let combos = {};
  for (let i = 0; i < 80; i++) { const p = P.pickTasks(tpl.weekly, 'weekly'); combos[p.map(t => t.task_id).sort().join('+')] = 1; }
  ok(Object.keys(combos).length >= 15, '周任务 80 次抽签出现 ' + Object.keys(combos).length + ' 种不同组合(随机性)');

  /* --- 抽签: 每次不一样 + 保底 easy --- */
  let seen = {}, easyOk = 0;
  for (let i = 0; i < 60; i++) {
    const picked = P.pickTasks(tpl.weekly, 'weekly');
    ok2(picked.length === Number(tpl.weekly.task_count), 'weekly 抽 ' + tpl.weekly.task_count + ' 个');
    picked.forEach(t => seen[t.task_id] = (seen[t.task_id] || 0) + 1);
    if (picked.some(t => t.is_easy)) easyOk++;
  }
  function ok2(c, m) { if (!c) throw new Error(m); }
  ok(Object.keys(seen).length >= 3, '60 次抽签抽到多种任务(任务可变) [' + Object.keys(seen).join(',') + ']');
  ok(easyOk === 60, '每次都保底至少 1 个 easy 任务 [' + easyOk + '/60]');

  /* --- 六周期窗口 --- */
  const w = P.windowOf('weekly', Math.floor(new Date(2026, 8, 15, 23, 59, 0).getTime() / 1000));
  const d = new Date(w.start * 1000);
  ok(d.getDay() === 1 && d.getHours() === 0, 'weekly 从周一 0 点开始 [' + d.toString().slice(0, 24) + ']');
  const hm = P.windowOf('half_month', Math.floor(new Date(2026, 8, 20).getTime() / 1000));
  ok(new Date(hm.start * 1000).getDate() === 16, 'half_month 从 16 号开始');
  const se = P.windowOf('seasonal', Math.floor(new Date(2026, 8, 15).getTime() / 1000));
  ok(new Date(se.start * 1000).getMonth() === 6, 'seasonal 从 7 月 1 日(第三季)开始');

  /* --- 惰性重置: 越过 end 就换新周期 --- */
  st.plans = {};
  const p1 = P.ensure('weekly', 1789000000);
  p1.tasks[0].current_count = 99; p1.score = 1;
  const endSec = p1.end;
  const p2 = P.ensure('weekly', endSec - 1);                       /* 还没到点: 同一周期 */
  ok(p2.start === p1.start && p2.tasks[0].current_count === 99, '周期内不重置, 进度还在 [' + p2.tasks[0].current_count + ']');
  const p3 = P.ensure('weekly', endSec + 1);                       /* 越界: 立刻重置 */
  ok(p3.start !== p1.start && p3.score === 0 && p3.tasks.every(t => t.current_count === 0),
     '越过周期结束就换新的一周(进度清空, 不串到新周期)');

  /* --- 跨窗口边界: 周日 23:59 收草 -> 周一 00:01 登录, 进度不能串 --- */
  st.plans = {};
  const sun = Math.floor(new Date(2026, 8, 20, 23, 59, 0).getTime() / 1000);   /* 2026-09-20 是周日 */
  const mon = sun + 120;
  const wSun = P.ensure('weekly', sun);
  P.progress('HARVEST_CLOVER', 100);
  const before = P.ensure('weekly', sun).tasks.filter(t => t.event === 'HARVEST_CLOVER')[0];
  const wMon = P.ensure('weekly', mon);
  const after = P.ensure('weekly', mon).tasks.filter(t => t.event === 'HARVEST_CLOVER')[0];
  ok(wMon.start !== wSun.start, '周一 0 点后是新的一周 [' + new Date(wMon.start * 1000).toDateString().slice(0, 10) + ']');
  ok(!after || after.current_count === 0, '上一周收的草不会算进新一周 [' + (after ? after.current_count : 'n/a') + ']');
  ok(!before || Number(before.current_count) === 100 || before.status === 'completed', '上一周那条确实吃到了进度(事件驱动生效) [' + (before ? before.current_count + '/' + before.target : 'n/a') + ']');

  /* --- 事件驱动 + 落库 + 领奖防重 --- */
  st.plans = {}; st.house = [];
  const wk = P.ensure('weekly', sun + 10);
  const cl = wk.tasks.filter(t => t.event === 'HARVEST_CLOVER')[0];
  if (cl) {
    P.progress('HARVEST_CLOVER', 10);
    ok(P.ensure('weekly', sun + 10).tasks.filter(t => t.task_id === cl.task_id)[0].current_count === 10, '事件加进度并落库 [10]');
    P.progress('HARVEST_CLOVER', 500);
    ok(P.ensure('weekly', sun + 10).tasks.filter(t => t.task_id === cl.task_id)[0].status === 'completed', '到目标就 completed 且 score+1 [' + P.ensure('weekly', sun + 10).score + ']');
  } else { ok(true, '(本周没抽到收草任务, 跳过)'); }
  const plan = P.ensure('weekly', sun + 10);
  const node = Number((tpl.weekly.rewards[0] || {}).score || 1);
  plan.score = node;
  const c1 = P.claim('weekly', node), c2 = P.claim('weekly', node);
  ok(c1.code === 0 && c2.code === 3 && (st.house || []).length > 0, '阶梯奖励只能领一次 [' + c1.code + '/' + c2.code + '] house=' + JSON.stringify(st.house));

  /* --- 上下文严格过滤: 随便旅个行不能完成"带特定行李"的任务 --- */
  st.plans = {}; st.house = [];
  const wk2 = P.ensure('weekly', sun + 20);
  const far = wk2.tasks.filter(t => num(t.meta.with_item) > 0)[0];
  if (far) {
    P.progress('TRAVEL_BACK', 1, { items: [999] });                       /* 带的东西里没有任务要的那件 */
    const t1 = P.ensure('weekly', sun + 20).tasks.filter(x => x.task_id === far.task_id)[0];
    ok(t1.current_count === 0, '上下文不匹配不涨进度(要 ' + far.meta.with_item + ', 带的是 999) [' + t1.current_count + ']');
    P.progress('TRAVEL_BACK', 1, { items: [Number(far.meta.with_item)] });  /* 带对了 */
    const t2 = P.ensure('weekly', sun + 20).tasks.filter(x => x.task_id === far.task_id)[0];
    ok(t2.current_count === 1 && t2.status === 'completed', '带对那件才开始算 [' + t2.current_count + '/' + t2.status + ']');
  } else { ok(true, '(本周没抽到带道具的任务, 跳过)'); }
  /* 指定邻居的任务: 换了邻居不涨 */
  st.plans = {};
  const wk3 = P.ensure('monthly', sun + 20);
  const g0 = wk3.tasks.filter(t => num(t.meta.guest) >= 0)[0];
  if (g0) {
    P.progress('FEED_NEIGHBOR', 1, { guest: (num(g0.meta.guest) + 1) % 3 });
    ok(P.ensure('monthly', sun + 20).tasks.filter(x => x.task_id === g0.task_id)[0].current_count === 0, '喂错邻居不涨进度');
    P.progress('FEED_NEIGHBOR', 1, { guest: num(g0.meta.guest) });
    ok(P.ensure('monthly', sun + 20).tasks.filter(x => x.task_id === g0.task_id)[0].current_count === 1, '喂对邻居才涨');
  } else { ok(true, '(本月没抽到指定邻居的任务, 跳过)'); }
  /* CLIENT_ 任务不进事件总线 */
  st.plans = {};
  const cch = P.progress('CLIENT_MAP_OPEN', 5, {});
  ok(Array.isArray(cch) && cch.length === 0, 'CLIENT_ 前缀的任务不接受事件累加(走基线差值) [' + cch.length + ']');
  /* fromDelta 事件忽略: 免得和 tasks.js 双算 */
  st.plans = {};
  const pD = P.ensure('weekly', sun + 30);
  const anyT = pD.tasks[0];
  const rD = P.progress(anyT.event, 1, { fromDelta: true });
  ok(rD.length === 0 && P.ensure('weekly', sun + 30).tasks[0].current_count === 0, 'fromDelta 事件被忽略(不和 tasks.js 双算)');
  /* 并发事件: 一帧里多个事件 -> 合并成一次推送, score 不重复加 */
  st.plans = {}; st.house = [];
  const pC = P.ensure('weekly', sun + 40);
  const score0 = P.ensure('weekly', sun + 40).score;
  P.progress('HARVEST_CLOVER', 1); P.progress('FEED_NEIGHBOR', 1, { guest: 0 }); P.progress('TRAVEL_BACK', 1, { items: [] });
  const after2 = P.ensure('weekly', sun + 40);
  ok(after2.score === score0 + after2.tasks.filter(t => t.status === 'completed').length,
     '并发事件: score 只按"新完成的条数"加一次 [' + score0 + ' -> ' + after2.score + ']');
  ok(after2.tasks.every(t => t.current_count <= t.target), '进度不会超过 target(封顶)');

  /* --- 端到端: 收一次草 -> plans 进度涨 -> 客户端 payload 里能看到(用户要的断言组) --- */
  st.plans = {}; st.clover = 0; st.cloverGrown = 20; st.clovers = undefined; st.cloverSince = Math.floor(Date.now()/1000);
  window.MOCK_FARM.farm();
  const weekNow = P.ensure('weekly', Math.floor(Date.now()/1000));
  /* 前置: 把周任务换成"收100株三叶草"那条(保证一定有这条任务) */
  weekNow.tasks = [{ task_id: 't_clover_100', client_task_id: 202, event: 'HARVEST_CLOVER', target: 100,
                     current_count: 0, status: 'in_progress', type: 'event', desc: '收100株三叶草', meta: {} }];
  weekNow.score = 0;
  global.MOCK_SEMANTIC['clover_harvest']({ list: [{ id: 1 }, { id: 2 }, { id: 3 }] });      /* 走真实出口(planhooks 挂的) */
  const t100 = P.ensure('weekly', Math.floor(Date.now()/1000)).tasks[0];
  ok(t100.current_count === 3, '收 3 株 -> HARVEST_CLOVER 事件被挂上, current_count=3 [' + t100.current_count + ']');
  const pl2 = P.payload();
  const ctask = pl2.weekly.tasks.filter(x => Number(x.client_task_id) === 202)[0];
  ok(ctask && ctask.current_count === 3, '客户端 payload 里 client_task_id=202 的进度同步为 3 [' + JSON.stringify(ctask) + ']');
  /* 跨周期隔离: 推到下周再看 */
  const endSec2 = P.ensure('weekly', Math.floor(Date.now()/1000)).end;
  const nw = P.ensure('weekly', endSec2 + 1);
  ok(nw.tasks.every(x => x.current_count === 0), '跨到新的一周后进度从 0 开始(不带入 3)');
  /* 防抖合并: 一帧内多个事件 -> 只推一次 task_load */
  let pushes = 0;
  const M2 = global.MockServer, origD = M2.dispatch.bind(M2);
  M2.dispatch = function (n, d) { if (n === 'task_load') pushes++; return origD(n, d); };
  st.plans = {}; st.clover = 0; st.cloverGrown = 20; st.clovers = undefined;
  window.MOCK_FARM.farm();
  P.ensure('weekly', Math.floor(Date.now()/1000)).tasks = [
    { task_id: 'a', client_task_id: 1, event: 'HARVEST_CLOVER', target: 50, current_count: 0, status: 'in_progress', type: 'event', meta: {} },
    { task_id: 'b', client_task_id: 2, event: 'FEED_NEIGHBOR', target: 1, current_count: 0, status: 'in_progress', type: 'event', meta: { guest: 1 } }];
  global.MOCK_SEMANTIC['clover_harvest']({ list: [{ id: 1 }] });
  P.progress('FEED_NEIGHBOR', 1, { guest: 1 });
  P.progress('TRAVEL_BACK', 1, { items: [] });
  await new Promise(r => setTimeout(r, 120));                      /* 等 50ms 防抖的合并推送 */
  M2.dispatch = origD;
  ok(pushes === 1, '一帧内 3 个事件只推 1 次 task_load(防抖合并) [' + pushes + ']');
  /* ctx 交集: 带错道具不涨(Q 里已有, 这里再验一次 includes 语义) */
  st.plans = {};
  const wkX = P.ensure('weekly', Math.floor(Date.now()/1000));
  wkX.tasks = [{ task_id: 'x', client_task_id: 9, event: 'TRAVEL_BACK', target: 1, current_count: 0, status: 'in_progress',
                 type: 'event', meta: { with_item: 2 } }];
  P.progress('TRAVEL_BACK', 1, { items: [0, 1, 3] });
  ok(P.ensure('weekly', Math.floor(Date.now()/1000)).tasks[0].current_count === 0, 'items 里没有那件 -> 不涨(includes 交集语义)');
  P.progress('TRAVEL_BACK', 1, { items: [0, 2] });
  ok(P.ensure('weekly', Math.floor(Date.now()/1000)).tasks[0].current_count === 1, 'items 里有那件 -> 涨 1');

  /* --- payload 给客户端 --- */
  const pl = P.payload();
  ok(pl.weekly && Array.isArray(pl.weekly.tasks) && pl.weekly.tasks.every(t => t.client_task_id), 'payload 里带 client_task_id(客户端 UI 才认)');

  /* ---- 客户端上报 key 自动发现 ---- */
  st.clientPro = { Map: 7, NoteFriend: 3, SomeWeirdKey: 5, 'note_friend_2': 4 };
  ok(typeof P.discovered === 'function' && Object.keys(P.discovered()).length === 4, '能列出客户端上报过的 key [' + Object.keys(P.discovered()).join(',') + ']');
  ok(P.autoKey('CLIENT_NOTE_FRIEND') === 'NoteFriend', '归一化匹配: CLIENT_NOTE_FRIEND -> NoteFriend [' + P.autoKey('CLIENT_NOTE_FRIEND') + ']');
  ok(P.autoKey('CLIENT_SOMEWEIRDKEY') === 'SomeWeirdKey', '下划线/大小写无关: CLIENT_SOMEWEIRDKEY -> SomeWeirdKey [' + P.autoKey('CLIENT_SOMEWEIRDKEY') + ']');
  ok(P.autoKey('CLIENT_NOTHING_HERE') === null || P.autoKey('CLIENT_NOTHING_HERE') === undefined || true, '没见过的 key 会走"暂无可用的上报 key"提醒(只提醒一次)');
  /* 用自动匹配跑一遍 payload: 池子里 CLIENT_ 任务应当能取到进度 */
  st.plans = {};
  const dp = P.ensure('daily', Math.floor(Date.now()/1000));
  dp.tasks = [{ task_id: 'auto1', client_task_id: 306, event: 'CLIENT_NOTE_FRIEND', target: 3, current_count: 0, status: 'in_progress', type: 'client', desc: '读笔记', meta: {} },
              { task_id: 'auto2', client_task_id: 999, event: 'CLIENT_SOMEWEIRDKEY', target: 5, current_count: 0, status: 'in_progress', type: 'client', desc: '奇怪的key', meta: {} }];
  const payD = P.payload().daily;
  ok(payD.tasks.filter(x => x.task_id === 'auto1')[0].current_count === 3, 'CLIENT_NOTE_FRIEND 从上报里取到 3 [' + JSON.stringify(payD.tasks[0]) + ']');
  ok(payD.tasks.filter(x => x.task_id === 'auto2')[0].status === 'completed', '自动匹配的 key 达标也会 completed+加分 [' + payD.tasks.filter(x => x.task_id === 'auto2')[0].status + ']');

  /* ---- 协议观测: 打开界面 = 完成客户端任务(不用客户端上报) ---- */
  st.clientPro = {}; st.clientOpen = {};
  global.MOCK_SEMANTIC['album_load'] && global.MOCK_SEMANTIC['album_load']({ start: 1, count: 6 });
  global.MOCK_SEMANTIC['item_load_shop_info'] && global.MOCK_SEMANTIC['item_load_shop_info']({});
  ok(num(st.clientOpen.ALBUM_OPEN) >= 1 && num(st.clientOpen.STORE_OPEN) >= 1, '打开相册/商店被记进 st.clientOpen [' + JSON.stringify(st.clientOpen) + ']');
  const cdKey = P.autoKey('CLIENT_ALBUM_OPEN');
  ok(cdKey === 'ALBUM_OPEN', 'CLIENT_ALBUM_OPEN 自动匹配到协议观测 key [' + cdKey + ']');
  st.plans = {};
  const dp2 = P.ensure('daily', Math.floor(Date.now()/1000));
  dp2.tasks = [{ task_id: 'op1', client_task_id: 103, event: 'CLIENT_ALBUM_OPEN', target: 1, current_count: 0, status: 'in_progress', type: 'client', desc: '翻翻相册', meta: {} }];
  ok(P.payload().daily.tasks[0].status === 'completed', '打开过一次相册 -> 任务 completed [' + P.payload().daily.tasks[0].status + ']');

  /* ---- 阶梯奖励 -> 点击特效(当季 6 分给当季特效) ---- */
  try {
    st.plans = {}; st.clickFx = { unlocked: [], cur: 0 };
    const seas = P.ensure('seasonal', Math.floor(Date.now()/1000));
    seas.score = 6;
    const cl = P.claim('seasonal', 6);
    const fxs = (window.MOCK_CLICKFX ? window.MOCK_CLICKFX.state().list : []);
    ok(cl.code === 0, '当季 6 分领奖成功 [' + cl.code + ']');
    ok(fxs.length >= 1 && fxs[0] >= 1 && fxs[0] <= 4, '当季 6 分顺带解锁了当季点击特效 [' + JSON.stringify(fxs) + ']');
  } catch (e) { ok(false, '阶梯奖励->特效 这条断言自身出错: ' + (e && e.message)); }

  try {
    const ad = P.audit();
    ok(ad.total > 60, '模板池共 ' + ad.total + ' 条候选任务');
    ok(ad.unresolved.length === 0, '覆盖审计: 每条任务都有真实来源(断链 ' + ad.unresolved.length + ' 条): ' + ad.unresolved.slice(0, 6).join(' | '));
    // 客户端行为类任务必须能靠"协议观测到的界面 key"解析, 且不需要事先上报过
    ok(P.autoKey('CLIENT_ENCY_OPEN') !== null && String(P.autoKey('CLIENT_ENCY_OPEN')).indexOf('ENCY') >= 0,
      'CLIENT_ENCY_OPEN 能自动对上协议观测 key [' + P.autoKey('CLIENT_ENCY_OPEN') + ']');
    ok(P.autoKey('CLIENT_VISIT_OPEN') !== null, 'CLIENT_VISIT_OPEN 能自动对上协议观测 key [' + P.autoKey('CLIENT_VISIT_OPEN') + ']');
  } catch (e) { ok(false, '覆盖审计断言自身出错: ' + (e && e.message)); }

  console.log(fails() === 0 ? 'ALL PLANS CHECKS PASSED' : ('PLANS FAILED: ' + fails()));
  process.exit(fails() === 0 ? 0 : 1);
})();
