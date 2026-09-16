import re
p='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw/tools/gen.py'
s=open(p,encoding='utf-8').read()
old="    if re.search(r'(_load|_update|_notice)$', name): push.append(name)"
new="    if ('_load' in name) or name.endswith('_update') or name.endswith('_notice'): push.append(name)"
s=s.replace(old,new)
open(p,'w',encoding='utf-8').write(s)
print('widened' if new in s else 'WIDEN FAILED')
