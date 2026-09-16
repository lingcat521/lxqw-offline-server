/* lxqw offline furniture: 家具摆放 (bench / box / room) — additive layer.
 *
 * The core decorating loop was missing entirely: the client sends
 *   furniture_putin_bench(pos,id) / furniture_takeout_bench(pos)
 *   furniture_putin_box(pos,id)   / furniture_takeout_box(pos)
 *   furniture_replace_fur(id)                      (put furniture in the room)
 * and all four were NO-HANDLER on the device. Client contract (FurnitureModel):
 *   serverData = { shop:{shop_list,start_time,leave_time}, mood, bench_lock,
 *                  bench:[10], put_fur:[{id,type}], has_fur:[], replace_fur:[] }
 *   bench.slice(0,5) = 工具槽, bench.slice(5) = 家具槽, pos is 1-based on the wire
 *   furniture_replace_fur answers {code}: 0 = ok, 1 = refused (client then drops it)
 * This layer only ADDS handlers and WRAPS the existing ones, it never rewrites them.
 */
(function () {
  var M = window.MockServer, st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  function log(m) { try { console.log("[MOCK] " + m); } catch (e) {} }
  var BENCH_SLOTS = 10, BOX_SLOTS = 6;

  function fs() {
    var f = st.furniture;
    if (!f || typeof f !== "object") f = st.furniture = {};
    if (!Array.isArray(f.bench) || f.bench.length !== BENCH_SLOTS) {
      var b = []; for (var i = 0; i < BENCH_SLOTS; i++) b.push(-1);
      if (Array.isArray(f.bench)) for (var j = 0; j < BENCH_SLOTS && j < f.bench.length; j++) b[j] = f.bench[j];
      f.bench = b;
    }
    if (!Array.isArray(f.box)) f.box = [];
    if (!Array.isArray(f.put_fur)) f.put_fur = [];
    if (!Array.isArray(f.has_fur)) f.has_fur = [];
    return f;
  }
  function save() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
  function push(name, d) { setTimeout(function () { try { M.dispatch(name, (typeof S[name] === "function" ? S[name]() : S[name])); } catch (e) {} }, d || 30); }
  function furType(id) {   /* ask the client's own table, never guess */
    try {
      var dm = Tabikaeru.DataManager.instance();
      var cfg = dm && dm.FurnitureDB ? dm.FurnitureDB.get(id) : null;
      if (cfg && typeof cfg.type === "number") return cfg.type;
    } catch (e) {}
    return null;
  }

  /* ---- wrap the whole-state handlers so live state is merged in ---- */
  var origFur = S["furniture_load_furniture"];
  S["furniture_load_furniture"] = function () {
    var base = (typeof origFur === "function") ? origFur() : (origFur || {});
    if (!base || typeof base !== "object") base = {};
    var f = fs();
    base.shop = base.shop || { shop_list: [], start_time: 0, leave_time: 0 };
    base.bench = f.bench.slice();
    /* 崩溃回归(2026-09-14 getReplaced): 客户端
         getReplaced(): for (r of serverData.put_fur) { o = FurnitureDB.get(r.id); if (replace_fur.indexOf(o.type) ...) }
       只要 put_fur 里有一条 id 在 furnitureData 表里查不到, o 就是 undefined -> `o.type` 抛异常
       (栈: onSelectGroupChange -> update -> getReplaced)。所以出口处**必须**把查不到的 id 剔掉,
       并保证 replace_fur 是数字数组(type), 而不是 id。 */
    var putOk = [], dbReady = false;
    try {
      var _dm2 = Tabikaeru.DataManager.instance();
      var _db = _dm2 && (_dm2.FurnitureDB || _dm2.furnitureDB);
      var _rows = (_db && typeof _db.list === 'function') ? (_db.list() || []) : [];
      if (_rows.length > 0) dbReady = true;
      else {
        /* 有的环境(测试桩/老客户端)只有 get 没有 list: 抽查几行, 能解析出 type 就说明表在应答 */
        var probe = arr(f.has_fur).concat(arr(f.put_fur).map(function (r) { return r && r.id; })).slice(0, 6);
        for (var qi = 0; qi < probe.length; qi++) { if (probe[qi] && furType(Number(probe[qi])) !== null) { dbReady = true; break; } }
      }
    } catch (e) { dbReady = false; }
    for (var pi = 0; pi < f.put_fur.length; pi++) {
      var row = f.put_fur[pi]; if (!row) continue;
      var ty = furType(Number(row.id));
      /* ⚠️ 只在**家具表确实读到了**、且确实查不到这个 id 时才丢;
         表还没就绪(启动早期/DB 异常)一律保留原行 —— 否则一次误判会把整屋已摆放家具全清掉,
         玩家看到的就是"造家具的地方/摆好的家具没了"。 */
      if (ty === null && dbReady) { try { console.log('[MOCK] 家具摆放: 丢弃表里不存在的 id ' + row.id); } catch (e) {} ; continue; }
      putOk.push({ id: Number(row.id), type: (ty === null ? num(row.type) : ty) });
    }
    if (putOk.length !== f.put_fur.length) { log('家具摆放: 剔除了 ' + (f.put_fur.length - putOk.length) + ' 条表里查不到的 id(否则客户端 getReplaced 会崩)'); f.put_fur = putOk; }
    base.put_fur = putOk.slice();
    /* ① has_fur 也做同样的非破坏性清洗: 只保留家具表里真有的 id ——
       以前 has_fur 有 227 条, 混着图纸(10305/10311)与普通物品(1001/1002),
       客户端"小仓库-家具"按 FurnitureDB.get(id) 逐条渲染 -> 幽灵行会让整页看起来"家具都没了"。 */
    try {
      f.has_fur = Array.isArray(f.has_fur) ? f.has_fur : [];
      if (dbReady) {
        var hfOk = [];
        for (var hi = 0; hi < f.has_fur.length; hi++) {
          var hid = Number(f.has_fur[hi]);
          if (!hid) continue;
          if (furType(hid) === null) continue;
          if (hfOk.indexOf(hid) < 0) hfOk.push(hid);
        }
        if (hfOk.length !== f.has_fur.length) {
          log('家具仓库: has_fur 清理 ' + f.has_fur.length + ' -> ' + hfOk.length + ' 条(剔除图纸/道具/幽灵 id)');
          f.has_fur = hfOk;
        }
      }
      base.has_fur = f.has_fur.slice();
    } catch (e) { base.has_fur = (f.has_fur || []).slice(); }
    /* ② replace_fur = 当前屋里已摆放的 type 集合(客户端"已摆放/替换"那栏读它),
       与 put_fur 一一对应, 并随存档落盘 —— 以前它一直是空的, 界面那栏就是空的。 */
    try {
      var seenT = {}; f.replace_fur = [];
      for (var ri2 = 0; ri2 < putOk.length; ri2++) { var ty2 = Number(putOk[ri2].type); if (!ty2 || seenT[ty2]) continue; seenT[ty2] = 1; f.replace_fur.push(ty2); }
      base.replace_fur = f.replace_fur.slice();
    } catch (e) { base.replace_fur = []; }
    base.has_fur = f.has_fur.slice();
    /* replace_fur 由上面的 put_fur 派生(见上), 这里不再单独过滤 */
    if (typeof base.mood !== "number") base.mood = 0;
    /* 工作台状态(清单 §9"空闲/制作中/完成"): 客户端只有两个状态通道 —— isLockBench()=bench_lock
       ("呱~不许动") 与 mood(very_angry 罢工图)。以前两者恒 false/0, 所以制作中和出门时台面照样能乱点。
       规则: 青蛙出门 或 正在做家具 -> 台面锁住; mood 可由 st.mood 覆盖(GM 调试用), 默认 0。 */
    var making = !!(st.furniture && st.furniture.make && st.furniture.make.id);
    var away = !!(st.frog && st.frog.status === 1);
    /* 用户报"青蛙不让我补充工作台": 客户端 isLockBench()=bench_lock 为真时会弹"呱~不许动"并禁止增删台面。
       原版是为了"别打扰正在干活的蛙", 但离线服里它 10~30 分钟就开工一次 + 出门几小时, 台面几乎一直锁着,
       玩家根本补充不了材料。所以默认**不锁**(st.benchLock=1 可恢复原版行为)。 */
    /* 默认: **正在做家具就锁**(客户端台面变灰 + 弹"呱~不许动", 原版行为);
       st.benchLock = 0 完全不锁(之前"不让我补充材料"的临时方案); = 2 连青蛙出门也锁。 */
    var bl = (st.benchLock === undefined || st.benchLock === null) ? 1 : Number(st.benchLock);
    if (bl === 0) base.bench_lock = false;
    else if (bl === 2) base.bench_lock = !!base.bench_lock || making || away;
    else base.bench_lock = making;
    if (typeof base.mood !== "number" || Number(st.mood) > 0) base.mood = Number(st.mood) || base.mood || 0;
    return base;
  };
  var origCompost = S["furniture_load_compost"];
  S["furniture_load_compost"] = function () {
    var base = (typeof origCompost === "function") ? origCompost() : (origCompost || {});
    if (!base || typeof base !== "object") base = {};
    var f = fs();
    base.box_list = f.box.slice();
    if (!Array.isArray(base.compost_list)) base.compost_list = [];
    return base;
  };

  /* ---- the four missing placement protocols ---- */
  S["furniture_putin_bench"] = function (p) {
    var f = fs(), pos = Number(p && p.pos) - 1;
    if (!(pos >= 0 && pos < BENCH_SLOTS)) return { code: 1 };
    f.bench[pos] = Number(p.id);
    save(); log("工具架/家具位 bench[" + pos + "] = " + p.id);
    return { code: 0 };
  };
  S["furniture_takeout_bench"] = function (p) {
    var f = fs(), pos = Number(p && p.pos) - 1;
    if (!(pos >= 0 && pos < BENCH_SLOTS)) return { code: 1 };
    var had = f.bench[pos];
    f.bench[pos] = -1;
    save(); log("取下 bench[" + pos + "] (was " + had + ")");
    return { code: 0 };
  };
  S["furniture_putin_box"] = function (p) {
    var f = fs(), pos = Number(p && p.pos) - 1;
    if (!(pos >= 0 && pos < BOX_SLOTS)) return { code: 1 };
    f.box[pos] = Number(p.id);
    save(); log("储物箱 box[" + pos + "] = " + p.id);
    return { code: 0 };
  };
  S["furniture_takeout_box"] = function (p) {
    var f = fs(), pos = Number(p && p.pos) - 1;
    if (!(pos >= 0 && pos < BOX_SLOTS)) return { code: 1 };
    f.box[pos] = 0;
    save(); log("储物箱清空 box[" + pos + "]");
    return { code: 0 };
  };

  /* ---- 把家具摆进小屋: answer {code:0} and remember {id,type} ---- */
  var origReplace = S["furniture_replace_fur"];
  S["furniture_replace_fur"] = function (p) {
    var id = Number(p && p.id);
    var t = furType(id);
    if (t === null) {
      log("家具摆放: FurnitureDB 查不到 id=" + id + " (仍然放行, 客户端自己记 type)");
      return { code: 0 };
    }
    var f = fs(), kept = [];
    for (var i = 0; i < f.put_fur.length; i++) if (f.put_fur[i] && f.put_fur[i].type !== t) kept.push(f.put_fur[i]);
    kept.push({ id: id, type: t });
    f.put_fur = kept;
    save(); log("家具摆放: 小屋里 type=" + t + " -> id=" + id + " (共 " + kept.length + " 件)");
    /* 客户端 case TimerEvent.Type.FurniturePut(22): "小屋好像发生了一点变化" */
    /* 客户端 case TimerEvent.Type.FurniturePut(22): "小屋好像发生了一点变化"。
       玩家自己刚做完替换动作, 页面上东西已经变了 —— 走 MOCK_NOTICE, 页面可见时挂起。 */
    try {
      if (window.MOCK_NOTICE) window.MOCK_NOTICE(22, [], { evt_id: id }, 'furnitureput');
      else if (window.MOCK_EVENT) window.MOCK_EVENT(22, [], { evt_id: id });
    } catch (e) {}
    return { code: 0 };
  };

  log("furniture ready: bench " + BENCH_SLOTS + " 槽, box " + BOX_SLOTS + " 槽, put_fur=" + fs().put_fur.length);

  /* ---- 解锁全部家具(用户: 工作台/桌子/地图/便条/窗灯都点不了, 说没解锁家具) -------
     客户端的小屋陈设由服务端下发的 has_fur(已拥有)/put_fur(已摆放) 驱动; 我们以前只给
     了少数几件, 所以工作台这些**根本没有被渲染**, 自然也点不了。这里把客户端家具表里的
     全部 id 补进 has_fur(仅解锁, 摆放仍由玩家自己在游戏里做), 并在日志里报数量。 */
  (function () {
    var prev = S['furniture_load_furniture'];
    S['furniture_load_furniture'] = function () {
      var r = (typeof prev === 'function') ? (prev() || {}) : (prev || {});
      try {
        var dm = Tabikaeru.DataManager.instance();
        var db = dm && (dm.FurnitureDB || dm.furnitureDB);
        var all = (db && typeof db.list === 'function') ? db.list() : null;
        if (all && all.length) {
          r.has_fur = Array.isArray(r.has_fur) ? r.has_fur.slice() : [];
          /* 先剔掉不是家具的 id —— 旧版购买处理把图纸 103xx 也塞进过 has_fur(客户端会当成坏家具渲染) */
          var furIds = {};
          for (var z = 0; z < all.length; z++) { var zid = Number(all[z] && all[z].id); if (zid) furIds[zid] = 1; }
          var kept2 = [], dropped2 = [];
          for (var y = 0; y < r.has_fur.length; y++) { var yid = Number(r.has_fur[y]); (furIds[yid] ? kept2 : dropped2).push(yid); }
          if (dropped2.length) { try { console.log('[MOCK] 家具: has_fur 里剔除非家具 id ' + dropped2.join(',')); } catch (e) {} }
          r.has_fur = kept2;
          var unlockAll = Number(st.furnitureUnlockAll || 0) !== 0;
          var seen = {};
          for (var i = 0; i < r.has_fur.length; i++) seen[Number(r.has_fur[i])] = 1;
          if (unlockAll) {
            for (var j = 0; j < all.length; j++) { var id = Number(all[j] && all[j].id); if (id && !seen[id]) { r.has_fur.push(id); seen[id] = 1; } }
          } else {
            try { console.log('[MOCK] 家具: 真循环(furnitureUnlockAll=0) —— has_fur 只保留做出来的 ' + r.has_fur.length + ' 件, 其余靠工作台制作'); } catch (e) {}
          }
          /* 客户端渲染小屋主要看 put_fur(已摆放) —— has_fur 只加不摆, 屋里什么都不会出现(用户反馈: 家具还是没解锁)。
             这里按既有条目的形状把全部家具补齐到 put_fur。 */
          r.put_fur = Array.isArray(r.put_fur) ? r.put_fur.slice() : [];
          /* 客户端读 put_fur[i].id 与 put_fur[i].type(且 type 取自 FurnitureDB.get(id).type),
             所以条目必须是**对象**; 以前 put_fur 为空时我推的是纯数字 -> n.id 为 undefined -> 屋里什么都不渲染。 */
          function furType(fid) { try { var e2 = db.get ? db.get(fid) : null; if (e2 && typeof e2.type === 'number') return e2.type; } catch (e) {} return 0; }
          var shape = (r.put_fur.length && typeof r.put_fur[0] === 'object') ? r.put_fur[0] : { id: 0, type: 0 };
          var seen2 = {};
          for (var q = 0; q < r.put_fur.length; q++) { var e0 = r.put_fur[q]; seen2[Number(shape ? (e0 && e0.id) : e0)] = 1; }
          for (var w = 0; unlockAll && w < all.length; w++) {
            var id2 = Number(all[w] && all[w].id);
            if (!id2 || seen2[id2]) continue;
            var cp2 = {}; for (var kk in shape) cp2[kk] = shape[kk]; cp2.id = id2; cp2.type = furType(id2); r.put_fur.push(cp2);
            seen2[id2] = 1;
          }
          try { console.log('[MOCK] 家具: has_fur=' + r.has_fur.length + ' put_fur=' + r.put_fur.length + ' (全部下发)'); } catch (e) {}
        }
      } catch (e) {}
      try { console.log('[MOCK] 家具下发字段: ' + Object.keys(r).join(',') + ' | bench=' + JSON.stringify(r.bench || []).slice(0,40) + ' | put_fur=' + JSON.stringify(r.put_fur || []).slice(0,60) + ' | has_fur=' + JSON.stringify(r.has_fur || []).slice(0,60)); } catch (e) {}
      return r;
    };
  })();
  /* 撤销"全部摆放": 324 件一起摆会触发客户端 replace_fur 换主题。这里只保留玩家自己摆的。 */
  (function () {
    var prev2 = S['furniture_load_furniture'];
    function furType2(fid) { try { var dm = Tabikaeru.DataManager.instance(), db = dm && dm.FurnitureDB; var e2 = (db && db.get) ? db.get(fid) : null; return (e2 && e2.type) || 0; } catch (e) { return 0; } }
    S['furniture_load_furniture'] = function () {
      var r = (typeof prev2 === 'function') ? (prev2() || {}) : (prev2 || {});
      try {
        var mine = (typeof fs === 'function') ? fs() : null;
        var ids = (mine && Array.isArray(mine.put_fur)) ? mine.put_fur : [];
        var out = [], seen = {};
        for (var i = 0; i < ids.length; i++) {
          var raw = ids[i];
          var id = Number(raw && raw.id !== undefined ? raw.id : raw);
          if (!id || seen[id]) continue;
          seen[id] = 1;
          out.push({ id: id, type: furType2(id) });
        }
        r.put_fur = out;
      } catch (e) {}
      try { console.log('[MOCK] 家具: 仅解锁 has_fur=' + ((r.has_fur || []).length) + ' put_fur=' + ((r.put_fur || []).length)); } catch (e) {}
      return r;
    };
  })();
  /* 工作台/合成台: 填充 bench(台面工具) —— 客户端读 {id,type}, 以前一直是空的。 */
  (function () {
    var prev3 = S['furniture_load_furniture'];
    S['furniture_load_furniture'] = function () {
      var r = (typeof prev3 === 'function') ? (prev3() || {}) : (prev3 || {});
      try {
        var list = null;
        try { var dm = Tabikaeru.DataManager.instance(), db = dm && (dm.BenchData || dm.benchData);
              if (db && typeof db.list === 'function') list = db.list(); } catch (e) {}
        var bench = [];
        if (list && list.length) {
          for (var i = 0; i < list.length && bench.length < 12; i++) {
            var e = list[i]; var id = Number(e && e.id), ty = Number(e && e.type);
            if (id) bench.push({ id: id, type: ty || 1 });
          }
        }
        if (!bench.length) { for (var j = 1101; j <= 1108; j++) bench.push({ id: j, type: 1 }); }
        var isEmpty = !Array.isArray(r.bench) || r.bench.length === 0;
        if (!isEmpty) { isEmpty = true;
          for (var bq = 0; bq < r.bench.length; bq++) { var bv = r.bench[bq];
            var bid = (bv && typeof bv === 'object') ? Number(bv.id) : Number(bv);
            if (bid !== -1 && !isNaN(bid) && bid !== 0) { isEmpty = false; break; } } }
        /* 关键: bench 前 5 槽 = 工具(getBenchTools), 6..10 槽 = 台面物品/材料(getBenchItems)。
           以前无条件用工具填满 10 槽 -> 客户端把工具当成材料行, 永远算不出配方(没有开工)。 */
        var mine2 = [];
        for (var mq = 0; mq < 10; mq++) { var mv = (Array.isArray(r.bench) && r.bench[mq] !== undefined) ? r.bench[mq] : -1; mine2.push(mv); }
        var toolsEmpty = true;
        for (var tq = 0; tq < 5; tq++) { var tv2 = mine2[tq]; if (tv2 !== -1 && tv2 !== undefined && tv2 !== null) { toolsEmpty = false; break; } }
        if (toolsEmpty && !window.__benchSeeded) { window.__benchSeeded = 1;
          for (var sq2 = 0; sq2 < 5 && sq2 < bench.length; sq2++) mine2[sq2] = bench[sq2].id; }
        r.bench = mine2;

        /* bench_lock 保持原值(测试断言依赖它), 只记录 */
        /* 商人库存 num 一律夹到 >= 0: 客户端 lblCount = _("剩{0}个", num) 是**直接显示**的,
           我们任何一条路径算出负数(重复购买记录/档期加减)都会让玩家看到"剩-1个"(用户报的 bug)。 */
        try {
          var fixed = 0;
          if (r.shop && Array.isArray(r.shop.shop_list)) {
            for (var si = 0; si < r.shop.shop_list.length; si++) {
              var rowN = r.shop.shop_list[si];
              if (!rowN) continue;
              var nv = Number(rowN.num);
              if (!isFinite(nv) || nv < 0) { rowN.num = 0; fixed++; }
            }
          }
          if (fixed) console.log('[MOCK] 商人库存: 修正 ' + fixed + ' 条非法 num(-1/NaN -> 0, 客户端会显示"剩-1个")');
        } catch (e) {}
        /* bought 记账去重: 同一个 shop_id 在 24 小时窗口里只算一次购买(重复记录会让 num 变成负数) */
        try {
          var f2 = (typeof fs === 'function') ? fs() : null;
          if (f2 && Array.isArray(f2.bought)) {
            var seenB = {}, dedup = [];
            for (var bi2 = f2.bought.length - 1; bi2 >= 0; bi2--) {
              var b2 = f2.bought[bi2];
              if (!b2) continue;
              var key2 = Number(b2.shop_id) + '@' + Math.floor(Number(b2.time || 0) / 1000);
              if (seenB[key2]) { continue; }
              seenB[key2] = 1; dedup.push(b2);
            }
            if (dedup.length !== f2.bought.length) {
              f2.bought = dedup.reverse();
              try { console.log('[MOCK] 商人购买记录去重: ' + f2.bought.length + ' 条'); } catch (e) {}
            }
          }
        } catch (e) {}
        try { console.log('[MOCK] 工作台: bench=' + JSON.stringify(r.bench) + ' lock=' + r.bench_lock); } catch (e) {}
      } catch (e) {}
      return r;
    };
  })();
  /* 旅行商人(嘟嘟): 客户端读 furniture_load_furniture.shop 的 {start_time, leave_time, shop_list}
     —— 商人在庭院出现的时间窗。以前我们给的是 0/0/[] -> 商人永远不出现(用户: 看不到嘟嘟)。 */
  (function () {
    var prev4 = S['furniture_load_furniture'];
    S['furniture_load_furniture'] = function () {
      var r = (typeof prev4 === 'function') ? (prev4() || {}) : (prev4 || {});
      try {
        var now = Math.floor(Date.now() / 1000);
        r.shop = r.shop || {};
        var list = r.shop.shop_list;
        if (!Array.isArray(list) || !list.length) {
          try {
            var dm = Tabikaeru.DataManager.instance(), db = dm && (dm.FurnitureShopDB || dm.furnitureShopDB);
            var all = (db && typeof db.list === 'function') ? db.list() : null;
            if (all && all.length) list = all.slice(0, 12);
          } catch (e) {}
        }
        r.shop.shop_list = Array.isArray(list) ? list : [];
        /* 嘟嘟的作息(用户表): "每天下午或晚上到访, 每次到访随机刷新 1 次商品"。
           以前是"start=now-1h, leave=now+24h" = 全天营业、永不刷新。
           现在: 每天挑一个【14:00~20:00】的到访时刻(存 st.merchantVisit.day/start),
                 营业 5 小时; **每次新的到访开始时清空当次的购买记录**(= 重新上架/重掷库存),
                 价格维持表里的值(工具 750 / 图纸 500 / 特殊材料 200)。 */
        var dnow = new Date(), dayKey = dnow.getFullYear() + '-' + (dnow.getMonth() + 1) + '-' + dnow.getDate();
        var mv = (st.merchantVisit && typeof st.merchantVisit === 'object') ? st.merchantVisit : (st.merchantVisit = {});
        if (mv.day !== dayKey || !(Number(mv.start) > 0)) {
          var openHour = 14 + Math.floor(Math.random() * 6);          /* 14~19 点到访 */
          var openAt = new Date(dnow.getFullYear(), dnow.getMonth(), dnow.getDate(), openHour, Math.floor(Math.random() * 60), 0, 0);
          mv.day = dayKey; mv.start = Math.floor(openAt.getTime() / 1000);
          if (ffur2()) ffur2().bought = [];                            /* 新的一趟 -> 重新上架 */
          try { console.log('[MOCK] 嘟嘟: 今天 ' + openHour + ' 点到访(营业 5 小时), 商品重新上架'); } catch (e) {}
        }
        function ffur2() { try { return fs(); } catch (e) { return null; } }
        /* ⚠️ 工作台热区就是靠这个字段显示的(用户: "工作台还是没出现"):
             客户端 MainOutView.updateFurniture(): btn_enterFurnitureBench.visible = FurnitureModel.isOpen()
                   FurnitureModel.isOpen() = getShopData().start_time > 0
           我们以前"还没到访就给 start_time = 0" -> 工作台一天里只有 14~19 点那 5 小时能点。
           修法: start_time **永远给今天 0 点**(>0, 热区常显), 商人在不在只由 leave_time 表达
           —— 客户端自己的 isOpenShop / leave_time 计时器照旧把商店收起来, 只有热区不再跟着消失。 */
        var d0 = new Date(), midnight = Math.floor(new Date(d0.getFullYear(), d0.getMonth(), d0.getDate(), 0, 0, 0, 0).getTime() / 1000);
        r.shop.start_time = midnight;
        r.shop.leave_time = (now < Number(mv.start)) ? midnight : (Number(mv.start) + 5 * 3600);   /* 到访前: 今天还没开张(leave<=now) */
        r.shop.visit_start = Number(mv.start);
        /* 库存 num: 客户端用它显示"剩N个/仅N个", 并在 num==0 时显示售罄 + 禁用购买按钮。
           以前我们从不写 num(直接透传 DB 行, 根本没有这个字段) -> 买完再进游戏又变成有货,
           玩家看到的就是"我买的图纸下一次进入游戏就不见了"(购买/售罄状态丢失, 同一张能反复买)。
           现在按 f.bought 里 24 小时内的购买次数扣减, 买了就是 0, 重启后依然是 0。 */
        var ffur = null; try { ffur = fs(); } catch (e) {}
        var bought = {}, bl = (ffur && Array.isArray(ffur.bought)) ? ffur.bought : [];
        var cut = Math.max(Date.now() - 86400000, (Number(mv.start) > 0 ? Number(mv.start) * 1000 : 0));   /* 只算本次到访内的购买 */
        for (var bi = 0; bi < bl.length; bi++) {
          var be = bl[bi]; if (!be || !be.time || Number(be.time) < cut) continue;
          var bsid = Number(be.shop_id); if (bsid) bought[bsid] = (bought[bsid] || 0) + 1;
        }
        var out2 = [], sold = 0;
        for (var ri = 0; ri < r.shop.shop_list.length; ri++) {
          var row3 = r.shop.shop_list[ri]; if (!row3) continue;
          var cp3 = {}, k3; for (k3 in row3) cp3[k3] = row3[k3];
          var base = Number(cp3.limit) || Number(cp3.shop_limit) || 0;
          var had = bought[Number(cp3.shop_id)] || 0;
          cp3.num = Math.max(0, base - had);
          if (cp3.num === 0) sold++;
          out2.push(cp3);
        }
        r.shop.shop_list = out2;
        /* 特殊刷新(清单 §8): 春节才卖「正丹纸」(10102), 年末/周年庆才卖「织彩带」(10108)。
           这两件平时就在嘟嘟的常驻列表里(id 3 / id 7) —— 所以过季要**下架**, 到季再上架并给库存。 */
        var SEASONAL = [{ item: 10102, act: 'springcard', name: '正丹纸' }, { item: 10108, act: 'greetcard', name: '织彩带' }];
        var seasonalOn = [], seasonalOff = [];
        try {
          var cal = window.MOCK_CALENDAR;
          var dmS2 = Tabikaeru.DataManager.instance(), dbS2 = dmS2 && (dmS2.FurnitureShopDB || dmS2.furnitureShopDB);
          var allS2 = (dbS2 && typeof dbS2.list === 'function') ? (dbS2.list() || []) : [];
          for (var si2 = 0; si2 < SEASONAL.length; si2++) {
            var ent = SEASONAL[si2];
            var on = !!(cal && typeof cal.activity === 'function' && cal.activity(ent.act).active);
            var kept = [];
            for (var qi = 0; qi < r.shop.shop_list.length; qi++) {
              var rr = r.shop.shop_list[qi];
              if (Number(rr.item_id) === ent.item) {
                if (!on) { seasonalOff.push(ent.name); continue; }          /* 过季: 下架 */
                if (!(Number(rr.num) > 0) && !(bought[Number(rr.shop_id)] > 0)) rr.num = 1;  /* 到季: 没买过就至少给 1 件 */
              }
              kept.push(rr);
            }
            r.shop.shop_list = kept;
            if (on) {
              var exists = false;
              for (var qj = 0; qj < r.shop.shop_list.length; qj++) if (Number(r.shop.shop_list[qj].item_id) === ent.item) exists = true;
              if (!exists) {                                                /* 常驻列表里没有就从表里补一条 */
                for (var ri3 = 0; ri3 < allS2.length; ri3++) {
                  var rowS = allS2[ri3]; if (!rowS || Number(rowS.item_id) !== ent.item) continue;
                  var cpS = {}, kS; for (kS in rowS) cpS[kS] = rowS[kS];
                  cpS.num = Math.max(1, (Number(cpS.limit) || Number(cpS.shop_limit) || 1) - (bought[Number(cpS.shop_id)] || 0));
                  r.shop.shop_list.push(cpS);
                  break;
                }
              }
              seasonalOn.push(ent.name);
            }
          }
        } catch (e) {}
        /* 限定家具档期(清单/目标⑤): 图纸按月上下架 ——
             8~10 月「森之国度」3 件(图纸 10313 小鱼干 / 10315 小鱼冻 / 10323 猫猫帽)
             11~12 月「古琴展」2 件(图纸 10312 书桌·古琴 / 10326 衣柜·古琴)
           其它月份这两套都下架(和季节商品一样: 过季下架、到季上架并给库存)。 */
        var MONTHLY = [
          { name: '森之国度', months: [8, 9, 10], draw: [10313, 10315, 10323] },
          { name: '古琴展',   months: [11, 12],   draw: [10312, 10326] }
        ];
        var monthlyOn = [], monthlyOff = [];
        try {
          var mNow = new Date().getMonth() + 1;
          var dmM = Tabikaeru.DataManager.instance(), dbM = dmM && (dmM.FurnitureShopDB || dmM.furnitureShopDB);
          var allM = (dbM && typeof dbM.list === 'function') ? (dbM.list() || []) : [];
          for (var mi = 0; mi < MONTHLY.length; mi++) {
            var M2 = MONTHLY[mi], onM = M2.months.indexOf(mNow) >= 0, keptM = [];
            for (var mj = 0; mj < r.shop.shop_list.length; mj++) {
              var rm = r.shop.shop_list[mj];
              if (M2.draw.indexOf(Number(rm.item_id)) >= 0) {
                if (!onM) { monthlyOff.push(M2.name + '·' + rm.item_id); continue; }
                if (!(Number(rm.num) > 0) && !(bought[Number(rm.shop_id)] > 0)) rm.num = 1;
              }
              keptM.push(rm);
            }
            r.shop.shop_list = keptM;
            if (onM) {
              for (var mk = 0; mk < M2.draw.length; mk++) {
                var want = M2.draw[mk], hasM = false;
                for (var ml = 0; ml < r.shop.shop_list.length; ml++) if (Number(r.shop.shop_list[ml].item_id) === want) hasM = true;
                if (hasM) continue;
                for (var mm = 0; mm < allM.length; mm++) {
                  var rowM = allM[mm]; if (!rowM || Number(rowM.item_id) !== want) continue;
                  var cpM = {}, kM; for (kM in rowM) cpM[kM] = rowM[kM];
                  cpM.num = Math.max(1, (Number(cpM.limit) || Number(cpM.shop_limit) || 1) - (bought[Number(cpM.shop_id)] || 0));
                  r.shop.shop_list.push(cpM);
                  break;
                }
              }
              monthlyOn.push(M2.name + '(' + mNow + '月)');
            } else {
              monthlyOff.push(M2.name + '(非档期 ' + mNow + '月)');
            }
          }
        } catch (e) {}
        try { if (monthlyOn.length || monthlyOff.length) console.log('[MOCK] 限定家具档期: 上架 ' + (monthlyOn.join(',') || '无') + ' | 下架 ' + (monthlyOff.join(',') || '无')); } catch (e) {}
        try { console.log('[MOCK] 商人库存: 商品' + out2.length + ' 件, 已售罄 ' + sold + ' 件, 本档期买过 ' + bl.length + ' 次' +
                          (seasonalOn.length ? (' | 季节限定上架 ' + seasonalOn.join(',')) : '') +
                          (seasonalOff.length ? (' | 过季下架 ' + seasonalOff.join(',')) : '') +
                          (!seasonalOn.length && !seasonalOff.length ? ' | 无季节商品' : '')); } catch (e) {}
        try { console.log('[MOCK] 旅行商人: start=' + r.shop.start_time + ' leave=' + r.shop.leave_time + ' 商品=' + r.shop.shop_list.length + ' 件'); } catch (e) {}
      } catch (e) {}
      return r;
    };
  })();
  /* 台面放/取: 以前打到自动存根 -> 放了不落库, 客户端算不出配方(没有开工按钮)。 */
  (function () {
    function st2() { try { return (typeof fs === 'function') ? fs() : null; } catch (e) { return null; } }
    function sv() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
    S['furniture_putin_bench'] = function (p) {
      var f = st2(); if (!f) return { code: 1 };
      f.bench = Array.isArray(f.bench) ? f.bench : [];
      var pos = Number(p && p.pos), id = Number(p && p.id);
      if (!(f.bench.length >= 10)) { var b0 = []; for (var q = 0; q < 10; q++) b0.push(f.bench[q] === undefined ? -1 : f.bench[q]); f.bench = b0; }
      if (!(pos >= 1 && pos <= f.bench.length)) return { code: 1 };
      f.bench[pos - 1] = id;
      sv();
      try { console.log('[MOCK] 台面放: pos=' + pos + ' id=' + id + ' -> bench=' + JSON.stringify(f.bench).slice(0, 80)); } catch (e) {}
      return { code: 0 };
    };
    S['furniture_takeout_bench'] = function (p) {
      var f = st2(); if (!f) return { code: 1 };
      var pos = Number(p && p.pos);
      if (Array.isArray(f.bench) && pos > 0) f.bench[pos - 1] = -1;
      sv();
      try { console.log('[MOCK] 台面取: pos=' + pos + ' -> bench=' + JSON.stringify(f.bench).slice(0, 80)); } catch (e) {}
      return { code: 0 };
    };
  })();
  /* 旅行商人(嘟嘟)购买: 以前没实现 -> 打到自动存根, 客户端乐观显示但服务端不记账, 重启即丢。 */
  (function () {
    function fst() { try { return (typeof fs === 'function') ? fs() : null; } catch (e) { return null; } }
    function sv2() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
    function shopRow(shopId) {
      try {
        var dm = Tabikaeru.DataManager.instance(), db = dm && (dm.FurnitureShopDB || dm.furnitureShopDB);
        if (!db) return null;
        var row = (typeof db.get === 'function') ? db.get(shopId) : null;
        if (row) return row;
        var all = (typeof db.list === 'function') ? (db.list() || []) : [];
        for (var i = 0; i < all.length; i++) { if (Number(all[i] && (all[i].shop_id !== undefined ? all[i].shop_id : all[i].id)) === Number(shopId)) return all[i]; }
      } catch (e) {}
      return null;
    }
    S['furniture_buy_shop'] = function (p) {
      var shopId = Number(p && (p.shop_id !== undefined ? p.shop_id : p.id));
      var f = fst(); if (!f) return { code: 1 };
      var row = shopRow(shopId);
      var itemId = Number(row && (row.item_id !== undefined ? row.item_id : row.itemId));
      var price = Number(row && row.price) || 0;
      if (!itemId) { try { console.log('[MOCK] 商人购买: 找不到商品 shop_id=' + shopId); } catch (e) {} return { code: 1 }; }
      if ((Number(st.clover) || 0) < price) return { code: 2 };
      st.clover -= price;
      f.bought = Array.isArray(f.bought) ? f.bought : [];
      f.bought.push({ shop_id: shopId, item_id: itemId, time: Date.now() });
      /* 图纸(103xx)是物品, 必须进 st.house 才能在物品栏/重启后看到; 家具才进 has_fur。 */
      /* 只有**真家具**(FurnitureDB 里有 id)才进 has_fur; 其它一律进 st.house 物品栏。
         以前按 ItemDB.type===14 判, 而 type14 恰恰是"周年庆·家具礼袋/蜡梅/木槿…"这些**物品**
         (furnitureShopData 里有 18 件) -> 塞进 has_fur 后, 下一次下发会被"剔除非家具 id"清掉,
         客户端那边却是 addHouseItem 进了物品栏 -> 重启即凭空消失。 */
      var isFurniture = false;
      try {
        var dm3 = Tabikaeru.DataManager.instance(), fdb3 = dm3 && (dm3.FurnitureDB || dm3.furnitureDB);
        isFurniture = !!(fdb3 && typeof fdb3.get === 'function' && fdb3.get(itemId));
      } catch (e) {}
      if (isFurniture) {
        f.has_fur = Array.isArray(f.has_fur) ? f.has_fur : [];
        if (f.has_fur.indexOf(itemId) < 0) f.has_fur.push(itemId);
      } else {
        st.house = Array.isArray(st.house) ? st.house : [];
        var found = null;
        for (var hq = 0; hq < st.house.length; hq++) if (st.house[hq] && Number(st.house[hq].item_id) === Number(itemId)) found = st.house[hq];
        if (found) found.count = (Number(found.count) || 0) + 1; else st.house.push({ item_id: Number(itemId), count: 1 });
      }
      try { if (typeof ds === 'function') { } } catch (e) {}
      sv2();
      try { push("furniture_load_furniture", S['furniture_load_furniture'] ? S['furniture_load_furniture']() : {}, 30); } catch (e) {}
      try { push("clover_update", { clover: st.clover }, 30); } catch (e) {}
      try { console.log('[MOCK] 商人购买 OK shop_id=' + shopId + ' itemId=' + itemId + ' price=' + price + ' 共买 ' + f.bought.length + ' 次'); } catch (e) {}
      return { code: 0, clover: st.clover, item_id: itemId };
    };
  })();
  /* ---- 工作台热区(用户:"小屋的桌子还点不动") ----------------------------------
     客户端 MainOutView.updateFurniture() 里:
         btn_enterFurnitureBench.visible = FurnitureModel.isOpen()   // = shop.start_time > 0
     而 updateFurniture() 只在这两处被调用:
         (a) 场景创建 childrenCreated
         (b) FurnitureEventType.UPDATE
     偏偏 UPDATE 只在"嘟嘟收摊"那一刻由 FurnitureModel.furniture_load_furniture 自己派发
     (那段代码在 setTimeout(leave_time - now) 里), 数据刚下发时**不派发**。
     于是开机时序只要"先建 MainOut 场景、后到 shop 数据", 热区就永远是 hidden ⇒ 点桌子没反应。
     这里在数据到达后补派一次 UPDATE(并节流), 让客户端自己按 isOpen() 重算可见性。 */
  (function () {
    var prevSpot = S['furniture_load_furniture'];
    var pending = false;
    function nudge(why) {
      if (pending) return;
      pending = true;
      setTimeout(function () {
        pending = false;
        try {
          if (typeof FurnitureEventType === 'undefined' || typeof window.FurnitureModel !== 'function') return;
          var m = core.ModelManage.getInstance().getModel(window.FurnitureModel);
          if (!m) return;
          try { m.dispatchEvent(new core.Event(FurnitureEventType.UPDATE)); } catch (e) {}
          try {
            var ctrl = core.PageManage.getInstance().getControl(MainOutController, core.ViewLayerType.SceneLayer);
            var view = ctrl && ctrl.getView ? ctrl.getView() : null;
            var btn = view && view.btn_enterFurnitureBench;
            if (btn) {
              console.log('[MOCK] 工作台热区: isOpen=' + (m.isOpen ? m.isOpen() : '?') +
                          ' visible=' + btn.visible + ' touchEnabled=' + btn.touchEnabled + ' (' + why + ')');
            } else if (view) {
              console.log('[MOCK] 工作台热区: MainOut 视图没有 btn_enterFurnitureBench (' + why + ')');
            }
          } catch (e2) {}
        } catch (e) {}
      }, 900);
    }
    S['furniture_load_furniture'] = function () {
      var r = (typeof prevSpot === 'function') ? (prevSpot() || {}) : (prevSpot || {});
      nudge('家具数据下发');
      return r;
    };
    window.MOCK_BENCH_SPOT = nudge;          /* 手动: window.MOCK_BENCH_SPOT('manual') */
    setTimeout(function () { nudge('boot+4s'); }, 4000);
    setTimeout(function () { nudge('boot+10s'); }, 10000);
  })();
  /* 台面工具行必须放 **type 12 = FURNITURE_TOOL** 的物品(客户端 getHouseItemsByType(FURNITURE_TOOL)),
     以前我播种的是家具 id(1101..1110) -> 不是工具 -> 客户端算不出配方, 没有开工。 */
  (function () {
    var prev5 = S['furniture_load_furniture'];
    function toolIds() {
      var out = [];
      try {
        var dm = Tabikaeru.DataManager.instance(), idb = dm && dm.ItemDB;
        var h = Array.isArray(st.house) ? st.house : [];
        for (var i = 0; i < h.length && out.length < 5; i++) {
          var id = Number(h[i] && h[i].item_id); if (!id) continue;
          var row = (idb && typeof idb.get === 'function') ? idb.get(id) : null;
          if (row && Number(row.type) === 12) out.push(id);
        }
      } catch (e) {}
      return out;
    }
    S['furniture_load_furniture'] = function () {
      var r = (typeof prev5 === 'function') ? (prev5() || {}) : (prev5 || {});
      try {
        var b = Array.isArray(r.bench) ? r.bench.slice() : [];
        while (b.length < 10) b.push(-1);
        var emptyTools = true;
        for (var i = 0; i < 5; i++) if (b[i] !== -1 && b[i] !== null && b[i] !== undefined) { emptyTools = false; break; }
        if (emptyTools) { var ids = toolIds(); for (var j = 0; j < ids.length && j < 5; j++) b[j] = ids[j]; }
        r.bench = b;
        try { console.log('[MOCK] 台面: tools=' + JSON.stringify(b.slice(0,5)) + ' items=' + JSON.stringify(b.slice(5))); } catch (e) {}
      } catch (e) {}
      return r;
    };
  })();
})();
