import json, re
BASE='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw'
spec=json.load(open(BASE+'/probe_out.json'))
BOOL=re.compile(r'^(is_|has_)')
NUM=re.compile(r'(cnt|count|num|time|id|point|ticket|clover|status|step|code|type|flag|switch|index|idx|total|start|level|exp|price|coin|day|hour|ver|phase|duration|value|icon|pic|wx_|_at|completed|conflict|ball)')
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
lines=[]; used=0; handled=[]
for name in sorted(spec):
    v=spec[name]
    if v.get('err'): continue
    fields=[f for f in v.get('fields',[]) if f and not f.endswith('.length') and f!='length']
    if not fields: continue
    arrays=set(a for a in v.get('arrays',[]) if a)
    top=sorted(set(f.split('.')[0] for f in fields))
    body=', '.join(json.dumps(t)+': '+emit(t, set(fields), arrays) for t in top)
    lines.append('  Mock.handlers[%s] = function(){ return {%s}; };' % (json.dumps(name), body))
    used+=1; handled.append((name, bool(v.get('req'))))
open(BASE+'/new/handlers_auto.js','w').write('\n'.join(lines)+'\n')
push=[]
for name,req in handled:
    if req: continue
    if name.startswith('hall_') or name.startswith('notify_') or name.startswith('client_') or name.startswith('guest_'): continue
    if ('_load' in name) or name.endswith('_update') or name.endswith('_notice'): push.append(name)
push += ['client_load_decorate','client_load_events','client_load_publicity']
seen=set(); push=[x for x in push if not (x in seen or seen.add(x))]
json.dump({'pushlist':push}, open(BASE+'/new/pushlist.json','w'), indent=1)
print('handlers:',used,'| push:',len(push))
print(' '.join(push))
