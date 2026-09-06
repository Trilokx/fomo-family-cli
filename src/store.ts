import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {homedir} from 'node:os';
import {FomoError, type Result} from './contracts.js';
import {hash} from './parse.js';

export const stateDir=process.env.FOMO_STATE_DIR??join(process.env.LOCALAPPDATA??join(homedir(),'.local','state'),'trlx-fomo');
export async function atomicJson(path:string,value:unknown){const tmp=`${path}.${randomUUID()}.tmp`;await writeFile(tmp,JSON.stringify(value),{mode:0o600});await rename(tmp,path);}
export async function saveEvidence(result:Result){
  const dir=join(stateDir,'evidence');await mkdir(dir,{recursive:true,mode:0o700});
  const id=randomUUID().replaceAll('-','');await atomicJson(join(dir,`${id}.json`),result);return id;
}
export async function newObservations(scope:string,items:any[]){
 const dir=join(stateDir,'seen');await mkdir(dir,{recursive:true,mode:0o700});const path=join(dir,`${hash(scope)}.json`);
 let seen:Record<string,number>={};try{seen=JSON.parse(await readFile(path,'utf8'));}catch{}
 const now=Date.now();seen=Object.fromEntries(Object.entries(seen).filter(([,t])=>now-t<30*86400000));
 const fresh=items.filter(x=>!seen[x.id]);for(const x of items)seen[x.id]=now;
 await atomicJson(path,Object.fromEntries(Object.entries(seen).sort((a,b)=>b[1]-a[1]).slice(0,10000)));
 return {items:fresh,previouslyObserved:items.length-fresh.length,observedItems:items.length,baseline:'last observed content fingerprints, not an exhaustive event watermark'};
}
export async function evidence(id:string,offset:number,limit:number){
  let saved:Result;try{saved=JSON.parse(await readFile(join(stateDir,'evidence',`${id}.json`),'utf8'));}catch{throw new FomoError('evidence_not_found','No local evidence with this ID');}
  const records:unknown[]=[];
  const walk=(v:any,path:string)=>{if(!v||typeof v!=='object')return;for(const [k,x]of Object.entries(v)){if(k==='items'&&Array.isArray(x))records.push(...x.map(item=>({section:path,item})));else if(x&&typeof x==='object')walk(x,`${path}.${k}`);}};
  walk(saved.data,'data');
  return {sourceMeta:saved.meta,sourceOp:saved.op,items:records.slice(offset,offset+limit),totalStoredRows:records.length,nextOffset:offset+limit<records.length?offset+limit:null,summary:records.length?undefined:saved.data};
}
