/* lxqw 明信片池: 按类型 / 目的地 / 行李加权抽卡。
 *
 * 为什么需要: 以前 rules.js 是 `PIC_IDS[Math.floor(Math.random()*PIC_IDS.length)]` —— 60 个 id 均匀随机,
 * 而客户端表 tables/Picture_json.json 里一共 351 张:
 *   Normal 39 / Tools 28 / Goal(目的地照) 151 / Unique(稀有·旅友相关) 133
 * 实测覆盖率 Normal 39/39、Tools 21/28、**Goal 0/151、Unique 0/133** ⇒ 目的地照与稀有照永远不掉,
 * 清单 §5"明信片: 从明信片池按权重抽取"、§10"合照概率: 携带特定道具提高"两条都没实现。
 *
 * 规则(数据全部来自客户端表):
 *   · 只从 **有图层数据** 的 id 里抽(window.MOCK_PICTURES, 343 张) —— 客户端 loadPicture 会读
 *     `pic.layers.length`, 没有图层的 id 会让明信片打不开/崩;
 *   · 出发/归来时随机定一个目的地(Goal 照片的 `place`), 记进 st.tripPlace, 让照片与日记/故事对得上;
 *   · 权重: 普通 42 / 道具 13 / 目的地 30 / 稀有 = 10% 起, 每带 1 件护身符(type 1 道具) +7%, 上限 45%;
 *   · 返回 pic id; 由 rules.js 的 comeBack() 调用(window.MOCK_PICK_PHOTO)。
 */
(function () {
  var st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var ROWS = null, LAYERS = null, POOLS = null;
  function log(m) { try { console.log('[MOCK] 明信片: ' + m); } catch (e) {} }

  function layerIds() {
    if (LAYERS) return LAYERS;
    var L = window.MOCK_PICTURES || {}, out = {};
    for (var k in L) if (Object.prototype.hasOwnProperty.call(L, k)) out[Number(k)] = 1;
    LAYERS = out;
    return out;
  }
  function rows() {
    if (ROWS) return ROWS;
    try {
      var db = Tabikaeru.DataManager.instance().PictureDB;
      var list = (db && typeof db.list === 'function') ? db.list() : null;
      if (list && list.length) ROWS = list;
    } catch (e) {}
    if (!ROWS) ROWS = [];                      /* 兜底: 没有表时用 id 区间猜(见 guessType) */
    return ROWS;
  }
  function guessType(id) {                     /* 与真实表一致的区间兜底 */
    if (id >= 2000 && id < 3000) return 'Goal';
    if (id >= 3000 && id < 4000) return 'Unique';
    return id < 200 ? 'Tools' : 'Normal';
  }
  function pools() {
    if (POOLS) return POOLS;
    var L = layerIds(), list = rows(), byPlace = {}, p = { normal: [], tools: [], unique: [], goalByPlace: byPlace };
    for (var i = 0; i < list.length; i++) {
      var r = list[i]; if (!r) continue;
      var id = Number(r.id); if (!id || !L[id]) continue;      /* 只收有图层的 */
      var t = String(r.type || guessType(id));
      if (t === 'Goal') {
        var pl = Number(r.place || 0);
        if (pl > 0) (byPlace[pl] = byPlace[pl] || []).push(id);
      } else if (t === 'Unique') p.unique.push(id);
      else if (t === 'Tools') p.tools.push(id);
      else p.normal.push(id);
    }
    if (!list.length) {                        /* 没有任何表: 用 MOCK_PICTURES 的 id 区间兜底 */
      for (var k in L) {
        var id2 = Number(k), t2 = guessType(id2);
        if (t2 === 'Goal') { var pl2 = 1 + (id2 % 30); (byPlace[pl2] = byPlace[pl2] || []).push(id2); }
        else if (t2 === 'Unique') p.unique.push(id2);
        else if (t2 === 'Tools') p.tools.push(id2);
        else p.normal.push(id2);
      }
    }
    POOLS = p;
    return p;
  }
  function pickFrom(a) { return a.length ? a[Math.floor(Math.random() * a.length)] : 0; }
  function amuletCount(items) {
    var n = 0;
    try {
      var db = Tabikaeru.DataManager.instance().ItemDB;
      for (var i = 0; i < (items || []).length; i++) {
        var d = db && db.get ? db.get(Number(items[i])) : null;
        if (d && Number(d.type) === 1) n++;      /* type 1 = 道具/护身符(四叶草 1000、护符 1300-1309…) */
      }
    } catch (e) {}
    return n;
  }
  /* 称号效果(用户表): 佩戴"漂泊的旅人"->照片偏道具; "独自旅行/散步好天气"->偏风景(少动物) */
  try {
    var _bias = (window.MOCK_TITLE && window.MOCK_TITLE.photoBias) ? window.MOCK_TITLE.photoBias() : null;
    if (_bias) console.log('[MOCK] 明信片: 称号偏向 -> ' + _bias);
  } catch (e) {}
  window.MOCK_PICK_PHOTO = function (items) {
    var p = pools();
    var places = Object.keys(p.goalByPlace);
    var place = places.length ? Number(places[Math.floor(Math.random() * places.length)]) : 0;
    st.tripPlace = place;                        /* 目的地: 让本次的照片/日记/故事用同一个 */
    var am = amuletCount(items);
    var rare = Math.min(0.45, 0.10 + 0.07 * am);
    var w = [
      ['normal', 42],
      ['tools', 13],
      ['goal', 30],
      ['unique', Math.round(rare * 100)]
    ];
    var total = 0, i;
    for (i = 0; i < w.length; i++) total += w[i][1];
    var r = Math.random() * total, kind = 'normal';
    for (i = 0; i < w.length; i++) { r -= w[i][1]; if (r <= 0) { kind = w[i][0]; break; } }
    var id = 0;
    if (kind === 'goal') id = pickFrom(p.goalByPlace[place] || []);
    if (!id && kind === 'unique') id = pickFrom(p.unique);
    if (!id && kind === 'tools') id = pickFrom(p.tools);
    if (!id) { kind = 'normal'; id = pickFrom(p.normal); }
    if (!id) { kind = 'any'; id = Number(Object.keys(layerIds())[0]) || 100; }
    log('抽到 ' + kind + ' id=' + id + (place ? (' 目的地=' + place) : '') + ' 护符×' + am + ' 稀有率=' + Math.round(rare * 100) + '%');
    return id;
  };
  window.MOCK_PICTURE_STATS = function () {
    var p = pools();
    return { normal: p.normal.length, tools: p.tools.length, unique: p.unique.length,
             goal: Object.keys(p.goalByPlace).reduce(function (a, k) { return a + p.goalByPlace[k].length; }, 0),
             places: Object.keys(p.goalByPlace).length, place: st.tripPlace || 0 };
  };
  var s = window.MOCK_PICTURE_STATS();
  log('池子就绪: 普通 ' + s.normal + ' / 道具 ' + s.tools + ' / 目的地 ' + s.goal + '(' + s.places + ' 个地点) / 稀有 ' + s.unique);
})();
