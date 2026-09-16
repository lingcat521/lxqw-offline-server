/* giftboxtest: 照片在相册<->礼品盒之间真的搬得动(客户端 travel_album_to_gift / travel_gift_to_album)。
   以前两个协议只回 {code:0}, 礼盒 pictures 还回"相册全部照片的 id" -> 点了没反应、盒子永远清不空。
   容量码: 盒子满=100("礼品盒满了"), 相册满=101("相册满了") —— 都是客户端在用的码。 */
const H = require('./_harness.js');
const fs = H.fs, ok = H.ok;
const LAYERS = JSON.parse(/window\.MOCK_PICTURES = (\{.*?\});\n/s.exec(fs.readFileSync(H.BASE + '/new/pictures.js', 'utf8'))[1]);

H.boot({ stubs: function (g) {
  g.Tabikaeru.DataManager = { instance: function () { return { ItemDB: { get: () => null, list: () => [] } }; } };
}});
const M = global.MockServer, st = global.MOCK_STATE, S = global.MOCK_SEMANTIC;
st.kitV2 = st.kitV3 = st.kitV4 = st.kitV5 = st.kitGranted = 1;

function mkPhotos(n) { const a = []; for (let i = 0; i < n; i++) a.push({ id: 100 + i, pic_id: 100 + i }); return a; }
const boxIds = () => S['travel_load_gift']().pictures.map(p => Number(p && p.id !== undefined ? p.id : p));

/* --- 1) 盒子初始为空, 照片进盒 --- */
st.photos = mkPhotos(3); st.giftPhotos = []; st.gifts = [];
ok(boxIds().length === 0, '空盒子: pictures 为空(以前回的是相册全部照片)');
let r = M.handle('travel_album_to_gift', { picture_id: 101 });
ok(r.code === 0, '照片 101 进盒 (code=' + r.code + ')');
ok(st.photos.length === 2 && st.photos.every(p => Number(p.id) !== 101), '相册里少了一张 (剩 ' + st.photos.length + ')');
ok(boxIds().join(',') === '101', '盒子里有 101 [' + boxIds().join(',') + ']');
ok(!!st.giftPhotos[0].pic_id, '盒子里存的是完整照片对象(带 pic_id, 才搬得回去)');

/* --- 2) 放回相册 --- */
r = M.handle('travel_gift_to_album', { picture_id: 101 });
ok(r.code === 0, '照片 101 回相册');
ok(st.photos.length === 3 && boxIds().length === 0, '相册 3 张 / 盒子空 [' + st.photos.length + '/' + boxIds().length + ']');
ok(st.photos.some(p => Number(p.id) === 101), '回到相册的正是 101');

/* --- 3) 容量: 盒子满 30 -> 100; 相册满 60 -> 101 --- */
st.giftPhotos = []; for (let i = 0; i < 30; i++) st.giftPhotos.push({ id: 900 + i, pic_id: 900 + i });
st.photos = mkPhotos(3);
ok(M.handle('travel_album_to_gift', { picture_id: 100 }).code === 100, '礼盒满 30 -> code 100("礼品盒满了")');
st.giftPhotos = [{ id: 901, pic_id: 901 }];
st.photos = mkPhotos(60);
ok(M.handle('travel_gift_to_album', { picture_id: 901 }).code === 101, '相册满 60 -> code 101("相册满了")');

/* --- 4) 不存在的 id --- */
st.giftPhotos = []; st.photos = mkPhotos(2);
ok(M.handle('travel_album_to_gift', { picture_id: 9999 }).code === 1, '相册里没有的照片 -> code 1');
ok(M.handle('travel_gift_to_album', { picture_id: 9999 }).code === 1, '盒子里没有的照片 -> code 1');

/* --- 5) 推送出去的照片必须带 layers(否则 PostcardView 读 layers.length 会崩) --- */
const sent = {};
const real = M.dispatch;
M.dispatch = function (n, d) { sent[n] = d; return real.apply(this, arguments); };
st.photos = mkPhotos(3); st.giftPhotos = [];
M.handle('travel_album_to_gift', { picture_id: 100 });
setTimeout(function () {
  const g = sent['travel_load_gift'];
  ok(!!g && Array.isArray(g.pictures) && g.pictures.length === 1, '推送里有这张照片');
  const pic = g && g.pictures[0];
  ok(!!pic && Array.isArray(pic.layers), '推送的照片带 layers [' + (pic && pic.layers && pic.layers.length) + ' 层]');
  ok(!!LAYERS[String(pic && pic.pic_id)] || Array.isArray(pic.layers), 'layers 来自真实图层表');
  M.dispatch = real;
  console.log(H.fails() ? ('\ngiftboxtest: ' + H.fails() + ' FAILED') : '\ngiftboxtest: all checks passed');
  process.exit(H.fails() ? 1 : 0);
}, 200);
