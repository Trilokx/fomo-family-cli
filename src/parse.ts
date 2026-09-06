import {createHash} from 'node:crypto';
import {tokenIdentity, type Row} from './contracts.js';

export const hash=(s:string)=>createHash('sha256').update(s).digest('hex').slice(0,32);
export function number(s:string|undefined):number|null {
  if(!s || /[₍₎]|\$0\.0\s/.test(s))return null;
  const match=s.replace(/,/g,'').match(/^\s*([+$−-]?\s*\$?\s*[−-]?\s*\d+(?:\.\d+)?)\s*([KMBT])?(?:\s*(?:MC|Vol|%))?\s*$/i);
  if(!match)return null;
  const n=Number(match[1].replace(/[$\s+]/g,'').replace('−','-'))*({K:1e3,M:1e6,B:1e9,T:1e12}[match[2]?.toUpperCase()??'']??1);
  return Number.isFinite(n)?n:null;
}
export type RawRow = {text:string;lines:string[];href?:string|null;links?:string[]};
export function parseToken(row:RawRow,rank:number):Row {
  const identity=tokenIdentity(row.href!);const lines=row.lines.map(x=>x.trim()).filter(Boolean);
  const mc=lines.findIndex(x=>x==='MC');
  const inlineMc=lines.find(x=>/\$.*\bMC$/.test(x));
  const mcText=inlineMc??(mc>0?lines[mc-1]:undefined);
  const price=lines.find(x=>/^\$[\d.,₍₎]+$/.test(x)&&x!==mcText);
  const pctIndex=lines.findIndex(x=>/^\d[\d.,]*%$/.test(x));
  const pct=pctIndex>=0?number(lines[pctIndex]):null;
  return {...identity,rank,symbol:lines[0],marketCapUsd:number(mcText),priceUsd:number(price),changePct:pct===null?null:pct*(lines[pctIndex-1]==='▼'?-1:1),display:row.text.slice(0,500)};
}
export function parseLeader(row:RawRow,rank:number):Row {
  const lines=row.lines.filter(Boolean);const handle=new URL(row.href!,'https://fomo.family').pathname.split('/').pop();
  const dollars=lines.find(x=>/^\$/.test(x));
  const amount=number(dollars);return {id:`trader:${handle}`,handle,rank,pnlUsd:amount===null?null:amount*(lines.includes('-')||lines.includes('−')?-1:1),url:new URL(row.href!,'https://fomo.family').href,display:row.text.slice(0,500)};
}
export function parseHolder(row:RawRow):Row {
  const external=row.lines.includes('Received from external wallet');
  const lines=row.lines.filter(x=>x!=='Received from external wallet');const hold=lines.findIndex(x=>/avg\. hold/.test(x));const pos=number(lines[hold+1]);
  const entry=lines.find(x=>/\$.*\bMC$/.test(x));const p=hold+3;
  const sign=/[-−]/.test(lines[p]??'')?-1:1;
  const pnl=number(lines[p+1]);
  const entryIndex=lines.findIndex(x=>x===entry);const tail=lines.slice(entryIndex+2).filter(x=>x!=='—'&&!/^\d+$/.test(x));
  return {id:hash(lines[0]),trader:lines[0],externalWalletTransfer:external,averageHoldDisplay:lines[hold]??null,positionUsd:pos,quantityDisplay:lines[hold+2]??null,pnlUsd:pnl===null?null:pnl*sign,entryMarketCapUsd:number(entry),thesis:tail.join('\n').slice(0,1600)||null,display:row.text.slice(0,2200)};
}
export function parseThesis(row:RawRow):Row {
  const lines=row.lines;const label=lines.indexOf('Thesis');const timeIndex=lines.findIndex((x,i)=>i>label&&/^(?:\d+[smhdw]|now)/.test(x));
  const end=lines.indexOf(')');const pct=lines.findIndex((x,i)=>i>timeIndex&&x.endsWith('%'));
  const start=end>=0?end+1:pct>=0?pct+1:timeIndex+1;
  const body=lines.slice(start);while(body.length&&(/^(?:\d+|\d+ (?:older|newer))$/.test(body.at(-1)!)||body.at(-1)==='Show more'))body.pop();
  const text=body.join('\n');
  return {...parseActivity(row),id:hash(`${lines[0]}:${text}`),identityQuality:'author_content_fingerprint',author:lines[0],ageDisplay:lines[timeIndex]??null,positionDisplay:lines.slice(timeIndex+1,start).find(x=>x.startsWith('$'))??null,closed:lines.includes('Closed'),thesis:text,uiTextMayBeTruncated:text.includes('…'),text:undefined};
}
export function parseActivity(row:RawRow):Row {
  const kind=/\bThesis\b/.test(row.text)?'thesis':/\bis up\b/.test(row.text)?'pnl':/\bSell\b/.test(row.text)?'sell':/\bBuy\b/.test(row.text)?'buy':/\bDeposit\b/.test(row.text)?'deposit':/\bWithdraw\b/.test(row.text)?'withdraw':'unknown';
  const href=row.href??row.links?.find(x=>x.startsWith('/tokens/')&&x.includes('tradeId='));
  const url=href?new URL(href,'https://fomo.family').href:null;
  const eventId=url?new URL(url).searchParams.get('tradeId'):null;
  return {id:eventId??hash(row.text),identityQuality:eventId?'position_reference':'snapshot_only',kind,text:row.text.slice(0,2400),sourceUrl:url,links:row.links?.slice(0,8)??[],textTruncated:row.text.length>2400};
}
export function bounded(result:any,maxChars=14000):any {
  const copy=structuredClone(result);let removed=0;
  copy.meta={...copy.meta,outputRowsOmitted:0,outputTruncated:false};
  while(JSON.stringify(copy).length>maxChars){
    const arrays:any[][]=[];
    const walk=(v:any)=>{if(!v||typeof v!=='object')return;for(const [k,x]of Object.entries(v)){if(Array.isArray(x)&&k==='items'&&x.length)arrays.push(x);else if(x&&typeof x==='object')walk(x);}};
    walk(copy.data);
    const a=arrays.sort((a,b)=>b.length-a.length)[0];
    if(!a){copy.data={omitted:true,reason:'output_budget',evidenceId:copy.evidenceId};break;}
    a.pop();removed++;copy.meta.outputRowsOmitted=removed;copy.meta.outputTruncated=true;
  }
  copy.meta={...copy.meta,outputRowsOmitted:removed,outputTruncated:removed>0||copy.data?.omitted===true};
  const reconcile=(v:any)=>{if(!v||typeof v!=='object')return;if(Array.isArray(v.items)&&typeof v.returnedRows==='number')v.returnedRows=v.items.length;for(const x of Object.values(v))if(x&&typeof x==='object')reconcile(x);};
  reconcile(copy.data);
  return copy;
}
