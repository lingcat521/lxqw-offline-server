const fs=require('fs');
const D='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw/apk/assets/game/js/';
let src='';
for (const f of ['main.min.js','game.min.js','default.thm.js']) { try{ src+=fs.readFileSync(D+f,'utf8')+' '; }catch(e){} }
const PATH=Symbol('p');
function makeRecorder(R, path){
  const child=(p)=>makeRecorder(R,p);
  const t=function(){ return child(path); };
  return new Proxy(t,{
    get(tt,k){
      if(k===PATH)return path;
      if(k==='then')return undefined;
      if(k==='prototype')return tt.prototype;
      if(typeof k==='symbol'){ if(k===Symbol.toPrimitive)return function(){return 0;}; if(k===Symbol.iterator)return function(){ let d=false; return { next(){ if(d)return{done:true,value:undefined}; d=true; return {done:false,value:child(path+'[]')}; } }; }; return undefined; }
      if(k==='length'){ R.arrays.add(path); return 1; }
      if(k==='toJSON')return function(){return null;};
      if(k==='valueOf')return function(){return 0;};
      if(k==='toString')return function(){return '';};
      if(k==='constructor')return Object;
      if(/^[0-9]+$/.test(k))return child(path);
      const np= path? path+'.'+k : k;
      R.fields.add(np); return child(np);
    },
    has(){return true;}, ownKeys(){return [];}, getOwnPropertyDescriptor(){return undefined;},
    apply(){return child(path);}, construct(){return child(path);}
  });
}
function makeAuto(){ const af=function(){return auto;}; return new Proxy(af,{ get(t,k){ if(k==='then')return undefined; if(k==='prototype')return t.prototype; if(typeof k==='symbol'){ if(k===Symbol.toPrimitive)return function(){return 0;}; if(k===Symbol.iterator)return function(){return {next(){return{done:true};}};}; return undefined;} if(k==='length')return 0; if(k==='toJSON')return function(){return null;}; if(k==='valueOf')return function(){return 0;}; if(k==='toString')return function(){return '';}; if(k==='constructor')return Object; return auto; }, has(){return true;}, ownKeys(){return [];}, getOwnPropertyDescriptor(){return undefined;}, apply(){return auto;}, construct(){return auto;} }); }
const auto=makeAuto();
function declaredNames(body,params){ const s=new Set(); params.split(',').forEach(p=>{p=p.trim(); if(p)s.add(p);}); let mm; const vr=/(?:var|let|const)\s+([A-Za-z0-9_$,\s=]+)/g; while((mm=vr.exec(body))){ mm[1].split(',').forEach(x=>{ const n=x.split('=')[0].trim(); if(/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(n))s.add(n); }); } const fr=/function\s*([A-Za-z0-9_$]*)\s*\(([^)]*)\)/g; while((mm=fr.exec(body))){ if(mm[1])s.add(mm[1]); mm[2].split(',').forEach(x=>{x=x.trim(); if(x)s.add(x);}); } return s; }
function matchParen(s,start){ let d=0,k=start; while(k<s.length){ const c=s[k]; if(c==='(')d++; else if(c===')'){ d--; if(d===0) return k; } else if(c==='"'||c==="'"){ const q=c;k++; while(k<s.length&&s[k]!==q)k++; } else if(c==='{'){ const e=matchBrace(s,k); if(e>0)k=e; } k++; } return -1; }
function matchBrace(s,start){ let d=0,k=start; while(k<s.length){ const c=s[k]; if(c==='{')d++; else if(c==='}'){ d--; if(d===0) return k; } else if(c==='"'||c==="'"){ const q=c;k++; while(k<s.length&&s[k]!==q)k++; } k++; } return -1; }
const re=/\.send\(\s*"([A-Za-z0-9_]+)"/g;
const out=Object.create(null);
let m;
while((m=re.exec(src))){
  const name=m[1];
  const open=src.indexOf('(', m.index+5);
  const close=matchParen(src, open);
  if(close<0) continue;
  const args=src.slice(open+1, close);
  const R=out[name]=out[name]||{fields:new Set(),arrays:new Set(),calls:0};
  R.calls++;
  /* find Action callbacks in the argument list */
  const fre=/function\s*\(([^)]*)\)\s*\{/g;
  let fm;
  while((fm=fre.exec(args))){
    const params=fm[1]; const bs=args.indexOf('{', fm.index+fm[0].length-1);
    const be=matchBrace(args, bs);
    if(be<0) continue;
    const body=args.slice(bs+1,be);
    const declared=declaredNames(body, params);
    const scope=new Proxy({},{ has:(t,k)=>typeof k==='string'&&!declared.has(k), get:(t,k)=>{ if(typeof k==='symbol')return undefined; if(k==='Array')return {isArray:()=>true,from:()=>auto}; if(k==='Object')return Object; if(k==='JSON')return JSON; if(k==='Math')return Math; if(k==='Utils')return new Proxy({},{get(tt,kk){ if(kk==='convertArray'||kk==='convertArrayAll') return function(x){ try{ if(x&&(typeof x==='object'||typeof x==='function')&&x[PATH]!==undefined) R.arrays.add(x[PATH]); }catch(e){} return x; }; return auto; }, has(){return true;}}); return auto; } });
    let fn=null;
    try{ fn=new Function('__scope','with(__scope){ return function('+params+'){'+body+'} }')(scope); }catch(e){ continue; }
    const resp=makeRecorder(R,'');
    try{ fn.call(auto, resp, makeRecorder({fields:new Set(),arrays:new Set()},'')); }catch(e){}
  }
}
const res=Object.create(null);
for(const k of Object.keys(out)){ res[k]={fields:[...out[k].fields].sort(), arrays:[...out[k].arrays].sort(), calls:out[k].calls}; }
fs.writeFileSync('/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw/probe_callbacks.json', JSON.stringify(res,null,1));
const withFields=Object.keys(res).filter(k=>res[k].fields.length);
console.log('call sites scanned:', Object.keys(res).length, '| with callback fields:', withFields.length);
for(const k of ['client_rename_cost','client_set_name','item_buy','lottery_open','clover_harvest','travel_read_note','item_load_shop_info']){
  if(res[k]) console.log('### '+k+' (calls='+res[k].calls+')\n   fields: '+res[k].fields.join(', ')+(res[k].arrays.length?('\n   arrays: '+res[k].arrays.join(', ')):''));
}
