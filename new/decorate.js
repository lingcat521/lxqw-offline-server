/* lxqw offline decorate: 小屋装饰/摆花 (client_load_decorate / client_change_decorate).
 *
 * Client contract (RoleModel):
 *   client_load_decorate(e): decorationList = convertArray(e.has_list)   // [{id,num}]
 *                            decorationPutID = e.put_id, decorationStatus = e.status
 *   changeDecoration(id): send("client_change_decorate", Action2(resp))
 *        resp.code == 0 -> consume one of the old put_id, decorationPutID = id, status = 1
 *   client_load_role.frog.decoration is the same list, so it is kept in sync here.
 * decoration_json has 31 rows (蜡梅/木槿/桂花/丁香/水仙...), ids 100..; the player starts
 * with a couple of them so the 装饰 UI is not empty, and every 3rd trip brings one more.
 */
(function () {
  var M = window.MockServer, st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  function log(m) { try { console.log("[MOCK] " + m); } catch (e) {} }
  var DECO_IDS = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111];
  var START_WITH = 3;

  function arr(v) { return Object.prototype.toString.call(v) === "[object Array]" ? v : []; }
  function ds() {
    if (!Array.isArray(st.decorations)) {
      st.decorations = [];
      for (var i = 0; i < START_WITH; i++) st.decorations.push({ id: DECO_IDS[i], num: 1 });
    }
    if (typeof st.decoratePutId !== "number") st.decoratePutId = 0;
    if (typeof st.decorateStatus !== "number") st.decorateStatus = 0;
    return st.decorations;
  }
  function save() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
  function owned(id) { var l = ds(); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }

  S["client_load_decorate"] = function () {
    return { has_list: ds().map(function (d) { return { id: d.id, num: d.num }; }), put_id: st.decoratePutId, status: st.decorateStatus };
  };
  S["client_change_decorate"] = function (p) {
    var id = Number(p && p.id);
    var it = owned(id);
    if (!it) { log("装饰: 没有 id=" + id + " (拒绝)"); return { code: 1 }; }
    st.decoratePutId = id;
    st.decorateStatus = 1;
    save();
    log("装饰: 摆放 id=" + id + " (拥有 " + ds().length + " 种)");
    return { code: 0 };
  };

  /* roleData() carries the same list under frog.decoration - wrap, don't rewrite */
  var origRole = S["client_load_role"];
  S["client_load_role"] = function () {
    var d = (typeof origRole === "function") ? origRole() : origRole;
    try { if (d && d.frog) d.frog.decoration = ds().map(function (x) { return { id: x.id, num: x.num }; }); } catch (e) {}
    return d;
  };

  /* every 3rd completed trip brings a new 装饰 (离线沙盒的可获得途径) */
  var lastTrips = (typeof st.travelCount === "number") ? st.travelCount : 0;
  setInterval(function () {
    var trips = (typeof st.travelCount === "number") ? st.travelCount : 0;
    if (trips <= lastTrips) return;
    var gained = 0;
    while (lastTrips + 3 <= trips) {
      lastTrips += 3;
      for (var i = 0; i < DECO_IDS.length; i++) {
        if (!owned(DECO_IDS[i])) { ds().push({ id: DECO_IDS[i], num: 1 }); gained++; break; }
      }
    }
    if (gained) {
      save();
      log("装饰: 新增 " + gained + " 种 (共 " + ds().length + ")");
      setTimeout(function () { try { M.dispatch("client_load_decorate", S["client_load_decorate"]()); } catch (e) {} }, 40);
    }
  }, 1500);

  log("decorate ready: " + ds().length + " 种装饰, put_id=" + st.decoratePutId);
})();
