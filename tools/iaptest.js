const fs=require('fs');const BASE='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw';
const listeners=Object.create(null);const dispatched=[];
global.window=global;
global.core={SocketManage:{prototype:{send(){}},getInstance:()=>({send:()=>{}})},Socket:{prototype:{}},ServiceDispatcher:{getInstance:()=>({hasEventListener:n=>!!listeners[n],dispatchEvent:e=>{dispatched.push(e.type);(listeners[e.type]||[]).forEach(f=>f(e.data));}})},Event:function(t,d,p){this.type=t;this.data=d;this.params=p;},Log:{print(){},warning(){},error(){}}};
global.ProtocolList={protocolList:{}};global.ALISDK={};global.egret={setTimeout:(f,t)=>setTimeout(f,t||0)};
function WeatherModel(){this.data={season:0,hours_type:0,weather:0};}
WeatherModel.prototype.getSeasonKey=function(){return this.data.season+""+this.data.hours_type;};
global.WeatherModel=WeatherModel; global.MessageModel=function(){}; global.MessageModel.prototype={};
/* client's RechargeModel stub with the ORIGINAL pay (goes to native IAP) */
global.RechargeModel=function(){};
global.RechargeModel.prototype.pay=function(id){ global.__nativePaid = id; };
['clover_update','recharge_update_num'].forEach(n=>listeners[n]=[function(){}]);
eval(fs.readFileSync(BASE+'/new/semantic.js','utf8'));
eval(fs.readFileSync(BASE+'/new/defaults.js','utf8'));
eval(fs.readFileSync(BASE+'/new/rules.js','utf8'));
eval(fs.readFileSync(BASE+'/new/mock.js','utf8'));
const ST=window.MOCK_STATE, M=window.MockServer;
console.log('clover before:', ST.clover);
eval(fs.readFileSync(BASE+'/new/iap.js','utf8'));
const rm=new RechargeModel();
rm.pay(1);   // pack 1 => 400 clover
console.log('after pay(1): clover =', ST.clover, '| native IAP called?', global.__nativePaid);
console.log('recharge_load      :', JSON.stringify(M.handle('recharge_load',{})));
console.log('recharge_update_num:', JSON.stringify(M.handle('recharge_update_num',{})));
rm.pay(3);   // pack 3 => 1800
console.log('after pay(3): clover =', ST.clover);
console.log('dispatched:', dispatched.join(' '));
