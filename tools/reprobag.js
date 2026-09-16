/* reproduce the client's REAL Bag.renderItem against OUR data */
const fs=require('fs');const BASE='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw';
let src='';
for (const f of ['main.min.js','game.min.js']) { try { src+=fs.readFileSync(BASE+'/apk/assets/game/js/'+f,'utf8')+' '; } catch(e){} }
function matchBrace(s,start){ let d=0,k=start; while(k<s.length){ const c=s[k]; if(c==='{')d++; else if(c==='}'){ d--; if(d===0)return k; } else if(c==='"'||c==="'"){ const q=c;k++; while(k<s.length&&s[k]!==q)k++; } k++; } return -1; }
/* locate the Bag class, then its renderItem body */
const bi=src.indexOf('Bag=function(');
const bagSrc=src.slice(bi, bi+9000);
const ri=bagSrc.indexOf('renderItem=function(');
const pstart=bagSrc.indexOf('(', ri);
const popen=bagSrc.indexOf('{', pstart);
const pend=matchBrace(bagSrc, popen);
const body=bagSrc.slice(popen+1, pend);
console.log('Bag.renderItem body length:', body.length);
console.log('body head:', body.slice(0,120).replace(/\s+/g,' '));

/* ---- environment ---- */
function cell(){ return { image: { addEventListener(){}, set source(v){}, get source(){return '';} } }; }
const SCENARIOS = [
  { name: 'A) guideStep=Complete, 4 cells, our bag=4   (normal)',      gs:'Complete', cells:4, bagLen:4 },
  { name: 'B) guideStep=OpenBag,  2 cells, our bag=4   (OLD -> crash)', gs:'OpenBag',  cells:2, bagLen:4 },
  { name: 'C) guideStep=OpenBag,  2 cells, our bag=2   (bagCap fix)',   gs:'OpenBag',  cells:2, bagLen:2 },
];
function runCase(sc, useShield){
  const bagData = [];
  for (let i=0;i<sc.bagLen;i++) bagData.push(i);           /* item ids 0..n-1 (real ids) */
  const cells = [];
  for (let i=0;i<sc.cells;i++) cells.push(cell());
  let threw = null;
  const D = { ItemDB:{ get:(id)=> ({ id:id, type:0, sub_type:'', img:{index:'goods_1',src:'Icon/goods'}, name:'it'+id }) },
              FlowerData:{ get:()=>null } };
  const Tabikaeru = { DataType:{ItemType:{},ItemAmuletType:{}}, DataManager:{ instance:()=>D } };
  const core = { ModelManage:{getInstance:()=>({getModel:()=>({})})}, PathManage:{getInstance:()=>({getSkinsPath:()=>''})}, Time:{getServerTime:()=>1} };
  const self = {
    items: undefined,
    item0:cell(), item1:cell(), item2:cell(), item3:cell(),
    userModel:{ getClientSettings:()=>({guideStep:sc.gs}) },
    itemModel:{ getBagDataList:()=>bagData, getBagLock:()=>0 },
    setImageLock(){}, addEventListener(){}
  };
  const GuideStep = { OpenBag:'OpenBag', Complete:'Complete' };
  const scope = { egret:{TouchEvent:{TOUCH_TAP:'tap'}, Event:{}}, core:core, Tabikaeru:Tabikaeru, GuideStep:GuideStep,
                  Utils:{}, PromiseTexture:function(){}, FlowerTextureFactory:{instance:()=>({createTexture:()=>({})})},
                  console:console, window:global, Object:Object, Array:Array, Math:Math, JSON:JSON };
  let fn;
  try { fn = new Function('__s','with(__s){ return function(){' + body + '} }')(new Proxy(scope,{has:()=>true,get:(t,k)=> k in t ? t[k] : (typeof k==='symbol'?undefined:undefined)})); }
  catch(e){ return 'COMPILE-ERR '+e.message; }
  const target = useShield ? (function(orig){ return function(){ try { return orig.apply(this, arguments); } catch(e){ threw = 'SHIELDED: '+e.message; } }; })(fn) : fn;
  try { target.call(self); } catch(e){ threw = e.message; }
  return threw || 'no throw';
}
console.log('');
console.log('--- WITHOUT shield ---');
for (const sc of SCENARIOS) console.log('  '+sc.name.padEnd(52)+' -> '+runCase(sc,false));
console.log('--- WITH view shield ---');
for (const sc of SCENARIOS) console.log('  '+sc.name.padEnd(52)+' -> '+runCase(sc,true));
