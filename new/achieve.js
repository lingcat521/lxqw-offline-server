/* lxqw 称号(成就) — additive layer.
 *
 * 用户报：「称号…没有做」。契约(notes/research_task_achieve_ency_story.md §2):
 *   client_load_role.frog = { achieves:[id...]（必须真数组）, achieves_time:[{id,time}]（time 是**到期**时间,
 *                            不发=永久）, cur_achieve }
 *   AchieveDB 101 行(id 0..902, 3 条 is_special="通过道具解锁")；AchieveDB.get(id).name/description/info
 *   client_set_achieve{id} 只有 AttributeView 保存属性时发一次, 不需要回包, 但必须落库,
 *   否则下次 client_load_role 回旧值(称号存不住/界面一直 ??????)。
 *   客户端只信 client_load_role -> 新达成要 push 它(AttributeView/MainInView 会弹"首次获得称号")。
 *
 * 判定: 条件全在表的 `info` 文本里(例如"旅行达到10次"/"获得5种纪念品"/"双皮奶超过10个"),
 * 所以这里做**文本解析 + 存档状态判定**。is_special(道具解锁)不自动发。
 *
 * 用户报「这样的弹窗太多了，需要一直点」—— 客户端 checkNewAchieve() 每调用一次只弹**一个**
 * ModalAlert("恭喜获得称号：…"), 点掉之后回调里再调一次 while 还有新 id; 于是"一次追认 N 个称号"
 * 就是 N 连点。而且它把弹过的 id 记进 clientSettings.achieveList(只弹一次)。
 * 所以这里的策略:
 *   · 老存档第一次追认(backlog): 全部静默入账 —— 同时把这些 id 预先写进 clientSettings.achieveList,
 *     客户端就认为"弹过了" -> 一个弹窗都不出(称号照样在属性/称号界面里);
 *   · 之后玩出来的新称号: 进队列, 每 GRANT_GAP(默认 300 秒)最多放行一个 -> 一次一个, 不连点;
 *   · GM: /gm achieve now|silent|gap 40|list。
 */
(function () {
  var M = window.MockServer, st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  function log(m) { try { console.log('[MOCK] 称号: ' + m); } catch (e) {} }
  function save() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function arr(v) { return Array.isArray(v) ? v : []; }

  function achieveRows() {
    try {
      var dm = Tabikaeru.DataManager.instance(), db = dm && (dm.AchieveDB || dm.achieveDB);
      if (db && typeof db.list === 'function') { var l = db.list(); if (l && l.length) return l; }
      if (db && typeof db.get === 'function') { var o = []; for (var i = 0; i <= 902; i++) { var r = db.get(i); if (r) o.push(r); } return o; }
    } catch (e) {}
    return null;
  }
  function itemList() {
    try { var db = Tabikaeru.DataManager.instance().ItemDB; return (db && db.list) ? (db.list() || []) : []; } catch (e) { return []; }
  }
  function houseCount(id) {
    var h = arr(st.house), n = 0;
    for (var i = 0; i < h.length; i++) if (h[i] && num(h[i].item_id) === num(id)) n += num(h[i].count);
    return n;
  }
  function counts() {
    var trip = arr(st.tripLog);
    var juice = 0, best = 0;
    for (var i = 0; i < trip.length; i++) {
      var items = arr(trip[i] && trip[i].items), has = 0;
      for (var j = 0; j < items.length; j++) { var id = num(items[j]); if (id >= 11 && id <= 14) has = 1; }
      juice = has ? juice + 1 : 0;
      if (juice > best) best = juice;
    }
    var spec = {}, kinds = 0;
    var sp = arr(st.specialtys);
    for (var k = 0; k < sp.length; k++) { var sid = num(sp[k] && (sp[k].itemId !== undefined ? sp[k].itemId : sp[k].id)); if (sid && !spec[sid]) { spec[sid] = 1; kinds++; } }
    return {
      travel: num(st.travelCount), collections: arr(st.collections).length, specialtyKinds: kinds,
      clover: num(st.clover), gacha: arr(st.gacha).length,
      days: Math.max(1, Math.floor((Date.now() / 1000 - num(st.createdAt || (Date.now() / 1000))) / 86400) + num(st.loginDays || 0) + 1),
      juiceStreak: best, allSpecialty: false
    };
  }
  function itemIdByName(name) {
    name = String(name || '').trim();
    if (!name) return 0;
    var l = itemList();
    for (var i = 0; i < l.length; i++) if (l[i] && String(l[i].name) === name) return num(l[i].id);
    return 0;
  }
  function flags() {
    if (!st.achieveFlags || typeof st.achieveFlags !== 'object') st.achieveFlags = {};
    return st.achieveFlags;
  }
  function condMet(info, c, row) {
    var m;
    if ((m = /旅行达到(\d+)次/.exec(info))) return c.travel >= num(m[1]);
    if ((m = /获得(\d+)种纪念品/.exec(info))) return c.collections >= num(m[1]);
    if ((m = /获得(\d+)种特产/.exec(info))) return c.specialtyKinds >= num(m[1]);
    if (/获得所有特产食材/.test(info)) return c.allSpecialty;
    if ((m = /拥有超过(\d+)万棵三叶草/.exec(info))) return c.clover >= num(m[1]) * 10000;
    if ((m = /抽奖(\d+)次以上/.exec(info))) return c.gacha >= num(m[1]);
    if ((m = /登录达到(\d+)天/.exec(info))) return c.days >= num(m[1]);
    if ((m = /^(.+?)超过(\d+)个$/.exec(info))) { var iid = itemIdByName(m[1]); return iid > 0 && houseCount(iid) >= num(m[2]); }
    if (/出发不到30分钟就回家/.test(info)) return !!flags().shortTrip;
    if (/出发超过24小时还没回家/.test(info)) return !!flags().longTrip;
    if (/连续4次带/.test(info) && /果汁/.test(info)) return c.juiceStreak >= 4;
    return false;
  }
  function owns(id) { return arr(st.achieves).indexOf(num(id)) >= 0; }
  function grant(id, why) {
    id = num(id);
    if (!id || owns(id)) return false;
    st.achieves = arr(st.achieves); st.achieves.push(id);
    st.achieveTime = (st.achieveTime && typeof st.achieveTime === 'object') ? st.achieveTime : {};
    st.achieveTime[id] = 0;                       /* 0 = 永久(客户端 isAchieveExpire 判断 falsy) */
    st.achieveQueue = arr(st.achieveQueue);
    if (st.achieveQueue.indexOf(id) < 0) st.achieveQueue.push(id);
    save();
    log('达成称号 ' + id + (why ? ' (' + why + ')' : '') + ' 共 ' + st.achieves.length + ' 个, 待播报 ' + st.achieveQueue.length + ' 个');
    return true;
  }
  /* 把 id 记进"客户端已弹过"的列表 -> 客户端 checkNewAchieve 不再弹它 */
  function markSeen(ids) {
    if (!ids || !ids.length) return 0;
    st.clientSettings = (st.clientSettings && typeof st.clientSettings === 'object') ? st.clientSettings : {};
    var list = Array.isArray(st.clientSettings.achieveList) ? st.clientSettings.achieveList.slice() : [];
    var n = 0;
    for (var i = 0; i < ids.length; i++) { var id = num(ids[i]); if (id && list.indexOf(id) < 0) { list.push(id); n++; } }
    st.clientSettings.achieveList = list;
    save();
    return n;
  }
  var lastPublish = 0;
  function gapMs() { return Math.max(0, num(st.achieveGap === undefined ? 300 : st.achieveGap)) * 1000; }
  /* 放行一条待播报称号(force=true 时忽略间隔, 用于 GM/测试) */
  function publish(force) {
    var q = arr(st.achieveQueue);
    if (!q.length) return 0;
    var now = Date.now();
    if (!force && now - lastPublish < gapMs()) return 0;
    var id = num(q.shift());
    st.achieveQueue = q;
    lastPublish = now;
    save();
    try { M.dispatch('client_load_role', S['client_load_role'] ? S['client_load_role']() : null); } catch (e) {}
    log('播报称号 ' + id + ' (还剩 ' + q.length + ' 个待播报, 间隔 ' + (gapMs() / 1000) + 's)');
    return 1;
  }
  function evaluate(why) {
    var rows = achieveRows();
    if (!rows || !rows.length) return 0;
    var c = counts(), got = 0, uneval = 0;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i]; if (!r) continue;
      var id = num(r.id);
      if (owns(id)) continue;
      if (r.is_special) continue;                 /* 3 条"通过道具解锁"不自动发 */
      var info = String(r.info || '');
      if (condMet(info, c, r)) { if (grant(id, info)) got++; }
      else if (!/默认/.test(info)) uneval++;
    }
    if (got) {
      /* 老存档第一次追认: 全部静默(直接标记成客户端"已弹过"), 否则一进游戏就是 N 连点 */
      if (!st.achieveBacklogDone) {
        /* 关键: 把**全部已拥有**的 id 都标记成"客户端已提示", 不只是这一轮新追认的 ——
           客户端 checkNewAchieve 是 `achieves.length > achieveList.length` 就弹, 弹一个
           push 一个 id 再递归弹下一个; 老存档里已经积压了一堆"没弹过"的, 只标记本轮新增
           的话用户还得再连点十几次。 */
        var seenAll = markSeen(arr(st.achieves));
        var seenNew = markSeen(arr(st.achieveQueue));
        st.achieveQueue = [];
        st.achieveBacklogDone = 1;
        save();
        log('首次追认: 新达成 ' + got + ' 个, 静默标记 ' + seenAll + ' 个已拥有称号为"已提示"(不再连点弹窗; 其中本轮 ' + seenNew + ' 个)');
      } else {
        log('本轮新达成 ' + got + ' 个 [' + (why || '') + '], 未判定 ' + uneval + ' 条, 待播报 ' + arr(st.achieveQueue).length + ' 个');
      }
    } else if (st.achieveBacklogDone === undefined) {
      /* 没有可追认的(新档) 或者老存档里积压的都弹过了: 也把已有的一次性标记掉, 之后新的正常弹 */
      var seen0 = markSeen(arr(st.achieves));
      st.achieveQueue = [];
      st.achieveBacklogDone = 1;
      save();
      log('称号初始化: 已有 ' + arr(st.achieves).length + ' 个(标记 ' + seen0 + ' 个为已提示), 之后新达成每 ' + (gapMs() / 1000) + ' 秒最多弹一个');
    }
    return got;
  }
  /* 客户端回传 settings(client_set_client) 时, achieveList 只增不减:
     客户端只把自己"弹过"的 id 写回去, 一旦覆盖掉我们预置的完整列表, checkNewAchieve 会认为
     剩下的都没弹过 -> 又是一串连点弹窗。 */
  (function () {
    var prev = S['client_set_client'];
    S['client_set_client'] = function (p) {
      var keep = (st.clientSettings && Array.isArray(st.clientSettings.achieveList)) ? st.clientSettings.achieveList.slice() : [];
      var r = prev ? prev.apply(this, arguments) : {};
      try {
        if (!st.clientSettings || typeof st.clientSettings !== 'object') st.clientSettings = {};
        var cur = Array.isArray(st.clientSettings.achieveList) ? st.clientSettings.achieveList.slice() : [];
        for (var i = 0; i < keep.length; i++) if (cur.indexOf(keep[i]) < 0) cur.push(keep[i]);
        st.clientSettings.achieveList = cur;
      } catch (e) {}
      return r;
    };
  })();

  /* 手动选称号 */
  S['client_set_achieve'] = function (p) {
    var id = num(p && (p.id !== undefined ? p.id : p.achieve_id));
    if (!owns(id) && id !== 0) { log('选择称号 ' + id + ' 被拒(还没有这个称号)'); return { code: 1 }; }
    st.achieveId = id; save(); log('当前称号 -> ' + id);
    return { code: 0 };
  };

  /* ---- 佩戴称号的效果(new.txt:「佩戴不同称号会影响后续旅行的照片内容和带回的物品」)
     中国版的称号表(101 行)条件文案与日版那 11 个不同, 所以按**条件文案**归到几类效果:
       · 「出发超过24小时还没回家」/「旅行达到50|100次」 -> 旅行时间 ×1.35(不归的旅途/无止境的冒险家)
       · 「出发不到30分钟就回家」                        -> 旅行时间 ×0.6 (随心所欲的旅行者)
       · 「拥有超过10万棵三叶草」                        -> 带回三叶草 ×1.5(青蛙之叶)
       · 含「超过10个」的物品类称号                      -> 照片更容易出现道具(漂泊旅人)
     取不到当前佩戴的称号就一律按 1 倍/无偏向处理。 */
  function curInfo() {
    var id = num(st.achieveId);
    if (!id) return '';
    var rows = achieveRows() || [];
    for (var i = 0; i < rows.length; i++) if (num(rows[i].id) === id) return String(rows[i].info || '');
    return '';
  }
  window.MOCK_TITLE = {
    current: function () { return { id: num(st.achieveId), info: curInfo() }; },
    tripScale: function () {
      var i = curInfo();
      if (/超过24小时/.test(i) || /旅行达到(50|100)次/.test(i)) return 1.35;
      if (/不到30分钟/.test(i)) return 0.6;
      return 1;
    },
    cloverScale: function () { return /三叶草/.test(curInfo()) ? 1.5 : 1; },
    photoBias: function () {
      var i = curInfo();
      if (/超过10个/.test(i)) return 'props';                 /* 漂泊的旅人: 照片里更容易出现道具 */
      if (/旅行达到(10|25)次/.test(i)) return 'scenery';       /* 独自旅行: 少拍其他动物, 多拍风景 */
      if (/出发不到30分钟/.test(i)) return 'scenery';          /* 散步好天气: 树/海边/海边公路 */
      return null;
    },
    /* 称号完整效果表(目标②)之三: 带回的东西 —— 特产类称号多带一份, 纪念品类称号更容易多带一件 */
    giftScale: function () {
      var i = curInfo();
      if (/获得(20|30|40)种特产/.test(i)) return 2;            /* 走到哪吃到哪 / 每逢出门胖三斤 / 吃货的自我修养 */
      if (/获得(10|15|20)种纪念品/.test(i)) return 1.6;         /* 旅行就是买买买 / 礼物堆成山 / 没钱也要任性 */
      if (/获得5种纪念品/.test(i)) return 1.25;                 /* 随手捎些小玩意 */
      return 1;
    },
    /* 之四: 稀有度 —— 鉴赏名家/走遍全国/抽奖运 这些称号让稀有明信片与珍品更容易出现 */
    rareScale: function () {
      var i = curInfo();
      if (/获得所有特产食材/.test(i)) return 1.5;               /* 鉴赏名家: 眼光好 */
      if (/全国所有城市都有照片/.test(i)) return 1.35;           /* 天涯海角走出腹肌 */
      if (/抽奖20次/.test(i)) return 1.2;                        /* 天灵灵地灵灵 */
      if (/旅行达到(50|100)次/.test(i)) return 1.15;             /* 冒险大王 / 浪迹天涯 */
      return 1;
    },
    /* 完整效果表一览(测试/GM 用) */
    effects: function () {
      var i = curInfo();
      return { id: num(st.achieveId), info: i, trip: this.tripScale(), clover: this.cloverScale(),
               photo: this.photoBias(), gift: this.giftScale(), rare: this.rareScale(),
               jitter: !!this.tripScaleJitter() };
    },
    /* 随心所欲的旅行者: 很短或很长的旅行几率变高(在 0.6 与 1.35 之间随机二选一) */
    tripScaleJitter: function () {
      var i = curInfo();
      if (/出发不到30分钟/.test(i)) return Math.random() < 0.5 ? 0.6 : 1.35;
      return null;
    }
  };

  /* 旅行时长成就的两个标记: 由 travel2.js 在出发/回家时打点 */
  window.MOCK_ACHIEVE = {
    evaluate: evaluate,
    publish: publish,
    markSeen: markSeen,
    pending: function () { return arr(st.achieveQueue).slice(); },
    rows: achieveRows,
    counts: counts,
    flags: flags,
    grant: function (id, why) { var r = grant(id, why); if (r) evaluate('手动'); return r; },
    state: function () { return { owns: arr(st.achieves).slice(), cur: num(st.achieveId), flags: flags() }; }
  };

  setInterval(function () { try { evaluate('定时'); } catch (e) {} }, 10000);
  setInterval(function () { try { publish(false); } catch (e) {} }, 20000);
  setTimeout(function () { try { evaluate('启动'); } catch (e) {} }, 3000);
  log('称号层就绪: 表 ' + (achieveRows() || []).length + ' 行, 已有 ' + arr(st.achieves).length + ' 个');
})();
