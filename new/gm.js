/* lxqw 调试/GM 通道（清单第一节"存档重置/调试接口" + 第十八节"时间支持倍率"）
 *
 * 通道: tools/devserver2.js 提供
 *      POST /gm   {"cmd":"clover","args":[9999]}   或纯文本 "clover 9999"
 *      GET  /gm   取走并清空队列（本层每 3 秒轮询一次）
 *   于是不用改代码、不用重装 APK, 在电脑/DSH 侧就能驱动真机:
 *      curl -s -X POST -d 'clover 9999'  http://127.0.0.1:8089/gm
 *      curl -s -X POST -d 'give 8501 5'  http://127.0.0.1:8089/gm
 *      curl -s -X POST -d 'home'         http://127.0.0.1:8089/gm      # 强制归来
 *      curl -s -X POST -d 'offset 7200'  http://127.0.0.1:8089/gm      # 时间前移 2 小时
 *      curl -s -X POST -d 'reset'        http://127.0.0.1:8089/gm      # 清存档并重载
 *   命令行之外, 客户端里也能直接调: window.MOCK_GM.cmd('clover', 9999)
 *
 * 支持的命令: say/clover/ticket/give/take/clearbag/home/away/settime/offset/timescale/
 *             weather/dump/reset/reload/help/notice/flush/trip/make/caketask/party
 *   notice auto|always|never  播报策略(默认 auto: 页面可见时不弹, 回来补播; always=原版总是弹)
 *   flush                     立刻补播挂起的播报
 *   trip 3 | trip auto        这一趟旅行固定 3 小时 / 回到"按行李自动算"
 *   make 120                  家具制作耗时改成 120 秒(0 = 回到默认 普通600/大件1800)
 *   caketask 2 1              聚会活动每周任务 id=2 加 1 次进度(不带 n 就是 +1)
 *   party | party end | party h 12 | party auto   立刻赴约 / 结束聚会 / 固定聚会时长 / 回到随机 6~18 小时
 *   visit [0|1|2] [分钟]      叫一位邻居来串门(停留默认 180~270 分钟; 第二个参数可临时改成几分钟)
 *   invite [0|1|2] | invite reset   立刻在门口挂一张邀请卡片 / 把绘纸状态重置为"等邀请"
 *   achieve now|silent|gap 40|list   立即播报待播报称号 / 静默标记为已提示 / 播报间隔秒 / 看状态
 *   furnish                  看摆放状态(put_fur/replace_fur/auto)
 *   furnish place 1101       替玩家把某件家具摆进小屋(必须是已拥有的)
 *   furnish auto 0|1         关/开"没摆过的家具自动进屋(每类一件)"
 *   furnish clear            清空摆放
 *   desire                   看"出门的想法"(背包/桌子/饥饿状态)
 *   roomrefresh 1|0          开关"场景重画"(0 = 完全不重画, 排查 UI 遮挡/拖不动)
 *   clean                    清掉物品栏里数量<=0 的幽灵行(合成碎片扣完后残留会让红点消不掉)
 *   furnish frog             让青蛙立刻自己动一件家具(原版行为)
 *   furnish ui 1|0           1 = 打开"玩家自己摆"的入口(非原版, 默认 0)
 * 时间: settime/offset 会同时改 Date.now 与 core.Time.getServerTime, 所以旅行倒计时、日历、
 *       活动时间窗都会跟着走(这就是"服务器时间+倍率"的离线等价物); timescale 是乘倍数。
 */
(function () {
  var M = window.MockServer, st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  var BASE = 'http://127.0.0.1:8089/gm';
  function log(m) { try { console.log('[MOCK] GM: ' + m); } catch (e) {} }
  function save() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
  /* 调试命令立刻落盘(用户踩过: /gm farm full 走 1~4 秒防抖, 紧接着 reload -> 改动丢了) */
  function saveNow() { try { if (window.MOCK_SAVE_NOW) window.MOCK_SAVE_NOW(); else save(); } catch (e) { save(); } }
  function push(name, data, d) { setTimeout(function () { try { M.dispatch(name, (typeof data === 'function' ? data() : (data !== undefined ? data : (typeof S[name] === 'function' ? S[name]() : null)))); } catch (e) {} }, d || 60); }
  function house() { return Array.isArray(st.house) ? st.house : (st.house = []); }

  /* ---- 时间: 一个全局偏移 + 倍率, Date.now 与 core.Time 一起改 ---- */
  var RealNow = Date.now;
  function clock() {
    var off = Number(st.timeOffset || 0), sc = Number(st.timeScale || 1) || 1;
    return Math.floor(RealNow() * sc + off * 1000);
  }
  function installClock() {
    if (!st.timeOffset && !st.timeScale) return;
    Date.now = clock;
    try {
      if (core && core.Time && !core.Time.__gmPatched) {
        core.Time.__gmPatched = 1;
        core.Time.getServerTime = function () { return Math.floor(clock() / 1000); };
      }
    } catch (e) {}
  }
  function nowSec() { return Math.floor(clock() / 1000); }

  var CMDS = {
    help: function () { log('命令: ' + Object.keys(CMDS).join(', ')); return 'help'; },
    say: function (a) { log('说: ' + a.join(' ')); return 'say'; },
    clover: function (a) { var n = Number(a[0]); if (!isFinite(n)) return 'clover?'; st.clover = n; save(); push('clover_update', { clover: n }); log('三叶草 = ' + n); return 'clover'; },
    ticket: function (a) { var n = Number(a[0]); if (!isFinite(n)) return 'ticket?'; st.ticket = n; save(); push('item_update_ticket', { ticket: n }); log('抽奖券 = ' + n); return 'ticket'; },
    give: function (a) {
      var id = Number(a[0]), n = Number(a[1] || 1);
      if (!id) return 'give?';
      var h = house(), f = null;
      for (var i = 0; i < h.length; i++) if (Number(h[i].item_id) === id) f = h[i];
      if (f) f.count = (Number(f.count) || 0) + n; else h.push({ item_id: id, count: n });
      save(); push('item_load_items'); log('给 ' + id + ' x' + n + ' (现有 ' + (f ? f.count : n) + ')');
      return 'give';
    },
    take: function (a) {
      var id = Number(a[0]), n = Number(a[1] || 1), h = house(), left = -1;
      for (var i = 0; i < h.length; i++) if (Number(h[i].item_id) === id) { h[i].count = Math.max(0, (Number(h[i].count) || 0) - n); left = h[i].count; }
      save(); push('item_load_items'); log('收走 ' + id + ' x' + n + ' (剩 ' + left + ')');
      return 'take';
    },
    clearbag: function () { st.house = []; st.bag = []; st.desk = []; save(); push('item_load_items'); log('背包已清空'); return 'clearbag'; },
    home: function () {                      /* 强制归来: 交给 rules.js 那个 4 秒的结算泵 */
      if (!st.frog) st.frog = {};
      st.frog.traveling = true;
      st.frog.status = 1;
      st.frog.returnAt = clock() - 1000;
      save(); log('强制归来(4 秒内结算)');
      return 'home';
    },
    away: function (a) {                     /* 强制出发: 走客户端的出发协议, 时长可给秒数 */
      var secs = Number(a[0] || 0);
      try { if (secs > 0) st.travelSeconds = secs; } catch (e) {}
      var h = house();
      if (!st.frog) st.frog = {};
      st.frog.traveling = false;             /* 让 rules.js 自己算时长 */
      try { if (window.MOCK_FORCE_DEPART) window.MOCK_FORCE_DEPART(); else core.SocketManage.getInstance().send('item_set_bag_completed', null, 1); } catch (e) { log('出发失败: ' + (e && e.message)); }
      log('强制出发(绕开"心情"; 若背包里没吃的它也不带东西走)');
      return 'away';
    },
    settime: function (a) { var ts = Number(a[0]); if (!isFinite(ts)) return 'settime?'; st.timeOffset = ts - Math.floor(RealNow() / 1000); installClock(); save(); log('服务器时间 -> ' + new Date(ts * 1000).toLocaleString() + ' (offset ' + st.timeOffset + 's)'); return 'settime'; },
    offset: function (a) { var d = Number(a[0]); if (!isFinite(d)) return 'offset?'; st.timeOffset = Number(st.timeOffset || 0) + d; installClock(); save(); log('时间偏移 -> ' + st.timeOffset + 's'); return 'offset'; },
    timescale: function (a) { var x = Number(a[0]); if (!isFinite(x) || x <= 0) return 'timescale?'; st.timeScale = x; installClock(); save(); log('时间倍率 -> ' + x + 'x'); return 'timescale'; },
    notice: function (a) {
      var m = String(a[0] || '');
      if (['auto', 'always', 'never'].indexOf(m) < 0) { log('用法: notice auto|always|never (当前 ' + (st.noticeMode || 'auto') + ')'); return 'notice?'; }
      st.noticeMode = m; save(); log('播报策略 -> ' + m); return 'notice';
    },
    flush: function () {
      var n = 0;
      try { n = window.MOCK_FLUSH_NOTICES ? window.MOCK_FLUSH_NOTICES() : 0; } catch (e) {}
      log('补播挂起播报 ' + n + ' 条'); return 'flush';
    },
    trip: function (a) {
      var v = String(a[0] === undefined ? '' : a[0]);
      if (!v || v === 'auto' || Number(v) === 0) { try { delete st.travelSeconds; } catch (e) { st.travelSeconds = undefined; } save(); log('旅行时长 -> 按行李自动算(0.5~72 小时)'); return 'trip'; }
      var h = Number(v);
      if (!isFinite(h) || h <= 0) { log('用法: trip 3 (=3 小时) 或 trip auto'); return 'trip?'; }
      st.travelSeconds = Math.round(h * 3600); save(); log('旅行时长固定 ' + h + ' 小时'); return 'trip';
    },
    make: function (a) {
      var sec = Number(a[0] === undefined ? 0 : a[0]);
      if (!isFinite(sec) || sec < 0) { log('用法: make 120 (=120 秒; 0=默认)'); return 'make?'; }
      st.makeSeconds = sec; save();
      log('家具制作耗时 -> ' + (sec > 0 ? sec + ' 秒' : '默认(普通 600 / 大件 1800 秒)'));
      return 'make';
    },
    caketask: function (a) {
      var id = Number(a[0]), n = Number(a[1] === undefined ? 1 : a[1]);
      if (!id) { log('用法: caketask <1..6> [次数]; 现在: ' + JSON.stringify(window.MOCK_CAKE_TASK ? window.MOCK_CAKE_TASK.state() : null)); return 'caketask?'; }
      var okk = false;
      try { okk = window.MOCK_CAKE_TASK ? window.MOCK_CAKE_TASK.pro(id, n) : false; } catch (e) {}
      log('每周任务 ' + id + ' +' + n + ' -> ' + (okk ? 'ok' : '没加上(已完成?)') + ' ' +
          JSON.stringify(window.MOCK_CAKE_TASK ? window.MOCK_CAKE_TASK.state().tasks : null));
      return 'caketask';
    },
    furnish: function (a) {
      var F = window.MOCK_FURNISH;
      if (!F) { log('家具摆放层没装'); return 'furnish?'; }
      var sub = String(a[0] === undefined ? 'list' : a[0]);
      if (sub === 'place') { var id = Number(a[1]); if (!id) { log('用法: furnish place <家具id>'); return 'furnish?'; }
        var r = F.place(id); log('摆放 ' + id + ' -> ' + JSON.stringify(r) + ' ' + JSON.stringify(F.state().put_fur)); return 'furnish'; }
      if (sub === 'clear') { F.clear(); log('摆放已清空'); return 'furnish'; }
      if (sub === 'auto') { var v = Number(a[1]); log('自动摆放 -> ' + F.auto(v ? 1 : 0)); return 'furnish'; }
      if (sub === 'ui') { var u = Number(a[1]); log('玩家自己摆的入口(重新布置) -> ' + (F.ui(u ? 1 : 0) ? '开(需重载页面)' : '关(原版)')); return 'furnish'; }
      if (sub === 'frog') { var r2 = F.frog(); log('青蛙摆放 -> ' + (r2 ? ('家具' + r2) : '这次没动') + ' ' + JSON.stringify(F.state().put_fur)); return 'furnish'; }
      var S2 = F.state();
      log('摆放: put_fur=' + JSON.stringify(S2.put_fur) + ' replace_fur=' + JSON.stringify(S2.replace_fur) +
          ' has_fur=' + S2.has_fur + ' auto=' + S2.auto);
      return 'furnish';
    },
    achieve: function (a) {
      var A = window.MOCK_ACHIEVE;
      if (!A) { log('称号层没装'); return 'achieve?'; }
      var sub = String(a[0] === undefined ? 'list' : a[0]);
      if (sub === 'now') { var n = 0, guard = 0; while (A.publish(true) && guard++ < 200) n++; log('立即播报 ' + n + ' 个称号'); return 'achieve'; }
      if (sub === 'silent') { var pend = A.pending(); var m = A.markSeen(pend); st.achieveQueue = []; save(); log('静默标记 ' + m + ' 个称号为已提示(不再弹窗)'); return 'achieve'; }
      if (sub === 'gap') { var g = Number(a[1]); if (!isFinite(g) || g < 0) { log('用法: achieve gap 40 (秒)'); return 'achieve?'; } st.achieveGap = g; save(); log('称号播报间隔 -> ' + g + ' 秒'); return 'achieve'; }
      log('称号: 已有 ' + (A.state().owns || []).length + ' 个, 待播报 ' + A.pending().length + ' 个, 间隔 ' +
          (st.achieveGap === undefined ? 300 : st.achieveGap) + 's, 当前佩戴 ' + A.state().cur);
      return 'achieve';
    },
    party: function (a) {
      var sub = String(a[0] === undefined ? '' : a[0]);
      if (sub === 'end') { var ok2 = false; try { ok2 = window.MOCK_PARTY ? window.MOCK_PARTY.finish('GM') : false; } catch (e) {} log('结束聚会 -> ' + ok2); return 'party'; }
      if (sub === 'hours' || sub === 'h') { var hv = Number(a[1]); if (!isFinite(hv) || hv <= 0) { log('用法: party h 12 (=12 小时)'); return 'party?'; } st.partySeconds = Math.round(hv * 3600); save(); log('聚会时长固定 ' + hv + ' 小时'); return 'party'; }
      if (sub === 'auto') { try { delete st.partySeconds; } catch (e) { st.partySeconds = undefined; } save(); log('聚会时长 -> 随机 6~18 小时(10% 到 24)'); return 'party'; }
      var r = false;
      try { r = window.MOCK_PARTY ? window.MOCK_PARTY.start('GM', { seconds: Number(a[1]) > 0 ? Number(a[1]) : undefined }) : false; } catch (e) {}
      log('发起聚会 -> ' + r + ' (时长 ' + Math.round((window.MOCK_DRAWING ? window.MOCK_DRAWING.partyMs() : 0) / 3600000) + ' 小时)'); return 'party';
    },
    invite: function (a) {
      var D = window.MOCK_DRAWING;
      if (!D) { log('绘纸层没装'); return 'invite?'; }
      var sub = String(a[0] === undefined ? '' : a[0]);
      if (sub === 'reset') { D.reset('GM'); return 'invite'; }
      var g = Number(sub);
      if (D.state().state !== 0 && D.state().state !== 1) { log('当前绘纸状态 ' + D.state().state + ' (0=等邀请 1=卡片已挂 2=已接受在备手信 3=已出发), 先 invite reset'); return 'invite'; }
      var ok2 = D.invite(isFinite(g) && g >= 0 ? g : undefined, 'GM');
      log('挂邀请卡片 -> ' + ok2 + ' ' + JSON.stringify(D.state()));
      return 'invite';
    },
    visit: function (a) {
      var g = Number(a[0]);
      var mins = Number(a[1]);
      if (isFinite(mins) && mins > 0) { st.visitSeconds = Math.round(mins * 60); save(); log('访客停留时间改成 ' + mins + ' 分钟'); }
      var r2 = false;
      try { r2 = window.MOCK_GUEST ? window.MOCK_GUEST.spawn(isFinite(g) && g >= 0 ? g : undefined) : false; } catch (e) {}
      var mins = 0; try { mins = Math.round(window.MOCK_GUEST.visitSeconds() / 60); } catch (e) {}
      log('叫一位邻居来串门 -> ' + r2 + ' (停留 ' + mins + ' 分钟; 离开后门口可能留邀请卡片)');
      return 'visit';
    },
    roomrefresh: function (a) {
      var v = Number(a[0]);
      if (!isFinite(v)) { log('用法: roomrefresh 1|0 (当前 ' + (st.roomRefresh === undefined ? 1 : st.roomRefresh) + ')'); return 'roomrefresh?'; }
      st.roomRefresh = v ? 1 : 0; save();
      log('场景重画(st.roomRefresh) -> ' + st.roomRefresh + (v ? '' : ' (完全不重画, 用于排除"按钮被遮/拖不动")'));
      return 'roomrefresh';
    },
    desire: function () {
      var f = window.MOCK_FROGSTATE;
      if (!f) { log('居家层没装'); return 'desire?'; }
      var s2 = f.state();
      log('出门的想法 = ' + (Math.round(s2.desire * 100) / 100) + ' | 背包 ' + JSON.stringify(s2.bag) +
          ' | 桌上 ' + JSON.stringify(s2.desk) + ' | 饿着=' + (s2.hungry ? 1 : 0));
      return 'desire';
    },
    weather: function (a) { var w = Number(a[0]); if (!isFinite(w) || w < 1 || w > 9) return 'weather?'; st.weather = w; save(); push('weather_load'); log('天气 -> ' + w); return 'weather'; },
    clean: function () {
      var before = Array.isArray(st.house) ? st.house.length : 0;
      var cleaned = [];
      (st.house || []).forEach(function (h) { if (h && (Number(h.count) || 0) > 0) cleaned.push(h); });
      st.house = cleaned; save();
      try { if (window.MockServer) window.MockServer.dispatch('item_load_items', (window.MOCK_SEMANTIC && window.MOCK_SEMANTIC['item_load_items']) ? window.MOCK_SEMANTIC['item_load_items']() : null); } catch (e) {}
      log('物品栏清理: ' + before + ' -> ' + st.house.length + ' 条(剔除了数量<=0 的幽灵行, 红点会跟着消)');
      return 'clean';
    },
    notice: function (a) {
      if (window.MOCK_TRAVEL_CATCHUP) { window.MOCK_TRAVEL_CATCHUP('GM'); log('已执行一次补发提示检查'); }
      else log('travel2 层没装');
      return 'notice';
    },
    plan: function (a) {
      if (String(a && a[0] || '') === 'keys') {
        var P2 = window.MOCK_PLANS, cp2 = st.clientPro || {};
        var ks = Object.keys(cp2).sort(function (x, y) { return Number(cp2[y]) - Number(cp2[x]); });
        log('客户端上报过的 key (' + ks.length + ' 个): ' + ks.map(function (k) { return k + '×' + cp2[k]; }).join('  '));
        var co = st.clientOpen || {}, ck = Object.keys(co).sort(function (x, y) { return Number(co[y]) - Number(co[x]); });
        log('协议观测到的界面开启 (' + ck.length + ' 类): ' + ck.map(function (k) { return k + '×' + co[k]; }).join('  '));
        var ps = st.protoSeen || {}, pk = Object.keys(ps).sort(function (x, y) { return Number(ps[y]) - Number(ps[x]); });
        var ad = (window.MOCK_PLANS && MOCK_PLANS.audit) ? MOCK_PLANS.audit() : null;
        if (ad) log('任务覆盖审计: ' + ad.resolved + '/' + ad.total + ' 有真实来源' + (ad.unresolved.length ? ('  ❌ 断链: ' + ad.unresolved.join(' | ')) : '  ✅ 无断链'));
        log('见过的协议 (' + pk.length + ' 个, 前 25): ' + pk.slice(0, 25).map(function (k) { return k + '×' + ps[k]; }).join('  '));
        if (P2 && P2.autoKey) log('  归一化匹配示例: CLIENT_NOTE_FRIEND -> ' + JSON.stringify(P2.autoKey('CLIENT_NOTE_FRIEND')));
        return 'plan';
      }
      var P = window.MOCK_PLANS;
      if (!P) { log('计划层没装'); return 'plan?'; }
      var pay = P.payload(), cp = st.clientPro || {};
      if (P.clientKeys) log('客户端上报映射: ' + Object.keys(P.clientKeys()).map(function (k) { return k + '<-' + P.clientKeys()[k][0]; }).join('  '));
      if (P.eventSources) log('事件出口对照: ' + Object.keys(P.eventSources()).map(function (k) { return k + ':' + P.eventSources()[k]; }).join(' | '));
      log('客户端上报计数 st.clientPro=' + JSON.stringify(cp));
      ['daily', 'weekly'].forEach(function (k) {
        var p = pay[k]; if (!p) return;
        log(k + ' (' + p.score + ' 分): ' + p.tasks.map(function (x) { return x.desc + ' ' + x.current_count + '/' + x.target + (x.status === 'completed' ? '✓' : ''); }).join(' | '));
      });
      return 'plan';
    },
    map: function (a) {
      var V = window.MOCK_MAPVIEW, M = window.MOCK_MAP;
      if (!V) { log('地图浮层没装'); return 'map?'; }
      var sub = String(a[0] || '');
      if (sub === 'open') { V.show(); log('已要求打开地图浮层'); return 'map'; }
      if (sub === 'close') { V.hide(); return 'map'; }
      var p2 = M ? M.progress() : { unlocked: 0, total: 0 };
      log('地图: ' + p2.unlocked + '/' + p2.total + ' 个地点已点亮 | 浮层' + (V.isOpen() ? '已开' : '未开') + ' | 已经接管 openWebView');
      if (M && M.regions11) log('  ' + M.regions11().map(function (r) { return r.name + ' ' + r.unlocked + '/' + r.total; }).join(' | '));
      log('  用法: /gm map open | /gm map close');
      return 'map';
    },
    pot: function (a) {
      var F = window.MOCK_FARM;
      if (!F) { log('农场层没装'); return 'pot?'; }
      var sub = String(a[0] || '');
      function plantIds() {
        /* 客户端的字段名/形状不止一种: flowerpotData 可能是 DB(有 get) 也可能是普通对象; 兜底用 flowerData */
        var out = [];
        try {
          var dm = Tabikaeru.DataManager.instance();
          var db = dm && (dm.flowerpotData || dm.FlowerpotData);
          var g = db ? (typeof db.get === 'function' ? db.get('plant') : db['plant']) : null;
          for (var k in g) if (Number(k)) out.push(Number(k));
        } catch (e) {}
        if (!out.length) { try { if (window.MOCK_FARM && window.MOCK_FARM.seeds) out = window.MOCK_FARM.seeds().slice(); } catch (e) {} }
        if (!out.length) { try { var fd = Tabikaeru.DataManager.instance().flowerData; var L = fd ? (typeof fd.list === 'function' ? fd.list() : fd) : null; for (var j in L) if (Number(j)) out.push(Number(j)); } catch (e) {} }
        return out;
      }
      if (sub === 'list') {
        var ids = plantIds().slice(0, 40);
        log('可用作物(flowerpotData.plant 的 id, 客户端只认这些): ' + ids.join(' '));
        log('  用法: /gm pot plant <id> [盆序号 1..N] | /gm pot stage 3(直接催熟) | /gm pot clear');
        return 'pot';
      }
      if (sub === 'plant') {
        var id = Number(a[1]);
        if (!plantIds().length || plantIds().indexOf(id) < 0) { log('这个 id 不在 client 的 plant 表里, 客户端画不出来: ' + id); return 'pot'; }
        var okp = false, how = '';
        var tries = [['plant(id)', function () { return F.plant(id); }],
                     ['plant(type,index,id)', function () { return F.plant(1, 1, id); }],
                     ['plant(type,index,id) 2 号位', function () { return F.plant(1, 2, id); }]];
        for (var ti = 0; ti < tries.length && !okp; ti++) { try { okp = tries[ti][1](); if (okp) how = tries[ti][0]; } catch (e) {} }
        log('种下 ' + id + ' -> ' + okp + ' via ' + how + ' | 现在: ' + JSON.stringify(F.farm().map(function (c) { return { t: c.type, i: c.index, plant: c.plant_id, stage: c.stage }; })));
        return 'pot';
      }
      if (sub === 'stage') {
        var want = Number(a[1] || 3);
        var f = st.farm || (st.farm = {});
        var n = 0;
        for (var i = 0; i < (f.slots || []).length; i++) {
          var sl = f.slots[i]; if (!sl || !Number(sl.plant)) continue;
          sl.stageAt = Math.floor(Date.now() / 1000) - 999999;      /* 把"上次进阶时间"推到很久以前 -> grownStage 直接拉满 */
          sl.plantedAt = sl.stageAt; n++;
        }
        save();
        try { window.MockServer.dispatch('furniture_load_flowerpot', (window.MOCK_SEMANTIC['furniture_load_flowerpot'] || function () { return null; })()); } catch (e) {}
        log('催熟 ' + n + ' 盆 -> 阶段拉满(客户端应显示成熟可收)');
        return 'pot';
      }
      if (sub === 'clear') {
        var f2 = st.farm || (st.farm = {});
        for (var j = 0; j < (f2.slots || []).length; j++) { f2.slots[j].plant = 0; f2.slots[j].stageAt = 0; f2.slots[j].plantedAt = 0; }
        save();
        try { window.MockServer.dispatch('furniture_load_flowerpot', (window.MOCK_SEMANTIC['furniture_load_flowerpot'] || function () { return null; })()); } catch (e) {}
        log('花盆已清空');
        return 'pot';
      }
      var pot = F.farm ? F.farm() : [];
      log('花盆: ' + pot.length + ' 个 [' + pot.map(function (c) { return c.type + '/' + c.index + ':' + (c.plant_id || '空') + '(阶段' + c.stage + '/' + c.stages + ')'; }).join(' ') + ']');
      log('  用法: /gm pot list | /gm pot plant <id> | /gm pot stage 3 | /gm pot clear');
      return 'pot';
    },
    cdkey: function (a) {
      var C = window.MOCK_CDKEY;
      if (!C) { log('兑换码层没装'); return 'cdkey?'; }
      var sub = String(a[0] || '');
      if (sub === 'reset') { C.reset(); log('已重置"已领过的码"(可重新领)'); return 'cdkey'; }
      if (sub === 'use') { var r = window.MOCK_SEMANTIC['item_use_gift_code']({ gift_code: String(a.slice(1).join(' ') || '') }); log('兑换 -> ' + JSON.stringify(r)); return 'cdkey'; }
      var tb = C.table();
      log('兑换码: ' + tb.length + ' 个, 已用 ' + C.used().length + ' [' + C.used().join(',') + ']');
      log('  未用: ' + tb.filter(function (x) { return !x.used; }).map(function (x) { return x.code; }).join(' '));
      return 'cdkey';
    },
    fx: function (a) {
      var F = window.MOCK_CLICKFX;
      if (!F) { log('点击特效层没装'); return 'fx?'; }
      var sub = String(a[0] || '');
      if (sub === 'unlock') { var r = F.unlock(num(a[1] || 1), 'GM'); log(r ? ('解锁点击特效 ' + r + ' (设置页的"暂未获得"会变成图标)') : '解锁失败/已拥有(资源只有 1~4)'); return 'fx'; }
      if (sub === 'use') { var r2 = F.equip(num(a[1] || 0), 'GM'); log('装备 -> ' + JSON.stringify(r2)); return 'fx'; }
      log('点击特效: 当前 ' + JSON.stringify(F.state()) + ' | ' + JSON.stringify(F.effects()));
      log('  用法: /gm fx unlock <1..4> | /gm fx use <1..4|0>');
      return 'fx';
    },
    farm: function (a) {
      var F = window.MOCK_FARM;
      if (!F) { log('农场层没装'); return 'farm?'; }
      var sub = String(a[0] || '');
      if (sub === 'full') {
        st.cloverGrown = 20; st.cloverSince = Math.floor(Date.now() / 1000);
        saveNow();
        var cs = F.farmState();
        try { window.MockServer.dispatch('clover_load_clovers', (window.MOCK_STATE.clovers || [])); } catch (e) {}
        log('三叶草农场: 直接长满 ' + cs.current_count + '/' + cs.max_capacity + ' 棵, sprite=' +
            JSON.stringify(cs.clovers.map(function (c) { return c.sprite; })) + ' (门口那块地现在应该是长成的样子)');
        return 'farm';
      }
      if (sub === 'empty') {
        st.cloverGrown = 0; st.cloverSince = Math.floor(Date.now() / 1000); saveNow();
        try { window.MockServer.dispatch('clover_load_clovers', (window.MOCK_STATE.clovers || [])); } catch (e) {}
        log('三叶草农场: 清空(回到刚收割完的样子)'); return 'farm';
      }
      var s = F.farmState();
      log('三叶草农场: ' + s.current_count + '/' + s.max_capacity + ' 棵, 每棵 ' + s.seconds_per_clover + 's, 满仓 ' +
          Math.round(s.grow_seconds_full / 3600) + 'h, 每棵四叶草 ' + Math.round(s.four_leaf_chance * 100) + '%, sprite=' +
          JSON.stringify(s.clovers.map(function (c) { return c.sprite; })));
      log('  用法: /gm farm full 直接长满 | /gm farm empty 清空');
      return 'farm';
    },
    book: function (a) {
      var B = window.MOCK_FRIEND_BOOK;
      if (!B) { log('友情绘本层没装(v0.71+ 才有)'); return 'book?'; }
      var sub = String(a[0] || '');
      if (sub === 'reset') { B.reset(); log('友情绘本记录已清空(可重新解锁)'); return 'book'; }
      if (sub === 'unlock') {
        var id = Number(a[1] || 0);
        if (!id) {
          /* 不给 id: 把三本"聚会绘本"都发一遍(每个朋友一本), 让绘本界面立刻有内容 */
          var n = 0;
          [20, 21, 22].forEach(function (x) { if (B.unlock(x, 'GM')) n++; });
          log('解锁 ' + n + ' 本聚会绘本(壁虎/刺猬/萤火虫)');
          return 'book';
        }
        var r = B.unlock(id, 'GM');
        log(r ? ('解锁『' + r.title + '』(' + r.rarity + ') -> ' + (r.kind === 'page' ? '绘纸页' : '旅友笔记')) : ('解锁失败: id ' + id + ' 不存在或已解锁'));
        return 'book';
      }
      var tb = B.table(), un = B.unlocked();
      log('友情绘本: 共 ' + tb.length + ' 本, 已解锁 ' + un.length + ' [' + tb.filter(function (x) { return x.unlocked; }).map(function (x) { return x.id + ':' + x.title; }).join(', ') + ']');
      log('  绘纸页 ' + JSON.stringify((st.drawing && st.drawing.pages) || []) + ' | 收藏 ' + JSON.stringify((st.drawing && st.drawing.colls) || []));
      log('  用法: /gm book unlock <id> 或 /gm book unlock(三本聚会绘本一起发)');
      return 'book';
    },
    story: function (a) {
      var sub = String(a[0] || '');
      if (sub === 'unlock') {
        var id = Number(a[1] || 1);
        var r = window.MOCK_STORY_UNLOCK ? window.MOCK_STORY_UNLOCK(id, 'GM') : null;
        log(r ? ('解锁故事 ' + id + ' (旅行趣事页签会立刻多一张卡)') : '解锁失败: 故事层没装或 id 不在 1..25');
        return 'story';
      }
      if (sub === 'backfill') { log('补记第一条 -> ' + (window.MOCK_STORY_BACKFILL ? window.MOCK_STORY_BACKFILL() : 'n/a')); return 'story'; }
      var list = (window.MOCK_SEMANTIC && window.MOCK_SEMANTIC['story_load']) ? (window.MOCK_SEMANTIC['story_load']().stories || []) : [];
      log('故事: 客户端可见 ' + list.length + '/25 条 [' + list.map(function (s) { return s.id; }).join(',') + ']' +
          ' | 自研趣事 ' + ((st.stories2 || []).length) + ' 条 | new_story_id=' + (st.newStoryId || 0) + ' | 空手 ' + (st.storyDry || 0) + ' 趟');
      log('  用法: /gm story unlock <1..25> 手动解锁一条; /gm story backfill 补记第一条');
      return 'story';
    },
    diary: function (a) {
      var D = window.MOCK_DIARY;
      if (!D) { log('日记层没装'); return 'diary?'; }
      var sub = String(a[0] || '');
      if (sub === 'write') { var r = D.write('GM'); log(r ? ('写了《' + r.title + '》 笔记页 ' + r.note) : '没有可写的条目'); return 'diary'; }
      if (sub === 'reset') { D.reset(); log('日记清空'); return 'diary'; }
      var c = D.ctx();
      log('日记: 已写 ' + D.list().length + ' 篇 / 可用页 ' + D.pages() + ' 张 / 待写候选 ' + JSON.stringify(D.pending()));
      log('  这一趟: ' + (c.route ? (c.route.placeName + ' ' + c.route.km + '/' + c.route.budget + 'km ' + (c.route.detour ? '绕路 ' : '') + (c.route.secret ? '隐藏 ' : '') + '风格=' + (c.route.flavor || '-')) : '(还没出门)') +
          ' 天气=' + c.weather + ' 季节=' + c.season + ' 旅行次数=' + c.trips + ' 去过 ' + c.places + ' 个地方' +
          ' 旅友笔记=' + c.friendNotes + ' 节气=' + c.solar + ' 节日=' + (c.festival ? 'yes' : 'no'));
      var list = D.list();
      for (var i = Math.max(0, list.length - 5); i < list.length; i++) log('  《' + list[i].title + '》页' + list[i].note + ' — ' + list[i].placeName + ' @' + list[i].at);
      return 'diary';
    },
    route: function () {
      var R = window.MOCK_ROUTE;
      if (!R) { log('路线层没装'); return 'route?'; }
      var s = R.stats();
      log('路线: ' + s.nodes + ' 节点 / ' + s.edges + ' 边 / ' + s.places + ' 目的地(' + s.placesWithPics + ' 个有景点照, ' + s.goalPics + ' 张)');
      var last = st.tripRoute;
      if (last) log('  上一趟: ' + (last.names || []).join(' -> ') + ' | ' + last.km + '/' + last.budget + 'km' + (last.detour ? ' 绕路' : '') + (last.secret ? ' 隐藏' : '') + ' 判定=' + last.grade + ' 图=' + last.pic);
      var sim = R.simulate(60, st.lastTripItems || []);
      log('  试跑 60 次: 分级 ' + JSON.stringify(sim.grades) + ' 区域 ' + JSON.stringify(sim.regions) + ' 坏图 ' + sim.bad.length);
      return 'route';
    },
    dump: function () {
      log('state: clover=' + st.clover + ' ticket=' + st.ticket + ' house=' + house().length +
          ' has_fur=' + ((st.furniture && st.furniture.has_fur) || []).length +
          ' bench=' + JSON.stringify((st.furniture && st.furniture.bench) || []) +
          ' frog=' + JSON.stringify(st.frog || {}) +
          ' craft.' + (st.craft ? ('wish=' + (st.craft.wishes || []).length + ' stamp=' + (st.craft.stamps || []).length + ' box=' + (st.craft.boxes || []).length) : 'n/a') +
          ' notes=' + ((st.notes || []).length) + ' mail=' + ((st.mailTaken || []).length) + ' offset=' + (st.timeOffset || 0) + ' scale=' + (st.timeScale || 1) +
          ' notice=' + (st.noticeMode || 'auto') + ' makeSeconds=' + (st.makeSeconds || 0) + ' tripSeconds=' + (st.travelSeconds || 0) +
          ' cakeTasks=' + JSON.stringify((window.MOCK_CAKE_TASK ? window.MOCK_CAKE_TASK.state().tasks : []).map(function (t) { return t.id + ':' + t.count + '/' + t.total; })) +
          ' diary=' + ((st.diary || []).length) + ' pages=' + (window.MOCK_DIARY ? window.MOCK_DIARY.pages() : 0) +
          ' route=' + JSON.stringify(st.tripRoute ? { place: st.tripRoute.placeName, km: st.tripRoute.km, grade: st.tripRoute.grade } : null));
      return 'dump';
    },
    reload: function () { log('重载页面…'); setTimeout(function () { try { location.reload(); } catch (e) {} }, 200); return 'reload'; },
    reset: function () {
      log('清存档: 所有 MOCK_STATE 归零, 然后重载页面');
      try {
        var keys = Object.keys(st);
        for (var i = 0; i < keys.length; i++) delete st[keys[i]];
        st.resetAt = nowSec();
      } catch (e) {}
      save();
      setTimeout(function () { try { location.reload(); } catch (e) {} }, 400);
      return 'reset';
    }
  };
  function run(cmd) {
    if (!cmd) return;
    var name = String(cmd.cmd || cmd.name || '').replace(/^-+/, '');
    var args = Array.isArray(cmd.args) ? cmd.args : (cmd.arg !== undefined ? [cmd.arg] : []);
    var fn = CMDS[name];
    if (!fn) { log('未知命令 ' + name + ' (可用: ' + Object.keys(CMDS).join(', ') + ')'); return; }
    try { fn(args); } catch (e) { log(name + ' 执行出错: ' + (e && e.message || e)); }
  }
  window.MOCK_GM = { cmd: function (name, a) { run({ cmd: name, args: [].concat(a === undefined ? [] : a) }); }, list: function () { return Object.keys(CMDS); }, state: function () { return st; } };
  window.MOCK_GM.clover = function (n) { run({ cmd: 'clover', args: [n] }); };

  var fails = 0;
  function poll() {
    try {
      var x = new XMLHttpRequest();
      x.open('GET', BASE + '?t=' + RealNow(), true);
      x.onreadystatechange = function () {
        if (x.readyState !== 4) return;
        var q = null;
        try { q = JSON.parse(x.responseText); } catch (e) { return; }
        if (Array.isArray(q) && q.length) { log('收到 ' + q.length + ' 条命令'); for (var i = 0; i < q.length; i++) run(q[i]); }
      };
      x.send(null);
      fails = 0;
    } catch (e) {
      fails++;
      if (fails === 1 || fails % 20 === 0) log('GM 通道不可用(' + fails + ' 次): ' + (e && e.message || e));
    }
  }
  installClock();
  setInterval(poll, 3000);
  setTimeout(poll, 1500);
  log('调试通道就绪: POST http://127.0.0.1:8089/gm  (命令: ' + Object.keys(CMDS).join(', ') + ')');
})();
