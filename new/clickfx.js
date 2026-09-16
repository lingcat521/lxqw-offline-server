/* lxqw 点击特效(离线) —— “设置 → 点击特效”那套个性化视觉反馈
 *
 * 客户端契约(实测 main.min.js):
 *   OtherModel.initModel -> addProtocolCallback("other_load_touch")
 *     other_load_touch(e): this.data.cur_touch = e.cur; this.data.touch_list = convertArray(e.list)
 *     点屏幕时若 cur_touch>0 -> SpineView.load("click_effect_" + cur_touch) 播一次粒子动画
 *   设置页 updateTouchEffect(): cur_touch 为 0 显示"暂未获得", 否则图标 = goods_(503+cur_touch)_png;
 *     左右箭头 -> req_touch(id) -> send("other_req_touch", id) -> 回包 code==0 才改本地 cur_touch
 *
 * 资源(APK 里现成的): resource/China/animation/click/click_effect_1..4.json —— 只有 4 个特效可用,
 *   所以解锁表就以这 4 个为准(资源不存在的不发, 免得点下去什么都不播)。
 *
 * 服务端只管两个字段(用户给的方案): unlocked_click_effects / equipped_click_effect。
 */
(function () {
  var st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  function log(m) { try { console.log('[MOCK] 点击特效: ' + m); } catch (e) {} }
  function save() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function push(name, d, t) { setTimeout(function () { try { window.MockServer.dispatch(name, (typeof d === 'function' ? d() : d)); } catch (e) {} }, t || 60); }

  /* 资源里真实存在的 4 个特效(id = click_effect_N) */
  var EFFECTS = [
    { id: 1, name: '樱花',   from: '新手/节气' },
    { id: 2, name: '萤火虫', from: '夏日活动' },
    { id: 3, name: '落叶',   from: '秋季收集' },
    { id: 4, name: '雪花',   from: '冬季收集' }
  ];
  function fx() {
    st.clickFx = st.clickFx || {};
    if (!Array.isArray(st.clickFx.unlocked)) st.clickFx.unlocked = [];
    if (st.clickFx.cur === undefined) st.clickFx.cur = 0;
    return st.clickFx;
  }
  function payload() { var f = fx(); return { cur: num(f.cur), list: f.unlocked.slice() }; }
  function unlock(id, why) {
    var i = num(id), f = fx();
    if (!EFFECTS.some(function (e) { return e.id === i; })) { log('没有这个特效 ' + i + '(资源只有 1~4)'); return null; }
    if (f.unlocked.indexOf(i) >= 0) return null;
    f.unlocked.push(i);
    if (!num(f.cur)) f.cur = i;                       /* 第一个解锁的自动装备(设置页就不再是"暂未获得") */
    save();
    log('解锁点击特效 ' + i + ' [' + (why || '') + '] -> 已解锁 ' + JSON.stringify(f.unlocked) + ' 当前 ' + f.cur);
    push('other_load_touch', payload(), 60);
    return i;
  }
  function equip(id, why) {
    var i = num(id), f = fx();
    if (i !== 0 && f.unlocked.indexOf(i) < 0) return { code: 1 };   /* 没解锁不能装 */
    f.cur = i; save();
    log('装备点击特效 -> ' + i + ' [' + (why || '') + ']');
    push('other_load_touch', payload(), 40);
    return { code: 0 };
  }
  S['other_load_touch'] = function () { return payload(); };
  S['other_req_touch'] = function (p) {
    /* 客户端 send("other_req_touch", id) —— 参数可能是裸数字, 也可能是 {id} */
    var id = (typeof p === 'number' || typeof p === 'string') ? num(p) : num(p && (p.id !== undefined ? p.id : p.cur));
    return equip(id, '客户端切换');
  };
  /* 给任务/节气/商店用的统一入口 */
  window.MOCK_CLICKFX = {
    effects: function () { return EFFECTS.map(function (e) { var f = fx(); return { id: e.id, name: e.name, from: e.from, unlocked: f.unlocked.indexOf(e.id) >= 0, cur: num(f.cur) === e.id }; }); },
    state: payload, unlock: unlock, equip: equip,
    /* 节气/任务结算里调用: 没解锁过就按季节给一个(春1 夏2 秋3 冬4) */
    grantBySeason: function (season, why) {
      var m = { 1: 1, 2: 2, 3: 3, 4: 4 }[num(season)] || 1;
      return unlock(m, why || ('季节 ' + season));
    },
    reset: function () { st.clickFx = { unlocked: [], cur: 0 }; save(); return 0; }
  };
  /* other_load_touch 是纯推送协议 -> 启动补推一次(和花盆/绘本一个套路) */
  setTimeout(function () { try { push('other_load_touch', payload(), 500); } catch (e) {} }, 1300);
  st.clickFx = st.clickFx || { unlocked: [], cur: 0 };
  log('就绪: 资源里可用的特效 ' + EFFECTS.map(function (e) { return e.id + ':' + e.name; }).join(' ') +
      ' | 已解锁 ' + JSON.stringify(fx().unlocked) + ' 当前 ' + fx().cur);
})();
