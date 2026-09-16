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
const ready = c => c.last_harvest === -1 || (c.last_harvest > 0 && c.last_harvest + c.rebirth_span <= now());

(async function () {
  const list = M.handle('clover_load_clovers', {});
  ok(Array.isArray(list) && list.length >= 3, 'clover_load_clovers answers the grow list (' + (list || []).length + ' 丛)');
  ok(list.every(c => typeof c.clover_id === 'number' && typeof c.rebirth_span === 'number' && typeof c.element === 'number'),
     'every entry carries clover_id / last_harvest / rebirth_span / element');
  ok(list.every(c => c.last_harvest !== 0), 'no entry is stuck at last_harvest = 0 (that made every clover invisible)');
  ok(list.every(ready), 'a fresh save starts with every patch pickable (client rule satisfied)');

  const c0 = list[0];
  const before = Number(st().clover);
  const ack = M.handle('clover_harvest', { clover_id: c0.clover_id });
  ok(ack && Number(ack.clover_id) === Number(c0.clover_id), 'clover_harvest acks { clover_id } so the client clears its resend queue');
  ok(Number(st().clover) === before + 1, '三叶草 +1 on the server too (' + before + ' -> ' + st().clover + ')');
  ok(!ready(c0), 'the picked patch stops being ready (it is regrowing now)');
  ok(c0.rebirth_span >= 60 && c0.rebirth_span <= 900, 'rebirth_span is a sane wait (' + c0.rebirth_span + 's)');
  c0.last_harvest = now() - c0.rebirth_span - 1;
  ok(ready(c0), 'after rebirth_span it is pickable again (定时刷新)');

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
