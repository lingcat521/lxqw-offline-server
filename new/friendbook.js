/* lxqw 友情绘本 / 旅友笔记(离线) —— friendship_books 表 + 聚会结算解锁 + 金色边框稀有版
 *
 * 用户给的机制(2026-09-15):
 *   · 访客离开 -> **独立概率**(15%~30%)留下邀请卡片 -> 同意 -> 备手信 -> 赴约 -> 聚会归来带回友情绘本;
 *   · 喂食只影响回礼质量, 不影响邀约概率(已在 new/guestfeed.js 里实现, 22%);
 *   · 绘本按"朋友 + 地点 + 携带道具"匹配解锁; 稀有(金色边框)要求特定道具且概率更低;
 *   · 社区配方(玩家实测, 高概率但非 100%):
 *       壁虎猫咪   北方    + 甜椒汁(13)   + 蓝纸鹤(1010)
 *       刺猬蚂蚁   西南    + 菠萝汁(11)   + 白纸鹤(1008)
 *       萤火虫玉米 东方    + 草莓汁(12)   + 绿纸鹤(1007)
 *       刺猬迷路   南(福建/江西 24/25) + 菠萝汁(11) + 红纸鹤(1009)
 *     低配替代: 花生(6~10) / 铃铛(1002~1006) / 帆船(1013~1016) —— 权重低一档。
 *
 * 客户端契约: 笔记走 travel_load_note {note_list:[{id,read,timestamp}]}(id 必须在 Note 表里);
 *   绘本页走 guest_load_drawing {pages[], colls[]}(id 必须在 drawingPageData/Collect 表里, 见 new/drawing.js)。
 *   本层只做"表 + 匹配 + 发奖", 渲染沿用已有两层。
 *
 * 表字段(用户指定): {id, friend, friend_name, title, content, rarity('normal'|'rare'), unlock_condition, related_item_id}
 */
(function () {
  var st = window.MOCK_STATE || (window.MOCK_STATE = {});
  function log(m) { try { console.log('[MOCK] 友情绘本: ' + m); } catch (e) {} }
  function save() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function push(name, data, d) { setTimeout(function () { try { window.MockServer.dispatch(name, (typeof data === 'function' ? data() : data)); } catch (e) {} }, d || 60); }
  function nowSec() { return Math.floor(Date.now() / 1000); }

  var FRIEND_NAME = { 0: '壁虎', 1: '刺猬', 2: '萤火虫' };
  /* ---- friendship_books 表 ----
     kind: 'note' = 旅友笔记(走 travel_load_note, 2000~2026 里的一篇; rare 就是"金色边框")
           'page' = 友情绘本的绘纸页(走 guest_load_drawing, guest 决定哪一本) */
  var BOOKS = [
    /* --- 社区配方四条(旅行携带果汁+纸鹤, 去对地方) --- */
    { id: 1, kind: 'note', note: 2000, friend: 0, title: '猫咪的窗台', rarity: 'rare', related_item_id: 2000,
      content: '在北方的小城里遇到的猫。它蹲在窗台上看我, 我把甜椒汁分了一点给它。',
      unlock_condition: { region: 'north', items_all: [13, 1010], place_name: '北方', drop: 0.25 } },
    { id: 2, kind: 'note', note: 2001, friend: 1, title: '蚂蚁搬家', rarity: 'rare', related_item_id: 2001,
      content: '西南的雨来得急。刺猬和我躲在屋檐下, 看蚂蚁排着队把家搬到高处。',
      unlock_condition: { region: 'west', items_all: [11, 1008], place_name: '西南', drop: 0.25 } },
    { id: 3, kind: 'note', note: 2002, friend: 2, title: '玉米地的灯', rarity: 'rare', related_item_id: 2002,
      content: '东边的玉米地到了晚上会亮起来 —— 是萤火虫, 一大群。',
      unlock_condition: { region: 'east', items_all: [12, 1007], place_name: '东方', drop: 0.25 } },
    { id: 4, kind: 'note', note: 2003, friend: 1, title: '迷路的下午', rarity: 'normal', related_item_id: 2003,
      content: '在福建的老巷子里绕了很久, 刺猬说它认识路, 结果我们一起迷路了。',
      unlock_condition: { place: [24, 25], items_all: [11, 1009], drop: 0.4 } },
    /* --- 低配(花生/铃铛/帆船): 权重低一档 --- */
    { id: 5, kind: 'note', note: 2004, friend: 0, title: '花生壳小船', rarity: 'normal', related_item_id: 2004,
      content: '用花生壳做了一条小船, 放在水沟里, 一直漂到看不见。', unlock_condition: { items: [6, 7, 8, 9, 10], drop: 0.3 } },
    { id: 6, kind: 'note', note: 2005, friend: 2, title: '铃铛的响声', rarity: 'normal', related_item_id: 2005,
      content: '铃铛挂在包上, 走一步响一声。萤火虫说它循着声音找过来的。', unlock_condition: { items: [1002, 1003, 1004, 1005, 1006], drop: 0.3 } },
    { id: 7, kind: 'note', note: 2006, friend: 1, title: '纸船出海', rarity: 'normal', related_item_id: 2006,
      content: '把纸船放进海里, 它转了个圈, 又回到脚边。', unlock_condition: { items: [1013, 1014, 1015, 1016], place_name: '沿海', drop: 0.3 } },
    { id: 8, kind: 'note', note: 2007, friend: 0, title: '雨天共伞', rarity: 'normal', related_item_id: 2007,
      content: '伞太小了, 我们两个都湿了半边。', unlock_condition: { weather: [3, 4], items: [2003, 2004, 2005], drop: 0.35 } },
    /* --- 聚会结算给"绘纸页"(每个朋友一本) --- */
    { id: 20, kind: 'page', guest: 0, friend: 0, title: '壁虎的聚会', rarity: 'normal', related_item_id: 0,
      content: '第一次去朋友家做客。桌上摆了我带的手信, 大家都说好吃。',
      unlock_condition: { party: 1, guest: 0, drop: 0.6 } },
    { id: 21, kind: 'page', guest: 1, friend: 1, title: '刺猬的聚会', rarity: 'normal', related_item_id: 0,
      content: '刺猬家的椅子有点扎人, 但是点心很好吃。', unlock_condition: { party: 1, guest: 1, drop: 0.6 } },
    { id: 22, kind: 'page', guest: 2, friend: 2, title: '萤火虫的聚会', rarity: 'normal', related_item_id: 0,
      content: '天黑了以后, 萤火虫把灯都点亮了。那是我见过最亮的一间屋子。', unlock_condition: { party: 1, guest: 2, drop: 0.6 } },
    { id: 23, kind: 'page', guest: 1, friend: 1, title: '金色的一页', rarity: 'rare', related_item_id: 0,
      content: '刺猬把它最喜欢的那页送给了我 —— 边上描着金线。',
      unlock_condition: { party: 3, guest: 1, items: [3000, 3001, 3002, 3003, 3004], drop: 0.15 } }
  ];

  function owned() { st.friendBooks = arr(st.friendBooks); return st.friendBooks; }
  function owns(id) { return owned().indexOf(Number(id)) >= 0; }
  function luggage() {
    var out = arr(st.lastTripItems).slice();
    var lists = [st.bag, st.desk];
    for (var l = 0; l < lists.length; l++) for (var i = 0; i < arr(lists[l]).length; i++) {
      var v = lists[l][i];
      if (v !== -1 && v !== null && v !== undefined && out.indexOf(v) < 0) out.push(v);
    }
    return out;
  }
  function route() { return st.tripRoute || null; }
  function regionKey() {
    var r = route();
    if (r && r.region) return String(r.region);
    return '';
  }
  function condMet(c, ctx) {
    if (!c) return false;
    var items = arr(ctx && ctx.items ? ctx.items : luggage()), r = route();
    if (c.kind && ctx && ctx.kind && c.kind !== ctx.kind) return false;
    if (c.party && num(ctx && ctx.party) < num(c.party)) return false;
    if (c.guest !== undefined && num(ctx && ctx.guest) !== num(c.guest)) return false;
    if (c.region && String(c.region) !== String(regionKey())) return false;
    if (c.place && arr(c.place).indexOf(num(r && r.place)) < 0) return false;
    if (c.weather) { var w = num((window.MOCK_ENV && window.MOCK_ENV.weather) || st.weather) || 1; if (arr(c.weather).indexOf(w) < 0) return false; }
    /* items = 任意一样即可(低配替代); items_all = **每一样都要带**(社区配方: 果汁 + 纸鹤) */
    if (c.items_all && arr(c.items_all).length) {
      for (var a = 0; a < arr(c.items_all).length; a++) {
        var found = false;
        for (var q = 0; q < items.length; q++) if (num(items[q]) === num(arr(c.items_all)[a])) found = true;
        if (!found) return false;
      }
    }
    if (c.items && arr(c.items).length) {
      var has = false;
      for (var i = 0; i < items.length; i++) if (arr(c.items).indexOf(num(items[i])) >= 0) has = true;
      if (!has) return false;
    }
    return true;
  }
  /* 匹配并解锁; ctx = {kind:'travel'|'party', items[], guest, party} */
  function match(ctx) {
    ctx = ctx || {};
    var got = [], i;
    for (i = 0; i < BOOKS.length; i++) {
      var b = BOOKS[i];
      if (owns(b.id)) continue;
      if (b.kind === 'note' && ctx.kind !== 'travel') continue;
      if (b.kind === 'page' && ctx.kind !== 'party') continue;
      if (!condMet(b.unlock_condition, ctx)) continue;
      if (Math.random() > num(b.unlock_condition.drop || 0.3)) { log('『' + b.title + '』条件够了但这趟没掉(概率 ' + Math.round(num(b.unlock_condition.drop) * 100) + '%)'); continue; }
      if (grant(b, ctx.why)) got.push(b);
    }
    if (got.length) save();
    return got.length;
  }
  function grant(b, why) {
    if (owns(b.id)) return false;
    owned().push(b.id);
    if (b.kind === 'note') {
      var nid = num(b.note);
      st.notes = arr(st.notes);
      var has = false;
      for (var i = 0; i < st.notes.length; i++) if (num(st.notes[i].id) === nid) has = true;
      if (!has) st.notes.push({ id: nid, read: 0, timestamp: nowSec() });
      save();
      push('travel_load_note', { note_list: st.notes.slice() }, 60);
      log((b.rarity === 'rare' ? '★稀有(金色边框)' : '') + '『' + b.title + '』-> 旅友笔记 ' + nid + ' [' + (why || '') + ']');
    } else {
      var d = st.drawing || (st.drawing = {});
      d.pages = arr(d.pages); d.colls = arr(d.colls);
      var page = 0, guest = num(b.guest);
      /* 客户端 DataManager 里的字段名是 **DrawingPage**(= drawingPageData 表), 不是 drawingPageDB */
      try {
        var dm = Tabikaeru.DataManager.instance();
        var db = dm.DrawingPage || dm.drawingPageDB || dm.drawingPageData;
        var rows = (db && typeof db.list === 'function') ? (db.list() || []) : (Array.isArray(db) ? db : []);
        for (var j = 0; j < rows.length; j++) {
          if (num(rows[j].guest) === guest && d.pages.indexOf(num(rows[j].id)) < 0) { page = num(rows[j].id); break; }
        }
      } catch (e) {}
      if (!page) { log('绘纸页: drawingPageData 里没有 guest=' + guest + ' 的可用页(或表没读到)'); }
      if (page) d.pages.push(page);
      save();
      try { if (window.MOCK_DRAWING && window.MOCK_DRAWING.push) window.MOCK_DRAWING.push(); } catch (e) {}
      push('guest_load_drawing', (window.MOCK_SEMANTIC && window.MOCK_SEMANTIC['guest_load_drawing']) ? window.MOCK_SEMANTIC['guest_load_drawing']() : { pages: d.pages.slice(), colls: d.colls.slice() }, 60);
      log((b.rarity === 'rare' ? '★稀有(金色边框)' : '') + '『' + b.title + '』-> 绘纸页 ' + (page || '(已画满)') + ' [' + (why || '') + ']');
    }
    return true;
  }
  function unlockById(id, why) {
    for (var i = 0; i < BOOKS.length; i++) if (num(BOOKS[i].id) === num(id)) {
      if (owns(id)) return null;
      return grant(BOOKS[i], why || 'GM') ? BOOKS[i] : null;
    }
    return null;
  }

  /* ---- 触发点 ①旅行归来(果汁+纸鹤+去对地方) ---- */
  (function () {
    var prev = window.MOCK_STORY_ROLL;
    window.MOCK_STORY_ROLL = function () {
      var r = (typeof prev === 'function') ? prev() : null;
      try { match({ kind: 'travel', items: luggage(), why: '旅行归来' }); } catch (e) {}
      return r;
    };
  })();
  /* ---- 触发点 ②聚会结算(带回友情绘本) ---- */
  (function () {
    var prev = window.MOCK_PARTY && window.MOCK_PARTY.finish;
    if (!prev) return;
    window.MOCK_PARTY.finish = function (why) {
      var r = prev.apply(this, arguments);
      try {
        var p = st.party || {};
        var guest = num(p.guest);
        var times = num(st.partyCount = num(st.partyCount) + 1);
        match({ kind: 'party', guest: guest, party: times, items: luggage(), why: '聚会归来(' + (FRIEND_NAME[guest] || guest) + ')' });
      } catch (e) {}
      return r;
    };
    log('已挂钩 MOCK_PARTY.finish: 聚会归来结算友情绘本');
  })();

  window.MOCK_FRIEND_BOOK = {
    table: function () {
      return BOOKS.map(function (b) {
        return { id: b.id, kind: b.kind, friend: b.friend, friend_name: FRIEND_NAME[b.friend] || '',
                 title: b.title, content: b.content, rarity: b.rarity,
                 unlock_condition: b.unlock_condition, related_item_id: b.related_item_id,
                 note: b.note || 0, guest: (b.guest === undefined ? -1 : b.guest), unlocked: owns(b.id) };
      });
    },
    list: function () { return window.MOCK_FRIEND_BOOK.table(); },
    unlocked: function () { return owned().slice(); },
    match: match, unlock: unlockById, condMet: condMet, grant: grant,
    stats: function () {
      var t = window.MOCK_FRIEND_BOOK.table();
      return { total: t.length, unlocked: owned().length, rare: t.filter(function (x) { return x.rarity === 'rare'; }).length,
               page: t.filter(function (x) { return x.kind === 'page'; }).length,
               note: t.filter(function (x) { return x.kind === 'note'; }).length, last: st.friendBooksLast || null };
    },
    reset: function () { st.friendBooks = []; save(); return 0; }
  };
  st.friendBooks = arr(st.friendBooks);
  var s = window.MOCK_FRIEND_BOOK.stats();
  log('friendship_books 表就绪: ' + s.total + ' 本(笔记 ' + s.note + ' / 绘纸 ' + s.page + ', 稀有 ' + s.rare + '), 已解锁 ' + s.unlocked);
})();
