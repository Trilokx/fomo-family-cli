import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CallSchema,tokenUrl,tokenIdentity,safeUrl} from '../dist/contracts.js';
import {number,parseHolder,parseToken,parseLeader,parseActivity,parseThesis,bounded} from '../dist/parse.js';

test('token routes reject external URLs, queries and path traversal',()=>{
  assert.equal(tokenUrl('solana:AbC123'),'https://fomo.family/tokens/solana/AbC123');
  assert.equal(tokenIdentity('robinhood:0xABCD').id,'robinhood:0xabcd');
  for(const bad of ['https://evil.test/tokens/solana/AbC','https://fomo.family/profile/a','solana:abc?x=y','solana:../../profile/a','https://u:p@fomo.family/tokens/solana/abc'])assert.throws(()=>tokenUrl(bad));
});
test('contracts enforce budgets and reject unsupported operations',()=>{
  for(const bad of [{op:'buy'},{op:'tokens',limit:101},{op:'scan',limit:6},{op:'alerts',filters:{minMarketCapUsd:20,maxMarketCapUsd:10}},{op:'evidence',id:'../../secret'},{op:'tokens',unexpected:true}])assert.equal(CallSchema.safeParse(bad).success,false);
  assert.equal(CallSchema.parse({op:'tokens'}).limit,20);
});
test('financial parsing does not turn unknown or tiny-price notation into zero',()=>{
  assert.equal(number('$21.3M'),21300000);assert.equal(number('$1,234.56'),1234.56);
  assert.equal(number('--'),null);assert.equal(number('$0.0₍7₎9993'),null);assert.equal(number('$0'),0);
});
test('holder quantities, PnL sign and average hold are separate',()=>{
  const lines=['Binkieee','3d 21h avg. hold','$21,450.35','13.1M P','-','$12,739.79','▼','37.26%','$2.5M MC','$0.00259','59','clear PvP runner'];
  const row=parseHolder({text:lines.join('\n'),lines});assert.equal(row.positionUsd,21450.35);assert.equal(row.pnlUsd,-12739.79);assert.equal(row.entryMarketCapUsd,2500000);assert.equal(row.averageHoldDisplay,'3d 21h avg. hold');assert.equal(row.thesis,'clear PvP runner');
});
test('tokens retain chain identity and signed change',()=>{
  const lines=['PONS','$0.907','$906.6M MC','▼','18.05%'];const row=parseToken({href:'/tokens/robinhood/0xABCD',text:lines.join('\n'),lines},1);
  assert.equal(row.marketCapUsd,906600000);assert.equal(row.priceUsd,.907);assert.equal(row.changePct,-18.05);assert.equal(row.id,'robinhood:0xabcd');
});
test('leaderboard PnL and trader identity parse independently of rank markup',()=>{
  const lines=['4.','AJC','@AvgJoesCrypto','+','$5,676,695.15','37+'];const row=parseLeader({href:'/profile/AvgJoesCrypto',text:lines.join('\n'),lines},4);assert.equal(row.pnlUsd,5676695.15);assert.equal(row.handle,'AvgJoesCrypto');
});
test('PnL alerts are not buys and weak event identities are explicit',()=>{
  const row=parseActivity({text:'ether_monk is up + $122,114.27 19m UMIA',lines:[],href:'/tokens/base/0x123'});assert.equal(row.kind,'pnl');assert.equal(row.identityQuality,'snapshot_only');
});
test('output budgets truncate rows explicitly and preserve evidence',()=>{
  const result=bounded({ok:true,evidenceId:'a'.repeat(32),data:{items:Array.from({length:100},()=>({text:'a'.repeat(1000)}))}},4000);
  assert.ok(JSON.stringify(result).length<=4000);assert.equal(result.meta.outputTruncated,true);assert.ok(result.meta.outputRowsOmitted>0);assert.equal(result.evidenceId,'a'.repeat(32));
});
test('external wallet notice does not shift amounts and absent thesis is null',()=>{
 const lines=['Trader','1d avg. hold','Received from external wallet','$1,000','2K TOKEN','+','$200','▲','25%','$4M MC','$0.5','—'];
 const row=parseHolder({text:lines.join('\n'),lines});assert.equal(row.positionUsd,1000);assert.equal(row.pnlUsd,200);assert.equal(row.quantityDisplay,'2K TOKEN');assert.equal(row.thesis,null);assert.equal(row.externalWalletTransfer,true);
});
test('thesis fingerprints survive price and age changes but detect edited text',()=>{
 const lines=['0xBohr','Thesis','25m','$123,000','(','▲','20%',')','Expect corrections','4'];
 const first=parseThesis({text:lines.join('\n'),lines});
 const updated=[...lines];updated[2]='1h';updated[3]='$122,000';
 assert.equal(first.id,parseThesis({text:updated.join('\n'),lines:updated}).id);
 updated[8]='Changed thesis';assert.notEqual(first.id,parseThesis({text:updated.join('\n'),lines:updated}).id);
 assert.equal(first.positionDisplay,'$123,000');assert.equal(first.thesis,'Expect corrections');
});
test('native filters and mutations have typed bounded contracts',()=>{
 assert.equal(CallSchema.parse({op:'theses',token:'solana:abc',minSizeUsd:100000}).minSizeUsd,100000);
 assert.equal(CallSchema.safeParse({op:'watchlist',action:'buy',token:'solana:abc'}).success,false);
 assert.equal(CallSchema.safeParse({op:'workspace',action:'delete-account'}).success,false);
 assert.equal(CallSchema.safeParse({op:'theses',token:'solana:abc',scrolls:999}).success,false);
});
test('OAuth query parameters and profile identifiers never appear in status URLs',()=>{
  assert.equal(safeUrl('https://accounts.google.com/signin?state=secret&email=private'),'https://accounts.google.com');
  assert.equal(safeUrl('https://fomo.family/profile/trlx?secret=yes'),'https://fomo.family/profile/trlx');
});
