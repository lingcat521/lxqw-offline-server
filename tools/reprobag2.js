/* reproduce the REAL Bag.renderItem (the one using getBagDataList) against our data */
const fs=require('fs');const BASE='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw';
let src='';
for (const f of ['main.min.js','game.min.js']) { try { src+=fs.readFileSync(BASE+'/apk/assets/game/js/'+f,'utf8')+' '; } catch(e){} }
function mb(s,start){ let d=0,k=start; while(k<s.length){ const c=s[k]; if(c==='{')d++; else if(c==='}'){ d--; if(d===0)return k; } else if(c==='"'||c==="'"){ const q=c;k++; while(k<s.length&&s[k]!==q)k++; } k++; } return -1; }
let BODY='', FOUND=0;
{ const re=/renderItem=function\(\)\{/g; let m;
  while((m=re.exec(src))){
    const bs=m.index+m[0].length-1, be=mb(src,bs);
    if(be<0) continue;
    const b=src.slice(bs+1,be);
    FOUND++;
    if (b.indexOf('getBagDataList')>=0) { BODY=b; }
  }
}
console.log('renderItem candidates found:', FOUND);
console.log('bag renderItem body length:', BODY.length);
console.log('body head:', BODY.slice(0,150).replace(/\s+/g,' '));
if (!BODY) { console.log('EXTRACTION FAILED'); process.exit(0); }

function cell(){ return { addEventListener(){}, source:'', texture:null }; }
function runCase(label, gs, cellsN, bagData, useShield){
  let out='no throw';
  const D={ ItemDB:{get:(id)=>({id:id,type:0,sub_type:'',img:{index:'goods_1',src:'Icon/goods'},name:'it'+id})}, FlowerData:{get:()=>null} };
  const core={ SocketManage:{getInstance:()=>({send(){}})}, ModelManage:{getInstance:()=>({getModel:()=>({})})}, Time:{getServerTime:()=>1} };
  const self={ item0:cell(),item1:cell(),item2:cell(),item3:cell(),
    userModel:{getClientSettings:()=>({guideStep:gs})},
    itemModel:{ getBagDataList:()=>bagData, getBagLock:()=>0 }, setImageLock(){}, addEventListener(){} };
  const scope={ egret:{TouchEvent:{TOUCH_TAP:'tap'}}, core:core, Tabikaeru:{DataType:{ItemType:{},ItemAmuletType:{}},DataManager:{instance:()=>D},path:{formatPathImage:()=>''}},
    GuideStep:{OpenBag:'OpenBag',Complete:'Complete'}, Utils:{}, PromiseTexture:function(){},
    FlowerTextureFactory:{instance:()=>({createTexture:()=>({})})}, Object:Object, Array:Array, Math:Math, JSON:JSON };
  let fn=null;
  try { fn=new Function('__s','with(__s){ return function(){'+BODY+'} }')(scope); } catch(e){ return 'COMPILE-ERR '+e.message; }
  const target = useShield ? (function(o){ return function(){ try{ return o.apply(this,arguments); }catch(e){ out='SHIELDED: '+e.message; } }; })(fn) : fn;
  try { target.call(self); } catch(e){ out=e.message; }
  console.log('  '+label.padEnd(56)+' -> '+out);
}
console.log('');
console.log('--- WITHOUT shield (what happened before the fix) ---');
runCase('Complete, 4 cells, bag=4 (normal)', 'Complete', 4, [0,1,2,3], false);
runCase('OpenBag , 2 cells, bag=4 (OLD crash)', 'OpenBag', 2, [0,1,2,3], false);
runCase('OpenBag , 2 cells, bag=2 (bagCap fix)', 'OpenBag', 2, [0,1], false);
console.log('--- WITH view shield ---');
runCase('OpenBag , 2 cells, bag=4 (shield net)', 'OpenBag', 2, [0,1,2,3], true);
