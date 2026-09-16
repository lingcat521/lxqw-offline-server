/* lxqw dev server: serves mock layers + persists save state */
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = '/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw/new';
const LOG  = '/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw/logs/devserver.log';
const SAVE = '/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw/save/state.json';
const SHOTS = '/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw/screenshots';
const GMQ   = '/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw/logs/gm.queue.json';
try { fs.mkdirSync(SHOTS, { recursive: true }); } catch (e) {}
try { fs.mkdirSync(path.dirname(SAVE), { recursive: true }); } catch (e) {}
function log(s){ try { fs.appendFileSync(LOG, new Date().toISOString()+' '+s+'\n'); } catch(e){} }
const srv = http.createServer((req, res) => {
  const u = (req.url || '/').split('?')[0];
  if (u === '/save' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 4e6) req.destroy(); });
    req.on('end', () => {
      const tmp = SAVE + '.tmp';
      try { fs.writeFileSync(tmp, body); fs.renameSync(tmp, SAVE); log('SAVE '+body.length+'B'); } catch(e){ log('SAVE-FAIL '+e.message); }
      res.writeHead(200, {'Access-Control-Allow-Origin':'*','Content-Type':'text/plain'}); res.end('ok');
    });
    return;
  }
  /* 相机保存: the WebView posts a data: URL here and the file lands in lxqw/screenshots */
  if (u === '/shot' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 12e6) req.destroy(); });
    req.on('end', () => {
      let ok = false, name = '';
      try {
        const b64 = String(body).replace(/^data:image\/[a-z]+;base64,/, '').trim();
        const buf = Buffer.from(b64, 'base64');
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        name = 'lxqw_' + stamp + '.jpg';
        /* the player has to be able to SEE the picture: write it into the phone's
           Pictures folder (visible in the gallery) and keep a copy in the workspace */
        const dirs = ['/storage/emulated/0/Pictures', SHOTS];
        const written = [];
        for (const dir of dirs) {
          try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, name), buf); written.push(dir); }
          catch (e) { log('SHOT-DIR-FAIL ' + dir + ' ' + e.message); }
        }
        ok = buf.length > 100 && written.length > 0;
        log('SHOT ' + name + ' ' + buf.length + 'B -> ' + written.join(', '));
      } catch (e) { log('SHOT-FAIL ' + e.message); }
      res.writeHead(200, {'Access-Control-Allow-Origin':'*','Content-Type':'text/plain'});
      res.end(ok ? ('saved ' + name) : 'failed');
    });
    return;
  }
  /* ---- 调试/GM 通道 ----------------------------------------------------------
     POST /gm   body: {"cmd":"clover","args":[9999]}  或纯文本 "clover 9999"
     GET  /gm   取走并清空命令队列(new/gm.js 每 3 秒轮询一次)
     用法: curl -s -X POST -d 'clover 9999' http://127.0.0.1:8089/gm            */
  if (u === '/gm') {
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Content-Type': 'application/json' };
    if (req.method === 'POST') {
      let body = '';
      req.on('data', c => { body += c; if (body.length > 1e5) req.destroy(); });
      req.on('end', () => {
        let cmd = null;
        const t = String(body).trim();
        try { const j = JSON.parse(t); cmd = { cmd: String(j.cmd || j.c || ''), args: Array.isArray(j.args) ? j.args : (j.arg !== undefined ? [j.arg] : []) }; }
        catch (e) { const parts = t.split(/\s+/).filter(Boolean); if (parts.length) cmd = { cmd: parts[0], args: parts.slice(1) }; }
        if (cmd && cmd.cmd) {
          const q = (() => { try { return JSON.parse(fs.readFileSync(GMQ, 'utf8')); } catch (e) { return []; } })();
          q.push(cmd);
          try { fs.writeFileSync(GMQ, JSON.stringify(q)); } catch (e) {}
          log('GM-QUEUE + ' + JSON.stringify(cmd) + ' (队列 ' + q.length + ')');
          res.writeHead(200, cors); res.end(JSON.stringify({ ok: true, queued: q.length, cmd: cmd }));
        } else { res.writeHead(400, cors); res.end(JSON.stringify({ ok: false, error: 'bad command' })); }
      });
      return;
    }
    let q = [];
    try { q = JSON.parse(fs.readFileSync(GMQ, 'utf8')); fs.writeFileSync(GMQ, '[]'); } catch (e) {}
    if (q.length) log('GM-TAKE ' + q.length + ' 条');
    res.writeHead(200, cors); res.end(JSON.stringify(q));
    return;
  }
  if (u === '/load') {
    fs.readFile(SAVE, (e, d) => {
      log('LOAD ' + (e ? 'MISS' : 'HIT '+d.length));
      res.writeHead(200, {'Access-Control-Allow-Origin':'*','Content-Type':'application/javascript','Cache-Control':'no-store'});
      res.end(e ? '/* no save */' : d);
    });
    return;
  }
  /* 地图/静态页: 这些必须是 text/html, 不能像 .js 那样发 application/javascript */
  if (/\.html?$/i.test(u)) {
    fs.readFile(path.join(ROOT, u), (e, d2) => {
      log(req.method + ' ' + req.url + ' ' + (e ? 'MISS' : 'HIT ' + d2.length));
      if (e) { res.writeHead(404, { 'Access-Control-Allow-Origin': '*' }); res.end('not found'); return; }
      res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(d2);
    });
    return;
  }
  const p = path.join(ROOT, u === '/' ? '/mock.js' : u);
  fs.readFile(p, (e, d) => {
    log(req.method+' '+req.url+' '+(e?'MISS':'HIT '+d.length));
    if (e) { res.writeHead(404, {'Access-Control-Allow-Origin':'*'}); res.end('not found'); return; }
    res.writeHead(200, {'Access-Control-Allow-Origin':'*','Content-Type':'application/javascript','Cache-Control':'no-store'});
    res.end(d);
  });
});
srv.listen(8089, '127.0.0.1', () => console.log('lxqw dev server on 127.0.0.1:8089 (static + /save + /load)'));
