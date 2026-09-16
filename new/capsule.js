/* lxqw offline capsule: 扭蛋机 (限时活动, capsule_*) — additive layer.
 *
 * Client contract (CapsuleModel + CapsuleView):
 *   data = { end_time, coin, pre_coin, reward_list, task_list, patch_num }
 *     getActivityTime() = end_time > 0 ? [1, end_time] : [0, 0]
 *     isOpen() = now >= start && now <= end      -> end_time 0 makes it invisible
 *     reward_list.length >= 16 -> the client refuses more twists
 *   capsule_twist -> { reward_id } > 0 : the client does coin-- and pushes reward_id
 *   capsule_get_coin -> {code:0} : moves pre_coin into coin
 *   capsule_patch -> { task_list } : answered empty and patch_num kept 0, otherwise the
 *     client auto-requests patches forever (patch_num > 0 && task_list empty)
 *   Reward ids and the 3/7/12 milestones are read from the client's own capsuleData
 *   table (reward -> reward_id, num_reward -> num/item_id/item_num).
 */
(function () {
  var M = window.MockServer, st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  function log(m) { try { console.log("[MOCK] " + m); } catch (e) {} }
  var REWARDS_FALLBACK = [101, 102, 103, 104, 105, 106, 107, 108, 109, 110];
  var MILESTONES_FALLBACK = { 3: { item_id: 200001, item_num: 5 }, 7: { item_id: 54, item_num: 1 }, 12: { item_id: 54, item_num: 1 } };
  function table(key) {
    try {
      var dm = Tabikaeru.DataManager.instance();
      return (dm && dm.capsuleData) ? dm.capsuleData.get(key) : null;
    } catch (e) { return null; }
  }
  function rewards() {
    var cfg = table("reward");
    if (cfg) { var out = []; for (var k in cfg) { var v = Number(cfg[k].reward_id); if (v > 0) out.push(v); } if (out.length) return out; }
    return REWARDS_FALLBACK;
  }
  function milestones() {
    var cfg = table("num_reward");
    if (cfg) {
      var out = {};
      for (var k in cfg) out[Number(cfg[k].num)] = { item_id: Number(cfg[k].item_id), item_num: Number(cfg[k].item_num) };
      if (out[3] || out[7] || out[12]) return out;
    }
    return MILESTONES_FALLBACK;
  }
  var MAX_TWIST = 16, OPEN_DAYS = 7, START_COIN = 10;

  function cs() {
    var c = st.capsule, now = Math.floor(Date.now() / 1000);
    if (!c || typeof c !== "object") c = st.capsule = {};
    if (!Array.isArray(c.rewards)) c.rewards = [];
    if (!Array.isArray(c.tasks)) c.tasks = [];
    if (typeof c.coin !== "number") c.coin = START_COIN;
    if (typeof c.preCoin !== "number") c.preCoin = 0;
    if (typeof c.patchNum !== "number") c.patchNum = 0;
    if (typeof c.endTime !== "number" || c.endTime <= now) c.endTime = now + OPEN_DAYS * 86400;
    return c;
  }
  function save() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
  function push(name, d) { setTimeout(function () { try { M.dispatch(name, (typeof S[name] === "function" ? S[name]() : S[name])); } catch (e) {} }, d || 30); }
  function grantHouseItem(itemId, num) {
    if (!Array.isArray(st.house)) st.house = [];
    var found = null;
    for (var i = 0; i < st.house.length; i++) if (st.house[i] && st.house[i].item_id === itemId) found = st.house[i];
    if (found) found.count = (found.count || 0) + num;
    else st.house.push({ item_id: itemId, count: num });
    push("item_load_items", null, 60);
  }

  S["capsule_load"] = function () {
    var c = cs();
    return { end_time: c.endTime, coin: c.coin, pre_coin: c.preCoin,
             reward_list: c.rewards.slice(), task_list: c.tasks.slice(), patch_num: c.patchNum };
  };
  S["capsule_load_coin"] = function () { var c = cs(); return { coin: c.coin, pre_coin: c.preCoin }; };
  S["capsule_load_task"] = function () { var c = cs(); return { task_list: c.tasks.slice() }; };
  S["capsule_patch"] = function () { return { task_list: [] }; };
  S["capsule_fast_task"] = function () { return { code: 0 }; };
  S["capsule_get_coin"] = function () {
    var c = cs();
    if (c.preCoin > 0) { c.coin += c.preCoin; c.preCoin = 0; save(); log("扭蛋: 领取 " + c.coin + " 个扭蛋币"); }
    return { code: 0 };
  };
  S["capsule_twist"] = function () {
    var c = cs();
    if (c.coin <= 0) { log("扭蛋: 币不够"); return { reward_id: 0 }; }
    if (c.rewards.length >= MAX_TWIST) { log("扭蛋: 已达上限 " + MAX_TWIST); return { reward_id: 0 }; }
    var pool = rewards();
    var id = pool[Math.floor(Math.random() * pool.length)];
    c.coin -= 1;
    c.rewards.push(id);
    var ms = milestones()[c.rewards.length];
    save();
    log("扭蛋: 第 " + c.rewards.length + " 次, reward_id=" + id + " (剩余币 " + c.coin + ")" + (ms ? " 里程碑奖励 item " + ms.item_id : ""));
    if (ms) grantHouseItem(ms.item_id, ms.item_num);
    return { reward_id: id };
  };
  log("capsule ready: " + cs().coin + " 个币, 有效至 " + new Date(cs().endTime * 1000).toISOString().slice(0, 10));
})();
