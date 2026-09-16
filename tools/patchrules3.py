p='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw/tools/genrules.py'
s=open(p,encoding='utf-8').read()
# 1) add extra table loads after gifts
if 'GIFT_ITEM_IDS' not in s:
    s=s.replace("giftids=[g.get('id') for g in gifts] if isinstance(gifts,list) else []",
"""giftids=[g.get('itemId') for g in gifts] if isinstance(gifts,list) else []
cols=load('Collection_json')
collids=[c.get('id') for c in cols] if isinstance(cols,list) else []
pics=load('Picture_json')
picids=[p.get('id') for p in pics] if isinstance(pics,list) else []""")
    s=s.replace("""js.append('  var GIFT_IDS   = '+json.dumps(giftids[:20])+';')""",
"""js.append('  var GIFT_IDS   = '+json.dumps(giftids[:40])+';')
js.append('  var COLL_IDS   = '+json.dumps(collids[:40])+';')
js.append('  var PIC_IDS    = '+json.dumps(picids[:60])+';')""")
    # 2) state additions
    s=s.replace("notes: [], gifts: [],", "notes: [], gifts: [], photos: [], nextPhoto: 1,")
    # 3) comeBack: photo + album push
    s=s.replace("""    push('client_load_role', roleData(), 40);
    push('travel_load_note', {note_list: st.notes}, 90);""",
"""    var pid = PIC_IDS[Math.floor(Math.random()*PIC_IDS.length)];
    var photo = { id: st.nextPhoto++, pic_id: pid };
    st.photos.push(photo);
    push('client_load_role', roleData(), 40);
    push('album_load_new', { pictures: [photo], has_ads:false, is_share:false, visted_pic: [] }, 70);
    push('travel_load_note', {note_list: st.notes}, 90);""")
    # 4) gift/album/visitor semantics
    s=s.replace("""  S['travel_load_gift'] = function(){ return { list: st.gifts }; };""",
"""  S['travel_load_gift'] = function(){ return { pictures: st.photos.map(function(p){return p.id;}), specialtys: st.gifts }; };
  S['album_load'] = function(){ return { pictures: st.photos, start: 1, total: st.photos.length }; };
  S['album_load_all'] = function(){ return { id_list: st.photos }; };
  S['album_load_by_id_list'] = function(){ return { pic_list: [] }; };
  S['album_load_new'] = function(){ return { pictures: [], has_ads:false, is_share:false, visted_pic: [] }; };
  S['visit_load'] = function(){
    return { visitor: { partner:0, name:"\\u5c0f\\u8717", title:0, expire_time: nowSec()+3600, city:"\\u5e7f\\u4e1c\\u7701_\\u5e7f\\u5dde\\u5e02", food:0, first:true, gift:{item_id:0,count:0}, carpet:1 },
             acquire: COLL_IDS.slice(0,6) };
  };""")
    open(p,'w',encoding='utf-8').write(s); print('genrules patched')
else: print('already patched')
