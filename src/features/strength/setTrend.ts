import {relationObject} from '../../lib/supabaseError';
import {localDateKey} from './logic';
import {mondayOf} from '../weight/weeklySummary';
import {countSetGroups,setGroups} from './setBreakdown';
import {niceAxis} from '../../lib/niceAxis';
import type {StrengthProgressRow} from '../progress/repository';
export type SetAggregation='weekly'|'monthly';
export type SetTimeframe='all'|'year'|'six-months'|'three-months'|'six-weeks';
export const defaultSetTimeframe:SetTimeframe='six-months';
export const setTimeframes=[{value:'all',label:'All Time'},{value:'year',label:'Past Year'},{value:'six-months',label:'Past 6 Months'},{value:'three-months',label:'Past 3 Months'},{value:'six-weeks',label:'Past 6 Weeks'}];
export type SetTrendPoint={date:string;partial:boolean;total:number}&Record<string,number|string|boolean>;
const day=(value:string)=>value.length===10?value:localDateKey(value);
const parse=(value:string)=>new Date(`${value.length===7?value+'-01':value}T12:00:00`);
export function setBucket(value:string,aggregation:SetAggregation){return aggregation==='weekly'?mondayOf(day(value)):day(value).slice(0,7);}
export const setAggregation=(timeframe:SetTimeframe):SetAggregation=>timeframe==='six-weeks'?'weekly':'monthly';
/** Full local-calendar periods. Count completed sets once; include zero periods through today. */
export function setTrend(rows:StrengthProgressRow[],timeframe:SetTimeframe,{location='',now=new Date()}={}):SetTrendPoint[]{
 if(!Number.isFinite(now.getTime()))return [];
 const aggregation=setAggregation(timeframe),today=localDateKey(now.toISOString()),current=setBucket(today,aggregation);
 const buckets=new Map<string,{id:string;exercise:unknown}[]>(),seen=new Set<string>();
 for(const row of rows){
  if(row.tracking_type==='repetitions'&&!(row.reps!=null&&Number.isSafeInteger(row.reps)&&row.reps>0))continue;
  if(row.tracking_type==='distance'&&!((row.distance!=null&&Number.isFinite(row.distance)&&row.distance>0&&row.distance_unit)||(row.laps!=null&&Number.isSafeInteger(row.laps)&&row.laps>0)))continue;
  const workout=relationObject<{performed_at:string;location:{id:string}|null}>(row.workout,'set trend workout');
  if(!row.id||seen.has(row.id)||!workout)continue;
  const date=day(workout.performed_at);
  if(!Number.isFinite(parse(date).getTime())||date>today||location&&(location==='__none__'?!!workout.location:workout.location?.id!==location))continue;
  seen.add(row.id);const key=setBucket(date,aggregation),bucket=buckets.get(key)??[];bucket.push({id:row.id,exercise:row.exercise});buckets.set(key,bucket);
 }
 let first=parse(current);
 if(timeframe==='all'){const earliest=[...buckets.keys()].sort()[0];if(!earliest)return [];first=parse(earliest);}
 else if(aggregation==='weekly')first.setDate(first.getDate()-35);
 else first.setMonth(first.getMonth()-(timeframe==='year'?11:timeframe==='six-months'?5:2));
 const points:SetTrendPoint[]=[];
 for(const cursor=new Date(first);cursor<=parse(current);aggregation==='weekly'?cursor.setDate(cursor.getDate()+7):cursor.setMonth(cursor.getMonth()+1)){
  const key=setBucket(localDateKey(cursor.toISOString()),aggregation),counts=countSetGroups(buckets.get(key)??[]);
  points.push({date:key,partial:key===current,total:counts.total,...Object.fromEntries(counts.groups.map(group=>[group.name,group.value]))});
 }
 return points;
}
/** Only visible, selected-period values influence the axis; integer ticks and no negative counts. */
export function setTrendAxis(points:SetTrendPoint[],visible:string[]){
 const values=points.flatMap(point=>visible.filter(group=>setGroups.includes(group)).map(group=>Number(point[group]))).filter(value=>Number.isFinite(value)&&value>=0);
 const axis=niceAxis(values,1),low=Math.max(0,axis.domain[0]),high=Math.max(low+1,axis.domain[1]);
 return {domain:[low,high] as [number,number],ticks:axis.ticks.filter(tick=>Number.isInteger(tick)&&tick>=low&&tick<=high)};
}
export function setPeriodLabel(key:string,aggregation:SetAggregation){
 const start=parse(key);
 if(aggregation==='monthly')return start.toLocaleDateString('en-US',{month:'long',year:'numeric'});
 const end=new Date(start);end.setDate(end.getDate()+6);
 const month=(date:Date)=>date.toLocaleDateString('en-US',{month:'short'});
 if(start.getFullYear()!==end.getFullYear())return month(start)+' '+start.getDate()+', '+start.getFullYear()+'\u2013'+month(end)+' '+end.getDate()+', '+end.getFullYear();
 if(start.getMonth()!==end.getMonth())return month(start)+' '+start.getDate()+'\u2013'+month(end)+' '+end.getDate()+', '+end.getFullYear();
 return month(start)+' '+start.getDate()+'\u2013'+end.getDate()+', '+end.getFullYear();
}
