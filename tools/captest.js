const fs=require('fs');const BASE='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw';
function load(guideStep){
  delete require.cache;
  global.window=global;
  const listeners=Object.create(null);
  global.core={SocketManage:{prototype:{send(){}},getInstance:()=>({send:()=>{}})},Socket:{prototype:{}},
    ServiceDispatcher:{getInstance:()=>({hasEventListener:()=>false,dispatchEvent:()=>{}})},Event:function(){},Log:{print(){},warning(){},error(){}},
    ModelManage:{getInstance:()=>({getModel:()=>({getClientSettings:()=>({guideStep:guideStep})})})}};
  global.Utils={convertArray:x=>Array.isArray(x)?x:[],formatPathImage:()=>''};
  global.egret={setTimeout:()=>0,clearTimeout(){},Capabilities:{runtimeType:'WEB'}};
  global.RES={getRes:()=>null,hasRes:()=>true};
  global.ProtocolList={protocolList:{}};global.ALISDK={};
  global.Tabikaeru={DataManager:{instance:()=>({})}};
  global.UserModel=function(){};
  for (const f of ['semantic','defaults','rules','mock','iap','mail','activities','visitor','guard','diag','harden']) { try{ eval(fs.readFileSync(BASE+'/new/'+f+'.js','utf8')); }catch(e){} }
  const M=window.MockServer;
  M.handle('item_load_items', {});
  return M;
}
console.log("=== dynamic bag capacity (client guideStep) ===");
for (const gs of ['OpenBag','Complete','Named']){
  delete global.window; delete global.MockServer; delete global.MOCK_STATE; delete global.MOCK_SEMANTIC;
  const M=load(gs);
  const r=M.handle('item_load_items',{});
  console.log("  guideStep="+gs.padEnd(9)+" -> bag length "+r.bag.length+"  desk length "+r.desk.length);
}
console.log("=== unreadable state (ModelManage throws) ===");
delete global.window; delete global.MockServer; delete global.MOCK_STATE; delete global.MOCK_SEMANTIC;
global.window=global;
global.core={SocketManage:{prototype:{send(){}},getInstance:()=>({send:()=>{}})},Socket:{prototype:{}},ServiceDispatcher:{getInstance:()=>({hasEventListener:()=>false,dispatchEvent:()=>{}})},Event:function(){},Log:{print(){},warning(){},error(){}},ModelManage:{getInstance:()=>{throw new Error('boom');}}};
global.Utils={convertArray:x=>Array.isArray(x)?x:[]};global.egret={setTimeout:()=>0,clearTimeout(){},Capabilities:{runtimeType:'WEB'}};
global.RES={getRes:()=>null};global.ProtocolList={protocolList:{}};global.ALISDK={};global.Tabikaeru={DataManager:{instance:()=>({})}};global.UserModel=function(){};
for (const f of ['semantic','defaults','rules','mock','iap','mail','activities','visitor','guard','diag','harden']) { try{ eval(fs.readFileSync(BASE+'/new/'+f+'.js','utf8')); }catch(e){} }
const M2=global.MockServer;
console.log("  -> bag length "+M2.handle('item_load_items',{}).bag.length+" (expect 2)");
