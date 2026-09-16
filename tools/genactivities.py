import json
BASE='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw'
T=BASE+'/tables/'
def load(n): return json.load(open(T+n+'.json',encoding='utf-8'))
mus=load('museumData_json')
mus_ids=[]
if isinstance(mus,dict):
    for k in sorted(mus,key=lambda x:int(x)):
        v=mus[k]
        if isinstance(v,dict): mus_ids.append({'id': v.get('id', int(k))})
elif isinstance(mus,list):
    for v in mus:
        if isinstance(v,dict): mus_ids.append({'id': v.get('id',0)})
cook=load('cookingData_json')
cook_ids=[]
if isinstance(cook,dict):
    for k in sorted(cook,key=lambda x:int(x)): cook_ids.append(int(k))
task=load('taskData_json')
_tm=(task.get('list_map') if isinstance(task,dict) else None) or {}
TASK_IDS=sorted((int(k) for k in _tm)) if isinstance(_tm,dict) else []
TASK_CFG=[_tm[k] for k in sorted(_tm, key=lambda x:int(x))] if isinstance(_tm,dict) else []
party=load('PartyCakeData_json')
cake = party.get('cake') if isinstance(party,dict) else None
cake_ids = sorted(int(k) for k in cake) if isinstance(cake,dict) else []
js=[]
js.append('/* lxqw offline activities: correct server field names + real table data */')
js.append('(function(){')
js.append('  var M = window.MockServer, st = window.MOCK_STATE || (window.MOCK_STATE = {});')
js.append('  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};')
js.append('  var MUSEUM_IDS = '+json.dumps(mus_ids[:40])+';')
js.append('  var COOK_IDS   = '+json.dumps(cook_ids[:40])+';')
js.append('  var CAKE_IDS   = '+json.dumps(cake_ids[:20])+';')
js.append('''
  /* museum_load: client reads e.museum_list (NOT e.list) */
  S['museum_load'] = function(){ return { museum_list: MUSEUM_IDS.slice() }; };
  S['museumday_load'] = function(){ return { list: [] }; };
  /* wishingpool: client does this.data = convertArrayAll(e); fields end_time/coin/items */
  S['wishingpool_load'] = function(){ return { end_time: 0, coin: 0, items: [] }; };
  S['wishingpool_wish'] = function(){ return { code: 0 }; };
  /* partycake: handler reads end_time/cream/sugar/pre_X/cur_state/part/layers/task_list/share_get */
  S['partycake_load'] = function(){ return { end_time: 0, cream: 0, sugar: 0, pre_cream: 0, pre_sugar: 0,
      cur_state: 0, part: [], layers: [], task_list: [], share_get: [] }; };
  S['partycake_load_qa'] = function(){ return { list: [] }; };
  /* cooking: handler sets serverData = e then normalises task_list */
  S['cooking_load_cooking'] = function(){ return { list: [], task_list: [], theme_id: COOK_IDS.length ? COOK_IDS[0] : 1 }; };
  /* furniture pocket/tumbler/compost already have full shapes in defaults.js */
  S['pray_load_grays'] = function(){ return { list: [] }; };
  S['museumday_info'] = function(){ return { list: [] }; };
''')
js.append('  var TASK_IDS   = '+json.dumps(TASK_IDS)+';')
js.append('  var TASK_CFG   = '+json.dumps(TASK_CFG,ensure_ascii=False)+';')
js.append("""
  /* GuideTaskListItem reads data.{count,desc,pro,title}; pro is injected from our task_load.list */
  S['task_load'] = function(){
    var prog = [];
    for (var i=0;i<TASK_IDS.length;i++) prog.push({ id: TASK_IDS[i], pro: 0 });
    return { tasks: TASK_CFG, list: prog };
  };
""")
js.append('})();')
open(BASE+'/new/activities.js','w').write(chr(10).join(js))
print('activities.js written | museum ids', len(mus_ids), '| cooking', len(cook_ids), '| cake', len(cake_ids))
