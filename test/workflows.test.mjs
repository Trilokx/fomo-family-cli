import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {CallSchema,capabilityMap,schemas} from '../dist/contracts.js';
import {parseActivity,bounded} from '../dist/parse.js';

test('discovery workflow has explicit deterministic budgets and native filter defaults',()=>{
 const c=CallSchema.parse({op:'daily'});assert.equal(c.limit,3);assert.equal(c.rows,5);assert.equal(c.minSizeUsd,10000);assert.equal(c.sinceLast,true);
 for(const args of [{op:'daily',limit:6},{op:'daily',rows:999},{op:'feed',types:['unknown']},{op:'position',token:'solana:abc',trader:''}])assert.equal(CallSchema.safeParse(args).success,false);
 assert.deepEqual(Object.keys(capabilityMap.operations).sort(),Object.keys(schemas).sort());
});
test('feed nested position links survive extraction; deposits are not buys',()=>{
 const row=parseActivity({text:'Trader\nSell\n$100',lines:[],links:['/tokens/base/0x123?tradeId=position-1']});assert.equal(row.id,'position-1');assert.equal(row.identityQuality,'position_reference');
 assert.equal(parseActivity({text:'Trader\nDeposit\n$100',lines:[]}).kind,'deposit');
});
test('output trimming reconciles returned-row counts in nested sections',()=>{
 const r=bounded({ok:true,data:{sections:{theses:{returnedRows:10,items:Array.from({length:10},()=>({text:'x'.repeat(500)}))}}}},1800);
 assert.ok(JSON.stringify(r).length<=1800);assert.equal(r.data.sections.theses.returnedRows,r.data.sections.theses.items.length);assert.ok(r.meta.outputRowsOmitted>0);
});
test('CLI emits portable MCP paths and rejects ignored filter arguments before starting browser',()=>{
 const cfg=spawnSync(process.execPath,['bin/fomo.mjs','mcp-config'],{encoding:'utf8'});assert.equal(cfg.status,0);const s=JSON.parse(cfg.stdout).mcpServers.fomo;assert.equal(s.command,process.execPath);assert.equal(s.args.at(-1),'mcp');
 const bad=spawnSync(process.execPath,['bin/fomo.mjs','theses','solana:abc','--min-size-usd','1000','--min-portfolio-usd','1000000'],{encoding:'utf8'});assert.equal(bad.status,1);assert.equal(JSON.parse(bad.stdout).error.code,'invalid_arguments');
});
test('delta persists observed content, detects edits, and isolates filter scopes',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'fomo-delta-'));
 try{
 const code="const {newObservations}=await import('./dist/store.js');const a=await newObservations('token:10k',[{id:'a'}]);const b=await newObservations('token:10k',[{id:'a'},{id:'edited'}]);const c=await newObservations('token:100k',[{id:'a'}]);console.log(JSON.stringify([a.items,b.items,c.items]));";
 const r=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8',env:{...process.env,FOMO_STATE_DIR:dir}});assert.equal(r.status,0);assert.deepEqual(JSON.parse(r.stdout),[[{id:'a'}],[{id:'edited'}],[{id:'a'}]]);
 }finally{await rm(dir,{recursive:true,force:true});}
});
