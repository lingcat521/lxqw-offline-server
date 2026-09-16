/* albumtest: 相册管理 + 小屋装饰 (P1 items) */
const fs = require('fs');
const BASE = '/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw';
let fail = 0;
function ok(cond, msg) { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) fail++; }

const DECO = JSON.parse(fs.readFileSync(BASE + '/tables/decoration_json.json', 'utf8'));
const DECO_IDS = Object.keys(DECO).map(Number);

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
  ['album_load', 'album_load_recover', 'client_load_decorate', 'client_load_role'].forEach(n => listeners[n] = [function () {}]);
  delete global.MOCK_STATE; delete global.MOCK_SEMANTIC; global.MockServer = undefined;
  const l = console.log, w = console.warn;
  console.log = () => {}; console.warn = () => {};
  try { eval(fs.readFileSync(BASE + '/new/mock.js', 'utf8')); } finally { console.log = l; console.warn = w; }
  return window.MockServer;
}

(async function () {
  const M = boot();
  /* give the album a couple of postcards like a travelled frog would have */
  window.MOCK_STATE.photos = [{ id: 1, pic_id: 100 }, { id: 2, pic_id: 101 }];
  window.MOCK_STATE.travelCount = 3;

  /* ---- album ---- */
  ok(M.handle('album_load', {}).total === 2, 'album_load reports 2 postcards');
  ok(Array.isArray(M.handle('album_load_recover', {}).pictures), 'album_load_recover answers a pictures array');
  const d = M.handle('album_delete', { id: 1 });
  ok(d.code === 0, 'album_delete answers code 0');
  ok(window.MOCK_STATE.photos.length === 1, 'the postcard left the album (1 left)');
  ok(M.handle('album_load_recover', {}).pictures.length === 1, 'it is now recoverable');
  ok(M.handle('album_recover', { id: 1 }).code === 0 && window.MOCK_STATE.photos.length === 2, 'album_recover puts it back');
  ok(M.handle('album_delete', { id: 999 }).code === 1, 'deleting an unknown id is refused');
  ok(M.handle('album_save_new', { id: 3 }).code === 0, 'album_save_new answers code 0');
  ok(window.MOCK_STATE.photos.some(p => p.id === 3), 'the saved new postcard is in the album');
  ok(M.handle('album_delete_new', { id: 3 }).code === 0 && !window.MOCK_STATE.photos.some(p => p.id === 3), 'album_delete_new drops it again');
  const byIds = M.handle('album_load_by_id_list', { id_list: [1, 2] });
  ok(Array.isArray(byIds.pic_list), 'album_load_by_id_list answers pic_list (layers overlay)');

  /* ---- decorate ---- */
  const dec = M.handle('client_load_decorate', {});
  ok(Array.isArray(dec.has_list) && dec.has_list.length > 0, 'client_load_decorate gives a non-empty has_list (' + dec.has_list.length + ')');
  ok(dec.has_list.every(x => DECO_IDS.indexOf(Number(x.id)) >= 0), 'every decoration id exists in the real decoration table');
  ok(typeof dec.put_id === 'number' && typeof dec.status === 'number', 'put_id / status are present');
  const role = M.handle('client_load_role', {});
  ok(Array.isArray(role.frog.decoration), 'client_load_role.frog.decoration is the same list (' + role.frog.decoration.length + ')');
  const ch = M.handle('client_change_decorate', { id: dec.has_list[1].id });
  ok(ch.code === 0, 'client_change_decorate answers code 0');
  ok(M.handle('client_load_decorate', {}).put_id === dec.has_list[1].id, 'the placed decoration switched to ' + dec.has_list[1].id);
  ok(M.handle('client_change_decorate', { id: 999999 }).code === 1, 'placing an unowned decoration is refused');

  /* ---- persists ---- */
  window.MOCK_SAVE && window.MOCK_SAVE();
  await new Promise(r => setTimeout(r, 4600));   /* persist.js 是"去抖 + 4 秒强制 flush" */
  ok(!!SERVER_SAVE && Array.isArray(SERVER_SAVE.decorations) && SERVER_SAVE.decorations.length > 0, 'decorations reached the server save');
  ok(!!SERVER_SAVE && SERVER_SAVE.decoratePutId === dec.has_list[1].id, 'the placed decoration id is saved');

  console.log('\n' + (fail ? 'FAILED ' + fail + ' check(s)' : 'ALL CHECKS PASSED'));
  process.exit(fail ? 1 : 0);
})();
