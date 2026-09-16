p='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw/new/iap.js'
s=open(p,encoding='utf-8').read()
old='''  S["recharge_load"] = function(){ return { water: 0, change: st.clover, field: [], sack: [] }; };
  S["recharge_load_gift"] = function(){ return { gift: [] }; };'''
new='''  /* client contract (RechargeModel + RechargeFieldItem/RechargeCloverItem):
       field[] = [{id, grow}]  id is passed to pay(); sack[] = [{id, goods:[{id,num}], price}] */
  function fieldList(){ return RECHARGE.map(function(p){ return { id: p.id, grow: 0 }; }); }
  function sackList(){ return RECHARGE.map(function(p){ return { id: p.id, goods: [{ id: 100000, num: p.count }], price: p.money }; }); }
  S["recharge_load"] = function(){ return { water: 10, change: st.clover, field: fieldList(), sack: sackList() }; };
  S["recharge_load_gift"] = function(){ return { gift: [] }; };
  S["recharge_merch"] = function(){ return { list: [] }; };'''
if old in s:
    s=s.replace(old,new); open(p,'w',encoding='utf-8').write(s); print('iap.js: recharge render data filled')
else: print('iap pattern missing; current:'); print(s[:0])
