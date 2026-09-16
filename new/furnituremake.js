/* lxqw 工作台"开工"：青蛙在家时用台面上的工具+材料做家具 —— 这一层补的是**服务端**那一半。
 *
 * 为什么需要它：客户端 FurnitureBenchView 只有三行(listTool/listItem/listResource)，**没有任何制作按钮**；
 * 官方新手引导图 guide_furniture_4 写得很清楚（原图在 logs/guides/guide_furniture_4.png）：
 *     "帮蛙蛙把材料和工具都放到工作台上吧 / 要有足够的材料和工具 / 蛙蛙才会做家具哦"
 * guide_furniture_5 补充："锤子，小刀…等工具"(工具行) / "岩纹石…等特殊材料"(材料行) / "多放一些准没错"。
 * 也就是说：**摆放是玩家的事，制作是服务端在青蛙在家时自动做的**。我们以前完全没实现这一步，
 * 所以玩家把东西摆满了工作台也什么都不会发生（"用不了工作台弄家具"，用户原话）。
 *
 * 规则(全部数据取自客户端自己的表)：
 *   条件: 青蛙在家(frog.status != 1) + 工具行有工具(type 12, 台面没有就用家里的) 
 *         + 材料行有特殊材料(type 11) + 玩家拥有对应家具的图纸(103xx 在 house 且 count>0)
 *   选谁: furnitureData.drawing 命中所拥有图纸、且还没拥有的家具里 id 最小的那件
 *   消耗: 1 件特殊材料(type 11) + 1 件普通材料(type 10) —— 期间 mate_list = 这两件(客户端资源行显示"占用")
 *   耗时: 普通 600 秒 / 大件(type1..6) 1800 秒(st.makeSeconds 可覆盖)，青蛙在家才计时
 *   完成: 家具进 has_fur，推 furniture_load_furniture + item_load_items，写日志
 *   开关: st.furnitureUnlockAll != 0 时保持旧行为(家具表全解锁, 制作就没有可做的了)；
 *         默认 0 = 真循环(做出来才归你)，要切回全解锁: 存档里把 furnitureUnlockAll 设 1。
 */
(function () {
  var M = window.MockServer, st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  var BENCH_SLOTS = 10, TICK = 4000;
  /* 制作耗时(用户报「莫名其妙在弹获得家具的提示」——以前 60 秒一件, 一晚上弹十几次)。
     原版: 像地板/墙壁这样的大件"制作的时间也会长一些, 有时候做一半就出门旅行了"(任务 603 原文),
     所以大件(type 1..6 = 墙壁/地面/阁楼/栏杆/窗户/仓门)给 3 倍时间。
     st.makeSeconds 可以整体覆盖(存档/GM: /gm make 120)。 */
  /* 用户按原版实测给的节奏: 青蛙在**庭院**做家具, 每次开工播一段专属动作动画(约 1 分 30 秒),
     一件家具分 1~3 次做完, 每次动画期间**工作台变灰**(客户端 bench_lock), 期间动画内容还会按工序变
     (锯/刷/敲/编/裁 = FrogMotionName 5..9, 正是外面场景那套)。所以:
       · 一段 = SESSION_SECONDS(默认 90s) 的"干活"动画;
       · 一段做完 -> 停 PAUSE_MIN~PAUSE_MAX 分钟(工作台恢复可操作), 再开下一段;
       · 段落数 1~3 打完整件家具。
     st.sessionSeconds / st.sessionPause 可覆盖(测试用短值)。 */
  var MAKE_SECONDS = 600, MAKE_SECONDS_BIG = 1800;
  var SESSION_SECONDS = 90;
  function sessionSeconds() { var v = Number(st.sessionSeconds); return (isFinite(v) && v > 0) ? v : SESSION_SECONDS; }
  function pauseSeconds() { var v = Number(st.pauseSeconds); if (isFinite(v) && v > 0) return v; return Math.round((2 + Math.random() * 6) * 60); }
  function sessionCount() { var v = Number(st.sessions); if (isFinite(v) && v > 0) return Math.max(1, Math.min(3, Math.round(v))); return 1 + Math.floor(Math.random() * 3); }
  /* 按家具类型挑工序动画(5..9): 刷漆/锯木/敲石/编织/裁剪 */
  function craftMotion(row) {
    var t = Number(row && row.type), style = Number(row && row.style) || 0;
    if (t === 1 || t === 2) return 6;               /* 墙壁/地面 -> 刷漆 brush */
    if (style === 1002) return 7;                   /* 石作风格 -> 敲 knock */
    if (t === 19 || t === 7 || t === 6 || t === 25) return 8;   /* 地毯/帘幕/仓门/照明 -> 编织 knit */
    if (t === 4 || t === 5 || t === 22) return 9;   /* 栏杆/窗户/立镜 -> 裁剪 cut */
    return 5;                                        /* 其余 -> 锯 saw */
  }
  var MOTION_LABEL = { 5: '锯木头', 6: '刷漆', 7: '敲打', 8: '编织', 9: '裁剪' };
  function isBigFur(row) { var t = Number(row && row.type); return t >= 1 && t <= 6; }
  function makeSeconds(cand) {
    var ov = Number(st.makeSeconds || 0);
    if (ov > 0) return ov;
    return isBigFur(cand) ? MAKE_SECONDS_BIG : MAKE_SECONDS;
  }
  function log(m) { try { console.log('[MOCK] 工作台: ' + m); } catch (e) {} }
  function save() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
  function push(name, d) { setTimeout(function () { try { M.dispatch(name, (typeof S[name] === 'function' ? S[name]() : S[name])); } catch (e) {} }, d || 30); }
  function nowSec() { return Math.floor(Date.now() / 1000); }

  function fs() {
    var f = st.furniture;
    if (!f || typeof f !== 'object') f = st.furniture = {};
    if (!Array.isArray(f.bench) || f.bench.length !== BENCH_SLOTS) {
      var b = []; for (var i = 0; i < BENCH_SLOTS; i++) b.push(-1);
      if (Array.isArray(f.bench)) for (var j = 0; j < BENCH_SLOTS && j < f.bench.length; j++) b[j] = f.bench[j];
      f.bench = b;
    }
    if (!Array.isArray(f.has_fur)) f.has_fur = [];
    if (!Array.isArray(f.put_fur)) f.put_fur = [];
    if (!f.make || typeof f.make !== 'object') f.make = { id: 0, drawing: 0, started: 0, tool: 0, mat: 0, res: 0 };
    return f;
  }
  function home() { return !(st.frog && st.frog.status === 1); }
  function idb() { try { return Tabikaeru.DataManager.instance().ItemDB; } catch (e) { return null; } }
  function fdb() { try { return Tabikaeru.DataManager.instance().FurnitureDB; } catch (e) { return null; } }
  function typeOf(id) { var db = idb(), d = db && db.get ? db.get(Number(id)) : null; return d ? Number(d.type) : 0; }
  function house() { return Array.isArray(st.house) ? st.house : (st.house = []); }
  function houseCount(id) { var h = house(); for (var i = 0; i < h.length; i++) if (h[i] && Number(h[i].item_id) === Number(id)) return Number(h[i].count) || 0; return 0; }
  function houseTake(id, n) {
    var h = house();
    for (var i = 0; i < h.length; i++) if (h[i] && Number(h[i].item_id) === Number(id)) {
      if ((Number(h[i].count) || 0) < n) return false;
      h[i].count = Number(h[i].count) - n; return true;
    }
    return false;
  }
  function houseGive(id, n) {
    var h = house();
    for (var i = 0; i < h.length; i++) if (h[i] && Number(h[i].item_id) === Number(id)) { h[i].count = (Number(h[i].count) || 0) + n; return; }
    h.push({ item_id: Number(id), count: n });
  }
  /* 台面工具行: 台面上有 type12 就用它, 否则用家里的(与 furniture_load_furniture 的补位逻辑一致) */
  function benchTool(f) {
    for (var i = 0; i < 5; i++) { var id = Number(f.bench[i]); if (id > 0 && typeOf(id) === 12) return id; }
    var h = house();
    for (var j = 0; j < h.length; j++) { var hid = Number(h[j] && h[j].item_id); if (hid > 0 && typeOf(hid) === 12 && (Number(h[j].count) || 0) > 0) return hid; }
    return 0;
  }
  /* 材料行的特殊材料(type 11): 优先台面上摆着的 */
  function benchMat(f) {
    for (var i = 5; i < BENCH_SLOTS; i++) { var id = Number(f.bench[i]); if (id > 0 && typeOf(id) === 11 && houseCount(id) > 0) return id; }
    var h = house();
    for (var j = 0; j < h.length; j++) { var hid = Number(h[j] && h[j].item_id); if (hid > 0 && typeOf(hid) === 11 && (Number(h[j].count) || 0) > 0) return hid; }
    return 0;
  }
  /* 普通材料(type 10 松木/楠竹/砂石…): 挑储量最多的那件 */
  function bestRes() {
    var h = house(), best = 0, bestN = 0;
    for (var i = 0; i < h.length; i++) {
      var id = Number(h[i] && h[i].item_id), n = Number(h[i] && h[i].count) || 0;
      if (id > 0 && n > bestN && typeOf(id) === 10) { best = id; bestN = n; }
    }
    return best;
  }
  /* 玩家拥有的图纸(103xx, type 13) */
  function ownedDrawings() {
    var out = {}, h = house();
    for (var i = 0; i < h.length; i++) {
      var id = Number(h[i] && h[i].item_id), n = Number(h[i] && h[i].count) || 0;
      if (id > 0 && n > 0 && typeOf(id) === 13) out[id] = 1;
    }
    return out;
  }
  function pickFurniture(f, draw, matIds) {
    var db = fdb(); if (!db || typeof db.list !== 'function') return null;
    var all = db.list() || [], owned = {}, best = null;
    for (var i = 0; i < f.has_fur.length; i++) owned[Number(f.has_fur[i])] = 1;
    for (var j = 0; j < all.length; j++) {
      var row = all[j]; if (!row) continue;
      var fid = Number(row.id); if (!fid || owned[fid]) continue;
      var dg = Number(row.drawing || 0); if (!dg || !draw[dg]) continue;
      /* 材料总量校验(new/furnstyle.js: 8 种特殊材料决定风格):
         台面上摆了特殊材料时, 只做那个材料能做的风格 —— 免得"随便放块石头就做出古琴"。 */
      try {
        if (matIds && matIds.length && window.MOCK_FURNSTYLE && window.MOCK_FURNSTYLE.canMake) {
          if (!window.MOCK_FURNSTYLE.canMake(row, matIds).ok) continue;
        }
      } catch (e) {}
      if (!best || fid < Number(best.id)) best = row;
    }
    return best;
  }
  /* 台面资源行显示的是 "house 数量 - mate_list 里被占用的数量", 所以制作期间把材料挂进 mate_list */
  var prevPayload = S['furniture_load_furniture'];
  S['furniture_load_furniture'] = function () {
    var r = (typeof prevPayload === 'function') ? (prevPayload() || {}) : (prevPayload || {});
    try {
      var f = fs(), mk = f.make, list = [];
      if (mk && mk.id) { if (mk.mat) list.push(mk.mat); if (mk.res) list.push(mk.res); }
      r.mate_list = list;
    } catch (e) {}
    return r;
  };

  var said = {};
  function start(f, tool, mat, res, cand) {
    var sessions = sessionCount(), secs = sessionSeconds();
    f.make = { id: Number(cand.id), drawing: Number(cand.drawing), started: nowSec(), tool: tool, mat: mat, res: res,
               seconds: secs, endsAt: nowSec() + secs,
               sessions: sessions, done: 0, phase: 'work', sessionEndsAt: nowSec() + secs,
               motion: craftMotion(cand), totalSeconds: secs * sessions };
    save();
    log('开工: 家具' + cand.id + '(' + (cand.name || '?') + ') ← 图纸' + cand.drawing +
        ' 工具' + tool + ' 材料' + mat + (res ? '+' + res : '') + ' 共 ' + sessions + ' 段(每段 ' + secs + ' 秒, ' +
        (MOTION_LABEL[f.make.motion] || '干活') + ')' + (isBigFur(cand) ? '(大件)' : '') +
        '; mate_list=[' + [mat, res].filter(Boolean).join(',') + ']');
    /* 用户: "青蛙造家具干活不给提示, 我也不知道它在不在造" —— 客户端屋里那套动画里
       FrogMotionName[3] = "sagyou_ie"(做手工/削木头, updateFlogStatus 里坐在椅子上做),
       所以开工期间把 frog.motion 钉在 3 并 refresh 小屋视图; new/frogstate.js 在此期间不再随机换动作。 */
    try {
      if (st.frog && st.frog.status !== 1) {
        /* 5..9 是**庭院**的专属工序动画: 放在 motion 上以后, 屋里 updateFlogStatus 走 default 不画青蛙,
           而庭院 MainOutView 会播锯/刷/敲/编/裁 —— 正是"在庭院里做家具"的样子 */
        /* 回到**室内**动作(3 = sagyou_ie 做手工): 5..9 那套庭院工序动画每次重画都会新建一个动画精灵,
           累积后会把场景盖住(用户: "拖不动场景 + 日历/聚会按钮被遮挡")。室内动作不新建额外精灵。 */
        st.frog.motion = 3; st.frog.motionSince = nowSec(); st.frog.motionHold = secs; st.frog.crafting = 1;
        save();
        push('client_load_role', (typeof S['client_load_role'] === 'function') ? S['client_load_role']() : null, 30);

        try { if (window.MOCK_REFRESH_ROOM) window.MOCK_REFRESH_ROOM('开工'); } catch (e) {}
        log('庭院开始播做家具动画 (' + (MOTION_LABEL[f.make.motion] || f.make.motion) + '), 这一段 ' + secs + ' 秒');
      }
    } catch (e) {}
  }
  function finish(f) {
    var mk = f.make, db = fdb(), row = (db && db.get) ? db.get(mk.id) : null;
    var okMat = mk.mat ? houseTake(mk.mat, 1) : false;
    var okRes = mk.res ? houseTake(mk.res, 1) : true;
    if (mk.mat && !okMat) {  /* 材料被别处花掉了: 这一单作废 */
      log('作废: 家具' + mk.id + ' 的材料' + mk.mat + ' 已经不够了 -> 停手(不再播做家具动画)');
      f.make = { id: 0, drawing: 0, started: 0, tool: 0, mat: 0, res: 0 };
      if (st.frog) { st.frog.crafting = 0; st.frog.motionSince = 0; }
      save();
      push('client_load_role', (typeof S['client_load_role'] === 'function') ? S['client_load_role']() : null, 40);

      push('furniture_load_furniture');
      return;
    }
    if (f.has_fur.indexOf(mk.id) < 0) f.has_fur.push(mk.id);
    /* 材料用光就把台面那一格清掉, 客户端才知道要再放 */
    if (mk.mat && houseCount(mk.mat) <= 0) {
      for (var i = 5; i < BENCH_SLOTS; i++) if (Number(f.bench[i]) === Number(mk.mat)) f.bench[i] = -1;
    }
    log('完成: 家具' + mk.id + '(' + ((row && row.name) || '?') + ') 进 has_fur(共' + f.has_fur.length + ')' +
        ' 消耗 ' + mk.mat + 'x1' + (mk.res ? ' + ' + mk.res + 'x1' : '') + (okRes ? '' : ' (普通材料不足, 只扣了特殊材料)'));
    f.make = { id: 0, drawing: 0, started: 0, tool: 0, mat: 0, res: 0 };
    /* 干完了: 松开动画, 让居家状态机继续挑新动作 */
    try {
      if (st.frog) { st.frog.crafting = 0; st.frog.motionSince = 0; }
      save();
      setTimeout(function () { try { if (window.MOCK_REFRESH_ROOM) window.MOCK_REFRESH_ROOM('家具完成'); } catch (e) {} }, 60);
      push('client_load_role', (typeof S['client_load_role'] === 'function') ? S['client_load_role']() : null, 40);
    } catch (e) {}
    push('item_load_items');
    /* 客户端 case TimerEvent.Type.FurnitureFinish(21): evt_id = 家具 id -> 播报"获得新家具" + 展示。
       走 MOCK_NOTICE: 玩家正盯着游戏时不弹(数据已经推过去了, 家具就在家具列表里), 页面不可见/回来时再播报。 */
    try {
      if (window.MOCK_NOTICE) window.MOCK_NOTICE(21, [], { evt_id: mk.id }, 'furniturefinish');
      else if (window.MOCK_EVENT) window.MOCK_EVENT(21, [], { evt_id: mk.id });
    } catch (e) {}
  }
  function tick() {
    try {
      var f = fs(), mk = f.make;
      if (mk && mk.id) {                        /* 正在做(分段) */
        var now2 = nowSec(), row2 = fdb() && fdb().get ? fdb().get(mk.id) : null;
        if (mk.phase === 'pause') {
          if (now2 >= Number(mk.pauseEndsAt || 0)) {          /* 歇够了 -> 下一段(先确认材料还在) */
            if (mk.mat && houseCount(mk.mat) <= 0) {
              log('材料没了(' + mk.mat + ') -> 这一单作废, 不再开工、不播动画');
              f.make = { id: 0, drawing: 0, started: 0, tool: 0, mat: 0, res: 0 };
              if (st.frog) { st.frog.crafting = 0; st.frog.motionSince = 0; }
              save();
              push('client_load_role', (typeof S['client_load_role'] === 'function') ? S['client_load_role']() : null, 40);
        
              return;
            }
            mk.phase = 'work'; mk.sessionEndsAt = now2 + sessionSeconds(); mk.motion = 3;   /* 同上: 用室内动作 */

            save();
            if (st.frog && st.frog.status !== 1) {
              st.frog.motion = 3; st.frog.motionSince = now2; st.frog.motionHold = sessionSeconds(); st.frog.crafting = 1;
              save();
              push('client_load_role', (typeof S['client_load_role'] === 'function') ? S['client_load_role']() : null, 30);

            }
            log('工作台: 第 ' + (Number(mk.done) + 1) + '/' + Number(mk.sessions) + ' 段开工 (' + (MOTION_LABEL[mk.motion] || mk.motion) + ')');
          }
          return;
        }
        if (now2 >= Number(mk.sessionEndsAt || 0)) {          /* 这一段做完了 */
          mk.done = Number(mk.done || 0) + 1;
          if (mk.done >= Number(mk.sessions || 1)) { log('工作台: 全部 ' + mk.sessions + ' 段做完 -> 出家具'); finish(f); return; }
          mk.phase = 'pause'; mk.pauseEndsAt = now2 + pauseSeconds();
          if (st.frog) { st.frog.crafting = 0; st.frog.motionSince = 0; }
          save();
          push('client_load_role', (typeof S['client_load_role'] === 'function') ? S['client_load_role']() : null, 40);

          log('工作台: 第 ' + mk.done + '/' + mk.sessions + ' 段做完, 歇 ' + Math.round(Number(mk.pauseEndsAt - now2) / 60) + ' 分钟后继续');
        }
        return;
      }
      if (!home()) { if (!said.travel) { said.travel = 1; log('青蛙不在家, 不开工'); } return; }
      said.travel = 0;
      var unlockAll = Number(st.furnitureUnlockAll || 0) !== 0;
      var tool = benchTool(f), mat = benchMat(f), draw = ownedDrawings();
      if (!tool) { if (!said.tool) { said.tool = 1; log('工具行是空的(台面/家里都没有 type12 工具), 不开工'); } return; }
      said.tool = 0;
      if (!mat) { if (!said.mat) { said.mat = 1; log('材料行没有特殊材料(type11), 不开工'); } return; }
      said.mat = 0;
      var cand = pickFurniture(f, draw, [mat]);
      if (!cand) {
        if (!said.none) {
          said.none = 1;
          log('没有可做的家具: 图纸' + Object.keys(draw).length + ' 张, 家具表 ' + (fdb() && fdb().list ? fdb().list().length : '?') +
              ' 件, 已拥有 ' + f.has_fur.length + (unlockAll ? ' [furnitureUnlockAll=1: 全部解锁, 所以没有可做的]' : '') +
              (function () { try { return ' | 台面材料 ' + mat + ' 能做的风格: ' + (window.MOCK_FURNSTYLE ? window.MOCK_FURNSTYLE.stylesOf(mat).map(window.MOCK_FURNSTYLE.styleName).join('/') : '?'); } catch (e) { return ''; } })());
        }
        return;
      }
      said.none = 0;
      start(f, tool, mat, bestRes(), cand);
    } catch (e) { try { console.log('[MOCK] 工作台 tick 出错: ' + (e && e.message || e)); } catch (e2) {} }
  }
  setInterval(tick, TICK);
  tick();
  /* 调试/测试钩子: window.MOCK_MAKE.tick() 立刻跑一次; .state() 看当前这一单; .finish() 直接完成 */
  window.MOCK_MAKE = {
    tick: tick,
    state: function () { var f = fs(); return { make: f.make, bench: f.bench.slice(), has_fur: f.has_fur.length, mate_list: (function () { try { return S['furniture_load_furniture']().mate_list; } catch (e) { return null; } })() }; },
    /* 直接做完这一单(把剩下所有段一次跑完) */
    finish: function () {
      var f = fs();
      if (f.make && f.make.id) {
        f.make.phase = 'work';
        f.make.done = Number(f.make.sessions || 1);      /* 假装剩下的段都做完了 */
        f.make.sessionEndsAt = nowSec() - 1;
        tick();
      }
    },
    /* 设定/查看耗时(秒); 传 0 = 回到默认(普通 600 / 大件 1800) */
    seconds: function (v) {
      if (v === undefined || v === null) return Number(st.makeSeconds || 0) || MAKE_SECONDS + '(普通)/' + MAKE_SECONDS_BIG + '(大件)';
      st.makeSeconds = Number(v) || 0; save(); return makeSeconds(null);
    },
    default: MAKE_SECONDS, big: MAKE_SECONDS_BIG
  };
  log('制作层就绪: 图纸↔家具 用 furnitureData.drawing 配对; 需要 工具(type12)+特殊材料(type11); ' +
      Math.round(MAKE_SECONDS / 60) + ' 分钟一件(大件 ' + Math.round(MAKE_SECONDS_BIG / 60) + ' 分钟, st.makeSeconds 可覆盖); furnitureUnlockAll=' +
      (Number(st.furnitureUnlockAll || 0) ? 1 : 0));
})();
