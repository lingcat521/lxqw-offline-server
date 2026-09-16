/* greetcardtest: 贺卡 (限时活动) — visible, buyable, sendable, rewarding */
const fs = require('fs');
const BASE = '/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw';
let fail = 0;
function ok(cond, msg) { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) fail++; }

const GC = JSON.parse(fs.readFileSync(BASE + '/tables/greetCard_json.json', 'utf8'));
const BG_IDS = GC.bg_list.map(b => Number(b.id));
const BLESS_IDS = GC.bless.map(b => Number(b.id));

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
  global.Tabikaeru = { DataManager: { instance: () => ({ greetCardData: { get: k => GC[k] || null } }) }, DataType: { ItemType: {} } };
  ['greetcard_load', 'clover_update'].forEach(n => listeners[n] = [function () {}]);
  delete global.MOCK_STATE; delete global.MOCK_SEMANTIC; global.MockServer = undefined;
  const l = console.log, w = console.warn;
  console.log = () => {}; console.warn = () => {};
  try { eval(fs.readFileSync(BASE + '/new/mock.js', 'utf8')); } finally { console.log = l; console.warn = w; }
  return window.MockServer;
}

(async function () {
  const M = boot();
  window.MOCK_STATE.clover = 1000;
  const d = M.handle('greetcard_load', {});
  const now = Math.floor(Date.now() / 1000);
  for (const k of ['end_time','card_info','send_list','get_list','items','task_login','task_share','task_item','can_reward','global_num','new_index','stock_num'])
    ok(d[k] !== undefined, 'greetcard_load.' + k + ' present');
  /* 活动的开启时间由 new/calendar.js 按真实日历决定(9 月这里应该是关的)，
     测试要验证的是活动本身，所以先用 calendar.json 的 force 语义把它打开 */
  ok(d.end_time === 0, 'greetcard 在真实日历(9 月)里是关闭的 (end_time 0)');
  window.MOCK_CALENDAR.cfg.force = ['greetcard'];
  const dForced = M.handle('greetcard_load', {});
  const nowForced = Math.floor(Date.now() / 1000);
  ok(dForced.end_time > nowForced, 'end_time in the future so isOpen() is true');
  ok(d.card_info.tags.length === 3, 'card_info.tags has 3 slots');

  /* buy a background with clover */
  const c0 = window.MOCK_STATE.clover;
  const price = Number(GC.bg_price[0]);
  ok(M.handle('greetcard_buy', { id: BG_IDS[0] }).code === 0, 'greetcard_buy answers code 0');
  ok(window.MOCK_STATE.clover === c0 - price, 'it charged bg_price[0]=' + price + ' clover (' + c0 + ' -> ' + window.MOCK_STATE.clover + ')');
  ok(M.handle('greetcard_load', {}).items.some(x => x.item_id === BG_IDS[0] && x.num === 1), 'the background landed in items');
  window.MOCK_STATE.clover = 0;
  ok(M.handle('greetcard_buy', { id: BG_IDS[1] }).code === 1, 'buying without clover is refused with code 1');
  ok(M.handle('greetcard_buy', { id: 9999 }).code === 1, 'buying an unknown background is refused');
  window.MOCK_STATE.clover = 1000;

  /* compose the card */
  ok(M.handle('greetcard_change_bg', { id: BG_IDS[0] }).code === 0, 'greetcard_change_bg answers code 0');
  ok(M.handle('greetcard_load', {}).card_info.bg === BG_IDS[0], 'card_info.bg is set');
  ok(M.handle('greetcard_change_bless', { id: BLESS_IDS[0] }).code === 0 && M.handle('greetcard_load', {}).card_info.bless === BLESS_IDS[0], 'greetcard_change_bless sets the blessing');
  ok(M.handle('greetcard_change_bless', { id: 9999 }).code === 1, 'an unknown blessing is refused');

  /* send + reward */
  ok(M.handle('greetcard_send', {}).code === 0, 'greetcard_send answers code 0');
  const d2 = M.handle('greetcard_load', {});
  ok(d2.send_list.length === 1 && d2.can_reward === true, 'the card is in send_list and can_reward is on');
  ok(d2.card_info.bg === 0, 'the card face resets after sending');
  const cl0 = window.MOCK_STATE.clover;
  const rew = M.handle('greetcard_get_reward', {});
  ok(Array.isArray(rew.list) && rew.list.length > 0, 'greetcard_get_reward answers a non-empty list');
  ok(window.MOCK_STATE.clover > cl0, 'the reward granted clover (' + cl0 + ' -> ' + window.MOCK_STATE.clover + ')');
  ok(M.handle('greetcard_get_reward', {}).list.length === 0, 'claiming twice returns an empty list');

  /* misc */
  ok(M.handle('greetcard_load_count', {}).count > 0, 'greetcard_load_count answers a count');
  ok(M.handle('greetcard_stock', {}).code === 0, 'greetcard_stock answers code 0');
  ok(M.handle('greetcard_get_task_item', {}).list !== undefined, 'greetcard_get_task_item answers list');
  ok(M.handle('greetcard_read_new', {}) !== undefined, 'greetcard_read_new is accepted');

  window.MOCK_SAVE && window.MOCK_SAVE();
  await new Promise(r => setTimeout(r, 1300));
  ok(!!SERVER_SAVE && !!SERVER_SAVE.greet && Array.isArray(SERVER_SAVE.greet.items), 'the greetcard state reached the server save');

  console.log('\n' + (fail ? 'FAILED ' + fail + ' check(s)' : 'ALL CHECKS PASSED'));
  process.exit(fail ? 1 : 0);
})();
