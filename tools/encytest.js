/* encytest: 植物百科 / 旅行百科。用户报「植物百科，旅行百科没有做」。
   契约(notes/research_task_achieve_ency_story.md §3):
     unlock_list = **long_id**(植物 id*10000+sub*100+pic, 旅行 id*10000+sub) —— 以前我们发主 id,
     客户端 list[101] 是 undefined 全被丢 -> 列表恒空;
     show_sub 里 sub_id 也必须是 long_id; set_show_sub 的请求参数名是 long_id;
     ⚠️ 旅行百科 unlock_list 为空会崩(EncyTravelView 对补位 {} 取 ItemDB.get(undefined).type)。 */
const { BASE, ok, boot, fails } = require('./_harness.js');
const fs = require('fs');
const ENC = JSON.parse(fs.readFileSync(BASE + '/tables/encyclopedia_json.json', 'utf8'));
const ETT = JSON.parse(fs.readFileSync(BASE + '/tables/encytravel_json.json', 'utf8'));
const ITEMS = JSON.parse(fs.readFileSync(BASE + '/tables/Item_json.json', 'utf8'));
const byId = {}; ITEMS.forEach(i => byId[Number(i.id)] = i);
const plantLong = Object.keys(ENC.list).map(Number);
const travelLong = Object.keys(ETT.list).map(Number);

boot({ stubs: g => {
  g.Tabikaeru.DataManager = { instance: () => ({
    ItemDB: { get: id => byId[Number(id)] || null, list: () => ITEMS },
    encyData: { get: k => ENC[k] || null },
    encyTravelData: { get: k => ETT[k] || null }
  }) };
}});
const st = global.MOCK_STATE || (global.MOCK_STATE = {});
const S = global.MOCK_SEMANTIC, M = global.MockServer;

(async function () {
  st.kitV2 = st.kitV3 = st.kitV4 = st.kitV5 = st.kitGranted = 1;
  st.party = { started: 0, guest: -1, ends: 0 }; st.partyLast = Math.floor(Date.now() / 1000);
  st.house = [{ item_id: 0, count: 1 }, { item_id: 1, count: 1 }];   /* 华夫饼/可丽饼 在仓库 */
  st.bag = [-1, -1, -1, -1]; st.desk = [-1, -1, -1, -1, -1, -1, -1, -1];
  st.tripLog = [{ items: [0, 1000] }]; st.flowerLog = []; st.encyShow = {};
  st.frog = { status: 0, traveling: false, returnAt: 0 };

  const pl = S['encyclopedia_load'](), tv = S['encytravel_load']();
  ok(Array.isArray(pl.unlock_list) && pl.unlock_list.length > 0, '植物百科 unlock_list 非空 [' + pl.unlock_list.length + ']');
  ok(pl.unlock_list.every(id => plantLong.indexOf(Number(id)) >= 0), 'unlock_list 全是**表里的 long_id** (不是主 id)');
  ok(pl.unlock_list.every(id => Number(id) > 10000), 'long_id 形如 id*10000+sub*100+pic [' + pl.unlock_list.slice(0, 3).join(',') + ']');
  ok(Array.isArray(tv.unlock_list) && tv.unlock_list.length > 0, '旅行百科 unlock_list 非空(空数组会让窗口打不开) [' + tv.unlock_list.length + ']');
  ok(tv.unlock_list.every(id => travelLong.indexOf(Number(id)) >= 0), '旅行百科 unlock_list 也全是表里的 long_id');
  ok(Array.isArray(pl.unlock_desc) && pl.unlock_desc.length > 0 && pl.unlock_desc[0].id > 0, 'unlock_desc 是 [{id:主id,list:[...]}]');
  ok(Array.isArray(pl.show_sub) && pl.show_sub.length > 0 && plantLong.indexOf(Number(pl.show_sub[0].sub_id)) >= 0,
     'show_sub.sub_id 是 long_id [' + JSON.stringify(pl.show_sub.slice(0, 2)) + ']');

  /* 玩得多 -> 解锁更多 */
  const before = tv.unlock_list.length;
  st.house.push({ item_id: 3, count: 1 }, { item_id: 1000, count: 1 });
  const tv2 = S['encytravel_load']();
  ok(tv2.unlock_list.length >= before, '拥有更多食物 -> 旅行百科解锁只增不减 [' + before + ' -> ' + tv2.unlock_list.length + ']');

  /* 切换展示: 参数名 long_id */
  const target = Number(tv2.unlock_list[0]);        /* 只能切到已解锁的 long_id */
  const r = S['encytravel_set_show_sub']({ long_id: target });
  ok(r && r.code === 0, 'encytravel_set_show_sub 认 long_id 参数 (code=' + (r && r.code) + ')');
  ok(S['encytravel_set_show_sub']({ id: 12345 }).code === 1, '非法 long_id 被拒');
  const tv3 = S['encytravel_load']();
  const row = tv3.show_sub.filter(x => Number(x.sub_id) === target)[0];
  ok(row && Number(row.sub_id) === Number(target), '选择被记住并回给客户端 [' + JSON.stringify(row) + ']');

  /* 种过植物 -> 植物百科解锁 */
  const p0 = S['encyclopedia_load']().unlock_list.length;
  st.flowerLog = [{ plant: 101, at: Date.now() }];
  const p1 = S['encyclopedia_load']().unlock_list.length;
  ok(p1 > p0, '种过一株 -> 植物百科解锁变多 [' + p0 + ' -> ' + p1 + ']');

  console.log(fails() === 0 ? 'ALL ENCY CHECKS PASSED' : (fails() + ' CHECK(S) FAILED'));
  process.exit(fails() === 0 ? 0 : 1);
})();
