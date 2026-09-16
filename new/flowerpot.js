/* lxqw 花盆种植 + 三叶草农场 —— additive layer.
 *
 * 用户: "把农场与耕作做起来"。
 * 契约(逆向报告 notes/research_plant_furniture_gift.md §A):
 *   · 与种植有关的协议**只有一条**: furniture_flowerpot_harvest:[["type","index"],!0]
 *     —— 玩家点成熟的植株收割; 没有任何"播种/浇水/施肥"上行协议。
 *   · furniture_load_flowerpot **不在 protocolList 里**, 但客户端注册了回调(FurnitureModel.initModel),
 *     处理器只有一句: `this.flowerpotData = Utils.convertArrayAll(e)` —— 纯服务端 push。
 *   所以"种什么、几阶段、什么时候熟"全部由服务端决定(离线服的空白区)。
 * 表: flowerpotData(花盆: {id,name,pic,pos_list,type}), flowerData(植株: {id,res[3 个阶段贴图],angle})。
 * 三叶草农场: rules.js 已有 clover_load_clovers / clover_harvest / clover_update, 本层补齐"成熟节奏 +
 *   采集掉落(element/sprite) + 到点重推", 让院子里的草真的会长满、能收。
 */
(function () {
  var M = window.MockServer, st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  function log(m) { try { console.log('[MOCK] 农场: ' + m); } catch (e) {} }
  function save() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
  function nowSec() { return Math.floor(Date.now() / 1000); }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function push(name, data, d) {
    setTimeout(function () {
      try {
        var payload = (data === undefined || data === null) ? (typeof S[name] === 'function' ? S[name]() : S[name])
                                                            : (typeof data === 'function' ? data() : data);
        M.dispatch(name, payload);
      } catch (e) {}
    }, d || 60);
  }
  function dm() { try { return Tabikaeru.DataManager.instance(); } catch (e) { return null; } }
  function tableRows(prop, key) {
    try {
      var d = dm(), t = d && d[prop];
      if (!t) return [];
      var l = (typeof t.list === 'function') ? t.list() : (typeof t.get === 'function' ? t.get(key) : null);
      if (l && !Array.isArray(l) && typeof l === 'object') { var o = []; for (var k in l) o.push(l[k]); return o; }
      return arr(l);
    } catch (e) { return []; }
  }
  var POT_FALLBACK = { id: 23001, name: '陶瓷花盆', pic: 'flowerpot_1_1', pos_list: [[-30, -40], [27, 28]], type: 1 };
  var PLANT_FALLBACK = [1201, 1202, 1203, 1204, 1205];
  function pots() { var r = tableRows('flowerpotData', 'flowerpot'); return r.length ? r : [POT_FALLBACK]; }
  function plants() { var r = tableRows('flowerData', 'plant'); var ids = []; for (var i = 0; i < r.length; i++) { var id = num(r[i] && r[i].id); if (id) ids.push(id); } return ids.length ? ids : PLANT_FALLBACK; }
  function plantStages(id) { var r = tableRows('flowerData', 'plant'); for (var i = 0; i < r.length; i++) if (num(r[i].id) === num(id)) return Math.max(1, arr(r[i].res).length || 3); return 3; }

  /* ---- 花盆状态: 每个盆一个槽(type/index 就是协议参数) ---- */
  function fs() {
    var f = st.flower;
    if (!f || typeof f !== 'object') f = st.flower = {};
    if (!Array.isArray(f.slots)) f.slots = [];
    /* ⚠️ 一个盆有**几个种植位**由表里的 pos_list 决定(客户端 plantList[10*type+index], index 1 基):
       我们表里的陶瓷花盆 pos_list 有 2 个位置 -> 必须建 2 个槽, 否则第二格永远是"呱~空的"。 */
    var ps = pots(), want = [];
    for (var i = 0; i < ps.length; i++) {
      var t = num(ps[i] && ps[i].type) || 1;
      var n = arr(ps[i] && ps[i].pos_list).length || 1;
      for (var j = 0; j < n; j++) want.push({ type: t, index: j });
    }
    for (var w = 0; w < want.length; w++) {
      var found = null;
      for (var k = 0; k < f.slots.length; k++) {
        if (num(f.slots[k].type) === want[w].type && num(f.slots[k].index) === want[w].index) { found = f.slots[k]; break; }
      }
      if (!found) f.slots.push({ type: want[w].type, index: want[w].index, plant: 0, stage: 0, stageAt: 0, plantedAt: 0, harvests: 0 });
    }
    return f;
  }
  /* 一个阶段多久: st.flowerStageSeconds(测试/GM 可覆盖), 默认 20 分钟 */
  function stageSeconds() { var v = num(st.flowerStageSeconds); return v > 0 ? v : 20 * 60; }
  function grownStage(sl) {
    if (!sl || !num(sl.plant)) return 0;
    var stages = plantStages(sl.plant), span = stageSeconds();
    var passed = Math.floor((nowSec() - num(sl.plantedAt)) / span);
    return Math.max(0, Math.min(stages, passed));      /* == stages 就是成熟 */
  }
  function slotByIndex(type, index) {
    var f = fs();
    for (var i = 0; i < f.slots.length; i++) if (num(f.slots[i].type) === num(type) && num(f.slots[i].index) === num(index)) return f.slots[i];
    return null;
  }
  /* 肥力: 1~3 星(1 星不能种); 用堆肥箱产出的"堆肥"提升; 3 星时自己会长野草(狗尾草 202103 / 知风草 202104) */
  var FERT_MAX = 3, WILD = [202103, 202104];
  /* 单株价值(用户表/原版): 一株三叶草 = **25** 货币(满田 20 株 -> 500); st.cloverValue 可覆盖 */
  function cloverValue() { var v = num(st.cloverValue); return v > 0 ? v : 25; }
  function fertOf(sl) { var v = num(sl && sl.fert); return v >= 1 ? Math.min(FERT_MAX, v) : 1; }
  function fertilize(sl) { if (!sl) return 0; var f = fertOf(sl); if (f >= FERT_MAX) return f; sl.fert = f + 1; save(); log('施肥: 花盆 ' + sl.type + '/' + sl.index + ' 肥力 -> ' + sl.fert + ' 星'); return sl.fert; }
  /* 小伙伴(访客)随机挑一颗种子帮你种下: 玩家准备种子, 种哪颗由它决定 */
  function neighbourPlant(guestId, why) {
    var f = fs(), i;
    for (i = 0; i < f.slots.length; i++) if (!num(f.slots[i].plant)) break;
    if (i >= f.slots.length) { log('小伙伴想种点什么, 但花盆都占着'); return false; }
    var sl = f.slots[i];
    if (fertOf(sl) < 2) { log('小伙伴看了看花盆: 肥力只有 ' + fertOf(sl) + ' 星(1 星不能种), 需要先施点肥'); return false; }
    var h = arr(st.house), seeds = [];
    for (var j = 0; j < h.length; j++) { var id = num(h[j] && h[j].item_id); if (num(h[j] && h[j].count) > 0 && SEED_IDS.indexOf(id) >= 0) seeds.push(j); }
    if (!seeds.length) { log('小伙伴想帮你种花, 但你背包里没有种子(嘟嘟商店有卖)'); return false; }
    var pick = seeds[Math.floor(Math.random() * seeds.length)];
    var seedId2 = num(h[pick].item_id);
    h[pick].count = num(h[pick].count) - 1;
    sl.plant = seedId2; sl.stage = 0; sl.plantedAt = nowSec(); sl.stageAt = nowSec(); sl.byGuest = num(guestId);
    save();
    push('item_load_items', null, 40);
    log('小伙伴' + num(guestId) + '帮你种下了种子 ' + seedId2 + ' (从 ' + seeds.length + ' 种里随机挑的)' + (why ? ' [' + why + ']' : ''));
    pushPot();
    return true;
  }
  /* 肥力 3 星: 空盆里自己长出野草 */
  function wildGrow() {
    var f = fs(), n = 0;
    for (var i = 0; i < f.slots.length; i++) {
      var sl = f.slots[i];
      if (num(sl.plant) || fertOf(sl) < FERT_MAX) continue;
      if (Math.random() < 0.15) { sl.plant = WILD[Math.floor(Math.random() * WILD.length)]; sl.stage = 0; sl.plantedAt = nowSec(); sl.wild = 1; n++; }
    }
    if (n) { save(); log('肥力满的盆里自己长出了野草 ×' + n); pushPot(); }
    return n;
  }
  function plantOne(plantId) {
    var f = fs(), id = num(plantId) || plants()[0];
    for (var i = 0; i < f.slots.length; i++) {
      if (!num(f.slots[i].plant)) {
        f.slots[i].plant = id; f.slots[i].stage = 0; f.slots[i].plantedAt = nowSec(); f.slots[i].stageAt = nowSec();
        save();
        log('种下植株 ' + id + ' 在花盆 ' + f.slots[i].type + '/' + f.slots[i].index + ' (每阶段 ' + Math.round(stageSeconds() / 60) + ' 分钟)');
        pushPot();
        return f.slots[i];
      }
    }
    return null;
  }
  /* 有种子就种: 种子 = 仓库里 id 属于 flowerData 的物品 */
  var SEED_IDS = plants();
  function tryPlantFromHouse() {
    try {
      var h = arr(st.house);
      for (var i = 0; i < h.length; i++) {
        var id = num(h[i] && h[i].item_id), c = num(h[i] && h[i].count);
        if (c <= 0 || SEED_IDS.indexOf(id) < 0) continue;
        if (!plantOne(id)) return false;
        h[i].count = c - 1; save(); push('item_load_items', null, 40);
        return true;
      }
    } catch (e) {}
    return false;
  }

  /* ---- 下发(push) ----------------------------------------------------------
     ⚠️ 崩溃根因(2026-09-15 定位): MainOutView.update_flowerpot() 读的是
         `flowerpotData.show_list`(花盆列表) 与 `flowerpotData.plant_list`(种了什么),
         show_list[i] = {id: 花盆表 id, type}, plant_list[i] = {id: 植株 id, type, index, stage(0..3, 3=可收)};
         客户端还只建了 `flowerpotList[1]` / `plantList[11]` / `plantList[12]`(见 MainOutView 构造),
         所以只能发**表里有的 type**、并且 index 不能超过那张盆的 pos_list 长度。
         以前我们发的是 {list, pots, num} -> `e.show_list.length` 直接抛
         "Cannot read properties of undefined (reading 'length')" @update_flowerpot,
         而这条路径挂在 open/reset 与 client_load_role 上 —— 也就是**每次进庭院/每次刷新都会崩**。
     ------------------------------------------------------------------------- */
  function potTable() {
    var out = {};
    try {
      var db = Tabikaeru.DataManager.instance().flowerpotData;
      var g = db && typeof db.get === 'function' ? db.get('flowerpot') : null;
      for (var k in g) if (g[k] && num(g[k].type)) out[num(g[k].type)] = g[k];
    } catch (e) {}
    return out;
  }
  /* 客户端 sprite: 0 空 / 1~2 生长中 / 3 可收 */
  function clientStage(sl, stage, stages) {
    if (!sl || !num(sl.plant)) return 0;
    if (stage >= stages) return 3;
    return Math.max(1, Math.min(2, Math.ceil(stage / Math.max(1, stages) * 2)));
  }
  function potPayload() {
    var f = fs(), list = [], show = [], plantsList = [], tb = potTable(), seen = {};
    for (var i = 0; i < f.slots.length; i++) {
      var sl = f.slots[i], stage = grownStage(sl), stages = sl.plant ? plantStages(sl.plant) : 0;
      list.push({
        type: num(sl.type), index: num(sl.index),
        plant_id: num(sl.plant), item_id: num(sl.plant),
        state: sl.plant ? (stage >= stages ? 2 : 1) : 0,          /* 0 空 / 1 生长中 / 2 可收割 */
        stage: stage, stages: stages,
        planted_at: num(sl.plantedAt), stage_at: num(sl.stageAt), stage_time: stageSeconds(),
        mature: (sl.plant && stage >= stages) ? 1 : 0
      });
      var pot = tb[num(sl.type)];
      if (!pot) continue;                                         /* 表里没有这种盆 -> 客户端画不出来, 不发 */
      if (!seen[num(sl.type)]) { seen[num(sl.type)] = 1; show.push({ id: num(pot.id), type: num(pot.type) }); }
      var maxIdx = arr(pot.pos_list).length || 1;
      var cIdx = num(sl.index) + 1;                                /* 客户端是 1 基: plantList[10*type+index] / req_flowerpot_harvest(type,index) */
      if (!num(sl.plant) || cIdx > maxIdx) continue;                /* 位置数不够也不发(plantList[10*type+idx] 会 undefined) */
      plantsList.push({ id: num(sl.plant), type: num(sl.type), index: cIdx,
                        stage: clientStage(sl, stage, stages) });
    }
    return { show_list: show, plant_list: plantsList, list: list, pots: pots(), num: pots().length };
  }
  function pushPot() { push('furniture_load_flowerpot', potPayload(), 60); }
  S['furniture_load_flowerpot'] = function () { return potPayload(); };
  /* 客户端要三叶草田时也要给它**规整过**的行(clovers() 里才会算 sprite/last_harvest) */
  S['clover_load_clovers'] = function () { return clovers(); };
  /* ---- 收割: 客户端两种玩法都要认 ------------------------------------------------------------
       · 单棵点: harvestClover(id) -> 只发那一棵(可能带 element/sprite)
       · 滑动:   一次发多棵
     以前不管收到什么都是"整片收掉" -> 用户点一棵四叶草, 整块田都没了。
     现在: 收到 id(们) 就只收那几棵; 一个 id 都没有(全收请求)才走 harvestAll。 */
  function harvestOne(ids, why) {
    clovers();                                   /* 先把行materialize(否则空列表上收割会算成 0) */
    var rows = arr(st.clovers), got = 0, four = 0, keep = [], i, j;
    /* 一个都没对上(客户端 id 与行错位)时退化成"收最前面那棵", 保证点一下一定有反应 */
    var any = false;
    for (i = 0; i < rows.length; i++) for (j = 0; j < ids.length; j++) if (num(ids[j]) === num(rows[i].clover_id)) any = true;
    if (!any && rows.length) ids = [num(rows[0].clover_id)];
    for (i = 0; i < rows.length; i++) {
      var r = rows[i], hit = false;
      for (j = 0; j < ids.length; j++) if (num(ids[j]) === num(r.clover_id)) hit = true;
      if (!hit) { keep.push(r); continue; }
      r.last_harvest = -1;                                   /* 只有这一株被标成已收割 */
      r.readyAt = 0;
      keep.push(r);
      if (num(r.element) === 1) four++; else got++;          /* 四叶草给道具, 三叶草给货币 */
    }
    /* ⚠️ 客户端把 clover_id 当**1 基下标**用(RoleModel.harvestClover: cloverGrowList[id-1],
       位置缓存也按 clover_id), 所以收掉一棵之后剩下的必须重新编号成 1..N —— 否则列表稀疏,
       点第 2 棵发上来的 id=2 会落到"另一棵"身上, 表现就是"点了一棵之后其他都点不动"。 */
    st.clovers = keep;                                     /* 行还在, 只是标成 -1(不画) */
    st.cloverGrown = keep.filter(function (r) { return num(r.last_harvest) === 0; }).length;
    st.clover = num(st.clover) + got * cloverValue();          /* 单株 25(用户表) */
    if (four) {
      st.fourLeaf = num(st.fourLeaf) + four;
      st.house = arr(st.house);
      var fd = null;
      for (i = 0; i < st.house.length; i++) if (num(st.house[i].item_id) === FOUR_LEAF_ITEM) fd = st.house[i];
      if (fd) fd.count = num(fd.count) + four; else st.house.push({ item_id: FOUR_LEAF_ITEM, count: four });
    }
    /* 逐行排期: 第 i 株 = now + (i+1) × 540s -> 20 株正好 3 小时长满(离线也按这个时间戳) */
    var qq = 0, t0 = nowSec();
    st.cloverQ = 0;
    for (i = 0; i < keep.length; i++) if (num(keep[i].last_harvest) !== 0) { qq++; keep[i].qpos = qq; keep[i].readyAt = t0 + qq * Math.round(1 / CLOVER_PER_SEC); }
    st.cloverSince = t0;
    save();
    push('clover_update', { clover: st.clover }, 30);
    push('clover_load_clovers', clovers(), 50);
    try { if (four) push('item_load_items', null, 60); } catch (e) {}
    /* 计划系统事件(第 3 步): 收割直接报数(不靠包装层, 免得加载顺序打架) */
    try { if (window.MOCK_PLANS && window.MOCK_PLANS.progress && got > 0) window.MOCK_PLANS.progress('HARVEST_CLOVER', got, {}); } catch (e) {}
    log('收割 ' + ids.length + ' 棵 [' + (why || '') + ']: 三叶草+' + (got * cloverValue()) + '(单株' + cloverValue() + ') 四叶草+' + four +
        ' (还剩 ' + keep.length + ' 棵, 货币 ' + st.clover + ')');
    return { code: 0, clover: st.clover, gain: got, four: four, left: keep.length };
  }
  var smartHarvest = S['clover_harvest'] = function (p) {
    if (p === undefined) { log('忽略无参数的收割调用(自动收割会清空整片田)'); return { code: 0, gain: 0, four: 0, left: -1 }; }
    var ids = [];
    /* 客户端 TOUCH_END 那一下可能直接发**裸数组**(harvestCloverList), 也可能包在 list/clovers 里 —— 两种都认,
       否则 ids 解析成空 -> 退化成"全收", 表现就是"点一棵, 剩下的全没了"。 */
    var list = Array.isArray(p) ? p : arr(p && (p.list || p.clovers || p.clover_list || p.harvest_list));
    for (var i = 0; i < list.length; i++) {
      var e = list[i] || {};
      if (num(e.clover_id || e.id)) ids.push(num(e.clover_id || e.id));
    }
    if (!ids.length && num(p && (p.clover_id || p.id))) ids.push(num(p.clover_id || p.id));
    if (ids.length) return harvestOne(ids, '单棵/多棵');
    var r = harvestAll('全部收割');
    return { code: 0, clover: num(st.clover), gain: num(r && r.gain), four: num(r && r.four), left: 0 };
  };

  /* ---- 收割: 客户端点成熟植株 -> furniture_flowerpot_harvest(type,index) ---- */
  S['furniture_flowerpot_harvest'] = function (p) {
    var type = num(p && p.type), index = num(p && p.index);
    /* 客户端发的是 1 基(plantList 的键 10*type+index) —— 内部槽位是 0 基, 两种都认 */
    var sl = slotByIndex(type, index) || slotByIndex(type, index - 1) || fs().slots[0];
    if (!sl || !num(sl.plant)) { log('收割失败: 这个盆是空的 (' + type + '/' + index + ')'); return { code: 1 }; }
    var stages = plantStages(sl.plant), stage = grownStage(sl);
    if (stage < stages) { log('收割失败: 还没熟 (' + stage + '/' + stages + ')'); return { code: 1 }; }
    var plantId = num(sl.plant);
    /* 收获: 植株本身进仓库 + 记进 flowerLog(植物百科 new/ency.js 按它解锁 long_id) */
    st.house = arr(st.house);
    var got = null;
    for (var i = 0; i < st.house.length; i++) if (num(st.house[i].item_id) === plantId) got = st.house[i];
    if (got) got.count = num(got.count) + 1; else st.house.push({ item_id: plantId, count: 1 });
    st.flowerLog = arr(st.flowerLog);
    st.flowerLog.push({ plant: plantId, at: Date.now() });
    if (st.flowerLog.length > 200) st.flowerLog = st.flowerLog.slice(-200);
    sl.plant = 0; sl.stage = 0; sl.plantedAt = 0; sl.harvests = num(sl.harvests) + 1;
    save();
    log('收割: 花盆 ' + type + '/' + index + ' 收到植株 ' + plantId + ' (累计 ' + st.flowerLog.length + ' 次) -> 植物百科解锁');
    push('item_load_items', null, 40);
    pushPot();
    try { if (window.MOCK_ENCY) push('encyclopedia_load', window.MOCK_ENCY.plant(), 120); } catch (e) {}
    return { code: 0 };
  };

  /* ---- 三叶草农场(用户给的配置表) ----------------------------------------
      · 生长: 从 0 长满 20 棵约 **3 小时** -> 每 9 分钟长 1 棵;
      · 容量上限 **20**, 满了停止生长;
      · **离线生长**: 按时间戳算累积量(min(20, (now-lastHarvest)/540s));
      · 收割: 庭院滑动一次收**全部成熟**的, 单次最多 20;
      · 四叶草: **每棵独立 1%** 变异 -> 收割时按棵数掷骰, 满 20 棵约 20% 至少出 1 个(一次性护身符 item 1000)。 */
  var CLOVER_MAX = 20, CLOVER_FULL_SEC = 3 * 3600, CLOVER_PER_SEC = CLOVER_MAX / CLOVER_FULL_SEC;   /* 9 分钟/棵 */
  var FOUR_LEAF_CHANCE = 0.01, FOUR_LEAF_ITEM = 1000;
  function clovers() {
    st.clovers = arr(st.clovers);
    var SEC = Math.round(1 / CLOVER_PER_SEC);          /* 每株 9 分钟 */
    function newRow(id, grown) {
      return { clover_id: id, last_harvest: grown ? 0 : -1, readyAt: 0, qpos: 0, rebirth_span: 1800,
               element: (Math.random() < FOUR_LEAF_CHANCE) ? 1 : 0, sprite: 2 };
    }
    /* 行数恒 20、clover_id = 1..20 稳定(客户端 RoleModel.harvestClover 用 [id-1] 取行) */
    if (!st.clovers.length) {
      var seed = Math.max(0, Math.min(CLOVER_MAX, num(st.cloverGrown)));
      for (var s0 = 1; s0 <= CLOVER_MAX; s0++) st.clovers.push(newRow(s0, s0 <= seed));
    }
    var changed = false;
    while (st.clovers.length < CLOVER_MAX) { st.clovers.push(newRow(st.clovers.length + 1, 0)); changed = true; }
    if (st.clovers.length > CLOVER_MAX) { st.clovers = st.clovers.slice(0, CLOVER_MAX); changed = true; }
    /* GM/调试自愈: farmForceFull=1 -> 直接长满 */
    if (num(st.farmForceFull) === 1) {
      st.farmForceFull = 0; st.cloverSince = nowSec();
      for (var fz = 0; fz < st.clovers.length; fz++) { st.clovers[fz].last_harvest = 0; st.clovers[fz].readyAt = 0; st.clovers[fz].qpos = 0; }
      try { save(); } catch (e) {}
      try { console.log('[MOCK] 农场: farmForceFull -> 直接长满 ' + CLOVER_MAX + ' 棵'); } catch (e) {}
      changed = true;
    }
    var nowS = nowSec(), base = num(st.cloverSince) || nowS, nextQ = num(st.cloverQ) || 0;
    var i, r;
    /* 唯一的"长回来"判定: qpos 决定它在 cloverSince 之后第几株熟 -> 离线也按时间戳算 */
    for (i = 0; i < st.clovers.length; i++) {
      r = st.clovers[i];
      if (num(r.last_harvest) === 0) { continue; }
      /* 用**行号**当队列位次(稳定、无需存状态): 第 i 行 = cloverSince + (i+1) × 9 分钟。
         整片收割 -> 最后一株正好 3 小时长满; 只收一棵 -> 那一株按自己的行号长回来。 */
      r.readyAt = base + (i + 1) * SEC;
      if (nowS >= num(r.readyAt)) { grown(r); changed = true; }
    }
    st.cloverQ = nextQ;
    /* 兼容旧字段: st.cloverGrown 比已长好的多(旧档/GM/测试直接写它) -> 把最靠前的几株催熟 */
    var pool = 0;
    for (i = 0; i < st.clovers.length; i++) if (num(st.clovers[i].last_harvest) === 0) pool++;
    var want = Math.max(0, Math.min(CLOVER_MAX, num(st.cloverGrown)));
    if (want > pool) {
      var order = st.clovers.slice().sort(function (a, b) { return num(a.readyAt) - num(b.readyAt); });
      for (i = 0; i < order.length && pool < want; i++) { if (num(order[i].last_harvest) === 0) continue; grown(order[i]); pool++; changed = true; }
    }
    st.cloverGrown = pool;
    for (i = 0; i < st.clovers.length; i++) {
      r = st.clovers[i];
      var isGrown = (num(r.last_harvest) === 0);
      r.grown = isGrown ? 1 : 0;
      r.mature = (pool >= CLOVER_MAX) ? 1 : 0;
      r.count = pool;
      r.sprite = isGrown ? (pool >= CLOVER_MAX ? 2 : 1) : 0;
    }
    if (changed) {
      save();
      setTimeout(function () { try { push('clover_load_clovers', st.clovers, 40); } catch (e) {} }, 30);
    }
    return st.clovers;
  }
  /* 一棵"长出来": 清排期 + 按用户规则**每生成一棵独立 1%** 重掷四叶草 */
  function grown(r) {
    r.last_harvest = 0; r.readyAt = 0; r.qpos = 0;
    r.element = (Math.random() < FOUR_LEAF_CHANCE) ? 1 : 0;
  }
  function cloverReady() { clovers(); return num(st.cloverGrown); }
  /* 收割全部成熟的三叶草; 每棵独立 1% 掷四叶草 */
  function harvestAll(why) {
    var pool = cloverReady();
    if (pool <= 0) return { gain: 0, four: 0 };
    /* 四叶草在**出生时**就已按每棵 1% 判好(element 1), 收割只做统计 */
    var four = 0, rows = arr(st.clovers);
    for (var i = 0; i < rows.length; i++) if (num(rows[i].element) === 1) four++;
    if (!rows.length) for (var i2 = 0; i2 < pool; i2++) if (Math.random() < FOUR_LEAF_CHANCE) four++;
    /* 可选: 凌晨那一小时收割双倍(用户表里的"4 点刷新", 默认关: st.cloverDoubleHour = 4 才开) */
    var dbl = (num(st.cloverDoubleHour) > 0 && new Date().getHours() === num(st.cloverDoubleHour)) ? 2 : 1;
    st.clover = num(st.clover) + pool * cloverValue() * dbl;    /* 单株 25, 凌晨双倍时再 ×2 */
    st.cloverLastHarvest = nowSec();
    st.cloverGrown = 0; st.cloverSince = nowSec();
    st.fourLeaf = num(st.fourLeaf) + four;
    if (four) {
      st.house = arr(st.house);
      var got = null;
      for (var k = 0; k < st.house.length; k++) if (num(st.house[k].item_id) === FOUR_LEAF_ITEM) got = st.house[k];
      if (got) got.count = num(got.count) + four; else st.house.push({ item_id: FOUR_LEAF_ITEM, count: four });
    }
    /* 逐行标成已收割并重新排期(20 株 = 3 小时长满), 行数保持 20、clover_id 稳定 */
    var rows2 = arr(st.clovers), t1 = nowSec(), q2 = 0;
    st.cloverQ = 0;
    for (var m2 = 0; m2 < rows2.length; m2++) {
      if (num(rows2[m2].last_harvest) !== 0) continue;
      q2++; rows2[m2].last_harvest = -1; rows2[m2].qpos = q2; rows2[m2].readyAt = t1 + q2 * Math.round(1 / CLOVER_PER_SEC);
    }
    st.cloverSince = t1;
    var cs = clovers();
    save();
    push('clover_update', { clover: st.clover }, 30);
    push('clover_load_clovers', cs, 60);
    if (four) push('item_load_items', null, 90);
    log('三叶草: 收割 ' + pool + ' 棵 (共 ' + st.clover + ')' + (four ? (' + 四叶草 ×' + four) : '') + ' [' + (why || '') + ']');
    return { gain: pool, four: four };
  }
  function farmTick(force) {
    var before = num(st.cloverGrown);
    clovers();
    if (num(st.cloverGrown) !== before) push('clover_load_clovers', clovers(), 60);
    if (force) return harvestAll('自动');
    return 0;
  }
  /* rules.js 的 clover_harvest 已实现; 包一层换成"一次收全部 + 1% 四叶草" */
  /* ⚠️ 这里原来还有一层包装, 无条件 `harvestAll('玩家滑动收割')` —— 它注册在后面,
     把上面的"智能收割(按 id 只收点中的那几棵)"整个盖掉了, 于是: 点一棵 -> 整片收光,
     剩下的行全变 last_harvest=-1(不画) -> "点了一棵之后其他都点不动"。现在只做薄包装:
     真正收割交给 smartHarvest, 这里只负责补客户端需要的 clover_id 回包字段。 */
  S['clover_harvest'] = function (p) {
    var r = (typeof smartHarvest === 'function') ? smartHarvest(p) : harvestAll('玩家滑动收割');
    /* 回包必须带 clover_id: 客户端靠它清掉"补发队列"(clover_harvest_resend 那条链),
       以前只回 {code:0} 会让它一直重发。 */
    var cid = num(p && (p.clover_id !== undefined ? p.clover_id : p.id));
    if (!cid) { var cs0 = clovers(); cid = num(cs0[0] && cs0[0].clover_id) || 1; }
    return { code: 0, clover_id: cid, clover: st.clover, gain: num(r && r.gain), four_leaf: num(r && r.four) };
  };
  setInterval(function () { try { farmTick(false); } catch (e) {} }, 60000);
  setInterval(function () { try { wildGrow(); } catch (e) {} }, 120000);   /* 不再定时自己种: 种什么由小伙伴决定 */
  setTimeout(function () { try { clovers(); pushPot(); } catch (e) {} }, 4000);
  /* 用一件"堆肥"给第一个盆施肥(堆肥箱产物; 玩家在堆肥界面收下后进仓库) */
  var FERT_ITEM = 202103 ? 202103 : 202103;      /* 占位, 真肥料走 st.fertItem 覆盖 */
  function useFertilizer() {
    try {
      var h = arr(st.house), want = num(st.fertItem) || 0, i;
      for (i = 0; i < h.length; i++) {
        var id = num(h[i] && h[i].item_id);
        if (num(h[i] && h[i].count) <= 0) continue;
        var nm = '';
        try { var d = Tabikaeru.DataManager.instance().ItemDB.get(id); nm = d ? String(d.name) : ''; } catch (e) {}
        if (want ? id !== want : (nm.indexOf('堆肥') < 0)) continue;
        var f = fs(), sl = null;
        for (var j = 0; j < f.slots.length; j++) if (fertOf(f.slots[j]) < FERT_MAX) { sl = f.slots[j]; break; }
        if (!sl) return false;
        h[i].count = num(h[i].count) - 1;
        fertilize(sl);
        push('item_load_items', null, 40);
        return true;
      }
    } catch (e) {}
    return false;
  }
  setInterval(function () { try { useFertilizer(); } catch (e) {} }, 90000);

  /* 用户给的 clover_farm 表结构(离线版: 没有 user_id, 存档本身就是单机):
     {current_count, max_capacity, last_harvest_time, growth_start_time, clovers:[{id,is_four_leaf,grown_at}]} */
  function farmState() {
    var cs = clovers(), pool = num(st.cloverGrown);
    return {
      current_count: pool, max_capacity: CLOVER_MAX,
      last_harvest_time: num(st.cloverLastHarvest) || 0,
      growth_start_time: num(st.cloverSince) || nowSec(),
      grow_seconds_full: CLOVER_FULL_SEC, seconds_per_clover: Math.round(1 / CLOVER_PER_SEC),
      four_leaf_chance: FOUR_LEAF_CHANCE, double_hour: num(st.cloverDoubleHour), clover_value: cloverValue(),
      clovers: cs.map(function (c) {
        return { id: num(c.clover_id), is_four_leaf: c.element === 1 ? true : false,
                 grown_at: num(c.grownAt) || 0, sprite: num(c.sprite), last_harvest: num(c.last_harvest),
                 rebirth_span: num(c.rebirth_span) };
      })
    };
  }
  window.MOCK_FARM = {
    fertilize: function (index) { var f = fs(); return fertilize(f.slots[num(index) || 0]); },
    neighbourPlant: neighbourPlant,
    wild: wildGrow,
    fert: function () { return fs().slots.map(function (x) { return fertOf(x); }); },
    pots: function () { return potPayload(); },
    plant: plantOne,
    harvest: function (type, index) { return S['furniture_flowerpot_harvest']({ type: type, index: index }); },
    farm: function () { return clovers(); },
    pool: cloverReady,
    collect: function () { return harvestAll('手动').gain; },
    harvestAll: harvestAll, farmState: farmState,
    tick: farmTick
  };
  /* 启动后补推一次(用户: "重进一次游戏就没了" —— 以前只在**状态变化**时推,
     存档里本来就是满的 -> changed=false -> 一条都不推 -> 客户端 getCloverGrowList() 空 -> 田是空的)。
     每次启动只推这一条(零代价)。 */
  /* 新手教程里那块田是**满的**(20 棵) —— 新档(还没有 cloverGrown 字段)就按教程初始状态给满,
     让玩家第一次进庭院就能学会"点一下把整片收掉"。老档不受影响。 */
  try {
    if (st.cloverGrown === undefined && st.cloverInit !== 1) {
      st.cloverInit = 1; st.cloverGrown = CLOVER_MAX; st.cloverSince = nowSec();
      try { save(); } catch (e) {}
      log('新档: 按新手教程把三叶草田填满 ' + CLOVER_MAX + ' 棵');
    }
  } catch (e) {}
  setTimeout(function () { try { clovers(); push('clover_load_clovers', st.clovers, 400); } catch (e) {} }, 900);
  log('农场层就绪: 花盆 ' + fs().slots.length + ' 个(每阶段 ' + Math.round(stageSeconds() / 60) + ' 分钟), 三叶草地 ' + clovers().length + ' 块(rebirth ' + Math.round(num(clovers()[0].rebirth_span) / 60) + ' 分钟)');
})();
