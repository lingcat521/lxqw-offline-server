/* e2eclaim: the player-reported journey, end to end and offline.
 *
 *    finish the tutorial -> claim the 500-clover mail -> REFRESH -> data must survive
 *
 * Faithful simulation: only mock.js is evaluated by hand; every other layer is
 * loaded through mock.js's own XMLHttpRequest loader, and persist.js talks to a
 * fake dev server (GET /load, POST /save). So this covers the real boot path.
 */
const fs = require('fs');
const BASE = '/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw';
let fail = 0;
function ok(cond, msg) { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) fail++; }

let SERVER_SAVE = null;         /* what the dev server has on "disk" */
let lastPosted = null;
function XHR() {
  this.responseText = ''; this.status = 200;
  this.open = (m, u) => { this.m = m; this.u = String(u); };
  this.setRequestHeader = () => {};
  this.send = (body) => {
    if (this.m === 'POST' && this.u.indexOf('/save') >= 0) {
      lastPosted = JSON.parse(body); SERVER_SAVE = lastPosted; this.responseText = 'ok'; return;
    }
    const m = /\/([a-z0-9_]+\.js)(\?|$)/.exec(this.u);
    if (m) { try { this.responseText = fs.readFileSync(BASE + '/new/' + m[1], 'utf8'); } catch (e) { this.responseText = ''; } return; }
    if (this.u.indexOf('/load') >= 0) { this.responseText = SERVER_SAVE ? JSON.stringify(SERVER_SAVE) : 'no save yet'; return; }
    this.responseText = '';
  };
}
global.XMLHttpRequest = XHR;

function boot() {
  global.window = global;
  const listeners = Object.create(null);
  global.__events = [];
  global.core = {
    SocketManage: { prototype: {}, getInstance: () => ({ send() {} }) },
    Socket: { prototype: {} },
    ServiceDispatcher: { getInstance: () => ({
      hasEventListener: n => !!listeners[n],
      dispatchEvent: e => { global.__events.push([e.type, e.data]); (listeners[e.type] || []).forEach(f => f(e.data)); }
    }) },
    Event: function (t, d, p) { this.type = t; this.data = d; this.params = p; },
    Log: { print() {}, warning() {}, error() {} },
    Time: { getServerTime: () => Math.floor(Date.now() / 1000), setServerTime() {} },
    String: { isNullOrEmpty: s => !s || s.length === 0, format: s => s }
  };
  global.ProtocolList = { protocolList: {
    mail_load: [[], true], mail_open: [['id'], false], mail_read: [['id'], false],
    client_set_client: [['client'], false], client_load_role: [[], true], weather_load: [[], true]
  } };
  global.egret = { setTimeout: (f, t) => setTimeout(f, t || 0), clearTimeout: id => clearTimeout(id), setInterval: (f, t) => setInterval(f, t), clearInterval: id => clearInterval(id) };
  function WeatherModel() { this.data = { season: 0, hours_type: 0, weather: 0 }; }
  WeatherModel.prototype.getSeasonKey = function () { return this.data.season + '' + this.data.hours_type; };
  global.WeatherModel = WeatherModel;
  global.MessageModel = function () {}; global.MessageModel.prototype = {};
  /* the client registers these listeners before the server pushes */
  ['clover_update', 'item_update_ticket', 'mail_load', 'client_load_role', 'weather_load'].forEach(n => listeners[n] = [function () {}]);
  delete global.MOCK_STATE; delete global.MOCK_SEMANTIC; global.MockServer = undefined;
  const l = console.log, w = console.warn;
  console.log = () => {}; console.warn = () => {};
  try { eval(fs.readFileSync(BASE + '/new/mock.js', 'utf8')); }
  finally { console.log = l; console.warn = w; }
  return window.MockServer;
}
function guideOf(role) { try { return JSON.parse(role.settings.client).guideStep; } catch (e) { return '<unparseable>'; } }
function mailCount(M) { return (M.handle('mail_load', {}) || []).length; }

(async function () {
  /* ---------- session 1: first launch ---------- */
  let M = boot();
  ok(!!M && M.version && M.version >= '0.20.0', 'boot 1: mock ' + M.version + ' online, ' + Object.keys(window.MOCK_SEMANTIC).length + ' semantic protocols, ' + Object.keys(M.handlers).length + ' handlers');
  const clover0 = window.MOCK_STATE.clover;
  const mails0 = mailCount(M);
  ok(mails0 > 0, 'boot 1: tutorial reward mail is present (' + mails0 + ' mails)');
  M.pushEarly();
  const pushedRole = global.__events.filter(e => e[0] === 'client_load_role').map(e => e[1])[0];
  ok(!!pushedRole, 'boot 1: client_load_role pushed to the client');
  ok(pushedRole && guideOf(pushedRole) === 'Complete', 'boot 1: pushed tutorial state is Complete (got ' + (pushedRole && guideOf(pushedRole)) + ')');
  ok(pushedRole && pushedRole.res.clover_point === clover0, 'boot 1: pushed clover_point is the saved value (' + (pushedRole && pushedRole.res.clover_point) + ')');

  /* ---------- claim the 500-clover mail ---------- */
  core.SocketManage.prototype.send('mail_open', null, 0);
  ok(window.MOCK_STATE.clover === clover0 + 500, 'claim: +500 clover (' + clover0 + ' -> ' + window.MOCK_STATE.clover + ')');
  ok(Array.isArray(window.MOCK_STATE.mailTaken) && window.MOCK_STATE.mailTaken.length === 1, 'claim: mailTaken recorded [' + window.MOCK_STATE.mailTaken + ']');
  ok(mailCount(M) === mails0 - 1, 'claim: the mail disappears from the list');

  /* ---------- the debounced save really reaches the server ---------- */
  await new Promise(r => setTimeout(r, 1400));
  ok(!!lastPosted, 'save: persist.js POSTed the state');
  if (!lastPosted) { console.log('  (no save posted, cannot continue)'); process.exit(1); }
  ok(lastPosted.clover === window.MOCK_STATE.clover, 'save: posted clover ' + lastPosted.clover);
  ok(!!lastPosted.clientSettings && lastPosted.clientSettings.guideStep === 'Complete',
     'save: guideStep is part of the save (clientSettings.guideStep=' + (lastPosted.clientSettings || {}).guideStep + ')');

  /* ---------- session 2: REFRESH ---------- */
  const cloverBefore = lastPosted.clover;
  M = boot();                      /* persist.js restores SERVER_SAVE via GET /load */
  const restored = M.handle('client_load_role', {});
  ok(restored.res.clover_point === cloverBefore, 'refresh: clover survived (' + restored.res.clover_point + ')');
  ok(guideOf(restored) === 'Complete', 'refresh: still Complete, NOT back to the beginner tutorial (got ' + guideOf(restored) + ')');
  ok(mailCount(M) === mails0 - 1, 'refresh: the claimed mail stays claimed');
  ok(window.MOCK_STATE.clover === cloverBefore, 'refresh: live state matches the save');
  M.pushEarly();
  const role2 = global.__events.filter(e => e[0] === 'client_load_role').map(e => e[1])[0];
  ok(!!role2 && guideOf(role2) === 'Complete', 'refresh: what is pushed to the client is Complete (got ' + (role2 && guideOf(role2)) + ')');

  console.log('\n' + (fail ? 'FAILED ' + fail + ' check(s)' : 'ALL CHECKS PASSED'));
  process.exit(fail ? 1 : 0);
})();
