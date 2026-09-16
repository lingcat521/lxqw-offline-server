/* lxqw 邻居(旅友投喂) —— 补齐清单 §10"投喂逻辑/回礼结算"。
 *
 * 客户端契约(逐字核对 main.min.js):
 *   TravelModel.guest_load(e): this.guestData = new GuestData(e)
 *     GuestData 字段只有 {id, confirmed, served, expire_time, pos} —— 多传键会触发客户端
 *     "GuestData 数据合并错误" 上报(jf_commit js.error), 所以 payload 必须**只有这五个**。
 *   MainInView.checkFriend()/friendClick(): guestData.id >= 0 才画小伙伴;
 *     点它 -> 选特产 -> "确认喂食小伙伴吗？" -> TravelModel.sendGuestServed(item)
 *       -> consumeHouseItem(item) + send("guest_serve", null, id, item_id)   [wants=false]
 *     -> friendFeedBack(): 用 CharaDB/SpecialtyDB **本地**算口味反应(不需要服务端)。
 *   还用到: guest_confirm(id)、guest_set_expire_time(time)、guest_finish()、guest_load 推送。
 * 以前服务端**从不推 guest_load** ⇒ getGuestData().id 永远 -1 ⇒ 整条投喂链不可达(点小伙伴只会弹
 * "小伙伴已经离开了")。回礼也只有 drawing.js 里另一套绘纸流程有。
 *
 * 本层: 定时/归来后按概率来一位小伙伴(id 必须是 CharaDB 里的 0/1/2), 维护上面五个字段,
 *       收下特产(扣仓库)后按口味给回礼(三叶草+抽奖券, 25% 再送件特产), 然后送客。
 */
(function () {
  var M = window.MockServer, st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  function log(m) { try { console.log('[MOCK] 邻居: ' + m); } catch (e) {} }
  function save() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
  function push(name, data, d) { setTimeout(function () { try { M.dispatch(name, (typeof data === 'function' ? data() : data)); } catch (e) {} }, d || 60); }
  function nowSec() { return Math.floor(Date.now() / 1000); }
  function home() { return !(st.frog && st.frog.status === 1); }
  function house() { return Array.isArray(st.house) ? st.house : (st.house = []); }
  function houseTake(id) {
    var h = house();
    for (var i = 0; i < h.length; i++) if (h[i] && Number(h[i].item_id) === Number(id)) {
      if ((Number(h[i].count) || 0) < 1) return false;
      h[i].count = Number(h[i].count) - 1;
      if (h[i].count <= 0) h.splice(i, 1);
      return true;
    }
    return false;
  }
  function houseAdd(id, n) {
    var h = house();
    for (var i = 0; i < h.length; i++) if (h[i] && Number(h[i].item_id) === Number(id)) { h[i].count = (Number(h[i].count) || 0) + n; return; }
    h.push({ item_id: Number(id), count: n });
  }
  /* 只有这五个键 —— 多一个客户端就上报"数据合并错误" */
  function payload() {
    var g = st.guestFeed;
    if (!g || !(Number(g.id) >= 0)) return { id: -1, confirmed: false, served: false, expire_time: 0, pos: 0 };
    return { id: Number(g.id), confirmed: !!g.confirmed, served: !!g.served, expire_time: Number(g.expire_time) || 0, pos: Number(g.pos) || 0 };
  }
  function friendIds() {
    var out = [];
    try {
      var db = Tabikaeru.DataManager.instance().CharaDB;
      var rows = (db && db.src && Array.isArray(db.src.data)) ? db.src.data : null;
      if (rows) for (var i = 0; i < rows.length; i++) if (rows[i] && rows[i].id !== undefined) out.push(Number(rows[i].id));
    } catch (e) {}
    return out.length ? out : [0, 1, 2];       /* China 版三个小伙伴: 困困/胖胖/跳跳 */
  }
  function tasteOf(fid, itemId) {
    try {
      var db = Tabikaeru.DataManager.instance().CharaDB;
      var rows = (db && db.src && Array.isArray(db.src.data)) ? db.src.data : [];
      for (var i = 0; i < rows.length; i++) if (Number(rows[i].id) === Number(fid)) {
        var sdb = Tabikaeru.DataManager.instance().SpecialtyDB;
        var list = (sdb && typeof sdb.list === 'function') ? sdb.list() : [];
        for (var j = 0; j < list.length; j++) if (Number(list[j].itemId) === Number(itemId)) return Number(rows[i].taste[j]) || 0;
        return Number(rows[i].taste[0]) || 30;
      }
    } catch (e) {}
    return 30;
  }
  /* ---- 回礼数值(用户按社区实测给的参考表) ---------------------------------
     中国版三位邻居按序号映射到那张表: 0 -> 蜗牛档, 1 -> 蜜蜂档, 2 -> 乌龟档。
     反应等级由口味值决定(客户端 CharaDB.taste: 15/30/75/99):
       taste >= 90 -> 感觉十分满意(full) / >= 60 -> 感觉很高兴(happy)
       >= 20       -> 一般(meh, 只给一点三叶草)     / < 20 -> 不喜欢(dislike, 没有回礼)
     基础回礼: 必定 三叶草 + 抽奖券(2~4 / 乌龟 2~6), 另有约一半概率附一枚四叶草。
     稀有 FLAG: 表的 Item 里没有这个字段, 用"高价特产"(price >= 100)当等价物 -> 额外 +20 三叶草 与 1~4 张券。
     连续投喂惩罚: 最近三次喂过同一种东西 -> 三叶草减半。 */
  var GIFT = [
    { name: '蜗牛档', hi: [1, 30], full: [30, 50], tickets: [2, 4] },
    { name: '蜜蜂档', hi: [10, 60], full: [50, 100], tickets: [2, 4] },
    { name: '乌龟档', hi: [10, 100], full: [100, 200], tickets: [2, 6] }
  ];
  function rnd(a, b) { a = Number(a) || 0; b = Number(b) || a; if (b < a) { var t = a; a = b; b = t; } return a + Math.floor(Math.random() * (b - a + 1)); }
  function reactionOf(taste) { return taste >= 90 ? 'full' : taste >= 60 ? 'happy' : taste >= 20 ? 'meh' : 'dislike'; }
  var REACT_TEXT = { full: '感觉十分满意', happy: '感觉很高兴', meh: '勉强吃饱了', dislike: '吃不下了' };
  function priceOf(item) { try { var d = Tabikaeru.DataManager.instance().ItemDB.get(Number(item)); return d ? Number(d.price) || 0 : 0; } catch (e) { return 0; } }
  function isRareFood(item) { return priceOf(item) >= 100; }
  function recentFoods() {
    var logx = Array.isArray(st.guestFeedLog) ? st.guestFeedLog : [];
    return logx.slice(-3).map(function (e) { return Number(e && e.item_id); });
  }
  function computeReward(guestId, item, taste) {
    var row = GIFT[Math.max(0, Math.min(GIFT.length - 1, Number(guestId) || 0))];
    var re = reactionOf(taste);
    var out = { reaction: re, text: REACT_TEXT[re], clover: 0, ticket: 0, amulet: 0, rare: 0, penal: 0, treat: 0 };
    if (re === 'dislike') return out;                       /* 不喜欢 -> 没有回礼(用户: "很可能收不到回礼") */
    if (re === 'meh') { out.clover = rnd(1, 10); return out; }
    out.clover = rnd(row[re === 'full' ? 'full' : 'hi'][0], row[re === 'full' ? 'full' : 'hi'][1]);
    out.ticket = rnd(row.tickets[0], row.tickets[1]);
    if (Math.random() < 0.5) out.amulet = 1;                /* 组合掉落: 四叶草 1 枚 */
    if (isRareFood(item)) {                                 /* 稀有(高价)特产加成 */
      out.rare = 1;
      out.clover += 20;
      out.ticket += rnd(1, 4);
    }
    var recent = recentFoods();
    if (recent.indexOf(Number(item)) >= 0) {                /* 连续投喂同一种 -> 三叶草减半 */
      out.penal = 1;
      out.clover = Math.max(1, Math.round(out.clover / 2));
    }
    out.treat = 3000 + Math.floor(Math.random() * 22);      /* 回礼里的那件特产 */
    return out;
  }
  /* 访客停留 180~270 分钟(原版实测数据); st.visitSeconds 可覆盖(测试/GM 用短值) */
  function visitSeconds() {
    var ov = Number(st.visitSeconds);
    if (isFinite(ov) && ov > 0) return ov;
    return Math.round((180 + Math.random() * 90) * 60);
  }
  function spawn(why, want) {
    if (st.guestFeed && Number(st.guestFeed.id) >= 0 && Number(st.guestFeed.expire_time) > nowSec()) return false;
    var ids = friendIds();
    var id = (want !== undefined && want !== null && Number(want) >= 0) ? Number(want) : ids[Math.floor(Math.random() * ids.length)];
    /* 访客停留时间: 原版数据是 180~270 分钟(3~4.5 小时) —— 注意这与"青蛙去聚会的时长"是两件事 */
    var stay = visitSeconds();
    st.guestFeed = { id: id, confirmed: false, served: false, expire_time: nowSec() + stay, pos: 0 };
    save();
    push('guest_load', payload(), 40);
    log('来了一位小伙伴 id=' + id + ' (停留 ' + Math.round(stay / 60) + ' 分钟, 3~4.5 小时) [' + why + ']');
    return true;
  }
  /* 离开时把回礼寄到邮箱: 客户端 Mail.EvtId.Gift=3 + sender=0..2 会显示邻居头像;
     三叶草/券写在 resource 里, 玩家开信时由 mail.js 入账(与原版"通过邮箱寄回礼物"一致)。 */
  function sendGiftMail(left, rw) {
    if (!rw) return false;
    var items = [];
    if (rw.treat) items.push({ item_id: rw.treat, count: 1 });
    if (rw.amulet) items.push({ item_id: 1000, count: 1 });          /* 四叶草护身符 */
    var okMail = false;
    try {
      if (window.MOCK_ADD_MAIL) {
        window.MOCK_ADD_MAIL({
          type: 3, sender: Number(left) || 0, title: '邻居的回礼',
          message: '谢谢你家的特产，这是我的一点心意~',
          items: items,
          resource: { clover_point: Number(rw.clover) || 0, ticket: Number(rw.ticket) || 0, ads_id: '' }
        });
        okMail = true;
      }
    } catch (e) {}
    log('回礼已寄到邮箱: 三叶草' + (rw.clover || 0) + ' 抽奖券' + (rw.ticket || 0) +
        (rw.amulet ? ' 四叶草1' : '') + (rw.treat ? (' 特产' + rw.treat) : '') + (okMail ? '' : ' (邮箱层没装)'));
    return okMail;
  }
  /* 邀约概率(与是否喂食无关, 用户: "喂食不会直接保证获得邀约"): 默认 22%, st.inviteChance 可覆盖 */
  function inviteChance() {
    var ov = Number(st.inviteChance);
    if (isFinite(ov) && ov >= 0) return ov;
    return 0.22;
  }
  function clear(why) {
    if (!st.guestFeed || Number(st.guestFeed.id) < 0) return false;
    var left = Number(st.guestFeed.id), fed = !!st.guestFeed.served;
    var rw = st.guestFeed.reward || null;
    if (fed && rw) sendGiftMail(left, rw);
    else log('没投喂过 -> 它自己走了, 没有回礼');
    log('小伙伴 id=' + left + ' 离开了 [' + why + ']' + (fed ? ' (招待过)' : ''));
    st.guestFeed = { id: -1, confirmed: false, served: false, expire_time: 0, pos: 0 };
    save();
    push('guest_load', payload(), 40);
    /* 花盆: 原版是"小伙伴随机挑一颗你准备的种子帮你种下"(1 星肥力不能种) */
    try {
      if (fed && window.MOCK_FARM && window.MOCK_FARM.neighbourPlant && Math.random() < 0.5) {
        window.MOCK_FARM.neighbourPlant(left, '访客离开时顺手种花');
      }
    } catch (e) {}
    /* 邀约: 访客离开时**独立判定**(喂食只影响回礼质量, 不影响邀约概率) —— 15%~30% 取 22% */
    try {
      if (!window.MOCK_DRAWING || !window.MOCK_DRAWING.invite) { log('绘纸层没装 -> 挂不出邀请卡片'); return true; }
      var roll = Math.random();
      if (roll < inviteChance()) {
        var okCard = window.MOCK_DRAWING.invite(left, '访客离开');
        if (!okCard) log('中签了(' + Math.round(roll * 100) + '%)但卡片没挂上 —— 看上一行的绘纸状态提示');
      } else {
        log('这次门口没有留下邀请卡片 (中签率 ' + Math.round(inviteChance() * 100) + '%, 本次掷出 ' + Math.round(roll * 100) + ')');
      }
    } catch (e) {}
    return true;
  }
  S['guest_load'] = function () { return payload(); };
  S['guest_confirm'] = function (p) {
    if (st.guestFeed && Number(st.guestFeed.id) >= 0) { st.guestFeed.confirmed = true; save(); log('确认了小伙伴 id=' + st.guestFeed.id); }
    return { code: 0 };
  };
  S['guest_set_expire_time'] = function (p) {
    var t = Number(p && (p.time !== undefined ? p.time : p));
    if (st.guestFeed && Number(st.guestFeed.id) >= 0 && t > 0) { st.guestFeed.expire_time = t; save(); }
    return { code: 0 };
  };
  S['guest_finish'] = function () { clear('客户端请求'); return { code: 0 }; };
  S['guest_serve'] = function (p) {
    var g = st.guestFeed, id = Number(p && (p.id !== undefined ? p.id : p.guest_id));
    var item = Number(p && (p.item_id !== undefined ? p.item_id : p.item));
    if (!g || Number(g.id) < 0) { log('投喂失败: 没有小伙伴'); return { code: 1 }; }
    if (Number(g.id) !== id) { log('投喂失败: id 不匹配 (' + id + ' != ' + g.id + ')'); return { code: 1 }; }
    if (g.served) { log('投喂失败: 已经喂过了'); return { code: 2 }; }
    if (item === undefined || item === null || !isFinite(item) || item < 0) return { code: 3 };   /* 注意 id 0 = 奶油华夫饼, 是合法食物 */
    houseTake(item);                                  /* 客户端已经本地扣过, 服务端必须也扣, 否则重启复现 */
    g.served = true;
    var taste = tasteOf(g.id, item);
    var rw = computeReward(g.id, item, taste);
    g.reward = rw;                                     /* 回礼在**访客离开时**以邮件寄出(原版: 离开后通过邮箱寄回礼物) */
    g.served = true;
    st.guestFeedLog = Array.isArray(st.guestFeedLog) ? st.guestFeedLog : [];
    st.guestFeedLog.push({ id: g.id, item_id: item, taste: taste, reaction: rw.reaction,
                           clover: rw.clover, ticket: rw.ticket, amulet: rw.amulet, rare: rw.rare, penal: rw.penal, time: Date.now() });
    save();
    log('投喂: 小伙伴' + g.id + '(' + GIFT[Math.max(0, Math.min(2, Number(g.id) || 0))].name + ') 吃到 ' + item +
        ' 口味 ' + taste + ' -> ' + rw.text +
        (rw.reaction === 'dislike' ? ' (没有回礼)' : ' 回礼: 三叶草' + rw.clover + ' 抽奖券' + rw.ticket + (rw.amulet ? ' 四叶草1' : '')) +
        (rw.rare ? ' [稀有特产 +20/+1~4]' : '') + (rw.penal ? ' [连续投喂惩罚: 三叶草减半]' : ''));
    setTimeout(function () { clear('投喂完毕'); }, 6000);   /* 送客: 客户端会把小伙伴收起来 */
    return { code: 0 };
  };

  window.MOCK_GUEST = {
    spawn: function (want) { return spawn('手动', want); },
    visitSeconds: visitSeconds,
    schedule: checkSchedule,                       /* 立刻跑一次排期判定 */
    clear: function () { return clear('手动'); },
    inviteChance: inviteChance,
    gift: function () { return computeReward; },
    reactionOf: reactionOf,
    state: function () { return payload(); },
    log: function () { return (st.guestFeedLog || []).slice(); }
  };
  /* 社交排期(new.txt): "青蛙出门旅行 2 次后蜗牛到访, 5 次后蜜蜂, 8 次后乌龟, 每隔 3 次旅行就会有一位访客"。
     中国版的三位邻居是 困困(乌龟)/胖胖(猫头鹰)/跳跳(松鼠)(CharaDB 0/1/2), 所以按序号映射。
     命中排期点时立刻来一位(不等随机), 同一趟只触发一次。 */
  function scheduledGuest(n) {
    n = Number(n) || 0;
    if (n === 2) return 0;
    if (n === 5) return 1;
    if (n === 8) return 2;
    if (n > 8 && (n - 8) % 3 === 0) return (Math.floor((n - 8) / 3) - 1) % 3;
    return -1;
  }
  function checkSchedule() {
    try {
      var n = Number(st.travelCount) || 0;
      var g = scheduledGuest(n);
      if (g < 0) return false;
      if (Number(st.guestSchedTrip) === n) return false;
      st.guestSchedTrip = n;
      save();
      var cur = st.guestFeed;
      if (cur && Number(cur.id) >= 0) { log('排期访客(第 ' + n + ' 次旅行)被前一位占着, 下次再说'); return false; }
      if (!home()) return false;
      var ok = spawn('排期:第' + n + '次旅行', g);   /* 排期指定是哪一位 */
      if (ok) log('排期访客: 第 ' + n + ' 次旅行 -> 邻居 ' + g);
      return true;
    } catch (e) { return false; }
  }
  setInterval(checkSchedule, 15000);

  /* 开机 6 秒后来第一位(方便玩家看到), 之后每 90 秒 35% 概率, 只在青蛙在家且当前没有小伙伴时 */
  setTimeout(function () { if (home()) spawn('开机'); }, 6000);
  setInterval(function () {
    try {
      var g = st.guestFeed;
      if (g && Number(g.id) >= 0 && Number(g.expire_time) > 0 && Number(g.expire_time) <= nowSec()) { clear('超时'); return; }
      if (!home()) return;
      if (g && Number(g.id) >= 0) return;
      if (Math.random() < 0.35) spawn('定时');
    } catch (e) {}
  }, 90000);
  log('邻居层就绪: 开机 6 秒后/每 90 秒 35% 来一位; 投喂走 guest_serve');
})();
