/* validate: run OUR mock responses through the CLIENT's real handlers */
const fs=require('fs');
const BASE='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw';
const D=BASE+'/apk/assets/game/js/';
let src='';
for (const f of ['main.min.js','game.min.js']) { try { src += fs.readFileSync(D+f,'utf8')+' '; } catch(e){} }
function matchBrace(s,start){ let d=0,k=start; while(k<s.length){ const c=s[k]; if(c==='{')d++; else if(c==='}'){ d--; if(d===0)return k; } else if(c==='"'||c==="'"){ const q=c;k++; while(k<s.length&&s[k]!==q)k++; } k++; } return -1; }
const re=/prototype\.([A-Za-z0-9_$]+)=function\(([^)]*)\)\{/g;
const handlers=Object.create(null); let m;
while((m=re.exec(src))){ const n=m[1],p=m[2],bs=m.index+m[0].length-1,be=matchBrace(src,bs); if(be<0)continue; (handlers[n]=handlers[n]||[]).push({params:p,body:src.slice(bs+1,be)}); }
function autoFn(){ return auto; }
const auto=new Proxy(autoFn,{ get(t,k){ if(k==='then')return undefined; if(k==='prototype')return t.prototype; if(typeof k==='symbol'){ if(k===Symbol.toPrimitive)return function(){return 0;}; if(k===Symbol.iterator)return function(){return {next(){return{done:true};}};}; return undefined;} if(k==='length')return 0; if(k==='toJSON')return function(){return null;}; if(k==='valueOf')return function(){return 0;}; if(k==='toString')return function(){return '';}; if(k==='constructor')return Object; return auto; }, set(){return true;}, has(){return true;}, ownKeys(){return [];}, getOwnPropertyDescriptor(){return undefined;}, apply(){return auto;}, construct(){return auto;} });
function declaredNames(body,params){ const s=new Set(); params.split(',').forEach(p=>{p=p.trim(); if(p)s.add(p);}); let mm; const vr=/(?:var|let|const)\s+([A-Za-z0-9_$,\s=]+)/g; while((mm=vr.exec(body))){ mm[1].split(',').forEach(x=>{ const n=x.split('=')[0].trim(); if(/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(n))s.add(n); }); } const fr=/function\s*([A-Za-z0-9_$]*)\s*\(([^)]*)\)/g; while((mm=fr.exec(body))){ if(mm[1])s.add(mm[1]); mm[2].split(',').forEach(x=>{x=x.trim(); if(x)s.add(x);}); } return s; }
/* ---- client stubs ---- */
const warns=[];
global.window=global;
const Log={ print(){}, warning(msg){ warns.push(String(msg)); }, error(msg){ warns.push('ERR '+String(msg)); } };
global.core={ SocketManage:{prototype:{send(){}},getInstance:()=>({send:()=>{},sendMessage:()=>{}})}, Socket:{prototype:{}}, ServiceDispatcher:{getInstance:()=>({hasEventListener:()=>false,dispatchEvent:()=>{}})}, Event:function(t,d,p){this.type=t;this.data=d;this.params=p;}, Log:Log, Time:{getServerTime:()=>Math.floor(Date.now()/1000),setServerTime(){}}, String:{isNullOrEmpty:s=>!s||s.length===0,format:(s)=>s,getFunctionArgs:()=>[]}, ModelManage:{getInstance:()=>({getModel:()=>auto})}, PageManage:{getInstance:()=>({addViewControl(){},getControl(){},removeControl(){}})}, DisplayManage:{getInstance:()=>({getNoticeLayer:()=>({}),popup(){},popupLayer:{addChild(){}}})}, MathExtend:{Range:()=>1}, NativeCall:{sendNative(){}} };
global.Utils={ convertArray:(x)=>{ if(Array.isArray(x))return x; if(x&&typeof x==='object'){ const o=[]; for(const k in x) o.push(x[k]); return o; } return []; }, convertArrayAll:(x)=>{ if(x&&typeof x==='object'&&!Array.isArray(x)){ const o={}; for(const k in x) o[k]=Array.isArray(x[k])?x[k]:[x[k]]; return o; } return x; }, formatPathImage:()=>'', getFunctionArgs:()=>[] };
global.egret={ setTimeout:(f)=>0, clearTimeout(){}, setInterval:()=>0, clearInterval(){}, Event:function(){}, ProgressEvent:{}, Capabilities:{runtimeType:'WEB'} };
global.ProtocolList={protocolList:{}}; global.ALISDK={}; global.MainContext=undefined; global.RES={ getRes:()=>null, hasRes:()=>true, getResByUrl:()=>({then:()=>{}}) };
global.Tabikaeru={ DataManager:{ instance:()=>({ ItemDB:{get:()=>null}, FlowerData:{get:()=>null}, ShopDataDB:{get:()=>null}, FurnitureDB:{get:()=>null}, encyclopediaData:{get:()=>[]}, TaskDB:{get:()=>({})} }) }, DataType:{ItemType:{},ItemAmuletType:{}}, RedotManager:{instance:()=>({setRedotValue(){}})}, DefineExtra:{}, Define:{WeatherType:{}} };
/* ---- load our mock ---- */
eval(fs.readFileSync(BASE+'/new/semantic.js','utf8'));
eval(fs.readFileSync(BASE+'/new/defaults.js','utf8'));
eval(fs.readFileSync(BASE+'/new/rules.js','utf8'));
eval(fs.readFileSync(BASE+'/new/mock.js','utf8'));
const M=window.MockServer;
/* only validate real protocol names */
const pi=src.indexOf('protocolList={');
const pj=pi+('protocolList='.length);
const pb=src.slice(pj, matchBrace(src,pj)+1);
const PROTO=new Set([...pb.matchAll(/([A-Za-z0-9_]+):\[/g)].map(x=>x[1]));
/* silence mock logging during the sweep */
const realLog=console.log, realWarn=console.warn;
console.log=function(){}; console.warn=function(){};
console.log=realLog; console.warn=realWarn;
realLog('PROTO_LIST_OK protocols='+PROTO.size+' | our handlers='+Object.keys(M.handlers).length+' | semantic='+Object.keys(window.MOCK_SEMANTIC).length);
let checked=0, exc=[], warnsByProto={};
const quiet=()=>{}; const savedLog=console.log, savedWarn=console.warn;
for (const name of Object.keys(handlers)) {
  if (!PROTO.has(name)) continue;
  let resp=null, ok=false;
  console.log=quiet; console.warn=quiet;
  try { resp = M.handle(name, {}); ok=true; } catch(e){ console.log=savedLog; console.warn=savedWarn; exc.push(name+': [our-handler] '+e.message); continue; }
  console.log=savedLog; console.warn=savedWarn;
  warns.length=0;
  for (const h of handlers[name]) {
    const declared=declaredNames(h.body,h.params);
    const scope=new Proxy({},{ has:(t,k)=>typeof k==='string'&&!declared.has(k), get:(t,k)=>{ if(typeof k==='symbol')return undefined; if(k==='Utils')return global.Utils; if(k==='Object')return Object; if(k==='JSON')return JSON; if(k==='Math')return Math; if(k==='Array')return {isArray:Array.isArray,from:Array.from}; return auto; } });
    let fn=null;
    try { fn=new Function('__scope','with(__scope){ return function('+h.params+'){'+h.body+'} }')(scope); } catch(e){ continue; }
    /* the second argument is what the CLIENT sent with the request; some handlers read
       it back (rank_get_intro does t.duration+t.type+t.uid.toString()), so give them a
       small concrete object.  Do NOT pass the auto proxy here - handlers that loop on a
       param would never terminate. */
    try { fn.call(auto, resp, { duration: 1, type: 1, uid: 1, id: 1, index: 1, pos: 1, start: 1, count: 1 }); } catch(e) { exc.push(name+': '+e.message); }
  }
  if (warns.length) warnsByProto[name]=warns.slice(0,2);
  checked++;
}
console.log('handlers exercised:', checked);
console.log('\n=== EXCEPTIONS ('+exc.length+') ===');
for (const e of exc.slice(0,25)) console.log('  '+e);
console.log('\n=== CLIENT WARNINGS ('+Object.keys(warnsByProto).length+' protocols) ===');
for (const k of Object.keys(warnsByProto).slice(0,25)) console.log('  '+k+' -> '+warnsByProto[k][0].slice(0,110));
