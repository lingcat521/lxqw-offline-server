/* startertest: 新档起步包(清单 §1 默认用户初始化) + 手工材料耗尽后不再开工(清单 §9 制作消耗)。 */
const H = require('./_harness.js');
const ok = H.ok, M_ = null;
H.boot({ stubs: function (g) {
  g.Tabikaeru.DataManager = { instance: function () { return { ItemDB: { get: function () { return null; }, list: function () { return []; } } }; } };
}});
const M = global.MockServer;
const st = global.MOCK_STATE;

ok(Array.isArray(st.house) && st.house.some(x => Number(x.item_id) === 0),
   '新档 house 里有食物 [' + JSON.stringify((st.house || []).slice(0, 3)) + ']');
ok(st.house.some(x => Number(x.item_id) === 1000), '新档有 1 个四叶草护身符(旅行可携带)');
ok(Number(st.clover) === 1000 && Number(st.ticket) === 10, '三叶草/抽奖券初始值不变 [' + st.clover + '/' + st.ticket + ']');
ok(Array.isArray(st.notes) && st.notes.length >= 3, '新档有日记笔记 (' + (st.notes || []).length + ' 条)');

/* 手工: 没有 7000/8000 就不开工 */
st.house = [];
st.frog = { status: 0, motion: 0, traveling: false, returnAt: 0, nextNote: 0 };
st.craft = { wishes: [], stamps: [], boxes: [], seq: 0, wishNew: null, stampNew: null };
const g0 = M.handle('pray_load_grays', {});
ok(!(g0.wish_new && g0.wish_new.make_time), '没有 7000/8000 时不开工 [wish_new=' + JSON.stringify(g0.wish_new) + ']');
ok(!(g0.stamp_new && g0.stamp_new.time), '印章同样不开工');

/* 有了就开工, 且每单各扣 1 件 */
st.house = [{ item_id: 7000, count: 1 }, { item_id: 8000, count: 1 }];
st.craft = { wishes: [], stamps: [], boxes: [], seq: 0, wishNew: null, stampNew: null };
const g1 = M.handle('pray_load_grays', {});
ok(!!(g1.wish_new && g1.wish_new.make_time), '有材料就开工');
const left = id => (st.house.filter(x => Number(x.item_id) === id)[0] || { count: 0 }).count;
ok(left(7000) === 0 && left(8000) === 0, '祈愿物一单扣光 7000/8000 [' + left(7000) + '/' + left(8000) + ']');
st.craft = { wishes: [], stamps: [], boxes: [], seq: 0, wishNew: null, stampNew: null };
const g2 = M.handle('pray_load_grays', {});
ok(!(g2.wish_new && g2.wish_new.make_time), '材料用光后再次停手');

console.log(H.fails() ? ('\nstartertest: ' + H.fails() + ' FAILED') : '\nstartertest: all checks passed');
process.exit(H.fails() ? 1 : 0);
