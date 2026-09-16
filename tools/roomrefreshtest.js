/* roomrefreshtest: 「准备好旅行后，青蛙的状态与渲染不会立即更新，要退出小屋后才会更新」。
   根因(main.min.js): MainInController **没有**监听 RoleEventType.loadRole, 而决定"屋里有没有青蛙"的
   MainInView.updateFlogStatus() 只在 childrenCreated 与 reset()(重新进小屋)时被调用 —— 所以光 push
   client_load_role 只更新外面场景, 小屋里要出门再进屋才变。
   new/roompatch.js 的做法: 找到场景层里带 updateFlogStatus 的视图, 直接调它。
   本测试用假视图当探针, 验证 出发/回家 两个方向都会触发重画(而不是等玩家离开小屋)。 */
const { ok, boot, fails } = require('./_harness.js');

const calls = [];
function fakeRoomView(tag) {
  return {
    curAnimName: tag || 'room',
    updateFlogStatus: function () { calls.push('flog:' + (this.curAnimName || tag)); },
    updateFurnitureAni: function () { calls.push('ani'); },
    updateBagState: function () { calls.push('bag'); }
  };
}
let usePageManage = true;
boot({ stubs: g => {
  g.core.ViewLayerType = { SceneLayer: 1 };
  g.core.PageManage = { getInstance: () => ({ getControlList: () => (usePageManage ? [{ view: fakeRoomView() }] : []) }) };
  g.egret.MainContext = { instance: { stage: { $children: [{ updateFlogStatus: function () { calls.push('stage-flog'); } }] } } };
}});
const st = global.MOCK_STATE || (global.MOCK_STATE = {});
const M = global.MockServer;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const has = p => calls.some(c => c.indexOf(p) === 0);

(async function () {
  st.kitV2 = st.kitV3 = st.kitV4 = st.kitV5 = st.kitGranted = 1;
  st.frog = { status: 0, motion: 0, traveling: false, returnAt: 0 };
  st.bag = [0, -1, -1, -1]; st.desk = [-1, -1, -1, -1, -1, -1, -1, -1];
  st.party = { started: 0, guest: -1, ends: 0 }; st.partyLast = Math.floor(Date.now() / 1000);

  ok(typeof window.MOCK_REFRESH_ROOM === 'function', 'roompatch 层装上了 MOCK_REFRESH_ROOM');
  const probed = window.MOCK_ROOM_PROBE();
  ok(probed.count === 1, '能从小屋场景里找到视图 (count=' + probed.count + ')');
  ok(probed.views[0].bagState === 1, '探针能看到视图上的方法/状态');

  calls.length = 0;
  window.MOCK_ROOM_RESET_THROTTLE();
  ok(window.MOCK_REFRESH_ROOM('单测') === 1, 'MOCK_REFRESH_ROOM 返回刷新的视图数');
  ok(window.MOCK_REFRESH_ROOM('立刻再来一次') === 0, '状态没变时重复调用直接跳过(零代价)');
  window.MOCK_ROOM_RESET_THROTTLE();
  /* 现在只调 updateFlogStatus(只重建玩家一个精灵); 家具/背包不再由我们重建(那是"按钮被遮/拖不动"的来源) */
  ok(has('flog'), '重画时调用了 updateFlogStatus [' + calls.join(',') + ']');
  ok(!has('ani') && !has('bag'), '不再重建家具/背包精灵(避免累积遮挡) [' + calls.join(',') + ']');

  /* --- 出发: push client_load_role 之后 1 秒内必须重画(用户不用退出小屋) --- */
  calls.length = 0;
  window.MOCK_ROOM_RESET_THROTTLE();
  M.handle('item_set_bag_completed', { completed: true }); window.MOCK_FORCE_DEPART();
  ok(st.frog.status === 1, '准备后青蛙进入旅行状态 (status=1)');
  await sleep(1600);
  ok(has('flog'), '出发后小屋视图被重画(不需要退出小屋) [' + calls.join(',') + ']');

  /* --- 回家 --- */
  calls.length = 0;
  window.MOCK_ROOM_RESET_THROTTLE();
  st.frog.returnAt = Date.now() - 1000;
  let back = false;
  for (let i = 0; i < 12 && !back; i++) { await sleep(700); if (M.handle('client_load_role', {}).frog.status === 0) back = true; }
  ok(back, '到点后青蛙回到家 (status=0)');
  await sleep(1600);
  ok(has('flog'), '回家后小屋视图也被重画 [' + calls.join(',') + ']');

  /* --- 兜底路径: PageManage 拿不到视图时, 从舞台树里找 --- */
  usePageManage = false;
  calls.length = 0;
  window.MOCK_ROOM_RESET_THROTTLE();
  ok(window.MOCK_REFRESH_ROOM('舞台兜底') === 1, 'PageManage 没有视图时改用舞台树');
  ok(has('stage-flog'), '舞台兜底找到了视图并调用 [' + calls.join(',') + ']');

  /* --- 找不到视图也不能抛 --- */
  global.egret.MainContext.instance.stage = { $children: [] };
  let threw = false;
  try { window.MOCK_REFRESH_ROOM('空场景'); } catch (e) { threw = true; }
  ok(!threw && window.MOCK_REFRESH_ROOM('空场景') === 0, '没有小屋视图时安静返回 0');

  console.log(fails() === 0 ? 'ALL ROOM-REFRESH CHECKS PASSED' : (fails() + ' CHECK(S) FAILED'));
  process.exit(fails() === 0 ? 0 : 1);
})();
