import { convertWeight, type WeightUnit } from '../../lib/weightUnits';
import { localDateKey } from '../strength/logic';
import type { Reading } from './logic';
export type ReadingPeriod = 'both' | 'morning' | 'evening';
export type WeeklyRange = '3' | '6' | '12' | 'all';
export type WeeklySummary = {key:string;label:string;average:number;change:number|null;percentChange:number|null;measuredDays:number;partial:boolean};
const parseDay=(day:string)=>{const [y,m,d]=day.split('-').map(Number);return new Date(y,m-1,d,12);};
const dayKey=(date:Date)=>localDateKey(date.toISOString());
const shiftDay=(day:string,amount:number)=>{const date=parseDay(day);date.setDate(date.getDate()+amount);return dayKey(date);};
export const mondayOf=(day:string)=>{const date=parseDay(day);return shiftDay(day,-((date.getDay()+6)%7));};
const mean=(values:number[])=>values.reduce((total,value)=>total+value/values.length,0);
const finite=(value:number)=>Number.isFinite(value)?value:null;
export function weekLabel(monday:string){
 const start=parseDay(monday),end=parseDay(shiftDay(monday,6));
 const month=(date:Date)=>date.toLocaleDateString('en-US',{month:'short'});
 if(start.getFullYear()!==end.getFullYear())return month(start)+' '+start.getDate()+', '+start.getFullYear()+' ? '+month(end)+' '+end.getDate()+', '+end.getFullYear();
 return month(start)+' '+start.getDate()+'?'+(start.getMonth()===end.getMonth()?'':month(end)+' ')+end.getDate()+', '+end.getFullYear();
}
/** Normalize copies before daily means; missing days/weeks never become zero.
 * Build all weekly evidence before range filtering, so the first visible week
 * can still compare with its immediately preceding calendar week.
 */
export function weeklySummaries(readings:Reading[],unit:WeightUnit,period:ReadingPeriod='both',now=new Date()):WeeklySummary[]{
 if(!Number.isFinite(now.getTime()))return [];
 const days=new Map<string,number[]>();
 for(const reading of readings){
  const time=Date.parse(reading.measuredAt);
  if(!Number.isFinite(time)||time>now.getTime()||!Number.isFinite(reading.weight)||reading.weight<0||(reading.unit!=='lb'&&reading.unit!=='kg')||(period!=='both'&&reading.period!==period))continue;
  const weight=convertWeight(reading.weight,reading.unit,unit);if(!Number.isFinite(weight))continue;
  const day=localDateKey(reading.measuredAt);days.set(day,[...(days.get(day)??[]),weight]);
 }
 const weeks=new Map<string,number[]>();
 for(const [day,values] of days){const monday=mondayOf(day),average=mean(values);if(Number.isFinite(average))weeks.set(monday,[...(weeks.get(monday)??[]),average]);}
 const averages=new Map([...weeks].map(([key,values])=>[key,mean(values)]));
 return [...averages].filter(([,average])=>Number.isFinite(average)).sort(([a],[b])=>b.localeCompare(a)).map(([key,average])=>{
  const previous=averages.get(shiftDay(key,-7)),change=previous===undefined?null:finite(average-previous);
  return {key,label:weekLabel(key),average,change,percentChange:previous===undefined||previous===0||change===null?null:finite(change/previous*100),measuredDays:weeks.get(key)!.length,partial:key===mondayOf(dayKey(now))};
 });
}
/** Rolling calendar-month window, expanded to complete Monday?Sunday weeks. */
export function weeklyPage(rows:WeeklySummary[],range:WeeklyRange,page=1,now=new Date()){
 const cutoff=new Date(now);cutoff.setDate(1);
 if(range!=='all')cutoff.setMonth(cutoff.getMonth()-Number(range));
 const lastDay=new Date(cutoff.getFullYear(),cutoff.getMonth()+1,0).getDate();cutoff.setDate(Math.min(now.getDate(),lastDay));
 const start=range==='all'?'':mondayOf(dayKey(cutoff));
 const filtered=rows.filter(row=>!start||row.key>=start).sort((a,b)=>b.key.localeCompare(a.key));
 const total=filtered.length,pages=Math.max(1,Math.ceil(total/12)),current=Math.min(pages,Math.max(1,Math.trunc(page)||1)),offset=(current-1)*12;
 return {items:filtered.slice(offset,offset+12),total,pages,page:current,start:total?offset+1:0,end:Math.min(offset+12,total)};
}
export function weeklyNumber(value:number|null,decimals:number,signed=false){
 if(value===null||!Number.isFinite(value))return '?';
 const rounded=Number(value.toFixed(decimals));
 return (signed&&rounded>0?'+':'')+(Object.is(rounded,-0)?0:rounded).toFixed(decimals);
}
