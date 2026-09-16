import json
BASE='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw'
T=BASE+'/tables/'
def load(n): return json.load(open(T+n+'.json',encoding='utf-8'))
me=load('MailEvent_json')
lst=me.get('list') if isinstance(me,dict) else me
def entry(e):
    items=[]
    try:
        iid=int(e.get('itemId') if e.get('itemId') is not None else -1)
        cnt=int(e.get('itemStock') or 0)
        if iid>0 and cnt>0: items.append({'item_id':iid,'count':cnt})
    except Exception: pass
    return {
        'id': e.get('id',0),
        'title': e.get('title') or '',
        'message': e.get('message') or '',
        'type': e.get('mailEvt') or 0,
        'read': 0, 'opened': 0,
        'resource': {'clover_point': e.get('CloverPoint') or 0, 'ticket': e.get('ticket') or 0, 'ads_id': ''},
        'items': items,
        'sender': e.get('senderCharaId', -1)
    }
entries=[entry(e) for e in (lst or [])]
js = []
js.append('/* lxqw offline mail: real MailEvent entries; client reads t.resource unguarded, so every entry MUST carry resource */')
js.append('(function(){')
js.append('  var M = window.MockServer, st = window.MOCK_STATE || (window.MOCK_STATE = {});')
js.append('  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};')
js.append('  var MAIL = '+json.dumps(entries,ensure_ascii=False)+';')
js.append('''
  if (!Array.isArray(st.mailTaken)) st.mailTaken = [];
  if (!Array.isArray(st.mailRead)) st.mailRead = [];
  function push(name, data, d){ setTimeout(function(){ try { M.dispatch(name, data); } catch(e){} }, d||40); }
  function live(){
    return MAIL.filter(function(m){ return st.mailTaken.indexOf(m.id) < 0; }).map(function(m){
      var c = {}; for (var k in m) c[k] = m[k];
      c.resource = { clover_point: m.resource.clover_point, ticket: m.resource.ticket, ads_id: '' };
      c.items = m.items.slice();
      c.read = st.mailRead.indexOf(m.id) >= 0 ? 1 : 0;
      return c;
    });
  }
  S['mail_load'] = function(){ return live(); };
  S['mail_load_mails'] = function(p){
    var all = live();
    var start = (p && p.start) || 1, count = (p && p.count) || 5;
    var slice = all.slice(start-1, start-1+count);
    return { mails: slice, start: start, total: all.length };
  };
  S['mail_open'] = function(p){
    var id = p && p.id, found = null;
    for (var i=0;i<MAIL.length;i++) if (MAIL[i].id === id) found = MAIL[i];
    if (found){
      if (st.mailTaken.indexOf(id) < 0) st.mailTaken.push(id);
      if (found.resource.clover_point) { st.clover += found.resource.clover_point; push('clover_update', {clover: st.clover}, 30); }
      if (found.resource.ticket) { st.ticket += found.resource.ticket; push('item_update_ticket', {ticket: st.ticket}, 60); }
      if (found.items && found.items.length){ for (var j=0;j<found.items.length;j++){ var it=found.items[j]; var slot=st.bag.indexOf(-1); if (slot>=0) st.bag[slot]=it.item_id; } push('item_load_items', S['item_load_items'] ? S['item_load_items']() : {}, 60); }
    }
    if (window.MOCK_SAVE) window.MOCK_SAVE();
    return { code: 0 };
  };
  S['mail_read'] = function(p){ var id=p&&p.id; if (st.mailRead.indexOf(id)<0) st.mailRead.push(id); if (window.MOCK_SAVE) window.MOCK_SAVE(); return { code:0 }; };
  S['mail_ejoy_active_code'] = function(){ return { code:0 }; };
''')
js.append('})();')
open(BASE+'/new/mail.js','w').write(chr(10).join(js))
print('mail.js written; entries:', len(entries), '| first:', json.dumps(entries[0],ensure_ascii=False)[:180] if entries else 'none')
