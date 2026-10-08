import type {SupabaseClient} from '@supabase/supabase-js';
import {startupDeadline} from './startupDeadline';
import {safeSupabaseDiagnostic,transientDataError} from './supabaseError';
export const strengthTrendsReleaseId='progressive-overload-2.3-strength-trends';
export const strengthReleaseKey=(userId:string)=>strengthTrendsReleaseId+':'+userId;
const eventName='strength-trends-release-dismissed';
const localMemory=new Map<string,'pending'|'synced'>();
export function localStrengthAcknowledgement(userId:string){
 try{const stored=localStorage.getItem(strengthReleaseKey(userId));if(stored==='pending'||stored==='synced')return stored;}catch{/* Memory still suppresses repeats in this process. */}
 return localMemory.get(userId);
}
function record(userId:string,state:'pending'|'synced'){
 localMemory.set(userId,state);try{localStorage.setItem(strengthReleaseKey(userId),state);}catch{/* Server success remains durable if storage is unavailable. */}
}
export function dismissStrengthReleaseLocally(userId:string){
 record(userId,'pending');window.dispatchEvent(new CustomEvent(eventName,{detail:strengthReleaseKey(userId)}));
}
export function strengthReleaseEligible(ready:boolean,userId:string,path:string){return ready&&!!userId&&!path.startsWith('/auth/');}
export function subscribeStrengthReleaseDismissal(userId:string,dismiss:()=>void){
 const storage=(event:StorageEvent)=>{if(event.key===strengthReleaseKey(userId)&&(event.newValue==='pending'||event.newValue==='synced'))dismiss();};
 const local=(event:Event)=>{if((event as CustomEvent<string>).detail===strengthReleaseKey(userId))dismiss();};
 window.addEventListener('storage',storage);window.addEventListener(eventName,local);
 return()=>{window.removeEventListener('storage',storage);window.removeEventListener(eventName,local);};
}
/** Bind the captured account token: a later account switch cannot redirect this RPC to B. */
async function accountRpc(client:SupabaseClient,userId:string,name:string){
 const {data,error}=await startupDeadline(client.auth.getSession());
 if(error)throw error;
 if(data.session?.user.id!==userId)throw Object.assign(new Error('Account changed'),{code:'ACCOUNT_CHANGED'});
 return await startupDeadline(client.rpc(name,{p_release_id:strengthTrendsReleaseId}).setHeader('Authorization','Bearer '+data.session.access_token));
}
const pending=new WeakMap<SupabaseClient,Map<string,Promise<void>>>();
export function reconcileStrengthRelease(client:SupabaseClient,userId:string){
 let requests=pending.get(client);if(!requests){requests=new Map();pending.set(client,requests);}const existing=requests.get(userId);if(existing)return existing;
 const request=(async()=>{
  for(let attempt=0;attempt<3;attempt++){
   try{const {error}=await accountRpc(client,userId,'acknowledge_release');if(error)throw error;record(userId,'synced');return;}
   catch(error){safeSupabaseDiagnostic('Announcements','reconcile Strength trends release',error);if(attempt===2||!transientDataError(error))throw error;await new Promise(resolve=>setTimeout(resolve,250*2**attempt));}
  }
 })().finally(()=>{if(requests.get(userId)===request)requests.delete(userId);});requests.set(userId,request);return request;
}
const pendingReads=new WeakMap<SupabaseClient,Map<string,Promise<boolean>>>();
export function shouldShowStrengthRelease(client:SupabaseClient,userId:string,ready:boolean,path:string){
 if(!strengthReleaseEligible(ready,userId,path))return Promise.resolve(false);
 if(localStrengthAcknowledgement(userId)){
  if(localStrengthAcknowledgement(userId)==='pending')void reconcileStrengthRelease(client,userId).catch(()=>{});
  return Promise.resolve(false);
 }
 let reads=pendingReads.get(client);if(!reads){reads=new Map();pendingReads.set(client,reads);}const existing=reads.get(userId);if(existing)return existing;
 const request=(async()=>{
 const {data,error}=await accountRpc(client,userId,'get_release_acknowledgement');
 if(error)throw error;if(typeof data!=='boolean')throw new Error('Invalid release acknowledgement response');
 if(data)record(userId,'synced');
 // A dismissal in another subscriber during this request wins over a stale unseen read.
 return !data&&!localStrengthAcknowledgement(userId);
 })().finally(()=>{if(reads.get(userId)===request)reads.delete(userId);});reads.set(userId,request);return request;
}
