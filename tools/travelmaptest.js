/* travelmaptest: 墙上的地图（清单第十四节）。
   客户端 MainInView.on_enterTravelMap_tap 要求 ActivityModel.getActivity("travelmap").params.isOpen,
   而那个活动来自渠道公告 BaseChannel.getAnnInfo({tags:["travelmap"]})（HTTP，离线拿不到）
   -> 以前点地图没反应。本层只劫持这一次调用, 返回本机 devserver 上的离线地图页。 */
const H = require('./_harness.js');
const fs = H.fs, ok = H.ok;

/* 假渠道: 单例 + getAnnInfo 原实现返回 null(和客户端基类一样) */
const calls = [];
function FakeChannel() {}
FakeChannel.prototype.getAnnInfo = function (arg) {
  calls.push(arg);
  return { then: function (cb) { try { cb(null); } catch (e) {} return this; }, catch: function () { return this; } };
};
const inst = new FakeChannel();
global.BaseChannel = function () {};
global.BaseChannel.getInstance = function () { return inst; };
global.BaseChannel.prototype = FakeChannel.prototype;

H.boot({ stubs: function (g) {
  g.BaseChannel = global.BaseChannel;
  g.GameConfig = { channel: 'ejoy', channelDictionaries: {} };
}});
const st = global.MOCK_STATE;
ok(!!inst.__mockMapPatched, '渠道单例的 getAnnInfo 已被挂钩');
ok(!!window.MOCK_TRAVELMAP && /travelmap\.html$/.test(window.MOCK_TRAVELMAP.url), 'MOCK_TRAVELMAP.url 指向本机地图页 [' + (window.MOCK_TRAVELMAP && window.MOCK_TRAVELMAP.url) + ']');

/* 1) travelmap 那次调用返回 isOpen=1 + url */
let got = null;
inst.getAnnInfo({ type: 'activity', tags: ['travelmap'], search_type: 'group', channel: 1 }).then(function (t) { got = t; });
ok(!!got && !!got.anns && !!got.anns[0], 'travelmap 公告回 {anns:[...]} [' + JSON.stringify(got) + ']');
ok(got && Number(got.anns[0].isOpen) === 1, 'anns[0].isOpen = 1 -> 客户端才会 addActivity 并亮出按钮');
ok(got && /^http:\/\/127\.0\.0\.1:8089\/travelmap\.html$/.test(got.anns[0].url), 'url 是本机页面 [' + (got && got.anns[0].url) + ']');

/* 2) 其它公告原样透传(不能被我们吞掉) */
let other = 'x';
inst.getAnnInfo({ type: 'maintain', search_type: 'name', channel: 1 }).then(function (t) { other = t; });
ok(other === null, '维护公告仍然走原实现(返回 null) [' + other + ']');
ok(calls.length === 1 && calls[0].type === 'maintain', '原实现只被非 travelmap 的调用触发 [' + JSON.stringify(calls) + ']');

/* 3) 支持 await(客户端有的地方是 __awaiter + yield) */
ok(typeof inst.getAnnInfo({ tags: ['travelmap'] }).then === 'function', '返回值是 thenable, await/then 都能用');

/* 4) 页面本体存在且真的会读存档 */
const html = fs.readFileSync(H.BASE + '/new/travelmap.html', 'utf8');
ok(html.indexOf('/load') >= 0, '页面会 GET /load 读本机存档');
ok(html.indexOf('三叶草') >= 0 && html.indexOf('明信片') >= 0 && html.indexOf('旅行次数') >= 0, '页面渲染存档里的关键数字');
ok(html.indexOf('走过的地方') >= 0, '页面有"走过的地方"版块');

console.log(H.fails() ? ('\ntravelmaptest: ' + H.fails() + ' FAILED') : '\ntravelmaptest: all checks passed');
process.exit(H.fails() ? 1 : 0);
