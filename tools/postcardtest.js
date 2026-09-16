/* postcardtest: 明信片池必须按类型/目的地/行李加权。
   以前 rules.js 从 60 个 id 均匀随机 -> 客户端表里 Goal(目的地照 151)/Unique(稀有 133) 覆盖率 0。 */
const { BASE, ok, boot, fails } = require('./_harness.js');
const fs = require('fs');

const PICS = JSON.parse(fs.readFileSync(BASE + '/tables/Picture_json.json', 'utf8'));
const ITEMS = JSON.parse(fs.readFileSync(BASE + '/tables/Item_json.json', 'utf8'));
const byId = {}; ITEMS.forEach(i => byId[Number(i.id)] = i);
const LAYERS = JSON.parse(/window\.MOCK_PICTURES = (\{.*?\});\n/s.exec(fs.readFileSync(BASE + '/new/pictures.js', 'utf8'))[1]);
const hasLayer = id => !!LAYERS[String(id)];

boot({ stubs: g => {
  g.Tabikaeru.DataManager = { instance: () => ({
    PictureDB: { list: () => PICS, get: id => PICS.filter(r => Number(r.id) === Number(id))[0] || null },
    ItemDB: { get: id => byId[Number(id)] || null, list: () => ITEMS }
  }) };
  g.Tabikaeru.getPicturePath = () => null;
}});
const st = global.MOCK_STATE || (global.MOCK_STATE = {});
st.kitV2 = st.kitV3 = st.kitV4 = st.kitV5 = st.kitGranted = 1;

const pick = window.MOCK_PICK_PHOTO;
ok(typeof pick === 'function', 'window.MOCK_PICK_PHOTO 装上了');
const stats = window.MOCK_PICTURE_STATS();
ok(stats.goal > 100, '池子里有目的地照 (' + stats.goal + ' 张 / ' + stats.places + ' 个地点)');
ok(stats.unique > 100, '池子里有稀有照 (' + stats.unique + ' 张)');

const typeOf = id => (PICS.filter(r => Number(r.id) === Number(id))[0] || {}).type;
const placeOf = id => Number((PICS.filter(r => Number(r.id) === Number(id))[0] || {}).place || 0);

/* --- 1) 不带护身符: 四类都要出现, 稀有率明显低于普通 --- */
const N = 3000, cnt = {}, bad = [];
for (let i = 0; i < N; i++) {
  const id = pick([]);
  const t = typeOf(id) || '?';
  cnt[t] = (cnt[t] || 0) + 1;
  if (!hasLayer(id)) bad.push(id);
}
ok(bad.length === 0, '抽出来的 id 全都有图层 (客户端 loadPicture 才不会崩) [' + bad.slice(0, 3).join(',') + ']');
ok((cnt['Normal'] || 0) > 0 && (cnt['Tools'] || 0) > 0, '普通/道具照都会掉 [' + JSON.stringify(cnt) + ']');
ok((cnt['Goal'] || 0) > 100, '目的地照会掉 (以前 0 张) [' + (cnt['Goal'] || 0) + '/' + N + ']');
ok((cnt['Unique'] || 0) > 20, '稀有照会掉 (以前 0 张) [' + (cnt['Unique'] || 0) + '/' + N + ']');
ok((cnt['Unique'] || 0) / N < 0.20, '不带护身符时稀有率 <20% [' + Math.round((cnt['Unique'] || 0) / N * 100) + '%]');
ok((cnt['Normal'] || 0) > (cnt['Unique'] || 0), '普通比稀有常见');

/* --- 2) 带 4 件护身符: 稀有率必须显著提高 --- */
const amulets = [1000, 1000, 1300, 1301];
let rare2 = 0;
const cnt2 = {};
for (let i = 0; i < N; i++) {
  const id = pick(amulets);
  const t = typeOf(id) || '?';
  cnt2[t] = (cnt2[t] || 0) + 1;
  if (t === 'Unique') rare2++;
}
const base = (cnt['Unique'] || 0) / N, withAm = rare2 / N;
ok(withAm > base + 0.08, '带 4 件护身符稀有率提高 (' + Math.round(base * 100) + '% -> ' + Math.round(withAm * 100) + '%)');
ok(hasLayer(pick(amulets)), '带护身符抽的也有图层');

/* --- 3) 目的地照必须与 st.tripPlace 一致 --- */
let mismatch = 0, goals = 0;
for (let i = 0; i < 500; i++) {
  const id = pick([]);
  if (typeOf(id) === 'Goal') { goals++; if (placeOf(id) !== Number(st.tripPlace)) mismatch++; }
}
ok(goals > 0 && mismatch === 0, '目的地照的 place 与 st.tripPlace 一致 (抽到 ' + goals + ' 张, 不一致 ' + mismatch + ')');
ok(Number(st.tripPlace) > 0, 'st.tripPlace 记下了本次目的地 [' + st.tripPlace + ']');

/* --- 4) comeBack() 真的用了这个池子 --- */
const S = global.MOCK_SEMANTIC, M = global.MockServer;
st.photos = []; st.nextPhoto = 1; st.notes = []; st.gifts = []; st.clover = 0; st.ticket = 0; st.house = [];
st.lastTripItems = [];
st.frog = { status: 1, traveling: true, returnAt: Date.now() - 1000, nextNote: 0 };
S['item_load_items'] = S['item_load_items'] || function () { return {}; };
setTimeout(function () {
  const last = st.photos[st.photos.length - 1];
  ok(!!last && hasLayer(last.pic_id), '归来发的明信片来自池子且有图层 [' + (last && last.pic_id) + ']');
  console.log(fails() === 0 ? 'ALL POSTCARD CHECKS PASSED' : (fails() + ' CHECK(S) FAILED'));
  process.exit(fails() === 0 ? 0 : 1);
}, 5200);
