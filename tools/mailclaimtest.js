const fs=require('fs');const BASE='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw';
global.window=global;
const listeners=Object.create(null); const dispatched=[];
global.core={SocketManage:{prototype:{send(){}},getInstance:()=>({send:()=>{}})},Socket:{prototype:{}},
  ServiceDispatcher:{getInstance:()=>({hasEventListener:n=>!!listeners[n],dispatchEvent:e=>{dispatched.push(e.type);(listeners[e.type]||[]).forEach(f=>f(e.data));}})},
  Event:function(t,d,p){this.type=t;this.data=d;this.params=p;},Log:{print(){},warning(){},error(){}}};
global.ProtocolList={protocolList:{}};global.ALISDK={};global.egret={setTimeout:(f,t)=>setTimeout(f,t||0)};
function WeatherModel(){this.data={season:0,hours_type:0,weather:0};} WeatherModel.prototype.getSeasonKey=function(){return this.data.season+""+this.data.hours_type;};
global.WeatherModel=WeatherModel;global.MessageModel=function(){};global.MessageModel.prototype={};
['clover_update','item_update_ticket','mail_load'].forEach(n=>listeners[n]=[function(){}]);
for (const f of ['semantic','defaults','rules','mock','iap','mail','activities','visitor','guard','diag','harden']) { try{ eval(fs.readFileSync(BASE+'/new/'+f+'.js','utf8')); }catch(e){} }
const M=window.MockServer,S=window.MOCK_SEMANTIC,ST=window.MOCK_STATE;
const SM=core.SocketManage.prototype;
/* register the protocols the client uses, with their real wants flags */
ProtocolList.protocolList={ mail_load:[[],true], mail_open:[["id"],false], mail_read:[["id"],false], client_set_client:[["client"],false] };
console.log("clover before:", ST.clover);
console.log("mail list len:", (M.handle('mail_load',{})||[]).length);
console.log("--- simulate client claiming mail id 0 (wants=false, no callback) ---");
SM.send('mail_open', null, 0);
console.log("clover after :", ST.clover, "(expect +500)");
console.log("mailTaken    :", JSON.stringify(ST.mailTaken));
console.log("mail list now:", (M.handle('mail_load',{})||[]).length, "(expect 1 fewer)");
console.log("dispatched   :", dispatched.join(' '));
