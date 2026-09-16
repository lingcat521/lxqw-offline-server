/* friendgifttest: 旅友笔记(type2) -> 旅行笔记"旅友"栏 + 阁楼礼品盒 解锁链, 以及投喂回礼(手信)邮件。
   用户报:「旅行笔记的旅友也不能解锁」「阁楼上的屋内箱子（礼品盒）不可用」「喂食完小伙伴并没有手信」。
   客户端契约(notes/research_guestbook_drawing_friend.md §B/C):
     TravelNoteView tab1 = note_list 里 type2 (Note_json: id 2000..2026);
     GiftBoxModel.isOpen() = note_list 命中 TravelFriends.visitOpen=[2000,2001,2002] (单向闩锁);
     travel_load_gift = {pictures:[{id,pic_id}], specialtys:[{item_id,count}]};
     投喂回礼的三条通道里, 邮件 type=3(Gift)+sender=0..2 是最稳的一条(事件7在客户端是空操作)。 */
const { BASE, ok, boot, fails } = require('./_harness.js');
const fs = require('fs');
const NOTES = JSON.parse(fs.readFileSync(BASE + '/tables/Note_json.json', 'utf8'));
const FRIENDS = JSON.parse(fs.readFileSync(BASE + '/tables/TravelFriends_json.json', 'utf8'));
const ITEMS = JSON.parse(fs.readFileSync(BASE + '/tables/Item_json.json', 'utf8'));
const byId = {}; ITEMS.forEach(i => byId[Number(i.id)] = i);
const noteRows = Array.isArray(NOTES) ? NOTES : Object.keys(NOTES).map(k => NOTES[k]);
const noteById = {}; noteRows.forEach(r => noteById[Number(r.id)] = r);
const visitOpen = (Array.isArray(FRIENDS) ? FRIENDS : Object.keys(FRIENDS).map(k => FRIENDS[k]))
  .filter(r => r && r.visitOpen).map(r => Number(r.visitOpen));

boot({ stubs: g => {
  g.Tabikaeru.DataManager = { instance: () => ({ ItemDB: { get: id => byId[Number(id)] || null, list: () => ITEMS },
                                                 NoteDB: { get: id => noteById[Number(id)] || null, list: () => noteRows } }) };
}});
const st = global.MOCK_STATE || (global.MOCK_STATE = {});
const S = global.MOCK_SEMANTIC, M = global.MockServer;
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async function () {
  st.kitV2 = st.kitV3 = st.kitV4 = st.kitV5 = st.kitGranted = 1;
  st.party = { started: 0, guest: -1, ends: 0 }; st.partyLast = Math.floor(Date.now() / 1000);
  st.notes = []; st.gifts = []; st.photos = []; st.nextPhoto = 1; st.clover = 0; st.ticket = 0;
  st.house = [{ item_id: 3000, count: 2 }];
  st.frog = { status: 1, motion: 1, traveling: true, returnAt: Date.now() - 1000 };

  ok(visitOpen.length >= 3, 'TravelFriends 表里 visitOpen 的 id: [' + visitOpen.join(',') + ']');
  ok(visitOpen.every(id => noteById[id] && Number(noteById[id].type) === 2), '这些 id 在 Note 表里确实是 type2(旅友笔记)');

  /* --- 归来会发旅友笔记 --- */
  let friend = 0;
  for (let i = 0; i < 30 && !friend; i++) { await sleep(700); friend = st.notes.filter(n => Number(n.id) >= 2000 && Number(n.id) < 3000).length; }
  ok(friend >= 1, '旅行归来会拿到旅友笔记(type2) [' + friend + ']');
  const note = S['travel_load_note']();
  ok(Array.isArray(note.note_list) && note.note_list.length >= 1, 'travel_load_note 有 note_list [' + note.note_list.length + ']');
  const t2 = note.note_list.filter(n => { const r = noteById[Number(n.id)]; return r && Number(r.type) === 2; });
  ok(t2.length >= 1, '其中含 type2 -> 旅行笔记"旅友"栏不再恒 0/27 [' + t2.length + ']');
  ok(t2.every(n => typeof n.timestamp === 'number' && n.timestamp > 1e9), 'timestamp 是**秒**(客户端 Date.format(1e3*timestamp))');
  const hits = note.note_list.filter(n => visitOpen.indexOf(Number(n.id)) >= 0).length;
  ok(hits >= 1, 'note_list 命中 visitOpen -> GiftBoxModel.isOpen() 为真(礼品盒按钮出现) [' + hits + ']');

  /* --- 礼品盒内容形状 --- */
  st.photos.push({ id: st.nextPhoto++, pic_id: 100 });
  st.gifts = [{ item_id: 3001, count: 2 }];
  const g = S['travel_load_gift']();
  ok(Array.isArray(g.pictures) && g.pictures.every(p => p.id !== undefined && p.pic_id !== undefined), 'travel_load_gift.pictures 每项有 {id,pic_id} [' + JSON.stringify(g.pictures) + ']');
  ok(Array.isArray(g.specialtys) && g.specialtys.every(s => Number(s.item_id) > 0 && Number(s.count) > 0), 'specialtys 每项是 {item_id,count} [' + JSON.stringify(g.specialtys) + ']');

  /* --- 投喂回礼: 邮件 type3 + sender --- */
  const before = S['mail_load'] ? S['mail_load']() : null;      /* mail_load 回的是数组 */
  const n0 = Array.isArray(before) ? before.length : 0;
  st.guestFeed = { id: 1, confirmed: true, served: false, expire_time: Math.floor(Date.now() / 1000) + 300, pos: 0 };
  st.house.push({ item_id: 3005, count: 1 });
  const r = S['guest_serve']({ id: 1, item_id: 3005 });
  ok(r && r.code === 0, '投喂成功 (code=' + (r && r.code) + ')');
  /* 原版: 回礼是**访客离开后**通过邮箱寄回的(投喂当下只算好) */
  ok(!!st.guestFeed.reward && Number(st.guestFeed.reward.clover) > 0, '投喂当下算出了回礼 [' + JSON.stringify(st.guestFeed.reward) + ']');
  S['guest_finish']({});
  await sleep(400);
  const mails = S['mail_load']() || [];
  /* 回礼邮件: 三叶草/券在 resource 里, 附件是那件特产; 反应等级为"一般"时只有少量三叶草、没有附件 */
  const giftMail = mails.filter(m => Number(m.type) === 3 && Number(m.sender) >= 0 && Number(m.sender) <= 2 &&
    (Number(m.resource && m.resource.clover_point) > 0 || (m.items || []).length > 0));
  ok(giftMail.length >= 1, '投喂后收到邻居回礼邮件(type3 + sender 0..2 + 附件) [' + (mails.length - n0) + ' 封新邮件]');
  ok(giftMail.every(m => m.resource && m.resource.ads_id !== undefined), '邮件 resource 带 ads_id(客户端 revice_mails 无保护读它)');

  /* --- 图鉴 collections 只含 Collection 表 id(0..61) --- */
  const hb = S['item_load_handbook']();
  ok(Array.isArray(hb.collections) && hb.collections.every(id => Number(id) >= 0 && Number(id) <= 61), 'item_load_handbook.collections 全是 0..61 [' + JSON.stringify(hb.collections.slice(0, 6)) + ']');

  console.log(fails() === 0 ? 'ALL FRIEND/GIFT CHECKS PASSED' : (fails() + ' CHECK(S) FAILED'));
  process.exit(fails() === 0 ? 0 : 1);
})();
