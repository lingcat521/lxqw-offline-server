/* museumdaytest: 博物馆日探索 (P2) */
const fs = require('fs');
const BASE = '/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw';
let fail = 0;
function ok(cond, msg) { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) fail++; }

const MD = JSON.parse(fs.readFileSync(BASE + '/tables/museumDayData_json.json', 'utf8'));
const MUS = JSON.parse(fs.readFileSync(BASE + '/tables/museumData_json.json', 'utf8'));
const MUSEUM_IDS = Object.keys(MD).map(Number);
const COLL_IDS = [];
for (const k of Object.keys(MUS)) String(MUS[k].collection_id || '').split(',').forEach(x => { if (x) COLL_IDS.push(Number(x)); });
const COLL_TABLE = JSON.parse(fs.readFileSync(BASE + '/tables/Collection_json.json', 'utf8'));
const ALL_COLL = COLL_TABLE.map(c => Number(c.id));

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
  /* the client's own museum tables */
  const DM = {
    MuseumDayData: { list: () => Object.keys(MD).map(k => MD[k]), get: k => MD[String(k)] || null },
    MuseumData: { get: k => MUS[String(k)] || null },
    MuseumDayCommonData: { get: k => (JSON.parse(fs.readFileSync(BASE + '/tables/museumDayCommon_json.json', 'utf8')))[k] || null }
  };
  global.Tabikaeru = { DataManager: { instance: () => DM }, DataType: { ItemType: {} } };
  ['museumday_load', 'item_load_items', 'item_load_handbook'].forEach(n => listeners[n] = [function () {}]);
  delete global.MOCK_STATE; delete global.MOCK_SEMANTIC; global.MockServer = undefined;
  const l = console.log, w = console.warn;
  console.log = () => {}; console.warn = () => {};
  try { eval(fs.readFileSync(BASE + '/new/mock.js', 'utf8')); } finally { console.log = l; console.warn = w; }
  return window.MockServer;
}

(async function () {
  const M = boot();
  const d = M.handle('museumday_load', {});
  const now = Math.floor(Date.now() / 1000);
  for (const k of ['end_time','inspire_num','inspire_time','museum_list','cur_museum','compass','task_num','frog','next','left_num','desc_id','pic_id','items','get_items','log_list','path'])
    ok(d[k] !== undefined, 'museumday_load.' + k + ' present');
  /* 活动的开启时间由 new/calendar.js 按真实日历决定(9 月这里应该是关的)，
     测试要验证的是活动本身，所以先用 calendar.json 的 force 语义把它打开 */
  ok(d.end_time === 0, 'museumday 在真实日历(9 月)里是关闭的 (end_time 0)');
  window.MOCK_CALENDAR.cfg.force = ['museumday'];
  const dForced = M.handle('museumday_load', {});
  const nowForced = Math.floor(Date.now() / 1000);
  ok(dForced.end_time > nowForced, 'end_time in the future so isOpen() is true');
  ok(d.museum_list.length === MUSEUM_IDS.length, 'museum_list carries all real museums (' + d.museum_list.length + ')');
  ok(d.museum_list.every(x => MUSEUM_IDS.indexOf(Number(x)) >= 0), 'every museum id exists in museumDayData');
  ok(d.compass > 0 && d.left_num > 0, 'the compass has a direction and there are moves left');
  ok(d.path.length !== d.next, 'path.length != next so checkRedot() prompts the player to advance');

  /* direction + advance */
  ok(M.handle('museumday_dir_compass', { dir: 2 }).code === 0, 'museumday_dir_compass answers code 0');
  ok(M.handle('museumday_load', {}).compass === 2, 'the compass direction was stored');

  const before = M.handle('museumday_load', {});
  ok(M.handle('museumday_start_advance', { id: 1 }).code === 0, 'museumday_start_advance answers code 0');
  const after = M.handle('museumday_load', {});
  ok(after.next === before.next + 1, 'the frog advanced one tile (' + before.next + ' -> ' + after.next + ')');
  ok(after.left_num === before.left_num - 1, 'a move was consumed (' + before.left_num + ' -> ' + after.left_num + ')');
  ok(after.path.length === before.path.length + 1, 'the path recorded the tile');

  /* items show up at tiles and can be collected into the 图鉴 */
  let found = null;
  for (let i = 0; i < 12 && !found; i++) {
    const cur = M.handle('museumday_load', {});
    if (cur.items.length) { found = cur.items[0]; break; }
    M.handle('museumday_start_advance', { id: 1 });
  }
  ok(!!found, 'tiles actually yield collectibles (' + JSON.stringify(found) + ')');
  ok(found && COLL_IDS.indexOf(Number(found.item_id)) >= 0, 'the collectible id comes from museumData.collection_id');
  const got = M.handle('museumday_get_items', {});
  ok(got.code === 0, 'museumday_get_items answers code 0');
  const d2 = M.handle('museumday_load', {});
  ok(d2.items.length === 0 && d2.get_items.length > 0, 'the item moved from items to get_items');
  ok((window.MOCK_STATE.collections || []).indexOf(Number(found.item_id)) >= 0, 'it also unlocked in the 图鉴 (handbook)');
  ok((window.MOCK_STATE.house || []).some(h => Number(h.item_id) === Number(found.item_id)), 'and landed in the house inventory');

  /* compass helpers + refresh */
  const r1 = M.handle('museumday_random_compass', {});
  ok(typeof r1.next === 'number' && typeof r1.inspire === 'number', 'museumday_random_compass answers {next, inspire}');
  const i0 = M.handle('museumday_load', {}).inspire_num;
  const r2 = M.handle('museumday_inspire', {});
  ok(typeof r2.next === 'number' && M.handle('museumday_load', {}).inspire_num === i0 - 1, 'museumday_inspire consumes one inspiration');
  window.MOCK_STATE.museumday.leftNum = 0;
  ok(M.handle('museumday_start_advance', { id: 1 }).code === 1, 'with no moves left the advance is refused');
  ok(M.handle('museumday_refresh', {}).left_num > 0, 'museumday_refresh refills the moves');
  ok(M.handle('museumday_info', {}).compass !== undefined, 'museumday_info answers compass/task_num');

  window.MOCK_SAVE && window.MOCK_SAVE();
  await new Promise(r => setTimeout(r, 1300));
  ok(!!SERVER_SAVE && !!SERVER_SAVE.museumday && Array.isArray(SERVER_SAVE.museumday.path), 'the museumday state reached the server save');

  console.log('\n' + (fail ? 'FAILED ' + fail + ' check(s)' : 'ALL CHECKS PASSED'));
  process.exit(fail ? 1 : 0);
})();
