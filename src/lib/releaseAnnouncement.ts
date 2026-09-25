import {startupTrace} from './startupDiagnostic';
import {safeSupabaseDiagnostic} from './supabaseError';
import type { SupabaseClient } from '@supabase/supabase-js';
export const releaseId='progressive-overload-2.1-launch';
const eventName='release-dismissed';
const key=(userId:string)=>releaseId+':'+userId;
// Storage is a cross-tab notification, never authority for the initial decision.
export async function shouldAnnounce(client:SupabaseClient,userId:string,ready:boolean){
  if(!ready||!userId)return false;
  startupTrace('Announcements','lookup acknowledgement');
  const {data,error}=await client.rpc('get_release_acknowledgement',{p_release_id:releaseId});
  if(error||typeof data!=='boolean'){safeSupabaseDiagnostic('Announcements','lookup acknowledgement',error);throw new Error('Could not check the release announcement. Please retry.');}
  startupTrace('Announcements','lookup acknowledgement','ready');
  return !data;
}
export async function acknowledgeRelease(client:SupabaseClient,userId:string){
  const {error}=await client.rpc('acknowledge_release',{p_release_id:releaseId});
  if(error)throw new Error('Could not save your dismissal. Please retry.');
  try{localStorage.setItem(key(userId),'dismissed');}catch{/* Server remains authoritative. */}
  window.dispatchEvent(new CustomEvent(eventName,{detail:key(userId)}));
}
export function subscribeReleaseDismissal(userId:string,onDismiss:()=>void){
  const storage=(event:StorageEvent)=>{if(event.key===key(userId)&&event.newValue==='dismissed')onDismiss();};
  const local=(event:Event)=>{if((event as CustomEvent<string>).detail===key(userId))onDismiss();};
  window.addEventListener('storage',storage);window.addEventListener(eventName,local);
  return()=>{window.removeEventListener('storage',storage);window.removeEventListener(eventName,local);};
}
