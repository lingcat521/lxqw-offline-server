/* 祈愿手工的"图纸/模板"是物品 1001-1004 / 2001-2004 / 3001-3004 / 4001-4004 (prayData.paper),
   玩家没有它们 -> 工作台算不出配方 -> 没有开工。这里一次性补给(kitV3)。 */
(function () {
  var st = window.MOCK_STATE || (window.MOCK_STATE = {});
  function lg(m) { try { console.log('[MOCK] ' + m); } catch (e) {} }
  function grant3() {
    if (st.kitV3) return true;
    var dm; try { dm = Tabikaeru.DataManager.instance(); } catch (e) { return false; }
    var db = dm && dm.ItemDB; if (!db || typeof db.get !== 'function') return false;
    st.house = Array.isArray(st.house) ? st.house : [];
    var ids = [1001,1002,1003,1004,2001,2002,2003,2004,3001,3002,3003,3004,4001,4002,4003,4004,7000,7001,8000,8001,8002,8003,8004];
    var n = 0;
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i], row = db.get(id);
      if (!row) continue;
      var f = null;
      for (var j = 0; j < st.house.length; j++) if (st.house[j] && Number(st.house[j].item_id) === id) f = st.house[j];
      if (f) { if ((Number(f.count) || 0) < 3) f.count = 3; } else st.house.push({ item_id: id, count: 3 });
      n++;
    }
    st.kitV3 = 1; try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {}
    lg('补发(kitV3): 祈愿模板/工具/特殊材料 ' + n + ' 种, house 共 ' + st.house.length + ' 种');
    return true;
  }
  var t = 0, iv = setInterval(function () { if (grant3() || ++t > 60) clearInterval(iv); }, 1000);
})();