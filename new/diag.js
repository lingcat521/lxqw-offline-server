/* lxqw diagnostics: capture the FULL stack of client exceptions so the crash site is identifiable */
(function(){
  var MAX = 12, n = 0;
  function compact(st){
    try { return String(st || "(no stack)").split("\n").slice(0, 8).map(function(s){ return s.trim(); }).join(" <= "); }
    catch(e){ return "(stack unreadable)"; }
  }
  function report(msg, stack){
    if (n++ > MAX) return;
    try { console.error("[DIAG#" + n + "] " + msg + " STACK: " + compact(stack)); } catch(e){}
  }
  try {
    window.addEventListener("error", function(ev){
      var e = ev && ev.error;
      report((ev && ev.message || "error") + " @ " + (ev && ev.filename || "") + ":" + (ev && ev.lineno || ""), e && e.stack);
    }, true);
  } catch(e){}
  try {
    window.addEventListener("unhandledrejection", function(ev){
      var r = ev && ev.reason;
      report("unhandledrejection: " + ((r && (r.message || r)) || "?"), r && r.stack);
    });
  } catch(e){}
  /* also report the last few protocol responses so the trigger is visible next to the stack */
  try {
    var M = window.MockServer;
    if (M && !M.__diag){
      M.__diag = 1;
      var ring = window.MOCK_RECENT = [];
      var orig = M.handle;
      M.handle = function(name, params){
        var r = orig.call(M, name, params);
        try { ring.push(name); if (ring.length > 12) ring.shift(); } catch(e){}
        return r;
      };
      window.MOCK_RECENT_PROTOCOLS = function(){ return ring.slice(); };
    }
  } catch(e){}
  try { console.log("[MOCK] diagnostics active (stack capture on)"); } catch(e){}
})();
