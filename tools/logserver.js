const http = require('http');
const fs = require('fs');
const OUT = '/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw/logs/game.log';
const srv = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', () => {
    try { fs.appendFileSync(OUT, new Date().toISOString() + ' ' + req.url + ' ' + body + '\n'); } catch (e) {}
    res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Content-Type': 'text/plain' });
    res.end('ok');
  });
});
srv.on('error', e => { console.error('logserver error', e && e.message); process.exit(1); });
srv.listen(8088, '127.0.0.1', () => console.log('lxqw log server listening on 127.0.0.1:8088 -> ' + OUT));
