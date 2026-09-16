/* partytastetest → partytastetest: 蛋糕派对 (限时活动) 全流程驱动 */
const fs = require('fs');
const BASE = '/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw';
let fail = 0;
function ok(cond, msg) { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) fail++; }

const PC = JSON.parse(fs.readFileSync(BASE + '/tables/PartyCakeData_json.json', 'utf8'));
const CAKE = PC.cake;
const PARTS = Object.keys(CAKE).map(Number).sort((a, b) => a - b);
const ST = { making: 0, make_reward: 1, qa: 2, qa_reward: 3, light: 4, light_reward: 5, complete: 6 };

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
  global.Tabikaeru = { DataManager: { instance: () => ({ partycakeData: { get: k => PC[k] || null } }) }, DataType: { ItemType: {} } };
  ['partycake_load', 'item_load_items'].forEach(n => listeners[n] = [function () {}]);
  delete global.MOCK_STATE; delete global.MOCK_SEMANTIC; global.MockServer = undefined;
  const l = console.log, w = console.warn;
  console.log = () => {}; console.warn = () => {};
  try { eval(fs.readFileSync(BASE + '/new/mock.js', 'utf8')); } finally { console.log = l; console.warn = w; }
  return window.MockServer;
}

(async function () {
  const M = boot();
  const d = M.handle('partycake_load', {});
  const now = Math.floor(Date.now() / 1000);
  for (const k of ['end_time','cream','sugar','pre_cream','pre_sugar','cur_state','part','layers','task_list','share_get'])
    ok(d[k] !== undefined, 'partycake_load.' + k + ' present');
  ok(d.end_time > now, 'end_time in the future so isOpen() is true');
  ok(d.cur_state === ST.making && d.part === 1, 'the party starts at part 1 in the making phase');

  /* drive the whole cake: for every part, make every layer + claim it */
  let makeCount = 0, claimStates = [];
  const cream0 = d.cream, sugar0 = d.sugar;
  for (let guard = 0; guard < 40; guard++) {
    const cur = M.handle('partycake_load', {});
    if (cur.cur_state !== ST.making) break;
    const partCfg = CAKE[String(cur.part)];
    if (!partCfg) break;
    const layerIds = Object.keys(partCfg.layers).map(Number).sort((a, b) => a - b);
    const layer = layerIds.find(l => cur.layers.indexOf(l) < 0);
    if (layer === undefined) break;
    const before = M.handle('partycake_load', {});
    const r = M.handle('partycake_make', { layer: layer });
    ok(r.state === ST.make_reward, 'make(layer ' + layer + ') answers make_reward so the client registers it (' + r.state + ')');
    const after = M.handle('partycake_load', {});
    const cfg = partCfg.layers[String(layer)];
    ok(after.cream === before.cream - Number(cfg.cream) && after.sugar === before.sugar - Number(cfg.sugar),
       'layer ' + layer + ' charged cream/sugar from the real table (' + cfg.cream + '/' + cfg.sugar + ')');
    /* the client refuses a second make while in make_reward */
    ok(M.handle('partycake_make', { layer: layer }).state === ST.make_reward, 'a make during make_reward is a no-op');
    const rw = M.handle('partycake_reward_make', {});
    claimStates.push(rw.state);
    makeCount++;
    if (makeCount > 30) break;
  }
  const done = M.handle('partycake_load', {});
  ok(makeCount === 14, 'the whole cake took 14 layers (' + makeCount + ')');
  ok(done.cur_state === ST.qa, 'after the last part the party moves to the Q&A phase (' + done.cur_state + ')');
  ok(done.cream < cream0 && done.sugar < sugar0, 'cream/sugar were consumed (' + cream0 + '/' + sugar0 + ' -> ' + done.cream + '/' + done.sugar + ')');
  ok((window.MOCK_STATE.house || []).length > 0, 'the layers granted real house items (' + JSON.stringify(window.MOCK_STATE.house) + ')');

  /* qa -> light -> reward -> complete */
  ok(M.handle('partycake_answer', { answer: 0 }).state === ST.qa_reward, 'answer -> qa_reward');
  ok(M.handle('partycake_reward_qa', {}).state === ST.light, 'reward_qa -> light');
  ok(M.handle('partycake_light', {}).state === ST.light_reward, 'light -> light_reward');
  const before = (window.MOCK_STATE.house || []).length;
  ok(M.handle('partycake_reward_light', {}).state === ST.complete, 'reward_light -> complete');
  ok((window.MOCK_STATE.house || []).some(h => h.item_id === Number(PC.light_reward.item_id)),
     'the candle reward item ' + PC.light_reward.item_id + ' was paid out');

  ok(M.handle('partycake_load_mate', {}).pre_cream !== undefined, 'partycake_load_mate answers pre_cream/pre_sugar');
  ok(M.handle('partycake_load_qa', {}).answer !== undefined, 'partycake_load_qa answers answer/reward');
  ok(M.handle('partycake_get_mate', {}).code === 0, 'partycake_get_mate answers code 0');

  window.MOCK_SAVE && window.MOCK_SAVE();
  await new Promise(r => setTimeout(r, 1300));
  ok(!!SERVER_SAVE && !!SERVER_SAVE.cake && SERVER_SAVE.cake.curState === ST.complete, 'the cake state reached the server save');

  console.log('\n' + (fail ? 'FAILED ' + fail + ' check(s)' : 'ALL CHECKS PASSED'));
  process.exit(fail ? 1 : 0);
})();
