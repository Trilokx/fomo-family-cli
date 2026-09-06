import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {mkdir,open,readFile,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {Adapter} from './adapter.js';
import {stateDir,atomicJson} from './store.js';
import {fail,FomoError} from './contracts.js';

export async function daemon(){
  await mkdir(stateDir,{recursive:true,mode:0o700});
  const lockPath=join(stateDir,'runtime.lock');
  let lock;
  try{lock=await open(lockPath,'wx',0o600);}catch{
    try{const pid=Number(await readFile(lockPath,'utf8'));if(!Number.isInteger(pid)||pid<=0)throw Error();process.kill(pid,0);return;}catch{}
    await unlink(lockPath).catch(()=>{});lock=await open(lockPath,'wx',0o600);
  }
  await lock.writeFile(String(process.pid));await lock.close();
  const adapter=new Adapter();const token=randomBytes(32).toString('hex');
  let pending=0;let tail=Promise.resolve();let closing=false;
  const server=createServer(async(req,res)=>{
    res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
    const send=(code:number,payload:unknown)=>{res.writeHead(code);res.end(JSON.stringify(payload));};
    if(req.headers.origin||req.headers.authorization!==`Bearer ${token}`){send(403,{ok:false,error:{code:'unauthorized'}});return;}
    if(req.method!=='POST'||!['/call','/control'].includes(req.url??'')){send(404,{ok:false});return;}
    if(pending>=8||closing){send(429,{ok:false,error:{code:'queue_full'}});return;}
    let body='';
    try{for await(const chunk of req){body+=chunk;if(body.length>16000)throw new FomoError('request_too_large','Request exceeds 16 KB');}}
    catch(e){send(400,fail('request',e));return;}
    let payload:any;try{payload=JSON.parse(body);}catch{send(400,{ok:false,error:{code:'invalid_json'}});return;}
    pending++;
    const work=tail.then(async()=>{
      if(req.url==='/call')return adapter.execute(payload);
      if(payload.action==='login'){
        await adapter.login();return {ok:true,op:'login',data:{manualLoginOpen:true,instructions:'Log in to Fomo in this normal Chrome window, close that window, then run fomo start.'}};
      }
      if(payload.action==='open'&&typeof payload.headed==='boolean'){
        if(payload.headed)await adapter.close();
        await adapter.launch(payload.headed);return adapter.execute({op:'status'});
      }
      if(payload.action==='stop'){
        closing=true;await adapter.close();setTimeout(()=>void shutdown(),50);return {ok:true,op:'stop'};
      }
      throw new FomoError('invalid_control','Unknown runtime control');
    });
    tail=work.then(()=>{},()=>{});
    try{send(200,await work);}catch(e){send(200,fail('runtime',e));}finally{pending--;}
  });
  server.requestTimeout=10000;server.headersTimeout=5000;
  const shutdown=async()=>{closing=true;await adapter.close().catch(()=>{});server.close();await unlink(join(stateDir,'runtime.json')).catch(()=>{});await unlink(lockPath).catch(()=>{});};
  process.once('SIGTERM',()=>void shutdown());process.once('SIGINT',()=>void shutdown());
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();if(!address||typeof address==='string')throw Error('No port');
  await atomicJson(join(stateDir,'runtime.json'),{port:address.port,token,pid:process.pid,version:'0.2.0-beta.1'});
}
