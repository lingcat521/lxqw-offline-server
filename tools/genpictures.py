# genpictures.py - build postcard layer compositions for the offline server.
#
# Source data (extracted from the game's own tables):
#   tables/Picture_json.json   -> per-picture template: backImage/frontImage names,
#                                 frogPose/frogPos, travelerPose/travelerPos
#   tables/resources_json.json -> resource id -> "Picture/<Type>/<name>" path
#   apk/.../default.res.json   -> which textures the client can actually load
#
# Output:
#   new/pictures.js            -> window.MOCK_PICTURES = { "<pic_id>": [[rid,x,y],...] }
#   logs/pictures_report.txt   -> diagnostics
#
# Coordinate model: template positions are CENTRE based inside a 500x350 canvas
# (observed range +-200 / +-162), so canvas_x = 250 + pos.x - sprite_w/2.
import io, json, os, random, struct, zipfile, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APK = '/storage/emulated/0/MT2/mcp/lxqw_offline_v14.apk'
W, H = 500, 350
FRIENDS = ['bh', 'cw', 'yhc']                  # 壁虎 / 刺猬 / 萤火虫
FLYING = ('bird', 'ibis', 'firefly', 'leaf', 'rain', 'snow', 'wind', 'fei', 'ying', 'lantern')

def load():
    pic = json.load(io.open(os.path.join(ROOT, 'tables/Picture_json.json'), encoding='utf-8'))
    res = json.load(io.open(os.path.join(ROOT, 'tables/resources_json.json'), encoding='utf-8'))
    cfg = json.load(io.open(os.path.join(ROOT, 'apk/assets/game/resource/China/default.res.json'),
                            encoding='utf-8'))
    return pic, res, cfg

class Art:
    def __init__(self, res, cfg):
        self.res = res
        self.by_name = {}
        for k, v in res.items():
            self.by_name.setdefault(v.split('/')[-1], []).append(int(k))
        self.by_path = {int(k): v for k, v in res.items()}
        self.declared = {r.get('name') for r in cfg['resources']}
        self.z = zipfile.ZipFile(APK)
        self.dims = {}
    def dims_of(self, rid):
        if rid in self.dims: return self.dims[rid]
        p = 'assets/game/resource/China/images/' + self.by_path[rid] + '.png'
        d = None
        try:
            head = self.z.open(p).read(24)
            if head[:8] == b'\x89PNG\r\n\x1a\n': d = struct.unpack('>II', head[16:24])
        except KeyError:
            d = None
        self.dims[rid] = d
        return d
    def usable(self, rid):
        if self.by_path[rid].split('/')[-1] + '_png' not in self.declared: return False
        return self.dims_of(rid) is not None
    def pick(self, name, variant=None):
        """resolve a template art name into (rid, w, h, path) - biggest match wins"""
        cands = []
        if name.startswith('rnd_'):
            cands += sorted(n for n in self.by_name if n.startswith(name[4:]))
        cands.append(name)
        base = name[5:] if name.startswith('back_') else name
        if base != name: cands.append(base)
        if variant:
            cands += [base + '_' + variant, base + '_2' + variant,
                      base.upper() + '_' + variant.upper(), base + '_' + variant.upper()]
        seen, out = set(), []
        for c in cands:
            for rid in self.by_name.get(c, []):
                if rid in seen or not self.usable(rid): continue
                seen.add(rid)
                d = self.dims_of(rid)
                out.append((rid, d[0], d[1], self.by_path[rid]))
        if not out: return None
        out.sort(key=lambda t: -(t[1] * t[2]))
        return out[0]

def clamp(v, lo, hi): return max(lo, min(hi, v))

def jit(pic_id, name, lo, hi):
    return random.Random('%s:%s' % (pic_id, name)).randint(lo, hi)

def centre(px, py, w, h):
    return (int(round(W / 2 + px - w / 2)), int(round(H / 2 + py - h / 2)))

def place(pic_id, name, w, h, frog_cy):
    """art directed placement of one scenery piece inside the 500x350 photo"""
    n = name.lower()
    if w >= 440 and h >= 280:
        return (0, 0)                                            # full frame backdrop
    if n.startswith('cloud'):
        return (clamp((W - w) // 2 + jit(pic_id, name, -40, 40), -80, 80), jit(pic_id, n + 'y', -20, 20))
    if n.startswith('mou') or n.startswith('rime') or 'mountain' in n:
        return (clamp((W - w) // 2 + jit(pic_id, name, -30, 30), -120, 120), jit(pic_id, n + 'y', 90, 150))
    if w >= 600 and h < 200:                                     # panorama strip (roof, rail, sea line)
        y = clamp(frog_cy + 26 - h, 0, H - h) if frog_cy is not None else H - h
        return ((W - w) // 2, y)
    if h >= 200:                                                 # tall object (tree, tulou, bamboo)
        return (clamp((W - w) // 2 + jit(pic_id, name, -170, 170), -w // 3, W - w + w // 3), H - h + 20)
    if any(k in n for k in FLYING):
        return (clamp((W - w) // 2 + jit(pic_id, name, -170, 170), -40, W - w + 40),
                jit(pic_id, n + 'y', 10, 120))
    return (clamp((W - w) // 2 + jit(pic_id, name, -160, 160), -w // 3, W - w + w // 3), H - h - 10)

def build(pic, art):
    out, report = {}, []
    for t in pic:
        pid = t['id']
        fpos = t.get('frogPos') or {}
        frog_cy = (H / 2 + fpos['y']) if 'y' in fpos else None
        layers, baked = [], False
        for name in (t.get('backImage') or []):
            got = art.pick(name)
            if not got:
                report.append('pic %s: back %r unresolved' % (pid, name)); continue
            rid, w, h, path = got
            if '/Goal/' in path or '/Unique/' in path: baked = True
            layers.append((rid,) + place(pid, name, w, h, frog_cy))
        if not baked and 'x' in fpos and (fpos['x'] or fpos['y']):
            pose = t.get('frogPose') or ''
            base = pose[4:] if pose.startswith('rnd_') else pose
            base = base[5:] if base.startswith('pose_') else base
            got = art.pick(base, 'qw')
            if got:
                layers.append((got[0],) + centre(fpos['x'], fpos['y'], got[1], got[2]))
            else:
                report.append('pic %s: frog %r unresolved' % (pid, pose))
        if not baked:
            tps, tpo = t.get('travelerPose') or [], t.get('travelerPos') or []
            r = random.Random('trav:%s' % pid)
            if tps and tpo and r.random() < 0.5:
                i = r.randrange(len(tps))
                pose = tps[i] or ''
                base = pose[4:] if pose.startswith('rnd_') else pose
                base = base[5:] if base.startswith('pose_') else base
                got = art.pick(base, FRIENDS[r.randrange(3)])
                if got and i < len(tpo):
                    layers.append((got[0],) + centre(tpo[i]['x'], tpo[i]['y'], got[1], got[2]))
        for name in (t.get('frontImage') or []):
            got = art.pick(name)
            if not got:
                report.append('pic %s: front %r unresolved' % (pid, name)); continue
            rid, w, h, path = got
            layers.append((rid,) + place(pid, name, w, h, frog_cy))
        def covers(rid):
            d = art.dims_of(rid)
            return d and d[0] >= 440 and d[1] >= 280
        if layers and not any(covers(l[0]) for l in layers):
            sky = art.pick('sky01') or art.pick('sky05')
            if sky: layers.insert(0, (sky[0], 0, 0))
        if layers:
            out[str(pid)] = [list(l) for l in layers]
        report.append('pic %-5s %-8s %-16s layers=%2d %s' % (
            pid, t.get('type'), t.get('name'), len(layers), 'baked' if baked else ''))
    return out, report

def compose(pic_id, data, art, bg=(255, 255, 255, 255)):
    import pnglite
    buf = bytearray()
    for _ in range(W * H): buf += bytes(bg)
    for rid, x, y in data[str(pic_id)]:
        p = 'assets/game/resource/China/images/' + art.by_path[rid] + '.png'
        w, h, rgba = pnglite.read_png(art.z.read(p))
        x = int(x); y = int(y)
        pnglite.blend(buf, W, H, rgba, w, h, x, y)
    return buf

def main():
    pic, res, cfg = load()
    art = Art(res, cfg)
    data, report = build(pic, art)
    io.open(os.path.join(ROOT, 'logs/pictures_report.txt'), 'w', encoding='utf-8').write('\n'.join(report))
    notes = json.load(io.open(os.path.join(ROOT, 'tables/Note_json.json'), encoding='utf-8'))
    note_ids = sorted(int(k) for k in notes) if isinstance(notes, dict) else []
    js = '/* generated by tools/genpictures.py - postcard layer compositions */\n' \
         'window.MOCK_PICTURES = ' + json.dumps(data, separators=(',', ':')) + ';\n' \
         '/* note paper textures (Scene/Note/Pic/pic_<id>_png) that the diary can ask for */\n' \
         'window.MOCK_NOTE_IDS = ' + json.dumps(note_ids) + ';\n'
    io.open(os.path.join(ROOT, 'new/pictures.js'), 'w', encoding='utf-8').write(js)
    print('pictures:', len(data), 'of', len(pic), 'templates; js bytes', len(js))
    print('unresolved reports:', len([r for r in report if 'unresolved' in r]))

if __name__ == '__main__':
    main()
