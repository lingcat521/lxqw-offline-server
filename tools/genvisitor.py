import json
BASE='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw'
v=json.load(open(BASE+'/tables/visitors_json.json',encoding='utf-8'))
pl=v['provinceList']; al=v['actionList']
provs=[{'key':k,'Province':pl[k].get('Province',k)} for k in pl]
parts=sorted(int(k) for k in al)
js=[]
js.append('/* lxqw offline visitors: city MUST be "<provinceKey>_<cityName>" or the client cannot resolve it */')
js.append('(function(){')
js.append('  var M = window.MockServer, st = window.MOCK_STATE || (window.MOCK_STATE = {});')
js.append('  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};')
js.append('  var PROVS = '+json.dumps(provs,ensure_ascii=False)+';')
js.append('  var PARTS = '+json.dumps(parts)+';')
js.append('  var KEYS = {}; PROVS.forEach(function(p){ KEYS[p.key]=1; });')
js.append('''
  if (!Array.isArray(st.acquire)) st.acquire = [];
  if (st.visitor === undefined) st.visitor = null;
  function nowSec(){ return Math.floor(Date.now()/1000); }
  function push(name, data, d){ setTimeout(function(){ try { M.dispatch(name, data); } catch(e){} }, d||40); }
  function pushVisit(){ push('visit_load', { visitor: st.visitor, acquire: st.acquire }, 40); }
  function spawnVisitor(){
    if (st.visitor) return false;
    var pool = PROVS.filter(function(p){ return st.acquire.indexOf(p.key) < 0; });
    if (!pool.length) pool = PROVS.slice();
    var p = pool[Math.floor(Math.random()*pool.length)];
    if (!KEYS[p.key]) return false;
    var part = PARTS.length ? PARTS[Math.floor(Math.random()*PARTS.length)] : 0;
    st.visitor = {
      partner: part,
      name: "",
      title: 0,
      expire_time: nowSec() + 1800,
      city: p.key + "_城区",
      food: 0,
      first: st.acquire.indexOf(p.key) < 0,
      gift: { item_id: 100000, count: 20 },
      carpet: 1 + Math.floor(Math.random()*8)
    };
    var prov = String(st.visitor.city).split("_")[0];
    if (!KEYS[prov]) { st.visitor = null; return false; }
    try { console.log("[MOCK] visitor spawned: key=" + p.key + " city=" + st.visitor.city + " partner=" + part); } catch(e){}
    pushVisit();
    return true;
  }
  window.MOCK_SPAWN_VISITOR = spawnVisitor;
  S['visit_load'] = function(){
    if (st.visitor) { var pr = String(st.visitor.city).split("_")[0]; if (!KEYS[pr]) st.visitor = null; }
    return { visitor: st.visitor, acquire: st.acquire };
  };
  S['visit_set_carpet'] = function(p){ if (st.visitor) st.visitor.carpet = p.carpet || st.visitor.carpet; return {code:0}; };
  S['visit_set_expire_time'] = function(p){ if (st.visitor) st.visitor.expire_time = p.time || st.visitor.expire_time; return {code:0}; };
  S['visit_open'] = function(){
    if (st.visitor){
      var prov = String(st.visitor.city).split("_")[0];
      if (st.visitor.first){ if (st.acquire.indexOf(prov) < 0) st.acquire.push(prov); }
      else {
        if (st.visitor.gift && st.visitor.gift.item_id === 100000){ st.clover += st.visitor.gift.count; push('clover_update', {clover: st.clover}, 30); }
        else if (st.visitor.gift && st.visitor.gift.item_id === 100001){ st.ticket += st.visitor.gift.count; push('item_update_ticket', {ticket: st.ticket}, 30); }
      }
      st.visitor = null;
      if (window.MOCK_SAVE) window.MOCK_SAVE();
      pushVisit();
    }
    return {code:0};
  };
  setTimeout(function(){ spawnVisitor(); }, 25000);
  setInterval(function(){ if (!st.visitor && st.frog && st.frog.status === 0 && Math.random() < 0.35) spawnVisitor(); }, 60000);
''')
js.append('})();')
open(BASE+'/new/visitor.js','w').write(chr(10).join(js))
print('visitor.js regenerated with correct "<key>_城区" city')
