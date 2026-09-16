import io, os, sys, glob
sys.path.insert(0,'tools')
import pnglite
CW,CH=560,60
rows=10
buf=bytearray()
for _ in range(CW*CH*rows): buf += bytes((255,255,255,255))
for d in range(10):
    x=4; y=d*CH+8
    fs=sorted(glob.glob('screenshots/cal/digits10/%d_*.png'%d))[:12]
    for f in fs:
        w,h,px=pnglite.read_png(open(f,'rb').read())
        pnglite.blend(buf,CW,CH*rows,px,w,h,x,y)
        x+=w+6
        if x>CW-30: break
    print('digit',d,'variants',len(fs))
pnglite.write_png('screenshots/cal/digits_sheet.png',CW,CH*rows,bytes(buf))
print('sheet written')