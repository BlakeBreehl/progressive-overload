import { comparisonWeight, convertWeight, displayWeight, type WeightUnit } from '../../lib/weightUnits';
import { localDateKey } from '../strength/logic';
import { relationObject } from '../../lib/supabaseError';
import type { StrengthProgressRow } from './repository';
export type StrengthMode = 'one' | 'repWeight' | 'all';
export const strengthModes = [{value:'one',label:'One Rep Max'},{value:'repWeight',label:'Rep Weight'},{value:'all',label:'All Logged Sets'}];
type Filters={start?:string;end?:string;location?:string;unit?:WeightUnit};
type Workout={performed_at:string;created_at:string;location:{id:string;name:string}|null};
const validNumber=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const eligibleWeight=(set:StrengthProgressRow)=>set.tracking_type==='repetitions'&&validNumber(set.weight)&&validNumber(set.reps)&&Number.isInteger(set.reps)&&set.reps>=1;
function visibleSets(rows:StrengthProgressRow[],exerciseId:string,filters:Filters){
 return rows.filter(row=>row.exercise_id===exerciseId).flatMap(row=>{
  const workout=relationObject<Workout>(row.workout,'strength mode workout');
  if(!row.id||!workout||!Number.isFinite(Date.parse(workout.performed_at)))return [];
  const date=/^\d{4}-\d{2}-\d{2}$/.test(workout.performed_at)?workout.performed_at:localDateKey(workout.performed_at);
  if((filters.start&&date<filters.start)||(filters.end&&date>filters.end)||(filters.location&&(filters.location==='__none__'?!!workout.location:workout.location?.id!==filters.location)))return [];
  return [{...row,workout,date}];
 }).sort((a,b)=>Date.parse(a.workout.performed_at)-Date.parse(b.workout.performed_at)||(Date.parse(a.workout.created_at)||0)-(Date.parse(b.workout.created_at)||0)||(a.set_order??0)-(b.set_order??0)||(a.id??'').localeCompare(b.id??''));
}
export function defaultStrengthMode(rows:StrengthProgressRow[],exerciseId:string):StrengthMode{
 const sets=visibleSets(rows,exerciseId,{}).filter(eligibleWeight);
 return sets.some(set=>set.reps===1)?'one':sets.some(set=>set.reps!>=4)?'repWeight':'all';
}
export type ModeSelection={exerciseId:string;mode:StrengthMode}|null;
export const selectedStrengthMode=(selection:ModeSelection,rows:StrengthProgressRow[],exerciseId:string)=>selection?.exerciseId===exerciseId?selection.mode:defaultStrengthMode(rows,exerciseId);
export function strengthModePoints(rows:StrengthProgressRow[],exerciseId:string,mode:StrengthMode,filters:Filters={}){
 let best=-Infinity,bestReps=0,bestDisplay=-Infinity;
 return visibleSets(rows,exerciseId,filters).flatMap(set=>{
  const distance=set.tracking_type==='distance',repsOnly=!distance&&set.weight==null;
  const raw=distance?(set.distance??set.laps??set.duration_seconds):repsOnly?set.reps:set.weight;
  if(!validNumber(raw)||(!distance&&(!validNumber(set.reps)||!Number.isInteger(set.reps)||set.reps<1)))return [];
  const unit=filters.unit??'lb',storedUnit=set.weight_unit??'lb';
  let result=distance||repsOnly?raw:convertWeight(raw,storedUnit,unit);
  if(!Number.isFinite(result))return [];
  if(mode!=='all'){
   if(!eligibleWeight(set)||(mode==='one'?set.reps!==1:set.reps!<4))return [];
   const weight=comparisonWeight(raw,storedUnit);if(!Number.isFinite(weight))return [];
   if(weight<best||weight===best&&(mode==='one'||set.reps!<=bestReps))return [];
   // Equivalent mixed-unit loads share one Y coordinate, avoiding reciprocal-factor drift.
   bestDisplay=weight===best?bestDisplay:Math.max(bestDisplay,result);
   best=weight;bestReps=set.reps!;result=bestDisplay;
  }
  const exercise=relationObject<{name?:string}>(set.exercise,'strength mode exercise');
  return [{id:set.id!,date:set.date,result,displayValue:distance||repsOnly?String(raw):displayWeight(raw,storedUnit,unit),displayUnit:distance?(set.distance!=null?set.distance_unit??'distance':set.laps!=null?'laps':'seconds'):repsOnly?'reps':unit,reps:distance?null:set.reps,exercise:exercise?.name??'Exercise',location:set.workout.location?.name??'No location',repsOnly,distanceUnit:set.distance_unit}];
 });
}
