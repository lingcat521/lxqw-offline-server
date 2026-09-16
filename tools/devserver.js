const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw/new';
const LOG='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw/logs/devserver.log';
http.createServer((req,res)=>{
  const u=(req.url||'/').split('?')[0];
  const p=path.join(ROOT,u==='/'?'/mock.js':u);
  fs.readFile(p,(e,d)=>{
    try{fs.appendFileSync(LOG,new Date().toISOString()+' '+req.method+' '+req.url+' '+(e?'MISS':'HIT '+d.length)+'\n');}catch(x){}
    if(e){res.writeHead(404,{'Access-Control-Allow-Origin':'*'});res.end('not found');return;}
    res.writeHead(200,{'Access-Control-Allow-Origin':'*','Content-Type':'application/javascript','Cache-Control':'no-store'});
    res.end(d);
  });
}).listen(8089,'127.0.0.1',()=>console.log('lxqw dev server on 127.0.0.1:8089 serving '+ROOT));
