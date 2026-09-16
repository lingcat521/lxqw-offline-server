/* friendtest: 旅友笔记(2000-2002 -> 客户端 GiftModel.isOpen) + StoryGift(6) 回礼邮件。
   审计发现: rules.js 的 NOTE_IDS 只有 1000..1029 ⇒ 三张旅友笔记永远不发 ⇒ 礼品盒永远打不开;
   story_send_gift 之后没有任何地方产生回礼邮件 ⇒ 客户端永远发不出 story_feedback_gift。 */
const H = require('./_harness.js');
const fs = H.fs, BASE = H.BASE, ok = H.ok;
H.boot();
const M = global.MockServer, st = () => window.MOCK_STATE, S = () => window.MOCK_SEMANTIC;

(async function () {
  st().kitV2 = st().kitV3 = st().kitV4 = st().kitV5 = st().kitGranted = 1;
  const notes = () => (st().notes || []).map(n => Number(n.id));

  /* --- 1) 故事解锁 -> 同时给旅友笔记 --- */
  st().notes = [];
  st().tripLuggage = [13, 1009, 6, 1002];
  const got = window.MOCK_STORY_ROLL();
  ok(!!got, '解锁一个故事 (' + (got && got.id) + ')');
  const want = 2000 + Number(got.partner);
  ok(notes().indexOf(want) >= 0, '同时发了旅友笔记 ' + want + ' (客户端 GiftModel 靠它开礼品盒) [' + notes().join(',') + ']');

  /* 客户端契约: Note 表里这三张 factorType2="Friends", TravelFriendsDB.visitOpen = 2000/2001/2002 */
  const NOTE_TABLE = JSON.parse(fs.readFileSync(BASE + '/tables/Note_json.json', 'utf8'));
  const noteRows = NOTE_TABLE.note || NOTE_TABLE;
  const row = (Array.isArray(noteRows) ? noteRows : Object.values(noteRows)).filter(n => Number(n.id) === want)[0];
  ok(!!row && row.factorType2 === 'Friends', '笔记 ' + want + ' 在客户端表里是 Friends 类 [' + (row && row.factorType2) + ']');
  const TF = JSON.parse(fs.readFileSync(BASE + '/tables/TravelFriends_json.json', 'utf8'));
  const opens = Object.keys(TF).map(k => Number(TF[k].visitOpen));
  ok(opens.indexOf(want) >= 0, '它是 TravelFriendsDB.visitOpen 之一 [' + opens.join(',') + ']');

  /* 不重复发 */
  const before = notes().filter(n => n === want).length;
  st().tripLuggage = [11, 12, 13, 14, 6, 7, 8, 9, 10, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010, 1013, 1014, 1015, 1016, 1100];
  let guard = 0;
  while (notes().filter(n => n === want).length === before && guard++ < 60) window.MOCK_STORY_ROLL();
  ok(notes().filter(n => n === want).length === before, '旅友笔记不会重复发 (还是 ' + before + ' 张)');

  /* --- 2) 送礼物 -> 8 秒后收到 StoryGift(6) 回礼邮件 --- */
  const mailsBefore = window.MOCK_MAIL_COUNT ? window.MOCK_MAIL_COUNT() : -1;
  const target = (S()['story_load']().stories[0] || {}).id;
  ok(!!target, '有一个已解锁故事可用于送礼 [' + target + ']');
  st().house = Array.isArray(st().house) ? st().house : [];
  st().house.push({ item_id: 3000, count: 1 });        /* 送礼必须真的拥有那件特产 */
  const r = M.handle('story_send_gift', { id: target, gift: 3000 });
  ok(r.code === 0, 'story_send_gift 成功');
  await new Promise(r2 => setTimeout(r2, 9000));
  const mails = M.handle('mail_load', {});
  const giftMail = (Array.isArray(mails) ? mails : []).filter(m => Number(m.type) === 6)[0];
  ok(!!giftMail, '收到 Mail.EvtId.StoryGift(6) 回礼邮件 [' + (giftMail && giftMail.title) + ']');
  ok(mails.length === mailsBefore + 1, '邮件总数 +1 (' + mailsBefore + ' -> ' + mails.length + ')');
  ok(giftMail && giftMail.resource && Number(giftMail.resource.ticket) >= 1, '回礼里带抽奖券 [' + (giftMail && giftMail.resource && giftMail.resource.ticket) + ']');
  if (giftMail) {
    /* 客户端点"是否感谢他的赠礼？" -> story_feedback_gift(id=mail id) */
    ok(M.handle('story_feedback_gift', { id: giftMail.id }).code === 0, 'story_feedback_gift 能处理这封信');
    ok(S()['story_load']().stories[0].feedback === 1, '故事 feedback 变成 1 (羁绊推进)');
  }

  console.log(H.fails() ? ('\nfriendtest: ' + H.fails() + ' FAILED') : '\nfriendtest: all checks passed');
  process.exit(H.fails() ? 1 : 0);
})();
