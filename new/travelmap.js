/* lxqw 墙上的地图(离线版) —— 清单第十四节点名"墙上的地图"，它其实是**频道活动公告**驱动的网页。
 *
 * 客户端契约(main.min.js):
 *   MainInView.on_enterTravelMap_tap():
 *     var e = ActivityModel.getActivity("travelmap");
 *     e && e.params && e.params.isOpen && PageManage.addViewControl(TravelMapController, ..., e.params.url)
 *   ActivityModel.getActivity("travelmap") 只在**微信小游戏**下返回 {id,params:{}}; 否则看 activityMap ——
 *   而 activityMap 里的 travelmap 来自:
 *     BaseChannel.getInstance().getAnnInfo({type:"activity",tags:["travelmap"],search_type:"group",channel:...})
 *       .then(t => t.anns[0] && (t.anns[0].isOpen ? addActivity({id:'travelmap',params:{url:t.anns[0].url,isOpen:true}}) : ...))
 *   getAnnInfo 是渠道 SDK 的 HTTP 调用(ALISDK.AnnSDK / EjoySDK) —— 离线永远拿不到 ⇒ 地图点了没反应。
 *
 * 本层: 把当前渠道单例的 getAnnInfo 包一层, 只劫持 tags 里含 "travelmap" 的那次调用, 返回**本机 devserver**
 *   上的离线地图页(127.0.0.1:8089/travelmap.html); 其它调用原样透传(维护公告/防沉迷公告照旧)。
 *   页面自己 GET /load 读存档渲染(三叶草/明信片/日记/故事/家具/物品/旅行次数 + 去过的地方)。
 *   注: 真正把这个 URL 显示出来要靠原生 WebView(EjoyWebView/BaseWebView) —— 这一层只保证"活动存在、
 *   URL 指向本机页面"; 若原生层不弹窗, 行为与以前(点了没反应)一致, 不会有副作用。
 */
(function () {
  var LOCAL = 'http://127.0.0.1:8089/travelmap.html';
  function log(m) { try { console.log('[MOCK] 地图: ' + m); } catch (e) {} }
  function wantsTravelMap(arg) {
    if (!arg || typeof arg !== 'object') return false;
    var tags = arg.tags;
    if (Array.isArray(tags)) for (var i = 0; i < tags.length; i++) if (String(tags[i]) === 'travelmap') return true;
    if (typeof tags === 'string' && tags.indexOf('travelmap') >= 0) return true;
    return false;
  }
  function localAnswer() {
    return { anns: [{ url: LOCAL, isOpen: 1, content: '', title: '旅行地图' }] };
  }
  function install() {
    try {
      if (typeof BaseChannel === 'undefined' || !BaseChannel.getInstance) return false;
      var ch = BaseChannel.getInstance();
      if (!ch || typeof ch.getAnnInfo !== 'function') return false;
      if (ch.__mockMapPatched) return true;
      var orig = ch.getAnnInfo;
      ch.getAnnInfo = function (arg) {
        if (wantsTravelMap(arg)) {
          log('活动公告(travelmap) -> 本机页面 ' + LOCAL);
          return { then: function (cb) { try { cb(localAnswer()); } catch (e) {} return this; },
                   catch: function () { return this; } };
        }
        try { return orig.apply(ch, arguments); } catch (e) { return null; }
      };
      ch.__mockMapPatched = 1;
      log('渠道公告已挂钩: travelmap -> 本机地图页, 其它公告原样透传');
      return true;
    } catch (e) { return false; }
  }
  if (!install()) {
    var n = 0;
    var iv = setInterval(function () { if (install() || ++n > 40) clearInterval(iv); }, 500);
  }
  window.MOCK_TRAVELMAP = { url: LOCAL, install: install };
})();
