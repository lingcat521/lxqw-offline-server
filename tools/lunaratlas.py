import io, json, os, sys, datetime, hashlib
sys.path.insert(0,'tools')
import pnglite
LU=json.load(io.open('logs/lunar2023.json',encoding='utf-8'))
inv=json.load(io.open('logs/glyphs.json',encoding='utf-8'))
os.makedirs('screenshots/cal/lunar',exist_ok=True)
CHAR='初一 初二 初三 初四 初五 初六 初七 初八 初九 初十 十一 十二 十三 十四 十五 十六 十七 十八 十九 二十 廿一 廿二 廿三 廿四 廿五 廿六 廿七 廿八 廿九 三十'.split()
saved=0
for mi in range(1,13):
    w,h,px=pnglite.read_png(open('screenshots/cal/calendar_%d.png'%mi,'rb').read())
    first=datetime.date(2023,mi,1); offset=first.weekday()
    days=(datetime.date(2023,mi%12+1,1)-datetime.timedelta(days=1)).day if mi<12 else 31
    bands=[b for b in inv[str(mi)]['bands'] if 8<=len(b['boxes'])<=22 and 240<b['y0']<520]
    bands.sort(key=lambda b:b['y0'])
    for r,b in enumerate(bands):
        bx=b['boxes']; n=len(bx)//7
        for c in range(7):
            cell=bx[c*n:(c+1)*n]
            if len(cell)<2: continue
            day=r*7+c-offset+1
            if day<1 or day>days: continue
            key='2023-%02d-%02d'%(mi,day)
            lab=LU.get(key)
            if not lab or len(lab)!=2: continue
            x0,y0,x1,y1=cell[1]
            cols=[]
            for x in range(x0,x1+1):
                k=0
                for y in range(y0,y1+1):
                    i=(y*w+x)*4
                    if px[i+3]>40 and (px[i]*299+px[i+1]*587+px[i+2]*114)//1000<205: k+=1
                cols.append(k)
            segs=[]; s=None
            for i,v in enumerate(cols):
                if v>0 and s is None: s=i
                elif v==0 and s is not None: segs.append((s,i-1)); s=None
            if s is not None: segs.append((s,len(cols)-1))
            if len(segs)!=2:
                mid=len(cols)//2; lo=max(1,mid-4); hi=min(len(cols)-2,mid+4)
                cut=min(range(lo,hi+1), key=lambda i:cols[i]); segs=[(0,cut-1),(cut,len(cols)-1)]
            for gi,(sx,ex) in enumerate(segs):
                gx0,gx1=x0+sx,x0+ex
                buf=bytearray()
                for y in range(y0,y1+1):
                    for x in range(gx0,gx1+1):
                        i=(y*w+x)*4; buf+=px[i:i+4]
                ch=lab[gi]
                pnglite.write_png('screenshots/cal/lunar/%s_%s.png'%(ch,hashlib.md5(bytes(buf)).hexdigest()[:10]), gx1-gx0+1, y1-y0+1, bytes(buf))
                saved+=1
print('lunar glyphs saved:', saved, 'distinct chars:', len(os.listdir('screenshots/cal/lunar')))