import zipfile, struct, json, os, sys
APK='/storage/emulated/0/MT2/mcp/lxqw_offline_v14.apk'
BASE='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw'
HEADER=bytes([0x89,0x45,0x41,0x42,0x0D,0x0A,0x1A,0x0A])
def decode(buf):
    if buf[:8]!=HEADER: return None
    metaLen=struct.unpack('<I', buf[8:12])[0]
    meta=json.loads(buf[12:12+metaLen].decode('utf-8'))
    off=12+metaLen; out={}
    for e in meta:
        data=buf[off:off+e['s']]; off+=e['s']
        out[e['f']]={'t':e.get('t'),'bytes':data}
    return out
z=zipfile.ZipFile(APK)
eabs=sorted(n for n in z.namelist() if n.endswith('.eab'))
os.makedirs(BASE+'/eab',exist_ok=True)
total=0
for n in eabs:
    d=decode(z.read(n))
    if d is None:
        print(n,'NOT EAB'); continue
    name=os.path.basename(n)[:-4]
    print('=== %s : %d entries ===' % (name, len(d)))
    for k,v in d.items():
        t=v['t']; b=v['bytes']
        print('   %-28s type=%-5s size=%d' % (k, t, len(b)))
        if t=='json' and len(b)<4000000:
            try:
                val=json.loads(b.decode('utf-8'))
                os.makedirs(BASE+'/eab/'+name,exist_ok=True)
                json.dump(val, open(BASE+'/eab/'+name+'/'+k+'.json','w'), ensure_ascii=False)
            except Exception as ex: print('      json parse fail', ex)
        total+=1
print('total entries:', total)
