import io
BASE='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw'
# ---- guard.js: dynamic bag capacity from the client's live guideStep ----
p=BASE+'/new/guard.js'
s=open(p,encoding='utf-8').read()
if 'bagCap' not in s:
    s=s.replace('''  var BAG_MAX = 3, DESK_MAX = 8;''',
'''  var DESK_MAX = 8;
  /* Bag.renderItem(): this.items=[item0..item3] (4 cells) BUT
     if (guideStep == GuideStep.OpenBag) this.items.splice(2,2)  -> only 2 cells.
     The client indexes items[i] with our bagDataList index, so our array length
     must be <= the CURRENT cell count. Read it from the live client state. */
  function bagCap(){
    try {
      if (typeof core === "undefined" || typeof UserModel === "undefined") return 4;
      var um = core.ModelManage.getInstance().getModel(UserModel);
      var gs = (um && um.getClientSettings) ? um.getClientSettings().guideStep : null;
      if (gs === "OpenBag") return 2;
      return 4;
    } catch(e){ return 4; }
  }''')
    s=s.replace('''        d.bag = clampSlots(d.bag, BAG_MAX);''',
'''        d.bag = clampSlots(d.bag, bagCap());''')
    open(p,'w',encoding='utf-8').write(s); print('guard: dynamic bagCap() installed')
else: print('guard already')
# ---- persist: keep up to 4 bag slots so items survive ----
p2=BASE+'/new/persist.js'
t=open(p2,encoding='utf-8').read()
if 'normN(st.bag, 3)' in t:
    t=t.replace('normN(st.bag, 3)','normN(st.bag, 4)'); open(p2,'w',encoding='utf-8').write(t); print('persist: bag keeps 4')
elif 'normN(st.bag, 4)' in t: print('persist already 4')
else: print('persist pattern missing')
# ---- rules: default bag = 4 slots ----
p3=BASE+'/tools/genrules.py'
g=open(p3,encoding='utf-8').read()
if 'BAG_SLOTS = 4' not in g:
    g=g.replace('var BAG_SLOTS = 3, DESK_SLOTS = 8;','var BAG_SLOTS = 4, DESK_SLOTS = 8;')
    open(p3,'w',encoding='utf-8').write(g); print('genrules: BAG_SLOTS=4')
else: print('genrules already 4')
