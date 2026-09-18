import {useState} from 'react';
import {CartesianGrid,Line,LineChart,ResponsiveContainer,Tooltip,YAxis} from 'recharts';
import {Select} from '../../components/SelectionControls';
import {TimeXAxis} from '../../components/TimeXAxis';
import {fullLocalDateLabel} from '../../lib/timeAxis';
import type {StrengthProgressRow} from '../progress/repository';
import {setGroupColors,setGroups} from './setBreakdown';
import {setTrend,type SetAggregation} from './setTrend';
export function SetsByMuscleGroup({rows,start,end,location}:{rows:StrengthProgressRow[];start:string;end:string;location:string}){
 const [aggregation,setAggregation]=useState<SetAggregation>('monthly'),[hidden,setHidden]=useState<string[]>([]);
 const data=setTrend(rows,aggregation,{start,end,location});
 return <section className="surface-card muscle-trend" aria-label="Sets by Muscle Group">
  <div className="primary-filters flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-lg font-bold text-ink">Sets by Muscle Group</h2><Select label="Aggregation" value={aggregation} options={['weekly','monthly','yearly'].map(value=>({value,label:value[0].toUpperCase()+value.slice(1)}))} onChange={value=>setAggregation(value as SetAggregation)}/></div>
  <div className="mt-3 h-80 min-w-0">{data.length?<ResponsiveContainer minWidth={0}><LineChart data={data}><CartesianGrid stroke="#e5e5e5"/><TimeXAxis dates={data.map(row=>row.date)} mode={aggregation}/><YAxis allowDecimals={false} domain={[0,'auto']} width={32}/><Tooltip content={({active,payload,label})=>{const bucket=data.find(row=>row.date===label);return active&&bucket?<div className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-xl"><strong>{aggregation==='weekly'?'Week of ':''}{fullLocalDateLabel(bucket.date)}{bucket.partial?' (Partial)':''}</strong><p>Total: {bucket.total} sets</p>{payload?.map(item=><p key={String(item.name)}>{item.name}: {String(item.value)} sets</p>)}</div>:null;}}/>{setGroups.map((group,index)=><Line key={group} hide={hidden.includes(group)} dataKey={group} name={group} stroke={setGroupColors[index]} strokeWidth={1.5} dot={{r:2}} activeDot={{r:4}} isAnimationActive={false}/>)}</LineChart></ResponsiveContainer>:<p className="py-8 text-sm">No Strength sets in this date range or location.</p>}</div>
  <div className="flex flex-wrap gap-2" aria-label="Muscle group legend">{setGroups.map((group,index)=><button key={group} className="secondary-button" aria-pressed={!hidden.includes(group)} onClick={()=>setHidden(values=>values.includes(group)?values.filter(value=>value!==group):[...values,group])}><span aria-hidden="true" className="mr-2 inline-block size-2 rounded-full" style={{background:setGroupColors[index]}}/>{group}</button>)}</div>
 </section>;
}
