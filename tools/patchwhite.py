p='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw/new/mock.js'
s=open(p,encoding='utf-8').read()
# 1) weather FIRST in early push
old1='''  Mock.pushEarly = function () {
    dispatch("client_load_role", Mock.handlers["client_load_role"]({}));
    dispatch("weather_load", Mock.handlers["weather_load"]({}));
  };'''
new1='''  Mock.pushEarly = function () {
    /* weather FIRST: the main scene captures seasonKey at construction */
    dispatch("weather_load", Mock.handlers["weather_load"]({}));
    dispatch("client_load_role", Mock.handlers["client_load_role"]({}));
  };'''
assert old1 in s, 'pushEarly pattern missing'
s=s.replace(old1,new1)
# 2) WeatherModel.getSeasonKey fallback + REQ logging
old2='''    /* errcode_json is absent from the APK; provide code->info so error checks work offline */'''
new2='''    /* season fallback: never let getSeasonKey() yield "00" (missing seasonNN group -> white screen) */
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
    /* errcode_json is absent from the APK; provide code->info so error checks work offline */'''
assert old2 in s, 'errcode anchor missing'
s=s.replace(old2,new2)
# 3) restore REQ logging for handshake/time-sensitive protocols
old3='''      var resp = (wants || hasCb) ? Mock.handle(name, params) : null;'''
new3='''      if (name.indexOf("hall_") === 0 || name === "weather_load" || name === "client_load_all_info") lg("REQ "+name);
      var resp = (wants || hasCb) ? Mock.handle(name, params) : null;'''
assert old3 in s, 'send anchor missing'
s=s.replace(old3,new3)
s=s.replace('version: "0.10.0"','version: "0.11.0"')
open(p,'w',encoding='utf-8').write(s); print('mock patched to v0.11')
