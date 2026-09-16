p='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw/tools/genrules.py'
s=open(p,encoding='utf-8').read()
if 'SLOTS' not in s:
    s=s.replace("bag: [0,1,2,3], desk: [], house: [],",
                "bag: SLOTS(), desk: SLOTS(), house: [],")
    s=s.replace("""  var TRAVEL_SECONDS = 90;""",
"""  var TRAVEL_SECONDS = 90;
  /* the client renders one UI cell per array slot and uses -1 for an empty slot;
     the array must NEVER grow past the number of cells or it crashes on items[i].image */
  function SLOTS(){ return [-1,-1,-1,-1,-1,-1,-1,-1]; }
  function firstEmpty(a){ for (var i=0;i<a.length;i++) if (a[i] === -1 || a[i] === null || a[i] === undefined) return i; return -1; }""")
    # item_load_items must return fixed slots
    s=s.replace("""  S['item_load_items'] = function(){
    return { house: st.house, bag: st.bag, desk: st.desk, bag_completed: 0, bag_conflict: 0, desk_conflict: 0, gacha: {color_ball:-1} };
  };""",
"""  S['item_load_items'] = function(){
    if (!Array.isArray(st.bag) || st.bag.length !== 8) st.bag = normalise(st.bag);
    if (!Array.isArray(st.desk) || st.desk.length !== 8) st.desk = normalise(st.desk);
    return { house: st.house, bag: st.bag, desk: st.desk, bag_completed: 0, bag_conflict: 0, desk_conflict: 0, gacha: {color_ball:-1} };
  };
  S['item_load_shop_info'] = function(){ return { purchased: st.purchased || [] }; };""")
    # normalise helper + buy/putin/takeout rewrite
    s=s.replace("""  function putIn(arr, pos, id){ var i = st.bag.indexOf(id); if (i>=0) st.bag.splice(i,1); while (arr.length < pos) arr.push(null); arr[pos-1>=0?pos-1:0] = id; }""",
"""  function normalise(a){
    var out = SLOTS();
    if (Array.isArray(a)) for (var i=0;i<a.length && i<8;i++){ var v=a[i]; out[i] = (v===null||v===undefined)?-1:v; }
    return out;
  }
  function putIn(arr, pos, id){
    var idx = (pos||1) - 1; if (idx < 0 || idx > 7) idx = firstEmpty(arr); if (idx < 0) return;
    var j = st.bag.indexOf(id); if (j >= 0) st.bag[j] = -1;
    arr[idx] = id;
  }""")
    s=s.replace("""    st.clover -= cost;
    if (st.bag.indexOf(iid) < 0) st.bag.push(iid);
    pushItems(); pushClover();
    return {code:0};""",
"""    st.clover -= cost;
    var slot = firstEmpty(st.bag);
    if (slot < 0) return {code:3};
    if (st.bag.indexOf(iid) < 0) st.bag[slot] = iid;
    st.purchased = st.purchased || []; st.purchased.push({item_id: iid, count: 1});
    pushItems(); pushClover();
    return {code:0};""")
    s=s.replace("""  S['item_takeout_bag'] = function(p){ st.bag[(p.pos||1)-1] = null; pushItems(); return {code:0}; };""",
"""  S['item_takeout_bag'] = function(p){ var i=(p.pos||1)-1; if (i>=0&&i<8) st.bag[i] = -1; pushItems(); return {code:0}; };""")
    s=s.replace("""    var pos=(p.pos||1)-1, id = st.desk[pos]; st.desk[pos]=null;
    if (id!==null && id!==undefined && st.bag.indexOf(id)<0) st.bag.push(id);""",
"""    var pos=(p.pos||1)-1, id = st.desk[pos]; st.desk[pos] = -1;
    if (id!==null && id!==undefined && id!==-1 && st.bag.indexOf(id)<0) { var sl=firstEmpty(st.bag); if (sl>=0) st.bag[sl]=id; }""")
    open(p,'w',encoding='utf-8').write(s); print('genrules patched for fixed slots')
else: print('already patched')
