/* lxqw offline album management: 相册删除/找回/另存 — additive layer.
 *
 * Client contract (TravelModel, all answers checked through MessageModel.getErrorInfo(code)):
 *   album_load_recover  -> {pictures:[...]}   the deleted-and-recoverable postcards
 *   album_delete(id)    -> {code:0}           move a postcard into that list
 *   album_recover(id)   -> {code:0}           move it back
 *   album_save_new(id)  -> {code:0}           keep a new postcard in the album
 *   album_delete_new(id)-> {code:0}           drop a new postcard
 *   album_load_by_id_list(id_list) -> {pic_list:[{id,layers}]}  extra layer data
 * Nothing here changes the existing rules.js album pushes; it only adds handlers
 * and keeps st.photos / st.deletedPhotos consistent so album_load stays correct.
 */
(function () {
  var M = window.MockServer, st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  function log(m) { try { console.log("[MOCK] " + m); } catch (e) {} }
  function arr(v) { return Object.prototype.toString.call(v) === "[object Array]" ? v : []; }
  function photos() { if (!Array.isArray(st.photos)) st.photos = []; return st.photos; }
  function deleted() { if (!Array.isArray(st.deletedPhotos)) st.deletedPhotos = []; return st.deletedPhotos; }
  function save() { try { if (window.MOCK_SAVE) window.MOCK_SAVE(); } catch (e) {} }
  function push(name, d) { setTimeout(function () { try { M.dispatch(name, (typeof S[name] === "function" ? S[name]() : S[name])); } catch (e) {} }, d || 30); }
  function take(list, id) { for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return list.splice(i, 1)[0]; return null; }

  S["album_load_recover"] = function () { return { pictures: deleted().slice() }; };
  S["album_delete"] = function (p) {
    var id = Number(p && p.id);
    var it = take(photos(), id);
    if (!it) return { code: 1 };
    deleted().push(it);
    save(); log("相册: 删除明信片 " + id + " (可找回 " + deleted().length + ")");
    push("album_load_recover");
    return { code: 0 };
  };
  S["album_recover"] = function (p) {
    var id = Number(p && p.id);
    var it = take(deleted(), id);
    if (!it) return { code: 1 };
    photos().push(it);
    save(); log("相册: 找回明信片 " + id + " (相册 " + photos().length + ")");
    push("album_load");
    return { code: 0 };
  };
  S["album_save_new"] = function (p) {
    var id = Number(p && p.id);
    st.savedPhotos = arr(st.savedPhotos);
    if (st.savedPhotos.indexOf(id) < 0) st.savedPhotos.push(id);
    var found = false;
    for (var i = 0; i < photos().length; i++) if (photos()[i].id === id) found = true;
    if (!found) photos().push({ id: id, pic_id: id });
    save(); log("相册: 保存新明信片 " + id);
    return { code: 0 };
  };
  S["album_delete_new"] = function (p) {
    var id = Number(p && p.id);
    var it = take(photos(), id);
    if (it) deleted().push(it);
    save(); log("相册: 丢弃新明信片 " + id);
    return { code: 0 };
  };
  /* layers are an extra overlay; the album already renders from pic_id/PictureDB,
     so answering an empty list keeps everything visible instead of guessing art */
  S["album_load_by_id_list"] = function () { return { pic_list: [] }; };
  log("album ready: " + photos().length + " 张明信片, " + deleted().length + " 张可找回");
})();
