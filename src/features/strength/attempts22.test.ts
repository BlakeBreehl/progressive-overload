import {describe,expect,it,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {detectRepetitionPrs,validateSet,validateWorkout} from './logic';
import {newQuickLift,quickLiftToWorkout,validateQuickLift,quickLiftFromWorkout} from './quickLog';
import {parseWorkoutRows,saveWorkout,getExercises} from './repository';
import {strengthModePoints} from '../progress/strengthModes';
import {strengthPrEvidence,strengthExerciseUsage,type StrengthProgressRow} from '../progress/repository';
import {setTrend} from './setTrend';
import {countSetGroups} from './setBreakdown';
import type {Exercise} from './types';
const exercise:Exercise={id:'e',userId:'u',name:'Bench Press',trackingType:'repetitions',loadMode:'weight_reps',majorMuscleGroups:['Chest'],muscleTags:[],isCompound:true,archived:false,createdAt:'',updatedAt:'',usageCount:0,lastUsedAt:null};
const row=(id:string,weight:number,reps:number,direction='higher_is_better'):StrengthProgressRow=>({id,exercise_id:'e',set_order:1,tracking_type:'repetitions',weight,reps,load:null,distance:null,distance_unit:null,laps:null,duration_seconds:null,exercise:{id:'e',name:'Bench Press',tracking_type:'repetitions',major_muscle_group:'Chest',progression_direction:direction},workout:{id,performed_at:`2026-09-0${id}T12:00:00Z`,created_at:`2026-09-0${id}T12:00:00Z`,location:null}});
describe('unsuccessful Strength attempts',()=>{
 it.each(['weight_reps','reps_only','assisted'])('saves and reloads zero exactly for %s',async mode=>{
  const definition={...exercise,loadMode:mode==='reps_only'?'reps_only' as const:'weight_reps' as const,progressionDirection:mode==='assisted'?'lower_is_better' as const:'higher_is_better' as const};
  const draft={...newQuickLift([],'2026-09-01'),exercise:definition,sets:[{weight:mode==='reps_only'?'':'300',reps:'0'}]};
  expect(validateQuickLift(draft)).toEqual({});const mapped=quickLiftToWorkout(draft);expect(validateWorkout(mapped)).toEqual([]);
  const rpc=vi.fn().mockResolvedValue({data:'w',error:null});await saveWorkout({rpc}as unknown as SupabaseClient,'u',mapped);
  const payload=rpc.mock.calls[0][1];expect(payload.p_sets[0].reps).toBe(0);expect(payload.p_sets[0].weight).toBe(mode==='reps_only'?undefined:300);
  const reloaded=parseWorkoutRows([{...payload.p_workout,id:'w',location:null,sets:payload.p_sets.map((set:object)=>({...set,id:'s',exercise:{id:'e',name:'Bench',tracking_type:'repetitions',major_muscle_group:'Chest'}}))}])[0];
  expect(reloaded.sets[0].reps).toBe(0);expect(quickLiftFromWorkout(reloaded).sets[0].reps).toBe('0');
 });
 it.each(['',' ','-1','1.5','abc','NaN','Infinity','9007199254740992'])('rejects invalid reps %j',reps=>{expect(validateQuickLift({...newQuickLift([]),exercise,sets:[{weight:'100',reps}]}).reps).toBeTruthy();expect(validateSet({exerciseId:'e',setOrder:1,trackingType:'repetitions',weight:100,reps:reps.trim()===''?undefined:Number(reps)})).not.toEqual([]);});
 it.each(['higher_is_better','lower_is_better'])('ignores attempts before all %s chronology and graphs',direction=>{
  const rows=[row('1',direction==='higher_is_better'?300:0,0,direction),row('2',225,5,direction),row('3',direction==='higher_is_better'?300:200,1,direction)];
  expect(detectRepetitionPrs(strengthPrEvidence(rows)).map(x=>x.kinds)).toEqual([[],['first'],['weight']]);
  for(const mode of ['one','repWeight','all'] as const)expect(strengthModePoints(rows,'e',mode).some(point=>point.id==='1')).toBe(false);
  expect(strengthExerciseUsage(rows)).toHaveLength(2);
  expect(countSetGroups(rows.map(r=>({...r,id:r.id!}))).total).toBe(2);expect(setTrend(rows,'all',{now:new Date(2027,0,1)})[0].total).toBe(2);
  rows[1].reps=0;expect(detectRepetitionPrs(strengthPrEvidence(rows)).map(x=>x.kinds)).toEqual([[],[],['first']]);
  rows[0].reps=5;expect(detectRepetitionPrs(strengthPrEvidence(rows))[0].kinds).toEqual(['first']);
 });
 it('rejects new multi-exercise drafts before calling the RPC; accepts legacy IDs',async()=>{
  const draft=quickLiftToWorkout({...newQuickLift([]),exercise,sets:[{weight:'100',reps:'5'},{weight:'110',reps:'0'}]});
  const rpc=vi.fn().mockResolvedValue({data:'w',error:null});await saveWorkout({rpc}as unknown as SupabaseClient,'u',draft);expect(rpc.mock.calls[0][1].p_sets).toHaveLength(2);
  draft.exercises.push({...draft.exercises[0],key:'second',exercise:{...exercise,id:'other'}});expect(validateWorkout(draft)).not.toEqual([]);await expect(saveWorkout({rpc}as unknown as SupabaseClient,'u',draft)).rejects.toThrow('exactly one exercise');
  await expect(saveWorkout({rpc}as unknown as SupabaseClient,'u',{...draft,id:'legacy'})).resolves.toBe('w');
 });
 it('attempts do not affect exercise usage, PR load or last successful subtitle',async()=>{
  const client={from(table:string){const q={select:()=>q,eq:()=>q,order:()=>q,range:()=>q,then(resolve:(result:unknown)=>void){resolve({data:table==='exercises'?[{id:'e',name:'Bench',tracking_type:'repetitions',major_muscle_group:'Chest'}]:table==='strength_sets'?[{exercise_id:'e',weight:100,reps:5,workout:{performed_at:'2026-09-01'}},{exercise_id:'e',weight:300,reps:0,workout:{performed_at:'2026-09-02'}}]:[],error:null})}};return q;}};
  expect((await getExercises(client as unknown as SupabaseClient,'u'))[0]).toMatchObject({usageCount:1,lastWeight:100,lastReps:5,prWeight:100});
 });
});
