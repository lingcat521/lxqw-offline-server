import json
BASE='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw'
T=BASE+'/tables/'
def load(n): return json.load(open(T+n+'.json',encoding='utf-8'))
def keyset(obj):
    if isinstance(obj,dict): return [str(k) for k in obj]
    if isinstance(obj,list): return [str(x.get('id')) for x in obj if isinstance(x,dict) and 'id' in x]
    return []
items=load('Item_json'); item_ids=[str(x.get('id')) for x in items if isinstance(x,dict)] if isinstance(items,list) else keyset(items)
notes=load('Note_json'); note_ids=keyset(notes)
vis=load('visitors_json'); prov_keys=keyset(vis.get('provinceList') or {}); part_keys=keyset(vis.get('actionList') or {})
fur=load('furnitureData_json'); fur_ids=keyset(fur)
fshop=load('furnitureShopData_json'); fshop_ids=keyset(fshop)
task=load('taskData_json'); task_map=(task.get('list_map') if isinstance(task,dict) else None) or {}; task_ids=keyset(task_map)
coll=load('Collection_json'); coll_ids=keyset(coll)
enc=load('encyclopedia_json'); enc_ids=keyset(enc.get('desc') or {})
pic=load('Picture_json'); pic_ids=[str(x.get('id')) for x in pic if isinstance(x,dict) and 'id' in x] if isinstance(pic,list) else keyset(pic)
sets={'item':item_ids,'note':note_ids,'prov':prov_keys,'part':part_keys,'fur':fur_ids,'furShop':fshop_ids,'task':task_ids,'coll':coll_ids,'ency':enc_ids,'pic':pic_ids}
js=[]
js.append('/* lxqw guard: drop or neutralise any reference id the client cannot resolve (prevents view crashes) */')
js.append('(function(){')
js.append('  var M = window.MockServer; if (!M) return; if (M.__guarded) return; M.__guarded = 1;')
js.append('  var K = '+json.dumps({k:sorted(v) for k,v in sets.items()})[0:200000]+';')
js.append('  var SET = {}; for (var k in K){ var o={}; for (var i=0;i<K[k].length;i++) o[K[k][i]]=1; SET[k]=o; }')
js.append('  var drops = [];')
js.append('  function has(k,v){ return v!==undefined && v!==null && SET[k] && SET[k][String(v)]===1; }')
js.append('  function drop(what){ if (drops.length<50) drops.push(what); }')
js.append('''
  function guard(name, d){
    try {
      if (!d || typeof d !== "object") return d;
      if (name === "visit_load" && d.visitor){
        var prov = String(d.visitor.city||"").split("_")[0];
        if (!has("prov", prov) || !has("part", d.visitor.partner)) { drop("visitor("+prov+")"); d.visitor = null; }
      }
      if (name === "travel_load_gift" && Array.isArray(d.specialtys)){
        d.specialtys = d.specialtys.filter(function(s){ var ok = has("item", s.item_id) || s.item_id===100000 || s.item_id===100001; if(!ok) drop("specialty:"+s.item_id); return ok; });
      }
      if (name === "travel_load_note" && Array.isArray(d.note_list)){
        d.note_list = d.note_list.filter(function(n){ var ok = has("note", n.id); if(!ok) drop("note:"+n.id); return ok; });
      }
      if (name === "item_load_items"){
        ["bag","desk"].forEach(function(f){
          if (Array.isArray(d[f])) d[f] = d[f].map(function(v){ if (v===-1||v===null||v===undefined) return -1; if(!has("item", v)){ drop(f+":"+v); return -1; } return v; });
        });
        if (Array.isArray(d.house)) d.house = d.house.filter(function(h){ var ok = has("item", h.item_id); if(!ok) drop("house:"+h.item_id); return ok; });
      }
      if (name === "furniture_load_furniture" && d.shop && Array.isArray(d.shop.shop_list)){
        d.shop.shop_list = d.shop.shop_list.filter(function(s){ var ok = has("furShop", s.shop_id); if(!ok) drop("furShop:"+s.shop_id); return ok; });
      }
      if (name === "task_load" && Array.isArray(d.tasks)){
        d.tasks = d.tasks.filter(function(t){ var ok = has("task", t.id); if(!ok) drop("task:"+t.id); return ok; });
      }
      if (name === "guest_load_drawing" && Array.isArray(d.colls)){
        d.colls = d.colls.filter(function(c){ var ok = has("coll", c); if(!ok) drop("coll:"+c); return ok; });
      }
      if (name === "encyclopedia_load" || name === "encytravel_load"){
        if (Array.isArray(d.unlock_desc)) d.unlock_desc = d.unlock_desc.filter(function(x){ var ok = has("ency", x.id); return ok; });
      }
    } catch(e){}
    return d;
  }
  var orig = M.handle;
  M.handle = function(name, params){
    var r = orig.call(M, name, params);
    return guard(name, r);
  };
  window.MOCK_GUARD_DROPS = function(){ return drops.slice(); };
  window.MOCK_GUARD_CHECK = function(name, d){ return guard(name, d); };
  try { console.log("[MOCK] guard active: keys " + Object.keys(SET).map(function(k){return k+"="+Object.keys(SET[k]).length;}).join(" ")); } catch(e){}
''')
js.append('})();')
open(BASE+'/new/guard.js','w').write(chr(10).join(js))
print('guard.js written | sets:', {k:len(v) for k,v in sets.items()})
