/* lxqw 游戏内地图浮层 —— new/mapview.js
 *   为什么需要: 默认渠道 BaseWebView.open 就是 `window.open(url)`, 在 Android WebView 里被静默丢弃
 *   ⇒ 相册右上角"地图"点了没反应(见 v0.111 之前的排查: EjoyWebView 才走 lua/native 桥, 没生效)。
 *   做法: **接管当前渠道的 openWebView()**, 返回我们自己的 webview 对象(open/close/onEvent/onClose),
 *        点地图时直接画一个 Egret 浮层: 11 区进度 + 38 城市点位(亮/灰) + 点城市看该地照片数。
 *   好处: 不改 APK、不依赖 SDK/网络, 客户端调用链一行都不用动。
 */
(function () {
  var st = window.MOCK_STATE || (window.MOCK_STATE = {});
  function log(m) { try { console.log('[MOCK] 地图层: ' + m); } catch (e) {} }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  var panel = null, photoPanel = null, onCloseAct = null;

  function mkText(txt, size, color, x, y, w) {
    var t = new egret.TextField();
    t.text = String(txt); t.size = size || 24; t.textColor = color === undefined ? 0x3b3021 : color;
    t.x = x || 0; t.y = y || 0; if (w) { t.width = w; t.wordWrap = true; }
    t.touchEnabled = false;
    return t;
  }
  function hide() {
    try {
      if (panel && panel.parent) panel.parent.removeChild(panel);
    } catch (e) {}
    panel = null;
    try { if (onCloseAct) onCloseAct.dispatch(); } catch (e) {}
    log('地图浮层关闭');
  }
  function show(url, params, opts) {
    try {
      if (panel) { log('地图浮层已经开着'); return; }
      panel = build();
      if (!panel) return;
      core.DisplayManage.getInstance().getNoticeLayer().addChild(panel);
      log('地图浮层打开: ' + (panel.__info || ''));
    } catch (e) { log('浮层打开失败: ' + (e && e.message)); }
  }
  /* 一个可点的文本(城市/按钮) */
  function tappable(txt, size, color, x, y, w, onTap) {
    var t = mkText(txt, size, color, x, y, w);
    t.touchEnabled = true;
    if (onTap) t.addEventListener(egret.TouchEvent.TOUCH_TAP, function () { try { onTap(); } catch (e) {} }, null);
    return t;
  }
  /* 点城市 -> 看该地照片(轻量列表浮层) */
  function showPhotos(placeId, name, locked) {
    try {
      if (photoPanel && photoPanel.parent) photoPanel.parent.removeChild(photoPanel);
      var M = window.MOCK_MAP, ids = (M && M.photosOf) ? M.photosOf(placeId) : [];
      var W = egret.MainContext.instance.stage.stageWidth, H = egret.MainContext.instance.stage.stageHeight;
      photoPanel = new egret.Sprite();
      var bg2 = new egret.Sprite();
      bg2.graphics.beginFill(0x000000, 0.5); bg2.graphics.drawRect(0, 0, W, H); bg2.graphics.endFill(); bg2.touchEnabled = true;
      photoPanel.addChild(bg2);
      var card2 = new egret.Sprite();
      card2.graphics.beginFill(0xfff7e0, 1); card2.graphics.drawRect(0, 0, W - 160, 320); card2.graphics.endFill();
      card2.x = 80; card2.y = H / 2 - 160;
      card2.addChild(mkText(locked ? (name + ' 还没去过') : (name + ' 的照片 ' + ids.length + ' 张'), 26, 0x6b4f2a, 20, 16));
      card2.addChild(mkText(locked ? '带上食物/道具出门, 到了就会在地图上点亮' :
                             (ids.length ? ('明信片 id: ' + ids.join(', ')) : '这里还没有拍到照片'), 20, 0x545a4f, 20, 70, W - 200));
      var b2 = tappable('关 闭', 22, 0x4a3a1c, 20, 250, 120, function () { if (photoPanel && photoPanel.parent) photoPanel.parent.removeChild(photoPanel); photoPanel = null; });
      var b2bg = new egret.Sprite();
      b2bg.graphics.beginFill(0xe8b04b, 1); b2bg.graphics.drawRect(0, 0, 120, 44); b2bg.graphics.endFill();
      b2bg.x = 20; b2bg.y = 250; b2bg.touchEnabled = true;
      b2bg.addChild(mkText('关 闭', 22, 0x4a3a1c, 28, 8));
      b2bg.addEventListener(egret.TouchEvent.TOUCH_TAP, function () { if (photoPanel && photoPanel.parent) photoPanel.parent.removeChild(photoPanel); photoPanel = null; }, null);
      card2.addChild(b2bg);
      photoPanel.addChild(card2);
      core.DisplayManage.getInstance().getNoticeLayer().addChild(photoPanel);
      log('看照片: ' + name + ' -> ' + ids.length + ' 张');
    } catch (e) { log('照片浮层失败: ' + (e && e.message)); }
  }
  /* 构建整张地图: 11 区 + 38 城市(未解锁灰色占位), 每个城市可点 */
  function build() {
    var M = window.MOCK_MAP;
    var data = (M && M.load) ? M.load() : { locations: [], unlocked: 0, total: 0 };
    var regions = (M && M.regions11) ? M.regions11() : [];
    var W = egret.MainContext.instance.stage.stageWidth, H = egret.MainContext.instance.stage.stageHeight;
    var root = new egret.Sprite();
    root.__info = num(data.unlocked) + '/' + num(data.total) + ' 地点, ' + regions.length + ' 区';
    var bg = new egret.Sprite();
    bg.graphics.beginFill(0x000000, 0.55); bg.graphics.drawRect(0, 0, W, H); bg.graphics.endFill();
    bg.touchEnabled = true;                                  /* 防点穿(用户提醒): 背景吃点击 */
    root.addChild(bg);
    var card = new egret.Sprite();
    card.graphics.beginFill(0xf7ecc9, 1); card.graphics.drawRect(0, 0, W - 40, H - 120); card.graphics.endFill();
    card.x = 20; card.y = 60;
    root.addChild(card);
    card.addChild(mkText('旅行地图   ' + num(data.unlocked) + ' / ' + num(data.total) + '      (点亮的城市可以点开看照片)', 24, 0x6b4f2a, 16, 12));
    var byId = {}; (data.locations || []).forEach(function (l) { byId[num(l.id)] = l; });
    var colW = (card.width - 40) / 2, x0 = card.x + 16, y = 52, col = 0;
    for (var i = 0; i < regions.length; i++) {
      var r = regions[i];
      var head = mkText(r.name + ' ' + r.unlocked + '/' + r.total, 18, 0x8a6b2a, x0 + col * colW, y);
      card.addChild(head);
      y += 22;
      var places = r.places || [];
      for (var j = 0; j < places.length; j++) {
        var pid = num(places[j]), l = byId[pid] || { id: pid, name: String(pid), unlocked: 0, photos: 0 };
        var col2 = 0xaa9f8c, label = '· ' + l.name;            /* 未解锁: 灰色占位名 */
        if (l.unlocked) { col2 = l.photos > 0 ? 0x2f6b2a : 0x3b3021; label = '★ ' + l.name + (l.photos ? '(' + l.photos + ')' : ''); }
        (function (loc) {
          card.addChild(tappable(label, 18, col2, x0 + col * colW, y, colW - 8, function () {
            if (!loc.unlocked) { showPhotos(num(loc.id), loc.name, 1); return; }   /* 未解锁也给一个反馈 */
            showPhotos(num(loc.id), loc.name);
          }));
        })(l);
        y += 20;
      }
      col = 1 - col;
      if (col === 0) y += 6;
      if (y > card.height - 80) break;
    }
    var btn = new egret.Sprite();
    btn.graphics.beginFill(0xe8b04b, 1); btn.graphics.drawRect(0, 0, 140, 48); btn.graphics.endFill();
    btn.x = card.width / 2 - 70; btn.y = card.height - 60; btn.touchEnabled = true;
    btn.addChild(mkText('关 闭', 22, 0x4a3a1c, 40, 10));
    btn.addEventListener(egret.TouchEvent.TOUCH_TAP, function () { hide(); }, null);
    card.addChild(btn);
    /* 屏幕比例特殊时重画(用户提醒): 监听 RESIZE */
    try {
      if (!root.__resizeHooked) {
        root.__resizeHooked = 1;
        egret.MainContext.instance.stage.addEventListener(egret.Event.RESIZE, function () {
          try { if (panel) { hide(); show(); } } catch (e) {}
        }, null);
      }
    } catch (e) {}
    return root;
  }
  function install() {
    try {
      if (typeof BaseChannel === 'undefined' || !BaseChannel.getInstance) return false;
      var ch = BaseChannel.getInstance();
      if (!ch || ch.__mockMapView) return true;
      ch.openWebView = function () {
        onCloseAct = onCloseAct || new core.Action();
        return {
          open: function (url, params, opts) { log('接管 openWebView -> 画游戏内地图 (' + String(url).slice(0, 60) + ')'); show(url, params, opts); },
          close: function () { hide(); },
          callback: function () {},
          onEvent: new core.Action1(),
          onClose: onCloseAct,
          __mock: 1
        };
      };
      ch.__mockMapView = 1;
      log('已接管渠道 openWebView(): 相册右上角"地图"会打开游戏内浮层');
      return true;
    } catch (e) { return false; }
  }
  /* ⚠️ 实测: 客户端点"地图"会走 TravelMapController.open() 里一大段 async 流程(task_client_pro -> 分享平台探测 ->
     BaseChannel.openWebView), 而这段 flow 在离线环境里没走到 openWebView 就停了(日志只有 task_client_pro, 没有我们的接管日志)。
     所以再补一层**更早的拦截**: 直接拦 PageManage.addViewControl, 只要它想开 TravelMapController, 就换成我们的浮层。 */
  function interceptController() {
    try {
      if (typeof core === 'undefined' || !core.PageManage) return false;
      var pm = core.PageManage.getInstance();
      if (!pm || pm.__mockMapIntercept) return true;
      var prevAdd = pm.addViewControl;
      pm.addViewControl = function (ctrl, layer) {
        try {
          var T = (typeof TravelMapController !== 'undefined') ? TravelMapController : null;
          if (T && ctrl === T) { log('拦截 TravelMapController -> 直接画游戏内地图浮层'); show(); return null; }
        } catch (e) {}
        return prevAdd.apply(this, arguments);
      };
      pm.__mockMapIntercept = 1;
      log('已拦截 PageManage.addViewControl(TravelMapController) —— 不依赖它内部那段 async 流程');
      return true;
    } catch (e) { return false; }
  }
  if (!install()) { var n = 0; var iv = setInterval(function () { if (install() || ++n > 40) clearInterval(iv); }, 500); }
  if (!interceptController()) { var n2 = 0; var iv2 = setInterval(function () { if (interceptController() || ++n2 > 40) clearInterval(iv2); }, 500); }
  window.MOCK_MAPVIEW = { show: show, hide: hide, install: install, isOpen: function () { return !!panel; } };
  log('就绪: 相册地图按钮 -> 游戏内浮层(11 区 + 38 城市, 不依赖原生 WebView)');
})();
