/* guestfeedtest: 投喂邻居的回礼与邀约机制(用户按社区实测给的数值表)。
   · 反应等级: taste>=90 十分满意 / >=60 很高兴 / >=20 一般 / <20 不喜欢(没有回礼)
   · 回礼(按邻居档位): 蜗牛 1~30 / 30~50, 蜜蜂 10~60 / 50~100, 乌龟 10~100 / 100~200 三叶草;
     抽奖券 2~4(乌龟 2~6); 约一半概率附四叶草
   · 稀有(高价 price>=100)特产: 额外 +20 三叶草 与 1~4 张券
   · 连续投喂同一种(最近三次内出现过): 三叶草减半
   · 回礼在**访客离开时**以邮件(type=3 Gift + sender)寄出; 不投喂则没有任何回礼
   · 邀约概率与是否喂食无关(15%~30%, 默认 22%)
   · 邮箱未领取上限 100 封, 超出丢最旧的(三叶草/券自动收取) */
const { BASE, ok, boot, fails } = require('./_harness.js');
const fs = require('fs');
const ITEMS = JSON.parse(fs.readFileSync(BASE + '/tables/Item_json.json', 'utf8'));
const SPEC = JSON.parse(fs.readFileSync(BASE + '/tables/Specialty_json.json', 'utf8'));
const byId = {}; ITEMS.forEach(i => byId[Number(i.id)] = i);
const specRows = SPEC.map(s => ({ itemId: Number(s.itemId) }));
const foods = ITEMS.filter(i => Number(i.type) === 0);
const cheap = foods.filter(i => Number(i.price) < 100)[0];
const rare = foods.filter(i => Number(i.price) >= 100)[0];
/* 三个邻居的口味表: 让 taste 可控 —— guest0 对每个物品都给 95(十分满意) */
function tasteArr(v) { return specRows.map(() => v); }
boot({ stubs: g => {
  g.Tabikaeru.DataManager = { instance: () => ({
    ItemDB: { get: id => byId[Number(id)] || null, list: () => ITEMS },
    SpecialtyDB: { list: () => specRows },
    CharaDB: { src: { data: [{ id: 0, taste: tasteArr(95) }, { id: 1, taste: tasteArr(70) }, { id: 2, taste: tasteArr(30) }] } }
  }) };
}});
const st = global.MOCK_STATE || (global.MOCK_STATE = {});
const S = global.MOCK_SEMANTIC, M = global.MockServer;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const mails = () => (S['mail_load']() || []);
function mailsOf(type) { return mails().filter(m => Number(m.type) === type); }

(async function () {
  st.kitV2 = st.kitV3 = st.kitV4 = st.kitV5 = st.kitGranted = 1;
  st.party = { started: 0, guest: -1, ends: 0 };
  st.drawing = undefined; st.guestFeedLog = []; st.extraMails = []; st.mailTaken = []; st.mailRead = [];
  st.house = [{ item_id: Number(cheap.id), count: 50 }, { item_id: Number(rare.id), count: 50 }];
  st.clover = 0; st.ticket = 0; st.frog = { status: 0, traveling: false, returnAt: 0 };

  ok(!!cheap && !!rare, '有普通(' + cheap.name + ')与高价(' + rare.name + ', price ' + rare.price + ')特产各一件可用');
  ok(window.MOCK_GUEST.reactionOf(95) === 'full' && window.MOCK_GUEST.reactionOf(70) === 'happy' &&
     window.MOCK_GUEST.reactionOf(30) === 'meh' && window.MOCK_GUEST.reactionOf(15) === 'dislike',
     '反应等级阈值: 90/60/20 分档');

  function feed(guestId, item, why) {
    st.guestFeed = { id: guestId, confirmed: true, served: false, expire_time: Math.floor(Date.now()/1000) + 300, pos: 0 };
    const r = S['guest_serve']({ id: guestId, item_id: item });
    return r;
  }
  /* 1) 十分满意(guest0, 95) -> 三叶草 30~50, 券 2~4 */
  const samples = [];
  for (let i = 0; i < 40; i++) {
    st.guestFeedLog = [];
    const r = feed(0, Number(cheap.id));
    samples.push(st.guestFeed.reward);
    st.guestFeed = { id: -1, confirmed: false, served: false, expire_time: 0, pos: 0 };   /* 让挂起的自动送客变成空操作 */
  }
  ok(samples.every(rw => rw.reaction === 'full'), 'guest0 口味 95 -> 全部"感觉十分满意"');
  ok(samples.every(rw => rw.clover >= 30 && rw.clover <= 50), '十分满意(蜗牛档) 三叶草 30~50 [' + Math.min(...samples.map(s => s.clover)) + '~' + Math.max(...samples.map(s => s.clover)) + ']');
  ok(samples.every(rw => rw.ticket >= 2 && rw.ticket <= 4), '抽奖券 2~4 [' + Math.min(...samples.map(s => s.ticket)) + '~' + Math.max(...samples.map(s => s.ticket)) + ']');
  ok(samples.some(rw => rw.amulet === 1), '约一半概率附一枚四叶草 [' + samples.filter(s => s.amulet).length + '/40]');

  /* 2) 很高兴(guest1, 70) -> 蜜蜂档 50~100 */
  const s2 = [];
  for (let i = 0; i < 30; i++) { st.guestFeedLog = []; feed(1, Number(cheap.id)); s2.push(st.guestFeed.reward); st.guestFeed = { id: -1, confirmed: false, served: false, expire_time: 0, pos: 0 }; }
  ok(s2.every(rw => rw.reaction === 'happy'), 'guest1 口味 70 -> "感觉很高兴"');
  ok(s2.every(rw => rw.clover >= 10 && rw.clover <= 60), '很高兴(蜜蜂档) 三叶草 10~60 [' + Math.min(...s2.map(s => s.clover)) + '~' + Math.max(...s2.map(s => s.clover)) + ']');

  /* 3) 一般(guest2, 30) -> 只给一点点; 不喜欢 -> 没有回礼 */
  st.guestFeedLog = []; feed(2, Number(cheap.id));
  const meh = st.guestFeed.reward;
  ok(meh.reaction === 'meh' && meh.clover >= 1 && meh.clover <= 10 && meh.ticket === 0, '口味一般 -> 只有 1~10 三叶草, 没有券 [' + JSON.stringify(meh) + ']');
  st.guestFeedLog = [];
  st.guestFeed = { id: 2, confirmed: true, served: false, expire_time: Math.floor(Date.now()/1000) + 300, pos: 0 };
  st.CharaDB = null;
  /* 直接把口味表改成 15 -> 不喜欢 */
  const dm = Tabikaeru.DataManager.instance;
  Tabikaeru.DataManager.instance = () => ({ ItemDB: { get: id => byId[Number(id)] || null, list: () => ITEMS },
                                            SpecialtyDB: { list: () => specRows },
                                            CharaDB: { src: { data: [{ id: 0, taste: tasteArr(95) }, { id: 1, taste: tasteArr(70) }, { id: 2, taste: tasteArr(15) }] } } });
  feed(2, Number(cheap.id));
  const bad = st.guestFeed.reward;
  Tabikaeru.DataManager.instance = dm;
  ok(bad.reaction === 'dislike' && bad.clover === 0 && bad.ticket === 0, '不喜欢的食物 -> 没有回礼 ["' + bad.text + '"]');

  /* 4) 稀有特产加成 */
  st.guestFeedLog = [];
  feed(0, Number(rare.id));
  const rwRare = st.guestFeed.reward;
  ok(rwRare.rare === 1 && rwRare.clover >= 50 && rwRare.ticket >= 3, '稀有(高价)特产: 额外 +20 三叶草 + 1~4 券 [' + JSON.stringify({ c: rwRare.clover, t: rwRare.ticket }) + ']');

  /* 5) 连续投喂惩罚 */
  const same = Number(cheap.id);
  st.guestFeedLog = [{ item_id: same }, { item_id: same }, { item_id: same }];
  feed(0, same);
  const pen = st.guestFeed.reward;
  ok(pen.penal === 1 && pen.clover >= 15 && pen.clover <= 25, '连续三次同一种 -> 三叶草减半 [' + pen.clover + ']');

  /* 6) 回礼在**离开时**寄出; 不投喂则没有 */
  st.guestFeedLog = []; st.extraMails = []; st.mailTaken = [];
  st.guestFeed = { id: -1, confirmed: false, served: false, expire_time: 0, pos: 0 };
  feed(1, Number(cheap.id));
  await sleep(100);
  const dynBefore = mailsOf(3).filter(m => Number(m.sender) >= 0).length;
  ok(dynBefore === 0, '投喂当下还没有邻居回礼邮件(回礼要等它离开) [' + dynBefore + ']');
  S['guest_finish']({});
  await sleep(200);
  const gift = mailsOf(3).filter(m => Number(m.sender) >= 0).slice(-1)[0];
  ok(!!gift, '访客离开后收到回礼邮件 [' + (gift && gift.title) + ']');
  ok(gift && Number(gift.sender) === 1, 'sender = 邻居编号(客户端显示对应头像) [' + (gift && gift.sender) + ']');
  ok(gift && Number(gift.resource.clover_point) > 0 && Number(gift.resource.ticket) > 0, '邮件 resource 里带三叶草与抽奖券 [' + JSON.stringify(gift && gift.resource) + ']');
  ok(gift && Array.isArray(gift.items) && gift.items.length >= 1, '还有一件特产附件 [' + JSON.stringify(gift && gift.items) + ']');
  const before = mails().length;
  st.guestFeed = { id: 1, confirmed: false, served: false, expire_time: Math.floor(Date.now()/1000) + 300, pos: 0 };
  S['guest_finish']({});
  await sleep(200);
  ok(mails().length === before, '没投喂过 -> 走了也没有回礼 [' + before + ' -> ' + mails().length + ']');

  /* 7) 邀约概率与喂食无关 */
  ok(Math.abs(window.MOCK_GUEST.inviteChance() - 0.22) < 1e-6, '邀约概率默认 22%(15%~30% 区间内)');
  st.inviteChance = 0.9; ok(window.MOCK_GUEST.inviteChance() === 0.9, 'st.inviteChance 可覆盖'); delete st.inviteChance;
  let invited = 0;
  for (let i = 0; i < 400; i++) {
    st.drawing = undefined;
    st.guestFeed = { id: 0, confirmed: true, served: i % 2 === 0, expire_time: Math.floor(Date.now()/1000) + 300, pos: 0 };
    if (i % 2 === 0) st.guestFeed.reward = { clover: 5, ticket: 2, treat: 0 };
    S['guest_finish']({});
    if (st.drawing && Number(st.drawing.state) === 1) invited++;
  }
  const rate = invited / 400;
  ok(rate > 0.13 && rate < 0.32, '邀约率 ' + (rate * 100).toFixed(1) + '% (与是否喂食无关, 目标 22%)');

  /* 8) 邮箱保管上限 100 */
  st.extraMails = []; st.mailTaken = []; st.clover = 0; st.ticket = 0;
  for (let i = 0; i < 130; i++) window.MOCK_ADD_MAIL({ type: 3, sender: 0, resource: { clover_point: 1, ticket: 0 }, items: [] });
  const liveCount = mails().length;
  ok(liveCount <= 100, '未领取邮件不超过 100 封 [' + liveCount + ']');
  ok(Number(st.clover) >= 30, '被挤掉的邮件里的三叶草自动收取 [' + st.clover + ']');

  console.log(fails() === 0 ? 'ALL GUEST-FEED CHECKS PASSED' : (fails() + ' CHECK(S) FAILED'));
  process.exit(fails() === 0 ? 0 : 1);
})();
