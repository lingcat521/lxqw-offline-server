/* lxqw starter kit (B): 一次性发放图纸/材料/家具, 让玩家立刻能在手工界面制作与摆放。
   数据来自客户端自己的 ItemDB(按 type 过滤), 只发一次(存 st.kitGranted)。 */
(function () {
  var M = window.MockServer, st = window.MOCK_STATE || (window.MOCK_STATE = {});
  function save() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
  function lg(m) { try { console.log('[MOCK] ' + m); } catch (e) {} }
  function grant() {
    if (st.kitGranted) return true;
    var dm;
    try { dm = Tabikaeru.DataManager.instance(); } catch (e) { return false; }
    var db = dm && (dm.ItemDB || dm.ItemDB2 || dm.itemDB);
    if (!db || typeof db.list !== 'function') return false;
    var list = db.list() || [];
    if (!list.length) return false;
    st.house = Array.isArray(st.house) ? st.house : [];
    var KINDS = { '3': 1, '4': 1, '5': 1, '6': 1, '7': 1, '8': 1, '9': 1, '10': 1, '11': 1, '12': 1, '13': 1, '14': 1, '15': 1 };
    var n = 0;
    for (var i = 0; i < list.length; i++) {
      var it = list[i]; if (!it) continue;
      var t = String(it.type);
      if (!KINDS[t]) continue;
      var id = Number(it.id); if (!id) continue;
      var num = (t === '14') ? 1 : 20;
      var f = null;
      for (var j = 0; j < st.house.length; j++) if (st.house[j] && Number(st.house[j].item_id) === id) f = st.house[j];
      if (f) { if ((Number(f.count) || 0) < num) f.count = num; }
      else st.house.push({ item_id: id, count: num });
      n++;
    }
    st.kitGranted = 1; save();
    lg('发福利(B): 已发放 ' + n + ' 种图纸/材料/家具(house 共 ' + st.house.length + ' 种)');
    try { M.dispatch('item_load_items', (typeof S === 'object' && S && S['item_load_items']) ? S['item_load_items']() : {}); } catch (e) {}
    return true;
  }
  var t = 0;
  var iv = setInterval(function () { if (grant() || ++t > 60) clearInterval(iv); }, 1000);
})();