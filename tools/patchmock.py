p='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw/new/mock.js'
s=open(p,encoding='utf-8').read()
old='''  try {
    var sx = new XMLHttpRequest();
    sx.open("GET", "http://127.0.0.1:8089/semantic.js?t=" + Date.now(), false);
    sx.send(null);
    if (sx.responseText) { (0, eval)(sx.responseText); lg("semantic layer: " + Object.keys(window.MOCK_SEMANTIC || {}).length + " protocols"); }
  } catch (e) { wn("semantic fetch failed: " + (e && e.message || e)); }'''
new='''  (function(){
    var files = ["semantic.js", "rules.js"];
    for (var fi = 0; fi < files.length; fi++) {
      try {
        var sx = new XMLHttpRequest();
        sx.open("GET", "http://127.0.0.1:8089/" + files[fi] + "?t=" + Date.now(), false);
        sx.send(null);
        if (sx.responseText) { (0, eval)(sx.responseText); lg("loaded " + files[fi]); }
      } catch (e) { wn("load fail " + files[fi] + ": " + (e && e.message || e)); }
    }
    lg("semantic protocols: " + Object.keys(window.MOCK_SEMANTIC || {}).length);
  })();'''
if old in s:
    s=s.replace(old,new); s=s.replace('version: "0.8.0"','version: "0.9.0"')
    open(p,'w',encoding='utf-8').write(s); print('mock patched to v0.9')
elif 'rules.js' in s:
    print('already patched')
else:
    print('PATTERN MISSING')
