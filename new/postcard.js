/* lxqw offline postcard layer: real明信片 layers + texture preloading - additive layer.
 *
 * Why this exists (device crash 2026-09-13T05:14:22Z, v0.43.0):
 *   client Tabikaeru.loadPicture(pic) does  for(var i=0,r=pic.layers; i<r.length; i++)
 *   so a picture object WITHOUT .layers throws
 *   "Cannot read properties of undefined (reading 'length')".
 *   album_load_new pushes new pictures into TravelModel.newPictureInfoList and the
 *   frog_back notice flow builds a PostcardView straight from getFirstNewPictureInfo(),
 *   so any picture we hand out must already carry layers.
 *
 * Layer source: tools/genpictures.py -> new/pictures.js (window.MOCK_PICTURES)
 *   { "<pic_id>": [[resource_id, x, y], ...] }   (500x350 canvas, client shape is
 *   [{layer:[resource_id,x,y]}, ...])
 *
 * Contract used here (verified in main.min.js):
 *   album_load_by_id_list(id_list) -> {pic_list:[{id, layers:[{layer:[rid,x,y]}]}]}
 *     the client then does pictureInfoList[i].layers = entry.layers and renders with
 *     Tabikaeru.loadPicture() (async RES.getResAsync) + renderPicture() (sync getRes)
 *   album_load_new  -> pictures must carry layers (PostcardView / new picture popup)
 *   Tabikaeru.getPicturePath(rid) -> "Picture/Normal/sky05"; texture name is basename+"_png"
 */
(function () {
  var M = window.MockServer, st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  var PIC = window.MOCK_PICTURES || {};
  var KEYS = Object.keys(PIC);
  st.nextPhoto = st.nextPhoto || 1;
  function log(m) { try { console.log("[MOCK] " + m); } catch (e) {} }
  function rand(n) { return Math.floor(Math.random() * n); }
  function texName(rid) {
    try {
      var p = Tabikaeru.getPicturePath(rid);            /* client's resources_json */
      var b = String(p).split('/').pop();
      return b + '_png';
    } catch (e) { return null; }
  }
  /* preload the textures of one picture so the sync renderPicture() finds them cached */
  function preloadPic(picId, done) {
    var triples = PIC[String(picId)];
    if (!triples) return false;
    for (var i = 0; i < triples.length; i++) {
      (function (rid) {
        var n = texName(rid);
        if (!n) return;
        try {
          if (RES.getRes(n)) return;
          RES.getResAsync(n).then(function () { if (done) done(); },
                                     function () { if (done) done(); });
        } catch (e) {}
      })(triples[i][0]);
    }
    return true;
  }
  /* note paper textures: the diary view uses RES.getRes("pic_<noteid>_png") (sync) */
  function preloadNote(id) {
    var n = 'pic_' + id + '_png';
    try { if (RES.getRes(n)) return; RES.getResAsync(n); } catch (e) {}
  }
  function layersFor(picId) {
    var triples = PIC[String(picId)];
    if (!triples || !triples.length) {
      /* unknown pic id: fall back to the first known composition so the client never
         receives a picture without layers (that is what crashed the app) */
      if (!KEYS.length) return [];
      var k = KEYS[Math.abs(Number(picId) || 0) % KEYS.length];
      triples = PIC[k];
    }
    var out = [];
    for (var i = 0; i < triples.length; i++)
      out.push({ layer: [triples[i][0], triples[i][1], triples[i][2]] });
    return out;
  }
  function picIdOfPhoto(id) {
    var lists = [st.photos, st.deletedPhotos, st.savedPhotos];
    for (var l = 0; l < lists.length; l++) {
      var a = lists[l]; if (!Array.isArray(a)) continue;
      for (var i = 0; i < a.length; i++) if (a[i] && a[i].id === id && a[i].pic_id !== undefined) return a[i].pic_id;
    }
    return null;
  }
  function withLayers(pic) {
    var pid = (pic && pic.pic_id !== undefined) ? pic.pic_id : null;
    if (pid === null) pid = picIdOfPhoto(pic && pic.id);
    if (pid === null) pid = KEYS.length ? KEYS[rand(KEYS.length)] : 100;
    var copy = {};
    for (var k in pic) if (Object.prototype.hasOwnProperty.call(pic, k)) copy[k] = pic[k];
    copy.layers = layersFor(pid);
    if (copy.pic_id === undefined) copy.pic_id = Number(pid);
    preloadPic(pid);
    return copy;
  }
  /* ---- handlers ---------------------------------------------------------- */
  /* the client asks for layers exactly when a picture has none (getFullPictures) */
  S['album_load_by_id_list'] = function (p) {
    var ids = (p && p.id_list) || [];
    if (!Array.isArray(ids)) ids = [ids];
    var out = [];
    for (var i = 0; i < ids.length; i++) {
      var id = Number(ids[i] && ids[i].id !== undefined ? ids[i].id : ids[i]);
      if (!id && id !== 0) continue;
      var pid = picIdOfPhoto(id);
      out.push({ id: id, pic_id: pid === null ? id : pid,
                 layers: layersFor(pid === null ? id : pid) });
    }
    log('明信片: 下发 ' + out.length + ' 张的图层数据');
    return { pic_list: out };
  };
  /* the new-picture popup renders straight from these objects -> they need layers.
     album_load_new is both a PUSH (rules.js hands over the fresh photo) and a REQUEST
     (the client asks at login what is still new), so keep a queue of unseen pictures. */
  if (!Array.isArray(st.newPhotos)) st.newPhotos = [];
  var origLoadNew = S['album_load_new'];
  S['album_load_new'] = function (p) {
    var base = origLoadNew ? (origLoadNew(p) || {}) : {};
    var pushed = Array.isArray(p && p.pictures) && p.pictures.length ? p.pictures : null;
    if (pushed) st.newPhotos = pushed.slice();
    var pics = pushed || (Array.isArray(st.newPhotos) ? st.newPhotos : []);
    var out = [];
    for (var i = 0; i < pics.length; i++) out.push(withLayers(pics[i]));
    base.pictures = out;
    base.has_ads = !!base.has_ads;
    base.is_share = !!base.is_share;
    base.visted_pic = Array.isArray(base.visted_pic) ? base.visted_pic.map(withLayers) : [];
    return base;
  };
  /* once the player keeps or drops a new postcard it is no longer 'new' */
  function forgetNew(id) {
    id = Number(id);
    for (var i = 0; i < st.newPhotos.length; i++)
      if (Number(st.newPhotos[i] && st.newPhotos[i].id) === id) st.newPhotos.splice(i, 1);
  }
  ['album_save_new', 'album_delete_new'].forEach(function (name) {
    var orig = S[name];
    S[name] = function (p) { forgetNew(p && p.id); return orig ? orig(p) : { code: 0 }; };
  });

  /* ---- helpers for other layers ------------------------------------------ */
  window.MOCK_PIC = {
    layersFor: layersFor, preloadPic: preloadPic, preloadNote: preloadNote,
    withLayers: withLayers, pick: function () { return KEYS.length ? Number(KEYS[rand(KEYS.length)]) : 100; },
    count: function () { return KEYS.length; }
  };
  /* annotate already stored pictures so album_load/album_load_all stay layer-free
     (the client fetches them through album_load_by_id_list -> async texture load),
     but the popup path above always has layers */
  (function () {
    var a = st.photos;
    if (Array.isArray(a)) for (var i = 0; i < a.length; i++) if (a[i] && a[i].pic_id === undefined) a[i].pic_id = window.MOCK_PIC.pick();
  })();
  /* The diary renders its paper with a SYNCHRONOUS RES.getRes("pic_<id>_png"), so the
     texture has to be in the cache before the note list is drawn - loading it on demand
     only produces the "res-miss :: pic_1003_png" and a blank page.  Warm the notes we
     already own first, then trickle the rest of the client's note table (197 pics) in
     small batches so the boot is not blocked. */
  function warmNotes() {
    var n = Array.isArray(st.notes) ? st.notes : [];
    for (var i = 0; i < n.length; i++) preloadNote(n[i].id);
    return n.length;
  }
  /* the diary paints its paper with a synchronous RES.getRes, so start warming the
     textures we already own IMMEDIATELY (and retry) instead of 3s later - the device log
     showed res-miss :: pic_100x_png when the player opened the diary first. */
  warmNotes();
  /* the note list grows while playing (v0.46 device log showed res-miss for pic_1048..1059),
     so keep warming whatever we own - a cached texture is a no-op, a missing one loads */
  setInterval(warmNotes, 1000);
  setTimeout(function () {
    var n = Array.isArray(st.notes) ? st.notes : [];
    for (var i = 0; i < n.length; i++) preloadNote(n[i].id);
    var all = Array.isArray(window.MOCK_NOTE_IDS) ? window.MOCK_NOTE_IDS.slice() : [];
    var pending = [];
    for (var k = 0; k < all.length; k++) {
      var has = false;
      for (var j = 0; j < n.length; j++) if (Number(n[j].id) === Number(all[k])) has = true;
      if (!has) pending.push(all[k]);
    }
    var idx = 0, batched = 0;
    var iv = setInterval(function () {
      for (var b = 0; b < 4 && idx < pending.length; b++, idx++) { preloadNote(pending[idx]); batched++; }
      if (idx >= pending.length) clearInterval(iv);
    }, 600);
    log('明信片图层表 ' + KEYS.length + ' 张, 笔记纹理预载 ' + n.length + ' 张 (+排队 ' + pending.length + ' 张)');
  }, 3000);

  /* 兜底: 所有**推送**出去的 album_load_new 都必须带 layers ---------------------------------
     rules.js 的 comeBack() 是直接 push('album_load_new', {pictures:[photo]}) —— 推送不走
     处理器, 所以 postcard 的包装看不到它; 于是新明信片又变成没有 layers 的对象, 客户端
     PostcardView -> Tabikaeru.loadPicture() 读 pic.layers.length 就崩(设备日志 09:24:00
     main.min.js:12 的 EXC 就是这个)。这里在 dispatch 出口统一补 layers, 一劳永逸。 */
  (function () {
    var origDispatch = M.dispatch;
    M.dispatch = function (name, data, sent) {
      try {
        if (name === 'album_load_new' && data && typeof data === 'object') {
          if (Array.isArray(data.pictures)) data.pictures = data.pictures.map(withLayers);
          if (Array.isArray(data.visted_pic)) data.visted_pic = data.visted_pic.map(withLayers);
        }
        /* 礼品盒里的照片同样会被渲染 -> 也要带 layers */
        if (name === 'travel_load_gift' && data && typeof data === 'object' && Array.isArray(data.pictures)) {
          data.pictures = data.pictures.map(withLayers);
        }
      } catch (e) {}
      return origDispatch ? origDispatch.call(M, name, data, sent) : undefined;
    };
  })();
})();