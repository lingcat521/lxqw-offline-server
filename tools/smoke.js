/* offline smoke test: load the mock with stubs and exercise every handler + the push burst */
const fs=require('fs');
const BASE='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw';
const events=[];
function mkDispatcher(){ return { hasEventListener:(n)=>{ return listeners[n]!==undefined; }, dispatchEvent:(ev)=>{ events.push(ev.type); if(listeners[ev.type]) listeners[ev.type].forEach(f=>f(ev.data, ev.params)); } }; }
const listeners=Object.create(null);
global.window=global;
global.core={
  SocketManage:{ prototype:{ send:function(){} }, getInstance:function(){ return { send:function(){} }; } },
  Socket:{ prototype:{} },
  ServiceDispatcher:{ getInstance:()=>mkDispatcher() },
  Event:function(type,data,params){ this.type=type; this.data=data; this.params=params; },
  Log:{ print:()=>{}, warning:()=>{}, error:()=>{} }
};
global.ProtocolList={ protocolList:{} };
global.ALISDK={};
global.egret={ setTimeout:(f,t)=>setTimeout(f,t||0) };
const src=fs.readFileSync(BASE+'/new/mock.js','utf8');
eval(src);
const Mock=global.MockServer; Object.keys(Mock.handlers).concat(['rank_load','client_load_role','weather_load']).forEach(function(n){ global.ProtocolList.protocolList[n]=[[],true]; });
const names=Object.keys(Mock.handlers);
console.log('handlers loaded:', names.length, '| push list:', Mock.PUSH_LIST.length);
/* register a listener for every protocol so nothing is skipped as NO-LISTENER */
names.forEach(n=>{ listeners[n]=[function(){}]; });
Mock.PUSH_LIST.forEach(n=>{ listeners[n]=listeners[n]||[function(){}]; });
let bad=0; const errs=[];
for(const n of names){
  try{ const r=Mock.handle(n,{}); JSON.stringify(r); }
  catch(e){ bad++; errs.push(n+': '+e.message); }
}
console.log('handler call errors:', bad);
if(errs.length) console.log(errs.slice(0,10).join('\n'));
/* exercise login chain + push burst end to end */
const SM=core.SocketManage.prototype;
SM.send('client_hello'); SM.send('hall_gen_token',null,'guest1'); SM.send('hall_login',null,'tok');
SM.send('hall_enter_game');
setTimeout(()=>{
  console.log('events after burst:', events.length);
  const seen=events.filter((v,i,a)=>a.indexOf(v)===i);
  console.log('dispatch ok for:', seen.length, 'protocols');
  const missing=Mock.PUSH_LIST.filter(n=>events.indexOf(n)<0);
  console.log('push entries with no dispatch:', missing.length, missing.slice(0,12).join(' '));
  console.log('sample values:');
  for(const k of ['item_load_items','album_load','client_load_role','weather_load','visit_load']){
    try{ console.log('  '+k+' = '+JSON.stringify(Mock.handle(k,{})).slice(0,180)); }catch(e){ console.log('  '+k+' ERR '+e.message); }
  }
}, 1200);
