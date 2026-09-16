/* lxqw 协议条款占位文案修正 —— new/termsfix.js
 *   现象: 邮箱等弹窗里出现 "各种条款说明各种条款说明各种条款说明各种条款说明"
 *         (来自 APK 自己的 assets/game/js/default.thm.js:21463, 是原包/前人改动留下的占位符)
 *   做法: 运行时把显示列表里含这段占位符的 TextField 换成正常文案 —— 不用重打包 APK。
 *        只在"弹窗层存在且真的出现占位符"时才遍历, 找到即替换并停止(零代价)。
 */
(function () {
  var BAD = '各种条款说明';
  var GOOD = '本服为离线单机模拟服，仅供个人学习与交流使用。';
  function log(m) { try { console.log('[MOCK] 条款: ' + m); } catch (e) {} }
  var fixed = 0, warned = 0;
  function walk(o, depth) {
    if (!o || depth > 6) return 0;
    var n = 0;
    try {
      if (o.text !== undefined && typeof o.text === 'string' && o.text.indexOf(BAD) >= 0) { o.text = GOOD; n++; }
    } catch (e) {}
    var kids = o.$children || o.numChildren !== undefined ? null : null;
    try {
      var list = (o.$children) ? o.$children : null;
      if (!list && o.numChildren !== undefined) { list = []; for (var i = 0; i < o.numChildren; i++) list.push(o.getChildAt(i)); }
      if (list) for (var j = 0; j < list.length; j++) n += walk(list[j], depth + 1);
    } catch (e) {}
    return n;
  }
  function sweep() {
    try {
      if (typeof core === 'undefined' || !core.DisplayManage) return;
      var layer = core.DisplayManage.getInstance().getPopupLayer();
      if (!layer || !layer.numChildren) return;
      var total = walk(layer, 0);
      if (total > 0) { fixed += total; log('替换协议条款占位文案 ' + total + ' 处 -> "' + GOOD + '" (累计 ' + fixed + ')'); }
    } catch (e) { if (warned++ < 1) log('扫描失败: ' + (e && e.message)); }
  }
  setInterval(sweep, 1500);
  setTimeout(sweep, 1200);
  log('就绪: 弹窗里出现"' + BAD + '"时会被替换成正常文案(不改 APK)');
  /* 自动关闭"协议条款"弹窗: 它每次都会挡住礼包码兑换的结果提示(用户反馈)。
     做法: 找到弹窗里名字像按钮(btn/ok/yes/close/confirm)且可点的节点, 派发一次 TOUCH_TAP。 */
  function findBtn(o, depth) {
    if (!o || depth > 7) return null;
    try {
      var nm = String(o.name || '');
      if (o.touchEnabled && /btn|ok|yes|close|confirm|sure/i.test(nm)) return o;
    } catch (e) {}
    var list = null;
    try { list = o.$children || null; } catch (e) {}
    if (list) for (var i = 0; i < list.length; i++) { var r = findBtn(list[i], depth + 1); if (r) return r; }
    return null;
  }
  var closed = 0;
  function autoClose(layer) {
    try {
      var btn = findBtn(layer, 0);
      if (!btn) return;
      var ev = new egret.TouchEvent(egret.TouchEvent.TOUCH_TAP, btn.x, btn.y, btn);
      btn.dispatchEvent(ev);
      if (closed++ < 3) log('已自动关闭协议弹窗(按钮 ' + (btn.name || '?') + ')');
    } catch (e) {}
  }
  setInterval(function () {
    try {
      if (typeof core === 'undefined' || !core.DisplayManage) return;
      var layer = core.DisplayManage.getInstance().getPopupLayer();
      if (!layer || !layer.numChildren) return;
      var hit = false;
      (function scan(o, d) {
        if (!o || d > 6 || hit) return;
        try { if (o.text === GOOD) hit = true; } catch (e) {}
        var list = null; try { list = o.$children || null; } catch (e) {}
        if (list) for (var i = 0; i < list.length; i++) scan(list[i], d + 1);
      })(layer, 0);
      if (hit) autoClose(layer);
    } catch (e) {}
  }, 2000);
})();
