/* lxqw offline travel layer: 出发/回来 提示 + 状态同步 + 合理的旅行时长 - additive layer.
 *
 * Additive by design: rules.js keeps owning depart()/comeBack(); this layer only
 *   - watches st.frog.status transitions and emits the client's TimerEvent notices
 *     ("{0}出去旅行了" / "{0}回来了。")  -> TimerEvent.Type.GoTravel = 1, Return = 5
 *   - answers client_load_events and client_confirm_event
 *   - pushes client_load_role twice on a transition so the home scene re-runs
 *     MainInView.updateFlogStatus() (isHome = RoleModel.getFrogStatus() == 0)
 *   - gives every trip a realistic duration instead of a fixed 90s loop
 *   - stops food on the DESK from launching a trip (only 准备 does that)
 *
 * Client contract (verified in main.min.js):
 *   client_load_events -> travelEventList ; notify_new_event -> {event:{...}}
 *   event fields: id, evt_type, evt_value[], evt_id, evt_string[]
 *   client_confirm_event is sent when a notice is dismissed (travel event removed)
 *   readTraveEvents() removes the event locally + sends client_confirm_event
 */
(function () {
  var M = window.MockServer, st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  function log(m) { try { console.log("[MOCK] " + m); } catch (e) {} }
  function now() { return Math.floor(Date.now() / 1000); }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function num2(v) { var n = Number(v); return isFinite(n) ? n : -1; }
  function save() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
  function push(name, data, d) {
    setTimeout(function () { try { M.dispatch(name, (typeof data === 'function' ? data() : data)); } catch (e) {} }, d || 30);
  }
  function role() { try { return M.handle('client_load_role', {}); } catch (e) { return null; } }
  if (!Array.isArray(st.events)) st.events = [];
  st.nextEventId = st.nextEventId || 1;
  if (st.lastFrogStatus === undefined) st.lastFrogStatus = (st.frog && st.frog.status) || 0;

  /* ---- TimerEvent ids (client enum) ------------------------------------- */
  var EV = { GoTravel: 1, BackHome: 2, Picture: 3, Drift: 4, Return: 5, NewNote: 15 };
  function addEvent(type, value, extra) {
    var ev = { id: st.nextEventId++, evt_type: type, evt_value: value || [], evt_id: 0,
               evt_string: [], time: now() };
    if (extra && typeof extra === 'object') for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) ev[k] = extra[k];
    st.events.push(ev);
    if (st.events.length > 20) st.events = st.events.slice(-20);
    save();
    return ev;
  }
  S['client_load_events'] = function () { return st.events.slice(); };
  /* the client removes an event locally when its notice is dismissed and then tells us;
     the payload may not be mapped (no declared params) so drop the oldest one */
  /* other layers can raise TimerEvent notices through this */
  window.MOCK_EVENT = function (type, value, extra) {
    var ev = addEvent(type, value, extra);
    push('notify_new_event', { event: ev }, 60);
    return ev;
  };

  /* ---- 播报策略 (用户报"莫名其妙在弹获得家具的提示"/"一堆家具与青蛙活动的状态弹窗") ----
     客户端的 TimerEvent 播报是**模态**的(SE_Popup + 队列), 玩家正盯着游戏时被反复打断很烦;
     而原版里这类播报本来就是"你不在的时候发生了什么"的通知。
     策略(MOCK_NOTICE): 页面可见时不弹, 改成"挂起"(同一 tag 只留最新一条), 等页面重新可见
     (visibilitychange) 再一次性补播 —— 于是既不打断, 也不会丢信息。
     st.noticeMode: 'auto'(默认) | 'always'(总是弹, 原版行为) | 'never'(从不弹)
     GM: /gm notice always|auto|never  /gm flush                                         */
  var pending = [], PENDING_MAX = 4;
  function isHidden() {
    try { if (typeof document !== 'undefined' && typeof document.hidden === 'boolean') return document.hidden; } catch (e) {}
    return null;
  }
  window.MOCK_FLUSH_NOTICES = function () {
    var copy = pending.slice();
    pending = [];
    for (var i = 0; i < copy.length; i++) {
      try { window.MOCK_EVENT(copy[i].type, copy[i].value, copy[i].extra); } catch (e) {}
    }
    if (copy.length) log('补播挂起的播报 ' + copy.length + ' 条');
    return copy.length;
  };
  window.MOCK_NOTICE = function (type, value, extra, tag) {
    var mode = st.noticeMode || 'auto';
    if (mode === 'never') { log('播报关闭(never): type=' + type + (tag ? ' ' + tag : '')); return null; }
    var hid = isHidden();
    if (mode === 'always' || hid === true || hid === null) return window.MOCK_EVENT(type, value, extra);
    tag = tag || ('type' + type);
    for (var i = 0; i < pending.length; i++) if (pending[i].tag === tag) { pending[i] = { tag: tag, type: type, value: value, extra: extra }; log('播报挂起(页面可见, 覆盖旧条): ' + tag); return null; }
    if (pending.length >= PENDING_MAX) pending.shift();
    pending.push({ tag: tag, type: type, value: value, extra: extra });
    log('播报挂起(页面可见): ' + tag + ' type=' + type + ' (共 ' + pending.length + ' 条待补播)');
    return null;
  };
  try {
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', function () {
        if (isHidden() !== true) { try { window.MOCK_FLUSH_NOTICES(); } catch (e) {} }
      });
    }
  } catch (e) {}
  S['client_confirm_event'] = function () {
    if (st.events.length) { st.events.shift(); save(); }
    return {};
  };

  /* ---- trip duration ---------------------------------------------------- */
  /* 用户报「青蛙的旅行时间过于频繁」+ 原版行为:
       · 一般情况: 背包里备好食物和道具, 几小时内就会出门; 一天 1~3 次; 没东西就不出门
       · 单次 6~72 小时, 主要由**食物与道具**决定: 便宜食物(四叶草/华夫饼)1~2 小时就回,
         高级食物/帐篷之类会明显变长, 甚至在外面过夜
     所以时长不再固定随机, 而是按玩家真正装进行李的东西算(数据来自客户端自己的 Item 表):
         食物(type 0) 按 price 分档: <=20 → 1.5h, <=40 → 2.5h, <=60 → 6h, <=90 → 9h, 更高 → 14h
         道具(type 2, 竹筒/水壶/纸伞/围巾/睡垫…) 每件 +3h; 护身符(type 1) 每枚 +1.5h
         再乘 0.85~1.35 的抖动, 夹在 0.5~72 小时之间
     st.travelSeconds 仍是**显式覆盖**(GM settime/away 会写它) —— 有它就用它, 否则按行李算。 */
  function itemRow(id) {
    try { var db = Tabikaeru.DataManager.instance().ItemDB; return db && db.get ? db.get(Number(id)) : null; } catch (e) { return null; }
  }
  function luggage() {
    var out = [];
    var add = function (a) { if (Array.isArray(a)) for (var i = 0; i < a.length; i++) { var v = a[i]; if (v !== -1 && v !== null && v !== undefined) out.push(v); } };
    add(st.bag); add(st.desk);
    return out;
  }
  /* 天气×道具(用户给的交互表):
       · 雪天 + 辣葱饼(type0 id=16 彩椒烙蛋饼/4 香葱烤包子 视作"辣葱饼") -> 归期 -10%
       · 雨天 + 纸伞(2003/2004/2005) -> 走得更远(时长 +25%)
       · 暴雨 -> 有概率带回贝壳(见 rules.js comeBack)
     st.weather: 1晴 2阴 3小雨 4暴雨 8小雪 9大雪 */
  function weatherNow() {
    try { return Number((window.MOCK_ENV && window.MOCK_ENV.weather) || st.weather) || 1; } catch (e) { return Number(st.weather) || 1; }
  }
  function isSnow() { var w = weatherNow(); return w === 8 || w === 9; }
  function isRain() { var w = weatherNow(); return w === 3 || w === 4; }
  var SPICY_CAKE = [4, 16];              /* 香葱烤包子 / 彩椒烙蛋饼 = 辣葱饼这一路 */
  var UMBRELLA = [2003, 2004, 2005];     /* 朴素/自然/水墨纸伞 */
  function planTrip() {
    var items = luggage(), bestFood = 0, props = 0, amulets = 0, food = 0;
    for (var i = 0; i < items.length; i++) {
      var row = itemRow(items[i]); if (!row) continue;
      var t = Number(row.type);
      if (t === 0) { food++; var p = Number(row.price) || 0; if (p > bestFood) bestFood = p; }
      else if (t === 2) props++;
      else if (t === 1) amulets++;
    }
    var base = bestFood <= 20 ? 1.5 : bestFood <= 40 ? 2.5 : bestFood <= 60 ? 6 : bestFood <= 90 ? 9 : 14;
    var rawProps = props, rawAmulets = amulets;
    /* 没带吃的: 原版"连续几天不出门就是因为背包里没东西" —— 这里给最短的一趟(半小时上下),
       道具/护身符也不再叠加(没干粮走不远)。客户端本来也会拦"请准备便当"。 */
    if (!food) { base = 0.5; props = 0; amulets = 0; }
    /* 天气×道具: 先算有没有辣葱饼 / 纸伞 */
    var spicy = 0, umbrella = 0, ii;
    for (ii = 0; ii < items.length; ii++) {
      var iid = num2(items[ii]);
      if (SPICY_CAKE.indexOf(iid) >= 0) spicy = 1;
      if (UMBRELLA.indexOf(iid) >= 0) umbrella = 1;
    }
    st.tripWeather = weatherNow();
    st.tripWeatherFx = { spicy: spicy, umbrella: umbrella };
    var hours = (base + props * 3 + amulets * 1.5) * (0.85 + Math.random() * 0.5);
    if (spicy && isSnow()) { hours *= 0.9; log('天气效果: 雪天带辣葱饼 -> 归期 -10%'); }
    if (umbrella && isRain()) { hours *= 1.25; log('天气效果: 雨天带纸伞 -> 走得更远 (+25%)'); }
    /* 佩戴的称号会改旅行时间(new.txt: 称号影响旅行) */
    try {
      var sc = null;
      if (window.MOCK_TITLE && window.MOCK_TITLE.tripScaleJitter) sc = window.MOCK_TITLE.tripScaleJitter();
      if (sc === null && window.MOCK_TITLE && window.MOCK_TITLE.tripScale) sc = Number(window.MOCK_TITLE.tripScale()) || 1;
      if (sc && sc !== 1) { log('称号效果: 旅行时间 ×' + sc); hours *= sc; }
    } catch (e) {}
    hours = Math.max(0.5, Math.min(72, hours));
    var secs = Math.round(hours * 3600);
    st.tripSeconds = secs;
    st.tripPlan = { food: food, bestFood: bestFood, props: rawProps, amulets: rawAmulets, noFood: food ? 0 : 1,
                    hours: Number(hours.toFixed(2)), at: now() };
    log('行程计划: 食物' + food + '件(最高价' + bestFood + ') 道具' + props + ' 护身符' + amulets +
        ' -> ' + hours.toFixed(2) + ' 小时 (' + secs + 's)');
    return secs;
  }
  function pickDuration() {
    /* 每条分支都要把 st.tripSeconds 写成"这一趟"的时长: 以前只有按行李算那条会写,
       于是 GM 指定/区间随机的那些趟会留着上一趟的旧值(日志与 /gm dump 都会看错)。 */
    if (st.travelSeconds) { st.tripSeconds = Number(st.travelSeconds); return st.tripSeconds; }   /* GM/存档显式指定 */
    if (st.travelMin && st.travelMax) {                      /* 老存档里的随机区间仍然尊重 */
      var lo = Number(st.travelMin), hi = Number(st.travelMax);
      st.tripSeconds = lo + Math.floor(Math.random() * Math.max(1, hi - lo + 1));
      return st.tripSeconds;
    }
    return planTrip();
  }
  var origBag = S['item_set_bag_completed'];
  S['item_set_bag_completed'] = function (p) {
    var done = !!(p && p.completed);
    if (done && st.frog && !st.frog.traveling) {
      /* depart() 读的是 st.travelSeconds: 临时借这个字段把"这一趟"的时长传进去, 事后再还原,
         否则第一趟的时长会被永远黏住(以前就是这样)。 */
      var dur = pickDuration(), keep = st.travelSeconds;
      st.travelSeconds = dur;
      try { return origBag ? origBag(p) : {}; }
      finally { if (keep === undefined) { try { delete st.travelSeconds; } catch (e) { st.travelSeconds = undefined; } } else st.travelSeconds = keep; }
    }
    return origBag ? origBag(p) : {};
  };
  /* placing food on the desk is preparation, not departure: the client only leaves
     when 准备 is pressed (item_set_bag_completed).  rules.js departed here, which made
     the diary grow while the player was still arranging things. */
  var origDesk = S['item_putin_desk'];
  if (origDesk) S['item_putin_desk'] = function (p) {
    var was = st.frog ? st.frog.traveling : false;
    if (st.frog) st.frog.traveling = true;      /* suppress rules.js auto-depart */
    var r;
    try { r = origDesk(p); } finally { if (st.frog) st.frog.traveling = was; }
    return r;
  };

  /* ---- 旅途中寄回明信片(mid-trip) ---------------------------------------
     原版: "旅途中会随机给你寄回照片(明信片), 展示它的见闻和遇到的动物朋友"。
     以前只在回家那一刻给一张, 路上什么都没有。现在按行程进度在 35% / 70% 两个点各掷一次骰,
     抽一张明信片推进相册(album_load_new), 并调用 window.MOCK_POSTCARD_HOME()
     —— 「故事」系统正是挂在"寄回明信片"这个时机做条件匹配的(用户给的故事机制)。 */
  var postedAt = {};
  setInterval(function () {
    try {
      if (status() !== 1 || (st.frog && st.frog.party)) return;
      var started = num(st.tripStartedAt) || num(st.frog && st.frog.leaveAt) || 0;
      var ends = num(st.frog && st.frog.returnAt) || 0;
      if (!started || !ends || ends <= started) return;
      var pct = (Date.now() - started) / (ends - started);
      var marks = [0.35, 0.7], i;
      for (i = 0; i < marks.length; i++) {
        if (pct < marks[i] || postedAt[marks[i]]) continue;
        postedAt[marks[i]] = 1;
        if (window.MOCK_PICK_PHOTO && Math.random() < 0.8) {
          var pid = window.MOCK_PICK_PHOTO(st.lastTripItems || []);
          if (pid) {
            var photo = { id: num(st.nextPhoto) || ((st.photos || []).length + 1), pic_id: pid };
            st.nextPhoto = num(photo.id) + 1;
            st.photos = Array.isArray(st.photos) ? st.photos : [];
            st.photos.push(photo);
            save();
            push('album_load_new', { pictures: [photo], has_ads: false, is_share: false, visted_pic: [] }, 60);
            log('旅途中寄回明信片 ' + pid + ' (行程 ' + Math.round(pct * 100) + '%)');
          }
        }
        try { if (window.MOCK_POSTCARD_HOME) window.MOCK_POSTCARD_HOME(); } catch (e) {}
      }
    } catch (e) {}
  }, 60000);
  /* 出发/回家时维护起点时间与"已寄"标记 */
  (function () {
    var l2 = status();
    setInterval(function () {
      var s = status();
      if (s === 1 && l2 !== 1) { st.tripStartedAt = Date.now(); postedAt = {}; save(); }
      if (s === 0 && l2 === 1) postedAt = {};
      l2 = s;
    }, 5000);
  })();

  /* ---- 补发提示(用户: "青蛙旅游了不会有提示") ----------------------------------
     WebView 在后台时定时器被冻结 -> 6 分钟这种短途旅行可能"出门+回家"全过程都发生在后台,
     status 的 0->1/1->0 跳变两边都没人看见, 于是**一条提示都没有**。
     这里额外盯 st.travelCount(归来才 +1): 一发现增加就补一条"归来"提示; 若此刻它还在外面, 再补一条"出门"提示。
     (登录/切前台后立刻跑一次, 之后每 20 秒看一次) */
  (function () {
    var lastTrips = num(st.travelCount), lastStatus2 = status();
    function catchUp(why) {
      try {
        var trips = num(st.travelCount), s = status();
        if (trips > lastTrips) {
          lastTrips = trips;
          addEvent(EV.Return, [0]);
          var ev = st.events[st.events.length - 1];
          push('notify_new_event', { event: ev }, 80);
          log('补发提示: ' + (st.name || '小蛙') + '回来了 (第 ' + trips + ' 次旅行, ' + (why || '') + ')');
        }
        if (s === 1 && lastStatus2 !== 1 && !(st.frog && st.frog.party)) {
          addEvent(EV.GoTravel, [0, 1]);
          var ev2 = st.events[st.events.length - 1];
          push('notify_new_event', { event: ev2 }, 80);
          log('补发提示: ' + (st.name || '小蛙') + '出去旅行了 (status 1, ' + (why || '') + ')');
        }
        lastStatus2 = s;
      } catch (e) {}
    }
    setInterval(function () { catchUp('轮询'); }, 20000);
    setTimeout(function () { catchUp('启动'); }, 2500);
    window.MOCK_TRAVEL_CATCHUP = catchUp;
  })();

  /* ---- transition watcher ---------------------------------------------- */
  function isHome() {
    try { return Tabikaeru.Game.instance().isHome ? 1 : 0; } catch (e) { return -1; }
  }
  function status() { return (st.frog && st.frog.status) | 0; }
  function motion() { return (st.frog && st.frog.motion) | 0; }
  var last = status();
  setInterval(function () {
    var s = status();
    if (s === last) return;
    var name = (st.name || '小蛙');
    /* 聚会也走 status 0->1(party.js 自己发 PartyGo/PartyResult), 所以这里不要重复发旅行播报 */
    if (st.frog && st.frog.party) {
      push('client_load_role', role, 40);
      try { if (window.MOCK_REFRESH_ROOM) window.MOCK_REFRESH_ROOM('聚会'); } catch (e) {}
      log('状态同步: 聚会 ' + last + ' -> ' + s);
      last = s; st.lastFrogStatus = s; save();
      return;
    }
    if (s === 1) {
      addEvent(EV.GoTravel, [0, 1]);
      var ev = st.events[st.events.length - 1];
      push('notify_new_event', { event: ev }, 60);
      log('提示: ' + name + '出去旅行了 (status 1, 预计 ' + Math.round(((st.frog.returnAt || 0) - Date.now()) / 1000) + 's 后回来)');
    } else if (s === 0) {
      addEvent(EV.Return, [0]);
      var ev2 = st.events[st.events.length - 1];
      push('notify_new_event', { event: ev2 }, 60);
      log('提示: ' + name + '回来了。');
      if (window.MOCK_STORY_ROLL) { try { window.MOCK_STORY_ROLL(); } catch (e) {} }
    }
    /* the home scene only re-reads the frog on RoleEventType.loadRole */
    push('client_load_role', role, 40);
    push('client_load_role', role, 1500);
    /* 但 MainInController **没有**监听 loadRole(见 new/roompatch.js): 小屋里必须直接把
       updateFlogStatus() 调到视图上, 否则玩家要出门再进屋才看得到青蛙走了/回来了。 */
    try { if (window.MOCK_REFRESH_ROOM) { window.MOCK_REFRESH_ROOM(s === 1 ? '出发' : '回家'); } } catch (e) {}
    setTimeout(function () { try { if (window.MOCK_REFRESH_ROOM) window.MOCK_REFRESH_ROOM('延迟补刷'); } catch (e) {} }, 700);
    log('状态同步: status ' + last + ' -> ' + s + ' motion=' + motion() + ' isHome=' + isHome() +
        (s === 1 ? ' 这一趟 ' + Math.round(Number(st.tripSeconds || 0) / 60) + ' 分钟' : ''));
    last = s; st.lastFrogStatus = s; save();
  }, 1000);

  /* ---- probe: what does the home scene decide? -------------------------- */
  (function () {
    var V = (window.Tabikaeru && Tabikaeru.MainInView) ? Tabikaeru.MainInView : null;
    if (V && V.prototype && V.prototype.updateFlogStatus && !V.prototype.__mockTraced) {
      var orig = V.prototype.updateFlogStatus;
      V.prototype.updateFlogStatus = function () {
        var r = orig.apply(this, arguments);
        try {
          log('[PROBE] updateFlogStatus isHome=' + isHome() + ' status=' + status() +
              ' motion=' + motion() + ' player=' + (this.player ? 'yes' : 'no') +
              ' frogCap=' + (this.frogCap ? (this.frogCap.visible ? 'vis' : 'hid') : 'none'));
        } catch (e) {}
        return r;
      };
      V.prototype.__mockTraced = true;
      log('probe: MainInView.updateFlogStatus wrapped');
    }
  })();

  /* ---- note textures ---------------------------------------------------- */
  if (window.MOCK_PIC && window.MOCK_PIC.preloadNote) {
    var pre = window.MOCK_PIC.preloadNote;
    setInterval(function () {
      var a = Array.isArray(st.notes) ? st.notes : [];
      for (var i = 0; i < a.length; i++) pre(a[i].id);
    }, 20000);
  }
  log('travel ready: events ' + st.events.length + ', 时长=按行李算(0.5~72小时, 便宜食物1~2小时), ' +
      '显式覆盖 st.travelSeconds=' + (st.travelSeconds || '无'));
})();