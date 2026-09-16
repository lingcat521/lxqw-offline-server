/* lxqw 抽奖(扭蛋机/抽奖券) + 礼品盒搬运 —— 补上服务端那一半。
 *
 * 客户端契约(逐字核对过 main.min.js):
 *   RaffleView.raffle(): userModel.consumeTicket(Tabikaeru.Define.RAFFEL_NEEDTICKETS)  ← 只判定 **不扣**
 *                        -> SocketManage.send("item_gacha", null, false)
 *   ItemModel.item_gacha(e): gachaColorBall = e.ticket  -> 派发 updateGachaColorBall
 *   RaffleView.updateGachaColorBall(): t=getGachaColorBall(); t==-1 -> 只把手恢复(没抽到/券不足);
 *       否则按 Prize.Rank 播动画 + showResult(t):
 *         · White(0) -> 弹"获得抽奖券 xN" + send("item_redeem_prize", id)
 *         · 其它      -> PrizeSelector 让玩家选一件 + send("item_redeem_prize", id)
 *   Prize 表(tables/Prize_json.json, 23 条): {id, itemId, rank, stock}; rank0 只有 1 条(itemId=-1 → 券)
 *   客户端 selectItem() 会**先本地 addHouseItem(itemId, stock)** 再发协议 —— 服务端必须也真发, 否则重启即丢。
 *
 * 所以我们这一层做三件事:
 *   1) item_gacha: 扣 RAFFEL_NEEDTICKETS(默认 5) 张券, 按权重掷一个 rank, 回 {ticket: rank};
 *      券不够回 {ticket: -1}(客户端把手恢复, 不播动画) —— 修掉"券永不减少、无限抽"。
 *   2) item_redeem_prize: 按 prize id 真发奖(itemId>0 进 st.house, rank0/券 加 st.ticket), 并推 item_load_items。
 *   3) travel_gift_to_bag / travel_bag_to_gift: 真搬运(以前只回 {code:0} → 礼盒只增不减、特产拿不出来);
 *      盒子满回 102(客户端弹"礼品盒满了")。
 */
(function () {
  var M = window.MockServer, st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  function log(m) { try { console.log('[MOCK] 抽奖: ' + m); } catch (e) {} }
  function save() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
  function push(name, data, d) { setTimeout(function () { try { M.dispatch(name, (typeof data === 'function' ? data() : (data !== undefined ? data : (typeof S[name] === 'function' ? S[name]() : null)))); } catch (e) {} }, d || 50); }
  function house() { return Array.isArray(st.house) ? st.house : (st.house = []); }
  function houseAdd(id, n) {
    var h = house();
    for (var i = 0; i < h.length; i++) if (h[i] && Number(h[i].item_id) === Number(id)) { h[i].count = (Number(h[i].count) || 0) + n; return; }
    h.push({ item_id: Number(id), count: n });
  }
  function houseTake(id, n) {
    var h = house();
    for (var i = 0; i < h.length; i++) if (h[i] && Number(h[i].item_id) === Number(id)) {
      if ((Number(h[i].count) || 0) < n) return false;
      h[i].count = Number(h[i].count) - n;
      if (h[i].count <= 0) h.splice(i, 1);        /* 归零就删条目, 别在物品栏里留 0 个的幽灵行 */
      return true;
    }
    return false;
  }
  function prizeTable() {
    try { var db = Tabikaeru.DataManager.instance().PrizeDB; if (db && typeof db.get === 'function') return { get: function (id) { return db.get(id); } }; } catch (e) {}
    return null;
  }
  /* Prize 表兜底: 只有 23 条, 直接内联(rank0 一条券奖, 其余是实物) */
  /* Prize 表兜底: 与 tables/Prize_json.json 逐条一致(23 条, 由脚本生成, 别手改) */
  var PRIZE = {
    0: {id:0, itemId:-1, rank:0, stock:1},
    1: {id:1, itemId:1002, rank:1, stock:1},
    2: {id:2, itemId:1003, rank:1, stock:1},
    3: {id:3, itemId:1004, rank:1, stock:1},
    4: {id:4, itemId:1005, rank:1, stock:1},
    5: {id:5, itemId:1006, rank:1, stock:1},
    6: {id:6, itemId:1013, rank:2, stock:1},
    7: {id:7, itemId:1014, rank:2, stock:1},
    8: {id:8, itemId:1015, rank:2, stock:1},
    9: {id:9, itemId:1016, rank:2, stock:1},
    10: {id:10, itemId:6, rank:3, stock:1},
    11: {id:11, itemId:7, rank:3, stock:1},
    12: {id:12, itemId:8, rank:3, stock:1},
    13: {id:13, itemId:10, rank:3, stock:1},
    14: {id:14, itemId:9, rank:3, stock:1},
    15: {id:15, itemId:11, rank:4, stock:1},
    16: {id:16, itemId:12, rank:4, stock:1},
    17: {id:17, itemId:13, rank:4, stock:1},
    18: {id:18, itemId:14, rank:4, stock:1},
    19: {id:19, itemId:1007, rank:5, stock:1},
    20: {id:20, itemId:1008, rank:5, stock:1},
    21: {id:21, itemId:1009, rank:5, stock:1},
    22: {id:22, itemId:1010, rank:5, stock:1}
  };
  function prizeOf(id) {
    var t = prizeTable();
    var row = t ? t.get(id) : null;
    return row || PRIZE[Number(id)] || null;
  }
  /* 权重: 白(券) 最多, 金 最少 —— 客户端按 rank 分组展示, 不依赖具体数值 */
  var RANK_W = [[0, 40], [1, 26], [2, 16], [3, 10], [4, 6], [5, 2]];
  function rollRank() {
    var total = 0, i;
    for (i = 0; i < RANK_W.length; i++) total += RANK_W[i][1];
    var r = Math.random() * total;
    for (i = 0; i < RANK_W.length; i++) { r -= RANK_W[i][1]; if (r <= 0) return RANK_W[i][0]; }
    return 0;
  }
  function needTickets() {
    try { if (Tabikaeru.Define && Tabikaeru.Define.RAFFEL_NEEDTICKETS) return Number(Tabikaeru.Define.RAFFEL_NEEDTICKETS); } catch (e) {}
    return 5;
  }

  S['item_gacha'] = function (p) {
    var need = needTickets(), have = Number(st.ticket) || 0;
    if (have < need) {
      log('券不足 (' + have + '/' + need + ') -> 回 -1');
      return { ticket: -1 };
    }
    st.ticket = have - need;
    var rank = rollRank();
    st.gacha = Array.isArray(st.gacha) ? st.gacha : [];
    st.gacha.push({ rank: rank, time: Date.now() });
    if (st.gacha.length > 200) st.gacha = st.gacha.slice(-200);
    save();
    push('item_update_ticket', { ticket: st.ticket }, 30);
    log('抽一次: 券 ' + have + '->' + st.ticket + ' (需要 ' + need + '), rank=' + rank + ', 累计 ' + st.gacha.length + ' 次');
    return { ticket: rank };
  };

  S['item_redeem_prize'] = function (p) {
    var id = Number(p && (p.id !== undefined ? p.id : p.prize_id !== undefined ? p.prize_id : p));
    var row = prizeOf(id);
    if (!row) { log('兑换未知奖品 id=' + id); return { code: 1 }; }
    var itemId = Number(row.itemId), stock = Number(row.stock) || 1;
    if (itemId > 0) { houseAdd(itemId, stock); push('item_load_items'); }
    else { st.ticket = (Number(st.ticket) || 0) + stock; push('item_update_ticket', { ticket: st.ticket }, 30); }
    st.prizes = Array.isArray(st.prizes) ? st.prizes : [];
    st.prizes.push({ prize_id: id, item_id: itemId, count: stock, time: Date.now() });
    /* 兼容 handbook.js 早先的记账(handbooktest 断言 st.redeemed 里有这个 prize_id), 两个都留 */
    st.redeemed = Array.isArray(st.redeemed) ? st.redeemed : [];
    st.redeemed.push(id);
    save();
    log('领奖 id=' + id + ' rank=' + row.rank + ' -> ' + (itemId > 0 ? ('物品 ' + itemId + 'x' + stock + ' 进仓库') : ('抽奖券 +' + stock)));
    return { code: 0 };
  };

  /* ---- 礼品盒搬运(以前是空实现: 只回 {code:0}, st.gifts 只增不减) ---- */
  var BOX_MAX = 30;
  function gifts() { return Array.isArray(st.gifts) ? st.gifts : (st.gifts = []); }
  S['travel_gift_to_bag'] = function (p) {
    var id = Number(p && (p.item_id !== undefined ? p.item_id : p.id));
    var g = gifts(), idx = -1;
    for (var i = 0; i < g.length; i++) if (g[i] && Number(g[i].item_id) === id) { idx = i; break; }
    if (idx < 0) { log('取出失败: 礼盒里没有 ' + id); return { code: 1 }; }
    g[idx].count = (Number(g[idx].count) || 0) - 1;
    if (g[idx].count <= 0) g.splice(idx, 1);
    houseAdd(id, 1);
    save();
    var left = 0; for (var j = 0; j < g.length; j++) left += Number(g[j].count) || 0;
    log('礼盒取出 ' + id + ' -> 仓库 (盒内还剩 ' + left + ' 件)');
    push('travel_load_gift');
    push('item_load_items');
    return { code: 0 };
  };
  S['travel_bag_to_gift'] = function (p) {
    var id = Number(p && (p.item_id !== undefined ? p.item_id : p.id));
    var g = gifts(), total = 0;
    for (var i = 0; i < g.length; i++) total += Number(g[i].count) || 0;
    if (total >= BOX_MAX) { log('放入失败: 礼盒满了 (' + total + '/' + BOX_MAX + ') -> code 102'); return { code: 102 }; }
    if (!houseTake(id, 1)) { log('放入失败: 仓库里没有 ' + id); return { code: 1 }; }
    var found = null;
    for (var j = 0; j < g.length; j++) if (g[j] && Number(g[j].item_id) === id) found = g[j];
    if (found) found.count = (Number(found.count) || 0) + 1; else g.push({ item_id: id, count: 1 });
    save();
    log('仓库放入礼盒 ' + id + ' (盒内 ' + (total + 1) + '/' + BOX_MAX + ')');
    push('travel_load_gift');
    push('item_load_items');
    return { code: 0 };
  };

  window.MOCK_RAFFLE = {
    need: needTickets,
    left: function () { return Math.floor((Number(st.ticket) || 0) / needTickets()); },
    history: function () { return (st.gacha || []).slice(); },
    prizes: function () { return (st.prizes || []).slice(); },
    box: function () { return { max: BOX_MAX, gifts: gifts().slice() }; }
  };
  log('抽奖/礼盒层就绪: 每次 ' + needTickets() + ' 张券, 券 ' + (st.ticket || 0) + ' 张, 礼盒上限 ' + BOX_MAX);
})();
