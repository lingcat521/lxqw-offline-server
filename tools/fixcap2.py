p='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw/new/guard.js'
s=open(p,encoding='utf-8').read()
if 'return 2; }' not in s.split('bagCap')[1][:600]:
    s=s.replace('''    } catch(e){ return 4; }
  }''','''    } catch(e){ return 2; }
  }''')
    s=s.replace('''      if (typeof core === "undefined" || typeof UserModel === "undefined") return 4;''',
                '''      if (typeof core === "undefined" || typeof UserModel === "undefined") return 2;''')
    open(p,'w',encoding='utf-8').write(s); print('guard: unreadable state -> bag 2 (safest)')
else: print('guard already safest')
