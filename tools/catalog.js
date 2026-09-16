const fs=require('fs');
const BASE='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw';
let src='';
for (const f of ['main.min.js','game.min.js']) { try { src+=fs.readFileSync(BASE+'/apk/assets/game/js/'+f,'utf8')+' '; } catch(e){} }
function matchBrace(s,start){ let d=0,k=start; while(k<s.length){ const c=s[k]; if(c==='{')d++; else if(c==='}'){ d--; if(d===0)return k; } else if(c==='"'||c==="'"){ const q=c;k++; while(k<s.length&&s[k]!==q)k++; } k++; } return -1; }
/* find every dataChanged method, then the nearest preceding NAME=function( -> class name */
const out=[];
const re=/dataChanged=function\(([^)]*)\)\{/g;
let m;
while((m=re.exec(src))){
  const bs=m.index+m[0].length-1, be=matchBrace(src,bs);
  if (be<0) continue;
  const body=src.slice(bs+1,be);
  const before=src.slice(Math.max(0,m.index-4000), m.index);
  const cn=[...before.matchAll(/([A-Z][A-Za-z0-9_$]*)=function\(/g)];
  const cls=cn.length?cn[cn.length-1][1]:'?';
  const reads=new Set();
  for (const mm of body.matchAll(/this\.data\.([A-Za-z0-9_$]+)((?:\.[A-Za-z0-9_$]+)*)/g)) reads.add(mm[1]+mm[2]);
  if (reads.size) out.push({cls, reads:[...reads].sort()});
}
const seen=new Set();
console.log('=== ITEM RENDERER CATALOG ('+out.length+') ===');
for (const o of out){
  const k=o.cls;
  if (seen.has(k)) continue; seen.add(k);
  console.log(o.cls.padEnd(28)+' :: '+o.reads.join(', '));
}
