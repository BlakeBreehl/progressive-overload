import { safeSupabaseDiagnostic } from './supabaseError';
import type { SupabaseClient } from '@supabase/supabase-js'
import { defaultModules, toSettingsRow, type ModuleState } from '../domain/modules'

export type UserSetup = { modules: ModuleState; onboardingCompleted: boolean; preferredWeightUnit: 'lb'|'kg' }

export async function loadUserSetup(client: SupabaseClient, userId: string): Promise<UserSetup> {
  const [settingsResult, profileResult] = await Promise.all([
    client.from('user_settings').select('strength_enabled,cardio_enabled,mobility_enabled,weight_enabled,preferred_weight_unit').eq('user_id', userId).single(),
    client.from('profiles').select('onboarding_completed').eq('user_id', userId).single(),
  ])
  if (settingsResult.error) { safeSupabaseDiagnostic("Startup","load user_settings",settingsResult.error);throw settingsResult.error }
  if (profileResult.error) { safeSupabaseDiagnostic("Startup","load profiles",profileResult.error);throw profileResult.error }
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
const transientSetupError=(error:unknown)=>{const value=error as{code?:string;message?:string};return value?.code==='PGRST116'||value?.code==='PGRST000'||value?.code==='PGRST001'||value?.code==='57014'||/fetch|network|timeout|no rows/i.test(value?.message??'')}

/** New auth sessions can arrive a few milliseconds before companion-row triggers are visible. */
export async function loadUserSetupWithRetry(client:SupabaseClient,userId:string,{attempts=4,wait=delay}:{attempts?:number;wait?:(milliseconds:number)=>Promise<unknown>}={}):Promise<UserSetup>{
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
