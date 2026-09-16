import json
BASE='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw'
T=BASE+'/tables/'
def load(n): return json.load(open(T+n+'.json',encoding='utf-8'))

enc=load('encyclopedia_json'); ent=load('encytravel_json')
def _build(t):
    d=t.get('desc') or {}
    ids=sorted(int(k) for k in d)
    # 客户端 isDescUnlock(id, 下标) 是拿"下标"去 unlock_desc[id] 里找的, 正文由客户端自己的
    # encyclopedia/encytravel 表提供 —— 所以 list 必须是**已解锁的下标数组**, 不是正文文本
    desc=[{'id':i,'list':[int(k) for k in sorted(d[str(i)],key=lambda x:int(x))]} for i in ids]
    subs=[{'id':i,'sub_id':0} for i in ids]
    return ids, desc, subs
eau,ead,eas=_build(enc)
etu,etd,ets=_build(ent)
items=load('Item_json')
price={}; itype={}; iname={}
for it in items:
    if isinstance(it,dict):
        price[str(it.get('id'))]=it.get('price',0)
        itype[str(it.get('id'))]=it.get('type',0)
        iname[str(it.get('id'))]=it.get('name','')
shop=load('Shop_json')
shopmap={str(s.get('id')):s.get('itemId',0) for s in shop if isinstance(s,dict)}
notes=load('Note_json')
noteids=sorted(int(k) for k in notes)
gifts=load('Specialty_json')
giftids=[g.get('itemId') for g in gifts] if isinstance(gifts,list) else []
cols=load('Collection_json')
collids=[c.get('id') for c in cols] if isinstance(cols,list) else []
pics=load('Picture_json')
picids=[p.get('id') for p in pics] if isinstance(pics,list) else []
cal=load('calendarData_json')
beginner=cal.get('beginner') if isinstance(cal,dict) else {}
vis=load('visitors_json')
provkeys=list((vis.get('provinceList') or {}).keys()) if isinstance(vis,dict) else []
actkeys=[k for k in ((vis.get('actionList') or {}).keys())] if isinstance(vis,dict) else []
js=[]
js.append('/* lxqw offline rules: stateful gameplay model (generated) */')
js.append('(function(){')
js.append('  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};')
js.append('  var ITEM_PRICE = '+json.dumps(price,ensure_ascii=False)+';')
js.append('  var ITEM_TYPE  = '+json.dumps(itype,ensure_ascii=False)+';')
js.append('  var SHOP_ITEM  = '+json.dumps(shopmap,ensure_ascii=False)+';')
js.append('  var SHOP       = '+json.dumps(shop,ensure_ascii=False)+';')
js.append('  var NOTE_IDS   = '+json.dumps(noteids[:30])+';')
js.append('  var GIFT_IDS   = '+json.dumps(giftids[:40])+';')
js.append('  var COLL_IDS   = '+json.dumps(collids[:40])+';')
js.append('  var PIC_IDS    = '+json.dumps(picids[:60])+';')
js.append('  var PROV_NAMES = '+json.dumps(provkeys,ensure_ascii=False)+';')
js.append('  var BEGINNER   = '+json.dumps(beginner,ensure_ascii=False)+';')
js.append('  var ENCY_UNLOCK= '+json.dumps(eau)+';')
js.append('  var ENCY_DESC  = '+json.dumps(ead,ensure_ascii=False)+';')
js.append('  var ENCY_SUB   = '+json.dumps(eas)+';')
js.append('  var ET_UNLOCK  = '+json.dumps(etu)+';')
js.append('  var ET_DESC    = '+json.dumps(etd,ensure_ascii=False)+';')
js.append('  var ET_SUB     = '+json.dumps(ets)+';')
js.append('  var ACT_KEYS   = '+json.dumps(actkeys)+';')
js.append('''
  var TRAVEL_SECONDS = 90;
  /* the client renders one UI cell per array slot and uses -1 for an empty slot;
     the array must NEVER grow past the number of cells or it crashes on items[i].image */
  /* client Bag view has exactly 3 cells; Desk has 8. bagDataList.length IS the usable slot count. */
  var BAG_SLOTS = 4, DESK_SLOTS = 8;
  function SLOTS(n){ n = n||8; var a=[]; for (var i=0;i<n;i++) a.push(-1); return a; }
  function bagSlots(){ return SLOTS(BAG_SLOTS); }
  function deskSlots(){ return SLOTS(DESK_SLOTS); }
  function firstEmpty(a){ for (var i=0;i<a.length;i++) if (a[i] === -1 || a[i] === null || a[i] === undefined) return i; return -1; }
  var st = window.MOCK_STATE = window.MOCK_STATE || {
    clover: 1000, ticket: 10, name: "xiaowa",
    bag: bagSlots(), desk: deskSlots(), house: [],
    notes: [], gifts: [], photos: [], nextPhoto: 1, newFlag: [], beginnerDay: 0, cloverId: 1,
    frog: { status: 0, motion: 0, todayStep: 0, traveling: false, returnAt: 0, nextNote: 0 }
  };
  if (!st.frog) st.frog = { status:0, motion:0, todayStep:0, traveling:false, returnAt:0, nextNote:0 };
  if (!st.notes || !st.notes.length) {
    st.notes = NOTE_IDS.slice(0,3).map(function(id,i){ return {id:id, read:i===0?1:0, timestamp:Math.floor(Date.now()/1000)-3600*(i+1)}; });
  }
  /* The client's own settings are SERVER state: client_load_role.settings.client
     is a JSON string and every change the player makes is echoed back with
     client_set_client (UserModel.setClientSettings in main.min.js).
     guideStep drives the entire beginner tutorial, so if it is not persisted the
     player restarts the tutorial after every refresh and the 500-clover
     tutorial mail reward can never be kept. */
  var DEFAULT_CLIENT_SETTINGS = {
    guideStep: "Complete", bgSound: 1, effectSound: 1,
    hasAchieve: true, hasOpenAttributeView: true, hasEnteredRaffle: true,
    hasOpenedDesk: true, hasBuyTool: true, hasFriendVisit: true,
    guideVisitor: true, guideVisitorGift: true, guideStory: true,
    guideStoryGift: true, hasOpenedNote: true, guideNote: true,
    guideHandCraft: true, guideSlidePicture: true,
    /* 这几个是**阶段数字**, 必须给终态值: 给中间值会让客户端一直弹引导 ——
       guideFurniture 1->2->3->4->5 才是做完(中间阶段会在准备/出门按钮上画手指高亮 + 感叹号气泡)
       guideDrawing   1->2->3->4 才是做完(会在邀请弹窗上画手指)
       noticeDrawing  -1 = 不再提示"屋内多了些东西" */
    guideFurniture: 5, guideAnnualReview: true, guideFurnitureNotice: true,
    guideDrawing: 4, noticeDrawing: -1
  };
  /* Writes that arrive before the role push are the client's untouched
     SettingsInfo defaults (guideStep New): accepting them would clobber the
     save and re-open the tutorial, so ignore them. */
  var roleSent = false;
  /* re-applied on every role push so a partial or legacy save (one that predates
     a setting, or was written before the tutorial finished) is repaired instead
     of silently dropping the player back to GuideStep.New */
  function ensureClientSettings(){
    if (!st.clientSettings || typeof st.clientSettings !== "object") st.clientSettings = {};
    for (var csKey in DEFAULT_CLIENT_SETTINGS) {
      if (st.clientSettings[csKey] === undefined) st.clientSettings[csKey] = DEFAULT_CLIENT_SETTINGS[csKey];
    }
    /* 老存档可能停在引导的中间阶段(我们早先默认写过 1) —— 那会让手指高亮/感叹号
       永远挂在按钮上; 这里只对中间值做迁移, 升到终态 */
    var gf = st.clientSettings.guideFurniture;
    if (typeof gf === "number" && gf >= 1 && gf <= 4) st.clientSettings.guideFurniture = 5;
    var gd = st.clientSettings.guideDrawing;
    if (typeof gd === "number" && gd >= 1 && gd <= 3) st.clientSettings.guideDrawing = 4;
    if (st.clientSettings.noticeDrawing === 0) st.clientSettings.noticeDrawing = -1;
    return st.clientSettings;
  }
  ensureClientSettings();
  S['client_set_client'] = function(p){
    if (!roleSent) return {};
    var raw = p ? p.client : null, o = null;
    if (typeof raw === "string") { try { o = JSON.parse(raw); } catch(e) { o = null; } }
    else if (raw && typeof raw === "object") o = raw;
    if (o) for (var k in o) ensureClientSettings()[k] = o[k];
    return {};
  };
  function nowSec(){ return Math.floor(Date.now()/1000); }
  function push(name, data, delay){
    setTimeout(function(){ var M = window.MockServer; if (M && M.dispatch) M.dispatch(name, data); }, delay||30);
  }
  function roleData(){ roleSent = true; return {
    uid: 10001,
    res: { clover_point: st.clover, ticket: st.ticket },
    settings: { client: JSON.stringify(ensureClientSettings()), push_switch: 0, rank_switch: 0 },
    misc: { picture_cnt: st.photos.length, wx_push_reward: false, wx_my_reward: false, create_time: nowSec() },
    frog: { name: st.name||"xiaowa", cur_achieve:0, achieves:[], achieves_time:[], status: st.frog.status,
            motion: st.frog.motion, icon:0, pic_show:1, today_step: st.frog.todayStep,
            /* taobao_data 必须是**假值**: 客户端 eventSystem() 里
               var m = RoleModel.drawTaobaoData(); if (m) { 打开淘宝导入界面 ... }
               以前给 {} 是真值 -> 每次进游戏都自动弹"淘宝版物品已导入" */
            decoration:[], taobao_data:null }
  }; }
  S['client_load_role'] = function(){ return roleData(); };
  /* 淘宝导入相关: 没有可导入的东西, 也必须回 {ok:false}, 否则客户端按真值弹"淘宝版物品已导入" */
  S['client_draw_taobao'] = function(){ return { ok: false }; };
  S['client_taobao_import'] = function(){ return { collections: [], pictures: 0 }; };
  function pushItems(){ push('item_load_items', S['item_load_items'](), 20); }
  function pushClover(){ push('clover_update', {clover: st.clover}, 20); }
  function itemPrice(id){ var p = ITEM_PRICE[String(id)]; return (p===undefined?0:p); }
  function addClover(n){ st.clover += n; pushClover(); }
  function isFood(id){ return ITEM_TYPE[String(id)] === 0; }  /* 协议表里这两个协议的参数名是 pos/id, 而客户端发的就是 id; 以前只读 p.item_id
     -> 取到 undefined -> 包里塞进一个 undefined 条目(JSON 里是 null), 玩家看到的就是
     "东西没进包 / 永远不消耗"。两种写法都兼容。 */
  function paramItemId(p){ if (!p) return undefined;
    if (p.id !== undefined && p.id !== null) return p.id;
    if (p.item_id !== undefined && p.item_id !== null) return p.item_id;
    return undefined; }
  /* the client presses 准备 -> ItemModel.setBagLock(true) ->
     send("item_set_bag_completed", null, true); that is the ONLY departure
     trigger in the protocol list (there is no travel_depart* protocol), so the
     server must start the trip here. */
  function pushLock(){ push('item_load_items', S['item_load_items'](), 20); }
  function depart(){
    st.frog.status = 1; st.frog.motion = 1; st.frog.traveling = true;
    st.frog.returnAt = Date.now() + (st.travelSeconds || TRAVEL_SECONDS)*1000;
    st.bagCompleted = true; st.travelCount = (st.travelCount||0) + 1;
    /* 出发这一刻要**消耗**行李: 便当被吃掉、护身符/道具随身带走。
       以前什么都不扣, 玩家看到的就是"背包里的东西永远还在"。
       顺序很重要: story.js 的 tripLuggage 快照发生在本函数之前, 所以故事判定不受影响。 */
    st.lastTripItems = [];
    for (var bi = 0; bi < st.bag.length; bi++) if (st.bag[bi] !== -1 && st.bag[bi] !== null && st.bag[bi] !== undefined) { st.lastTripItems.push(st.bag[bi]); st.bag[bi] = -1; }
    for (var di = 0; di < st.desk.length; di++) if (st.desk[di] !== -1 && st.desk[di] !== null && st.desk[di] !== undefined) { st.lastTripItems.push(st.desk[di]); st.desk[di] = -1; }
    pushLock();
    push('client_load_role', roleData(), 60);
    try { console.log("[MOCK] 出发: 便当/护身符已备好, " + (st.travelSeconds || TRAVEL_SECONDS) + "秒后回家"); } catch(e){}
  }
  S['item_set_bag_completed'] = function(p){
    var done = !!(p && p.completed);
    st.bagCompleted = done;
    if (done && !st.frog.traveling) depart();
    else { pushLock(); push('client_load_role', roleData(), 40); }
    return {};
  };
  /* client-side guide/task progress report (fire and forget) */
  S['task_client_pro'] = function(p){
    st.clientPro = st.clientPro || {};
    var k = (p && p.param) ? String(p.param) : "";
    if (k) st.clientPro[k] = (st.clientPro[k]||0) + 1;
    return {};
  };
  function comeBack(){
    st.frog.status = 0; st.frog.motion = 0; st.frog.traveling = false; st.frog.returnAt = 0;
    st.bagCompleted = false;
    var nid = null;
    for (var k=0;k<NOTE_IDS.length;k++){
      var cand = NOTE_IDS[(st.frog.nextNote+k) % NOTE_IDS.length];
      var used = false;
      for (var i=0;i<st.notes.length;i++) if (st.notes[i].id === cand) used = true;
      if (!used) { nid = cand; st.frog.nextNote = (st.frog.nextNote+k+1) % NOTE_IDS.length; break; }
    }
    if (nid !== null) st.notes.push({id: nid, read: 0, timestamp: nowSec()});
    var gid = GIFT_IDS.length ? GIFT_IDS[Math.floor(Math.random()*GIFT_IDS.length)] : null;
    if (gid !== null) st.gifts.push({item_id: gid, count: 1});
    st.clover += 30;
    var pid = PIC_IDS[Math.floor(Math.random()*PIC_IDS.length)];
    var photo = { id: st.nextPhoto++, pic_id: pid };
    st.photos.push(photo);
    push('item_load_items', S['item_load_items'](), 20);
    push('client_load_role', roleData(), 40);
    push('album_load_new', { pictures: [photo], has_ads:false, is_share:false, visted_pic: [] }, 70);
    push('travel_load_note', {note_list: st.notes}, 90);
    push('clover_update', {clover: st.clover}, 130);
    push('travel_load_gift', S['travel_load_gift'](), 150);
    try { console.log("[MOCK] 回家: 笔记 " + (nid===null?"-":nid) + " 明信片 " + photo.id + " 三叶草 " + st.clover); } catch(e){}
  }
  setInterval(function(){ try { if (st.frog.traveling && Date.now() >= st.frog.returnAt) comeBack(); } catch(e){} }, 4000);

  S['item_load_items'] = function(){
    if (!Array.isArray(st.bag) || st.bag.length !== BAG_SLOTS) st.bag = normalise(st.bag, BAG_SLOTS);
    if (!Array.isArray(st.desk) || st.desk.length !== DESK_SLOTS) st.desk = normalise(st.desk, DESK_SLOTS);
    /* bag_completed drives ItemModel.bagLock: 1 = 便当已备好, 青蛙出发中 */
    return { house: st.house, bag: st.bag, desk: st.desk, bag_completed: st.bagCompleted ? 1 : 0,
             bag_conflict: 0, desk_conflict: 0, gacha: {color_ball:-1} };
  };
  /* 嘟嘟商店: 每天刷新一次限购(以前 purchased 只增不减, 买过就永远售罄) */
  function todayKey(){ var d = new Date(); return d.getFullYear() + chr(45) + (d.getMonth()+1) + chr(45) + d.getDate(); }
  S['item_load_shop_info'] = function(){
    st.purchased = st.purchased || [];
    var t = todayKey();
    if (st.shopDay !== t) { st.shopDay = t; st.purchased = []; try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
    return { purchased: st.purchased }; };
  S['shop_refresh'] = function(){ st.shopDay = todayKey(); st.purchased = []; return { code: 0 }; };

  /* 兑换码: 官方码池已随停服消失, 这里接受任意非空码, 每码只发一次奖(幂等) */
  S['item_use_gift_code'] = function(p){
    var code = String((p && (p.code || p.gift_code || p.id)) || 0).trim();
    if (!code) return { code: 1 };
    st.usedCodes = st.usedCodes || [];
    if (st.usedCodes.indexOf(code) >= 0) return { code: 2 };
    st.usedCodes.push(code);
    st.clover += 100; st.ticket += 1;
    try { pushClover(); } catch (e) {}
    try { push('item_update_ticket', { ticket: st.ticket }, 40); } catch (e) {}
    try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {}
    try { console.log('[MOCK] 兑换码 ' + code + ' -> 三叶草+100 抽奖券+1'); } catch (e) {}
    return { code: 0 };
  };
  S['item_load_shop_info'] = function(){ return { purchased: st.purchased || [] }; };
  /* item_buy: the client handler also reads e.ticket / e.ads_id / e.share_id
     (contract audit) - a bare {code:0} left the ticket and ad-share paths undefined */
  function buyResult(code, ticket){
    return { code: code,
             ticket: (typeof ticket === 'number') ? ticket : 0,
             ads_id: [], share_id: [] };
  }
  S['item_buy'] = function(p){
    var iid = SHOP_ITEM[String(p.shop_id)];
    if (iid === undefined) return buyResult(1);
    var cost = itemPrice(iid);
    if (st.clover < cost) return buyResult(2);
    st.clover -= cost;
    var slot = firstEmpty(st.bag);
    if (slot < 0) return buyResult(3);
    if (st.bag.indexOf(iid) < 0) st.bag[slot] = iid;
    st.purchased = st.purchased || []; st.purchased.push({item_id: (p.shop_id!==undefined?p.shop_id:iid), count: 1});
    pushItems(); pushClover();
    return buyResult(0);
  };
  function normalise(a, n){
    n = n || 8; var out = SLOTS(n);
    if (Array.isArray(a)) for (var i=0;i<a.length && i<n;i++){ var v=a[i]; out[i] = (v===null||v===undefined)?-1:v; }
    return out;
  }
  function putIn(arr, pos, id){
    var idx = (pos||1) - 1; if (idx < 0 || idx >= arr.length) idx = firstEmpty(arr); if (idx < 0) return;
    var j = st.bag.indexOf(id); if (j >= 0) st.bag[j] = -1;
    arr[idx] = id;
  }
  S['item_putin_bag'] = function(p){ putIn(st.bag, p.pos||1, paramItemId(p)); pushItems(); return {code:0}; };
  S['item_takeout_bag'] = function(p){ var i=(p.pos||1)-1; if (i>=0&&i<8) st.bag[i] = -1; pushItems(); return {code:0}; };
  S['item_putin_desk'] = function(p){
    putIn(st.desk, p.pos||1, paramItemId(p)); pushItems();
    if (isFood(paramItemId(p)) && !st.frog.traveling) depart();
    return {code:0};
  };
  S['item_takeout_desk'] = function(p){
    var pos=(p.pos||1)-1, id = st.desk[pos]; st.desk[pos] = -1;
    if (id!==null && id!==undefined && id!==-1 && st.bag.indexOf(id)<0) { var sl=firstEmpty(st.bag); if (sl>=0) st.bag[sl]=id; }
    pushItems(); return {code:0};
  };
  S['item_select_gift'] = function(p){
    var idx=p.index_list||[], out=[];
    for (var i=0;i<idx.length;i++) out.push({item_id: st.bag[idx[i]]||0, count:1, is_selected:1});
    return {items: out};
  };
  S['clover_load_clovers'] = function(){ return []; };
  S['clover_harvest'] = function(p){ addClover(10); return {clover: st.clover}; };
  S['travel_load_note'] = function(){ return { note_list: st.notes }; };
  /* 客户端 sendReadNote() 传的是**数组**: send("travel_read_note", null, ids)
     协议参数名是 id -> p.id 是 [1000,1001,...], 以前按单值比较永远不匹配, 于是感叹号点不掉 */
  S['travel_read_note'] = function(p){
    var ids = (p && Object.prototype.toString.call(p.id) === '[object Array]') ? p.id : [p && p.id];
    for (var k=0;k<ids.length;k++)
      for (var i=0;i<st.notes.length;i++) if (st.notes[i].id === ids[k]) st.notes[i].read = 1;
    push('travel_load_note', {note_list: st.notes}, 20); return {code:0};
  };
  S['travel_load_gift'] = function(){ return { pictures: st.photos.map(function(p){return p.id;}), specialtys: st.gifts }; };
  S['album_load'] = function(){ return { pictures: st.photos, start: 1, total: st.photos.length }; };
  S['album_load_all'] = function(){ return { id_list: st.photos }; };
  S['album_load_by_id_list'] = function(){ return { pic_list: [] }; };
  S['album_load_new'] = function(){ return { pictures: [], has_ads:false, is_share:false, visted_pic: [] }; };
  S['visit_load'] = function(){
    /* acquire holds PROVINCE names (client: acquireList.indexOf(province.Province)) */
    return { visitor: null, acquire: PROV_NAMES.slice(0,6) };
  };
  S['visit_set_carpet'] = function(p){ return {code:0}; };
  S['visit_open'] = function(p){ return {code:0}; };
  S['visitor_invite'] = function(p){
    /* a well-formed visitor: city must be "<province>_<city>" with province in provinceList,
       and partner must exist in actionList */
    var prov = PROV_NAMES.length ? PROV_NAMES[Math.floor(Math.random()*PROV_NAMES.length)] : "北京";
    var part = ACT_KEYS.length ? Number(ACT_KEYS[Math.floor(Math.random()*ACT_KEYS.length)]) : 0;
    return { visitor: { partner: part, name:"", title:0, expire_time: nowSec()+1800, city: prov+"_\u57ce\u533a",
                        food:0, first:false, gift:{item_id:100000,count:20}, carpet:1 } };
  };
  S['travel_gift_to_bag'] = function(p){ return {code:0}; };
  S['travel_bag_to_gift'] = function(p){ return {code:0}; };
  S['lottery_open'] = function(p){
    var pool=[0,1,2,3,4,5,15,19];
    var iid=pool[Math.floor(Math.random()*pool.length)];
    if (st.bag.indexOf(iid)<0) st.bag.push(iid);
    pushItems(); return { open_item:{item_id:iid,count:1}, extra_item:null };
  };
  S['lottery_select'] = function(p){ return {code:0}; };
  S['task_get_reward'] = function(p){ addClover(50); return {code:0}; };
  S['task_get_list_reward'] = function(p){ addClover(100); return {code:0}; };
  S['furniture_buy_shop'] = function(p){ var _f=S['furniture_load_furniture']; push('furniture_load_furniture', (typeof _f==='function'?_f():_f)||{}, 20); return {code:0}; };
  S['client_rename_cost'] = function(){ return {clover:0}; };
  S['client_set_name'] = function(p){ st.name = p.name; return {code:0, lucky:0}; };
  /* ---- clover grows in the courtyard: it must be harvestable ----
     客户端的可见/可采规则(RoleModel + CloverManager):
       last_harvest == -1  或  (last_harvest > 0 且 last_harvest + rebirth_span <= now)
     旧存档里 last_harvest 是 0 -> 两条件都不满足 -> 永远看不见三叶草, 这里迁移成 -1。
     element: 0 = 三叶草(+1), 1 = 四叶草(道具 1000), 2 = 直接给 sprite 这个道具 ---- */
  st.clovers = st.clovers || [
    {clover_id:1, last_harvest:-1, rebirth_span:1800, element:0, sprite:0},
    {clover_id:2, last_harvest:-1, rebirth_span:1800, element:0, sprite:0},
    {clover_id:3, last_harvest:-1, rebirth_span:1800, element:0, sprite:0}
  ];
  for (var ci=0; ci<st.clovers.length; ci++){ var cc = st.clovers[ci]; if (!cc) continue;
    if (cc.last_harvest === 0 || cc.last_harvest === undefined || cc.last_harvest === null) cc.last_harvest = -1;
    if (typeof cc.rebirth_span !== 'number' || cc.rebirth_span <= 0) cc.rebirth_span = 1800;
    if (typeof cc.element !== 'number') cc.element = 0;
  }
  S['clover_load_clovers'] = function(){ return st.clovers; };
  function cloverRoll(){ var r = Math.random(); return r < 0.12 ? 1 : (r < 0.22 ? 2 : 0); }
  var CLOVER_DROPS = [1002,1003,1004,1005,1006,1007,1008,1009,1010,1013,1014,1015,1016];
  function houseAdd(it, n){ st.house = st.house || [];
    for (var i=0;i<st.house.length;i++) if (Number(st.house[i].item_id) === Number(it)) { st.house[i].count = (st.house[i].count||0) + (n||1); return; }
    st.house.push({item_id: Number(it), count: n || 1}); }
  S['clover_harvest'] = function(p){
    var id = (p && (p.clover_id || p.id)) || 1, seen = null;
    for (var i=0;i<st.clovers.length;i++) if (Number(st.clovers[i].clover_id) === Number(id)) seen = st.clovers[i];
    if (!seen) seen = st.clovers[0];
    var el = Number(seen.element) || 0, sp = seen.sprite;
    /* 客户端在本地已经先发了奖励, 服务端必须镜像同一份, 否则两边会对不上 */
    if (el === 1) houseAdd(1000, 1);
    else if (el === 2 && sp) houseAdd(sp, 1);
    else { st.clover += 1; }
    seen.last_harvest = Math.floor(Date.now()/1000);
    seen.rebirth_span = 90 + Math.floor(Math.random()*331);
    var el2 = cloverRoll();
    seen.element = el2;
    seen.sprite = el2 === 2 ? CLOVER_DROPS[Math.floor(Math.random()*CLOVER_DROPS.length)] : 0;
    pushClover();
    try { push('item_load_items', S['item_load_items'](), 40); } catch(e){}
    return { clover_id: Number(seen.clover_id) };
  };
  S['clover_harvest_resend'] = function(p){ return {clover_id: (p && (p.clover_id || p.id)) || 0}; };
  S['clover_update'] = function(){ return {clover: st.clover}; };
  /* ---- calendar: beginner / lucky / st rewards ---- */
  function grantItem(item_id, count){
    if (item_id === 100000) { st.clover += (count||1); pushClover(); }
    else if (item_id === 100001) { st.ticket += (count||1); }
    else { for (var i=0;i<(count||1);i++) if (st.bag.indexOf(item_id) < 0) st.bag.push(item_id); pushItems(); }
  }
  S['calendar_load'] = function(){ var d = new Date(), today = d.getDate(); /* 客户端会 Utils.convertArray(lucky_days/st_days) 再取 t[i].day / t[i].item_id:    必须是数组, 以前给对象 -> 日历页读不到, 与现实时间对不上 */ return { lucky_days: [{day: calCell(today), item_id: 100000}],          st_days: [{day: calCell(today), item_id: st.cloverId || 1}],          new_flag: (typeof Utils !== 'undefined' && Utils.convertArray) ? Utils.convertArray(st.newFlag) : (st.newFlag || []),          task_list: [], note_list: [] }; };
  S['calendar_load_note'] = function(){ return {list: []}; };
  /* 日历格子下标: 客户端月历从周一开始且第一格显示上月末尾几天,
     lucky_days/st_days 是按"格子下标"赋值的(lucky_days[t[i].day] = item_id),
     所以今天所在格 = (1号的周一偏移) + 今天 - 1, 不是"几号"。 */
  /* 格子下标必须按**底图那年**算: calendar_*.png 是 2023 年的版面(2023-09-01 是周五,
     首行显示 28/29/30/31), 而 2026-09-01 是周二 —— 用当前年份算偏移会让标记错 3 格 */
  var CAL_ART_YEAR = 2023;
  /* 实测标定: 服务端下标 13 被客户端画在底图的"9"号格上 -> 索引 = 偏移 + day
     (客户端是 1 基的格子编号), 2023-09 偏移 4 => 13 号 -> 17 */
  function calCell(day){ var d=new Date(), f=new Date(CAL_ART_YEAR, d.getMonth(), 1);
    return ((f.getDay()+6)%7) + day; }
  function calSave(){ try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch(e){} }
  function calClaim(idx, itemId, num){ st.newFlag = st.newFlag || [];
    if (st.newFlag[idx]) return { code: 1 };
    st.newFlag[idx] = 1; grantItem(itemId, num || 1); calSave();
    push('calendar_load', S['calendar_load'](), 30);
    return { code: 0, day: new Date().getDate() }; }
  S['calendar_get_luck_reward'] = function(){ return calClaim(calCell(new Date().getDate()), 100000, 1); };
  S['calendar_get_st_reward'] = function(){ return calClaim(calCell(new Date().getDate())+100, st.cloverId || 1, 1); };
  S['calendar_get_beginer_reward'] = function(){ var i = st.beginnerDay || 0; st.beginnerDay = i + 1; return calClaim(i, 100000, 5); };
  S['calendar_get_code_reward'] = function(p){ var day = Number(p && p.day) || new Date().getDate();
    return calClaim(calCell(day), 100000, 2); };
  /* ---- encyclopedia / encytravel: real desc data from config.eab ---- */
  S['encyclopedia_load'] = function(){ return { unlock_list: ENCY_UNLOCK, unlock_desc: ENCY_DESC, show_sub: ENCY_SUB }; };
  S['encytravel_load'] = function(){ return { unlock_list: ET_UNLOCK, unlock_desc: ET_DESC, show_sub: ET_SUB }; };
  S['encyclopedia_set_show_sub'] = function(p){ 
    for (var i=0;i<ENCY_SUB.length;i++) if (ENCY_SUB[i].id === p.id) ENCY_SUB[i].sub_id = p.sub_id;
    return {code:0};
  };
  S['encytravel_set_show_sub'] = function(p){ 
    for (var i=0;i<ET_SUB.length;i++) if (ET_SUB[i].id === p.id) ET_SUB[i].sub_id = p.sub_id;
    return {code:0};
  };
  S['calendar_get_beginer_reward'] = function(){
    var day = st.beginnerDay || 1;
    var cfg = BEGINNER[String(day)];
    if (cfg) { grantItem(cfg.item_id, cfg.num || 1); if (st.newFlag.length < day) st.newFlag[day-1] = 1; }
    return { day: day };
  };
  S['calendar_get_luck_reward'] = function(){ addClover(50); return {code:0}; };
  S['calendar_get_st_reward'] = function(){ addClover(100); return {code:0}; };
  S['calendar_get_code_reward'] = function(p){ addClover(20); return {day: p.day || 1}; };
  S['travel_depart_now'] = function(){ depart(); return {code:0}; };
''')
js.append('})();')
open(BASE+'/new/rules.js','w').write('\n'.join(js))
print('rules.js regenerated; notes pool', len(noteids), '| gifts', len(giftids), '| shop', len(shop))
