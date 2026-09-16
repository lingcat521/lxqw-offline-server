/* full automatic consistency audit: every renderer vs every payload item shape */
const fs=require('fs');
const BASE='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw';
let src='';
for (const f of ['main.min.js','game.min.js']) { try { src+=fs.readFileSync(BASE+'/apk/assets/game/js/'+f,'utf8')+' '; } catch(e){} }
function matchBrace(s,start){ let d=0,k=start; while(k<s.length){ const c=s[k]; if(c==='{')d++; else if(c==='}'){ d--; if(d===0)return k; } else if(c==='"'||c==="'"){ const q=c;k++; while(k<s.length&&s[k]!==q)k++; } k++; } return -1; }
/* renderers */
const renderers=[];
const re=/dataChanged=function\(([^)]*)\)\{/g;
let m;
while((m=re.exec(src))){
  const bs=m.index+m[0].length-1, be=matchBrace(src,bs);
  if(be<0) continue;
  const body=src.slice(bs+1,be);
  const before=src.slice(Math.max(0,m.index-6000), m.index);
  const cn=[...before.matchAll(/([A-Z][A-Za-z0-9_$]*)=function\(/g)];
  const cls=cn.length?cn[cn.length-1][1]:'?';
  const reads=new Set();
  for (const mm of body.matchAll(/this\.data\.([A-Za-z0-9_$]+)/g)) reads.add(mm[1]);
  if (reads.size) renderers.push({cls, reads:[...reads].sort()});
}
/* our payload item shapes */
global.window=global;
global.core={SocketManage:{prototype:{send(){}},getInstance:()=>({send:()=>{}})},Socket:{prototype:{}},ServiceDispatcher:{getInstance:()=>({hasEventListener:()=>false,dispatchEvent:()=>{}})},Event:function(){},Log:{print(){},warning(){},error(){}},Time:{getServerTime:()=>1},String:{isNullOrEmpty:()=>false,format:s=>s}};
global.Utils={convertArray:x=>Array.isArray(x)?x:[],formatPathImage:()=>'',parseHTML:x=>x};
global.egret={setTimeout:()=>0,clearTimeout(){},Capabilities:{runtimeType:'WEB'}};
global.RES={getRes:()=>null,hasRes:()=>true};
global.ProtocolList={protocolList:{}};global.ALISDK={};
global.Tabikaeru={DataManager:{instance:()=>({})}};
for (const f of ['semantic','defaults','rules','mock','iap','mail','activities','visitor','guard']) { try { eval(fs.readFileSync(BASE+'/new/'+f+'.js','utf8')); } catch(e){} }
const realLog=console.log, realWarn=console.warn; console.log=()=>{}; console.warn=()=>{};
const M=window.MockServer, S=window.MOCK_SEMANTIC;
const shapes=[];
function shapeOf(proto, path, el){
  if (!el || typeof el !== 'object' || Array.isArray(el)) return;
  shapes.push({proto, path, keys:Object.keys(el)});
}
function walk(proto, val, path, depth){
  if (depth>2 || !val || typeof val !== 'object') return;
  for (const k in val){
    const v=val[k];
    const p = path ? path+'.'+k : k;
    if (Array.isArray(v) && v.length && v[0] && typeof v[0]==='object') shapeOf(proto, p+'[]', v[0]);
    else if (v && typeof v==='object') walk(proto, v, p, depth+1);
  }
}
for (const name of Object.keys(S)) { try { walk(name, (typeof S[name]==='function'?S[name]({}):S[name]), '', 0); } catch(e){} }
for (const name of Object.keys(M.handlers)) { try { walk(name, M.handlers[name]({}), '', 0); } catch(e){} }
console.log=realLog; console.warn=realWarn;
/* match each renderer to the best overlapping shape */
const rows=[];
for (const r of renderers){
  let best=null, bestScore=0;
  for (const s of shapes){
    let score=0;
    for (const rd of r.reads) if (s.keys.indexOf(rd)>=0) score++;
    if (score>bestScore){ bestScore=score; best=s; }
  }
  if (!best || bestScore < 2) continue;
  const missing=r.reads.filter(rd=>best.keys.indexOf(rd)<0);
  if (missing.length) rows.push({cls:r.cls, proto:best.proto, path:best.path, score:bestScore, missing, keys:best.keys});
}
rows.sort((a,b)=>a.missing.length-b.missing.length);
realLog('renderers: '+renderers.length+' | payload shapes: '+shapes.length+' | matches with gaps: '+rows.length);
realLog('');
for (const r of rows){
  realLog(r.cls.padEnd(26)+' <- '+r.proto+'.'+r.path);
  realLog('    has   : '+r.keys.join(', ').slice(0,150));
  realLog('    needs : '+r.missing.join(', ').slice(0,150));
}
