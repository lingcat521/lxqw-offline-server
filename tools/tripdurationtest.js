/* tripdurationtest: 用户报「青蛙的旅行时间过于频繁」，原版行为是
     · 单次 6~72 小时, 最长可到 4 天; 由**携带的食物与道具**决定
     · 便宜食物(四叶草/华夫饼)1~2 小时就回家; 高级食物/帐篷之类明显更长, 甚至在外面过夜
   我们以前固定 90 秒(后来 3~7 分钟)一趟, 一天能来回几十次 —— 这就是"过于频繁"。
   现在 new/travel2.js 按玩家真正装进行李的东西算(Item 表的 type/price):
     食物(type0) price<=20 ->1.5h, <=40 ->2.5h, <=60 ->6h, <=90 ->9h, 更高 ->14h
     道具(type2) 每件 +3h; 护身符(type1) 每枚 +1.5h; 再乘 0.85~1.35 抖动, 夹在 0.5~72h
   st.travelSeconds 仍是显式覆盖(GM trip/settime 会写它), 而且**不再黏住**下一趟。 */
const { BASE, ok, boot, fails } = require('./_harness.js');
const fs = require('fs');

const ITEMS = JSON.parse(fs.readFileSync(BASE + '/tables/Item_json.json', 'utf8'));
const byId = {}; ITEMS.forEach(i => byId[Number(i.id)] = i);

boot({ stubs: g => {
  g.Tabikaeru.DataManager = { instance: () => ({ ItemDB: { get: id => byId[Number(id)] || null, list: () => ITEMS } }) };
}});
const st = global.MOCK_STATE || (global.MOCK_STATE = {});
const M = global.MockServer;
const H = s => Math.round(s / 360) / 10;          /* 秒 -> 小时(一位小数) */

function depart(bag, desk, note) {
  st.frog = { status: 1, motion: 1, traveling: false, returnAt: 0 };
  st.bag = bag; st.desk = desk || [-1, -1, -1, -1, -1, -1, -1, -1];
  M.handle('item_set_bag_completed', { completed: true }); window.MOCK_FORCE_DEPART();
  return Number(st.tripSeconds);
}

(async function () {
  st.kitV2 = st.kitV3 = st.kitV4 = st.kitV5 = st.kitGranted = 1;
  st.party = { started: 0, guest: -1, ends: 0 };
  delete st.travelSeconds; delete st.travelMin; delete st.travelMax;

  /* --- 1) 便宜食物: 1~2 小时 --- */
  let s1 = depart([0, -1, -1, -1]);
  ok(s1 >= 4000 && s1 <= 7400, '只带华夫饼(price 10) -> ' + H(s1) + ' 小时 (原版: 1~2 小时)');

  /* --- 2) 中级食物: 6 小时量级 --- */
  let s2 = depart([2, -1, -1, -1]);
  ok(s2 >= 18000 && s2 <= 30000, '带沙拉皮塔饼(price 50) -> ' + H(s2) + ' 小时');
  ok(s2 > s1 * 2, '好吃的食物走得更远 (' + H(s1) + 'h -> ' + H(s2) + 'h)');

  /* --- 3) 道具叠加 --- */
  let s3 = depart([2, 2000, -1, -1]);              /* 皮塔饼 + 竹筒(道具 type2) */
  ok(s3 > s2, '加一件道具(竹筒)时间变长 (' + H(s2) + 'h -> ' + H(s3) + 'h)');

  /* --- 4) 高级食物 + 多件道具 -> 十几小时, 会过夜 --- */
  let s4 = depart([4, 2000, 2003, 2009]);
  ok(s4 >= 10 * 3600, '香葱烤包子 + 3 件道具 -> ' + H(s4) + ' 小时 (在外面过夜)');
  ok(s4 > s3, '配置越好时间越长');

  /* --- 5) 没带吃的: 出门晃一圈就回 --- */
  let s5 = depart([-1, 2000, -1, -1]);
  ok(s5 <= 2600, '没带食物 -> ' + H(s5) + ' 小时就回家');

  /* --- 6) 上限 72 小时 --- */
  let many = [4, 2000, 2001, 2002];                 /* 4 格背包 */
  let desk = [-1, -1, -1, -1, -1, -1, -1, -1];
  let s6 = depart(many, desk);
  ok(s6 <= 72 * 3600, '再豪华也不会超过 72 小时 [' + H(s6) + 'h]');
  ok(s6 >= 6 * 3600, '豪华配置至少 6 小时 [' + H(s6) + 'h]');

  /* --- 7) 不是一次算完就黏住: 第二趟按新的行李重算 --- */
  let a = depart([0, -1, -1, -1]);
  let b = depart([4, 2000, -1, -1]);
  ok(b > a * 2, '下一趟按新行李重新算 (' + H(a) + 'h -> ' + H(b) + 'h), 不是沿用上一趟');

  /* --- 8) 显式覆盖(GM trip / 老存档)优先, 且不黏住 --- */
  st.travelSeconds = 600;
  let c = depart([4, 2000, -1, -1]);
  ok(c === 600, 'st.travelSeconds=600 时按它走 [' + c + ']');
  ok(Number(st.travelSeconds) === 600, '覆盖值本身不被改写(留给下一趟继续用)');
  delete st.travelSeconds;
  let d = depart([0, -1, -1, -1]);
  ok(d !== 600 && d > 1000, '清掉覆盖后回到按行李算 [' + H(d) + 'h]');

  /* --- 9) 老存档的 travelMin/travelMax 仍然尊重 --- */
  st.travelMin = 100; st.travelMax = 200;
  let e = depart([0, -1, -1, -1]);
  ok(e >= 100 && e <= 200, '存档里写了 travelMin/travelMax 就用区间 [' + e + 's]');
  delete st.travelMin; delete st.travelMax;

  /* --- 10) 行程计划有据可查 --- */
  depart([2, 2000, 2000, -1]);
  ok(st.tripPlan && st.tripPlan.food === 1 && st.tripPlan.props === 2 && st.tripPlan.bestFood === 50,
     'st.tripPlan 记录了这一趟的食物/道具/最高价 [' + JSON.stringify(st.tripPlan) + ']');

  /* --- 11) 天气×道具(用户表): 雪天+辣葱饼 -10% / 雨天+纸伞 +25% (各取 5 次平均, 抵掉抖动) --- */
  function avgDur(w, bag, n) {
    let sum = 0;
    for (let i2 = 0; i2 < (n || 5); i2++) {
      if (window.MOCK_ENV) window.MOCK_ENV.weather = w;
      sum += depart(bag.slice());
    }
    return sum / (n || 5);
  }
  const sunnyW = avgDur(1, [2, 4, -1, -1]);
  const snowSpicy = avgDur(9, [2, 4, -1, -1]);
  const rainPlain = avgDur(3, [2, -1, -1, -1]);
  const rainUmbrella = avgDur(3, [2, 2003, -1, -1]);
  ok(snowSpicy < sunnyW * 0.98, '雪天带辣葱饼: 归期更短 (' + H(sunnyW) + 'h -> ' + H(snowSpicy) + 'h)');
  ok(rainUmbrella > rainPlain * 1.02, '雨天带纸伞: 走得更远 (' + H(rainPlain) + 'h -> ' + H(rainUmbrella) + 'h)');
  ok(Number(st.tripWeatherFx && st.tripWeatherFx.umbrella) === 1, '行程里记下带了纸伞 [tripWeatherFx=' + JSON.stringify(st.tripWeatherFx) + ']');
  if (window.MOCK_ENV) window.MOCK_ENV.weather = 1;

  console.log(fails() === 0 ? 'ALL TRIP-DURATION CHECKS PASSED' : (fails() + ' CHECK(S) FAILED'));
  process.exit(fails() === 0 ? 0 : 1);
})();
