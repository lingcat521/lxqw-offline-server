import json, re
BASE='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw'
spec=json.load(open(BASE+'/probe_out.json'))
cb=json.load(open(BASE+'/probe_callbacks.json'))
merged={}
for name,v in spec.items():
    if v.get('err'): continue
    f=[x for x in v.get('fields',[]) if x and not x.endswith('.length')]
    if not f: continue
    merged.setdefault(name,{'fields':set(),'arrays':set(),'req':bool(v.get('req'))})
    merged[name]['fields'].update(f)
    merged[name]['arrays'].update(v.get('arrays',[]))
for name,v in cb.items():
    f=[x for x in v.get('fields',[]) if x and not x.endswith('.length')]
    if not f: continue
    merged.setdefault(name,{'fields':set(),'arrays':set(),'req':False})
    merged[name]['fields'].update(f)
    merged[name]['arrays'].update(v.get('arrays',[]))
BOOL=re.compile(r'^(is_|has_)')
NUM=re.compile(r'(cnt|count|num|time|id|point|ticket|clover|status|step|code|type|flag|switch|index|idx|total|start|level|exp|price|coin|day|hour|ver|phase|duration|value|icon|pic|wx_|_at|completed|conflict|ball|lucky)')
STR=re.compile(r'(name|desc|text|content|msg|message|city|title|url|key|lang|string)')
LIST=re.compile(r'^(_)?(list|arr|ary|bag|desk|house|items|tasks|cards|notes|pics|pictures|list_all)$')
def default(path):
    leaf=path.split('.')[-1]
    if leaf=='visitor': return '0'
    if BOOL.match(leaf): return 'false'
    if NUM.search(leaf): return '0'
    if LIST.match(leaf): return '[]'
    if STR.search(leaf): return '""'
    return 'MOCK_FLEX()'
def emit(path, paths, arrays):
    ch=sorted(set(q[len(path)+1:].split('.')[0] for q in paths if path and q.startswith(path+'.')))
    if path in arrays:
        if ch:
            parts=[json.dumps(c)+': '+emit(path+'.'+c, paths, arrays) for c in ch]
            return '[' + '{ ' + ', '.join(parts) + ' }' + ']'
        return '[]'
    if ch:
        parts=[json.dumps(c)+': '+emit(path+'.'+c, paths, arrays) for c in ch]
        return '{ ' + ', '.join(parts) + ' }'
    return default(path)
lines=[]; names=[]
for name in sorted(merged):
    v=merged[name]
    paths=set(v['fields'])
    if not paths: continue
    top=sorted(set(f.split('.')[0] for f in paths))
    body=', '.join(json.dumps(t)+': '+emit(t, paths, v['arrays']) for t in top)
    lines.append('  Mock.handlers[%s] = function(){ return {%s}; };' % (json.dumps(name), body))
    names.append(name)
open(BASE+'/new/handlers_auto.js','w').write('\n'.join(lines)+'\n')
print('merged handlers:', len(names))
print('sample:', ' '.join(names[:25]))
