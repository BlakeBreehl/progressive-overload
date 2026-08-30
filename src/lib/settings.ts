import type { SupabaseClient } from '@supabase/supabase-js'
import { defaultModules, toSettingsRow, type ModuleState } from '../domain/modules'

export type UserSetup = { modules: ModuleState; onboardingCompleted: boolean }

export async function loadUserSetup(client: SupabaseClient, userId: string): Promise<UserSetup> {
  const [settingsResult, profileResult] = await Promise.all([
    client.from('user_settings').select('strength_enabled,cardio_enabled,mobility_enabled,weight_enabled').eq('user_id', userId).single(),
    client.from('profiles').select('onboarding_completed').eq('user_id', userId).single(),
  ])
  if (settingsResult.error) throw settingsResult.error
  if (profileResult.error) throw profileResult.error
  return {
    modules: {
      strength: settingsResult.data.strength_enabled,
      cardio: settingsResult.data.cardio_enabled,
      mobility: settingsResult.data.mobility_enabled,
      weight: settingsResult.data.weight_enabled,
    },
    onboardingCompleted: profileResult.data.onboarding_completed,
  }
}

export async function saveModuleSettings(client: SupabaseClient, userId: string, settings: ModuleState): Promise<void> {
  const { error } = await client.from('user_settings').upsert(toSettingsRow(userId, settings), { onConflict: 'user_id' })
  if (error) throw error
}

export async function completeOnboarding(client: SupabaseClient, userId: string, settings = defaultModules): Promise<void> {
  await saveModuleSettings(client, userId, settings)
  const { error } = await client.from('profiles').update({ onboarding_completed: true }).eq('user_id', userId)
  if (error) throw error
}
