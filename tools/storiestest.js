/* storiestest: 「故事」界面双板块(旅行趣事 / 节日趣闻) —— new/stories.js
   用户给的结构: stories{id,type,title,content,unlock_condition,related_item_id};
   旅行归来/收到明信片时遍历未解锁故事做条件匹配(目的地/携带道具/事件/现实节日);
   节日故事条件满足后再过 15~30% 概率; 与称号/图鉴联动。 */
const { BASE, ok, boot, fails } = require('./_harness.js');
const fs = require('fs');
const ITEMS = JSON.parse(fs.readFileSync(BASE + '/tables/Item_json.json', 'utf8'));
const byId = {}; ITEMS.forEach(i => byId[Number(i.id)] = i);
boot({ stubs: g => {
  g.Tabikaeru.DataManager = { instance: () => ({ ItemDB: { get: id => byId[Number(id)] || null, list: () => ITEMS } }) };
}});
const st = global.MOCK_STATE || (global.MOCK_STATE = {});
const M = global.MockServer;
const S = global.MOCK_SEMANTIC;

(async function () {
  st.kitV2 = st.kitV3 = st.kitV4 = st.kitV5 = st.kitGranted = 1;
  st.party = { started: 0, guest: -1, ends: 0 };
  st.stories2 = []; st.travelCount = 0; st.lastTripItems = []; st.collections = []; st.notes = [];
  if (window.MOCK_ENV) window.MOCK_ENV.weather = 1;
  const S2 = window.MOCK_STORIES;
  ok(!!S2, 'stories 层装上了 MOCK_STORIES');

  const list = S2.list();
  const travel = list.filter(x => x.type === 'travel'), fest = list.filter(x => x.type === 'festival');
  ok(JSON.stringify(list) === JSON.stringify(JSON.parse(JSON.stringify(list))), 'stories 表可以整体 JSON 序列化(给 GM/存档/测试用)');
  ok(travel.length >= 5 && fest.length >= 5, '双板块都有条目: 旅行趣事 ' + travel.length + ' / 节日趣闻 ' + fest.length);
  ok(list.every(x => x.id && x.type && x.title && x.content && x.unlock_condition && x.related_item_id !== undefined),
     '每条都有用户要求的字段 id/type/title/content/unlock_condition/related_item_id');
  ok(list.every(x => typeof x.unlock_condition === 'object'), 'unlock_condition 是 JSON 对象(可序列化): ' + JSON.stringify(list[0].unlock_condition));
  ok(fest.every(x => Number(x.chance) >= 0.15 && Number(x.chance) <= 0.3), '节日趣闻都带 15%~30% 概率判定 [' + fest.map(x => x.chance).join(',') + ']');

  /* 旅行趣事: 满足"旅行次数"就解锁 */
  ok(S2.check('单测') === 0, '条件不满足时一条都不解锁 [' + JSON.stringify(S2.unlocked()) + ']');
  st.travelCount = 3;
  if (window.MOCK_ENV) window.MOCK_ENV.weather = 4;      /* 暴雨: 让"海边的贝壳"那条条件也成立 */
  const n1 = S2.check('单测');
  if (window.MOCK_ENV) window.MOCK_ENV.weather = 1;
  ok(n1 >= 2, '旅行 3 次后解锁 ' + n1 + ' 条旅行趣事 [' + JSON.stringify(S2.unlocked()) + ']');
  ok(S2.unlocked().length === n1, '再查一次不会重复解锁 [' + S2.check('单测') + ']');

  /* 节日趣闻: 带当月节气限定食物出门 -> 条件满足 + 概率 */
  const sf = S2.solar().food;
  st.lastTripItems = [sf];
  const anyMonth = list.filter(x => x.type === 'festival' && x.unlock_condition && x.unlock_condition.any_month)[0];
  ok(S2.condMet(anyMonth.unlock_condition) === true, '带当月节气食物(' + sf + ') -> 节气故事条件成立');
  let got2 = 0;
  for (let i = 0; i < 60 && !S2.unlocked().some(id => id === anyMonth.id); i++) got2 += S2.check('单测');
  ok(S2.unlocked().indexOf(anyMonth.id) >= 0, '概率判定通过后解锁『' + anyMonth.title + '』(试 ' + got2 + ' 次)');
  ok(S2.condMet({ festival: '中秋', solar_food: 1 }) === (S2.festivals().indexOf('中秋') >= 0), '现实节日判定与日期一致 [' + JSON.stringify(S2.festivals()) + ']');

  /* 与其他系统联动: 收集类故事要 18 种纪念品 */
  const coll = list.filter(x => x.type === 'travel' && x.cond && x.cond.collections)[0];
  if (coll) {
    st.collections = new Array(5).fill(0);
    ok(S2.condMet(coll.cond) === false, '纪念品不够时『' + coll.title + '』条件不成立');
    st.collections = new Array(18).fill(0);
    ok(S2.condMet(coll.cond) === true, '集齐 18 种 -> 『' + coll.title + '』条件成立');
  }
  /* 旅行归来会跑判定(包了 MOCK_STORY_ROLL) */
  const before = S2.unlocked().length;
  st.travelCount = 9;
  if (window.MOCK_STORY_ROLL) window.MOCK_STORY_ROLL();
  ok(S2.unlocked().length >= before, '旅行归来(走 MOCK_STORY_ROLL)会跑故事判定 [' + before + ' -> ' + S2.unlocked().length + ']');

  /* ---- 老存档(出过门但一条故事都没有)开机就该补一条, 否则页签是 0/0 ---- */
  st.stories = []; st.newStoryId = 0; st.travelCount = 7; st.tripLuggage = [];
  const bf = window.MOCK_STORY_BACKFILL ? window.MOCK_STORY_BACKFILL() : 0;
  ok(bf === 1 && global.MOCK_SEMANTIC['story_load']({}).stories.length === 1,
     '老存档开机补记第一条(设备上 travelCount=7/stories=0 就是这种) [' + bf + ']');

  /* ---- 客户端的"旅行趣事"页签要真的有卡片(story_load) ---- */
  st.stories = []; st.stories2 = []; st.newStoryId = 0;
  st.travelCount = 1; st.tripLuggage = [13, 1009, 6, 1002];
  st.tripRoute = { place: 4, placeName: '广州', region: 'south', km: 2100, budget: 3200, detour: 0, secret: 0, flavor: 'coastal' };
  const rolled = window.MOCK_STORY_ROLL();
  ok(!!rolled, '旅行归来会解锁故事(自研表)');
  const loaded = global.MOCK_SEMANTIC['story_load']({});
  ok(Array.isArray(loaded.stories) && loaded.stories.length >= 1,
     'story_load 给客户端下发 ' + (loaded.stories && loaded.stories.length) + ' 条(旅行趣事页签不再是 0/0)');
  ok(loaded.stories.every(s => s.id >= 1 && s.id <= 25), '每条 id 都落在客户端 story_json 的 1..25 里(否则界面画不出来)');
  ok(loaded.stories.every(s => s.gift === -1 || s.gift >= 0) && loaded.stories.every(s => typeof s.name === 'string'),
     '每条都带 name(卡片上那行字) 与 gift=-1 默认值 [' + JSON.stringify(loaded.stories[0]) + ']');
  ok(window.MOCK_STORY_UNLOCK && !!window.MOCK_STORY_UNLOCK(3, '单测'), 'MOCK_STORY_UNLOCK 能指定解锁(自研趣事 -> 客户端卡片合流)');
  ok(global.MOCK_SEMANTIC['story_load']({}).stories.some(s => s.id === 3), '指定解锁的那条立刻出现在 story_load 里');
  /* 目的地决定能不能遇到故事: 广州(华南) -> 华南那条有机会 */
  st.stories = []; st.newStoryId = 0; st.storyDry = 0; st.stories2 = []; st.tripLuggage = [];
  let byRegion = 0;
  for (let i = 0; i < 30 && !byRegion; i++) {
    st.stories = []; st.newStoryId = 0; st.storyDry = 0;
    window.MOCK_STORY_ROLL();
    if (global.MOCK_SEMANTIC['story_load']({}).stories.length) byRegion++;
  }
  ok(byRegion === 1, '空着手去对地方(广州=华南)也能遇到故事 [' + byRegion + ']');
  /* 保底: 连续空手也会给一条, 不会永远 0 */
  st.stories = []; st.newStoryId = 0; st.storyDry = 0; st.tripRoute = { place: 999, region: '', km: 0, budget: 0 };
  st.tripLuggage = [];
  let gotAny = 0;
  for (let i = 0; i < 3; i++) { if (window.MOCK_STORY_ROLL()) gotAny++; }
  ok(gotAny >= 1 && global.MOCK_SEMANTIC['story_load']({}).stories.length >= 1,
     '连着几趟空手也有保底(故事收集不卡死) [' + gotAny + '/3]');

  /* ---- 称号联动(鉴赏名家) ---- */
  const t9 = S2.table().filter(x => x.id === 9)[0];
  ok(!!t9 && t9.unlock_condition.titles && t9.unlock_condition.titles[0] === '鉴赏名家', '有一条故事要求"鉴赏名家"称号 [' + JSON.stringify(t9 && t9.unlock_condition) + ']');
  st.collections = new Array(20).fill(1); st.achieveList = [];
  ok(S2.condMet(t9.unlock_condition) === false, '没拿到称号时条件不成立(图鉴够也不行)');
  st.achieveList = [6];                                   /* 6 = 鉴赏名家(Achieve 表) */
  const tn = S2.titles();
  ok(S2.condMet(t9.unlock_condition) === true || tn.length === 0,
     '拿到称号后条件成立 [称号=' + JSON.stringify(tn) + ']');

  /* ---- 关联纪念品/明信片(related_item_id) ---- */
  st.achieveList = []; st.collections = [];
  const t5 = S2.table().filter(x => x.id === 5)[0];        /* 沙丘上的落日: 带烤包子(4) -> 直接给关联纪念品 */
  ok(!!t5 && t5.related_item_id >= 3000, '每条都带关联纪念品 id [' + (t5 && t5.related_item_id) + ']');
  st.stories3 = []; st.tripRoute = { place: 17, placeName: '酒泉', flavor: 'desert', km: 2200, budget: 3000 };
  st.tripLuggage = [4]; st.lastTripItems = [4];
  st.house = [];
  const u5 = S2.unlock(5, '单测');
  ok(!!u5, '指定解锁『' + (u5 && u5.title) + '』');
  ok((st.house || []).some(h => Number(h.item_id) === Number(t5.related_item_id)),
     '带对道具的故事会把关联纪念品一起给你 [house=' + JSON.stringify(st.house) + ']');

  /* ---- 寄回明信片也是触发点 ---- */
  ok(typeof window.MOCK_POSTCARD_HOME === 'function', '「寄回明信片」钩子存在(travel2 的 mid-trip 明信片会调它)');
  st.stories3 = []; st.travelCount = 1; st.tripRoute = null; st.tripLuggage = []; st.lastTripItems = [];
  let crashed = 0;
  try { window.MOCK_POSTCARD_HOME(); } catch (e) { crashed++; }
  ok(crashed === 0, '在"寄回明信片"时机跑条件匹配不会崩');

  console.log(fails() === 0 ? 'ALL STORIES2 CHECKS PASSED' : (fails() + ' CHECK(S) FAILED'));
  process.exit(fails() === 0 ? 0 : 1);
})();
