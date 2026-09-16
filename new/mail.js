/* lxqw offline mail: real MailEvent entries; client reads t.resource unguarded, so every entry MUST carry resource */
(function(){
  var M = window.MockServer, st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  /* 这一层以前漏了 log 的定义, 最后一行 log(...) 直接抛 ReferenceError ->
     mock.js 把整个文件判成 "load fail"(真机日志里刷了 75 次)。补上。 */
  function log(m) { try { console.log("[MOCK] " + m); } catch (e) {} }
  var MAIL = [{"id": 0, "title": "恭喜您完成教程！", "message": "", "type": 3, "read": 0, "opened": 0, "resource": {"clover_point": 500, "ticket": 0, "ads_id": ""}, "items": [], "sender": -1}, {"id": 1, "title": "请愉快继续游戏！", "message": "", "type": 3, "read": 0, "opened": 0, "resource": {"clover_point": 0, "ticket": 0, "ads_id": ""}, "items": [{"item_id": 1000, "count": 1}], "sender": -1}];

  if (!Array.isArray(st.mailTaken)) st.mailTaken = [];
  if (!Array.isArray(st.mailRead)) st.mailRead = [];
  function push(name, data, d){ setTimeout(function(){ try { M.dispatch(name, data); } catch(e){} }, d||40); }
  /* 动态邮件(旅友来信/活动补偿): 由 window.MOCK_ADD_MAIL 追加, 和固定邮件一起走同一条出口 */
  if (!Array.isArray(st.extraMails)) st.extraMails = [];
  function allMail(){ return MAIL.concat(st.extraMails); }
  function live(){
    return allMail().filter(function(m){ return st.mailTaken.indexOf(m.id) < 0; }).map(function(m){
      var c = {}; for (var k in m) c[k] = m[k];
      c.resource = { clover_point: m.resource.clover_point, ticket: m.resource.ticket, ads_id: '' };
      c.items = m.items.slice();
      c.read = st.mailRead.indexOf(m.id) >= 0 ? 1 : 0;
      return c;
    });
  }
  /* 过期邮件: 客户端会自己 openMailInfo(自动拆信并 addClover/addTicket/addHouseItem), 服务端必须镜像,
     否则"客户端显示了奖励、服务端没记账"(和之前那批 bug 同类)。这里在每次读邮箱前 + 每 60 秒扫一遍。 */
  function sweepExpired(why) {
    var all = allMail(), now = Math.floor(Date.now() / 1000), n = 0;
    for (var i = 0; i < all.length; i++) {
      var m = all[i];
      if (!m || st.mailTaken.indexOf(m.id) >= 0) continue;
      if (!(Number(m.expire) > 0) || Number(m.expire) > now) continue;
      st.mailTaken.push(m.id);
      if (m.resource && m.resource.clover_point) { st.clover = (Number(st.clover) || 0) + Number(m.resource.clover_point); push('clover_update', { clover: st.clover }, 30); }
      if (m.resource && m.resource.ticket) { st.ticket = (Number(st.ticket) || 0) + Number(m.resource.ticket); push('item_update_ticket', { ticket: st.ticket }, 60); }
      if (Array.isArray(m.items)) for (var j = 0; j < m.items.length; j++) {
        var it = m.items[j]; if (!it || !it.item_id) continue;
        st.house = Array.isArray(st.house) ? st.house : [];
        var f = null;
        for (var q = 0; q < st.house.length; q++) if (st.house[q] && Number(st.house[q].item_id) === Number(it.item_id)) f = st.house[q];
        if (f) f.count = (Number(f.count) || 0) + (Number(it.count) || 1); else st.house.push({ item_id: Number(it.item_id), count: Number(it.count) || 1 });
      }
      n++;
      try { console.log('[MOCK] 邮件过期自动入账 #' + m.id + ' 「' + m.title + '」' + (why ? (' [' + why + ']') : '')); } catch (e) {}
    }
    if (n) { try { push('item_load_items', S['item_load_items'] ? S['item_load_items']() : {}, 90); } catch (e) {} if (window.MOCK_SAVE) window.MOCK_SAVE(); }
    return n;
  }
  window.MOCK_MAIL_SWEEP = sweepExpired;
  setInterval(function () { try { sweepExpired('tick'); } catch (e) {} }, 60000);
  S['mail_load'] = function(){ try { sweepExpired('load'); } catch (e) {} return live(); };
  S['mail_load_mails'] = function(p){
    var all = live();
    var start = (p && p.start) || 1, count = (p && p.count) || 5;
    var slice = all.slice(start-1, start-1+count);
    return { mails: slice, start: start, total: all.length };
  };
  S['mail_open'] = function(p){
    var id = p && p.id, found = null, ALL = allMail();
    for (var i=0;i<ALL.length;i++) if (ALL[i].id === id) found = ALL[i];
    if (found){
      if (st.mailTaken.indexOf(id) < 0) st.mailTaken.push(id);
      if (found.resource.clover_point) { st.clover += found.resource.clover_point; push('clover_update', {clover: st.clover}, 30); }
      if (found.resource.ticket) { st.ticket += found.resource.ticket; push('item_update_ticket', {ticket: st.ticket}, 60); }
      if (found.items && found.items.length){ for (var j=0;j<found.items.length;j++){ var it=found.items[j];
        /* 手信/附件: 背包满时以前是**静默丢弃**(和桌子那个 bug 同类); 现在先放背包, 放不下进 house 仓库, 都会记日志 */
        var slot=st.bag.indexOf(-1);
        if (slot>=0) { st.bag[slot]=it.item_id; }
        else { st.house = Array.isArray(st.house) ? st.house : [];
          var f=null; for (var q=0;q<st.house.length;q++) if (st.house[q] && Number(st.house[q].item_id)===Number(it.item_id)) f=st.house[q];
          if (f) f.count=(Number(f.count)||0)+(Number(it.count)||1); else st.house.push({item_id:Number(it.item_id), count:Number(it.count)||1});
          try { console.log('[MOCK] 邮件附件背包已满 -> 进仓库 item_id=' + it.item_id); } catch (e) {} }
      } push('item_load_items', S['item_load_items'] ? S['item_load_items']() : {}, 60);
        /* 附件里可能有纪念品/特产: 图鉴(友情绘本)必须在改完后补推一次, 否则集合不刷新 */
        setTimeout(function(){ try { if (S['item_load_handbook']) M.dispatch('item_load_handbook', S['item_load_handbook']()); } catch (e) {} }, 120); }
    }
    if (window.MOCK_SAVE) window.MOCK_SAVE();
    return { code: 0 };
  };
  S['mail_read'] = function(p){ var id=p&&p.id; if (st.mailRead.indexOf(id)<0) st.mailRead.push(id); if (window.MOCK_SAVE) window.MOCK_SAVE(); return { code:0 }; };
  S['mail_ejoy_active_code'] = function(){ return { code:0 }; };


  /* ---- 邮箱防崩: 每封出站的邮件都必须字段齐全 ------------------------------------
     2026-09-13T05:54:42 设备崩溃: MailView.fillItems() 读 mailInfo.items.length，
     而某封邮件 payload 没有 items(或 resource) -> TypeError -> 自动 reload。
     这里在出口统一规范化，任何层造的邮件都不可能再缺字段。 */
  function normMail(m) {
    if (!m || typeof m !== 'object') return m;
    var o = {};
    for (var k in m) if (Object.prototype.hasOwnProperty.call(m, k)) o[k] = m[k];
    if (!Array.isArray(o.items)) o.items = [];
    o.items = o.items.map(function (it) {
      return (it && typeof it === 'object')
        ? { item_id: Number(it.item_id) || 0, count: Number(it.count) || 0 }
        : { item_id: 0, count: 0 };
    });
    var r = (o.resource && typeof o.resource === 'object') ? o.resource : {};
    o.resource = { clover_point: Number(r.clover_point) || 0, ticket: Number(r.ticket) || 0,
                   reward_gacha: Number(r.reward_gacha) || 0,
                   ads_id: (r.ads_id === undefined ? '' : r.ads_id),
                   share_id: (r.share_id === undefined ? '' : r.share_id) };
    if (!Array.isArray(o.pictures)) o.pictures = [];
    if (typeof o.id !== 'number') o.id = Number(o.id) || 0;
    if (typeof o.type !== 'number') o.type = 1;
    if (typeof o.read !== 'number') o.read = 0;
    if (typeof o.opened !== 'number') o.opened = 0;
    if (typeof o.expire !== 'number') o.expire = 0;
    if (typeof o.auto_open !== 'boolean') o.auto_open = false;
    if (typeof o.title !== 'string') o.title = String(o.title === undefined ? '' : o.title);
    if (typeof o.message !== 'string') o.message = String(o.message === undefined ? '' : o.message);
    if (o.sender === undefined) o.sender = -1;
    return o;
  }
  window.MOCK_NORMALIZE_MAIL = normMail;
  /* 运行时造一封新邮件并推给客户端。
     客户端 MailModel.notify_new_mail(e): e.mail 插到列表头, 未读红点; auto_open / expire 也会被处理。
     返回新邮件的 id。 */
  var dynId = 1000;
  window.MOCK_ADD_MAIL = function (m) {
    m = m || {};
    var id = (m.id !== undefined && m.id !== null) ? Number(m.id) : (dynId++);
    while (allMail().filter(function (x) { return Number(x.id) === id; }).length) id = dynId++;
    var mail = normMail({
      id: id, title: m.title || "旅友来信", message: m.message || "",
      type: (m.type !== undefined) ? Number(m.type) : 3,
      read: 0, opened: 0,
      resource: m.resource || { clover_point: 0, ticket: 0, ads_id: "" },
      items: m.items || [], sender: (m.sender !== undefined) ? m.sender : -1,
      /* 过期时间: 客户端 revice_mails/notify_new_mail 里 expire>0 且已过期 -> 自动拆信领奖;
         以前这里恒 0, 邮件永不过期(清单 §11"邮件附件: 领取、过期"只做了一半)。默认 7 天。 */
      expire: (m.expire !== undefined) ? Number(m.expire) : (Math.floor(Date.now() / 1000) + 7 * 86400),
      auto_open: !!m.auto_open
    });
    /* 回礼保管上限(用户给的规则): 邮箱里未领取的邮件最多 100 封, 超出的把**最旧的**删掉,
       三叶草/抽奖券自动收取(resource 里的值直接入账), 附件物品丢弃 —— 与原版"旧物品会被自动删除,
       三叶草则会自动收取"一致。 */
    var MAX_HOLD = Number(st.mailHoldMax) > 0 ? Number(st.mailHoldMax) : 100;
    try {
      var liveCount = allMail().filter(function (x) { return st.mailTaken.indexOf(x.id) < 0; }).length;
      while (liveCount >= MAX_HOLD) {
        var oldest = null;
        for (var mi = 0; mi < st.extraMails.length; mi++) {
          var cand = st.extraMails[mi];
          if (!cand || st.mailTaken.indexOf(cand.id) >= 0) continue;
          if (!oldest || Number(cand.id) < Number(oldest.id)) oldest = cand;
        }
        if (!oldest) break;
        if (oldest.resource && oldest.resource.clover_point) { st.clover = (Number(st.clover) || 0) + Number(oldest.resource.clover_point); }
        if (oldest.resource && oldest.resource.ticket) { st.ticket = (Number(st.ticket) || 0) + Number(oldest.resource.ticket); }
        st.mailTaken.push(oldest.id);
        liveCount--;
        try { console.log('[MOCK] 邮箱保管上限 ' + MAX_HOLD + ': 丢掉最旧的邮件 #' + oldest.id + ' (三叶草/券已自动收取, 附件作废)'); } catch (e) {}
      }
    } catch (e) {}
    st.extraMails.push(mail);
    try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {}
    push('notify_new_mail', { mail: mail }, 40);
    setTimeout(function () { try { M.dispatch('clover_update', { clover: st.clover }); M.dispatch('item_update_ticket', { ticket: st.ticket }); } catch (e) {} }, 80);
    try { console.log('[MOCK] 新邮件 #' + id + ' 「' + mail.title + '」 items=' + mail.items.length + ' clover=' + mail.resource.clover_point + ' ticket=' + mail.resource.ticket); } catch (e) {}
    return id;
  };
  window.MOCK_MAIL_COUNT = function () { return live().length; };
  ['mail_load', 'mail_load_mails'].forEach(function (name) {
    var orig = S[name];
    if (typeof orig !== 'function') return;
    S[name] = function (p) {
      var r = orig(p);
      if (name === 'mail_load') return Array.isArray(r) ? r.map(normMail) : normMail(r);
      if (r && Array.isArray(r.mails)) r.mails = r.mails.map(normMail);
      return r;
    };
  });
  log('mail guard: 出站邮件字段规范化已启用');
})();
