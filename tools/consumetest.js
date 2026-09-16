/* consumetest: 出发时行李必须被消耗 (不是永远留在背包里) */
const H = require('./_harness.js');
const ok = H.ok;
H.boot();
const M = global.MockServer;
const st = () => window.MOCK_STATE;

(async function () {
  M.handle('item_putin_bag', { pos: 1, id: 1000 });
  M.handle('item_putin_bag', { pos: 2, id: 2000 });
  M.handle('item_putin_desk', { pos: 1, id: 3 });
  const before = M.handle('item_load_items', {});
  ok(before.bag.some(v => v >= 0), '准备前: 包里有东西 ' + JSON.stringify(before.bag));
  ok(before.desk.some(v => v >= 0), '准备前: 桌上有食物 ' + JSON.stringify(before.desk));

  M.handle('item_set_bag_completed', { completed: true }); window.MOCK_FORCE_DEPART();
  const after = M.handle('item_load_items', {});
  ok(after.bag.every(v => v === -1), '出发后: 背包被消耗清空 ' + JSON.stringify(after.bag));
  /* 原版: 背包(包袱)才是这趟带走的, **桌子是备用物资**(回家后青蛙自己收进行囊) */
  ok(after.desk.some(v => Number(v) >= 0), '出发后: 桌上的备用物资还在 ' + JSON.stringify(after.desk));
  ok(Array.isArray(st().lastTripItems) && st().lastTripItems.length >= 2,
     '这次旅行带走了什么被记录下来 ' + JSON.stringify(st().lastTripItems));
  ok(after.bag_completed === 1, '出发后背包仍处于锁定状态 (bag_completed=1)');

  console.log(H.fails() ? '\nconsumetest: ' + H.fails() + ' FAILED' : '\nconsumetest: all checks passed');
  process.exit(H.fails() ? 1 : 0);
})();
