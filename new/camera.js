/* lxqw offline camera: 相机(全景/屏幕) + 保存图片 — additive layer.
 *
 * Two real bugs the player hit, both rooted in client code that assumes the original
 * build environment:
 *
 * A) 全景模式和屏幕模式没区别
 *    MainIn/MainOut.getCameraTexture(full, rect):
 *       if (rect)  ...                                    裁切模式用给定框
 *       else if (full) rect = (0,0,854,1420)  / (0,0,1152,1420)   <-- 写死的设计框
 *       else rect = 视口 (scrollH, (1420 - this.height)/2, this.width, this.height)
 *    写死的 854x1420 只有在 stage 正好等于设计框时才等于"整个场景"。我们做了自适应适配后
 *    stage 会是 640x1378(竖屏) 甚至 830x1136(窗口变矮时), 于是"全景"的裁剪框要么超出场景、
 *    要么和视口几乎重合 —— 两张照片看起来一样。
 *    修法(不重写原方法): 包住 getCameraTexture, full 模式下若拿到的贴图还没覆盖场景容器的
 *    真实尺寸, 就按场景真实尺寸重新 capture 一次, 并把两组尺寸写进日志。
 *
 * B) 无法保存图片
 *    CameraView.onSaveBtnTap -> BaseChannel.check_permission("album")
 *                            -> BaseChannel.save_texture_to_album(texture, true)
 *                            -> e ? "保存成功" : "保存失败"
 *    我们的渠道是 Test(channelType=1), TestChannel 没有重写这两个方法, 继承到 BaseChannel 的
 *    桩实现: check_permission 直接 true, save_texture_to_album 直接 **null** -> 必然"保存失败"。
 *    修法: 给当前渠道的 prototype 装上真实实现 —— canvas.toDataURL -> 1) 试原生
 *    PlatformFile.writeFile + save_to_album  2) POST 到 8089/shot, 落到 lxqw/screenshots/。
 */
(function () {
  var M = window.MockServer, st = window.MOCK_STATE || (window.MOCK_STATE = {});
  function log(m) { try { console.log("[CAMERA] " + m); } catch (e) {} }
  var SAVE_URL = "http://127.0.0.1:8089/shot";

  /* ---------------- A. 全景模式 ---------------- */
  function sceneOf(view) { return (view && (view.groupFull || view.groupScene)) || null; }
  function patchCapture() {
    if (typeof Main === "undefined") return 0;
    var patched = 0;
    for (var k in window) {
      var C;
      try { C = window[k]; } catch (e) { continue; }
      if (typeof C !== "function" || !C.prototype) continue;
      var fn = C.prototype.getCameraTexture;
      if (typeof fn !== "function" || fn.__mockCamera) continue;
      (function (C, fn) {
        C.prototype.getCameraTexture = function (full, rect) {
          var tex = fn.call(this, full, rect);
          try {
            var scene = sceneOf(this);
            var sw = Math.max(Number(Main.stageWidth) || 0, (scene && scene.width) || 0);
            var sh = Math.max(Number(Main.stageHeight) || 0, (scene && scene.height) || 0);
            var tw = tex ? (tex.textureWidth || tex.width) : 0;
            var th = tex ? (tex.textureHeight || tex.height) : 0;
            log((full ? "全景" : "屏幕") + "模式 捕获 " + tw + "x" + th + " | 场景 " + (scene && scene.width) + "x" + (scene && scene.height) +
                " | stage " + Main.stageWidth + "x" + Main.stageHeight + " | 需要 " + sw + "x" + sh);
            /* 全景 = 整个场景: 无条件按场景真实尺寸(不小于 stage)重拍一次,
               写死的 854x1420 / 1152x1420 在自适应 stage 下可能比场景还小或完全错位 */
            if (full && !rect && scene && typeof Utils !== "undefined" && Utils.Capture) {
              var again = Utils.Capture.instance().captureTexture(scene, new egret.Rectangle(0, 0, sw, sh));
              if (again) {
                log("全景模式: 重拍为场景尺寸 -> " + (again.textureWidth || again.width) + "x" + (again.textureHeight || again.height));
                tex = again;
              }
            }
          } catch (e) { log("捕获探测失败: " + (e && e.message || e)); }
          return tex;
        };
        C.prototype.getCameraTexture.__mockCamera = 1;
        patched++;
      })(C, fn);
    }
    return patched;
  }

  /* ---------------- B. 保存图片 ---------------- */
  function channelProto() {
    try {
      var ch = BaseChannel.getInstance();
      return ch ? Object.getPrototypeOf(ch) : null;
    } catch (e) { return null; }
  }
  function saveTexture(channel, texture, flag) {
    return new Promise(function (resolve) {
      var url = null;
      try {
        var canvas = null;
        try { canvas = BaseChannel.prototype.textureToCanvas.call(channel, texture); } catch (e) {}
        if (canvas && canvas.toDataURL) url = canvas.toDataURL("image/jpeg", 0.92);
        else if (texture && texture.toDataURL) url = texture.toDataURL("image/png");
      } catch (e) { log("取画布失败: " + (e && e.message || e)); }
      if (!url) { log("保存失败: 无法把贴图转成图片数据"); resolve(false); return; }

      /* 1) 原生路径(有就顺带存进系统相册) */
      var nativeTried = false, nativeOk = false;
      try {
        if (typeof core !== "undefined" && core.PlatformFile && typeof Utils !== "undefined" && Utils.base64ToArrayBuffer) {
          nativeTried = true;
          var b64 = url.replace(/^data:image\/[a-z]+;base64,/, "");
          core.PlatformFile.getPath("temp_picture.jpg").then(function (p) {
            return core.PlatformFile.writeFile(p, Utils.base64ToArrayBuffer(b64), true).then(function () {
              try { return BaseChannel.prototype.save_to_album.call(channel, p, true); } catch (e) { return false; }
            });
          }).then(function (r) { nativeOk = !!r; log("原生保存相册 -> " + (nativeOk ? "成功" : "未确认")); })
            ["catch"](function (e) { log("原生保存失败: " + (e && e.message || e)); });
        }
      } catch (e) { log("原生保存异常: " + (e && e.message || e)); }

      /* 2) 本地服务兜底: 一定落到 lxqw/screenshots/ */
      try {
        var x = new XMLHttpRequest();
        x.open("POST", SAVE_URL, true);
        try { x.setRequestHeader("Content-Type", "text/plain"); } catch (e) {}
        x.onload = function () {
          log("已保存 -> " + SAVE_URL + " 返回: " + String(x.responseText).slice(0, 60) + " (" + url.length + "B)");
          resolve(true);
        };
        x.onerror = function () {
          log("本地保存失败(8089 不可达), 原生路径: " + (nativeTried ? (nativeOk ? "成功" : "未确认") : "未尝试"));
          resolve(nativeOk);
        };
        x.send(url);
      } catch (e) { log("保存请求异常: " + (e && e.message || e)); resolve(nativeOk); }
    });
  }
  function patchSave() {
    var proto = channelProto();
    if (!proto) return false;
    if (proto.save_texture_to_album && proto.save_texture_to_album.__mockCamera) return true;
    try {
      var orig = proto.save_texture_to_album;
      proto.save_texture_to_album = function (texture, flag) {
        log("保存图片: 原实现返回 " + (orig ? "一个桩值" : "无") + ", 改用本地实现");
        return saveTexture(this, texture, flag);
      };
      proto.save_texture_to_album.__mockCamera = 1;
      if (typeof proto.check_permission !== "function") {
        proto.check_permission = function () { return Promise.resolve(true); };
      }
      return true;
    } catch (e) { log("保存补丁失败: " + (e && e.message || e)); return false; }
  }

  var tries = 0;
  function apply() {
    var a = patchCapture(), b = patchSave();
    if (a || b) log("相机补丁: 捕获 " + a + " 处, 保存 " + (b ? "已接管" : "未接管"));
    return a > 0 && b;
  }
  if (!apply()) {
    var iv = setInterval(function () { if (apply() || ++tries > 100) clearInterval(iv); }, 300);
  }
})();
