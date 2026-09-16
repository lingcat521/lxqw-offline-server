/* lxqw offline save-state: real persistence via the dev server (/load + /save) */
(function () {
  var M = window.MockServer, st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var BASEURL = "http://127.0.0.1:8089/";
  function get(u){ var x = new XMLHttpRequest(); x.open("GET", u, false); x.send(null); return x.responseText; }
  try {
    var t = get(BASEURL + "load?t=" + Date.now());
    if (t && t.indexOf("no save") < 0) {
      var sv = JSON.parse(t);
      for (var k in sv) {
        if (k === "frog") { if (!st.frog) st.frog = {}; for (var f in sv.frog) st.frog[f] = sv.frog[f]; }
        else st[k] = sv[k];
      }
      try { console.log("[MOCK] save restored: clover=" + st.clover + " notes=" + ((st.notes||[]).length) + " photos=" + ((st.photos||[]).length) + " bag=" + JSON.stringify(st.bag)); } catch(e){}
    } else { try { console.log("[MOCK] no save yet - new game"); } catch(e){} }
  } catch (e) { try { console.log("[MOCK] save restore failed: " + (e && e.message || e)); } catch(e2){} }
  /* migrate legacy saves: bag/desk must be 8 slots with -1 for empty */
  function normN(a, n){ var out=[]; for (var j=0;j<n;j++) out.push(-1); if (Array.isArray(a)){ var k=0; for (var i=0;i<a.length && k<n;i++){ var v=a[i]; if (typeof v === "number" && v >= 0){ out[k++]=v; } } } return out; }
  st.bag = normN(st.bag, 4); st.desk = normN(st.desk, 8);
  try { console.log("[MOCK] slots normalised: bag=" + JSON.stringify(st.bag) + " desk=" + JSON.stringify(st.desk)); } catch(e){}
  function save(){
    try {
      var x = new XMLHttpRequest(); x.open("POST", BASEURL + "save", true);
      try { x.setRequestHeader("Content-Type", "text/plain"); } catch(e){}
      x.send(JSON.stringify(st));
    } catch (e) {}
  }
  /* debounce, but never starve: layers save() from their own timers, so a plain
     1s debounce can be postponed forever and the /save POST then only happens on
     the 8s interval below.  Guarantee a flush within SAVE_MAX_DELAY. */
  var SAVE_MAX_DELAY = 1200;
  var timer = null, firstPending = 0;
  window.MOCK_SAVE = function(){
    var now = Date.now();
    if (!firstPending) firstPending = now;
    if (timer) { clearTimeout(timer); timer = null; }
    if (now - firstPending >= SAVE_MAX_DELAY) { firstPending = 0; save(); return; }
    timer = setTimeout(function(){ timer = null; firstPending = 0; save(); }, 1000);
  };
  /* 立刻落盘(GM 调试命令/关键结算用): 不走 1 秒防抖, 免得 reload/退出把这次改动冲掉 */
  window.MOCK_SAVE_NOW = function () {
    try { if (timer) { clearTimeout(timer); timer = null; } firstPending = 0; save(); return true; } catch (e) { return false; }
  };
  if (M && M.handle) {
    var orig = M.handle;
    M.handle = function (name, params) { var r = orig.call(M, name, params); try { window.MOCK_SAVE(); } catch(e){} return r; };
  }
  setInterval(save, 8000);
  try { console.log("[MOCK] persistence ready"); } catch(e){}
  /* 包内自足: 没有 8089 时用 localStorage 存档(APK 内运行不再依赖开发服) */
  function LS_get() { try { return localStorage.getItem('lxqw_save_v1'); } catch (e) { return null; } }
  function LS_set(t) { try { localStorage.setItem('lxqw_save_v1', t); } catch (e) {} }
  window.MOCK_LS_SAVE = function () {
    try {
      var txt = JSON.stringify(st);
      LS_set(txt);
      try { var ping = new XMLHttpRequest(); ping.open('POST', BASEURL + 'save', false); ping.send(txt); } catch (e) {}
      return txt.length;
    } catch (e) { return 0; }
  };
  (function () {
    var local = LS_get();
    if (local && local.length > 50) {
      try {
        var sv2 = JSON.parse(local);
        for (var k in sv2) if (Object.prototype.hasOwnProperty.call(sv2, k)) st[k] = sv2[k];
        try { console.log('[MOCK] 存档: 已从包内 localStorage 恢复 (' + local.length + 'B)'); } catch (e) {}
      } catch (e) {}
      return;
    }
    try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {}
    try { console.log('[MOCK] 存档: 包内暂无存档 -> 全新开始'); } catch (e) {}
  })();
  /* 关键协议: 处理完立刻落盘(不走 1.2s 防抖), 避免"刚做完就杀进程"丢进度 */
  var CRITICAL = /^(client_set_client|item_buy|item_use_gift_code|item_putin_bag|item_takeout_bag|item_putin_desk|item_takeout_desk|item_select_gift|item_set_bag_completed|furniture_putin_bench|furniture_takeout_bench|furniture_buy_shop|clover_harvest|clover_harvest_resend|travel_depart|travel_call_back|travel_read_note|story_read_new_story|story_send_gift|mail_open|mail_load_mails|guest_confirm|guest_serve|guest_finish|pray_compose|drawing_|calendar_get_st_reward|task_client_pro|rank_like)$/;
  (function () {
    try {
      var M = window.MockServer; if (!M || !M.handle) return;
      var orig2 = M.handle;
      M.handle = function (name, params) {
        var r = orig2.call(M, name, params);
        try { if (CRITICAL.test(String(name))) { if (window.MOCK_SAVE_NOW) window.MOCK_SAVE_NOW(); else if (window.MOCK_SAVE) window.MOCK_SAVE(); } } catch (e) {}
        return r;
      };
      try { console.log('[MOCK] 存档: 关键协议即时落盘已启用'); } catch (e) {}
    } catch (e) {}
  })();
})();
