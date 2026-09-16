/* lxqw 任务 / 计划（「伴蛙前行」里的 日/周/半月/月/季/年 计划 + 任务列表）—— additive layer.
 *
 * 用户报：「伴蛙前行里面的任务（日任务，周任务，月任务，季任务，年任务）也做不了，无法增加进度与获取奖励」。
 *
 * 客户端契约（逐字核对 main.min.js，详见 notes/research_task_achieve_ency_story.md §1）：
 *   GuideTaskModel.addProtocolCallback("task_load","task_load_list")
 *   task_load(e):  this.data    = e.tasks   // [{id,pro,is_reward}]  id ∈ TaskDB["task_list"] 的 30 个键
 *                  this.dataList[id] = pro  // e.list  [{id,pro}]     id ∈ TaskDB["list_map"] 的 67 个键
 *   task_load_list(e): this.dataReward[id] = pro   // e.reward [{id:节奏1..6, pro:已领档位数}]
 *   领奖: task_get_reward{id} -> 必须回 {code:0}（客户端把 is_reward 置 1 并播动画, 但
 *         ItemModel.addHouseItem 是**空函数** —— 真到账必须靠我们 push item_load_items/clover_update）
 *         task_get_list_reward{id = 100*节奏 + (已领+1)} -> 必须回 {code:0}
 *
 * 硬约束（违反就崩/白屏，全部有源码证据）：
 *   · tasks[].id 必须是 task_list 的键, 否则详情页空白;
 *   · list[].id 必须是 list_map 的键 —— updateRedot → getCompleteListNum 里 `t[n].type`
 *     对非法 id 直接抛异常, 任务窗整块打不开;
 *   · list 必须含 101/201/301/401/501/601, 否则 6 个页签不出现（客户端的页签显隐条件）;
 *   · list_type[*].reward 的 item id 必须都在 Item 表里（GuideTaskListPageItem.updateReward 无保护取 .img）。
 *
 * 进度谁算：**100% 服务端**（客户端零计数器, 唯一上报 task_client_pro 只有 "Map"/"NoteFriend" 两个字符串）。
 *   本层的做法是"从存档状态推导 + 少量水印", 不再去挂几十个协议:
 *     · 累计指标(单调不减) = max(当前状态量, 历史值): 旅行次数/照片/笔记/旅友笔记/故事/特产/纪念品/
 *       三叶草峰值/抽奖券峰值/购买次数/祈愿物/印章/家具/聚会/贺卡/投喂/装饰/日历奖励…
 *     · 计划(日/周/半月/月/季/年) = 各节奏窗口内该指标的增量（窗口开启时记一次基线）。
 *   指标的映射用**关键词**从 list_map 的 title+desc 里推（见 KW 表）, 所以客户端表怎么改都能跟上。
 *
 * 时间窗（客户端完全不管, 服务端定义）：日=当日; 周=周一 0 点; 半月=1/16 号; 月=自然月; 季=3/6/9/12 月 1 日; 年=1 月 1 日。
 */
(function () {
  var M = window.MockServer, st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  function log(m) { try { console.log('[MOCK] 任务: ' + m); } catch (e) {} }
  function save() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
  function nowSec() { return Math.floor(Date.now() / 1000); }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function push(name, data, d) {
    setTimeout(function () {
      try {
        var payload = (data === undefined || data === null) ? (typeof S[name] === 'function' ? S[name]() : S[name])
                                                            : (typeof data === 'function' ? data() : data);
        M.dispatch(name, payload);
      } catch (e) {}
    }, d || 40);
  }
  function tbl(name) {
    try { var dm = Tabikaeru.DataManager.instance(); var db = dm && (dm.TaskDB || dm.taskDB); return db && db.get ? db.get(name) : null; }
    catch (e) { return null; }
  }
  var FALLBACK_TASKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 101, 102, 103, 104, 105, 201, 202, 203, 204, 205, 301, 302, 303, 304, 401, 402, 403, 901, 902, 903, 904];
  function tableKeys(name, fallback) {
    var t = tbl(name), o = [];
    if (t) { for (var k in t) { var n = Number(k); if (isFinite(n) && t[k]) o.push(n); } }
    if (!o.length) o = (fallback || []).slice();
    o.sort(function (a, b) { return a - b; });
    return o;
  }
  function taskCfg(id) { var t = tbl('task_list'); return (t && t[String(id)]) || null; }
  function listCfg(id) { var t = tbl('list_map'); return (t && t[String(id)]) || null; }
  function listType(c) { var t = tbl('list_type'); return (t && t[String(c)]) || null; }

  /* ---- 周期窗口 -------------------------------------------------------- */
  function weekStart(sec) {
    var d = new Date(sec * 1000), back = (d.getDay() + 6) % 7;
    return Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate() - back, 0, 0, 0, 0).getTime() / 1000);
  }
  function windowKey(c, sec) {
    var d = new Date(sec * 1000), y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
    switch (Number(c)) {
      case 1: return 'd' + y + '.' + m + '.' + day;
      case 2: return 'w' + weekStart(sec);
      case 3: return 'h' + y + '.' + m + '.' + (day <= 15 ? 1 : 2);
      case 4: return 'm' + y + '.' + m;
      case 5: return 'q' + y + '.' + Math.floor(m / 3);
      case 6: return 'y' + y;
    }
    return 'x';
  }

  /* ---- 状态 ------------------------------------------------------------ */
  function ts() {
    var t = st.tasks;
    if (!t || typeof t !== 'object') t = st.tasks = {};
    if (!t.m || typeof t.m !== 'object') t.m = {};        /* 累计指标 */
    if (!t.r || typeof t.r !== 'object') t.r = {};        /* 任务已领奖 */
    if (!t.lr || typeof t.lr !== 'object') t.lr = {};     /* 计划已领档位数 */
    if (!t.win || typeof t.win !== 'object') t.win = {};  /* 各节奏窗口 */
    if (!t.w || typeof t.w !== 'object') t.w = {};        /* 水印(一次性事件) */
    if (!t.l || typeof t.l !== 'object') t.l = {};        /* 计划进度快照(推送用) */
    return t;
  }
  function peak(key) {
    var t = ts(), v = num(st[key]);
    if (v > num(t.m['peak_' + key])) t.m['peak_' + key] = v;
    return num(t.m['peak_' + key]);
  }
  function houseCount(id) {
    var h = arr(st.house), n = 0;
    for (var i = 0; i < h.length; i++) if (h[i] && Number(h[i].item_id) === Number(id)) n += num(h[i].count);
    return n;
  }
  function noteCount(lo, hi) {
    var a = arr(st.notes), n = 0;
    for (var i = 0; i < a.length; i++) { var id = num(a[i] && a[i].id); if (id >= lo && id < hi) n++; }
    return n;
  }
  function greetCount() {
    var g = st.greet;
    if (!g || typeof g !== 'object') return 0;
    var n = arr(g.items).length + arr(g.sendList).length + arr(g.getList).length;
    return n;
  }

  /* ---- 指标: 从状态推导(单调不减) -------------------------------------- */
  var METRICS = ['travel', 'photo', 'note', 'friendNote', 'story', 'specialty', 'collection', 'clover', 'ticket',
                 'buy', 'giftCode', 'map', 'wish', 'stamp', 'box', 'mat', 'furniture', 'party', 'greet', 'feed',
                 'visitor', 'decorate', 'calendar', 'expand', 'book', 'flower', 'share', 'gacha'];
  var METRIC_NAME = {
    travel: '旅行次数', photo: '明信片', note: '旅行笔记', friendNote: '旅友笔记', story: '故事',
    specialty: '特产', collection: '纪念品', clover: '三叶草', ticket: '抽奖券', buy: '商店购买',
    giftCode: '兑换码', map: '地图', wish: '祈愿物', stamp: '印章', box: '祈愿盒', mat: '手工材料',
    furniture: '家具', party: '聚会', greet: '贺卡', feed: '投喂邻居', visitor: '旅友来访',
    decorate: '小屋装饰', calendar: '日历奖励', expand: '相册扩容', book: '友情绘本', flower: '花盆',
    share: '分享', gacha: '商店抽奖'
  };
  function measure() {
    var craft = (st.craft && typeof st.craft === 'object') ? st.craft : {};
    var fur = (st.furniture && typeof st.furniture === 'object') ? st.furniture : {};
    var out = {
      travel: num(st.travelCount),
      photo: arr(st.photos).length,
      note: arr(st.notes).length,
      friendNote: noteCount(2000, 3000),
      story: arr(st.stories).length,
      specialty: num(st.specialtyTotal) || arr(st.gifts).length,
      collection: arr(st.collections).length,
      clover: peak('clover'),
      ticket: peak('ticket'),
      buy: num(st.buyCount),
      share: num(st.shareCount),
      gacha: arr(st.gacha).length,
      wish: arr(craft.wishes).length,
      stamp: arr(craft.stamps).length,
      furniture: arr(fur.has_fur).length,
      party: arr(st.partyLog).length,
      greet: greetCount(),
      feed: arr(st.guestFeedLog).length,
      visitor: num(st.visitorCount),
      decorate: arr(st.decorations).length + (num(st.decoratePutId) > 0 ? 1 : 0),
      calendar: Object.keys(st.calClaimed || {}).length
    };
    var t = ts();
    /* 水印: 只发生过一次的事件(mat/book/expand/giftCode/map/flower/box) 达到 1 就不再变 */
    var WM = ['mat', 'book', 'expand', 'giftCode', 'map', 'flower', 'box'];
    for (var i = 0; i < WM.length; i++) out[WM[i]] = num(t.w[WM[i]]);
    return out;
  }
  function scan() {
    var t = ts(), cur = measure(), ch = 0;
    for (var k in cur) {
      if (cur[k] > num(t.m[k])) { t.m[k] = cur[k]; ch++; }
    }
    /* 窗口: 开了新窗口就把当前累计值记成基线 */
    var now = nowSec(), wch = 0;
    for (var c = 1; c <= 6; c++) {
      var key = windowKey(c, now), w = t.win[c];
      if (!w || w.key !== key || !w.base) {
        var base = {};
        for (var j = 0; j < METRICS.length; j++) base[METRICS[j]] = num(t.m[METRICS[j]]);
        t.win[c] = w = { key: key, base: base };
        if (t.lr[c]) { t.lr[c] = 0; log('计划 ' + c + ' 新周期(' + key + ') -> 进度与已领档位清零'); }
        wch++;
      }
    }
    if (wch) save();
    return { metrics: t.m, changed: ch + wch };
  }
  function winPro(c, metric) {
    var t = ts(), w = t.win[c];
    if (!w || !w.base) return 0;
    return Math.max(0, num(t.m[metric]) - num(w.base[metric]));
  }
  function setWm(k, why) {
    var t = ts();
    if (!num(t.w[k])) { t.w[k] = 1; save(); log('水印 ' + k + ' = 1 (' + (why || '') + ')'); }
  }

  /* ---- 计划条目 -> 指标: 关键词映射 ------------------------------------ */
  var KW = [
    ['三叶草', 'clover'], ['草原', 'clover'], ['特产', 'specialty'], ['分享', 'feed'],
    ['纪念品', 'collection'], ['相册', 'photo'], ['照片', 'photo'], ['明信片', 'photo'],
    ['旅友', 'friendNote'], ['笔记', 'note'], ['故事', 'story'],
    ['印章', 'stamp'], ['祈愿', 'wish'], ['手工', 'wish'], ['材料', 'mat'],
    ['家具', 'furniture'], ['图纸', 'furniture'], ['工作台', 'furniture'], ['地板', 'furniture'], ['墙壁', 'furniture'],
    ['商店', 'buy'], ['道具', 'buy'], ['购买', 'buy'], ['买点', 'buy'],
    ['邻居', 'feed'], ['聚会', 'party'], ['串门', 'party'], ['贺卡', 'greet'],
    ['地图', 'map'], ['花瓶', 'flower'], ['鲜花', 'flower'], ['兑换码', 'giftCode'],
    ['抽奖', 'ticket'], ['兑换券', 'ticket'], ['券', 'ticket'],
    ['日历', 'calendar'], ['节气', 'calendar'], ['时令', 'calendar'],
    ['扩容', 'expand'], ['绘纸', 'book'], ['绘本', 'book'],
    ['旅行', 'travel'], ['出门', 'travel'], ['目的地', 'travel'], ['水乡', 'travel'], ['雪山', 'travel']
  ];
  var kwCache = {};
  function metricOfList(id) {
    if (kwCache[id]) return kwCache[id];
    var cfg = listCfg(id), text = cfg ? (String(cfg.title || '') + ' ' + String(cfg.desc || '')) : '';
    var m = null;
    for (var i = 0; i < KW.length; i++) if (text.indexOf(KW[i][0]) >= 0) { m = KW[i][1]; break; }
    if (!m) m = 'travel';
    kwCache[id] = m;
    return m;
  }
  /* 30 条任务的指标(按 notes/research_task_achieae_ency_story.md §1.8 的对照表) */
  var TASK_METRIC = {
    1: 'travel', 2: 'travel', 3: 'specialty', 4: 'specialty', 5: 'collection', 6: 'collection',
    7: 'photo', 8: 'photo', 9: 'story',
    101: 'note', 102: 'note', 103: 'friendNote', 104: 'story', 105: 'visitor',
    201: 'mat', 202: 'box', 203: 'wish', 204: 'stamp', 205: 'stamp',
    301: 'buy', 302: 'buy', 303: 'decorate', 304: 'decorate',
    401: 'greet', 402: 'greet', 403: 'party',
    901: 'clover', 902: 'ticket', 903: 'calendar', 904: 'expand'
  };
  function taskMetric(id) { return TASK_METRIC[Number(id)] || (metricOfList(Number(id)) || 'travel'); }

  /* ---- 应答 ------------------------------------------------------------ */
  function taskRows() {
    var t = ts(), ids = tableKeys('task_list', FALLBACK_TASKS), out = [];
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i], cfg = taskCfg(id), pro = num(t.m[taskMetric(id)]);
      if (cfg) pro = Math.min(pro, num(cfg.count));          /* 详情页显示 x/y, 超了反而怪 */
      out.push({ id: id, pro: pro, is_reward: t.r[id] ? 1 : 0 });
    }
    return out;
  }
  function listRows() {
    var ids = tableKeys('list_map', window.MOCK_LIST_IDS || []), out = [];
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i], cfg = listCfg(id);
      if (!cfg) continue;                                     /* 非 list_map 的 id 会让 updateRedot 抛异常 */
      var c = num(cfg.type) || 1, pro = winPro(c, metricOfList(id));
      if (num(cfg.count) > 0) pro = Math.min(pro, num(cfg.count));
      out.push({ id: id, pro: pro });
    }
    return out;
  }
  function rewardRows() {
    var t = ts(), out = [];
    for (var c = 1; c <= 6; c++) out.push({ id: c, pro: num(t.lr[c]) });
    return out;
  }
  S['task_load'] = function () { scan(); return { tasks: taskRows(), list: listRows() }; };
  S['task_load_list'] = function () { scan(); return { reward: rewardRows() }; };

  /* ---- 发奖 ------------------------------------------------------------ */
  function grant(rewardId, n) {
    rewardId = num(rewardId); n = num(n) || 1;
    if (!rewardId) return;
    if (rewardId === 200000) {                                /* 200000 = 三叶草 */
      st.clover = num(st.clover) + n;
      push('clover_update', { clover: st.clover }, 30);
      log('奖励: 三叶草 +' + n + ' (共 ' + st.clover + ')');
    } else {
      st.house = arr(st.house);
      var found = null;
      for (var i = 0; i < st.house.length; i++) if (st.house[i] && num(st.house[i].item_id) === rewardId) found = st.house[i];
      if (found) found.count = num(found.count) + n; else st.house.push({ item_id: rewardId, count: n });
      push('item_load_items', null, 30);
      log('奖励: item ' + rewardId + ' x' + n + ' 进仓库');
    }
  }
  S['task_get_reward'] = function (p) {
    var t = ts(), id = num(p && (p.id !== undefined ? p.id : p.task_id)), cfg = taskCfg(id);
    if (!cfg) { log('领奖失败: 未知任务 ' + id); return { code: 1 }; }
    if (t.r[id]) return { code: 2 };
    var pro = num(t.m[taskMetric(id)]);
    if (pro < num(cfg.count)) { log('领奖失败: 任务' + id + ' 未完成 (' + pro + '/' + cfg.count + ')'); return { code: 3 }; }
    t.r[id] = 1;
    grant(cfg.reward_id, cfg.num);
    save();
    log('领奖: 任务' + id + '「' + cfg.title + '」-> item ' + cfg.reward_id + ' x' + cfg.num);
    push('task_load', function () { return { tasks: taskRows(), list: listRows() }; }, 60);
    return { code: 0 };
  };
  S['task_get_list_reward'] = function (p) {
    var t = ts(), id = num(p && (p.id !== undefined ? p.id : p.reward_id));
    var c = Math.floor(id / 100), tier = id % 100;
    var cfg = listType(c);
    if (!cfg || !arr(cfg.target).length || tier < 1 || tier > arr(cfg.target).length) { log('计划领奖失败: 非法 id ' + id); return { code: 1 }; }
    if (num(t.lr[c]) >= tier) { log('计划领奖失败: 第' + tier + '档已领过'); return { code: 2 }; }
    if (num(t.lr[c]) !== tier - 1) { log('计划领奖失败: 还没轮到第' + tier + '档 (已领 ' + num(t.lr[c]) + ')'); return { code: 3 }; }
    /* 完成度: 本节奏里已达标的条目数 >= 该档门槛 */
    var done = 0, ids = tableKeys('list_map', window.MOCK_LIST_IDS || []);
    for (var i = 0; i < ids.length; i++) {
      var lc = listCfg(ids[i]); if (!lc || num(lc.type) !== c) continue;
      if (winPro(c, metricOfList(ids[i])) >= num(lc.count)) done++;
    }
    if (done < num(arr(cfg.target)[tier - 1])) { log('计划领奖失败: 第' + tier + '档需要 ' + arr(cfg.target)[tier - 1] + ' 条达标, 现在 ' + done); return { code: 3 }; }
    t.lr[c] = tier;
    grant(arr(cfg.reward)[tier - 1], 1);
    save();
    log('计划领奖: ' + cfg.name + ' 第' + tier + '档 -> item ' + arr(cfg.reward)[tier - 1] + ' (' + done + ' 条达标)');
    push('task_load_list', { reward: rewardRows() }, 50);
    push('task_load', function () { return { tasks: taskRows(), list: listRows() }; }, 80);
    return { code: 0 };
  };

  /* ---- 旁听: 少量需要"事件"而不是"状态"的指标 -------------------------- */
  var prev = M.handle;
  M.handle = function (name, params) {
    var r = prev.apply(this, arguments);
    try {
      if (name === 'item_buy') { if (r && num(r.code) === 0) st.buyCount = num(st.buyCount) + 1; }
      else if (name === 'item_use_gift_code') setWm('giftCode', '用了兑换码');
      else if (name === 'task_client_pro') {
        var k = String((params && params.param) || '');
        if (k === 'Map') setWm('map', '打开旅行地图');
        else if (k === 'NoteFriend') setWm('friendNote', '打开旅友笔记');
      } else if (name === 'pray_confirm_make_box') { st.boxMade = num(st.boxMade) + 1; setWm('box', '收下祈愿盒'); }
      else if (name === 'share_get_reward' || name === 'partycake_reward_share' || name === 'admsmgr_share' || name === 'client_share_publicity') {
        st.shareCount = num(st.shareCount) + 1;      /* 日历任务1「观看广告或完成分享」= 当日分享次数 */
      }
      else if (name === 'encyclopedia_set_show_sub' || name === 'item_load_handbook') { /* 只读旁听, 不记账 */ }
    } catch (e) {}
    return r;
  };

  /* ---- 状态水印扫描 + 推送 -------------------------------------------- */
  var lastSig = '';
  function sig() {
    var a = taskRows(), b = listRows(), c = rewardRows(), o = [];
    for (var i = 0; i < a.length; i++) o.push(a[i].id + ':' + a[i].pro + ':' + a[i].is_reward);
    o.push('|');
    for (var j = 0; j < b.length; j++) o.push(b[j].id + ':' + b[j].pro);
    o.push('|');
    for (var k = 0; k < c.length; k++) o.push(c[k].id + ':' + c[k].pro);
    return o.join(',');
  }
  function tick(why) {
    try {
      /* 水印: 见过的物品/绘本/花盆 */
      if (houseCount(8000) > 0) setWm('mat', '仓库里有手工品材料');
      if (houseCount(7001) > 0) setWm('book', '仓库里有友情绘本');
      if (houseCount(9000) > 0) setWm('expand', '买了相册扩容');
      if (num(st.flowerPlanted)) setWm('flower', '花盆种过东西');
      scan();
      syncCalendar();
      var s = sig();
      if (s !== lastSig) {
        if (lastSig) {
          push('task_load', function () { return { tasks: taskRows(), list: listRows() }; }, 40);
          push('task_load_list', { reward: rewardRows() }, 90);
          log('进度变化 -> 推送 task_load' + (why ? ' (' + why + ')' : ''));
        }
        lastSig = s;
      }
    } catch (e) { log('tick 出错: ' + (e && e.message || e)); }
  }
  setInterval(function () { tick('定时'); }, 5000);
  tick('启动');

  /* ---- 日历的"当日任务"(calendar_load.task_list) ----------------------------
     客户端 canGetStReward() = task_list 里**每一条** complete 才为真; 而 req_st_reward 的成功
     回调里有一句 `i.data.task_list[0].complete = !1` —— task_list 为空数组时那句会抛异常,
     checkRedot() 与隐藏图标的回调都不执行(用户看到的"点了节气奖励, 图标不消失/红点常亮")。
     所以必须给非空的当日任务; 这里用日计划(list_map type=1)的完成情况,
     并且**当天已领过节气奖励就不再算完成**(否则领完立刻又能领)。 */
  /* 日历面板里那三条是客户端**写死**的文案(CalendarView @527935):
       ["观看广告或完成分享（{0}/1）","累计获得三叶草（{0}/30）","商店抽奖兑换奖品（{0}/1）"]
     它读 task_list[u].pro (u=0..2) 填 {0}, 并且 canGetStReward() = 三条都 complete。
     所以这里就照这三条发(而不是拿日计划去凑), 进度全是"当日增量"。 */
  var CAL_TASKS = [
    { id: 1, metric: 'share', target: 1 },
    { id: 2, metric: 'clover', target: 30 },
    { id: 3, metric: 'gacha', target: 1 }
  ];
  function calendarDayTasks() {
    scan();
    var d = new Date(), key = 'st_' + d.getDate();
    var claimed = !!(st.calClaimed && st.calClaimed[key]);
    var out = [];
    for (var i = 0; i < CAL_TASKS.length; i++) {
      var t = CAL_TASKS[i], pro = winPro(1, t.metric);
      out.push({ id: t.id, pro: pro, complete: (!claimed && pro >= t.target) ? 1 : 0 });
    }
    return out;
  }
  var daySig = '';
  function syncCalendar() {
    try {
      var a = calendarDayTasks(), o = [];
      for (var i = 0; i < a.length; i++) o.push(a[i].id + ':' + a[i].pro + ':' + a[i].complete);
      var sig = o.join(',');
      if (sig === daySig) return;
      var first = !daySig;
      daySig = sig;
      if (first) return;
      for (var j = 0; j < a.length; j++) {
        push('calendar_task_update', { task: { id: a[j].id, complete: a[j].complete } }, 30 + j * 30);
      }
      if (S['calendar_load']) push('calendar_load', null, 120);
      log('日历当日任务变化 -> calendar_task_update [' + sig + ']');
    } catch (e) {}
  }

  window.MOCK_TASKS = {
    load: function () { scan(); return { tasks: taskRows(), list: listRows(), reward: rewardRows() }; },
    metrics: function () { scan(); return ts().m; },
    rows: taskRows,
    listRows: listRows,
    metric: taskMetric,
    windowKey: windowKey,
    bump: function (kind, n) { var t = ts(); t.m[kind] = num(t.m[kind]) + (num(n) || 1); save(); tick('手动'); return t.m[kind]; },
    watermark: setWm,
    /* 调试: 直接看每个任务/计划条目用的指标与进度 */
    calendarDayTasks: calendarDayTasks,
    explain: function () {
      scan();
      var ids = tableKeys('task_list', FALLBACK_TASKS), o = [];
      for (var i = 0; i < ids.length; i++) o.push(ids[i] + ':' + taskMetric(ids[i]) + '=' + num(ts().m[taskMetric(ids[i])]));
      var lids = tableKeys('list_map', window.MOCK_LIST_IDS || []), p = [];
      for (var j = 0; j < lids.length; j++) { var c = num((listCfg(lids[j]) || {}).type) || 1; p.push(lids[j] + ':' + metricOfList(lids[j]) + '[' + c + ']=' + winPro(c, metricOfList(lids[j]))); }
      return { tasks: o, list: p, claimed: ts().lr };
    }
  };
  log('任务层就绪: 任务 ' + tableKeys('task_list', FALLBACK_TASKS).length + ' 条, 计划 ' + tableKeys('list_map', window.MOCK_LIST_IDS || []).length + ' 条, 指标 ' + METRICS.length + ' 个');
})();
