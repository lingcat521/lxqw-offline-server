/* lxqw offline rules: stateful gameplay model (generated) */
(function(){
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  var ITEM_PRICE = {"0": 10, "1": 30, "2": 50, "3": 80, "4": 100, "5": 100, "6": 100, "7": 100, "8": 100, "9": 100, "10": 100, "11": 100, "12": 100, "13": 100, "14": 100, "15": 100, "16": 100, "17": 100, "18": 100, "19": 90, "20": 100, "21": 100, "22": 100, "23": 100, "24": 100, "25": 100, "26": 100, "27": 100, "28": 100, "29": 100, "30": 100, "31": 100, "32": 100, "33": 100, "34": 100, "35": 100, "36": 100, "37": 100, "38": 100, "39": 100, "40": 100, "41": 100, "42": 100, "43": 100, "44": 100, "45": 100, "46": 100, "47": 100, "48": 100, "49": 100, "50": 100, "51": 100, "52": 100, "53": 100, "54": 100, "55": 100, "56": 100, "57": 100, "101": 100, "102": 100, "103": 100, "104": 100, "105": 100, "106": 100, "107": 100, "108": 100, "109": 100, "110": 100, "111": 100, "112": 100, "113": 100, "114": 100, "115": 100, "116": 100, "117": 100, "118": 100, "119": 100, "120": 100, "121": 100, "122": 100, "123": 100, "124": 100, "125": 100, "126": 100, "127": 100, "128": 100, "129": 100, "130": 100, "131": 100, "132": 100, "133": 100, "134": 100, "1000": 0, "1001": 3000, "1002": 0, "1003": 0, "1004": 0, "1005": 0, "1006": 0, "1007": 0, "1008": 0, "1009": 0, "1010": 0, "1011": 0, "1012": 100, "1013": 0, "1014": 0, "1015": 0, "1016": 0, "1017": 0, "1018": 0, "1019": 0, "1020": 0, "1021": 0, "1100": 0, "1101": 0, "1102": 0, "1103": 0, "1104": 0, "1105": 0, "1106": 0, "1200": 0, "1201": 0, "1202": 0, "1203": 0, "1204": 0, "1205": 0, "1206": 0, "1207": 0, "1208": 0, "1209": 0, "1210": 0, "1211": 0, "1212": 0, "1213": 0, "1214": 0, "1215": 0, "1300": 0, "1301": 0, "1302": 0, "1303": 0, "1304": 0, "1305": 0, "1306": 0, "1307": 0, "1308": 0, "1309": 0, "2000": 300, "2001": 450, "2002": 750, "2003": 450, "2004": 700, "2005": 1200, "2006": 600, "2007": 900, "2008": 1500, "2009": 150, "2010": 250, "2011": 400, "3000": 0, "3001": 0, "3002": 0, "3003": 0, "3004": 0, "3005": 0, "3006": 0, "3007": 0, "3008": 0, "3009": 0, "3010": 0, "3011": 0, "3012": 0, "3013": 0, "3014": 0, "3015": 0, "3016": 0, "3017": 0, "3018": 0, "3019": 0, "3020": 0, "3021": 0, "3022": 0, "3023": 0, "3024": 0, "3025": 0, "3026": 0, "3027": 0, "3028": 0, "3029": 0, "3030": 0, "3031": 0, "3032": 0, "3033": 0, "3034": 0, "3035": 0, "3036": 0, "3037": 0, "3038": 0, "4000": 0, "4001": 0, "4002": 0, "4003": 0, "4004": 0, "4005": 0, "4006": 0, "4007": 0, "4008": 0, "4009": 0, "4010": 0, "4011": 0, "4012": 0, "4013": 0, "4014": 0, "4015": 0, "4016": 0, "4017": 0, "4018": 0, "4019": 0, "4020": 0, "4101": 0, "4102": 0, "4103": 0, "4104": 0, "5001": "", "5002": "", "5003": "", "5101": "", "5102": "", "5103": "", "5104": "", "5105": "", "5501": "", "5502": "", "5601": "", "5602": "", "7000": 0, "7001": 0, "8000": 0, "8001": 0, "8002": 0, "8003": 0, "8004": 0, "8501": "", "8502": "", "8503": "", "9000": 0, "9001": 0, "9002": 0, "10001": "", "10002": "", "10003": "", "10004": "", "10005": "", "10006": "", "10007": "", "10101": "", "10102": "", "10103": "", "10104": "", "10105": "", "10106": "", "10107": "", "10108": "", "11001": "", "11101": "", "11102": "", "10201": "", "10202": "", "10203": "", "10204": "", "10205": "", "10211": "", "10212": "", "10213": "", "10214": "", "10215": "", "10221": "", "10222": "", "10223": "", "10224": "", "10225": "", "10301": "", "10302": "", "10303": "", "10304": "", "10305": "", "10306": "", "10307": "", "10308": "", "10309": "", "10310": "", "10311": "", "10312": "", "10313": "", "10314": "", "10315": "", "10316": "", "10317": "", "10318": "", "10319": "", "10320": "", "10321": "", "10322": "", "10323": "", "10324": "", "10325": "", "10326": "", "10327": "", "10401": "", "10501": "", "10601": "", "20001": "", "20002": "", "20003": "", "20004": "", "20005": "", "20006": "", "20101": "", "20102": "", "20103": "", "20104": "", "20105": "", "20106": "", "20107": "", "20108": "", "20109": "", "20110": "", "20111": "", "200000": "", "200001": "", "200002": "", "200003": "", "200004": "", "200005": "", "200006": "", "200007": "", "200008": "", "200009": "", "200010": "", "200011": "", "200012": "", "200013": "", "200014": "", "200015": "", "200016": "", "201001": "", "201002": "", "201003": "", "201004": "", "201005": "", "201006": "", "201007": "", "201008": "", "202101": "", "202102": "", "202103": "", "202104": "", "202105": "", "202106": "", "202107": "", "202108": "", "202109": "", "202110": "", "202111": "", "202211": "", "202212": "", "202213": "", "202221": "", "202222": "", "202223": "", "202231": "", "202232": "", "202233": "", "202241": "", "202242": "", "202243": "", "202244": "", "202251": "", "202252": "", "202253": "", "202254": "", "202261": "", "202262": "", "202263": "", "203001": "", "203002": "", "203003": "", "203004": "", "203005": "", "203006": "", "203007": "", "203011": "", "203012": "", "203013": "", "203014": "", "203015": "", "203016": "", "203017": "", "203021": "", "203022": "", "203023": "", "203024": "", "203025": "", "203026": "", "203027": "", "204001": "", "204002": "", "205001": "", "205002": "", "205003": "", "205004": ""};
  var ITEM_TYPE  = {"0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0, "9": 0, "10": 0, "11": 0, "12": 0, "13": 0, "14": 0, "15": 0, "16": 0, "17": 0, "18": 0, "19": 0, "20": 0, "21": 0, "22": 0, "23": 0, "24": 0, "25": 0, "26": 0, "27": 0, "28": 0, "29": 0, "30": 0, "31": 0, "32": 0, "33": 0, "34": 0, "35": 0, "36": 0, "37": 0, "38": 0, "39": 0, "40": 0, "41": 0, "42": 0, "43": 0, "44": 0, "45": 0, "46": 0, "47": 0, "48": 0, "49": 0, "50": 0, "51": 0, "52": 0, "53": 0, "54": 0, "55": 0, "56": 0, "57": 0, "101": 0, "102": 0, "103": 0, "104": 0, "105": 0, "106": 0, "107": 0, "108": 0, "109": 0, "110": 0, "111": 0, "112": 0, "113": 0, "114": 0, "115": 0, "116": 0, "117": 0, "118": 0, "119": 0, "120": 0, "121": 0, "122": 0, "123": 0, "124": 0, "125": 0, "126": 0, "127": 0, "128": 0, "129": 0, "130": 0, "131": 0, "132": 0, "133": 0, "134": 0, "1000": 1, "1001": 1, "1002": 1, "1003": 1, "1004": 1, "1005": 1, "1006": 1, "1007": 1, "1008": 1, "1009": 1, "1010": 1, "1011": 1, "1012": 1, "1013": 1, "1014": 1, "1015": 1, "1016": 1, "1017": 1, "1018": 1, "1019": 1, "1020": 1, "1021": 1, "1100": 1, "1101": 1, "1102": 1, "1103": 1, "1104": 1, "1105": 1, "1106": 1, "1200": 1, "1201": 1, "1202": 1, "1203": 1, "1204": 1, "1205": 1, "1206": 1, "1207": 1, "1208": 1, "1209": 1, "1210": 1, "1211": 1, "1212": 1, "1213": 1, "1214": 1, "1215": 1, "1300": 1, "1301": 1, "1302": 1, "1303": 1, "1304": 1, "1305": 1, "1306": 1, "1307": 1, "1308": 1, "1309": 1, "2000": 2, "2001": 2, "2002": 2, "2003": 2, "2004": 2, "2005": 2, "2006": 2, "2007": 2, "2008": 2, "2009": 2, "2010": 2, "2011": 2, "3000": 3, "3001": 3, "3002": 3, "3003": 3, "3004": 3, "3005": 3, "3006": 3, "3007": 3, "3008": 3, "3009": 3, "3010": 3, "3011": 3, "3012": 3, "3013": 3, "3014": 3, "3015": 3, "3016": 3, "3017": 3, "3018": 3, "3019": 3, "3020": 3, "3021": 3, "3022": 3, "3023": 3, "3024": 3, "3025": 3, "3026": 3, "3027": 3, "3028": 3, "3029": 3, "3030": 3, "3031": 3, "3032": 3, "3033": 3, "3034": 3, "3035": 3, "3036": 3, "3037": 3, "3038": 3, "4000": 3, "4001": 3, "4002": 3, "4003": 3, "4004": 3, "4005": 3, "4006": 3, "4007": 3, "4008": 3, "4009": 3, "4010": 3, "4011": 3, "4012": 3, "4013": 3, "4014": 3, "4015": 3, "4016": 3, "4017": 3, "4018": 3, "4019": 3, "4020": 3, "4101": 3, "4102": 3, "4103": 3, "4104": 3, "5001": 5, "5002": 5, "5003": 5, "5101": 5, "5102": 5, "5103": 5, "5104": 5, "5105": 5, "5501": 5, "5502": 5, "5601": 5, "5602": 5, "7000": 7, "7001": 7, "8000": 8, "8001": 8, "8002": 8, "8003": 8, "8004": 8, "8501": 16, "8502": 16, "8503": 16, "9000": 9, "9001": 9, "9002": 9, "10001": 10, "10002": 10, "10003": 10, "10004": 10, "10005": 10, "10006": 10, "10007": 10, "10101": 11, "10102": 11, "10103": 11, "10104": 11, "10105": 11, "10106": 11, "10107": 11, "10108": 11, "11001": 11, "11101": 11, "11102": 11, "10201": 12, "10202": 12, "10203": 12, "10204": 12, "10205": 12, "10211": 12, "10212": 12, "10213": 12, "10214": 12, "10215": 12, "10221": 12, "10222": 12, "10223": 12, "10224": 12, "10225": 12, "10301": 13, "10302": 13, "10303": 13, "10304": 13, "10305": 13, "10306": 13, "10307": 13, "10308": 13, "10309": 13, "10310": 13, "10311": 13, "10312": 13, "10313": 13, "10314": 13, "10315": 13, "10316": 13, "10317": 13, "10318": 13, "10319": 13, "10320": 13, "10321": 13, "10322": 13, "10323": 13, "10324": 13, "10325": 13, "10326": 13, "10327": 13, "10401": 13, "10501": 13, "10601": 13, "20001": 15, "20002": 15, "20003": 15, "20004": 15, "20005": 15, "20006": 15, "20101": 15, "20102": 15, "20103": 15, "20104": 15, "20105": 15, "20106": 15, "20107": 15, "20108": 15, "20109": 15, "20110": 15, "20111": 15, "200000": 14, "200001": 14, "200002": 14, "200003": 14, "200004": 14, "200005": 14, "200006": 14, "200007": 14, "200008": 14, "200009": 14, "200010": 14, "200011": 14, "200012": 14, "200013": 14, "200014": 14, "200015": 14, "200016": 14, "201001": 14, "201002": 14, "201003": 14, "201004": 14, "201005": 14, "201006": 14, "201007": 14, "201008": 14, "202101": 14, "202102": 14, "202103": 14, "202104": 14, "202105": 14, "202106": 14, "202107": 14, "202108": 14, "202109": 14, "202110": 14, "202111": 14, "202211": 14, "202212": 14, "202213": 14, "202221": 14, "202222": 14, "202223": 14, "202231": 14, "202232": 14, "202233": 14, "202241": 14, "202242": 14, "202243": 14, "202244": 14, "202251": 14, "202252": 14, "202253": 14, "202254": 14, "202261": 14, "202262": 14, "202263": 14, "203001": 14, "203002": 14, "203003": 14, "203004": 14, "203005": 14, "203006": 14, "203007": 14, "203011": 14, "203012": 14, "203013": 14, "203014": 14, "203015": 14, "203016": 14, "203017": 14, "203021": 14, "203022": 14, "203023": 14, "203024": 14, "203025": 14, "203026": 14, "203027": 14, "204001": 14, "204002": 14, "205001": 14, "205002": 14, "205003": 14, "205004": 14};
  var SHOP_ITEM  = {"0": 0, "1": 1, "2": 2, "3": 3, "4": 19, "5": 4, "6": 5, "7": 15, "8": 16, "9": 1001, "10": 2009, "11": 2010, "12": 2011, "13": 2000, "14": 2001, "15": 2002, "16": 2003, "17": 2004, "18": 2005, "19": 2006, "20": 2007, "21": 2008};
  var SHOP       = [{"fixPos_Y": 3, "id": 0, "info": "香喷喷的原味华夫饼 涂上甜甜的奶油 嘴馋的时候就来一个吧", "itemId": 0}, {"fixPos_Y": 8, "id": 1, "info": "奶香味十足的薄煎饼 卷上新鲜的草莓 想少吃点就选这个吧", "itemId": 1}, {"fixPos_Y": 15, "id": 2, "info": "烤得鼓鼓的口袋面包 装上满满的蔬菜沙拉 可以美美地饱餐一顿了", "itemId": 2}, {"fixPos_Y": 2, "id": 3, "info": "口感柔软嫩滑的煎蛋 裹着暖暖的茄汁炒饭 吃完身心都变得愉快了呢", "itemId": 3}, {"fixPos_Y": 0, "id": 4, "info": "热乎乎的白胖大饺子 皮薄馅儿大颜值高 和寒冷的冬天更配哦", "itemId": 19}, {"fixPos_Y": 2, "id": 5, "info": "外皮烤得焦黄的包子 散发浓郁的葱香 满满的都是大漠风情", "itemId": 4}, {"fixPos_Y": 2, "id": 6, "info": "外焦里嫩的煎豆腐 混入海苔的鲜香 满满的都是大海的味道", "itemId": 5}, {"fixPos_Y": 2, "id": 7, "info": "软糯可口的蒸米糕 揉入甜而不腻的桂花 满满的都是水乡韵味", "itemId": 15}, {"fixPos_Y": 2, "id": 8, "info": "香气扑鼻的鸡蛋烙饼 塞满辛香爽脆的彩椒 满满的都是北地风味", "itemId": 16}, {"fixPos_Y": 11, "id": 9, "info": "人气爆棚的锦鲤玉佩 可以反复使用 买不了吃亏买不了上当", "itemId": 1001}, {"fixPos_Y": 18, "id": 10, "info": "低调又不失个性的棕色围巾 戴在头上酷酷哒 为旅途增添一抹亮色", "itemId": 2009}, {"fixPos_Y": 18, "id": 11, "info": "充满民族风情的深蓝色围巾 戴在头上萌萌哒 为旅途增添一抹亮色", "itemId": 2010}, {"fixPos_Y": 18, "id": 12, "info": "高端大气上档次的红色围巾 戴在头上美美哒 为旅途增添一抹亮色", "itemId": 2011}, {"fixPos_Y": 18, "id": 13, "info": "产自深山的原生态竹筒 散发自然的清香 炎炎烈日的解渴神器", "itemId": 2000}, {"fixPos_Y": 17, "id": 14, "info": "古装剧同款葫芦 小巧便捷不渗漏 炎炎烈日的解渴神器", "itemId": 2001}, {"fixPos_Y": 16, "id": 15, "info": "旅行者常备的运动水壶 坚固耐用不变形 炎炎烈日的解渴神器", "itemId": 2002}, {"fixPos_Y": 17, "id": 16, "info": "民间艺人手工制作的纸伞 古朴典雅不花哨 下雨天也有好心情", "itemId": 2003}, {"fixPos_Y": 17, "id": 17, "info": "民间艺人手工制作的纸伞 洋溢着自然气息 下雨天也有好心情", "itemId": 2004}, {"fixPos_Y": 17, "id": 18, "info": "民间艺人手工制作的纸伞 描绘江南水乡风韵 下雨天也有好心情", "itemId": 2005}, {"fixPos_Y": 18, "id": 19, "info": "简约风格的入门级睡垫 舒适便携可折叠 户外也有家的温暖", "itemId": 2006}, {"fixPos_Y": 18, "id": 20, "info": "条纹风格的标准级睡垫 舒适便携可折叠 户外也有家的温暖", "itemId": 2007}, {"fixPos_Y": 18, "id": 21, "info": "现代风格的专业级睡垫 舒适便携可折叠 户外也有家的温暖", "itemId": 2008}];
  var NOTE_IDS   = [1000, 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010, 1011, 1012, 1013, 1014, 1015, 1016, 1017, 1018, 1019, 1020, 1021, 1022, 1023, 1024, 1025, 1026, 1027, 1028, 1029];

  /* 旅友笔记(type2): id 段 2000..2026 (Note_json)。它是**唯一**能解锁"旅行笔记-旅友"栏与
     阁楼礼品盒的东西 —— GiftBoxModel.isOpen() / TravelNoteView tab2 都要求 note_list 里出现过
     TravelFriends_json.visitOpen=[2000,2001,2002]。以前只发 1000..1029(type1), 于是旅友栏恒 0/27、
     礼品盒按钮永远不出现(用户报的"旅友不能解锁 / 屋内箱子不可用"是同一个原因)。 */
  var FRIEND_NOTE_IDS = [2000, 2001, 2002];
  /* 旅友笔记一共 **27 篇**(Note 表 type=2, id 2000..2026, 每篇 factorType=Drop / factorData=掉落物品):
       factorData 100 -> 2000/2001/2002   (初次相遇: 壁虎/刺猬/萤火虫, 每位一篇, 不带东西也给)
       factorData  35 -> 2003..2020 + 2024..2026 (21 篇, 需带【枣泥核桃糖】出门)
       factorData  15 -> 2021/2022/2023   (3 篇, 需带【桂花蒸米糕】出门)
     表在运行时从客户端的 TravelNoteDB 读, 读不到就用这份兜底。 */
  var FRIEND_NOTE_FALLBACK = {
    '100': [2000, 2001, 2002],
    '35': [2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2024, 2025, 2026],
    '15': [2021, 2022, 2023]
  };
  function friendNoteGroups() {
    try {
      var db = Tabikaeru.DataManager.instance().TravelNoteDB;
      var list = (db && typeof db.list === 'function') ? db.list() : null;
      if (list && list.length) {
        var g = {};
        for (var i = 0; i < list.length; i++) {
          var r = list[i];
          if (!r || Number(r.type) !== 2) continue;
          var k = String(Number(r.factorData));
          if (!g[k]) g[k] = [];
          g[k].push(Number(r.id));
        }
        if (Object.keys(g).length) return g;
      }
    } catch (e) {}
    return FRIEND_NOTE_FALLBACK;
  }
  /* 这一趟带的东西能解锁哪一篇旅友笔记(没拿到的里面挑一篇) */
  function friendNoteFromLuggage(items) {
    var g = friendNoteGroups(), i, k;
    var carried = [];
    for (i = 0; i < arr2(items).length; i++) carried.push(Number(arr2(items)[i]));
    for (i = 0; i < carried.length; i++) {
      k = String(carried[i]);
      var ids = g[k];
      if (!ids || !ids.length) continue;
      for (var j = 0; j < ids.length; j++) if (!noteUsed(ids[j])) return ids[j];
    }
    return null;
  }
  function arr2(v) { return Array.isArray(v) ? v : []; }
  function anyFriendNoteLeft() {
    var g = friendNoteGroups();
    for (var k in g) { var ids = g[k]; for (var i = 0; i < ids.length; i++) if (!noteUsed(ids[i])) return true; }
    return false;
  }
  function noteUsed(id){ if (id === undefined || id === null) return true;
    var a = Array.isArray(st.notes) ? st.notes : [];
    for (var i=0;i<a.length;i++) if (Number(a[i] && a[i].id) === Number(id)) return true; return false; }
  function pickNote(pool){
    if (!pool || !pool.length) return null;
    var base = Number((st.frog && st.frog.nextNote) || 0); if (!isFinite(base)) base = 0;
    for (var k=0;k<pool.length;k++){
      var cand = pool[(base+k) % pool.length];
      if (cand === undefined || cand === null) continue;
      if (!noteUsed(cand)) { st.frog.nextNote = (base+k+1) % pool.length; return cand; }
    }
    return null;
  }
  function friendNoteWanted(){
    /* "初次相遇"三篇(壁虎/刺猬/萤火虫)在前三趟里**一定**给全: 它们是旅友栏与阁楼礼品盒的解锁条件,
       概率给会让玩家碰运气(以前 0/1/2 三篇只给到两篇)。给全之后由特产掉落(friendNoteFromLuggage)接管。 */
    for (var i=0;i<FRIEND_NOTE_IDS.length;i++) if (!noteUsed(FRIEND_NOTE_IDS[i])) return true;
    return false;
  }
  var GIFT_IDS   = [3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010, 3011, 3012, 3013, 3014, 3015, 3016, 3017, 3018, 3019, 3020, 3021, 4000, 4001, 4002, 4003, 4004, 4005, 4006, 4007, 4008, 4009, 4010, 4011, 4012, 4013, 4014, 4015, 4016, 4017];
  var COLL_IDS   = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39];
  var PIC_IDS    = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 201, 202, 203, 204, 205, 206, 207, 1000, 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010, 1011, 1012, 1013, 1014, 1015, 1016, 1017, 1018, 1019, 1020];
  var PROV_NAMES = ["上海", "云南", "内蒙古", "北京", "台湾", "吉林", "四川", "天津", "安徽", "山东", "山西", "广东", "广西", "新疆", "江苏", "江西", "河北", "河南", "浙江", "海南", "海外", "湖北", "湖南", "澳门", "甘肃", "福建", "西藏", "辽宁", "重庆", "陕西", "青海", "香港", "黑龙江"];
  var BEGINNER   = {"1": {"code": "新呱同乐之报个到", "id": 1, "item_id": 1201, "note_id": 10001, "num": 1}, "2": {"code": "新呱同乐之游京城", "id": 2, "item_id": 101, "note_id": 10002, "num": 1}, "3": {"code": "新呱同乐之博物馆", "id": 3, "item_id": 1104, "note_id": 10003, "num": 1}, "4": {"code": "新呱同乐之寻蜀道", "id": 4, "item_id": 102, "note_id": 10004, "num": 1}, "5": {"code": "新呱同乐之绿兔子", "id": 5, "item_id": 202107, "note_id": 10005, "num": 1}, "6": {"code": "新呱同乐之好邻居", "id": 6, "item_id": 5101, "note_id": 10006, "num": 1}, "7": {"code": "新呱同乐之不迷路", "id": 7, "item_id": 1103, "note_id": 10007, "num": 1}};
  var ENCY_UNLOCK= [101, 102, 103, 104, 105, 106, 107, 108, 201, 202, 203, 204, 205, 301, 302, 303, 304, 401, 402, 403, 404, 405, 406];
  var ENCY_DESC  = [{"id": 101, "list": [1, 2, 3, 4]}, {"id": 102, "list": [1, 2, 3, 4]}, {"id": 103, "list": [1, 2, 3, 4]}, {"id": 104, "list": [1, 2, 3, 4]}, {"id": 105, "list": [1, 2, 3, 4, 5]}, {"id": 106, "list": [1, 2, 3, 4]}, {"id": 107, "list": [1, 2, 3, 4]}, {"id": 108, "list": [1, 2, 3, 4]}, {"id": 201, "list": [1, 2, 3, 4]}, {"id": 202, "list": [1, 2, 3, 4]}, {"id": 203, "list": [1, 2, 3, 4]}, {"id": 204, "list": [1, 2, 3, 4]}, {"id": 205, "list": [1, 2, 3, 4]}, {"id": 301, "list": [1, 2, 3, 4]}, {"id": 302, "list": [1, 2, 3, 4]}, {"id": 303, "list": [1, 2, 3, 4]}, {"id": 304, "list": [1, 2, 3, 4]}, {"id": 401, "list": [1, 2, 3, 4]}, {"id": 402, "list": [1, 2, 3]}, {"id": 403, "list": [1, 2, 3]}, {"id": 404, "list": [1, 2, 3]}, {"id": 405, "list": [1, 2, 3]}, {"id": 406, "list": [1, 2, 3]}];
  var ENCY_SUB   = [{"id": 101, "sub_id": 0}, {"id": 102, "sub_id": 0}, {"id": 103, "sub_id": 0}, {"id": 104, "sub_id": 0}, {"id": 105, "sub_id": 0}, {"id": 106, "sub_id": 0}, {"id": 107, "sub_id": 0}, {"id": 108, "sub_id": 0}, {"id": 201, "sub_id": 0}, {"id": 202, "sub_id": 0}, {"id": 203, "sub_id": 0}, {"id": 204, "sub_id": 0}, {"id": 205, "sub_id": 0}, {"id": 301, "sub_id": 0}, {"id": 302, "sub_id": 0}, {"id": 303, "sub_id": 0}, {"id": 304, "sub_id": 0}, {"id": 401, "sub_id": 0}, {"id": 402, "sub_id": 0}, {"id": 403, "sub_id": 0}, {"id": 404, "sub_id": 0}, {"id": 405, "sub_id": 0}, {"id": 406, "sub_id": 0}];
  var ET_UNLOCK  = [1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010, 1011, 1012, 1013, 1014, 1015, 1016, 1017, 1018, 1101, 1102, 1103, 1104, 1105, 1106, 1107, 1108, 1109, 1110, 1111, 1112, 1113, 1114, 1115, 1116, 1117, 1118, 1119, 1120, 1121, 1122, 1123, 1124, 1201, 1202, 1203, 1204, 1205, 1206, 1207, 1208, 1209, 1210, 1211, 1212, 1213, 1214, 1215, 1216, 1217, 1218, 1219, 1220, 1221, 1222, 1223, 1224, 1225, 1226, 1227, 1228, 1229, 1230, 1231, 1232, 1233, 1234, 1901, 1902, 1903, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2101, 2102, 2103, 2104, 2105, 2106, 2107, 3001, 3002, 3003, 3004];
  var ET_DESC    = [{"id": 1001, "list": [1, 2, 3]}, {"id": 1002, "list": [1, 2, 3]}, {"id": 1003, "list": [1, 2, 3]}, {"id": 1004, "list": [1, 2, 3]}, {"id": 1005, "list": [1, 2, 3]}, {"id": 1006, "list": [1, 2, 3]}, {"id": 1007, "list": [1, 2, 3]}, {"id": 1008, "list": [1, 2, 3]}, {"id": 1009, "list": [1, 2, 3]}, {"id": 1010, "list": [1, 2, 3]}, {"id": 1011, "list": [1, 2, 3]}, {"id": 1012, "list": [1, 2, 3]}, {"id": 1013, "list": [1, 2, 3]}, {"id": 1014, "list": [1, 2, 3]}, {"id": 1015, "list": [1, 2, 3]}, {"id": 1016, "list": [1, 2, 3]}, {"id": 1017, "list": [1, 2, 3]}, {"id": 1018, "list": [1, 2, 3]}, {"id": 1101, "list": [1, 2, 3]}, {"id": 1102, "list": [1, 2, 3]}, {"id": 1103, "list": [1, 2, 3]}, {"id": 1104, "list": [1, 2, 3]}, {"id": 1105, "list": [1, 2, 3]}, {"id": 1106, "list": [1, 2, 3]}, {"id": 1107, "list": [1, 2, 3]}, {"id": 1108, "list": [1, 2, 3]}, {"id": 1109, "list": [1, 2, 3]}, {"id": 1110, "list": [1, 2, 3]}, {"id": 1111, "list": [1, 2, 3]}, {"id": 1112, "list": [1, 2, 3]}, {"id": 1113, "list": [1, 2, 3]}, {"id": 1114, "list": [1, 2, 3]}, {"id": 1115, "list": [1, 2, 3]}, {"id": 1116, "list": [1, 2, 3]}, {"id": 1117, "list": [1, 2, 3]}, {"id": 1118, "list": [1, 2, 3]}, {"id": 1119, "list": [1, 2, 3]}, {"id": 1120, "list": [1, 2, 3]}, {"id": 1121, "list": [1, 2, 3]}, {"id": 1122, "list": [1, 2, 3]}, {"id": 1123, "list": [1, 2, 3]}, {"id": 1124, "list": [1, 2, 3]}, {"id": 1201, "list": [1, 2, 3]}, {"id": 1202, "list": [1, 2, 3]}, {"id": 1203, "list": [1, 2, 3]}, {"id": 1204, "list": [1, 2, 3]}, {"id": 1205, "list": [1, 2, 3]}, {"id": 1206, "list": [1, 2, 3]}, {"id": 1207, "list": [1, 2, 3]}, {"id": 1208, "list": [1, 2, 3]}, {"id": 1209, "list": [1, 2, 3]}, {"id": 1210, "list": [1, 2, 3]}, {"id": 1211, "list": [1, 2, 3]}, {"id": 1212, "list": [1, 2, 3]}, {"id": 1213, "list": [1, 2, 3]}, {"id": 1214, "list": [1, 2, 3]}, {"id": 1215, "list": [1, 2, 3]}, {"id": 1216, "list": [1, 2, 3]}, {"id": 1217, "list": [1, 2, 3]}, {"id": 1218, "list": [1, 2, 3]}, {"id": 1219, "list": [1, 2, 3]}, {"id": 1220, "list": [1, 2, 3]}, {"id": 1221, "list": [1, 2, 3]}, {"id": 1222, "list": [1, 2, 3]}, {"id": 1223, "list": [1, 2, 3]}, {"id": 1224, "list": [1, 2, 3]}, {"id": 1225, "list": [1, 2, 3]}, {"id": 1226, "list": [1, 2, 3]}, {"id": 1227, "list": [1, 2, 3]}, {"id": 1228, "list": [1, 2, 3]}, {"id": 1229, "list": [1, 2, 3]}, {"id": 1230, "list": [1, 2, 3]}, {"id": 1231, "list": [1, 2, 3]}, {"id": 1232, "list": [1, 2, 3]}, {"id": 1233, "list": [1, 2, 3]}, {"id": 1234, "list": [1, 2, 3]}, {"id": 1901, "list": [1, 2, 3]}, {"id": 1902, "list": [1, 2, 3, 4, 5]}, {"id": 1903, "list": [1, 2, 3, 4]}, {"id": 2001, "list": [1, 2, 3]}, {"id": 2002, "list": [1, 2, 3]}, {"id": 2003, "list": [1, 2, 3]}, {"id": 2004, "list": [1, 2]}, {"id": 2005, "list": [1, 2, 3]}, {"id": 2006, "list": [1, 2, 3]}, {"id": 2007, "list": [1, 2, 3]}, {"id": 2008, "list": [1, 2, 3]}, {"id": 2101, "list": [1, 2, 3, 4]}, {"id": 2102, "list": [1, 2, 3, 4]}, {"id": 2103, "list": [1, 2, 3, 4]}, {"id": 2104, "list": [1, 2, 3, 4]}, {"id": 2105, "list": [1, 2, 3]}, {"id": 2106, "list": [1, 2, 3]}, {"id": 2107, "list": [1, 2, 3]}, {"id": 3001, "list": [1, 2]}, {"id": 3002, "list": [1, 2]}, {"id": 3003, "list": [1, 2]}, {"id": 3004, "list": [1, 2]}];
  var ET_SUB     = [{"id": 1001, "sub_id": 0}, {"id": 1002, "sub_id": 0}, {"id": 1003, "sub_id": 0}, {"id": 1004, "sub_id": 0}, {"id": 1005, "sub_id": 0}, {"id": 1006, "sub_id": 0}, {"id": 1007, "sub_id": 0}, {"id": 1008, "sub_id": 0}, {"id": 1009, "sub_id": 0}, {"id": 1010, "sub_id": 0}, {"id": 1011, "sub_id": 0}, {"id": 1012, "sub_id": 0}, {"id": 1013, "sub_id": 0}, {"id": 1014, "sub_id": 0}, {"id": 1015, "sub_id": 0}, {"id": 1016, "sub_id": 0}, {"id": 1017, "sub_id": 0}, {"id": 1018, "sub_id": 0}, {"id": 1101, "sub_id": 0}, {"id": 1102, "sub_id": 0}, {"id": 1103, "sub_id": 0}, {"id": 1104, "sub_id": 0}, {"id": 1105, "sub_id": 0}, {"id": 1106, "sub_id": 0}, {"id": 1107, "sub_id": 0}, {"id": 1108, "sub_id": 0}, {"id": 1109, "sub_id": 0}, {"id": 1110, "sub_id": 0}, {"id": 1111, "sub_id": 0}, {"id": 1112, "sub_id": 0}, {"id": 1113, "sub_id": 0}, {"id": 1114, "sub_id": 0}, {"id": 1115, "sub_id": 0}, {"id": 1116, "sub_id": 0}, {"id": 1117, "sub_id": 0}, {"id": 1118, "sub_id": 0}, {"id": 1119, "sub_id": 0}, {"id": 1120, "sub_id": 0}, {"id": 1121, "sub_id": 0}, {"id": 1122, "sub_id": 0}, {"id": 1123, "sub_id": 0}, {"id": 1124, "sub_id": 0}, {"id": 1201, "sub_id": 0}, {"id": 1202, "sub_id": 0}, {"id": 1203, "sub_id": 0}, {"id": 1204, "sub_id": 0}, {"id": 1205, "sub_id": 0}, {"id": 1206, "sub_id": 0}, {"id": 1207, "sub_id": 0}, {"id": 1208, "sub_id": 0}, {"id": 1209, "sub_id": 0}, {"id": 1210, "sub_id": 0}, {"id": 1211, "sub_id": 0}, {"id": 1212, "sub_id": 0}, {"id": 1213, "sub_id": 0}, {"id": 1214, "sub_id": 0}, {"id": 1215, "sub_id": 0}, {"id": 1216, "sub_id": 0}, {"id": 1217, "sub_id": 0}, {"id": 1218, "sub_id": 0}, {"id": 1219, "sub_id": 0}, {"id": 1220, "sub_id": 0}, {"id": 1221, "sub_id": 0}, {"id": 1222, "sub_id": 0}, {"id": 1223, "sub_id": 0}, {"id": 1224, "sub_id": 0}, {"id": 1225, "sub_id": 0}, {"id": 1226, "sub_id": 0}, {"id": 1227, "sub_id": 0}, {"id": 1228, "sub_id": 0}, {"id": 1229, "sub_id": 0}, {"id": 1230, "sub_id": 0}, {"id": 1231, "sub_id": 0}, {"id": 1232, "sub_id": 0}, {"id": 1233, "sub_id": 0}, {"id": 1234, "sub_id": 0}, {"id": 1901, "sub_id": 0}, {"id": 1902, "sub_id": 0}, {"id": 1903, "sub_id": 0}, {"id": 2001, "sub_id": 0}, {"id": 2002, "sub_id": 0}, {"id": 2003, "sub_id": 0}, {"id": 2004, "sub_id": 0}, {"id": 2005, "sub_id": 0}, {"id": 2006, "sub_id": 0}, {"id": 2007, "sub_id": 0}, {"id": 2008, "sub_id": 0}, {"id": 2101, "sub_id": 0}, {"id": 2102, "sub_id": 0}, {"id": 2103, "sub_id": 0}, {"id": 2104, "sub_id": 0}, {"id": 2105, "sub_id": 0}, {"id": 2106, "sub_id": 0}, {"id": 2107, "sub_id": 0}, {"id": 3001, "sub_id": 0}, {"id": 3002, "sub_id": 0}, {"id": 3003, "sub_id": 0}, {"id": 3004, "sub_id": 0}];
  var ACT_KEYS   = ["0", "1", "10", "11", "12", "13", "14", "15", "16", "17", "18", "2", "3", "4", "5", "6", "7", "8", "9"];

  var TRAVEL_SECONDS = 90;
  /* the client renders one UI cell per array slot and uses -1 for an empty slot;
     the array must NEVER grow past the number of cells or it crashes on items[i].image */
  /* client Bag view has exactly 3 cells; Desk has 8. bagDataList.length IS the usable slot count. */
  var BAG_SLOTS = 4, DESK_SLOTS = 8;
  function SLOTS(n){ n = n||8; var a=[]; for (var i=0;i<n;i++) a.push(-1); return a; }
  function bagSlots(){ return SLOTS(BAG_SLOTS); }
  function deskSlots(){ return SLOTS(DESK_SLOTS); }
  function firstEmpty(a){ for (var i=0;i<a.length;i++) if (a[i] === -1 || a[i] === null || a[i] === undefined) return i; return -1; }
  var st = window.MOCK_STATE = window.MOCK_STATE || {
    clover: 1000, ticket: 10, name: "xiaowa",
    bag: bagSlots(), desk: deskSlots(),
    /* 新档起步包(清单 §1"默认用户初始化"): 3 份食物 + 1 个四叶草护身符,
       以前 house 是空的、bag/desk 全 -1 —— 第一次出门必须先跑去商店买吃的。 */
    house: [{ item_id: 0, count: 2 }, { item_id: 1, count: 1 }, { item_id: 1000, count: 1 }],
    notes: [], gifts: [], photos: [], nextPhoto: 1, newFlag: [], beginnerDay: 0, cloverId: 1,
    frog: { status: 0, motion: 0, todayStep: 0, traveling: false, returnAt: 0, nextNote: 0 }
  };
  if (!st.frog) st.frog = { status:0, motion:0, todayStep:0, traveling:false, returnAt:0, nextNote:0 };
  if (!st.notes || !st.notes.length) {
    st.notes = NOTE_IDS.slice(0,3).map(function(id,i){ return {id:id, read:i===0?1:0, timestamp:Math.floor(Date.now()/1000)-3600*(i+1)}; });
  }
  /* The client's own settings are SERVER state: client_load_role.settings.client
     is a JSON string and every change the player makes is echoed back with
     client_set_client (UserModel.setClientSettings in main.min.js).
     guideStep drives the entire beginner tutorial, so if it is not persisted the
     player restarts the tutorial after every refresh and the 500-clover
     tutorial mail reward can never be kept. */
  var DEFAULT_CLIENT_SETTINGS = {
    guideStep: "Complete", bgSound: 1, effectSound: 1,   /* 教程在本客户端里会死循环(见 NOTES), 默认跳过 */
    hasAchieve: true, hasOpenAttributeView: true, hasEnteredRaffle: true,
    hasOpenedDesk: true, hasBuyTool: true, hasFriendVisit: true,
    guideVisitor: true, guideVisitorGift: true, guideStory: true,
    guideStoryGift: true, hasOpenedNote: true, guideNote: true,
    guideHandCraft: true, guideSlidePicture: true,
    /* 这几个是**阶段数字**, 必须给终态值: 给中间值会让客户端一直弹引导 ——
       guideFurniture 1->2->3->4->5 才是做完(中间阶段会在准备/出门按钮上画手指高亮 + 感叹号气泡)
       guideDrawing   1->2->3->4 才是做完(会在邀请弹窗上画手指)
       noticeDrawing  -1 = 不再提示"屋内多了些东西" */
    guideFurniture: 5, guideAnnualReview: true, guideFurnitureNotice: true,
    guideDrawing: 4, noticeDrawing: 1   /* 非 -1: 让绘纸的提示/入口出现(客户端: noticeDrawing = DrawingModel.show_coll) */
  };
  /* Writes that arrive before the role push are the client's untouched
     SettingsInfo defaults (guideStep New): accepting them would clobber the
     save and re-open the tutorial, so ignore them. */
  /* B 方案: 旧存档一次性迁移到「新手引导」状态 */
  st.clientSettings = st.clientSettings || {};
  st.clientSettings.guideStep = 'Complete';   /* 强制跳过新手教程(客户端在本版本会无限重开) */
  try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {}
  window.MOCK_GUIDE = {
    step: function () { return (st.clientSettings && st.clientSettings.guideStep) || '?'; },
    skip: function () { st.clientSettings = st.clientSettings || {}; st.clientSettings.guideStep = 'Complete'; try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} try { console.log('[MOCK] 引导: 已跳过 -> Complete'); } catch (e) {} return 0; },
    set: function (v) { st.clientSettings = st.clientSettings || {}; st.clientSettings.guideStep = String(v); return String(v); }
  };
  var roleSent = false;
  /* re-applied on every role push so a partial or legacy save (one that predates
     a setting, or was written before the tutorial finished) is repaired instead
     of silently dropping the player back to GuideStep.New */
  function ensureClientSettings(){
    /* 绘纸入口解锁: noticeDrawing=-1 会让绘纸提示与入口一直不出现(用户: 没有图纸/配方) */
    if (st.clientSettings && st.clientSettings.noticeDrawing === -1) st.clientSettings.noticeDrawing = 1;
    if (!st.clientSettings || typeof st.clientSettings !== "object") st.clientSettings = {};
    for (var csKey in DEFAULT_CLIENT_SETTINGS) {
      if (st.clientSettings[csKey] === undefined) st.clientSettings[csKey] = DEFAULT_CLIENT_SETTINGS[csKey];
    }
    /* 老存档可能停在引导的中间阶段(我们早先默认写过 1) —— 那会让手指高亮/感叹号
       永远挂在按钮上; 这里只对中间值做迁移, 升到终态 */
    var gf = st.clientSettings.guideFurniture;
    if (typeof gf === "number" && gf >= 1 && gf <= 4) st.clientSettings.guideFurniture = 5;
    var gd = st.clientSettings.guideDrawing;
    if (typeof gd === "number" && gd >= 1 && gd <= 3) st.clientSettings.guideDrawing = 4;
    if (st.clientSettings.noticeDrawing === 0) st.clientSettings.noticeDrawing = -1;
    return st.clientSettings;
  }
  ensureClientSettings();
  S['client_set_client'] = function(p){
    if (!roleSent) return {};
    var raw = p ? p.client : null, o = null;
    if (typeof raw === "string") { try { o = JSON.parse(raw); } catch(e) { o = null; } }
    else if (raw && typeof raw === "object") o = raw;
    if (o) for (var k in o) { if (k === 'guideStep') continue; ensureClientSettings()[k] = o[k]; }
    ensureClientSettings().guideStep = 'Complete';   /* 教程关闭: 忽略客户端上报的引导步骤 */
    /* 关键: 客户端上报的设置必须立刻落盘 —— 以前只靠别的路径自动保存, 引导进度在领奖后可能还没写盘就
       被杀进程 -> 重启又从 New 开始(用户报的教程死循环就是这个)。 */
    try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {}
    /* 引导防回退(用户报的死循环): 客户端从 Introduce 又回到 Named 时, 直接把服务端设置置为 Complete,
       让它在下次 client_load_role 时不再重开教程; 同时记录见过的最高步骤便于排查。 */
    try {
      var RANK = { Named: 1, PrepareGatherClover: 2, StartGatherClover: 3, EnterRoom: 4, Introduce: 5, Complete: 9 };
      var gsv = (o && o.guideStep !== undefined) ? String(o.guideStep) : null;
      if (gsv) {
        var cur = Number(st.guideHigh) || 0, now2 = RANK[gsv] || 0;
        if (now2 > cur) { st.guideHigh = now2; }
        else if (cur >= 4 && now2 <= 2) {
          st.clientSettings.guideStep = 'Complete';
          try { console.log('[MOCK] 引导: 检测到回退(' + gsv + '), 已强制置为 Complete 以免死循环'); } catch (e) {}
        }
      }
    } catch (e) {}
    try { console.log('[MOCK] 引导: 客户端上报 guideStep=' + ((o && o.guideStep !== undefined) ? o.guideStep : '?')); } catch (e) {}
    return {};
  };
  function nowSec(){ return Math.floor(Date.now()/1000); }
  function push(name, data, delay){
    setTimeout(function(){ var M = window.MockServer; if (M && M.dispatch) M.dispatch(name, data); }, delay||30);
  }
  function roleData(){ roleSent = true; return {
    uid: 10001,
    res: { clover_point: st.clover, ticket: st.ticket },
    settings: { client: JSON.stringify(ensureClientSettings()), push_switch: 0, rank_switch: 0 },
    misc: { picture_cnt: st.photos.length, wx_push_reward: false, wx_my_reward: false, create_time: nowSec() },
    /* 称号: achieves = 已拥有 id 数组, achieves_time 里的 time 是**到期**时间(不发/0 = 永久),
       cur_achieve = 当前佩戴(由 client_set_achieve 落库, new/achieve.js)。以前这里全硬编码空 ->
       称号界面永远 ??????、换了也存不住。 */
    frog: { name: st.name||"xiaowa", cur_achieve: Number(st.achieveId || 0),
            achieves: (Array.isArray(st.achieves) && st.achieves.length) ? st.achieves.slice() : [0],
            achieves_time: [], status: st.frog.status,
            motion: st.frog.motion, icon:0, pic_show:1, today_step: st.frog.todayStep,
            /* taobao_data 必须是**假值**: 客户端 eventSystem() 里
               var m = RoleModel.drawTaobaoData(); if (m) { 打开淘宝导入界面 ... }
               以前给 {} 是真值 -> 每次进游戏都自动弹"淘宝版物品已导入" */
            decoration:[], taobao_data:null }
  }; }
  S['client_load_role'] = function(){ return roleData(); };
  /* 淘宝导入相关: 没有可导入的东西, 也必须回 {ok:false}, 否则客户端按真值弹"淘宝版物品已导入" */
  S['client_draw_taobao'] = function(){ return { ok: false }; };
  S['client_taobao_import'] = function(){ return { collections: [], pictures: 0 }; };
  function pushItems(){ push('item_load_items', S['item_load_items'](), 20); }
  function pushClover(){ push('clover_update', {clover: st.clover}, 20); }
  function itemPrice(id){ var p = ITEM_PRICE[String(id)]; return (p===undefined?0:p); }
  function addClover(n){ st.clover += n; pushClover(); }
  function isFood(id){ return ITEM_TYPE[String(id)] === 0; }  /* 协议表里这两个协议的参数名是 pos/id, 而客户端发的就是 id; 以前只读 p.item_id
     -> 取到 undefined -> 包里塞进一个 undefined 条目(JSON 里是 null), 玩家看到的就是
     "东西没进包 / 永远不消耗"。两种写法都兼容。 */
  function paramItemId(p){ if (!p) return undefined;
    if (p.id !== undefined && p.id !== null) return p.id;
    if (p.item_id !== undefined && p.item_id !== null) return p.item_id;
    return undefined; }
  /* the client presses 准备 -> ItemModel.setBagLock(true) ->
     send("item_set_bag_completed", null, true); that is the ONLY departure
     trigger in the protocol list (there is no travel_depart* protocol), so the
     server must start the trip here. */
  function pushLock(){ push('item_load_items', S['item_load_items'](), 20); }
  function depart(){
    st.frog.status = 1; st.frog.motion = 1; st.frog.traveling = true;
    st.frog.returnAt = Date.now() + (st.travelSeconds || TRAVEL_SECONDS)*1000;
    st.bagCompleted = true; st.travelCount = (st.travelCount||0) + 1;
    /* 出发这一刻要**消耗**行李: 便当被吃掉、护身符/道具随身带走。
       以前什么都不扣, 玩家看到的就是"背包里的东西永远还在"。
       顺序很重要: story.js 的 tripLuggage 快照发生在本函数之前, 所以故事判定不受影响。 */
    /* 原版: **背包(包袱)**才是这趟直接带走的东西; **桌子**是备用物资 —— 出门时不动它,
       回家后青蛙自己把桌上的东西收进背包, 为下一次旅行做准备(new/frogstate.js 的 packDesk())。 */
    st.lastTripItems = [];
    for (var bi = 0; bi < st.bag.length; bi++) if (st.bag[bi] !== -1 && st.bag[bi] !== null && st.bag[bi] !== undefined) { st.lastTripItems.push(st.bag[bi]); st.bag[bi] = -1; }
    pushLock();
    push('client_load_role', roleData(), 60);
    /* 聚会活动的每周任务 6「聚会或是旅行」记一次(准备工作不再等于出发, 所以挂在真正出发这里) */
    try { if (window.MOCK_CAKE_TASK && window.MOCK_CAKE_TASK.pro) window.MOCK_CAKE_TASK.pro(6, 1); } catch (e) {}
    try { console.log("[MOCK] 出发: 带上背包里的 " + st.lastTripItems.length + " 件东西 (桌上留着 " + (st.desk || []).filter(function (x) { return x >= 0; }).length + " 件备用), " + Math.round((st.tripSeconds || st.travelSeconds || TRAVEL_SECONDS) / 60) + " 分钟后回家"); } catch(e){}
  }
  /* 玩家的「准备」= 把行李备好, 让青蛙"更想出门"(原版: 你无法命令它出发)。
     以前这里直接 depart() -> 一按准备就走; 现在只提升 desire, 具体什么时候走由
     new/frogstate.js 按心情掷骰子决定(想立刻验证用 /gm away 或 window.MOCK_FORCE_DEPART())。 */
  S['item_set_bag_completed'] = function(p){
    var done = !!(p && p.completed);
    st.bagCompleted = done;
    if (done) {
      st.frog.bagPrepared = nowSec();
      st.frog.desire = Math.min(1, (Number(st.frog.desire) || 0) + 0.35);
      try { console.log("[MOCK] 准备完成: 出门的想法 +0.35 -> " + (Math.round(st.frog.desire * 100) / 100) + " (背包里有 " + (st.bag || []).filter(function (x) { return x >= 0; }).length + " 件, 桌上有 " + (st.desk || []).filter(function (x) { return x >= 0; }).length + " 件备用)"); } catch (e) {}
    }
    pushLock(); push('client_load_role', roleData(), 40);
    return {};
  };
  /* 调试/GM: 强制出发(绕开"心情") */
  window.MOCK_FORCE_DEPART = function(){ try { if (!st.frog.traveling) depart(); return true; } catch (e) { return false; } };
  /* client-side guide/task progress report (fire and forget) */
  S['task_client_pro'] = function(p){
    st.clientPro = st.clientPro || {};
    var k = (p && p.param) ? String(p.param) : "";
    if (k) st.clientPro[k] = (st.clientPro[k]||0) + 1;
    return {};
  };
  function comeBack(){
    st.frog.status = 0; st.frog.motion = 0; st.frog.traveling = false; st.frog.returnAt = 0;
    st.bagCompleted = false;
    /* 旅友笔记优先: ①先看这一趟带的特产(35 枣泥核桃糖 / 15 桂花蒸米糕)能不能解锁新的那几篇;
       ②没有对应的就按"初次相遇"给 2000/2001/2002(保证旅友栏与礼品盒解锁); ③都不行才给普通见闻。 */
    var nid = friendNoteFromLuggage(st.lastTripItems);
    if (nid === null) nid = friendNoteWanted() ? (pickNote(FRIEND_NOTE_IDS) || pickNote(NOTE_IDS)) : null;
    if (nid === null) nid = pickNote(NOTE_IDS) || pickNote(FRIEND_NOTE_IDS);
    if (nid !== null) {
      st.notes.push({id: nid, read: 0, timestamp: nowSec()});
      if (nid >= 2000 && nid < 3000) {
        var got = 0, all = 0, gg = friendNoteGroups();
        for (var kk in gg) { for (var qi = 0; qi < gg[kk].length; qi++) { all++; if (noteUsed(gg[kk][qi])) got++; } }
        try { console.log("[MOCK] 旅友笔记 " + nid + " 到手 -> 旅友栏/礼品盒解锁 (旅友笔记 " + got + "/" + all + ", 笔记共 " + st.notes.length + " 篇)"); } catch (e) {}
      }
    }
    /* 天气×道具(用户表): 暴雨天有概率带回"贝壳"一类的海边特产品 */
    try {
      var wNow = Number((window.MOCK_ENV && window.MOCK_ENV.weather) || st.weather) || 1;
      if (wNow === 4 && Math.random() < 0.5) {
        var shell = 4000 + Math.floor(Math.random() * 21);      /* 特产段(海边贝壳一类) */
        st.gifts = st.gifts || [];
        var had = null;
        for (var si = 0; si < st.gifts.length; si++) if (Number(st.gifts[si].item_id) === shell) had = st.gifts[si];
        if (had) had.count = (Number(had.count) || 0) + 1; else st.gifts.push({ item_id: shell, count: 1 });
        try { console.log('[MOCK] 天气效果: 暴雨天带回贝壳一类特产 ' + shell); } catch (e) {}
      }
    } catch (e) {}
    var gid = GIFT_IDS.length ? GIFT_IDS[Math.floor(Math.random()*GIFT_IDS.length)] : null;
    if (gid !== null) st.gifts.push({item_id: gid, count: 1});
    /* 称号效果(目标②): 特产/纪念品类称号会**多带一份**回来(giftScale 1~2, 超出 1 的部分按概率给) */
    try {
      var gs = window.MOCK_TITLE && window.MOCK_TITLE.giftScale ? Number(window.MOCK_TITLE.giftScale()) || 1 : 1;
      if (gs > 1 && GIFT_IDS.length) {
        var extra = Math.floor(gs - 1) + (Math.random() < (gs - Math.floor(gs)) ? 1 : 0);
        for (var gi = 0; gi < extra; gi++) {
          var gid2 = GIFT_IDS[Math.floor(Math.random() * GIFT_IDS.length)];
          st.gifts.push({ item_id: gid2, count: 1 });
        }
        if (extra) { try { console.log('[MOCK] 称号效果: 带回的东西 ×' + gs + ' -> 多带 ' + extra + ' 份特产/纪念品'); } catch (e) {} }
      }
    } catch (e) {}
    /* 称号效果(new.txt): 「青蛙之叶」类称号让带回的三叶草变多 */
    var cloverGain = 30;
    try { if (window.MOCK_TITLE && window.MOCK_TITLE.cloverScale) cloverGain = Math.round(30 * (Number(window.MOCK_TITLE.cloverScale()) || 1)); } catch (e) {}
    st.clover += cloverGain;
    /* 明信片按池子抽(new/postcardpool.js): 普通/道具/目的地照/稀有照, 行李里的护身符提高稀有率。
       以前是 60 个 id 均匀随机 -> 客户端表里的 Goal(151)/Unique(133) 永远不掉。 */
    var pid = (typeof window.MOCK_PICK_PHOTO === 'function')
      ? window.MOCK_PICK_PHOTO(st.lastTripItems || [])
      : PIC_IDS[Math.floor(Math.random()*PIC_IDS.length)];
    var photo = { id: st.nextPhoto++, pic_id: pid };
    st.photos.push(photo);
    push('item_load_items', S['item_load_items'](), 20);
    push('client_load_role', roleData(), 40);
    push('album_load_new', { pictures: [photo], has_ads:false, is_share:false, visted_pic: [] }, 70);
    push('travel_load_note', {note_list: st.notes}, 90);
    push('clover_update', {clover: st.clover}, 130);
    push('travel_load_gift', S['travel_load_gift'](), 150);
    /* ---- 归来结算三缺(清单四·6/五·4·5·6): 抽奖券 / 信件 / 访客 --------------------------
       以前 comeBack() 只给 笔记+特产+三叶草+明信片: 抽奖券永远不涨、邮箱永远只有 2 封静态信、
       访客与归来完全无关(独立定时器)。这里补上, 都用客户端真实协议推送。 */
    var addTicket = Math.random() < 0.5 ? 1 : 2;
    st.ticket = (Number(st.ticket) || 0) + addTicket;
    push('item_update_ticket', { ticket: st.ticket }, 110);
    var mailId = null;
    try {
      if (window.MOCK_ADD_MAIL && Math.random() < 0.7) {          /* 旅友来信(带一点手信) */
        var from = ["困困", "胖胖", "跳跳", "嘟嘟"][Math.floor(Math.random() * 4)];
        var giftItem = GIFT_IDS.length ? GIFT_IDS[Math.floor(Math.random() * GIFT_IDS.length)] : 3000;
        mailId = window.MOCK_ADD_MAIL({
          title: from + "的来信",
          message: "路上遇到好玩的事，顺手给你带了点东西。",
          type: 3,
          resource: { clover_point: 20, ticket: 0, ads_id: "" },
          items: [{ item_id: giftItem, count: 1 }],
          sender: -1
        });
      }
    } catch (e) {}
    try { if (window.MOCK_SPAWN_VISITOR && Math.random() < 0.5) window.MOCK_SPAWN_VISITOR(); } catch (e) {}
    try { console.log("[MOCK] 回家: 笔记 " + (nid===null?"-":nid) + " 明信片 " + photo.id + " 三叶草 " + st.clover +
                     " 抽奖券+" + addTicket + "=" + st.ticket + " 来信=" + (mailId === null ? "无" : ("#" + mailId))); } catch(e){}
  }
  setInterval(function(){ try { if (st.frog.traveling && Date.now() >= st.frog.returnAt) comeBack(); } catch(e){} }, 4000);
  /* 调试/测试入口: 立刻结算一次"旅行归来"(与 4 秒泵走的是同一条路) */
  window.MOCK_COME_HOME = function(){ try { st.frog.traveling = true; st.frog.returnAt = Date.now() - 1000; comeBack(); return true; } catch (e) { return false; } };

  S['item_load_items'] = function(){
    if (!Array.isArray(st.bag) || st.bag.length !== BAG_SLOTS) st.bag = normalise(st.bag, BAG_SLOTS);
    if (!Array.isArray(st.desk) || st.desk.length !== DESK_SLOTS) st.desk = normalise(st.desk, DESK_SLOTS);
    /* 清掉 count<=0 的幽灵行: 客户端 ItemModel.getHouseItemsByType() **不看数量**, 只看这个 type 桶里有几个 key
       —— 合成三拼(COMPOSE 16)的碎片被扣到 0 以后如果还留着条目, HandCraftModel.updateComposeRedot()
       的 `t.length>=3` 恒真 -> 工具栏「其他」页签的红点永远消不掉(用户截图报的"木制护符的三拼技巧红点始终存在")。
       所以出口统一剔除 count<=0 的行。 */
    if (Array.isArray(st.house)) {
      var cleaned = [], dropped = 0;
      for (var hi = 0; hi < st.house.length; hi++) {
        var h = st.house[hi];
        if (!h) continue;
        if ((Number(h.count) || 0) <= 0) { dropped++; continue; }
        cleaned.push(h);
      }
      if (dropped) {
        st.house = cleaned;
        try { console.log('[MOCK] 物品栏: 清掉 ' + dropped + ' 条数量为 0 的幽灵行'); } catch (e) {}
        try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {}
      }
    }
    /* bag_completed drives ItemModel.bagLock: 1 = 便当已备好, 青蛙出发中 */
    return { house: st.house, bag: st.bag, desk: st.desk, bag_completed: st.bagCompleted ? 1 : 0,
             bag_conflict: 0, desk_conflict: 0, gacha: {color_ball:-1} };
  };
  /* 嘟嘟商店: 每天刷新一次限购(以前 purchased 只增不减, 买过就永远售罄) */
  function todayKey(){ var d = new Date(); return d.getFullYear() + chr(45) + (d.getMonth()+1) + chr(45) + d.getDate(); }
  S['item_load_shop_info'] = function(){
    st.purchased = st.purchased || [];
    var t = todayKey();
    if (st.shopDay !== t) { st.shopDay = t; st.purchased = []; try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
    return { purchased: st.purchased }; };
  S['shop_refresh'] = function(){ st.shopDay = todayKey(); st.purchased = []; return { code: 0 }; };

  /* 兑换码: 官方码池已随停服消失, 这里接受任意非空码, 每码只发一次奖(幂等) */
  S['item_use_gift_code'] = function(p){
    var code = String((p && (p.code || p.gift_code || p.id)) || 0).trim();
    if (!code) return { code: 1 };
    st.usedCodes = st.usedCodes || [];
    if (st.usedCodes.indexOf(code) >= 0) return { code: 2 };
    st.usedCodes.push(code);
    st.clover += 100; st.ticket += 1;
    try { pushClover(); } catch (e) {}
    try { push('item_update_ticket', { ticket: st.ticket }, 40); } catch (e) {}
    try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {}
    try { console.log('[MOCK] 兑换码 ' + code + ' -> 三叶草+100 抽奖券+1'); } catch (e) {}
    /* 客户端 CdkeyView: if(200==e.code) 才显示"礼包码兑换成功", 否则按 1..4 报
       "分享码无效/已被兑换过/不能兑换自己分享的/已过期" -> 成功必须回 200, 不是 0 */
    return { code: 200 };
  };
  S['item_load_shop_info'] = function(){ return { purchased: st.purchased || [] }; };
  /* item_buy: the client handler also reads e.ticket / e.ads_id / e.share_id
     (contract audit) - a bare {code:0} left the ticket and ad-share paths undefined */
  function buyResult(code, ticket){
    return { code: code,
             ticket: (typeof ticket === 'number') ? ticket : 0,
             ads_id: [], share_id: [] };
  }
  S['item_buy'] = function(p){
    var iid = SHOP_ITEM[String(p.shop_id)];
    try { console.log('[MOCK] item_buy REQ shop_id=' + sid + ' -> itemId=' + iid + ' type=' + ((typeof ITEM_TYPE !== 'undefined') ? ITEM_TYPE[String(iid)] : '?')); } catch (e) {}
    if (iid === undefined) { try { console.log('[MOCK] item_buy 无法解析商品, 返回 code1'); } catch (e) {} return buyResult(1); }
    var cost = itemPrice(iid);
    if (st.clover < cost) return buyResult(2);
    st.clover -= cost;
    var slot = firstEmpty(st.bag);
    if (slot < 0) return buyResult(3);
    if (st.bag.indexOf(iid) < 0) st.bag[slot] = iid;
    st.purchased = st.purchased || []; st.purchased.push({item_id: (p.shop_id!==undefined?p.shop_id:iid), count: 1});
    pushItems(); pushClover();
    try { console.log('[MOCK] item_buy OK itemId=' + iid + ' house=' + JSON.stringify((st.house || []).slice(-3)) + ' bag=' + JSON.stringify(st.bag)); } catch (e) {}
    return buyResult(0);
  };
  function normalise(a, n){
    n = n || 8; var out = SLOTS(n);
    if (Array.isArray(a)) for (var i=0;i<a.length && i<n;i++){ var v=a[i]; out[i] = (v===null||v===undefined)?-1:v; }
    return out;
  }
  function putIn(arr, pos, id){
    var idx = (pos||1) - 1; if (idx < 0 || idx >= arr.length) idx = firstEmpty(arr); if (idx < 0) return;
    var j = st.bag.indexOf(id); if (j >= 0) st.bag[j] = -1;
    arr[idx] = id;
  }
  S['item_putin_bag'] = function(p){ putIn(st.bag, p.pos||1, paramItemId(p)); pushItems(); return {code:0}; };
  S['item_takeout_bag'] = function(p){ var i=(p.pos||1)-1; if (i>=0&&i<8) st.bag[i] = -1; pushItems(); return {code:0}; };
  S['item_putin_desk'] = function(p){
    putIn(st.desk, p.pos||1, paramItemId(p)); pushItems();
    if (isFood(paramItemId(p)) && !st.frog.traveling) depart();
    return {code:0};
  };
  S['item_takeout_desk'] = function(p){
    var pos=(p.pos||1)-1, id = st.desk[pos]; st.desk[pos] = -1;
    if (id!==null && id!==undefined && id!==-1 && st.bag.indexOf(id)<0) { var sl=firstEmpty(st.bag); if (sl>=0) st.bag[sl]=id; }
    pushItems(); return {code:0};
  };
  S['item_select_gift'] = function(p){
    var idx=p.index_list||[], out=[];
    for (var i=0;i<idx.length;i++) out.push({item_id: st.bag[idx[i]]||0, count:1, is_selected:1});
    return {items: out};
  };
  S['clover_load_clovers'] = function(){ return []; };
  S['clover_harvest'] = function(p){ addClover(10); return {clover: st.clover}; };
  S['travel_load_note'] = function(){ return { note_list: st.notes }; };
  /* 客户端 sendReadNote() 传的是**数组**: send("travel_read_note", null, ids)
     协议参数名是 id -> p.id 是 [1000,1001,...], 以前按单值比较永远不匹配, 于是感叹号点不掉 */
  S['travel_read_note'] = function(p){
    var ids = (p && Object.prototype.toString.call(p.id) === '[object Array]') ? p.id : [p && p.id];
    for (var k=0;k<ids.length;k++)
      for (var i=0;i<st.notes.length;i++) if (st.notes[i].id === ids[k]) st.notes[i].read = 1;
    push('travel_load_note', {note_list: st.notes}, 20); return {code:0};
  };
  /* 礼品盒: 特产(st.gifts) + 照片(st.giftPhotos, **独立**于相册)。
     以前 pictures 回的是"相册里所有照片的 id" ⇒ 礼盒清不空, 而且 travel_album_to_gift /
     travel_gift_to_album 只回 {code:0} 什么都不搬(客户端点了没反应)。
     容量: 盒子 30 张(满了回 100), 相册 60 张(满了回 101) —— 客户端就是按这两个码弹提示的。 */
  var BOX_PIC_MAX = 30, ALBUM_MAX = 60;
  function boxPhotos() { return Array.isArray(st.giftPhotos) ? st.giftPhotos : (st.giftPhotos = []); }
  S['travel_load_gift'] = function(){ return { pictures: boxPhotos().slice(), specialtys: st.gifts }; };
  S['travel_album_to_gift'] = function(p){
    var id = Number(p && (p.picture_id !== undefined ? p.picture_id : p.id));
    if (boxPhotos().length >= BOX_PIC_MAX) { try { console.log('[MOCK] 礼盒照片已满 ' + BOX_PIC_MAX + ' -> code 100'); } catch (e) {} return { code: 100 }; }
    var idx = -1;
    for (var i = 0; i < st.photos.length; i++) if (Number(st.photos[i].id) === id) idx = i;
    if (idx < 0) return { code: 1 };
    var ph = st.photos.splice(idx, 1)[0];
    boxPhotos().push(ph);
    try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {}
    push('travel_load_gift', S['travel_load_gift'](), 30);
    push('album_load', S['album_load']({ start: 1, count: ALBUM_MAX }), 60);
    try { console.log('[MOCK] 照片 ' + id + ' 进礼盒 (盒 ' + boxPhotos().length + '/' + BOX_PIC_MAX + ', 相册 ' + st.photos.length + ')'); } catch (e) {}
    return { code: 0 };
  };
  S['travel_gift_to_album'] = function(p){
    var id = Number(p && (p.picture_id !== undefined ? p.picture_id : p.id));
    if (st.photos.length >= ALBUM_MAX) { try { console.log('[MOCK] 相册已满 ' + ALBUM_MAX + ' -> code 101'); } catch (e) {} return { code: 101 }; }
    var box = boxPhotos(), idx = -1;
    for (var i = 0; i < box.length; i++) if (Number(box[i] && box[i].id) === id) idx = i;
    if (idx < 0) return { code: 1 };
    var ph = box.splice(idx, 1)[0];
    st.photos.push(ph);
    try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {}
    push('travel_load_gift', S['travel_load_gift'](), 30);
    push('album_load', S['album_load']({ start: 1, count: ALBUM_MAX }), 60);
    try { console.log('[MOCK] 照片 ' + id + ' 回相册 (盒 ' + box.length + ', 相册 ' + st.photos.length + '/' + ALBUM_MAX + ')'); } catch (e) {}
    return { code: 0 };
  };
  /* 相册分页: 客户端 `album_load(start, count)` 按 `pictureInfoList[e.start+n-1] = i[n]` 填绝对下标,
     以前我们忽略 start/count 永远回全部 + start=1 —— 靠客户端前缀填充侥幸能用, 但一旦分页就错位。 */
  S['album_load'] = function(p){
    var total = st.photos.length;
    var start = Math.max(1, Number(p && p.start) || 1);
    var count = Number(p && p.count) || total || 1;
    return { pictures: st.photos.slice(start - 1, start - 1 + count), start: start, total: total };
  };
  S['album_load_all'] = function(){ return { id_list: st.photos }; };
  S['album_load_by_id_list'] = function(){ return { pic_list: [] }; };
  S['album_load_new'] = function(){ return { pictures: [], has_ads:false, is_share:false, visted_pic: [] }; };
  S['visit_load'] = function(){
    /* acquire holds PROVINCE names (client: acquireList.indexOf(province.Province)) */
    return { visitor: null, acquire: PROV_NAMES.slice(0,6) };
  };
  S['visit_set_carpet'] = function(p){ return {code:0}; };
  S['visit_open'] = function(p){ return {code:0}; };
  S['visitor_invite'] = function(p){
    /* a well-formed visitor: city must be "<province>_<city>" with province in provinceList,
       and partner must exist in actionList */
    var prov = PROV_NAMES.length ? PROV_NAMES[Math.floor(Math.random()*PROV_NAMES.length)] : "北京";
    var part = ACT_KEYS.length ? Number(ACT_KEYS[Math.floor(Math.random()*ACT_KEYS.length)]) : 0;
    return { visitor: { partner: part, name:"", title:0, expire_time: nowSec()+1800, city: prov+"_城区",
                        food:0, first:false, gift:{item_id:100000,count:20}, carpet:1 } };
  };
  S['travel_gift_to_bag'] = function(p){ return {code:0}; };
  S['travel_bag_to_gift'] = function(p){ return {code:0}; };
  S['lottery_open'] = function(p){
    var pool=[0,1,2,3,4,5,15,19];
    var iid=pool[Math.floor(Math.random()*pool.length)];
    if (st.bag.indexOf(iid)<0) st.bag.push(iid);
    pushItems(); return { open_item:{item_id:iid,count:1}, extra_item:null };
  };
  S['lottery_select'] = function(p){ return {code:0}; };
  S['task_get_reward'] = function(p){ addClover(50); return {code:0}; };
  S['task_get_list_reward'] = function(p){ addClover(100); return {code:0}; };
  S['furniture_buy_shop'] = function(p){ var _f=S['furniture_load_furniture']; push('furniture_load_furniture', (typeof _f==='function'?_f():_f)||{}, 20); return {code:0}; };
  S['client_rename_cost'] = function(){ return {clover:0}; };
  S['client_set_name'] = function(p){ st.name = p.name; return {code:0, lucky:0}; };
  /* ---- clover grows in the courtyard: it must be harvestable ----
     客户端的可见/可采规则(RoleModel + CloverManager):
       last_harvest == -1  或  (last_harvest > 0 且 last_harvest + rebirth_span <= now)
     旧存档里 last_harvest 是 0 -> 两条件都不满足 -> 永远看不见三叶草, 这里迁移成 -1。
     element: 0 = 三叶草(+1), 1 = 四叶草(道具 1000), 2 = 直接给 sprite 这个道具 ---- */
  st.clovers = st.clovers || [
    {clover_id:1, last_harvest:-1, rebirth_span:1800, element:0, sprite:0},
    {clover_id:2, last_harvest:-1, rebirth_span:1800, element:0, sprite:0},
    {clover_id:3, last_harvest:-1, rebirth_span:1800, element:0, sprite:0}
  ];
  for (var ci=0; ci<st.clovers.length; ci++){ var cc = st.clovers[ci]; if (!cc) continue;
    if (cc.last_harvest === 0 || cc.last_harvest === undefined || cc.last_harvest === null) cc.last_harvest = -1;
    if (typeof cc.rebirth_span !== 'number' || cc.rebirth_span <= 0) cc.rebirth_span = 1800;
    if (typeof cc.element !== 'number') cc.element = 0;
  }
  S['clover_load_clovers'] = function(){ return st.clovers; };
  function cloverRoll(){ var r = Math.random(); return r < 0.12 ? 1 : (r < 0.22 ? 2 : 0); }
  var CLOVER_DROPS = [1002,1003,1004,1005,1006,1007,1008,1009,1010,1013,1014,1015,1016];
  function houseAdd(it, n){ st.house = st.house || [];
    for (var i=0;i<st.house.length;i++) if (Number(st.house[i].item_id) === Number(it)) { st.house[i].count = (st.house[i].count||0) + (n||1); return; }
    st.house.push({item_id: Number(it), count: n || 1}); }
  S['clover_harvest'] = function(p){
    var id = (p && (p.clover_id || p.id)) || 1, seen = null;
    for (var i=0;i<st.clovers.length;i++) if (Number(st.clovers[i].clover_id) === Number(id)) seen = st.clovers[i];
    if (!seen) seen = st.clovers[0];
    var el = Number(seen.element) || 0, sp = seen.sprite;
    /* 客户端在本地已经先发了奖励, 服务端必须镜像同一份, 否则两边会对不上 */
    if (el === 1) houseAdd(1000, 1);
    else if (el === 2 && sp) houseAdd(sp, 1);
    else { st.clover += 1; }
    seen.last_harvest = Math.floor(Date.now()/1000);
    seen.rebirth_span = 90 + Math.floor(Math.random()*331);
    var el2 = cloverRoll();
    seen.element = el2;
    seen.sprite = el2 === 2 ? CLOVER_DROPS[Math.floor(Math.random()*CLOVER_DROPS.length)] : 0;
    pushClover();
    try { push('item_load_items', S['item_load_items'](), 40); } catch(e){}
    return { clover_id: Number(seen.clover_id) };
  };
  S['clover_harvest_resend'] = function(p){ return {clover_id: (p && (p.clover_id || p.id)) || 0}; };
  S['clover_update'] = function(){ return {clover: st.clover}; };
  /* ---- calendar: beginner / lucky / st rewards ---- */
  function grantItem(item_id, count){
    if (item_id === 100000) { st.clover += (count||1); pushClover(); }
    else if (item_id === 100001) { st.ticket += (count||1); }
    else { for (var i=0;i<(count||1);i++) if (st.bag.indexOf(item_id) < 0) st.bag.push(item_id); pushItems(); }
  }
  S['calendar_load'] = function(){ var d = new Date(), today = d.getDate(); /* 客户端会 Utils.convertArray(lucky_days/st_days) 再取 t[i].day / t[i].item_id:    必须是数组, 以前给对象 -> 日历页读不到, 与现实时间对不上 */ return { lucky_days: []   /* 花的落点由客户端按真实日期自绘(我们控制不了), 为避免画错格子先不发标记 */,          st_days: (st.calClaimed && st.calClaimed['st_' + today]) ? [] : [{day: calCell(today), item_id: st.cloverId || 1}],
          /* 当日任务必须非空: 客户端 req_st_reward 成功回调里有 data.task_list[0].complete=!1,
             空数组会抛异常 -> checkRedot 不执行 -> 红点常亮/节气图标不消失(用户报的"点了没反应")。 */
          task_list: (window.MOCK_TASKS && window.MOCK_TASKS.calendarDayTasks) ? window.MOCK_TASKS.calendarDayTasks() : [{id: 101, complete: 0}],          new_flag: (typeof Utils !== 'undefined' && Utils.convertArray) ? Utils.convertArray(st.newFlag) : (st.newFlag || []),          note_list: [] }; };
  S['calendar_load_note'] = function(){ return {list: []}; };
  /* 日历格子下标: 客户端月历从周一开始且第一格显示上月末尾几天,
     lucky_days/st_days 是按"格子下标"赋值的(lucky_days[t[i].day] = item_id),
     所以今天所在格 = (1号的周一偏移) + 今天 - 1, 不是"几号"。 */
  /* 格子下标必须按**底图那年**算: calendar_*.png 是 2023 年的版面(2023-09-01 是周五,
     首行显示 28/29/30/31), 而 2026-09-01 是周二 —— 用当前年份算偏移会让标记错 3 格 */
  var CAL_ART_YEAR = 2023;
  /* 实测标定: 服务端下标 13 被客户端画在底图的"9"号格上 -> 索引 = 偏移 + day
     (客户端是 1 基的格子编号), 2023-09 偏移 4 => 13 号 -> 17 */
  function calCell(day){ var d=new Date(), f=new Date(CAL_ART_YEAR, d.getMonth(), 1);
    return ((f.getDay()+6)%7) + day; }
  function calSave(){ try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch(e){} }
  function calClaim(idx, itemId, num){ st.newFlag = st.newFlag || [];
    if (st.newFlag[idx]) return { code: 1 };
    st.newFlag[idx] = 1; grantItem(itemId, num || 1); calSave();
    push('calendar_load', S['calendar_load'](), 30);
    return { code: 0, day: new Date().getDate() }; }
  S['calendar_get_luck_reward'] = function(){ return calClaim(calCell(new Date().getDate()), 100000, 1); };
  S['calendar_get_st_reward'] = function(){ return calClaim(calCell(new Date().getDate())+100, st.cloverId || 1, 1); };
  S['calendar_get_beginer_reward'] = function(){ var i = st.beginnerDay || 0; st.beginnerDay = i + 1; return calClaim(i, 100000, 5); };
  S['calendar_get_code_reward'] = function(p){ var day = Number(p && p.day) || new Date().getDate();
    return calClaim(calCell(day), 100000, 2); };
  /* ---- encyclopedia / encytravel: real desc data from config.eab ---- */
  S['encyclopedia_load'] = function(){ return { unlock_list: ENCY_UNLOCK, unlock_desc: ENCY_DESC, show_sub: ENCY_SUB }; };
  S['encytravel_load'] = function(){ return { unlock_list: ET_UNLOCK, unlock_desc: ET_DESC, show_sub: ET_SUB }; };
  S['encyclopedia_set_show_sub'] = function(p){ 
    for (var i=0;i<ENCY_SUB.length;i++) if (ENCY_SUB[i].id === p.id) ENCY_SUB[i].sub_id = p.sub_id;
    return {code:0};
  };
  S['encytravel_set_show_sub'] = function(p){ 
    for (var i=0;i<ET_SUB.length;i++) if (ET_SUB[i].id === p.id) ET_SUB[i].sub_id = p.sub_id;
    return {code:0};
  };
  S['calendar_get_beginer_reward'] = function(){
    var day = st.beginnerDay || 1;
    var cfg = BEGINNER[String(day)];
    if (cfg) { grantItem(cfg.item_id, cfg.num || 1); if (st.newFlag.length < day) st.newFlag[day-1] = 1; }
    return { day: day };
  };
  S['calendar_get_luck_reward'] = function(){ addClover(50); return {code:0}; };
  S['calendar_get_st_reward'] = function(){ addClover(100); return {code:0}; };
  S['calendar_get_code_reward'] = function(p){ addClover(20); return {day: p.day || 1}; };
  /* S['travel_depart_now'] 已删除: 它不在客户端 245 条 ProtocolList 里, 永远收不到。
     要强制出发请用调试通道: curl -s -X POST -d "away" http://127.0.0.1:8089/gm */

  /* ---- calendar 领奖: 最终生效版本 ----------------------------------------
     必须放在文件末尾: 前面既有的实现(+50 三叶草、可重复领)与我这轮插入的副本
     都是同名的 S[...] 赋值, JS 后定义者胜 —— 这里覆盖前面全部, 用独立 st.calClaimed
     记已领, 奖励按表格(calendarData)给的那一天发, 并推 calendar_load 刷新界面。
     注意: 本块是手改的, 重新运行 tools/genrules.py 会丢失, 需要同步过去。 */
  (function () {
    function logCal(m) { try { console.log('[MOCK] 日历: ' + m); } catch (e) {} }
    function claimed() { st.calClaimed = st.calClaimed || {}; return st.calClaimed; }
    function doClaim(key, itemId, n, dayIdx) {
      /* 已领判定以客户端可见的 new_flag 为准(它自己也写 new_flag[day-1]):
         之前用独立 calClaimed 记录, 导致被 code:1 挡掉却没发奖的那天永远领不了 */
      st.calClaimed = st.calClaimed || {};
      if (!st.calGuardV2) { st.calClaimed = {}; st.calGuardV2 = 1; }
      var c = claimed(), flagIdx = (Number(dayIdx) || 1) - 1;
      st.newFlag = st.newFlag || [];
      if (c[key] || st.newFlag[flagIdx]) return { code: 1 };
      c[key] = 1; st.newFlag[flagIdx] = 1;
      /* 奖励与客户端读的同一张表一致: 客户端领奖时读 calendarData.get(beginner)[day] 的 {item_id,num} */
      var it = null;
      try { var dm = Tabikaeru.DataManager.instance(), tb = dm && dm.calendarData && dm.calendarData.get('beginner');
            if (tb) it = tb[dayIdx] || tb[String(dayIdx)] || null; } catch (e) {}
      if (it && it.item_id) { try { grantItem(it.item_id, it.num || 1); } catch (e) {} }
      else { try { grantItem(itemId, n); } catch (e) {} }
      try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {}
      try { pushClover(); } catch (e) {}
      try { push('calendar_load', S['calendar_load'](), 30); } catch (e) {}
      return { code: 0, day: new Date().getDate() };
    }
    S['calendar_get_luck_reward'] = function () { return doClaim('luck_' + new Date().getDate(), 100000, 1, new Date().getDate()); };
    S['calendar_get_st_reward'] = function () {
      /* 节气奖励的前置条件与客户端 canGetStReward() 一致: 当日任务全部完成。
         客户端的按钮只在 canGetStReward() 为真时可点, 这里镜像一份, 免得被脚本刷。 */
      try {
        var dt = (window.MOCK_TASKS && window.MOCK_TASKS.calendarDayTasks) ? window.MOCK_TASKS.calendarDayTasks() : null;
        if (dt && dt.length) { for (var i = 0; i < dt.length; i++) if (!dt[i].complete) { logCal('节气奖励: 当日任务还没做完 (' + dt[i].id + ') -> code 1'); return { code: 1 }; } }
      } catch (e) {}
      return doClaim('st_' + new Date().getDate(), st.cloverId || 1, 1, new Date().getDate());
    };
    S['calendar_get_beginer_reward'] = function () { var i = st.beginnerDay || 0; st.beginnerDay = i + 1; return doClaim('begin_' + i, 100000, 5, i + 1); };
    S['calendar_get_code_reward'] = function (p) { var day = Number(p && p.day) || new Date().getDate(); return doClaim('code_' + day, 100000, 2, day); };
  })();

  /* ---- 最终生效版本(放在文件末尾, 覆盖前面所有同名实现) --------------------
     教训: 用 append 加新实现时, 若前面还有同名赋值, 后定义者才生效;
     之前商店/兑换码就是被前面的实现盖掉了(servicetest 三条 FAIL 暴露)。 */
  function todayKey2() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  S['item_load_shop_info'] = function () {
    st.purchased = Array.isArray(st.purchased) ? st.purchased : [];
    var t = todayKey2();
    if (st.shopDay !== t) { st.shopDay = t; st.purchased = []; try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
    return { purchased: st.purchased };
  };
  S['shop_refresh'] = function () { st.shopDay = todayKey2(); st.purchased = []; try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} return { code: 0 }; };
  S['item_use_gift_code'] = function (p) {
    var raw = p && (p.code !== undefined ? p.code : (p.gift_code !== undefined ? p.gift_code : p.id));
    var code = (raw === undefined || raw === null) ? '' : String(raw).trim();
    if (!code) return { code: 1 };
    st.usedCodes = Array.isArray(st.usedCodes) ? st.usedCodes : [];
    if (st.usedCodes.indexOf(code) >= 0) return { code: 2 };
    st.usedCodes.push(code);
    st.clover = (Number(st.clover) || 0) + 100;
    st.ticket = (Number(st.ticket) || 0) + 1;
    try { pushClover(); } catch (e) {}
    try { push('item_update_ticket', { ticket: st.ticket }, 40); } catch (e) {}
    try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {}
    return { code: 200 };
  };

  /* 客户端 calendar_task_update: e && e.task && (data.task_list[e.task.id-1] = e.task) ——
     以前自动存根回 {task:{id:0}}, 会写到下标 -1 造成脏数据; 现在回空对象(无任务)。 */
  S['calendar_task_update'] = function () {
    /* 客户端 handler: e && e.task && (data.task_list[e.task.id-1] = e.task) —— 回空对象等于没更新。
       它是"推送型"协议, 但客户端/契约检查都会来问一次, 所以给第一条当日任务。 */
    var t = null;
    try { if (window.MOCK_TASKS && window.MOCK_TASKS.calendarDayTasks) { var a = window.MOCK_TASKS.calendarDayTasks(); t = a && a.length ? a[0] : null; } } catch (e) {}
    if (!t) t = { id: 1, pro: 0, complete: 0 };
    return { task: t };
  };

  /* ---- 排行榜: 本地假榜(单机不可能有真榜) ----------------------------------
     客户端 rank_load 读: e.me -> selfInfo, e.info[] -> info, keyed by duration+type;
     每个榜项按"客户端可能读的字段"给足, 避免 undefined 渲染。 */
  function rankEntry(rank) {
    return { uid: 10001, rank: rank, name: st.name || '小蛙', score: (Number(st.travelCount) || 0) * 10 + ((st.collections || []).length) * 5,
             icon: 0, achieve: 0, step: Number(st.frog && st.frog.todayStep) || 0,
             clover: Number(st.clover) || 0, picture: (st.photos || []).length, is_self: 1 };
  }
  S['rank_load'] = function () { var me = rankEntry(1); return { me: me, info: [me], first_intro: 0 }; };
  S['rank_get_intro'] = function () { return { intro: '' }; };
  S['rank_like'] = function () { return { code: 0 }; };

  /* ---- 最终生效的 calendar_load -------------------------------------------
     底图(2023 版面)与真实年份的星期排布不同, 客户端按真实日期自绘的"幸运日花"
     必然错格; 所以这里不再下发 lucky_days / st_days, 改由 new/calpatch.js 在
     正确格子上画今日标记。 (同名赋值后定义者胜 -> 放在文件末尾) */
  S['calendar_load'] = function () {
    var d = new Date(), today = d.getDate();
    /* ★ 关键: st_days/lucky_days 的键是**当月第几天**(客户端 CalendarView: o = imageList.length,
       渲染读 u.data.st_days[o]、点击也传同一个 o)。以前这里发的是 calCell(today)=2023版面偏移+day,
       于是 st_days 的键根本对不上任何格子 -> `t.data.st_days[o]` 恒假 -> 点格子什么都不发
       ("点了没反应"、节气奖励永远领不到)。现在按当月第几天发, 图标与可点格子必然一致。 */
    var stDays = (st.calClaimed && st.calClaimed['st_' + today]) ? [] : [{ day: today, item_id: st.cloverId || 1 }];
    /* 当日任务必须非空: 客户端 req_st_reward 成功回调里有 data.task_list[0].complete=!1,
       空数组会抛异常 -> checkRedot 不执行 -> 红点常亮、图标不消失。 */
    var dayTasks = (window.MOCK_TASKS && window.MOCK_TASKS.calendarDayTasks) ? window.MOCK_TASKS.calendarDayTasks() : [{ id: 101, complete: 0 }];
    try { window.__lastLucky = []; window.__lastSt = stDays; window.__lastNewFlag = (st.newFlag || []).slice(0, 16); } catch (e) {}
    return { lucky_days: [], st_days: stDays, new_flag: (st.newFlag || []), task_list: dayTasks, note_list: [] };
  };
  S['calendar_load_note'] = function () { return { list: [] }; };

  /* ---- 嘟嘟商店: 商品来自客户端自己的 ShopDataDB + before_buy 解锁链 + 按日轮换 ---- */
  function shopTable() {
    try {
      var dm = Tabikaeru.DataManager.instance();
      var db = dm && (dm.ShopDataDB || dm.shopDataDB);
      var l = (db && typeof db.list === 'function') ? db.list() : null;
      if (l && l.length) return l;
    } catch (e) {}
    return null;
  }
  /* 说明: 客户端的商店列表来自它自己的 ShopDataDB(静态表), 服务端唯一的杠杆是
     `purchased`(限购/解锁链, 见 getShopItemBuynums) 与嘟嘟那边的 num。以前这里还按天轮换了一份
     list 塞进回包, 但客户端 item_load_shop_info 只读 e.purchased —— 纯死代码, 已删除。
     真正的每日刷新 = 每天把 purchased 清零(下面两处), 已有 servicetest 覆盖。 */
  S['item_load_shop_info'] = function () {
    st.purchased = Array.isArray(st.purchased) ? st.purchased : [];
    var t = todayKey2();
    if (st.shopDay !== t) { st.shopDay = t; st.purchased = []; try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
    return { purchased: st.purchased };
  };

  /* ---- item_buy 最终版: 买到的物品必须真的进物品栏 ----------------------------
     以前一律塞进 4 格背包 -> 道具/家具(house 类)在界面上永远看不到, 用户报"买完没进物品栏"。
     规则: 食物(type 0) 进背包空格; 其余(道具/护身符/家具等) 进 st.house 并累加数量。 */
  S['item_buy'] = function (p) {
    var sid = Number(p && (p.shop_id !== undefined ? p.shop_id : p.id));
    var iid = (typeof SHOP_ITEM !== 'undefined') ? SHOP_ITEM[String(sid)] : undefined;
    if (iid === undefined) { try { var dm2 = Tabikaeru.DataManager.instance(), tb2 = dm2 && (dm2.ShopDataDB || dm2.shopDataDB);
        var row = tb2 && typeof tb2.get === 'function' ? tb2.get(sid) : null; if (row && row.itemId !== undefined) iid = Number(row.itemId); } catch (e) {} }
    if (iid === undefined) return buyResult(1);
    var cost = itemPrice(iid);
    if ((Number(st.clover) || 0) < cost) return buyResult(2);
    /* 限购: 客户端的 purchasedMap 是**以商店行 id 为键**, isShopItemBuyLimit(sid) 用
       ShopDataDB.get(sid).limit 判定, 解锁链(before_buy: 相册扩容/手工品材料)也读这个键。
       以前我们记的是**物品 id** -> 客户端 purchasedMap[sid] 永远是 0 -> 限购失效、
       相册扩容 2..12 与"手工品材料"永远不出现(真机日志里 9000 被反复买、三叶草每次 -1000)。 */
    var lim = 0;
    try {
      var dmS = Tabikaeru.DataManager.instance(), tbS = dmS && (dmS.ShopDataDB || dmS.shopDataDB);
      var rowS = (tbS && typeof tbS.get === 'function') ? tbS.get(sid) : null;
      if (rowS && Number(rowS.limit) > 0) lim = Number(rowS.limit);
    } catch (e) {}
    st.purchased = Array.isArray(st.purchased) ? st.purchased : [];
    var boughtN = 0;
    for (var pi = 0; pi < st.purchased.length; pi++) if (Number(st.purchased[pi].item_id) === Number(sid)) boughtN += Number(st.purchased[pi].count) || 0;
    if (lim > 0 && boughtN >= lim) { try { console.log('[MOCK] item_buy 限购拦截 shop_id=' + sid + ' 已买 ' + boughtN + '/' + lim); } catch (e) {} return buyResult(3); }
    st.clover -= cost;
    st.purchased.push({ item_id: sid, count: 1 });
    /* 商店买到的东西一律进 st.house(可堆叠的仓库/物品栏): 以前把食物塞进 4 格背包,
       背包一满就 code:3, 而扣款发生在这之前 -> 用户看到"扣了钱、东西没进"(日志证据:
       item_buy OUT {"code":3}, house 里没有任何新物品)。 */
    var itype = (typeof ITEM_TYPE !== 'undefined') ? Number(ITEM_TYPE[String(iid)]) : 1;
    if (false) {
    } else {
      st.house = Array.isArray(st.house) ? st.house : [];
      var found = null;
      for (var i = 0; i < st.house.length; i++) if (st.house[i] && Number(st.house[i].item_id) === Number(iid)) found = st.house[i];
      if (found) found.count = (Number(found.count) || 0) + 1; else st.house.push({ item_id: Number(iid), count: 1 });
    }
    try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {}
    pushItems(); pushClover();
    /* 把买完的最新状态直接放进应答: 部分界面只读回包, 不重新拉列表, 以前因此出现 */
    /* 「扣款了但数字/物品栏要重启才刷新」「看不到买到的东西」。 */
    var ans = buyResult(0);
    ans.clover = st.clover;
    ans.ticket = st.ticket;
    ans.house = st.house || [];
    ans.bag = st.bag || [];
    ans.desk = st.desk || [];
    ans.purchased = st.purchased || [];
    ans.item_id = iid;
    return ans;
  };

  /* clover_harvest_resend 的应答, 客户端是按 clover_load_clovers 来消费的
     (i.clover_load_clovers(Utils.convertArray(e), null)), 所以必须回**完整的三叶草列表数组**;
     以前回 {clover_id:...} -> 它的 harvestCloverList 永远清不掉 -> 购买链
     syncHarvestClover(false, cb) 里的 cb 不执行 -> item_buy 永不发出(用户报"买东西没扣款")。 */
  S['clover_harvest_resend'] = function () {
    try { return (typeof S['clover_load_clovers'] === 'function') ? S['clover_load_clovers']() : (st.clovers || []); }
    catch (e) { return st.clovers || []; }
  };

  /* 诊断: 包住 item_buy 与 item_load_items, 把入参/回包/异常都打出来 */
  (function () {
    ['item_buy', 'item_load_items'].forEach(function (n) {
      var orig = S[n];
      if (typeof orig !== 'function') return;
      S[n] = function (p) {
        try { console.log('[MOCK] ' + n + ' IN ' + JSON.stringify(p || {}).slice(0, 140)); } catch (e) {}
        try {
          var r = orig(p);
          try { console.log('[MOCK] ' + n + ' OUT ' + JSON.stringify(r || {}).slice(0, 220)); } catch (e) {}
          return r;
        } catch (e) {
          try { console.log('[MOCK] ' + n + ' THROW ' + (e && e.message)); } catch (e2) {}
          throw e;
        }
      };
    });
  })();

  /* ---- 桌子/背包放满时的安全处理(用户提示: 桌子满了可能有同类 bug) ----------
     老的 putIn 在目标格满时**静默丢弃**: 客户端以为放好了, 服务端没记 -> 物品凭空消失。
     这里改成: 目标满 -> 退回另一个容器; 都满 -> 返回 code:1 让客户端自己回滚。 */
  function putInSafe(dst, pos, id, alt) {
    if (id === undefined || id === null || id === -1) return false;
    var idx = Number(pos || 1) - 1;
    if (idx < 0 || idx >= dst.length || dst[idx] !== -1) idx = dst.indexOf(-1);
    if (idx < 0) {
      if (alt) {
        var j = alt.indexOf(-1);
        if (j >= 0) { alt[j] = id; return true; }
      }
      return false;
    }
    var k = dst.indexOf(id); if (k >= 0) dst[k] = -1;
    dst[idx] = id;
    return true;
  }
  S['item_putin_desk'] = function (p) {
    var id = paramItemId(p);
    var ok = putInSafe(st.desk, p && p.pos, id, st.bag);
    pushItems();
    try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {}
    try { console.log('[MOCK] item_putin_desk id=' + id + ' ok=' + ok + ' desk=' + JSON.stringify(st.desk)); } catch (e) {}
    return { code: ok ? 0 : 1 };
  };
  S['item_putin_bag'] = function (p) {
    var id = paramItemId(p);
    var ok = putInSafe(st.bag, p && p.pos, id, st.desk);
    pushItems();
    try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {}
    try { console.log('[MOCK] item_putin_bag id=' + id + ' ok=' + ok + ' bag=' + JSON.stringify(st.bag)); } catch (e) {}
    return { code: ok ? 0 : 1 };
  };

  /* 修复"没买就卖完啦": 以前 item_buy 在**发货之前**就把记录写进 purchased, 失败的购买
     也计入限购 -> 商店显示售罄但没有东西。这里做一次性自愈 + 只保留真的到货的记录。 */
  S['item_load_shop_info'] = function () {
    st.purchased = Array.isArray(st.purchased) ? st.purchased : [];
    var t = todayKey2();
    if (st.shopDay !== t) { st.shopDay = t; st.purchased = []; }
    if (!st.shopHealV1) { st.purchased = []; st.shopHealV1 = 1; }   /* 一次性清掉旧的错误记录 */
    try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {}
    return { purchased: st.purchased };
  };
})();