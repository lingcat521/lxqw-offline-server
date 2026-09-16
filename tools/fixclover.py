p='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw/tools/genrules.py'
s=open(p,encoding='utf-8').read()
if 'BEGINNER' not in s:
    s=s.replace("""vis=load('visitors_json')""","""cal=load('calendarData_json')
beginner=cal.get('beginner') if isinstance(cal,dict) else {}
vis=load('visitors_json')""")
    s=s.replace("""js.append('  var PROV_NAMES = '+json.dumps(provkeys,ensure_ascii=False)+';')""",
"""js.append('  var PROV_NAMES = '+json.dumps(provkeys,ensure_ascii=False)+';')
js.append('  var BEGINNER   = '+json.dumps(beginner,ensure_ascii=False)+';')""")
    # state additions
    s=s.replace("notes: [], gifts: [], photos: [], nextPhoto: 1,",
                "notes: [], gifts: [], photos: [], nextPhoto: 1, newFlag: [], beginnerDay: 0, cloverId: 1,")
    # replace clover handlers + add calendar rewards, appended before travel_depart_now
    old="  S['travel_depart_now'] = function(){ depart(); return {code:0}; };"
    new = """  /* ---- clover grows in the courtyard: it must be harvestable ---- */
  st.clovers = st.clovers || [
    {clover_id:1, last_harvest:0, rebirth_span:1800, element:0, sprite:0},
    {clover_id:2, last_harvest:0, rebirth_span:1800, element:0, sprite:0},
    {clover_id:3, last_harvest:0, rebirth_span:1800, element:0, sprite:0}
  ];
  S['clover_load_clovers'] = function(){ return st.clovers; };
  S['clover_harvest'] = function(p){
    var id = p.clover_id || 1;
    for (var i=0;i<st.clovers.length;i++) if (st.clovers[i].clover_id === id) st.clovers[i].last_harvest = -1;
    st.clover += 10; pushClover();
    return { clover_id: id, clover: 10 };
  };
  S['clover_harvest_resend'] = function(p){ return {list: []}; };
  S['clover_update'] = function(){ return {clover: st.clover}; };
  /* ---- calendar: beginner / lucky / st rewards ---- */
  function grantItem(item_id, count){
    if (item_id === 100000) { st.clover += (count||1); pushClover(); }
    else if (item_id === 100001) { st.ticket += (count||1); }
    else { for (var i=0;i<(count||1);i++) if (st.bag.indexOf(item_id) < 0) st.bag.push(item_id); pushItems(); }
  }
  S['calendar_load'] = function(){
    var d = new Date(); var today = d.getDate();
    var lucky = {}; lucky[today] = 100000;
    return { lucky_days: lucky, new_flag: st.newFlag, st_days: {}, task_list: [], note_list: [] };
  };
  S['calendar_load_note'] = function(){ return {list: []}; };
  S['calendar_get_beginer_reward'] = function(){
    var day = st.beginnerDay || 1;
    var cfg = BEGINNER[String(day)];
    if (cfg) { grantItem(cfg.item_id, cfg.num || 1); if (st.newFlag.length < day) st.newFlag[day-1] = 1; }
    return { day: day };
  };
  S['calendar_get_luck_reward'] = function(){ addClover(50); return {code:0}; };
  S['calendar_get_st_reward'] = function(){ addClover(100); return {code:0}; };
  S['calendar_get_code_reward'] = function(p){ addClover(20); return {day: p.day || 1}; };
  S['travel_depart_now'] = function(){ depart(); return {code:0}; };"""
    if old in s:
        s=s.replace(old,new); print('calendar/clover added')
    else:
        print('ANCHOR MISSING for calendar block')
    open(p,'w',encoding='utf-8').write(s)
else:
    print('already patched')
