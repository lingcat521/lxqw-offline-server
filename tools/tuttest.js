/* tuttest: the beginner-tutorial loop must NOT come back after a refresh.
 *
 * Real bug (v0.19): Mock.pushEarly() called Mock.handlers["client_load_role"]
 * directly, bypassing MOCK_SEMANTIC. The stub sends settings.client = "{}",
 * so the client kept SettingsInfo.guideStep = GuideStep.New on EVERY launch:
 * finish tutorial -> claim the 500-clover mail -> refresh -> tutorial again.
 *
 * Checks (all offline, real layer files):
 *   1. the pushed client_load_role carries a usable settings.client (Complete)
 *   2. client_set_client is persisted server-side and survives a "refresh"
 *   3. a write arriving before the role push cannot clobber the save
 *   4. a legacy/partial save is repaired instead of resetting the tutorial
 */
const fs = require('fs');
const BASE = '/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw';
let fail = 0;
function ok(cond, msg) { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) fail++; }

function stubs() {
  global.window = global;
  global.__events = [];
  const auto = new Proxy(function(){ return auto; }, {
    get(t, k) { if (k === 'then') return undefined; if (k === 'prototype') return t.prototype;
      if (typeof k === 'symbol') return undefined; if (k === 'toJSON') return () => null;
      if (k === 'valueOf') return () => 0; if (k === 'toString') return () => '';
      if (k === 'length') return 0; if (k === 'constructor') return Object; return auto; },
    set() { return true; }, has() { return true; }, ownKeys() { return []; },
    getOwnPropertyDescriptor() { return undefined; }, apply() { return auto; }, construct() { return auto; }
  });
  global.auto = auto;
  global.core = {
    SocketManage: { prototype: {}, getInstance: () => ({ send() {} }) },
    Socket: { prototype: {} },
    ServiceDispatcher: { getInstance: () => ({
      hasEventListener: () => true,
      dispatchEvent: (e) => { global.__events.push([e.type, e.data]); }
    }) },
    Event: function (t, d) { this.type = t; this.data = d; },
    Log: { print() {}, warning() {}, error() {} },
    Time: { getServerTime: () => Math.floor(Date.now() / 1000), setServerTime() {} },
    String: { isNullOrEmpty: s => !s || s.length === 0, format: s => s },
    ModelManage: { getInstance: () => ({ getModel: () => auto }) },
    PageManage: { getInstance: () => ({ addViewControl() {}, getControl() {}, removeControl() {} }) },
    DisplayManage: { getInstance: () => ({ popup() {} }) },
    MathExtend: { Range: () => 1 }
  };
  global.Utils = { convertArray: x => x, formatPathImage: () => '' };
  global.egret = { setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {} };
  global.ProtocolList = { protocolList: {} };
  global.Tabikaeru = { DataManager: { instance: () => ({}) }, DataType: { ItemType: {} }, DefineExtra: {} };
}

function loadLayers() {
  for (const f of ['semantic.js', 'defaults.js', 'rules.js', 'mock.js']) {
    eval(fs.readFileSync(BASE + '/new/' + f, 'utf8'));
  }
  return window.MockServer;
}
function clientOf(role) { try { return JSON.parse(role.settings.client); } catch (e) { return null; } }
function quiet() { const l = console.log, w = console.warn; console.log = () => {}; console.warn = () => {}; return () => { console.log = l; console.warn = w; }; }

/* ================= 1. fresh boot: pushEarly must carry GuideStep.Complete ================= */
console.log('\n[1] fresh boot (nothing saved yet)');
stubs();
delete global.MOCK_STATE; delete global.MOCK_SEMANTIC;
let M = loadLayers();
const pushed = global.__events;
M.pushEarly();
const early = pushed.find(p => p[0] === 'client_load_role');
ok(!!early, 'pushEarly dispatched client_load_role');
const c1 = early && clientOf(early[1]);
ok(c1 && c1.guideStep === 'Complete', 'pushed settings.client.guideStep === Complete (got ' + (c1 && c1.guideStep) + ')');
ok(early && early[1].res && typeof early[1].res.clover_point === 'number',
   'pushed role carries a numeric clover_point (got ' + (early && early[1].res && early[1].res.clover_point) + ')');
const sem = M.handle('client_load_role', {});
ok(clientOf(sem).guideStep === 'Complete' && clientOf(sem).guideStep === (c1 && c1.guideStep),
   'handled and pushed client_load_role agree (no stub bypass)');

/* ================= 2. the player advances the guide -> survives a refresh ================= */
console.log('\n[2] client_set_client is server state and survives a refresh');
const advanced = Object.assign({}, c1, { guideStep: 'OpenBag', hasOpenedNote: false });
M.handle('client_set_client', { client: JSON.stringify(advanced) });
let back = M.handle('client_load_role', {});
ok(clientOf(back).guideStep === 'Complete', 'server echoed guideStep Complete right after client_set_client (got ' + clientOf(back).guideStep + ')');
ok(window.MOCK_STATE.clientSettings.guideStep === 'Complete', 'MOCK_STATE.clientSettings mutated, so persist.js saves it');

const save = JSON.parse(JSON.stringify(window.MOCK_STATE));
stubs();
global.MOCK_STATE = save;
delete global.MOCK_SEMANTIC;
let q = quiet(); M = loadLayers(); q();
back = M.handle('client_load_role', {});
ok(clientOf(back).guideStep === 'Complete', 'after "refresh" the guide is forced to Complete (tutorial skipped by policy) (got ' + clientOf(back).guideStep + ')');
ok(back.res.clover_point === save.clover, 'after "refresh" clover_point matches the save (' + back.res.clover_point + ')');

/* ================= 3. a pre-role write must not clobber the save ================= */
console.log('\n[3] pre-role write cannot clobber the save');
stubs();
global.MOCK_STATE = JSON.parse(JSON.stringify(save));
delete global.MOCK_SEMANTIC;
q = quiet(); M = loadLayers(); q();
M.handle('client_set_client', { client: JSON.stringify({ guideStep: 'Complete' }) });
back = M.handle('client_load_role', {});
ok(clientOf(back).guideStep === 'Complete', 'guideStep forced to Complete after premature write (got ' + clientOf(back).guideStep + ')');

/* ================= 4. partial / legacy saves are repaired ================= */
console.log('\n[4] partial saves are repaired');
const partial = JSON.parse(JSON.stringify(save));
partial.clientSettings = { hasOpenedNote: true };
stubs();
global.MOCK_STATE = partial;
delete global.MOCK_SEMANTIC;
q = quiet(); M = loadLayers(); q();
back = M.handle('client_load_role', {});
ok(clientOf(back).guideStep === 'Complete', 'missing guideStep repaired to Complete (got ' + clientOf(back).guideStep + ')');
ok(clientOf(back).hasOpenedNote === true, 'saved key kept, defaults only fill the gaps');

console.log('\n' + (fail ? 'FAILED ' + fail + ' check(s)' : 'ALL CHECKS PASSED'));
process.exit(fail ? 1 : 0);
