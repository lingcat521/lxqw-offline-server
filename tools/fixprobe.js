const fs=require('fs');
const p='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw/tools/probe2.js';
let s=fs.readFileSync(p,'utf8');
const bad="if(x&&typeof x==='object'&&x[PATH]!==undefined&&CUR) CUR.arrays.add(x[PATH]);";
const good="try{ if(x&&(typeof x==='object'||typeof x==='function')&&x[PATH]!==undefined&&CUR) CUR.arrays.add(x[PATH]); }catch(e){}";
if(s.indexOf(bad)>=0){ s=s.replace(bad,good); fs.writeFileSync(p,s); console.log('probe2 patched'); } else console.log('probe2 pattern missing');
