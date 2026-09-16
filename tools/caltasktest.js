/* caltasktest: 日历「节气奖励」与当日任务。
   用户报「客户端内一堆点了没反应」里就有日历: 以前 calendar_load.task_list 是**空数组**,
   而客户端 req_st_reward 的成功回调里有一句 `i.data.task_list[0].complete=!1` ——
   空数组直接抛异常 -> checkRedot() 与隐藏图标的回调都不执行(红点常亮、格子图标不消失)。
   现在: task_list = 日计划(list_map type=1)的完成情况, 非空; 当天已领过节气奖励就不再算完成。 */
const { BASE, ok, boot, fails } = require('./_harness.js');
const fs = require('fs');
const T = JSON.parse(fs.readFileSync(BASE + '/tables/taskData_json.json', 'utf8'));
const ITEMS = JSON.parse(fs.readFileSync(BASE + '/tables/Item_json.json', 'utf8'));
const byId = {}; ITEMS.forEach(i => byId[Number(i.id)] = i);

boot({ stubs: g => {
  g.Tabikaeru.DataManager = { instance: () => ({
    ItemDB: { get: id => byId[Number(id)] || null, list: () => ITEMS },
    TaskDB: { get: k => T[k] || null },
    calendarData: { get: () => ({ 1: { item_id: 1000, num: 1 } }) }
  }) };
}});
const st = global.MOCK_STATE || (global.MOCK_STATE = {});
const S = global.MOCK_SEMANTIC, M = global.MockServer;

(async function () {
  st.kitV2 = st.kitV3 = st.kitV4 = st.kitV5 = st.kitGranted = 1;
  st.party = { started: 0, guest: -1, ends: 0 }; st.partyLast = Math.floor(Date.now() / 1000);
  st.tasks = undefined; st.calClaimed = {}; st.newFlag = []; st.travelCount = 0; st.photos = [];
  st.ticket = 0; st.clover = 100; st.house = [];
  st.frog = { status: 0, traveling: false, returnAt: 0 };

  const cal = S['calendar_load']();
  ok(Array.isArray(cal.task_list) && cal.task_list.length > 0, 'calendar_load.task_list 非空 [' + (cal.task_list || []).length + ']');
  ok(cal.task_list.every(t => typeof t.id === 'number' && (t.complete === 0 || t.complete === 1)), '当日任务是 {id,complete}');
  ok(cal.task_list.length === 3 && cal.task_list.every(t => t.id >= 1 && t.id <= 3), '当日任务是客户端写死的那三条 (id 1..3) [' + JSON.stringify(cal.task_list) + ']');
  ok(cal.task_list.every(t => typeof t.pro === 'number'), '每条都带 pro(客户端把它填进 {0})');
  /* 客户端回调: data.task_list[0].complete = !1 —— 空数组会抛, 这里模拟一次 */
  let threw = false;
  try { cal.task_list[0].complete = false; } catch (e) { threw = true; }
  ok(!threw, '客户端的 task_list[0].complete=!1 不会抛异常');
  const today = new Date().getDate();
  ok(cal.st_days.length === 1 && cal.st_days[0].day === today, 'st_days 用"当月第几天"作键(客户端 o=imageList.length) [' + JSON.stringify(cal.st_days) + ']');
  ok(cal.st_days[0].item_id > 0, 'st_days 的 item_id 合法');

  /* 未完成时不能领 */
  ok(S['calendar_get_st_reward']().code === 1, '当日任务没做完时领不了节气奖励');

  /* 把当日任务做完: 分享 1 次 + 当日三叶草 +30 + 抽奖 1 次 */
  M.handle('share_get_reward', { id: 1 });
  st.clover = Number(st.clover) + 40;
  st.gacha = [{ rank: 1, time: Date.now() }];
  const cal2 = S['calendar_load']();
  ok(cal2.task_list.every(t => t.complete === 1), '做完后当日任务全部 complete=1 [' + JSON.stringify(cal2.task_list) + ']');

  const r = S['calendar_get_st_reward']();
  ok(r && r.code === 0, '全部完成后可以领节气奖励 (code=' + (r && r.code) + ')');
  const cal3 = S['calendar_load']();
  ok(cal3.st_days.length === 0, '领过之后 st_days 不再出现(格子图标要消失)');
  ok(S['calendar_load']().st_days.length === 0, '重复 load 也不会又把图标放回来');
  ok(cal3.task_list.every(t => t.complete === 0), '领过之后当日任务不再算完成(红点不能常亮)');
  ok(S['calendar_get_st_reward']().code === 1, '同一天不能重复领');

  console.log(fails() === 0 ? 'ALL CALENDAR-TASK CHECKS PASSED' : (fails() + ' CHECK(S) FAILED'));
  process.exit(fails() === 0 ? 0 : 1);
})();
