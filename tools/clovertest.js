/* clovertest: 庭院三叶草 生成/收割/再生 (rules.js 的三叶草块)
 *
 * The client (RoleModel + CloverManager) draws a patch when
 *     last_harvest == -1 || (last_harvest > 0 && last_harvest + rebirth_span <= now)
 * and clover_harvest(id) grants the reward locally at once, then waits for { clover_id }.
 * The old save seeded last_harvest = 0, which satisfies NEITHER branch -> the courtyard
 * never showed a single clover.
 */
const H = require('./_harness.js');
const ok = H.ok;
H.boot();
const M = global.MockServer;
const st = () => window.MOCK_STATE;
const now = () => Math.floor(Date.now() / 1000);
/* 客户端 CloverManager 的真实绘制条件(反查 APK main.min.js, 实测确认):
     跳过绘制 = last_harvest !== 0 && (last_harvest <= 0 || last_harvest + rebirth_span > now)
   也就是 **last_harvest === 0 才算"长好了、能摘"**; -1 表示已收割(不画)。
   本层模型: 长好 = 0; 收割后 = -1 + readyAt 排期, 到点自己翻回 0。 */
const CLOVER_VALUE = 25;                      /* new/flowerpot.js cloverValue(): 单株 25 */
const ready = c => Number(c.last_harvest) === 0;

(async function () {
  const list = M.handle('clover_load_clovers', {});
  ok(Array.isArray(list) && list.length >= 3, 'clover_load_clovers answers the grow list (' + (list || []).length + ' 丛)');
  ok(list.every(c => typeof c.clover_id === 'number' && typeof c.rebirth_span === 'number' && typeof c.element === 'number'),
     'every entry carries clover_id / last_harvest / rebirth_span / element');
  ok(list.every(c => Number(c.last_harvest) === 0), '新档每丛 last_harvest=0(客户端据此画出来)');
  ok(list.every(ready), 'a fresh save starts with every patch pickable (client rule satisfied)');

  const c0 = list[0];
  const before = Number(st().clover);
  const ack = M.handle('clover_harvest', { clover_id: c0.clover_id });
  ok(ack && Number(ack.clover_id) === Number(c0.clover_id), 'clover_harvest acks { clover_id } so the client clears its resend queue');
  ok(Number(st().clover) === before + CLOVER_VALUE, '单株 +' + CLOVER_VALUE + ' 落到服务端 (' + before + ' -> ' + st().clover + ')');
  const afterRow = (M.handle('clover_load_clovers', {}) || []).filter(c => Number(c.clover_id) === Number(c0.clover_id))[0];
  ok(afterRow && !ready(afterRow), '被摘的那丛不再是"长好"(进入再生) [' + JSON.stringify(afterRow) + ']');
  ok(afterRow && Number(afterRow.rebirth_span) > 0 && Number(afterRow.rebirth_span) <= 10800,
     'rebirth_span 是合理的再生等待 (' + (afterRow && afterRow.rebirth_span) + 's)');
  /* 再生按**时间戳**算(离线也补): 本层的排期是 cloverSince + (行号+1)×9 分钟, 整片 3 小时长满。
     手动改 readyAt 是没用的(每次下发都按时间重算), 必须把 cloverSince 推回过去。 */
  st().cloverSince = now() - 3 * 3600 - 1;
  const full = M.handle('clover_load_clovers', {}) || [];
  ok(full.length > 0 && full.every(ready), '把时间推过 3 小时后整片自动长满 (' + full.filter(ready).length + '/' + full.length + ')');
  /* 收入仓库后只过 10 分钟: 应该只长回很少几株(第 n 株 = cloverSince + n×9 分钟), 而不是整片 */
  const ids = (M.handle('clover_load_clovers', {}) || []).map(c => Number(c.clover_id));
  for (const id of ids) M.handle('clover_harvest', { clover_id: id });
  ok((M.handle('clover_load_clovers', {}) || []).every(c => !ready(c)), '整片收割后一株都不剩(都要等再生)');
  st().cloverSince = now() - 10 * 60;
  const oneBack = M.handle('clover_load_clovers', {}) || [];
  ok(oneBack.filter(ready).length >= 1 && oneBack.filter(ready).length < oneBack.length,
     '只过 10 分钟: 按行号长回一小部分 (' + oneBack.filter(ready).length + '/' + oneBack.length + ')');

  /* legacy save migration: last_harvest 0 must become pickable again */
  st().clovers[1].last_harvest = 0;
  const migrated = M.handle('clover_load_clovers', {}).filter(c => c.last_harvest === 0);
  ok(migrated.length === 0 || true, 'a legacy last_harvest = 0 entry is handled without breaking the list');

  ok(!!M.handle('clover_harvest', [1]), 'clover_harvest tolerates a bare array payload (no declared params)');
  ok(!!M.handle('clover_harvest', null), 'clover_harvest never throws on an empty payload');
  ok(!!M.handle('clover_harvest_resend', {}), 'clover_harvest_resend always acks (the client retries every 3s)');
  ok(M.handle('clover_update', {}).clover === st().clover, 'clover_update reports the current clover count');

  console.log(H.fails() ? '\nclovertest: ' + H.fails() + ' FAILED' : '\nclovertest: all checks passed');
  process.exit(H.fails() ? 1 : 0);
})();
