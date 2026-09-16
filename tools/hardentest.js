global.window=global;
/* singleton, like the real DataManager */
var DM = {
  ItemDB:{ get:()=>undefined }, ShopDataDB:{ get:()=>undefined }, FurnitureDB:{ get:()=>undefined },
  FurnitureShopDB:{ get:()=>undefined }, FlowerData:{ get:()=>undefined }, rechargeDB:{ get:()=>undefined }
};
global.Tabikaeru={ DataManager:{ instance:()=>DM } };
eval(require('fs').readFileSync('/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw/new/harden.js','utf8'));
function probe(label, fn){ try { var v=fn(); console.log("  OK   "+label+" -> "+JSON.stringify(v).slice(0,80)); } catch(e){ console.log("  FAIL "+label+" -> "+e.message); } }
console.log("=== harden (singleton) ===");
probe("ItemDB.get(999).img.index", function(){ return DM.ItemDB.get(999).img.index; });
probe("ItemDB.get(999).price.toString()", function(){ return DM.ItemDB.get(999).price.toString(); });
probe("ShopDataDB.get(999).name", function(){ return DM.ShopDataDB.get(999).name; });
probe("FurnitureDB.get(999).res.length", function(){ return DM.FurnitureDB.get(999).res.length; });
probe("FlowerData.get(999).img.src", function(){ return DM.FlowerData.get(999).img.src; });
probe("rechargeDB.get(999).count", function(){ return DM.rechargeDB.get(999).count; });
/* real values still pass through */
DM.ItemDB.get = function(k){ return k===1 ? {id:1,name:"real",img:{index:"x",src:"y"},price:5,type:0} : undefined; };
console.log("=== harden keeps real values ===");
probe("ItemDB.get(1).name", function(){ return DM.ItemDB.get(1).name; });
