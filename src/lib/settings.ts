import { safeSupabaseDiagnostic, transientDataError } from './supabaseError';
import type { SupabaseClient } from '@supabase/supabase-js'
import { defaultModules, toSettingsRow, type ModuleState } from '../domain/modules'

export type UserSetup = { modules: ModuleState; onboardingCompleted: boolean; preferredWeightUnit: 'lb'|'kg' }

export async function loadUserSetup(client: SupabaseClient, userId: string): Promise<UserSetup> {
  const [settingsResult, profileResult] = await Promise.all([
    client.from('user_settings').select('strength_enabled,cardio_enabled,mobility_enabled,weight_enabled,preferred_weight_unit').eq('user_id', userId).single(),
    client.from('profiles').select('onboarding_completed').eq('user_id', userId).single(),
  ])
  if (settingsResult.error) { const error={...settingsResult.error,status:settingsResult.status,operation:'load user_settings'};safeSupabaseDiagnostic("Startup",error.operation,error);throw error }
  if (profileResult.error) { const error={...profileResult.error,status:profileResult.status,operation:'load profiles'};safeSupabaseDiagnostic("Startup",error.operation,error);throw error }
  return {
    modules: {
      strength: settingsResult.data.strength_enabled,
      cardio: settingsResult.data.cardio_enabled,
      flexibility: settingsResult.data.mobility_enabled,
      weight: settingsResult.data.weight_enabled,
    },
    onboardingCompleted: profileResult.data.onboarding_completed,
    preferredWeightUnit: settingsResult.data.preferred_weight_unit,
  }
}

const delay=(milliseconds:number)=>new Promise(resolve=>setTimeout(resolve,milliseconds))
export const transientSetupError=(error:unknown)=>transientDataError(error)||(error as {code?:string})?.code==='PGRST116';

/** New auth sessions can arrive a few milliseconds before companion-row triggers are visible. */
async function fetchUserSetupWithRetry(client:SupabaseClient,userId:string,{attempts=4,wait=delay}:{attempts?:number;wait?:(milliseconds:number)=>Promise<unknown>}={}):Promise<UserSetup>{
 let last:unknown
 for(let attempt=0;attempt<attempts;attempt++){
  try{return await loadUserSetup(client,userId)}catch(error){last=error;if(!transientSetupError(error)||attempt===attempts-1)throw error;await wait(150*2**attempt)}
 }
 throw last
}

export async function saveModuleSettings(client: SupabaseClient, userId: string, settings: ModuleState): Promise<void> {
  const { error } = await client.from('user_settings').upsert(toSettingsRow(userId, settings), { onConflict: 'user_id' })
  if (error) throw error
}

export async function savePreferredWeightUnit(client:SupabaseClient,userId:string,unit:'lb'|'kg'){const{error}=await client.from('user_settings').update({preferred_weight_unit:unit}).eq('user_id',userId);if(error)throw error;if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('preferred-weight-unit',{detail:unit}))}

export async function completeOnboarding(client: SupabaseClient, userId: string, settings = defaultModules): Promise<void> {
  await saveModuleSettings(client, userId, settings)
  const { error } = await client.from('profiles').update({ onboarding_completed: true }).eq('user_id', userId)
  if (error) throw error
}

// Only in-flight work is shared. Never retain account data after completion.
const pendingSetup=new WeakMap<SupabaseClient,Map<string,Promise<UserSetup>>>();
export function loadUserSetupWithRetry(client:SupabaseClient,userId:string,options:Parameters<typeof fetchUserSetupWithRetry>[2]={}){
 let pending=pendingSetup.get(client);if(!pending){pending=new Map();pendingSetup.set(client,pending);}
 const existing=pending.get(userId);if(existing)return existing;
 const request=fetchUserSetupWithRetry(client,userId,options).finally(()=>{if(pending.get(userId)===request)pending.delete(userId);});
 pending.set(userId,request);return request;
}
