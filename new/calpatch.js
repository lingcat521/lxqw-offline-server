/* lxqw: 日历运行时叠加层 - additive layer.
 * 底图(553x648)把「癸卯兔年」「2023」和当天标记都画死了, 且底图是 2023 版面;
 * 这里在月份位图之上: ①盖掉年份/干支两块并写当前真实年份+干支+生肖;
 * ②按真实日期在正确格子上画一枚标记环(服务端已不发 lucky_days, 底图那颗错位的花不会再出现)。
 */
(function () {
  function lg(m) { try { console.log('[MOCK] ' + m); } catch (e) {} }
  function gz(y) { var s='甲乙丙丁戊己庚辛壬癸', b='子丑寅卯辰巳午未申酉戌亥'; return s[(y-4)%10]+b[(y-4)%12]; }
  function zo(y) { return '鼠牛虎兔龙蛇马羊猴鸡狗猪'[(y-4)%12]; }
  var W = 553, H = 648, done = 0;
  /* 底图版面几何(从 calendar_9.png 逐带量出) */
  var COLCX = [52, 125, 201, 275, 347, 423, 489];
  var ROWY  = [210, 275, 339, 408, 474];   /* 修正: 扫描时漏掉了第一行(28..3), 导致环/遮罩整体下移一行 */
  var ART_YEAR = 2023;
  function patch(bmp) {
    try {
      var par = bmp.parent; if (!par) return false;
      var sx = (bmp.width || W) / W, sy = (bmp.height || H) / H;
      var bx = bmp.x - (bmp.anchorOffsetX || 0), by = bmp.y - (bmp.anchorOffsetY || 0);
      lg('日历叠加: 位图 x=' + Math.round(bmp.x) + ' y=' + Math.round(bmp.y) + ' w=' + Math.round(bmp.width) + ' h=' + Math.round(bmp.height) + ' anchor=' + Math.round(bmp.anchorOffsetX || 0) + ',' + Math.round(bmp.anchorOffsetY || 0));
      var d = new Date(), y = d.getFullYear(), today = d.getDate();
      /* 纸面有纹理: 从位图自身采样遮挡色, 避免出现一块明显色差 */
      function sampleColour(ax, ay) {
        try {
          var bd = bmp.texture && bmp.texture.bitmapData, src = bd && bd.source;
          if (!src) return 0xf7f4ea;
          var cv = document.createElement('canvas'); cv.width = 6; cv.height = 6;
          var ctx = cv.getContext('2d');
          ctx.drawImage(src, Math.max(0, ax - 3), Math.max(0, ay - 3), 6, 6, 0, 0, 6, 6);
          var d = ctx.getImageData(0, 0, 6, 6).data;
          return (d[0] << 16) | (d[1] << 8) | d[2];
        } catch (e) { return 0xf7f4ea; }
      }
      var bgYear = sampleColour(280, 598), bgGz = sampleColour(470, 100);
      var sh = new egret.Shape();
      sh.graphics.beginFill(bgYear, 1);
      sh.graphics.drawRect(bx + 232 * sx, by + 564 * sy, 96 * sx, 46 * sy);   /* 2023 */
      sh.graphics.drawRect(bx + 398 * sx, by + 78 * sy, 150 * sx, 44 * sy);   /* 癸卯兔年 */
      sh.graphics.endFill();
      par.addChild(sh);
      function label(txt, px, py, size) {
        var t = new egret.TextField();
        t.text = txt; t.size = Math.round(size * sy); t.textColor = 0x8a7a5c;
        t.x = bx + px * sx; t.y = by + py * sy;
        par.addChild(t);
      }
      label(String(y), 248, 570, 26);
      label(gz(y) + zo(y) + '年', 406, 84, 22);
      /* 今天所在格(按**底图年**版面算), 画一枚环 */
      var first = new Date(ART_YEAR, d.getMonth(), 1);
      var cell = ((first.getDay() + 6) % 7) + today;      /* 实测: 客户端 1 基格子编号 */
      var col = (cell - 1) % 7, row = Math.floor((cell - 1) / 7);
      if (row < ROWY.length) {
        var ring = new egret.Shape();
        ring.graphics.lineStyle(2, 0xe8a33d, 1);
        ring.graphics.drawCircle(bx + COLCX[col] * sx, by + (ROWY[row] - 16) * sy, 22 * Math.min(sx, sy));
        par.addChild(ring);
      }
      var srv = '';
      try { srv = core.Time.getServerTime(); } catch (e) {}
      /* 客户端自己会在"它算出的今天格"上画一朵 calendar_icon_lucky(错格)。
         它晚于本层加入, 所以这里延后一拍、用周边纸色盖住那一格, 只留我画的环。 */
      function coverClientFlower() {
        try {
          var dd = new Date(), f2 = new Date(dd.getFullYear(), dd.getMonth(), 1);
          var cCell = ((f2.getDay() + 6) % 7) + dd.getDate();   /* 客户端按真实年份算的格号 */
          var cCol = (cCell - 1) % 7, cRow = Math.floor((cCell - 1) / 7);
          if (cRow >= ROWY.length) return;
          var cov = new egret.Shape();
          cov.touchEnabled = false;
          cov.graphics.beginFill(sampleColour(COLCX[cCol], ROWY[cRow] - 16), 1);
          cov.graphics.drawRect(bx + (COLCX[cCol] - 34) * sx, by + (ROWY[cRow] - 40) * sy, 68 * sx, 44 * sy);
          cov.graphics.endFill();
          par.addChild(cov);   /* 后加入 -> z 序在客户端花之上 */
          lg('日历叠加: 已覆盖客户端花所在格 ' + cCell + ' (环在 ' + cell + ')' );
        } catch (e) {}
      }
      /* 客户端可能反复重绘它自己的花, 所以周期性重加遮罩(只在这张日历上) */
      var __cvTries = 0;
      var __cvIv = setInterval(function () { coverClientFlower(); if (++__cvTries > 30) clearInterval(__cvIv); }, 1200);
      lg('日历叠加: 年份 ' + y + ' ' + gz(y) + zo(y) + '年, 今日格 ' + cell +
         ' | deviceDate=' + d.toString() + ' | serverTime=' + srv + ' | lucky=' + JSON.stringify((window.__lastLucky || null)) + ' | newFlag=' + JSON.stringify((window.__lastNewFlag || null)));
      return true;
    } catch (e) { lg('日历叠加失败: ' + (e && e.message || e)); return false; }
  }
  function scan() {
    try {
      if (!egret || !egret.lifecycle || !egret.lifecycle.stage) return;
      var st = egret.lifecycle.stage, stack = (st.$children || []).slice(), guard = 0;
      while (stack.length && guard++ < 5000) {
        var n = stack.pop(); if (!n) continue;
        try {
          var t = n.texture;
          var src = String(n.source || '');
          /* 只认日历底图 calendar_*.png —— 以前只按尺寸(553x648±40)匹配, 充值页等同样大小的位图也被叠上日历内容 */
          var isCal = src.indexOf('calendar_') === 0 || /calendar_[0-9]+/.test(src);
          if (isCal && t && Math.abs((t.textureWidth || 0) - W) < 40 && Math.abs((t.textureHeight || 0) - H) < 40 && !n.__calPatched2) {
            n.__calPatched2 = true; if (patch(n)) done++;
          }
        } catch (e) {}
        if (n.$children && n.$children.length) for (var i = 0; i < n.$children.length; i++) stack.push(n.$children[i]);
      }
    } catch (e) {}
  }
  var iv = setInterval(function () { scan(); }, 1500);
  setTimeout(function () { if (!done) lg('日历叠加: 本轮未发现日历位图(未打开日历页时正常)'); }, 20000);
})();