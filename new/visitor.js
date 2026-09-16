/* lxqw offline visitors: city MUST be "<provinceKey>_<cityName>" or the client cannot resolve it */
(function(){
  var M = window.MockServer, st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  var PROVS = [{"key": "上海", "Province": "上海"}, {"key": "云南", "Province": "云南"}, {"key": "内蒙古", "Province": "内蒙古"}, {"key": "北京", "Province": "北京"}, {"key": "台湾", "Province": "台湾"}, {"key": "吉林", "Province": "吉林"}, {"key": "四川", "Province": "四川"}, {"key": "天津", "Province": "天津"}, {"key": "安徽", "Province": "安徽"}, {"key": "山东", "Province": "山东"}, {"key": "山西", "Province": "山西"}, {"key": "广东", "Province": "广东"}, {"key": "广西", "Province": "广西"}, {"key": "新疆", "Province": "新疆"}, {"key": "江苏", "Province": "江苏"}, {"key": "江西", "Province": "江西"}, {"key": "河北", "Province": "河北"}, {"key": "河南", "Province": "河南"}, {"key": "浙江", "Province": "浙江"}, {"key": "海南", "Province": "海南"}, {"key": "海外", "Province": "海外"}, {"key": "湖北", "Province": "湖北"}, {"key": "湖南", "Province": "湖南"}, {"key": "澳门", "Province": "澳门"}, {"key": "甘肃", "Province": "甘肃"}, {"key": "福建", "Province": "福建"}, {"key": "西藏", "Province": "西藏"}, {"key": "辽宁", "Province": "辽宁"}, {"key": "重庆", "Province": "重庆"}, {"key": "陕西", "Province": "陕西"}, {"key": "青海", "Province": "青海"}, {"key": "香港", "Province": "香港"}, {"key": "黑龙江", "Province": "黑龙江"}];
  var PARTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  var KEYS = {}; PROVS.forEach(function(p){ KEYS[p.key]=1; });

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

})();