import {relationObject} from '../../lib/supabaseError';
import {localDateKey} from './logic';
import {mondayOf} from '../weight/weeklySummary';
import {countSetGroups} from './setBreakdown';
import type {StrengthProgressRow} from '../progress/repository';
export type SetAggregation='weekly'|'monthly';
const day=(value:string)=>value.length===10?value:localDateKey(value);
const parse=(value:string)=>new Date(`${value.length===7?value+'-01':value}T12:00:00`);
export function setBucket(value:string,aggregation:SetAggregation){return aggregation==='weekly'?mondayOf(day(value)):day(value).slice(0,7);}
/** Count once per saved set, using the donut's primary-group classification.
 * Omit entirely empty periods; emit one zero per absent group in active buckets.
 */
export function setTrend(rows:StrengthProgressRow[],aggregation:SetAggregation,{start='',end='',location='',now=new Date()}={}){
 const buckets=new Map<string,{id:string;exercise:unknown}[]>(),seen=new Set<string>();
 for(const row of rows){
  if(row.tracking_type==='repetitions'&&!(row.reps!=null&&Number.isInteger(row.reps)&&row.reps>0))continue;
  if(row.tracking_type==='distance' && !((row.distance!=null&&Number.isFinite(row.distance)&&row.distance>0&&row.distance_unit) || (row.laps!=null&&Number.isSafeInteger(row.laps)&&row.laps>0)))continue;
  const workout=relationObject<{performed_at:string;location:{id:string}|null}>(row.workout,'set trend workout');
  if(!row.id||seen.has(row.id)||!workout||!Number.isFinite(parse(day(workout.performed_at)).getTime()))continue;
  const date=day(workout.performed_at);
  if(start&&date<start||end&&date>end||location&&(location==='__none__'?!!workout.location:workout.location?.id!==location))continue;
  seen.add(row.id);const key=setBucket(date,aggregation);buckets.set(key,[...(buckets.get(key)??[]),{id:row.id,exercise:row.exercise}]);
 }
 const keys=[...buckets.keys()].sort((a,b)=>parse(a).getTime()-parse(b).getTime());if(!keys.length)return [];
 const current=setBucket(localDateKey(now.toISOString()),aggregation);
 return keys.map(key=>{
  const counts=countSetGroups(buckets.get(key)??[]);
  return {date:key,partial:key===current,total:counts.total,...Object.fromEntries(counts.groups.map(group=>[group.name,group.value]))};
 });
}
