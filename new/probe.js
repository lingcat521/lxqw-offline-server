/* lxqw runtime probe (v0.23): everything that can silently go wrong, watched.
 *
 * Born from the 年度回顾 bug: annual_load answered {} so every "{0}" in the
 * review sentences was substituted with undefined and the player read
 * "一共雕刻了undefined个印章 / 完成了undefined个祈愿物".
 *
 * Probes installed:
 *   1. egret.TextField.prototype.text  - every Label/BitmapLabel the client draws
 *   2. the i18n helper _()             - catches it at the formatting source, and
 *                                        also unsubstituted "{0}" placeholders
 *   3. Mock.handle                     - payloads containing explicit undefined
 *   4. core.ServiceDispatcher          - EVERY protocol event the server sends:
 *                                        one shape line per event name (twice),
 *                                        a loud warning when the payload is the
 *                                        placeholder proxy (== no handler exists)
 *                                        or contains undefined
 * Reports go through console.error with a stack, which the apk log shim forwards
 * to the 8088 log server, so the device log names the offender directly.
 */
(function () {
  var seen = {}, hits = 0, MAX = 60;
  function lg(m) { try { console.log("[MOCK] " + m); } catch (e) {} }
  function stack() { try { return String((new Error()).stack || "").split("\n").slice(1, 7).join(" <- "); } catch (e) { return ""; } }
  function report(kind, text, extra) {
    var s = String(text);
    var key = kind + "|" + s.slice(0, 60);
    if (seen[key]) return;
    seen[key] = 1; hits++;
    if (hits > MAX) return;
    try { console.error("[PROBE] " + kind + " :: " + s.slice(0, 220) + (extra ? " | " + extra : "") + "\nSTACK: " + stack()); } catch (e) {}
  }
  function bad(s) { return typeof s === "string" && /undefined|NaN/.test(s); }

  /* 1) every text drawn by the client */
  try {
    if (typeof egret !== "undefined" && egret.TextField && egret.TextField.prototype) {
      var d = Object.getOwnPropertyDescriptor(egret.TextField.prototype, "text");
      if (d && d.set) {
        Object.defineProperty(egret.TextField.prototype, "text", {
          configurable: true, enumerable: !!d.enumerable, get: d.get,
          set: function (v) { if (bad(v)) report("undefined-text", v); return d.set.call(this, v); }
        });
        lg("probe: TextField.text armed");
      } else { lg("probe: TextField.text descriptor missing"); }
    }
  } catch (e) { lg("probe: TextField hook failed: " + (e && e.message || e)); }

  /* 2) the i18n helper, wrapped as soon as it exists */
  var tries = 0;
  function wrapI18n() {
    try {
      if (typeof window._ !== "function") return false;
      if (window._.__probed) return true;
      var orig = window._;
      var w = function () {
        var out = orig.apply(this, arguments);
        if (typeof out === "string" && (bad(out) || /\{[0-9]\}/.test(out))) {
          report("i18n", out, "args=" + JSON.stringify(Array.prototype.slice.call(arguments, 1)).slice(0, 160));
        }
        return out;
      };
      w.__probed = true;
      window._ = w;
      lg("probe: i18n _() armed");
      return true;
    } catch (e) { return true; }
  }
  if (!wrapI18n()) {
    var iv = setInterval(function () { if (wrapI18n() || ++tries > 120) clearInterval(iv); }, 250);
  }

  /* 3) explicit undefined inside a mock answer */
  try {
    var M = window.MockServer;
    if (M && M.handle && !M.handle.__probed) {
      var origH = M.handle;
      var h = function (name, params) {
        var r = origH.call(M, name, params);
        if (r && typeof r === "object") {
          var undef = [];
          for (var k in r) if (r[k] === undefined) undef.push(k);
          if (undef.length) report("payload-undefined", name + " -> " + undef.join(","), "");
        }
        return r;
      };
      h.__probed = true;
      M.handle = h;
      lg("probe: payload scan armed");
    }
  } catch (e) { lg("probe: payload hook failed: " + (e && e.message || e)); }

  /* 4) trace EVERY protocol event the server delivers */
  function shape(data) {
    if (data === null || data === undefined) return String(data);
    if (typeof data === "function") return "PLACEHOLDER-PROXY (no handler)";
    if (typeof data !== "object") return typeof data + "=" + JSON.stringify(data);
    var keys = [], undef = [];
    for (var k in data) { keys.push(k); if (data[k] === undefined) undef.push(k); }
    if (!keys.length) return "{} (empty object)";
    return "{" + keys.slice(0, 16).join(",") + (keys.length > 16 ? ",+" + (keys.length - 16) + " more" : "") + "}" +
           (undef.length ? "  UNDEFINED:" + undef.join(",") : "");
  }
  var eventSeen = {};
  function traceWrap(origD) {
    var nd = function (e) {
      try {
        var name = (e && e.type) || "?", s = shape(e && e.data);
        if (/PLACEHOLDER-PROXY/.test(s)) report("no-handler-event", String(name), "server sent the placeholder payload");
        var n = eventSeen[name] = (eventSeen[name] || 0) + 1;
        if (n <= 2 || /UNDEFINED|empty object/.test(s)) lg("event " + name + " #" + n + " -> " + s);
      } catch (x) {}
      return origD.apply(this, arguments);
    };
    nd.__probed = true;
    return nd;
  }
  try {
    /* 真实的分发器既可能在原型上、也可能是单例实例上的自有方法 —— 两处都包,
       否则事件探针一条都不会打出来(上一版就是漏在实例上, 日志里没有 event 行) */
    var dp = (typeof core !== "undefined" && core.ServiceDispatcher && core.ServiceDispatcher.prototype) ? core.ServiceDispatcher.prototype : null;
    if (dp && typeof dp.dispatchEvent === "function" && !dp.dispatchEvent.__probed) {
      dp.dispatchEvent = traceWrap(dp.dispatchEvent);
      lg("probe: ServiceDispatcher prototype trace armed");
    }
    if (typeof core !== "undefined" && core.ServiceDispatcher && core.ServiceDispatcher.getInstance) {
      var inst = core.ServiceDispatcher.getInstance();
      if (inst && typeof inst.dispatchEvent === "function" && !inst.dispatchEvent.__probed) {
        inst.dispatchEvent = traceWrap(inst.dispatchEvent);
        lg("probe: ServiceDispatcher instance trace armed");
      }
    }
  } catch (e) { lg("probe: event trace failed: " + (e && e.message || e)); }

  /* 5) 旅行笔记 path probe: the device log will say exactly what the client got.
        (the player reported the note content could not be opened, so watch the
         note list, the per-item render, and any missing note/word texture) */
  try {
    var TNM = window.TravelNoteModel;
    if (TNM && TNM.prototype && TNM.prototype.travel_load_note && !TNM.prototype.travel_load_note.__probed) {
      var otn = TNM.prototype.travel_load_note;
      var ntn = function (e, t) {
        var r = otn.apply(this, arguments);
        try {
          var got = (e && Array.isArray(e.note_list)) ? e.note_list.length : -1;
          var kept = this.travelNodeList ? this.travelNodeList.length : -1;
          lg("prob 笔记列表: 收到 " + got + " 条, 保留 " + kept + " 条" + (got !== kept ? "  <-- " + (got - kept) + " 条 id 不在 Note 表" : ""));
        } catch (x) {}
        return r;
      };
      ntn.__probed = 1; TNM.prototype.travel_load_note = ntn;
      lg("probe: 笔记列表 armed");
    }
  } catch (e) { lg("probe: 笔记列表 hook failed"); }
  try {
    var TNI = window.TravelNoteItem;
    if (TNI && TNI.prototype && TNI.prototype.update && !TNI.prototype.update.__probed) {
      var oup = TNI.prototype.update;
      var nup = function () {
        try {
          var d = this.data && this.data.data;
          if (d) {
            var cfg = d.config;
            var words = cfg ? String(cfg.info).split(/[\n\r]+/).reduce(function (a, l) { return a + l.split(',').filter(function (x) { return x !== ''; }).length; }, 0) : -1;
            lg("prob 笔记渲染 id=" + d.id + " config=" + (cfg ? "有" : "缺失") + " 字数=" + words);
          }
        } catch (x) {}
        return oup.apply(this, arguments);
      };
      nup.__probed = 1; TNI.prototype.update = nup;
      lg("probe: 笔记渲染 armed");
    }
  } catch (e) { lg("probe: 笔记渲染 hook failed"); }
  try {
    if (typeof RES !== "undefined" && RES.getRes && !RES.getRes.__probed) {
      var ogr = RES.getRes;
      var ngr = function (k) {
        var v = ogr.apply(this, arguments);
        try {
          if ((v === undefined || v === null) && typeof k === "string" && /Scene\/Note|Words|^word_|^pic_1/.test(k)) {
            report("res-miss", k, "note/word texture is not loaded");
          }
        } catch (x) {}
        return v;
      };
      ngr.__probed = 1; RES.getRes = ngr;
      lg("probe: RES.getRes 笔记贴图监测 armed");
    }
  } catch (e) { lg("probe: RES hook failed"); }

})();
