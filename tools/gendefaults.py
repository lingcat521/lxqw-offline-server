import json
BASE='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw'
T=BASE+'/tables/'
def load(n): return json.load(open(T+n+'.json',encoding='utf-8'))
fs=load('furnitureShopData_json')
shoplist=[]
for k in sorted(fs,key=lambda x:int(x)):
    v=fs[k]
    if not isinstance(v,dict): continue
    e=dict(v)
    e['shop_id']=v.get('id', int(k))          # FurnitureShopDB key
    e['num']=v.get('limit', 0)                # remaining stock (renders 剩N个)
    e['item_id']=v.get('item_id')             # item for icon/price lookup
    shoplist.append(e)
fd=load('furnitureData_json')
# starter yard set: first furniture of each type 1..8
starter=[]
seen=set()
for k in sorted(fd,key=lambda x:int(x)):
    v=fd[k]
    if not isinstance(v,dict): continue
    t=v.get('type')
    if t in seen: continue
    if t is None: continue
    seen.add(t); starter.append({'id':v.get('id'),'type':t})
    if len(starter)>=8: break
lines=[]
lines.append('/* lxqw offline defaults: complete shapes for whole-replace handlers */')
lines.append('(function(){')
lines.append('  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};')
lines.append('  var FUR_SHOP = '+json.dumps(shoplist,ensure_ascii=False)+';')
lines.append('  var PUT_FUR = '+json.dumps(starter,ensure_ascii=False)+';')
lines.append('  S["furniture_load_furniture"] = function(){ return { shop:{start_time:0,leave_time:0,shop_list:FUR_SHOP}, mood:0, bench_lock:false, bench:[], put_fur:PUT_FUR, has_fur:[], mate_list:[], replace_fur:[] }; };')
lines.append('  S["furniture_load_tumbler"] = function(){ return { show_index:0, replace_index:0, tumbler_list:[] }; };')
lines.append('  S["furniture_load_compost"] = function(){ return { show_index:0, replace_index:0, compost_list:[], state:0, box_index:0, box_list:[] }; };')
lines.append('  S["furniture_load_pocket"] = function(){ return { show_index:0, replace_index:0, list:[], clover:0 }; };')
lines.append('  S["furniture_load_flowerpot"] = function(){ return { show_list:[], list:[], plant_list:[] }; };')
lines.append('  S["client_load_events"] = function(){ return []; };')
lines.append('  S["client_load_publicity"] = function(){ return { id_list: [] }; };')
lines.append('})();')
open(BASE+'/new/defaults.js','w').write('\n'.join(lines))
print('defaults.js: shop',len(shoplist),'| starter furniture',json.dumps(starter,ensure_ascii=False))
