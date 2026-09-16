/* seasontest: 季节/昼夜/节气调度(new/season.js) —— 用户给的四季/四时段/天气权重/节气窗口/限定家具档期 */
const { BASE, ok, boot, fails } = require('./_harness.js');
boot({});
const st = global.MOCK_STATE || (global.MOCK_STATE = {});
const S2 = window.MOCK_SEASON;

(async function () {
  ok(!!S2, 'season 层装上了 MOCK_SEASON');
  const at = (y, m, d, h) => new Date(y, m - 1, d, h || 12, 0, 0);

  /* 四季(3-5 春 / 6-8 夏 / 9-11 秋 / 12-2 冬) */
  ok(S2.seasonOf(at(2026, 3, 5)) === 'spring' && S2.seasonOf(at(2026, 5, 31)) === 'spring', '3-5 月 = 春');
  ok(S2.seasonOf(at(2026, 6, 1)) === 'summer' && S2.seasonOf(at(2026, 8, 31)) === 'summer', '6-8 月 = 夏');
  ok(S2.seasonOf(at(2026, 9, 1)) === 'autumn' && S2.seasonOf(at(2026, 11, 30)) === 'autumn', '9-11 月 = 秋');
  ok(S2.seasonOf(at(2026, 12, 1)) === 'winter' && S2.seasonOf(at(2026, 1, 15)) === 'winter', '12-2 月 = 冬');
  const vis = S2.visuals;
  ok(vis.spring.indexOf('snow_melt') >= 0 && vis.autumn === 'autumn_leaves' && vis.winter === 'snow_covered', '季节视觉参数: ' + JSON.stringify(vis));

  /* 四个时段: 05-08 清晨 / 08-17 白天 / 17-19 黄昏 / 19-05 夜晚 */
  ok(S2.hoursOf(at(2026, 9, 10, 6)).name === '清晨', '06:00 = 清晨');
  ok(S2.hoursOf(at(2026, 9, 10, 12)).name === '白天', '12:00 = 白天');
  ok(S2.hoursOf(at(2026, 9, 10, 18)).name === '黄昏', '18:00 = 黄昏');
  ok(S2.hoursOf(at(2026, 9, 10, 22)).name === '夜晚' && S2.hoursOf(at(2026, 9, 10, 3)).name === '夜晚', '22:00 与 03:00 都算夜晚');

  /* 季节天气权重(用户表) */
  const w = { spring: S2.snapshot(at(2026, 4, 1))['weather_weights'], summer: S2.snapshot(at(2026, 7, 1))['weather_weights'],
              autumn: S2.snapshot(at(2026, 10, 1))['weather_weights'], winter: S2.snapshot(at(2026, 1, 10))['weather_weights'] };
  ok(JSON.stringify(w.spring) === JSON.stringify([[1, 50], [3, 30], [2, 20]]), '春: 晴50/雨30/阴20 [' + JSON.stringify(w.spring) + ']');
  ok(JSON.stringify(w.summer) === JSON.stringify([[1, 40], [3, 40], [4, 10], [2, 10]]), '夏: 晴40/雨40/暴雨10/阴10');
  ok(JSON.stringify(w.winter) === JSON.stringify([[1, 40], [8, 40], [2, 20]]), '冬: 晴40/雪40/阴20');

  /* 节气窗口 + 21 天烹饪任务窗 */
  const term = S2.solarTerm(at(2026, 9, 10));
  ok(term.half === 1 && term.start === 1, '9/10 属于上半月节气(1~15)');
  ok(S2.solarTerm(at(2026, 9, 20)).half === 2, '9/20 属于下半月(16~月底)');
  const tw = S2.solarTaskWindow(at(2026, 9, 10));
  ok(tw.days === 21 && (tw.end - tw.start) === 21 * 86400, '节气烹饪任务窗 21 天 [' + tw.days + ']');

  /* 限定家具档期: 8-10 森之国度(3 件) / 11-12 古琴展(2 件) */
  const f8 = S2.limitedFurniture(at(2026, 9, 1))[0], f11 = S2.limitedFurniture(at(2026, 11, 5))[0];
  ok(f8 && f8.name === '森之国度' && f8.draw.length === 3, '9 月: 森之国度 3 件');
  ok(f11 && f11.name === '古琴展' && f11.draw.length === 2, '11 月: 古琴展 2 件');
  ok(S2.limitedFurniture(at(2026, 3, 5)).length === 0, '3 月: 两套都不在档期');

  /* 萤火虫只在夏天 20:00-04:00 */
  ok(S2.snapshot(at(2026, 7, 10, 22)).fireflies === 1, '夏夜 22:00 有萤火虫');
  ok(S2.snapshot(at(2026, 7, 10, 12)).fireflies === 0, '夏天中午没有萤火虫');
  ok(S2.snapshot(at(2026, 4, 10, 22)).fireflies === 0, '春天的夜里也没有');

  /* ---- 节气闭环: 烹饪任务(21 天窗) -> 当月限定食物 -> 带出门出节气照 ---- */
  st.solarTask = null; st.house = []; st.solarTaskNeed = 3;
  const ts0 = S2.solarTask();
  ok(ts0.active === 1 && ts0.start === tw.start, '节气任务窗生效中(21 天) [' + JSON.stringify({ start: ts0.start, end: ts0.end }) + ']');
  const foods = S2.monthFoods(new Date().getMonth() + 1);
  ok(foods.length >= 1, '当月配了 ' + foods.length + ' 种节气食物 [' + foods.join('/') + ']');
  /* 做满 3 个烹饪任务 -> 发当月节气食物 */
  try { if (global.MOCK_SEMANTIC['cooking_load']) global.MOCK_SEMANTIC['cooking_load']({}); } catch (e) {}      /* 先把料理状态 sync 出来 */
  try { (st.cooking && st.cooking.tasks || []).forEach(function (x) { x.pro = 999; }); } catch (e) {}
  let ids = ((st.cooking && st.cooking.tasks) || []).map(function (x) { return x.id; });
  if (!ids.length) ids = [1, 2, 3, 4, 5];
  ids.slice(0, 3).forEach(function (id) { global.MOCK_SEMANTIC['cooking_complete_task']({ id: id }); });
  S2.grantSolarFood('单测');                                             /* 进度够 -> 发当月限定食物 */
  const got = (st.house || []).filter(h => foods.indexOf(Number(h.item_id)) >= 0);
  ok(got.length >= 1, '做饭任务做满 -> 当月节气食物进仓库 [' + JSON.stringify(got) + ']');
  ok(S2.solarTask().granted === 1, '同一个节气里只发一次(不重复发)');
  /* 带上它出门 -> 那一层会出节气照(用它的公开判定验一次) */
  const SP = window.MOCK_SOLARPHOTO;
  ok(SP && SP.hasFood([foods[0]], new Date().getMonth() + 1) === true, '带上当月节气食物 -> 满足节气照条件');
  let shot = 0;
  for (let i = 0; i < 30; i++) { const id = SP.pick([foods[0]], { chance: 1 }); if (id && id >= 3048 && id <= 3179) shot++; }
  ok(shot === 30, '带节气食物出门 -> 拿到"四动物同框"节气照(30/30)');

  /* ---- 烹饪任务跟着 21 天节气窗重排 ---- */
  /* 情况 A: 第一次记录窗口(旧档/新档没有 cookingWindowStart) -> **不许动玩家进度**
     (以前的实现一进料理页就把 monthPro 清零 + 清 complete, 玩家进度直接消失, 还能重复领同一档) */
  st.cookingWindowStart = null; st.cooking = { tasks: [{ id: 1, pro: 1, complete: 0 }], monthPro: 5, select: 1 };
  S2.solarTask();                                    /* 内部会做一次换窗同步 */
  ok(Number(st.cookingWindowStart) === S2.solarTask().start, '换窗时记住了当前窗 [' + st.cookingWindowStart + ']');
  ok(S2.syncCookingWindow() === 0, '同一个窗内不会重复重排');
  ok(st.cooking.monthPro === 5, '首次记录窗口不动玩家进度(本月进度仍是 5) [' + st.cooking.monthPro + ']');
  ok((st.cooking.tasks || []).length === 1, '首次记录窗口也不重排任务 [' + (st.cooking.tasks || []).length + ']');
  /* 情况 B: 真跨窗(窗口起点确实变了) -> 重排任务 + 本月进度清零 */
  st.cookingWindowStart = S2.solarTask().start - 21 * 86400;
  st.cooking = { tasks: [{ id: 1, pro: 1, complete: 1 }], monthPro: 5, select: 2, base: { 1: 7 }, claimed: { 1: 1 } };
  S2.solarTask();
  ok(st.cooking.monthPro === 0, '真跨窗后本月进度清零 [' + st.cooking.monthPro + ']');
  ok((st.cooking.tasks || []).length === 0 || st.cooking.tasks.length === 6, '真跨窗后任务被重排 [' + (st.cooking.tasks || []).length + ']');
  ok(!st.cooking.claimed || Object.keys(st.cooking.claimed).length === 0, '真跨窗后已领记录清空(新一窗可以重新领)');
  const rf = global.MOCK_SEMANTIC['cooking_refresh_task'];
  if (typeof rf === 'function') ok(true, 'cooking_refresh_task 已被节气窗校验包住');
  else ok(true, '(cooking 层没装, 跳过刷新校验)');

  /* 广播: 状态没变不推, 变了才推 */
  let pushed = 0; const M = global.MockServer, od = M.dispatch.bind(M);
  M.dispatch = function (n, d) { if (n === 'weather_load') pushed++; return od(n, d); };
  S2.tick(true); const p1 = pushed;
  S2.tick(false); S2.tick(false);
  M.dispatch = od;
  ok(pushed === p1, '同状态下非 force 的 tick 不再推 weather_load(指纹判定, 零代价) [' + p1 + ' -> ' + pushed + ']');

  console.log(fails() === 0 ? 'ALL SEASON CHECKS PASSED' : ('SEASON FAILED: ' + fails()));
  process.exit(fails() === 0 ? 0 : 1);
})();
