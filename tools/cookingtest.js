/* cookingtest: 每月料理任务 (P2) — progress must track what the player really did */
const fs = require('fs');
const BASE = '/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw';
let fail = 0;
function ok(cond, msg) { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) fail++; }

const TASKS = JSON.parse(fs.readFileSync(BASE + '/tables/cookingTaskData_json.json', 'utf8'));
const COOK = JSON.parse(fs.readFileSync(BASE + '/tables/cookingData_json.json', 'utf8'));
const TASK_IDS = Object.keys(TASKS).map(Number);

let SERVER_SAVE = null;
global.XMLHttpRequest = function () {
  this.responseText = ''; this.status = 200;
  this.open = (m, u) => { this.m = m; this.u = String(u); };
  this.setRequestHeader = () => {};
  this.send = (body) => {
    if (this.m === 'POST' && this.u.indexOf('/save') >= 0) { SERVER_SAVE = JSON.parse(body); this.responseText = 'ok'; return; }
    const f = /\/([a-z0-9_.]+\.js|screen\.json)(\?|$)/.exec(this.u);
    if (f) { try { this.responseText = fs.readFileSync(BASE + '/new/' + f[1], 'utf8'); } catch (e) { this.responseText = ''; } return; }
    if (this.u.indexOf('/load') >= 0) { this.responseText = SERVER_SAVE ? JSON.stringify(SERVER_SAVE) : 'no save'; return; }
    this.responseText = '';
  };
};
function boot() {
  global.window = global;
  const listeners = Object.create(null);
  global.__events = [];
  global.core = {
    SocketManage: { prototype: {}, getInstance: () => ({ send() {} }) }, Socket: { prototype: {} },
    ServiceDispatcher: { getInstance: () => ({ hasEventListener: n => !!listeners[n], dispatchEvent: e => { global.__events.push(e.type); (listeners[e.type] || []).forEach(f => f(e.data)); } }) },
    Event: function (t, d, p) { this.type = t; this.data = d; this.params = p; },
    Log: { print() {}, warning() {}, error() {} },
    Time: { getServerTime: () => Math.floor(Date.now() / 1000), setServerTime() {} },
    String: { isNullOrEmpty: s => !s || s.length === 0, format: s => s }
  };
  global.ProtocolList = { protocolList: {} };
  global.egret = { setTimeout: (f, t) => setTimeout(f, t || 0), clearTimeout: id => clearTimeout(id), setInterval: (f, t) => setInterval(f, t), clearInterval: id => clearInterval(id) };
  function WeatherModel() { this.data = { season: 0, hours_type: 0, weather: 0 }; }
  WeatherModel.prototype.getSeasonKey = function () { return this.data.season + '' + this.data.hours_type; };
  global.WeatherModel = WeatherModel; global.MessageModel = function () {}; global.MessageModel.prototype = {};
  global.RechargeModel = function () {}; global.RechargeModel.prototype = {};
  /* the client's own cooking table: month -> {item_id,...} */
  const MONTH_CFG = {};
  for (const k of Object.keys(COOK)) MONTH_CFG[Number(COOK[k].month)] = COOK[k];
  global.Tabikaeru = { DataManager: { instance: () => ({ CookingDB: { get: m => MONTH_CFG[m] || null }, CookingTaskDB: { get: id => TASKS[String(id)] || null } }) }, DataType: { ItemType: {} } };
  ['cooking_load_cooking', 'cooking_task_update'].forEach(n => listeners[n] = [function () {}]);
  delete global.MOCK_STATE; delete global.MOCK_SEMANTIC; global.MockServer = undefined;
  const l = console.log, w = console.warn;
  console.log = () => {}; console.warn = () => {};
  try { eval(fs.readFileSync(BASE + '/new/mock.js', 'utf8')); } finally { console.log = l; console.warn = w; }
  return window.MockServer;
}

(async function () {
  const M = boot();
  const d = M.handle('cooking_load_cooking', {});
  for (const k of ['month', 'month_pro', 'week', 'complete', 'select', 'refresh_time', 'task_list']) {
    ok(d[k] !== undefined, 'serverData.' + k + ' is present');
  }
  ok(d.month >= 1 && d.month <= 12, 'month is the real month (' + d.month + ')');
  ok(d.task_list.length === 6, 'six tasks for the month (' + d.task_list.length + ')');
  ok(d.task_list.every(t => TASK_IDS.indexOf(Number(t.id)) >= 0), 'every task id exists in the real cookingTaskData table');
  ok(d.task_list.every(t => typeof t.pro === 'number' && typeof t.complete === 'number'), 'every task carries pro + complete (the progress bar reads them)');
  ok((COOK[String(d.month)] || {}).task_num === 6, 'cookingData[' + d.month + '].task_num matches the list length');
  ok(d.task_list[0].pro === TASKS['1'].state, '吃 type1(每周登录) 自动达成 (' + d.task_list[0].pro + ')');

  /* the counters we can observe really move the bars */
  window.MOCK_STATE.travelCount = (window.MOCK_STATE.travelCount || 0) + 1;   /* task 5 */
  window.MOCK_STATE.photos = (window.MOCK_STATE.photos || []).concat([{ id: 9, pic_id: 100 }]); /* task 6 */
  window.MOCK_STATE.clover = (window.MOCK_STATE.clover || 0) + 80;            /* task 4 */
  const d2 = M.handle('cooking_load_cooking', {});
  ok(d2.task_list.find(t => t.id === 5).pro >= 1, 'task 5 (旅行) progressed from travelCount');
  ok(d2.task_list.find(t => t.id === 6).pro >= 1, 'task 6 (照片) progressed from the album');
  ok(d2.task_list.find(t => t.id === 4).pro === TASKS['4'].state, 'task 4 (累计80三叶草) reached its target');

  /* claim a finished task */
  const before = M.handle('cooking_load_cooking', {}).month_pro;
  const r = M.handle('cooking_complete_task', { id: 5 });
  ok(r.code === 0, 'cooking_complete_task answers code 0 for a finished task');
  ok(M.handle('cooking_load_cooking', {}).month_pro === before + 1, 'month_pro advanced');
  ok(M.handle('cooking_complete_task', { id: 5 }).code === 1, 'claiming twice is refused');

  /* refresh resets one task */
  const rf = M.handle('cooking_refresh_task', { id: 6 });
  ok(rf.task && rf.task.id === 6 && rf.task.pro === 0 && rf.task.complete === 0, 'cooking_refresh_task returns the reset entry');

  /* 开始料理 needs every task done */
  const wrong = M.handle('cooking_start_cooking', {});
  ok(wrong.code === 1, 'cooking_start_cooking refuses while tasks are open');
  for (const t of M.handle('cooking_load_cooking', {}).task_list) {
    window.MOCK_STATE.cooking.tasks.find(x => x.id === t.id).complete = 1;
  }
  const s = M.handle('cooking_start_cooking', {});
  ok(s.code === 0, 'cooking_start_cooking answers code 0 when all tasks are done');
  ok(M.handle('cooking_load_cooking', {}).complete === true, 'the month is marked complete');
  ok(s.item_id === COOK[String(d.month)].item_id, 'the dish item id matches cookingData[' + d.month + '].item_id (' + s.item_id + ')');

  /* select + ad/share bumps */
  ok(M.handle('cooking_select', { index: 2 }).code === 0 && M.handle('cooking_load_cooking', {}).select === 2, 'cooking_select switches the recipe');
  M.handle('cooking_look_ad', {});
  const d3 = M.handle('cooking_load_cooking', {});
  ok(d3.task_list.find(t => t.id === 2).pro >= 1, 'cooking_look_ad bumps the 看广告 task');

  window.MOCK_SAVE && window.MOCK_SAVE();
  /* persist.js 的 MOCK_SAVE 是"去抖 + 4 秒强制 flush"(SAVE_MAX_DELAY=4000), 所以这里要等 >4 秒 */
  await new Promise(r => setTimeout(r, 4600));
  ok(!!SERVER_SAVE && !!SERVER_SAVE.cooking && Array.isArray(SERVER_SAVE.cooking.tasks), 'the cooking state reached the server save');

  console.log('\n' + (fail ? 'FAILED ' + fail + ' check(s)' : 'ALL CHECKS PASSED'));
  process.exit(fail ? 1 : 0);
})();
