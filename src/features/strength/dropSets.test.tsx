import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { blankDropSet, duplicateSet, isCountableMainSet, performances } from './dropSets'
import { detectRepetitionPrs, validateWorkout } from './logic'
import { changeExercise, workoutEditDraft } from './exerciseChange'
import { quickLiftFromWorkout, quickLiftToWorkout, isQuickWorkout } from './quickLog'
import { saveWorkout, parseWorkoutRows } from './repository'
import { SetRow, DropSetHistory } from './StrengthFeature'
import { summarizeSetPeriod, countSetGroups } from './setBreakdown'
import { setTrend } from './setTrend'
import { summarizeExercises } from './exerciseSummary'
import { strengthModePoints } from '../progress/strengthModes'
import { strengthPrEvidence, strengthPerformances, strengthExerciseUsage, type StrengthProgressRow } from '../progress/repository'
import { prHistory } from '../progress/prHistory'
import type { Exercise, StrengthSet, Workout } from './types'

const exercise:Exercise={id:'ex',userId:'u',name:'Bench',trackingType:'repetitions',loadMode:'weight_reps',progressionDirection:'higher_is_better',majorMuscleGroups:['Chest'],muscleTags:[],isCompound:true,archived:false,createdAt:'',updatedAt:'',usageCount:0,lastUsedAt:null}
const main:StrengthSet={id:'main',clientKey:'main',exerciseId:'ex',setOrder:1,trackingType:'repetitions',loadMode:'weight_reps',weight:225,reps:8,dropSets:[{id:'d1',clientKey:'d1',exerciseId:'ex',setOrder:1,trackingType:'repetitions',weight:185,reps:10},{id:'d2',clientKey:'d2',exerciseId:'ex',setOrder:1,trackingType:'repetitions',weight:135,reps:12}]}
const workout:Workout={id:'w',performedAt:'2026-11-13T12:00:00Z',location:null,notes:'shared',durationSeconds:null,sets:[{...main,exercise}]}
const progress=(id:string,date:string,weight:number,drops:StrengthProgressRow['drop_sets']=[]):StrengthProgressRow=>({id,exercise_id:'ex',set_order:1,tracking_type:'repetitions',weight,reps:8,load:null,distance:null,distance_unit:null,laps:null,duration_seconds:null,exercise:{id:'ex',name:'Bench',major_muscle_group:'Chest',progression_direction:'higher_is_better'},workout:{id:'w'+id,performed_at:date,created_at:date,location:null},drop_sets:drops})
const rows=[progress('old','2026-10-01T12:00:00Z',100),progress('new','2026-11-01T12:00:00Z',110,[{id:'drop',drop_order:1,weight:120,reps:9}])]
const render=(set:StrengthSet)=>renderToStaticMarkup(<SetRow set={set} index={0} unit="lb" busy={false} canRemove showNumber={false} onChange={()=>{}} onRemove={()=>{}} onDuplicate={()=>{}}/>)

describe('nested drop set model and rendering',()=>{
  it('starts blank and duplicates all rows with fresh client identities',()=>{
    const blank=blankDropSet(main);expect(blank.weight).toBeUndefined();expect(blank.reps).toBeUndefined()
    const copy=duplicateSet(main);expect(copy.id).toBeUndefined();expect(copy.clientKey).not.toBe(main.clientKey)
    expect(copy.dropSets?.map(s=>[s.weight,s.reps])).toEqual([[185,10],[135,12]])
    expect(copy.dropSets?.every(s=>!s.id&&s.clientKey)).toBe(true)
    expect(duplicateSet(main.dropSets![0]).weight).toBe(185)
  })
  it('renders labels only for nested groups and renumbers after removal',()=>{
    expect(render(main)).toContain('Drop Set 2')
    expect(render(main)).toContain('Main Set')
    const remaining={...main,dropSets:main.dropSets!.slice(1)}
    expect(render(remaining)).toContain('Drop Set 1');expect(render(remaining)).not.toContain('Drop Set 2')
    expect(render({...main,dropSets:[]})).not.toContain('Main Set')
    expect(render({...main,dropSets:[]})).not.toContain('SET 1')
  })
  it('supports reps-only, assistance, zero attempts and hides distance drops',()=>{
    expect(render({...main,weight:undefined,loadMode:'reps_only',dropSets:[]})).not.toContain('Weight (')
    expect(render({...main,progressionDirection:'lower_is_better',dropSets:[]})).toContain('Assistance')
    expect(render({...main,trackingType:'distance',dropSets:[]})).not.toContain('Add Drop Set')
    const draft=workoutEditDraft(structuredClone(workout));draft.exercises[0].sets[0].dropSets![0].reps=0
    expect(validateWorkout(draft)).toEqual([])
    draft.exercises[0].sets[0].dropSets![0].reps=undefined
    expect(validateWorkout(draft).join()).toContain('Reps must')
  })
  it('restores and preserves IDs and nested values across compatible changes and both converters',()=>{
    const draft=workoutEditDraft(workout),block=changeExercise(draft.exercises[0],{...exercise,id:'new',name:'New Bench'})
    expect(block.sets[0].dropSets?.[1]).toMatchObject({id:'d2',exerciseId:'new',weight:135,reps:12})
    expect(changeExercise(block,{...exercise,loadMode:'reps_only'}).sets[0].dropSets?.[0].weight).toBeUndefined()
    expect(changeExercise(block,{...exercise,trackingType:'distance'}).sets[0].dropSets).toEqual([])
    expect(isQuickWorkout(workout)).toBe(false)
    expect(quickLiftToWorkout(quickLiftFromWorkout(workout)).exercises[0].sets[0].dropSets?.[1]).toMatchObject({id:'d2',weight:135,reps:12})
  })
  it('serializes one atomic call and retains the complete draft after failure',async()=>{
    const rpc=vi.fn().mockResolvedValue({data:null,error:new Error('offline')}),draft=workoutEditDraft(workout),before=JSON.stringify(draft)
    await expect(saveWorkout({rpc} as unknown as SupabaseClient,'u',draft)).rejects.toThrow('offline')
    expect(rpc).toHaveBeenCalledTimes(1);expect(rpc.mock.calls[0][1].p_sets[0].drop_sets).toEqual([{id:'d1',drop_order:1,weight:185,weight_unit:'lb',reps:10},{id:'d2',drop_order:2,weight:135,weight_unit:'lb',reps:12}])
    expect(JSON.stringify(draft)).toBe(before)
  })
  it('explicitly clears saved drops when a confirmed exercise change switches to distance',async()=>{
    const draft=workoutEditDraft(workout)
    draft.exercises[0]=changeExercise(draft.exercises[0],{...exercise,trackingType:'distance'})
    Object.assign(draft.exercises[0].sets[0],{load:0,distance:20,distanceUnit:'meters',laps:1})
    const rpc=vi.fn().mockResolvedValue({data:'w',error:null})
    await saveWorkout({rpc} as unknown as SupabaseClient,'u',draft)
    expect(rpc.mock.calls[0][1].p_sets[0]).toMatchObject({id:'main',tracking_type:'distance',drop_sets:[]})
    expect(workout.sets[0].dropSets).toHaveLength(2)
  })
  it('parses database nested ordering and displays actual history performances',()=>{
    const parsed=parseWorkoutRows([{id:'w',performed_at:workout.performedAt,duration_seconds:null,notes:null,location:null,sets:[{id:'m',exercise_id:'ex',set_order:1,tracking_type:'repetitions',weight:225,reps:8,exercise:{id:'ex',user_id:'u',name:'Bench',tracking_type:'repetitions',major_muscle_group:'Chest'},drop_sets:[{id:'b',drop_order:2,weight:135,reps:12},{id:'a',drop_order:1,weight:185,reps:10}]}]}] as never)[0]
    expect(parsed.sets[0].dropSets?.map(s=>s.id)).toEqual(['a','b'])
    const html=renderToStaticMarkup(<DropSetHistory set={parsed.sets[0]} unit="lb" prs={new Map()}/>);expect(html).toContain('Drop Set 2');expect(html).toContain('135 lb')
  })
})

describe('count and performance boundaries',()=>{
  it('counts main sets only across periods, muscle groups, home and usage adapters',()=>{
    const expanded=strengthPerformances(rows)
    expect(expanded).toHaveLength(3);expect(countSetGroups(expanded.map(row=>({...row,id:row.id!}))).total).toBe(2)
    expect(countSetGroups(expanded.map(row=>({...row,id:row.id!}))).groups.find(g=>g.name==='Chest')?.value).toBe(2)
    for(const months of [0,1,3,6,12])expect(summarizeSetPeriod(rows,months,new Date('2026-11-13')).total).toBe(months===1?1:2)
    expect(strengthExerciseUsage(expanded)).toHaveLength(2)
    expect(setTrend(expanded,'all',{now:new Date('2026-11-13')}).reduce((sum,p)=>sum+p.total,0)).toBe(2)
    expect(summarizeExercises([exercise],rows)[0].usageCount).toBe(2)
    expect(isCountableMainSet({trackingType:'repetitions',reps:0})).toBe(false)
  })
  it('includes drops in graphs and exclusive chronological PRs and PR timelines',()=>{
    expect(strengthModePoints(rows,'ex','all')).toHaveLength(3)
    const badges=detectRepetitionPrs(strengthPrEvidence([...rows].reverse()))
    expect(badges.find(p=>p.setKey==='drop')?.kinds).toEqual(['weight'])
    expect(prHistory(rows,'monthly').find(p=>p.period==='2026-11')?.weight).toBe(2)
    expect(summarizeSetPeriod(rows,1,new Date('2026-11-13')).weightPrs).toBe(2)
    const attempts=performances({...main,performedAt:'2026-11-13',dropSets:[{...main.dropSets![0],reps:0}]})
    expect(detectRepetitionPrs(attempts).find(p=>p.setKey==='d1')?.kinds).toEqual([])
  })
  it('legacy workouts remain one ordinary main row per stored set',()=>{
    expect(strengthPerformances([progress('legacy','2026-11-01',100)])).toHaveLength(1)
    expect(render({...main,dropSets:undefined})).not.toContain('Main Set')
  })
  it.each([
    {direction:'higher_is_better' as const,weight:100,dropWeight:100,kind:'reps'},
    {direction:'higher_is_better' as const,weight:100,dropWeight:110,kind:'weight'},
    {direction:'lower_is_better' as const,weight:100,dropWeight:90,kind:'weight'},
    {direction:'higher_is_better' as const,weight:undefined,dropWeight:undefined,kind:'reps'},
  ])('classifies nested $direction $kind exclusively',({direction,weight,dropWeight,kind})=>{
    const timed=[{...main,id:'prior',weight,reps:5,dropSets:undefined,performedAt:'2026-10-01',workoutId:'prior',progressionDirection:direction},
      {...main,id:'next',weight,reps:5,performedAt:'2026-11-01',workoutId:'next',progressionDirection:direction,
        dropSets:[{...main.dropSets![0],weight:dropWeight,reps:10}]}]
    const prs=detectRepetitionPrs(timed)
    expect(prs.find(p=>p.setKey==='prior')?.kinds).toEqual(['first'])
    expect(prs.find(p=>p.setKey==='d1')?.kinds).toEqual([kind])
    expect(detectRepetitionPrs([...timed].reverse())).toEqual(prs)
  })
})

