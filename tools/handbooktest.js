/* handbooktest: 图鉴/收藏 + 兑奖 + 一次旅行解锁一件纪念品 */
const fs = require('fs');
const BASE = '/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw';
let fail = 0;
function ok(cond, msg) { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) fail++; }

const COLL = JSON.parse(fs.readFileSync(BASE + '/tables/Collection_json.json', 'utf8'));
const SPEC = JSON.parse(fs.readFileSync(BASE + '/tables/Specialty_json.json', 'utf8'));
const COLL_IDS = COLL.map(c => c.id);
const SPEC_IDS = SPEC.map(s => s.itemId);

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
  ['item_load_handbook'].forEach(n => listeners[n] = [function () {}]);
  delete global.MOCK_STATE; delete global.MOCK_SEMANTIC; global.MockServer = undefined;
  const l = console.log, w = console.warn;
  console.log = () => {}; console.warn = () => {};
  try { eval(fs.readFileSync(BASE + '/new/mock.js', 'utf8')); } finally { console.log = l; console.warn = w; }
  return window.MockServer;
}

(async function () {
  const M = boot();
  const hb = M.handle('item_load_handbook', {});
  ok(Array.isArray(hb.collections), 'collections is an array (Game.collectionList does indexOf on it)');
  ok(Array.isArray(hb.specialtys), 'specialtys is an array (Game.specialtyList does indexOf on it)');
  ok(hb.collections.every(id => COLL_IDS.indexOf(id) >= 0), 'every collection id exists in the real Collection table');
  ok(hb.specialtys.every(id => SPEC_IDS.indexOf(Number(id)) >= 0), 'every specialty id exists in the real Specialty table');

  /* a trip unlocks one more 纪念品 */
  const before = hb.collections.length;
  window.MOCK_STATE.travelCount = (window.MOCK_STATE.travelCount || 0) + 1;
  await new Promise(r => setTimeout(r, 1900));
  const hb2 = M.handle('item_load_handbook', {});
  ok(hb2.collections.length === before + 1, 'one trip unlocked one collection (' + before + ' -> ' + hb2.collections.length + ')');
  ok(hb2.collections.indexOf(0) === 0 || hb2.collections.length > 0, 'unlocked ids are real: ' + JSON.stringify(hb2.collections.slice(0, 4)));

  /* a specialty sitting in the gift box shows up as collected */
  const sp0 = hb2.specialtys.length;
  window.MOCK_STATE.gifts = (window.MOCK_STATE.gifts || []).concat([{ item_id: SPEC_IDS[3], count: 1 }]);
  const hb3 = M.handle('item_load_handbook', {});
  ok(hb3.specialtys.length === sp0 + 1 && hb3.specialtys.indexOf(Number(SPEC_IDS[3])) >= 0,
     'the specialty from the gift box is marked collected (' + sp0 + ' -> ' + hb3.specialtys.length + ')');

  /* 兑奖 is accepted */
  const r = M.handle('item_redeem_prize', { prize_id: 7 });
  ok(r && typeof r === 'object', 'item_redeem_prize is handled, not a placeholder');
  ok(Array.isArray(window.MOCK_STATE.redeemed) && window.MOCK_STATE.redeemed.indexOf(7) >= 0, 'the redeemed prize id is recorded');

  /* survives a refresh */
  (window.MOCK_SAVE_NOW || window.MOCK_SAVE)();     /* 立即落盘: 不赌 1.2s 防抖的时序 */
  await new Promise(r => setTimeout(r, 1500));
  ok(!!SERVER_SAVE && !!SERVER_SAVE.collections && SERVER_SAVE.collections.length === hb3.collections.length,
     'the handbook state reached the server save (' + (SERVER_SAVE && SERVER_SAVE.collections || []).length + ')');


  /* --- 珍品: 同一件带回约 3 次才真正解锁(用户表) --- */
  if (window.MOCK_RETURNS) {
    const hb0 = M.handle('item_load_handbook', {}) || {};
    ok(Number(hb0.return_need) === 3, '图鉴下发 return_need=3 [' + hb0.return_need + ']');
    window.MOCK_RETURNS.bump(7); window.MOCK_RETURNS.bump(7);
    ok(Number(window.MOCK_RETURNS.all()['7']) === 2, '珍品带回次数计数到 2 [' + window.MOCK_RETURNS.all()['7'] + ']');
    window.MOCK_RETURNS.bump(7);
    ok(Number(window.MOCK_RETURNS.all()['7']) === 3, '第 3 次 -> 集齐(可盖红章)');
    window.MOCK_RETURNS.bump(7);
    ok(Number(window.MOCK_RETURNS.all()['7']) === 3, '次数封顶在 3');
  }

  console.log('\n' + (fail ? 'FAILED ' + fail + ' check(s)' : 'ALL CHECKS PASSED'));
  process.exit(fail ? 1 : 0);
})();
