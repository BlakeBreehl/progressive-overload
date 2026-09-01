import { describe, expect, it } from 'vitest'
import { defaultModules, enabledModuleKeys, mergeModuleSetting, toSettingsRow } from './modules'

describe('module settings', () => {
  it('uses Flexibility as the application module key', () => {
    expect(enabledModuleKeys({ ...defaultModules, flexibility: true })).toContain('flexibility')
  })

  it('hides disabled modules from derived navigation', () => expect(enabledModuleKeys({ ...defaultModules, cardio: false })).not.toContain('cardio'))
  it('changes only the requested preference', () => {
    const next = mergeModuleSetting(defaultModules, 'strength', false)
    expect(next).toEqual({ ...defaultModules, strength: false })
    expect(defaultModules.strength).toBe(true)
  })
  it('maps Flexibility to the existing database column without any delete instruction', () => {
    const row = toSettingsRow('user-1', { ...defaultModules, flexibility: true })
    expect(row).toMatchObject({ user_id: 'user-1', mobility_enabled: true })
    expect(Object.keys(row).some((key) => key.includes('delete'))).toBe(false)
  })
})
