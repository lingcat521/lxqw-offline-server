/* springcardtest: 春卡 (限时活动) — same protocol family as 贺卡 */
const fs = require('fs');
const BASE = '/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw';
let fail = 0;
function ok(cond, msg) { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) fail++; }

const SC = JSON.parse(fs.readFileSync(BASE + '/tables/springCard_json.json', 'utf8'));
const TAG_IDS = SC.tags.map(t => Number(t.id));
const BG_IDS = SC.bg_list.map(b => Number(b.id));

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
  global.Tabikaeru = { DataManager: { instance: () => ({ springCardData: { get: k => SC[k] || null } }) }, DataType: { ItemType: {} } };
  ['springcard_load', 'clover_update'].forEach(n => listeners[n] = [function () {}]);
  delete global.MOCK_STATE; delete global.MOCK_SEMANTIC; global.MockServer = undefined;
  const l = console.log, w = console.warn;
  console.log = () => {}; console.warn = () => {};
  try { eval(fs.readFileSync(BASE + '/new/mock.js', 'utf8')); } finally { console.log = l; console.warn = w; }
  return window.MockServer;
}

(async function () {
  const M = boot();
  window.MOCK_STATE.clover = 1000;
  const d = M.handle('springcard_load', {});
  const now = Math.floor(Date.now() / 1000);
  for (const k of ['end_time','card_info','items','buy_num','can_buy_num','task_item','share_num','share_get','box_id','share_code','reward_list','global_num'])
    ok(d[k] !== undefined, 'springcard_load.' + k + ' present');
  /* 活动的开启时间由 new/calendar.js 按真实日历决定(9 月这里应该是关的)，
     测试要验证的是活动本身，所以先用 calendar.json 的 force 语义把它打开 */
  ok(d.end_time === 0, 'springcard 在真实日历(9 月)里是关闭的 (end_time 0)');
  window.MOCK_CALENDAR.cfg.force = ['springcard'];
  const dForced = M.handle('springcard_load', {});
  const nowForced = Math.floor(Date.now() / 1000);
  ok(dForced.end_time > nowForced, 'end_time in the future so isOpen() is true');

  /* buy a sticker: costs tags_price clover and returns a real tag id */
  const c0 = window.MOCK_STATE.clover, pr = Number(SC.tags_price);
  const b = M.handle('springcard_buy', {});
  ok(b.tags_id > 0 && TAG_IDS.indexOf(Number(b.tags_id)) >= 0, 'springcard_buy answers a real tags_id (' + b.tags_id + ')');
  ok(window.MOCK_STATE.clover === c0 - pr, 'it charged tags_price=' + pr + ' (' + c0 + ' -> ' + window.MOCK_STATE.clover + ')');
  ok(M.handle('springcard_load', {}).buy_num === 1, 'buy_num advanced');
  window.MOCK_STATE.clover = 0;
  ok(M.handle('springcard_buy', {}).tags_id === 0, 'without clover the buy is refused with tags_id 0');
  window.MOCK_STATE.clover = 1000;

  /* compose: bg + three tags from items */
  window.MOCK_STATE.spring.items = [{ item_id: BG_IDS[0], num: 1 }, { item_id: 101, num: 3 }];
  ok(M.handle('springcard_change_bg', { id: BG_IDS[0] }).code === 0, 'springcard_change_bg answers code 0');
  for (let i = 0; i < 3; i++) ok(M.handle('springcard_put_tags', { pos: i, id: 101 }).code === 0, 'springcard_put_tags slot ' + i + ' ok');
  const d2 = M.handle('springcard_load', {});
  ok(d2.card_info.bg === BG_IDS[0] && d2.card_info.tags.every(t => t === 101), 'the card face is complete (bg + 3 tags)');

  /* send -> box -> reward */
  const sent = M.handle('springcard_send', {});
  ok(sent.box_id === Number(SC.big_box_id), 'a full card yields the big box (' + sent.box_id + ' == ' + SC.big_box_id + ')');
  ok(M.handle('springcard_load', {}).card_info.bg === 0, 'the card face resets after sending');
  const cl0 = window.MOCK_STATE.clover;
  const rew = M.handle('springcard_get_reward', {});
  ok(rew.num > 0 && window.MOCK_STATE.clover > cl0, 'opening the box granted the reward (+' + rew.num + ' clover)');
  ok(M.handle('springcard_load', {}).box_id === 0, 'box_id cleared after opening');
  ok(M.handle('springcard_get_reward', {}).num === 0, 'opening twice gives nothing');

  /* share flow + daily limit */
  const sh = M.handle('springcard_share_tags', {});
  ok(typeof sh.share_code === 'string' && sh.share_code.length > 0, 'springcard_share_tags answers a share_code (' + sh.share_code + ')');
  let got = 0;
  for (let i = 0; i < 5; i++) if (M.handle('springcard_get_share_tags', {}).tags_id > 0) got++;
  ok(got === Number(SC.tags_share_limit), 'the share exchange respects tags_share_limit (' + got + ' == ' + SC.tags_share_limit + ')');

  ok(M.handle('springcard_load_count', {}).count > 0, 'springcard_load_count answers a count');
  ok(M.handle('springcard_get_task_item', {}).list !== undefined, 'springcard_get_task_item answers list');
  ok(M.handle('springcard_get_task_reward', {}).code === 0, 'springcard_get_task_reward answers code 0');

  window.MOCK_SAVE && window.MOCK_SAVE();
  await new Promise(r => setTimeout(r, 1300));
  ok(!!SERVER_SAVE && !!SERVER_SAVE.spring && Array.isArray(SERVER_SAVE.spring.items), 'the springcard state reached the server save');

  console.log('\n' + (fail ? 'FAILED ' + fail + ' check(s)' : 'ALL CHECKS PASSED'));
  process.exit(fail ? 1 : 0);
})();
