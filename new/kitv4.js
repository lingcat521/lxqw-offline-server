/* 合成(工作台)真正需要的三组材料 = ItemType.COMPOSE(16), sub_type 1/2/3 —— 客户端 updateView():
   三组数量都 >0 才允许开工, 否则图标被置灰(getBlackFilter)且不显示开工。以前我发的类型里没有 16, */
/* 所以工作台永远没有开工。这里一次性补发(kitV4)。 */
(function () {
  var st = window.MOCK_STATE || (window.MOCK_STATE = {});
  function lg(m) { try { console.log('[MOCK] ' + m); } catch (e) {} }
  function grant4() {
    if (st.kitV5) return true;
    var dm; try { dm = Tabikaeru.DataManager.instance(); } catch (e) { return false; }
    var db = dm && dm.ItemDB; if (!db || typeof db.list !== 'function') return false;
    var list = db.list() || []; if (!list.length) return false;
    st.house = Array.isArray(st.house) ? st.house : [];
    var n = 0, names = [];
    for (var i = 0; i < list.length; i++) {
      var it = list[i]; if (!it) continue;
      if (Number(it.type) !== 16) continue;
      var id = Number(it.id); if (!id) continue;
      var f = null;
      for (var j = 0; j < st.house.length; j++) if (st.house[j] && Number(st.house[j].item_id) === id) f = st.house[j];
      if (f) { if ((Number(f.count) || 0) < 5) f.count = 5; } else st.house.push({ item_id: id, count: 5 });
      names.push(id + '(' + (it.sub_type || '?') + ')'); n++;
    }
    if (!n) return false;               /* 一件都没发到就别打标记, 下次再试 */
    st.kitV5 = 1; try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {}
    /* 立刻刷新客户端物品栏: 否则界面仍显示数量 0(要重启才更新) */
    try {
      var M2 = window.MockServer, S2 = window.MOCK_SEMANTIC || {};
      var payload = (typeof S2['item_load_items'] === 'function') ? S2['item_load_items']() : {};
      M2 && M2.dispatch && M2.dispatch('item_load_items', payload);
    } catch (e) {}
    lg('补发(kitV5): 合成材料 ' + n + ' 种 ' + names.join(',') + ' | house 共 ' + st.house.length);
    return true;
  }
  var t = 0, iv = setInterval(function () { if (grant4() || ++t > 60) clearInterval(iv); }, 1000);
/* 探针: 对比服务端 house 里的 8501-8503 与客户端 ItemModel 的 COMPOSE(16) 列表 */
(function () {
  var n = 0;
  var iv = setInterval(function () {
    n++; if (n > 12) { clearInterval(iv); return; }
    try {
      var st = window.MOCK_STATE || {};
      var srv = [];
      var h = Array.isArray(st.house) ? st.house : [];
      for (var i = 0; i < h.length; i++) { var id = Number(h[i] && h[i].item_id); if (id >= 8500 && id <= 8599) srv.push(id + '=' + (h[i].count)); }
      var cli = 'n/a';
      try {
        var IM = window.ItemModel, mm = core.ModelManage.getInstance(), m = (typeof IM === 'function') ? mm.getModel(IM) : null;
        var t = (m && m.getHouseItemsByType) ? m.getHouseItemsByType(Tabikaeru.DataType.ItemType.COMPOSE) : null;
        if (t) { var a = []; for (var j = 0; j < t.length && j < 6; j++) a.push(t[j].item_id + '=' + t[j].count); cli = 'len' + t.length + ' [' + a.join(',') + ']'; }
      } catch (e) { cli = 'err:' + (e && e.message); }
      console.log('[MOCK] COMPOSE probe: srv[' + srv.join(',') + '] cli ' + cli);
    } catch (e) {}
  }, 3000);
})();
/* 菜单/工作台通用探针: 包住 ItemModel.getHouseItemsByType, 记录每个界面按类型取物品的结果 */
(function () {
  function hook() {
    try {
      var IM = window.ItemModel;
      if (typeof IM !== 'function' || !IM.prototype || IM.prototype.__probed) return false;
      var orig = IM.prototype.getHouseItemsByType;
      if (typeof orig !== 'function') return false;
      IM.prototype.__probed = 1;
      IM.prototype.getHouseItemsByType = function (type, n) {
        var r = orig.apply(this, arguments);
        try {
          var a = [];
          if (r) for (var i = 0; i < r.length && i < 6; i++) a.push(r[i].item_id + '=' + r[i].count);
          console.log('[MOCK] BYTYPE type=' + type + ' -> len' + ((r && r.length) || 0) + ' [' + a.join(',') + ']');
        } catch (e) {}
        return r;
      };
      return true;
    } catch (e) { return false; }
  }
  var t = 0, iv = setInterval(function () { if (hook() || ++t > 60) clearInterval(iv); }, 1000);
})();
/* 强制刷新: item_load_items 结束时客户端会 dispatch ItemEventType.updateAllItemInfo;
   这里周期性重复触发同一事件, 让工具栏/工作台等视图重新读取数量(解决"界面停在 0")。 */
(function () {
  var n = 0;
  var iv = setInterval(function () {
    n++; if (n > 20) { clearInterval(iv); return; }
    try {
      var IM = window.ItemModel, mm = core.ModelManage.getInstance();
      var m = (typeof IM === 'function') ? mm.getModel(IM) : null;
      if (!m || !m.dispatchEvent) return;
      var ET = window.ItemEventType;
      if (!ET || !ET.updateAllItemInfo) return;
      m.dispatchEvent(new core.Event(ET.updateAllItemInfo));
      if (n <= 3) { try { console.log('[MOCK] 强制刷新物品视图 #' + n); } catch (e) {} }
    } catch (e) {}
  }, 4000);
})();
/* 深度探针: 合成视图 BoxCraftView.updateView 之后, 打印它算出的三组数量与拼板图/使能状态 */
(function () {
  function hook() {
    try {
      var V = window.BoxCraftView;
      if (typeof V !== 'function' || !V.prototype || V.prototype.__probed2) return false;
      var orig = V.prototype.updateView;
      if (typeof orig !== 'function') return false;
      V.prototype.__probed2 = 1;
      V.prototype.updateView = function () {
        var r = orig.apply(this, arguments);
        try {
          var a = this.lbNum1 && this.lbNum1.text, b = this.lbNum2 && this.lbNum2.text, c = this.lbNum3 && this.lbNum3.text;
          var img = this.imageShow && this.imageShow.source;
          var g = [this.group1, this.group2, this.group3].map(function (x) { return x && x.filters ? 'gray' : 'on'; });
          console.log('[MOCK] BOXCRAFT nums=' + a + '/' + b + '/' + c + ' groups=' + g.join(',') + ' img=' + img);
        } catch (e) {}
        return r;
      };
      return true;
    } catch (e) { return false; }
  }
  var t = 0, iv = setInterval(function () { if (hook() || ++t > 60) clearInterval(iv); }, 1000);
})();
/* 自动挂探针: 不猜类名 —— (1) 包住所有含 updateView 的视图类; (2) 包住 addChild, 记录含 craft/bench/tool/compose 的视图被打开 */
(function () {
  var seen = {};
  function wrapViews() {
    var n = 0;
    for (var k in window) {
      try {
        var C = window[k];
        if (typeof C !== 'function' || !C.prototype || C.prototype.__autoProbe) continue;
        var u = C.prototype.updateView;
        if (typeof u !== 'function') continue;
        C.prototype.__autoProbe = 1;
        (function (name, orig) {
          C.prototype.updateView = function () {
            var r = orig.apply(this, arguments);
            try {
              if (!seen[name]) {
                seen[name] = 1;
                var info = [];
                ['lbNum1','lbNum2','lbNum3','group1','bench','param','param2'].forEach(function (p) {
                  try { if (this[p] !== undefined) info.push(p + '=' + (this[p] && this[p].text !== undefined ? this[p].text : (typeof this[p] === 'object' ? 'obj' : this[p]))); } catch (e) {}
                }, this);
                console.log('[MOCK] VIEWCALL ' + name + ' ' + info.join(' '));
              }
            } catch (e) {}
            return r;
          };
        })(k, u);
        n++;
      } catch (e) {}
    }
    return n;
  }
  function wrapAddChild() {
    try {
      var D = egret.DisplayObjectContainer;
      if (!D || D.prototype.__autoProbe2) return false;
      D.prototype.__autoProbe2 = 1;
      var orig = D.prototype.addChild;
      D.prototype.addChild = function (child) {
        try {
          var nm = (child && child.constructor && child.constructor.name) || '';
          if (/craft|bench|tool|compose|box/i.test(nm) && !seen['AC:' + nm]) { seen['AC:' + nm] = 1; console.log('[MOCK] ADDCHILD ' + nm); }
        } catch (e) {}
        return orig.apply(this, arguments);
      };
      return true;
    } catch (e) { return false; }
  }
  var t = 0, iv = setInterval(function () { var a = wrapViews(); var b = wrapAddChild(); if ((a && b) || ++t > 90) clearInterval(iv); }, 1000);
})();
})();