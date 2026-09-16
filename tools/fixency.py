import json
BASE='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw'
T=BASE+'/tables/'
def load(n): return json.load(open(T+n+'.json',encoding='utf-8'))
enc=load('encyclopedia_json'); ent=load('encytravel_json')
def build(t):
    d=t.get('desc') or {}
    ids=sorted(int(k) for k in d)
    desc=[{'id':i,'list':[d[str(i)][k] for k in sorted(d[str(i)],key=lambda x:int(x))]} for i in ids]
    subs=[{'id':i,'sub_id':0} for i in ids]
    return ids, desc, subs
eau,ead,eas=build(enc)
etu,etd,ets=build(ent)
p='tools/genrules.py'
s=open(p,encoding='utf-8').read()
if 'ENCY_UNLOCK' not in s:
    s=s.replace("""js.append('  var BEGINNER   = '+json.dumps(beginner,ensure_ascii=False)+';')""",
"""js.append('  var BEGINNER   = '+json.dumps(beginner,ensure_ascii=False)+';')
js.append('  var ENCY_UNLOCK= '+json.dumps(eau)+';')
js.append('  var ENCY_DESC  = '+json.dumps(ead,ensure_ascii=False)+';')
js.append('  var ENCY_SUB   = '+json.dumps(eas)+';')
js.append('  var ET_UNLOCK  = '+json.dumps(etu)+';')
js.append('  var ET_DESC    = '+json.dumps(etd,ensure_ascii=False)+';')
js.append('  var ET_SUB     = '+json.dumps(ets)+';')""")
    # add handlers near the calendar block
    anchor="  S['calendar_get_beginer_reward'] = function(){"
    add = """  /* ---- encyclopedia / encytravel: real desc data from config.eab ---- */
  S['encyclopedia_load'] = function(){ return { unlock_list: ENCY_UNLOCK, unlock_desc: ENCY_DESC, show_sub: ENCY_SUB }; };
  S['encytravel_load'] = function(){ return { unlock_list: ET_UNLOCK, unlock_desc: ET_DESC, show_sub: ET_SUB }; };
  S['encyclopedia_set_show_sub'] = function(p){ 
    for (var i=0;i<ENCY_SUB.length;i++) if (ENCY_SUB[i].id === p.id) ENCY_SUB[i].sub_id = p.sub_id;
    return {code:0};
  };
  S['encytravel_set_show_sub'] = function(p){ 
    for (var i=0;i<ET_SUB.length;i++) if (ET_SUB[i].id === p.id) ET_SUB[i].sub_id = p.sub_id;
    return {code:0};
  };
"""
    if anchor in s:
        s=s.replace(anchor, add+anchor); print('encyclopedia handlers added')
    else:
        print('ANCHOR MISSING')
    open(p,'w',encoding='utf-8').write(s)
else: print('already patched')
