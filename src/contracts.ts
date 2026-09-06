import {z} from 'zod';

export const ORIGIN = 'https://fomo.family';
export const HOME = `${ORIGIN}/tokens/robinhood/0xe1e5f00a9b0255ca4df85b3130ee0f77d15acc2d`;
export function safeUrl(raw:string|undefined){if(!raw)return undefined;try{const u=new URL(raw);return u.origin===ORIGIN?`${u.origin}${u.pathname}`:u.origin;}catch{return undefined;}}
export class FomoError extends Error {
  constructor(public code: string, message: string) { super(message); }
}
const limit = z.number().int().min(1).max(100).default(20);
const panel = z.number().int().min(0).max(5).default(0);
const scrolls = z.number().int().min(0).max(5).default(1);
export const views = ['watchlist','crypto','trending','most-held','graduated','bonding'] as const;
export const viewLabels = {watchlist:'Watchlist',crypto:'Crypto',trending:'Trending','most-held':'Most held',graduated:'Graduated',bonding:'Bonding'};
export const feedLabels={trades:'Trades',closedPositions:'Closed positions',theses:'Theses',multiUserTrades:'Multi-user trades',newListings:'New listings',priceSpikes:'Price spikes',profitMilestones:'Profit milestones',newTraders:'New traders'};
const feedTypes=z.array(z.enum(['trades','closedPositions','theses','multiUserTrades','newListings','priceSpikes','profitMilestones','newTraders'])).min(1).max(8).optional();
const token = z.string().max(240).refine(s => {
  try { tokenUrl(s); return true; } catch { return false; }
}, 'Use a Fomo token URL or chain:contract');
const list = {limit,panel,scrolls};
const minSizeUsd=z.number().min(0).max(1e12).optional();
const overlays=z.object({mySwaps:z.boolean().optional(),theses:z.boolean().optional(),friendsOnly:z.boolean().optional(),minSizeUsd}).strict();
const filters = z.object({
  minSizeUsd:z.number().min(0).max(1e12).optional(),
  minPortfolioUsd:z.number().min(0).max(1e12).optional(),
  minMarketCapUsd:z.number().min(0).max(1e15).optional(),
  maxMarketCapUsd:z.number().min(0).max(1e15).optional(),
}).strict().refine(x=>x.minMarketCapUsd===undefined||x.maxMarketCapUsd===undefined||x.maxMarketCapUsd===0||x.minMarketCapUsd<=x.maxMarketCapUsd,'Minimum market cap exceeds maximum');
export const schemas = {
  capabilities:z.object({op:z.literal('capabilities')}).strict(),
  status:z.object({op:z.literal('status')}).strict(),
  account:z.object({op:z.literal('account')}).strict(),
  workspace:z.object({op:z.literal('workspace'),action:z.enum(['inspect','split-bottom','split-right','close']).default('inspect'),panel}).strict(),
  watchlist:z.object({op:z.literal('watchlist'),action:z.enum(['add','remove']),token,expectedAccount:z.string().regex(/^[A-Za-z0-9_.-]{1,80}$/).optional(),panel}).strict(),
  tokens:z.object({op:z.literal('tokens'),view:z.enum(views).default('trending'),...list}).strict(),
  leaderboard:z.object({op:z.literal('leaderboard'),period:z.enum(['24h','7d','30d','all']).default('24h'),...list}).strict(),
  alerts:z.object({op:z.literal('alerts'),filters:filters.optional(),...list}).strict(),
  feed:z.object({op:z.literal('feed'),types:feedTypes,...list}).strict(),
  token:z.object({op:z.literal('token'),token,sections:z.array(z.enum(['overview','holders','theses','swaps'])).min(1).max(4).default(['overview']),limit,scrolls,
    minSizeUsd,sinceLast:z.boolean().optional(),holdersThesisOnly:z.boolean().default(false),holdersFriendsOnly:z.boolean().default(false)}).strict(),
  theses:z.object({op:z.literal('theses'),token,limit,scrolls,minSizeUsd,sinceLast:z.boolean().optional()}).strict(),
  position:z.object({op:z.literal('position'),token,trader:z.string().min(1).max(80),tab:z.enum(['theses','swaps']).default('theses'),minSizeUsd,limit,scrolls}).strict(),
  trader:z.object({op:z.literal('trader'),handle:z.string().regex(/^[A-Za-z0-9_.-]{1,80}$/),period:z.enum(['24h','7d','30d']).default('24h'),positions:z.enum(['open','closed']).default('open'),limit}).strict(),
  chart:z.object({op:z.literal('chart'),token,overlays:overlays.optional(),timeframe:z.enum(['1m','5m','15m','1h','4h','1d']).optional()}).strict(),
  scan:z.object({op:z.literal('scan'),view:z.enum(views).default('trending'),limit:z.number().int().min(1).max(5).default(3),panel,minSizeUsd:z.number().min(0).max(1e12).default(10000),sinceLast:z.boolean().default(true),holdersFriendsOnly:z.boolean().default(true),rows:z.number().int().min(1).max(30).default(10)}).strict(),
  daily:z.object({op:z.literal('daily'),limit:z.number().int().min(1).max(5).default(3),panel,minSizeUsd:z.number().min(0).max(1e12).default(10000),sinceLast:z.boolean().default(true),rows:z.number().int().min(1).max(20).default(5)}).strict(),
  evidence:z.object({op:z.literal('evidence'),id:z.string().regex(/^[a-f0-9]{32}$/),offset:z.number().int().min(0).default(0),limit:z.number().int().min(1).max(50).default(10)}).strict(),
};
export const CallSchema = z.discriminatedUnion('op',[schemas.capabilities,schemas.status,schemas.account,schemas.workspace,schemas.watchlist,schemas.tokens,schemas.leaderboard,schemas.alerts,schemas.feed,schemas.token,schemas.theses,schemas.position,schemas.trader,schemas.chart,schemas.scan,schemas.daily,schemas.evidence]);
export type Call = z.infer<typeof CallSchema>;
export type Row = {id?:string;[key:string]:unknown};
export type Result = {ok:boolean;op:string;data?:any;error?:{code:string;message:string};meta?:Record<string,unknown>;evidenceId?:string};
export function tokenUrl(s:string):string {
  let path = s;
  if (!s.startsWith('http') && !s.startsWith('/')) path = `/tokens/${s.replace(':','/')}`;
  const u = new URL(path,ORIGIN);
  if(u.origin!==ORIGIN||u.username||u.password||u.search||u.hash||!/^\/tokens\/[a-z0-9-]+\/[A-Za-z0-9]+$/.test(u.pathname)) throw new FomoError('invalid_token','Only a Fomo chain/contract URL is accepted');
  return u.href;
}
export function tokenIdentity(s:string) {
  const url=tokenUrl(s); const [, ,chain,contract]=new URL(url).pathname.split('/');
  return {id:`${chain}:${contract.startsWith('0x')?contract.toLowerCase():contract}`,chain,contract,url};
}
export function fail(op:string,e:unknown):Result {
  if(e instanceof z.ZodError)return {ok:false,op,error:{code:'invalid_arguments',message:e.issues.map(x=>`${x.path.join('.')}: ${x.message}`).join(';').slice(0,1000)}};
  return {ok:false,op,error:{code:e instanceof FomoError?e.code:'adapter_error',message:e instanceof FomoError?e.message:'Browser operation failed. Run status or retry once; no result was inferred.'}};
}
export const capabilityMap = {
  version:'0.2.0-beta.1', mode:'research-and-watchlist', llmCalls:0,
  operations:{
    capabilities:{coverage:'version, contracts and limits'},status:{coverage:'local runtime health'},
    account:{coverage:'signed-in profile link; fails if ambiguous'},
    workspace:{actions:['inspect','split-bottom','split-right','close'],coverage:'native layout limits apply'},
    watchlist:{actions:['add','remove'],verification:'native star state after reload; optional expectedAccount'},
    tokens:{views,coverage:'bounded rendered lists'},
    leaderboard:{periods:['24h','7d','30d','all'],coverage:'bounded trader list'},
    alerts:{filters:['minSizeUsd','minPortfolioUsd','minMarketCapUsd','maxMarketCapUsd'],coverage:'loaded alerts; settings may persist'},
    feed:{types:Object.keys(feedLabels),coverage:'loaded activity and pinned preview'},
    token:{sections:['overview','holders','theses','swaps'],filters:['holdersThesisOnly','holdersFriendsOnly','minSizeUsd']},
    theses:{filters:['minSizeUsd','sinceLast'],coverage:'bounded rows; content dedupe, not complete historical sync'},
    position:{tabs:['theses','swaps'],coverage:'native detail for first matching trader in loaded thesis rows'},
    trader:{periods:['24h','7d','30d'],positions:['open','closed'],coverage:'displayed portfolio and positions; not audited returns'},
    chart:{timeframes:['1m','5m','15m','1h','4h','1d'],overlays:['mySwaps','theses','friendsOnly','minSizeUsd'],coverage:'chart image and labels; no OHLCV export'},
    scan:{maxTokens:5,sections:['overview','holders','theses']},
    daily:{sources:['watchlist','trending','most-held'],maxTokens:5,selection:'source overlap; not investment scoring'},
    evidence:{coverage:'paged local records before response truncation'},
  },
  unavailable:['order execution','fund transfers','follow/unfollow','posting or reactions','full OHLCV history','chart drawing and indicator editing','unbounded historical pagination','automatic LLM interpretation','Twitter enrichment'],
  limits:{rowsPerSection:100,scrollsPerSection:5,requestTimeoutMs:90000,scanTimeoutMs:180000,outputChars:14000,queuedRequests:8},
};
