p='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw/new/mock.js'
s=open(p,encoding='utf-8').read()
if 'persist.js' not in s:
    old='''    try { patchSDK(); } catch(e) { wn("sdk patch "+e); }
    lg("installed v"+Mock.version'''
    new='''    try { patchSDK(); } catch(e) { wn("sdk patch "+e); }
    /* late layers need Mock + the game's classes to exist */
    (function(){
      var extra = ["persist.js", "iap.js"];
      for (var i = 0; i < extra.length; i++) {
        try {
          var x = new XMLHttpRequest();
          x.open("GET", "http://127.0.0.1:8089/" + extra[i] + "?t=" + Date.now(), false);
          x.send(null);
          if (x.responseText) { (0, eval)(x.responseText); lg("loaded " + extra[i]); }
        } catch (e) { wn("load fail " + extra[i] + ": " + (e && e.message || e)); }
      }
    })();
    lg("installed v"+Mock.version'''
    assert old in s, 'install anchor missing'
    s=s.replace(old,new).replace('version: "0.11.0"','version: "0.12.0"')
    open(p,'w',encoding='utf-8').write(s); print('mock patched for late layers')
else: print('already patched')
