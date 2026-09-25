import {mondayOf} from '../weight/weeklySummary';
import {performedTimestamp} from '../../lib/performedOrder';
export type StepEntry={date:string;steps?:number|null;id?:string;performed_at?:string;created_at?:string};
export type StepPeriod='daily'|'weekly'|'monthly';
export function stepProgress(entries:StepEntry[],period:StepPeriod){
 const measured=entries.filter((entry):entry is StepEntry&{steps:number}=>Number.isFinite(performedTimestamp(entry.date))&&Number.isInteger(entry.steps)&&entry.steps!>0&&entry.steps!<=2147483647)
  .sort((a,b)=>performedTimestamp(a.performed_at??a.date)-performedTimestamp(b.performed_at??b.date)||(performedTimestamp(a.created_at??a.date)-performedTimestamp(b.created_at??b.date)||0)||(a.id??'').localeCompare(b.id??''));
 const buckets=new Map<string,{steps:number;entries:number}>();
 for(const entry of measured){
  const key=period==='monthly'?entry.date.slice(0,7):period==='weekly'?mondayOf(entry.date):entry.date;
  const bucket=buckets.get(key)??{steps:0,entries:0};bucket.steps+=entry.steps;bucket.entries++;buckets.set(key,bucket);
 }
 const total=measured.reduce((sum,entry)=>sum+entry.steps,0);
 return {total,count:measured.length,average:measured.length?total/measured.length:null,points:[...buckets].sort(([a],[b])=>performedTimestamp(a.length===7?a+'-01':a)-performedTimestamp(b.length===7?b+'-01':b)).map(([date,bucket])=>({date,...bucket}))};
}
