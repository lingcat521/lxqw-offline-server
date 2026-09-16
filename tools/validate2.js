/* view sweep: run every client item-renderer against every item WE send */
const fs=require('fs');
const BASE='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw';
const D=BASE+'/apk/assets/game/js/';
let src='';
for (const f of ['main.min.js','game.min.js']) { try { src += fs.readFileSync(D+f,'utf8')+' '; } catch(e){} }
function matchBrace(s,start){ let d=0,k=start; while(k<s.length){ const c=s[k]; if(c==='{')d++; else if(c==='}'){ d--; if(d===0)return k; } else if(c==='"'||c==="'"){ const q=c;k++; while(k<s.length&&s[k]!==q)k++; } k++; } return -1; }
/* collect render entry points */
const RENDER=/^(dataChanged|setInfo|updateInfo|refresh|onRefresh|update|show)$/;
const renders=[];
const re=/prototype\.([A-Za-z0-9_$]+)=function\(([^)]*)\)\{/g;
let m;
while((m=re.exec(src))){
  if (!RENDER.test(m[1])) continue;
  const bs=m.index+m[0].length-1, be=matchBrace(src,bs);
  if (be<0) continue;
  renders.push({name:m[1], params:m[2], body:src.slice(bs+1,be)});
}
function autoFn(){ return auto; }
const auto=new Proxy(autoFn,{ get(t,k){ if(k==='then')return undefined; if(k==='prototype')return auto; if(typeof k==='symbol'){ if(k===Symbol.toPrimitive)return function(){return 0;}; if(k===Symbol.iterator)return function(){return {next(){return{done:true};}};}; return undefined;} if(k==='length')return 0; if(k==='toJSON')return function(){return null;}; if(k==='valueOf')return function(){return 0;}; if(k==='toString')return function(){return '';}; if(k==='constructor')return Object; return auto; }, set(){return true;}, has(){return true;}, ownKeys(){return [];}, getOwnPropertyDescriptor(){return undefined;}, apply(){return auto;}, construct(){return auto;} });
function declaredNames(body,params){ const s=new Set(); params.split(',').forEach(p=>{p=p.trim(); if(p)s.add(p);}); let mm; const vr=/(?:var|let|const)\s+([A-Za-z0-9_$,\s=]+)/g; while((mm=vr.exec(body))){ mm[1].split(',').forEach(x=>{ const n=x.split('=')[0].trim(); if(/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(n))s.add(n); }); } const fr=/function\s*([A-Za-z0-9_$]*)\s*\(([^)]*)\)/g; while((mm=fr.exec(body))){ if(mm[1])s.add(mm[1]); mm[2].split(',').forEach(x=>{x=x.trim(); if(x)s.add(x);}); } return s; }
global.window=global;
const warns=[];
global.core={ SocketManage:{prototype:{send(){}},getInstance:()=>({send:()=>{}})}, Socket:{prototype:{}}, ServiceDispatcher:{getInstance:()=>({hasEventListener:()=>false,dispatchEvent:()=>{}})}, Event:function(t,d,p){this.type=t;this.data=d;this.params=p;}, Log:{print(){},warning(x){warns.push(String(x));},error(x){warns.push('ERR '+String(x));}}, Time:{getServerTime:()=>Math.floor(Date.now()/1000)}, String:{isNullOrEmpty:s=>!s||!s.length,format:s=>s}, ModelManage:{getInstance:()=>({getModel:()=>auto})}, PageManage:{getInstance:()=>({addViewControl(){},getControl(){},removeControl(){}})}, DisplayManage:{getInstance:()=>({getNoticeLayer:()=>({}),popup(){}})}, MathExtend:{Range:()=>1} };
global.Utils={ parseHTML:(x)=>x, chengeNewline:(x)=>x, getFunctionArgs:()=>[], createObjectURL:()=>'', createImage(){}, simpleEncrypt:(x)=>x, convertArray:(x)=>{ if(Array.isArray(x))return x; if(x&&typeof x==='object'){const o=[];for(const k in x)o.push(x[k]);return o;} return []; }, convertArrayAll:(x)=>x, formatPathImage:()=>'', disableButtonOneTime(){} };
global.egret={ setTimeout:()=>0, clearTimeout(){}, setInterval:()=>0, clearInterval(){}, Event:function(){}, Tween:{removeTweens(){}}, Capabilities:{runtimeType:'WEB'}, getTimer:()=>0 };
global.RES={ getRes:()=>null, hasRes:()=>true, getResByUrl:()=>({then:()=>{}}), createGroup(){}, loadGroup:()=>({then:()=>{}}) };
global.ProtocolList={protocolList:{}}; global.ALISDK={};
global.Tabikaeru={ DataManager:{instance:()=>({ItemDB:{get:()=>null},FlowerData:{get:()=>null},ShopDataDB:{get:()=>null},FurnitureDB:{get:()=>null},rechargeDB:{get:()=>null},encyclopediaData:{get:()=>[]},TaskDB:{get:()=>({})}})}, DataType:{ItemType:{},ItemAmuletType:{}}, RedotManager:{instance:()=>({setRedotValue(){}})}, DefineExtra:{}, Define:{WeatherType:{}} };
eval(fs.readFileSync(BASE+'/new/semantic.js','utf8'));
eval(fs.readFileSync(BASE+'/new/defaults.js','utf8'));
eval(fs.readFileSync(BASE+'/new/rules.js','utf8'));
eval(fs.readFileSync(BASE+'/new/mock.js','utf8'));
eval(fs.readFileSync(BASE+'/new/iap.js','utf8'));
eval(fs.readFileSync(BASE+'/new/mail.js','utf8'));
const M=window.MockServer, S=window.MOCK_SEMANTIC;
const realLog=console.log, realWarn=console.warn; console.log=()=>{}; console.warn=()=>{};
/* build the item list: every array we send, plus every element of nested arrays */
const items=[];
function collect(name, val, depth){
  if (depth>2) return;
  if (Array.isArray(val)) { for (const el of val) if (el && typeof el === 'object') items.push({proto:name, where:'array', el:el}); }
  else if (val && typeof val==='object') {
    for (const k in val) if (Array.isArray(val[k])) { for (const el of val[k]) if (el && typeof el === 'object') items.push({proto:name, where:k, el:el}); }
  }
}
for (const name of Object.keys(S)) { try { collect(name, (typeof S[name]==='function'?S[name]({}):S[name]), 0); } catch(e){} }
for (const name of Object.keys(M.handlers)) { try { collect(name, M.handlers[name]({}), 0); } catch(e){} }
console.log=realLog; console.warn=realWarn;
realLog('render entry points: '+renders.length+' | item instances to render: '+items.length);
const failures=Object.create(null);
let runs=0;
for (const it of items){
  for (const r of renders){
    const declared=declaredNames(r.body, r.params);
    const scope=new Proxy({},{ has:(t,k)=>typeof k==='string'&&!declared.has(k), get:(t,k)=>{ if(typeof k==='symbol')return undefined; if(k==='Utils')return global.Utils; if(k==='Object')return Object; if(k==='JSON')return JSON; if(k==='Math')return Math; if(k==='Array')return {isArray:Array.isArray,from:Array.from}; if(k==='RES')return global.RES; if(k==='egret')return global.egret; return auto; } });
    let fn=null;
    try { fn=new Function('__scope','with(__scope){ return function('+r.params+'){'+r.body+'} }')(scope); } catch(e){ continue; }
    /* this with .data = our item */
    const self=Object.create(null);
    self.data=it.el;
    const selfP=new Proxy(self,{ get(t,k){ if(k in t) return t[k]; if(typeof k==='symbol')return undefined; return auto; }, set(t,k,v){ t[k]=v; return true; }, has(){ return true; }, ownKeys(t){ return Reflect.ownKeys(t); }, getOwnPropertyDescriptor(t,k){ return Reflect.getOwnPropertyDescriptor(t,k); } });
    console.log=()=>{}; console.warn=()=>{};
    try { fn.apply(selfP, [auto]); runs++; } catch(e) {
      const key=r.name+' <- '+it.proto+(it.where==='array'?'[]':'.'+it.where);
      if (!failures[key]) failures[key]=e.message;
    }
    console.log=realLog; console.warn=realWarn;
  }
}
realLog('renderer runs: '+runs);
realLog('');
realLog('=== RENDER FAILURES ('+Object.keys(failures).length+') ===');
let n=0;
for (const k of Object.keys(failures)) { realLog('  '+k+'  ::  '+String(failures[k]).slice(0,90)); if(++n>40) break; }
