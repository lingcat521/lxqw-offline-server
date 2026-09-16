/* lxqw 青蛙状态机（/storage/emulated/0/new.txt 的「居家 / 旅行 / 社交 / 特殊」四类状态）—— additive layer.
 *
 * new.txt 要点 → 本层对应实现:
 *   居家: 吃饭/看书/打瞌睡/写信写日记/做手工削木头 —— 随机触发、循环出现、每次持续很久
 *         → 客户端自己就有 Frogpattern(0..2) 与 FrogMotionNum{doku:0,doku_s:1,write:2,make:3,eat:4},
 *           FrogMotionName 把 id 映射成动画名(dokusyo_ie/inemuri_ie/hikki_ie/sagyou_ie/syokuzi_ie/sleep_1..4)。
 *           我们**直接用客户端这张表**挑动作, 再把 frog.motion 推给客户端 + 让小屋立刻重画。
 *           顺手解锁对应的小动作图鉴(momentData type=1, param=动画名)。
 *   居家: 收拾行囊 —— 回家后把桌上的备用品默默收进背包(服务端真搬运 + 推 item_load_items)。
 *   居家: 饥饿等待/饿晕 —— 背包和桌子都没有吃的: 记 emptySince; 久了改成一直睡觉(sleep_1..4)。
 *   特殊: 离家出走 —— 空行李持续 ~10 小时(可配 st.runawaySeconds)就出走(status=1, 不会自己回来),
 *         必须**在桌上放食物**才会回家。
 *   旅行: 决定出发 —— 不再只等玩家按「准备」: 背包里有吃的 + 在家待够一段时间(可配)
 *         青蛙就自己出发(走客户端的 item_set_bag_completed 协议, 和 GM 的 away 同一个入口)。
 *   社交: 庭院访客排期 —— 旅行 2/5/8 次后依次来 蜗牛/蜜蜂/乌龟, 之后每隔 3 次来一位(见 guestfeed.js 里的钩子)。
 *   称号: 佩戴的称号会改旅行时长与三叶草收益(见 new/achieve.js 的 MOCK_TITLE)。
 */
(function () {
  var M = window.MockServer, st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  function log(m) { try { console.log('[MOCK] 居家: ' + m); } catch (e) {} }
  function save() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
  function nowSec() { return Math.floor(Date.now() / 1000); }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function arr(v) { return Array.isArray(v) ? v : []; }

  /* ---- 客户端自己的动作表(拿不到就内联同一份) ---------------------------- */
  var PATTERN = [
    ['eat', 'eat', 'eat', 'eat', 'doku', 'doku', 'doku', 'doku', 'doku_s', 'doku_s', 'make', 'make', 'make'],
    ['eat', 'eat', 'doku', 'doku', 'doku', 'doku', 'doku_s', 'doku_s', 'write', 'write', 'write', 'write', 'write'],
    ['write', 'write', 'write', 'write', 'eat', 'eat', 'make', 'make', 'make', 'make', 'write', 'write', 'write']
  ];
  var MOTION_NUM = { doku: 0, doku_s: 1, write: 2, make: 3, eat: 4 };
  function defs() { try { return Tabikaeru.Define || {}; } catch (e) { return {}; } }
  function patterns() {
    var D = defs();
    if (D.Frogpattern) {
      var out = [], n = num(D.FrogPatternMax) || 3;
      for (var i = 0; i < n; i++) if (Array.isArray(D.Frogpattern[i]) && D.Frogpattern[i].length) out.push(D.Frogpattern[i]);
      if (out.length) return out;
    }
    return PATTERN;
  }
  function motionNum(tok) {
    var D = defs();
    var m = (D.FrogMotionNum && D.FrogMotionNum[tok] !== undefined) ? num(D.FrogMotionNum[tok]) : MOTION_NUM[tok];
    return isFinite(m) ? m : 0;
  }
  function motionName(id) {
    var D = defs();
    if (D.FrogMotionName && D.FrogMotionName[id] !== undefined) return String(D.FrogMotionName[id]);
    return ({ 0: 'dokusyo_ie', 1: 'inemuri_ie', 2: 'hikki_ie', 3: 'sagyou_ie', 4: 'syokuzi_ie', 10: 'sleep_1', 11: 'sleep_2', 12: 'sleep_3', 13: 'sleep_4' })[id] || 'dokusyo_ie';
  }
  var LABEL = { 0: '看书', 1: '打瞌睡', 2: '写信/写日记', 3: '做手工/削木头', 4: '吃饭', 10: '睡觉', 11: '睡觉', 12: '睡觉', 13: '睡觉' };
  var MOMENT_OF = { dokusyo_ie: 1, inemuri_ie: 2, hikki_ie: 3, sagyou_ie: 4, syokuzi_ie: 5, sleep_1: 13, sleep_2: 12, sleep_3: 14, sleep_4: 15 };

  /* ---- 小动作图鉴(momentData type=1) ------------------------------------ */
  function moments() { st.moments = arr(st.moments); return st.moments; }
  function unlockMoment(name) {
    var id = MOMENT_OF[name];
    if (!id) return false;
    var a = moments();
    if (a.indexOf(id) >= 0) return false;
    a.push(id);
    save();
    log('解锁小动作图鉴 #' + id + '(' + name + ') 共 ' + a.length + ' 个');
    setTimeout(function () { try { M.dispatch('misc_moment_load', { list: a.slice() }); } catch (e) {} }, 60);
    return true;
  }
  S['misc_moment_load'] = function () { return { list: moments().slice() }; };
  S['misc_moment_unlock'] = function (p) {
    var id = num(p && (p.id !== undefined ? p.id : p.moment_id));
    var a = moments();
    if (id && a.indexOf(id) < 0) { a.push(id); save(); log('手动解锁小动作 #' + id); }
    return { code: 0 };
  };

  /* ---- 状态 helpers ------------------------------------------------------ */
  function home() { return !(st.frog && st.frog.status === 1); }
  function hasFood(list) {
    for (var i = 0; i < list.length; i++) {
      var id = num(list[i]);
      if (id < 0) continue;
      var t = -1;
      try { var d = Tabikaeru.DataManager.instance().ItemDB.get(id); t = d ? num(d.type) : -1; } catch (e) { t = -1; }
      if (t === 0) return true;                        /* type 0 = 食物 */
      if (t === -1 && id >= 0 && id < 25) return true;  /* ItemDB 拿不到时用 id 段兜底 */
    }
    return false;
  }
  function foodInBag() { return hasFood(arr(st.bag)); }
  function foodAnywhere() { return hasFood(arr(st.bag)) || hasFood(arr(st.desk)); }
  function pushRole() {
    /* 实时推送: 只在**动作真的变了**时推 role + 重画。MOCK_REFRESH_ROOM 内部还有"状态指纹"过滤,
       同一个状态重复调用不会再重画 —— 所以既实时、又不会累积精灵(用户要的"不要代价")。 */
    try { M.dispatch('client_load_role', (typeof S['client_load_role'] === 'function') ? S['client_load_role']() : null); } catch (e) {}
    try { if (window.MOCK_REFRESH_ROOM) window.MOCK_REFRESH_ROOM('居家动作'); } catch (e) {}
  }
  function setMotion(m, why) {
    if (!st.frog) st.frog = {};
    if (num(st.frog.motion) === num(m) && st.frog.motionSince) return false;
    st.frog.motion = num(m);
    st.frog.motionSince = nowSec();
    st.frog.motionHold = holdSeconds(num(m));
    save();
    log('动作 -> ' + (LABEL[num(m)] || motionName(num(m))) + ' (' + motionName(num(m)) + ')' + (why ? ' [' + why + ']' : ''));
    pushRole();
    unlockMoment(motionName(num(m)));
    return true;
  }
  function holdSeconds(m) {
    /* 长动作(new/diary.js 注册的"写日记"这类): 一次很久, 期间不可打断(new.txt: 常常一写就是很久) */
    try { var L = window.MOCK_LONGACTION, e = L && L[num(m)]; if (e && e.hold) return num(e.hold()) || 1800; } catch (err) {}
    return Math.round((3 + Math.random() * 9) * 60);   /* 3~12 分钟一个动作 */
  }
  function longAction(m) {
    try { var L = window.MOCK_LONGACTION; return (L && L[num(m)]) ? L[num(m)] : null; } catch (e) { return null; }
  }

  /* ---- 收拾行囊: 把桌上的备用品收进背包 -------------------------------- */
  function packDesk() {
    var bag = arr(st.bag), desk = arr(st.desk), moved = 0;
    for (var i = 0; i < desk.length; i++) {
      var id = num(desk[i]);
      if (!(id >= 0)) continue;                              /* 注意 id 0 = 华夫饼, 是合法食物 */
      var slot = -1;
      for (var b = 0; b < bag.length; b++) if (num(bag[b]) < 0) { slot = b; break; }
      if (slot < 0) break;                                   /* 背包满了 */
      bag[slot] = id; desk[i] = -1; moved++;
    }
    if (moved) {
      st.bag = bag; st.desk = desk; save();
      try { M.dispatch('item_load_items', (typeof S['item_load_items'] === 'function') ? S['item_load_items']() : null); } catch (e) {}
      log('收拾行囊: ' + moved + ' 件从桌上收进背包 (背包 ' + foodLabel(bag) + ')');
      return true;
    }
    return false;
  }
  function foodLabel(bag) { var n = 0; for (var i = 0; i < bag.length; i++) if (num(bag[i]) >= 0) n++; return n + ' 件'; }

  /* ---- 自主出发: 行李只"提升出门的想法", 什么时候走由它自己掷骰子 --------------
     原版: 备好行囊并不会让它立刻出发; 背包里放好食物/护身符/道具只是让它"更想出门",
     具体时间与时长完全随机。所以这里用**心情 + 每 tick 概率**而不是定时器:
       desire = 基础(有吃的 0.35) + 护身符 0.10/枚 + 道具 0.08/件 + 玩家按过「准备」的加成
       每个 tick(45 秒) 以 p = 0.010 + 0.030*desire 的概率走 -> 只有便当约 3~4 小时,
       备齐护身符+道具后约 1 小时上下, 且每次都不确定(可能刚回家就走, 也可能拖上一整天)。
     另: 手上还有没做完的家具/刚回家 20 分钟内 -> 不走。 */
  function bag() { return arr(st.bag); }
  function desire() {
    var items = bag(), d = 0, i;
    if (!foodInBag()) return 0;                                /* 没有吃的: 根本不想出门 */
    d = 0.35;
    for (i = 0; i < items.length; i++) {
      var id = num(items[i]); if (id < 0) continue;
      var t = -1;
      try { var row = Tabikaeru.DataManager.instance().ItemDB.get(id); t = row ? num(row.type) : -1; } catch (e) { t = -1; }
      if (t === 1) d += 0.10;                                  /* 护身符 */
      else if (t === 2) d += 0.08;                             /* 道具 */
    }
    d += Math.min(0.35, num(st.frog.desire) * 0.5);             /* 玩家按过「准备」的加成 */
    return Math.max(0, Math.min(1, d));
  }
  function readyToLeave() {
    if (!st.frog) return false;
    if (st.frog.runaway) return false;
    if (st.frog.status === 1) return false;
    if (!foodInBag()) return false;
    var since = num(st.frog.homeSince) || 0;
    if (since && nowSec() - since < 20 * 60) return false;       /* 刚回家先歇会儿 */
    if (num(st.furniture && st.furniture.make && st.furniture.make.id)) return false;
    return true;
  }
  function leave(why) {
    var d = desire();
    st.frog.desire = 0;
    save();
    log('决定出发(' + why + '): 出门的想法 ' + (Math.round(d * 100) / 100) + ', 背包 ' +
        bag().filter(function (x) { return num(x) >= 0; }).length + ' 件, 桌上留 ' +
        arr(st.desk).filter(function (x) { return num(x) >= 0; }).length + ' 件(下次回家自己收)');
    try { if (window.MOCK_FORCE_DEPART) window.MOCK_FORCE_DEPART(); else M.handle('item_set_bag_completed', { completed: true }); } catch (e) {}
  }
  function rollLeave(force) {
    if (!readyToLeave()) return false;
    if (!force) {
      var p = 0.010 + 0.030 * desire();
      if (Math.random() > p) return false;
    }
    leave(force ? '强制' : '心情到了');
    return true;
  }

  /* ---- 特殊状态: 离家出走 ------------------------------------------------- */
  var RUNAWAY_DEFAULT = 10 * 3600;                             /* new.txt: 感叹号持续约 10 小时 */
  function runawaySeconds() { return num(st.runawaySeconds) || RUNAWAY_DEFAULT; }
  function checkRunaway() {
    var empty = !foodAnywhere();
    if (!empty) { if (st.frog.emptySince) { st.frog.emptySince = 0; save(); } return false; }
    if (!st.frog.emptySince) { st.frog.emptySince = nowSec(); save(); log('背包和桌子都空了 -> 开始饿肚子计时'); return false; }
    if (st.frog.runaway) return false;
    if (nowSec() - num(st.frog.emptySince) >= runawaySeconds()) {
      st.frog.runaway = 1;
      st.frog.status = 1; st.frog.traveling = true;
      st.frog.returnAt = Date.now() + 365 * 86400000;          /* 不会自己回来 */
      save();
      log('离家出走! 空行李 ' + Math.round(runawaySeconds() / 3600) + ' 小时 -> 在桌上放食物它才回来');
      try { if (window.MOCK_EVENT) window.MOCK_EVENT(1, [0, 1]); } catch (e) {}
      pushRole();
      return true;
    }
    return false;
  }
  function checkRunawayReturn() {
    if (!(st.frog && st.frog.runaway)) return false;
    if (!hasFood(arr(st.desk))) return false;                  /* 必须在**桌上**放吃的 */
    st.frog.runaway = 0;
    st.frog.returnAt = Date.now() - 1000;                      /* 交给 rules.js 的结算泵送它回家 */
    save();
    log('桌上有吃的了 -> 它消气回家');
    return true;
  }

  /* ---- 主循环 ------------------------------------------------------------ */
  function tick() {
    try {
      if (!st.frog) st.frog = {};
      checkRunawayReturn();
      if (st.frog.status === 1) return;                        /* 出门在外: 没有居家动作 */
      /* 正在做家具(new/furnituremake.js 把 motion 钉在 3=sagyou_ie): 别用随机动作把它顶掉 */
      var mk = st.furniture && st.furniture.make;
      if (mk && Number(mk.id) > 0) { st.frog.crafting = 1; return; }
      if (Number(st.frog.crafting) === 1) {
        /* 残留在 "正在做家具"(motion 5..9 是**庭院**工序动画): 如果其实没有在做的单子,
           青蛙会一直卡在庭院那个姿势/位置(用户看到"季节变化后布局像坏了")。这里立刻收回室内动作并重画。 */
        st.frog.crafting = 0; st.frog.motionSince = 0;
        var indoor = [0, 1, 2, 3, 4];
        st.frog.motion = indoor[Math.floor(Math.random() * indoor.length)];
        st.frog.motionHold = holdSeconds();
        save();
        log('发现残留的"在做家具"标记 -> 收回室内动作 (' + motionName(st.frog.motion) + ')');
      }
      if (checkRunaway()) return;
      /* 饿晕: 饿了很久就一直在睡 */
      var hungry = !foodAnywhere();
      if (hungry && num(st.frog.emptySince) && nowSec() - num(st.frog.emptySince) > 7200) {
        if (num(st.frog.motion) < 10) { setMotion(10 + Math.floor(Math.random() * 4), '饿晕一直睡'); }
        return;
      }
      /* 长动作(写日记…): 到点之前不可打断 —— 不收拾行囊、不换动作、也不出门;
         到点先"收尾"(写完这一篇), 然后再回到普通动作循环。 */
      var la = longAction(st.frog.motion);
      if (la) {
        var lhold = num(st.frog.motionHold) || holdSeconds(st.frog.motion);
        if (st.frog.motionSince && nowSec() - num(st.frog.motionSince) < lhold) return;
        if (la.done) { try { la.done(); } catch (e) { log('长动作收尾出错: ' + (e && e.message || e)); } }
        st.frog.motionSince = 0;
      }
      /* 收拾行囊: 桌上有东西 + 背包有空位 */
      if (packDesk()) { setMotion(3, '收拾行囊'); return; }
      /* 动作循环 */
      var hold = num(st.frog.motionHold) || holdSeconds(st.frog.motion);
      if (!st.frog.motionSince || nowSec() - num(st.frog.motionSince) >= hold || num(st.frog.motion) < 0 || num(st.frog.motion) > 13) {
        var pats = patterns(), p = pats[Math.floor(Math.random() * pats.length)];
        var tok = p[Math.floor(Math.random() * p.length)];
        setMotion(motionNum(tok), '随机');
      }
      /* 自主出发: 每 tick 按心情掷一次(不是定时器) */
      rollLeave(false);
    } catch (e) { log('tick 出错: ' + (e && e.message || e)); }
  }
  setInterval(tick, 45000);
  /* 回家那一刻: 记下 homeSince 并挑一个新动作 */
  (function () {
    var last = num(st.frog && st.frog.status);
    setInterval(function () {
      var s = num(st.frog && st.frog.status);
      if (s === last) return;
      last = s;
      if (s === 0) {
        st.frog.homeSince = nowSec();
        st.frog.motionSince = 0;
        save();
        log('回到家: 先歇着, 出门的想法 ' + (Math.round(desire() * 100) / 100) + '(备好行李它会更容易想出门)');
        setTimeout(function () { try { tick(); } catch (e) {} }, 2000);
      }
    }, 3000);
  })();
  if (!st.frog.homeSince) { st.frog.homeSince = nowSec(); save(); }
  tick();

  window.MOCK_FROGSTATE = {
    tick: tick,
    motion: function () { return { motion: num(st.frog.motion), name: motionName(num(st.frog.motion)), label: LABEL[num(st.frog.motion)] || '', since: num(st.frog.motionSince), hold: num(st.frog.motionHold) }; },
    next: function () { st.frog.motionSince = 0; tick(); return window.MOCK_FROGSTATE.motion(); },
    set: function (m) { return setMotion(num(m), '手动'); },
    pack: packDesk,
    desire: desire,
    roll: rollLeave,                     /* roll(true) = 强制走一趟(测试/GM) */
    state: function () {
      return { status: num(st.frog.status), runaway: num(st.frog.runaway), emptySince: num(st.frog.emptySince),
               homeSince: num(st.frog.homeSince), hungry: !foodAnywhere(), moments: moments().length,
               desire: desire(), bag: bag().slice(), desk: arr(st.desk).slice() };
    },
    unlockMoment: unlockMoment
  };
  log('居家层就绪: 动作来自客户端 Frogpattern(' + patterns().length + ' 套), 小动作图鉴 ' + moments().length + ' 个, 离家出走阈值 ' + Math.round(runawaySeconds() / 3600) + ' 小时');
})();
