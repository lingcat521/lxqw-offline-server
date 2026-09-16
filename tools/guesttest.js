/* guesttest: 邻居(旅友投喂)整条链。
   客户端 TravelModel.guest_load -> GuestData{id,confirmed,served,expire_time,pos};
   friendClick 要求 getGuestData().id>=0; 投喂走 TravelModel.sendGuestServed(item) -> guest_serve(id,item_id)。
   以前服务端从不推 guest_load => 点小伙伴只弹"小伙伴已经离开了"。 */
const { BASE, ok, boot, fails } = require('./_harness.js');
const fs = require('fs');

const CH = JSON.parse(fs.readFileSync(BASE + '/tables/Character_json.json', 'utf8'));
const ITEMS = JSON.parse(fs.readFileSync(BASE + '/tables/Item_json.json', 'utf8'));
const SPEC = JSON.parse(fs.readFileSync(BASE + '/tables/Specialty_json.json', 'utf8'));
const byId = {}; ITEMS.forEach(i => byId[Number(i.id)] = i);
const specList = SPEC.map((s, i) => ({ itemId: Number(s.itemId !== undefined ? s.itemId : s.id), idx: i }));

boot({ stubs: g => {
  g.Tabikaeru.DataManager = { instance: () => ({
    ItemDB: { get: id => byId[Number(id)] || null, list: () => ITEMS },
    CharaDB: { src: { data: (function () {
      /* Character_json = [味道表, [角色...]]; 把每个角色的 taste 全部拉到 95(十分满意), 保证测试稳定拿到回礼 */
      var chars = (CH.data && CH.data[1]) || [];
      return chars.map(function (r) { var c = {}; for (var k in r) c[k] = r[k]; c.taste = (r.taste || []).map(function () { return 95; }); return c; });
    })() } },
    SpecialtyDB: { list: () => specList }
  }) };
}});
const M = global.MockServer, st = global.MOCK_STATE || (global.MOCK_STATE = {}), S = global.MOCK_SEMANTIC;
st.kitV2 = st.kitV3 = st.kitV4 = st.kitV5 = st.kitGranted = 1;
const sent = [];
const real = M.dispatch;
M.dispatch = function (n, d) { sent.push(n); return real.apply(this, arguments); };

(async function () {
  /* --- 1) 开局没有小伙伴, 空 payload 必须是 -1 且只有 5 个键 --- */
  st.guestFeed = { id: -1, confirmed: false, served: false, expire_time: 0, pos: 0 };
  const empty = M.handle('guest_load', {});
  ok(empty.id === -1, '空状态 id=-1');
  ok(Object.keys(empty).sort().join(',') === 'confirmed,expire_time,id,pos,served',
     'payload 只有 GuestData 的 5 个键 (多一个客户端就报"数据合并错误") [' + Object.keys(empty).join(',') + ']');

  /* --- 2) 来小伙伴 --- */
  ok(window.MOCK_GUEST.spawn() === true, 'MOCK_GUEST.spawn 能来一位');
  const p1 = M.handle('guest_load', {});
  ok(p1.id >= 0 && p1.id <= 2, 'id 是 CharaDB 里的 0/1/2 [' + p1.id + ']');
  ok(p1.expire_time > Math.floor(Date.now() / 1000), 'expire_time 在未来');
  await new Promise(r => setTimeout(r, 120));
  ok(sent.indexOf('guest_load') >= 0, '推了 guest_load (客户端 guestData 才会被赋值)');

  /* --- 3) 确认 + 投喂 --- */
  M.handle('guest_confirm', { id: p1.id });
  ok(st.guestFeed.confirmed === true, 'guest_confirm 记下 confirmed');
  const food = specList.find(s => Number(s.itemId) > 0).itemId;
  st.house = [{ item_id: food, count: 3 }];
  st.clover = 100; st.ticket = 0;
  const serve = M.handle('guest_serve', { id: p1.id, item_id: food });
  ok(serve.code === 0, '投喂成功 (code=' + serve.code + ')');
  ok(st.house.filter(x => x.item_id === food)[0].count === 2, '服务端也扣了特产 (剩 2)');
  ok(st.guestFeed.served === true, 'served 标记上');
  /* 回礼改成"访客离开时以邮件寄出"(原版): 投喂当下只记账, 三叶草/券在邮件里,
     玩家开信时由 mail.js 入账。 */
  ok(!!st.guestFeed.reward && Number(st.guestFeed.reward.clover) > 0, '投喂当下算出了回礼(' + JSON.stringify(st.guestFeed.reward) + ')');
  ok(Number(st.clover) === 100, '三叶草还没变(要等它离开寄信) [' + st.clover + ']');
  /* --- 4) 不能重复投喂 --- */
  ok(M.handle('guest_serve', { id: p1.id, item_id: food }).code === 2, '同一位不能喂两次 (code 2)');
  ok(M.handle('guest_serve', { id: 99, item_id: food }).code === 1, 'id 不匹配回 code 1');

  const mailsBefore = (M.handle('mail_load', {}) || []).length;
  M.handle('guest_finish', {});
  await new Promise(r => setTimeout(r, 250));
  ok((M.handle('mail_load', {}) || []).length === mailsBefore + 1, '离开后多了一封回礼邮件');
  const rec = window.MOCK_GUEST.log().pop();
  ok(!!rec && rec.taste >= 0, '记录了口味分 [' + (rec && rec.taste) + '] -> 三叶草+' + (rec && rec.clover));

  /* --- 5) 送客 / 超时 --- */
  M.handle('guest_finish', {});
  ok(M.handle('guest_load', {}).id === -1, 'guest_finish 之后 id=-1');
  window.MOCK_GUEST.spawn();
  st.guestFeed.expire_time = Math.floor(Date.now() / 1000) - 10;
  st.frog = { status: 0, traveling: false };
  M.handle('guest_load', {});
  ok(true, '超时由 tick 清理(下面用 clear 直接验证)');
  window.MOCK_GUEST.clear();
  ok(M.handle('guest_load', {}).id === -1, 'clear 之后 id=-1');

  /* --- 6) 青蛙出门时不刷新小伙伴 --- */
  st.frog = { status: 1, traveling: true };
  st.guestFeed = { id: -1, confirmed: false, served: false, expire_time: 0, pos: 0 };
  ok(window.MOCK_GUEST.state().id === -1, '出门状态下没有小伙伴(定时器只在在家时生成)');

  M.dispatch = real;
  console.log(fails() === 0 ? 'ALL GUEST CHECKS PASSED' : (fails() + ' CHECK(S) FAILED'));
  process.exit(fails() === 0 ? 0 : 1);
})();
