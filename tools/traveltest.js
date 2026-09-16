/* traveltest: the whole 出行/笔记 loop, offline and evidence based.
 *
 * Root cause it pins down: the client's ONLY departure trigger is the 准备 button
 *   Bag.setImageLock -> ItemModel.setBagLock(true) -> send("item_set_bag_completed", null, true)
 * (there is no travel_depart* protocol in ProtocolList), and our mock had no
 * handler for it - the device log was full of "NO-HANDLER item_set_bag_completed"
 * while the frog never left. It also checks that every note the server sends can
 * actually be drawn: note id must exist in the real Note table and every word id
 * in its info must exist in the real Word table with an img.
 */
const fs = require('fs');
const BASE = '/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw';
let fail = 0;
function ok(cond, msg) { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) fail++; }

const NOTE_DB = JSON.parse(fs.readFileSync(BASE + '/tables/Note_json.json', 'utf8'));
const WORD_DB = JSON.parse(fs.readFileSync(BASE + '/tables/Word_json.json', 'utf8'));
function noteCfg(id) { return NOTE_DB[String(id)]; }
function wordCfg(id) { return WORD_DB[String(id)]; }

let SERVER_SAVE = null;
global.XMLHttpRequest = function () {
  this.responseText = ''; this.status = 200;
  this.open = (m, u) => { this.m = m; this.u = String(u); };
  this.setRequestHeader = () => {};
  this.send = (body) => {
    if (this.m === 'POST' && this.u.indexOf('/save') >= 0) { SERVER_SAVE = JSON.parse(body); this.responseText = 'ok'; return; }
    const f = /\/([a-z0-9_.]+\.js|screen\.json)(\?|$)/.exec(this.u);
    if (f) { try { this.responseText = fs.readFileSync(BASE + '/new/' + f[1], 'utf8'); } catch (e) { this.responseText = ''; } return; }
    if (this.u.indexOf('/load') >= 0) { this.responseText = SERVER_SAVE ? JSON.stringify(SERVER_SAVE) : 'no save yet'; return; }
    this.responseText = '';
  };
};
(function boot() {
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
    item_putin_bag: [['pos', 'id'], true], travel_load_note: [[], true], album_load_new: [[], true],
    clover_update: [[], true], travel_load_gift: [[], true], task_client_pro: [['param'], false], item_load_shop_info: [[], true]
  } };
  global.egret = { setTimeout: (f, t) => setTimeout(f, t || 0), clearTimeout: id => clearTimeout(id), setInterval: (f, t) => setInterval(f, t), clearInterval: id => clearInterval(id) };
  function WeatherModel() { this.data = { season: 0, hours_type: 0, weather: 0 }; }
  WeatherModel.prototype.getSeasonKey = function () { return this.data.season + '' + this.data.hours_type; };
  global.WeatherModel = WeatherModel; global.MessageModel = function () {}; global.MessageModel.prototype = {};
  global.RechargeModel = function () {}; global.RechargeModel.prototype = {};
  ['item_load_items', 'client_load_role', 'travel_load_note', 'album_load_new', 'clover_update', 'travel_load_gift'].forEach(n => listeners[n] = [function () {}]);
  delete global.MOCK_STATE; delete global.MOCK_SEMANTIC; global.MockServer = undefined;
  const l = console.log, w = console.warn;
  console.log = () => {}; console.warn = () => {};
  try { eval(fs.readFileSync(BASE + '/new/mock.js', 'utf8')); } finally { console.log = l; console.warn = w; }
})();
const M = window.MockServer;
const SM = core.SocketManage.prototype;

(async function () {
  /* fast return so the test does not sit for the real 90s */
  window.MOCK_STATE.travelSeconds = 0.4;

  /* the client only enables 准备 once a lunchbox + amulet are in the bag */
  M.handle('item_putin_bag', { pos: 0, id: 1000 });
  M.handle('item_putin_bag', { pos: 1, id: 2000 });
  const items0 = M.handle('item_load_items', {});
  ok(items0.bag_completed === 0, 'before 准备: bag_completed is 0, the bag is open');

  /* ---- 1. the departure trigger ---- */
  global.__events.length = 0;
  SM.send('item_set_bag_completed', null, true); window.MOCK_FORCE_DEPART();   /* 准备只提升"想法", 出发由它自己决定; 测试里强制 */
  await new Promise(r => setTimeout(r, 200));
  const role = M.handle('client_load_role', {});
  ok(role.frog.status === 1, 'after 准备: frog.status = 1 (travelling), was ' + role.frog.status);
  ok(M.handle('item_load_items', {}).bag_completed === 1, 'after 准备: bag_completed = 1 so the UI locks the bag');
  ok(global.__events.indexOf('client_load_role') >= 0, 'client_load_role was pushed to the client');
  ok(global.__events.indexOf('item_load_items') >= 0, 'item_load_items was pushed to the client');
  ok(window.MOCK_STATE.travelCount >= 1, 'the trip counter advanced (travelCount=' + window.MOCK_STATE.travelCount + ')');
  console.log('   pushed: ' + global.__events.join(' '));

  /* ---- 2. the return ---- */
  const notes0 = window.MOCK_STATE.notes.length, pics0 = window.MOCK_STATE.photos.length, clover0 = window.MOCK_STATE.clover;
  global.__events.length = 0;
  await new Promise(r => setTimeout(r, 5200));      /* rules.js polls every 4s */
  const role2 = M.handle('client_load_role', {});
  ok(role2.frog.status === 0, 'after the trip: frog.status = 0 (home), was ' + role2.frog.status);
  ok(M.handle('item_load_items', {}).bag_completed === 0, 'after the trip: the bag unlocks again');
  ok(window.MOCK_STATE.notes.length > notes0, 'a new travel note arrived (' + notes0 + ' -> ' + window.MOCK_STATE.notes.length + ')');
  ok(window.MOCK_STATE.photos.length === pics0 + 1, 'a new postcard arrived (' + pics0 + ' -> ' + window.MOCK_STATE.photos.length + ')');
  ok(window.MOCK_STATE.clover > clover0, 'the trip brought clover back (' + clover0 + ' -> ' + window.MOCK_STATE.clover + ')');
  for (const n of ['travel_load_note', 'client_load_role', 'album_load_new', 'clover_update']) {
    ok(global.__events.indexOf(n) >= 0, 'the return pushed ' + n);
  }

  /* ---- 3. every note we send must be drawable by the client ---- */
  const noteList = M.handle('travel_load_note', {}).note_list;
  ok(Array.isArray(noteList) && noteList.length > 0, 'travel_load_note returns ' + noteList.length + ' notes');
  const badId = [], badWord = [], badImg = [];
  for (const n of noteList) {
    const cfg = noteCfg(n.id);
    if (!cfg) { badId.push(n.id); continue; }
    if (!cfg.img || !cfg.img.index) badImg.push('note ' + n.id + ' has no img');
    if (1 != cfg.quality && 2 != cfg.quality) badImg.push('note ' + n.id + ' quality=' + cfg.quality);
    for (const line of String(cfg.info).split(/[\n\r]+/)) {
      for (const w of line.split(',')) {
        if (w === '') continue;
        const wc = wordCfg(parseInt(w, 10));
        if (!wc) badWord.push(n.id + ':' + w);
        else if (!wc.img || !wc.img.index) badImg.push('word ' + w + ' has no img');
        else if (1 != wc.type && 2 != wc.type) badImg.push('word ' + w + ' type=' + wc.type);
      }
    }
  }
  ok(badId.length === 0, 'every note id exists in the real Note table' + (badId.length ? ': ' + badId.join(',') : ''));
  ok(badWord.length === 0, 'every word id in every note exists in the real Word table' + (badWord.length ? ': ' + badWord.slice(0, 5).join(',') : ''));
  ok(badImg.length === 0, 'every note/word carries a drawable img+type' + (badImg.length ? ': ' + badImg.slice(0, 5).join(',') : ''));

  /* ---- 4. client progress reports are accepted (they used to be NO-HANDLER) ---- */
  SM.send('task_client_pro', null, 'NoteFriend');
  await new Promise(r => setTimeout(r, 60));
  ok(window.MOCK_STATE.clientPro && window.MOCK_STATE.clientPro.NoteFriend === 1, 'task_client_pro is recorded instead of dropped');

  console.log('\n' + (fail ? 'FAILED ' + fail + ' check(s)' : 'ALL CHECKS PASSED'));
  process.exit(fail ? 1 : 0);
})();
