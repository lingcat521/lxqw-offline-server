/* lxqw offline screen fitting (v0.21)
 *
 * The game ships index.html with data-scale-mode="fixedHeight" AND
 * GameConfig.fullScreen = false. With fullScreen off, Main.updateStageSize()
 * returns immediately and egret keeps the 640x1136 design box scaled to the
 * screen HEIGHT. On a tall phone (20:9, CSS viewport ~540x1200) that box is
 * only ~509x1136 design units, while the UI is authored for 640 wide: every
 * element outside the middle ~509 units is pushed off screen and the box does
 * not fill the phone. That is the "UI too small / some content does not fit".
 *
 * Setting GameConfig.fullScreen = true turns the game's OWN adaptive path back
 * on (Main.updateStageSize in main.min.js):
 *   - tall screen  -> FIXED_WIDTH : stage = 640 x (640*screenH/screenW)
 *   - wide screen  -> FIXED_HEIGHT: stage = (1136*screenW/screenH) x 1136
 *   - stage clamped to [designSize .. maxWidth x maxHeight]
 *   - safe area applied, then "uiresize" is dispatched so views re-lay out
 * On a 20:9 phone that yields a 640 x ~1400 stage = the whole screen, with
 * nothing cropped.
 *
 * Tunables live in screen.json on the dev server, so they can be changed
 * without touching the APK (relaunch the game to pick them up):
 *   { "fullScreen": true, "contentWidth": 640, "contentHeight": 1136,
 *     "maxWidth": 854, "maxHeight": 1420 }
 * Lower contentWidth (e.g. 560) to zoom the whole UI in ~14% - the sides then
 * get cropped; raise it to show more around a smaller UI.
 */
(function () {
  var BASE = "http://127.0.0.1:8089/";
  function lg(m) { try { console.log("[SCREEN] " + m); } catch (e) {} }

  function readCfg() {
    var o = { fullScreen: true, contentWidth: 640, contentHeight: 1136, maxWidth: 854, maxHeight: 1420 };
    try {
      var x = new XMLHttpRequest();
      x.open("GET", BASE + "screen.json?t=" + Date.now(), false);
      x.send(null);
      if (x.responseText && x.responseText.indexOf("not found") < 0) {
        var j = JSON.parse(x.responseText);
        for (var k in j) { if (j[k] !== undefined && j[k] !== null) o[k] = j[k]; }
        lg("screen.json: " + JSON.stringify(o));
      }
    } catch (e) { lg("screen.json unavailable, using defaults: " + (e && e.message || e)); }
    return o;
  }
  var C = readCfg();
  window.MOCK_SCREEN_CFG = C;

  function apply() {
    if (typeof GameConfig === "undefined" || !GameConfig) return false;
    try {
      if (C.fullScreen && !GameConfig.fullScreen) {
        GameConfig.fullScreen = true;
        lg("fullScreen ON -> game adaptive layout enabled");
      }
      if (typeof C.maxWidth === "number") GameConfig.maxWidth = C.maxWidth;
      if (typeof C.maxHeight === "number") GameConfig.maxHeight = C.maxHeight;
      if (typeof C.designSizeWidth === "number") GameConfig.designSizeWidth = C.designSizeWidth;
      if (typeof C.designSizeHeight === "number") GameConfig.designSizeHeight = C.designSizeHeight;
      GameConfig.designSizeAspectRatio = GameConfig.designSizeWidth / GameConfig.designSizeHeight;
      applyContentSize();
      return true;
    } catch (e) { lg("apply failed: " + (e && e.message || e)); return true; }
  }
  /* only needed for the "zoom" knob; 640x1136 is the stock content size */
  function applyContentSize() {
    if (C.contentWidth === 640 && C.contentHeight === 1136) return;
    try {
      var mc = (typeof egret !== "undefined" && egret.MainContext) ? egret.MainContext.instance : null;
      var st = mc ? mc.stage : null;
      var scr = st ? (st.$screen || null) : null;
      var fn = (scr && scr.setContentSize) ? scr.setContentSize : (st && st.setContentSize ? st.setContentSize : null);
      if (fn) { fn.call(scr || st, C.contentWidth, C.contentHeight); lg("content size -> " + C.contentWidth + "x" + C.contentHeight); }
    } catch (e) { lg("setContentSize failed: " + (e && e.message || e)); }
  }
  function metrics() {
    var o = { win: window.innerWidth + "x" + window.innerHeight, dpr: window.devicePixelRatio };
    try { o.screen = screen.width + "x" + screen.height; } catch (e) {}
    try {
      var mc = (typeof egret !== "undefined" && egret.MainContext) ? egret.MainContext.instance : null;
      var st = mc ? mc.stage : null;
      if (st) { o.stage = st.stageWidth + "x" + st.stageHeight; o.scaleMode = st.scaleMode; }
    } catch (e) {}
    try {
      var c = document.querySelector("canvas");
      if (c) { o.canvas = c.width + "x" + c.height; o.canvasCss = c.style.width + "x" + c.style.height; }
    } catch (e) {}
    try {
      var d = document.querySelector(".egret-player");
      if (d) { var r = d.getBoundingClientRect(); o.box = Math.round(r.width) + "x" + Math.round(r.height); }
    } catch (e) {}
    try { o.fullScreen = GameConfig.fullScreen; o.maxW = GameConfig.maxWidth; o.maxH = GameConfig.maxHeight; o.safe = JSON.stringify(GameConfig.safeArea); } catch (e) {}
    return o;
  }
  window.MOCK_SCREEN_METRICS = metrics;

  /* re-run the game's layout once the stage exists */
  function relayout(tag) {
    try {
      if (typeof egret === "undefined" || !egret.lifecycle || !egret.lifecycle.stage) return false;
      var s = egret.lifecycle.stage;
      s.dispatchEvent(new egret.Event(egret.Event.RESIZE));
      lg(tag + " " + JSON.stringify(metrics()));
      return true;
    } catch (e) { lg(tag + " relayout failed: " + (e && e.message || e)); return false; }
  }

  if (!apply()) {
    var t = 0;
    var iv = setInterval(function () {
      t++;
      if (apply() || t > 200) { clearInterval(iv); if (t <= 200) lg("GameConfig found after " + (t * 50) + "ms"); }
    }, 50);
  } else { lg("GameConfig patched before boot"); }

  /* 布局探针: 玩家反馈"准备按钮偏移", 这里把按钮/父容器/舞台的真实几何打出来,
     下一次真机日志就能直接定位偏移是相对哪一层产生的 */
  function layoutProbe(tag) {
    try {
      var out = [];
      var pairs = [["MainOutController", "out"], ["MainInController", "in"]];
      for (var i = 0; i < pairs.length; i++) {
        var C = window[pairs[i][0]];
        if (typeof C !== "function") { out.push(pairs[i][1] + ":no-class"); continue; }
        var ctrl = null;
        try { ctrl = core.PageManage.getInstance().getControl(C, core.ViewLayerType.SceneLayer); } catch (e) {}
        var v = ctrl && ctrl.getView ? ctrl.getView() : null;
        if (!v) { out.push(pairs[i][1] + ":closed"); continue; }
        var b = v.outBtn;
        var par = b && b.parent;
        var scene = v.groupFull || v.groupScene || null;
        /* 把所有直接子节点也列出来, 这样"底左那个准备按钮"是哪个元素、在哪一目了然 */
        var kids = [];
        try {
          for (var ci = 0; ci < v.numChildren && kids.length < 16; ci++) {
            var ch = v.getChildAt(ci);
            if (!ch) continue;
            var nm = ch.name || (ch.constructor && ch.constructor.name) || "?";
            if (ch.width === undefined) continue;
            kids.push(nm + "(" + Math.round(ch.x) + "," + Math.round(ch.y) + " " + Math.round(ch.width) + "x" + Math.round(ch.height) + ")");
          }
        } catch (e) {}
        var sc = null;
        try { sc = v.scroller ? (Math.round(v.scroller.viewport.scrollH) + "/" + Math.round(v.scroller.viewport.width)) : null; } catch (e) {}
        out.push(pairs[i][1] +
          " view " + Math.round(v.width) + "x" + Math.round(v.height) +
          " scrollH " + (sc === null ? "none" : sc) +
          " scene " + (scene ? Math.round(scene.width) + "x" + Math.round(scene.height) : "?") +
          " sceneXY " + (scene ? Math.round(scene.x) + "," + Math.round(scene.y) : "?") +
          " | outBtn " + (b ? Math.round(b.x) + "," + Math.round(b.y) + " " + Math.round(b.width) + "x" + Math.round(b.height) +
            " anchor " + Math.round(b.anchorOffsetX || 0) + "," + Math.round(b.anchorOffsetY || 0) : "none") +
          (par ? " parent " + Math.round(par.width) + "x" + Math.round(par.height) + " at " + Math.round(par.x) + "," + Math.round(par.y) : "") +
          " | children: " + kids.join(" ") + (scene ? (" | sceneKids: " + sceneKids(scene)) : ""));
      }
      var st = (typeof egret !== "undefined" && egret.lifecycle && egret.lifecycle.stage) ? egret.lifecycle.stage : null;
      lg("LAYOUT " + tag + " stage " + (st ? st.stageWidth + "x" + st.stageHeight : "?") +
         " container " + (typeof Main !== "undefined" ? Main.stageWidth + "x" + Main.stageHeight : "?") +
         " | " + out.join(" | "));
    } catch (e) { lg("LAYOUT " + tag + " failed: " + (e && e.message || e)); }
  }
  function sceneKids(scene) {
    var out = [];
    try {
      for (var i = 0; i < scene.numChildren && out.length < 16; i++) {
        var ch = scene.getChildAt(i);
        if (!ch || ch.width === undefined) continue;
        var nm = ch.name || (ch.constructor && ch.constructor.name) || "?";
        out.push(nm + "(" + Math.round(ch.x) + "," + Math.round(ch.y) + " " + Math.round(ch.width) + "x" + Math.round(ch.height) + ")");
      }
    } catch (e) {}
    return out.join(" ");
  }
  /* The house scene is authored 854 wide but the viewport is only ~640 (Main.stageWidth).
     MainInView.center_scroller() does  scroller.viewport.scrollH = 0.5*(854 - this.width)
     and is only called from onComplete()/on_resize().  If the view was laid out before our
     stage resize, or the skin root kept its designed width, scrollH stays 0 and everything
     anchored to the scene centre (the bag panel with its 准备/完成 button, furniture, the
     frog) shows up ~107px to the right - exactly the "准备按钮偏移 100px" report.
     Instead of moving anything ourselves we re-run the client's OWN centering. */
  function recenterScenes(tag) {
    var centered = 0, resize = 0;
    try {
      var st = (typeof egret !== "undefined" && egret.lifecycle && egret.lifecycle.stage) ? egret.lifecycle.stage : null;
      if (!st) return;
      try { st.dispatchEventWith(egret.Event.RESIZE); resize++; } catch (e) {}
      var stack = (st.$children || []).slice();
      var guard = 0;
      while (stack.length && guard++ < 4000) {
        var n = stack.pop();
        if (!n) continue;
        if (typeof n.center_scroller === "function") {
          try { n.center_scroller(); centered++; } catch (e) {}
        }
        if (n.$children && n.$children.length) {
          for (var i = 0; i < n.$children.length; i++) stack.push(n.$children[i]);
        }
      }
      lg("recenter " + tag + ": stage RESIZE x" + resize + ", center_scroller x" + centered);
    } catch (e) { lg("recenter " + tag + " failed: " + (e && e.message || e)); }
  }
  window.MOCK_RECENTER = recenterScenes;
  window.MOCK_LAYOUT_PROBE = layoutProbe;

  /* keep watching: the house/bag views are built when the player walks in, so a single
     pass at boot is not enough.  Only log when a scroller actually had to move. */
  var lastScroll = "";
  setInterval(function () {
    var before = 0, cur = "";
    try {
      var st = egret.lifecycle.stage;
      var stack = (st && st.$children || []).slice();
      while (stack.length) {
        var q = stack.pop();
        if (!q) continue;
        try { if (q.scroller && q.scroller.viewport) { before++; cur += Math.round(q.scroller.viewport.scrollH) + ","; } } catch (e2) {}
        if (q.$children && q.$children.length) for (var i = 0; i < q.$children.length; i++) stack.push(q.$children[i]);
      }
    } catch (e3) {}
    if (cur && cur !== lastScroll) { lastScroll = cur; recenterScenes("watch"); }
  }, 15000);

  /* the engine boots a few hundred ms after this layer loads: log the real
     numbers a few times so the device report says exactly what the layout is */
  var n = 0;
  var iv2 = setInterval(function () {
    n++;
    if (n === 2 || n === 5 || n === 10 || n === 20) recenterScenes("t" + n);
    if (n === 4 || n === 12 || n === 30 || n === 80) { relayout("t" + n); layoutProbe("t" + n); }
    if (n > 80) clearInterval(iv2);
  }, 400);
  lg("screen fit armed (relayout probes scheduled)");
  /* 场景探针: 打印小屋/庭院里每个可交互对象的可见性与命中开关, 用于定位"点不动/找不到合成台" */
  (function () {
    var n = 0;
    var iv = setInterval(function () {
      n++; if (n > 12) { clearInterval(iv); return; }
      try {
        var st = egret.lifecycle.stage;
        var out = [];
        function walk(node, depth) {
          if (!node || depth > 7) return;
          var kids = node.$children || [];
          for (var i = 0; i < kids.length; i++) {
            var c = kids[i]; if (!c) continue;
            var nm = c.name || (c.constructor && c.constructor.name) || '?';
            if (c.width !== undefined && (c.name || c.touchEnabled || c.visible === false)) {
              out.push(nm + '(' + Math.round(c.x) + ',' + Math.round(c.y) + ' ' + Math.round(c.width) + 'x' + Math.round(c.height) +
                       ' v=' + (c.visible ? 1 : 0) + ' t=' + (c.touchEnabled ? 1 : 0) + ')');
            }
            walk(c, depth + 1);
          }
        }
        walk(st, 0);
        console.log('[SCENE] t' + n + ' ' + out.slice(0, 26).join(' | '));
      } catch (e) {}
    }, 3000);
  })();
  /* 触摸探针: 记录每次点击的坐标与命中的对象, 用于定位"点不动"是被谁接走了事件 */
  (function () {
    var n = 0;
    try {
      var st = egret.lifecycle.stage;
      function nm(o) { try { return (o && (o.name || (o.constructor && o.constructor.name))) || '?'; } catch (e) { return '?'; } }
      st.addEventListener(egret.TouchEvent.TOUCH_BEGIN, function (ev) {
        if (n++ > 60) return;
        try {
          var t = ev.target, chain = [], p2 = t;
          for (var i = 0; i < 5 && p2; i++) { chain.push(nm(p2) + '(' + Math.round(p2.x) + ',' + Math.round(p2.y) + ')'); p2 = p2.parent; }
          console.log('[TOUCH] (' + Math.round(ev.stageX) + ',' + Math.round(ev.stageY) + ') target=' + nm(t) + ' t=' + (t && t.touchEnabled ? 1 : 0) + ' chain=' + chain.join(' < '));
        } catch (e) {}
      }, this);
    } catch (e) {}
  })();
  /* 触摸探针 v2: 直接在 document 上监听, 跨过 Egret 层, 验证点击到底走到哪一层 */
  (function () {
    var n = 0;
    function log2(where, e) {
      if (n++ > 60) return;
      try {
        var t = (e.touches && e.touches[0]) || e.changedTouches && e.changedTouches[0] || e;
        console.log('[TOUCH2] ' + where + ' x=' + Math.round(t.clientX) + ' y=' + Math.round(t.clientY) + ' type=' + e.type);
      } catch (err) {}
    }
    try {
      document.addEventListener('touchstart', function (e) { log2('doc', e); }, true);
      document.addEventListener('mousedown', function (e) { log2('doc-mouse', e); }, true);
    } catch (e) {}
  })();
})();
