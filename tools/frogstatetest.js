/* frogstatetest: /storage/emulated/0/new.txt 的「青蛙状态机」。
   居家 = 吃饭/看书/打瞌睡/写信/做手工, 随机触发、循环出现、每次很久(客户端自己的 Frogpattern/FrogMotionNum 决定动作);
   另有 收拾行囊 / 饥饿等待 / 饿晕一直睡 / 离家出走(空行李 ~10 小时, 桌上放食物才回来) /
   自主出发(背包有吃的 + 在家待够) / 访客排期(2/5/8 次后蜗牛/蜜蜂/乌龟, 之后每 3 次) / 称号效果。 */
const { BASE, ok, boot, fails } = require('./_harness.js');
const fs = require('fs');
const ITEMS = JSON.parse(fs.readFileSync(BASE + '/tables/Item_json.json', 'utf8'));
const ACH = JSON.parse(fs.readFileSync(BASE + '/tables/Achieve_json.json', 'utf8'));
const byId = {}; ITEMS.forEach(i => byId[Number(i.id)] = i);
const achRows = Array.isArray(ACH) ? ACH : Object.keys(ACH).map(k => ACH[k]);
let spawned = [];
boot({ stubs: g => {
  g.Tabikaeru.DataManager = { instance: () => ({
    ItemDB: { get: id => byId[Number(id)] || null, list: () => ITEMS },
    AchieveDB: { get: id => achRows.filter(r => Number(r.id) === Number(id))[0] || null, list: () => achRows },
    CharaDB: { src: { data: [{ id: 0 }, { id: 1 }, { id: 2 }] } }
  }) };
  /* 客户端那张动作表: 与 main.min.js @Tabikaeru.Define 一致 */
  g.Tabikaeru.Define = {
    FrogPatternMax: 3,
    Frogpattern: {
      0: ['eat','eat','eat','eat','doku','doku','doku','doku','doku_s','doku_s','make','make','make'],
      1: ['eat','eat','doku','doku','doku','doku','doku_s','doku_s','write','write','write','write','write'],
      2: ['write','write','write','write','eat','eat','make','make','make','make','write','write','write']
    },
    FrogMotionNum: { doku: 0, doku_s: 1, write: 2, make: 3, eat: 4 },
    FrogMotionName: { 0: 'dokusyo_ie', 1: 'inemuri_ie', 2: 'hikki_ie', 3: 'sagyou_ie', 4: 'syokuzi_ie', 10: 'sleep_1', 11: 'sleep_2', 12: 'sleep_3', 13: 'sleep_4' }
  };
}});
const st = global.MOCK_STATE || (global.MOCK_STATE = {});
const S = global.MOCK_SEMANTIC, M = global.MockServer;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pushed = [];
const realDispatch = M.dispatch;
M.dispatch = function (n) { pushed.push(n); return realDispatch.apply(this, arguments); };

(async function () {
  st.kitV2 = st.kitV3 = st.kitV4 = st.kitV5 = st.kitGranted = 1;
  st.party = { started: 0, guest: -1, ends: 0 }; st.partyLast = Math.floor(Date.now() / 1000);
  st.frog = { status: 0, motion: -1, traveling: false, returnAt: 0 };
  st.bag = [-1,-1,-1,-1]; st.desk = [-1,-1,-1,-1,-1,-1,-1,-1];
  st.moments = []; st.achieves = []; st.house = [];

  /* --- 1) 居家动作来自客户端自己的表 --- */
  st.frog.motion = -1; st.frog.motionSince = 0; st.frog.motionHold = 0;
  window.MOCK_FROGSTATE.tick();                      /* 让它自己挑一个动作 */
  const m0 = window.MOCK_FROGSTATE.motion();
  ok([0,1,2,3,4].indexOf(m0.motion) >= 0, '动作是 FrogMotionNum 里的 0..4 [' + m0.motion + '/' + m0.name + ']');
  ok(['dokusyo_ie','inemuri_ie','hikki_ie','sagyou_ie','syokuzi_ie'].indexOf(m0.name) >= 0, '动画名是屋里能渲染的那几个 [' + m0.name + ']');
  /* 动作 2 = 写信/写日记: new/diary.js 注册成长动作, 一次 18~40 分钟且不可打断; 其它动作 3~12 分钟 */
  const holdOk = (m0.motion === 2) ? (m0.hold >= 18 * 60 && m0.hold <= 40 * 60) : (m0.hold >= 180 && m0.hold <= 720);
  ok(holdOk, '动作时长合理(写日记 18~40 分钟 / 其它 3~12 分钟) [' + m0.hold + 's, 动作' + m0.motion + ']');
  let seen = {};
  for (let i = 0; i < 40; i++) { seen[window.MOCK_FROGSTATE.next().motion] = (seen[window.MOCK_FROGSTATE.next().motion] || 0) + 1; }
  const kinds = Object.keys(seen).map(Number);
  ok(kinds.length >= 3, '循环里会出现多种动作(吃饭/看书/写信/手工/打瞌睡) [' + kinds.join(',') + ']');
  ok(kinds.every(k => k >= 0 && k <= 4), '绝不会用到 5..9(那是外面场景的锯/刷/凿, 屋里会不渲染)');
  /* 用户既要"实时推送"、又不要"代价"(精灵累积 = 反复重画)。
     方案: 动作**真的变了**才推 role + 重画; MOCK_REFRESH_ROOM 内部有"状态指纹", 同状态重复调用直接跳过。 */
  pushed.length = 0;
  const before = window.MOCK_FROGSTATE.motion().motion;
  window.MOCK_FROGSTATE.next();                       /* 强制换一个动作(值变了) */
  await sleep(150);
  ok(pushed.indexOf('client_load_role') >= 0, '动作变化时实时推 client_load_role [' + before + ' -> ' + window.MOCK_FROGSTATE.motion().motion + ']');
  pushed.length = 0;
  window.MOCK_REFRESH_ROOM && window.MOCK_ROOM_RESET_THROTTLE && window.MOCK_ROOM_RESET_THROTTLE();
  const same = window.MOCK_FROGSTATE.motion().motion;
  window.MOCK_REFRESH_ROOM && window.MOCK_REFRESH_ROOM('重复调用');
  ok((window.MOCK_REFRESH_ROOM ? window.MOCK_REFRESH_ROOM('再来一次') : 0) === 0, '同一个状态重复重画被指纹过滤(零代价) [' + same + ']');
  ok((st.moments || []).length >= 1, '动作会解锁小动作图鉴(misc_moment_load 可能被指纹/节流合并) [' + JSON.stringify(st.moments) + ']');

  /* --- 2) 收拾行囊 --- */
  st.desk = [0, 1000, -1, -1, -1, -1, -1, -1]; st.bag = [-1,-1,-1,-1];
  ok(window.MOCK_FROGSTATE.pack() === true, '桌上有东西 -> 收拾行囊');
  ok(st.bag.filter(x => Number(x) >= 0).length === 2 && st.desk.every(x => Number(x) < 0), '备用品进背包、桌子清空 [' + JSON.stringify(st.bag) + ']');

  /* --- 3) 自主出发: 背包有吃的只是"提升出门的想法", 走不走由它自己掷骰子 ---
     (原版: 备好行囊不会让它立刻出发; 所以这里是**概率**不是定时器) */
  st.frog = { status: 0, motion: 0, traveling: false, returnAt: 0, homeSince: Math.floor(Date.now()/1000) - 4*3600, desire: 0 };
  st.bag = [-1,-1,-1,-1]; st.desk = [-1,-1,-1,-1,-1,-1,-1,-1];
  st.furniture = { make: { id: 0 } };
  ok(window.MOCK_FROGSTATE.desire() === 0, '背包里没吃的 -> 出门的想法 0');
  ok(window.MOCK_FROGSTATE.roll(true) === false || st.frog.status === 0, '没吃的时强制也不走');
  st.bag = [0, 1000, 2000, -1];                              /* 便当 + 护身符 + 道具 */
  const d1 = window.MOCK_FROGSTATE.desire();
  ok(d1 > 0.35 && d1 <= 1, '备好东西 -> 想法涨到 ' + d1.toFixed(2));
  S['item_set_bag_completed']({ completed: true });           /* 按"准备"只加想法, 不出发 */
  await sleep(120);
  ok(st.frog.status === 0, '按了准备也不会立刻出发(想法 ' + window.MOCK_FROGSTATE.desire().toFixed(2) + ')');
  ok(window.MOCK_FROGSTATE.roll(true) === true && st.frog.status === 1, '它自己决定走的时候才出发 [' + st.frog.status + ']');

  /* --- 4) 饥饿/离家出走 --- */
  st.frog = { status: 0, motion: 0, traveling: false, returnAt: 0, homeSince: Math.floor(Date.now()/1000) };
  st.bag = [-1,-1,-1,-1]; st.desk = [-1,-1,-1,-1,-1,-1,-1,-1];
  st.runawaySeconds = 3600;
  window.MOCK_FROGSTATE.tick();
  ok(window.MOCK_FROGSTATE.state().hungry === true && Number(st.frog.emptySince) > 0, '背包和桌子都空 -> 进入饿肚子计时');
  st.frog.emptySince = Math.floor(Date.now()/1000) - 3700;
  window.MOCK_FROGSTATE.tick();
  ok(Number(st.frog.runaway) === 1 && Number(st.frog.status) === 1, '空行李超时 -> 离家出走(不会自己回来)');
  ok(Number(st.frog.returnAt) > Date.now() + 86400000, 'returnAt 被推得极远, 不会自动回家');
  st.desk = [0, -1, -1, -1, -1, -1, -1, -1];                 /* 在**桌上**放食物 */
  window.MOCK_FROGSTATE.tick();
  ok(Number(st.frog.runaway) === 0 && Number(st.frog.returnAt) < Date.now(), '桌上有吃的 -> 消气, 交给结算泵送它回家');

  /* --- 5) 社交排期: 2/5/8 次, 之后每 3 次 --- */
  const sched = n => { st.travelCount = n; st.guestSchedTrip = 0; st.guestFeed = { id: -1, confirmed: false, served: false, expire_time: 0, pos: 0 }; st.frog = { status: 0, traveling: false, returnAt: 0 };
                        window.MOCK_GUEST.schedule(); return Number(st.guestFeed.id); };
  ok(sched(2) === 0, '第 2 次旅行后来第一位邻居(蜗牛) [' + st.guestFeed.id + ']');
  ok(sched(5) === 1, '第 5 次旅行后来第二位(蜜蜂) [' + st.guestFeed.id + ']');
  ok(sched(8) === 2, '第 8 次旅行后来第三位(乌龟) [' + st.guestFeed.id + ']');
  ok(sched(11) === 0, '第 11 次(每 3 次一位)又来第一位 [' + st.guestFeed.id + ']');
  ok(sched(3) === -1, '不在排期点的次数不会硬塞访客 [' + st.guestFeed.id + ']');

  /* --- 6) 称号效果 --- */
  const noTitle = window.MOCK_TITLE.tripScale();
  const longId = achRows.filter(r => /出发超过24小时/.test(String(r.info)))[0];
  if (longId) { st.achieveId = longId.id; ok(window.MOCK_TITLE.tripScale() > noTitle, '「不归的旅途」类称号 -> 旅行时间变长 [' + window.MOCK_TITLE.tripScale() + ']'); }
  const richId = achRows.filter(r => /三叶草/.test(String(r.info)))[0];
  if (richId) { st.achieveId = richId.id; ok(window.MOCK_TITLE.cloverScale() > 1, '「青蛙之叶」类称号 -> 三叶草收益变多 [' + window.MOCK_TITLE.cloverScale() + ']'); }
  st.achieveId = 0;
  ok(window.MOCK_TITLE.tripScale() === 1 && window.MOCK_TITLE.cloverScale() === 1, '不戴称号就没有加成');

  /* --- 7) 玩家自己摆家具默认开着(用户澄清) --- */
  ok(window.MOCK_FURNISH && typeof window.MOCK_FURNISH.ui === 'function', '家具摆放层在');
  st.furnishUI = undefined;
  ok(window.MOCK_FURNISH.installUI() === true, '玩家自己摆家具 = 默认开启');
  st.furnishUI = 0;
  ok(window.MOCK_FURNISH.installUI() === false, 'st.furnishUI=0 才关掉');

  console.log(fails() === 0 ? 'ALL FROG-STATE CHECKS PASSED' : (fails() + ' CHECK(S) FAILED'));
  process.exit(fails() === 0 ? 0 : 1);
})();
