import io, os, sys, json
sys.path.insert(0, 'tools')
import pnglite
img = 'screenshots/cal/calendar_9.png'
w, h, px = pnglite.read_png(open(img,'rb').read())
def lum(i):
    return (px[i]*299 + px[i+1]*587 + px[i+2]*114)//1000
rows = []
for y in range(h):
    ink = 0
    for x in range(w):
        i = (y*w + x)*4
        if px[i+3] > 40 and lum(i) < 205: ink += 1
    rows.append(ink)
bands = []
cur = None
for y, n in enumerate(rows):
    if n >= 2 and cur is None: cur = [y, y]
    elif n >= 2: cur[1] = y
    elif cur is not None:
        if cur[1]-cur[0] >= 6: bands.append(tuple(cur))
        cur = None
if cur: bands.append(tuple(cur))
print('image', w, h, 'text bands:', len(bands))
for (y0, y1) in bands:
    cols = [0]*w
    for y in range(y0, y1+1):
        for x in range(w):
            i = (y*w + x)*4
            if px[i+3] > 40 and lum(i) < 205: cols[x] += 1
    boxes = []
    s = None
    for x, c in enumerate(cols):
        if c > 0 and s is None: s = x
        elif c == 0 and s is not None:
            if x - s >= 3: boxes.append((s, x-1))
            s = None
    if s is not None: boxes.append((s, w-1))
    print('  band y=%d..%d h=%d boxes=%d' % (y0, y1, y1-y0+1, len(boxes)), boxes[:9])