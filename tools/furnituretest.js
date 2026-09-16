/* furnituretest: 家具摆放 loop (bench / box / room) — was NO-HANDLER on device. */
const fs = require('fs');
const BASE = '/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw';
let fail = 0;
function ok(cond, msg) { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) fail++; }

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
  /* the client's own furniture table, used to resolve a furniture's slot type */
  const FURN = { 5001: { id: 5001, type: 1, name: '地毯' }, 5002: { id: 5002, type: 2, name: '椅子' }, 5003: { id: 5003, type: 2, name: '另一把椅子' }, 10102: { id: 10102, type: 9, name: '摆件' } };
  global.Tabikaeru = { DataManager: { instance: () => ({ FurnitureDB: { get: id => FURN[id] || null }, ItemDB: { get: () => null } }) }, DataType: { ItemType: {} } };
  ['furniture_load_furniture', 'furniture_load_compost'].forEach(n => listeners[n] = [function () {}]);
  delete global.MOCK_STATE; delete global.MOCK_SEMANTIC; global.MockServer = undefined;
  const l = console.log, w = console.warn;
  console.log = () => {}; console.warn = () => {};
  try { eval(fs.readFileSync(BASE + '/new/mock.js', 'utf8')); } finally { console.log = l; console.warn = w; }
  return window.MockServer;
}

const M = boot();
const SM = core.SocketManage.prototype;

/* ---- 1. every placement protocol is handled now ---- */
for (const p of ['furniture_putin_bench', 'furniture_takeout_bench', 'furniture_putin_box', 'furniture_takeout_box', 'furniture_replace_fur']) {
  const r = M.handle(p, {});   /* empty params -> refused, must not mutate */
  ok(r && typeof r === 'object' && !(typeof r === 'function'), p + ' is handled, not a placeholder (answer=' + JSON.stringify(r) + ')');
}

/* ---- 2. bench slots ---- */
const l0 = M.handle('furniture_load_furniture', {});
ok(Array.isArray(l0.bench) && l0.bench.length === 10, 'furniture_load_furniture carries a 10 slot bench (' + (l0.bench || []).length + ')');
ok(Array.isArray(l0.put_fur) && Array.isArray(l0.has_fur), 'put_fur / has_fur exist for getHomeFurnitures()');
ok(l0.shop && Array.isArray(l0.shop.shop_list), 'shop.shop_list exists (the client assigns it without a guard)');
M.handle('furniture_putin_bench', { pos: 1, id: 5001 });
M.handle('furniture_putin_bench', { pos: 6, id: 10102 });
let lf = M.handle('furniture_load_furniture', {});
ok(lf.bench[0] === 5001 && lf.bench[5] === 10102, '工具槽 bench[0]=5001, 家具槽 bench[5]=10102 -> ' + JSON.stringify(lf.bench));
ok(lf.bench.slice(0, 5).filter(x => x !== -1).length === 1, 'getBenchTools() sees exactly one tool');
M.handle('furniture_takeout_bench', { pos: 1 });
ok(M.handle('furniture_load_furniture', {}).bench[0] === -1, 'takeout clears the slot');
ok(M.handle('furniture_putin_bench', { pos: 99, id: 5001 }).code === 1, 'an out-of-range slot is refused with code 1');

/* ---- 3. storage box ---- */
M.handle('furniture_putin_box', { pos: 2, id: 5002 });
ok(M.handle('furniture_load_compost', {}).box_list[1] === 5002, 'storage box slot 2 holds 5002');
M.handle('furniture_takeout_box', { pos: 2 });
ok(M.handle('furniture_load_compost', {}).box_list[1] === 0, 'storage box slot 2 cleared');

/* ---- 4. putting furniture into the room ----
   新契约(new/furnishplace.js): 只有**已拥有**(has_fur)的家具能摆进小屋, 否则回 code 1
   (客户端据此把该 type 从 replace_fur 撤回)。所以先把它加进 has_fur。 */
MOCK_STATE.furniture.has_fur = [5001, 5002, 5003, 10102];
ok(M.handle('furniture_replace_fur', { id: 9999 }).code === 1, '没拥有的家具摆不进去 (code 1)');
const rr = M.handle('furniture_replace_fur', { id: 5002 });
ok(rr.code === 0, 'furniture_replace_fur answers code 0');
const typeEntries = (list, t) => list.filter(x => Number(x.type) === Number(t));
let put = M.handle('furniture_load_furniture', {}).put_fur;
let t2 = typeEntries(put, 2);
ok(t2.length === 1 && Number(t2[0].id) === 5002, 'the room now holds {id:5002,type:2} -> ' + JSON.stringify(t2));
ok(put.every(x => x && typeof x === 'object' && x.id > 0 && x.type > 0), 'put_fur 条目都是 {id,type} 对象(纯数字不渲染)');
ok(put.length === 3, '没摆过的家具每类自动进屋一件(5001/5003/10102 三类) -> ' + JSON.stringify(put));
M.handle('furniture_replace_fur', { id: 5003 });   /* same type -> replaces */
put = M.handle('furniture_load_furniture', {}).put_fur;
t2 = typeEntries(put, 2);
ok(t2.length === 1 && Number(t2[0].id) === 5003, 'a second furniture of the same type replaces the first -> ' + JSON.stringify(t2));
ok(typeEntries(put, 1).length === 1 && typeEntries(put, 9).length === 1, 'a different type is kept alongside -> ' + JSON.stringify(put));

/* ---- 5. it survives a refresh (real persist.js POST + restore) ----
   注意: persist.js 的 MOCK_SAVE 是"去抖 + 4 秒强制 flush"(SAVE_MAX_DELAY=4000),
   而 travel2/handcraft 等层每秒都会调一次 M.handle -> 每次都刷新去抖计时器,
   所以这里必须等 >4 秒才有 POST(以前只等 1300ms, 三条断言一直"失败"其实是我的测试等太短)。 */
window.MOCK_SAVE && window.MOCK_SAVE();
setTimeout(function () {
  ok(!!SERVER_SAVE && !!SERVER_SAVE.furniture, 'the furniture state was POSTed to the server save');
  const savedPut = (SERVER_SAVE && SERVER_SAVE.furniture && SERVER_SAVE.furniture.put_fur) || [];
  ok(typeEntries(savedPut, 2).length === 1 && Number(typeEntries(savedPut, 2)[0].id) === 5003, '摆放(同类留最后一件)落库 -> ' + JSON.stringify(savedPut));
  const M2 = boot();                      /* persist.js restores SERVER_SAVE through GET /load */
  const after = M2.handle('furniture_load_furniture', {});
  ok(after.bench[5] === 10102, 'bench survives a refresh (' + JSON.stringify(after.bench) + ')');
  const afterT2 = typeEntries(after.put_fur, 2);
  ok(afterT2.length === 1 && Number(afterT2[0].id) === 5003, 'room furniture survives a refresh (' + JSON.stringify(after.put_fur) + ')');
    /* ---- 小仓库家具回归: has_fur 必须都能在家具表里查到 / replace_fur 与 put_fur 对应 ---- */
  const FURJSON = JSON.parse(require('fs').readFileSync(BASE + '/tables/furnitureData_json.json', 'utf8'));
  const furList = Array.isArray(FURJSON) ? FURJSON : Object.keys(FURJSON).map(k => FURJSON[k]);
  const furIds = {}; furList.forEach(r => furIds[Number(r.id)] = Number(r.type));
  /* 注入**真实家具表**的 DB(测试桩会对任何 id 都返回行, 那样测不出幽灵 id) */
  try {
    const dm = global.Tabikaeru.DataManager.instance();
    dm.FurnitureDB = { get: id => furList.filter(r => Number(r.id) === Number(id))[0] || null, list: () => furList };
  } catch (e) {}
  const pay = M.handle('furniture_load_furniture', {});
  ok(Array.isArray(pay.has_fur) && Array.isArray(pay.put_fur) && Array.isArray(pay.replace_fur), '下发里有 has_fur/put_fur/replace_fur');
  const ghost = (pay.has_fur || []).filter(id => !furIds[Number(id)]);
  ok(ghost.length === 0, 'has_fur 里没有家具表查不到的幽灵 id [' + ghost.slice(0, 6).join(',') + ' 共 ' + ghost.length + ']');
  ok((pay.has_fur || []).length === new Set((pay.has_fur || []).map(Number)).size, 'has_fur 没有重复条目');
  ok(Array.isArray(pay.replace_fur) && pay.replace_fur.length >= 1 && pay.replace_fur.every(t2 => Number(t2) >= 1 && Number(t2) <= 27),
     'replace_fur 是合法的家具 type 集合(客户端"已摆放/替换"那栏读它) [' + JSON.stringify(pay.replace_fur) + ']');
  ok((pay.put_fur || []).every(r => Number(r.type) > 0), 'put_fur 每条都有 type(客户端 getReplaced 靠它)');

console.log('\n' + (fail ? 'FAILED ' + fail + ' check(s)' : 'ALL CHECKS PASSED'));
  process.exit(fail ? 1 : 0);
}, 4600);
