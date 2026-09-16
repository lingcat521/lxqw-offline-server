import re, json, os, sys
D='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw/apk/assets/game/js/'
files=['main.min.js','game.min.js','ejoySDK.min.js','default.thm.js']
src=''
for f in files:
    p=D+f
    if os.path.exists(p): src+=open(p,encoding='utf-8',errors='replace').read()+"\n/*SPLIT*/\n"
def match(s,start):
    depth=0;k=start
    while k<len(s):
        c=s[k]
        if c=='{':depth+=1
        elif c=='}':
            depth-=1
            if depth==0:return k
        elif c in '"\'':
            q=c;k+=1
            while k<len(s) and s[k]!=q:
                if s[k]=='\\':k+=1
                k+=1
        k+=1
    return -1
i=src.index('protocolList={')
j=i+len('protocolList=')
end=match(src,j)
block=src[j:end+1]
names=sorted(set(re.findall(r'([A-Za-z0-9_]+):\[',block)))
out={}
for n in names:
    m=re.search(r'prototype\.'+re.escape(n)+r'=function\(([^)]*)\)\{',src)
    if not m: out[n]=None; continue
    params=[p.strip() for p in m.group(1).split(',') if p.strip()]
    bstart=m.end()-1
    bend=match(src,bstart)
    body=src[bstart:bend+1] if bend>0 else ''
    p0=params[0] if params else None
    fields=sorted(set(re.findall(r'\b'+re.escape(p0)+r'\.([A-Za-z0-9_]+)',body))) if p0 else []
    out[n]={'params':params,'fields':fields,'len':len(body)}
json.dump(out,open('/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw/protocol_spec.json','w'),ensure_ascii=False,indent=1)
have=[k for k,v in out.items() if v]; miss=[k for k,v in out.items() if not v]
print('protocols:',len(names),'with handler:',len(have),'no handler:',len(miss))
print('NO HANDLER:', ' '.join(miss))
print()
for k in have[:40]:
    print(k,'->',out[k]['fields'][:14])
