const fs=require('fs');
const D='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw/apk/assets/game/js/';
let src='';
for (const f of ['main.min.js','game.min.js','default.thm.js']) { try{ src+=fs.readFileSync(D+f,'utf8')+' '; }catch(e){} }

function matchBrace(s,start){
  let depth=0,k=start;
  while(k<s.length){
    const c=s[k];
    if(c==='{')depth++;
    else if(c==='}'){ depth--; if(depth===0)return k; }
    else if(c==='"'||c==="'"){ const q=c;k++; while(k<s.length&&s[k]!==q)k++; }
    k++;
  }
  return -1;
}
const re=/prototype\.([A-Za-z0-9_$]+)=function\(([^)]*)\)\{/g;
const handlers=Object.create(null);
let m;
while((m=re.exec(src))){
  const name=m[1],params=m[2],bs=m.index+m[0].length-1,be=matchBrace(src,bs);
  if(be<0)continue;
  (handlers[name]=handlers[name]||[]).push({params,body:src.slice(bs+1,be)});
}
const protoSrc=src.slice(src.indexOf('protocolList={'));
const protoBlock=protoSrc.slice(0, matchBrace(protoSrc, protoSrc.indexOf('{'))+1);
const protos=[...new Set([...protoBlock.matchAll(/([A-Za-z0-9_]+):\[/g)].map(x=>x[1]))];

function makeRecorder(rec, path, opts){
  const child=(p)=>{ if(!rec.has(p)){ rec.add(p); } return makeRecorder(rec,p,opts); };
  const target=function(){ return child(path); };
  return new Proxy(target,{
    get(t,k){
      if(k==='then')return undefined;
      if(k==='prototype')return t.prototype;
      if(typeof k==='symbol'){
        if(k===Symbol.toPrimitive)return function(){return 0;};
        if(k===Symbol.iterator)return function(){ let done=false; return { next(){ if(done)return{done:true,value:undefined}; done=true; return {done:false,value:child(path+'[]')}; } }; };
        if(k===Symbol.toStringTag)return 'Object';
        return undefined;
      }
      if(k==='length'){ rec.add(path+'.length'); return 1; }
      if(k==='toJSON')return function(){return null;};
      if(k==='valueOf')return function(){return 0;};
      if(k==='toString')return function(){return '';};
      if(k==='constructor')return Object;
      if(/^[0-9]+$/.test(k))return child(path+'[]');
      return child(k===''?path:(path?path+'.'+k:String(k)));
    },
    has(){return true;},
    ownKeys(){return [];},
    getOwnPropertyDescriptor(){return undefined;},
    apply(){return child(path+'()');},
    construct(){return child(path+'()');}
  });
}
function makeAuto(){
  const af=function(){return auto;};
  return new Proxy(af,{
    get(t,k){
      if(k==='then')return undefined;
      if(k==='prototype')return t.prototype;
      if(typeof k==='symbol'){ if(k===Symbol.toPrimitive)return function(){return 0;}; if(k===Symbol.iterator)return function(){return {next(){return{done:true};}};}; return undefined; }
      if(k==='length')return 0;
      if(k==='toJSON')return function(){return null;};
      if(k==='valueOf')return function(){return 0;};
      if(k==='toString')return function(){return '';};
      if(k==='constructor')return Object;
      return auto;
    },
    has(){return true;},
    ownKeys(){return [];},
    getOwnPropertyDescriptor(){return undefined;},
    apply(){return auto;},
    construct(){return auto;}
  });
}
const auto=makeAuto();

function declaredNames(body,params){
  const s=new Set();
  params.split(',').forEach(p=>{p=p.trim(); if(p)s.add(p);});
  let mm;
  const vr=/(?:var|let|const)\s+([A-Za-z0-9_$,\s=]+)/g;
  while((mm=vr.exec(body))){ mm[1].split(',').forEach(x=>{ const n=x.split('=')[0].trim(); if(/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(n))s.add(n); }); }
  const fr=/function\s*([A-Za-z0-9_$]*)\s*\(([^)]*)\)/g;
  while((mm=fr.exec(body))){ if(mm[1])s.add(mm[1]); mm[2].split(',').forEach(x=>{x=x.trim(); if(x)s.add(x);}); }
  return s;
}
const out=Object.create(null);
for(const name of protos){
  const hs=handlers[name];
  if(!hs)continue;
  const rec=new Set(); const reqRec=new Set();
  let err=null;
  for(const h of hs){
    const declared=declaredNames(h.body,h.params);
    const scope=new Proxy({},{ has:(t,k)=>typeof k==='string'&&!declared.has(k), get:(t,k)=>{ if(typeof k==='symbol')return undefined; if(k==='Array')return {isArray:()=>true,from:()=>auto}; if(k==='Object')return Object; if(k==='JSON')return JSON; if(k==='Math')return Math; return auto; } });
    let fn=null;
    try{ fn=new Function('__scope','with(__scope){ return function('+h.params+'){'+h.body+'} }')(scope); }catch(e){ err='compile:'+e.message; continue; }
    const resp=makeRecorder(rec,'');
    const req=makeRecorder(reqRec,'');
    try{ fn.call(auto, resp, req); }catch(e){ if(!err)err='run:'+e.message; }
  }
  if(rec.size||reqRec.size||err) out[name]={fields:[...rec].sort(), req:[...reqRec].sort(), err};
}
fs.writeFileSync('/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw/probe_out.json', JSON.stringify(out,null,1));
const keys=Object.keys(out);
console.log('probed protocols:',keys.length);
const demo=['client_load_role','weather_load','item_load_items','furniture_load_furniture','visit_load','task_load','calendar_load','mail_load','lottery_load','guest_load_drawing','album_load','rank_load'];
for(const k of demo){ if(out[k]) console.log('### '+k+'\n   '+(out[k].fields||[]).join(' | ').slice(0,600)+(out[k].err?('   ERR='+out[k].err):'')); }
