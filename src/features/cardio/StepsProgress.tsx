import {CartesianGrid,Line,LineChart,ResponsiveContainer,Tooltip,YAxis} from 'recharts';
import {TimeXAxis} from '../../components/TimeXAxis';
import {fullLocalDateLabel} from '../../lib/timeAxis';
import {stepAxis} from './stepAxis';
import {stepProgress,type StepEntry} from './steps';
import {defaultAxisSettings,type AxisSettings} from '../../components/ChartControls';
export function StepsProgress({entries,axes=defaultAxisSettings}:{entries:StepEntry[];axes?:AxisSettings}){
 const period='daily' as const;
 const data=stepProgress(entries,period);
 const axis=stepAxis(data.points.map(point=>point.steps),axes);
 return <section className="surface-card min-w-0" aria-label="Steps Progress">
  <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-lg font-bold text-ink">Steps over Time</h2></div>
  <dl className="mt-4 grid grid-cols-3 gap-2 text-sm"><div><dt>Latest recorded</dt><dd className="font-bold">{data.points.at(-1)?.steps.toLocaleString()??'\u2014'}</dd></div><div><dt>Average recorded day</dt><dd className="font-bold">{data.average===null?'—':data.average.toLocaleString(undefined,{maximumFractionDigits:0})}</dd></div><div><dt>Recorded days</dt><dd className="font-bold">{data.count}</dd></div></dl>
  <div className="mt-4 h-72 min-w-0">{data.points.length?<ResponsiveContainer minWidth={0}><LineChart data={data.points}><CartesianGrid stroke="#e5e5e5"/><TimeXAxis dates={data.points.map(point=>point.date)} mode="auto"/><YAxis allowDecimals={false} domain={axis.domain} ticks={axis.ticks} width={65} tickFormatter={value=>Number(value).toLocaleString()}/><Tooltip position={{x:0,y:0}} content={({active,payload})=>{const point=payload?.[0]?.payload;return active&&point?<div className="rounded-xl border bg-white p-3 text-sm shadow-xl"><strong>{fullLocalDateLabel(point.date)}</strong><p>{point.steps.toLocaleString()} steps</p><p>Latest saved total for this date</p></div>:null;}}/><Line dataKey="steps" name="Steps" stroke="#d71920" strokeWidth={2} dot={{r:4}} isAnimationActive={false}/></LineChart></ResponsiveContainer>:<p className="py-8 text-sm">No manual step counts in these filters.</p>}</div>
 </section>;
}
