/* lxqw 「故事」界面(离线) —— 旅行趣事 / 节日趣闻 两个板块(目标⑧)
 *
 * 用户给的机制(2026-09-15 补充):
 *   · 故事界面是一本**收集册**, 初始 0/0 = 一条都没解锁; 核心是"触发式收集";
 *   · 旅行趣事: 与**目的地 / 携带道具 / 遭遇的动物朋友 / 随机事件**有关;
 *   · 节日趣闻: 与现实**传统节日或节气**挂钩 —— 节日/节气期间带上对应的限定食物出门, 才有机会;
 *   · 触发时机: **旅行结束(归来)或寄回明信片**时遍历未解锁故事做条件匹配;
 *   · 节日类即使条件满足也要再过一次 **15%~30%** 概率(纪念品本身约 15%);
 *   · 与**称号**(如"鉴赏名家")和**图鉴**(collections)联动。
 *
 * stories 表(用户指定字段) = {id, type, title, content, unlock_condition, related_item_id}
 *   · type: 'travel' | 'festival'
 *   · unlock_condition(JSON): {trips, weather[], hours[], items[], flavor, region, place,
 *                              collections, friend_notes, titles[], festival, any_month, solar_food}
 *   · related_item_id: 关联的纪念品(Item id, 3000+/4000+ 特产/纪念品) 或 明信片(Picture id);
 *       解锁时按 **15%** 概率把它一起给你(节日类) / 有道具条件时直接给(旅行类)
 *
 * 客户端契约: 客户端的"旅行趣事"页签读的是 story_load(story.js 的 25 条), 本层的条目
 *   解锁时通过 window.MOCK_STORY_UNLOCK(id) **合流**成客户端的一张卡(所以 id 必须落在 1..25)。
 *   本层自己的 title/content 是服务端侧的文案(日记/笔记/GM 可见)。
 */
(function () {
  var st = window.MOCK_STATE || (window.MOCK_STATE = {});
  function log(m) { try { console.log('[MOCK] 故事3: ' + m); } catch (e) {} }
  function save() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function push(name, data, d) { setTimeout(function () { try { window.MockServer.dispatch(name, (typeof data === 'function' ? data() : data)); } catch (e) {} }, d || 60); }
  function now() { return new Date(); }

  /* ---------- 节日(现实日期) + 节气(每月固定一个) ---------- */
  function festivals(d) {
    d = d || now();
    var m = d.getMonth() + 1, day = d.getDate(), out = [];
    if (m === 1 && day >= 1 && day <= 3) out.push('元旦');
    if (m === 2 && day >= 10 && day <= 17) out.push('春节');
    if (m === 4 && day >= 3 && day <= 6) out.push('清明');
    if (m === 5 && day >= 1 && day <= 3) out.push('劳动节');
    if (m === 6 && day >= 10 && day <= 25) out.push('端午');
    if (m === 8 && day >= 10 && day <= 20) out.push('七夕');
    if (m === 9 && day >= 20 && day <= 30) out.push('中秋');
    if (m === 10 && day >= 1 && day <= 7) out.push('国庆');
    if (m === 12 && day >= 20) out.push('冬至');
    return out;
  }
  var SOLAR = {
    1: { term: 1, name: '小寒', food: 203001 }, 2: { term: 2, name: '立春', food: 203002 },
    3: { term: 3, name: '惊蛰', food: 203003 }, 4: { term: 4, name: '清明', food: 203004 },
    5: { term: 5, name: '立夏', food: 203005 }, 6: { term: 6, name: '芒种', food: 203006 },
    7: { term: 7, name: '大暑', food: 203007 }, 8: { term: 8, name: '立秋', food: 203011 },
    9: { term: 9, name: '白露', food: 203012 }, 10: { term: 10, name: '霜降', food: 203013 },
    11: { term: 11, name: '立冬', food: 203014 }, 12: { term: 12, name: '大雪', food: 203015 }
  };
  function solarNow(d) { return SOLAR[(d || now()).getMonth() + 1] || SOLAR[1]; }
  /* 本月节气食物(嘟嘟 375 草那 24 件, 见 new/solarphoto.js): 带它出门才算"节气主题" */
  function solarFoods() {
    try { if (window.MOCK_SOLARPHOTO && window.MOCK_SOLARPHOTO.foods) return arr(window.MOCK_SOLARPHOTO.foods()); } catch (e) {}
    return [];
  }

  /* ---------- stories 表(用户字段: id/type/title/content/unlock_condition/related_item_id) ---------- */
  var STORIES = [
    { id: 1, type: 'travel', title: '第一次远行', client_id: 1, related_item_id: 4001,
      content: '第一次背着行囊出了远门。风比院子里大得多, 我有点紧张, 也有点高兴。',
      unlock_condition: { trips: 1 } },
    { id: 2, type: 'travel', title: '山路上的雨', client_id: 2, related_item_id: 4002,
      content: '雨点打在叶子上, 声音很好听。我躲在屋檐下等了一会儿, 顺手捡了片叶子。',
      unlock_condition: { weather: [3, 4], items: [2003, 2004, 2005] } },
    { id: 3, type: 'travel', title: '海边的贝壳', client_id: 3, related_item_id: 4003,
      content: '雨下得特别大, 我在海边捡到一枚贝壳, 带回去放在窗台上应该会很好看。',
      unlock_condition: { weather: [4], trips: 3, flavor: 'coastal' } },
    { id: 4, type: 'travel', title: '晨雾里的竹林', client_id: 4, related_item_id: 4004,
      content: '清早的雾还没散, 竹林里只有脚步踩在落叶上的声音。',
      unlock_condition: { hours: [4], trips: 5, flavor: 'jiangnan' } },
    { id: 5, type: 'travel', title: '沙丘上的落日', client_id: 5, related_item_id: 4005,
      content: '风把沙子吹成一道一道的痕。太阳落下去的时候, 整片地都是金色的。',
      unlock_condition: { flavor: 'desert', items: [4] } },
    { id: 6, type: 'travel', title: '山那边的云', client_id: 6, related_item_id: 4006,
      content: '爬了很久才到上面, 云就在旁边。往下看的时候我抓紧了背包。',
      unlock_condition: { flavor: 'mountain', items: [33] } },
    { id: 7, type: 'travel', title: '老屋里的展品', client_id: 7, related_item_id: 4007,
      content: '屋子里摆着很久以前的东西。我看了很久, 觉得它们也在看我。',
      unlock_condition: { flavor: 'museum', items: [1104] } },
    { id: 8, type: 'travel', title: '十次出门之后', client_id: 8, related_item_id: 4008,
      content: '走过的地方在心里连起来像一条路。我数了数, 已经出门十次了。',
      unlock_condition: { trips: 10 } },
    { id: 9, type: 'travel', title: '鉴赏家的眼光', client_id: 9, related_item_id: 4009,
      content: '看得多了, 一眼就能认出好东西。这大概也算一种本事。',
      unlock_condition: { collections: 18, titles: ['鉴赏名家'] } },
    { id: 10, type: 'travel', title: '旅友的合影', client_id: 10, related_item_id: 3055,
      content: '路上遇到的朋友和我挤在同一张照片里。谁也不肯先走。',
      unlock_condition: { friend_notes: 1 } },
    { id: 11, type: 'festival', title: '中秋的月饼', client_id: 11, related_item_id: 3080,
      content: '月亮很圆, 我带了一块月饼出门, 路上分了一半给遇见的朋友。',
      unlock_condition: { festival: '中秋', solar_food: 1 }, chance: 0.25 },
    { id: 12, type: 'festival', title: '端午的粽叶', client_id: 12, related_item_id: 3024,
      content: '河边有人在包粽子, 空气里全是箬叶的味道。',
      unlock_condition: { festival: '端午', solar_food: 1 }, chance: 0.25 },
    { id: 13, type: 'festival', title: '冬至的饺子', client_id: 13, related_item_id: 3059,
      content: '吃了饺子就不怕冻耳朵。今天走再远也要赶回家。',
      unlock_condition: { festival: '冬至', solar_food: 1 }, chance: 0.2 },
    { id: 14, type: 'festival', title: '春节的红纸', client_id: 14, related_item_id: 3086,
      content: '到处都挂着红的东西。我也在门口贴了一张, 风一吹就响。',
      unlock_condition: { festival: '春节', solar_food: 1 }, chance: 0.3 },
    { id: 15, type: 'festival', title: '节气里的味道', client_id: 15, related_item_id: 3055,
      content: '只有这几天才有的吃食。吃完就该出门看看了。',
      unlock_condition: { any_month: 1, solar_food: 1 }, chance: 0.2 },
    { id: 16, type: 'festival', title: '霜降的糖霜', client_id: 16, related_item_id: 3057,
      content: '早上草叶上有一层白。舔一下是甜的。',
      unlock_condition: { festival: '国庆', solar_food: 1 }, chance: 0.2 },
    { id: 17, type: 'festival', title: '七夕的河灯', client_id: 17, related_item_id: 3055,
      content: '水面上漂着很多小灯。我蹲下来看了很久, 直到它们都漂远。',
      unlock_condition: { festival: '七夕', solar_food: 1 }, chance: 0.25 },
    { id: 18, type: 'festival', title: '清明的青团', client_id: 18, related_item_id: 3051,
      content: '艾草的清香混在雨里。这样的日子适合慢慢地走。',
      unlock_condition: { festival: '清明', solar_food: 1 }, chance: 0.25 }
  ];

  function owned() { st.stories3 = arr(st.stories3); return st.stories3; }
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
  function weather() { try { return num((window.MOCK_ENV && window.MOCK_ENV.weather) || st.weather) || 1; } catch (e) { return num(st.weather) || 1; } }
  function hoursType() { try { return num(window.MOCK_ENV && window.MOCK_ENV.hours_type) || 0; } catch (e) { return 0; } }
  function route() { return st.tripRoute || null; }
  function titleNames() {
    var out = [], ids = arr(st.achieveList || (st.clientSettings && st.clientSettings.achieveList));
    try {
      var db = Tabikaeru.DataManager.instance().AchieveDB;
      var rows = (db && typeof db.list === 'function') ? db.list() : [];
      for (var i = 0; i < rows.length; i++) if (ids.indexOf(num(rows[i].id)) >= 0) out.push(String(rows[i].name || ''));
      if (num(st.achieveId)) for (var j = 0; j < rows.length; j++) if (num(rows[j].id) === num(st.achieveId)) out.push(String(rows[j].name || ''));
    } catch (e) {}
    return out;
  }
  /* ---- 条件匹配(用户指定的 unlock_condition) ---- */
  function condMet(c) {
    if (!c) return false;
    var it = luggage(), r = route();
    if (c.trips && num(st.travelCount) < num(c.trips)) return false;
    if (c.places && Object.keys(st.placeVisited || {}).length < num(c.places)) return false;
    if (c.collections && arr(st.collections).length < num(c.collections)) return false;
    if (c.friend_notes) {
      var n = 0, notes = arr(st.notes);
      for (var i = 0; i < notes.length; i++) if (num(notes[i] && notes[i].id) >= 2000 && num(notes[i].id) < 3000) n++;
      if (n < num(c.friend_notes)) return false;
    }
    if (c.weather && arr(c.weather).indexOf(weather()) < 0) return false;
    if (c.hours && arr(c.hours).indexOf(hoursType()) < 0) return false;
    if (c.items && arr(c.items).length) {
      var has = false;
      for (var j = 0; j < it.length; j++) if (arr(c.items).indexOf(num(it[j])) >= 0) has = true;
      if (!has) return false;
    }
    if (c.place && num(c.place) !== num(r && r.place)) return false;
    if (c.flavor && String(c.flavor) !== String(r && r.flavor)) return false;
    if (c.region && String(c.region) !== String(r && r.region)) return false;
    if (c.titles && arr(c.titles).length) {
      var tn = titleNames(), okT = false;
      for (var k = 0; k < arr(c.titles).length; k++) if (tn.indexOf(String(c.titles[k])) >= 0) okT = true;
      if (!okT) return false;
    }
    if (c.festival && festivals(now()).indexOf(String(c.festival)) < 0) return false;
    if (c.any_month) { /* 只要带了当月节气食物即可(下面 solar_food 会判) */ }
    if (c.solar_food) {
      var sf = solarNow(now()).food, got = false, mf = solarFoods(), month = now().getMonth() + 1;
      var want = arr(mf[month]).concat([sf]);
      for (var q = 0; q < it.length; q++) if (want.indexOf(num(it[q])) >= 0) got = true;
      if (!got) return false;
    }
    return true;
  }
  /* ---- 关联纪念品/明信片: 解锁时按 15% 给(节日类), 有道具条件的旅行类直接给 ---- */
  function grantRelated(s, why) {
    var rid = num(s.related_item_id);
    if (!rid) return 0;
    var isPic = false;
    try { isPic = !!(window.MOCK_PICTURES && window.MOCK_PICTURES[String(rid)]); } catch (e) {}
    var chance = (s.type === 'festival') ? 0.15 : (s.unlock_condition && s.unlock_condition.items ? 1 : 0.15);
    if (Math.random() > chance) { log('『' + s.title + '』的关联收藏(' + rid + ')这次没带回来(概率 ' + Math.round(chance * 100) + '%)'); return 0; }
    if (isPic) {
      st.photos = arr(st.photos);
      var photo = { id: num(st.nextPhoto) || (st.photos.length + 1), pic_id: rid };
      st.nextPhoto = num(photo.id) + 1;
      st.photos.push(photo);
      save();
      push('album_load_new', { pictures: [photo], has_ads: false, is_share: false, visted_pic: [] }, 90);
      log('『' + s.title + '』带回一张关联明信片 ' + rid);
      return rid;
    }
    st.house = arr(st.house);
    var found = null;
    for (var i = 0; i < st.house.length; i++) if (num(st.house[i].item_id) === rid) found = st.house[i];
    if (found) found.count = (num(found.count) || 0) + 1; else st.house.push({ item_id: rid, count: 1 });
    save();
    push('item_load_items', (window.MOCK_SEMANTIC && window.MOCK_SEMANTIC['item_load_items']) ? window.MOCK_SEMANTIC['item_load_items']() : null, 90);
    log('『' + s.title + '』带回关联纪念品 ' + rid);
    return rid;
  }
  /* ---- 遍历未解锁 -> 条件匹配 -> (节日类)概率 -> 解锁 ---- */
  function check(why) {
    var got = [], i;
    for (i = 0; i < STORIES.length; i++) {
      var s = STORIES[i];
      if (owns(s.id)) continue;
      if (!condMet(s.unlock_condition)) continue;
      if (s.type === 'festival') {
        var ch = Math.max(0.15, Math.min(0.3, num(s.chance) || 0.2));
        if (Math.random() > ch) { log('节日趣闻『' + s.title + '』条件满足但这趟没触发(概率 ' + Math.round(ch * 100) + '%)'); continue; }
      }
      owned().push(s.id);
      s.unlockedAt = Math.floor(Date.now() / 1000);
      log('解锁' + (s.type === 'festival' ? '节日趣闻' : '旅行趣事') + ' #' + s.id + '『' + s.title + '』[' + (why || '') + ']');
      /* 客户端"旅行趣事"页签的卡片: 合流到 story.js 的 25 条里 */
      try { if (window.MOCK_STORY_UNLOCK && s.client_id) window.MOCK_STORY_UNLOCK(num(s.client_id), '故事3:' + s.title); } catch (e) {}
      try { grantRelated(s, why); } catch (e) {}
      got.push(s);
    }
    if (got.length) save();
    return got.length;
  }
  function unlockById(id, why) {
    for (var i = 0; i < STORIES.length; i++) {
      var s = STORIES[i];
      if (num(s.id) !== num(id)) continue;
      if (owns(s.id)) return null;
      owned().push(s.id);
      try { if (window.MOCK_STORY_UNLOCK && s.client_id) window.MOCK_STORY_UNLOCK(num(s.client_id), 'GM:' + s.title); } catch (e) {}
      try { grantRelated(s, why || 'GM'); } catch (e) {}
      save();
      log('指定解锁『' + s.title + '』');
      return s;
    }
    return null;
  }

  /* ---- 触发点: 旅行归来 / 寄回明信片 ---- */
  function hookRoll() {
    var prev = window.MOCK_STORY_ROLL;
    window.MOCK_STORY_ROLL = function () {
      var r = (typeof prev === 'function') ? prev() : null;
      try { check('旅行归来'); } catch (e) {}
      return r;
    };
  }
  /* 旅途中寄回明信片(mid-trip): rules.js/travel2 的寄信时机 -> window.MOCK_POSTCARD_HOME */
  function hookPostcard() {
    var prev = window.MOCK_POSTCARD_HOME;
    window.MOCK_POSTCARD_HOME = function () {
      var r = (typeof prev === 'function') ? prev.apply(this, arguments) : null;
      try { check('寄回明信片'); } catch (e) {}
      return r;
    };
  }
  hookRoll(); hookPostcard();

  window.MOCK_STORIES2 = {
    /* 用户要的 stories 表(JSON 样例给 GM/测试看) */
    table: function () {
      return STORIES.map(function (s) {
        return { id: s.id, type: s.type, title: s.title, content: s.content,
                 unlock_condition: s.unlock_condition, related_item_id: s.related_item_id,
                 chance: s.chance || 0, client_id: s.client_id, unlocked: owns(s.id) };
      });
    },
    list: function () { return window.MOCK_STORIES2.table(); },
    unlocked: function () { return owned().slice(); },
    unlockedRows: function () { return window.MOCK_STORIES2.table().filter(function (r) { return r.unlocked; }); },
    check: check, condMet: condMet, unlock: unlockById,
    festivals: function () { return festivals(now()); },
    solar: function () { return solarNow(now()); },
    titles: titleNames, grant: grantRelated, reset: function () { st.stories3 = []; save(); return 0; }
  };
  /* 兼容老接口(diary.js 用 solar()/festivals(), 测试用 list/unlocked/check/condMet) */
  window.MOCK_STORIES = window.MOCK_STORIES2;
  st.stories3 = arr(st.stories3);
  log('stories 表就绪: ' + STORIES.length + ' 条(旅行趣事 ' + STORIES.filter(function (s) { return s.type === 'travel'; }).length +
      ' / 节日趣闻 ' + STORIES.filter(function (s) { return s.type === 'festival'; }).length + '), 已解锁 ' + owned().length +
      ' | 节日: ' + (festivals(now()).join(',') || '无') + ' | 节气: ' + solarNow(now()).name);
})();
