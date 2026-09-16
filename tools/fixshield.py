BASE='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw'
p=BASE+'/new/harden.js'
s=open(p,encoding='utf-8').read()
if 'renderItem' not in s:
    add = '''
  /* ---- generic view crash shield ----
     Every list view funnels through a renderItem()/onAddToStage() pair. A single
     index mismatch there used to throw on EVERY frame. Wrap them so a failure is
     logged once instead of killing the render loop. */
  function shieldMethods(){
    var wrapped = 0, names = [];
    for (var k in window) {
      try {
        var C = window[k];
        if (typeof C !== "function" || !C.prototype) continue;
        var names2 = ["renderItem","onAddToStage","dataChanged"];
        for (var j=0;j<names2.length;j++){
          var mn = names2[j];
          var fn = C.prototype[mn];
          if (typeof fn !== "function" || fn.__mockShield) continue;
          (function(C, mn, fn){
            var guardCount = 0;
            C.prototype[mn] = function(){
              try { return fn.apply(this, arguments); }
              catch(e){
                if (guardCount++ < 3) { try { console.warn("[MOCK] shielded " + mn + ": " + (e && e.message || e)); } catch(e2){} }
                return undefined;
              }
            };
            C.prototype[mn].__mockShield = 1;
            wrapped++;
          })(C, mn, fn);
          if (names.length < 12) names.push(k+"."+mn);
        }
      } catch(e){}
    }
    return { wrapped: wrapped, names: names };
  }
  try {
    var r = shieldMethods();
    try { console.log("[MOCK] view shield: wrapped " + r.wrapped + " methods (" + r.names.slice(0,8).join(", ") + ")"); } catch(e){}
  } catch(e){}
'''
    s=s.replace('})();', add + '})();')
    open(p,'w',encoding='utf-8').write(s); print('harden: view shield added')
else: print('already')
