p='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw/tools/gensem.py'
s=open(p,encoding='utf-8').read()
add = """sem['client_rename_cost']={"clover":0}
sem['client_set_name']={"code":0,"lucky":0}
"""
if "client_rename_cost" not in s:
    s=s.replace("out='window.MOCK_SEMANTIC = '", add+"out='window.MOCK_SEMANTIC = '")
    open(p,'w',encoding='utf-8').write(s); print('gensem patched')
else: print('already')
