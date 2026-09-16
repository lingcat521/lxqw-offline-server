/* lxqw 兑换码(离线) —— 邮箱 → "礼包码兑换"
 *
 * 客户端契约: send("item_use_gift_code", code) —— 协议表 item_use_gift_code:[["gift_code"],!0] (要回包)。
 *   回包 code: 0 = 成功(客户端接着弹"兑换成功"并展示奖励) / 1 = 无效或已兑换 / 2 = 已兑换过 / 4 = 过期。
 *   客户端那几句提示文案(1/2/3/4)就是这么用的。
 *
 * 私服规则(用户要求): **不看时效**, 但**每个码每个用户只能领一次**(st.cdkeyUsed 记已用)。
 *   奖励直接落到存档: 三叶草 / 四叶草(道具 1000) / 兑换券(ticket) / 任意道具 item_id。
 *   点击特效那几个码走 MOCK_CLICKFX.unlock(id)。
 */
(function () {
  var st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  function log(m) { try { console.log('[MOCK] 兑换码: ' + m); } catch (e) {} }
  function save() { try { if (window.MOCK_SAVE_NOW) window.MOCK_SAVE_NOW(); else if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function push(name, d, t) { setTimeout(function () { try { window.MockServer.dispatch(name, (typeof d === 'function' ? d() : d)); } catch (e) {} }, t || 60); }

  var FOUR_LEAF = 1000;                  /* 四叶草(一次性护身符) */
  /* 码表(用户给的清单; 大码一律大写比较, 输入不区分大小写) */
  var CODES = {
    CUQJEDTJHKDV: { clover: 200, four: 2, ticket: 10, note: '长期通用' },
    WAZAIAIMAMA: { clover: 100, note: '蛙仔爱麻麻' },
    WAZAILAILA: { clover: 100, note: '蛙仔来啦' },
    QW666: { clover: 66, note: '' },
    QW999: { clover: 99, note: '' },
    '给自己的信': { clover: 50, note: '邮箱-兑换码' },
    '把呱包成花束送给你': { clover: 50, note: '' },
    '小青蛙去淘宝人生串门啦': { clover: 50, ticket: 3, note: '' },
    '蛙的新年红包': { clover: 50, items: [{ id: 19, count: 1 }], note: '新年' },
    '五周年快乐蛙': { clover: 100, items: [{ id: 10108, count: 1 }], note: '周年庆' },
    '劳动蛙蛙最光荣': { clover: 50, items: [{ id: 19, count: 1 }], note: '劳动节' },
    '五一快乐蛙': { items: [{ id: 1104, count: 2 }], note: '博物馆门票×2' },
    '新的一年要加油蛙': { clover: 50, items: [{ id: 2010101, count: 1 }], note: '种子礼包(花种×1)' },
    '我看你像个兑换码': { four: 1, note: '' },
    '开学快乐蛙': { clover: 20, note: '' },
    '上班也快乐蛙': { clover: 20, note: '' },
    '再忙也常回家看看蛙': { clover: 20, note: '' },
    '又出BUG了': { clover: 50, note: '已失效(私服不看时效)' },
    '植物百科上线啦': { items: [{ id: 202101, count: 1 }], note: '一号水溶肥' },
    '旅行青蛙来小红书啦啦': { ticket: 3, four: 2, note: '小红书' },
    '向你致敬': { items: [{ id: 2010101, count: 1 }], note: '角堇·火龙果' },
    '新呱同乐之寻蜀道': { clover: 30, note: '新呱同乐' },
    '新呱同乐之报个到': { clover: 30, note: '新呱同乐' },
    '新呱同乐之好邻居': { clover: 30, note: '新呱同乐' },
    '新呱同乐之绿兔子': { clover: 30, note: '新呱同乐' },
    '新呱同乐之不迷路': { clover: 30, note: '新呱同乐' },
    '新呱同乐之博物馆': { clover: 30, note: '新呱同乐' },
    '新呱同乐之游京城': { clover: 30, note: '新呱同乐' },
    '旅行青蛙来小红书啦': { clover: 30, note: '小红书' },
    '蛙蛙在小红书做线下打卡旅行啦': { clover: 30, note: '小红书' },
    /* 私服自定义: 点击特效 + 520 三叶草 */
    CHUNFENG: { fx: 1, note: '樱花飞舞' },
    XIAYE: { fx: 2, note: '萤火微光' },
    QIUSE: { fx: 3, note: '银杏叶落' },
    WAGUA: { fx: 4, note: '蛙爪印记' },
    LINGCAT521: { clover: 521, four: 1, ticket: 3, repeat: true, note: '专属码(可重复领)' }
  };
  function used() { st.cdkeyUsed = arr(st.cdkeyUsed); return st.cdkeyUsed; }
  function key(raw) { return String(raw === undefined || raw === null ? '' : raw).trim().toUpperCase(); }
  function table() { var out = [], k; for (k in CODES) out.push({ code: k, note: CODES[k].note || '', used: used().indexOf(k) >= 0 }); return out; }

  function grant(code, r) {
    var st2 = st, got = [];
    if (num(r.clover)) { st2.clover = num(st2.clover) + num(r.clover); got.push('三叶草×' + r.clover); }
    if (num(r.four)) {
      st2.house = arr(st2.house);
      var f = null;
      for (var i = 0; i < st2.house.length; i++) if (num(st2.house[i].item_id) === FOUR_LEAF) f = st2.house[i];
      if (f) f.count = num(f.count) + num(r.four); else st2.house.push({ item_id: FOUR_LEAF, count: num(r.four) });
      got.push('四叶草×' + r.four);
    }
    if (num(r.ticket)) { st2.ticket = num(st2.ticket) + num(r.ticket); got.push('兑换券×' + r.ticket); }
    var list = arr(r.items);
    for (var j = 0; j < list.length; j++) {
      var it = list[j], found = null;
      st2.house = arr(st2.house);
      for (var h = 0; h < st2.house.length; h++) if (num(st2.house[h].item_id) === num(it.id)) found = st2.house[h];
      if (found) found.count = num(found.count) + num(it.count); else st2.house.push({ item_id: num(it.id), count: num(it.count) });
      got.push('道具' + it.id + '×' + it.count);
    }
    if (num(r.fx) && window.MOCK_CLICKFX) { window.MOCK_CLICKFX.unlock(num(r.fx), '兑换码 ' + code); got.push('点击特效' + r.fx + '(' + r.note + ')'); }
    /* 统一推一遍, 客户端各处数字立刻跟上 */
    push('clover_update', { clover: num(st.clover) }, 40);
    push('item_load_items', S['item_load_items'] ? S['item_load_items']() : null, 70);
    push('item_update_ticket', { ticket: num(st.ticket) }, 90);
    return got;
  }

  S['item_use_gift_code'] = function (p) {
    var k = key(p && (p.gift_code !== undefined ? p.gift_code : p.code));
    if (!k) return { code: 1 };
    var r = CODES[k];
    if (!r) { log('无效兑换码: ' + k); return { code: 1 }; }                    /* 1 = 无效或已被兑换过 */
    if (!r.repeat && used().indexOf(k) >= 0) { log('已领过: ' + k); return { code: 2 }; }   /* 2 = 已被兑换过; repeat 码不限次数 */
    if (!r.repeat) used().push(k);
    var got = grant(k, r);
    save();
    log('兑换成功 ' + k + (r.note ? '(' + r.note + ')' : '') + ' -> ' + got.join(' + ') + ' | 已用 ' + used().length + ' 个码');
    /* ⚠️ 客户端判定是 **200 == e.code** 才算成功(CdkeyView: if(200==e.code){关闭界面; "礼包码兑换成功"}),
       0/1/2/4 都会走 else 提示分支 —— 以前回 0, 于是"领到了但界面说失败"。 */
    return { code: 200, item_id: num(r.items && r.items[0] && r.items[0].id) || (num(r.clover) ? 100000 : 0),
             count: num(r.items && r.items[0] && r.items[0].count) || num(r.clover) || 0, tags_id: 0, type: 0 };
  };
  window.MOCK_CDKEY = {
    table: table, key: key, used: function () { return used().slice(); },
    add: function (code, reward) { CODES[key(code)] = reward || { clover: 50 }; return true; },   /* 私服想加码随时加 */
    reset: function () { st.cdkeyUsed = []; save(); return 0; }
  };
  st.cdkeyUsed = arr(st.cdkeyUsed);
  log('就绪: 码表 ' + Object.keys(CODES).length + ' 个, 已用 ' + used().length + ' 个(私服不看时效, 每码每人一次)');
})();
