import {call} from '../dist/client.js';
import {writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {stateDir} from '../dist/store.js';
const token='solana:Dz9mQ9NzkBcCsuGPFJ3r1bS4wgqKMHBPiVuniW8Mbonk';
const calls=[
 ...['watchlist','crypto','trending','most-held','graduated','bonding'].map(view=>({op:'tokens',view,limit:3,scrolls:0})),
 ...['24h','7d','30d','all'].map(period=>({op:'leaderboard',period,limit:3,scrolls:0})),
 {op:'feed',limit:3,scrolls:0},
 ...[0,1000,5000,10000,100000].map(minSizeUsd=>({op:'theses',token,minSizeUsd,limit:3,scrolls:0})),
 {op:'token',token,sections:['holders'],holdersFriendsOnly:true,limit:3,scrolls:0},
 {op:'token',token,sections:['swaps'],minSizeUsd:1000,limit:3,scrolls:0},
 {op:'theses',token,minSizeUsd:1000,limit:80,scrolls:3},
];
const receipts=[];
for(const input of calls){
 const result=await call(input);const summary={input,ok:result.ok,error:result.error,evidenceId:result.evidenceId,elapsedMs:result.meta?.elapsedMs,outputChars:JSON.stringify(result).length,coverage:result.data?.sections?.theses?{...result.data.sections.theses,items:undefined}:undefined};
 receipts.push(summary);console.log(JSON.stringify(summary));
}
await mkdir(join(stateDir,'verification'),{recursive:true});await writeFile(join(stateDir,'verification','live-check.json'),JSON.stringify(receipts,null,2));
if(receipts.some(x=>!x.ok))process.exitCode=1;
