import re, json
BASE='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw'
src=open(BASE+'/apk/assets/game/js/main.min.js',encoding='utf-8',errors='replace').read()
def match_brace(s,start):
    d=0;k=start
    while k<len(s):
        c=s[k]
        if c=='{':d+=1
        elif c=='}':
            d-=1
            if d==0:return k
        elif c=='"' or c=="'":
            q=c;k+=1
            while k<len(s) and s[k]!=q:k+=1
        k+=1
    return -1
# classes: NAME=function(e){ ... }
classes={}
for m in re.finditer(r'([A-Z][A-Za-z0-9_$]*)=function\(', src):
    bs=src.find('{', m.end()-1)
    be=match_brace(src,bs)
    if be<0: continue
    classes.setdefault(m.group(1),[]).append((bs,be))
rows=[]
for name,spans in classes.items():
    for (bs,be) in spans:
        body=src[bs:be+1]
        # fixed cell arrays: this.X=[{...},...]
        for am in re.finditer(r'this\.([A-Za-z0-9_$]+)=\[(\{[^\]]*?\})\]', body):
            arr=am.group(2)
            cnt=len(re.findall(r'\{', arr))
            if cnt<2 or cnt>16: continue
            rows.append({'cls':name,'field':am.group(1),'cells':cnt})
        # index coupling: SOMETHING.forEach(function(v,i){ ... this.items[i] ... })
        for fm in re.finditer(r'([A-Za-z0-9_$.()]{4,70})\.forEach\(function\(([A-Za-z0-9_$]+),\s*([A-Za-z0-9_$]+)\)\{', body):
            expr=fm.group(1); idx=fm.group(3)
            fs=src.find('{', fm.end()-1); fe=match_brace(src,fs)
            if fe<0: continue
            fb=src[fs:fe+1]
            cells=set(re.findall(r'(?:this\.)?([A-Za-z0-9_$]+)\[' + re.escape(idx) + r'\]', fb))
            if cells:
                rows.append({'cls':name,'coupling':expr,'indexVar':idx,'cellsUsed':sorted(cells)[:3]})
seen=set(); out=[]
for r in rows:
    k=json.dumps(r,ensure_ascii=False,sort_keys=True)
    if k in seen: continue
    seen.add(k); out.append(r)
print('=== fixed-cell / index-coupling map ('+str(len(out))+') ===')
for r in out:
    if 'cells' in r: print('CELLS  %-26s this.%-16s = %d cells' % (r['cls'], r['field'], r['cells']))
    else: print('COUPLE %-26s %s.forEach((v,%s)=> %s[%s])' % (r['cls'], r['coupling'], r['indexVar'], ','.join(r['cellsUsed']), r['indexVar']))
