import sys, re, os
D='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw/apk/assets/game/js/'
src=''
for f in ['main.min.js','game.min.js','ejoySDK.min.js','default.thm.js']:
    p=D+f
    if os.path.exists(p): src+=open(p,encoding='utf-8',errors='replace').read()+"\n"
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
for n in sys.argv[1:]:
    m=re.search(r'prototype\.'+re.escape(n)+r'=function\(([^)]*)\)\{',src)
    if not m:
        print('### '+n+'  NOT-FOUND'); continue
    bs=m.end()-1; be=match(src,bs)
    b=src[bs:be+1]
    print('### '+n+'  ('+str(len(b))+'B)')
    print(b if len(b)<900 else b[:900]+' ...[TRUNC]')
    print()

