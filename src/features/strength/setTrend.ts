import {relationObject} from '../../lib/supabaseError';
import {localDateKey} from './logic';
import {mondayOf} from '../weight/weeklySummary';
import {countSetGroups} from './setBreakdown';
import type {StrengthProgressRow} from '../progress/repository';
export type SetAggregation='weekly'|'monthly'|'yearly';
const day=(value:string)=>value.length===10?value:localDateKey(value);
const parse=(value:string)=>new Date(`${value}T12:00:00`);
export function setBucket(value:string,aggregation:SetAggregation){return aggregation==='weekly'?mondayOf(value):aggregation==='monthly'?value.slice(0,7)+'-01':value.slice(0,4)+'-01-01';}
/** Count once per saved set, using the donut's primary-group classification.
 * Zero-fill only between measured buckets after date/location filtering.
 */
export function setTrend(rows:StrengthProgressRow[],aggregation:SetAggregation,{start='',end='',location='',now=new Date()}={}){
 const buckets=new Map<string,{id:string;exercise:unknown}[]>(),seen=new Set<string>();
 for(const row of rows){
  const workout=relationObject<{performed_at:string;location:{id:string}|null}>(row.workout,'set trend workout');
  if(!row.id||seen.has(row.id)||!workout||!Number.isFinite(parse(day(workout.performed_at)).getTime()))continue;
  const date=day(workout.performed_at);
  if(start&&date<start||end&&date>end||location&&(location==='__none__'?!!workout.location:workout.location?.id!==location))continue;
  seen.add(row.id);const key=setBucket(date,aggregation);buckets.set(key,[...(buckets.get(key)??[]),{id:row.id,exercise:row.exercise}]);
 }
 const keys=[...buckets.keys()].sort();if(!keys.length)return [];
 const result=[];let key=keys[0];const current=setBucket(localDateKey(now.toISOString()),aggregation);
 while(key<=keys.at(-1)!){
  const counts=countSetGroups(buckets.get(key)??[]);
  result.push({date:key,partial:key===current,total:counts.total,...Object.fromEntries(counts.groups.map(group=>[group.name,group.value]))});
  const next=parse(key);if(aggregation==='weekly')next.setDate(next.getDate()+7);else if(aggregation==='monthly')next.setMonth(next.getMonth()+1);else next.setFullYear(next.getFullYear()+1);key=localDateKey(next.toISOString());
 }
 return result;
}
