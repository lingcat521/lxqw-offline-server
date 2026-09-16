/* lxqw roompatch: 让"小屋场景"在青蛙状态变化时**立刻**重画 —— additive layer.
 *
 * 用户报的 bug(原话): "准备好旅行后，青蛙的状态与渲染不会立即更新，要退出小屋后才会更新"。
 *
 * 原因(客户端 main.min.js 里查到的硬证据):
 *   MainInController 只监听了
 *     UserEventType.updateClover / TravelEventType.updateRedpoint /
 *     ItemEventType.updateDesk / updateBag / TravelNoteEventType.checkNoteGuide /
 *     FurnitureEventType.UPDATE / DrawingEventType.ITEM_CHANGE / RoleEventType.updateDecoration
 *   —— **没有** RoleEventType.loadRole。
 *   而 MainInView.updateFlogStatus()(唯一决定"屋里有没有青蛙"的那个函数, 用
 *   Tabikaeru.Game.instance().isHome = RoleModel.getFrogStatus()==0)只在两处被调用:
 *     childrenCreated(进小屋时) 与 reset()(MainInController.open() 重新打开视图时)。
 *   所以服务端 push client_load_role 之后: 外面场景(MainOutController 监听 loadRole -> reset)会立刻更新,
 *   而**小屋里**要等玩家出门再进屋(reset)才更新 —— 就是用户看到的现象。
 *
 * 修法: 服务端不能只在协议层喊话, 得像 bench hotspot 那样把"重画"这个动作**递到视图上**:
 *   找到场景层里带 updateFlogStatus 的视图(MainInView / MainOutView 都有同名方法),
 *   直接调 updateFlogStatus(); 顺带 updateFurnitureAni()(家具动画也按 isHome 分支) 与
 *    updateBagState()(背包文案/红点)。全部 try/catch 包起来, 找不到视图就安静跳过。
 *   触发点放在 travel2.js 的状态观察器里(它本来就在轮询 status 变化) -> 出发/回家/GM 都能覆盖。
 */
(function () {
  var st = window.MOCK_STATE || (window.MOCK_STATE = {});
  function log(m) { try { console.log("[MOCK] " + m); } catch (e) {} }

  function isRoomView(v) { return !!(v && typeof v.updateFlogStatus === 'function'); }

  /* 1) 首选: PageManage 的场景层控制列表(getControl 内部用的就是它) */
  function fromPageManage() {
    var out = [];
    try {
      var pm = core.PageManage.getInstance();
      if (!pm || typeof pm.getControlList !== 'function') return out;
      var layer = (core.ViewLayerType && core.ViewLayerType.SceneLayer !== undefined) ? core.ViewLayerType.SceneLayer : 0;
      var list = pm.getControlList(layer) || [];
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        var v = c && (c.view || c);
        if (isRoomView(v)) out.push(v);
      }
    } catch (e) {}
    return out;
  }
  /* 2) 兜底: 从舞台整棵树里找(视图是 Controller 的子节点, 所以直接按方法名认) */
  function fromStage() {
    var out = [];
    try {
      var stage = (egret && egret.MainContext && egret.MainContext.instance && egret.MainContext.instance.stage) || null;
      var stack = stage ? [stage] : [];
      var guard = 0;
      while (stack.length && guard++ < 4000) {
        var n = stack.pop();
        if (!n) continue;
        if (isRoomView(n) && out.indexOf(n) < 0) out.push(n);
        var kids = n.$children;
        if (kids) for (var k = 0; k < kids.length; k++) stack.push(kids[k]);
      }
    } catch (e) {}
    return out;
  }
  function views() {
    var a = fromPageManage();
    if (a.length) return a;
    return fromStage();
  }

  /* 测试/GM: 看看现在能找到几个屋子视图 */
  /* 测试/调试: 清掉节流/指纹 */
  window.MOCK_ROOM_RESET_THROTTLE = function () { lastRefresh = 0; lastSig = ''; return true; };
  window.MOCK_ROOM_PROBE = function () {
    var a = views(), o = [];
    for (var i = 0; i < a.length; i++) {
      var v = a[i];
      o.push({ anim: v.curAnimName || '', player: v.player ? 1 : 0,
               frogCap: v.frogCap ? (v.frogCap.visible ? 1 : 0) : null,
               bagState: (typeof v.updateBagState === 'function') ? 1 : 0 });
    }
    return { count: a.length, views: o, isHome: !!(st.frog && st.frog.status === 0) };
  };

  var lastRefresh = 0, lastSig = '';
  /* 状态指纹: 只有 motion/status/crafting/party 真的变了才值得重画 —— 重复重画才是"精灵累积"的来源 */
  function roomSig() {
    try {
      var f = st.frog || {};
      var mk = (st.furniture && st.furniture.make && st.furniture.make.id) ? 1 : 0;
      return [Number(f.status) || 0, Number(f.motion), Number(f.crafting) || 0, Number(f.party) || 0, mk].join('|');
    } catch (e) { return ''; }
  }
  window.MOCK_REFRESH_ROOM = function (why, force) {
    /* 节流: 默认 10 秒内最多重画一次(频繁 updateFlogStatus 会反复新建精灵, 累积后会盖住场景/打断拖动) */
    var now = Date.now();
    if (Number(st.roomRefresh) === 0) { log('小屋刷新已关闭(st.roomRefresh=0) [' + (why || '') + ']'); return 0; }
    var sig = roomSig();
    if (!force && sig === lastSig) return 0;                  /* 状态没变: 不重画(这是"零代价"的关键) */
    if (!force && now - lastRefresh < 5000) return 0;         /* 5 秒节流: 变化很频繁时也不刷屏 */
    lastRefresh = now; lastSig = sig;
    var a = views(), n = 0;
    for (var i = 0; i < a.length; i++) {
      var v = a[i];
      try { v.updateFlogStatus(); n++; } catch (e) { log('小屋刷新 updateFlogStatus 出错: ' + (e && e.message || e)); }
      /* 只调 updateFlogStatus: 它销毁并重建**玩家**这一个精灵;
         updateFurnitureAni/updateBagState 会重建家具/背包的一堆精灵 —— 用户复现的"按钮被遮/拖不动"
         就是精灵累积造成的, 所以这里不再碰它们(家具/背包交给各自的数据推送去刷新)。 */
    }
    log('小屋刷新(' + (why || '') + '): ' + n + ' 个视图, isHome=' + (st.frog && st.frog.status === 0 ? 1 : 0));
    return n;
  };
})();
