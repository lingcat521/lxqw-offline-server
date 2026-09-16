/* noticespamtest: 用户报「莫名其妙在弹出获得家具的提示」+「一堆关于家具与青蛙活动的状态弹窗」。
   两件事:
     A) 节奏: 家具制作以前 60 秒一件 -> 一晚上弹十几次。现在普通 600 秒、大件(墙壁/地面/阁楼/
        栏杆/窗户/仓门, type 1..6) 1800 秒, st.makeSeconds 可覆盖。
     B) 打扰: 客户端的 TimerEvent 播报是模态的。MOCK_NOTICE 在"页面可见"时把播报挂起
        (同一 tag 只留最新一条), 页面重新可见(visibilitychange)或 /gm flush 时补播;
        st.noticeMode = auto(默认) / always(原版总是弹) / never。
       数据更新(item_load_items / furniture_load_furniture)不受影响 —— 家具照样进列表。 */
const { BASE, ok, boot, fails } = require('./_harness.js');
const fs = require('fs');

const ITEMS = JSON.parse(fs.readFileSync(BASE + '/tables/Item_json.json', 'utf8'));
const FURN = JSON.parse(fs.readFileSync(BASE + '/tables/furnitureData_json.json', 'utf8'));
const byId = {}; ITEMS.forEach(i => byId[Number(i.id)] = i);
const furRows = Object.keys(FURN).map(k => FURN[k]);
const furById = {}; furRows.forEach(r => furById[Number(r.id)] = r);

/* 页面可见(document.hidden=false) —— 玩家正盯着游戏 */
const listeners = {};
global.document = { hidden: false, addEventListener: (n, f) => { (listeners[n] = listeners[n] || []).push(f); } };
function setHidden(v) { global.document.hidden = v; }
function fireVisibility() { (listeners.visibilitychange || []).forEach(f => f()); }

boot({ stubs: g => {
  g.Tabikaeru.DataType = { ItemType: { FURNITURE_RESOURCE: 10, FURNITURE_ITEM: 11, FURNITURE_TOOL: 12, FURNITURE_PAPER: 13, COMPOSE: 16 } };
  g.Tabikaeru.Define = { ComposeId: 5502 };
  g.Tabikaeru.DataManager = { instance: () => ({
    ItemDB: { get: id => byId[Number(id)] || null, list: () => ITEMS },
    FurnitureDB: { get: id => furById[Number(id)] || null, list: () => furRows }
  }) };
}});
const st = global.MOCK_STATE || (global.MOCK_STATE = {});
const S = global.MOCK_SEMANTIC, M = global.MockServer;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const notices = [];
const realDispatch = M.dispatch;
M.dispatch = function (n, d) {
  if (n === 'notify_new_event' && d && d.event) notices.push(d.event);
  return realDispatch.apply(this, arguments);
};

(async function () {
  st.kitV2 = st.kitV3 = st.kitV4 = st.kitV5 = st.kitGranted = 1;
  st.furnitureUnlockAll = 0;
  st.party = { started: 0, guest: -1, ends: 0 };
  st.frog = { status: 0, traveling: false, returnAt: 0 };
  st.house = [{ item_id: 10301, count: 1 }, { item_id: 10201, count: 1 }, { item_id: 10102, count: 5 }, { item_id: 10001, count: 20 }];
  st.furniture = { bench: [10201, -1, -1, -1, -1, 10102, -1, -1, -1, -1], has_fur: [], put_fur: [], box: [], bought: [] };

  /* --- A) 制作耗时 --- */
  ok(window.MOCK_MAKE.default === 600, '普通家具默认 600 秒(以前 60 秒 -> 弹窗刷屏) [' + window.MOCK_MAKE.default + ']');
  ok(window.MOCK_MAKE.big === 1800, '大件(墙壁/地面/阁楼…)1800 秒 [' + window.MOCK_MAKE.big + ']');
  st.makeSeconds = 0;
  window.MOCK_MAKE.tick();
  const mk = window.MOCK_MAKE.state().make;
  ok(!!mk && mk.id > 0, '青蛙在家 + 台面有工具材料 -> 开工 (家具' + (mk && mk.id) + ')');
  /* 制作改成分段(原版实测): 每段 90 秒、1~3 段一件; 期间工作台锁住(客户端"呱~不许动") */
  ok(Number(mk.seconds) === 90, '每一段 90 秒(原版实测约 1 分 30 秒) [' + mk.seconds + ']');
  ok(Number(mk.sessions) >= 1 && Number(mk.sessions) <= 3, '一件分 ' + mk.sessions + ' 段做完');
  ok(Number(mk.endsAt) - Number(mk.started) === Number(mk.seconds), 'endsAt 与 started 差 = 这一段的时长');
  ok([5, 6, 7, 8, 9].indexOf(Number(mk.motion)) >= 0, '这一段播的是庭院工序动画 motion=' + mk.motion);
  st.makeSeconds = 5;
  ok(window.MOCK_MAKE.seconds() === 5, '/gm make 能覆盖耗时 [' + window.MOCK_MAKE.seconds() + ']');
  st.makeSeconds = 0;
  ok(String(window.MOCK_MAKE.seconds()).indexOf('600') === 0, '传 0 回到默认 [' + window.MOCK_MAKE.seconds() + ']');

  /* --- B) 播报策略 --- */
  notices.length = 0;
  ok(window.MOCK_NOTICE(21, [], { evt_id: 1 }, 'furniturefinish') === null, '页面可见时播报被挂起(返回 null)');
  await sleep(120);
  ok(notices.length === 0, '挂起的播报不会立刻推给客户端 [' + notices.length + ']');
  ok(window.MOCK_FLUSH_NOTICES() === 1, 'flush 把挂起的那条补播出去');
  await sleep(120);
  ok(notices.length === 1 && Number(notices[0].evt_type) === 21, '补播的确实是 FurnitureFinish(21) [' + JSON.stringify(notices[0] && notices[0].evt_type) + ']');

  notices.length = 0;
  setHidden(true);
  window.MOCK_NOTICE(24, [0, 0, -1, 1], { evt_id: 0 }, 'partyresult');
  await sleep(120);
  ok(notices.length === 1 && Number(notices[0].evt_type) === 24, '页面不可见时照常排队(回来正好看到) [' + notices.length + ']');
  setHidden(false);

  notices.length = 0;
  window.MOCK_NOTICE(23, [], {}, 'partygo');
  window.MOCK_NOTICE(23, [], {}, 'partygo');
  window.MOCK_NOTICE(23, [], {}, 'partygo');
  ok(window.MOCK_FLUSH_NOTICES() === 1, '同一个 tag 只留最新一条(不堆一屏)');
  await sleep(120);
  ok(notices.length === 1, '补播也只有一条 [' + notices.length + ']');

  notices.length = 0;
  st.noticeMode = 'always';
  window.MOCK_NOTICE(22, [], {}, 'furnitureput');
  await sleep(120);
  ok(notices.length === 1, 'noticeMode=always 恢复原版(总是弹) [' + notices.length + ']');
  notices.length = 0;
  st.noticeMode = 'never';
  window.MOCK_NOTICE(22, [], {}, 'furnitureput');
  await sleep(120);
  ok(notices.length === 0, 'noticeMode=never 一条都不弹');
  st.noticeMode = 'auto';

  /* --- C) 制作完成: 数据照样更新, 播报按策略 --- */
  notices.length = 0;
  st.furniture.make = { id: Number(row.id), drawing: Number(row.drawing), started: Math.floor(Date.now() / 1000) - 5000,
                        tool: 10201, mat: 10102, res: 10001, seconds: wantSecs, endsAt: 0 };
  window.MOCK_MAKE.finish();
  await sleep(160);
  ok(st.furniture.has_fur.indexOf(Number(row.id)) >= 0, '家具真的进了 has_fur [' + st.furniture.has_fur.join(',') + ']');
  ok(notices.filter(n => Number(n.evt_type) === 21).length === 0, '页面可见时不再打断玩家(没有 21 播报)');
  ok(window.MOCK_FLUSH_NOTICES() === 1, '但"获得新家具"仍然挂着, 回来会补播');

  /* --- D) 聚会不再由定时器产生(改由"访客离开 -> 门口邀请卡片 -> 准备手信"触发, 见 partyinvitetest) --- */
  st.frog.status = 0;
  ok(window.MOCK_PARTY && typeof window.MOCK_PARTY.start === 'function', '聚会层在(手动可发起)');
  ok(window.MOCK_PARTY.gap === undefined && !window.MOCK_PARTY.timer, '没有"每 N 分钟自己开一场"的定时器了');
  let auto = 0;
  for (let i2 = 0; i2 < 5; i2++) { if (window.MOCK_PARTY.busy && window.MOCK_PARTY.busy()) auto++; }
  ok(auto === 0 && Number(st.party.started) === 0, '没有邀请时一直不会有凭空的聚会');

  console.log(fails() === 0 ? 'ALL NOTICE-SPAM CHECKS PASSED' : (fails() + ' CHECK(S) FAILED'));
  process.exit(fails() === 0 ? 0 : 1);
})();
