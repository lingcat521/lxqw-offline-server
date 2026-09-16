import re
BASE='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw'
p=BASE+'/new/mock.js'
s=open(p,encoding='utf-8').read()
old='      var resp = (wants || hasCb) ? Mock.handle(name, params) : null;'
new='      /* always run the handler: many fire-and-forget protocols (mail_open, mail_read,\n         client_set_client, guest_confirm...) MUTATE server state even though they\n         expect no reply. Skipping them broke state + persistence. */\n      var resp = Mock.handle(name, params);'
if old in s:
    s=s.replace(old,new); s=s.replace('version: "0.18.0"','version: "0.19.0"')
    open(p,'w',encoding='utf-8').write(s); print('mock: handlers always run (v0.19)')
elif 'always run the handler' in s: print('already fixed')
else: print('PATTERN MISSING')
