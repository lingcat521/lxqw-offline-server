import io, json, os, sys
sys.path.insert(0,'tools')
import pnglite
inv=json.load(io.open('logs/glyphs.json',encoding='utf-8'))
os.makedirs('screenshots/cal/digits',exist_ok=True)
def off(y,m):
    return (__import__('datetime').date(y,m,1).weekday())
got={}
saved=0
for mi in range(1,13):
    w,h,px=pnglite.read_png(open('screenshots/cal/calendar_%d.png'%mi,'rb').read())
    bands=inv[str(mi)]['bands']
    datebands=[b for b in bands if 8<=len(b['boxes'])<=22 and b['y0']>240 and b['y0']<520]
    rowoff=off(2023,mi)
    for b in datebands:
        bx=b['boxes']
        n=len(bx)//7
        if n<1: continue
        for ci in range(7):
            cell=bx[ci*n:(ci+1)*n]
            if not cell: continue
            x0,y0,x1,y1=cell[0]
            day=1+ (b['y0']//1,0)[0]*0
            got.setdefault('boxes',0)
            got['boxes']+=1
            buf=bytearray()
            for y in range(y0,y1+1):
                for x in range(x0,x1+1):
                    i=(y*w+x)*4
                    buf+=px[i:i+4]
            pnglite.write_png('screenshots/cal/digits/m%02d_%d_%d_%dx%d.png'%(mi,b['y0'],x0,x1-x0+1,y1-y0+1), x1-x0+1, y1-y0+1, bytes(buf))
            saved+=1
print('number-box crops saved:', saved)