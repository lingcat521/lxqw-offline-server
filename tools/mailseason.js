/* mailseason: 三件小功能一起测
   1) 邮件过期: 客户端 revice_mails/notify_new_mail 里 expire>0 且过期 -> 自动拆信领奖,
      服务端以前 normMail 恒 expire=0, 两边都不记账 -> 现在服务端要镜像入账;
   2) 相册分页: album_load(start,count) 客户端按 pictureInfoList[start+n-1] 填绝对下标;
   3) 特殊刷新: 春节正丹纸(10102)/年末织彩带(10108) 必须按 calendar.js 的真实日历上下架。 */
const H = require('./_harness.js');
const fs = H.fs, BASE = H.BASE, ok = H.ok;
const SHOP = JSON.parse(fs.readFileSync(BASE + '/tables/furnitureShopData_json.json', 'utf8'));
const ITEMS = JSON.parse(fs.readFileSync(BASE + '/tables/Item_json.json', 'utf8'));
const byId = {}; ITEMS.forEach(i => byId[Number(i.id)] = i);
const shopRows = Object.keys(SHOP).map(k => SHOP[k]);

H.boot({ stubs: function (g) {
  g.Tabikaeru.DataManager = { instance: function () { return {
    ItemDB: { get: id => byId[Number(id)] || null, list: () => ITEMS },
    FurnitureShopDB: { get: id => SHOP[String(id)] || null, list: () => shopRows },
    FurnitureDB: { get: () => null, list: () => [] }
  }; } };
}});
const M = global.MockServer, st = global.MOCK_STATE, S = global.MOCK_SEMANTIC;
st.kitV2 = st.kitV3 = st.kitV4 = st.kitV5 = st.kitGranted = 1;
const cnt = id => (st.house || []).filter(x => Number(x.item_id) === Number(id)).reduce((a, b) => a + Number(b.count || 0), 0);

/* --- 1) 邮件过期 --- */
st.mailTaken = []; st.mailRead = []; st.extraMails = []; st.clover = 0; st.ticket = 0; st.house = [];
const past = Math.floor(Date.now() / 1000) - 60;
st.extraMails.push(window.MOCK_NORMALIZE_MAIL({
  id: 5001, title: '过期的补偿', type: 1, read: 0, opened: 0,
  resource: { clover_point: 123, ticket: 2, ads_id: '' }, items: [{ item_id: 1000, count: 1 }],
  sender: -1, expire: past, auto_open: false
}));
st.extraMails.push(window.MOCK_NORMALIZE_MAIL({
  id: 5002, title: '还没过期', type: 1, read: 0, opened: 0,
  resource: { clover_point: 999, ticket: 0, ads_id: '' }, items: [], sender: -1,
  expire: Math.floor(Date.now() / 1000) + 3600, auto_open: false
}));
ok(window.MOCK_NORMALIZE_MAIL({ id: 1, expire: past }).expire === past, 'normMail 保留 expire(不再统一归零)');
const list = M.handle('mail_load', {});
ok(list.filter(m => m.id === 5001).length === 0, '过期邮件从列表消失(已入账)');
ok(list.filter(m => m.id === 5002).length === 1, '没过期的邮件还在');
ok(Number(st.clover) === 123, '过期邮件的三叶草已入账 [' + st.clover + ']');
ok(Number(st.ticket) === 2, '过期邮件的抽奖券已入账 [' + st.ticket + ']');
ok(cnt(1000) === 1, '过期邮件的附件进仓库 (1000 x' + cnt(1000) + ')');
ok(window.MOCK_MAIL_SWEEP('test') === 0, '再扫一遍没有可入账的(幂等)');
ok(Number(st.clover) === 123, '幂等: 三叶草没被重复加');

/* 新邮件默认 7 天后过期 */
const nid = window.MOCK_ADD_MAIL({ title: '默认过期', resource: { clover_point: 1, ticket: 0, ads_id: '' } });
const added = st.extraMails.filter(m => Number(m.id) === nid)[0];
ok(added && Number(added.expire) > Math.floor(Date.now() / 1000), 'MOCK_ADD_MAIL 默认带未来过期时间 [' + (added && added.expire) + ']');

/* --- 2) 相册分页 --- */
st.photos = []; for (let i = 0; i < 25; i++) st.photos.push({ id: i + 1, pic_id: 100 + i });
let pg = M.handle('album_load', { start: 6, count: 5 });
ok(pg.start === 6 && pg.total === 25, 'album_load 回正确的 start/total [' + pg.start + '/' + pg.total + ']');
ok(pg.pictures.length === 5 && Number(pg.pictures[0].id) === 6 && Number(pg.pictures[4].id) === 10,
   '返回第 6..10 张 [' + pg.pictures.map(p => p.id).join(',') + ']');
pg = M.handle('album_load', { start: 24, count: 10 });
ok(pg.pictures.length === 2, '越界分页只回剩下的 2 张');

/* --- 3) 特殊刷新(季节限定) --- */
  /* 嘟嘟新作息(用户表): 每天 14~19 点到访一次 —— 测试里把"本次到访"设成已开始, 否则 start_time=0(不在城) */
  st.merchantVisit = { day: (function(){var d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();})(), start: Math.floor(Date.now()/1000) - 60 };
  st.shopDay = undefined;

function shopList() { return S['furniture_load_furniture']().shop.shop_list; }
function hasItem(list, id) { return list.some(r => Number(r.item_id) === Number(id)); }
st.furniture = { bench: [], has_fur: [], put_fur: [], box: [], bought: [] };
st.clover = 99999;
/* 9 月(现在): 春节/年末都关 -> 10102/10108 都不该上架 */
ok(!hasItem(shopList(), 10102), '9 月(春节未到)不上架正丹纸 10102');
ok(!hasItem(shopList(), 10108), '9 月(年末未到)不上架织彩带 10108');
/* 用 calendar.json force 模拟春节 -> 正丹纸上架 */
window.MOCK_CALENDAR.cfg.force = ['springcard'];
ok(hasItem(shopList(), 10102), '春节窗口: 正丹纸 10102 上架');
ok(!hasItem(shopList(), 10108), '春节不开织彩带');
window.MOCK_CALENDAR.cfg.force = ['greetcard'];
ok(hasItem(shopList(), 10108), '年末窗口: 织彩带 10108 上架');
ok(!hasItem(shopList(), 10102), '年末不上正丹纸');
const row = shopList().filter(r => Number(r.item_id) === 10108)[0];
ok(row && Number(row.num) >= 1, '季节限定有库存 num [' + (row && row.num) + ']');
/* 买了就售罄(和普通商品一致) */
M.handle('furniture_buy_shop', { shop_id: row.shop_id });
ok(cnt(10108) === 1, '织彩带真进仓库 [' + cnt(10108) + ']');
ok(Number(shopList().filter(r => Number(r.item_id) === 10108)[0].num) === 0, '买过之后 num=0(售罄)');
window.MOCK_CALENDAR.cfg.force = [];

console.log(H.fails() ? ('\nmailseason: ' + H.fails() + ' FAILED') : '\nmailseason: all checks passed');
process.exit(H.fails() ? 1 : 0);
