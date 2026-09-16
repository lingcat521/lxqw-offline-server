/* noticetest: 出发/回来 提示 + 状态同步 + 合理旅行时长 (new/travel2.js)
 *
 * Reported bug: "青蛙明明出走了…青蛙还渲染在小屋里面…出走与回来并没有提示".
 * The client only draws the frog when Game.isHome (RoleModel.getFrogStatus()==0) and
 * only re-reads the role on RoleEventType.loadRole, so the server must
 *   (a) push client_load_role on every status change and
 *   (b) answer client_load_events / push notify_new_event with a TimerEvent
 *       (GoTravel=1 "{0}出去旅行了", Return=5 "{0}回来了。")
 */
const H = require('./_harness.js');
const ok = H.ok;
H.boot();
const M = global.MockServer;
const SM = core.SocketManage.prototype;
const st = () => window.MOCK_STATE;
const evTypes = () => (M.handle('client_load_events', {}) || []).map(e => e.evt_type);
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async function () {
  delete st().travelSeconds;
  ok(Array.isArray(M.handle('client_load_events', {})), 'client_load_events answers an array');

  /* --- food on the desk is preparation, not departure --- */
  M.handle('item_putin_desk', { pos: 0, id: 3 });
  await sleep(300);
  ok(M.handle('client_load_role', {}).frog.status === 0,
     'placing food on the desk does not start a trip by itself (only 准备 does)');

  /* --- departure --- */
  M.handle('item_putin_bag', { pos: 0, id: 1000 });
  M.handle('item_putin_bag', { pos: 1, id: 2000 });
  global.__events.length = 0;
  M.handle('item_set_bag_completed', { completed: true }); window.MOCK_FORCE_DEPART();
  await sleep(1600);

  const role = M.handle('client_load_role', {});
  ok(role.frog.status === 1, 'after 准备 the frog is travelling (status=' + role.frog.status + ')');
  /* 时长现在按行李算(new/travel2.js planTrip): 这里只带了四叶草(护身符)+竹筒(道具)、没带食物,
     所以是"出门晃一圈"档(0.5 小时上下); 食物分档与 6~72 小时的原版区间见 tripdurationtest.js */
  const dur = Number(st().tripSeconds);
  ok(dur >= 1500 && dur <= 2600, '没带食物 -> 半小时上下的一趟 (' + dur + 's, 旧版是固定 90s/3~7 分钟)');
  ok(st().travelSeconds === undefined, '这一趟的时长不会黏在 st.travelSeconds 上(下一趟重新按行李算)');
  ok(global.__events.filter(e => e === 'client_load_role').length >= 2,
     'client_load_role was pushed more than once so the home scene re-runs updateFlogStatus (' +
     global.__events.filter(e => e === 'client_load_role').length + ')');
  ok(evTypes().indexOf(1) >= 0, 'a GoTravel(1) TimerEvent is queued ("出去旅行了")');

  /* --- dismissing a notice clears it server side --- */
  const n0 = evTypes().length;
  M.handle('client_confirm_event', {});
  ok(evTypes().length === Math.max(0, n0 - 1), 'client_confirm_event drops the shown event (' + n0 + ' -> ' + evTypes().length + ')');

  /* --- return --- */
  global.__events.length = 0;
  global.__tripDone = false;
  st().frog.returnAt = Date.now() - 1000;
  for (let i = 0; i < 12 && !global.__tripDone; i++) {
    await sleep(1000);
    if (M.handle('client_load_role', {}).frog.status === 0) global.__tripDone = true;
  }
  ok(global.__tripDone === true, 'the frog came home (status=0)');
  await sleep(1200);                                  /* let the watcher + delayed pushes land */
  ok(evTypes().indexOf(5) >= 0, 'a Return(5) TimerEvent is queued ("回来了。")');
  ok(global.__events.indexOf('client_load_role') >= 0,
     'the return pushed client_load_role so the house stops drawing the frog [' + global.__events.join(',') + ']');

  console.log(H.fails() ? '\nnoticetest: ' + H.fails() + ' FAILED' : '\nnoticetest: all checks passed');
  process.exit(H.fails() ? 1 : 0);
})();
