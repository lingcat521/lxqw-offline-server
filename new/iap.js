/* lxqw offline recharge (v0.23): free IAP + a working 浇水/兑换/礼包 loop.
 *
 * Everything below is derived from the client's own code, not guessed:
 *
 * 1. RechargeFieldItem.points (the hand-tuned clover layout table) has exactly
 *    three keys: {1:..., 3:..., 4:...}  -> the 三叶草田 page was designed for
 *    THREE fields: id 1 (400/¥6), id 3 (1800/¥18), id 4 (2800/¥25).
 *    field[] must therefore be those three - our old 6-row list is the
 *    "多了一行三叶草" the player saw (and ids 5/6 only fell back to layout 1).
 * 2. default.res.json only ships btn_pay_1/3/6/18/25_png, so a row's money MUST
 *    be one of those. recharge_json's ¥12 tier (id 2) has no icon anywhere and
 *    is not sold - it is dropped.
 * 3. The ¥1/¥3 tiers are named "充值特惠X元好礼" and belong to the 礼包 page:
 *    RechargeGiftPage.updateGift(e) reads e.id (-> rechargeDB count/money/name),
 *    e.water, e.change, e.goods[] and e.time. switchGift() only shows an entry
 *    while (time - 1 > server time), so time MUST be in the future or the page
 *    stays masked.
 * 4. 浇水: RechargeFieldPage.on_btnWater_tap -> request_water() ->
 *    send("recharge_water"); the FIELD_WATERED handler reads
 *    model.data.field[].grow, so the server has to push a fresh recharge_load
 *    BEFORE it answers, otherwise nothing appears to happen.
 * 5. 兑换: RechargeCloverPage.on_btnChange_tap -> send("recharge_change").
 *    water/change are CHARGE COUNTERS (button labels are "{0}次"), not clover.
 */
(function () {
  var M = window.MockServer, st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  function log(m) { try { console.log("[MOCK] " + m); } catch (e) {} }

  /* the three clover fields the client has layouts for */
  var FIELD_PACKS = [
    { id: 1, count: 400,  money: 6,  shopID: 1001 },
    { id: 3, count: 1800, money: 18, shopID: 1003 },
    { id: 4, count: 2800, money: 25, shopID: 1004 }
  ];
  /* the two 特惠礼包: they hand out clover plus water / change charges */
  var GIFT_PACKS = [
    { id: 5, count: 150, money: 1, shopID: 1005, water: 5,  change: 5 },
    { id: 6, count: 300, money: 3, shopID: 1006, water: 10, change: 10 }
  ];
  var FREE_WATER = true;   /* 内购版: 浇水不消耗次数 */
  var FIELD_TOTAL = 100;   /* growth units per field                     */
  var GROW_STEP = 25;      /* one 浇水 advances every field by this much */
  var WATER_MAX = 10;
  var CHANGE_MAX = 10;
  var GIFT_DAYS = 7;

  function rs() {
    var r = st.recharge;
    if (!r || typeof r !== "object") r = st.recharge = {};
    if (!r.fields || typeof r.fields !== "object") r.fields = {};
    if (!r.goods || typeof r.goods !== "object") r.goods = {};
    if (typeof r.water !== "number") r.water = WATER_MAX;
    if (typeof r.change !== "number") r.change = CHANGE_MAX;
    return r;
  }
  function fieldPack(id) { for (var i = 0; i < FIELD_PACKS.length; i++) if (FIELD_PACKS[i].id === id) return FIELD_PACKS[i]; return null; }
  function giftPack(id) { for (var i = 0; i < GIFT_PACKS.length; i++) if (GIFT_PACKS[i].id === id) return GIFT_PACKS[i]; return null; }
  function growOf(id) { var f = rs().fields[id]; return (f && typeof f.grow === "number") ? f.grow : 0; }
  function setGrow(id, g) { rs().fields[id] = { grow: g }; }
  function fieldList() { return FIELD_PACKS.map(function (p) { return { id: p.id, grow: growOf(p.id), total: FIELD_TOTAL }; }); }
  function sackList() {
    var r = rs();
    return FIELD_PACKS.map(function (p) { return { id: p.id, goods: r.goods[p.id] || [], price: p.money }; });
  }
  function giftList() {
    var now = Math.floor(Date.now() / 1000);
    return GIFT_PACKS.map(function (p) {
      return { id: p.id, water: p.water, change: p.change, goods: [], time: now + GIFT_DAYS * 86400 };
    });
  }
  function loadData() { var r = rs(); return { water: r.water, change: r.change, field: fieldList(), sack: sackList() }; }
  function push(name, data, d) { setTimeout(function () { try { M.dispatch(name, data); } catch (e) {} }, (d === undefined ? 40 : d)); }
  function pushLoad() { push("recharge_load", loadData(), 0); }  /* before the answer - see header */
  function pushClover() { push("clover_update", { clover: st.clover }, 30); }
  function save() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }

  S["recharge_load"] = function () {
    var r = rs();
    if (r.water <= 0) r.water = WATER_MAX;      /* never leave the player stuck */
    if (r.change <= 0) r.change = CHANGE_MAX;
    return loadData();
  };
  S["recharge_load_gift"] = function () { return { gift: giftList() }; };
  S["recharge_update_num"] = function () { var r = rs(); return { water: r.water, change: r.change, coin: st.clover }; };
  S["recharge_ready_pay"] = function () { return { code: 0 }; };
  S["recharge_cancel_pay"] = function () { return { code: 0 }; };

  /* 浇水: advance all three fields; a field that reaches total yields goods */
  S["recharge_water"] = function () {
    var r = rs();
    if (r.water <= 0) r.water = WATER_MAX;
    /* 免费内购版: 浇水不消耗次数(玩家反馈"浇水依然会消耗次数") —— 计数只显示不扣,
       并且保持在一个好看的数值上; 需要"消耗感"时把 FREE_WATER 改成 false 即可 */
    if (FREE_WATER) { if (r.water < WATER_MAX) r.water = WATER_MAX; }
    else r.water -= 1;
    var matured = [];
    for (var i = 0; i < FIELD_PACKS.length; i++) {
      var p = FIELD_PACKS[i], g = growOf(p.id) + GROW_STEP;
      if (g >= FIELD_TOTAL) {
        g = 0;
        r.goods[p.id] = [{ id: 100000, num: p.count }];
        matured.push(p.id + ":" + p.count);
      }
      setGrow(p.id, g);
    }
    pushLoad();
    save();
    log("浇水 -> water=" + r.water + " grows=" + JSON.stringify(fieldList().map(function (f) { return f.grow; })) +
        (matured.length ? " 成熟货物 " + matured.join(",") : ""));
    return { water: r.water, change: r.change, field: fieldList(), sack: sackList() };
  };

  /* 兑换: turn collected goods into clover points */
  S["recharge_change"] = function () {
    var r = rs(), gained = 0, got = [];
    for (var i = 0; i < FIELD_PACKS.length; i++) {
      var p = FIELD_PACKS[i], g = r.goods[p.id];
      if (g && g.length) {
        for (var k = 0; k < g.length; k++) gained += (g[k].num || 0);
        got.push(p.id);
        r.goods[p.id] = [];
      }
    }
    if (r.change > 0) r.change -= 1;
    if (gained) { st.clover += gained; pushClover(); }
    pushLoad();
    save();
    log("兑换 -> +" + gained + " clover (total " + st.clover + "), change=" + r.change + (got.length ? " packs " + got.join(",") : ""));
    return { change: r.change, water: r.water, coin: st.clover };
  };

  /* free IAP: tapping a price tag buys the pack outright */
  try {
    if (typeof RechargeModel !== "undefined" && RechargeModel.prototype) {
      RechargeModel.prototype.pay = function (id) {
        var fp = fieldPack(id), gp = giftPack(id), r = rs();
        if (fp) {
          st.clover += fp.count;
          setGrow(id, 0);
          pushClover(); pushLoad();
          push("recharge_update_num", { water: r.water, change: r.change, coin: st.clover }, 60);
          save();
          log("IAP 三叶草田 id=" + id + " (¥" + fp.money + ") +" + fp.count + " clover -> " + st.clover);
          return;
        }
        if (gp) {
          st.clover += gp.count;
          r.water += gp.water; r.change += gp.change;
          pushClover(); pushLoad();
          push("recharge_load_gift", { gift: giftList() }, 40);
          push("recharge_update_num", { water: r.water, change: r.change, coin: st.clover }, 60);
          save();
          log("IAP 特惠礼包 id=" + id + " (¥" + gp.money + ") +" + gp.count + " clover +" + gp.water + "水 +" + gp.change + "兑换 -> " + st.clover);
          return;
        }
        log("IAP: unknown pack " + id);
      };
      log("IAP ready: 3 三叶草田 (¥6/18/25) + 2 特惠礼包 (¥1/3), purchases are free");
    }
  } catch (e) { log("IAP patch failed: " + (e && e.message || e)); }
})();
