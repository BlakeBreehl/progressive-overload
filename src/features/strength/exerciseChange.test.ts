import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { changeExercise, exerciseChangeWarning, workoutEditDraft } from './exerciseChange'
import type { Exercise, Workout } from './types'
import { saveWorkout } from './repository'
import { detectRepetitionPrs } from './logic'
import { strengthPrEvidence, type StrengthProgressRow } from '../progress/repository'
import { strengthModePoints } from '../progress/strengthModes'

const exercise = (id: string, fields: Partial<Exercise> = {}): Exercise => ({ id, name:id, userId:'u', trackingType:'repetitions', loadMode:'weight_reps', progressionDirection:'higher_is_better', majorMuscleGroups:['Shoulders'], muscleTags:[], archived:false, isCompound:false, createdAt:'', updatedAt:'', usageCount:0, lastUsedAt:null, ...fields })
const shoulder = exercise('Shoulder Press'), military = exercise('Military Press')
const workout = (definition = shoulder, count = 3): Workout => ({ id:'existing', createdAt:'2020-01-01T09:13:22Z', performedAt:'2020-01-01T09:13:22Z', notes:'workout notes', durationSeconds:1234, location:null, sets:Array.from({length:count}, (_,i) => ({id:`set-${i}`, clientKey:`row-${i}`, exerciseId:definition.id, exercise:definition, setOrder:i+1, trackingType:definition.trackingType, loadMode:definition.loadMode, progressionDirection:definition.progressionDirection, weight:40+i, weightUnit:'kg', reps:8+i, durationSeconds:23+i, notes:`note ${i}`})) })

describe('existing Strength exercise edits', () => {
  it.each([1,3])('preserves %i set identities, metadata, ordering and the exact update target', async count => {
    const original = workout(shoulder,count); original.sets.forEach(set=>{set.setOrder*=3}); const draft = workoutEditDraft(original), before = structuredClone(draft)
    draft.exercises[0] = changeExercise(draft.exercises[0],military)
    expect(exerciseChangeWarning(shoulder,military)).toBe('')
    expect(draft).toEqual({...before,exercises:[{...before.exercises[0],exercise:military,sets:before.exercises[0].sets.map(set=>({...set,exerciseId:military.id}))}]})
    const rpc = vi.fn().mockResolvedValue({data:original.id,error:null})
    expect(await saveWorkout({rpc} as unknown as SupabaseClient,'u',draft)).toBe(original.id)
    expect(rpc).toHaveBeenCalledOnce()
    const payload = rpc.mock.calls[0][1]
    expect(payload.p_workout).toEqual({id:original.id,performed_at:original.performedAt,location_id:null,notes:original.notes,duration_seconds:original.durationSeconds})
    expect(payload.p_sets.map((set: {id:string})=>set.id)).toEqual(original.sets.map(set=>set.id))
    expect(payload.p_sets.map((set: {duration_seconds:number})=>set.duration_seconds)).toEqual(original.sets.map(set=>set.durationSeconds))
    expect(payload.p_sets.map((set: {set_order:number})=>set.set_order)).toEqual(original.sets.map(set=>set.setOrder))
    expect(payload.p_workout).not.toHaveProperty('created_at')
    expect(JSON.stringify(payload)).not.toMatch(/pr_badge|is_pr/)
  })
  it('preserves assistance and reps; requires confirmation when weight meaning changes', () => {
    const assisted = exercise('Assisted Pull Up',{progressionDirection:'lower_is_better'}), next=exercise('Assisted Chin Up',{progressionDirection:'lower_is_better'})
    const block=workoutEditDraft(workout(assisted)).exercises[0]
    expect(exerciseChangeWarning(assisted,next)).toBe('')
    expect(changeExercise(block,next).sets.map(s=>[s.id,s.weight,s.reps])).toEqual(block.sets.map(s=>[s.id,s.weight,s.reps]))
    expect(exerciseChangeWarning(shoulder,assisted)).toContain('assistance weight')
    expect(exerciseChangeWarning(assisted,shoulder)).toContain('lifted weight')
  })
  it('does not mutate a proposed/cancelled conversion; confirmed reps-only clears only weight', () => {
    const block=workoutEditDraft(workout()).exercises[0], before=structuredClone(block), next=exercise('arbitrary name',{loadMode:'reps_only'})
    expect(exerciseChangeWarning(block.exercise,next)).toContain('Weight values will be removed')
    expect(block).toEqual(before)
    const changed=changeExercise(block,next)
    expect(changed.sets).toEqual(block.sets.map(({weight: _weight,...set})=>({...set,exerciseId:next.id,loadMode:'reps_only'})))
    expect(block).toEqual(before)
  })
  it('preserves every distance row and removes only schema-incompatible fields on conversion', () => {
    const sled=exercise('Sled Push',{trackingType:'distance'}), yoke=exercise('Yoke Carry',{trackingType:'distance'}), original=workout(sled)
    original.sets=original.sets.map(({weight:_weight,reps:_reps,...set},i)=>({...set,load:80+i,distance:20+i,distanceUnit:'yards',laps:2+i}))
    const block=workoutEditDraft(original).exercises[0]
    expect(exerciseChangeWarning(sled,yoke)).toBe('')
    expect(changeExercise(block,yoke).sets).toEqual(block.sets.map(set=>({...set,exerciseId:yoke.id})))
    const changed=changeExercise(block,military)
    expect(changed.sets.map(s=>[s.id,s.load,s.durationSeconds,s.notes])).toEqual(block.sets.map(s=>[s.id,s.load,s.durationSeconds,s.notes]))
    expect(changed.sets.every(s=>s.distance===undefined&&s.distanceUnit===undefined&&s.laps===undefined)).toBe(true)
    expect(changeExercise(workoutEditDraft(workout()).exercises[0],sled).sets.every(s=>s.weight===undefined&&s.reps===undefined)).toBe(true)
  })
  it('retains the complete edited draft after a failed save and rapid compatible changes', async () => {
    const draft=workoutEditDraft(workout())
    for(const definition of [military,shoulder,military]) draft.exercises[0]=changeExercise(draft.exercises[0],definition)
    const before=structuredClone(draft), rpc=vi.fn().mockResolvedValue({error:new Error('offline')})
    await expect(saveWorkout({rpc} as unknown as SupabaseClient,'u',draft)).rejects.toThrow('offline')
    expect(draft).toEqual(before)
  })
  it('preserves interleaved set order and explicit locations on hydration', () => {
    const original=workout(); original.location={id:'gym',name:'Gym',archived:false,isDefault:false}
    original.sets[1]={...original.sets[1],exerciseId:military.id,exercise:military}
    const draft=workoutEditDraft(original)
    expect(draft.exercises.flatMap(b=>b.sets.map(s=>s.id))).toEqual(original.sets.map(s=>s.id))
    expect(draft.locationId).toBe('gym')
  })
  it('recalculates PR evidence and Progress membership for the destination exercise', () => {
    const row=(id:string,exerciseId:string,weight:number,date:string):StrengthProgressRow=>({id,exercise_id:exerciseId,set_order:1,tracking_type:'repetitions',weight,reps:5,load:null,distance:null,distance_unit:null,laps:null,duration_seconds:null,exercise:{id:exerciseId,load_mode:'weight_reps'},workout:{id,performed_at:date,created_at:date,location:null}})
    const rows=[row('prior',military.id,10,'2020-01-01'),row('edited',shoulder.id,50,'2020-02-01')]
    expect(detectRepetitionPrs(strengthPrEvidence(rows)).find(s=>s.setKey==='edited')?.kinds).toEqual(['first'])
    const changed=[rows[0],{...rows[1],exercise_id:military.id,exercise:{id:military.id,load_mode:'weight_reps'}}]
    expect(detectRepetitionPrs(strengthPrEvidence(changed)).find(s=>s.setKey==='edited')?.kinds).toEqual(['weight'])
    expect(strengthModePoints(changed,shoulder.id,'all')).toHaveLength(0)
    expect(strengthModePoints(changed,military.id,'all')).toHaveLength(2)
    expect(rows[0]).toEqual(changed[0])
  })
})
