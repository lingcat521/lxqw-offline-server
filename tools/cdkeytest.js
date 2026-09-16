/* cdkeytest: 兑换码(new/cdkey.js) —— 不看时效, 每码每人一次; 特效码/520 彩蛋 */
const { BASE, ok, boot, fails } = require('./_harness.js');
boot({});
const st = global.MOCK_STATE || (global.MOCK_STATE = {});
const S = global.MOCK_SEMANTIC;

(async function () {
  const C = window.MOCK_CDKEY;
  ok(!!C, '兑换码层装上了 MOCK_CDKEY');
  const tb = C.table();
  ok(tb.length >= 35, '码表 ' + tb.length + ' 个(含限时/节日/平台/私服自定义)');
  st.clover = 0; st.ticket = 0; st.house = []; st.cdkeyUsed = [];

  const r1 = S['item_use_gift_code']({ gift_code: 'CUQJEDTJHKDV' });
  ok(r1.code === 200, '长期通用码兑换成功 [code=' + r1.code + ']');
  ok(Number(st.clover) === 200, '三叶草 +200 [' + st.clover + ']');
  ok((st.house || []).some(h => Number(h.item_id) === 1000 && Number(h.count) === 2), '四叶草 ×2 进仓库');
  ok(Number(st.ticket) === 10, '兑换券 +10 [' + st.ticket + ']');

  const r2 = S['item_use_gift_code']({ gift_code: 'CUQJEDTJHKDV' });
  ok(r2.code === 2, '同一个码第二次 -> code 2(已被兑换过) [' + r2.code + ']');
  ok(Number(st.clover) === 200, '重复兑换不再发奖(三叶草还是 200)');

  ok(S['item_use_gift_code']({ gift_code: 'MEIYOUZHEGEMA' }).code === 1, '无效码 -> code 1');
  ok(S['item_use_gift_code']({ gift_code: 'cuqjedtjhkdv' }).code === 2, '大小写不敏感(小写也判为已领)');

  /* 私服自定义: 点击特效 + 520 */
  st.cdkeyUsed = []; st.clickFx = { unlocked: [], cur: 0 };
  const rf = S['item_use_gift_code']({ gift_code: 'CHUNFENG' });
  ok(rf.code === 200 && S['other_load_touch']({}).cur === 1, 'CHUNFENG -> 解锁并装备樱花特效 [' + JSON.stringify(S['other_load_touch']({})) + ']');
  ok(S['item_use_gift_code']({ gift_code: 'WAGUA' }).code === 200 && S['other_load_touch']({}).list.length === 2, 'WAGUA -> 蛙爪印(有效期不看, 只记一次)');
  st.clover = 0;
  ok(S['item_use_gift_code']({ gift_code: 'lingcat521' }).code === 200 && Number(st.clover) === 520, 'lingcat521 -> 520 三叶草 [' + st.clover + ']');
  ok(S['item_use_gift_code']({ gift_code: 'LINGCAT521' }).code === 2, '同一个彩蛋码也只能领一次');

  /* 中文码 + 道具类奖励 */
  st.cdkeyUsed = []; st.house = []; st.clover = 0;
  ok(S['item_use_gift_code']({ gift_code: '五一快乐蛙' }).code === 200, '中文码可用(博物馆门票×2)');
  ok((st.house || []).some(h => Number(h.item_id) === 1104 && Number(h.count) === 2), '门票 ×2 进仓库 [' + JSON.stringify(st.house) + ']');
  ok(S['item_use_gift_code']({ gift_code: '新呱同乐之寻蜀道' }).code === 200 && Number(st.clover) === 30, '新呱同乐系列码可用(30 草, 不夸张)');

  console.log(fails() === 0 ? 'ALL CDKEY CHECKS PASSED' : ('CDKEY FAILED: ' + fails()));
  process.exit(fails() === 0 ? 0 : 1);
})();
