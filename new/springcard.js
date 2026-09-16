/* lxqw offline springcard: 春卡 (限时活动, springcard_*) — additive layer.
 *
 * Client contract (SpringCardModel — every field is read individually, so a partial
 * answer is safe, but isOpen() still needs end_time in the future):
 *   data = { end_time, card_info:{bg,bless,tags[3]}, items[], task_harvest, buy_num,
 *            can_buy_num, task_item[], share_num, share_get, box_id, share_code,
 *            reward_list[], global_num }
 *   springcard_buy()            -> { tags_id } > 0   (client: buy_num++, items += 1)
 *   springcard_change_bg/bless/put_tags -> {code:0}
 *   springcard_send()           -> { box_id } > 0    (small/big box by how many tags)
 *   springcard_get_reward()     -> {id, num}         (client clears box_id, num>0 => reward)
 *   springcard_share_tags()     -> { share_code }    (client then claims the task reward)
 *   springcard_get_share_tags() -> { tags_id }       (limit tags_share_limit per day)
 *   springcard_load_count()     -> {count}
 *   Tags/boxes/prices all come from the client's own springCardData table.
 */
(function () {
  var M = window.MockServer, st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  function log(m) { try { console.log("[MOCK] " + m); } catch (e) {} }
  var TAG_FALLBACK = [101, 102, 103, 104, 105, 106], PRICE_FALLBACK = 20;
  var SMALL_BOX = 200009, BIG_BOX = 200010, OPEN_DAYS = 7, SHARE_LIMIT = 3;
  var BOX_REWARD = { id: 200000, num: 300 };    /* 200000 = 三叶草 item */
  function table(key) {
    try { var dm = Tabikaeru.DataManager.instance(); return (dm && dm.springCardData) ? dm.springCardData.get(key) : null; } catch (e) { return null; }
  }
  function tagIds() { var l = table("tags"); if (l && l.length) { var o = []; for (var i = 0; i < l.length; i++) o.push(Number(l[i].id)); return o; } return TAG_FALLBACK; }
  function price() { var p = table("tags_price"); return (typeof p === "number" && p > 0) ? p : PRICE_FALLBACK; }
  function boxes() {
    var s = table("small_box_id"), b = table("big_box_id");
    return { small: (typeof s === "number" && s > 0) ? s : SMALL_BOX, big: (typeof b === "number" && b > 0) ? b : BIG_BOX };
  }

  function ss() {
    var x = st.spring, now = Math.floor(Date.now() / 1000);
    if (!x || typeof x !== "object") x = st.spring = {};
    if (!x.cardInfo || typeof x.cardInfo !== "object") x.cardInfo = { bg: 0, bless: 0, tags: [0, 0, 0] };
    if (!Array.isArray(x.cardInfo.tags)) x.cardInfo.tags = [0, 0, 0];
    if (!Array.isArray(x.items)) x.items = [];
    if (!Array.isArray(x.taskItem)) x.taskItem = [];
    if (!Array.isArray(x.rewardList)) x.rewardList = [];
    if (typeof x.buyNum !== "number") x.buyNum = 0;
    if (typeof x.shareGet !== "number") x.shareGet = 0;
    if (typeof x.shareNum !== "number") x.shareNum = 0;
    if (typeof x.boxId !== "number") x.boxId = 0;
    if (typeof x.globalNum !== "number") x.globalNum = 0;
    /* 限时活动只在真实日历窗口内开启: 客户端 isOpen() = now in [1, end_time],
       end_time = 0 即隐藏活动(以前这里无条件 now+7 天, 所以 9 月也会弹春节活动) */
    var __win = window.MOCK_CALENDAR ? window.MOCK_CALENDAR.activity('springcard') : null;
    if (__win && !__win.active) { x.endTime = 0; return x; }
    if (typeof x.endTime !== "number" || x.endTime <= now || (__win && __win.end && x.endTime > __win.end))
      x.endTime = (__win && __win.end) ? __win.end : now + OPEN_DAYS * 86400;
    return x;
  }
  function save() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
  function push(name, d) { setTimeout(function () { try { M.dispatch(name, (typeof S[name] === "function" ? S[name]() : S[name])); } catch (e) {} }, d || 40); }
  function itemNum(id) { var x = ss(); for (var i = 0; i < x.items.length; i++) if (Number(x.items[i].item_id) === Number(id)) return x.items[i].num || 0; return 0; }
  function addItem(id, n) {
    var x = ss();
    for (var i = 0; i < x.items.length; i++) if (Number(x.items[i].item_id) === Number(id)) { x.items[i].num = (x.items[i].num || 0) + n; return; }
    x.items.push({ item_id: Number(id), num: n });
  }
  function data() {
    var x = ss();
    return { end_time: x.endTime, card_info: { bg: x.cardInfo.bg, bless: x.cardInfo.bless, tags: x.cardInfo.tags.slice() },
             items: x.items.map(function (i) { return { item_id: i.item_id, num: i.num }; }),
             task_harvest: x.taskHarvest || 0, buy_num: x.buyNum, can_buy_num: x.canBuyNum || 0,
             task_item: x.taskItem.slice(), share_num: x.shareNum, share_get: x.shareGet,
             box_id: x.boxId, share_code: x.shareCode || "", reward_list: x.rewardList.slice(), global_num: x.globalNum };
  }

  S["springcard_load"] = function () { return data(); };
  S["springcard_load_count"] = function () { var x = ss(); x.globalNum += 1; save(); return { count: x.globalNum }; };
  S["springcard_get_task_item"] = function () { var x = ss(); return { task_harvest: x.taskHarvest || 0, share_num: x.shareNum, list: x.taskItem.slice() }; };
  S["springcard_get_task_reward"] = function () { return { code: 0 }; };

  S["springcard_buy"] = function () {
    var x = ss(), pr = price();
    if ((Number(st.clover) || 0) < pr) { log("春卡: 三叶草不够买贴纸 (" + st.clover + " < " + pr + ")"); return { tags_id: 0 }; }
    var ids = tagIds(), id = ids[Math.floor(Math.random() * ids.length)];
    st.clover -= pr;
    x.buyNum += 1;
    addItem(id, 1);
    save();
    push("clover_update", { clover: st.clover }, 30);
    log("春卡: 买入贴纸 " + id + " 花费 " + pr + " (剩 " + st.clover + ")");
    return { tags_id: id };
  };
  S["springcard_change_bg"] = function (p) {
    var x = ss(), id = Number(p && p.id);
    if (id > 0 && itemNum(id) <= 0) return { code: 1 };
    if (x.cardInfo.bg > 0) addItem(x.cardInfo.bg, 1);
    if (id > 0) addItem(id, -1);
    x.cardInfo.bg = id; save(); log("春卡: 背景 -> " + id);
    return { code: 0 };
  };
  S["springcard_change_bless"] = function (p) {
    var x = ss(), id = Number(p && p.id);
    x.cardInfo.bless = id; save(); log("春卡: 祝福 -> " + id);
    return { code: 0 };
  };
  S["springcard_put_tags"] = function (p) {
    var x = ss(), pos = Number(p && p.pos), id = Number(p && p.id);
    if (!(pos >= 0 && pos < 3)) return { code: 1 };
    if (x.cardInfo.tags[pos] > 0) addItem(x.cardInfo.tags[pos], 1);
    if (id > 0) { if (itemNum(id) <= 0) return { code: 1 }; addItem(id, -1); }
    x.cardInfo.tags[pos] = id;
    save(); log("春卡: 贴纸 " + pos + " -> " + id);
    return { code: 0 };
  };
  S["springcard_send"] = function () {
    var x = ss(), bx = boxes();
    if (!x.cardInfo.bg) { log("春卡: 还没选背景"); return { box_id: 0 }; }
    for (var i = 0; i < 3; i++) if (!(x.cardInfo.tags[i] > 0)) { log("春卡: 还差贴纸 " + i); return { box_id: 0 }; }
    var used = 0;
    for (var k = 0; k < 3; k++) if (x.cardInfo.tags[k] > 0) used++;
    var box = (used >= 3) ? bx.big : bx.small;
    x.boxId = box;
    x.cardInfo = { bg: 0, bless: 0, tags: [0, 0, 0] };
    x.globalNum += 1;
    save(); log("春卡: 寄出 (" + used + " 张贴纸) -> 礼盒 " + box);
    return { box_id: box };
  };
  S["springcard_get_reward"] = function () {
    var x = ss();
    if (!x.boxId) { log("春卡: 没有待开的礼盒"); return { id: 0, num: 0 }; }
    x.boxId = 0;
    st.clover = (Number(st.clover) || 0) + BOX_REWARD.num;
    x.rewardList.push({ item_id: BOX_REWARD.id, num: BOX_REWARD.num });
    save();
    push("clover_update", { clover: st.clover }, 30);
    log("春卡: 开盒 +" + BOX_REWARD.num + " 三叶草 -> " + st.clover);
    return { id: BOX_REWARD.id, num: BOX_REWARD.num };
  };
  S["springcard_share_tags"] = function () {
    var x = ss();
    x.shareNum += 1;
    x.shareCode = "spring" + (1000 + x.shareNum);
    save(); log("春卡: 分享码 " + x.shareCode);
    return { share_code: x.shareCode };
  };
  S["springcard_get_share_tags"] = function () {
    var x = ss();
    if (x.shareGet >= SHARE_LIMIT) { log("春卡: 今日兑换已达上限"); return { tags_id: 0 }; }
    var ids = tagIds(), id = ids[Math.floor(Math.random() * ids.length)];
    x.shareGet += 1;
    addItem(id, 1);
    save(); log("春卡: 分享兑换到贴纸 " + id + " (今日第 " + x.shareGet + " 次)");
    return { tags_id: id };
  };
  log("springcard ready: 有效至 " + new Date(ss().endTime * 1000).toISOString().slice(0, 10));
})();
