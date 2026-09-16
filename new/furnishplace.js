/* lxqw 家具摆放/更换 —— 由**青蛙决定**（原版行为），additive layer.
 *
 * 用户 2026-09-15: 先前那句"原版玩家不能自己摆家具、由青蛙决定"**已作废** —— 玩家要能自己摆/换。
 * (旧记录) 用户核实(2026-09-15): "原版好像玩家本来就不能自己摆家具，是由青蛙决定的…"。
 * 这与客户端里的证据一致:
 *   · 「重新布置」按钮 = GameConfig.decorate_open && ... , 而 decorate_open 在 APK 里**默认 false**
 *     (只有微信小游戏运行环境 / 远程配置 / 测试渠道 才会打开) -> 原版安卓包里玩家根本进不去;
 *   · 工作台 FurnitureBenchView 只有三行(工具/材料/资源)**没有任何制作按钮**, 官方引导图写着
 *     "要有足够的材料和工具，蛙蛙才会做家具哦" -> 摆放是玩家的事, 开工与制作是青蛙的事。
 * 所以本层现在按原版来:
 *   A) 入口默认**不开**(玩家不能自己摆); 只有存档里 st.furnishUI=1(GM `/gm furnish ui 1`)才打开,
 *      留给"我就想自己摆"的玩家;
 *   B) 摆放由**青蛙自己决定**: 进屋的家具自动每类摆一件(等价于"它早就摆好了"), 之后它每隔
 *      FROG_GAP 左右自己动手换一件, 并播报"小屋好像发生了一点变化"(22);
 *   C) furniture_replace_fur 的记账仍然完整(契约: 一件一条, code 0/1 的语义) —— 玩家模式下用得上。
 *
 * 旧注释(留档): 客户端 `FurnitureModel.replaceFurniture()` 是
 *
 * **一件一条协议**:
 *      **一件一条协议**:
 *        send("furniture_replace_fur", Action2(cb), <家具id>)
 *        cb: code == -1 -> 什么都不做(静默忽略)
 *            code == 1 -> 客户端把该 type 从 serverData.replace_fur 里删掉(= 服务端拒绝这一件)
 *            code == 0 -> 客户端把 type 推进 replace_fur, 并把 put_fur 里同 type 的条目换成 {type,id}
 *      所以服务端必须: 拥有的才放行(code 0) 并同步 put_fur/replace_fur; 不拥有回 code 1。
 *      摆放完还要让小屋重画: 推 furniture_load_furniture + FurnitureEventType.UPDATE
 *      (MainInController 监听 FurnitureEventType.UPDATE -> view.updateFurniture()) + 播报 22。
 */
(function () {
  var M = window.MockServer, st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  function log(m) { try { console.log('[MOCK] 家具摆放: ' + m); } catch (e) {} }
  function save() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function fdb() { try { var dm = Tabikaeru.DataManager.instance(); return dm && (dm.FurnitureDB || dm.furnitureDB); } catch (e) { return null; } }
  function furRow(id) { try { var db = fdb(); return (db && db.get) ? db.get(id) : null; } catch (e) { return null; } }
  function furType(id) { var r = furRow(id); return r ? num(r.type) : 0; }
  function fs() {
    var f = st.furniture;
    if (!f || typeof f !== 'object') f = st.furniture = {};
    if (!Array.isArray(f.put_fur)) f.put_fur = [];
    if (!Array.isArray(f.has_fur)) f.has_fur = [];
    if (!Array.isArray(f.replace_fur)) f.replace_fur = [];
    return f;
  }
  function owns(id) { var f = fs(), a = f.has_fur; for (var i = 0; i < a.length; i++) if (num(a[i]) === num(id)) return true; return false; }

  /* ---------- A) 客户端入口 ------------------------------------------------- */
  /* 玩家能不能自己摆: 原版=不能(decorate_open 默认 false)。st.furnishUI=1 才打开入口。 */
  /* 用户 2026-09-15 澄清: 之前"原版玩家不能自己摆"的说法**不算数** -> 玩家可以自己摆, 默认开。
     st.furnishUI=0 可以关掉(回到"只有青蛙摆")。 */
  function uiWanted() { if (st.furnishUI === undefined || st.furnishUI === null) return true; return num(st.furnishUI) === 1; }
  function patchGameConfig() {
    try {
      if (!window.GameConfig) return false;
      if (!uiWanted()) {
        if (window.GameConfig.decorate_open !== false && window.GameConfig.decorate_open !== undefined) {
          window.GameConfig.decorate_open = false;
          log('保持原版: decorate_open=false（玩家不能自己摆家具, 由青蛙决定; 想自己摆用 /gm furnish ui 1）');
        }
        return true;
      }
      if (window.GameConfig.decorate_open !== true) {
        window.GameConfig.decorate_open = true;
        log('st.furnishUI=1 -> 打开 GameConfig.decorate_open（「重新布置」的前置开关）');
      }
      return true;
    } catch (e) { return false; }
  }
  function patchFurnitureView() {
    if (!uiWanted()) return true;                 /* 原版模式: 按钮就是不该出现, 不打补丁 */
    var V = window.FurnitureView;
    if (!V || !V.prototype || typeof V.prototype.updateDecorate !== 'function') return false;
    if (V.prototype.__mockFurnishPatched) return true;
    V.prototype.updateDecorate = function () {
      /* 原版: decorate_open && isOpen() && !isHome && state=="normal"
         离线服: 只要开关开着 + 不在替换模式里, 就让按钮出现(青蛙在家也能布置) */
      var vis = false;
      try { vis = !!(window.GameConfig && window.GameConfig.decorate_open && this.currentState === 'normal'); } catch (e) {}
      try { if (this.btnRefurniture) { this.btnRefurniture.includeInLayout = vis; this.btnRefurniture.visible = vis; } } catch (e) {}
      return vis;
    };
    V.prototype.__mockFurnishPatched = true;
    log('FurnitureView.updateDecorate 已替换: 不再要求"商人档期 + 青蛙不在家"');
    return true;
  }
  function installEntry(retries) {
    var a = patchGameConfig(), b = patchFurnitureView();
    if ((!a || !b) && (retries || 0) < 40) {
      setTimeout(function () { installEntry((retries || 0) + 1); }, 1500);
    } else if (a && b) {
      log(uiWanted() ? '入口就绪: 家具窗口会出现「重新布置」(st.furnishUI=1)' :
                       '入口关闭(原版): 家具由青蛙自己摆, 玩家只负责准备材料/工具');
    }
  }
  installEntry(0);

  /* ---------- B) 摆放记账 --------------------------------------------------- */
  var pushTimer = null;
  function syncRoom(why, id) {
    /* 小屋视图监听 FurnitureEventType.UPDATE; 找不到事件名就直接调 roompatch 的重画 */
    try {
      var evName = null;
      try { evName = (window.FurnitureEventType && FurnitureEventType.UPDATE) || null; } catch (e) {}
      if (!evName) evName = 'FurnitureEventType_update';
      var d = core.ServiceDispatcher.getInstance();
      if (d && d.hasEventListener && d.hasEventListener(evName)) d.dispatchEvent(new core.Event(evName, null));
    } catch (e) {}
    /* 播报 22「小屋好像发生了一点变化」—— 页面可见时由 MOCK_NOTICE 挂起 */
    try {
      if (window.MOCK_NOTICE) window.MOCK_NOTICE(22, [], { evt_id: num(id) }, 'furnitureput');
      else if (window.MOCK_EVENT) window.MOCK_EVENT(22, [], { evt_id: num(id) });
    } catch (e) {}
    log('小屋已重画 (' + (why || '') + ')');
  }
  function syncServer(delay) {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      pushTimer = null;
      try { M.dispatch('furniture_load_furniture', (typeof S['furniture_load_furniture'] === 'function') ? S['furniture_load_furniture']() : null); } catch (e) {}
    }, delay || 1200);
  }

  var prevReplace = S['furniture_replace_fur'];
  S['furniture_replace_fur'] = function (p) {
    var id = num(p && (p.id !== undefined ? p.id : (p.fur_id !== undefined ? p.fur_id : p.item_id)));
    if (!id) { log('请求里没有家具 id -> code 1'); return { code: 1 }; }
    var t = furType(id);
    if (!t) { log('FurnitureDB 查不到 id=' + id + ' -> code 1'); return { code: 1 }; }
    if (!owns(id)) {
      log('还没拥有家具 ' + id + ' -> code 1（客户端会把该 type 从 replace_fur 撤回）');
      return { code: 1 };
    }
    var f = fs(), kept = [];
    for (var i = 0; i < f.put_fur.length; i++) {
      var e = f.put_fur[i];
      if (e && num(e.type) === t) continue;              /* 同一类只留一件(客户端也是这么做的) */
      kept.push(e);
    }
    kept.push({ id: id, type: t });
    f.put_fur = kept;
    if (f.replace_fur.map(num).indexOf(t) < 0) f.replace_fur.push(t);   /* 玩家亲手换过的类别 */
    save();
    log('摆进小屋: type=' + t + ' id=' + id + '(' + ((furRow(id) || {}).name || '?') + ') 共 ' + kept.length + ' 件, 换过的类别 ' + JSON.stringify(f.replace_fur));
    syncRoom('摆放', id);
    syncServer(1200);
    return { code: 0 };
  };

  /* 摆放数据补全: 让"已拥有但还没摆"的家具自动进屋(每类一件), 玩家亲手换过的类别不动 */
  var prevLoad = S['furniture_load_furniture'];
  S['furniture_load_furniture'] = function () {
    var r = (typeof prevLoad === 'function') ? (prevLoad() || {}) : (prevLoad || {});
    try {
      var f = fs();
      r.put_fur = Array.isArray(r.put_fur) ? r.put_fur.slice() : [];
      r.replace_fur = Array.isArray(r.replace_fur) ? r.replace_fur.slice() : [];
      /* 客户端读 put_fur[i].id / .type, 条目必须是对象 */
      var types = {}, i;
      for (i = 0; i < r.put_fur.length; i++) { var e = r.put_fur[i]; if (e && typeof e === 'object') types[num(e.type)] = 1; }
      var auto = num(st.autoPlaceFur === undefined ? 1 : st.autoPlaceFur) !== 0;
      var added = 0;
      if (auto) {
        for (i = 0; i < f.has_fur.length; i++) {
          var id = num(f.has_fur[i]);
          if (!id) continue;
          var t = furType(id);
          if (!t || types[t]) continue;                   /* 这一类已经有东西了 -> 尊重玩家/既有摆放 */
          r.put_fur.push({ id: id, type: t }); types[t] = 1; added++;
        }
      }
      /* 客户端 getReplaced() = put_fur 里 type 在 replace_fur 里的那些 */
      for (i = 0; i < f.replace_fur.length; i++) { var t2 = num(f.replace_fur[i]); if (t2 && r.replace_fur.map(num).indexOf(t2) < 0) r.replace_fur.push(t2); }
      if (added) log('自动摆放 ' + added + ' 件(每类一件, st.autoPlaceFur=0 可关) -> put_fur ' + r.put_fur.length + ' 件');
    } catch (e) {}
    return r;
  };

  /* ---------- C) 青蛙自己决定摆放 ----------------------------------------- */
  var FROG_GAP = 25 * 60 * 1000;                  /* 它大约每隔这么久动一件家具 */
  function home() { return !(st.frog && st.frog.status === 1); }
  function frogTick(force) {
    try {
      if (!force) {
        if (uiWanted()) return 0;                 /* 玩家自己摆的模式下, 青蛙不动手 */
        if (!home()) return 0;
        if (Date.now() - num(st.frogFurnishAt) < FROG_GAP) return 0;
        if (Math.random() > 0.5) { st.frogFurnishAt = Date.now(); save(); return 0; }   /* 有时只是转一圈 */
      }
      st.frogFurnishAt = Date.now(); save();
      var f = fs(), owned = f.has_fur.slice(), i;
      if (!owned.length) return 0;
      var placedTypes = {};
      for (i = 0; i < f.put_fur.length; i++) placedTypes[num(f.put_fur[i].type)] = 1;
      var cand = null;
      for (i = 0; i < owned.length; i++) { var t = furType(owned[i]); if (t && !placedTypes[t]) { cand = num(owned[i]); break; } }
      var swapping = false;
      if (!cand) {                                 /* 每类都摆好了 -> 换掉随机一件 */
        if (!f.put_fur.length) return 0;
        var cur = f.put_fur[Math.floor(Math.random() * f.put_fur.length)];
        if (!cur) return 0;
        var same = [];
        for (i = 0; i < owned.length; i++) if (furType(owned[i]) === num(cur.type) && num(owned[i]) !== num(cur.id)) same.push(num(owned[i]));
        if (!same.length) return 0;
        cand = same[Math.floor(Math.random() * same.length)];
        swapping = true;
      }
      var t2 = furType(cand);
      if (!t2) return 0;
      var kept = [];
      for (i = 0; i < f.put_fur.length; i++) if (num(f.put_fur[i].type) !== t2) kept.push(f.put_fur[i]);
      kept.push({ id: cand, type: t2 });
      f.put_fur = kept;
      st.furnishLog = arr(st.furnishLog);
      st.furnishLog.push({ id: cand, type: t2, swap: swapping ? 1 : 0, at: Date.now() });
      if (st.furnishLog.length > 30) st.furnishLog = st.furnishLog.slice(-30);
      save();
      log('青蛙自己动手: ' + (swapping ? '换掉' : '摆上') + ' type=' + t2 + ' -> ' + cand +
          '(' + ((furRow(cand) || {}).name || '?') + ') 共 ' + kept.length + ' 件');
      syncRoom('青蛙摆放', cand);
      syncServer(1200);
      return cand;
    } catch (e) { return 0; }
  }
  setInterval(function () { try { frogTick(false); } catch (e) {} }, 60000);

  /* 调试/GM 入口 */
  window.MOCK_FURNISH = {
    place: function (id) { return S['furniture_replace_fur']({ id: id }); },
    state: function () {
      var f = fs();
      return { put_fur: f.put_fur.slice(), replace_fur: f.replace_fur.slice(), has_fur: f.has_fur.length, auto: num(st.autoPlaceFur === undefined ? 1 : st.autoPlaceFur) !== 0 };
    },
    clear: function () { var f = fs(); f.put_fur = []; f.replace_fur = []; save(); log('已清空摆放'); return true; },
    auto: function (v) { st.autoPlaceFur = num(v) ? 1 : 0; save(); return st.autoPlaceFur; },
    frog: function () { return frogTick(true); },                     /* 让青蛙立刻动一件 */
    /* 重装客户端入口补丁(改过 st.furnishUI 之后调用, 等价于"重载页面") */
    installUI: function () { installEntry(0); return uiWanted(); },
    ui: function (v) { st.furnishUI = num(v) ? 1 : 0; save(); return st.furnishUI; },
    log: function () { return arr(st.furnishLog).slice(); }
  };
})();
