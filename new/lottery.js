/* lxqw offline lottery: 周末抽奖/帮忙挑选 (lottery_*) — additive layer.
 *
 * Client contract (LotteryModel + LotteryView):
 *   data = { last_phase, phase, state, select_list, answer[], extra_item:{item_id,count},
 *            right_flag[], egg_num, reward[] }
 *     LotteryState = { Open:0, Select:1, Complete:2, Reward:3 }
 *     lottery_load(e) is applied ONLY when e.phase is truthy - the old defaults answered
 *     phase 0, so the whole page sat on its defaults.
 *     the view picks the neighbour with n = (last_phase - 1) % 4 + 1 out of its OWN
 *     lotteryData.select_list, and settle_desc[rightCount] (+ extra_desc[n][..] when egg_num==5)
 *   lottery_open()            -> {open_item:{item_id,count}, extra_item:{item_id,count}}
 *   lottery_select(ids)       -> {code:0}   (client sets answer = ids, state = Complete)
 *   lottery_confirm_reward()  -> {code:0}   (client resets answer, state = Open)
 * Reward / open items are real ids from the Item table.
 */
(function () {
  var M = window.MockServer, st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  function log(m) { try { console.log("[MOCK] " + m); } catch (e) {} }
  var LState = { Open: 0, Select: 1, Complete: 2, Reward: 3 };
  /* 开局送的"奖池": 以前固定 1000(四叶草) x1。这里按权重从**真实物品 id** 里抽, 并记进 st.lotteryLog。
     (周末抽奖的邻居偏好表在客户端 lotteryData 里, 服务端不复制; 这里只负责发奖与记账。) */
  var OPEN_POOL = [
    { item_id: 1000, count: 1, w: 40 },   /* 四叶草 */
    { item_id: 3000, count: 1, w: 18 },   /* 特产 */
    { item_id: 3001, count: 1, w: 14 },
    { item_id: 4000, count: 1, w: 12 },
    { item_id: 1002, count: 1, w: 8 },    /* 道具 */
    { item_id: 1013, count: 1, w: 5 },
    { item_id: 1100, count: 1, w: 3 }     /* 稀有道具 */
  ];
  function rollOpenItem() {
    var total = 0, i;
    for (i = 0; i < OPEN_POOL.length; i++) total += OPEN_POOL[i].w;
    var r = Math.random() * total;
    for (i = 0; i < OPEN_POOL.length; i++) { r -= OPEN_POOL[i].w; if (r <= 0) return OPEN_POOL[i]; }
    return OPEN_POOL[0];
  }
  var REWARD_CLOVER = 200;

  function table(key) {
    try { var dm = Tabikaeru.DataManager.instance(); return (dm && dm.lotteryData) ? dm.lotteryData.get(key) : null; } catch (e) { return null; }
  }
  function neighbors() {
    var l = table("select_list");
    if (l) { var o = []; for (var k in l) o.push({ id: Number(l[k].id), name: l[k].name, pic: l[k].pic, desc: l[k].desc, desc2: l[k].desc2 }); if (o.length) return o; }
    return [{ id: 1, name: "困困", pic: "neighbor_emote_0_0" }, { id: 2, name: "胖胖", pic: "neighbor_emote_1_0" },
            { id: 3, name: "跳跳", pic: "neighbor_emote_2_0" }, { id: 4, name: "嘟嘟", pic: "neighbor_emote_3_0" }];
  }

  function ls() {
    var l = st.lottery;
    if (!l || typeof l !== "object") l = st.lottery = {};
    if (typeof l.phase !== "number" || l.phase < 1) { l.lastPhase = 0; l.phase = 1; }
    if (typeof l.lastPhase !== "number") l.lastPhase = l.phase > 1 ? l.phase - 1 : 0;
    if (typeof l.state !== "number") l.state = LState.Open;
    if (!Array.isArray(l.answer)) l.answer = [];
    if (!Array.isArray(l.rightFlag)) l.rightFlag = [];
    if (!Array.isArray(l.reward)) l.reward = [];
    if (typeof l.eggNum !== "number") l.eggNum = 0;
    if (!l.extraItem || typeof l.extraItem !== "object") l.extraItem = { item_id: 0, count: 0 };
    return l;
  }
  function save() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
  function push(name, d) { setTimeout(function () { try { M.dispatch(name, (typeof S[name] === "function" ? S[name]() : S[name])); } catch (e) {} }, d || 40); }
  function grantHouseItem(itemId, num) {
    if (!Array.isArray(st.house)) st.house = [];
    for (var i = 0; i < st.house.length; i++) if (st.house[i] && st.house[i].item_id === itemId) { st.house[i].count = (st.house[i].count || 0) + num; push("item_load_items", null, 60); return; }
    st.house.push({ item_id: itemId, count: num });
    push("item_load_items", null, 60);
  }
  function data() {
    var l = ls();
    return { last_phase: l.lastPhase, phase: l.phase, state: l.state,
             select_list: neighbors(), answer: l.answer.slice(),
             extra_item: { item_id: l.extraItem.item_id, count: l.extraItem.count },
             right_flag: l.rightFlag.slice(), egg_num: l.eggNum, reward: l.reward.slice() };
  }

  S["lottery_load"] = function () { return data(); };
  S["lottery_open"] = function () {
    var l = ls();
    var got = rollOpenItem();
    grantHouseItem(got.item_id, got.count);
    l.state = LState.Select;
    l.answer = []; l.rightFlag = [];
    l.extraItem = { item_id: 0, count: 0 };
    st.lotteryLog = Array.isArray(st.lotteryLog) ? st.lotteryLog : [];
    st.lotteryLog.push({ phase: l.phase, kind: "open", item_id: got.item_id, count: got.count, time: Date.now() });
    if (st.lotteryLog.length > 100) st.lotteryLog = st.lotteryLog.slice(-100);
    save();
    log("抽奖: 开局从奖池抽到 item " + got.item_id + " x" + got.count + " -> 进入挑选 (第 " + l.phase + " 期)");
    return { open_item: { item_id: got.item_id, count: got.count }, extra_item: { item_id: 0, count: 0 } };
  };
  S["lottery_select"] = function (p) {
    var l = ls();
    var ids = p && (p.answer || p.list || p.id_list);
    if (!Array.isArray(ids)) { ids = []; for (var k in p) { var v = p[k]; if (typeof v === "number") ids.push(v); } }
    l.answer = ids.slice(0, 5);
    /* 玩家挑的都是真实食物 -> 全部算"挑对了", 结算文案走 settle_desc 的最高档 */
    l.rightFlag = l.answer.map(function () { return 1; });
    l.eggNum = Math.min(5, l.answer.length);
    l.reward = [{ item_id: 200000, count: REWARD_CLOVER }];
    l.state = LState.Complete;
    save();
    log("抽奖: 挑了 " + l.answer.length + " 样 -> 结算 (全对)");
    return { code: 0 };
  };
  S["lottery_confirm_reward"] = function () {
    var l = ls();
    st.clover = (Number(st.clover) || 0) + REWARD_CLOVER;
    /* 抽中记录(清单 §2"抽奖系统: 抽奖券消耗、奖池、抽中物品、记录") */
    st.lotteryLog = Array.isArray(st.lotteryLog) ? st.lotteryLog : [];
    st.lotteryLog.push({ phase: l.phase, answer: (l.answer || []).slice(), egg_num: l.eggNum, right: (l.rightFlag || []).length, clover: REWARD_CLOVER, time: Date.now() });
    if (st.lotteryLog.length > 100) st.lotteryLog = st.lotteryLog.slice(-100);
    l.state = LState.Open;
    l.answer = []; l.rightFlag = []; l.reward = []; l.eggNum = 0;
    l.lastPhase = l.phase;
    l.phase = l.phase + 1;                       /* 下一期, 邻居/背景随之变化 */
    save();
    push("clover_update", { clover: st.clover }, 30);
    push("lottery_load", null, 50);
    log("抽奖: 结算完成 +" + REWARD_CLOVER + " 三叶草 -> " + st.clover + " (进入第 " + l.phase + " 期)");
    return { code: 0 };
  };
  log("lottery ready: 第 " + ls().phase + " 期, 邻居 " + neighbors().length + " 位");
})();
