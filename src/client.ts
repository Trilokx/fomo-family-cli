import {readFile,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {stateDir} from './store.js';
import {FomoError,CallSchema,type Result} from './contracts.js';

async function request(path:string,payload:unknown):Promise<Result>{
  const state=JSON.parse(await readFile(join(stateDir,'runtime.json'),'utf8'));
  if(!Number.isInteger(state.port)||state.port<1||state.port>65535||!/^[a-f0-9]{64}$/.test(state.token))throw new FomoError('invalid_runtime','Invalid runtime state');
  const response=await fetch(`http://127.0.0.1:${state.port}${path}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${state.token}`},body:JSON.stringify(payload),signal:AbortSignal.timeout(195000)});
  return response.json() as Promise<Result>;
}
export async function ensureService(){
  try{await request('/call',{op:'status'});return;}catch{}
  await mkdir(stateDir,{recursive:true,mode:0o700});
  const child=spawn(process.execPath,[fileURLToPath(new URL('../bin/fomo.mjs',import.meta.url)),'daemon'],{detached:true,stdio:'ignore',windowsHide:true,env:process.env});child.unref();
  for(let i=0;i<40;i++){
    await new Promise(r=>setTimeout(r,250));
    try{await request('/call',{op:'status'});return;}catch{}
  }
  throw new FomoError('runtime_start_failed','Runtime did not start. Check fomo doctor or run fomo daemon in a terminal.');
}
export async function control(action:'open'|'stop'|'login',headed=false){await ensureService();return request('/control',{action,headed});}
export async function call(raw:unknown){
  const parsed=CallSchema.parse(raw);await ensureService();
  if(!['status','capabilities','evidence'].includes(parsed.op)){
    const status=await request('/call',{op:'status'});
    if(!status.data?.browserOpen){const opened=await control('open');if(!opened.ok)return opened;}
  }
  return request('/call',parsed);
}
