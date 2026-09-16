/* lxqw offline mock server v0.8.0 */
(function () {
  "use strict";
  function fmt(o){ try{ var s=JSON.stringify(o); return s&&s.length>500?s.slice(0,500)+"...":s; }catch(e){ return "<unstringifiable>"; } }
  function lg(m){ try{ console.log("[MOCK] "+m); }catch(e){} }
  function wn(m){ try{ console.warn("[MOCK] "+m); }catch(e){} }
  function flexFn(){ return flex(); }
  function flex() {
    var t = flexFn;
    return new Proxy(t, {
      get: function (tt, k) {
        if (k === "then") return undefined;
        if (k === "length") return 0;
        if (k === "prototype") return tt.prototype;
        if (k === "toJSON") return function(){ return null; };
        if (k === Symbol.toPrimitive) return function(h){ return h === "string" ? "" : 0; };
        if (k === "valueOf") return function(){ return 0; };
        if (k === "toString") return function(){ return ""; };
        if (k === Symbol.iterator) return function(){ return { next: function(){ return { done: true, value: undefined }; } }; };
        if (k === "constructor") return Object;
        if (typeof k === "symbol") return undefined;
        return flex();
      },
      has: function(){ return true; }, ownKeys: function(){ return []; },
      getOwnPropertyDescriptor: function(){ return undefined; },
      apply: function(){ return flex(); }, construct: function(){ return flex(); }
    });
  }
  function MOCK_FLEX(){ return flex(); }
  /* ---- 时间/季节/天气 --------------------------------------------------------
     以前这里写死 {season:3, hours_type:2, weather:0} -> 永远是"秋天傍晚":
       · MainOutView.update_season 只在 hours_type 3/4 时设 imgLightCover -> 窗户的灯永远不亮
       · MainInView.updateSeason 用 1/2 走白天图、3/4 走夜晚图 + 夜晚色矩阵 -> 屋里永远是白天
       · seasonKey = season+hours_type 决定美术组 season11..season44 -> 季节永远不变
     现在跟**真实本地时钟**走(season: 3-5春/6-8夏/9-11秋/12-2冬; hours_type: 6-16白天/16-19傍晚/
     19-23夜晚/23-6深夜, 对应 Tabikaeru.Define.HoursType)。跨段时由 new/weatherclock.js 推 weather_load。
     weather 默认 1(sunny, 合法值); st.weather 可以覆盖(测试用)。 */
  var ENV = { season: 3, hours_type: 2, weather: 1 };
  function clockEnv(d) {
    d = d || new Date();
    var h = d.getHours(), m = d.getMonth() + 1;
    ENV.season = (m >= 3 && m <= 5) ? 1 : (m >= 6 && m <= 8) ? 2 : (m >= 9 && m <= 11) ? 3 : 4;
    /* 用户给的时段表(客户端 HoursType: 1 白天 / 2 黄昏 / 3 夜晚 / 4 深夜):
         清晨 05:00-08:00 -> 4(天还没亮, 用深夜美术) ; 白天 08:00-17:00 -> 1
         黄昏 17:00-19:00 -> 2 ; 夜晚 19:00-05:00 -> 3(蜡烛点亮/盖被子睡觉) */
    ENV.hours_type = (h >= 8 && h < 17) ? 1 : (h >= 17 && h < 19) ? 2 : (h >= 19 || h < 5) ? 3 : 4;
    var ov = (window.MOCK_STATE && typeof window.MOCK_STATE.weather === 'number') ? window.MOCK_STATE.weather : 0;
    ENV.weather = ov > 0 ? ov : 1;
    return ENV;
  }
  clockEnv();
  window.MOCK_ENV = ENV;
  function now(){ return Math.floor(Date.now()/1000); }
  (function(){
    var files = ["semantic.js", "defaults.js", "rules.js"];
    for (var fi = 0; fi < files.length; fi++) {
      try {
        var sx = new XMLHttpRequest();
        sx.open("GET", "http://127.0.0.1:8089/" + files[fi] + "?t=" + Date.now(), false);
        sx.send(null);
        if (sx.responseText) { (0, eval)(sx.responseText); lg("loaded " + files[fi]); }
      } catch (e) { wn("load fail " + files[fi] + ": " + (e && e.message || e)); }
    }
    lg("semantic protocols: " + Object.keys(window.MOCK_SEMANTIC || {}).length);
  })();
  var Mock = window.MockServer = {
    version: "0.122.0",
    clockEnv: clockEnv,            /* 时间层(new/weatherclock.js)用它把 ENV 对齐真实本地时钟 */
    handlers: {},
    state: { clover: 1000, ticket: 10, account: "offline", uid: 10001 },
    handle: function (name, params) {
      /* 诊断: 凡是商店/背包/购买相关的协议, 一律记名(用于定位"买东西"到底走了哪条协议) */
      try { if (true) console.log('[MOCK] HANDLE ' + name + ' params=' + JSON.stringify(params || {}).slice(0, 80)); } catch (e) {}
      var S = window.MOCK_SEMANTIC;
      if (S && S[name] !== undefined) {
        try { var sv = (typeof S[name] === "function") ? S[name](params) : S[name]; return (sv===undefined||sv===null)?{}:sv; }
        catch (e) { wn("SEM-ERR "+name+" "+(e&&e.message||e)); }
      }
      var h = Mock.handlers[name];
      if (!h) { wn("NO-HANDLER "+name); return MOCK_FLEX(); }
      try { var r = h(params); return (r === undefined || r === null) ? {} : r; }
      catch (e) { wn("HANDLER-ERR "+name+" "+(e&&e.message||e)); return MOCK_FLEX(); }
    }
  };
  /* 启动竞态: 我们在登录瞬间就把 item_load_items / client_load_role 推给客户端, 而此时 Egret 的
     AssetManager(assetsmanager.min.js) 还没建好 —— 真机日志里出现过
       DISPATCH-ERR item_load_items : Cannot read properties of null (reading 'getFile')
     (04:22 / 17:21 / 22:00 各一次)。异常被这里 catch 住了所以不死, 但那一次刷新丢了(视图可能停在旧数据)。
     修法: 识别"资源管理器没就绪"这一类错误, 把同一份数据在 400/1200ms 后各重投一次(有限次, 不递归)。 */
  var RETRY_MS = [400, 1200];
  function dispatch(name, data, sent) {
    var d = core.ServiceDispatcher.getInstance();
    if (!d.hasEventListener(name)) { wn("NO-LISTENER "+name); return false; }
    try { d.dispatchEvent(new core.Event(name, data, sent)); }
    catch (e) {
      var msg = (e && e.message || String(e));
      var racey = /getFile|AssetManager|assetsManager/i.test(msg);
      wn("DISPATCH-ERR "+name+" : "+msg + (racey ? "  [资源管理器未就绪 -> 稍后重投]" : ""));
      if (racey) {
        for (var i = 0; i < RETRY_MS.length; i++) {
          (function (delay) {
            setTimeout(function () {
              try {
                if (!d.hasEventListener(name)) return;
                d.dispatchEvent(new core.Event(name, data, sent));
                lg("DISPATCH-RETRY 成功 " + name + " (+" + delay + "ms)");
              } catch (e2) { wn("DISPATCH-RETRY 仍失败 " + name + " : " + (e2 && e2.message || e2)); }
            }, delay);
          })(RETRY_MS[i]);
        }
      }
    }
    return true;
  }
  Mock.dispatch = dispatch;
/* ======= auto-generated handlers ======= */
  Mock.handlers["adsmgr_refuse"] = function(){ return {"code": 0}; };
  Mock.handlers["adsmgr_share"] = function(){ return {"code": 0}; };
  Mock.handlers["adsmgr_shop_free"] = function(){ return {"code": 0}; };
  Mock.handlers["album_delete"] = function(){ return {"code": 0}; };
  Mock.handlers["album_delete_new"] = function(){ return {"code": 0}; };
  Mock.handlers["album_load"] = function(){ return {"pictures": [], "start": 0, "total": 0}; };
  Mock.handlers["album_load_all"] = function(){ return {"id_list": [{ "id": 0 }]}; };
  Mock.handlers["album_load_by_id_list"] = function(){ return {"pic_list": [{ "id": 0 }]}; };
  Mock.handlers["album_load_new"] = function(){ return {"has_ads": false, "is_share": false, "pictures": [{ "for_ads": MOCK_FLEX() }], "visted_pic": []}; };
  Mock.handlers["album_load_recover"] = function(){ return {"pictures": []}; };
  Mock.handlers["album_recover"] = function(){ return {"code": 0}; };
  Mock.handlers["album_save_new"] = function(){ return {"code": 0}; };
  Mock.handlers["animpicture_add_pic"] = function(){ return {"code": 0}; };
  Mock.handlers["animpicture_album_add_pic"] = function(){ return {"code": 0}; };
  Mock.handlers["animpicture_album_remove_pic"] = function(){ return {"code": 0}; };
  Mock.handlers["animpicture_get_item"] = function(){ return {"code": 0}; };
  Mock.handlers["animpicture_guide"] = function(){ return {"code": 0}; };
  Mock.handlers["animpicture_load"] = function(){ return {"pic_list": [{ "exp_pic": [], "pictures": [] }]}; };
  Mock.handlers["animpicture_open_album"] = function(){ return {"code": 0}; };
  Mock.handlers["animpicture_remove_pic"] = function(){ return {"code": 0}; };
  Mock.handlers["animpicture_select_pic"] = function(){ return {"code": 0}; };
  Mock.handlers["animpicture_use_item"] = function(){ return {"phase": 0}; };
  Mock.handlers["calendar_get_beginer_reward"] = function(){ return {"day": 0}; };
  Mock.handlers["calendar_get_code_reward"] = function(){ return {"day": 0}; };
  Mock.handlers["calendar_get_luck_reward"] = function(){ return {"code": 0}; };
  Mock.handlers["calendar_get_st_reward"] = function(){ return {"code": 0}; };
  Mock.handlers["calendar_load"] = function(){ return {"lucky_days": [{ "day": 0, "item_id": 0 }], "new_flag": [], "st_days": [{ "day": 0, "item_id": 0 }], "task_list": []}; };
  Mock.handlers["calendar_load_note"] = function(){ return {"list": []}; };
  Mock.handlers["calendar_task_update"] = function(){ return {"task": { "id": 0 }}; };
  Mock.handlers["capsule_fast_task"] = function(){ return {"code": 0}; };
  Mock.handlers["capsule_get_coin"] = function(){ return {"code": 0}; };
  Mock.handlers["capsule_load_coin"] = function(){ return {"coin": 0, "pre_coin": 0}; };
  Mock.handlers["capsule_load_task"] = function(){ return {"task_list": []}; };
  Mock.handlers["capsule_patch"] = function(){ return {"task_list": []}; };
  Mock.handlers["capsule_twist"] = function(){ return {"reward_id": 0}; };
  Mock.handlers["client_change_decorate"] = function(){ return {"code": 0}; };
  Mock.handlers["client_draw_taobao"] = function(){ return {"ok": MOCK_FLEX()}; };
  Mock.handlers["client_get_my_wx_reward"] = function(){ return {"code": 0}; };
  Mock.handlers["client_get_push_reward"] = function(){ return {"code": 0}; };
  Mock.handlers["client_gm"] = function(){ return {"info": MOCK_FLEX(), "succeed": MOCK_FLEX()}; };
  Mock.handlers["client_hello"] = function(){ return {"timestamp": 0}; };
  Mock.handlers["client_load_decorate"] = function(){ return {"has_list": [], "put_id": 0, "status": 0}; };
  Mock.handlers["client_load_role"] = function(){ return {"frog": { "achieves": [], "achieves_time": [{ "id": 0, "time": 0 }], "cur_achieve": MOCK_FLEX(), "decoration": [], "icon": 0, "motion": MOCK_FLEX(), "name": "", "pic_show": 0, "status": 0, "taobao_data": MOCK_FLEX(), "today_step": 0 }, "misc": { "create_time": 0, "picture_cnt": 0, "wx_my_reward": 0, "wx_push_reward": 0 }, "res": { "clover_point": 0, "ticket": 0 }, "settings": { "client": MOCK_FLEX(), "push_switch": 0, "rank_switch": 0 }, "uid": 0}; };
  Mock.handlers["client_rename_cost"] = function(){ return {"clover": 0, "code": 0, "lucky": 0}; };
  Mock.handlers["client_set_name"] = function(){ return {"code": 0, "lucky": 0}; };
  Mock.handlers["client_set_wx_open_id"] = function(){ return {"push_list": []}; };
  Mock.handlers["client_share_publicity"] = function(){ return {"code": 0}; };
  Mock.handlers["client_switch_push"] = function(){ return {"push_switch": 0}; };
  Mock.handlers["client_switch_rank"] = function(){ return {"rank_switch": 0}; };
  Mock.handlers["client_taobao_import"] = function(){ return {"collections": MOCK_FLEX(), "pictures": 0}; };
  Mock.handlers["clover_harvest_resend"] = function(){ return {"id": 0, "time": 0}; };
  Mock.handlers["clover_notice_get"] = function(){ return {"clover": 0, "reason": MOCK_FLEX()}; };
  Mock.handlers["clover_update"] = function(){ return {"clover": 0}; };
  Mock.handlers["cooking_complete_task"] = function(){ return {"code": 0}; };
  Mock.handlers["cooking_refresh_task"] = function(){ return {"task": MOCK_FLEX()}; };
  Mock.handlers["cooking_select"] = function(){ return {"code": 0}; };
  Mock.handlers["cooking_start_cooking"] = function(){ return {"code": 0}; };
  Mock.handlers["encyclopedia_load"] = function(){ return {"show_sub": [{ "id": 0, "sub_id": 0 }], "unlock_desc": [{ "id": 0, "list": [] }], "unlock_list": MOCK_FLEX()}; };
  Mock.handlers["encytravel_load"] = function(){ return {"show_sub": [{ "id": 0, "sub_id": 0 }], "unlock_desc": [{ "id": 0, "list": [] }], "unlock_list": MOCK_FLEX()}; };
  Mock.handlers["furniture_buy_shop"] = function(){ return {"code": 0}; };
  Mock.handlers["furniture_flowerpot_harvest"] = function(){ return {"item_list": [{ "item_id": 0, "num": 0 }]}; };
  Mock.handlers["furniture_load_compost"] = function(){ return {"box_list": [], "compost_list": []}; };
  Mock.handlers["furniture_load_furniture"] = function(){ return {"replace_fur": [], "shop": { "shop_list": [] }}; };
  Mock.handlers["furniture_load_pocket"] = function(){ return {"list": []}; };
  Mock.handlers["furniture_load_tumbler"] = function(){ return {"tumbler_list": []}; };
  Mock.handlers["furniture_pocket_get"] = function(){ return {"code": 0}; };
  Mock.handlers["furniture_replace_compost"] = function(){ return {"code": 0}; };
  Mock.handlers["furniture_replace_fur"] = function(){ return {"code": 0}; };
  Mock.handlers["furniture_replace_pocket"] = function(){ return {"code": 0}; };
  Mock.handlers["furniture_replace_tumbler"] = function(){ return {"code": 0}; };
  Mock.handlers["greetcard_buy"] = function(){ return {"code": 0}; };
  Mock.handlers["greetcard_change_bg"] = function(){ return {"code": 0}; };
  Mock.handlers["greetcard_change_bless"] = function(){ return {"code": 0}; };
  Mock.handlers["greetcard_get_reward"] = function(){ return {"list": []}; };
  Mock.handlers["greetcard_get_task_item"] = function(){ return {"list": []}; };
  Mock.handlers["greetcard_get_task_reward"] = function(){ return {"code": 0}; };
  Mock.handlers["greetcard_load"] = function(){ return {"card_info": MOCK_FLEX()}; };
  Mock.handlers["greetcard_load_count"] = function(){ return {"count": 0}; };
  Mock.handlers["greetcard_put_tags"] = function(){ return {"code": 0}; };
  Mock.handlers["greetcard_send"] = function(){ return {"code": 0}; };
  Mock.handlers["greetcard_stock"] = function(){ return {"code": 0}; };
  Mock.handlers["guest_accept_invit"] = function(){ return {"code": 0}; };
  Mock.handlers["guest_load_drawing"] = function(){ return {"colls": [], "pages": []}; };
  Mock.handlers["guest_lock_bag"] = function(){ return {"code": 0}; };
  Mock.handlers["guest_putin_bag"] = function(){ return {"code": 0}; };
  Mock.handlers["guest_takeout_bag"] = function(){ return {"code": 0}; };
  Mock.handlers["hall_enter_game"] = function(){ return {"code": 0}; };
  Mock.handlers["hall_gen_token"] = function(){ return {"code": 0, "token": MOCK_FLEX()}; };
  Mock.handlers["hall_login"] = function(){ return {"account": 0, "code": 0}; };
  Mock.handlers["hall_reconnect"] = function(){ return {"account": 0, "code": 0}; };
  Mock.handlers["item_buy"] = function(){ return {"ads_id": [], "ticket": 0}; };
  Mock.handlers["item_gacha"] = function(){ return {"ticket": 0}; };
  Mock.handlers["item_load_handbook"] = function(){ return {"collections": [], "specialtys": []}; };
  Mock.handlers["item_load_items"] = function(){ return {"bag": [], "bag_completed": 0, "bag_conflict": 0, "desk": [], "desk_conflict": 0, "gacha": { "color_ball": 0 }, "house": [{ "count": 0, "item_id": 0 }]}; };
  Mock.handlers["item_load_select_gift"] = function(){ return {"list": []}; };
  Mock.handlers["item_load_shop_info"] = function(){ return {"purchased": [{ "count": 0, "item_id": 0 }]}; };
  Mock.handlers["item_select_gift"] = function(){ return {"items": [{ "count": 0, "item_id": 0 }]}; };
  Mock.handlers["item_update"] = function(){ return {"item": { "count": 0, "item_id": 0 }}; };
  Mock.handlers["item_update_ticket"] = function(){ return {"ticket": 0}; };
  Mock.handlers["item_use_gift_code"] = function(){ return {"code": 0}; };
  Mock.handlers["lottery_confirm_reward"] = function(){ return {"code": 0}; };
  Mock.handlers["lottery_load"] = function(){ return {"phase": 0}; };
  Mock.handlers["lottery_open"] = function(){ return {"extra_item": MOCK_FLEX(), "open_item": { "count": 0, "item_id": 0 }}; };
  Mock.handlers["lottery_select"] = function(){ return {"code": 0}; };
  Mock.handlers["mail_load_mails"] = function(){ return {"mails": [], "start": 0, "total": 0}; };
  Mock.handlers["misc_moment_load"] = function(){ return {"list": []}; };
  Mock.handlers["misc_moment_unlock"] = function(){ return {"code": 0}; };
  Mock.handlers["museum_load"] = function(){ return {"museum_list": MOCK_FLEX()}; };
  Mock.handlers["museumday_dir_compass"] = function(){ return {"code": 0}; };
  Mock.handlers["museumday_get_items"] = function(){ return {"code": 0, "index": 0}; };
  Mock.handlers["museumday_info"] = function(){ return {"compass": MOCK_FLEX(), "task_num": 0}; };
  Mock.handlers["museumday_inspire"] = function(){ return {"next": MOCK_FLEX()}; };
  Mock.handlers["museumday_random_compass"] = function(){ return {"inspire": MOCK_FLEX(), "next": MOCK_FLEX()}; };
  Mock.handlers["museumday_refresh"] = function(){ return {"left_num": 0}; };
  Mock.handlers["museumday_start_advance"] = function(){ return {"code": 0}; };
  Mock.handlers["other_req_touch"] = function(){ return {"code": 0}; };
  Mock.handlers["partycake_answer"] = function(){ return {"state": MOCK_FLEX()}; };
  Mock.handlers["partycake_get_mate"] = function(){ return {"code": 0}; };
  Mock.handlers["partycake_light"] = function(){ return {"state": MOCK_FLEX()}; };
  Mock.handlers["partycake_load"] = function(){ return {"cream": MOCK_FLEX(), "cur_state": MOCK_FLEX(), "end_time": 0, "layers": [], "part": MOCK_FLEX(), "pre_cream": MOCK_FLEX(), "pre_sugar": MOCK_FLEX(), "share_get": [], "sugar": MOCK_FLEX(), "task_list": []}; };
  Mock.handlers["partycake_load_mate"] = function(){ return {"pre_cream": MOCK_FLEX(), "pre_sugar": MOCK_FLEX()}; };
  Mock.handlers["partycake_load_qa"] = function(){ return {"answer": [], "guest": MOCK_FLEX(), "reward": [], "wrong": MOCK_FLEX()}; };
  Mock.handlers["partycake_load_task"] = function(){ return {"task": { "id": 0 }}; };
  Mock.handlers["partycake_make"] = function(){ return {"state": MOCK_FLEX()}; };
  Mock.handlers["partycake_reward_light"] = function(){ return {"state": MOCK_FLEX()}; };
  Mock.handlers["partycake_reward_make"] = function(){ return {"state": MOCK_FLEX()}; };
  Mock.handlers["partycake_reward_qa"] = function(){ return {"state": MOCK_FLEX()}; };
  Mock.handlers["partycake_reward_share"] = function(){ return {"code": 0}; };
  Mock.handlers["pray_compose"] = function(){ return {"item_list": [{ "shift": MOCK_FLEX() }]}; };
  Mock.handlers["pray_load_grays"] = function(){ return {"boxes": [], "stamp_new": MOCK_FLEX(), "stamps": [], "wish_new": MOCK_FLEX(), "wishs": []}; };
  Mock.handlers["rank_get_intro"] = function(){ return {"intro": MOCK_FLEX()}; };
  Mock.handlers["rank_load"] = function(){ return {"first_intro": MOCK_FLEX(), "info": [], "me": MOCK_FLEX()}; };
  Mock.handlers["recharge_load"] = function(){ return {"field": [], "sack": []}; };
  Mock.handlers["recharge_load_gift"] = function(){ return {"gift": []}; };
  Mock.handlers["recharge_update_num"] = function(){ return {"change": MOCK_FLEX(), "water": MOCK_FLEX()}; };
  Mock.handlers["share_get_reward"] = function(){ return {"code": 0}; };
  Mock.handlers["share_load"] = function(){ return {"pic_list": [{ "clover": 0, "id": 0 }]}; };
  Mock.handlers["springcard_buy"] = function(){ return {"tags_id": 0}; };
  Mock.handlers["springcard_change_bg"] = function(){ return {"code": 0}; };
  Mock.handlers["springcard_change_bless"] = function(){ return {"code": 0}; };
  Mock.handlers["springcard_get_reward"] = function(){ return {"num": 0}; };
  Mock.handlers["springcard_get_share_tags"] = function(){ return {"tags_id": 0}; };
  Mock.handlers["springcard_get_task_reward"] = function(){ return {"code": 0}; };
  Mock.handlers["springcard_load"] = function(){ return {"box_id": 0, "buy_num": 0, "can_buy_num": 0, "card_info": MOCK_FLEX(), "end_time": 0, "items": [], "reward_list": [], "share_code": 0, "share_get": MOCK_FLEX(), "share_num": 0, "task_harvest": MOCK_FLEX(), "task_item": []}; };
  Mock.handlers["springcard_load_count"] = function(){ return {"count": 0}; };
  Mock.handlers["springcard_put_tags"] = function(){ return {"code": 0}; };
  Mock.handlers["springcard_send"] = function(){ return {"box_id": 0}; };
  Mock.handlers["springcard_share_tags"] = function(){ return {"share_code": 0}; };
  Mock.handlers["story_load"] = function(){ return {"new_story_id": 0, "stories": []}; };
  Mock.handlers["task_get_list_reward"] = function(){ return {"code": 0}; };
  Mock.handlers["task_get_reward"] = function(){ return {"code": 0}; };
  Mock.handlers["task_load"] = function(){ return {"list": [{ "id": 0, "pro": MOCK_FLEX() }], "tasks": []}; };
  Mock.handlers["task_load_list"] = function(){ return {"reward": [{ "id": 0, "pro": MOCK_FLEX() }]}; };
  Mock.handlers["travel_album_to_gift"] = function(){ return {"code": 0}; };
  Mock.handlers["travel_bag_to_gift"] = function(){ return {"code": 0}; };
  Mock.handlers["travel_gift_to_album"] = function(){ return {"code": 0}; };
  Mock.handlers["travel_gift_to_bag"] = function(){ return {"code": 0}; };
  Mock.handlers["travel_load_gift"] = function(){ return {"pictures": [], "specialtys": [{ "count": 0, "item_id": 0 }]}; };
  Mock.handlers["travel_load_note"] = function(){ return {"note_list": [{ "id": 0, "read": MOCK_FLEX(), "timestamp": 0 }]}; };
  Mock.handlers["tutorial_step_ask_award_q"] = function(){ return {"ok": MOCK_FLEX()}; };
  Mock.handlers["tutorial_step_open_door_q"] = function(){ return {"ok": MOCK_FLEX()}; };
  Mock.handlers["visit_load"] = function(){ return {"acquire": [], "visitor": 0}; };
  Mock.handlers["wishingpool_wish"] = function(){ return {"id": 0}; };
/* ======= manual core handlers ======= */
  Mock.handlers["client_hello"] = function(){ return { timestamp: now() }; };
  Mock.handlers["hall_gen_token"] = function(){ return { code:0, token:"offline-token" }; };
  Mock.handlers["hall_login"] = function(){ return { code:0, account:Mock.state.account }; };
  Mock.handlers["hall_reconnect"] = function(){ return { code:0, account:Mock.state.account }; };
  Mock.handlers["hall_enter_game"] = function(){ return { code:0 }; };
  Mock.handlers["client_load_all_info"] = function(){ return {}; };
  Mock.handlers["annual_load"] = function(){ return { is_share: false, list: [] }; };
  Mock.handlers["client_load_role"] = function(){
    return { uid: Mock.state.uid,
      res: { clover_point: Mock.state.clover, ticket: Mock.state.ticket },
      settings: { client: "{}", push_switch: 0, rank_switch: 0 },
      misc: { picture_cnt: 0, wx_push_reward: false, wx_my_reward: false, create_time: now() },
      frog: { name:"xiaowa", cur_achieve:0, achieves:[], achieves_time:[], status:0, motion:0,
              icon:0, pic_show:1, today_step:0, decoration:[], taobao_data:{} } };
  };
  Mock.handlers["weather_load"] = function(){ clockEnv(); return { season: ENV.season, hours_type: ENV.hours_type, weather: ENV.weather }; };
/* ======= server push ======= */
  Mock.PUSH_LIST = ["album_load","album_load_all","album_load_by_id_list","album_load_new","album_load_recover","animpicture_load","calendar_load","calendar_load_note","calendar_task_update","capsule_load_coin","capsule_load_task","clover_update","encyclopedia_load","encytravel_load","furniture_load_compost","furniture_load_furniture","furniture_load_pocket","furniture_load_tumbler","greetcard_load","item_load_handbook","item_load_items","item_load_select_gift","item_load_shop_info","item_update","lottery_load","misc_moment_load","museum_load","partycake_load","partycake_load_mate","partycake_load_qa","partycake_load_task","pray_load_grays","recharge_load","recharge_load_gift","share_load","springcard_load","story_load","task_load","task_load_list","travel_load_gift","travel_load_note","visit_load","client_load_decorate","client_load_events","client_load_publicity"];
  Mock.pushed = false;
  Mock.pushEarly = function () {
    /* BOTH pushes MUST go through Mock.handle(): it prefers MOCK_SEMANTIC
       (semantic.js/defaults.js/rules.js) over the stub table below.
       Calling Mock.handlers[...] directly here dispatched the STUB
       client_load_role whose settings.client was "{}", so the client kept its
       default SettingsInfo.guideStep = GuideStep.New on every launch and the
       player was thrown back into the beginner tutorial after each refresh,
       no matter what the save file said. It also sent the stub clover_point. */
    dispatch("weather_load", Mock.handle("weather_load", {}));
    dispatch("client_load_role", Mock.handle("client_load_role", {}));
  };
  Mock.pushInitial = function () {
    if (Mock.pushed) return;
    Mock.pushed = true;
    var L = Mock.PUSH_LIST;
    for (var i = 0; i < L.length; i++) (function(n, k){ setTimeout(function(){ dispatch(n, Mock.handle(n, {})); }, k * 12); })(L[i], i);
    lg("burst: " + L.length + " protocols");
  };
/* ======= plumbing ======= */
  function callCb(cb, resp, sent) {
    if (cb == null) return false;
    try {
      if (typeof cb.apply === "function") { cb.apply(resp, sent); return true; }
      if (typeof cb === "function") { cb.call(resp); return true; }
      if (typeof cb.execute === "function") { cb.execute(); return true; }
    } catch (e) { wn("callback err: "+(e&&e.message||e)); }
    return false;
  }
  function patchSDK() {
    var done = [];
    function patchInst(o, label) {
      if (!o || o.__mockPatched) return;
      try {
        o.__mockPatched = 1;
        o.Login = function(){ return Promise.resolve({ code:0, token:"offline-token", game_token:"offline-game-token", ptoken:"offline-ptoken", pinfo:{ user_id:Mock.state.uid, user_name:Mock.state.account, nick_name:Mock.state.account, platform:"ONE", channel:"P10528" } }); };
        if (o.jsInvokeLua) o.jsInvokeLua = function(){ return Promise.resolve({}); };
        if (o.jsInvokeLuaUseLongCallback) o.jsInvokeLuaUseLongCallback = function(){ return Promise.resolve({}); };
        done.push(label);
      } catch(e) {}
    }
    try { if (window.ALISDK) {
      if (ALISDK.LoginSDK && ALISDK.LoginSDK.instance) patchInst(ALISDK.LoginSDK.instance(), "LoginSDK");
      if (ALISDK.Platform && ALISDK.Platform.FTGameSDK && ALISDK.Platform.FTGameSDK.instance) patchInst(ALISDK.Platform.FTGameSDK.instance(), "FTGameSDK");
      if (ALISDK.AnnSDK && ALISDK.AnnSDK.instance) patchInst(ALISDK.AnnSDK.instance(), "AnnSDK");
    } } catch(e) {}
    try { if (window.EjoySDK && EjoySDK.instance) patchInst(EjoySDK.instance(), "EjoySDK"); } catch(e) {}
    /* season fallback: never let getSeasonKey() yield "00" (missing seasonNN group -> white screen) */
    try {
      if (typeof WeatherModel !== "undefined" && WeatherModel.prototype) {
        WeatherModel.prototype.getSeasonKey = function(){
          var d = this.data || {};
          var sN = d.season || ENV.season, hT = d.hours_type || ENV.hours_type;
          return String(sN) + String(hT);
        };
        lg("patched WeatherModel.getSeasonKey fallback");
      }
    } catch(e) { wn("season patch "+e); }
    /* errcode_json is absent from the APK; provide code->info so error checks work offline */
    try {
      if (typeof MessageModel !== "undefined" && MessageModel.prototype) {
        MessageModel.prototype.getErrorInfo = function(code){ return { code: (code||0), msg: "" }; };
        lg("patched MessageModel.getErrorInfo (errcode_json missing in APK)");
      }
    } catch(e) { wn("getErrorInfo patch "+e); }
    lg("sdk patched: "+done.join(","));
  }
  function install() {
    if (typeof core === "undefined" || !core.SocketManage || typeof ProtocolList === "undefined" || !ProtocolList.protocolList) return setTimeout(install, 30);
    if (Mock.state.installed) return;
    Mock.state.installed = true;
    var SM = core.SocketManage.prototype;
    /* ---- 熔断 ---------------------------------------------------------------
       有些客户端逻辑是**自我重触发**的: 比如 BoxCraftView.updateView() 在"三组材料都>0"时
       自动 req_compose, 而 req_compose 的回包回调里又跑一次 updateView。服务端一旦不真实扣料,
       客户端就会一直发 —— 2026-09-14 那次连发 2997 次, 界面卡死 -> 崩溃。
       这里给每个协议名加一个滑动窗口: 短时间内超过阈值就**连回包都不发**(回调链断开, 循环立刻停),
       同时只吼一次日志。正常 UI 不可能在 2 秒内把同一条协议发 40 次。 */
    var RATE_N = 40, RATE_WIN = 2000, rate = {};
    Mock.rate = rate;
    function tripped(name) {
      var t = Date.now(), r = rate[name] || (rate[name] = { t: t, n: 0 });
      if (t - r.t > RATE_WIN) { r.t = t; r.n = 0; }
      r.n++;
      if (r.n > RATE_N) {
        if (r.n === RATE_N + 1) wn("RATE-TRIP "+name+" > "+RATE_N+" 次/"+RATE_WIN+"ms —— 切断回包(疑似客户端自我重触发循环)");
        else if (r.n % 500 === 0) wn("RATE-TRIP "+name+" 已累计 "+r.n+" 次");
        return true;
      }
      return false;
    }
    Mock.tripped = tripped;
    SM.send = function (name, callback) {
      var args = Array.prototype.slice.call(arguments, 2);
      var def = ProtocolList.protocolList[name];
      if (!def) { wn("unknown protocol "+name); return; }
      if (tripped(name)) return;              /* 熔断: 处理函数与回包都不再执行 */
      var pnames = def[0] || [], wants = def[1], params = {};
      for (var i=0;i<pnames.length;i++) params[pnames[i]] = args[i];
      var hasCb = (callback != null);
      if (name.indexOf("hall_") === 0 || name === "weather_load" || name === "client_load_all_info") lg("REQ "+name);
      /* always run the handler: many fire-and-forget protocols (mail_open, mail_read,
         client_set_client, guest_confirm...) MUTATE server state even though they
         expect no reply. Skipping them broke state + persistence. */
      var resp = Mock.handle(name, params);
      if (name === "hall_login" || name === "hall_reconnect") { try { Mock.pushEarly(); } catch(e) {} }
      if (name === "hall_enter_game") Mock.pushInitial();
      if (resp == null) return;
      if (!wants && !hasCb) return;
      setTimeout(function () {
        var okd = dispatch(name, resp, params);
        var okc = callCb(callback, resp, params);
        if (!okd && !okc) wn("NO-CONSUMER "+name);
      }, 0);
    };
    if (core.Socket) {
      var SP = core.Socket.prototype;
      SP.connect = function(){ var s=this; setTimeout(function(){ s.socket_Connect(); }, 10); };
      SP.connectByUrl = function(){ var s=this; setTimeout(function(){ s.socket_Connect(); }, 10); };
      SP.send = function(){};
    }
    /* the loading screen shows GameConfig.version = window.appVersion + "." + window.manifestVersion;
       appVersion normally arrives from the native SDK, which does not exist offline,
       so the player saw "版本：undefined.1002" (caught by probe.js). */
    try {
      if (!window.appVersion) { window.appVersion = "1.0.20"; lg("patched window.appVersion=1.0.20"); }
    } catch(e) { wn("appVersion patch "+e); }
    try { patchSDK(); } catch(e) { wn("sdk patch "+e); }
    /* late layers need Mock + the game's classes to exist */
    (function(){
      /* screen.js first: it patches GameConfig before the engine boots */
      var extra = ["screen.js", "calendar.js", "calpatch.js", "probe.js", "persist.js", "iap.js", "mail.js", "activities.js", "annual.js", "album.js", "pictures.js", "postcard.js", "furniture.js", "handbook.js", "decorate.js", "handcraft.js", "cooking.js", "wishing.js", "capsule.js", "greetcard.js", "springcard.js", "partycake.js", "lottery.js", "museumday.js", "drawing.js", "camera.js", "visitor.js", "guard.js", "diag.js", "harden.js", "travel2.js", "story.js", "starterkit.js", "kitv2.js", "kitv3.js", "kitv4.js", "vprobe.js", "furnituremake.js", "furnstyle.js", "weatherclock.js", "gm.js", "raffle.js", "postcardpool.js", "guestfeed.js", "party.js", "travelmap.js", "roompatch.js", "tasks.js", "achieve.js", "ency.js", "furnishplace.js", "frogstate.js", "flowerpot.js", "stories.js", "diary.js", "solarphoto.js", "postroute.js", "friendbook.js", "plan_templates.js", "plans.js", "planhooks.js", "clickfx.js", "cdkey.js", "season.js", "materials.js", "map_locations.js", "map_paths.js", "maploc.js", "pathengine.js", "termsfix.js", "mapview.js"];
      for (var i = 0; i < extra.length; i++) {
        try {
          var x = new XMLHttpRequest();
          x.open("GET", "http://127.0.0.1:8089/" + extra[i] + "?t=" + Date.now(), false);
          x.send(null);
          if (x.responseText) { (0, eval)(x.responseText); lg("loaded " + extra[i]); }
        } catch (e) { wn("load fail " + extra[i] + ": " + (e && e.message || e)); }
      }
    })();
    lg("installed v"+Mock.version+" | handlers "+Object.keys(Mock.handlers).length+" | push "+Mock.PUSH_LIST.length);
  }
  install();
})();
