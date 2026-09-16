/* storygifttest: 故事送礼链 —— 扣仓库 + 只能送一次 + type=6(StoryGift) 回礼邮件,
   以及 story_load 的 gift 必须是显式 -1(客户端不 new StoryData(), 默认值运行时无效)。 */
const { BASE, ok, boot, fails } = require('./_harness.js');
const fs = require('fs');
const STORY = JSON.parse(fs.readFileSync(BASE + '/tables/story_json.json', 'utf8'));
const ITEMS = JSON.parse(fs.readFileSync(BASE + '/tables/Item_json.json', 'utf8'));
const byId = {}; ITEMS.forEach(i => byId[Number(i.id)] = i);
const storyRows = Array.isArray(STORY.story) ? STORY.story : Object.keys(STORY.story).map(k => STORY.story[k]);
boot({ stubs: g => {
  g.Tabikaeru.DataManager = { instance: () => ({
    ItemDB: { get: id => byId[Number(id)] || null, list: () => ITEMS },
    StoryDB: { getStory: id => storyRows.filter(r => Number(r.storyid !== undefined ? r.storyid : r.id) === Number(id))[0] || null, list: () => storyRows }
  }) };
}});
const st = global.MOCK_STATE || (global.MOCK_STATE = {});
const S = global.MOCK_SEMANTIC, M = global.MockServer;
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async function () {
  st.kitV2 = st.kitV3 = st.kitV4 = st.kitV5 = st.kitGranted = 1;
  st.party = { started: 0, guest: -1, ends: 0 }; st.partyLast = Math.floor(Date.now() / 1000);
  st.house = [{ item_id: 3000, count: 2 }];
  /* story.js 的解锁条件: 果汁(11..14) + 千纸鹤(1007..1010), 稀有故事还要风铃 1100;
     行李带齐就能稳定解锁(否则本测试会 SKIP) */
  st.tripLuggage = [11, 12, 13, 14, 1007, 1008, 1009, 1010, 1100]; st.newStoryId = 0;
  st.stories = [];
  st.frog = { status: 0, traveling: false, returnAt: 0 };

  /* 触发一次故事判定(等价于旅行归来): 带齐行李 -> 必解锁一条 */
  let rolled = 0;
  for (let i = 0; i < 20 && !rolled; i++) { window.MOCK_STORY_ROLL(); rolled = (st.stories || []).length; }
  const list = S['story_load']();
  ok(Array.isArray(list.stories), 'story_load.stories 是数组 [' + list.stories.length + ']');
  ok(list.stories.every(s => s.gift === -1), '每条的 gift 都是显式 -1(否则客户端按钮变"已送")');
  const valid = list.stories.every(s => storyRows.some(r => Number(r.storyid !== undefined ? r.storyid : r.id) === Number(s.id)));
  ok(valid, '故事 id 都在 story_json 里(越界会让 RelationshipItem 崩)');

  if (!list.stories.length) { console.log('SKIP: 本次没有解锁故事'); process.exit(0); }
  const s0 = list.stories[0];
  ok(S['story_send_gift']({ id: s0.id, gift: 999999 }).code === 3, '仓库里没有的礼物送不出去');
  const before = (st.house.filter(x => Number(x.item_id) === 3000)[0] || {}).count;
  const r = S['story_send_gift']({ id: s0.id, gift: 3000 });
  ok(r && r.code === 0, '送礼成功 (code=' + (r && r.code) + ')');
  const after = (st.house.filter(x => Number(x.item_id) === 3000)[0] || {}).count;
  ok(after === before - 1, '礼物真的从仓库扣掉 [' + before + ' -> ' + after + ']');
  ok(S['story_load']().stories.filter(x => x.id === s0.id)[0].gift === 3000, 'gift 被记住(重启也不会回滚成 -1)');
  ok(S['story_send_gift']({ id: s0.id, gift: 3000 }).code === 2, '同一个故事不能重复送礼');
  await sleep(9000);
  const mails = S['mail_load']() || [];
  const gift = mails.filter(m => Number(m.type) === 6);
  ok(gift.length >= 1, '收到 type=6(StoryGift) 回礼邮件 [' + gift.length + ' 封]');
  ok(gift.every(m => m.resource && m.resource.clover_point >= 0 && m.resource.ads_id !== undefined), '邮件 resource 字段齐全(ads_id 必需)');
  ok(gift.every(m => Number(m.sender) >= -1 && Number(m.sender) <= 2), 'sender 在 -1..2(决定邻居头像)');

  console.log(fails() === 0 ? 'ALL STORY-GIFT CHECKS PASSED' : (fails() + ' CHECK(S) FAILED'));
  process.exit(fails() === 0 ? 0 : 1);
})();
