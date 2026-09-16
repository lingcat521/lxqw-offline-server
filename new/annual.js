/* lxqw offline 年度回顾 (annual_load) v0.22
 *
 * AnnualReviewModel.request() does send("annual_load", ...) and the whole answer
 * becomes the chat pages' data. AnnualReviewChatPage builds ~10 sentences out of
 * these fields:
 *   create_time travel_num pic_num stamp_num wish_num fur_num note_num spe_num
 *   col_num first_col story_num first_story clover visit_num page_num
 *   first_guest login_day is_share
 * The old stub answered {is_share:false, list:[]}, so every "{0}" was filled with
 * undefined and the player literally read "一共雕刻了undefined个印章" /
 * "完成了undefined个祈愿物". Every field below is now a real number derived from
 * the save; first_col/first_story/first_guest stay inside the client's own id
 * and index ranges so nothing dereferences undefined.
 */
(function () {
  var st = window.MOCK_STATE || (window.MOCK_STATE = {});
  var S = window.MOCK_SEMANTIC = window.MOCK_SEMANTIC || {};
  function log(m) { try { console.log("[MOCK] " + m); } catch (e) {} }
  function num(v) { return (typeof v === "number" && isFinite(v)) ? v : 0; }
  function arr(v) { return Object.prototype.toString.call(v) === "[object Array]" ? v : []; }
  /* CollectDB ids (tables/Collection_json.json, 62 rows, 0-based) */
  var COLL_IDS = [];
  for (var ci = 0; ci < 62; ci++) COLL_IDS.push(ci);
  var GUEST_NAMES = ["困困", "胖胖", "跳跳"];   /* first_guest indexes this list */

  function created() {
    if (typeof st.createdAt !== "number" || !isFinite(st.createdAt)) st.createdAt = Math.floor(Date.now() / 1000);
    return st.createdAt;
  }
  created();

  S["annual_load"] = function () {
    var now = Math.floor(Date.now() / 1000);
    var notes = arr(st.notes), photos = arr(st.photos), gifts = arr(st.gifts);
    var stamps = arr(st.stamps), wishs = arr(st.wishs), house = arr(st.house);
    var cols = arr(st.collections), pages = arr(st.pages);
    var visits = num(st.visitCount) || ((st.visitor && st.visitor.partner) ? 1 : 0);
    var days = Math.max(1, Math.floor((now - created()) / 86400) + 1);
    var travels = num(st.travelCount) || notes.length;
    var data = {
      is_share: !!st.annualShared,
      create_time: created(),
      travel_num: travels,
      pic_num: photos.length,
      stamp_num: stamps.length,
      wish_num: wishs.length,
      fur_num: house.length,
      note_num: notes.length,
      spe_num: gifts.length,
      col_num: cols.length,
      first_col: cols.length ? num(cols[0]) : COLL_IDS[0],
      story_num: num(st.storyCount),
      first_story: (typeof st.firstStory === "string" && st.firstStory) ? st.firstStory : "小青蛙",
      clover: num(st.clover),
      visit_num: visits,
      page_num: pages.length,
      first_guest: Math.min(Math.max(num(st.firstGuest), 0), GUEST_NAMES.length - 1),
      login_day: days
    };
    var missing = [];
    for (var k in data) if (data[k] === undefined || (typeof data[k] === "number" && !isFinite(data[k]))) missing.push(k);
    if (missing.length) log("annual_load BAD FIELDS: " + missing.join(","));
    return data;
  };
})();
