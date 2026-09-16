/* contract: for EVERY protocol, compare the fields the client's own response
 * handler reads with the fields our mock actually answers.
 *
 * This is the generalised version of the 年度回顾 bug hunt: annual_load answered
 * {is_share:false,list:[]} while AnnualReviewChatPage read 17 fields, so the
 * player read "一共雕刻了undefined个印章". The same shape of bug can hide in any
 * of the ~160 handled protocols, so this walks them all.
 *
 * Method: pull every <proto>=function(e,t){...} out of main.min.js (the client's
 * protocol handlers are named exactly like the protocol), collect e.<field>
 * reads from the first parameter, then diff against M.handle(proto, {}).
 */
const fs = require('fs');
const BASE = '/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw';
const src = fs.readFileSync(BASE + '/apk/assets/game/js/main.min.js', 'utf8');

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
/* protocol list */
const pi = src.indexOf('protocolList={');
const pb = src.slice(pi + 15, matchBrace(src, pi + 14) + 1);
const PROTO = new Set([...pb.matchAll(/([A-Za-z0-9_]+):\[/g)].map(x => x[1]));

/* client handlers: name + first param + body */
const re = /prototype\.([A-Za-z0-9_$]+)=function\(([^)]*)\)\{/g;
const handlers = {};
let m;
while ((m = re.exec(src))) {
  const name = m[1];
  if (!PROTO.has(name)) continue;
  const first = (m[2].split(',')[0] || '').trim();
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(first)) continue;
  const bs = m.index + m[0].length - 1, be = matchBrace(src, bs);
  if (be < 0) continue;
  (handlers[name] = handlers[name] || []).push({ param: first, body: src.slice(bs + 1, be) });
}
const JS_NOISE = new Set(['length','apply','call','prototype','indexOf','forEach','push','slice','map','filter','join','split','replace','toString','hasOwnProperty','constructor','then','catch','charAt','substring','substr','match','test','toFixed','sort','concat','pop','shift','splice','keys','values','getTime','toLowerCase','toUpperCase','trim','search','every','some','reduce','find','includes','valueOf','toJSON','apply','bind','reverse','fill','flat','entries','name','id']);


/* ranges of every nested function body inside a handler body */
function nestedRanges(body) {
  const out = [];
  const re = /function\s*[A-Za-z0-9_$]*\s*\([^)]*\)\s*\{/g;
  let m;
  while ((m = re.exec(body))) {
    const bs = body.indexOf('{', m.index + m[0].length - 1);
    const be = matchBrace(body, bs);
    if (be > bs) out.push([m.index, be]);
  }
  return out;
}

/* our mock, loaded like the game loads it */
let SERVER_SAVE = null;
global.XMLHttpRequest = function () {
  this.responseText = ''; this.status = 200;
  this.open = (mm, u) => { this.m = mm; this.u = String(u); };
  this.setRequestHeader = () => {};
  this.send = (body) => {
    if (this.m === 'POST' && this.u.indexOf('/save') >= 0) { SERVER_SAVE = JSON.parse(body); this.responseText = 'ok'; return; }
    const f = /\/([a-z0-9_.]+\.js|screen\.json)(\?|$)/.exec(this.u);
    if (f) { try { this.responseText = fs.readFileSync(BASE + '/new/' + f[1], 'utf8'); } catch (e) { this.responseText = ''; } return; }
    if (this.u.indexOf('/load') >= 0) { this.responseText = SERVER_SAVE ? JSON.stringify(SERVER_SAVE) : 'no save yet'; return; }
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

/* ---- compare ---- */
const report = [];
let checked = 0;
for (const name of Object.keys(handlers)) {
  let payload;
  try { payload = M.handle(name, {}); } catch (e) { continue; }
  if (!payload || typeof payload !== 'object' || typeof payload === 'function' || Array.isArray(payload)) continue;
  const keys = new Set(Object.keys(payload));
  const needed = new Set();
  for (const h of handlers[name]) {
    const nested = nestedRanges(h.body);
    const r = new RegExp('\\b' + h.param.replace(/\$/g, '\\$') + '\\.([A-Za-z_$][A-Za-z0-9_$]*)', 'g');
    let mm;
    while ((mm = r.exec(h.body))) {
      const f = mm[1];
      if (JS_NOISE.has(f)) continue;
      /* a read inside a nested function belongs to that callback's own scope
         (wx.checkIsAddedToMyMiniProgram success(e) etc.), not to the payload */
      if (nested.some(([a, b]) => mm.index > a && mm.index < b)) continue;
      needed.add(f);
    }
  }
  if (!needed.size) continue;
  checked++;
  const missing = [...needed].filter(f => !keys.has(f));
  if (missing.length) report.push({ name, missing: missing.sort(), have: [...keys].sort() });
}
report.sort((a, b) => b.missing.length - a.missing.length);
console.log('protocols with a real client handler: ' + checked + ' | with missing fields: ' + report.length);
console.log('');
for (const r of report) {
  console.log((r.name + ' ').padEnd(30) + 'MISSING ' + r.missing.join(', '));
  console.log('  we send: ' + r.have.join(', ').slice(0, 200));
}
process.exit(0);
