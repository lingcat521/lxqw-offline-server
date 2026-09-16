/* rechargetest: the 充值 pages must only send rows the client can actually draw,
 * and 浇水/兑换/礼包 must really move the state.
 *
 * Everything is checked against the client's own definitions:
 *   - RechargeFieldItem.points  = the clover layouts the designer made (one per tier)
 *   - default.res.json          = the btn_pay icons that actually exist
 *   - RechargeGiftPage.updateGift/switchGift = the 礼包 row contract
 */
const fs = require('fs');
const BASE = '/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw';
let fail = 0;
function ok(cond, msg) { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) fail++; }

const main = fs.readFileSync(BASE + '/apk/assets/game/js/main.min.js', 'utf8');
const resText = fs.readFileSync(BASE + '/apk/assets/game/resource/China/default.res.json', 'utf8');
const PAY_ICONS = [...new Set((resText.match(/btn_pay_[0-9]+/g) || []))].map(s => Number(s.replace('btn_pay_', ''))).sort((a, b) => a - b);
const rechargeJson = JSON.parse(fs.readFileSync(BASE + '/tables/recharge_json.json', 'utf8'));
const DB = {};
for (const p of rechargeJson) DB[p.id] = p;

/* the clover layouts the client ships: one per 三叶草田 tier */
const rfi = main.indexOf('var RechargeFieldItem=');
const seg = main.slice(rfi, rfi + 9000);
const pj = seg.indexOf('points=');
const LAYOUT_IDS = [...new Set([...seg.slice(pj, pj + 9000).matchAll(/([0-9]+):\[\[/g)].map(m => Number(m[1])))].sort((a, b) => a - b);

let SERVER_SAVE = null, lastPosted = null;
global.XMLHttpRequest = function () {
  this.responseText = ''; this.status = 200;
  this.open = (m, u) => { this.m = m; this.u = String(u); };
  this.setRequestHeader = () => {};
  this.send = (body) => {
    if (this.m === 'POST' && this.u.indexOf('/save') >= 0) { lastPosted = JSON.parse(body); SERVER_SAVE = lastPosted; this.responseText = 'ok'; return; }
    const m = /\/([a-z0-9_.]+\.js|screen\.json)(\?|$)/.exec(this.u);
    if (m) { try { this.responseText = fs.readFileSync(BASE + '/new/' + m[1], 'utf8'); } catch (e) { this.responseText = ''; } return; }
    if (this.u.indexOf('/load') >= 0) { this.responseText = SERVER_SAVE ? JSON.stringify(SERVER_SAVE) : 'no save yet'; return; }
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
  global.ProtocolList = { protocolList: {
    recharge_load: [[], true], recharge_load_gift: [[], true], recharge_update_num: [[], true],
    recharge_water: [[], true], recharge_change: [[], true], recharge_ready_pay: [['id'], true],
    recharge_cancel_pay: [['id'], false], clover_update: [[], true]
  } };
  global.egret = { setTimeout: (f, t) => setTimeout(f, t || 0), clearTimeout: id => clearTimeout(id), setInterval: (f, t) => setInterval(f, t), clearInterval: id => clearInterval(id) };
  function WeatherModel() { this.data = { season: 0, hours_type: 0, weather: 0 }; }
  WeatherModel.prototype.getSeasonKey = function () { return this.data.season + '' + this.data.hours_type; };
  global.WeatherModel = WeatherModel;
  global.MessageModel = function () {}; global.MessageModel.prototype = {};
  global.RechargeModel = function () {}; global.RechargeModel.prototype = { pay: function () { throw new Error('native pay reached'); } };
  ['clover_update', 'recharge_load', 'recharge_update_num', 'recharge_load_gift'].forEach(n => listeners[n] = [function () {}]);
  delete global.MOCK_STATE; delete global.MOCK_SEMANTIC; global.MockServer = undefined;
  const l = console.log, w = console.warn;
  console.log = () => {}; console.warn = () => {};
  try { eval(fs.readFileSync(BASE + '/new/mock.js', 'utf8')); } finally { console.log = l; console.warn = w; }
  return window.MockServer;
}

(async function () {
  const M = boot();
  const SM = core.SocketManage.prototype;
  console.log('price icons shipped:', PAY_ICONS.join(',') , '| clover layouts shipped:', LAYOUT_IDS.join(','));

  /* ---------- 1. the field page must show exactly the tiers the client drew layouts for ---------- */
  const load = M.handle('recharge_load', {});
  const fieldIds = load.field.map(f => f.id).sort((a, b) => a - b);
  ok(JSON.stringify(fieldIds) === JSON.stringify(LAYOUT_IDS),
     'field[] is exactly the tiers the client has clover layouts for: ' + fieldIds.join(',') + ' (client ships ' + LAYOUT_IDS.join(',') + ')');
  ok(load.field.length === LAYOUT_IDS.length, 'no extra clover rows (' + load.field.length + ' rows)');
  ok(load.sack.length === load.field.length, 'sack[] mirrors the same tiers');
  let badIcon = [];
  for (const rows of [load.field, load.sack]) for (const r of rows) {
    if (!DB[r.id]) badIcon.push('id ' + r.id + ' not in rechargeDB');
    else if (PAY_ICONS.indexOf(Number(DB[r.id].money)) < 0) badIcon.push(r.id + ' (¥' + DB[r.id].money + ')');
  }
  ok(badIcon.length === 0, 'every row has a btn_pay icon in default.res.json' + (badIcon.length ? ': ' + badIcon.join(',') : ''));
  ok(load.field.every(f => typeof f.grow === 'number' && typeof f.total === 'number' && f.total > 0), 'every field row has grow+total');
  ok(Number(DB[1].money) === 6 && Number(DB[3].money) === 18 && Number(DB[4].money) === 25, 'the three tiers are ¥6 / ¥18 / ¥25 (400 / 1800 / 2800 clover)');
  ok(load.water <= 20 && load.change <= 20, 'water/change are charge counters (' + load.water + '/' + load.change + '), not clover');

  /* ---------- 2. the 礼包 page ---------- */
  const gift = M.handle('recharge_load_gift', {});
  const now = Math.floor(Date.now() / 1000);
  ok(Array.isArray(gift.gift) && gift.gift.length === 2, 'two 特惠礼包 rows (' + gift.gift.length + ')');
  ok(gift.gift.every(g => g.time - 1 > now), 'every gift has a future e.time, otherwise switchGift() leaves the page masked');
  ok(gift.gift.every(g => DB[g.id] && PAY_ICONS.indexOf(Number(DB[g.id].money)) >= 0), 'gift ids exist in rechargeDB and have price icons (¥1 / ¥3)');
  ok(gift.gift.every(g => typeof g.water === 'number' && typeof g.change === 'number' && Array.isArray(g.goods)), 'gift rows carry water/change/goods for updateGift()');

  /* ---------- 3. 浇水 pushes the new growth BEFORE it answers ---------- */
  global.__events.length = 0;
  let cbOrder = -1;
  SM.send('recharge_water', { apply: function () { cbOrder = global.__events.length; }, execute: function () { cbOrder = global.__events.length; } });
  await new Promise(r => setTimeout(r, 250));
  const loadIdx = global.__events.indexOf('recharge_load');
  ok(loadIdx >= 0 && cbOrder >= 0 && loadIdx < cbOrder, 'recharge_load pushed BEFORE the callback (' + loadIdx + ' < ' + cbOrder + ')');
  const after1 = M.handle('recharge_load', {});
  ok(after1.field.some(f => f.grow > 0), '浇水 advanced the fields: ' + JSON.stringify(after1.field.map(f => f.grow)));
  /* 浇水 is an in-app-purchase feature we ship as free (FREE_WATER in new/iap.js), so the
     charge must NOT go down - the old assertion pinned the paying behaviour. */
  ok(after1.water === load.water, '浇水 does not consume a charge (free IAP build): ' + load.water + ' -> ' + after1.water);

  /* ---------- 4. maturity -> goods -> 兑换 -> clover ---------- */
  let guard = 0;
  while (guard++ < 40) {
    const s = M.handle('recharge_load', {});
    if (s.sack.some(x => x.goods.length > 0)) break;
    SM.send('recharge_water', null);
    await new Promise(r => setTimeout(r, 6));
  }
  const withGoods = M.handle('recharge_load', {});
  const rows = withGoods.sack.filter(s => s.goods.length > 0);
  ok(rows.length > 0, 'a matured field delivers goods into its sack row (' + rows.length + ')');
  const gain = rows.reduce((a, s) => a + s.goods.reduce((b, g) => b + g.num, 0), 0);
  const before = window.MOCK_STATE.clover;
  SM.send('recharge_change', null);
  await new Promise(r => setTimeout(r, 120));
  ok(window.MOCK_STATE.clover === before + gain, '兑换 converted goods into clover (+' + gain + ' -> ' + window.MOCK_STATE.clover + ')');
  ok(M.handle('recharge_load', {}).sack.every(s => s.goods.length === 0), '兑换 emptied the goods rows');

  /* ---------- 5. free purchases ---------- */
  const b1 = window.MOCK_STATE.clover;
  RechargeModel.prototype.pay.call({}, 1);
  ok(window.MOCK_STATE.clover === b1 + DB[1].count, 'pay(1) gave ' + DB[1].count + ' clover free (' + b1 + ' -> ' + window.MOCK_STATE.clover + ')');
  const b2 = window.MOCK_STATE.clover, w0 = M.handle('recharge_load', {}).water;
  RechargeModel.prototype.pay.call({}, 5);
  const afterGift = M.handle('recharge_load', {});
  ok(window.MOCK_STATE.clover === b2 + DB[5].count, 'pay(5) gave ' + DB[5].count + ' clover free');
  ok(afterGift.water > w0, 'the 特惠礼包 also granted 浇水 charges (' + w0 + ' -> ' + afterGift.water + ')');

  /* ---------- 6. persisted ---------- */
  await new Promise(r => setTimeout(r, 1300));
  ok(!!lastPosted && !!lastPosted.recharge && typeof lastPosted.recharge.water === 'number', 'recharge state reached the server save');

  console.log('\n' + (fail ? 'FAILED ' + fail + ' check(s)' : 'ALL CHECKS PASSED'));
  process.exit(fail ? 1 : 0);
})();
