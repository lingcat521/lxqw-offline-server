p='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw/tools/genrules.py'
s=open(p,encoding='utf-8').read()
# add province list extraction
if 'PROV_NAMES' not in s:
    s=s.replace("""pics=load('Picture_json')
picids=[p.get('id') for p in pics] if isinstance(pics,list) else []""",
"""pics=load('Picture_json')
picids=[p.get('id') for p in pics] if isinstance(pics,list) else []
vis=load('visitors_json')
provkeys=list((vis.get('provinceList') or {}).keys()) if isinstance(vis,dict) else []
actkeys=[k for k in ((vis.get('actionList') or {}).keys())] if isinstance(vis,dict) else []""")
    s=s.replace("""js.append('  var PIC_IDS    = '+json.dumps(picids[:60])+';')""",
"""js.append('  var PIC_IDS    = '+json.dumps(picids[:60])+';')
js.append('  var PROV_NAMES = '+json.dumps(provkeys,ensure_ascii=False)+';')
js.append('  var ACT_KEYS   = '+json.dumps(actkeys)+';')""")
    # replace visit_load: no visitor, acquire = province names
    old_visit = """  S['visit_load'] = function(){
    return { visitor: { partner:0, name:"\\u5c0f\\u8717", title:0, expire_time: nowSec()+3600, city:"\\u5e7f\\u4e1c\\u7701_\\u5e7f\\u5dde\\u5e02", food:0, first:true, gift:{item_id:0,count:0}, carpet:1 },
             acquire: COLL_IDS.slice(0,6) };
  };"""
    new_visit = """  S['visit_load'] = function(){
    /* acquire holds PROVINCE names (client: acquireList.indexOf(province.Province)) */
    return { visitor: null, acquire: PROV_NAMES.slice(0,6) };
  };
  S['visit_set_carpet'] = function(p){ return {code:0}; };
  S['visit_open'] = function(p){ return {code:0}; };
  S['visitor_invite'] = function(p){
    /* a well-formed visitor: city must be "<province>_<city>" with province in provinceList,
       and partner must exist in actionList */
    var prov = PROV_NAMES.length ? PROV_NAMES[Math.floor(Math.random()*PROV_NAMES.length)] : "北京";
    var part = ACT_KEYS.length ? Number(ACT_KEYS[Math.floor(Math.random()*ACT_KEYS.length)]) : 0;
    return { visitor: { partner: part, name:"", title:0, expire_time: nowSec()+1800, city: prov+"_\\u57ce\\u533a",
                        food:0, first:false, gift:{item_id:100000,count:20}, carpet:1 } };
  };"""
    if old_visit in s:
        s=s.replace(old_visit,new_visit); print('visit_load replaced')
    else:
        print('VISIT PATTERN MISSING - will patch rules.js directly')
    open(p,'w',encoding='utf-8').write(s)
else:
    print('already patched')
