/* lxqw 明信片路径模拟(离线) —— 四区域图 + START/GOAL/PATH/DETOUR + Dijkstra + 逐节点分级判定
 *
 * 需求(用户清单/目标): 明信片不是"随便抽一张", 而是**先走一条路**: 四区域图(东/南/西/北)上
 *   从 START(家) 到 GOAL(目的地) 求最短路(带预算), 顺路可能走 PATH(途经) 或 DETOUR(岔路),
 *   每个节点按等级判定: 途经=普通(Normal) / 目的地=景点(Goal) / 岔路=道具(Tools) / 隐藏=稀有(Unique)。
 *
 * 全部数据都来自本机表(不联网), 所以这套判定是"真的"在按游戏数据走:
 *   GoalNumber_json : 38 个目的地 {id,name,tag=g_xxx}
 *   Picture_json    : 351 张明信片 {id,name,type,place(=GoalNumber.id)} —— Goal 类里有 132 张带 place
 *   PictureTag_json : 200 个标签 {Tag,picNames,tagType}, picNames 是底图名 -> 用它把"风格"落到真实底图
 *   Item_json       : 食物 type0 / 道具 type2 / 护符 type1
 *
 * 客户端契约:
 *   rules.js comeBack() 里 `window.MOCK_PICK_PHOTO(st.lastTripItems)` -> 返回 pic id -> 写进相册。
 *   本层在 postcardpool.js 之后加载(见 mock.js 层表), 包住 MOCK_PICK_PHOTO: 能走通就按路径判级出图,
 *   走不通(表缺失/异常)就原样回落到原来的池子抽法 —— 不改变原有可用行为。
 *
 * 食物/道具如何影响路线(与 encytravel/Item 表里的文案一一对应):
 *   · 101~134 是"目的地指向性食物": 吃一口就想进京/入川/来渝/赴粤… -> 直接锁定目的地
 *   · 4 香葱烤包子=沙漠 / 5 海苔煎豆腐=海边 / 15 桂花蒸米糕=水乡 / 16 彩椒烙蛋饼=雪地 / 33 水果沙拉=山丘
 *   · 护符 type1: 1004 红铃铛->南, 1005 蓝铃铛->北, 1006 桃铃铛->没去过的新地方,
 *                 1007 绿千纸鹤->东, 1008 白千纸鹤->西, 1009 红千纸鹤->南, 1010 蓝千纸鹤->北
 *   · 走得远不远: st.tripPlan.hours(已含食物价格/道具/护符/天气/称号) -> 预算 km
 */
(function () {
  var st = window.MOCK_STATE || (window.MOCK_STATE = {});
  function log(m) { try { console.log('[MOCK] 明信片路线: ' + m); } catch (e) {} }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function arr(a) { return Array.isArray(a) ? a : []; }
  function pick(a) { return a && a.length ? a[Math.floor(Math.random() * a.length)] : 0; }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function itemRow(id) { try { var db = Tabikaeru.DataManager.instance().ItemDB; return db && db.get ? db.get(num(id)) : null; } catch (e) { return null; } }

  /* ---------- 真实表 ---------- */
  function dm() { try { return Tabikaeru.DataManager.instance(); } catch (e) { return null; } }
  function dbList(name) {
    try {
      var d = dm(), db = d && d[name];
      if (!db) return [];
      if (typeof db.list === 'function') return db.list() || [];
      return db || [];
    } catch (e) { return []; }
  }
  function layerIds() { return window.MOCK_PICTURES || {}; }
  var LCOUNT = -1;
  function layerCount() { if (LCOUNT < 0) { try { LCOUNT = Object.keys(layerIds()).length; } catch (e) { LCOUNT = 0; } } return LCOUNT; }
  function hasLayer(id) { return layerCount() === 0 ? true : !!layerIds()[String(id)]; }

  var PIC = null;
  function picRows() { if (!PIC) PIC = dbList('PictureDB'); return PIC; }
  var GOALS = null;
  function goalRows() { if (!GOALS) GOALS = dbList('GoalNumberDB'); return GOALS; }
  function goalName(id) {
    var g = goalRows();
    for (var i = 0; i < g.length; i++) if (num(g[i].id) === num(id)) return String(g[i].name || '');
    return '';
  }
  /* place -> 有图层的景点照 id 列表 */
  var BYPLACE = null;
  function picsByPlace() {
    if (BYPLACE) return BYPLACE;
    var out = {}, rows = picRows();
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i]; if (!r) continue;
      if (String(r.type) !== 'Goal') continue;
      var pl = num(r.place), id = num(r.id);
      if (!pl || !id || !hasLayer(id)) continue;
      (out[pl] = out[pl] || []).push(id);
    }
    BYPLACE = out;
    return out;
  }
  /* 标签 -> 有图层的照片 id(用 PictureTag.picNames 对 Picture.name) */
  var TAGPIC = {};
  function tagPics(tag) {
    if (TAGPIC[tag]) return TAGPIC[tag];
    var out = [], tags = dbList('PictureTagDB'), rows = picRows(), i, j, k;
    for (i = 0; i < tags.length; i++) {
      var t = tags[i]; if (!t || String(t.Tag) !== String(tag)) continue;
      var names = arr(t.picNames);
      for (j = 0; j < rows.length; j++) {
        var r = rows[j]; if (!r) continue;
        for (k = 0; k < names.length; k++) {
          if (String(r.name) === String(names[k]) && hasLayer(num(r.id))) { out.push(num(r.id)); break; }
        }
      }
    }
    TAGPIC[tag] = out;
    return out;
  }

  /* ---------- 四区域图(东/南/西/北) ----------
     km = 从家出发的里程; flavor 决定"在某地吃更佳"的偏好与途经底图风格 */
  var PLACE_META = {
    1:  [1200, 'north', 'city',     '北京'],
    2:  [1800, 'west',  'mountain', '成都'],
    3:  [1700, 'west',  'mountain', '重庆'],
    4:  [1900, 'south', 'coastal',  '广州'],
    5:  [1700, 'south', 'mountain', '桂林'],
    6:  [1300, 'east',  'jiangnan', '杭州'],
    7:  [1250, 'east',  'jiangnan', '苏州'],
    8:  [1100, 'north', 'coastal',  '天津'],
    9:  [2200, 'south', 'mountain', '台湾十分'],
    10: [2300, 'south', 'coastal',  '台湾垦丁'],
    11: [1950, 'south', 'coastal',  '香港'],
    12: [2000, 'north', 'snow',     '哈尔滨'],
    13: [1400, 'south', 'mountain', '张家界'],
    14: [1100, 'east',  'jiangnan', '武汉'],
    15: [1000, 'north', 'city',     '洛阳'],
    16: [1200, 'west',  'city',     '西安'],
    17: [2200, 'west',  'desert',   '酒泉'],
    18: [2400, 'west',  'mountain', '云南'],
    19: [3000, 'west',  'mountain', '拉萨'],
    20: [1300, 'east',  'jiangnan', '上海'],
    21: [2100, 'south', 'coastal',  '海南'],
    22: [1900, 'west',  'mountain', '贵州'],
    23: [1600, 'west',  'desert',   '宁夏'],
    24: [1600, 'south', 'coastal',  '福建'],
    25: [1300, 'east',  'jiangnan', '江西'],
    26: [1150, 'east',  'jiangnan', '安徽'],
    27: [1500, 'north', 'snow',     '辽宁'],
    28: [1400, 'east',  'coastal',  '青岛'],
    29: [900,  'north', 'city',     '山西'],
    30: [1800, 'north', 'snow',     '吉林'],
    31: [1950, 'south', 'coastal',  '澳门'],
    32: [2100, 'west',  'mountain', '青海'],
    33: [1150, 'north', 'city',     '河北'],
    100:[1300, 'east',  'museum',   '江西省博物馆'],
    101:[1400, 'east',  'museum',   '山东博物馆'],
    102:[1900, 'south', 'museum',   '南越王博物院'],
    103:[1250, 'east',  'museum',   '吴文化博物馆'],
    104:[900,  'north', 'museum',   '山西博物院']
  };
  var REGION_NAME = { east: '东', south: '南', west: '西', north: '北' };
  var REGION_FLAVOR = { east: '江南水乡/沿海', south: '沿海/山水', west: '沙漠/山丘', north: '北方/雪地' };
  var REGION_TAGS = {
    east:  ['n_bamboo', 'n_branch', 'n_tulou', 'n_lanhuateng', 'n_chuisihaitang'],
    south: ['n_beach', 'n_ibis', 'n_bamboo', 'n_tree'],
    west:  ['n_field', 'n_panda', 'n_fenglingmu', 'n_sanxia', 'n_tree'],
    north: ['n_rime', 'n_lamei', 'n_field', 'n_leaves2', 'n_roof'],
    any:   ['n_roof', 'n_branch', 'n_field']
  };
  /* 目的地指向性食物(Item id -> GoalNumber id), 文案见 Item_json.info */
  var FOOD_PLACE = {
    47: 20, 48: 7, 49: 1, 50: 4, 51: 11, 52: 29, 53: 16,
    101: 1, 102: 2, 103: 3, 104: 4, 105: 5, 106: 6, 107: 7, 108: 8, 109: 9, 110: 12,
    111: 18, 112: 21, 113: 14, 114: 13, 115: 16, 116: 15, 117: 17, 118: 19, 119: 20, 120: 11,
    121: 23, 122: 22, 123: 24, 124: 25, 125: 26, 126: 27, 127: 28, 128: 29, 129: 30, 130: 31,
    131: 32, 132: 33, 133: 17, 134: 33
  };
  /* "在某地享用味道更佳" —— 食物 -> 风格偏好 */
  var FOOD_FLAVOR = { 4: 'desert', 5: 'coastal', 15: 'jiangnan', 16: 'snow', 33: 'mountain' };
  /* 护符指方向 */
  var PROP_DIR = { 1004: 'south', 1005: 'north', 1006: 'new', 1007: 'east', 1008: 'west', 1009: 'south', 1010: 'north' };

  function placesIn(region) {
    var out = [], k;
    for (k in PLACE_META) if (PLACE_META[k][1] === region) out.push(num(k));
    return out;
  }
  function regionOfPlace(place) { var m = PLACE_META[num(place)]; return m ? m[1] : ''; }
  function placeName(place) { return (PLACE_META[num(place)] && PLACE_META[num(place)][3]) || goalName(place) || ('目的地' + place); }

  /* ---------- 图 ---------- */
  var G = null;
  function graph() {
    if (G) return G;
    var nodes = {}, edges = [], k, r, i;
    function node(id, kind, region, place, tag) { nodes[id] = { id: id, kind: kind, region: region, place: place || 0, tag: tag || '' }; }
    function edge(a, b, km) { edges.push([a, b, km]); }
    node('home', 'start', '', 0, '');
    var keys = ['east', 'south', 'west', 'north'];
    for (i = 0; i < keys.length; i++) {
      r = keys[i];
      node('r:' + r, 'road', r, 0, REGION_TAGS[r][0]);
      node('f:' + r, 'fork', r, 0, REGION_TAGS[r][1] || REGION_TAGS[r][0]);
      node('d:' + r, 'detour', r, 0, 'p_town');
      node('s:' + r, 'secret', r, 0, '');
      edge('home', 'r:' + r, 260);
      edge('r:' + r, 'f:' + r, 150);
      edge('f:' + r, 'd:' + r, 240);
      edge('d:' + r, 's:' + r, 200);
      var ps = placesIn(r);
      for (k = 0; k < ps.length; k++) {
        node('g:' + ps[k], 'goal', r, ps[k], '');
        edge('f:' + r, 'g:' + ps[k], PLACE_META[ps[k]][0]);
      }
    }
    /* 区域之间也连着(所以 Dijkstra 可能真的"穿过另一个区域") */
    edge('r:east', 'r:north', 420);
    edge('r:north', 'r:west', 520);
    edge('r:west', 'r:south', 600);
    edge('r:south', 'r:east', 380);
    var adj = {};
    for (i = 0; i < edges.length; i++) {
      var e = edges[i];
      (adj[e[0]] = adj[e[0]] || []).push([e[1], num(e[2])]);
      (adj[e[1]] = adj[e[1]] || []).push([e[0], num(e[2])]);
    }
    G = { nodes: nodes, adj: adj, edges: edges };
    return G;
  }
  /* Dijkstra: 返回 {km, path:[...]} , 不可达 -> null */
  function shortest(from, to) {
    var g = graph();
    if (!g.nodes[from] || !g.nodes[to]) return null;
    var dist = {}, prev = {}, done = {}, cur = from;
    dist[from] = 0;
    while (cur) {
      done[cur] = 1;
      var nb = g.adj[cur] || [];
      for (var i = 0; i < nb.length; i++) {
        var v = nb[i][0], w = nb[i][1];
        if (done[v]) continue;
        var nd = dist[cur] + w;
        if (dist[v] === undefined || nd < dist[v]) { dist[v] = nd; prev[v] = cur; }
      }
      cur = null;
      var best = Infinity;
      for (var k in dist) if (!done[k] && dist[k] < best) { best = dist[k]; cur = k; }
    }
    if (dist[to] === undefined) return null;
    var path = [to], p = to;
    while (prev[p] !== undefined) { p = prev[p]; path.unshift(p); }
    return { km: Math.round(dist[to]), path: path };
  }
  function joinPath(a, b) {
    var out = arr(a).slice(), i;
    for (i = 0; i < arr(b).length; i++) if (out[out.length - 1] !== b[i]) out.push(b[i]);
    return out;
  }
  function nearestGoal(region, budget) {
    var ps = region ? placesIn(region) : Object.keys(PLACE_META).map(num);
    var best = 0, bestKm = Infinity;
    for (var i = 0; i < ps.length; i++) {
      var d = shortest('home', 'g:' + ps[i]);
      if (!d) continue;
      var over = budget && d.km > budget ? d.km - budget : 0;   /* 超预算的排后面 */
      var score = d.km + over * 3;
      if (score < bestKm) { bestKm = score; best = ps[i]; }
    }
    return best;
  }

  /* ---------- 行李 -> 这次要去哪儿 ---------- */
  function envInfo(items) {
    var list = arr(items), i, food = [], flavor = '', lock = 0, dir = '', amulets = 0, props = 0, bestFood = 0;
    for (i = 0; i < list.length; i++) {
      var id = num(list[i]); if (id < 0) continue;
      var row = itemRow(id); if (!row) continue;
      var t = num(row.type);
      if (t === 0) {
        food.push(id);
        if (FOOD_PLACE[id]) lock = FOOD_PLACE[id];
        if (FOOD_FLAVOR[id]) flavor = FOOD_FLAVOR[id];
        var pr = num(row.price); if (pr > bestFood) bestFood = pr;
      } else if (t === 1) { amulets++; if (PROP_DIR[id]) dir = PROP_DIR[id]; }
      else if (t === 2) props++;
    }
    var hours = 0;
    try { hours = num(st.tripPlan && st.tripPlan.hours); } catch (e) {}
    if (!hours) hours = num(st.tripSeconds) / 3600;
    if (!hours) hours = food.length ? 4 : 0.5;
    return { food: food, lock: lock, flavor: flavor, dir: dir, amulets: amulets, props: props,
             bestFood: bestFood, hours: hours };
  }
  /* 预算 km: 半天 ~600, 一天 ~1500, 三天 ~3000, 一周以上 ~4000+ (与时长表一致) */
  function budgetFor(env) {
    var h = Math.max(0.5, Math.min(72, num(env.hours)));
    var km = 420 * Math.pow(h, 0.85);
    if (env.props) km *= 1.12;
    if (!env.food.length) km *= 0.6;                    /* 没带吃的走不远 */
    return Math.round(Math.max(180, Math.min(5200, km)));
  }
  function choosePlace(env, budget) {
    if (env.lock) return env.lock;                       /* 目的地指向性食物: 直接锁定 */
    var cands = [], k;
    /* 方向护符 / 风格偏好 -> 候选目的地 */
    if (env.dir === 'new') {
      var visited = st.placeVisited || {}, all = [];
      for (k in PLACE_META) if (!visited[k]) all.push(num(k));
      cands = all.length ? all : Object.keys(PLACE_META).map(num);
    } else if (env.dir) {
      cands = placesIn(env.dir);
    } else if (env.flavor) {
      for (k in PLACE_META) if (PLACE_META[k][2] === env.flavor) cands.push(num(k));
    }
    if (cands.length) {
      /* 候选里挑一个"这次预算走得动"的: 走不动就挑最近的(抵达不了太远的远方) */
      var fit = [], i;
      for (i = 0; i < cands.length; i++) {
        var d = shortest('home', 'g:' + cands[i]);
        if (d && d.km <= budget) fit.push(cands[i]);
      }
      if (fit.length) return pick(fit);
      var near = 0, nk = Infinity;
      for (i = 0; i < cands.length; i++) {
        var d2 = shortest('home', 'g:' + cands[i]);
        if (d2 && d2.km < nk) { nk = d2.km; near = cands[i]; }
      }
      if (near) return near;
    }
    /* 没有偏好: 在预算内随便挑(预算不够就挑最近的) */
    var reach = [];
    for (k in PLACE_META) { var dd = shortest('home', 'g:' + k); if (dd && dd.km <= budget) reach.push(num(k)); }
    if (reach.length) return pick(reach);
    return nearestGoal('', budget);
  }
  /* 走这条路: PATH(最短) / DETOUR(绕一次岔路) / 再深一层稀有节点 */
  function walk(place, budget, env) {
    var goal = 'g:' + place, region = regionOfPlace(place);
    var main = shortest('home', goal);
    if (!main) return null;
    var detour = 0, secret = 0, path = main.path, km = main.km, spare = budget - km;
    var luck = 0.55 + 0.12 * env.amulets + 0.06 * env.props;
    if (region && spare >= 420 && Math.random() < luck) {
      var a = shortest('home', 'd:' + region), b = shortest('d:' + region, goal);
      if (a && b && a.km + b.km <= budget) {
        detour = 1; path = joinPath(a.path, b.path); km = Math.round(a.km + b.km);
        spare = budget - km;
      }
    }
    if (detour && spare >= 200 && env.amulets > 0 && Math.random() < 0.35 + 0.1 * env.amulets) {
      var c = shortest('home', 's:' + region), d2 = shortest('s:' + region, goal);
      if (c && d2 && c.km + d2.km <= budget) {
        secret = 1; path = joinPath(c.path, d2.path); km = Math.round(c.km + d2.km);
      }
    }
    return { path: path, km: km, budget: budget, detour: detour, secret: secret, region: region,
             over: km > budget };
  }

  /* ---------- 逐节点分级判定 ---------- */
  function nodeTag(n, env) {
    if (n.kind === 'road' || n.kind === 'fork' || n.kind === 'start') {
      var tags = REGION_TAGS[n.region] || REGION_TAGS.any;
      if (env.flavor === 'coastal' && n.region !== 'north') tags = ['n_beach', 'n_ibis'];
      return pick(tags);
    }
    if (n.kind === 'detour') return pick(['p_town', 'p_town1', 'p_town2', 'p_town3']);
    return '';
  }
  function candidates(w, env) {
    var g = graph(), out = [], i;
    for (i = 0; i < w.path.length; i++) {
      var n = g.nodes[w.path[i]]; if (!n || n.kind === 'start') continue;
      if (n.kind === 'secret' && !w.secret) continue;
      if (n.kind === 'detour' && !w.detour) continue;
      var kind = n.kind === 'goal' ? 'goal' : n.kind === 'detour' ? 'tools' : n.kind === 'secret' ? 'unique' : 'normal';
      out.push({ kind: kind, tag: nodeTag(n, env), place: n.place, region: n.region, id: n.id });
    }
    if (!out.length) out.push({ kind: 'normal', tag: pick(['n_roof', 'n_branch']) });
    return out;
  }
  var BASE_W = { normal: 42, tools: 13, goal: 30 };
  function weights(cands, env) {
    var w = { normal: 0, tools: 0, goal: 0, unique: 0 }, i;
    for (i = 0; i < cands.length; i++) {
      var k = cands[i].kind;
      if (k === 'goal') w.goal += BASE_W.goal;
      else if (k === 'tools') w.tools += BASE_W.tools;
      else if (k === 'unique') w.unique += 100;
      else w.normal += BASE_W.normal;
    }
    /* 护符(四叶草/绘马…): 稀有率跟着涨, 和旧池子保持一致 */
    var rare = Math.min(0.45, 0.10 + 0.07 * env.amulets);
    try { if (window.MOCK_TITLE && window.MOCK_TITLE.rareScale) rare = Math.min(0.6, rare * (Number(window.MOCK_TITLE.rareScale()) || 1)); } catch (e) {}
    w.unique = Math.round(Math.min(w.unique, 100) * rare);
    /* 称号偏向 */
    try {
      var bias = window.MOCK_TITLE && window.MOCK_TITLE.photoBias ? window.MOCK_TITLE.photoBias() : null;
      if (bias === 'props') { w.tools = Math.round(w.tools * 2.2); w.normal = Math.round(w.normal * 1.2); w.unique = Math.round(w.unique * 0.8); }
      else if (bias === 'scenery') { w.normal = Math.round(w.normal * 1.3); w.goal = Math.round(w.goal * 1.3); w.tools = Math.round(w.tools * 0.5); w.unique = Math.round(w.unique * 0.55); }
    } catch (e) {}
    /* 风格偏好食物: 那次旅行更"像"那个地方 */
    if (env.flavor === 'coastal' || env.flavor === 'jiangnan') w.goal = Math.round(w.goal * 1.2);
    return w;
  }
  function rollKind(w) {
    var total = w.normal + w.tools + w.goal + w.unique;
    if (total <= 0) return 'normal';
    var r = Math.random() * total;
    if ((r -= w.normal) <= 0) return 'normal';
    if ((r -= w.goal) <= 0) return 'goal';
    if ((r -= w.tools) <= 0) return 'tools';
    return 'unique';
  }
  var POOL = {};
  function poolOf(kind) {
    if (POOL[kind]) return POOL[kind];
    var rows = picRows(), out = [], i;
    for (i = 0; i < rows.length; i++) {
      var r = rows[i]; if (!r) continue;
      var id = num(r.id);
      if (!id || !hasLayer(id)) continue;
      if (String(r.type) === kind) out.push(id);
    }
    POOL[kind] = out;
    return out;
  }
  function pictureFor(kind, cands, place, env) {
    var ids = [], i;
    if (kind === 'goal') {
      ids = (picsByPlace()[num(place)] || []).slice();
      if (!ids.length) { var gcs = []; for (i = 0; i < cands.length; i++) if (cands[i].kind === 'goal' && cands[i].place) gcs.push(cands[i].place); ids = (picsByPlace()[pick(gcs)] || []).slice(); }
    } else if (kind === 'normal') {
      var tags = [];
      for (i = 0; i < cands.length; i++) if (cands[i].kind === 'normal' && cands[i].tag) tags.push(cands[i].tag);
      tags = shuffle(tags);
      for (i = 0; i < tags.length && !ids.length; i++) ids = tagPics(tags[i]).slice();
      if (!ids.length) ids = poolOf('Normal');
    } else if (kind === 'tools') {
      var ttags = [];
      for (i = 0; i < cands.length; i++) if (cands[i].kind === 'tools' && cands[i].tag) ttags.push(cands[i].tag);
      for (i = 0; i < ttags.length && !ids.length; i++) ids = tagPics(ttags[i]).slice();
      if (!ids.length) ids = poolOf('Tools');
    } else {
      ids = poolOf('Unique');
    }
    return pick(ids);
  }

  /* ---------- 对外 ---------- */
  function plan(items) {
    var env = envInfo(items), budget = budgetFor(env);
    var place = choosePlace(env, budget);
    if (!place) return null;
    var w = walk(place, budget, env);
    if (!w) return null;
    var cands = candidates(w, env), wt = weights(cands, env);
    var kind = rollKind(wt), id = pictureFor(kind, cands, place, env);
    if (!id) { kind = 'normal'; id = pictureFor('normal', cands, place, env); }
    /* 节气照(new/solarphoto.js): 带上当月的节气食物(或今天是节气) -> 有机会拿到"四动物同框"限定照 */
    var sid = 0;
    try { if (window.MOCK_SOLARPHOTO && window.MOCK_SOLARPHOTO.pick) sid = num(window.MOCK_SOLARPHOTO.pick(items)); } catch (e) {}
    if (sid) { kind = 'seasonal'; id = sid; }
    var g = graph(), names = [], i;
    for (i = 0; i < w.path.length; i++) {
      var n = g.nodes[w.path[i]];
      if (!n) continue;
      names.push(n.kind === 'goal' ? placeName(n.place) : n.kind === 'start' ? '家' :
                 (REGION_NAME[n.region] || '') + (n.kind === 'detour' ? '岔路' : n.kind === 'secret' ? '隐藏处' : n.kind === 'fork' ? '分岔口' : '大路'));
    }
    try {
      st.tripPlace = num(place);
      st.placeVisited = st.placeVisited || {};
      st.placeVisited[num(place)] = num(st.placeVisited[num(place)]) + 1;
      st.tripRoute = { region: w.region, regionName: REGION_NAME[w.region] || '', place: num(place), placeName: placeName(place),
                       km: w.km, budget: budget, detour: w.detour, secret: w.secret, grade: kind, pic: num(id),
                       flavor: env.flavor || (PLACE_META[num(place)] ? PLACE_META[num(place)][2] : ''),
                       path: w.path.slice(), names: names, food: env.lock ? 1 : 0, dir: env.dir || '' };
    } catch (e) {}
    log('路线: ' + names.join(' -> ') + ' (' + w.km + '/' + budget + 'km' + (w.detour ? ' 绕路' : '') + (w.secret ? ' 隐藏' : '') +
        ') 判定=' + kind + ' id=' + id);
    return { id: num(id), grade: kind, place: num(place), placeName: placeName(place), region: w.region,
             km: w.km, budget: budget, detour: w.detour, secret: w.secret, path: w.path.slice(), names: names,
             weights: wt, candidates: cands.length, flavor: env.flavor || '', seasonal: sid ? 1 : 0 };
  }

  if (typeof window.MOCK_PICK_PHOTO === 'function') {
    var orig = window.MOCK_PICK_PHOTO;
    window.MOCK_PICK_PHOTO = function (items) {
      try {
        var r = plan(items);
        if (r && r.id) return r.id;
      } catch (e) { log('路线判定失败, 回落到池子: ' + (e && e.message)); }
      return orig.apply(this, arguments);
    };
    log('已接管 MOCK_PICK_PHOTO: 先按路径判级, 失败再回落池子');
  }

  window.MOCK_ROUTE = {
    plan: plan,
    env: envInfo,
    budget: budgetFor,
    choosePlace: choosePlace,
    walk: walk,
    shortest: shortest,
    graph: function () { var g = graph(); return { nodes: Object.keys(g.nodes).length, edges: g.edges.length, region: REGION_NAME, place: PLACE_META }; },
    places: function () { return Object.keys(PLACE_META).map(function (k) { return { id: num(k), name: placeName(k), region: regionOfPlace(k), flavor: PLACE_META[k][2], km: PLACE_META[k][0] }; }); },
    foodPlace: FOOD_PLACE, foodFlavor: FOOD_FLAVOR, propDir: PROP_DIR,
    /* 离线自检: 跑 n 次看落点/分级分布, 并检查每张图都真有图层 */
    simulate: function (n, items) {
      n = num(n) || 200;
      var out = { n: n, grades: {}, regions: {}, places: {}, ids: {}, bad: [] }, i;
      for (i = 0; i < n; i++) {
        var r = plan(items);
        if (!r || !r.id) { out.bad.push('null'); continue; }
        out.grades[r.grade] = (out.grades[r.grade] || 0) + 1;
        out.regions[r.region] = (out.regions[r.region] || 0) + 1;
        out.places[r.placeName] = (out.places[r.placeName] || 0) + 1;
        out.ids[r.id] = (out.ids[r.id] || 0) + 1;
        if (!hasLayer(r.id)) out.bad.push(r.id);
      }
      out.layers = Object.keys(layerIds()).length;
      return out;
    },
    stats: function () {
      var b = picsByPlace(), n = 0, k;
      for (k in b) n += b[k].length;
      return { places: Object.keys(PLACE_META).length, placesWithPics: Object.keys(b).length, goalPics: n,
               nodes: Object.keys(graph().nodes).length, edges: graph().edges.length,
               last: st.tripRoute || null };
    }
  };
  var s = window.MOCK_ROUTE.stats();
  log('四区域图就绪: ' + s.nodes + ' 个节点 / ' + s.edges + ' 条边 / ' + s.places + ' 个目的地(' + s.placesWithPics + ' 个有景点照, 共 ' + s.goalPics + ' 张)');
})();
