import { describe, expect, it } from 'vitest'
import { contextualAddTarget, primaryNavigation } from './modules'

describe('primary navigation and Add behavior', () => {
  const enabled = { strength: true, cardio: false, flexibility: true, weight: false }

  it('shows enabled modules and Progress, never Settings', () => {
    expect(primaryNavigation(enabled)).toEqual(['home', 'strength', 'flexibility', 'progress'])
    expect(primaryNavigation(enabled)).not.toContain('settings')
  })

  it('uses contextual module entry and the Home chooser', () => {
    expect(contextualAddTarget('home')).toBe('chooser')
    expect(contextualAddTarget('strength')).toBe('strength')
    expect(contextualAddTarget('progress')).toBeNull()
  })
})
