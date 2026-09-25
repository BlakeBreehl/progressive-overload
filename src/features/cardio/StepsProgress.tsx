import {useState} from 'react';
import {CartesianGrid,Line,LineChart,ResponsiveContainer,Tooltip,YAxis} from 'recharts';
import {Select} from '../../components/SelectionControls';
import {TimeXAxis} from '../../components/TimeXAxis';
import {fullLocalDateLabel} from '../../lib/timeAxis';
import {stepProgress,type StepEntry,type StepPeriod} from './steps';
import {defaultAxisSettings,paddedDomain,type AxisSettings} from '../../components/ChartControls';
export function StepsProgress({entries,axes=defaultAxisSettings}:{entries:StepEntry[];axes?:AxisSettings}){
 const [period,setPeriod]=useState<StepPeriod>('daily');
 const data=stepProgress(entries,period);
 return <section className="surface-card min-w-0" aria-label="Steps Progress">
  <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-lg font-bold text-ink">Steps over Time</h2><Select label="Step aggregation" value={period} options={['daily','weekly','monthly'].map(value=>({value,label:value[0].toUpperCase()+value.slice(1)}))} onChange={value=>setPeriod(value as StepPeriod)}/></div>
  <dl className="mt-4 grid grid-cols-3 gap-2 text-sm"><div><dt>Total steps</dt><dd className="font-bold">{data.total.toLocaleString()}</dd></div><div><dt>Average per entry</dt><dd className="font-bold">{data.average===null?'—':data.average.toLocaleString(undefined,{maximumFractionDigits:2})}</dd></div><div><dt>Entries with steps</dt><dd className="font-bold">{data.count}</dd></div></dl>
  <div className="mt-4 h-72 min-w-0">{data.points.length?<ResponsiveContainer minWidth={0}><LineChart data={data.points}><CartesianGrid stroke="#e5e5e5"/><TimeXAxis dates={data.points.map(point=>point.date)} mode={period==='daily'?'auto':period}/><YAxis allowDecimals={false} domain={paddedDomain(data.points.map(point=>point.steps),axes,1)} width={55}/><Tooltip content={({active,payload})=>{const point=payload?.[0]?.payload;return active&&point?<div className="rounded-xl border bg-white p-3 text-sm shadow-xl"><strong>{period==='weekly'?'Week of ':''}{fullLocalDateLabel(point.date)}</strong><p>{point.steps.toLocaleString()} steps</p><p>{point.entries} entries with steps</p></div>:null;}}/><Line dataKey="steps" name="Steps" stroke="#d71920" strokeWidth={2} dot={{r:4}} isAnimationActive={false}/></LineChart></ResponsiveContainer>:<p className="py-8 text-sm">No manual step counts in these filters.</p>}</div>
 </section>;
}
