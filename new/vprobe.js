/* lxqw 视图探针 v1 —— "工作台/合成(开工)" 专项 (2026-09-14)
 *
 * 用户诉求: 别再猜"工作台"是哪个类了。
 *   ① 给所有名字含 craft / bench / tool / bag 的视图类 + 它们的 addChild 挂探针;
 *   ② 用户点开哪个, 日志里就出现哪个类(每次界面变化打一行 "当前界面类 [...]);
 *   ③ 在它的刷新方法(updateView/update/updateBench/updatePage...)里打印
 *      工具行 / 材料行 数据 + 开工(合成)使能条件。
 *
 * 四个探针:
 *   A 类清单  启动时列出候选类在 window 上是否存在(缺失 = 只能靠 C/D 兜住)
 *   B addChild/addChildAt 钩子 —— 命中类 或 被挂进 *Layer 的界面类 -> [VP] ADD / [VP] OPEN
 *   C 显示树扫描 —— 0.8s x 40 次, 之后每 3s; 界面类集合变化时打一行; 发现命中类实例 -> FOUND + 挂 D + 打状态
 *   D 方法探针 —— 命中类原型上的刷新/点击方法全部包一层 -> [VP] CALL <类>.<方法> + 状态摘要(每方法限 6 次)
 * 手动: window.__vp() 立刻重扫重打; window.__vpDump('类名') 列该类活实例。
 *
 * 读 main.min.js 得到的事实(供日志对照):
 *   FurnitureBenchView = 工作台/桌子(frame_tsukue_png): listTool=工具行 bench[0..4],
 *     listItem=材料行 bench[5..9], listResource=10001..10007; 使能 = !isLockBench()
 *   BoxCraftView = 合成(chips): group1..3 / lbNum1..3, COMPOSE(16) 的 sub_type 1/2/3 三组全 >0 才 s=true,
 *     s 为真就直接 req_compose(ComposeId=5502 -> pray_compose)—— 没有按钮, 是自动开工
 *   ToolBagView = 工具栏: tab 0..3 = 工具/物品/庭院/其他; 从台面格子进来时 param.tabFilter 把不匹配的页签
 *     enabled=false(设计如此, 不是 bug)
 *   BagItemRender = 背包格子: btnCompose.visible = (item_id == ComposeId(5502)) —— 合成的唯一入口
 */
(function () {
  'use strict';
  var HIT = /Craft|Bench|Tool|Bag|Drop|Furniture|Paper|Book|Cargo|Shop|MainOut|MainIn/i;   /* 要盯的类 */
  var VIEWISH = /(View|ViewController|Controller|Page)$/;  /* "这是一屏界面" */
  var REFRESH = ['childrenCreated', 'onComplete', '$onAddToStage', 'update', 'updateView', 'updateBench',
                 'updateList', 'updatePage', 'updateScrollShelf', 'updateRedot', 'setParam', 'commitProperties',
                 'dataChanged', 'open', 'close', 'selectPage', 'onTypeGroupChange', 'onTabTap', 'onTabChange',
                 'onListTap', 'onToolListTap', 'onItemListTap', 'onListResourceTap', 'onItemTap', 'onEvent'];
  var MAX = 400, lines = 0, muted = false;
  var seenDump = {}, seenPair = {}, callCount = {}, hookedFn = 0, found = 0, lastScreenKey = '';
  var armed = [];

  function lg(m) {
    if (muted) return;
    lines++;
    if (lines > MAX) { muted = true; try { console.log('[VP] ...超过 ' + MAX + ' 行, 后续静默(重启即可)'); } catch (e) {} return; }
    try { console.log('[VP] ' + m); } catch (e) {}
  }
  function nm(o) { try { if (!o) return '?'; return o.__class__ || (o.constructor && o.constructor.name) || '?'; } catch (e) { return '?'; } }
  function own(o) { try { return Object.keys(o); } catch (e) { return []; } }
  function safe(f) { try { return f(); } catch (e) { return '<err:' + (e && e.message) + '>'; } }
  function brief(a) {
    if (!a) return 'null';
    var o = [];
    for (var i = 0; i < a.length && i < 12; i++) o.push(String(a[i]));
    return '[' + o.join(',') + ']';
  }
  function itemBrief(it) {
    if (it === null || it === undefined) return 'null';
    if (typeof it !== 'object') return String(it);
    var id = (it.item_id !== undefined) ? it.item_id : it.id;
    var s = (id !== undefined) ? String(id) : JSON.stringify(it).slice(0, 22);
    if (it.count !== undefined && it.count !== -1) s += 'x' + it.count;
    if (it.isLock) s += '(锁)';
    if (id === undefined && it.data !== undefined) s = String(it.data);
    return s;
  }
  /* ---- 行数据: 任何 own 属性里带 dataProvider 的 (listTool/listItem/listResource/tab/list) ---- */
  function rowsOf(o) {
    var out = [], ks = own(o);
    for (var i = 0; i < ks.length && out.length < 8; i++) {
      var k = ks[i], v = null;
      try { v = o[k]; } catch (e) { continue; }
      if (!v || typeof v !== 'object' || !v.dataProvider || !v.dataProvider.source) continue;
      var src = v.dataProvider.source, a = [];
      for (var j = 0; j < src.length && j < 6; j++) a.push(itemBrief(src[j]));
      out.push(k + '(' + src.length + ')=[' + a.join(',') + ']');
    }
    return out;
  }
  function textsOf(o) {
    var out = [], ks = own(o);
    for (var i = 0; i < ks.length && out.length < 10; i++) {
      var v = null; try { v = o[ks[i]]; } catch (e) { continue; }
      if (v && typeof v === 'object' && typeof v.text === 'string' && v.text) out.push(ks[i] + '="' + v.text.slice(0, 16) + '"');
    }
    return out;
  }
  function flagsOf(o) {
    var out = [], skip = { numChildren: 1, x: 1, y: 1, width: 1, height: 1, anchorOffsetX: 1, anchorOffsetY: 1, alpha: 1, rotation: 1, scaleX: 1, scaleY: 1 };
    var ks = own(o);
    for (var i = 0; i < ks.length && out.length < 8; i++) {
      var v = null; try { v = o[ks[i]]; } catch (e) { continue; }
      if (skip[ks[i]]) continue;
      if (typeof v === 'boolean') out.push(ks[i] + '=' + v);
      else if (typeof v === 'number') out.push(ks[i] + '=' + v);
    }
    return out;
  }
  function kidsOf(o) {
    var out = [];
    try { for (var i = 0; i < o.numChildren && i < 10; i++) { var c = o.getChildAt(i); out.push(nm(c) + (c && c.visible === false ? '(藏)' : '')); } } catch (e) {}
    return out;
  }
  function dims(o) {
    return safe(function () {
      var p = o.parent ? nm(o.parent) : 'none';
      return Math.round(o.width) + 'x' + Math.round(o.height) + ' @' + Math.round(o.x) + ',' + Math.round(o.y) +
             ' vis=' + (o.visible === false ? 0 : 1) + ' parent=' + p + (o.skinName ? ' skin=' + String(o.skinName).split('/').pop() : '');
    });
  }
  /* ---- 全局使能条件: 台面 + 合成 ---- */
  function craftState() {
    var p = [], mm = null;
    try { mm = core.ModelManage.getInstance(); } catch (e) {}
    try {
      var FM = window.FurnitureModel;
      if (mm && typeof FM === 'function') {
        var fm = mm.getModel(FM);
        if (fm) {
          var tools = fm.getBenchTools ? fm.getBenchTools() : null;
          var items = fm.getBenchItems ? fm.getBenchItems() : null;
          var tl = 0, il = 0;
          for (var i = 0; i < (tools || []).length; i++) if (tools[i] !== -1 && tools[i] !== undefined) tl++;
          for (var j = 0; j < (items || []).length; j++) if (items[j] !== -1 && items[j] !== undefined) il++;
          p.push('台面 工具行' + brief(tools) + '(有' + tl + ') 材料行' + brief(items) + '(有' + il + ') 锁=' + (fm.isLockBench ? fm.isLockBench() : '?'));
        }
      }
    } catch (e) { p.push('台面err:' + (e && e.message)); }
    try {
      var IM = window.ItemModel;
      if (mm && typeof IM === 'function') {
        var im = mm.getModel(IM), t = [0, 0, 0], ids = [];
        if (im && im.getHouseItemsByType) {
          var arr = im.getHouseItemsByType(16) || [];
          for (var k = 0; k < arr.length; k++) {
            var it = arr[k], d = null;
            try { d = Tabikaeru.DataManager.instance().ItemDB.get(it.item_id); } catch (e2) {}
            var st = d ? Number(d.sub_type) : 0;
            if (st >= 1 && st <= 3) t[st - 1] = it.count;
            ids.push(it.item_id + '=' + it.count + '(st' + st + ')');
          }
        }
        var s = t[0] > 0 && t[1] > 0 && t[2] > 0;
        var cid = 0; try { cid = Tabikaeru.Define.ComposeId; } catch (e3) {}
        var have = (im && im.getHouseItemCount) ? im.getHouseItemCount(cid) : '?';
        var chips = 'chips' + (t[0] > 0 ? '_1' : '') + (t[1] > 0 ? '_2' : '') + (t[2] > 0 ? '_3' : '') + '_png';
        p.push('合成 COMPOSE' + brief(ids) + ' t=[' + t.join(',') + '] s=' + (s ? 'TRUE' : 'false') +
               ' img=' + chips + ' ComposeId=' + cid + ' 背包有=' + have);
      }
    } catch (e) { p.push('合成err:' + (e && e.message)); }
    return p.join(' | ');
  }
  function viewExtra(o) {
    var c = nm(o);
    try {
      if (/BoxCraft/.test(c)) {
        var g = [o.group1, o.group2, o.group3].map(function (x) { return x ? (x.filters ? '灰' : '亮') : 'null'; });
        var nums = [o.lbNum1, o.lbNum2, o.lbNum3].map(function (x) { return x ? x.text : '?'; });
        lg('  ' + c + '.三格 groups=' + g.join(',') + ' 数=' + nums.join('/') + ' img=' + (o.imageShow && o.imageShow.source));
      }
      if (/ToolBag/.test(c)) {
        var en = [];
        try { for (var i = 0; i < o.tab.numChildren; i++) en.push(o.tab.getChildAt(i).enabled === false ? 'X' : 'o'); } catch (e) {}
        lg('  ' + c + '.页签 enabled=[' + en.join('') + '] pageIndex=' + o.pageIndex + ' param=' +
           (o.param ? JSON.stringify({ tabIndex: o.param.tabIndex, isSelection: !!o.param.isSelection, sel: o.param.selected }) : 'null'));
      }
      if (/MainOut/.test(c)) {
        try {
          var b = o.btn_enterFurnitureBench;
          var fm2 = null; try { fm2 = o.getModel(FurnitureModel); } catch (e3) {}
          lg('  ' + c + '.工作台热区 visible=' + (b ? b.visible : '无') + ' touchEnabled=' + (b ? b.touchEnabled : '-') +
             ' isOpen=' + (fm2 && fm2.isOpen ? fm2.isOpen() : '?') + ' start_time=' + ((fm2 && fm2.getShopData && fm2.getShopData().start_time) || '?'));
        } catch (e) {}
      }
      if (/Shop/.test(c)) {
        try {
          var sl = null;
          try { sl = o.getModel(FurnitureModel).getShopData().shop_list; } catch (e1) { sl = (o.serverData && o.serverData.shop && o.serverData.shop.shop_list) || null; }
          if (sl && sl.length) {
            var q = [];
            for (var si = 0; si < sl.length && si < 12; si++) q.push(sl[si].shop_id + ':' + sl[si].item_id + ':num' + sl[si].num);
            lg('  ' + c + '.商人库存(' + sl.length + ') ' + q.join(' '));
          }
        } catch (e) {}
      }
      if (/Furniture|Paper|Book|Cargo/.test(c)) {
        try {
          var fm = o.getModel(FurnitureModel);
          lg('  ' + c + '.家具 has_fur=' + ((fm.getOwnedFurnitures() || []).length) + ' put_fur=' + ((fm.getHomeFurnitures() || []).length) +
             ' 图纸(13)=' + ((o.getModel(ItemModel).getHouseItemsByType(13) || []).length));
        } catch (e) {}
      }
      if (/BagItemRender/.test(c)) {
        var d = o.data || {};
        if (Number(d.item_id) === 5502 || (o.btnCompose && o.btnCompose.visible)) {
          lg('  ' + c + ' item_id=' + d.item_id + ' count=' + d.count + ' btnCompose.visible=' + (o.btnCompose && o.btnCompose.visible));
        }
      }
    } catch (e) {}
  }
  function dump(o, why) {
    var c = nm(o);
    lg(c + ' ' + why + ' | ' + dims(o));
    var r = rowsOf(o); if (r.length) lg('  ' + c + '.行 ' + r.join('  '));
    var t = textsOf(o); if (t.length) lg('  ' + c + '.文本 ' + t.join(' '));
    var f = flagsOf(o); if (f.length) lg('  ' + c + '.标志 ' + f.join(' '));
    var k = kidsOf(o); if (k.length) lg('  ' + c + '.子 ' + k.join(' '));
    lg('  ' + c + '.数据 ' + craftState());
    viewExtra(o);
  }
  /* ---- D: 方法探针 ---- */
  function arm(o) {
    var c = nm(o), proto = null;
    try { proto = Object.getPrototypeOf(o); } catch (e) { return; }
    if (!proto) return;
    for (var i = 0; i < REFRESH.length; i++) {
      (function (m) {
        var fn = null; try { fn = proto[m]; } catch (e) { return; }
        if (typeof fn !== 'function' || fn.__vpHook) return;
        var w = function () {
          var key = c + '.' + m; callCount[key] = (callCount[key] || 0) + 1;
          var n = callCount[key], a = [];
          for (var q = 0; q < arguments.length && q < 3; q++) {
            var v = arguments[q];
            a.push(v && typeof v === 'object' ? (nm(v) + (v.itemIndex !== undefined ? '#' + v.itemIndex : '')) : String(v));
          }
          if (n <= 6) lg('CALL ' + c + '.' + m + '(' + a.join(',') + ')' + (n > 1 ? ' #' + n : ''));
          var r = fn.apply(this, arguments);
          if (n <= 6 && /^(updateView|update|updateBench|updatePage|updateList|setParam|onComplete|childrenCreated|dataChanged)$/.test(m)) {
            try { dump(this, 'AFTER ' + m); } catch (e) {}
          }
          return r;
        };
        w.__vpHook = 1;
        try { proto[m] = w; hookedFn++; } catch (e) {}
      })(REFRESH[i]);
    }
    if (armed.indexOf(c) < 0) { armed.push(c); lg('ARM ' + c + ' 已挂方法探针(累计 ' + hookedFn + ' 个)'); }
  }
  function chain(o) {
    var s = [], p = o && o.parent, g = 0;
    while (p && g++ < 5) { s.push(nm(p)); p = p.parent; }
    return s.join('<');
  }
  function hitNode(o) {
    var c = nm(o);
    var key = c + ':' + (o.name || '') + (o.data && o.data.item_id !== undefined ? ':' + o.data.item_id : '');
    if (seeDump(key)) return;
    /* 背包/掉落格子太多: 只报合成入口那一个 */
    if (/Render$/.test(c) && !(/BagItemRender|DropItemRender|PrayCraftItemRender|StampCraftItemRender/.test(c))) return;
    if (/BagItemRender/.test(c)) {
      var id = o.data && Number(o.data.item_id);
      if (id !== 5502 && !(o.btnCompose && o.btnCompose.visible)) return;
    }
    found++;
    lg('FOUND #' + found + ' ' + c + ' | ' + dims(o) + ' 父链=' + chain(o));
    arm(o);
    dump(o, '状态');
  }
  function seeDump(key) { if (seenDump[key]) return true; seenDump[key] = 1; return false; }
  /* ---- C: 显示树扫描 ---- */
  function stage() {
    try { if (typeof egret !== 'undefined' && egret.lifecycle && egret.lifecycle.stage) return egret.lifecycle.stage; } catch (e) {}
    try { if (typeof egret !== 'undefined' && egret.MainContext && egret.MainContext.instance) return egret.MainContext.instance.stage; } catch (e) {}
    return null;
  }
  function walk(fn) {
    var st = stage(); if (!st) return 0;
    var stack = (st.$children || []).slice(), guard = 0, n = 0;
    while (stack.length && guard++ < 6000) {
      var node = stack.pop(); if (!node) continue; n++;
      try { if (node.$children && node.$children.length) for (var i = 0; i < node.$children.length; i++) stack.push(node.$children[i]); } catch (e) {}
      try { fn(node); } catch (e) {}
    }
    return n;
  }
  function scan(tag) {
    var open = {};
    var n = walk(function (node) {
      var c = nm(node);
      if (VIEWISH.test(c)) open[c] = 1;
      if (HIT.test(c)) hitNode(node);
    });
    var keys = Object.keys(open).sort(), key = keys.join(',');
    if (key !== lastScreenKey) {
      lastScreenKey = key;
      lg('界面变化 [' + tag + ']: 当前界面类=' + (key || '(无)') + ' | 树节点 ' + n);
    }
  }
  /* ---- B: addChild 钩子 ---- */
  function hookAdd() {
    try {
      if (typeof egret === 'undefined' || !egret.DisplayObjectContainer || !egret.DisplayObjectContainer.prototype) return false;
      var P = egret.DisplayObjectContainer.prototype;
      if (P.__vpHooked) return true;
      P.__vpHooked = 1;
      ['addChild', 'addChildAt'].forEach(function (m) {
        var orig = P[m];
        if (typeof orig !== 'function') return;
        P[m] = function (child) {
          var r = orig.apply(this, arguments);
          try {
            var pc = nm(this), cc = nm(child), isView = VIEWISH.test(cc);
            if (HIT.test(cc) || HIT.test(pc) || (isView && /Layer/.test(pc))) {
              var k = pc + '<-' + cc;
              seenPair[k] = (seenPair[k] || 0) + 1;
              if (seenPair[k] <= 2) {
                lg((isView ? 'OPEN ' : 'ADD ') + pc + ' <- ' + cc +
                   (child && child.width !== undefined ? ' ' + Math.round(child.width) + 'x' + Math.round(child.height) + ' vis=' + (child.visible === false ? 0 : 1) : ''));
              }
            }
            if (HIT.test(cc)) { arm(child); hitNode(child); }
          } catch (e) {}
          return r;
        };
      });
      lg('addChild 钩子已挂');
      return true;
    } catch (e) { return false; }
  }
  /* ---- A: 类清单 ---- */
  var CANDIDATES = ['FurnitureBenchView', 'FurnitureBenchViewController', 'GuideFurnitureBenchView', 'GuideFurnitureBenchToolView',
                    'HandCraftView', 'HandCraftViewController', 'HandCraftModel', 'HandCraftUtils',
                    'BoxCraftView', 'BoxCraftShowView', 'PrayCraftPageView', 'PrayCraftPageItemRender', 'PrayCraftItemRender',
                    'PrayCraftDetailView', 'PrayCraftDetailRender', 'StampCraftPageView', 'StampCraftPageItemRender',
                    'StampCraftItemRender', 'StampCraftDetailView', 'StampCraftDetailRender',
                    'ToolBagView', 'ToolBagViewController', 'TooltipsManager', 'BagItemRender', 'DropItemRender',
                    'FurnitureModel', 'ItemModel', 'core', 'egret', 'Tabikaeru'];
  function classList() {
    var has = [], miss = [];
    for (var i = 0; i < CANDIDATES.length; i++) {
      var n = CANDIDATES[i], o = null; try { o = window[n]; } catch (e) {}
      ((typeof o === 'function' || (o && typeof o === 'object')) ? has : miss).push(n);
    }
    lg('类清单 存在(' + has.length + '): ' + has.join(','));
    lg('类清单 缺失(' + miss.length + '): ' + (miss.join(',') || '无'));
  }
  /* ---- 启动 ---- */
  function hasDisplay() {
    try {
      if (typeof egret === 'undefined' || !egret.DisplayObjectContainer) return false;
      if (typeof document === 'undefined' && typeof window === 'undefined') return false;
      return true;
    } catch (e) { return false; }
  }
  classList();
  if (!hasDisplay()) { lg('离线环境(无 egret 显示树), 只列类清单, 不启动扫描 —— 真机才会跑'); return; }
  hookAdd();
  var t = 0;
  var fast = setInterval(function () {
    t++;
    hookAdd();
    scan('t' + t);
    if (t >= 40) { clearInterval(fast); slow = setInterval(function () { scan('s'); }, 3000); }
  }, 800);
  var slow = null;
  window.__vp = function () { muted = false; lines = 0; lg('=== 手动 __vp() ==='); scan('manual'); window.__vpDump(); };
  window.__vpDump = function (name) {
    walk(function (node) {
      var c = nm(node);
      if (HIT.test(c) && (!name || c === name)) dump(node, 'DUMP');
    });
  };
  lg('探针就绪: 关注 [VP] 界面变化 / FOUND / CALL / 行 / 数据; window.__vp() 手动重打');
})();
