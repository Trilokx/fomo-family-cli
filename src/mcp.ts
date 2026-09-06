import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {schemas,fail} from './contracts.js';
import {call} from './client.js';
import {z} from 'zod';

export async function mcp(){
  const server=new McpServer({name:'fomo',version:'0.2.0-beta.1'});
  const descriptions:Record<string,string>={capabilities:'Supported Fomo operations and limits; no browser needed.',status:'Browser and panel status. Missing login is not empty data.',tokens:'Read one Tokens subtab; bounded list with chain/contract IDs.',leaderboard:'Read trader leaderboard for 24h, 7d, 30d or all.',alerts:'Read loaded alerts. Optional filters modify Fomo view preferences and may persist.',feed:'Read loaded Feed posts.',token:'Inspect a token: overview, holders, theses or swaps. Partial UI coverage.',trader:'Read a trader profile and loaded open positions.',chart:'Save current chart screenshot locally; return path and labels. Does not interpret or export OHLCV.',scan:'Discover up to five tokens and inspect overview, holders and theses in one bounded call.',evidence:'Read a page of locally saved evidence by ID.'};
  for(const [op,schema]of Object.entries(schemas)){
    descriptions.position='Read a bounded native trader position dialog from the loaded token thesis list; Thesis or Swaps tab.';
    descriptions.daily='Combine bounded Watchlist, Trending and Most held, select up to five candidates by overlap, inspect Friends holders and filtered delta theses. No model calls or watchlist writes.';
    const {op:_,...shape}=schema.shape;
    server.registerTool(`fomo_${op}`,{description:descriptions[op]??({account:'Read signed-in account identity.',workspace:'Inspect research panels, split bottom/right or close a panel.',watchlist:'Add or remove one token from the signed-in account watchlist; verify persistence after reload.',theses:'Read bounded token theses with native minimum size filter and optional sinceLast content deduplication.'} as Record<string,string>)[op],inputSchema:shape as z.ZodRawShape,annotations:{readOnlyHint:['capabilities','status','evidence','account'].includes(op),destructiveHint:false,openWorldHint:true}},async(args:Record<string,unknown>)=>{
      let result;try{result=await call({...args,op});}catch(e){result=fail(op,e);}
      return {content:[{type:'text' as const,text:JSON.stringify(result)}],isError:!result.ok};
    });
  }
  await server.connect(new StdioServerTransport());
}
