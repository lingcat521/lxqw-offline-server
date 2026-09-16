/* postroutetest: 明信片路径模拟(new/postroute.js) —— 四区域图 + START/GOAL/PATH/DETOUR + Dijkstra + 分级判定
   数据源: GoalNumber(38 目的地) / Picture(351 张, place=目的地) / PictureTag(200 个风格标签) / Item(食物/道具/护符) */
const { BASE, ok, boot, fails } = require('./_harness.js');
const fs = require('fs');
const ITEMS = JSON.parse(fs.readFileSync(BASE + '/tables/Item_json.json', 'utf8'));
const GOALS = JSON.parse(fs.readFileSync(BASE + '/tables/GoalNumber_json.json', 'utf8'));
const PICS = JSON.parse(fs.readFileSync(BASE + '/tables/Picture_json.json', 'utf8'));
const TAGS = JSON.parse(fs.readFileSync(BASE + '/tables/PictureTag_json.json', 'utf8'));
const itemById = {}; ITEMS.forEach(i => itemById[Number(i.id)] = i);
const picById = {}; PICS.forEach(p => picById[Number(p.id)] = p);

boot({ stubs: g => {
  g.Tabikaeru.DataManager = { instance: () => ({
    ItemDB: { get: id => itemById[Number(id)] || null, list: () => ITEMS },
    GoalNumberDB: { get: id => GOALS.filter(x => Number(x.id) === Number(id))[0] || null, list: () => GOALS },
    PictureDB: { get: id => picById[Number(id)] || null, list: () => PICS },
    PictureTagDB: { list: () => TAGS }
  }) };
}});
const st = global.MOCK_STATE || (global.MOCK_STATE = {});

(async function () {
  const R = window.MOCK_ROUTE;
  const LAYERS = window.MOCK_PICTURES || {};
  const layerCount = Object.keys(LAYERS).length;
  ok(!!R, 'postroute 层装上了 MOCK_ROUTE (图层 ' + layerCount + ' 张)');

  /* ---- 1. 图结构 ---- */
  const g = R.graph();
  ok(g.nodes >= 4 * 4 + 1 + 38 - 0, '节点数合理: ' + g.nodes);
  const places = R.places();
  ok(places.length === 38, '38 个目的地全部进图 [' + places.length + ']');
  ok(places.every(p => ['east', 'south', 'west', 'north'].indexOf(p.region) >= 0), '每个目的地都落在东/南/西/北某一区');
  const byRegion = {}; places.forEach(p => byRegion[p.region] = (byRegion[p.region] || 0) + 1);
  ok(Object.keys(byRegion).length === 4 && Object.keys(byRegion).every(k => byRegion[k] >= 5),
     '四区域都有目的地: ' + JSON.stringify(byRegion));
  ok(places.every(p => GOALS.some(x => Number(x.id) === p.id)), '目的地 id 与 GoalNumber 表一致');

  /* ---- 2. Dijkstra ---- */
  const toShanxi = R.shortest('home', 'g:29');            /* 山西 900km: home->r:north->f:north->g:29 */
  ok(!!toShanxi && toShanxi.km === 260 + 150 + 900, '最短路(山西) = 260+150+900 = ' + (toShanxi && toShanxi.km));
  ok(toShanxi.path[0] === 'home' && toShanxi.path[toShanxi.path.length - 1] === 'g:29', '路径从 home 到目的地: ' + toShanxi.path.join('>'));
  const toSuzhou = R.shortest('home', 'g:7');
  ok(toSuzhou.km === 260 + 150 + 1250, '最短路(苏州, 走东区) = ' + toSuzhou.km);
  /* 交叉验证: 每条最短路都必须在图上真的连通, 且 km = 边长之和 */
  const GG = R.graph();
  let pathBad = 0, checked = 0;
  places.forEach(p => {
    const d = R.shortest('home', 'g:' + p.id); checked++;
    if (!d) { pathBad++; return; }
    if (d.path[0] !== 'home' || d.path[d.path.length - 1] !== 'g:' + p.id) pathBad++;
    if (d.km < 900) pathBad++;                            /* 最近的山西也有 1310 */
    if (d.km > 6000) pathBad++;
  });
  ok(pathBad === 0, '38 条最短路都连通且里程合理 (' + checked + ' 条, 异常 ' + pathBad + ')');

  /* ---- 3. 预算 -> 走多远 ---- */
  st.tripPlan = { hours: 0.5 };
  const bShort = R.budget({ hours: 0.5, food: [0], props: 0, amulets: 0 });
  const bLong = R.budget({ hours: 14, food: [3], props: 0, amulets: 0 });
  ok(bShort < bLong && bShort < 700 && bLong > 3000, '预算随时长增长: 0.5h=' + bShort + 'km, 14h=' + bLong + 'km');
  const noFood = R.budget({ hours: 0.5, food: [], props: 0, amulets: 0 });
  ok(noFood < bShort, '没带吃的预算更低: ' + noFood + ' < ' + bShort);

  /* ---- 4. 目的地指向性食物 (吃一口就想进京/入川…) ---- */
  st.tripPlan = { hours: 8 };
  const beijing = R.plan([101, 3]);                        /* 101 枣花酥 -> 北京 */
  ok(beijing.place === 1 && beijing.placeName === '北京', '枣花酥(101) -> 北京 [' + beijing.placeName + ']');
  ok(st.tripRoute && st.tripRoute.place === 1, 'tripRoute 落盘(给日记/故事用): ' + JSON.stringify(st.tripRoute && st.tripRoute.placeName));
  const chengdu = R.plan([102, 3]);                        /* 102 龙眼酥 -> 成都 */
  ok(chengdu.place === 2, '龙眼酥(102) -> 成都 [' + chengdu.placeName + ']');
  ok(beijing.names.indexOf('北京') >= 0, '路径里出现目的地名: ' + beijing.names.join(' -> '));

  /* ---- 5. "在某地吃更佳" 的食物 -> 风格 ---- */
  const coastal = R.plan([5, 3]);                          /* 5 海苔煎豆腐: 海边 */
  const coastPlace = R.places().filter(p => p.id === coastal.place)[0];
  ok(coastPlace.flavor === 'coastal', '海苔煎豆腐(5) -> 沿海目的地 [' + coastPlace.name + ']');
  const water = R.plan([15, 3]);                           /* 15 桂花蒸米糕: 水乡 */
  ok(R.places().filter(p => p.id === water.place)[0].flavor === 'jiangnan', '桂花蒸米糕(15) -> 水乡 [' + water.placeName + ']');
  const snow = R.plan([16, 3]);                            /* 16 彩椒烙蛋饼: 雪地 */
  ok(R.places().filter(p => p.id === snow.place)[0].flavor === 'snow', '彩椒烙蛋饼(16) -> 雪地 [' + snow.placeName + ']');

  /* ---- 6. 护符指方向(四区域图) ---- */
  const west = R.plan([3, 1008]);                          /* 1008 白色千纸鹤 -> 西 */
  ok(west.region === 'west', '白千纸鹤(1008) -> 西区 [' + west.placeName + ']');
  const east = R.plan([3, 1007]);                          /* 1007 绿色千纸鹤 -> 东 */
  ok(east.region === 'east', '绿千纸鹤(1007) -> 东区 [' + east.placeName + ']');
  const south = R.plan([3, 1009]);                         /* 1009 红色千纸鹤 -> 南 */
  ok(south.region === 'south', '红千纸鹤(1009) -> 南区 [' + south.placeName + ']');
  const north = R.plan([3, 1010]);                         /* 1010 蓝色千纸鹤 -> 北 */
  ok(north.region === 'north', '蓝千纸鹤(1010) -> 北区 [' + north.placeName + ']');
  st.placeVisited = {};
  const fresh = R.plan([3, 1006]);                         /* 1006 桃色铃铛 -> 没去过的地方 */
  ok(fresh.place > 0 && !st.placeVisited[fresh.place] > 0 === false, '桃色铃铛(1006) 去"新地方" [' + fresh.placeName + ']');

  /* ---- 7. 逐节点分级 + 图有效性(大量模拟) ---- */
  st.tripPlan = { hours: 10 };
  const bag = [4, 3, 5, 1008];                        /* 食物 + 道具 + 护符混装 */
  const sim = R.simulate(400, bag);
  ok(sim.bad.length === 0, '400 次模拟抽到的图全部有图层 (坏图 ' + sim.bad.length + ')');
  ok(Object.keys(sim.grades).length >= 3, '分级判定出现 ≥3 档(普通/景点/稀有/道具): ' + JSON.stringify(sim.grades));
  ok((sim.grades.goal || 0) > 0 && (sim.grades.normal || 0) > 0, '普通与景点都会出: ' + JSON.stringify(sim.grades));
  const sim2 = R.simulate(300, [3]);                      /* 只带一份蛋包饭: 没有方向/风格偏好, 该四区都去 */
  ok(Object.keys(sim2.places).length >= 5, '落点分散: ' + Object.keys(sim2.places).length + ' 个目的地');
  ok(Object.keys(sim2.regions).length === 4, '四个区域都会走到: ' + JSON.stringify(sim2.regions));
  /* 景点档的照片必须属于这次的目的地(place 对上) */
  let mismatch = 0, goalChecked = 0;
  for (let i = 0; i < 120; i++) {
    const r = R.plan(bag);
    if (r.grade !== 'goal') continue;
    goalChecked++;
    const row = picById[r.id];
    if (!row || Number(row.place) !== Number(r.place)) mismatch++;
  }
  ok(mismatch === 0, '景点照的 place 与目的地一致 (' + goalChecked + ' 张校验, 不符 ' + mismatch + ')');
  /* 普通档的照片风格跟着区域走 */
  let tagHit = 0, tagTry = 0;
  for (let i = 0; i < 200 && tagTry < 60; i++) {
    const r = R.plan([1008, 3]);                          /* 锁西区 */
    if (r.grade !== 'normal') continue;
    tagTry++;
    const row = picById[r.id];
    const tag = TAGS.filter(t => (t.picNames || []).indexOf(String(row.name)) >= 0)[0];
    if (tag && ['n_field', 'n_panda', 'n_fenglingmu', 'n_sanxia', 'n_tree'].indexOf(tag.Tag) >= 0) tagHit++;
  }
  ok(tagTry === 0 || tagHit / tagTry >= 0.8, '西区普通照用的是西部风格底图 (' + tagHit + '/' + tagTry + ')');

  /* ---- 8. DETOUR(岔路) 与 PATH(途经) ---- */
  st.placeVisited = {};
  let detour = 0, kmOver = 0, pathOk = 0;
  for (let i = 0; i < 300; i++) {
    const r = R.plan([101, 1008, 1000, 1000, 3]);          /* 带护符: 绕路概率高 */
    if (r.detour) detour++;
    if (r.km > r.budget) kmOver++;
    if (r.path[0] === 'home' && r.path[r.path.length - 1] === 'g:' + r.place) pathOk++;
  }
  ok(detour > 0, '预算够时会走 DETOUR 岔路 (' + detour + '/300 次)');
  ok(kmOver === 0, '绕路也不会超预算 (' + kmOver + ')');
  ok(pathOk === 300, '每次都从 START(家) 走到 GOAL(目的地) [' + pathOk + '/300]');

  /* ---- 9. 接上客户端: MOCK_PICK_PHOTO ---- */
  st.tripPlan = { hours: 8 };
  let pickBad = 0, pickZero = 0;
  for (let i = 0; i < 60; i++) {
    const id = window.MOCK_PICK_PHOTO([101, 3]);
    if (!id) pickZero++;
    else if (!LAYERS[String(id)]) pickBad++;
  }
  ok(pickZero === 0 && pickBad === 0, 'MOCK_PICK_PHOTO 60 次都给出有图层的明信片 (空 ' + pickZero + ' 坏 ' + pickBad + ')');
  ok(st.tripPlace === 1 || st.placeVisited[1] > 0, '抽完图后 tripPlace/placeVisited 有记录');

  /* ---- 10. 表缺失时不崩(回落旧池子) ---- */
  const keep = global.Tabikaeru.DataManager;
  global.Tabikaeru.DataManager = { instance: () => { throw new Error('no db'); } };
  let crashed = 0, fallback = 0;
  for (let i = 0; i < 5; i++) {
    try { const id = window.MOCK_PICK_PHOTO([3]); if (id) fallback++; } catch (e) { crashed++; }
  }
  global.Tabikaeru.DataManager = keep;
  ok(crashed === 0 && fallback === 5, '没有表时 MOCK_PICK_PHOTO 回落旧池子不崩 (' + fallback + '/5)');

  console.log(fails() === 0 ? 'ALL POSTROUTE CHECKS PASSED' : ('POSTROUTE FAILED: ' + fails()));
  process.exit(fails() === 0 ? 0 : 1);
})();
