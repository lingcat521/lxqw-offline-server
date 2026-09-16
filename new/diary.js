/* lxqw 呱呱日记(离线) —— 居家"写日记"不可打断 + 日记内容表 + 写好的那页进"小仓库·笔记"
 *
 * 需求(用户清单 new.txt + 目标④):
 *   · 居家状态"写信/写日记: 在书桌前伏案写信或写日记, 常常一写就是很久" -> 这段时间**不可打断**:
 *     不收拾行囊、不换动作、也不出门; 写完才回到随机动作。
 *   · 日记内容表: 按这一趟的路线(new/postroute.js 的 st.tripRoute: 区域/目的地/绕路/隐藏/公里)、
 *     天气季节、旅行次数、图鉴进度、旅友笔记、称号、节气节日, 从表里挑一条没写过的写下来。
 *   · 内容落在客户端**真实的笔记页**上: Note_json 里 type=1 的 137 张(quality 1 普通 / 2 精华),
 *     走 travel_load_note 的 {id,read,timestamp} -> 客户端 TravelNoteModel 按 type 分栏渲染
 *     (getNoteListByType(1) = 呱呱的日记; type2 = 旅友笔记), 纹理 pic_<id>_png 见 MOCK_NOTE_IDS。
 *   · 客户端 sendReadNote() 走 travel_read_note(rules.js 已实现) -> 未读红点(NEW_NOTE)会消。
 *
 * 客户端契约: travel_load_note -> {note_list:[{id,read,timestamp}]}; Note 表 type=1/2; 纹理 pic_<id>_png。
 */
(function () {
  var M = window.MockServer, st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  function log(m) { try { console.log('[MOCK] 日记: ' + m); } catch (e) {} }
  function save() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
  function nowSec() { return Math.floor(Date.now() / 1000); }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function pick(a) { return a && a.length ? a[Math.floor(Math.random() * a.length)] : null; }

  /* ---------- 日记内容表 ----------
     cond(ctx) 命中即候选; pri 越大越优先; tier 2 -> 精华页(quality 2) */
  var TEXTS = [
    { key: 'first_trip', pri: 100, tier: 2, title: '第一次出门',
      text: '今天第一次背上行囊出了远门。外面的风比院子里的大得多, 我有点紧张, 也有点高兴。',
      cond: function (c) { return c.trips <= 1; } },
    { key: 'first_photo', pri: 96, tier: 1, title: '第一张明信片',
      text: '我把路上看到的东西拍了下来寄回家。不知道家里的人会不会喜欢这张。',
      cond: function (c) { return c.photos <= 1; } },
    { key: 'rainy', pri: 80, tier: 1, title: '雨天',
      text: '下雨了。雨点打在叶子上, 声音很好听, 我躲在屋檐下等了一会儿。',
      cond: function (c) { return c.rain; } },
    { key: 'storm', pri: 84, tier: 2, title: '暴雨',
      text: '雨下得特别大, 我在海边捡到一枚贝壳。带回去放在窗台上应该会很好看。',
      cond: function (c) { return c.storm; } },
    { key: 'snow', pri: 82, tier: 1, title: '雪天',
      text: '下雪了, 脚踩下去会陷进去一点点。冷是冷, 可是雪地亮得像白天。',
      cond: function (c) { return c.snow; } },
    { key: 'hot', pri: 60, tier: 1, title: '盛夏',
      text: '太阳很晒, 我找了一片大叶子顶在头上, 走一段歇一段。',
      cond: function (c) { return c.season === 1; } },
    { key: 'autumn', pri: 60, tier: 1, title: '秋天',
      text: '树叶开始变颜色了。捡了一片夹在笔记本里, 回家再拿出来看。',
      cond: function (c) { return c.season === 3; } },
    { key: 'winter', pri: 60, tier: 1, title: '冬天',
      text: '风一吹就想快点回家。想到家里还有热的东西可以吃, 脚步就快了。',
      cond: function (c) { return c.season === 4; } },
    { key: 'detour', pri: 88, tier: 2, title: '绕了远路',
      text: '本来可以直着走的, 我还是拐进了那条小路。路上没有人, 只有风和一整片草。',
      cond: function (c) { return c.route && c.route.detour; } },
    { key: 'secret', pri: 92, tier: 2, title: '没写在纸上的地方',
      text: '有一处地方我不打算告诉别人, 只写在这里。那里安静得能听见自己的呼吸。',
      cond: function (c) { return c.route && c.route.secret; } },
    { key: 'long_trip', pri: 78, tier: 1, title: '走了很远',
      text: '这一趟走了很久, 久到我有点想家里的桌子。可是远处真的很好看。',
      cond: function (c) { return c.hours >= 10; } },
    { key: 'short_trip', pri: 50, tier: 1, title: '附近转转',
      text: '今天只是在家附近走了走, 却也发现了一条以前没走过的小路。',
      cond: function (c) { return c.hours > 0 && c.hours <= 2; } },
    { key: 'coastal', pri: 74, tier: 1, title: '海边',
      text: '海的声音比我想的大。浪退下去的时候, 沙滩上会留下一些小东西。',
      cond: function (c) { return c.flavor === 'coastal'; } },
    { key: 'jiangnan', pri: 74, tier: 1, title: '水乡',
      text: '这里到处都是水和小桥, 走着走着就到了河边。有人在河边洗东西。',
      cond: function (c) { return c.flavor === 'jiangnan'; } },
    { key: 'desert', pri: 74, tier: 1, title: '沙地',
      text: '风把沙子吹成一道一道的痕。太阳落下去的时候, 整片地都是金色的。',
      cond: function (c) { return c.flavor === 'desert'; } },
    { key: 'mountain', pri: 74, tier: 1, title: '山上',
      text: '爬了很久才到上面, 云就在旁边。往下看的时候我抓紧了背包。',
      cond: function (c) { return c.flavor === 'mountain'; } },
    { key: 'museum', pri: 86, tier: 2, title: '博物馆',
      text: '屋子里面摆着很久以前的东西。我看了很久, 觉得它们也在看我。',
      cond: function (c) { return c.flavor === 'museum'; } },
    { key: 'city', pri: 66, tier: 1, title: '城里',
      text: '这里人很多, 声音也很多。我贴着墙根走, 找到了一家很小很小的店。',
      cond: function (c) { return c.flavor === 'city'; } },
    { key: 'new_place', pri: 90, tier: 2, title: '新地方',
      text: '这个地方我从来没来过。什么都是新的, 连空气的味道都不一样。',
      cond: function (c) { return c.newPlace; } },
    { key: 'place5', pri: 70, tier: 1, title: '第五个地方',
      text: '数了数, 这已经是我去过的第五个地方了。每个地方都带走了一点点东西。',
      cond: function (c) { return c.places >= 5; } },
    { key: 'place10', pri: 72, tier: 2, title: '第十个地方',
      text: '第十个地方了。我把去过的地方在心里排了一遍, 发现它们连起来像一条路。',
      cond: function (c) { return c.places >= 10; } },
    { key: 'friend_note', pri: 76, tier: 1, title: '收到旅友的信',
      text: '有位旅友给我留了信。我们只看过对方一眼, 可是信里写得像老朋友。',
      cond: function (c) { return c.friendNotes > 0; } },
    { key: 'party', pri: 76, tier: 1, title: '去过聚会',
      text: '大家凑在一起吃了很多东西, 桌子从来没有那么热闹过。回家路上我还想笑。',
      cond: function (c) { return c.parties > 0; } },
    { key: 'visit', pri: 64, tier: 1, title: '有客来过',
      text: '院子里来过客人。我把最好的东西拿出来招待, 它走的时候留下了回礼。',
      cond: function (c) { return c.visits > 0; } },
    { key: 'craft', pri: 58, tier: 1, title: '做手工',
      text: '在屋里削了一下午木头。手上的味道很久都没有散。',
      cond: function (c) { return c.crafted; } },
    { key: 'clover', pri: 56, tier: 1, title: '三叶草',
      text: '院子里长满了三叶草。我蹲下来找了很久, 想找到一片四个叶子的。',
      cond: function (c) { return c.clover >= 100; } },
    { key: 'solar', pri: 86, tier: 2, title: '节气',
      text: '今天是节气。桌上摆着只有这几天才有的吃食, 吃完就该出门看看了。',
      cond: function (c) { return c.solar > 0; } },
    { key: 'festival', pri: 86, tier: 2, title: '过节',
      text: '外面在过节, 到处都挂着东西。我也跟着走了一圈, 口袋里装了些小玩意儿。',
      cond: function (c) { return c.festival; } },
    { key: 'title', pri: 68, tier: 1, title: '一个新的称呼',
      text: '大家开始用别的名字叫我了。名字变了, 我还是我, 只是走得比以前远一点。',
      cond: function (c) { return c.titles > 0; } },
    { key: 'rainbow', pri: 70, tier: 2, title: '雨停之后',
      text: '雨停的时候天上出现了一道颜色。我站着看了很久, 直到它淡下去。',
      cond: function (c) { return c.rainClear; } },
    { key: 'quiet', pri: 10, tier: 1, title: '平常的一天',
      text: '没什么特别的事。吃饭, 看书, 在窗边坐了一会儿。这样也挺好。',
      cond: function () { return true; } }
  ];

  /* ---------- 真实笔记页(Note_json type=1) ---------- */
  function noteRows() {
    try {
      var d = Tabikaeru.DataManager.instance(), db = d && d.TravelNoteDB;
      var list = db && (typeof db.list === 'function' ? db.list() : db);
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }
  function pages() {
    if (st.diaryPages && st.diaryPages._cache) return st.diaryPages._cache;
    var rows = noteRows(), out = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i]; if (!r) continue;
      if (num(r.type) !== 1) continue;                       /* 1 = 呱呱的日记页; 2 = 旅友笔记 */
      out.push({ id: num(r.id), quality: num(r.quality) || 1 });
    }
    if (!out.length) {                                       /* 没有表: 用纹理表兜底 */
      var ids = arr(window.MOCK_NOTE_IDS);
      for (var k = 0; k < ids.length; k++) if (num(ids[k]) >= 1000 && num(ids[k]) < 2000) out.push({ id: num(ids[k]), quality: 1 });
    }
    st.diaryPages = st.diaryPages || {};
    st.diaryPages._cache = out;
    return out;
  }
  function pageFor(tier) {
    var all = pages(), want = [], used = {}, i;
    var diary = arr(st.diary);
    for (i = 0; i < diary.length; i++) used[num(diary[i].note)] = 1;
    for (i = 0; i < st.notes.length; i++) used[num(st.notes[i].id)] = 1;
    for (i = 0; i < all.length; i++) if (all[i].quality === num(tier) && !used[all[i].id]) want.push(all[i].id);
    if (!want.length) for (i = 0; i < all.length; i++) if (!used[all[i].id]) want.push(all[i].id);
    if (!want.length) for (i = 0; i < all.length; i++) want.push(all[i].id);
    return pick(want) || 0;
  }

  /* ---------- 上下文: 这一趟/这一天是什么样 ---------- */
  function seasonNow() {
    try { var v = num(window.MOCK_ENV && window.MOCK_ENV.season); if (v) return v; } catch (e) {}
    var m = new Date().getMonth() + 1;
    return m <= 2 || m === 12 ? 4 : m <= 5 ? 1 : m <= 8 ? 2 : 3;   /* 1春 2夏 3秋 4冬 */
  }
  function weatherNow() {
    try { var w = num(window.MOCK_ENV && window.MOCK_ENV.weather); if (w) return w; } catch (e) {}
    return num(st.weather) || 1;
  }
  function solarNow() {
    try { if (window.MOCK_ENV && window.MOCK_ENV.solar !== undefined) return num(window.MOCK_ENV.solar); } catch (e) {}
    try { if (window.MOCK_STORIES && window.MOCK_STORIES.solar) return num(window.MOCK_STORIES.solar().term); } catch (e) {}
    return 0;
  }
  function festivalNow() {
    try { if (window.MOCK_ENV && window.MOCK_ENV.festival !== undefined) return !!window.MOCK_ENV.festival; } catch (e) {}
    try { if (window.MOCK_STORIES && window.MOCK_STORIES.festivals) return !!window.MOCK_STORIES.festivals().length; } catch (e) {}
    return false;
  }
  function ctx() {
    var route = st.tripRoute || null, place = num(route && route.place);
    var visited = st.placeVisited || {};
    var w = weatherNow();
    var friendNotes = 0, notes = arr(st.notes);
    for (var i = 0; i < notes.length; i++) if (num(notes[i].id) >= 2000 && num(notes[i].id) < 3000) friendNotes++;
    var titles = 0;
    try { titles = arr(st.achieveList || (st.clientSettings && st.clientSettings.achieveList)).length; } catch (e) {}
    var visits = 0;
    try { visits = arr(st.guestLog).length || num(st.visitCount); } catch (e) {}
    var parties = 0;
    try { parties = num(st.partyCount) || (st.party && num(st.party.done)) || 0; } catch (e) {}
    return {
      trips: num(st.travelCount), photos: arr(st.photos).length, places: Object.keys(visited).length,
      weather: w, rain: w === 3 || w === 4, storm: w === 4, snow: w === 8 || w === 9, rainClear: !!st.rainCleared,
      season: seasonNow(), hours: num(st.tripPlan && st.tripPlan.hours),
      route: route, flavor: (route && route.flavor) || '', newPlace: !!(place && num(visited[place]) === 1),
      friendNotes: friendNotes, titles: titles, visits: visits, parties: parties,
      crafted: num(st.furnitureMade) > 0 || !!st.craftingDone, clover: num(st.clover),
      solar: solarNow(), festival: festivalNow()
    };
  }
  function chooseText(c) {
    var best = null;
    for (var i = 0; i < TEXTS.length; i++) {
      var t = TEXTS[i];
      if (written(t.key)) continue;
      try { if (!t.cond(c)) continue; } catch (e) { continue; }
      if (!best || t.pri > best.pri) best = t;
    }
    return best;
  }
  function written(key) {
    var d = arr(st.diary);
    for (var i = 0; i < d.length; i++) if (String(d[i].key) === String(key)) return true;
    return false;
  }

  /* ---------- 写一篇 ---------- */
  function write(why) {
    st.diary = arr(st.diary);
    st.notes = arr(st.notes);
    var c = ctx(), t = chooseText(c);
    if (!t) { log('日记内容表的条目都写完了'); return null; }
    var pid = pageFor(t.tier);
    if (!pid) { log('没有可用的日记页(Note 表缺失)'); return null; }
    var note = { id: pid, read: 0, timestamp: nowSec() };
    st.notes.push(note);
    var rec = { key: t.key, title: t.title, text: t.text, note: pid, tier: t.tier, at: note.timestamp,
                place: num(c.route && c.route.place), placeName: (c.route && c.route.placeName) || '', why: String(why || '') };
    st.diary.push(rec);
    save();
    log('写完一篇《' + t.title + '》 -> 笔记页 ' + pid + ' (type=1, 品质' + t.tier + ')' + (why ? ' [' + why + ']' : ''));
    try { M.dispatch('travel_load_note', { note_list: st.notes.slice() }); } catch (e) {}
    return rec;
  }

  /* ---------- 居家"写日记": 18~40 分钟, 期间不可打断 ---------- */
  window.MOCK_LONGACTION = window.MOCK_LONGACTION || {};
  window.MOCK_LONGACTION[2] = {
    hold: function () { return Math.round((18 + Math.random() * 22) * 60); },
    done: function () { write('伏案写完'); }
  };

  /* 归来后: 歇一会儿就把这一趟写下来(不用等下一次伏案) */
  (function () {
    var last = num(st.frog && st.frog.status), lastTrips = num(st.travelCount);
    setInterval(function () {
      var s = num(st.frog && st.frog.status), trips = num(st.travelCount), back = false;
      if (trips > lastTrips) { lastTrips = trips; back = true; }      /* 旅行次数涨了 = 回来过 */
      if (s !== last) { if (last === 1 && s === 0) back = true; last = s; }
      if (back) setTimeout(function () { try { write('旅行归来'); } catch (e) {} }, 3000);
    }, 2500);
  })();
  /* 层装上时如果它正好在伏案: 把这次"写"也升级成长动作 */
  try {
    if (num(st.frog && st.frog.motion) === 2) {
      var h = num(window.MOCK_LONGACTION[2].hold());
      if (num(st.frog.motionHold) < h) { st.frog.motionHold = h; save(); log('正在伏案: 这次写的时长改为 ' + Math.round(h / 60) + ' 分钟'); }
    }
  } catch (e) {}

  window.MOCK_DIARY = {
    list: function () { return arr(st.diary).slice(); },
    texts: function () { return TEXTS.map(function (t) { return { key: t.key, title: t.title, tier: t.tier, pri: t.pri, written: written(t.key) }; }); },
    page: function (tier) { return pageFor(tier === undefined ? 1 : tier); },
    pages: function () { return pages().length; },
    ctx: ctx,
    write: write,
    pending: function () { var c = ctx(), out = []; for (var i = 0; i < TEXTS.length; i++) { try { if (!written(TEXTS[i].key) && TEXTS[i].cond(c)) out.push(TEXTS[i].key); } catch (e) {} } return out; },
    hold: function () { return num(window.MOCK_LONGACTION[2].hold()); },
    reset: function () { st.diary = []; save(); return 0; }
  };
  st.diary = arr(st.diary);
  log('日记表就绪: ' + TEXTS.length + ' 条文案 / 可用日记页 ' + pages().length + ' 张 / 已写 ' + st.diary.length + ' 篇' +
      ' (居家动作 2=写信写日记 现在 18~40 分钟不可打断)');
})();
