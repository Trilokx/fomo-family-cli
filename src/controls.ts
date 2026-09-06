import type {Locator} from 'playwright';
import type {Adapter} from './adapter.js';
import {FomoError,tokenIdentity,type Call} from './contracts.js';

export async function minimumSize(a:Adapter,button:Locator,value?:number){
 await button.click();const dialog=a.page!.getByRole('dialog');await dialog.waitFor();
 try{
  const input=dialog.getByPlaceholder('Custom',{exact:true});
  if(value!==undefined){await input.fill(String(value));await input.press('Tab');}
  const raw=await input.inputValue();
  if(value!==undefined&&Number(raw)!==value)throw new FomoError('filter_unverified','Custom minimum size did not match');
  return {requestedUsd:value??null,customUsd:raw===''?null:Number(raw),triggerDisplay:await button.innerText(),meaning:'Fomo native Min size; not independently verified as initial buy-in'};
 }finally{await dialog.press('Escape');}
}

export async function account(a:Adapter){
 await a.ready();
 const links=a.page!.locator('nav a[href^="/profile/"],header a[href^="/profile/"]');
 if(await links.count()!==1)throw new FomoError('account_unverified','Could not uniquely identify the signed-in account');
 const href=await links.getAttribute('href');const handle=href?.split('/').pop();
 if(!handle)throw new FomoError('account_unverified','Account handle missing');
 return {handle,url:`https://fomo.family/profile/${handle}`};
}

export async function workspace(a:Adapter,call:Extract<Call,{op:'workspace'}>){
 await a.ready();let panels=a.panels();const before=await panels.count();
 if(call.action!=='inspect'){
  if(call.panel>=before)throw new FomoError('panel_missing','Requested panel does not exist');
  if(call.action==='close'){
   if(before===1)throw new FomoError('last_panel','The final research panel cannot be closed');
   await panels.nth(call.panel).getByRole('button',{name:'Close panel',exact:true}).click();
  }else{
   const label=call.action==='split-bottom'?'Split into rows':'Add discovery column';
   let button=panels.nth(call.panel).getByRole('button',{name:label,exact:true});
   if(await button.count()===0){
    const column=panels.nth(call.panel).locator('..');
    button=column.getByRole('button',{name:label,exact:true});
   }
   if(await button.count()!==1)throw new FomoError('layout_limit','Fomo does not expose this split for the selected panel in the current layout');
   await button.click();
  }
  const target=before+(call.action==='close'?-1:1);
  for(let i=0;i<20&&await a.panels().count()!==target;i++)await a.page!.waitForTimeout(100);
  if(await a.panels().count()!==target)throw new FomoError('layout_unverified','Panel count did not change as requested');
 }
 panels=a.panels();
 return {panelCount:await panels.count(),panels:await panels.evaluateAll(es=>es.map((e,index)=>({index,tabs:[...e.querySelectorAll('button')].filter(b=>['Alerts','Tokens','Leaderboard','Feed'].includes(b.textContent??'')).map(b=>({name:b.textContent,selected:!b.className.includes('text-text-secondary')})),controls:[...e.querySelectorAll('button[aria-label]')].map(b=>b.getAttribute('aria-label'))})))};
}

export async function watchlist(a:Adapter,call:Extract<Call,{op:'watchlist'}>){
 const self=await account(a);
 if(call.expectedAccount&&self.handle!==call.expectedAccount)throw new FomoError('account_mismatch','Signed-in account differs from expectedAccount');
 const identity=tokenIdentity(call.token);const desired=call.action==='add';
 const read=()=>a.tokenList({op:'tokens',view:'watchlist',panel:call.panel,limit:100,scrolls:5});
 await a.navigate(identity.url);const copy=a.page!.getByRole('button',{name:'Copy address',exact:true});await copy.waitFor();
 const star=a.page!.locator('div.min-w-52.max-w-80').filter({has:copy}).locator('button[data-slot="tooltip-trigger"]');
 if(await star.count()!==1)throw new FomoError('watchlist_unavailable','Could not uniquely identify the watchlist control');
 await star.hover();const tip=a.page!.getByRole('tooltip');await tip.waitFor();const label=await tip.innerText();
 const present=label.toLowerCase()==='remove from watchlist';
 if(!present&&label.toLowerCase()!=='add to watchlist')throw new FomoError('watchlist_unverified','Native watchlist state is unknown');
 if(present===desired)return {...identity,account:self.handle,present:desired,changed:false};
 await star.click();await a.page!.reload({waitUntil:'domcontentloaded'});await a.ready();
 await star.hover();await tip.waitFor();
 if((await tip.innerText()).toLowerCase()!==(desired?'remove from watchlist':'add to watchlist'))throw new FomoError('watchlist_unverified','Native star did not retain requested state after reload');
 const after=await read();
 return {...identity,account:self.handle,present:desired,changed:true,verifiedAfterReload:true,foundInBoundedList:after.items.some(x=>x.id===identity.id)};
}
