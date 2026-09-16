/* lxqw 「伴蛙前行」事件出口挂载(第 3 步) —— new/planhooks.js
 *
 * 只做一件事: 把游戏里已有的动作出口, 翻译成 MOCK_PLANS.progress(event, amount, ctx)。
 * 不重写任何既有逻辑: 全部是"包一层 -> 先调原实现 -> 再从前后状态/参数里推事件"。
 *
 * 用户给的避坑三条:
 *   ① ctx 严格清洗: items 用**交集判断**(includes), guest 直接比, 不透传;
 *   ② 一次动作可能触发多个事件(归来 = TRAVEL_BACK + MATERIAL_BACK) -> plans.js 里 50ms 防抖合并推送;
 *   ③ 和 tasks.js 的基线系统互斥: CLIENT_ 前缀只由 tasks.js 算, 这里永不发它。
 */
(function () {
  var st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  function log(m) { try { console.log('[MOCK] 计划事件: ' + m); } catch (e) {} }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function ev(name, amount, ctx) {
    try { if (window.MOCK_PLANS && window.MOCK_PLANS.progress) { var r = window.MOCK_PLANS.progress(name, amount, ctx || {}); if (r && r.length) log(name + ' ×' + amount + ' -> ' + r.length + ' 条任务涨了'); } } catch (e) {}
  }
  function wrap(name, fn) {
    var prev = S[name];
    var orig = (typeof prev === 'function') ? prev : null;
    S[name] = function (p) {
      var r = orig ? orig.apply(this, arguments) : undefined;
      try { fn(p, r); } catch (e) {}
      return r;
    };
  }
  var ITEM = function (id) { try { var db = Tabikaeru.DataManager.instance().ItemDB; return db && db.get ? db.get(num(id)) : null; } catch (e) { return null; } };
  function typeOf(id) { var r = ITEM(id); return r ? num(r.type) : -1; }

  /* ① 收割三叶草: 数量从"货币增量 / 单株价"反推(plans 只管事件, 不重复记账) */
  wrap('clover_harvest', function (p) {
    var before = num(st.clover);
    var val = 25; try { if (window.MOCK_FARM && window.MOCK_FARM.farmState) val = num(window.MOCK_FARM.farmState().clover_value) || 25; } catch (e) {}
    var gained = Math.max(0, num(st.clover) - before);
    var n = Math.round(gained / val);
    if (n > 0) ev('HARVEST_CLOVER', n, {});
  });
  /* ② 投喂邻居: guest 直接取当前访客 id */
  wrap('guest_serve', function (p) {
    var g = st.guestFeed || {};
    ev('FEED_NEIGHBOR', 1, { guest: num(g.id) });
  });
  /* ③ 访客离开(顺手种花那条链) */
  wrap('guest_finish', function () { if (num((st.guestFeed || {}).served)) ev('FEED_NEIGHBOR', 0, {}); });
  /* ④ 商店买东西(食物/道具) 与 图纸 */
  wrap('item_buy', function (p) { ev('ITEM_BUY', 1, { itemId: num(p && (p.id !== undefined ? p.id : p.item_id)) }); });
  wrap('furniture_buy', function (p) {
    var id = num(p && (p.id !== undefined ? p.id : p.item_id));
    if (typeOf(id) === 13) ev('DRAWING_BUY', 1, {});        /* 13 = 家具图纸 */
    else ev('ITEM_BUY', 1, { itemId: id });
  });
  /* ⑤ 手工: 印章 / 祈愿物 */
  wrap('pray_compose', function (p) { ev('CRAFT_WISH', 1, { itemId: num(p && p.id) }); });
  wrap('pray_confirm_make_box', function () { ev('CRAFT_WISH', 1, {}); });
  wrap('pray_load_grays', function () { });
  wrap('capsule_compose', function () { ev('CRAFT_STAMP', 1, {}); });
  wrap('handcraft_make', function () { ev('CRAFT_STAMP', 1, {}); });
  /* ⑥ 礼品盒: 照片/特产放进去 */
  wrap('travel_bag_to_gift', function () { ev('GIFT_BOX_PUT', 1, {}); });
  wrap('travel_album_to_gift', function () { ev('GIFT_BOX_PUT', 1, {}); });
  /* ⑦ 聚会出发 */
  (function () {
    if (!window.MOCK_PARTY || window.MOCK_PARTY.__hooked) return;
    var prev = window.MOCK_PARTY.start;
    window.MOCK_PARTY.start = function () { var r = prev.apply(this, arguments); try { ev('PARTY_GO', 1, {}); } catch (e) {} return r; };
    window.MOCK_PARTY.__hooked = 1;
  })();
  /* ⑧ 旅行归来: TRAVEL_BACK + MATERIAL_BACK(一次动作两个事件 -> plans 里 50ms 合并成一次推送) */
  (function () {
    var prev = window.MOCK_STORY_ROLL;
    window.MOCK_STORY_ROLL = function () {
      var r = (typeof prev === 'function') ? prev() : null;
      try {
        var items = arr(st.lastTripItems);
        ev('TRAVEL_BACK', 1, { items: items });
        var mats = 0;
        for (var i = 0; i < items.length; i++) { var t = typeOf(items[i]); if (t === 10 || t === 11) mats++; }
        if (mats > 0) ev('MATERIAL_BACK', mats, { items: items });
      } catch (e) {}
      return r;
    };
  })();
  /* ⑨ 家具做完(工作台) */
  (function () {
    var prev = window.MOCK_FURNITURE_DONE;
    window.MOCK_FURNITURE_DONE = function (row) {
      var r = (typeof prev === 'function') ? prev.apply(this, arguments) : null;
      try { ev('FURNITURE_DONE', 1, { furType: num(row && row.type), itemId: num(row && row.id) }); } catch (e) {}
      return r;
    };
  })();
  /* ⑩ 新增出口(给任务池加随机性用): 送礼 / 贺卡 / 读笔记 / 收拾行囊 / 摆工作台 */
  wrap('story_send_gift', function () { ev('SEND_GIFT', 1, {}); });
  wrap('story_read_new_story', function () { ev('STORY_LIKE', 1, {}); });
  if (window.MOCK_PLANS && MOCK_PLANS.declareEmitter) MOCK_PLANS.declareEmitter('STORY_LIKE', 'story_read_new_story');
  wrap('greetcard_send_gift', function () { ev('GREET_CARD', 1, {}); });
  wrap('travel_read_note', function () { ev('NOTE_READ', 1, {}); });
  wrap('item_set_bag_completed', function () { ev('PACK_BAG', 1, {}); });
  wrap('furniture_putin_bench', function () { ev('BENCH_PUT', 1, {}); });
  /* ⑪ 差分式出口: 访客到访 / 明信片 / 特产 / 绘纸(聚会归来) —— 用"上一次看到的数量"比出来 */
  var seen = { guest: -1, photos: num((st.photos || []).length), gifts: num((st.gifts || []).length), pages: num(((st.drawing || {}).pages || []).length), status: num((st.frog || {}).status), pots: 0 };
  setInterval(function () {
    try {
      var g = num((st.guestFeed || {}).id);
      if (g >= 0 && g !== seen.guest) { seen.guest = g; ev('GUEST_VISIT', 1, { guest: g }); }
      if (g < 0) seen.guest = -1;
      var ph = num((st.photos || []).length);
      if (ph > seen.photos) { ev('PHOTO_GET', ph - seen.photos, {}); seen.photos = ph; }
      var gf = num((st.gifts || []).length);
      if (gf > seen.gifts) { ev('SOUVENIR_BACK', gf - seen.gifts, {}); seen.gifts = gf; }
      var pg = num((((st.drawing || {}).pages) || []).length);
      if (pg > seen.pages) { ev('PARTY_RESULT', pg - seen.pages, {}); seen.pages = pg; }
      /* TRAVEL_GO: 出门(status 0->1, 聚会不算) —— 以前没人发它, 池子里"出门随便逛逛/多出门走走"永远 0 */
      var stt = num((st.frog || {}).status);
      if (stt === 1 && seen.status !== 1 && !(st.frog && st.frog.party)) ev('TRAVEL_GO', 1, {});
      seen.status = stt;
      /* PLANT_FLOWER: 花盆从空变有植株(自己种 / 小伙伴帮你种都算) */
      try {
        var pot = (window.MOCK_FARM && window.MOCK_FARM.farm) ? window.MOCK_FARM.farm() : [], planted = 0;
        for (var q = 0; q < pot.length; q++) if (num(pot[q].plant_id)) planted++;
        if (planted > num(seen.pots)) ev('PLANT_FLOWER', planted - num(seen.pots), {});
        seen.pots = planted;
      } catch (e) {}
    } catch (e) {}
  }, 20000);
  /* ---- 客户端行为: 光靠 task_client_pro 只有 Map/NoteFriend 两个 key(实测) ----
     但**每个界面客户端都会发协议**(album_load / item_load_shop_info / story_load / calendar_load …),
     这些请求服务端全看得到 -> 用它们当"打开过某界面"的信号, 记进 st.clientOpen[key]。
     命名与任务池里的 CLIENT_ 后缀对齐, 走同一套归一化自动匹配。 */
  var OPEN_SRC = [
    ['album_load', 'ALBUM_OPEN'], ['album_load_all', 'ALBUM_OPEN'], ['album_load_by_id_list', 'ALBUM_OPEN'],
    ['item_load_shop_info', 'STORE_OPEN'], ['furniture_load_furniture', 'FURNITURE_OPEN'],
    ['story_load', 'DIARY_OPEN'], ['calendar_load', 'CALENDAR_OPEN'],
    ['travel_load_note', 'NOTE_READ'], ['mail_load', 'MAIL_OPEN'], ['mail_load_mails', 'MAIL_OPEN'],
    ['encyclopedia_load', 'ENCY_OPEN'], ['encytravel_load', 'ENCY_OPEN'],
    ['task_load', 'PLAN_OPEN'], ['task_load_list', 'PLAN_OPEN'],
    ['lottery_load', 'LOTTERY_OPEN'], ['visit_load', 'VISIT_OPEN'], ['misc_moment_load', 'MOMENT_OPEN'],
    ['travel_load_gift', 'GIFTBOX_OPEN'], ['item_load_handbook', 'HANDBOOK_OPEN'],
    ['guest_load_drawing', 'DRAWING_OPEN'], ['museum_load', 'MUSEUM_OPEN'], ['greetcard_load', 'GREETCARD_OPEN']
  ];
  (function () {
    st.clientOpen = st.clientOpen || {};
    var n = 0;
    for (var i = 0; i < OPEN_SRC.length; i++) {
      (function (name, key) {
        var prev = S[name];
        if (typeof prev !== 'function' || prev.__openWatched) return;
        var fn = function () {
          try { st.clientOpen[key] = num(st.clientOpen[key]) + 1; } catch (e) {}
          return prev.apply(this, arguments);
        };
        fn.__openWatched = 1;
        S[name] = fn; n++;
      })(OPEN_SRC[i][0], OPEN_SRC[i][1]);
    }
    log('界面开启观测就绪: 包了 ' + n + ' 个协议 -> st.clientOpen (' + OPEN_SRC.length + ' 条映射)');
  })();
  /* ---- 全协议观测(彻底版自动发现): 客户端每发一个协议都记进 st.protoSeen ----
     固定映射只能覆盖我预先想到的 22 个; 这一层把**所有**协议都登记下来,
     你点任何界面 -> 新协议名就会冒出来 -> 我再照着它加映射/加任务。 */
  (function () {
    try {
      var M3 = window.MockServer;
      if (!M3 || typeof M3.handle !== 'function' || M3.__protoSeenWrapped) return;
      var prev = M3.handle;
      st.protoSeen = st.protoSeen || {};
      M3.handle = function (name, params) {
        try {
          var k = String(name);
          st.protoSeen[k] = num(st.protoSeen[k]) + 1;
          if (st.protoSeen[k] === 1 && !/^(item_load_items|client_load_role|task_load|travel_load_note|clover_update|weather_load|guest_load|visit_load)$/.test(k)) {
            log('新协议: ' + k);
          }
        } catch (e) {}
        return prev.apply(this, arguments);
      };
      M3.__protoSeenWrapped = 1;
      log('全协议观测就绪: 任何协议都会记进 st.protoSeen');
    } catch (e) {}
  })();
  /* 客户端上报 key 自动发现: 每 15 秒看一眼 st.clientPro, 第一次见到新 key 就打日志 */
  setInterval(function () { try { if (window.MOCK_PLANS && window.MOCK_PLANS.watchClientPro) window.MOCK_PLANS.watchClientPro(); } catch (e) {} }, 15000);
  setTimeout(function () { try { if (window.MOCK_PLANS && window.MOCK_PLANS.watchClientPro) window.MOCK_PLANS.watchClientPro(); } catch (e) {} }, 3000);
  log('事件出口已挂载: HARVEST_CLOVER / FEED_NEIGHBOR / ITEM_BUY / DRAWING_BUY / CRAFT_STAMP / CRAFT_WISH / GIFT_BOX_PUT / PARTY_GO / TRAVEL_BACK / MATERIAL_BACK / FURNITURE_DONE');
})();
