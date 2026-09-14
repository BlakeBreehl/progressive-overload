import type { SupabaseClient } from '@supabase/supabase-js';
import { safeSupabaseDiagnostic } from './supabaseError';
export const releaseId='progressive-overload-2.0';
const shown=new Set<string>();
const key=(userId:string)=>`${releaseId}:${userId}`;
export function shownThisSession(userId:string){try{return shown.has(key(userId))||sessionStorage.getItem(key(userId))==='shown';}catch{return shown.has(key(userId));}}
export function markShown(userId:string){shown.add(key(userId));try{sessionStorage.setItem(key(userId),'shown');}catch{/* Memory still prevents repeated dialogs. */}}
export async function shouldAnnounce(client:SupabaseClient,userId:string,ready:boolean){
  if(!ready||shownThisSession(userId))return false;
  const {data,error}=await client.from('release_announcements').select('release_id').eq('user_id',userId).eq('release_id',releaseId).maybeSingle();
  if(error)safeSupabaseDiagnostic('Announcement','read acknowledgement',error);
  return !data;
}
export async function acknowledgeRelease(client:SupabaseClient,userId:string){
  markShown(userId);
  try{
    const {error}=await client.from('release_announcements').insert({user_id:userId,release_id:releaseId});
    if(error&&error.code!=='23505')safeSupabaseDiagnostic('Announcement','save acknowledgement',error);
  }catch(error){safeSupabaseDiagnostic('Announcement','save acknowledgement',error);}
}
