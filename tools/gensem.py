import json, time, os
BASE='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw'
T=BASE+'/tables/'
def load(n):
    return json.load(open(T+n+'.json',encoding='utf-8'))
now=int(time.time())
sem={}
# --- items: real starter foods from Item.json ---
sem['item_load_items']={"house":[],"bag":[0,1,2,3],"desk":[0],"bag_completed":0,"bag_conflict":0,"desk_conflict":0,"gacha":{"color_ball":-1}}
sem['item_load_select_gift']={"list":[]}
# --- food shop (Shop.json + shopData) ---
try:
    shop=load('Shop_json')
    sem['item_load_shop_info']={"list":shop}
except Exception as e: pass
# --- travel notes: real Note ids ---
try:
    nt=load('Note_json')
    ids=sorted((int(k) for k in nt), key=lambda x:x)[:3]
    sem['travel_load_note']={"note_list":[{"id":i,"read":(1 if n==0 else 0),"timestamp":now-3600*(n+1)} for n,i in enumerate(ids)]}
except Exception as e: pass
# --- furniture shop ---
try:
    fs=load('furnitureShopData_json')
    lst=[]
    for k in sorted(fs, key=lambda x:int(x)):
        v=fs[k]
        if isinstance(v,dict):
            lst.append(v)
        if len(lst)>=12: break
    sem['furniture_load_furniture']={"shop":{"shop_list":lst,"start_time":0,"leave_time":0},"replace_fur":[],"box_list":[],"compost_list":[],"tumbler_list":[]}
    sem['furniture_load_pocket']={"list":[]}
except Exception as e: pass
# --- lottery ---
try:
    lot=load('lotteryData_json')
    sl=lot.get('select_list') or {}
    arr=[sl[k] for k in sorted(sl,key=lambda x:int(x))] if isinstance(sl,dict) else sl
    sem['lottery_load']={"select_list":arr,"list":arr}
except Exception as e: pass
# --- story ---
try:
    st=load('story_json')
    stories=st.get('story') or []
    sem['story_load']={"stories":stories,"new_story_id":0}
except Exception as e: pass
# --- collection acquire (guest drawing) ---
try:
    col=load('Collection_json')
    ids=[c.get('id') for c in col[:6]] if isinstance(col,list) else []
    sem['guest_load_drawing']={"colls":ids,"pages":[]}
    sem['visit_load']={"acquire":ids}
except Exception as e: pass
# --- tasks ---
try:
    td=load('taskData_json')
    lm=td.get('list_map') or {}
    tasks=[lm[k] for k in sorted(lm,key=lambda x:int(x))] if isinstance(lm,dict) else lm
    sem['task_load']={"tasks":tasks[:8],"list":[]}
except Exception as e: pass
# --- encyclopedia ---
try:
    en=load('encyclopedia_json')
    desc=en.get('desc') or {}
    unlock=sorted(int(k) for k in desc)[:12] if isinstance(desc,dict) else []
    sem['encyclopedia_load']={"unlock_list":unlock,"unlock_desc":[],"show_sub":[]}
    sem['encytravel_load']={"unlock_list":unlock,"unlock_desc":[],"show_sub":[]}
except Exception as e: pass
# --- calendar ---
try:
    cd=load('calendarData_json')
    bg=cd.get('beginner') or {}
    tl=[bg[k] for k in sorted(bg,key=lambda x:int(x))] if isinstance(bg,dict) else bg
    sem['calendar_load']={"lucky_days":{},"new_flag":[],"st_days":{},"task_list":tl[:5],"note_list":[]}
except Exception as e: pass
sem['client_rename_cost']={"clover":0}
sem['client_set_name']={"code":0,"lucky":0}
out='window.MOCK_SEMANTIC = '+json.dumps(sem,ensure_ascii=False)+';\n'
open(BASE+'/new/semantic.js','w').write(out)
print('semantic protocols:', len(sem))
print('keys:', ' '.join(sorted(sem)))
