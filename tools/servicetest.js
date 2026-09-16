/* servicetest: 商店每日刷新 / 兑换码 / 旅友投喂 三项新增行为的回归 */
const H = require('./_harness.js');
const ok = H.ok;
H.boot();
const M = global.MockServer;
const st = () => window.MOCK_STATE;

(async function () {
  /* --- 嘟嘟商店: 跨天刷新限购 --- */
  st().purchased = [{ item_id: 3, count: 1 }];
  st().shopDay = '2000-1-1';
  const s1 = M.handle('item_load_shop_info', {});
  ok(Array.isArray(s1.purchased) && s1.purchased.length === 0, 'crossing a day clears 限购 (purchased 清空)');
  st().purchased = [{ item_id: 3, count: 1 }];
  const s2 = M.handle('item_load_shop_info', {});
  ok(s2.purchased.length === 1, 'same day keeps 限购记录');
  const s3 = M.handle('shop_refresh', {});
  ok(s3.code === 0 && st().purchased.length === 0, 'shop_refresh 立即清空限购');

  /* --- item_buy: purchased 的键必须是**商店行 id**(客户端 purchasedMap[sid]), 且服务端也要限购 --- */
  (function () {
    const fs = require('fs');
    const SHOP = JSON.parse(fs.readFileSync(H.BASE + '/tables/shopData_json.json', 'utf8'));
    const rows = {}; SHOP.forEach(r => rows[Number(r.id)] = r);
    global.Tabikaeru = global.Tabikaeru || {};
    global.Tabikaeru.DataManager = { instance: () => ({ ShopDataDB: { get: id => rows[Number(id)] || null }, ItemDB: { get: () => ({ type: 1, spend: 1, own_num: 0 }) } }) };
    M.handle('shop_refresh', {});          /* 先把 shopDay 设成"今天"(键格式由服务端决定), 否则读取时会被当成跨天清空 */
    st().purchased = []; st().clover = 100000; st().house = [];
    /* 找一条 limit>0 的商品 */
    let limRow = SHOP.filter(r => Number(r.limit) > 0)[0];
    ok(!!limRow, 'shopData 里有限购商品 (limit>0) [id=' + (limRow && limRow.id) + ' limit=' + (limRow && limRow.limit) + ']');
    const sid = Number(limRow.id);
    const r1 = M.handle('item_buy', { shop_id: sid });
    ok(r1.code === 0, '第一次买成功 (code=' + r1.code + ')');
    ok(st().purchased.length === 1 && Number(st().purchased[0].item_id) === sid,
       'purchased 记的是商店行 id ' + sid + ' 而不是物品 id [' + JSON.stringify(st().purchased[0]) + ']');
    const info = M.handle('item_load_shop_info', {});
    ok(Number(info.purchased[0].item_id) === sid, 'item_load_shop_info 下发的键也是商店行 id');
    let over = null;
    for (let i = 0; i < Number(limRow.limit) + 1; i++) over = M.handle('item_buy', { shop_id: sid });
    ok(over.code !== 0, '超过 limit 后服务端拒绝 (code=' + over.code + ')');
    ok(st().purchased.filter(x => Number(x.item_id) === sid).reduce((a, b) => a + Number(b.count || 0), 0) === Number(limRow.limit),
       '限购次数正好等于 limit (' + limRow.limit + ')');
  })();

  /* --- 兑换码: 幂等 --- */
  ok(M.handle('item_use_gift_code', {}).code === 1, 'empty code is rejected (code 1)');
  const c0 = Number(st().clover), t0 = Number(st().ticket);
  /* 客户端 CdkeyView: if(200==e.code) 才显示"礼包码兑换成功" —— 成功必须回 200 */
  /* 现在的兑换码是**固定码表**(new/cdkey.js, 每码每人一次), 不再"任何串都能兑";
     用官方 API 造一个已知奖励的码, 验证奖励发放 + 幂等 + 未知码拒绝 */
  ok(!!(window.MOCK_CDKEY && MOCK_CDKEY.add), 'MOCK_CDKEY.add 可用(私服加码入口)');
  MOCK_CDKEY.add('TEST-CODE-1', { clover: 100, items: [{ id: 1000, count: 1 }] });
  const r1 = M.handle('item_use_gift_code', { code: 'TEST-CODE-1' });
  ok(r1.code === 200, 'a fresh code redeems (code 200) [' + JSON.stringify(r1).slice(0, 60) + ']');
  ok(Number(st().clover) === c0 + 100, '奖励三叶草 +100 (' + c0 + ' -> ' + st().clover + ')');
  const houseHas = () => (st().house || []).filter(h => Number(h.item_id) === 1000).reduce((a, h) => a + Number(h.count || 0), 0);
  ok(houseHas() >= 1, '奖励道具进了物品栏 (id 1000 x' + houseHas() + ')');
  ok(M.handle('item_use_gift_code', { code: 'TEST-CODE-1' }).code === 2, 'the same code cannot be reused (code 2)');
  ok(M.handle('item_use_gift_code', { code: 'NO-SUCH-CODE-999' }).code === 1, '码表里没有的码被拒绝 (code 1)');

console.log(H.fails() ? '\nservicetest: ' + H.fails() + ' FAILED' : '\nservicetest: all checks passed');
  process.exit(H.fails() ? 1 : 0);
})();
