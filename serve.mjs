import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.jpeg':'image/jpeg'};
const allowed=new Set(['index.html','style.css','game.js','characters.png','venues.png','security-team.png','security-sprites.png','black-shirt-fan.png','black-shirt-throw.png','black-shirt-mosh.png','black-shirt-invasion.png','rank-s.png','rank-a.png','rank-b.png','rank-c.png','rank-d.png','blond-fans.png','animal-planet-idols.png']);

// Development-only response transformation. Neither the static source nor www/ is changed.
// Do not use hostname checks: native Capacitor apps also use localhost.
export function createGameServer({debugUnlock=false}={}) {
  return http.createServer(async(req,res)=>{
    try {
      const n=new URL(req.url,'http://localhost').pathname.replace(/^\//,'')||'index.html';
      if(!allowed.has(n)){res.writeHead(404);res.end('Not found');return;}
      let body=await fs.readFile(path.join(root,n));
      if(debugUnlock && n==='game.js') {
        const source=body.toString('utf8'),marker='const DEBUG_UNLOCK=false;';
        if(source.split(marker).length!==2)throw new Error('Missing or ambiguous release default');
        body=source.replace(marker,"const DEBUG_UNLOCK=new URLSearchParams(location.search).get('unlock')==='animal';");
      }
      res.writeHead(200,{'Content-Type':mime[path.extname(n)]||'application/octet-stream','Cache-Control':'no-store'});
      res.end(body);
    } catch {
      res.writeHead(500);res.end('Local server error');
    }
  });
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2);
  if(args.some(arg=>arg!=='--debug-unlock'))throw new Error('Usage: node serve.mjs [--debug-unlock]');
  const debugUnlock=args.includes('--debug-unlock');
  const port=Number(process.env.PORT||8080),host=process.env.HOST||'127.0.0.1';
  createGameServer({debugUnlock}).listen(port,host,()=>{
    console.log(`Game: http://${host}:${port}/${debugUnlock?'?unlock=animal':''}`);
    if(debugUnlock)console.log('Development only: animal preview enabled for this server; unlock is not saved.');
  });
}
