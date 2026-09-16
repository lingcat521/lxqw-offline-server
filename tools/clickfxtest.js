/* clickfxtest: 点击特效(new/clickfx.js) —— other_load_touch {cur,list} + other_req_touch 装备 + 统一解锁入口 */
const { BASE, ok, boot, fails } = require('./_harness.js');
boot({});
const st = global.MOCK_STATE || (global.MOCK_STATE = {});

(async function () {
  const F = window.MOCK_CLICKFX, S = global.MOCK_SEMANTIC;
  ok(!!F, '点击特效层装上了 MOCK_CLICKFX');
  const eff = F.effects();
  ok(eff.length === 4 && eff.every(e => e.id >= 1 && e.id <= 4), '只有资源里真实存在的 4 个特效 [' + eff.map(e => e.id + ':' + e.name).join(' ') + ']');

  st.clickFx = { unlocked: [], cur: 0 };
  const p0 = S['other_load_touch']({});
  ok(p0.cur === 0 && Array.isArray(p0.list) && p0.list.length === 0, '没解锁时下发 {cur:0, list:[]}(设置页显示"暂未获得") [' + JSON.stringify(p0) + ']');

  ok(F.unlock(2, '单测') === 2, '解锁特效 2');
  const p1 = S['other_load_touch']({});
  ok(p1.cur === 2 && p1.list.indexOf(2) >= 0, '第一个解锁的自动装备(设置页立刻有图标) [' + JSON.stringify(p1) + ']');
  ok(F.unlock(2, '重复') === null, '重复解锁返回 null(不重复发)');
  ok(F.unlock(99, '越界') === null, '资源里没有的 id 不解锁(点下去不会什么都播不出来)');

  ok(F.unlock(3, '单测') === 3 && S['other_load_touch']({}).list.length === 2, '再解锁一个 -> list 两条');
  /* 客户端切换: send("other_req_touch", id) —— 裸数字与 {id} 两种形状 */
  ok(S['other_req_touch'](3).code === 0 && S['other_load_touch']({}).cur === 3, '收裸数字切换生效 [cur=' + S['other_load_touch']({}).cur + ']');
  ok(S['other_req_touch']({ id: 2 }).code === 0 && S['other_load_touch']({}).cur === 2, '收 {id} 形状也生效');
  ok(S['other_req_touch'](4).code === 1, '没解锁的特效不能装备(code 1)');
  ok(S['other_req_touch'](0).code === 0 && S['other_load_touch']({}).cur === 0, '可以关掉(cur=0)');

  /* 统一入口: 任务/节气结算用 */
  st.clickFx = { unlocked: [], cur: 0 };
  ok(F.grantBySeason(3, '秋季收集') === 3 && S['other_load_touch']({}).cur === 3, '按季节发放(秋 -> 落叶特效)');
  ok(F.state().list.length === 1 && st.clickFx.unlocked[0] === 3, '状态落库(存档里两个字段: unlocked/cur)');

  console.log(fails() === 0 ? 'ALL CLICK-FX CHECKS PASSED' : ('CLICK-FX FAILED: ' + fails()));
  process.exit(fails() === 0 ? 0 : 1);
})();
