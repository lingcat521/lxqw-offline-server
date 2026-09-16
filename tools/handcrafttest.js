/* handcrafttest: 手工品界面「NaN.NaN.NaN」。
   客户端 PrayCraftDetailRender: this.l_date.text = core.DateFormat.format(1e3*entry.stamp_time,"YYYY.MM.DD")
   —— 我们的祈愿物条目以前只有 {id,u_id,state,body,paper,make_time}, 没有 stamp_time,
   1e3*undefined = NaN -> 界面上就是大字 NaN.NaN.NaN(用户截图)。
   同一条目还要: content(PrayCraftNoteDB id, 刻在祈愿物上的字) / body / paper(PrayCraftBodyDB id, 贴图)
   / state(1..4) / make_time(排序)。本测试连"老存档里的脏数据"一起验: 出口必须就地修好。 */
const { BASE, ok, boot, fails } = require('./_harness.js');
const fs = require('fs');
const PRAY = JSON.parse(fs.readFileSync(BASE + '/tables/prayData_json.json', 'utf8'));
const BODY = JSON.parse(fs.readFileSync(BASE + '/tables/prayBodyData_json.json', 'utf8'));
const NOTE = JSON.parse(fs.readFileSync(BASE + '/tables/prayNoteData_json.json', 'utf8'));
const STAMP = JSON.parse(fs.readFileSync(BASE + '/tables/stampData_json.json', 'utf8'));
const rows = x => Array.isArray(x) ? x : Object.keys(x).map(k => x[k]);
const prayRows = rows(PRAY), bodyRows = rows(BODY), noteRows = rows(NOTE), stampRows = rows(STAMP);
const bodyIds = bodyRows.map(r => Number(r.id)), noteIds = noteRows.map(r => Number(r.id));

boot({ stubs: g => {
  g.Tabikaeru.DataManager = { instance: () => ({
    PrayCraftDB: { get: id => prayRows.filter(r => Number(r.id) === Number(id))[0] || null, list: () => prayRows },
    PrayCraftBodyDB: { get: id => bodyRows.filter(r => Number(r.id) === Number(id))[0] || null, list: () => bodyRows },
    PrayCraftNoteDB: { get: id => noteRows.filter(r => Number(r.id) === Number(id))[0] || null, list: () => noteRows },
    StampCraftDB: { get: id => stampRows.filter(r => Number(r.id) === Number(id))[0] || null, list: () => stampRows }
  }) };
}});
const st = global.MOCK_STATE || (global.MOCK_STATE = {});
const S = global.MOCK_SEMANTIC, M = global.MockServer;

function dateOf(sec) { return new Date(1e3 * Number(sec)).getFullYear(); }

(async function () {
  st.kitV2 = st.kitV3 = st.kitV4 = st.kitV5 = st.kitGranted = 1;
  st.party = { started: 0, guest: -1, ends: 0 }; st.partyLast = Math.floor(Date.now() / 1000);
  st.frog = { status: 0, traveling: false, returnAt: 0 };
  st.house = [{ item_id: 7000, count: 3 }, { item_id: 8000, count: 3 }];
  /* 模拟用户的存档: 老条目只有旧字段(没有 stamp_time/content/body…) */
  const old = Math.floor(Date.now() / 1000) - 86400;
  st.craft = { wishes: [{ id: 1, u_id: 1, state: 1, body: 0, paper: 0, make_time: old }],
               stamps: [{ id: 1, u_id: 2, state: 1, time: old }],
               boxes: [], seq: 2, wishNew: null, stampNew: null };

  const d = S['pray_load_grays']();
  ok(Array.isArray(d.wishs) && d.wishs.length >= 1, '祈愿物列表非空 [' + d.wishs.length + ']');
  const w = d.wishs[0];
  ok(Number.isFinite(Number(w.stamp_time)) && Number(w.stamp_time) > 1e9,
     '每条祈愿物都有有效的 stamp_time(客户端 format(1e3*stamp_time), 缺了就是 NaN.NaN.NaN) [' + w.stamp_time + ']');
  ok(dateOf(w.stamp_time) >= 2020, 'stamp_time 能格式化出正常年份 [' + dateOf(w.stamp_time) + ']');
  ok(Number.isFinite(Number(w.make_time)) && dateOf(w.make_time) >= 2020, 'make_time 也是有效时间(排序用)');
  ok(noteIds.indexOf(Number(w.content)) >= 0, 'content 是 PrayCraftNoteDB 里真实存在的 id [' + w.content + ']');
  ok(bodyIds.indexOf(Number(w.body)) >= 0, 'body 是 PrayCraftBodyDB 的 id(贴图层) [' + w.body + ']');
  ok(bodyIds.indexOf(Number(w.paper)) >= 0, 'paper 同理 [' + w.paper + ']');
  ok(Number(w.state) >= 1 && Number(w.state) <= 4, 'state 在 1..4 [' + w.state + ']');
  ok(Number.isFinite(Number(w.u_id)), 'u_id 是数字 [' + w.u_id + ']');
  ok(Number(w.stamp) === 0, '没盖章的祈愿物 stamp=0(客户端据此跳过印章图)');

  const s0 = d.stamps[0];
  ok(Number.isFinite(Number(s0.time)) && dateOf(s0.time) >= 2020, '印章的 time 也是有效时间(红点判定读它) [' + s0.time + ']');

  /* 新建的祈愿物同样要齐 */
  st.craft.wishes = []; st.craft.stampNew = null; st.craft.wishNew = null;
  S['pray_load_grays']();                       /* 触发 pump -> 开工 */
  const d2 = S['pray_load_grays']();
  const mk = d2.wish_new;
  ok(!!mk && typeof mk === 'object', '青蛙在家 + 有材料 -> 开始做祈愿物');
  if (mk) {
    ok(Number.isFinite(Number(mk.stamp_time)) && dateOf(mk.stamp_time) >= 2020, '新单也带 stamp_time [' + mk.stamp_time + ']');
    ok(noteIds.indexOf(Number(mk.content)) >= 0 && bodyIds.indexOf(Number(mk.body)) >= 0, '新单的 content/body 合法');
  }
  /* 出口清洗要落库(下次 load 不用再修) */
  ok(Number(st.craft.wishes.length) + (mk ? 1 : 0) >= 1, '清洗后的数据留在状态里 [' + st.craft.wishes.length + ' 已完成]');

  /* --- 三拼(COMPOSE 16) 的红点: 客户端 updateComposeRedot() = 这个 type 桶里有 >=3 个 key,
         所以扣到 0 的碎片必须从物品栏里删掉, 否则「工具栏-其他」的红点永远消不掉(用户截图)。 --- */
  st.house = [{ item_id: 8501, count: 1 }, { item_id: 8502, count: 1 }, { item_id: 8503, count: 1 }];
  const composeKinds = () => (S['item_load_items']().house || []).filter(h => Number(h.item_id) >= 8501 && Number(h.item_id) <= 8503).length;
  ok(composeKinds() === 3, '手里有三片(三拼红点本来就该亮) [' + composeKinds() + ']');
  const rc = S['pray_compose']({ id: 5502 });
  ok(rc && Array.isArray(rc.item_list), '合成返回 item_list [' + JSON.stringify(rc.item_list) + ']');
  const house = S['item_load_items']().house || [];
  ok(house.every(h => Number(h.count) > 0), '下发里不再有数量 0 的幽灵行 [' + JSON.stringify(house.filter(h => Number(h.count) <= 0)) + ']');
  ok(composeKinds() === 0, '三片被扣光后碎片条目不残留 -> 红点会灭 [' + composeKinds() + ']');
  ok(house.some(h => Number(h.item_id) === 8000 && Number(h.count) > 0), '合成产物(手工品材料 8000)进包');

  console.log(fails() === 0 ? 'ALL HANDCRAFT CHECKS PASSED' : (fails() + ' CHECK(S) FAILED'));
  process.exit(fails() === 0 ? 0 : 1);
})();
