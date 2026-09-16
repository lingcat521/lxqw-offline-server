/* lotterytest: 抽奖 (P2) — the page must actually load (phase truthy) and settle */
const fs = require('fs');
const BASE = '/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw';
let fail = 0;
function ok(cond, msg) { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) fail++; }

const LOT = JSON.parse(fs.readFileSync(BASE + '/tables/lotteryData_json.json', 'utf8'));
const NEIGHBOURS = Object.keys(LOT.select_list).map(k => Number(LOT.select_list[k].id));
const ITEM = JSON.parse(fs.readFileSync(BASE + '/tables/Item_json.json', 'utf8'));
const ITEM_IDS = (Array.isArray(ITEM) ? ITEM : Object.values(ITEM)).map(x => Number(x.id));
const LSTATE = { Open: 0, Select: 1, Complete: 2, Reward: 3 };

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
  global.Tabikaeru = { DataManager: { instance: () => ({ lotteryData: { get: k => LOT[k] || null } }) }, DataType: { ItemType: {} } };
  ['lottery_load', 'clover_update', 'item_load_items'].forEach(n => listeners[n] = [function () {}]);
  delete global.MOCK_STATE; delete global.MOCK_SEMANTIC; global.MockServer = undefined;
  const l = console.log, w = console.warn;
  console.log = () => {}; console.warn = () => {};
  try { eval(fs.readFileSync(BASE + '/new/mock.js', 'utf8')); } finally { console.log = l; console.warn = w; }
  return window.MockServer;
}

(async function () {
  const M = boot();
  const d = M.handle('lottery_load', {});
  for (const k of ['last_phase','phase','state','select_list','answer','extra_item','right_flag','egg_num','reward'])
    ok(d[k] !== undefined, 'lottery_load.' + k + ' present');
  ok(d.phase > 0, 'phase is truthy so LotteryModel actually applies the payload (' + d.phase + ')');
  ok(d.state === LSTATE.Open, 'the round starts in Open state');
  ok(d.select_list.length === 4 && d.select_list.every(n => NEIGHBOURS.indexOf(Number(n.id)) >= 0),
     'select_list carries the 4 real neighbours');
  ok(d.select_list.every(n => n.pic && n.name), 'each neighbour has name + pic (the view reads them from the table)');

  /* open -> select -> confirm */
  const open = M.handle('lottery_open', {});
  ok(open.open_item && open.open_item.item_id > 0, 'lottery_open answers open_item (' + JSON.stringify(open.open_item) + ')');
  ok(ITEM_IDS.indexOf(Number(open.open_item.item_id)) >= 0, 'the open item is a real Item id');
  ok(Array.isArray(window.MOCK_STATE.lotteryLog) && window.MOCK_STATE.lotteryLog.some(x => x.kind === 'open'),
     '开局奖励也记进了 lotteryLog (奖池记录)');
  ok(!!open.extra_item, 'extra_item is present (LotteryExtraView reads it)');
  ok(M.handle('lottery_load', {}).state === LSTATE.Select, 'state moved to Select');

  const picks = [0, 1, 2];
  ok(M.handle('lottery_select', { answer: picks }).code === 0, 'lottery_select answers code 0');
  const d2 = M.handle('lottery_load', {});
  ok(d2.answer.length === 3, 'the answer is recorded (' + d2.answer.length + ' picks)');
  ok(d2.right_flag.length === 3 && d2.right_flag.every(x => x), 'right_flag marks every pick as accepted');
  ok(d2.reward.length > 0 && ITEM_IDS.indexOf(Number(d2.reward[0].item_id)) >= 0, 'the reward list holds a real item');
  ok(d2.state === LSTATE.Complete, 'state moved to Complete (the settle text is shown)');
  ok(d2.egg_num > 0, 'egg_num > 0 so the extra flavour text is used');

  const cl0 = Number(window.MOCK_STATE.clover) || 0;
  ok(M.handle('lottery_confirm_reward', {}).code === 0, 'lottery_confirm_reward answers code 0');
  const d3 = M.handle('lottery_load', {});
  ok((Number(window.MOCK_STATE.clover) || 0) > cl0, 'the settle granted clover (' + cl0 + ' -> ' + window.MOCK_STATE.clover + ')');
  ok(Array.isArray(window.MOCK_STATE.lotteryLog) && window.MOCK_STATE.lotteryLog.length >= 1,
     '抽中记录写进 st.lotteryLog (' + (window.MOCK_STATE.lotteryLog || []).length + ' 条)');
  ok(d3.state === LSTATE.Open && d3.answer.length === 0, 'the round resets to Open with an empty answer');
  ok(d3.phase === d.phase + 1 && d3.last_phase === d.phase, 'the phase advanced so the neighbour/background changes next round');
  await new Promise(r => setTimeout(r, 150));
  ok(global.__events.indexOf('lottery_load') >= 0, 'a fresh lottery_load was pushed after settling');

  window.MOCK_SAVE && window.MOCK_SAVE();
  await new Promise(r => setTimeout(r, 1300));
  ok(!!SERVER_SAVE && !!SERVER_SAVE.lottery && SERVER_SAVE.lottery.phase === d3.phase, 'the lottery state reached the server save');

  console.log('\n' + (fail ? 'FAILED ' + fail + ' check(s)' : 'ALL CHECKS PASSED'));
  process.exit(fail ? 1 : 0);
})();
