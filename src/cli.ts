import {parseArgs} from 'node:util';
import {call,control} from './client.js';
import {daemon} from './server.js';
import {mcp} from './mcp.js';
import {capabilityMap,fail,FomoError} from './contracts.js';
import {stateDir} from './store.js';
import {fileURLToPath} from 'node:url';

const help=`FOMO.family CLI 0.2 beta — browser research tools (no model calls)
  fomo login                         Open dedicated browser to sign in
  fomo start                         Start dedicated Chrome browser
  fomo status | stop | capabilities | doctor
  fomo tokens list --view trending --limit 20
  fomo leaderboard list --period 30d --limit 20
  fomo alerts list --min-size-usd 10000 --min-portfolio-usd 1000000
  fomo feed list --limit 10
  fomo token <chain:contract> --sections overview,holders,theses
  fomo theses <chain:contract> --min-size-usd 100000 --since-last
  fomo position <chain:contract> --trader <display-name> --tab theses
  fomo trader <handle> --limit 10
  fomo chart <chain:contract> --timeframe 1h --theses --friends-only
  fomo workspace inspect | split-bottom | split-right | close --panel 0
  fomo watchlist add|remove <chain:contract> --expected-account <handle>
  fomo scan --view trending --limit 3
  fomo daily --limit 3 --min-size-usd 10000 --rows 5
  fomo evidence <id> --offset 0 --limit 10
  fomo call '<JSON>'                  Same typed arguments as MCP
  fomo mcp                           MCP over stdio
  fomo mcp-config                    Generate config for this installation
Options: --panel 0 --scrolls 1 --json (JSON is always the default)
Feed: --types trades,theses (omitted preserves all native category settings)
Trader: --period 24h|7d|30d --positions open|closed
Boolean flags support --no-...; omitted controls preserve state unless documented.
State: FOMO_STATE_DIR; browser: FOMO_BROWSER_CHANNEL (default chrome)
`;
export async function main(argv=process.argv.slice(2)){
  let op='unknown';
  try{
  const {positionals:p,values:v}=parseArgs({args:argv,allowPositionals:true,allowNegative:true,options:{types:{type:'string'},positions:{type:'string'},trader:{type:'string'},tab:{type:'string'},rows:{type:'string'},help:{type:'boolean'},json:{type:'boolean'},view:{type:'string'},period:{type:'string'},limit:{type:'string'},panel:{type:'string'},scrolls:{type:'string'},sections:{type:'string'},offset:{type:'string'},timeframe:{type:'string'},'since-last':{type:'boolean'},'my-swaps':{type:'boolean'},'theses':{type:'boolean'},'friends-only':{type:'boolean'},'expected-account':{type:'string'},'min-size-usd':{type:'string'},'min-portfolio-usd':{type:'string'},'min-market-cap-usd':{type:'string'},'max-market-cap-usd':{type:'string'},'holders-thesis-only':{type:'boolean'},'holders-friends-only':{type:'boolean'}}});
  if(v.help||!p.length){console.log(help);return;}
  op=p[0];let result:any;
    if(op==='daemon'){await daemon();return;}
    if(op==='mcp'){await mcp();return;}
    if(op==='mcp-config'){console.log(JSON.stringify({mcpServers:{fomo:{command:process.execPath,args:[fileURLToPath(new URL('../bin/fomo.mjs',import.meta.url)),'mcp']}}},null,2));return;}
    if(op==='capabilities')result={ok:true,data:capabilityMap};
    else if(op==='doctor')result={ok:true,node:process.version,stateDir,browserChannel:process.env.FOMO_BROWSER_CHANNEL??'chrome',note:'Use login once for this profile; ordinary collection makes zero model calls.'};
    else if(op==='login')result=await control('login');
    else if(op==='start')result=await control('open');
    else if(op==='stop')result=await control('stop');
    else if(op==='call')result=await call(JSON.parse(p[1]??'{}'));
    else{
      const args:Record<string,unknown>={op};
      const flags=v as Record<string,string|boolean|undefined>;
      for(const key of ['limit','panel','scrolls','offset','rows'])if(flags[key]!==undefined)args[key]=Number(flags[key]);
      for(const key of ['view','period'])if(flags[key]!==undefined)args[key]=flags[key];
      if(['token','chart','theses','position'].includes(op))args.token=p[1];
      if(v.types)args.types=v.types.split(',');
      if(v.positions)args.positions=v.positions;
      if(v.trader)args.trader=v.trader;
      if(v.tab)args.tab=v.tab;
      if(op==='workspace')args.action=p[1]??'inspect';
      if(op==='watchlist'){args.action=p[1];args.token=p[2];if(v['expected-account'])args.expectedAccount=v['expected-account'];}
      if(op==='trader')args.handle=p[1];
      if(op==='evidence')args.id=p[1];
      if(v.sections)args.sections=v.sections.split(',');
      if(v['holders-thesis-only']!==undefined)args.holdersThesisOnly=v['holders-thesis-only'];
      if(v['holders-friends-only']!==undefined)args.holdersFriendsOnly=v['holders-friends-only'];
      if(v['since-last']!==undefined)args.sinceLast=v['since-last'];
      if(v.timeframe)args.timeframe=v.timeframe;
      const filters:Record<string,number>={};
      for(const [flag,key]of Object.entries({'min-size-usd':'minSizeUsd','min-portfolio-usd':'minPortfolioUsd','min-market-cap-usd':'minMarketCapUsd','max-market-cap-usd':'maxMarketCapUsd'}))if(flags[flag]!==undefined)filters[key]=Number(flags[flag]);
      if(op!=='alerts'&&Object.keys(filters).some(k=>k!=='minSizeUsd'))throw new FomoError('invalid_arguments','Portfolio and market-cap filters are supported only for alerts');
      if(op==='chart'){
        const overlay:Record<string,unknown>={};
        for(const [flag,key]of Object.entries({'my-swaps':'mySwaps',theses:'theses','friends-only':'friendsOnly'}))if(flags[flag]!==undefined)overlay[key]=flags[flag];
        if(filters.minSizeUsd!==undefined)overlay.minSizeUsd=filters.minSizeUsd;
        if(Object.keys(overlay).length)args.overlays=overlay;
      }else if(['token','theses','position','scan','daily'].includes(op)&&filters.minSizeUsd!==undefined)args.minSizeUsd=filters.minSizeUsd;
      else if(Object.keys(filters).length)args.filters=filters;
      const withValue=['token','chart','theses','position','trader','evidence','workspace'];
      if(p.length>(op==='watchlist'?3:withValue.includes(op)?2:['tokens','leaderboard','alerts','feed'].includes(op)?2:1)||p.length>1&&!withValue.includes(op)&&op!=='watchlist'&&p[1]!=='list')throw new FomoError('invalid_command','Unexpected positional argument');
      result=await call(args);
    }
  console.log(JSON.stringify(result));if(!result.ok)process.exitCode=1;
  }catch(e){console.log(JSON.stringify(fail(op,e)));process.exitCode=1;}
}
