import { describe, expect, it } from 'vitest'
import { isValidHistoricalPeriod, validateStrengthSet } from './validation'

describe('strength data validation', () => {
  it('accepts weighted repetition sets', () => expect(validateStrengthSet({ trackingType:'repetitions', weight:185, reps:5, difficulty:8 })).toEqual([]))
  it('accepts loaded distance and lap sets with duration', () => expect(validateStrengthSet({ trackingType:'distance', load:90, distance:40, distanceUnit:'yards', laps:2, durationSeconds:35 })).toEqual([]))
  it('rejects mixed repetition and distance fields', () => expect(validateStrengthSet({ trackingType:'repetitions', reps:5, distance:100 })).toContain('repetition sets cannot contain distance fields'))
  it('rejects invalid difficulty and negative numeric values', () => expect(validateStrengthSet({ trackingType:'repetitions', reps:-1, difficulty:11 })).toHaveLength(2))
  it('distinguishes normalized monthly and yearly history periods', () => {
    expect(isValidHistoricalPeriod('monthly','2026-08-01')).toBe(true)
    expect(isValidHistoricalPeriod('monthly','2026-08-30')).toBe(false)
    expect(isValidHistoricalPeriod('yearly','2026-01-01')).toBe(true)
    expect(isValidHistoricalPeriod('yearly','2026-08-01')).toBe(false)
  })
})
