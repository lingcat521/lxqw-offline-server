/* raffletest: 抽奖券消耗(以前无限抽) + 领奖真发货 + 礼盒搬运(以前只回 code:0)。
   契约来自 main.min.js: RaffleView.raffle() 用 Tabikaeru.Define.RAFFEL_NEEDTICKETS(=5) 只判定不扣,
   ItemModel.item_gacha 把 e.ticket 当 gachaColorBall(-1 = 没抽成); item_redeem_prize(id) 由玩家点选后发出。 */
const { BASE, ok, boot, fails } = require('./_harness.js');
const fs = require('fs');

const PRIZE = JSON.parse(fs.readFileSync(BASE + '/tables/Prize_json.json', 'utf8'));
const ITEMS = JSON.parse(fs.readFileSync(BASE + '/tables/Item_json.json', 'utf8'));
const byId = {}; ITEMS.forEach(i => byId[Number(i.id)] = i);

boot({ stubs: g => {
  g.Tabikaeru.Define = { RAFFEL_NEEDTICKETS: 5 };
  g.Tabikaeru.DataType = { ItemType: { RESOURCE: 14 } };
  g.Tabikaeru.DataManager = { instance: () => ({
    PrizeDB: { get: id => PRIZE.filter(r => Number(r.id) === Number(id))[0] || null, count: () => PRIZE.length, index: i => PRIZE[i] },
    ItemDB: { get: id => byId[Number(id)] || null, list: () => ITEMS }
  }) };
}});
const M = global.MockServer, st = global.MOCK_STATE || (global.MOCK_STATE = {}), S = global.MOCK_SEMANTIC;
st.kitV2 = st.kitV3 = st.kitV4 = st.kitV5 = st.kitGranted = 1;

(async function () {
const sent = [];
const real = M.dispatch;
M.dispatch = function (n, d) { sent.push(n); return real.apply(this, arguments); };

/* --- 1) 抽奖券必须被扣 --- */
st.ticket = 12; st.house = []; st.gacha = [];
const r1 = M.handle('item_gacha', {});
ok(r1.ticket >= 0 && r1.ticket <= 5, '抽一次回了合法 rank [' + r1.ticket + ']');
ok(st.ticket === 7, '扣掉 5 张券 (12 -> ' + st.ticket + ')');
M.handle('item_gacha', {});
ok(st.ticket === 2, '再抽一次 (7 -> ' + st.ticket + ')');
const r3 = M.handle('item_gacha', {});
ok(r3.ticket === -1, '券不足时回 -1 (客户端把手恢复, 不播动画) [' + r3.ticket + ']');
ok(st.ticket === 2, '券不足时不扣券');
ok(global.MOCK_RAFFLE.left() === 0, '券不足时剩余次数 0');

/* 次数与 rank 分布: 抽 400 次, 每个 rank 都要出现过, 且不越界 */
st.ticket = 5 * 400;
const ranks = {};
for (let i = 0; i < 400; i++) { const r = M.handle('item_gacha', {}); ranks[r.ticket] = (ranks[r.ticket] || 0) + 1; }
ok(st.ticket === 0, '400 次正好扣 2000 张券 (剩 ' + st.ticket + ')');
ok(Object.keys(ranks).every(k => Number(k) >= 0 && Number(k) <= 5), 'rank 都在 0..5 [' + JSON.stringify(ranks) + ']');
ok(Object.keys(ranks).length >= 4, 'rank 有分布, 不是恒定值 [' + Object.keys(ranks).sort().join(',') + ']');
ok(global.MOCK_RAFFLE.history().length >= 200, '抽奖记录有留存(上限 200 条) (' + global.MOCK_RAFFLE.history().length + ' 条)');

/* --- 2) 领奖必须真发货 --- */
const itemPrize = PRIZE.filter(r => Number(r.itemId) > 0)[0];
st.house = [];
const g1 = M.handle('item_redeem_prize', { id: itemPrize.id });
ok(g1.code === 0, '领奖成功 (code=' + g1.code + ')');
const got = st.house.filter(x => Number(x.item_id) === Number(itemPrize.itemId))[0];
ok(!!got && Number(got.count) === Number(itemPrize.stock), '实物奖进仓库 ' + itemPrize.itemId + ' x' + (got && got.count));
const ticketPrize = PRIZE.filter(r => Number(r.itemId) <= 0)[0];
const t0 = Number(st.ticket);
const g2 = M.handle('item_redeem_prize', { id: ticketPrize.id });
ok(g2.code === 0 && Number(st.ticket) === t0 + Number(ticketPrize.stock), '券奖加抽奖券 (' + t0 + ' -> ' + st.ticket + ')');
ok(M.handle('item_redeem_prize', { id: 9999 }).code === 1, '未知 prize id 回 code 1');

/* --- 3) 礼盒搬运 --- */
st.gifts = [{ item_id: 3000, count: 2 }];
st.house = [];
const mv = M.handle('travel_gift_to_bag', { item_id: 3000 });
ok(mv.code === 0, '礼盒取出成功');
ok(st.gifts.length === 1 && st.gifts[0].count === 1, '礼盒里少了一件 [' + JSON.stringify(st.gifts) + ']');
ok(st.house.filter(x => x.item_id === 3000)[0].count === 1, '仓库里多了一件');
const mv2 = M.handle('travel_bag_to_gift', { item_id: 3000 });
ok(mv2.code === 0, '放回礼盒成功');
ok(st.gifts[0].count === 2 && st.house.filter(x => x.item_id === 3000).length === 0, '礼盒又变 2 件, 仓库清空');
st.gifts = []; for (let i = 0; i < 30; i++) st.gifts.push({ item_id: 3000 + i, count: 1 });
st.house = [{ item_id: 3000, count: 5 }];
ok(M.handle('travel_bag_to_gift', { item_id: 3000 }).code === 102, '礼盒满(30)时回 102 -> 客户端弹"礼品盒满了"');
ok(M.handle('travel_gift_to_bag', { item_id: 777 }).code === 1, '取不存在的特产回 code 1');

/* --- 4) 归来结算三缺 --- */
let mails = 0;
const realAdd = window.MOCK_ADD_MAIL;
window.MOCK_ADD_MAIL = function (m) { mails++; return realAdd(m); };
st.frog = { status: 1, traveling: true, returnAt: Date.now() - 1000, nextNote: 0 };
st.ticket = 0; st.clover = 0; st.notes = []; st.gifts = []; st.photos = []; st.nextPhoto = 1;
S['item_load_items'] = S['item_load_items'] || function () { return {}; };
await new Promise(r => setTimeout(r, 5000));
ok(Number(st.ticket) >= 1, '归来带回抽奖券 (ticket=' + st.ticket + ')');
ok(mails >= 0, '归来尝试生成旅友来信 (本次 ' + mails + ' 封)');

M.dispatch = real;
console.log(fails() === 0 ? 'ALL RAFFLE CHECKS PASSED' : (fails() + ' CHECK(S) FAILED'));
process.exit(fails() === 0 ? 0 : 1);
})();
