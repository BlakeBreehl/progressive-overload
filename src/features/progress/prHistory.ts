import {detectRepetitionPrs, localDateKey} from '../strength/logic';
import {relationObject} from '../../lib/supabaseError';
import {strengthPrEvidence, type StrengthProgressRow} from './repository';
export type PrPeriod={period:string;weight:number;reps:number};
/** Classify the complete history before filtering events by location. */
export function prHistory(rows:StrengthProgressRow[],period:'monthly'|'yearly',location=''):PrPeriod[]{
 const evidence=strengthPrEvidence(rows);
 const badges=new Map(detectRepetitionPrs(evidence).map(event=>[event.setKey,event.kinds[0]]));
 const byId=new Map(rows.map(row=>[row.id,row]));
 const events=evidence.flatMap(set=>{
  const row=byId.get(set.id);
  const workout=relationObject<{location:{id:string}|null}>(row?.workout,'pr.history.location');
  if(location&&(location==='__none__'?!!workout?.location:workout?.location?.id!==location))return [];
  const day=set.performedAt.length===10?set.performedAt:localDateKey(set.performedAt);
  return /^\d{4}-\d{2}-\d{2}$/.test(day)?[{day,kind:set.id?badges.get(set.id):undefined}]:[];
 });
 if(!events.length)return [];
 const days=events.map(event=>event.day).sort(),start=days[0],end=days.at(-1)!;
 const buckets=new Map<string,PrPeriod>();
 let year=Number(start.slice(0,4)),month=period==='yearly'?1:Number(start.slice(5,7));
 const last=period==='yearly'?end.slice(0,4):end.slice(0,7);
 while(true){const key=period==='yearly'?String(year):`${year}-${String(month).padStart(2,'0')}`;if(key>last)break;buckets.set(key,{period:key,weight:0,reps:0});if(period==='yearly')year++;else if(++month>12){month=1;year++;}}
 for(const event of events){const bucket=buckets.get(event.day.slice(0,period==='yearly'?4:7));if(bucket&&event.kind==='weight')bucket.weight++;else if(bucket&&event.kind==='reps')bucket.reps++;}
 return [...buckets.values()];
}
