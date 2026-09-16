/* taskplantest: 「伴蛙前行」的任务 / 计划（日/周/半月/月/季/年）进度与领奖。
   用户报："伴蛙前行里面的任务（日任务，周任务，月任务，季任务，年任务）也做不了，无法增加进度与获取奖励"。
   契约(notes/research_task_achieve_ency_story.md §1):
     task_load = {tasks:[{id,pro,is_reward}] (id∈task_list 30 键), list:[{id,pro}] (id∈list_map 67 键)}
     task_load_list = {reward:[{id:节奏1..6, pro:已领档位数}]}
     task_get_reward{id} / task_get_list_reward{id:100*节奏+档位} 都要回 {code:0}
   硬约束: list 里出现非 list_map id -> 客户端 updateRedot 抛异常(任务窗打不开);
           list 必须含 101/201/301/401/501/601 否则页签不出现。 */
const { BASE, ok, boot, fails } = require('./_harness.js');
const fs = require('fs');
const T = JSON.parse(fs.readFileSync(BASE + '/tables/taskData_json.json', 'utf8'));
const ITEMS = JSON.parse(fs.readFileSync(BASE + '/tables/Item_json.json', 'utf8'));
const byId = {}; ITEMS.forEach(i => byId[Number(i.id)] = i);

boot({ stubs: g => {
  g.Tabikaeru.DataManager = { instance: () => ({
    ItemDB: { get: id => byId[Number(id)] || null, list: () => ITEMS },
    TaskDB: { get: k => T[k] || null }
  }) };
}});
const st = global.MOCK_STATE || (global.MOCK_STATE = {});
const S = global.MOCK_SEMANTIC, M = global.MockServer;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TASK_IDS = Object.keys(T.task_list).map(Number);
const LIST_IDS = Object.keys(T.list_map).map(Number);

(async function () {
  st.kitV2 = st.kitV3 = st.kitV4 = st.kitV5 = st.kitGranted = 1;
  st.party = { started: 0, guest: -1, ends: 0 }; st.partyLast = Math.floor(Date.now() / 1000);
  st.travelCount = 0; st.photos = []; st.notes = []; st.stories = []; st.collections = [];
  st.tasks = undefined; st.clover = 100; st.ticket = 0; st.buyCount = 0;
  st.frog = { status: 0, motion: 0, traveling: false, returnAt: 0 };

  /* --- 1) 形状 --- */
  const d = S['task_load']();
  ok(Array.isArray(d.tasks) && d.tasks.length === TASK_IDS.length, 'tasks 覆盖 task_list 全部 ' + TASK_IDS.length + ' 条 [' + d.tasks.length + ']');
  ok(d.tasks.every(t => TASK_IDS.indexOf(t.id) >= 0), 'tasks 的 id 全部是 task_list 的键(否则详情页空白)');
  ok(d.tasks.every(t => typeof t.pro === 'number' && (t.is_reward === 0 || t.is_reward === 1)), '每条都带 pro/is_reward');
  ok(Array.isArray(d.list) && d.list.length === LIST_IDS.length, 'list 覆盖 list_map 全部 ' + LIST_IDS.length + ' 条 [' + d.list.length + ']');
  ok(d.list.every(x => LIST_IDS.indexOf(x.id) >= 0), 'list 的 id 全部是 list_map 的键(否则 updateRedot 抛异常)');
  const anchors = [101, 201, 301, 401, 501, 601];
  ok(anchors.every(id => d.list.some(x => x.id === id)), 'list 含 6 个页签锚点 101/201/301/401/501/601');
  const rl = S['task_load_list']();
  ok(Array.isArray(rl.reward) && rl.reward.length === 6 && rl.reward.every((r, i) => r.id === i + 1), 'task_load_list.reward 的 id 是节奏 1..6');

  /* --- 2) 任务进度来自存档状态 --- */
  st.travelCount = 3; st.photos = [{ id: 1, pic_id: 100 }, { id: 2, pic_id: 101 }];
  st.notes = [{ id: 1000, read: 1 }, { id: 2000, read: 0 }];
  st.stories = [{ id: 1 }]; st.collections = [0, 1, 2];
  const d2 = S['task_load']();
  const pro = id => (d2.tasks.filter(t => t.id === id)[0] || {}).pro;
  const isRw = id => (d2.tasks.filter(t => t.id === id)[0] || {}).is_reward;
  ok(pro(2) === 3, '「旅行成了常态」= 旅行次数 3 [' + pro(2) + ']');
  ok(pro(8) === 2, '「这些照片都有蛙」= 明信片 2 [' + pro(8) + ']');
  ok(pro(102) === 2, '「一连串的见闻叙事」= 笔记 2 [' + pro(102) + ']');
  ok(pro(103) === 1, '「蛙友的结伴记录」= 旅友笔记(type2) 1 [' + pro(103) + ']');
  ok(pro(6) === 3, '「一屋子的纪念品」= 纪念品种类 3 [' + pro(6) + ']');

  /* --- 3) 领奖: code 0 + 真到账 + is_reward --- */
  const before = Number(st.clover);
  let r = S['task_get_reward']({ id: 7 });            /* 任务7「照片里有蛙」count 1, 奖励 1000 四叶草 */
  ok(r && r.code === 0, '未完成的任务不能领? 这里照片=2>=1 应该能领 (code=' + (r && r.code) + ')');
  ok(Number(st.clover) === before, '奖励是 item(1000 四叶草) 不是三叶草, clover 不变');
  const hc = id => (st.house.filter(x => Number(x.item_id) === Number(id))[0] || { count: 0 }).count;
  ok(hc(1000) >= 1, '任务奖励 item 1000 真进仓库 [' + hc(1000) + ']');
  ok(isRwAfter(7) === 1, '领过之后 is_reward=1');
  function isRwAfter(id) { return (S['task_load']().tasks.filter(t => t.id === id)[0] || {}).is_reward; }
  ok(S['task_get_reward']({ id: 7 }).code === 2, '重复领取被拒 (code 2)');
  ok(S['task_get_reward']({ id: 2 }).code === 3, '没做完的任务领不了 (code 3)');
  ok(S['task_get_reward']({ id: 999999 }).code === 1, '非法任务 id 回 code 1');

  /* --- 4) 计划: 窗口内进度 + 档位领奖 --- */
  st.travelCount = 12; st.photos = [1, 2, 3, 4, 5].map(i => ({ id: i, pic_id: 100 + i }));
  M.handle('task_client_pro', { param: 'Map' });
  const d3 = S['task_load']();
  const lp = id => (d3.list.filter(x => x.id === id)[0] || {}).pro;
  ok(lp(101) >= 1 && lp(101) <= Number(T.list_map['101'].count), '日计划 101「出门随便逛逛」跟着旅行次数走 [' + lp(101) + ']');
  ok(lp(102) >= 1, '日计划 102 跟着照片走 [' + lp(102) + ']');
  ok(lp(103) >= 1, '日计划 103 跟着地图水印走 [' + lp(103) + ']');
  const dailyDone = d3.list.filter(x => {
    const c = T.list_map[String(x.id)];
    return c && Number(c.type) === 1 && x.pro >= Number(c.count);
  }).length;
  ok(dailyDone >= Number(T.list_type['1'].target[0]), '日计划已完成 ' + dailyDone + ' 条 (第1档需要 ' + T.list_type['1'].target[0] + ')');
  const cloverB = Number(st.clover);
  r = S['task_get_list_reward']({ id: 100 * 1 + 1 });
  ok(r && r.code === 0, '日计划第 1 档可以领 (code=' + (r && r.code) + ')');
  ok(Number(st.clover) + hc(1) > cloverB || hc(1) >= 1, '档位奖励(华夫饼 item 1)到账 [' + hc(1) + ']');
  ok(S['task_load_list']().reward.filter(x => x.id === 1)[0].pro === 1, 'task_load_list 记住已领 1 档');
  ok(S['task_get_list_reward']({ id: 100 * 1 + 1 }).code === 2, '同一档不能领两次');
  ok(S['task_get_list_reward']({ id: 100 * 1 + 2 }).code === 1, '日计划只有 1 档, 越界 id 回 code 1');
  ok(S['task_get_list_reward']({ id: 100 * 2 + 2 }).code === 3, '当周计划跳档领取被拒 (还没领第1档)');
  ok(S['task_get_list_reward']({ id: 999 }).code === 1, '非法档位 id 回 code 1');

  /* --- 5) 周期切换: 进度与已领档位清零, 任务(累计)不受影响 --- */
  st.tasks.win[1] = { key: '旧窗口', base: { travel: 0, photo: 0 } };
  const d4 = S['task_load']();
  const lp4 = id => (d4.list.filter(x => x.id === id)[0] || {}).pro;
  ok(lp4(101) === 0, '跨周期后日计划进度清零 [' + lp4(101) + ']');
  ok(S['task_load_list']().reward.filter(x => x.id === 1)[0].pro === 0, '跨周期后已领档位清零');
  ok((d4.tasks.filter(t => t.id === 2)[0] || {}).pro === Number(T.task_list['2'].count), '任务是累计的, 跨周期不清零(显示按目标值封顶) [' + (d4.tasks.filter(t => t.id === 2)[0] || {}).pro + ']');

  /* --- 6) guard 不会把任务删掉 --- */
  const drops = (typeof window.MOCK_GUARD_DROPS === 'function') ? window.MOCK_GUARD_DROPS() : null;
  const taskDrops = drops ? (Array.isArray(drops) ? drops.filter(x => String(x).indexOf('task:') === 0) : []) : [];
  if (drops) ok(taskDrops.length === 0, 'guard 没有丢任何任务 id [' + JSON.stringify(taskDrops.slice(0, 4)) + ']');

  console.log(fails() === 0 ? 'ALL TASK-PLAN CHECKS PASSED' : (fails() + ' CHECK(S) FAILED'));
  process.exit(fails() === 0 ? 0 : 1);
})();
