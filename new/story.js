/* lxqw offline story layer: 故事/羁绊 (story.txt spec, implemented over the game's own
 * story protocols instead of a separate HTTP service - the client only speaks
 * SocketManage JSON protocols, so the HTTP API from story.txt cannot be used).
 *
 * Client contract (verified in main.min.js):
 *   story_load -> { stories:[{id, partner, name, gift, feedback}], new_story_id }
 *                 StoryData defaults: gift = -1 (no gift sent), feedback = -1
 *   story_read_new_story -> clear the pending reveal (StoryAlertView)
 *   story_send_gift(id, gift)   -> player sends an item to a 旅友
 *   story_feedback_gift(id)     -> thanks for a gift that arrived by mail
 *   StoryAlertView shows StoryDB.getStory(new_story_id) (tables/story_json.json)
 *   the relationship view groups stories by .partner and counts them (levels 2/3)
 *
 * Unlock model (story.txt): a story needs a destination + required/optional luggage;
 * optional items raise the weight.  Destination follows the food carried (weights).
 */
(function () {
  var M = window.MockServer, st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  function log(m) { try { console.log("[MOCK] " + m); } catch (e) {} }
  function now() { return Math.floor(Date.now() / 1000); }
  function save() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
  function push(name, data, d) {
    setTimeout(function () { try { M.dispatch(name, (typeof data === 'function' ? data() : data)); } catch (e) {} }, d || 40);
  }
  var REGIONS = ['华南地区', '华东地区', '华北地区', '西南地区', '台湾地区', '东北地区', '华中地区', '西北地区', '港澳地区'];
  var JUICE = [11, 12, 13, 14];                       /* 菠萝/草莓/甜椒/苹果 汁 */
  var PEANUT = [6, 7, 8, 9, 10];
  var BELL = [1002, 1003, 1004, 1005, 1006];
  var CRANE = [1007, 1008, 1009, 1010];
  var BOAT = [1013, 1014, 1015, 1016];
  var WINDCHIME = 1100;
  var TOTAL = 25;                                     /* tables/story_json.json 有 25 条 */
  /* condition table: one row per story, so the rules stay readable and testable */
  function condOf(id) {
    var i = id - 1, rare = (id % 7 === 0);
    return {
      region: REGIONS[i % REGIONS.length],
      partner: i % 3,
      req: rare ? [WINDCHIME] : [JUICE[i % 4], CRANE[i % 4]],
      opt: [PEANUT[i % 5], BELL[i % 5], BOAT[i % 4]],
      weight: rare ? 4 : 10,
      rare: rare ? 1 : 0
    };
  }
  if (!Array.isArray(st.stories)) st.stories = [];
  if (st.newStoryId === undefined) st.newStoryId = 0;
  function owned(id) { for (var i = 0; i < st.stories.length; i++) if (st.stories[i].id === id) return st.stories[i]; return null; }
  function has(list, v) { for (var i = 0; i < list.length; i++) if (Number(list[i]) === Number(v)) return true; return false; }
  function tripItems() {
    var out = Array.isArray(st.tripLuggage) ? st.tripLuggage.slice() : [];
    var lists = [st.bag, st.desk];
    for (var l = 0; l < lists.length; l++) {
      var a = lists[l]; if (!Array.isArray(a)) continue;
      for (var i = 0; i < a.length; i++) {
        var v = a[i];
        if (v !== -1 && v !== null && v !== undefined && !has(out, v)) out.push(v);
      }
    }
    return out;
  }
  /* 目的地 -> story.txt 的九大区: 优先用 new/postroute.js 判出来的**真实目的地**(st.tripRoute.place,
     就是 GoalNumber.id), 这样"去对地方"才真的能遇到故事; 拿不到再退回老办法(按食物 id 猜)。 */
  var PLACE_REGION = {
    1: '华北地区', 8: '华北地区', 15: '华中地区', 29: '华北地区', 33: '华北地区', 104: '华北地区',
    2: '西南地区', 3: '西南地区', 18: '西南地区', 19: '西南地区', 22: '西南地区',
    16: '西北地区', 17: '西北地区', 23: '西北地区', 32: '西北地区',
    6: '华东地区', 7: '华东地区', 20: '华东地区', 25: '华东地区', 26: '华东地区', 28: '华东地区', 100: '华东地区', 101: '华东地区', 103: '华东地区',
    14: '华中地区', 13: '华中地区',
    4: '华南地区', 5: '华南地区', 21: '华南地区', 24: '华南地区', 102: '华南地区',
    11: '港澳地区', 31: '港澳地区', 9: '台湾地区', 10: '台湾地区',
    12: '东北地区', 27: '东北地区', 30: '东北地区'
  };
  function tripRegion(items) {
    try {
      var r = st.tripRoute;
      var reg = r && PLACE_REGION[Number(r.place)];
      if (reg) return reg;
    } catch (e) {}
    return regionOf(items);
  }
  function regionOf(items) {
    for (var i = 0; i < items.length; i++) {
      var id = Number(items[i]);
      if (id >= 0 && id < 100) return REGIONS[id % REGIONS.length];   /* food ids 0..99 */
    }
    return REGIONS[Math.floor(Math.random() * REGIONS.length)];
  }
  function rollStory(items) {
    var region = tripRegion(items);
    var cands = [];
    for (var id = 1; id <= TOTAL; id++) {
      if (owned(id)) continue;
      var c = condOf(id);
      var ok = true;
      for (var r = 0; r < c.req.length; r++) if (!has(items, c.req[r])) ok = false;
      var sameRegion = (c.region === region);
      /* 原版的两种触发: ①带对行李(必得机会, 去对地方权重×3) ②**去对地方**也有机会遇到(权重 6) */
      if (!ok && !sameRegion) continue;
      var w = ok ? c.weight * (sameRegion ? 3 : 1) : 6;
      for (var o = 0; o < c.opt.length; o++) if (has(items, c.opt[o])) w += 5;
      if (w > 0) cands.push({ id: id, w: w, c: c, byRegion: !ok });
    }
    if (!cands.length) return null;
    var total = 0, i;
    for (i = 0; i < cands.length; i++) total += cands[i].w;
    var rnd = Math.random() * total;
    for (i = 0; i < cands.length; i++) { rnd -= cands[i].w; if (rnd <= 0) return cands[i]; }
    return cands[cands.length - 1];
  }
  function unlock(pick, items) {
    var entry = { id: pick.id, partner: pick.c.partner, gift: -1, feedback: -1, time: now() };
    st.stories.push(entry);
    st.newStoryId = pick.id;
    st.lastStoryRegion = pick.c.region;
    save();
    log('故事: 解锁 [' + pick.id + '] ' + pick.c.region + (pick.c.rare ? ' (稀有)' : '') +
        ' 携带 ' + items.join(',') + ' 累计 ' + st.stories.length + '/' + TOTAL);
    push('story_load', S['story_load'](), 80);
    /* 旅友笔记: 客户端 GiftModel.isOpen() 的判定是"笔记列表里有 TravelFriendsDB.visitOpen 里的 id"
       (2000 壁虎 / 2001 刺猬 / 2002 萤火虫, Note 表 factorType2="Friends", factorData2=好友 id)。
       我们的 NOTE_IDS 以前只有 1000..1029, 这三张永远不发 -> 礼品盒永远打不开。 */
    try {
      var noteId = 2000 + Number(pick.c.partner || 0);
      st.notes = Array.isArray(st.notes) ? st.notes : [];
      var has = false;
      for (var ni = 0; ni < st.notes.length; ni++) if (Number(st.notes[ni].id) === noteId) has = true;
      if (!has) {
        st.notes.push({ id: noteId, read: 0, timestamp: now() });
        save();
        log('故事: 同时解锁旅友笔记 ' + noteId + ' (GiftModel.isOpen)');
        push('travel_load_note', { note_list: st.notes }, 110);
      }
    } catch (e) {}
    if (window.MOCK_EVENT) window.MOCK_EVENT(8, [0]);        /* TimerEvent.Story -> 好像有故事发生 */
    return entry;
  }
  /* 直接解锁某条(给 new/stories.js 的"旅行趣事/节日趣闻"合流用; 也让 GM 能手动补一条) */
  window.MOCK_STORY_UNLOCK = function (id, why) {
    var n = Number(id);
    if (!(n >= 1 && n <= TOTAL)) return null;
    if (owned(n)) return owned(n);
    var c = condOf(n);
    var entry = unlock({ id: n, w: 0, c: c }, tripItems());
    log('故事: 指定解锁 [' + n + '] ' + c.region + ' (' + (why || '') + ')');
    return entry;
  };
  /* 已经有旅行记录的存档却一条故事都没有(v0.65 以前的存档就是这样): 补记第一条,
     否则玩家打开"旅行趣事"看到的是 0/0 —— 明明已经出过门了。 */
  function backfill() {
    try {
      if (Number(st.travelCount) >= 1 && !st.stories.length) {
        var c = condOf(1);
        unlock({ id: 1, w: 0, c: c }, tripItems());
        log('故事: 存档里已有 ' + st.travelCount + ' 次旅行 -> 补记第一条(旅行趣事的格子不该是空的)');
        return 1;
      }
    } catch (e) {}
    return 0;
  }
  window.MOCK_STORY_BACKFILL = backfill;
  backfill();
  /* called by the travel layer on every return */
  window.MOCK_STORY_ROLL = function () {
    if (st.stories.length >= TOTAL) return null;
    var items = tripItems();
    /* 第一次回来一定给一条(新玩家打开"旅行趣事"不该是空的) */
    if (!st.stories.length) {
      var first = rollStory(items) || { id: 1, w: 0, c: condOf(1) };
      st.storyDry = 0;
      return unlock(first, items);
    }
    var pick = rollStory(items);
    if (!pick) {
      /* 连着 2 趟空手 -> 保底给最靠前的那条(收集进度不卡死; 原版也是"多出门总会遇到") */
      st.storyDry = Number(st.storyDry || 0) + 1;
      if (st.storyDry >= 2) {
        for (var id = 1; id <= TOTAL; id++) {
          if (owned(id)) continue;
          st.storyDry = 0;
          log('故事: 连续 ' + (st.storyDry + 2) + ' 趟没遇到 -> 保底解锁 [' + id + ']');
          return unlock({ id: id, w: 0, c: condOf(id) }, items);
        }
      }
      log('故事: 本次旅行没有新的故事 (携带 ' + items.join(',') + ', 已空手 ' + st.storyDry + ' 趟)');
      return null;
    }
    st.storyDry = 0;
    return unlock(pick, items);
  };
  /* ---- protocols --------------------------------------------------------- */
  /* 客户端 StoryItem.setInfo(): t_title=n.name / t_describe=n.desc(n = StoryDB.getStory(id)),
     t_name = **t.name**(行里的 name)。以前不下发 name -> 卡片上那行字会变成 "undefined",
     所以这里从客户端自己的 story_json 里把名字带上(表里没有就退回空串)。 */
  function storyName(id) {
    try {
      var db = Tabikaeru.DataManager.instance().StoryDB;
      var row = db && db.getStory ? db.getStory(Number(id)) : null;
      if (row && row.name) return String(row.name);
    } catch (e) {}
    return '';
  }
  S['story_load'] = function () {
    return { stories: st.stories.map(function (s) {
      return { id: s.id, partner: s.partner, name: storyName(s.id), gift: (s.gift === undefined ? -1 : s.gift),
               feedback: (s.feedback === undefined ? -1 : s.feedback) };
    }), new_story_id: st.newStoryId || 0 };
  };
  S['story_read_new_story'] = function () { st.newStoryId = 0; save(); return { code: 0 }; };
  /* 送礼: 客户端只把 gift(特产 item_id)发上来, 回包不看内容(它自己本地记 gift)。
     契约要点: ①礼物必须真的从仓库扣掉+推 item_load_items(否则"礼物白送、仓库不减");
     ②同一个故事只能送一次(gift != -1 就是已送, 客户端据此把按钮变灰);
     ③之后要发一封 type=6(StoryGift) 邮件, 玩家点"感谢"会回 story_feedback_gift。 */
  S['story_send_gift'] = function (p) {
    var id = Number(p && p.id), gift = p && p.gift;
    var s = owned(id);
    if (!s) { log('送礼失败: 没有故事 ' + id); return { code: 1 }; }
    if (s.gift !== -1 && s.gift !== undefined && s.gift !== null) { log('送礼失败: 故事 ' + id + ' 已经送过了'); return { code: 2 }; }
    if (gift) {
      /* 礼物可以是仓库(house)/礼品盒(gifts)/背包(bag)里的特产 —— 三种都算拥有, 但要真扣 */
      var took = false, i;
      var h = Array.isArray(st.house) ? st.house : (st.house = []);
      for (i = 0; i < h.length; i++) if (h[i] && Number(h[i].item_id) === Number(gift) && (Number(h[i].count) || 0) > 0) {
        h[i].count = Number(h[i].count) - 1; took = true; break;
      }
      if (!took && Array.isArray(st.gifts)) {
        for (i = 0; i < st.gifts.length; i++) if (st.gifts[i] && Number(st.gifts[i].item_id) === Number(gift) && (Number(st.gifts[i].count) || 0) > 0) {
          st.gifts[i].count = Number(st.gifts[i].count) - 1; took = true;
          if (st.gifts[i].count <= 0) st.gifts.splice(i, 1);
          break;
        }
        if (took) setTimeout(function () { try { M.dispatch('travel_load_gift', (typeof S['travel_load_gift'] === 'function') ? S['travel_load_gift']() : null); } catch (e) {} }, 60);
      }
      if (!took && Array.isArray(st.bag)) {
        var slot = st.bag.indexOf(Number(gift));
        if (slot >= 0) { st.bag[slot] = -1; took = true; }
      }
      if (!took) { log('送礼失败: 仓库/礼品盒/背包里都没有 ' + gift); return { code: 3 }; }
      setTimeout(function () { try { M.dispatch('item_load_items', (typeof S['item_load_items'] === 'function') ? S['item_load_items']() : null); } catch (e) {} }, 40);
    }
    if (s) { s.gift = gift; save(); log('故事: 给 [' + id + '] 送出礼物 ' + gift + '(已从仓库扣除)'); }
    /* 回礼: 客户端点邮件列表里 Mail.EvtId.StoryGift(6) 那封的"是否感谢他的赠礼？"才会发
       story_feedback_gift —— 以前没有任何地方产生这封信, gift 送出后 feedback 永远是 -1。 */
    if (s && window.MOCK_ADD_MAIL) {
      setTimeout(function () {
        try {
          window.MOCK_ADD_MAIL({
            title: '旅友的回礼', message: '谢谢你送的东西，这个给你。',
            type: 6,                                  /* StoryGift */
            resource: { clover_point: 50, ticket: 1, ads_id: '' },
            items: [], sender: (Number(s.partner) >= 0 && Number(s.partner) <= 2) ? Number(s.partner) : -1
          });
          log('故事: 已发出 StoryGift 回礼邮件 (故事 ' + id + ', sender ' + s.partner + ')');
        } catch (e) {}
      }, 8000);
    }
    return { code: 0 };
  };
  S['story_feedback_gift'] = function (p) {
    var mid = Number(p && p.id);
    for (var i = 0; i < st.stories.length; i++) if (st.stories[i].gift !== -1 && st.stories[i].feedback === -1) {
      st.stories[i].feedback = 1; save();
      log('故事: 已回礼 (mail ' + mid + ') -> 故事 ' + st.stories[i].id);
      break;
    }
    return { code: 0 };
  };
  /* snapshot the luggage when the player presses 准备 (the trip carries it) */
  var origBag = S['item_set_bag_completed'];
  S['item_set_bag_completed'] = function (p) {
    if (p && p.completed) st.tripLuggage = tripItems();
    return origBag ? origBag(p) : {};
  };
  log('story ready: ' + st.stories.length + '/' + TOTAL + ' 个故事, 待揭晓 ' + (st.newStoryId || 0));
})();