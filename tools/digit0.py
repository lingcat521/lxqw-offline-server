import io, json, os, sys, datetime, hashlib
sys.path.insert(0,'tools')
import pnglite
inv=json.load(io.open('logs/glyphs.json',encoding='utf-8'))
os.makedirs('screenshots/cal/digits10',exist_ok=True)
n0=0
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
            if not cell: continue
            x0,y0,x1,y1=cell[0]
            day=r*7+c-offset+1
            if day not in (10,20,30): continue
            cols=[]
            for x in range(x0,x1+1):
                k=0
                for y in range(y0,y1+1):
                    i=(y*w+x)*4
                    if px[i+3]>40 and (px[i]*299+px[i+1]*587+px[i+2]*114)//1000<205: k+=1
                cols.append(k)
            mid=len(cols)//2
            lo=max(1,mid-6); hi=min(len(cols)-2,mid+6)
            cut=min(range(lo,hi+1), key=lambda i:cols[i])
            for (cx0,cx1,label) in [(x0, x0+cut-1, str(day)[0]), (x0+cut, x1, '0')]:
                buf=bytearray()
                for y in range(y0,y1+1):
                    for x in range(cx0,cx1+1):
                        i=(y*w+x)*4; buf+=px[i:i+4]
                key=hashlib.md5(bytes(buf)).hexdigest()[:10]
                pnglite.write_png('screenshots/cal/digits10/%s_%s.png'%(label,key), cx1-cx0+1, y1-y0+1, bytes(buf))
                if label=='0': n0+=1
print('zero glyphs recovered:', n0)
print('files now:', len(os.listdir('screenshots/cal/digits10')))