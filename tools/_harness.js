/* _harness.js - shared offline harness for the lxqw mock tests.
 * Exports: fs, BASE, ok(), boot(), resCfg(), fails(), clearConfig()
 */
const fs = require('fs');
const BASE = '/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw';
let fails = 0;
function ok(cond, msg) { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) fails++; }
function fails_() { return fails; }
function resCfg() { return JSON.parse(fs.readFileSync(BASE + '/apk/assets/game/resource/China/default.res.json', 'utf8')); }
/* boot loads new/mock.js (which fetches the layer files through the fake XHR) */
function boot(opts) {
  opts = opts || {};
  let SERVER_SAVE = null;
  global.XMLHttpRequest = function () {
    this.responseText = ''; this.status = 200;
    this.open = (m, u) => { this.m = m; this.u = String(u); };
    this.setRequestHeader = () => {};
    this.send = (body) => {
      if (this.m === 'POST' && this.u.indexOf('/save') >= 0) { global.__posts = (global.__posts || 0) + 1; try { SERVER_SAVE = JSON.parse(body); } catch (e) {} this.responseText = 'ok'; return; }
      const f = /\/([a-z0-9_.]+\.js|screen\.json)(\?|$)/.exec(this.u);
      if (f) { try { this.responseText = fs.readFileSync(BASE + '/new/' + f[1], 'utf8'); } catch (e) { this.responseText = ''; } return; }
      if (this.u.indexOf('/load') >= 0) { this.responseText = SERVER_SAVE ? JSON.stringify(SERVER_SAVE) : 'no save yet'; return; }
      this.responseText = '';
    };
  };
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
  global.ProtocolList = { protocolList: {
    item_set_bag_completed: [['completed'], false], item_load_items: [[], true], client_load_role: [[], true],
    item_putin_bag: [['pos', 'id'], true], item_putin_desk: [['pos', 'id'], true], travel_load_note: [[], true],
    album_load_new: [[], true], album_load_by_id_list: [['id_list'], true], clover_update: [[], true],
    travel_load_gift: [[], true], task_client_pro: [['param'], false], item_load_shop_info: [[], true],
    client_load_events: [[], true], notify_new_event: [[], true], client_confirm_event: [[], true],
    story_load: [[], true], story_read_new_story: [[], true]
  } };
  global.egret = { setTimeout: (f, t) => setTimeout(f, t || 0), clearTimeout: id => clearTimeout(id), setInterval: (f, t) => setInterval(f, t), clearInterval: id => clearInterval(id) };
  function WeatherModel() { this.data = { season: 0, hours_type: 0, weather: 0 }; }
  WeatherModel.prototype.getSeasonKey = function () { return this.data.season + '' + this.data.hours_type; };
  global.WeatherModel = WeatherModel; global.MessageModel = function () {}; global.MessageModel.prototype = {};
  global.RechargeModel = function () {}; global.RechargeModel.prototype = {};
  const RESDB = JSON.parse(fs.readFileSync(BASE + '/tables/resources_json.json', 'utf8'));
  global.RES = { getRes: () => null, getResAsync: () => Promise.resolve({}) };
  global.Tabikaeru = {
    getPicturePath: rid => RESDB[String(rid)] || null,
    Game: { instance: () => ({ isHome: (global.MOCK_STATE && global.MOCK_STATE.frog) ? MOCK_STATE.frog.status === 0 : true }) },
    MainInView: opts.MainInView || null
  };
  if (opts.stubs) opts.stubs(global);
  (opts.listeners || ['item_load_items', 'client_load_role', 'travel_load_note', 'album_load_new', 'clover_update',
    'travel_load_gift', 'notify_new_event', 'story_load']).forEach(n => listeners[n] = [function () {}]);
  delete global.MOCK_STATE; delete global.MOCK_SEMANTIC; global.MockServer = undefined;
  const l = console.log, w = console.warn;
  console.log = () => {}; console.warn = () => {};
  try { eval(fs.readFileSync(BASE + ((opts && opts.entry) ? opts.entry : '/new/mock.js'), 'utf8')); } finally { console.log = l; console.warn = w; }
}
module.exports = { fs, BASE, ok, boot, resCfg, fails: fails_ };
