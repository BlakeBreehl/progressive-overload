import type { GroupSummary } from './repository';
import {distanceMiles} from '../../lib/distanceUnits';
export const groupPeriods=[{value:'week',label:'This Week'},{value:'month',label:'This Month'},{value:'3m',label:'Past 3 Months'},{value:'6m',label:'Past 6 Months'},{value:'year',label:'This Year'}];
export const muscleCategories=['Legs','Chest','Back','Arms','Shoulders','Core','Olympic/Other'];
export function calendarStart(period:string,now=new Date()){
  const date=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  if(period==='week')date.setDate(date.getDate()-(date.getDay()+6)%7);
  else if(period==='year')date.setMonth(0,1);
  else date.setMonth(date.getMonth()-(period==='3m'?2:period==='6m'?5:0),1);
  return date;
}
export function rankMembers<T extends {member_id:string;display_name:string;value:number|null}>(rows:T[]){
  const sorted=[...rows].sort((a,b)=>(b.value??-Infinity)-(a.value??-Infinity)||a.display_name.trim().toLowerCase().localeCompare(b.display_name.trim().toLowerCase())||a.member_id.localeCompare(b.member_id));
  return sorted.map((row,index)=>({...row,rank:row.value===null?null:index+1,tied:false}));
}
export function strengthRanks(data:GroupSummary,metric:'sets'|'weight'|'reps'|'combined'='sets'){
  return rankMembers(data.members.filter(member=>member.sharing_progress!==false).map(member=>{const prs=data.prs.find(row=>row.member_id===member.member_id);return {...member,value:metric==='sets'?data.sets.filter(row=>row.member_id===member.member_id).reduce((sum,row)=>sum+Number(row.total),0):metric==='weight'?Number(prs?.weight_prs??0):metric==='reps'?Number(prs?.rep_prs??0):Number(prs?.weight_prs??0)+Number(prs?.rep_prs??0)};}));
}
export function cardioRanks(data:GroupSummary,metric:'duration'|'distance'){
  return rankMembers(data.members.filter(member=>member.sharing_progress!==false).map(member=>{const entries=data.cardio.filter(row=>row.member_id===member.member_id),duration=entries.reduce((sum,row)=>sum+Number(row.duration_seconds),0),supported=entries.flatMap(row=>{const miles=distanceMiles(row.distance_meters===null?null:Number(row.distance_meters),'meters');return miles===null?[]:[miles];}),distance=supported.length?supported.reduce((sum,value)=>sum+value,0):null;return {...member,value:metric==='duration'?duration:distance,duration,distance,entries:entries.reduce((sum,row)=>sum+Number(row.entries),0),activities:entries.map(row=>row.activity).join(', ')};}));
}
