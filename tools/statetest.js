const fs=require('fs');const BASE='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw';
const listeners=Object.create(null); const dispatched=[];
global.window=global;
global.core={ SocketManage:{prototype:{send(){}},getInstance:()=>({send:()=>{}})}, Socket:{prototype:{}},
  ServiceDispatcher:{getInstance:()=>({hasEventListener:n=>!!listeners[n],dispatchEvent:e=>{dispatched.push(e.type);(listeners[e.type]||[]).forEach(f=>f(e.data,e.params));}})},
  Event:function(t,d,p){this.type=t;this.data=d;this.params=p;}, Log:{print(){},warning(){},error(){}} };
global.ProtocolList={protocolList:{}}; global.ALISDK={}; global.egret={setTimeout:(f,t)=>setTimeout(f,t||0)};
function mk(n){ const A=function(fn){this.fn=fn;}; A.prototype.apply=function(){return this.fn.apply(null,Array.prototype.slice.call(arguments,0,n));}; return A; }
global.Action0=mk(0);global.Action1=mk(1);global.Action2=mk(2);global.Action3=mk(3);
eval(fs.readFileSync(BASE+'/new/semantic.js','utf8'));
eval(fs.readFileSync(BASE+'/new/rules.js','utf8'));
eval(fs.readFileSync(BASE+'/new/mock.js','utf8'));
const M=window.MockServer, S=window.MOCK_SEMANTIC, ST=window.MOCK_STATE;
console.log('handlers:',Object.keys(M.handlers).length,'| semantic:',Object.keys(S).length);
console.log('start: clover',ST.clover,'bag',JSON.stringify(ST.bag),'desk',JSON.stringify(ST.desk));
console.log('shop_info list len:', (M.handle('item_load_shop_info',{})||{}).list.length);
console.log('buy shop_id 0 (item0, price 10):', JSON.stringify(M.handle('item_buy',{shop_id:0})));
console.log('after buy: clover',ST.clover,'bag',JSON.stringify(ST.bag));
console.log('put desk item 0:', JSON.stringify(M.handle('item_putin_desk',{pos:1,item_id:0})));
console.log('after putin: bag',JSON.stringify(ST.bag),'desk',JSON.stringify(ST.desk));
console.log('lottery_open:', JSON.stringify(M.handle('lottery_open',{})));
console.log('travel_load_note:', JSON.stringify(M.handle('travel_load_note',{})).slice(0,150));
setTimeout(()=>{ console.log('pushes dispatched:', dispatched.join(' ')); },200);
