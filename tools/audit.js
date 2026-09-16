/* static consistency audit: what each renderer reads from this.data  vs  what we send */
const fs=require('fs');
const BASE='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw';
const D=BASE+'/apk/assets/game/js/';
let src='';
for (const f of ['main.min.js','game.min.js']) { try { src += fs.readFileSync(D+f,'utf8')+' '; } catch(e){} }
function classBody(name, span){
  const i=src.indexOf(name+'=function(');
  if (i<0) return '';
  return src.slice(i, i+(span||2600));
}
function dataReads(body){
  const out=new Set();
  for (const m of body.matchAll(/this\.data\.([A-Za-z0-9_$]+)((?:\.[A-Za-z0-9_$]+)*)/g)) out.add(m[1]+m[2]);
  for (const m of body.matchAll(/this\.data\b(?!\.)/g)) out.add('<data itself>');
  return [...out].sort();
}
/* renderer  ->  our payload path */
const MAP=[
  ['RechargeFieldItem','recharge_load','field[]'],
  ['RechargeCloverItem','recharge_load','sack[]'],
  ['RechargeMerchItem','recharge_merch','list[]'],
  ['FurnitureShopItem','furniture_load_furniture','shop.shop_list[]'],
  ['RechargeGiftPage','recharge_load_gift','gift[]'],
  ['GuestItemRenderer','guest_load_drawing','colls[]'],
  ['CalendarNoteView','calendar_load','note_list[]'],
  ['DropItemRender','travel_load_gift','specialtys[]'],
  ['SpecialtyGridRemder','travel_load_gift','specialtys[]'],
  ['GuideTaskListItem','task_load','tasks[]'],
  ['WishingPoolItem','wishingpool_load','items[]'],
  ['CookingThemeItem','cooking_load_cooking','task_list[]'],
  ['MuseumListItem','museum_load','museum_list[]'],
  ['PartyCakeTaskItem','partycake_load','task_list[]'],
  ['MuseumDayHistoryListItem','museumday_load','list[]'],
  ['TumblerListItem','furniture_load_tumbler','tumbler_list[]'],
  ['CompostListItem','furniture_load_compost','compost_list[]'],
  ['PocketListItem','furniture_load_pocket','list[]'],
  ['FurniturePaperListItem','album_load','pictures[]'],
  ['GiftSelectItem','item_load_select_gift','items[]'],
  ['FlowerDecorationRender','flowerpotData','list[]'],
  ['GreetCardBgSelect','greetcard_load','card_info[]'],
  ['SpringCardBgSelect','springcard_load','card_info[]'],
];
/* load our mock */
global.window=global;
const warns=[];
global.core={ SocketManage:{prototype:{send(){}},getInstance:()=>({send:()=>{}})}, Socket:{prototype:{}}, ServiceDispatcher:{getInstance:()=>({hasEventListener:()=>false,dispatchEvent:()=>{}})}, Event:function(){}, Log:{print(){},warning(x){warns.push(x);},error(){}}, Time:{getServerTime:()=>1}, String:{isNullOrEmpty:()=>false,format:s=>s}, ModelManage:{getInstance:()=>({getModel:()=>({})})} };
global.Utils={ convertArray:(x)=>Array.isArray(x)?x:[], formatPathImage:()=>'', parseHTML:x=>x };
global.egret={ setTimeout:()=>0, clearTimeout(){}, Capabilities:{runtimeType:'WEB'} };
global.RES={ getRes:()=>null, hasRes:()=>true };
global.ProtocolList={protocolList:{}}; global.ALISDK={};
global.Tabikaeru={DataManager:{instance:()=>({})}};
eval(fs.readFileSync(BASE+'/new/semantic.js','utf8'));
eval(fs.readFileSync(BASE+'/new/defaults.js','utf8'));
eval(fs.readFileSync(BASE+'/new/rules.js','utf8'));
eval(fs.readFileSync(BASE+'/new/mock.js','utf8'));
eval(fs.readFileSync(BASE+'/new/iap.js','utf8'));
eval(fs.readFileSync(BASE+'/new/mail.js','utf8'));
const S=window.MOCK_SEMANTIC, M=window.MockServer;
function payload(proto, path){
  let v = (typeof S[proto]==='function') ? S[proto]({}) : (S[proto]!==undefined ? S[proto] : M.handlers[proto] && M.handlers[proto]({}));
  for (const seg of path.split('.')){
    if (v==null) return undefined;
    if (seg.endsWith('[]')) { const k=seg.slice(0,-2); v = k ? (v[k]||[])[0] : (Array.isArray(v)?v[0]:undefined); }
    else v = v[seg];
  }
  return v;
}
console.log('=== RENDERER vs SERVER PAYLOAD AUDIT ===');
for (const [cls, proto, path] of MAP){
  const body=classBody(cls);
  const reads=body?dataReads(body):[];
  const item=payload(proto,path);
  const keys=item&&typeof item==='object'?Object.keys(item):[];
  const missing=reads.filter(r=>{
    if (r==='<data itself>') return false;
    const top=r.split('.')[0];
    if (item==null) return true;
    return item[top]===undefined;
  });
  console.log('');
  console.log('--- '+cls+'  <-  '+proto+'.'+path);
  console.log('    our item keys : '+(keys.length?keys.join(', '):'<none>'));
  console.log('    renderer reads: '+(reads.length?reads.join(', '):'<none extracted>'));
  console.log('    MISSING       : '+(missing.length?missing.join(', '):'none'));
}
