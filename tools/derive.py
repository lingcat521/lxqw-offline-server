import re, json, os, sys
D='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw/apk/assets/game/js/'
src=''
for f in ['main.min.js','game.min.js','default.thm.js','ejoySDK.min.js']:
    p=D+f
    if os.path.exists(p): src+=open(p,encoding='utf-8',errors='replace').read()+" "

def match(s,start):
    depth=0;k=start
    while k<len(s):
        c=s[k]
        if c=='{':depth+=1
        elif c=='}':
            depth-=1
            if depth==0:return k
        elif c=='"' or c=="'":
            q=c;k+=1
            while k<len(s) and s[k]!=q: k+=1
        k+=1
    return -1

i=src.index('protocolList={'); j=i+len('protocolList=')
end=match(src,j); block=src[j:end+1]
proto=sorted(set(re.findall(r'([A-Za-z0-9_]+):\[',block)))

methods={}
for m in re.finditer(r'prototype\.([A-Za-z0-9_$]+)=function\(([^)]*)\)\{', src):
    name=m.group(1); params=m.group(2); bs=m.end()-1; be=match(src,bs)
    if be<0: continue
    methods.setdefault(name,[]).append((params,src[bs:be+1]))

def scalar_type(body, leaf):
    if re.search(r'Array\.isArray\([^)]*'+re.escape(leaf)+r'\b',body): return 'array'
    if re.search(r'convertArray(All)?\([^)]*'+re.escape(leaf)+r'\b',body): return 'array'
    if re.search(r'[A-Za-z0-9_$.]*'+re.escape(leaf)+r'\.length',body): return 'array'
    if re.search(r'for\s*\(\s*var\s+[A-Za-z0-9_$]+\s+in\s+[^)]*'+re.escape(leaf)+r'\b',body): return 'object'
    if re.search(r'(==|===|!=|>=|<=|>|<)\s*(-?[0-9]+|[A-Za-z0-9_$.]*'+re.escape(leaf)+r')\b',body) or re.search(r'\b'+re.escape(leaf)+r'\s*(==|===|!=|>=|<=|>|<)',body): return 'number'
    if re.search(r'[A-Za-z0-9_$.]*'+re.escape(leaf)+r'\.(split|indexOf|replace|substr|substring|charAt)\b',body): return 'string'
    if re.match(r'.*(_id|_cnt|_num|_count|_time|_point|_ticket|_clover|_status|_step|_code|_type|_flag|_switch|_idx|_index|_price|_coin|_level|_exp|_ver|_num|_total|_start|_day)$',leaf): return 'number'
    if re.match(r'^(is_|has_)',leaf): return 'boolean'
    return 'auto'

spec={}
for name in proto:
    hs=methods.get(name)
    if not hs: continue
    tree={}; usesReq=False
    for params,body in hs:
        ps=[p.strip() for p in params.split(',') if p.strip()]
        if not ps: continue
        p0=ps[0]; p1=ps[1] if len(ps)>1 else None
        if p1 and re.search(r'\b'+re.escape(p1)+r'\.',body): usesReq=True
        alias={}
        for am in re.finditer(r'(?:var\s+)?([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*'+re.escape(p0)+r'((?:\.[A-Za-z0-9_$]+)*)', body):
            alias[am.group(1)]=am.group(2)
        paths=set()
        for m2 in re.finditer(re.escape(p0)+r'((?:\.[A-Za-z0-9_$]+)+)', body): paths.add(m2.group(1))
        for a,pref in alias.items():
            for m3 in re.finditer(r'\b'+re.escape(a)+r'((?:\.[A-Za-z0-9_$]+)+)', body): paths.add(pref+m3.group(1))
            if pref: paths.add(pref)
        for am in re.finditer(r'this\.([A-Za-z0-9_$]+)\s*=\s*'+re.escape(p0)+r'\s*[,;)]', body):
            prop=am.group(1)
            for m4 in re.finditer(r'this\.'+re.escape(prop)+r'\.([A-Za-z0-9_$]+)', src):
                paths.add('.'+m4.group(1))
        for path in paths:
            parts=[x for x in path.split('.') if x]
            if not parts: continue
            node=tree
            for k2 in parts[:-1]:
                node=node.setdefault(k2,{'_type':'object'})
                node=node.setdefault('_children',{})
            leaf=parts[-1]
            if leaf not in node: node[leaf]={'_type':'auto'}
            if len(parts)==1: node[leaf]['_type']=scalar_type(body, leaf)
    if tree: spec[name]={'tree':tree,'usesReq':usesReq}

json.dump(spec, open('/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw/spec_auto.json','w'), ensure_ascii=False, indent=1)
print('protocols with handlers:', len(spec))
print('usesReq:', sorted(k for k,v in spec.items() if v['usesReq']))
print()
def render(t, ind=0):
    out=[]
    for key in sorted(t):
        if key.startswith('_'): continue
        v=t[key]
        ch={x:y for x,y in v.items() if not x.startswith('_')}
        if ch:
            out.append(' '*ind+key+': { '+', '.join(sorted(ch))+' }')
        else:
            out.append(' '*ind+key+': '+v.get('_type','auto'))
    return out
for k in ['client_load_role','weather_load','item_load_items','furniture_load_furniture','visit_load','task_load','calendar_load','rank_load','mail_load','lottery_load','guest_load_drawing','wishingpool_load']:
    if k in spec:
        print('### '+k+'  usesReq='+str(spec[k]['usesReq']))
        print('\n'.join('   '+l for l in render(spec[k]['tree'])))
