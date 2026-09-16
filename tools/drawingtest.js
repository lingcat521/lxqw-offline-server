/* drawingtest: 绘纸 (P2 最后一块) — 邀请/接包/锁包/产出绘纸的循环 */
const fs = require('fs');
const BASE = '/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw';
let fail = 0;
function ok(cond, msg) { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) fail++; }

const PAGE = JSON.parse(fs.readFileSync(BASE + '/tables/drawingPageData_json.json', 'utf8'));
const COLL = JSON.parse(fs.readFileSync(BASE + '/tables/drawingCollectData_json.json', 'utf8'));
const PAGE_IDS = Object.keys(PAGE).map(Number);
const COLL_IDS = Object.keys(COLL).map(Number);
const DS = { wait: 0, invite: 1, accept: 2, lock: 3, visit: 4 };

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
  const D = { DrawingPage: { list: () => PAGE_IDS.map(id => ({ id: id })) }, DrawingCollect: { list: () => COLL_IDS.map(id => ({ id: id })) } };
  global.Tabikaeru = { DataManager: { instance: () => D }, DataType: { ItemType: {} }, ItemID: { DRAWING_BOOK: 7001 } };
  ['guest_load_drawing', 'item_load_items', 'item_load_handbook'].forEach(n => listeners[n] = [function () {}]);
  delete global.MOCK_STATE; delete global.MOCK_SEMANTIC; global.MockServer = undefined;
  const l = console.log, w = console.warn;
  console.log = () => {}; console.warn = () => {};
  try { eval(fs.readFileSync(BASE + '/new/mock.js', 'utf8')); } finally { console.log = l; console.warn = w; }
  return window.MockServer;
}

(async function () {
  const M = boot();
  /* the activity unlocks through the 友情绘本 */
  ok((window.MOCK_STATE.house || []).some(h => Number(h.item_id) === 7001), 'the 友情绘本 (7001) is in the house so isOpen() is true');

  const d0 = M.handle('guest_load_drawing', {});
  for (const k of ['state','guest','bag','pages','colls','show_coll','pen_motion']) ok(d0[k] !== undefined, 'guest_load_drawing.' + k + ' present');
  ok(d0.pages.length === 0 && d0.colls.length === 0, 'a fresh save starts with no pages/collectibles');

  /* invite arrives on its own */
  window.MOCK_STATE.drawing.nextInvite = Date.now() - 1;
  await new Promise(r => setTimeout(r, 3400));
  const d1 = M.handle('guest_load_drawing', {});
  ok(d1.state === DS.invite, 'a neighbour invited the frog (state=invite, guest=' + d1.guest + ')');
  ok(global.__events.indexOf('guest_load_drawing') >= 0, 'the server pushed guest_load_drawing to the client');

  /* accept -> fill the bag -> lock */
  ok(M.handle('guest_accept_invit', { is_accept: true }).code === 0, 'guest_accept_invit(true) answers code 0');
  ok(M.handle('guest_load_drawing', {}).state === DS.accept, 'state is accept');
  ok(M.handle('guest_putin_bag', { pos: 1, id: 1000 }).code === 0, 'guest_putin_bag answers code 0');
  ok(M.handle('guest_putin_bag', { pos: 9, id: 1000 }).code === 1, 'an out of range slot is refused');
  ok(M.handle('guest_load_drawing', {}).bag[0] === 1000, 'the bag holds the item');
  ok(M.handle('guest_takeout_bag', { pos: 1 }).code === 0 && M.handle('guest_load_drawing', {}).bag[0] === -1, 'guest_takeout_bag clears the slot');
  /* 原版流程: 邀约卡片在"手信面板的邀约槽"里 + 手信(bag[0])放好 + 点「准备」才出发。
     所以先把手信放回去, 再锁定 -> code 0。 */
  ok(M.handle('guest_lock_bag', {}).code === 1, '没放手信时点准备 -> code 1(不出发)');
  ok(M.handle('guest_putin_bag', { pos: 1, id: 1000 }).code === 0, '把手信放回第一格');
  ok(M.handle('guest_lock_bag', {}).code === 0, 'guest_lock_bag answers code 0');
  ok(M.handle('guest_load_drawing', {}).state === DS.lock, 'state is lock (the neighbour is drawing)');

  /* the drawing finishes -> a page + a collectible */
  window.MOCK_STATE.drawing.lockUntil = Date.now() - 1;
  await new Promise(r => setTimeout(r, 3400));
  const d2 = M.handle('guest_load_drawing', {});
  ok(d2.pages.length === 1, 'a 绘纸 page was produced (' + JSON.stringify(d2.pages) + ')');
  ok(PAGE_IDS.indexOf(Number(d2.pages[0])) >= 0, 'the page id exists in the real drawingPageData table');
  ok(d2.colls.length === 1 && COLL_IDS.indexOf(Number(d2.colls[0])) >= 0, 'the collectible id exists in the real drawingCollectData table');
  ok(d2.state === DS.wait && d2.guest === -1, 'the loop resets to wait');
  ok((window.MOCK_STATE.collections || []).indexOf(Number(d2.colls[0])) >= 0, 'the collectible also unlocked in the 图鉴');

  /* declining returns to wait */
  window.MOCK_STATE.drawing.nextInvite = Date.now() - 1;
  await new Promise(r => setTimeout(r, 3400));
  ok(M.handle('guest_load_drawing', {}).state === DS.invite, 'another invitation arrives');
  ok(M.handle('guest_accept_invit', { is_accept: false }).code === 0, 'declining answers code 0');
  ok(M.handle('guest_load_drawing', {}).state === DS.wait, 'declining returns to wait');

  /* fire-and-forget guest protocols */
  ok(M.handle('guest_confirm', { id: 1 }) !== undefined, 'guest_confirm is accepted');
  ok(M.handle('guest_serve', { id: 1, item: 1000 }) !== undefined, 'guest_serve is accepted');
  ok(M.handle('guest_finish', {}) !== undefined, 'guest_finish is accepted');

  window.MOCK_SAVE && window.MOCK_SAVE();
  await new Promise(r => setTimeout(r, 1300));
  ok(!!SERVER_SAVE && !!SERVER_SAVE.drawing && Array.isArray(SERVER_SAVE.drawing.pages), 'the drawing state reached the server save');

  console.log('\n' + (fail ? 'FAILED ' + fail + ' check(s)' : 'ALL CHECKS PASSED'));
  process.exit(fail ? 1 : 0);
})();
