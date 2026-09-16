/* friendbooktest: 友情绘本/旅友笔记(new/friendbook.js) —— friendship_books 表 + 聚会结算解锁 + 金色边框稀有
   用户给的机制: 访客离开(独立概率 15~30%) -> 邀请卡 -> 赴约 -> 聚会归来带回绘本; 社区配方(果汁+纸鹤+去对地方)。 */
const { BASE, ok, boot, fails } = require('./_harness.js');
const fs = require('fs');
const ITEMS = JSON.parse(fs.readFileSync(BASE + '/tables/Item_json.json', 'utf8'));
const NOTES = JSON.parse(fs.readFileSync(BASE + '/tables/Note_json.json', 'utf8'));
const PAGES = JSON.parse(fs.readFileSync(BASE + '/tables/drawingPageData_json.json', 'utf8'));
const itemById = {}; ITEMS.forEach(i => itemById[Number(i.id)] = i);
const noteById = {}; Object.keys(NOTES).forEach(k => noteById[Number(k)] = NOTES[k]);
const pageRows = Object.keys(PAGES).map(k => PAGES[k]);
boot({ stubs: g => {
  g.Tabikaeru.DataManager = { instance: () => ({
    ItemDB: { get: id => itemById[Number(id)] || null, list: () => ITEMS },
    TravelNoteDB: { get: id => noteById[Number(id)] || null, list: () => Object.keys(NOTES).map(k => NOTES[k]) },
    DrawingPage: { list: () => pageRows }, drawingPageDB: { list: () => pageRows }
  }) };
}});
const st = global.MOCK_STATE || (global.MOCK_STATE = {});

(async function () {
  const F = window.MOCK_FRIEND_BOOK;
  ok(!!F, '友情绘本层装上了 MOCK_FRIEND_BOOK');
  const t = F.table();
  ok(t.length >= 12, 'friendship_books 表 ' + t.length + ' 条');
  ok(t.every(x => x.id && x.friend_name && x.title && x.content && x.rarity && x.unlock_condition),
     '每条都有用户要求的字段 id/friend_name/title/content/rarity/unlock_condition');
  ok(t.every(x => ['normal', 'rare'].indexOf(x.rarity) >= 0), '稀有度只有 normal/rare [' + t.filter(x => x.rarity === 'rare').length + ' 条稀有(金色边框)]');
  ok(JSON.stringify(t) === JSON.stringify(JSON.parse(JSON.stringify(t))), '整表可 JSON 序列化');

  /* ---- 社区配方: 果汁 + 纸鹤 + 去对地方 ---- */
  const cases = [
    { book: 1, region: 'north', items: [13, 1010], why: '壁虎猫咪: 北方 + 甜椒汁 + 蓝纸鹤' },
    { book: 2, region: 'west', items: [11, 1008], why: '刺猬蚂蚁: 西南 + 菠萝汁 + 白纸鹤' },
    { book: 3, region: 'east', items: [12, 1007], why: '萤火虫玉米: 东方 + 草莓汁 + 绿纸鹤' },
    { book: 4, region: 'south', place: 24, items: [11, 1009], why: '刺猬迷路: 南2(福建) + 菠萝汁 + 红纸鹤' }
  ];
  let bad = [];
  cases.forEach(c => {
    st.friendBooks = []; st.notes = []; st.stories = [];
    st.tripRoute = { place: c.place || 0, region: c.region, flavor: '', km: 1000, budget: 2000 };
    st.lastTripItems = c.items; st.bag = []; st.desk = [];
    for (let i = 0; i < 60 && !F.unlocked().length; i++) F.match({ kind: 'travel', items: c.items });
    if (F.unlocked().indexOf(c.book) < 0) bad.push(c.why + ' -> ' + JSON.stringify(F.unlocked()));
  });
  ok(bad.length === 0, '四条社区配方都能匹配到对应绘本' + (bad.length ? ' | 不符: ' + bad.join(' ; ') : ''));

  /* ---- 条件不对就不给 ---- */
  st.friendBooks = []; st.notes = [];
  st.tripRoute = { place: 0, region: 'south', flavor: '' }; st.lastTripItems = [13, 1010];
  let no = 0;
  for (let i = 0; i < 40; i++) no += F.match({ kind: 'travel', items: [13, 1010] });
  ok(no === 0, '方向不对(拿北方的配方去南方)不匹配 [' + no + ']');
  st.tripRoute = { place: 0, region: 'north', flavor: '' }; st.lastTripItems = [13];
  no = 0;
  for (let i = 0; i < 40; i++) no += F.match({ kind: 'travel', items: [13] });
  ok(no === 0, '少带一样(只有甜椒汁没纸鹤)也不匹配 [' + no + ']');   /* items_all: 每一样都要带 */

  /* ---- 解锁真的发到客户端: travel_load_note 里出现那篇笔记 ---- */
  st.friendBooks = []; st.notes = [];
  st.tripRoute = { place: 0, region: 'north', flavor: '' }; st.lastTripItems = [13, 1010];
  let got = 0;
  for (let i = 0; i < 60 && !got; i++) got = F.match({ kind: 'travel', items: [13, 1010] });
  ok(got === 1, '北方配方解锁了一条 [' + got + ']');
  const resp = global.MOCK_SEMANTIC['travel_load_note']({});
  ok(resp.note_list.some(n => Number(n.id) === 2000), '笔记 2000 进了 travel_load_note(客户端笔记栏/礼品盒)');
  ok(resp.note_list.every(n => noteById[Number(n.id)]), '每篇 id 都在 Note 表里(画得出来)');
  const rare = F.table().filter(x => x.id === 1)[0];
  ok(rare.rarity === 'rare', '社区配方那几条是稀有(金色边框) [' + rare.title + ']');

  /* ---- 聚会结算给绘纸页 ---- */
  st.friendBooks = []; st.drawing = { state: 0, guest: -1, bag: [-1,-1,-1,-1], pages: [], colls: [], showColl: 0, penMotion: 0 };
  st.party = { started: 0, guest: 1, ends: 0 }; st.partyCount = 0;
  const before = (st.drawing.pages || []).length;
  ok(typeof window.MOCK_PARTY.finish === 'function', 'party.finish 已挂钩');
  window.MOCK_PARTY.finish('单测');
  for (let i = 0; i < 40 && (st.drawing.pages || []).length === before; i++) {
    st.party = { started: 0, guest: 1, ends: 0 };
    window.MOCK_PARTY.finish('单测');
  }
  ok((st.drawing.pages || []).length > before, '聚会归来解锁了绘纸页 [' + JSON.stringify(st.drawing.pages) + ']');
  ok(st.drawing.pages.every(p => pageRows.some(r => Number(r.id) === Number(p))), '绘纸页 id 都在 drawingPageData 表里(客户端画得出来)');
  ok(F.unlocked().some(id => id === 21 || id === 23), '刺猬那本进账 [' + JSON.stringify(F.unlocked()) + ']');

  /* ---- 稀有(金色边框): 要求手信 + 概率 15% ---- */
  const b23 = F.table().filter(x => x.id === 23)[0];
  ok(b23.rarity === 'rare' && b23.unlock_condition.drop === 0.15 && b23.unlock_condition.party === 3,
     '金色那页要求 party>=3 且 15% [' + JSON.stringify(b23.unlock_condition) + ']');
  st.friendBooks = []; st.drawing = { state: 0, guest: 1, bag: [-1,-1,-1,-1], pages: [], colls: [], showColl: 0, penMotion: 0 };
  st.party = { started: 0, guest: 1, ends: 0 };
  let hit = 0;
  for (let i = 0; i < 200; i++) { const g = F.unlock(23, '样本'); if (g) hit++; st.friendBooks = []; }
  ok(hit > 0, '手动解锁稀有那页能成功 [' + hit + '/200]');
  const noItem = F.condMet(b23.unlock_condition, { kind: 'party', guest: 1, party: 3, items: [1, 2] });
  const withItem = F.condMet(b23.unlock_condition, { kind: 'party', guest: 1, party: 3, items: [3000] });
  ok(noItem === false && withItem === true, '稀有页要求带对道具(手信) [' + noItem + '/' + withItem + ']');

  /* ---- 表缺失不崩 ---- */
  const keep = global.Tabikaeru.DataManager;
  global.Tabikaeru.DataManager = { instance: () => { throw new Error('no db'); } };
  st.friendBooks = []; st.drawing = { pages: [], colls: [] };
  let crashed = 0;
  try { F.unlock(20, '无表'); } catch (e) { crashed++; }
  global.Tabikaeru.DataManager = keep;
  ok(crashed === 0, '没有客户端表时不崩(绘纸页拿不到就只记解锁)');

  console.log(fails() === 0 ? 'ALL FRIEND-BOOK CHECKS PASSED' : ('FRIEND-BOOK FAILED: ' + fails()));
  process.exit(fails() === 0 ? 0 : 1);
})();
