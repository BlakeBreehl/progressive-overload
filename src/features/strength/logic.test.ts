import { describe, expect, it } from 'vitest'
import { chooseDefaultLocation, detectRepetitionPrs, filterExercises, groupDailyStrength, isDuplicateExerciseName, localDateKey, localDateToIso, normalizeExerciseName, orderedSets, rankExercises, validateSet } from './logic'
import type { Exercise, StrengthSet, Workout, WorkoutDraft } from './types'

const exercise=(overrides:Partial<Exercise>={}):Exercise=>({id:'bench',userId:'u',name:'Bench Press',trackingType:'repetitions',majorMuscleGroups:['Chest'],muscleTags:['Mid Chest','Triceps'],isCompound:true,archived:false,createdAt:'2026-01-01',updatedAt:'2026-01-01',usageCount:0,lastUsedAt:null,...overrides})
const timed=(id:string,weight:number,reps:number,performedAt:string,setOrder=1)=>({id,exerciseId:'bench',trackingType:'repetitions' as const,weight,reps,setOrder,performedAt})

describe('exercise library logic',()=>{
  it('normalizes whitespace and capitalization for duplicate detection',()=>{expect(normalizeExerciseName('  BENCH   Press ')).toBe('bench press');expect(isDuplicateExerciseName(' bench PRESS ',[exercise()])).toBe(true)})
  it('filters partial names case-insensitively',()=>expect(filterExercises([exercise(),exercise({id:'squat',name:'Back Squat'})],{query:' squAT '})).toHaveLength(1))
  it('filters major muscle group',()=>expect(filterExercises([exercise(),exercise({id:'row',majorMuscleGroups:['Back']})],{group:'Back'}).map(e=>e.id)).toEqual(['row']))
  it('filters detailed muscle',()=>expect(filterExercises([exercise(),exercise({id:'fly',muscleTags:['Upper Chest']})],{muscle:'Triceps'}).map(e=>e.id)).toEqual(['bench']))
  it('combines compound filtering',()=>expect(filterExercises([exercise(),exercise({id:'fly',isCompound:false})],{group:'Chest',compoundOnly:true})).toHaveLength(1))
  it('ranks frequency, then recency, then alphabetically',()=>{const list=rankExercises([exercise({id:'a',name:'Z Press',usageCount:2,lastUsedAt:'2026-01-01'}),exercise({id:'b',name:'A Press',usageCount:2,lastUsedAt:'2026-02-01'}),exercise({id:'c',usageCount:4})]);expect(list.map(e=>e.id)).toEqual(['c','b','a'])})
})

describe('set and workout validation',()=>{
  it('accepts decimal weight with whole reps',()=>expect(validateSet({exerciseId:'bench',setOrder:1,trackingType:'repetitions',weight:52.5,reps:7})).toEqual([]))
  it('rejects negative, fractional, NaN, and infinite reps',()=>{for(const reps of [-1,1.5,NaN,Infinity])expect(validateSet({exerciseId:'bench',setOrder:1,trackingType:'repetitions',weight:10,reps}).length).toBeGreaterThan(0)})
  it('validates complete distance fields and rejects mixed fields',()=>{expect(validateSet({exerciseId:'carry',setOrder:1,trackingType:'distance',load:80,distance:25,distanceUnit:'yards',laps:4,durationSeconds:60})).toEqual([]);expect(validateSet({exerciseId:'carry',setOrder:1,trackingType:'distance',load:80,distance:25,distanceUnit:'yards',laps:4,reps:2})).toContain('Distance sets cannot include repetition fields.')})
  it('orders sets within each exercise block',()=>{const e=exercise();const draft:WorkoutDraft={date:'2026-08-30',locationId:null,notes:'',exercises:[{key:'1',exercise:e,sets:[{exerciseId:e.id,setOrder:9,trackingType:'repetitions',weight:10,reps:5},{exerciseId:e.id,setOrder:9,trackingType:'repetitions',weight:20,reps:3}]}]};expect(orderedSets(draft).map(s=>s.setOrder)).toEqual([1,2])})
  it('keeps set order unique across multiple exercises in a workout',()=>{const first=exercise(),second=exercise({id:'row',name:'Row',majorMuscleGroups:['Back']});const set=(id:string):StrengthSet=>({exerciseId:id,setOrder:1,trackingType:'repetitions',weight:10,reps:5});const draft:WorkoutDraft={date:'2026-08-30',locationId:null,notes:'',exercises:[{key:'1',exercise:first,sets:[set(first.id),set(first.id)]},{key:'2',exercise:second,sets:[set(second.id)]}]};expect(orderedSets(draft).map(s=>s.setOrder)).toEqual([1,2,3])})
})

describe('actual PR detection',()=>{
  it('marks first performance as a restrained baseline',()=>expect(detectRepetitionPrs([timed('a',100,5,'2026-01-01')])[0].kinds).toEqual(['first']))
  it('detects literal Weight and exact-weight Rep PRs',()=>{const result=detectRepetitionPrs([timed('a',100,5,'2026-01-01'),timed('b',110,4,'2026-01-02'),timed('c',110,6,'2026-01-03')]);expect(result[1].kinds).toContain('weight');expect(result[2].kinds).toContain('reps')})
  it('does not count weight or rep ties',()=>expect(detectRepetitionPrs([timed('a',100,5,'2026-01-01'),timed('b',100,5,'2026-01-02')])[1].kinds).toEqual([]))
  it('sorts chronology so future entries never affect earlier records',()=>{const result=detectRepetitionPrs([timed('future',200,2,'2026-02-01'),timed('past',100,5,'2026-01-01')]);expect(result.find(r=>r.setKey==='past')?.kinds).toEqual(['first'])})
  it('supports multiple PRs in one workout set order',()=>{const result=detectRepetitionPrs([timed('base',100,5,'2026-01-01'),timed('one',110,4,'2026-01-02',1),timed('two',120,6,'2026-01-02',2)]);expect(result.find(r=>r.setKey==='two')?.kinds).toEqual(['weight','reps'])})
  it('recalculates after editing or deleting earlier source data',()=>{const original=[timed('a',100,5,'2026-01-01'),timed('b',110,5,'2026-01-02')];expect(detectRepetitionPrs(original)[1].kinds).toContain('weight');expect(detectRepetitionPrs([original[1]])[0].kinds).toEqual(['first']);expect(detectRepetitionPrs([{...original[0],weight:120},original[1]])[1].kinds).not.toContain('weight')})
})

describe('local dates and locations',()=>{
  it('round-trips a local calendar date at a late-night time',()=>{const iso=localDateToIso('2026-08-30',new Date(2026,7,30,23,55));expect(localDateKey(iso)).toBe('2026-08-30')})
  it('selects exactly one active default location',()=>{const result=chooseDefaultLocation([{id:'a',name:'A',isDefault:true,archived:false},{id:'b',name:'B',isDefault:false,archived:false}], 'b');expect(result.filter(l=>l.isDefault).map(l=>l.id)).toEqual(['b'])})
})

describe('Strength entry boundaries',()=>{it('keeps separately saved same-day entries separate',()=>{const e=exercise(),make=(id:string,locationId:string,weight:number):Workout=>({id,performedAt:'2026-08-30T12:00:00',location:{id:locationId,name:locationId,isDefault:false,archived:false},notes:null,durationSeconds:null,sets:[{id:`${id}-set`,exerciseId:e.id,setOrder:1,trackingType:'repetitions',weight,reps:5,exercise:e}]});const groups=groupDailyStrength([make('a','home',100),make('b','home',110),make('c','gym',120)]);expect(groups).toHaveLength(3);expect(groups.map(group=>group.workouts)).toEqual([['a'],['b'],['c']]);expect(groups.map(group=>group.sets[0].weight)).toEqual([100,110,120])})})
