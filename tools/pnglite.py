# pnglite.py - minimal pure-python PNG read/write (8-bit RGB/RGBA/palette), no deps.
import zlib, struct

def _paeth(a, b, c):
    p = a + b - c
    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
    if pa <= pb and pa <= pc: return a
    if pb <= pc: return b
    return c

def read_png(data):
    if data[:8] != b'\x89PNG\r\n\x1a\n': raise ValueError('not png')
    pos = 8; idat = b''; w = h = depth = ctype = None; plte = None; trns = None
    while pos < len(data):
        ln = struct.unpack('>I', data[pos:pos+4])[0]; typ = data[pos+4:pos+8]
        body = data[pos+8:pos+8+ln]; pos += 12 + ln
        if typ == b'IHDR':
            w, h, depth, ctype = struct.unpack('>IIBB', body[:10])
        elif typ == b'PLTE': plte = body
        elif typ == b'tRNS': trns = body
        elif typ == b'IDAT': idat += body
        elif typ == b'IEND': break
    if depth != 8: raise ValueError('depth %s unsupported' % depth)
    raw = zlib.decompress(idat)
    nch = {0:1, 2:3, 3:1, 4:2, 6:4}[ctype]
    stride = w * nch
    out = bytearray(h * stride); prev = bytearray(stride); p = 0
    for y in range(h):
        f = raw[p]; p += 1
        line = bytearray(raw[p:p+stride]); p += stride
        if f == 1:
            for i in range(nch, stride): line[i] = (line[i] + line[i-nch]) & 255
        elif f == 2:
            for i in range(stride): line[i] = (line[i] + prev[i]) & 255
        elif f == 3:
            for i in range(stride):
                a = line[i-nch] if i >= nch else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 255
        elif f == 4:
            for i in range(stride):
                a = line[i-nch] if i >= nch else 0
                c = prev[i-nch] if i >= nch else 0
                line[i] = (line[i] + _paeth(a, prev[i], c)) & 255
        out[y*stride:(y+1)*stride] = line; prev = line
    if ctype == 6: return w, h, bytes(out)
    rgba = bytearray(w*h*4)
    if ctype == 2:
        for i in range(w*h):
            rgba[i*4:i*4+3] = out[i*3:i*3+3]; rgba[i*4+3] = 255
    elif ctype == 0:
        for i in range(w*h):
            v = out[i]; rgba[i*4] = rgba[i*4+1] = rgba[i*4+2] = v; rgba[i*4+3] = 255
    elif ctype == 3:
        for i in range(w*h):
            idx = out[i]; rgba[i*4:i*4+3] = plte[idx*3:idx*3+3]
            rgba[i*4+3] = trns[idx] if (trns and idx < len(trns)) else 255
    elif ctype == 4:
        for i in range(w*h):
            v = out[i*2]; rgba[i*4] = rgba[i*4+1] = rgba[i*4+2] = v; rgba[i*4+3] = out[i*2+1]
    return w, h, bytes(rgba)

def write_png(path, w, h, rgba):
    raw = bytearray()
    stride = w*4
    for y in range(h):
        raw.append(0); raw += rgba[y*stride:(y+1)*stride]
    def chunk(t, d):
        c = struct.pack('>I', len(d)) + t + d
        return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    hdr = struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', hdr) +
        chunk(b'IDAT', zlib.compress(bytes(raw), 6)) + chunk(b'IEND', b''))

def blend(dst, dw, dh, src, sw, sh, x, y):
    x = int(x); y = int(y)
    for sy in range(sh):
        dy = y + sy
        if dy < 0 or dy >= dh: continue
        row = sy*sw*4; drow = dy*dw*4
        for sx in range(sw):
            dx = x + sx
            if dx < 0 or dx >= dw: continue
            sa = src[row+sx*4+3]
            if sa == 0: continue
            i = drow+dx*4; j = row+sx*4
            if sa == 255:
                dst[i:i+4] = src[j:j+4]
            else:
                ia = 255-sa
                dst[i]   = (src[j]*sa + dst[i]*ia)//255
                dst[i+1] = (src[j+1]*sa + dst[i+1]*ia)//255
                dst[i+2] = (src[j+2]*sa + dst[i+2]*ia)//255
                dst[i+3] = min(255, sa + dst[i+3]*ia//255)
