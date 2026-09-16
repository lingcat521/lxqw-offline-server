/* lxqw offline greetcard: 贺卡 (限时活动, greetcard_*) — additive layer.
 *
 * Client contract (GreetCardModel):
 *   data = { end_time, card_info:{bg,bless,tags[3]}, send_list, get_list, items:[{item_id,num}],
 *            task_login, task_share, task_item, can_reward, global_num, new_index, stock_num }
 *     getActivityTime() = end_time > 0 ? [1, end_time] : [0,0]   -> end_time 0 hides it
 *     items[].item_id < 100 counts as a card background (req_stock removes those)
 *   greetcard_buy(id)        -> {code:0} -> client changeItems(id,+1)
 *   greetcard_change_bg(id)  -> {code:0} -> bg = id (old one goes back to items)
 *   greetcard_change_bless(id) / greetcard_put_tags(pos,id) -> {code:0}
 *   greetcard_send           -> {code:0} -> client pushes to send_list, can_reward = true
 *   greetcard_get_reward(id) -> {list:[{item_id,count}]}, must be non-empty
 *   greetcard_load_count     -> {count}, greetcard_get_task_item -> {list}, greetcard_stock -> {code:0}
 * Table access: Tabikaeru.DataManager.instance().greetCardData (bg_list / bg_price / bless / tags).
 */
(function () {
  var M = window.MockServer, st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  function log(m) { try { console.log("[MOCK] " + m); } catch (e) {} }
  var BG_FALLBACK = [1, 2, 3, 4, 5], BLESS_FALLBACK = [1, 2, 3, 4, 5, 6], PRICE_FALLBACK = [100, 150, 200];
  var OPEN_DAYS = 7, SEND_REWARD = { item_id: 200000, count: 500 };   /* 200000 = 三叶草 item */
  function table(key) {
    try { var dm = Tabikaeru.DataManager.instance(); return (dm && dm.greetCardData) ? dm.greetCardData.get(key) : null; } catch (e) { return null; }
  }
  function bgIds() { var l = table("bg_list"); if (l && l.length) { var o = []; for (var i = 0; i < l.length; i++) o.push(Number(l[i].id)); return o; } return BG_FALLBACK; }
  function blessIds() { var l = table("bless"); if (l && l.length) { var o = []; for (var i = 0; i < l.length; i++) o.push(Number(l[i].id)); return o; } return BLESS_FALLBACK; }
  function prices() { var p = table("bg_price"); return (p && p.length) ? p : PRICE_FALLBACK; }

  function gs() {
    var g = st.greet, now = Math.floor(Date.now() / 1000);
    if (!g || typeof g !== "object") g = st.greet = {};
    if (!Array.isArray(g.items)) g.items = [];
    if (!g.cardInfo || typeof g.cardInfo !== "object") g.cardInfo = { bg: 0, bless: 0, tags: [0, 0, 0] };
    if (!Array.isArray(g.cardInfo.tags)) g.cardInfo.tags = [0, 0, 0];
    if (!Array.isArray(g.sendList)) g.sendList = [];
    if (!Array.isArray(g.getList)) g.getList = [];
    if (!Array.isArray(g.taskItem)) g.taskItem = [];
    if (typeof g.stockNum !== "number") g.stockNum = 0;
    if (typeof g.globalNum !== "number") g.globalNum = 0;
    if (typeof g.newIndex !== "number") g.newIndex = 0;
    if (typeof g.canReward !== "boolean") g.canReward = false;
    /* 限时活动只在真实日历窗口内开启: 客户端 isOpen() = now in [1, end_time],
       end_time = 0 即隐藏活动(以前这里无条件 now+7 天, 所以 9 月也会弹春节活动) */
    var __win = window.MOCK_CALENDAR ? window.MOCK_CALENDAR.activity('greetcard') : null;
    if (__win && !__win.active) { g.endTime = 0; return g; }
    if (typeof g.endTime !== "number" || g.endTime <= now || (__win && __win.end && g.endTime > __win.end))
      g.endTime = (__win && __win.end) ? __win.end : now + OPEN_DAYS * 86400;
    return g;
  }
  function save() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
  function push(name, d) { setTimeout(function () { try { M.dispatch(name, (typeof S[name] === "function" ? S[name]() : S[name])); } catch (e) {} }, d || 40); }
  function itemNum(id) { var g = gs(); for (var i = 0; i < g.items.length; i++) if (Number(g.items[i].item_id) === Number(id)) return g.items[i].num || 0; return 0; }
  function addItem(id, n) {
    var g = gs();
    for (var i = 0; i < g.items.length; i++) if (Number(g.items[i].item_id) === Number(id)) { g.items[i].num = (g.items[i].num || 0) + n; return; }
    g.items.push({ item_id: Number(id), num: n });
  }
  function data() {
    var g = gs();
    return { end_time: g.endTime, card_info: { bg: g.cardInfo.bg, bless: g.cardInfo.bless, tags: g.cardInfo.tags.slice() },
             send_list: g.sendList.slice(), get_list: g.getList.slice(),
             items: g.items.map(function (x) { return { item_id: x.item_id, num: x.num }; }),
             task_login: true, task_share: !!g.taskShare, task_item: g.taskItem.slice(),
             can_reward: !!g.canReward, global_num: g.globalNum, new_index: g.newIndex, stock_num: g.stockNum };
  }

  S["greetcard_load"] = function () { return data(); };
  S["greetcard_load_count"] = function () { var g = gs(); g.globalNum += 1; save(); return { count: g.globalNum }; };
  S["greetcard_get_task_item"] = function () { return { list: [] }; };
  S["greetcard_get_task_reward"] = function () { return { code: 0 }; };
  S["greetcard_read_new"] = function () { var g = gs(); g.newIndex = g.getList.length; save(); return {}; };
  S["greetcard_send_gift"] = function () { return {}; };
  S["greetcard_feedback_gift"] = function () { return {}; };

  S["greetcard_buy"] = function (p) {
    var g = gs(), id = Number(p && p.id);
    if (bgIds().indexOf(id) < 0) { log("贺卡: 没有这个背景 id=" + id); return { code: 1 }; }
    var pr = prices(), price = Number(pr[Math.min(g.stockNum, pr.length - 1)]) || 0;
    if ((Number(st.clover) || 0) < price) { log("贺卡: 三叶草不够 (" + st.clover + " < " + price + ")"); return { code: 1 }; }
    st.clover -= price;
    addItem(id, 1);
    save();
    push("clover_update", { clover: st.clover }, 30);
    log("贺卡: 买入背景 " + id + " 花费 " + price + " 三叶草 (剩 " + st.clover + ")");
    return { code: 0 };
  };
  S["greetcard_change_bg"] = function (p) {
    var g = gs(), id = Number(p && p.id);
    if (id > 0 && itemNum(id) <= 0) return { code: 1 };
    if (g.cardInfo.bg > 0) addItem(g.cardInfo.bg, 1);     /* the old one goes back */
    if (id > 0) addItem(id, -1);
    g.cardInfo.bg = id;
    save(); log("贺卡: 背景 -> " + id);
    return { code: 0 };
  };
  S["greetcard_change_bless"] = function (p) {
    var id = Number(p && p.id);
    if (id > 0 && blessIds().indexOf(id) < 0) return { code: 1 };
    gs().cardInfo.bless = id; save(); log("贺卡: 祝福 -> " + id);
    return { code: 0 };
  };
  S["greetcard_put_tags"] = function (p) {
    var g = gs(), pos = Number(p && p.pos), id = Number(p && p.id);
    if (!(pos >= 0 && pos < 3)) return { code: 1 };
    if (g.cardInfo.tags[pos] > 0) addItem(g.cardInfo.tags[pos], 1);
    if (id > 0) { if (itemNum(id) <= 0) return { code: 1 }; addItem(id, -1); }
    g.cardInfo.tags[pos] = id;
    save(); log("贺卡: 贴纸 " + pos + " -> " + id);
    return { code: 0 };
  };
  S["greetcard_send"] = function () {
    var g = gs();
    if (!g.cardInfo.bg) { log("贺卡: 还没选背景"); return { code: 1 }; }
    g.sendList.push({ bg: g.cardInfo.bg, bless: g.cardInfo.bless, tags: g.cardInfo.tags.slice() });
    g.cardInfo = { bg: 0, bless: 0, tags: [0, 0, 0] };
    g.canReward = true;
    g.globalNum += 1;
    save(); log("贺卡: 寄出第 " + g.sendList.length + " 张 (全服 " + g.globalNum + ")");
    return { code: 0 };
  };
  S["greetcard_get_reward"] = function () {
    var g = gs();
    if (!g.canReward) return { list: [] };
    g.canReward = false;
    st.clover = (Number(st.clover) || 0) + SEND_REWARD.count;
    save();
    push("clover_update", { clover: st.clover }, 30);
    log("贺卡: 收到回礼 +" + SEND_REWARD.count + " 三叶草 -> " + st.clover);
    return { list: [{ item_id: SEND_REWARD.item_id, count: SEND_REWARD.count }] };
  };
  S["greetcard_stock"] = function () {
    var g = gs();
    g.stockNum += 1; save(); log("贺卡: 存图鉴 第 " + g.stockNum + " 次");
    return { code: 0 };
  };

  /* 邻居回卡: 每 3 分钟来一张, 让 get_list 真的有东西 */
  var lastMail = Date.now();
  setInterval(function () {
    var g = gs();
    if (Date.now() - lastMail < 180000) return;
    lastMail = Date.now();
    var bgs = bgIds(), bl = blessIds();
    g.getList.push({ bg: bgs[Math.floor(Math.random() * bgs.length)], bless: bl[Math.floor(Math.random() * bl.length)], tags: [0, 0, 0] });
    save();
    log("贺卡: 收到一张邻居贺卡 (共 " + g.getList.length + ")");
    push("greetcard_load", null, 40);
  }, 30000);

  log("greetcard ready: 有效至 " + new Date(gs().endTime * 1000).toISOString().slice(0, 10) + ", 持有 " + gs().items.length + " 种卡片素材");
})();
