import json,re
BASE='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw'
src=open(BASE+'/apk/assets/game/js/main.min.js',encoding='utf-8',errors='replace').read()
i=src.index('protocolList={')
def match(s,start):
    depth=0;k=start
    while k<len(s):
        c=s[k]
        if c=='{':depth+=1
        elif c=='}':
            depth-=1
            if depth==0:return k
        elif c=='"' or c=="'":
            q=c;k+=1
            while k<len(s) and s[k]!=q:k+=1
        k+=1
    return -1
j=i+len('protocolList=')
block=src[j:match(src,j)+1]
params=dict()
for m in re.finditer(r'([A-Za-z0-9_]+):\[\[([^\]]*)\],(!?[01])\]', block):
    ps=[x.strip().strip('"') for x in m.group(2).split(',') if x.strip()]
    params[m.group(1)]={'params':ps,'needs':m.group(3)=='!0'}
cb=json.load(open(BASE+'/probe_callbacks.json'))
push=json.load(open(BASE+'/new/pushlist.json'))['pushlist']
targets=['item_buy','item_putin_bag','item_takeout_bag','item_putin_desk','item_takeout_desk','item_select_gift','item_load_shop_info','item_load_handbook','clover_harvest','clover_harvest_resend','clover_load_clovers','travel_read_note','travel_load_gift','travel_gift_to_bag','travel_bag_to_gift','travel_load_note','furniture_buy_shop','furniture_putin_box','furniture_takeout_box','guest_accept_invit','lottery_open','lottery_select','clover_notice_get','item_update','item_update_ticket','task_get_reward','task_get_list_reward']
for t in targets:
    p=params.get(t,{})
    c=cb.get(t,{})
    print('%-24s params=%-28s needs=%-5s cbFields=%s' % (t, ','.join(p.get('params',[])) or '-', p.get('needs'), ','.join(c.get('fields',[])[:10]) or '-'))
