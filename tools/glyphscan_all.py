import io, json, sys
sys.path.insert(0, 'tools')
import pnglite
def scan(path):
    w, h, px = pnglite.read_png(open(path,'rb').read())
    def lum(i): return (px[i]*299 + px[i+1]*587 + px[i+2]*114)//1000
    def ink(x, y):
        i = (y*w + x)*4
        return px[i+3] > 40 and lum(i) < 205
    rows = [sum(1 for x in range(w) if ink(x, y)) for y in range(h)]
    bands, cur = [], None
    for y, n in enumerate(rows):
        if n >= 2 and cur is None: cur = [y, y]
        elif n >= 2: cur[1] = y
        elif cur is not None:
            if cur[1]-cur[0] >= 6: bands.append(tuple(cur))
            cur = None
    if cur and cur[1]-cur[0] >= 6: bands.append(tuple(cur))
    out = []
    for (y0, y1) in bands:
        cols = [0]*w
        for y in range(y0, y1+1):
            for x in range(w):
                if ink(x, y): cols[x] += 1
        boxes, s = [], None
        for x, c in enumerate(cols):
            if c > 0 and s is None: s = x
            elif c == 0 and s is not None:
                if x - s >= 3: boxes.append([s, y0, x-1, y1])
                s = None
        if s is not None: boxes.append([s, y0, w-1, y1])
        out.append({'y0': y0, 'y1': y1, 'boxes': boxes})
    return w, h, out
inv = {}
for i in range(1, 13):
    p = 'screenshots/cal/calendar_%d.png' % i
    w, h, bands = scan(p)
    inv[i] = {'w': w, 'h': h, 'bands': bands}
    nb = sum(len(b['boxes']) for b in bands)
    print('month %2d: bands=%2d boxes=%3d' % (i, len(bands), nb))
json.dump(inv, io.open('logs/glyphs.json','w',encoding='utf-8'))
print('saved logs/glyphs.json')