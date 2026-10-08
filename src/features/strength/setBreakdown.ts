import {loadStrengthProgressRows,strengthPrEvidence,type StrengthProgressRow} from '../progress/repository';
import {detectRepetitionPrs} from './logic';
import type { SupabaseClient } from '@supabase/supabase-js';
import { relationObject } from '../../lib/supabaseError';
export function setPeriodStart(months:number,now=new Date()){return new Date(now.getFullYear(),now.getMonth()-(months-1),1);}
export const setGroups=['Chest','Back','Legs','Arms','Shoulders','Core','Olympic/Other'];
export const setGroupColors=['#dc2626','#15803d','#2563eb','#111111','#ea580c','#9333ea','#0891b2'];
export function countSetGroups(rows:{id:string;exercise:unknown;tracking_type?:string;reps?:number|null}[]){
  const seen=new Set<string>(),counts=new Map(setGroups.map(group=>[group,0]));
  for(const row of rows){if(row.tracking_type==='repetitions'&&!(row.reps!=null&&Number.isInteger(row.reps)&&row.reps>0))continue;if(seen.has(row.id))continue;seen.add(row.id);
    const exercise=relationObject<{major_muscle_group:string}>(row.exercise,'set breakdown exercise');
    const primary=exercise?.major_muscle_group??'',group=counts.has(primary)?primary:'Olympic/Other';
    counts.set(group,counts.get(group)!+1);
  }
  return {total:seen.size,groups:[...counts].map(([name,value])=>({name,value}))};
}
export function summarizeSetPeriod(rows:StrengthProgressRow[],months:number,now=new Date()){
 const start=months===0?-Infinity:setPeriodStart(months,now).getTime();
 const selected=rows.filter(row=>{const workout=relationObject<{performed_at:string}>(row.workout,'set period workout');const time=Date.parse(workout?.performed_at??'');return Number.isFinite(time)&&(months===0||time>=start&&time<=now.getTime());});
 const ids=new Set(selected.map(row=>row.id));
 const prs=detectRepetitionPrs(strengthPrEvidence(rows));
 return {...countSetGroups(selected.map(row=>({...row,id:row.id!}))),weightPrs:prs.filter(pr=>ids.has(pr.setKey)&&pr.kinds.includes('weight')).length,repPrs:prs.filter(pr=>ids.has(pr.setKey)&&pr.kinds.includes('reps')).length};
}
export async function loadSetBreakdown(client:SupabaseClient,userId:string,months:number,now=new Date()){
 return summarizeSetPeriod(await loadStrengthProgressRows(client,userId),months,now);
}
