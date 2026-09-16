import re, json
M='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw/apk/assets/game/js/main.min.js'
s=open(M,encoding='utf-8',errors='replace').read()
def matchBrace(st,start):
    d=0;k=start
    while k<len(st):
        c=st[k]
        if c=='{':d+=1
        elif c=='}':
            d-=1
            if d==0:return k
        elif c=='"' or c=="'":
            q=c;k+=1
            while k<len(st) and st[k]!=q:k+=1
        k+=1
    return -1
out={}
for m in re.finditer(r'this\.([A-Za-z0-9_$]+)=\{', s):
    name=m.group(1)
    bs=m.end()-1; be=matchBrace(s,bs)
    if be<0: continue
    obj=s[bs:be+1]
    if len(obj)>900: continue
    # only keep objects that look like field defaults (contain ':')
    if ':' not in obj: continue
    out.setdefault(name,set()).add(obj)
for name in sorted(out):
    for obj in list(out[name])[:1]:
        print('### this.%s = %s' % (name, obj[:520]))
print()
print('total default containers:', len(out))
