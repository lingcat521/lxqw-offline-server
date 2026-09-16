import zipfile, struct, json, os
APK='/storage/emulated/0/MT2/mcp/lxqw_offline_v14.apk'
BASE='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw'
DELTA=0x9E3779B9; M32=0xFFFFFFFF
def to_u32(b, il):
    n=(len(b)+3)//4
    res=[0]*(n+1) if il else [0]*n
    if il: res[n]=len(b)
    for i,x in enumerate(b): res[i>>2] |= x << ((i&3)*8)
    return res
def to_bytes(v, il):
    n=len(v)*4
    if il:
        m=v[-1]; n-=4
        if m<n-3 or m>n: return None
        n=m
    return bytes(((v[i>>2] >> ((i&3)*8)) & 0xFF) for i in range(n))
def dec(v,k):
    n=len(v)
    if n<2: return v
    q=6+52//n; s=(q*DELTA)&M32; y=v[0]
    while s!=0:
        e=(s>>2)&3
        for p in range(n-1,0,-1):
            z=v[p-1]
            mx=((((z>>5)^((y<<2)&M32))+((y>>3)^((z<<4)&M32)))&M32) ^ (((s^y)+ (k[(p&3)^e]^z))&M32)
            v[p]=(v[p]-mx)&M32; y=v[p]
        z=v[n-1]
        mx=((((z>>5)^((y<<2)&M32))+((y>>3)^((z<<4)&M32)))&M32) ^ (((s^y)+ (k[(0&3)^e]^z))&M32)
        v[0]=(v[0]-mx)&M32; y=v[0]
        s=(s-DELTA)&M32
    return v
src=open(BASE+'/apk/assets/game/js/main.min.js',encoding='utf-8',errors='replace').read()
i=src.find('Utils.simpleEncrypt("')
j=i+len('Utils.simpleEncrypt("')
k2=src.find('"', j)
raw=src[j:k2]
out=''.join(chr(ord(c)-13 if idx%2==0 else ord(c)+13) for idx,c in enumerate(raw))
KEY=out.encode('utf-8')
print('derived key:', KEY)
z=zipfile.ZipFile(APK)
buf=z.read('assets/game/resource/China/eab/config.eab')
ct=to_u32(buf[8:], False)
ct=dec(ct, to_u32((KEY+b'\x00'*16)[:16], False))
pt=to_bytes(ct, True)
if pt is None:
    print('FAILED length check')
else:
    print('plain bytes:', len(pt), 'hex head:', pt[:24].hex())
    metaLen=struct.unpack('<I', pt[:4])[0]
    print('metaLen:', metaLen)
    try:
        meta=json.loads(pt[4:4+metaLen].decode('utf-8'))
        print('META ENTRIES:', len(meta))
        for e in meta[:50]: print('   ', e)
    except Exception as ex:
        print('json fail', ex, repr(pt[4:120]))
