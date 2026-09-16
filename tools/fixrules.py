p='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw/new/rules.js'
s=open(p,encoding='utf-8').read()
old="push('furniture_load_furniture', S['furniture_load_furniture'] ? S['furniture_load_furniture']() : {}, 20);"
new="var _f=S['furniture_load_furniture']; push('furniture_load_furniture', (typeof _f==='function'? _f() : _f) || {}, 20);"
if old in s:
    s=s.replace(old,new); open(p,'w',encoding='utf-8').write(s); print('rules fixed')
elif 'typeof _f===' in s: print('already fixed')
else: print('rules pattern missing')
