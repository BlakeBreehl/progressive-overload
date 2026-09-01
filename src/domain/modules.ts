export type ModuleKey = 'strength' | 'cardio' | 'flexibility' | 'weight'
export type ModuleState = Record<ModuleKey, boolean>

export const defaultModules: ModuleState = { strength: true, cardio: true, flexibility: false, weight: true }

export function enabledModuleKeys(settings: ModuleState): ModuleKey[] {
  return (Object.keys(settings) as ModuleKey[]).filter((key) => settings[key])
}

export type PrimaryScreen = 'home' | ModuleKey | 'progress'

export function primaryNavigation(settings: ModuleState): PrimaryScreen[] {
  return ['home', ...enabledModuleKeys(settings), 'progress']
}

export function contextualAddTarget(screen: PrimaryScreen): ModuleKey | 'chooser' | null {
  if (screen === 'home') return 'chooser'
  if (screen === 'progress') return null
  return screen
}

export function mergeModuleSetting(current: ModuleState, key: ModuleKey, enabled: boolean): ModuleState {
  return { ...current, [key]: enabled }
}

export function toSettingsRow(userId: string, settings: ModuleState) {
  return {
    user_id: userId,
    strength_enabled: settings.strength,
    cardio_enabled: settings.cardio,
    // The applied database contract retains its original mobility identifier.
    mobility_enabled: settings.flexibility,
    weight_enabled: settings.weight,
  }
}
