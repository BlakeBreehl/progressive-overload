import { describe, expect, it } from 'vitest'
import { filterFlexibilityActivities, totalFlexibilityDuration, validateFlexibility } from './logic'

describe('Flexibility logic', () => {
  it('validates duration per set and whole set counts', () => {
    expect(validateFlexibility(0, 1)).not.toHaveLength(0)
    expect(validateFlexibility(30, 1.5)).not.toHaveLength(0)
    expect(validateFlexibility(30, 3)).toEqual([])
    expect(totalFlexibilityDuration(30, 3)).toBe(90)
  })

  it('filters by stretch name and body area', () => {
    const items = [{ name: 'Doorway Chest', areas: ['Chest'] }, { name: 'Couch Stretch', areas: ['Quads', 'Hips'] }]
    expect(filterFlexibilityActivities(items, 'couch', 'Hips')).toEqual([items[1]])
  })
})
