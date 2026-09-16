/* mailtest: 邮箱不再崩 (2026-09-13T05:54:42 fillItems 读 items.length)
 * MailView.setInfo -> fillItems 读 mailInfo.items.length / mailInfo.resource.*，
 * 缺字段就会 TypeError 并让整局 reload。出口规范化后任何邮件都字段齐全。 */
const H = require('./_harness.js');
const ok = H.ok;
H.boot();
const M = global.MockServer;
const SHAPE = m => m && typeof m === 'object' && Array.isArray(m.items) && m.resource &&
                    typeof m.resource.clover_point === 'number' && typeof m.resource.ticket === 'number' &&
                    Array.isArray(m.pictures) && typeof m.id === 'number' && typeof m.type === 'number';

(async function () {
  const list = M.handle('mail_load', {});
  ok(Array.isArray(list), 'mail_load answers an array');
  ok(list.every(SHAPE), 'every mail in mail_load is complete (items/resource/pictures/id/type)');
  const page = M.handle('mail_load_mails', { start: 1, count: 5 });
  ok(page && Array.isArray(page.mails), 'mail_load_mails answers { mails }');
  ok(page.mails.every(SHAPE), 'every paged mail is complete as well');
  ok(typeof page.total === 'number' && typeof page.start === 'number', 'paging fields are numbers');

  ok(typeof window.MOCK_NORMALIZE_MAIL === 'function', 'the normaliser is exported for testing');
  const broken = window.MOCK_NORMALIZE_MAIL({ id: 9, title: 'x' });
  ok(SHAPE(broken), 'a mail payload without items/resource is completed instead of crashing the view');
  ok(broken.items.length === 0 && broken.resource.clover_point === 0, 'the missing parts become empty/zero, never undefined');
  const messy = window.MOCK_NORMALIZE_MAIL({ id: 10, items: [{ item_id: 3 }, null], resource: { clover_point: '5' } });
  ok(messy.items.length === 2 && messy.items[1].item_id === 0, 'a malformed item entry becomes a safe zero entry');
  ok(messy.resource.clover_point === 5 && messy.resource.ticket === 0, 'numeric fields are coerced, missing ones defaulted');

  console.log(H.fails() ? '\nmailtest: ' + H.fails() + ' FAILED' : '\nmailtest: all checks passed');
  process.exit(H.fails() ? 1 : 0);
})();
