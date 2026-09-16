import io, json, os, sys, datetime, hashlib
sys.path.insert(0,'tools')
import pnglite
inv=json.load(io.open('logs/glyphs.json',encoding='utf-8'))
os.makedirs('screenshots/cal/digits10',exist_ok=True)
def ink_cols(px,w,h,x0,y0,x1,y1):
    cols=[]
    for x in range(x0,x1+1):
        n=0
        for y in range(y0,y1+1):
            i=(y*w+x)*4
            if px[i+3]>40 and (px[i]*299+px[i+1]*587+px[i+2]*114)//1000 < 205: n+=1
        cols.append(n)
    return cols
cnt={str(d):0 for d in range(10)}
for mi in range(1,13):
    w,h,px=pnglite.read_png(open('screenshots/cal/calendar_%d.png'%mi,'rb').read())
    days=(datetime.date(2023,mi%12+1,1)-datetime.timedelta(days=1)).day if mi<12 else 31
    first=datetime.date(2023,mi,1)
    offset=first.weekday()
    bands=[b for b in inv[str(mi)]['bands'] if 8<=len(b['boxes'])<=22 and 240<b['y0']<520]
    bands.sort(key=lambda b:b['y0'])
    for r,b in enumerate(bands):
        bx=b['boxes']; n=len(bx)//7
        for c in range(7):
            cell=bx[c*n:(c+1)*n]
            if not cell: continue
            x0,y0,x1,y1=cell[0]
            slot=r*7+c
            day=slot-offset+1
            if day<1 or day>days: continue
            cols=ink_cols(px,w,h,x0,y0,x1,y1)
            segs=[]; s=None
            for i,v in enumerate(cols):
                if v>0 and s is None: s=i
                elif v==0 and s is not None:
                    segs.append((s,i-1)); s=None
            if s is not None: segs.append((s,len(cols)-1))
            ds=str(day)
            if len(segs)!=len(ds): continue
            for gi,(sx,ex) in enumerate(segs):
                gx0=x0+sx; gx1=x0+ex
                buf=bytearray()
                for y in range(y0,y1+1):
                    for x in range(gx0,gx1+1):
                        i=(y*w+x)*4; buf+=px[i:i+4]
                d=ds[gi]
                key=hashlib.md5(bytes(buf)).hexdigest()[:10]
                pnglite.write_png('screenshots/cal/digits10/%s_%s.png'%(d,key), gx1-gx0+1, y1-y0+1, bytes(buf))
                cnt[d]+=1
print('labelled digit glyphs per value:', cnt)
print('files:', len(os.listdir('screenshots/cal/digits10')))