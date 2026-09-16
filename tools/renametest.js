const fs=require('fs');const BASE='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw';
const listeners=Object.create(null);
global.window=global;
global.core={ SocketManage:{prototype:{send(){}},getInstance:()=>({send:()=>{}})}, Socket:{prototype:{}},
  ServiceDispatcher:{getInstance:()=>({hasEventListener:n=>!!listeners[n],dispatchEvent:e=>{(listeners[e.type]||[]).forEach(f=>f(e.data,e.params));}})},
  Event:function(t,d,p){this.type=t;this.data=d;this.params=p;}, Log:{print(){},warning(){},error(){}} };
global.ProtocolList={protocolList:{}};
global.ALISDK={}; global.egret={setTimeout:(f,t)=>setTimeout(f,t||0)};
/* faithful Action shims (apply forwards args, exactly like the client) */
function mkAction(n){ const A=function(fn){ this.fn=fn; }; A.prototype.apply=function(){ return this.fn.apply(null, Array.prototype.slice.call(arguments,0,n)); }; return A; }
global.Action0=mkAction(0); global.Action1=mkAction(1); global.Action2=mkAction(2); global.Action3=mkAction(3);
eval(fs.readFileSync(BASE+'/new/semantic.js','utf8'));
eval(fs.readFileSync(BASE+'/new/mock.js','utf8'));
global.ProtocolList.protocolList={};
['client_rename_cost','client_set_name','lottery_open','item_buy'].forEach(n=>{ global.ProtocolList.protocolList[n]=[[],true]; });
const SM=core.SocketManage.prototype;
function call(name, params){
  return new Promise(res=>{
    const cb=new Action2(function(n,r){ res({name, respData:n, sentData:r}); });
    SM.send.apply(SM, [name, cb].concat(params||[]));
    setTimeout(()=>res({name, respData:'<timeout>'}),150);
  });
}
(async()=>{
  console.log('rename cost:', JSON.stringify(await call('client_rename_cost')));
  console.log('set name   :', JSON.stringify(await call('client_set_name', ['笨蛋'])));
  console.log('lottery_open:', JSON.stringify(await call('lottery_open')));
  console.log('item_buy   :', JSON.stringify(await call('item_buy', [0,1])));
})();
