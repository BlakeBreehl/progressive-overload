import { expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'node:fs'
import { workoutEditDraft } from './exerciseChange'
import { newQuickLift, quickLiftFromWorkout, quickLiftToWorkout, validateQuickLift } from './quickLog'
import { saveWorkout } from './repository'
import type { Exercise, Workout } from './types'

const exercise: Exercise = { id:'bench', userId:'u', name:'Bench Press', trackingType:'repetitions', majorMuscleGroups:['Chest'], muscleTags:[], isCompound:true, archived:false, createdAt:'', updatedAt:'', usageCount:0, lastUsedAt:null }
const read = (path:string) => readFileSync(new URL(path, import.meta.url), 'utf8')

it('keeps overall duration out of all Strength screens, including shared history, details, success and legacy editing', () => {
  for (const file of readdirSync(new URL('./', import.meta.url)).filter(name=>name.endsWith('.tsx')&&!name.includes('.test.'))) {
    const source=read(file)
    expect(source).not.toMatch(/workout\s+duration/i)
    expect(source).not.toMatch(/(?:draft|workout|entry|success)\??\.durationSeconds/)
  }
  const progress=read('../progress/ProgressFeature.tsx')
  expect(progress).not.toMatch(/workout\s+duration|workout\??\.(?:durationSeconds|duration_seconds)/i)
  expect(read('StrengthFeature.tsx')).toContain('value={set.durationSeconds ?? ""}')
  expect(read('../cardio/CardioFeature.tsx')).toContain('<DurationWheel')
  expect(read('../flexibility/FlexibilityFeature.tsx')).toContain('label={`Set ${index + 1} duration`}')
})

it.each(['repetitions','distance'] as const)('saves new %s entries with a neutral overall duration and retains distance-set time', async trackingType => {
  const draft={...newQuickLift([], '2026-09-29'),exercise:{...exercise,trackingType},weight:'100',reps:'5',load:'50',distance:'20',laps:'2',durationSeconds:trackingType==='distance'?'45':''}
  expect(validateQuickLift(draft)).toEqual({})
  const rpc=vi.fn().mockResolvedValue({data:'new',error:null})
  await saveWorkout({rpc} as unknown as SupabaseClient,'u',quickLiftToWorkout(draft))
  expect(rpc.mock.calls[0][1].p_workout.duration_seconds).toBeNull()
  expect(rpc.mock.calls[0][1].p_sets[0].duration_seconds).toBe(trackingType==='distance'?45:null)
})

it.each(['quick','single','legacy'] as const)('preserves hidden historical duration through %s edits and subsequent saves', async mode => {
  const original:Workout={id:'old',performedAt:'2020-01-01T12:00:00Z',location:null,notes:'old note',durationSeconds:1234,sets:[{id:'set',exerciseId:exercise.id,exercise,trackingType:'repetitions',setOrder:1,weight:100,reps:5}]}
  if(mode==='legacy') original.sets.push({...original.sets[0],id:'other-set',exerciseId:'other',exercise:{...exercise,id:'other'},setOrder:2})
  const draft=mode==='quick'?quickLiftToWorkout(quickLiftFromWorkout(original)):workoutEditDraft(original)
  expect(draft.exercises).toHaveLength(mode==='legacy'?2:1)
  const rpc=vi.fn().mockResolvedValue({data:'old',error:null})
  draft.notes='changed note'
  await saveWorkout({rpc} as unknown as SupabaseClient,'u',draft)
  draft.locationId='new-location'
  await saveWorkout({rpc} as unknown as SupabaseClient,'u',draft)
  for(const [,payload] of rpc.mock.calls) {
    expect(payload.p_workout.duration_seconds).toBe(1234)
    expect(payload.p_sets).toHaveLength(original.sets.length)
  }
  expect(original.durationSeconds).toBe(1234)
})
