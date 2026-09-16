/* lxqw offline wishing pool: 庭院许愿池 (wishingpool_load / wishingpool_wish) — additive.
 *
 * Client contract (WishingPoolModel + WishingPoolView):
 *   data = { end_time, coin, items:[{id, num, limit}] }
 *     isOpen()  = now < end_time        (end_time 0 => the pool never appears)
 *     lbNum     = "x" + coin            (one wish costs one coin)
 *     lbTime    = "当前有效期至 M月D日"  (formatted from end_time)
 *   wishingpool_wish -> { id }  the granted item id, must be > 0;
 *     the client then shows [{item_id:id, count:num}] and decrements coin + that item's limit.
 * This used to answer end_time 0, so the pool was invisible in the courtyard.
 */
(function () {
  var M = window.MockServer, st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  function log(m) { try { console.log("[MOCK] " + m); } catch (e) {} }
  /* real prize ids: 特产 (Specialty.itemId) + a couple of 家具/材料 */
  var PRIZE_IDS = [3000, 3001, 3002, 3003, 4000, 4001, 8501, 10001, 10101, 5001];
  var OPEN_DAYS = 7, START_COIN = 10;

  function ws() {
    var w = st.wishing;
    var now = Math.floor(Date.now() / 1000);
    if (!w || typeof w !== "object") w = st.wishing = {};
    if (!Array.isArray(w.items) || !w.items.length) {
      w.items = PRIZE_IDS.map(function (id, i) { return { id: id, num: 1 + (i % 2), limit: 3 }; });
    }
    if (typeof w.coin !== "number") w.coin = START_COIN;
    if (typeof w.endTime !== "number" || w.endTime <= now) w.endTime = now + OPEN_DAYS * 86400;  /* keep it open */
    return w;
  }
  function save() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }

  S["wishingpool_load"] = function () {
    var w = ws();
    return { end_time: w.endTime, coin: w.coin, items: w.items.map(function (x) { return { id: x.id, num: x.num, limit: x.limit }; }) };
  };
  S["wishingpool_wish"] = function () {
    var w = ws();
    if (w.coin <= 0) { log("许愿池: 没有许愿次数了"); return { id: 0 }; }
    var pool = [];
    for (var i = 0; i < w.items.length; i++) if (w.items[i].limit > 0) pool.push(w.items[i]);
    if (!pool.length) { log("许愿池: 奖品都换完了"); return { id: 0 }; }
    var pick = pool[Math.floor(Math.random() * pool.length)];
    pick.limit -= 1;
    w.coin -= 1;
    save();
    log("许愿池: 许愿一次, 获得 item " + pick.id + " x" + pick.num + " (剩余次数 " + w.coin + ")");
    return { id: pick.id };
  };
  log("wishing pool ready: " + ws().coin + " 次许愿, 有效至 " + new Date(ws().endTime * 1000).toISOString().slice(0, 10));
})();
