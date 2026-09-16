BASE='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw'
import io
# ---- 1) rules.js source: bag=3 slots, desk=8, guideStep Complete ----
p=BASE+'/tools/genrules.py'
s=open(p,encoding='utf-8').read()
if 'BAG_SLOTS' not in s:
    s=s.replace("""  function SLOTS(){ return [-1,-1,-1,-1,-1,-1,-1,-1]; }""",
"""  /* client Bag view has exactly 3 cells; Desk has 8. bagDataList.length IS the usable slot count. */
  var BAG_SLOTS = 3, DESK_SLOTS = 8;
  function SLOTS(n){ n = n||8; var a=[]; for (var i=0;i<n;i++) a.push(-1); return a; }
  function bagSlots(){ return SLOTS(BAG_SLOTS); }
  function deskSlots(){ return SLOTS(DESK_SLOTS); }""")
    s=s.replace("bag: SLOTS(), desk: SLOTS(), house: [],", "bag: bagSlots(), desk: deskSlots(), house: [],")
    s=s.replace("""  function normalise(a){
    var out = SLOTS();
    if (Array.isArray(a)) for (var i=0;i<a.length && i<8;i++){ var v=a[i]; out[i] = (v===null||v===undefined)?-1:v; }
    return out;
  }""",
"""  function normalise(a, n){
    n = n || 8; var out = SLOTS(n);
    if (Array.isArray(a)) for (var i=0;i<a.length && i<n;i++){ var v=a[i]; out[i] = (v===null||v===undefined)?-1:v; }
    return out;
  }""")
    s=s.replace("if (!Array.isArray(st.bag) || st.bag.length !== 8) st.bag = normalise(st.bag);",
                "if (!Array.isArray(st.bag) || st.bag.length !== BAG_SLOTS) st.bag = normalise(st.bag, BAG_SLOTS);")
    s=s.replace("if (!Array.isArray(st.desk) || st.desk.length !== 8) st.desk = normalise(st.desk);",
                "if (!Array.isArray(st.desk) || st.desk.length !== DESK_SLOTS) st.desk = normalise(st.desk, DESK_SLOTS);")
    s=s.replace("""    var idx = (pos||1) - 1; if (idx < 0 || idx > 7) idx = firstEmpty(arr); if (idx < 0) return;""",
"""    var idx = (pos||1) - 1; if (idx < 0 || idx >= arr.length) idx = firstEmpty(arr); if (idx < 0) return;""")
    # guideStep Complete in roleData settings
    s=s.replace("""settings: { client: "{}", push_switch: 0, rank_switch: 0 },""",
"""settings: { client: '{"guideStep":"Complete","hasAchieve":true,"hasOpenAttributeView":true,"hasEnteredRaffle":true,"hasOpenedDesk":true,"hasBuyTool":true,"hasFriendVisit":true,"guideVisitor":true,"guideStory":true,"guideNote":true,"guideHandCraft":true,"guideSlidePicture":true,"guideFurniture":1,"guideDrawing":1}', push_switch: 0, rank_switch: 0 },""")
    open(p,'w',encoding='utf-8').write(s); print('genrules: bag=3/desk=8 + guideStep=Complete')
else: print('genrules already patched')
