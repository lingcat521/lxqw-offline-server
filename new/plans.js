/* lxqw 「伴蛙前行」动态计划系统(第 1+2 步) —— new/plans.js
 *
 * 用户给的设计(2026-09-15): 任务**数据驱动**(plan_templates.json) + 按周期惰性重置 + 权重抽签(保底 easy),
 *   事件驱动/基线差值混合(第 3 步), 逐任务计数落库, 阶梯奖励 claimed_scores 防重, 启动全量同步 + 变更增量同步。
 *   本层先做 1+2: 模板表 + 惰性重置 + 抽签 + 落库 + 与现有 new/tasks.js 并存(基线差值那套不动)。
 *
 * 周期(Asia/Shanghai): daily 当日 0 点 / weekly 周一 0 点 / half_month 1、16 号 / monthly 1 号 /
 *   seasonal 1、4、7、10 月 1 号 / annual 1 月 1 号。
 * 存库形状(每个周期一份):
 *   { template_id, start, end, score, claimed:[score...],
 *     tasks:[{task_id, client_task_id, event, target, current_count, status, type, meta}] }
 */
(function () {
  var st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  function log(m) { try { console.log('[MOCK] 计划: ' + m); } catch (e) {} }
  function save() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function push(name, d, t) { setTimeout(function () { try { window.MockServer.dispatch(name, (typeof d === 'function' ? d() : d)); } catch (e) {} }, t || 60); }

  /* ---------- 模板表: 优先从 devserver 读(改文件即改任务), 读不到用内联兜底 ---------- */
  var FALLBACK = { daily: { template_id: 'daily_default', task_count: 2, rewards: [{ score: 1, items: [{ id: 100000, count: 30 }] }],
    candidate_tasks: [{ task_id: 't_travel_1', client_task_id: 101, event: 'TRAVEL_GO', target: 1, is_easy: true, weight: 20, desc: '出门随便逛逛' },
                      { task_id: 't_clover_10', client_task_id: 202, event: 'HARVEST_CLOVER', target: 10, is_easy: true, weight: 18, desc: '收10株三叶草' }] } };
  var TPL = null;
  function templates() {
    if (TPL) return TPL;
    TPL = window.MOCK_PLAN_TEMPLATES || FALLBACK;      /* 数据文件: new/plan_templates.js(改它即改任务) */
    if (window.MOCK_PLAN_TEMPLATES) log('模板表已载入: ' + Object.keys(TPL).join(', '));
    else log('模板表没装(plan_templates.js), 用内联兜底');
    return TPL;
  }

  /* ---------- 周期窗口(用时间戳算, 不看内存状态 —— 跨窗口边界才稳) ---------- */
  var PERIODS = ['daily', 'weekly', 'half_month', 'monthly', 'seasonal', 'annual'];
  function windowOf(period, sec) {
    var d = new Date(num(sec) * 1000);
    var y = d.getFullYear(), mo = d.getMonth(), day = d.getDate();
    function at(yy, mm, dd) { return Math.floor(new Date(yy, mm, dd, 0, 0, 0, 0).getTime() / 1000); }
    if (period === 'daily') return { start: at(y, mo, day), end: at(y, mo, day + 1) };
    if (period === 'weekly') { var wd = (d.getDay() + 6) % 7; return { start: at(y, mo, day - wd), end: at(y, mo, day - wd + 7) }; }
    if (period === 'half_month') return day < 16 ? { start: at(y, mo, 1), end: at(y, mo, 16) } : { start: at(y, mo, 16), end: at(y, mo + 1, 1) };
    if (period === 'monthly') return { start: at(y, mo, 1), end: at(y, mo + 1, 1) };
    if (period === 'seasonal') { var q = Math.floor(mo / 3) * 3; return { start: at(y, q, 1), end: at(y, q + 3, 1) }; }
    return { start: at(y, 0, 1), end: at(y + 1, 0, 1) };
  }

  /* ---------- 抽签: 权重随机 + 保底至少一个 easy ---------- */
  function pickTasks(tpl, period) {
    var pool = (tpl && Array.isArray(tpl.candidate_tasks) ? tpl.candidate_tasks : []).slice();
    if (!pool.length) return [];
    var want = Math.max(1, Math.min(pool.length, num(tpl.task_count) || 3));
    var picked = [];
    while (picked.length < want && pool.length) {
      var total = 0, i;
      for (i = 0; i < pool.length; i++) total += Math.max(1, num(pool[i].weight) || 10);
      var r = Math.random() * total, idx = 0;
      for (i = 0; i < pool.length; i++) { r -= Math.max(1, num(pool[i].weight) || 10); if (r <= 0) { idx = i; break; } }
      picked.push(pool.splice(idx, 1)[0]);
    }
    var hasEasy = false;
    for (var k = 0; k < picked.length; k++) if (picked[k].is_easy) hasEasy = true;
    if (!hasEasy) {                                   /* 保底: 没抽到简单任务就把最后一个换成 easy */
      var easies = (tpl.candidate_tasks || []).filter(function (t) { return t.is_easy; });
      if (easies.length) picked[picked.length - 1] = easies[Math.floor(Math.random() * easies.length)];
    }
    return picked;
  }
  function toTask(t) {
    return { task_id: String(t.task_id), client_task_id: num(t.client_task_id), event: String(t.event || ''),
             target: Math.max(1, num(t.target) || 1), current_count: 0, status: 'in_progress',
             type: t.event === 'CLIENT_MAP_OPEN' || t.event === 'CLIENT_MAIL_CDKEY' ? 'client' : 'event',
             desc: String(t.desc || ''), meta: { with_item: num(t.with_item), guest: (t.guest === undefined ? -1 : num(t.guest)),
             bag_full: num(t.bag_full), desk_full: num(t.desk_full), fur_type: num(t.fur_type) } };
  }
  function resetPlan(period, sec) {
    var tpl = templates()[period]; if (!tpl) return null;
    var w = windowOf(period, sec), picked = pickTasks(tpl, period);
    var plan = { template_id: tpl.template_id, period: period, start: w.start, end: w.end,
                 score: 0, claimed: [], tasks: picked.map(toTask) };
    st.plans[period] = plan;
    plan.resetAt = num(sec); plan.newly = true;
    log('新周期 ' + period + ' (' + new Date(w.start * 1000).toLocaleString() + ' ~ ) 抽到 ' +
        plan.tasks.map(function (t) { return t.desc + '(' + t.event + '×' + t.target + ')'; }).join(', '));
    return plan;
  }
  /* 池子里每个 event 的出口对照(新加任务前先查这张表, 免得又出现"没人发 -> 永远 0") */
  var EVENT_SRC = {
    TRAVEL_GO: '状态差分(status 0->1)', TRAVEL_BACK: '归来钩子', PHOTO_GET: '相册差分',
    HARVEST_CLOVER: 'clover_harvest', FEED_NEIGHBOR: 'guest_serve', GUEST_VISIT: '访客差分',
    PLANT_FLOWER: '花盆差分', ITEM_BUY: 'item_buy', DRAWING_BUY: 'furniture_buy(type13)',
    CRAFT_STAMP: 'capsule_compose/handcraft_make', CRAFT_WISH: 'pray_*', FURNITURE_DONE: 'MOCK_FURNITURE_DONE',
    MATERIAL_BACK: '归来钩子', PARTY_GO: 'MOCK_PARTY.start', PARTY_RESULT: '绘纸差分',
    STORY_LIKE: 'story_read_new_story(planhooks 登记)', GIFT_BOX_PUT: 'travel_*_to_gift', SEND_GIFT: 'story_send_gift',
    GREET_CARD: 'greetcard_send_gift', NOTE_READ: 'travel_read_note', PACK_BAG: 'item_set_bag_completed',
    BENCH_PUT: 'furniture_putin_bench', SOUVENIR_BACK: '特产差分'
  };
  /* 惰性重置: 每次取用时先看 now 是否越过 end(用时间戳, 不看内存) */
  function ensure(period, sec) {
    st.plans = st.plans || {};
    sec = num(sec) || Math.floor(Date.now() / 1000);
    var p = st.plans[period];
    if (!p || !num(p.end) || sec >= num(p.end) || num(p.start) > sec) { p = resetPlan(period, sec); if (p) save(); }
    return p;
  }
  function ensureAll(sec) { var out = [], i; for (i = 0; i < PERIODS.length; i++) out.push(ensure(PERIODS[i], sec)); return out; }

  /* ---------- 事件驱动(第 3 步的地基: 先落库 + 推增量) ---------- */
  /* ---------- 同步: 脏标记 + 合并推送(用户要求: 防"同步风暴") ---------- */
  var dirty = false, flushTimer = 0, lastChanged = [];
  function markDirty(changed) {
    if (changed && changed.length) lastChanged = lastChanged.concat(changed);
    if (dirty) return;
    dirty = true;
    flushTimer = setTimeout(flush, 50);          /* 同一帧里的多个事件只推一次 */
  }
  function flush() {
    dirty = false; if (flushTimer) { clearTimeout(flushTimer); flushTimer = 0; }
    var inc = lastChanged.slice(); lastChanged = [];
    push('task_load', taskPayload(), 40);        /* 全量(含绝对 current_count) */
    if (inc.length) push('task_sync', { list: inc, at: Math.floor(Date.now() / 1000) }, 70);
    log('同步: task_load(全量) + task_sync(' + inc.length + ' 条增量)');
  }
  /* ---------- 事件驱动(第 3 步): 严格按 meta 过滤, 不许"随便旅个行就完成带特定行李的任务" ---------- */
  function matchMeta(t, ctx) {
    var m = t.meta || {};
    if (num(m.guest) >= 0 && num(ctx.guest) !== num(m.guest)) return false;          /* 指定邻居 */
    if (num(m.with_item) > 0) {                                                      /* 必须**带着**那件东西 */
      var want = num(m.with_item), ok = false;
      if (num(ctx.itemId) === want) ok = true;
      var list = ctx.items || [];
      for (var i = 0; i < list.length; i++) if (num(list[i]) === want) ok = true;
      if (!ok) return false;
    }
    if (num(m.bag_full) > 0 && !ctx.bagFull) return false;
    if (num(m.desk_full) > 0 && !ctx.deskFull) return false;
    if (num(m.fur_type) > 0 && num(ctx.furType) !== num(m.fur_type)) return false;
    return true;
  }
  function progress(event, amount, ctx) {
    amount = num(amount) || 1; ctx = ctx || {};
    if (/^CLIENT_/.test(String(event))) return [];          /* 客户端行为任务: 走 tasks.js 基线差值, 不进事件总线 */
    if (ctx.fromDelta) return [];                           /* 从 tasks.js 的 delta 触发器来的: 忽略, 免得加两次 */
    var changed = [], i, j;
    for (i = 0; i < PERIODS.length; i++) {
      var p = ensure(PERIODS[i]);
      if (!p) continue;
      for (j = 0; j < p.tasks.length; j++) {
        var t = p.tasks[j];
        if (t.status === 'completed' || t.event !== String(event)) continue;
        if (t.type === 'client') continue;                  /* CLIENT_ 类任务不参与事件累加 */
        if (!matchMeta(t, ctx)) continue;
        t.current_count = Math.min(t.target, num(t.current_count) + amount);
        if (t.current_count >= t.target) { t.status = 'completed'; p.score = num(p.score) + 1; }
        changed.push({ period: PERIODS[i], task_id: t.task_id, current_count: t.current_count, status: t.status, score: p.score });
      }
    }
    if (changed.length) { save(); markDirty(changed); }
    return changed;
  }
  /* 阶梯奖励: claimed 防重, 发物品走现有 item_load_items */
  function claim(period, scoreNode) {
    var p = ensure(period), node = num(scoreNode);
    if (!p || !node) return { code: 1 };
    if (num(p.score) < node) return { code: 2 };
    for (var i = 0; i < p.claimed.length; i++) if (num(p.claimed[i]) === node) return { code: 3 };
    /* 点击特效作为阶梯奖励(用户: 当季计划 6 分 -> 当季特效; 年度 10 分 -> 蛙爪印) */
    try {
      var fxMap = { seasonal: { 6: 'season' }, annual: { 10: 4 } };
      var want = fxMap[period] && fxMap[period][node];
      if (want && window.MOCK_CLICKFX) {
        if (want === 'season') {
          var sKey = (window.MOCK_SEASON && window.MOCK_SEASON.snapshot) ? window.MOCK_SEASON.snapshot().season_key : 1;
          var got = window.MOCK_CLICKFX.grantBySeason(sKey, '伴蛙前行 ' + period + ' ' + node + ' 分');
          log('阶梯奖励: 当季特效 -> ' + (got || '已拥有'));
        } else {
          var got2 = window.MOCK_CLICKFX.unlock(num(want), '伴蛙前行 ' + period + ' ' + node + ' 分');
          log('阶梯奖励: 点击特效 ' + num(want) + ' -> ' + (got2 || '已拥有'));
        }
      }
    } catch (e) {}
    var tpl = templates()[period], rw = null, rs = (tpl && tpl.rewards) || [];
    for (var j = 0; j < rs.length; j++) if (num(rs[j].score) === node) rw = rs[j];
    p.claimed.push(node); save();
    if (rw) {
      st.house = Array.isArray(st.house) ? st.house : [];
      for (var k = 0; k < rw.items.length; k++) {
        var it = rw.items[k], found = null;
        for (var h = 0; h < st.house.length; h++) if (num(st.house[h].item_id) === num(it.id)) found = st.house[h];
        if (found) found.count = num(found.count) + num(it.count); else st.house.push({ item_id: num(it.id), count: num(it.count) });
      }
      push('item_load_items', S['item_load_items'] ? S['item_load_items']() : null, 80);
    }
    log('领奖 ' + period + ' 分数节点 ' + node + (rw ? (' -> ' + JSON.stringify(rw.items)) : '(模板里没配这个节点)'));
    return { code: 0 };
  }
  /* 给客户端的形态: 每个周期一份 {start,end,score,claimed,tasks[{client_task_id,current_count,target,status}]} */
  /* CLIENT_ 类任务: 客户端行为(看地图/兑换码)服务端抓不到事件, 但客户端**会主动上报**:
       send("task_client_pro", {param:"Map"})  ← 我们在日志里实测到过(HANDLE task_client_pro {"param":"Map"})
     rules.js 把它记在 st.clientPro[param] 上, 这里按任务类型取对应 key 的累计次数。 */
  var CLIENT_KEY = {
    CLIENT_MAP_OPEN: ['Map', 'map', 'TravelMap'],
    CLIENT_MAIL_CDKEY: ['Cdkey', 'CDKey', 'Mail', 'Email', 'cdkey'],
    CLIENT_OPEN_BAG: ['OpenBag', 'Bag'],
    CLIENT_NOTE_FRIEND: ['NoteFriend', 'Note', 'note'],
    CLIENT_ALBUM_OPEN: ['Album', 'album', 'Picture'],
    CLIENT_STORE_OPEN: ['Shop', 'Store', 'shop'],
    CLIENT_HOUSE_OPEN: ['House', 'house', 'Room', 'room'],
    CLIENT_DIARY_OPEN: ['Diary', 'diary', 'Story', 'story'],
    CLIENT_CALENDAR_OPEN: ['Calendar', 'calendar'],
    CLIENT_FURNITURE_OPEN: ['Furniture', 'furniture', 'Bench']
  };
  var clientDone = {};
  /* ---- 自动发现(用户要求): 客户端上报的任何 param 都记在 st.clientPro, 这里做**归一化模糊匹配** ----
     CLIENT_NOTE_FRIEND -> "notefriend"  能对上上报的 "NoteFriend"/"note_friend"/"noteFriend" ...
     显式别名表(CLIENT_KEY)优先; 匹配不到就按归一化找; 完全没有就当 0 并只提醒一次。 */
  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function discovered() {
    var out = {}, k, a = st.clientPro || {}, b = st.clientOpen || {};
    for (k in a) out[k] = num(a[k]);
    for (k in b) out[k] = num(out[k]) + num(b[k]);       /* 协议观测到的"打开过某界面"也算 */
    return out;
  }
  function autoKey(ev) {
    var want = norm(String(ev || '').replace(/^CLIENT_/, ''));
    if (!want) return null;
    var cp = discovered(), k;
    for (k in cp) if (norm(k) === want) return k;
    for (k in cp) { var nk = norm(k); if (nk && (nk.indexOf(want) >= 0 || want.indexOf(nk) >= 0)) return k; }
    /* 兜底: 协议观测层已确认存在的界面 key(玩家还没点过也要算"有来源", 计数先按 0 走) */
    var K = KNOWN_CLIENT_KEYS || [];
    for (k = 0; k < K.length; k++) { var kk = norm(K[k]); if (kk && (kk === want || kk.indexOf(want) >= 0 || want.indexOf(kk) >= 0)) return K[k]; }
    return null;
  }
  /* ---- 覆盖审计(用户要求"修复同种 bug"): 任何模板事件都必须有**真实来源** ----
     三类合法来源: ① EVENT_SRC 里登记的服务端钩子 ② CLIENT_ 前缀 + 已知/已发现的界面 key
     ③ planhooks 运行时 declareEmitter 登记过的发射点。审计不通过 = 这条任务永远做不完。 */
  var emitters = {};
  var KNOWN_CLIENT_KEYS = ['Map','NoteFriend','Cdkey','ALBUM_OPEN','ENCY_OPEN','PLAN_OPEN','GIFTBOX_OPEN',
    'NOTE_READ','CALENDAR_OPEN','FURNITURE_OPEN','GREETCARD_OPEN','HANDBOOK_OPEN','STORE_OPEN','LOTTERY_OPEN',
    'MOMENT_OPEN','MUSEUM_OPEN','DIARY_OPEN','VISIT_OPEN'];
  function knownOrDiscovered(ev) {
    var a2 = autoKey(ev);
    if (a2) return a2;
    var want = norm(String(ev).replace(/^CLIENT_/, '')), i, nk;
    for (i = 0; i < KNOWN_CLIENT_KEYS.length; i++) {
      nk = norm(KNOWN_CLIENT_KEYS[i]);
      if (nk === want || nk.indexOf(want) >= 0 || want.indexOf(nk) >= 0) return KNOWN_CLIENT_KEYS[i];
    }
    return null;
  }
  function eventSrcMap() {
    /* 兼容两种加载方式: 同一作用域直接可见 / 被外层重新包裹后只能通过导出对象拿 */
    try { if (typeof EVENT_SRC !== 'undefined' && EVENT_SRC) return EVENT_SRC; } catch (e0) {}
    try { return (window.MOCK_PLANS && window.MOCK_PLANS.eventSources) ? window.MOCK_PLANS.eventSources() : {}; } catch (e1) { return {}; }
  }
  function resolvable(ev) {
    if (emitters[ev]) return true;
    if (/^CLIENT_/.test(ev)) return !!knownOrDiscovered(ev);
    var es = eventSrcMap(), src = es[ev];
    if (src && String(src).indexOf('走 CLIENT_ 上报') < 0) return true;
    return false;
  }
  function discover(ev) {
    var sig = 'nomatch:' + String(ev);
    if (clientDone[sig]) return 0;
    clientDone[sig] = 1;
    log('客户端任务 ' + ev + ' 暂无可用的上报 key —— 已发现的上报: ' + (Object.keys(discovered()).join(',') || '(还没有)'));
    return 0;
  }
  function clientDelta(clientId, period, task) {
    try {
      if (window.MOCK_TASK_DELTA) { var v0 = window.MOCK_TASK_DELTA(clientId, period); if (isFinite(Number(v0)) && num(v0) > 0) return num(v0); }
    } catch (e) {}
    var cp = discovered(), ev = String((task && task.event) || ''), keys = (CLIENT_KEY[ev] || []).slice();
    var auto = autoKey(ev);
    if (auto && keys.indexOf(auto) < 0) keys.push(auto);            /* 自动发现来的 key */
    var n = 0, k;
    for (var i = 0; i < keys.length; i++) n += num(cp[keys[i]]);
    if (n === 0 && /^CLIENT_/.test(ev)) return discover(ev);
    if (n > 0) {
      var sig = period + ':' + (task && task.task_id);
      if (!clientDone[sig]) { clientDone[sig] = 1; log('客户端上报 ' + ev + ' ×' + n + ' -> ' + period + ' 任务进度'); }
    }
    return n;
  }
  function taskPayload() {
    var out = {};
    for (var i = 0; i < PERIODS.length; i++) {
      var p = ensure(PERIODS[i]); if (!p) continue;
      out[PERIODS[i]] = { template_id: p.template_id, start: p.start, end: p.end, score: p.score, claimed: p.claimed.slice(),
        tasks: p.tasks.map(function (t) {
          var cur = (t.type === 'client') ? Math.min(t.target, clientDelta(t.client_task_id, p.period, t)) : num(t.current_count);
          if (t.type === 'client' && cur >= t.target && t.status !== 'completed') { t.status = 'completed'; p.score = num(p.score) + 1; save(); }
          return { task_id: t.task_id, client_task_id: t.client_task_id, current_count: cur, target: t.target,
                   status: (cur >= t.target ? 'completed' : t.status), desc: t.desc, type: t.type };
        }) };
    }
    return out;
  }
  st.plans = st.plans || {};
  window.MOCK_PLANS = {
    periods: PERIODS, templates: templates, windowOf: windowOf, pickTasks: pickTasks,
    clientKeys: function () { return CLIENT_KEY; }, eventSources: function () { return EVENT_SRC; },
    /* 覆盖审计: 返回未接上真实来源的事件(必须为空, 否则就是"永远做不完的任务") */
    audit: function () {
      var un = [], okN = 0, k, i, ev;
      for (k in TPL) {
        var pool = (TPL[k] && TPL[k].candidate_tasks) || [];
        for (i = 0; i < pool.length; i++) {
          ev = String(pool[i].event || '');
          if (ev && resolvable(ev)) { okN++; continue; }
          un.push(k + ':' + (pool[i].task_id || '?') + ' -> ' + (ev || '(缺 event)'));
        }
      }
      return { total: okN + un.length, resolved: okN, unresolved: un };
    },
    declareEmitter: function (ev, src) { emitters[String(ev)] = String(src || 'runtime'); return true; },
    emitters: function () { return emitters; },
    discovered: discovered, autoKey: autoKey,
    /* 自动发现登记: 客户端任何 task_client_pro(param) 都进 st.clientPro; 第一次见到就打日志 */
    watchClientPro: function () {
      var cp = st.clientPro || {}, k, n = 0;
      for (k in cp) { var sig = 'seen:' + k; if (!clientDone[sig]) { clientDone[sig] = 1; log('发现客户端上报 key: ' + k + ' (当前累计 ' + num(cp[k]) + ')'); n++; } }
      return n;
    },
    ensure: ensure, ensureAll: ensureAll, reset: resetPlan, progress: progress, claim: claim,
    payload: taskPayload,
    state: taskPayload,
    summary: function () {
      return PERIODS.map(function (p) { var x = ensure(p); return p + ':' + (x ? (x.score + '/' + x.tasks.length) : '-'); }).join(' ');
    },
    /* 测试用: 把某个周期的时间推到过去/未来, 验证惰性重置与跨窗口不串 */
    shift: function (period, seconds) { var p = ensure(period); p.start = num(p.start) + seconds; p.end = num(p.end) + seconds; save(); return p; }
  };
  ensureAll();
  log('计划系统就绪(' + window.MOCK_PLANS.summary() + ') 模板: ' + Object.keys(templates()).join(','));
  /* 启动全量同步(纯推送协议/界面第一次打开都要有数据) */
  setTimeout(function () { try { markDirty([]); } catch (e) {} }, 1100);   /* 启动全量同步(走同一套防抖) */
})();
