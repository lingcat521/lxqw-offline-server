/* 补发(第二批): 台面需要 type 12=工具 与 type 11=材料; 之前那一批发福利可能没把工具发进仓库,
   导致工具行全空、无法开工。这里按类型精确补发一次(kitV2)。 */
(function () {
  var st = window.MOCK_STATE || (window.MOCK_STATE = {});
  function lg(m) { try { console.log('[MOCK] ' + m); } catch (e) {} }
  function grant2() {
    if (st.kitV2) return true;
    var dm; try { dm = Tabikaeru.DataManager.instance(); } catch (e) { return false; }
    var db = dm && dm.ItemDB; if (!db || typeof db.list !== 'function') return false;
    var list = db.list() || []; if (!list.length) return false;
    st.house = Array.isArray(st.house) ? st.house : [];
    var want = { '11': 5, '12': 5, '13': 3 };   /* 材料 / 工具 / 图纸 */
    var n = 0;
    for (var i = 0; i < list.length; i++) {
      var it = list[i]; if (!it) continue;
      var t = String(it.type); if (!want[t]) continue;
      var id = Number(it.id); if (!id) continue;
      var num = want[t], f = null;
      for (var j = 0; j < st.house.length; j++) if (st.house[j] && Number(st.house[j].item_id) === id) f = st.house[j];
      if (f) { if ((Number(f.count) || 0) < num) f.count = num; }
      else st.house.push({ item_id: id, count: num });
      n++;
    }
    st.kitV2 = 1; try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {}
    lg('补发(kitV2): 工具/材料/图纸 ' + n + ' 种, house 共 ' + st.house.length + ' 种');
    return true;
  }
  var t = 0, iv = setInterval(function () { if (grant2() || ++t > 60) clearInterval(iv); }, 1000);
})();