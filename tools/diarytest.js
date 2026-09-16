/* diarytest: 呱呱日记(new/diary.js) —— 居家"写日记"不可打断 + 日记内容表 + 笔记页进"小仓库·笔记"
   客户端真实表: Note_json type=1(137 张, quality 1/2) = 呱呱的日记页; type=2(2000-2026) = 旅友笔记 */
const { BASE, ok, boot, fails } = require('./_harness.js');
const fs = require('fs');
const NOTES = JSON.parse(fs.readFileSync(BASE + '/tables/Note_json.json', 'utf8'));
const noteList = Object.keys(NOTES).map(k => NOTES[k]);
const noteById = {}; noteList.forEach(n => noteById[Number(n.id)] = n);
const ITEMS = JSON.parse(fs.readFileSync(BASE + '/tables/Item_json.json', 'utf8'));
const itemById = {}; ITEMS.forEach(i => itemById[Number(i.id)] = i);

boot({ stubs: g => {
  g.Tabikaeru.DataManager = { instance: () => ({
    ItemDB: { get: id => itemById[Number(id)] || null, list: () => ITEMS },
    TravelNoteDB: { get: id => noteById[Number(id)] || null, list: () => noteList }
  }) };
}});
const st = global.MOCK_STATE || (global.MOCK_STATE = {});
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async function () {
  const D = window.MOCK_DIARY, F = window.MOCK_FROGSTATE;
  ok(!!D && !!F, '日记层 + 居家层都装上了 (可用页 ' + (D && D.pages()) + ' 张)');
  const pages = noteList.filter(n => Number(n.type) === 1);
  ok(D.pages() === pages.length && pages.length >= 100, '日记页取自真实 Note 表 type=1: ' + D.pages() + ' 张');
  ok(D.texts().length >= 20, '日记内容表 ' + D.texts().length + ' 条');

  /* ---- 1. 写日记不可打断 ---- */
  st.frog = st.frog || {}; st.frog.status = 0; st.frog.crafting = 0; st.furniture = st.furniture || {};
  st.frog.motion = -1; st.frog.motionSince = 0;          /* 复位: 保证这次真的切进动作 2 */
  F.set(2);                                             /* 动作 2 = 写信/写日记 */
  const m = F.motion();
  ok(m.motion === 2, '动作切到 2 [' + m.label + ']');
  ok(m.hold >= 18 * 60 && m.hold <= 40 * 60, '写日记一次 18~40 分钟 [' + Math.round(m.hold / 60) + ' 分钟]');
  const before = JSON.stringify(st.bag || []), beforeDesk = JSON.stringify(st.desk || []);
  st.bag = [-1, -1]; st.desk = [101, 102];               /* 桌上有东西: 平时会被"收拾行囊"打断 */
  st.frog.motionSince = Math.floor(Date.now() / 1000) - 60;
  const d0 = D.list().length;
  F.tick();
  ok(F.motion().motion === 2, '写日记期间 tick 不会换动作 [' + F.motion().name + ']');
  ok(JSON.stringify(st.desk) === JSON.stringify([101, 102]), '写日记期间不收拾行囊(桌子没被清空)');
  ok(D.list().length === d0, '还没写完就先不落笔 [' + D.list().length + ']');

  /* ---- 2. 写完 -> 落一篇, 并挂到"小仓库·笔记" ---- */
  const held = F.motion().hold;
  st.frog.motionSince = Math.floor(Date.now() / 1000) - held - 10e3;
  const notesBefore = (st.notes || []).length;
  F.tick();
  const written = D.list();
  ok(written.length === d0 + 1, '到点自动写完一篇 [' + written.length + ']');
  ok((st.notes || []).length === notesBefore + 1, '日记页进了 note_list(小仓库·笔记) [' + st.notes.length + ']');
  const page = st.notes[st.notes.length - 1];
  ok(Number(page.read) === 0 && page.timestamp > 0, '新日记页未读(客户端 NEW_NOTE 红点会亮): ' + JSON.stringify(page));
  const row = noteById[Number(page.id)];
  ok(row && Number(row.type) === 1, '用的是 Note 表 type=1 的日记页 [id=' + page.id + ', quality=' + (row && row.quality) + ']');
  ok((window.MOCK_NOTE_IDS || []).indexOf(Number(page.id)) >= 0, '这张页有纹理 pic_' + page.id + '_png (客户端画得出来)');
  ok(F.motion().motion !== 2, '写完就换回其它居家动作 [' + F.motion().name + ']');
  ok((st.diary || []).length === d0 + 1, '收尾动作(写完这一篇)先于换动作/收拾行囊执行');

  /* ---- 3. 内容表按这一趟的路线挑条目 ---- */
  st.diary = []; st.notes = [];
  st.travelCount = 3; st.photos = [1, 2, 3]; st.season = 2;
  window.MOCK_ENV = window.MOCK_ENV || {};
  window.MOCK_ENV.weather = 3;                            /* 小雨 */
  st.tripRoute = { place: 4, placeName: '广州', region: 'south', km: 2100, budget: 3200, detour: 1, secret: 0, flavor: 'coastal', grade: 'goal', names: ['家', '南大路', '广州'] };
  st.placeVisited = { 4: 1 };
  const cand = D.pending();
  ok(cand.indexOf('detour') >= 0 && cand.indexOf('coastal') >= 0 && cand.indexOf('rainy') >= 0,
     '绕路/海边/雨天都进了候选: ' + JSON.stringify(cand.slice(0, 6)));
  const r1 = D.write('单测');                              /* 优先级最高的先写 */
  ok(r1 && r1.key === 'new_place', '优先写优先级最高的《' + (r1 && r1.title) + '》(' + (r1 && r1.key) + ')');
  const r2 = D.write('单测');
  ok(!!r2 && r2.key !== r1.key, '同一条不重复写: ' + (r2 && r2.key));
  ok(D.list().length === 2 && st.notes.length === 2, '两篇日记都在 note_list 里');

  /* ---- 4. 节日/节气 + 图鉴/称号联动 ---- */
  st.diary = []; st.notes = [];
  st.travelCount = 0; st.photos = []; st.placeVisited = {}; st.tripRoute = null; window.MOCK_ENV.weather = 1;
  ok(D.ctx().trips === 0, '上下文读到旅行次数');
  const firstList = D.pending();
  ok(firstList.indexOf('first_trip') >= 0, '第一次出门会写《第一次出门》');
  const rf = D.write('单测');
  ok(rf && rf.key === 'first_trip' && rf.tier === 2, '第一条就是精华页(quality 2) [' + rf.tier + ']');
  const pageRow = noteById[Number(rf.note)];
  ok(Number(pageRow.quality) === 2, 'tier 2 -> 客户端 quality=2 的页 [' + pageRow.quality + ']');
  st.achieveList = [1, 2]; st.clover = 300; st.guestLog = [1]; st.partyCount = 1;
  const pend2 = D.pending();
  ok(pend2.indexOf('title') >= 0 && pend2.indexOf('clover') >= 0 && pend2.indexOf('party') >= 0,
     '称号/三叶草/聚会 联动进候选: ' + JSON.stringify(pend2));

  /* ---- 5. 写满整张表也不崩, 且页不重复 ---- */
  st.diary = []; st.notes = [];
  const SCEN = [
    { trips: 0, photos: 0, w: 1, season: 2, route: null, visited: {}, hours: 1 },
    { trips: 3, photos: [1], w: 3, season: 3, hours: 0.8, route: { place: 4, placeName: '广州', flavor: 'coastal', detour: 0, secret: 0 }, visited: { 4: 1 } },
    { w: 4, route: { place: 21, placeName: '海南', flavor: 'coastal', detour: 1, secret: 0 } },
    { w: 8, season: 4, route: { place: 12, placeName: '哈尔滨', flavor: 'snow', detour: 0, secret: 1 } },
    { w: 1, season: 1, hours: 14, route: { place: 17, placeName: '酒泉', flavor: 'desert', detour: 0, secret: 0 } },
    { route: { place: 20, placeName: '上海', flavor: 'jiangnan', detour: 0, secret: 0 } },
    { route: { place: 103, placeName: '吴文化博物馆', flavor: 'museum', detour: 0, secret: 0 } },
    { route: { place: 1, placeName: '北京', flavor: 'city', detour: 0, secret: 0 } },
    { route: { place: 19, placeName: '拉萨', flavor: 'mountain', detour: 0, secret: 0 }, visited: { 1: 2, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 } },
    { visited: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1 } },
    { notes: [2000], achieveList: [1, 2], clover: 500, guestLog: [1], partyCount: 1, furnitureMade: 1, solar: 1, festival: true, rainCleared: true }
  ];
  let n = 0;
  for (const sc of SCEN) {
    st.travelCount = sc.trips !== undefined ? sc.trips : 5;
    st.photos = sc.photos !== undefined ? sc.photos : [1, 2, 3];
    window.MOCK_ENV.weather = sc.w || 1;
    window.MOCK_ENV.season = sc.season || 2;
    st.tripPlan = { hours: sc.hours !== undefined ? sc.hours : 6 };
    st.tripRoute = sc.route || null;
    st.placeVisited = sc.visited || {};
    st.notes = sc.notes ? [{ id: 2000, read: 1, timestamp: 1 }] : [];
    st.achieveList = sc.achieveList || []; st.clover = sc.clover || 0; st.guestLog = sc.guestLog || [];
    st.partyCount = sc.partyCount || 0; st.furnitureMade = sc.furnitureMade || 0;
    st.rainCleared = !!sc.rainCleared;
    window.MOCK_ENV.solar = sc.solar || 0;
    if (window.MOCK_ENV) window.MOCK_ENV.festival = !!sc.festival;
    for (let i = 0; i < 40; i++) { const r = D.write('批量'); if (!r) break; n++; }
  }
  const usedPages = st.notes.map(x => Number(x.id));
  ok(n === D.texts().length, '内容表的 ' + D.texts().length + ' 条在各种情境下全部能写完 [' + n + ']');
  ok(new Set(usedPages).size === usedPages.length, '同一张笔记页不会重复用 [' + usedPages.length + ' 篇]');
  ok(D.write('再写') === null, '写完之后再写返回 null(不重复堆)');

  /* ---- 6. 归来后会自动写这一趟 ---- */
  st.diary = []; st.notes = []; st.tripRoute = { place: 20, placeName: '上海', km: 1400, budget: 2000, detour: 0, secret: 0, flavor: 'jiangnan' };
  st.frog.status = 1;
  st.travelCount = 1;                                    /* 旅行次数 +1 = 归来过(比"盯状态跳变"更稳) */
  await sleep(2800 + 3400);
  ok(D.list().length >= 1, '回家后自动写了一篇 [' + JSON.stringify(D.list().map(x => x.title)) + ']');

  /* ---- 7. travel_load_note 把小仓库的笔记交给客户端 ---- */
  const resp = global.MOCK_SEMANTIC['travel_load_note']({});
  ok(resp && Array.isArray(resp.note_list) && resp.note_list.length === st.notes.length,
     'travel_load_note 返回 ' + (resp && resp.note_list && resp.note_list.length) + ' 篇(与存档一致)');
  ok(resp.note_list.every(x => noteById[Number(x.id)]), '每一篇 id 都能在 Note 表里查到(客户端才画得出来)');

  /* ---- 8. 没有 Note 表也不崩 ---- */
  const keep = global.Tabikaeru.DataManager;
  global.Tabikaeru.DataManager = { instance: () => { throw new Error('no db'); } };
  st.diaryPages = null;
  let crashed = 0, got = 0;
  try { st.diary = []; st.notes = []; if (D.write('无表')) got++; } catch (e) { crashed++; }
  global.Tabikaeru.DataManager = keep; st.diaryPages = null;
  ok(crashed === 0 && got === 1, '表缺失时用纹理表兜底, 不崩 (' + got + ')');

  console.log(fails() === 0 ? 'ALL DIARY CHECKS PASSED' : ('DIARY FAILED: ' + fails()));
  process.exit(fails() === 0 ? 0 : 1);
})();
