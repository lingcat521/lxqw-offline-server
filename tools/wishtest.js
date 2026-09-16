/* wishtest: 许愿池 (限时活动) — must be VISIBLE (end_time in the future) and payable */
const fs = require('fs');
const BASE = '/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw';
let fail = 0;
function ok(cond, msg) { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) fail++; }
const ITEM = JSON.parse(fs.readFileSync(BASE + '/tables/Item_json.json', 'utf8'));
const ITEM_IDS = (Array.isArray(ITEM) ? ITEM : Object.values(ITEM)).map(x => x.id);

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
  delete global.MOCK_STATE; delete global.MOCK_SEMANTIC; global.MockServer = undefined;
  const l = console.log, w = console.warn;
  console.log = () => {}; console.warn = () => {};
  try { eval(fs.readFileSync(BASE + '/new/mock.js', 'utf8')); } finally { console.log = l; console.warn = w; }
  return window.MockServer;
}

(async function () {
  const M = boot();
  const d = M.handle('wishingpool_load', {});
  const now = Math.floor(Date.now() / 1000);
  ok(typeof d.end_time === 'number' && d.end_time > now, 'end_time is in the future so the courtyard shows the pool (' + new Date(d.end_time * 1000).toISOString().slice(0, 10) + ')');
  ok(typeof d.coin === 'number' && d.coin > 0, 'coin > 0 so the wish button works (' + d.coin + ')');
  ok(Array.isArray(d.items) && d.items.length > 0, 'items is a non-empty prize list (' + d.items.length + ')');
  ok(d.items.every(x => typeof x.id === 'number' && typeof x.num === 'number' && typeof x.limit === 'number'),
     'every prize has id/num/limit (the client decrements limit and shows num)');
  ok(d.items.every(x => ITEM_IDS.indexOf(Number(x.id)) >= 0), 'every prize id exists in the real Item table');

  const coin0 = d.coin;
  const r = M.handle('wishingpool_wish', {});
  ok(r.id > 0, 'wishingpool_wish answers {id} > 0 (' + r.id + ')');
  ok(ITEM_IDS.indexOf(Number(r.id)) >= 0, 'the granted id is a real item');
  const d2 = M.handle('wishingpool_load', {});
  ok(d2.coin === coin0 - 1, 'one wish consumed one coin (' + coin0 + ' -> ' + d2.coin + ')');
  ok(d2.items.find(x => x.id === r.id).limit === d.items.find(x => x.id === r.id).limit - 1, 'that prize stock went down');

  /* drained pool refuses politely instead of crashing */
  window.MOCK_STATE.wishing.coin = 0;
  ok(M.handle('wishingpool_wish', {}).id === 0, 'with no coins left the wish is refused with id 0');
  window.MOCK_STATE.wishing.coin = 5;
  window.MOCK_STATE.wishing.items.forEach(x => { x.limit = 0; });
  ok(M.handle('wishingpool_wish', {}).id === 0, 'with no stock left the wish is refused too');

  /* expires -> reopened automatically so the activity never disappears */
  window.MOCK_STATE.wishing.endTime = now - 10;
  const d3 = M.handle('wishingpool_load', {});
  ok(d3.end_time > Math.floor(Date.now() / 1000), 'an expired pool is reopened (end_time refreshed)');

  window.MOCK_SAVE && window.MOCK_SAVE();
  await new Promise(r => setTimeout(r, 1300));
  ok(!!SERVER_SAVE && !!SERVER_SAVE.wishing && typeof SERVER_SAVE.wishing.coin === 'number', 'the wishing pool state reached the server save');

  console.log('\n' + (fail ? 'FAILED ' + fail + ' check(s)' : 'ALL CHECKS PASSED'));
  process.exit(fail ? 1 : 0);
})();
