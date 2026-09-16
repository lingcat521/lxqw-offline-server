/* coverage: roadmap aid - for every protocol, is it handled, and is the answer
 * rich or an empty placeholder? Core-loop families are printed first. */
const fs = require('fs');
const BASE = '/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw';
const src = fs.readFileSync(BASE + '/apk/assets/game/js/main.min.js', 'utf8');
function matchBrace(s, start) { let d = 0, k = start; while (k < s.length) { const c = s[k]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return k; } else if (c === '"' || c === "'") { const q = c; k++; while (k < s.length && s[k] !== q) { if (s[k] === '\\') k++; k++; } } k++; } return -1; }
const pi = src.indexOf('protocolList={');
const pb = src.slice(pi + 15, matchBrace(src, pi + 14) + 1);
const PROTO = [...pb.matchAll(/([A-Za-z0-9_]+):\[/g)].map(x => x[1]);

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
(function () {
  global.window = global;
  const listeners = Object.create(null);
  global.core = {
    SocketManage: { prototype: {}, getInstance: () => ({ send() {} }) }, Socket: { prototype: {} },
    ServiceDispatcher: { getInstance: () => ({ hasEventListener: n => !!listeners[n], dispatchEvent: e => { (listeners[e.type] || []).forEach(f => f(e.data)); } }) },
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
  const l = console.log, w = console.warn;
  console.log = () => {}; console.warn = () => {};
  try { eval(fs.readFileSync(BASE + '/new/mock.js', 'utf8')); } finally { console.log = l; console.warn = w; }
})();
const M = window.MockServer;
const S = window.MOCK_SEMANTIC;

function summary(v) {
  if (v === undefined || v === null) return 'null';
  if (typeof v === 'function') return 'PLACEHOLDER';
  if (typeof v !== 'object') return String(v);
  if (Array.isArray(v)) return 'array[' + v.length + ']';
  const keys = Object.keys(v);
  const empty = keys.filter(k => { const x = v[k]; return (Array.isArray(x) && x.length === 0) || x === null || x === undefined || x === 0 || x === '' || x === false; });
  return '{' + keys.length + 'k' + (empty.length === keys.length && keys.length ? ' ALL-EMPTY' : '') + '}';
}
const CORE = ['travel', 'item', 'album', 'clover', 'shop', 'furniture', 'visit', 'client_load_role', 'mail', 'task', 'note'];
const rows = [];
for (const name of PROTO) {
  const handled = (S && S[name] !== undefined) || !!M.handlers[name];
  let desc;
  try { desc = summary(M.handle(name, {})); } catch (e) { desc = 'ERR ' + e.message; }
  rows.push({ name, handled, desc });
}
const coreRows = rows.filter(r => CORE.some(c => r.name.startsWith(c)));
const rest = rows.filter(r => !coreRows.includes(r));
console.log('=== CORE-loop protocols (' + coreRows.length + ') ===');
for (const r of coreRows) console.log((r.name).padEnd(28) + (r.handled ? 'yes' : 'NO ') + '  ' + r.desc);
console.log('');
console.log('=== other protocols with a placeholder/empty answer (' + rest.filter(r => /PLACEHOLDER|ALL-EMPTY|^\{\}$/.test(r.desc)).length + ') ===');
for (const r of rest.filter(r => /PLACEHOLDER|ALL-EMPTY|^\{\}$/.test(r.desc))) console.log((r.name).padEnd(28) + r.desc);
process.exit(0);
