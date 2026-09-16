/* storytest: 故事/羁绊 (new/story.js) - the story.txt model over the game's own protocols.
 *   story_load -> {stories:[{id,partner,gift,feedback}], new_story_id}
 *   unlock = destination (from the food carried) + required/optional luggage weights
 */
const H = require('./_harness.js');
const fs = H.fs, BASE = H.BASE, ok = H.ok;
H.boot();
const M = global.MockServer;
const st = () => window.MOCK_STATE;
const STORY_TABLE = JSON.parse(fs.readFileSync(BASE + '/tables/story_json.json', 'utf8'));
const POOL = STORY_TABLE.story.map(s => s.storyid);

(async function () {
  const first = M.handle('story_load', {});
  ok(Array.isArray(first.stories) && first.stories.length === 0, 'a fresh save has no story yet');
  ok(first.new_story_id === 0, 'no pending story reveal on a fresh save');
  ok(POOL.length === 25, 'the client ships ' + POOL.length + ' story entries (tables/story_json.json)');

  /* required luggage from story.txt style rules: juice 11 + blue paper crane 1010 */
  st().tripLuggage = [13, 1009, 6, 1002];   /* 甜椒汁 + 红纸鹤 + 花生 + 铃铛 */
  const got = window.MOCK_STORY_ROLL();
  ok(!!got, 'a trip carrying 甜椒汁+红纸鹤 unlocks a story');
  const list = M.handle('story_load', {}).stories;
  ok(list.length >= 1, 'story_load now reports a story (拿到 ' + list.length + ' 条: 老 25 条表 + 自研趣事合流)');
  ok(POOL.indexOf(list[0].id) >= 0, 'the unlocked story id exists in the client story table (' + list[0].id + ')');
  ok(list[0].gift === -1 && list[0].feedback === -1, 'a fresh story has gift=-1 / feedback=-1 (client StoryData defaults)');
  ok(list[0].partner >= 0 && list[0].partner <= 2, 'the story carries a 旅友 partner id (' + list[0].partner + ')');
  ok(list.some(function (s) { return s.id === M.handle('story_load', {}).new_story_id; }), 'new_story_id points at one of them (drives StoryAlertView)');

  /* the reveal is acknowledged */
  M.handle('story_read_new_story', {});
  ok(M.handle('story_load', {}).new_story_id === 0, 'story_read_new_story clears the pending reveal');

  /* gifting + thanking —— 契约(2026-09 补): 礼物必须真的在仓库里(否则等于白送), 且一个故事只能送一次 */
  st().house = Array.isArray(st().house) ? st().house : [];
  st().house.push({ item_id: 9, count: 1 });
  ok(M.handle('story_send_gift', { id: list[0].id, gift: 10 }).code === 3, '仓库里没有的礼物送不出去');
  M.handle('story_send_gift', { id: list[0].id, gift: 9 });
  ok(M.handle('story_load', {}).stories[0].gift === 9, 'story_send_gift records the gifted item');
  ok((st().house.filter(function(x){return Number(x.item_id)===9;})[0] || {count:0}).count === 0, '礼物真的从仓库扣掉了');
  M.handle('story_feedback_gift', { id: 3 });
  ok(M.handle('story_load', {}).stories[0].feedback === 1, 'story_feedback_gift marks the thank-you');

  /* no duplicates, and the whole pool is reachable */
  st().tripLuggage = [11, 12, 13, 14, 6, 7, 8, 9, 10, 1002, 1003, 1004, 1005, 1006,
                      1007, 1008, 1009, 1010, 1013, 1014, 1015, 1016, 1100];
  let guard = 0;
  while (M.handle('story_load', {}).stories.length < POOL.length && guard++ < 200) window.MOCK_STORY_ROLL();
  const all = M.handle('story_load', {}).stories;
  ok(all.length === POOL.length, 'the whole story pool is reachable (' + all.length + '/' + POOL.length + ')');
  const ids = new Set(all.map(s => s.id));
  ok(ids.size === all.length, 'no story is unlocked twice (' + ids.size + ' unique ids)');
  ok(all.every(s => POOL.indexOf(s.id) >= 0), 'every unlocked id exists in the client story table');
  ok(window.MOCK_STORY_ROLL() === null, 'a full pool stops rolling (no phantom story)');

  console.log(H.fails() ? '\nstorytest: ' + H.fails() + ' FAILED' : '\nstorytest: all checks passed');
  process.exit(H.fails() ? 1 : 0);
})();
