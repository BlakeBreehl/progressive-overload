import { describe, expect, it } from 'vitest'
import { cardioFields, durationToSeconds, formatDuration, validateCardio } from './logic'

describe('Cardio validation', () => {
  it('converts and formats structured durations', () => {
    expect(durationToSeconds(1, 2, 3)).toBe(3723)
    expect(formatDuration(3723)).toBe('1h 2m 3s')
  })

  it('rejects zero and invalid duration parts', () => {
    expect(validateCardio({ activityName: 'Running', hours: 0, minutes: 0, seconds: 0 })).toContainEqual(expect.stringContaining('at least one second'))
    expect(validateCardio({ activityName: 'Running', hours: 0, minutes: 60, seconds: 0 })).not.toHaveLength(0)
  })

  it('keeps activity-specific fields distinct', () => {
    expect(cardioFields('Treadmill')).toEqual({ distance: true, speed: true, incline: true, difficulty: false })
    expect(cardioFields('StairMaster')).toEqual({ distance: false, speed: false, incline: false, difficulty: true })
  })
})
