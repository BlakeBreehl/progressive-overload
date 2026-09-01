import { describe, expect, it } from 'vitest'
import { isQuickWorkout, localToday, newQuickLift, quickLiftFromWorkout, quickLiftToWorkout, validateQuickLift } from './quickLog'
import type { Exercise, Location, Workout } from './types'

const repetitionExercise: Exercise = { id:'bench', userId:'user', name:'Bench Press', trackingType:'repetitions', majorMuscleGroups:['Chest'], muscleTags:['Mid Chest'], isCompound:true, archived:false, createdAt:'2026-01-01', updatedAt:'2026-01-01', usageCount:3, lastUsedAt:null }
const distanceExercise: Exercise = { ...repetitionExercise, id:'sled', name:'Sled Push', trackingType:'distance' }
const locations: Location[] = [{ id:'home', name:'Home', isDefault:true, archived:false }]

describe('Strength quick log', () => {
  it('requires an exercise, weight, and positive whole reps', () => {
    const empty = newQuickLift([], '2026-08-31')
    expect(validateQuickLift(empty)).toMatchObject({ exercise:expect.any(String) })
    expect(validateQuickLift({ ...empty, exercise:repetitionExercise })).toMatchObject({ weight:expect.any(String), reps:expect.any(String) })
    expect(validateQuickLift({ ...empty, exercise:repetitionExercise, weight:'-1', reps:'2.5' })).toMatchObject({ weight:expect.any(String), reps:expect.any(String) })
  })

  it('accepts decimal weights and an optional location', () => {
    const draft = { ...newQuickLift([], '2026-08-30', null), exercise:repetitionExercise, weight:'52.5', reps:'8' }
    expect(validateQuickLift(draft)).toEqual({})
    expect(draft.locationId).toBeNull()
    expect(draft.date).toBe('2026-08-30')
  })

  it('uses the local calendar date and allows the date to be replaced', () => {
    expect(localToday(new Date(2026, 7, 31, 23, 59))).toBe('2026-08-31')
    expect({ ...newQuickLift([]), date:'2025-12-24' }.date).toBe('2025-12-24')
  })

  it('prefills a default location, permits clearing it, and clears lift fields for the next entry', () => {
    const first = { ...newQuickLift(locations, '2026-08-31'), exercise:repetitionExercise, weight:'100', reps:'5' }
    expect(first.locationId).toBe('home')
    expect({ ...first, locationId:null }.locationId).toBeNull()
    const next = newQuickLift(locations, first.date, first.locationId)
    expect(next).toMatchObject({ date:'2026-08-31', locationId:'home', exercise:null, weight:'', reps:'' })
  })

  it('creates exactly one ordered set in one exercise result', () => {
    const workout = quickLiftToWorkout({ ...newQuickLift([], '2026-08-31'), exercise:repetitionExercise, weight:'147.5', reps:'4' })
    expect(workout.exercises).toHaveLength(1)
    expect(workout.exercises[0].sets).toHaveLength(1)
    expect(workout.exercises[0].sets[0]).toMatchObject({ exerciseId:'bench', setOrder:1, weight:147.5, reps:4 })
  })

  it('validates and maps distance-only fields', () => {
    const draft = { ...newQuickLift([], '2026-08-31'), exercise:distanceExercise, load:'90', distance:'20', distanceUnit:'yards' as const, laps:'3', durationSeconds:'45' }
    expect(validateQuickLift(draft)).toEqual({})
    expect(quickLiftToWorkout(draft).exercises[0].sets[0]).toMatchObject({ trackingType:'distance', load:90, distance:20, distanceUnit:'yards', laps:3, durationSeconds:45, setOrder:1 })
  })

  it('uses quick editing only for one-set records and retains their local date', () => {
    const workout: Workout = { id:'workout', performedAt:new Date(2026,7,31,12).toISOString(), location:locations[0], notes:null, durationSeconds:null, sets:[{ id:'set', exerciseId:'bench', setOrder:1, trackingType:'repetitions', weight:100, reps:5, exercise:repetitionExercise }] }
    expect(isQuickWorkout(workout)).toBe(true)
    expect(quickLiftFromWorkout(workout).date).toBe('2026-08-31')
    expect(isQuickWorkout({ ...workout, sets:[...workout.sets, { ...workout.sets[0], id:'set-2', setOrder:2 }] })).toBe(true)
  })

})
