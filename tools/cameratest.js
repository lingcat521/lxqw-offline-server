/* cameratest: 相机两处 bug 的离线验证
 *   A) 全景模式的裁剪框原来写死 854x1420 / 1152x1420, 自适应 stage 下跟视口差不多 -> 两张图一样
 *   B) TestChannel 继承 BaseChannel 的桩 save_texture_to_album(返回 null) -> 永远"保存失败"
 */
const fs = require('fs');
const BASE = '/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw';
let fail = 0;
function ok(cond, msg) { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) fail++; }

let posted = [];
global.XMLHttpRequest = function () {
  this.responseText = ''; this.status = 200;
  this.open = (m, u) => { this.m = m; this.u = String(u); };
  this.setRequestHeader = () => {};
  this.send = (body) => {
    const f = /\/([a-z0-9_.]+\.js|screen\.json)(\?|$)/.exec(this.u);
    if (f) { try { this.responseText = fs.readFileSync(BASE + '/new/' + f[1], 'utf8'); } catch (e) { this.responseText = ''; } return; }
    if (this.u.indexOf('/shot') >= 0) { posted.push(body); this.responseText = 'saved test.jpg'; if (this.onload) setTimeout(() => this.onload(), 0); return; }
    this.responseText = '';
  };
};
global.window = global;
const listeners = Object.create(null);
global.__events = [];
global.core = {
  SocketManage: { prototype: {}, getInstance: () => ({ send() {} }) }, Socket: { prototype: {} },
  ServiceDispatcher: { getInstance: () => ({ hasEventListener: n => !!listeners[n], dispatchEvent: e => { __events.push(e.type); } }) },
  Event: function (t, d, p) { this.type = t; this.data = d; },
  Log: { print() {}, warning() {}, error() {} },
  Time: { getServerTime: () => Math.floor(Date.now() / 1000), setServerTime() {} },
  String: { isNullOrEmpty: s => !s || s.length === 0, format: s => s }
};
global.ProtocolList = { protocolList: {} };
global.egret = {
  setTimeout: (f, t) => setTimeout(f, t || 0), clearTimeout: id => clearTimeout(id),
  setInterval: (f, t) => setInterval(f, t), clearInterval: id => clearInterval(id),
  Rectangle: function (x, y, w, h) { this.x = x; this.y = y; this.width = w; this.height = h; }
};
function WeatherModel() { this.data = { season: 0, hours_type: 0, weather: 0 }; }
WeatherModel.prototype.getSeasonKey = function () { return this.data.season + '' + this.data.hours_type; };
global.WeatherModel = WeatherModel; global.MessageModel = function () {}; global.MessageModel.prototype = {};
global.RechargeModel = function () {}; global.RechargeModel.prototype = {};
global.Main = { stageWidth: 640, stageHeight: 1378 };

/* ---- the client's channel stack: BaseChannel with a NULL stub, TestChannel inheriting it ---- */
function BaseChannel() {}
BaseChannel.prototype.textureToCanvas = function (texture) {
  return { toDataURL: function () { return 'data:image/jpeg;base64,' + Buffer.from('x'.repeat(400)).toString('base64'); } };
};
BaseChannel.prototype.check_permission = function () { return Promise.resolve(true); };
BaseChannel.prototype.save_texture_to_album = function () { return Promise.resolve(null); };   /* ← 桩 */
BaseChannel.getInstance = function () { return BaseChannel._i || (BaseChannel._i = new TestChannel()); };
BaseChannel.prototype.save_to_album = function () { return Promise.resolve(true); };
function TestChannel() {}
TestChannel.prototype = Object.create(BaseChannel.prototype);
global.BaseChannel = BaseChannel; global.TestChannel = TestChannel;

/* ---- a view shaped like MainIn/MainOut with the CLIENT's original capture maths ---- */
let lastCapture = null;
global.Utils = {
  Capture: { instance: () => ({ captureTexture: (container, rect) => { lastCapture = { container: container, rect: rect }; return { textureWidth: rect.width, textureHeight: rect.height }; } }) },
  base64ToArrayBuffer: () => new ArrayBuffer(8)
};
function MainIn() { this.groupScene = { width: 900, height: 1500 }; this.width = 640; this.height = 1378; this.scroller = { viewport: { scrollH: 0 } }; }
MainIn.prototype.checkCameraMoment = function () {};
MainIn.prototype.getCameraTexture = function (e, t) {          /* e = full, t = section rect */
  var i;
  if (t) i = t;
  else if (e) i = new egret.Rectangle(0, 0, 1152, 1420);        /* 写死的设计框 */
  else { var n = (1420 - this.height) / 2; i = new egret.Rectangle(this.scroller.viewport.scrollH, n, this.width, this.height); }
  return Utils.Capture.instance().captureTexture(this.groupScene, i);
};
global.MainIn = MainIn;

eval(fs.readFileSync(BASE + '/new/mock.js', 'utf8'));

(async function () {
  const M = window.MockServer;
  const v = new MainIn();

  /* --- A. 全景模式必须比屏幕模式覆盖更大的场景 --- */
  const full = v.getCameraTexture(true, null);
  const fullRect = { w: lastCapture.rect.width, h: lastCapture.rect.height };
  ok(fullRect.w === 900 && fullRect.h === 1500, '全景模式按场景真实尺寸捕获 (' + fullRect.w + 'x' + fullRect.h + ') 而不是写死的 1152x1420');
  ok(full.textureWidth === 900, '返回的贴图就是场景尺寸 (' + full.textureWidth + ')');
  const screen = v.getCameraTexture(false, null);
  ok(screen.textureWidth === 640 && screen.textureHeight === 1378, '屏幕模式仍是视口 (' + screen.textureWidth + 'x' + screen.textureHeight + ')');
  ok(full.textureWidth > screen.textureWidth, '两种模式现在确实不同 (' + full.textureWidth + ' vs ' + screen.textureWidth + ')');
  const section = v.getCameraTexture(true, new egret.Rectangle(0, 0, 250, 250));
  ok(section.textureWidth === 250, '裁切模式(带 rect)不受影响 (' + section.textureWidth + ')');

  /* --- B. 保存图片 --- */
  const ch = BaseChannel.getInstance();
  ok(typeof ch.save_texture_to_album === 'function', 'save_texture_to_album exists');
  ok(ch.save_texture_to_album.__mockCamera === 1, 'it was replaced by the local implementation');
  const tex = { textureWidth: 900, textureHeight: 1500 };
  const r = await ch.save_texture_to_album(tex, true);
  ok(r === true, '保存返回 true => 客户端会显示"保存成功" (was null => 保存失败)');
  ok(posted.length === 1, 'the image was POSTed to /shot (' + posted.length + ')');
  ok(/^data:image\//.test(posted[0] || ''), 'the POST body is a data: URL (' + String(posted[0]).slice(0, 30) + '...)');
  ok((await ch.check_permission('album')) === true, 'check_permission still resolves true');

  console.log('\n' + (fail ? 'FAILED ' + fail + ' check(s)' : 'ALL CHECKS PASSED'));
  process.exit(fail ? 1 : 0);
})();
