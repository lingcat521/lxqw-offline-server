/* gmtest: 调试/GM 通道（清单第一节"存档重置/调试接口"）与时间倍率（第十八节）。
   通道本身是 tools/devserver2.js 的 POST/GET /gm, 这里只测客户端侧的执行器。 */
const { BASE, ok, boot, fails } = require('./_harness.js');

boot({});
const M = global.MockServer, st = global.MOCK_STATE || (global.MOCK_STATE = {});
const S = global.MOCK_SEMANTIC;
st.kitV2 = st.kitV3 = st.kitV4 = st.kitV5 = st.kitGranted = 1;

(async function () {
const GM = window.MOCK_GM;
const sent = [];
const realDispatch = M.dispatch;
M.dispatch = function (name, data) { sent.push(name); return realDispatch.apply(this, arguments); };

ok(!!GM && typeof GM.cmd === 'function', 'window.MOCK_GM 存在');
['say','clover','ticket','give','take','clearbag','home','away','settime','offset','timescale','weather','dump','reset','reload','help']
  .forEach(function (c) { ok(GM.list().indexOf(c) >= 0, '支持命令 ' + c); });

GM.cmd('clover', 9999);
ok(st.clover === 9999, 'clover 9999 -> st.clover=9999');

GM.cmd('ticket', 42);
ok(st.ticket === 42, 'ticket 42 -> st.ticket=42');

st.house = [];
GM.cmd('give', [8501, 3]);
GM.cmd('give', [8501, 2]);
ok(st.house.length === 1 && st.house[0].count === 5, 'give 同 id 会累加 (8501=' + (st.house[0] || {}).count + ')');
GM.cmd('take', [8501, 4]);
ok(st.house[0].count === 1, 'take 会扣 (8501=' + st.house[0].count + ')');

/* push() 是异步的(setTimeout 60ms), 这里给它们落地的时间再断言 */
await new Promise(r => setTimeout(r, 200));
ok(sent.indexOf('clover_update') >= 0, 'clover 之后推了 clover_update');
ok(sent.filter(n => n === 'item_load_items').length >= 3, '给/收物品都推了 item_load_items [' + sent.join(',') + ']');

st.frog = { status: 0, traveling: false, returnAt: 0 };
GM.cmd('home');
ok(st.frog.traveling === true && st.frog.returnAt < Date.now(), 'home -> returnAt 已过期, rules.js 4 秒内结算');

GM.cmd('weather', 3);
ok(st.weather === 3, 'weather 3 -> st.weather=3');
ok(M.handle('weather_load', {}).weather === 3, 'weather_load 下发跟着变');

/* 时间: offset / settime 必须同时影响 Date.now 与 core.Time.getServerTime */
global.core.Time = { getServerTime: function () { return Math.floor(Date.now() / 1000); } };
const before = Date.now();
GM.cmd('offset', 7200);
const after = Date.now();
ok(Math.abs((after - before) - 7200000) < 5000, 'offset 7200 -> Date.now 前移 2 小时 [' + Math.round((after - before) / 1000) + 's]');
ok(Math.abs(global.core.Time.getServerTime() - Math.floor(after / 1000)) <= 1, 'core.Time.getServerTime 跟着走');
GM.cmd('settime', 1800000000);
ok(Math.abs(global.core.Time.getServerTime() - 1800000000) <= 2, 'settime 1800000000 -> 服务器时间对齐 [' + global.core.Time.getServerTime() + ']');
GM.cmd('timescale', 2);
ok(typeof st.timeScale === 'number' && st.timeScale === 2, 'timescale 2 记录在案');

GM.cmd('clearbag');
ok(st.house.length === 0, 'clearbag 清空背包');
GM.cmd('nonexistent-command');
ok(true, '未知命令只打日志不抛异常');

const keys = Object.keys(st).length;
GM.cmd('reset');
ok(Object.keys(st).length < keys, 'reset 清掉存档 (键 ' + keys + ' -> ' + Object.keys(st).length + ')');

console.log(fails() === 0 ? 'ALL GM CHECKS PASSED' : (fails() + ' CHECK(S) FAILED'));
process.exit(fails() === 0 ? 0 : 1);
})();
