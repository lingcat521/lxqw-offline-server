/* solarfurntest: ⑤ 节气照片(四动物同框) + 限定家具档期   ⑦ 家具风格与材料总量校验
   new/solarphoto.js / new/furnstyle.js + new/furniture.js(档期) + new/furnituremake.js(材料校验) */
const { BASE, ok, boot, fails } = require('./_harness.js');
const fs = require('fs');
const ITEMS = JSON.parse(fs.readFileSync(BASE + '/tables/Item_json.json', 'utf8'));
const FUR = JSON.parse(fs.readFileSync(BASE + '/tables/furnitureData_json.json', 'utf8'));
const PICS = JSON.parse(fs.readFileSync(BASE + '/tables/Picture_json.json', 'utf8'));
const TAGS = JSON.parse(fs.readFileSync(BASE + '/tables/PictureTag_json.json', 'utf8'));
const COMMON = JSON.parse(fs.readFileSync(BASE + '/tables/furnitureCommon_json.json', 'utf8'));
const SHOP = JSON.parse(fs.readFileSync(BASE + '/tables/furnitureShopData_json.json', 'utf8'));
const itemById = {}; ITEMS.forEach(i => itemById[Number(i.id)] = i);
const furRows = Array.isArray(FUR) ? FUR : Object.keys(FUR).map(k => FUR[k]);
const shopRows = Array.isArray(SHOP) ? SHOP : Object.keys(SHOP).map(k => SHOP[k]);
const commonRows = Object.keys(COMMON).map(k => ({ id: Number(k), value: COMMON[k].value }));

boot({ stubs: g => {
  g.Tabikaeru.DataManager = { instance: () => ({
    ItemDB: { get: id => itemById[Number(id)] || null, list: () => ITEMS },
    PictureDB: { list: () => PICS },
    PictureTagDB: { list: () => TAGS },
    FurnitureDB: { list: () => furRows },
    FurnitureShopDB: { list: () => shopRows },
    furnitureCommonDB: { list: () => commonRows }
  }) };
}});
const st = global.MOCK_STATE || (global.MOCK_STATE = {});
const env = () => (window.MOCK_ENV = window.MOCK_ENV || {});

(async function () {
  const SP = window.MOCK_SOLARPHOTO, FS = window.MOCK_FURNSTYLE, S = global.MOCK_SEMANTIC;
  const LAYERS = window.MOCK_PICTURES || {};
  ok(!!SP && !!FS, '节气照层 + 家具风格层都装上了');

  /* ---------- ⑤-a 节气食物: 每月两种, 都在 Item 表里且是食物 ---------- */
  const months = SP.months();
  ok(Object.keys(months).length === 12, '12 个月都有节气食物 [' + Object.keys(months).length + ']');
  let badFood = 0, total = 0;
  Object.keys(months).forEach(m => months[m].forEach(id => { total++; const r = itemById[id]; if (!r || Number(r.type) !== 0) badFood++; }));
  ok(total === 24 && badFood === 0, '24 种节气食物都在 Item 表且是食物(type 0) [' + total + '/' + badFood + ']');
  const shopFoods = shopRows.filter(r => Number(r.price) === 375).map(r => Number(r.item_id));
  ok(shopFoods.length >= 20 && Object.keys(months).every(m => months[m].every(id => shopFoods.indexOf(id) >= 0)),
     '每月节气食物都能在嘟嘟那儿 375 草买到 [' + shopFoods.length + ' 件 375 草]');

  /* ---------- ⑤-b 节气照: 四动物同框 = u_month/u_two_month ---------- */
  const p8 = SP.picFor(8, 0), p8b = SP.picFor(8, 1);
  ok(p8.tag === 'u_month8' && p8b.tag === 'u_two_month8', '按月份解析标签: ' + p8.tag + ' / ' + p8b.tag);
  ok(LAYERS[String(p8.id)] && LAYERS[String(p8.id)], '两个标签都指向真有图层的照片 [' + p8.id + '/' + p8b.id + ']');
  let tagBad = 0, tagAll = 0;
  for (let m = 1; m <= 12; m++) {
    [0, 1].forEach(two => {
      tagAll++;
      const p = SP.picFor(m, two);
      const row = PICS.filter(x => Number(x.id) === p.id)[0];
      const tag = TAGS.filter(t => (t.picNames || []).indexOf(String(row && row.name)) >= 0)[0];
      if (!row || !tag || tag.Tag !== p.tag) tagBad++;
    });
  }
  ok(tagBad === 0, '12 个月 × 当月/双月 = ' + tagAll + ' 张节气照都与 PictureTag 对得上 (不符 ' + tagBad + ')');
  ok(p8.id >= 3048 && p8.id <= 3059 && p8b.id >= 3068 && p8b.id <= 3179, '节气照落在 Unique 段的月照区间 [' + p8.id + '/' + p8b.id + ']');

  /* ---------- ⑤-c 判定: 带当月节气食物才容易出 ---------- */
  env().month = 8; st.travelPlan = { hours: 8 };
  ok(SP.month() === 8 && SP.term().indexOf('立秋') === 0, '月份可注入(测试用): ' + SP.month() + ' 月 ' + SP.term());
  ok(SP.hasFood([27, 3], 8) && !SP.hasFood([26], 8), '只有当月的节气食物算数 [8月: 27/42]');
  env().solar = 0;
  ok(SP.pick([3], { chance: 1 }) === null, '没带节气食物也不是节气日 -> 不出节气照');
  let got = 0;
  for (let i = 0; i < 40; i++) { const id = SP.pick([27, 3], { chance: 1 }); if (id && LAYERS[String(id)]) got++; }
  ok(got === 40, '带上当月节气食物 -> 一定拿到节气照且都有图层 [' + got + '/40]');
  let ok2 = 0;
  env().solar = 1;
  for (let i = 0; i < 40; i++) { const id = SP.pick([3], { chance: 1 }); if (id) ok2++; }
  env().solar = 0;
  ok(ok2 === 40, '今天是节气(没带节气食物)也能出 [' + ok2 + '/40]');
  ok(SP.last() && SP.last().month === 8, '落盘最近一张节气照: ' + JSON.stringify(SP.last()));

  /* ---------- ⑤-d 接到明信片链路上(postroute) ---------- */
  const R = window.MOCK_ROUTE;
  let season = 0;
  for (let i = 0; i < 60; i++) { const r = R.plan([27, 101, 3]); if (r.grade === 'seasonal') season++; }
  ok(season > 0, '节气照会作为明信片判级 seasonal 出现 [' + season + '/60]');
  let grad = {};
  for (let i = 0; i < 60; i++) { const r = R.plan([101, 3]); grad[r.grade] = (grad[r.grade] || 0) + 1; }
  ok(!grad.seasonal, '不带节气食物时不会硬塞节气照 [' + JSON.stringify(grad) + ']');

  /* ---------- ⑦-a 8 种特殊材料 ---------- */
  const mats = FS.materials();
  ok(mats.length === 8, '特殊材料正好 8 种 [' + mats.join(',') + ']');
  ok(mats.every(m => itemById[m] && Number(itemById[m].type) === 11), '8 件都是 type 11 特殊材料');
  const shopMats = shopRows.filter(r => Number(r.price) === 200).map(r => Number(r.item_id));
  ok(mats.every(m => shopMats.indexOf(m) >= 0), '8 件都能在嘟嘟那儿买到(200 草)');

  /* ---------- ⑦-b 一套室内 27 个 ---------- */
  const v = FS.validate();
  ok(v.base.length === 11, '11 个基础风格都在表里 [' + v.base.length + ']');
  ok(v.full === 11 && v.ok, '每个基础风格都是 27 件、种类 1..27 各一件 [' + FS.summary() + ']');
  const s6 = v.styles.filter(x => x.style === 6)[0];
  ok(s6.count === 29 && s6.dup.join(',') === '12,26', '博古风格 27 + 古琴 2 件(书桌 12/衣柜 26 各多一个选择) = ' + s6.count + ' [重复种类 ' + s6.dup.join(',') + ']');
  const t27 = FS.total(1);
  ok(t27.items === 27 && t27.special === 27 && t27.normal === 27, '一套室内 27 件 = 27 特殊材料 + 27 普通材料 [' + JSON.stringify(t27) + ']');
  ok(v.problems.length === 0, '总量校验没有缺种类的问题 [' + v.problems.join(';') + ']');

  /* ---------- ⑦-c 材料决定风格 ---------- */
  ok(FS.stylesOf(10105).indexOf(6) >= 0 && FS.styleName(6).indexOf('博古') === 0, '紫檀木(10105) -> ' + FS.styleName(6));
  ok(FS.materialFor(5) === 10104 && FS.styleName(5).indexOf('海洋') === 0, '海洋风格用海螺贝(10104)');
  const guqin = furRows.filter(r => Number(r.id) === 1531)[0];
  ok(FS.styleOfFur(guqin) === 6 && FS.materialOfFur(guqin) === 10105, '古琴书桌是博古风格, 要紫檀木 [' + guqin.name + ']');
  ok(FS.canMake(guqin, [10105]).ok === true, '紫檀木 -> 做得出古琴书桌');
  const no = FS.canMake(guqin, [10101]);
  ok(no.ok === false && no.why.indexOf('做不出') > 0, '岩纹石 -> 做不出博古风格 [' + no.why + ']');
  const any = FS.canMake(guqin, []);
  ok(any.ok === true, '台面没放特殊材料时不拦(保持旧行为)');

  /* ---------- ⑤-e 限定家具档期(8-10 月森之国度 / 11-12 月古琴展) ---------- */
  const MORI = [10313, 10315, 10323];                    /* 森之国度: 小鱼干/小鱼冻/猫猫帽 */
  const GUQIN = [10312, 10326];                          /* 古琴展: 书桌·古琴/衣柜·古琴 */
  const draws = furRows.filter(r => [10017, 10018, 10019, 1531, 1532].indexOf(Number(r.id)) >= 0).map(r => Number(r.drawing));
  ok(new Set(draws).size === 5 && MORI.concat(GUQIN).every(d => draws.indexOf(d) >= 0), '5 件限定家具各有图纸 [' + draws.join(',') + ']');
  ok(draws.every(d => shopRows.some(r => Number(r.item_id) === d)), '5 张限定图纸都真的在图纸商店表里');
  const f = (st.furniture = st.furniture || {});
  f.bought = []; f.has_fur = [];
  function shopItems() {
    const r = S['furniture_load_furniture']() || {};
    return ((r.shop || {}).shop_list || []).map(x => Number(x.item_id));
  }
  const RealDate = Date;
  function atMonth(m, day) {
    const d = new RealDate(2026, m - 1, day, 20, 0, 0);
    global.Date = function (...a) { return a.length ? new RealDate(...a) : new RealDate(d.getTime()); };
    global.Date.now = () => d.getTime();
    global.Date.prototype = RealDate.prototype;
  }
  atMonth(9, 10); st.merchantVisit = null;
  const sep = shopItems();
  ok(MORI.every(d => sep.indexOf(d) >= 0), '9 月: 森之国度 3 张图纸在架 [' + sep.filter(x => MORI.indexOf(x) >= 0).join(',') + ']');
  ok(!GUQIN.some(d => sep.indexOf(d) >= 0), '9 月: 古琴图纸不在架');
  atMonth(12, 5); st.merchantVisit = null;
  const dec = shopItems();
  ok(GUQIN.every(d => dec.indexOf(d) >= 0), '12 月: 古琴 2 张图纸在架 [' + dec.filter(x => GUQIN.indexOf(x) >= 0).join(',') + ']');
  ok(!MORI.some(d => dec.indexOf(d) >= 0), '12 月: 森之国度图纸不在架');
  atMonth(3, 5); st.merchantVisit = null;
  const mar = shopItems();
  ok(!draws.some(d => mar.indexOf(d) >= 0), '3 月: 两套限定图纸都下架');
  global.Date = RealDate;

  console.log(fails() === 0 ? 'ALL SOLAR-FURN CHECKS PASSED' : ('SOLAR-FURN FAILED: ' + fails()));
  process.exit(fails() === 0 ? 0 : 1);
})();
