import {chromium, type BrowserContext,type Page,type Locator} from 'playwright';
import {join} from 'node:path';
import {mkdir} from 'node:fs/promises';
import {spawn,type ChildProcess} from 'node:child_process';
import {CallSchema,HOME,ORIGIN,FomoError,capabilityMap,tokenUrl,tokenIdentity,viewLabels,feedLabels,fail,safeUrl,type Call,type Result,type Row} from './contracts.js';
import {parseToken,parseLeader,parseHolder,parseActivity,parseThesis,type RawRow,number,bounded,hash} from './parse.js';
import {stateDir,saveEvidence,evidence,newObservations} from './store.js';
import {minimumSize,account,workspace,watchlist} from './controls.js';

export class Adapter {
  context?:BrowserContext;
  page?:Page;
  manualLogin?:ChildProcess;
  startedAt=new Date().toISOString();
  async launch(headed=false){
    if(this.context)return;
    if(this.manualLogin&&this.manualLogin.exitCode===null)throw new FomoError('login_in_progress','Finish login and close the dedicated Chrome window, then run fomo start');
    await mkdir(stateDir,{recursive:true,mode:0o700});
    this.context=await chromium.launchPersistentContext(join(stateDir,'browser'),{
      channel:process.env.FOMO_BROWSER_CHANNEL??'chrome',headless:!headed&&process.env.FOMO_HEADLESS==='1',viewport:{width:1600,height:1000},timeout:20000,
    });
    this.context.setDefaultTimeout(8000);this.context.setDefaultNavigationTimeout(20000);
    this.page=this.context.pages()[0]??await this.context.newPage();
    this.page.on('dialog',d=>void d.dismiss());
    this.context.on('close',()=>{this.context=undefined;this.page=undefined;});
    await this.page.goto(HOME,{waitUntil:'domcontentloaded'});
  }
  async login(){
    await this.close();
    await mkdir(join(stateDir,'browser'),{recursive:true,mode:0o700});
    const executable=process.env.FOMO_CHROME_PATH??(process.platform==='win32'?'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe':process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'google-chrome');
    const child=spawn(executable,[`--user-data-dir=${join(stateDir,'browser')}`,'--new-window',HOME],{stdio:'ignore',windowsHide:false});
    if(!this.manualLogin||this.manualLogin.exitCode!==null)this.manualLogin=child;
    await new Promise<void>((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});
  }
  async close(){await this.context?.close();this.context=undefined;this.page=undefined;}
  async ready(){
    if(!this.page||this.page.isClosed())throw new FomoError('browser_closed','Start the runtime with fomo start or fomo login');
    if(new URL(this.page.url()).origin!==ORIGIN)throw new FomoError('login_required','Complete login in the Fomo browser');
    try{await this.page.getByRole('button',{name:'Tokens',exact:true}).first().waitFor({timeout:12000});}
    catch{
      const text=await this.page.locator('body').innerText().catch(()=>'');
      if(/log in|sign in|log.?in|continue with|join fomo/i.test(text))throw new FomoError('login_required','Run fomo login and sign in using the dedicated browser profile');
      throw new FomoError('ui_unavailable','Fomo navigation did not load; no empty data result was inferred');
    }
  }
  panels(){return this.page!.locator('div.rounded-xl.border').filter({has:this.page!.getByRole('button',{name:'Tokens',exact:true})});}
  async panel(index:number,tab:string){
    await this.ready();const panels=this.panels();
    if(index>=await panels.count())throw new FomoError('panel_missing',`Panel ${index} is unavailable. Check workspace in status.`);
    const panel=panels.nth(index);await panel.getByRole('button',{name:tab,exact:true}).click();
    await this.selected(panel.getByRole('button',{name:tab,exact:true}),true);
    return panel;
  }
  async selected(button:Locator,main=false){
    for(let i=0;i<20;i++){
    const selected=await button.evaluate((el)=>{
      const state=el.getAttribute('aria-pressed')??el.getAttribute('aria-selected')??el.getAttribute('data-state');
      const cls=el.getAttribute('class')??'';
      return state!=='false'&&state!=='inactive'&&!cls.includes('text-text-secondary')&&!cls.includes('text-text-tertiary');
    });
    if(selected)return;await this.page!.waitForTimeout(100);
    }
    throw new FomoError('selection_unverified','Expected view selection was not confirmed');
  }
  async navigate(url:string){
    await this.ready();if(this.page!.url()!==url)await this.page!.goto(url,{waitUntil:'domcontentloaded'});
  }
  async collect(root:Locator,rows:Locator,limit:number,maxScrolls:number){
    const found=new Map<string,RawRow>();let passes=0;
    await root.evaluate(el=>{for(const e of [el,...el.querySelectorAll('*')])if(e.clientHeight>60&&/auto|scroll/.test(getComputedStyle(e).overflowY))e.scrollTop=0;});
    await this.page!.waitForTimeout(200);
    for(let pass=0;pass<=maxScrolls;pass++){
      const batch=await rows.evaluateAll(els=>els.map(el=>{
        const text=(el as HTMLElement).innerText;
        return {text,lines:text.split('\n').map(x=>x.trim()).filter(Boolean),href:el.getAttribute('href'),links:[...el.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')!).filter(Boolean)};
      }));
      for(const row of batch){const key=hash(row.text.replace(/\b\d+[smhd]\b/g,''));if(!found.has(key))found.set(key,row);}
      if(found.size>=limit||pass===maxScrolls)break;
      const moved=await root.evaluate(el=>{
        const candidates=[el,...el.querySelectorAll('*')].filter(e=>e.scrollHeight>e.clientHeight+5&&e.clientHeight>60&&/auto|scroll/.test(getComputedStyle(e).overflowY));
        const scroller=candidates.sort((a,b)=>b.clientHeight-a.clientHeight)[0];if(!scroller)return false;
        const previous=scroller.scrollTop;scroller.scrollTop+=scroller.clientHeight*.8;return scroller.scrollTop!==previous;
      });
      if(!moved)break;
      passes++;
      await rows.last().scrollIntoViewIfNeeded().catch(()=>{});
      await this.page!.waitForTimeout(500);
    }
    return {rows:[...found.values()].slice(0,limit),coverage:{scope:'loaded_rows',complete:false,observedRows:found.size,returnedRows:Math.min(found.size,limit),scrolls:passes,limitReached:found.size>=limit}};
  }
  async listReady(panel:Locator,rows:Locator){
    await Promise.any([
      rows.first().waitFor({timeout:10000}),
      panel.getByText(/no .*found|no tokens|no alerts|no posts|no activity yet|nothing .*yet|watchlist is empty|start following|sign in|log in/i).first().waitFor({timeout:10000}),
    ]).catch(()=>{throw new FomoError('list_not_loaded','List did not expose rows or a recognized empty state');});
    if(await panel.getByText(/sign in|log in|start following/i).count())throw new FomoError('login_or_following_required','This view requires a signed-in account or following list');
  }
  async tokenList(call:Extract<Call,{op:'tokens'}>){
    const panel=await this.panel(call.panel,'Tokens');
    const view=panel.getByRole('button',{name:viewLabels[call.view],exact:true});await view.click();await this.selected(view);
    const rows=panel.locator('a[href^="/tokens/"]');await this.listReady(panel,rows);
    const collected=await this.collect(panel,rows,call.limit,call.scrolls);
    return {view:call.view,...collected.coverage,items:collected.rows.map((r,i)=>parseToken(r,i+1))};
  }
  async leaderboard(call:Extract<Call,{op:'leaderboard'}>){
    const panel=await this.panel(call.panel,'Leaderboard');const period=panel.getByRole('button',{name:call.period.toUpperCase(),exact:true});
    await period.click();await this.selected(period);
    const rows=panel.locator('a[href^="/profile/"]');await this.listReady(panel,rows);
    const collected=await this.collect(panel,rows,call.limit,call.scrolls);
    return {period:call.period,...collected.coverage,items:collected.rows.map((r,i)=>parseLeader(r,i+1))};
  }
  async alertFilters(panel:Locator,values:any){
    await panel.getByRole('button',{name:/^Filters/}).click();const dialog=this.page!.getByRole('dialog');await dialog.waitFor();
    const read=async()=>({
      minSizeUsd:await dialog.getByPlaceholder('Custom',{exact:true}).nth(0).inputValue(),
      minPortfolioUsd:await dialog.getByPlaceholder('Custom',{exact:true}).nth(1).inputValue(),
      minMarketCapUsd:await dialog.getByRole('textbox',{name:'Min $',exact:true}).inputValue(),
      maxMarketCapUsd:await dialog.getByRole('textbox',{name:'Max $',exact:true}).inputValue(),
    });
    try{
      if(values){
        const inputs={minSizeUsd:dialog.getByPlaceholder('Custom',{exact:true}).nth(0),minPortfolioUsd:dialog.getByPlaceholder('Custom',{exact:true}).nth(1),minMarketCapUsd:dialog.getByRole('textbox',{name:'Min $',exact:true}),maxMarketCapUsd:dialog.getByRole('textbox',{name:'Max $',exact:true})};
        for(const [key,value]of Object.entries(values)){const input=inputs[key as keyof typeof inputs];await input.fill(String(value));await input.press('Tab');}
      }
      const display=await dialog.innerText();const fields=await read();
      if(values)for(const [key,value]of Object.entries(values)){
        const actual=fields[key as keyof typeof fields];
        if(Number(actual.replaceAll(',',''))!==value)throw new FomoError('filter_unverified',`${key} was not applied`);
      }
      return {requested:values??null,fields,display,persistence:'Fomo account preferences may persist'};
    }finally{await dialog.press('Escape');}
  }
  async activity(call:Extract<Call,{op:'alerts'|'feed'}>){
    const panel=await this.panel(call.panel,call.op==='alerts'?'Alerts':'Feed');
    let filters:unknown=call.op==='alerts'?await this.alertFilters(panel,call.filters):undefined;
    if(call.op==='feed'){
      const filter=panel.getByRole('button',{name:/^Filter/});await filter.click();
      try{
        const states:Record<string,boolean>={};
        for(const [key,label]of Object.entries(feedLabels)){
          const button=panel.getByRole('button',{name:label,exact:true});
          const read=()=>button.locator('svg').evaluate(e=>e.getAttribute('class')?.includes('text-accent-primary')??false);
          const desired=call.types?.includes(key as NonNullable<typeof call.types>[number]);
          if(desired!==undefined&&await read()!==desired)await button.click();
          states[key]=await read();if(desired!==undefined&&states[key]!==desired)throw new FomoError('filter_unverified','Feed category did not reach requested state');
        }
        filters=states;
      }finally{await filter.click();}
    }
    const rows=call.op==='feed'?panel.locator('div.border-b.border-bg-secondary').filter({hasNot:panel.getByRole('button',{name:'Collapse',exact:true})}):panel.locator('a').filter({hasText:/Thesis|Buy|Sell|is up/});
    await this.listReady(panel,rows);
    const collected=await this.collect(panel,rows,call.limit,call.scrolls);
    const pinned=call.op==='feed'?await panel.getByRole('button',{name:'Collapse',exact:true}).evaluateAll(es=>es.map(e=>{let p=e.parentElement;while(p&&p.innerText.length<150)p=p.parentElement;const text=p?.innerText??'';return {text:text.slice(0,3000),textMayBeTruncated:text.includes('Show more')||text.length>3000};})):[];
    const items=collected.rows.filter(r=>!r.lines.includes('Pinned')).map(parseActivity);
    return {filters,pinned,...collected.coverage,returnedRows:items.length,items,note:'Snapshot only. PnL alerts are not swaps. Relative times are display values, not exact timestamps.'};
  }
  async metrics(){
    const labels=['Market cap','Price','24H change','24H Vol.','Liquidity','Holders','Top 10 holding'];
    const result:Record<string,unknown>={};
    for(const label of labels){
      const locator=this.page!.getByText(label,{exact:true});
      if(await locator.count()!==1){result[label]=null;continue;}
      result[label]=await locator.evaluate(el=>el.parentElement?.innerText.replace(el.textContent??'','').trim()??null);
    }
    return result;
  }
  async toggle(button:Locator,value:boolean){
    const read=()=>button.evaluate(el=>{
      const s=el.getAttribute('aria-pressed')??el.getAttribute('aria-checked')??el.querySelector('[role="checkbox"],button')?.getAttribute('data-state')??el.getAttribute('data-state');
      if(s==='true'||s==='checked'||s==='on')return true;
      if(s==='false'||s==='unchecked'||s==='off')return false;
      const style=el.getAttribute('style')??el.querySelector('button')?.getAttribute('style')??'';
      if(style.includes('--color-accent-primary'))return true;
      if(style.includes('--color-text-tertiary'))return false;
      if(el.className.includes('text-accent-primary'))return true;
      if(el.className.includes('text-text-tertiary'))return false;
      return null;
    });
    const active=await read();
    if(active===null)throw new FomoError('toggle_unverified','Could not read filter state; refusing to guess');
    if(active!==value){await button.click();if(await read()!==value)throw new FomoError('toggle_unverified','Toggle did not reach requested state');}
  }
  async inspect(call:Extract<Call,{op:'token'}>){
    const identity=tokenIdentity(call.token);await this.navigate(identity.url);
    await this.page!.getByRole('button',{name:'Copy address',exact:true}).waitFor();
    await this.page!.getByText('Market cap',{exact:true}).waitFor();
    const sections:Record<string,unknown>={};
    for(const section of call.sections){
      if(section==='overview'){sections.overview={metrics:await this.metrics(),title:await this.page!.title()};continue;}
      const label=section==='holders'?/^Holders \(/:section==='theses'?/^Thesis \(/:/^Swaps$/;
      const sectionRoot=this.page!.locator('div.rounded-lg.border.flex-col').filter({has:this.page!.getByRole('button',{name:/^Holders \(/})});
      if(await sectionRoot.count()!==1)throw new FomoError('section_unavailable','Could not uniquely identify token research section');
      await sectionRoot.getByRole('button',{name:label}).click();
      let sizeFilter;
      if(section!=='holders')sizeFilter=await minimumSize(this,sectionRoot.getByRole('button',{name:/^Min size/}),call.minSizeUsd);
      if(section==='holders'){
        await this.toggle(this.page!.getByRole('button',{name:'Thesis only',exact:true}),call.holdersThesisOnly);
        await this.toggle(this.page!.getByRole('button',{name:'Friends only',exact:true}).last(),call.holdersFriendsOnly);
      }
      const rows=section==='holders'?sectionRoot.getByRole('button').filter({hasText:/avg\. hold/}):section==='theses'?sectionRoot.getByRole('button').filter({hasText:/Thesis\s*(?:Closed\s*)?\d/}):sectionRoot.getByRole('button').filter({hasText:/(?:Buy|Sell|Deposit|Withdraw)\s*\$/});
      await this.listReady(sectionRoot,rows);
      const collected=await this.collect(sectionRoot,rows,call.limit,call.scrolls);
      let items=collected.rows.map(section==='holders'?parseHolder:section==='theses'?parseThesis:parseActivity);
      if(section==='theses')items=[...new Map(items.map(item=>[item.id,item])).values()];
      let delta;
      if(section==='theses'&&call.sinceLast){delta=await newObservations(`${identity.id}:${JSON.stringify(sizeFilter)}`,items);items=delta.items;}
      sections[section]={...collected.coverage,returnedRows:items.length,items,delta:delta?{...delta,items:undefined}:undefined,filters:section==='holders'?{thesisOnly:call.holdersThesisOnly,friendsOnly:call.holdersFriendsOnly}:sizeFilter};
    }
    return {...identity,sections};
  }
  async trader(call:Extract<Call,{op:'trader'}>){
    await this.navigate(`${ORIGIN}/profile/${call.handle}`);
    await this.page!.getByText(/Joined /).first().waitFor();
    const period=this.page!.getByRole('tablist',{name:'Time range',exact:true}).getByRole('tab',{name:call.period.toUpperCase(),exact:true});await period.click();await this.selected(period);
    const header=this.page!.getByText(/^Positions\d+$/);await header.waitFor({timeout:10000});
    const root=header.locator('..').locator('..');
    const state=root.getByText(call.positions==='open'?'Open':'Closed',{exact:true});
    if(!await state.evaluate(e=>e.className.includes('text-accent-primary')))await state.click();await this.selected(state);
    const rows=root.getByRole('button').filter({hasText:/\$/});await this.listReady(root,rows);
    const collected=await this.collect(root,rows,call.limit,0);
    const summary=await this.page!.getByText(/Joined |avg\. hold|\d[\d.KM]* trades/).allTextContents();
    const performance=await root.locator('..').innerText();
    return {handle:call.handle,period:call.period,positions:call.positions,summary:[...new Set(summary)].filter(x=>x.length<120),performanceDisplay:performance.split('Positions')[0].slice(0,1200),...collected.coverage,items:collected.rows.map(r=>({id:hash(r.text),display:r.text.slice(0,1800)})),note:'Loaded profile rows; no complete realized-performance calculation.'};
  }
  async position(call:Extract<Call,{op:'position'}>){
    await this.inspect({op:'token',token:call.token,sections:['theses'],limit:call.limit,scrolls:call.scrolls,minSizeUsd:call.minSizeUsd,holdersFriendsOnly:false,holdersThesisOnly:false});
    const root=this.page!.locator('div.rounded-lg.border.flex-col').filter({has:this.page!.getByRole('button',{name:/^Holders \(/})});
    const rows=root.getByRole('button').filter({hasText:/Thesis\s*(?:Closed\s*)?\d/}).filter({has:this.page!.getByText(call.trader,{exact:true})});
    if(await rows.count()===0)throw new FomoError('position_not_loaded','Trader thesis was not found in the bounded loaded rows; increase limit/scrolls or change Min size');
    await rows.first().click();const dialog=this.page!.getByRole('dialog');await dialog.waitFor();
    try{
      await dialog.getByText(call.trader,{exact:true}).first().waitFor({timeout:10000});
      await dialog.getByText('Avg. entry',{exact:true}).waitFor();
      await dialog.getByRole('button',{name:call.tab==='theses'?'Thesis':'Swaps',exact:true}).click();
      await this.page!.waitForTimeout(500);
      const text=await dialog.innerText();if(text.includes('Loading chart...')||text.includes('-- invested'))throw new FomoError('position_not_loaded','Position detail is still loading');
      return {...tokenIdentity(call.token),trader:call.trader,tab:call.tab,display:text.slice(0,10000),textTruncated:text.length>10000,coverage:'loaded_position_dialog',note:'First matching loaded trader position; includes displayed history only. Native transaction Min size is separate from the thesis list filter.'};
    }finally{await dialog.getByRole('button',{name:'Close',exact:true}).click();}
  }
  async chart(call:Extract<Call,{op:'chart'}>){
    const identity=tokenIdentity(call.token);await this.navigate(identity.url);
    // Select the actual chart frame by its observed TradingView container.
    const chart=this.page!.locator('[id^="tradingview_"]');
    await chart.first().waitFor({timeout:10000});
    if(await chart.count()!==1)throw new FomoError('chart_unavailable','Could not uniquely identify the TradingView chart');
    const frame=this.page!.locator('iframe[id^="tradingview_"]');
    await frame.first().waitFor({timeout:10000});
    if(await frame.count()!==1)throw new FomoError('chart_unavailable','Could not uniquely identify the chart frame');
    const body=frame.contentFrame().locator('body');
    await body.filter({hasText:/fomo/}).waitFor({timeout:10000});
    if(call.overlays){
      const labels={mySwaps:'My swaps',theses:'Thesis',friendsOnly:'Friends only'};
      for(const [key,label]of Object.entries(labels)){const value=call.overlays[key as keyof typeof labels];if(value!==undefined)await this.toggle(this.page!.getByRole('button',{name:label,exact:true}).first(),value);}
      if(call.overlays.minSizeUsd!==undefined)await minimumSize(this,this.page!.getByRole('button',{name:/^Min size/}).first(),call.overlays.minSizeUsd);
    }
    if(call.timeframe){
      const label={'1m':'1 minute','5m':'5 minutes','15m':'15 minutes','1h':'1 hour','4h':'4 hours','1d':'1 day'}[call.timeframe];
      const interval=frame.contentFrame().getByRole('button',{name:/^(?:\d+ (?:minute|hour|day)s?)$/}).first();
      await interval.click();await frame.contentFrame().getByText(label,{exact:true}).last().click();
      await frame.contentFrame().getByRole('button',{name:label,exact:true}).first().waitFor();
      await this.page!.waitForTimeout(500);
    }
    const text=await body.innerText();
    const labels=text.includes('TradingView')?[text.slice(0,1400)]:[];
    if(!labels.length)throw new FomoError('chart_not_loaded','Chart has not rendered');
    const id=hash(`${Date.now()}:${identity.id}`);const dir=join(stateDir,'charts');await mkdir(dir,{recursive:true});const path=join(dir,`${id}.png`);
    await chart.screenshot({path});
    return {...identity,path,labels,requestedTimeframe:call.timeframe??null,requestedOverlays:call.overlays??null,interpretation:'Current UI chart. No OHLCV series extracted. No model called.'};
  }
  async execute(raw:unknown):Promise<Result>{
    const start=Date.now();let call:Call;
    try{call=CallSchema.parse(raw);}catch(e){return fail('unknown',e);}
    const run=async()=>{
      switch(call.op){
        case 'capabilities':return capabilityMap;
        case 'status':return {browserOpen:!!this.page&&!this.page.isClosed(),manualLoginOpen:!!this.manualLogin&&this.manualLogin.exitCode===null,url:safeUrl(this.page?.url()),panels:this.page?await this.panels().count():0,startedAt:this.startedAt};
        case 'account':return account(this);
        case 'workspace':return workspace(this,call);
        case 'watchlist':return watchlist(this,call);
        case 'evidence':return evidence(call.id,call.offset,call.limit);
        case 'tokens':return this.tokenList(call);
        case 'leaderboard':return this.leaderboard(call);
        case 'alerts':case 'feed':return this.activity(call);
        case 'token':return this.inspect(call);
        case 'theses':return this.inspect({...call,op:'token',sections:['theses'],holdersThesisOnly:false,holdersFriendsOnly:false});
        case 'position':return this.position(call);
        case 'trader':return this.trader(call);
        case 'chart':return this.chart(call);
        case 'daily':{
          const self=await account(this);const sources:Record<string,any>={};const candidates=new Map<string,any>();
          for(const view of ['watchlist','trending','most-held'] as const){
            const list=await this.tokenList({op:'tokens',view,panel:call.panel,limit:view==='watchlist'?20:10,scrolls:1});sources[view]=list;
            for(const item of list.items){const found=candidates.get(item.id as string)??{...item,sources:[]};found.sources.push(view);candidates.set(item.id as string,found);}
          }
          const selected=[...candidates.values()].sort((a,b)=>b.sources.length-a.sources.length||a.rank-b.rank).slice(0,call.limit);
          const items:unknown[]=[];
          for(const item of selected){try{items.push({candidate:item,...await this.inspect({op:'token',token:item.url,sections:['overview','holders','theses'],limit:call.rows,scrolls:1,minSizeUsd:call.minSizeUsd,sinceLast:call.sinceLast,holdersThesisOnly:false,holdersFriendsOnly:true})});}catch(e){items.push({candidate:item,...fail('token',e)});}}
          return {account:self,selectionRule:'Most overlap among bounded Watchlist, Trending and Most held; ties use first observed rank. Discovery priority only, not an investment score.',sources,items,partial:items.some((x:any)=>x.ok===false),settings:{minSizeUsd:call.minSizeUsd,sinceLast:call.sinceLast,holdersFriendsOnly:true}};
        }
        case 'scan':{
          const discovered=await this.tokenList({op:'tokens',view:call.view,panel:call.panel,limit:call.limit,scrolls:0});
          const items:unknown[]=[];
          for(const item of discovered.items){try{items.push(await this.inspect({op:'token',token:item.url as string,sections:['overview','holders','theses'],limit:call.rows,scrolls:1,minSizeUsd:call.minSizeUsd,sinceLast:call.sinceLast,holdersThesisOnly:false,holdersFriendsOnly:call.holdersFriendsOnly}));}catch(e){items.push({token:item.id,...fail('token',e)});}}
          return {discovery:discovered,settings:{minSizeUsd:call.minSizeUsd,sinceLast:call.sinceLast,holdersFriendsOnly:call.holdersFriendsOnly},items,partial:items.some((x:any)=>x.ok===false)};
        }
      }
    };
    let timer:ReturnType<typeof setTimeout>|undefined;
    try{
      const data=await Promise.race([run(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{void this.close();reject(new FomoError('request_timeout','Operation budget reached; browser closed to stop pending work'));},['scan','daily'].includes(call.op)?180000:90000);})]);
      const result:Result={ok:true,op:call.op,data,meta:{observedAt:new Date().toISOString(),elapsedMs:Date.now()-start,url:safeUrl(this.page?.url()),coverage:'bounded_ui_snapshot',llmCalls:0}};
      if(!['capabilities','status','evidence'].includes(call.op))result.evidenceId=await saveEvidence(result);
      return bounded(result);
    }catch(e){return fail(call.op,e);}finally{clearTimeout(timer);}
  }
}
