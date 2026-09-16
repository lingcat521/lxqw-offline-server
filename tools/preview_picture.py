import io, os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pnglite, genpictures as G

pic, res, cfg = G.load()
art = G.Art(res, cfg)
raw = io.open(os.path.join(G.ROOT, 'new/pictures.js'), encoding='utf-8').read()
MOCK = json.loads(raw[raw.index('{'):raw.rindex('}') + 1])

ids = [int(x) for x in sys.argv[1].split(',')]
cols = 2
rows = (len(ids) + cols - 1) // cols
GW, GH = G.W * cols, G.H * rows
buf = bytearray()
for _ in range(GW * GH): buf += bytes((40, 40, 50, 255))
for i, pid in enumerate(ids):
    if str(pid) not in MOCK:
        print('no layers for', pid); continue
    sub = G.compose(pid, MOCK, art, bg=(255, 255, 255, 255))
    ox, oy = (i % cols) * G.W, (i // cols) * G.H
    pnglite.blend(buf, GW, GH, bytes(sub), G.W, G.H, ox, oy)
out = os.path.join(G.ROOT, 'screenshots/preview_%s.png' % sys.argv[1].replace(',', '_'))
pnglite.write_png(out, GW, GH, bytes(buf))
print('wrote', out, GW, GH)
for pid in ids:
    if str(pid) in MOCK:
        t = [p for p in pic if p['id'] == pid]
        t = t[0] if t else {}
        print(pid, t.get('type'), t.get('name'), 'layers', MOCK[str(pid)])
