/* capsuletest: 扭蛋机 (限时活动) — visible, payable, table driven */
const fs = require('fs');
const BASE = '/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw';
let fail = 0;
function ok(cond, msg) { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) fail++; }

const CAP = JSON.parse(fs.readFileSync(BASE + '/tables/capsuleData_json.json', 'utf8'));
const REWARD_IDS = Object.keys(CAP.reward).map(k => Number(CAP.reward[k].reward_id));
const MS = {};
for (const k of Object.keys(CAP.num_reward)) MS[Number(CAP.num_reward[k].num)] = CAP.num_reward[k];

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
  /* the client's own capsule table, exactly as DataManager exposes it */
  global.Tabikaeru = { DataManager: { instance: () => ({ capsuleData: { get: k => CAP[k] || null } }) }, DataType: { ItemType: {} } };
  ['item_load_items'].forEach(n => listeners[n] = [function () {}]);
  delete global.MOCK_STATE; delete global.MOCK_SEMANTIC; global.MockServer = undefined;
  const l = console.log, w = console.warn;
  console.log = () => {}; console.warn = () => {};
  try { eval(fs.readFileSync(BASE + '/new/mock.js', 'utf8')); } finally { console.log = l; console.warn = w; }
  return window.MockServer;
}

(async function () {
  const M = boot();
  const d = M.handle('capsule_load', {});
  const now = Math.floor(Date.now() / 1000);
  for (const k of ['end_time', 'coin', 'pre_coin', 'reward_list', 'task_list', 'patch_num']) ok(d[k] !== undefined, 'capsule_load.' + k + ' present');
  ok(d.end_time > now, 'end_time is in the future so isOpen() is true (' + new Date(d.end_time * 1000).toISOString().slice(0, 10) + ')');
  ok(d.coin > 0, 'coin > 0 (' + d.coin + ')');
  ok(d.patch_num === 0, 'patch_num is 0 so the client does not auto-request patches in a loop');

  const r1 = M.handle('capsule_twist', {});
  ok(r1.reward_id > 0, 'capsule_twist answers reward_id > 0 (' + r1.reward_id + ')');
  ok(REWARD_IDS.indexOf(Number(r1.reward_id)) >= 0, 'the reward id exists in the real capsuleData.reward table');
  const d2 = M.handle('capsule_load', {});
  ok(d2.coin === d.coin - 1, 'one twist consumed one coin (' + d.coin + ' -> ' + d2.coin + ')');
  ok(d2.reward_list.length === 1, 'the reward is recorded in reward_list');

  /* milestones pay out server side */
  const before = (window.MOCK_STATE.house || []).slice();
  let guard = 0;
  while (M.handle('capsule_load', {}).reward_list.length < 3 && guard++ < 10) M.handle('capsule_twist', {});
  const ms3 = window.MOCK_STATE.house.find(h => h.item_id === Number(MS[3].item_id));
  ok(!!ms3, 'the 3rd twist paid the milestone item ' + MS[3].item_id + ' into the house (house=' + JSON.stringify(window.MOCK_STATE.house) + ')');

  /* limits */
  window.MOCK_STATE.capsule.coin = 0;
  ok(M.handle('capsule_twist', {}).reward_id === 0, 'no coin -> reward_id 0 (client shows 扭蛋币不够了)');
  window.MOCK_STATE.capsule.coin = 5;
  window.MOCK_STATE.capsule.rewards = new Array(16).fill(101);
  ok(M.handle('capsule_twist', {}).reward_id === 0, '16 rewards -> reward_id 0 (client shows 没有可扭的次数了)');

  /* pre_coin collection */
  window.MOCK_STATE.capsule.rewards = [];
  window.MOCK_STATE.capsule.preCoin = 3;
  const c0 = M.handle('capsule_load', {}).coin;
  ok(M.handle('capsule_get_coin', {}).code === 0, 'capsule_get_coin answers code 0');
  ok(M.handle('capsule_load', {}).coin === c0 + 3, 'pre_coin moved into coin (' + c0 + ' -> ' + (c0 + 3) + ')');

  /* expired -> reopened so the activity stays visible */
  window.MOCK_STATE.capsule.endTime = now - 10;
  ok(M.handle('capsule_load', {}).end_time > Math.floor(Date.now() / 1000), 'an expired capsule activity is reopened');

  window.MOCK_SAVE && window.MOCK_SAVE();
  await new Promise(r => setTimeout(r, 1300));
  ok(!!SERVER_SAVE && !!SERVER_SAVE.capsule && Array.isArray(SERVER_SAVE.capsule.rewards), 'the capsule state reached the server save');

  console.log('\n' + (fail ? 'FAILED ' + fail + ' check(s)' : 'ALL CHECKS PASSED'));
  process.exit(fail ? 1 : 0);
})();
