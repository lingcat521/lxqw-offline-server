import io, json, os, sys, hashlib
sys.path.insert(0, 'tools')
import pnglite
inv = json.load(io.open('logs/glyphs.json', encoding='utf-8'))
os.makedirs('screenshots/cal/glyphs', exist_ok=True)
seen, total, uniq = {}, 0, 0
for mi in sorted(inv, key=lambda s: int(s)):
    info = inv[mi]
    w, h, px = pnglite.read_png(open('screenshots/cal/calendar_%s.png' % mi, 'rb').read())
    for bi, band in enumerate(info['bands']):
        for k, (x0, y0, x1, y1) in enumerate(band['boxes']):
            total += 1
            bw, bh = x1-x0+1, y1-y0+1
            buf = bytearray()
            for y in range(y0, y1+1):
                for x in range(x0, x1+1):
                    i = (y*w + x)*4
                    buf += px[i:i+4]
            key = hashlib.md5(bytes(buf)).hexdigest()[:12]
            if key not in seen:
                seen[key] = True; uniq += 1
                pnglite.write_png('screenshots/cal/glyphs/%s_%dx%d.png' % (key, bw, bh), bw, bh, bytes(buf))
print('boxes total', total, 'unique glyphs', uniq)
sizes = {}
for f in os.listdir('screenshots/cal/glyphs'):
    s = f.split('_')[-1].replace('.png','')
    sizes[s] = sizes.get(s, 0) + 1
print('top sizes:', sorted(sizes.items(), key=lambda kv: -kv[1])[:8])