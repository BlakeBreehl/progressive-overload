export type ModuleKey = 'strength' | 'cardio' | 'mobility' | 'weight'
export type ModuleState = Record<ModuleKey, boolean>

export const defaultModules: ModuleState = { strength: true, cardio: true, mobility: false, weight: true }

export function enabledModuleKeys(settings: ModuleState): ModuleKey[] {
  return (Object.keys(settings) as ModuleKey[]).filter((key) => settings[key])
}

export function mergeModuleSetting(current: ModuleState, key: ModuleKey, enabled: boolean): ModuleState {
  return { ...current, [key]: enabled }
}

export function toSettingsRow(userId: string, settings: ModuleState) {
  return {
    user_id: userId,
    strength_enabled: settings.strength,
    cardio_enabled: settings.cardio,
    mobility_enabled: settings.mobility,
    weight_enabled: settings.weight,
  }
}
