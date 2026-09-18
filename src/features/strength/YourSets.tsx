import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Select } from '../../components/SelectionControls';
import { loadSetBreakdown, setGroupColors as colors } from './setBreakdown';
export function YourSets({client,userId}:{client:SupabaseClient;userId:string}){
  const [months,setMonths]=useState(1),[attempt,setAttempt]=useState(0),[state,setState]=useState<{key:string;data?:Awaited<ReturnType<typeof loadSetBreakdown>>;error?:string}>({key:''});
  const key=`${userId}:${months}:${attempt}`;
  useEffect(()=>{let active=true;loadSetBreakdown(client,userId,months).then(data=>{if(active)setState({key,data});}).catch(()=>{if(active)setState({key,error:'Your set breakdown could not load.'});});return()=>{active=false;};},[client,userId,months,key]);
  const data=state.key===key?state.data:undefined;
  return <section className="surface-card mt-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-xl font-bold text-ink">Your Sets</h2><Select label="Set period" value={String(months)} options={[{value:'1',label:'This Month'},{value:'3',label:'Past 3 Months'},{value:'6',label:'Past 6 Months'},{value:'12',label:'Past Year'}]} onChange={value=>setMonths(Number(value))}/></div>
    {state.key===key&&state.error?<p role="alert">{state.error} <button className="text-button" onClick={()=>setAttempt(value=>value+1)}>Retry</button></p>:!data?<p role="status">Loading sets…</p>:!data.total?<p className="py-8 text-center text-slate-500">No sets in this period yet. Log a lift to start your breakdown.</p>:<>
      <div className="relative h-60"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.groups} dataKey="value" nameKey="name" innerRadius="60%" outerRadius="85%" isAnimationActive={false}>{data.groups.map((group,index)=><Cell key={group.name} fill={colors[index]}/>)}</Pie><Tooltip formatter={value=>`${value} sets (${(Number(value)/data.total*100).toFixed(1)}%)`}/></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 grid place-content-center text-center"><strong className="text-3xl text-ink">{data.total}</strong><span className="text-xs">total sets</span></div></div>
      <ul className="grid grid-cols-2 gap-2 text-xs">{data.groups.map((group,index)=><li key={group.name}><span aria-hidden="true" style={{background:colors[index]}} className="mr-2 inline-block size-2 rounded-full"/>{group.name}: <strong>{group.value}</strong></li>)}</ul>
    </>}
    <p className="mt-3 text-xs text-slate-500">Each saved set counts once toward its exercise’s primary muscle group. Compound and multi-group exercises are not counted twice.</p>
  </section>;
}
