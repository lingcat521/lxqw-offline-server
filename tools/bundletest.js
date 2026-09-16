/* bundletest: build/mock.bundle.js 必须自足启动(不请求任何 .js 层) */
const H = require('./_harness.js');
const ok = H.ok;
global.__denyLayerFetch = true;
H.boot({ entry: '/build/mock.bundle.js' });
const M = global.MockServer;

(async function () {
  ok(!!M, 'bundle exposes MockServer');
  console.log('   bundle XHR urls seen: ' + JSON.stringify((global.__bundleUrls || []).slice(0, 6)) + ' total ' + ((global.__bundleUrls || []).length));
  ok(String((M && M.version) || '').length >= 3, 'version present (' + (M && M.version) + ')');
  const sem = Object.keys(window.MOCK_SEMANTIC || {}).length;
  ok(sem >= 100 || !!M.handle('client_load_role', {}).frog, 'semantic handlers inlined or reachable (' + sem + ')');
  const picList = M.handle('album_load_by_id_list', { id_list: [1] });
  ok(!!(picList && picList.pic_list && picList.pic_list[0] && picList.pic_list[0].layers && picList.pic_list[0].layers.length), 'postcard layer pipeline works in the bundle');
  const role = M.handle('client_load_role', {});
  ok(!!(role && role.frog && role.frog.status !== undefined), 'client_load_role answers a full role');
  ok(Array.isArray(M.handle('item_load_items', {}).bag), 'item_load_items answers a bag array');
  ok(Array.isArray(M.handle('calendar_load', {}).lucky_days), 'calendar_load answers lucky_days array');
  ok(Array.isArray(M.handle('clover_load_clovers', {})) || Array.isArray((M.handle('clover_load_clovers', {}) || {}).list), 'courtyard clover list responds');
  ok(!!(M.handle('rank_load', {}) || {}).me, 'rank_load works');
  ok(Array.isArray((M.handle('story_load', {}) || {}).stories), 'story_load works');
  ok((global.__layerFetches || 0) === 0, 'no .js layer was fetched at runtime (' + (global.__layerFetches || 0) + ')');

  console.log(H.fails() ? '\nbundletest: ' + H.fails() + ' FAILED' : '\nbundletest: all checks passed');
  process.exit(H.fails() ? 1 : 0);
})();
