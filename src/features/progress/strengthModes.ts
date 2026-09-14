import { comparisonWeight, convertWeight, displayWeight, type WeightUnit } from "../../lib/weightUnits";
import { localDateKey } from '../strength/logic';
import { relationObject } from '../../lib/supabaseError';
import type { StrengthProgressRow } from './repository';
export type StrengthMode = 'prs' | 'one' | 'repWeight' | 'all';
export const strengthModes = [{value:'prs',label:'PRs'},{value:'one',label:'1-Rep Max'},{value:'repWeight',label:'Rep Weight'},{value:'all',label:'All Logged Sets'}];
export function strengthModePoints(rows:StrengthProgressRow[],exerciseId:string,mode:StrengthMode,filters:{start?:string;end?:string;location?:string;unit?:WeightUnit}={}){
  const sets=rows.filter(row=>row.exercise_id===exerciseId).flatMap(row=>{
    const workout=relationObject<{performed_at:string;created_at:string;location:{id:string;name:string}|null}>(row.workout,'strength mode workout');
    return workout?[{...row,workout}]:[];
  }).sort((a,b)=>Date.parse(a.workout.performed_at)-Date.parse(b.workout.performed_at)||(Date.parse(a.workout.created_at)||0)-(Date.parse(b.workout.created_at)||0)||(a.set_order??0)-(b.set_order??0)||(a.id??'').localeCompare(b.id??''));
  let best=-Infinity,bestThree=-Infinity;
  return sets.flatMap(set=>{
    const date=localDateKey(set.workout.performed_at),distance=set.tracking_type==='distance',repsOnly=!distance&&set.weight===null;
    if(distance&&mode==='one')return [];
    const result=distance?set.distance:repsOnly?set.reps:set.weight;
    if(result===null||!Number.isFinite(Number(result)))return [];
    const comparison=distance||repsOnly?Number(result):comparisonWeight(Number(result),set.weight_unit??"lb"),value=distance||repsOnly?Number(result):convertWeight(Number(result),set.weight_unit??"lb",filters.unit??"lb"),reps=set.reps===null?undefined:Number(set.reps);
    let primary:number|null=null,three:number|null=null;
    if(mode==='all'||distance){primary=value;}
    else if(mode==='repWeight'){if(repsOnly||(reps??0)>=3)primary=value;}
    else if(mode==='one'){if(!repsOnly&&reps===1&&comparison>best){primary=value;best=comparison;}}
    else {
      if(comparison>best){primary=value;best=comparison;}
      if(!repsOnly&&(reps??0)>=3&&comparison>bestThree){three=value;bestThree=comparison;}
    }
    // Establish lifetime/all-location records before applying visibility filters.
    if((filters.start&&date<filters.start)||(filters.end&&date>filters.end)||(filters.location&&(filters.location==='__none__'?!!set.workout.location:set.workout.location?.id!==filters.location)))return [];
    if(primary===null&&three===null)return [];
    return [{id:set.id,date,displayValue:distance||repsOnly?String(value):displayWeight(Number(result),set.weight_unit??"lb",filters.unit??"lb"),result:primary,three,reps:repsOnly?undefined:reps,location:set.workout.location?.name??'No location',repsOnly,distanceUnit:set.distance_unit}];
  });
}
