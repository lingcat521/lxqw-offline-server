BASE='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw'
# 1) mock: add mail.js to the late layers
p=BASE+'/new/mock.js'
s=open(p,encoding='utf-8').read()
if 'mail.js' not in s:
    s=s.replace('var extra = ["persist.js", "iap.js"];','var extra = ["persist.js", "iap.js", "mail.js"];')
    s=s.replace('version: "0.12.0"','version: "0.13.0"')
    open(p,'w',encoding='utf-8').write(s); print('mock: mail.js mounted')
else: print('mock: already')
# 2) persist: normalise legacy bag/desk to 8 slots on restore
p2=BASE+'/new/persist.js'
t=open(p2,encoding='utf-8').read()
if 'norm8' not in t:
    anchor="  function save(){"
    add='''  /* migrate legacy saves: bag/desk must be 8 slots with -1 for empty */
  function norm8(a){ var out=[-1,-1,-1,-1,-1,-1,-1,-1]; if (Array.isArray(a)){ var k=0; for (var i=0;i<a.length && k<8;i++){ var v=a[i]; if (typeof v === "number" && v >= 0){ out[k++]=v; } } } return out; }
  st.bag = norm8(st.bag); st.desk = norm8(st.desk);
  try { console.log("[MOCK] slots normalised: bag=" + JSON.stringify(st.bag) + " desk=" + JSON.stringify(st.desk)); } catch(e){}
'''
    if anchor in t:
        t=t.replace(anchor, add+anchor); open(p2,'w',encoding='utf-8').write(t); print('persist: normaliser added')
    else: print('persist: ANCHOR MISSING')
else: print('persist: already')
