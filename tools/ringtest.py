import io, sys
sys.path.insert(0,'tools')
import pnglite
W,H=553,648
w,h,px=pnglite.read_png(open('screenshots/cal/calendar_9.png','rb').read())
buf=bytearray(px)
COLCX=[52,125,201,275,347,423,489]
ROWY=[210,275,339,408,474]   # 修正: 第一行(28..3)之前被过滤掉了, 导致整体少一行
import math
def ring(cx,cy,r,col):
    for a in range(0,3600):
        x=int(cx+r*math.cos(a/57.2958)); y=int(cy+r*math.sin(a/57.2958))
        for dx in (-1,0,1):
            for dy in (-1,0,1):
                X,Y=x+dx,y+dy
                if 0<=X<W and 0<=Y<H:
                    i=(Y*W+X)*4; buf[i],buf[i+1],buf[i+2],buf[i+3]=col
cell=17; row=(cell-1)//7; col=(cell-1)%7
ring(COLCX[col], ROWY[row]-16, 22, (232,163,61,255))
cell2=14; row2=(cell2-1)//7; col2=(cell2-1)%7
for y in range(ROWY[row2]-40, ROWY[row2]+4):
    for x in range(COLCX[col2]-34, COLCX[col2]+34):
        if 0<=x<W and 0<=y<H:
            i=(y*W+x)*4; buf[i],buf[i+1],buf[i+2],buf[i+3]=230,230,230,255
pnglite.write_png('screenshots/cal/ring_test2.png',W,H,bytes(buf))
print('ring cell17 at y', ROWY[2]-16, '| cover cell14 at y', ROWY[1]-40)