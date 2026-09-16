/* lxqw harden: make every DataManager table lookup return a structurally-complete stub
   instead of undefined. The client is full of 'DB.get(id).field' with no null check. */
(function(){
  var DEFAULTS = {
    ItemDB:            { id:0, name:"", info:"", img:{index:"goods_1",src:"Icon/goods"}, price:0, type:0, sub_type:"", spend:0, own_num:"" },
    ShopDataDB:        { id:0, itemId:0, name:"", info:"", price:0, limit:0, order:0, before_buy:null, is_hide_before:0, is_sold_out_hide:0 },
    FurnitureDB:       { id:0, name:"", info:"", type:1, style:0, drawing:0, res:[], animation:[""], icon:{index:"xw0_1",src:"Icon/furniture/xw0"} },
    FurnitureShopDB:   { shop_id:0, item_id:0, price:0, limit:0, num:0, sign:0, type:0, shop_limit:0, icon:{index:"xw0_1",src:"Icon/furniture/xw0"} },
    FlowerData:        { id:0, img:{index:"", src:""}, res:"", name:"" },
    rechargeDB:        { id:0, count:0, money:0, shopID:0, shopID_iOS:"", coupon_id:0, name:"" },
    TravelNoteDB:      { id:0, info:"", quality:1, type:0, factorData:0, factorType:"", img:{index:"pic_1000",src:"Scene/Note/Pic"} },
    /* TravelNoteUtils.convertContent2Sources reads u.img + u.type (we used to hand
       back {id,word}, so a missing word id rendered a blank glyph) */
    TravelNoteWordDB:  { id:0, type:1, img:{index:"word_0",src:"Scene/Note/Words"} },
    AchieveDB:         { id:0, name:"", info:"", icon:{index:"",src:""} },
    CollectDB:         { id:0, name:"", info:"", info2:"", place:"", type:1, img:{index:"collection_11",src:"Icon/collection"} },
    SpecialtyDB:       { id:0, itemId:0, place:"" },
    PictureDB:         { id:0, name:"", backImage:[], frontImage:[], effect:"", frogPose:"", frogPos:{x:0,y:0} },
    PictureTagDB:      { id:0, name:"" },
    decorationDB:      { id:0, name:"", info:"" },
    gamePalyDB:        {},
    stepDB:            [],
    ResourcesDB:       {},
    visitorDB:         { provinceList:{}, actionList:{} }
  };
  var patched = [];
  function stubFor(key){
    var d = DEFAULTS[key]; if (!d) return {};
    var o = {}; for (var k in d){ var v=d[k]; o[k] = (v && typeof v === "object") ? (Array.isArray(v) ? v.slice() : JSON.parse(JSON.stringify(v))) : v; }
    o.__missing = 1; return o;
  }
  function harden(db, key){
    if (!db || db.__hardened) return;
    try {
      if (typeof db.get === "function"){
        var og = db.get.bind(db);
        db.get = function(k){ var v = og(k); return (v===undefined||v===null) ? stubFor(key) : v; };
      }
      if (typeof db.getValue === "function"){
        var ov = db.getValue.bind(db);
        db.getValue = function(k){ var v = ov(k); return (v===undefined||v===null) ? stubFor(key) : v; };
      }
      db.__hardened = 1; patched.push(key);
    } catch(e){}
  }
  function apply(){
    try {
      if (typeof Tabikaeru === "undefined" || !Tabikaeru.DataManager) return false;
      var dm = Tabikaeru.DataManager.instance();
      if (!dm) return false;
      for (var key in DEFAULTS) { try { harden(dm[key], key); } catch(e){} }
      if (dm.visitorDB){ dm.visitorDB.provinceList = dm.visitorDB.provinceList || {}; dm.visitorDB.actionList = dm.visitorDB.actionList || {}; }
      try { console.log("[MOCK] hardened tables: " + patched.join(",")); } catch(e){}
      return true;
    } catch(e){ return false; }
  }
  if (!apply()) { var t=0; var iv=setInterval(function(){ if (apply() || ++t>60) clearInterval(iv); }, 500); }
  window.MOCK_HARDENED = function(){ return patched.slice(); };

  /* ---- generic view crash shield ----
     Every list view funnels through a renderItem()/onAddToStage() pair. A single
     index mismatch there used to throw on EVERY frame. Wrap them so a failure is
     logged once instead of killing the render loop. */
  function shieldMethods(){
    var wrapped = 0, names = [];
    for (var k in window) {
      try {
        var C = window[k];
        if (typeof C !== "function" || !C.prototype) continue;
        var names2 = ["renderItem","onAddToStage","dataChanged"];
        for (var j=0;j<names2.length;j++){
          var mn = names2[j];
          var fn = C.prototype[mn];
          if (typeof fn !== "function" || fn.__mockShield) continue;
          (function(C, mn, fn){
            var guardCount = 0;
            C.prototype[mn] = function(){
              try { return fn.apply(this, arguments); }
              catch(e){
                if (guardCount++ < 3) { try { console.warn("[MOCK] shielded " + mn + ": " + (e && e.message || e)); } catch(e2){} }
                return undefined;
              }
            };
            C.prototype[mn].__mockShield = 1;
            wrapped++;
          })(C, mn, fn);
          if (names.length < 12) names.push(k+"."+mn);
        }
      } catch(e){}
    }
    return { wrapped: wrapped, names: names };
  }
  try {
    var r = shieldMethods();
    try { console.log("[MOCK] view shield: wrapped " + r.wrapped + " methods (" + r.names.slice(0,8).join(", ") + ")"); } catch(e){}
  } catch(e){}
})();
