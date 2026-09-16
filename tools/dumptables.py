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
i=src.find('Utils.simpleEncrypt("'); j=i+len('Utils.simpleEncrypt("'); k2=src.find('"', j)
raw=src[j:k2]
KEY=''.join(chr(ord(c)-13 if idx%2==0 else ord(c)+13) for idx,c in enumerate(raw)).encode('utf-8')
z=zipfile.ZipFile(APK)
def load_eab(name):
    buf=z.read('assets/game/resource/China/eab/'+name+'.eab')
    if list(buf[:8])==[137,69,65,66,13,10,27,10]:
        ct=to_u32(buf[8:],False); ct=dec(ct, to_u32((KEY+b'\x00'*16)[:16],False)); pt=to_bytes(ct,True)
    elif list(buf[:8])==[137,69,65,66,13,10,26,10]:
        meta_len=struct.unpack('<I',buf[8:12])[0]; meta=json.loads(buf[12:12+meta_len])
        off=12+meta_len; out={}
        for e in meta:
            d=buf[off:off+e['s']]; off+=e['s']
            if e.get('t')=='json': out[e['n']]=json.loads(d.decode('utf-8'))
        return out
    else:
        return None
    metaLen=struct.unpack('<I',pt[:4])[0]
    meta=json.loads(pt[4:4+metaLen].decode('utf-8'))
    off=4+metaLen; out={}
    for e in meta:
        d=pt[off:off+e['s']]; off+=e['s']
        if e.get('t')=='json':
            try: out[e['n']]=json.loads(d.decode('utf-8'))
            except Exception as ex: out[e['n']]='PARSE_FAIL'
    return out
tables=load_eab('config')
os.makedirs(BASE+'/tables',exist_ok=True)
ok=0
for k,v in tables.items():
    if isinstance(v,str): continue
    json.dump(v, open(BASE+'/tables/'+k+'.json','w'), ensure_ascii=False)
    ok+=1
print('tables dumped:', ok, '/', len(tables))
def shape(o, depth=0, maxd=3):
    if depth>maxd: return '...'
    if isinstance(o,list):
        return ['len=%d'%len(o)] + ([shape(o[0],depth+1,maxd)] if o else [])
    if isinstance(o,dict):
        return {k:shape(v,depth+1,maxd) for k,v in list(o.items())[:12]}
    return type(o).__name__
for t in ['Item_json','Note_json','Shop_json','furnitureData_json','lotteryData_json','Collection_json']:
    v=tables.get(t)
    print('\n### '+t)
    print(json.dumps(shape(v), ensure_ascii=False)[:900])
