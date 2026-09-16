import io, json, os, sys, datetime, glob
from collections import Counter
sys.path.insert(0,'tools')
import pnglite
W,H=553,648
LU=json.load(io.open('logs/lunar2026.json',encoding='utf-8'))
inv=json.load(io.open('logs/glyphs.json',encoding='utf-8'))
bands=[b for b in inv['9']['bands'] if 150<b['y0']<520 and 8<=len(b['boxes'])<=22]
bands.sort(key=lambda b:b['y0'])
rows=[(bands[i],bands[i+1]) for i in range(0,len(bands)-1,2)]
colx=[52,125,201,275,347,423,489]
src=open('screenshots/cal/calendar_9.png','rb').read()
w0,h0,base=pnglite.read_png(src)
buf=bytearray(base)
for (nb,lb) in rows:
    y0,y1=nb['y0']-8, lb['y1']+8
    col=base[((y0+y1)//2*W + 540)*4:((y0+y1)//2*W + 540)*4+3]
    for y in range(y0,y1+1):
        for x in range(16,537):
            i=(y*W+x)*4
            buf[i],buf[i+1],buf[i+2],buf[i+3]=col[0],col[1],col[2],255
def glyph(ch, kind):
    fs=sorted(glob.glob('screenshots/cal/%s/%s_*.png'%(kind,ch)))
    if not fs: return None
    return pnglite.read_png(open(fs[0],'rb').read())
first=datetime.date(2026,9,1); off=first.weekday()
ndays=30
drawn=0
for r,(nb,lb) in enumerate(rows):
    for c in range(7):
        day=r*7+c-off+1
        if day<1 or day>ndays: continue
        ds=str(day); gs=[]; tot=0
        for ch in ds:
            g=glyph(ch,'digits10')
            if g: gs.append(g); tot+=g[0]
        x=colx[c]-tot//2
        for (gw,gh,gpx) in gs:
            pnglite.blend(buf,W,H,gpx,gw,gh,x,nb['y1']-gh+1); x+=gw
        lab=LU.get('2026-09-%02d'%day)
        if lab and len(lab)==2:
            tot=0; gs=[]
            for ch in lab:
                g=glyph(ch,'lunar')
                if g: gs.append(g); tot+=g[0]
            x=colx[c]-tot//2
            for (gw,gh,gpx) in gs:
                pnglite.blend(buf,W,H,gpx,gw,gh,x,lb['y1']-gh+1); x+=gw
        drawn+=1
pnglite.write_png('screenshots/cal/preview3_2026_09.png',W,H,bytes(buf))
print('preview3 days', drawn)