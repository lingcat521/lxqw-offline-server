p='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw/new/mock.js'
s=open(p,encoding='utf-8').read()
s=s.replace('var files = ["semantic.js", "rules.js"];','var files = ["semantic.js", "defaults.js", "rules.js"];')
old='      var resp = Mock.handle(name, params);\n      if (name === "hall_login"'
new='      var resp = (wants || hasCb) ? Mock.handle(name, params) : null;\n      if (name === "hall_login"'
if old in s:
    s=s.replace(old,new); print('skip-handle patched')
else:
    print('skip-handle pattern missing')
s=s.replace('version: "0.9.0"','version: "0.10.0"')
open(p,'w',encoding='utf-8').write(s)
