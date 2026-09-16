/* lxqw 家具风格与材料总量校验(离线) —— "8 种特殊材料决定风格 / 一套室内 27 个"
 *
 * 需求(目标⑦): 家具风格与材料的总量校验。
 *
 * 表里的真相(furnitureData_json 324 件 / furnitureCommon_json):
 *   · furnitureCommon 里 1~27 是**家具种类**: 墙壁/地面/阁楼/栏杆/窗户/仓门/帘幕/地图/床铺/花瓶/便签/书桌/
 *     坐垫/储柜/装饰/箱子/餐桌/餐椅/地毯/厨灶/厨杂/立镜/衣架/屏风/照明/衣柜/杂物 —— 正好 27 个,
 *     也就是"一套室内 = 27 个"。
 *   · furnitureData.style: 1~11 各有**恰好 27 件, 且 type 覆盖 1..27(每个种类一件)** —— 这就是一套完整室内;
 *     6 号(博古风格)多 2 件「书桌·古琴 / 衣柜·古琴」(古琴展限定), 100/101 是联动/活动风格(件数不全)。
 *   · 特殊材料 = Item_json type 11 且 id < 11000 的 8 件: 10101 岩纹石 / 10102 正丹纸 / 10103 棕榈叶 /
 *     10104 海螺贝 / 10105 紫檀木 / 10106 细篷布 / 10107 秋芦荻 / 10108 织彩带 —— 嘟嘟那儿 200 草一件。
 *     出什么风格由台面上的那件特殊材料决定(材质与风格同名: 石作/雨林/海洋/博古/露营/秋收/庆典…)。
 *
 * 对外: MOCK_FURNSTYLE{styles, materials, materialFor, stylesOf, validate, total, canMake}
 *   · validate() -> 逐风格校验"27 件 / 种类不重不漏", 家具制作前也会用它挡掉"材料与风格不符"的活。
 */
(function () {
  var st = window.MOCK_STATE || (window.MOCK_STATE = {});
  function log(m) { try { console.log('[MOCK] 家具风格: ' + m); } catch (e) {} }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

  function dm() { try { return Tabikaeru.DataManager.instance(); } catch (e) { return null; } }
  function furRows() {
    try {
      var d = dm(), db = d && (d.FurnitureDB || d.furnitureDB || d.FurnitureDataDB);
      var list = db && (typeof db.list === 'function' ? db.list() : db);
      if (Array.isArray(list) && list.length) return list;
    } catch (e) {}
    return st.furTable && st.furTable.length ? st.furTable : [];
  }
  function itemRows() {
    try { var d = dm(), db = d && d.ItemDB; return (db && typeof db.list === 'function') ? (db.list() || []) : []; } catch (e) { return []; }
  }
  function commonName(id) {
    try {
      var d = dm(), c = d && d.furnitureCommonDB;
      var list = c && (typeof c.list === 'function' ? c.list() : c);
      if (Array.isArray(list)) for (var i = 0; i < list.length; i++) if (num(list[i].id) === num(id)) return String(list[i].value || '');
    } catch (e) {}
    return '';
  }
  /* 家具种类(1~27) 与风格(1~11) 的中文名: 优先读表, 否则用内联同一份 */
  var KIND_FALLBACK = { 1: '墙壁', 2: '地面', 3: '阁楼', 4: '栏杆', 5: '窗户', 6: '仓门', 7: '帘幕', 8: '地图', 9: '床铺',
    10: '花瓶', 11: '便签', 12: '书桌', 13: '坐垫', 14: '储柜', 15: '装饰', 16: '箱子', 17: '餐桌', 18: '餐椅', 19: '地毯',
    20: '厨灶', 21: '厨杂', 22: '立镜', 23: '衣架', 24: '屏风', 25: '照明', 26: '衣柜', 27: '杂物' };
  var STYLE_FALLBACK = { 1: '素风格', 2: '石作风格', 3: '迎春·壬寅', 4: '雨林风格', 5: '海洋风格', 6: '博古风格',
    7: '露营风格', 8: '秋收风格', 9: '庆典·欢聚', 10: '迎春·癸卯', 11: '庆典·田园', 100: '联动风格(森之国度)', 101: '活动风格' };
  function styleName(s) { return commonName(1000 + num(s)) || STYLE_FALLBACK[num(s)] || ('风格' + s); }
  function kindName(t) { return commonName(num(t)) || KIND_FALLBACK[num(t)] || ('种类' + t); }

  /* 8 种特殊材料 -> 风格(材质对得上风格名) */
  var MATERIAL_STYLE = {
    10101: [2],          /* 岩纹石 -> 石作风格 */
    10102: [1, 3, 10],   /* 正丹纸 -> 素风格 / 迎春(贴红纸) */
    10103: [4, 100],     /* 棕榈叶 -> 雨林风格 / 联动(森之国度) */
    10104: [5],          /* 海螺贝 -> 海洋风格 */
    10105: [6],          /* 紫檀木 -> 博古风格(古琴展) */
    10106: [7],          /* 细篷布 -> 露营风格 */
    10107: [8],          /* 秋芦荻 -> 秋收风格 */
    10108: [9, 11, 101]  /* 织彩带 -> 庆典·欢聚 / 庆典·田园 / 活动 */
  };
  function materialIds() {
    var rows = itemRows(), out = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i]; if (!r) continue;
      var id = num(r.id);
      if (num(r.type) === 11 && id >= 10100 && id < 11000) out.push(id);
    }
    out.sort(function (a, b) { return a - b; });
    return out.length ? out : Object.keys(MATERIAL_STYLE).map(num);
  }
  function stylesOf(mat) { return (MATERIAL_STYLE[num(mat)] || []).slice(); }
  function materialFor(style) {
    var s = num(style), mats = materialIds();
    for (var i = 0; i < mats.length; i++) if (stylesOf(mats[i]).indexOf(s) >= 0) return mats[i];
    return mats.length ? mats[(Math.max(1, s) - 1) % mats.length] : 0;   /* 兜底: 按序号轮 */
  }
  /* 一件家具属于哪个风格 / 需要哪件特殊材料 */
  function styleOfFur(row) { return num(row && row.style); }
  function materialOfFur(row) { return materialFor(styleOfFur(row)); }

  /* ---- 总量校验: 每个风格是不是"27 件、种类 1..27 各一件" ---- */
  function group() {
    var rows = furRows(), by = {};
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i]; if (!r) continue;
      var s = styleOfFur(r);
      if (!s) continue;
      (by[s] = by[s] || []).push(r);
    }
    return by;
  }
  function validate() {
    var by = group(), out = { ok: true, styles: [], problems: [] }, s;
    for (s in by) {
      var rows = by[s], types = {}, dup = [], miss = [], i, t;
      for (i = 0; i < rows.length; i++) {
        t = num(rows[i].type);
        if (types[t]) dup.push(t); else types[t] = 1;
      }
      for (t = 1; t <= 27; t++) if (!types[t]) miss.push(t);
      var rec = { style: num(s), name: styleName(s), count: rows.length, material: materialFor(s),
                  dup: dup, missing: miss, full: (miss.length === 0 && rows.length >= 27) };
      out.styles.push(rec);
      /* 缺种类 = 这一套不完整(100/101 这类活动风格本来就只卖几件, 不算错) */
      if (miss.length && num(s) <= 11) { out.ok = false; out.problems.push('风格' + s + '(' + rec.name + ') 缺种类 ' + miss.join(',')); }
    }
    out.styles.sort(function (a, b) { return a.style - b.style; });
    out.base = out.styles.filter(function (r) { return r.style <= 11; });
    out.full = out.base.filter(function (r) { return r.full; }).length;
    out.materials = materialIds();
    out.materialCount = out.materials.length;
    return out;
  }
  /* 一套室内 27 件需要多少材料(总量) */
  function total(style, count) {
    var n = num(count) || 27;
    return { style: num(style), name: styleName(style), items: n, special: n, normal: n, material: materialFor(style) };
  }
  /* 制作校验: 台面上这件特殊材料能不能做这件家具 */
  function canMake(row, benchMaterials) {
    var style = styleOfFur(row), mats = (benchMaterials || []).map(num).filter(function (x) { return x > 0; });
    if (!style) return { ok: true, style: 0, why: '这件没有风格标记, 按普通件做' };
    if (!mats.length) return { ok: true, style: style, why: '台面没有特殊材料, 不校验风格' };
    for (var i = 0; i < mats.length; i++) {
      if (stylesOf(mats[i]).indexOf(style) >= 0) return { ok: true, style: style, name: styleName(style), material: mats[i], why: '材料对得上风格' };
    }
    return { ok: false, style: style, name: styleName(style), why: '台面的特殊材料(' + mats.join(',') + ')做不出「' + styleName(style) + '」' };
  }

  window.MOCK_FURNSTYLE = {
    styles: function () { return validate().styles; },
    materials: materialIds,
    materialFor: materialFor,
    stylesOf: stylesOf,
    styleOfFur: styleOfFur,
    materialOfFur: materialOfFur,
    kindName: kindName, styleName: styleName,
    validate: validate,
    total: total,
    canMake: canMake,
    summary: function () {
      var v = validate();
      return v.full + '/' + v.base.length + ' 个风格各 27 件(种类不重不漏), 特殊材料 ' + v.materialCount + ' 种, 问题 ' + v.problems.length;
    }
  };
  var summary = window.MOCK_FURNSTYLE.summary();
  log('校验: ' + summary);
  log('材料->风格: ' + materialIds().map(function (m) { return m + '→' + stylesOf(m).map(styleName).join('/'); }).join('  '));
})();
