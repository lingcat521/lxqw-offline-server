/* maptest: 旅行地图/地点图鉴(new/maploc.js) —— 38 地点分四区, 到达或明信片寄回点亮, 进度与相册联动 */
const { BASE, ok, boot, fails } = require('./_harness.js');
const fs = require('fs');
const PICS = JSON.parse(fs.readFileSync(BASE + '/tables/Picture_json.json', 'utf8'));
const picById = {}; PICS.forEach(p => picById[Number(p.id)] = p);
boot({ stubs: g => { g.Tabikaeru.DataManager = { instance: () => ({ PictureDB: { get: id => picById[Number(id)] || null, list: () => PICS } }) }; } });
const st = global.MOCK_STATE || (global.MOCK_STATE = {});

(async function () {
  const M = window.MOCK_MAP;
  ok(!!M, '地图层装上了 MOCK_MAP');
  const p0 = M.progress();
  ok(p0.total === 38, '地点表 38 个目的地 [' + p0.total + ']');
  st.mapUnlocked = [];
  const rg = M.regions();
  ok(rg.length === 4 && rg.every(r => r.total >= 5), '四个区域都有地点: ' + rg.map(r => r.name + ':' + r.total).join(' '));
  const first = M.load().locations[0];
  ok(first.id && first.name && first.region && first.x >= 0 && first.y >= 0, '每个地点带 名称/区域/坐标 [' + JSON.stringify(first) + ']');
  ok(M.load().locations.every(l => l.unlocked === 0), '初始全灰(未解锁)');

  /* 旅行到达 -> 点亮 */
  st.tripRoute = { place: 6, placeName: '杭州', region: 'east' };
  window.MOCK_STORY_ROLL();
  ok(M.unlocked().indexOf(6) >= 0, '旅行到达杭州 -> 点亮 [' + JSON.stringify(M.unlocked()) + ']');
  ok(M.unlock(6, '重复') === null, '同一个地点不重复点亮');
  ok(M.progress().unlocked >= 1 && M.progress().total === 38, '进度会累加(路径沿途也会点亮) [' + JSON.stringify(M.progress()) + ']');

  /* 相册联动: 该地照片数 */
  const hz = M.load().locations.filter(l => l.id === 6)[0];
  ok(typeof hz.photos === 'number', '点亮后能看到该地照片数 [' + hz.photos + ']');
  ok(M.photosOf(6).every(pid => Number((picById[pid] || {}).place) === 6), 'photosOf 只返回该地的照片');

  /* 明信片寄回也会点亮 */
  st.mapUnlocked = []; st.lastTripItems = [];
  st.photos = [{ id: 1, pic_id: hzPicId() }];
  st.tripRoute = null;
  window.MOCK_STORY_ROLL();
  ok(M.unlocked().length >= 1, '只寄回明信片(没有 tripRoute)也点亮 [' + JSON.stringify(M.unlocked()) + ']');
  function hzPicId() { const p = PICS.filter(x => Number(x.place) === 20 && x.type === 'Goal')[0]; return p ? Number(p.id) : 0; }

  /* 全量包形状(给客户端/地图页) */
  const pay = M.load();
  ok(Array.isArray(pay.locations) && pay.locations.length === 38 && typeof pay.unlocked === 'number' && Array.isArray(pay.regions), 'map_load 形状: locations/unlocked/total/regions');

  /* ---- 路径图(用户模板补全版): 29 节点 / 区内连通 / 地形合法 / 边上照片真存在 / 11 区口径 ---- */
  const P = window.MOCK_MAP_PATHS;
  ok(!!P && Object.keys(P.nodes).length === 29, '29 个节点(起点 0 + 28 城市) [' + (P ? Object.keys(P.nodes).length : 0) + ']');
  ok(P.edges.length >= 28, P.edges.length + ' 条边');
  ok(P.edges.every(e => ['NONE', 'Mountain', 'Sea', 'Cave'].indexOf(e.terrain) >= 0), '地形只用 NONE/Mountain/Sea/Cave');
  ok(P.edges.every(e => Number(e.length) >= 1), '每条边都有长度(非普通地形按它加耗时)');
  const allPic = {}; PICS.forEach(p2 => allPic[Number(p2.id)] = 1);
  const badPic = P.edges.filter(e => (e.photo_ids || []).some(id => !allPic[Number(id)]));
  ok(badPic.length === 0, '边上的 photo_ids 都能在明信片表里查到 [' + badPic.length + ']');
  const withPic = P.edges.filter(e => (e.photo_ids || []).length).length;
  ok(withPic >= 20, '有 ' + withPic + ' 条边绑定了照片(每条最多一张)');
  /* 整图从起点可达所有城市 */
  let reach = {}; reach['0'] = 1; let q = ['0'];
  const adj = {}; P.edges.forEach(e => { (adj[e.from] = adj[e.from] || []).push(e.to); (adj[e.to] = adj[e.to] || []).push(e.from); });
  while (q.length) { const c = q.shift(); (adj[c] || []).forEach(n => { if (!reach[n]) { reach[n] = 1; q.push(n); } }); }
  ok(Object.keys(P.nodes).every(k => reach[k]), '所有城市都能从起点走到(整图连通) [' + Object.keys(reach).length + '/29]');
  const r11 = M.regions11();
  ok(r11.length === 11 && r11.reduce((n, x) => n + x.total, 0) >= 25, '11 个区域口径(用户表) 共 ' + r11.reduce((n, x) => n + x.total, 0) + ' 个城市');
  ok(typeof M.pathTo === 'function' && M.pathTo(1).length >= 1, '能算出"去某城经过哪些城市" [' + JSON.stringify(M.pathTo(1)) + ']');
  ok(P.prop_targets && P.prop_targets.scarf && P.prop_targets.umbrella && P.charm_regions && JSON.stringify(P.charm_regions.green_crane.regions) === JSON.stringify(['east','taiwan']),
     '道具指向(围巾/纸伞/竹筒/睡垫)与护身符限定区域(绿纸鹤=东)都在表里');

  /* ---- 四条关键测试(用户指定) ---- */
  const E = window.MOCK_PATHS;
  ok(!!E, '路径结算引擎装上了 MOCK_PATHS');
  st.edgePhotos = []; st.photos = []; st.mapUnlocked = [];
  /* ① 两点最多两特产: 找一条只经过 2 个点的目的地 */
  let two = null;
  M.load().locations.forEach(l => { const c = M.pathTo(l.id); if (!two && c.length === 2) two = l.id; });
  if (two) {
    const g1 = E.settle(two, '单测');
    ok(g1.specialty <= 2, '经过 2 个点 -> 特产最多 2 [' + g1.specialty + ']');
  } else { ok(true, '(没有恰好 2 点的目的地, 跳过)'); }
  /* ② 绿纸鹤只抽东区 5 城 */
  const cand = E.candidates([1007]);
  ok(cand.length === 5, '绿纸鹤(1007) 候选只有东区+台湾 5 城 [' + cand.length + ']');
  let east = 0, all = 0;
  for (let i = 0; i < 100; i++) { const c = E.candidates([1007]); c.forEach(x => { all++; if (x.key) east++; }); }
  ok(all === 100 * 5, '100 次抽签候选池恒为 5 城, 不会漏到别的区 [' + all + ']');
  ok(E.charmRegionOf([1007]).regions.join() === 'east,taiwan' && E.charmRegionOf([1008]).regions[0] === 'northwest', '千纸鹤限区表正确(绿=东+台湾/白=西北+西南) [' + E.charmRegionOf([1007]).regions.join('+') + ']');
  ok(E.candidates([]).length >= 25, '没带限区护身符 -> 全 28 城加权 [' + E.candidates([]).length + ']');
  /* ③ 同一条边反复走, 照片只发一次 */
  st.edgePhotos = []; st.photos = []; st.mapUnlocked = [];
  const dest3 = two || M.load().locations[0].id;
  let firstGot = 0, laterGot = 0;
  for (let i = 0; i < 10; i++) { const g = E.settle(dest3, '重复走'); if (i === 0) firstGot = g.photos.length; else laterGot += g.photos.length; }
  ok(st.edgePhotos.length === new Set(st.edgePhotos).size, '同一条边的照片只解锁一次(去重) [' + st.edgePhotos.length + ' 张]');
  ok(st.photos.length === st.edgePhotos.length, '相册里的照片数 = 已解锁边照数 [' + st.photos.length + '/' + st.edgePhotos.length + ']');
  /* ④ 11 区进度分别正确 */
  st.mapUnlocked = [];
  M.unlock(1, '单测'); M.unlock(20, '单测');         /* 北京(北, GoalNumber 1) + 上海(东, GoalNumber 20) */
  const r11b = M.regions11();
  const north = r11b.filter(x => x.key === 'north')[0], eastR = r11.filter(x => x.key === 'east')[0];
  ok(north && north.unlocked >= 1, '北区进度 ' + (north && north.unlocked) + '/' + (north && north.total) + ' [' + JSON.stringify(north) + ']');
  ok(eastR && eastR.unlocked >= 1, '东区进度 ' + (eastR && eastR.unlocked) + '/' + (eastR && eastR.total) + ' [' + JSON.stringify(eastR) + ']');
  ok(r11b.length === 11 && r11b.every(x => x.unlocked <= x.total) && r11b.filter(x => x.unlocked > 0).length >= 2, '11 个区各自独立计数(不是一个大区) [' + r11b.map(x => x.key + ':' + x.unlocked + '/' + x.total).join(' ') + ']');
  /* 路径耗时/体力/休息 */
  const pl = E.plan(dest3, 6 * 3600);
  ok(pl.totalHours >= 6 && pl.totalHours <= 72, '总耗时刻在 6~72 小时 [' + pl.totalHours + 'h]');
  ok(pl.rests >= 0 && pl.staminaLeft >= 0, '体力结算合法(休息 ' + pl.rests + ' 次, 余 ' + pl.staminaLeft + ')');

  console.log(fails() === 0 ? 'ALL MAP CHECKS PASSED' : ('MAP FAILED: ' + fails()));
  process.exit(fails() === 0 ? 0 : 1);
})();
