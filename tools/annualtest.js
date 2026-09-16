/* annualtest: run the CLIENT's own 年度回顾 text builder against our payload.
 *
 * The bug: annual_load answered {is_share:false,list:[]} so the review sentences
 * rendered "一共雕刻了undefined个印章 / 完成了undefined个祈愿物".
 * This test extracts AnnualReviewChatPage.childrenCreated() out of main.min.js,
 * executes it for real with our payload, and fails if any produced line contains
 * undefined/NaN or an unsubstituted {0}.
 */
const fs = require('fs');
const BASE = '/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw';
let fail = 0;
function ok(cond, msg) { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) fail++; }

const src = fs.readFileSync(BASE + '/apk/assets/game/js/main.min.js', 'utf8');

/* ---- pull the real chat-page text builder out of the client ---- */
function matchBrace(s, start) {
  let d = 0, k = start;
  while (k < s.length) {
    const c = s[k];
    if (c === '{') d++;
    else if (c === '}') { d--; if (d === 0) return k; }
    else if (c === '"' || c === "'") { const q = c; k++; while (k < s.length && s[k] !== q) { if (s[k] === '\\') k++; k++; } }
    k++;
  }
  return -1;
}
const pageMark = src.indexOf('AnnualReviewChatPageSkin.exml');
ok(pageMark > 0, 'found AnnualReviewChatPage in the client');
const fnMark = src.indexOf('t.prototype.childrenCreated=function(', pageMark);
ok(fnMark > 0, 'found its childrenCreated()');
const bodyStart = src.indexOf('{', fnMark + 't.prototype.childrenCreated=function('.length - 1);
const bodyEnd = matchBrace(src, bodyStart);
const body = src.slice(bodyStart + 1, bodyEnd);
ok(body.length > 500 && body.indexOf('个印章') > 0, 'extracted the text builder (' + body.length + ' chars)');

/* fields the client reads off the answer */
const FIELDS = [...new Set([...body.matchAll(/\bt\.([a-z_][a-z0-9_]*)/g)].map(m => m[1]))].sort();
console.log('  fields read by the review:', FIELDS.join(', '));

/* ---- our mock layers, loaded the way the game loads them ---- */
let SERVER_SAVE = null;
global.XMLHttpRequest = function () {
  this.responseText = ''; this.status = 200;
  this.open = (m, u) => { this.m = m; this.u = String(u); };
  this.setRequestHeader = () => {};
  this.send = (body) => {
    if (this.m === 'POST' && this.u.indexOf('/save') >= 0) { SERVER_SAVE = JSON.parse(body); this.responseText = 'ok'; return; }
    const m = /\/([a-z0-9_.]+\.js|screen\.json)(\?|$)/.exec(this.u);
    if (m) { try { this.responseText = fs.readFileSync(BASE + '/new/' + m[1], 'utf8'); } catch (e) { this.responseText = ''; } return; }
    if (this.u.indexOf('/load') >= 0) { this.responseText = SERVER_SAVE ? JSON.stringify(SERVER_SAVE) : 'no save yet'; return; }
    this.responseText = '';
  };
};
(function boot() {
  global.window = global;
  const listeners = Object.create(null);
  global.core = {
    SocketManage: { prototype: {}, getInstance: () => ({ send() {} }) },
    Socket: { prototype: {} },
    ServiceDispatcher: { getInstance: () => ({ hasEventListener: n => !!listeners[n], dispatchEvent: e => { (listeners[e.type] || []).forEach(f => f(e.data)); } }) },
    Event: function (t, d, p) { this.type = t; this.data = d; this.params = p; },
    Log: { print() {}, warning() {}, error() {} },
    Time: { getServerTime: () => Math.floor(Date.now() / 1000), setServerTime() {} },
    String: { isNullOrEmpty: s => !s || s.length === 0, format: s => s }
  };
  global.ProtocolList = { protocolList: { annual_load: [[], true] } };
  global.egret = { setTimeout: (f, t) => setTimeout(f, t || 0), clearTimeout: id => clearTimeout(id), setInterval: (f, t) => setInterval(f, t), clearInterval: id => clearInterval(id) };
  function WeatherModel() { this.data = { season: 0, hours_type: 0, weather: 0 }; }
  WeatherModel.prototype.getSeasonKey = function () { return this.data.season + '' + this.data.hours_type; };
  global.WeatherModel = WeatherModel; global.MessageModel = function () {}; global.MessageModel.prototype = {};
  const l = console.log, w = console.warn;
  console.log = () => {}; console.warn = () => {};
  try { eval(fs.readFileSync(BASE + '/new/mock.js', 'utf8')); } finally { console.log = l; console.warn = w; }
})();
const M = window.MockServer;

/* ---- a faithful "_{0}" localiser, exactly what the client's _() does ---- */
function i18n(fmt) {
  const args = arguments;
  return String(fmt).replace(/\{(\d+)\}/g, (m, i) => String(args[Number(i) + 1]));
}
const CollectDB = { get: (id) => ({ name: '纪念品#' + id }) };
const sandbox = { core: { DateFormat: { format: () => '2026年01月01日' }, DateFormater: { 'YYYY年MM月DD日': 1 }, String: { getCookie: () => null, setCookie: () => {} } },
  Utils: { setArrayCollection: (list, arr) => { sandbox.chats = arr.map(x => x.text); } },
  Tabikaeru: { DataManager: { instance: () => ({ CollectDB }) } } };

function runClientBuilder(payload) {
  const scope = {
    list: { addEventListener() {}, itemRenderer: null }, scroller: {}, imgArrow: {},
    dispatchEventWith() {}, start() {}, onNext() {}, showChats: [], chats: [],
    data: payload, getModel: () => ({ reportBlog() {} })
  };
  const factory = new Function('_', 'core', 'Utils', 'Tabikaeru', 'eui', 'r', 'e', 't',
    'with(this){ ' + body + ' }');
  function Base() {} Base.prototype.childrenCreated = function () {};
  factory.call(scope, i18n, sandbox.core, sandbox.Utils, sandbox.Tabikaeru, { ScrollPolicy: { OFF: 'off', ON: 'on', AUTO: 'auto' } }, function R() {}, Base, payload);
  return scope.chats.map(c => c.text);
}

/* ---- 1. our payload satisfies every field the client reads ---- */
const payload = M.handle('annual_load', {});
const missing = FIELDS.filter(f => payload[f] === undefined);
ok(missing.length === 0, 'annual_load defines every field the client reads' + (missing.length ? ' -- MISSING: ' + missing.join(',') : ' (' + FIELDS.length + ' fields)'));
const badNums = FIELDS.filter(f => payload[f] !== undefined && typeof payload[f] === 'number' && !isFinite(payload[f]));
ok(badNums.length === 0, 'no NaN/Infinity field' + (badNums.length ? ': ' + badNums.join(',') : ''));
console.log('  payload:', JSON.stringify(payload));

/* ---- 2. the real builder must produce clean text ---- */
let lines = [];
try { lines = runClientBuilder(payload); } catch (e) { ok(false, 'client builder threw: ' + e.message); }
ok(lines.length >= 8, 'client builder produced ' + lines.length + ' chat lines');
const dirty = lines.filter(s => /undefined|NaN|\{[0-9]\}/.test(String(s)));
ok(dirty.length === 0, 'no rendered line contains undefined/NaN/{0}' + (dirty.length ? '\n        ' + dirty.join('\n        ') : ''));
console.log('--- rendered review lines ---');
lines.forEach(s => console.log('   ' + s));

/* ---- 3. reverse check: the OLD stub payload must reproduce the bug ---- */
const oldLines = runClientBuilder({ is_share: false, list: [] });
const oldDirty = oldLines.filter(s => /undefined/.test(String(s)));
ok(oldDirty.length > 0, 'the old stub payload still reproduces "undefined" (proves the test bites): ' + (oldDirty[0] || '').slice(0, 60) + '...');

console.log('\n' + (fail ? 'FAILED ' + fail + ' check(s)' : 'ALL CHECKS PASSED'));
process.exit(fail ? 1 : 0);
