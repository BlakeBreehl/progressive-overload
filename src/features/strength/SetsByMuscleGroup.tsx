import {useRef,useState} from 'react';
import {CartesianGrid,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis,useChartWidth} from 'recharts';
import {Select} from '../../components/SelectionControls';
import {compactTimeLabel,selectFormattedTimeTicks,timeTickLimit} from '../../lib/timeAxis';
import type {StrengthProgressRow} from '../progress/repository';
import {setGroupColors,setGroups} from './setBreakdown';
import {setTrend,setPeriodLabel,setTrendAxis,setAggregation,setTimeframes,defaultSetTimeframe,type SetAggregation,type SetTimeframe} from './setTrend';

/** Recharts may call dot renderers for null values: draw every real calendar aggregate, including zero. */
export function SetTrendDot({cx,cy,value,payload,stroke,fill,active=false,r=3}:{cx?:number;cy?:number;value?:unknown;payload?:{date?:string};stroke?:string;fill?:string;active?:boolean;r?:number}){
 if(typeof value!=='number'||value<0||!Number.isFinite(value)||!Number.isFinite(cx)||!Number.isFinite(cy))return null;
 return <circle className={active?"set-trend-active-dot":"set-trend-dot"} data-period={payload?.date} data-value={value} cx={cx} cy={cy} r={r} fill={active?fill??stroke:stroke} stroke="white" strokeWidth={1} aria-hidden="true"/>;
}
function SetTrendXAxis({dates,aggregation}:{dates:string[];aggregation:SetAggregation}){
 const width=useChartWidth()??320;
 return <XAxis type="category" dataKey="date" allowDuplicatedCategory={false} ticks={selectFormattedTimeTicks(dates,timeTickLimit(width),aggregation)} tickFormatter={value=>aggregation==='weekly'?new Date(String(value)+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}):compactTimeLabel(String(value),dates,aggregation)} minTickGap={18} tick={{fontSize:11,fill:'#777'}} interval="preserveStartEnd"/>;
}
export function SetsByMuscleGroup({rows,location,now}:{rows:StrengthProgressRow[];location:string;now?:Date}){
 const [timeframe,setTimeframe]=useState<SetTimeframe>(defaultSetTimeframe),[hidden,setHidden]=useState<string[]>([]),[notice,setNotice]=useState('');
 const aggregation=setAggregation(timeframe),data=setTrend(rows,timeframe,{location,now}),visible=setGroups.filter(group=>!hidden.includes(group)),axis=setTrendAxis(data,visible);
 const hiddenRef=useRef<string[]>([]);
 const toggle=(group:string)=>{const previous=hiddenRef.current;if(!previous.includes(group)&&previous.length===setGroups.length-1){setNotice('Keep at least one muscle group visible.');return;}const showing=previous.includes(group),next=showing?previous.filter(value=>value!==group):[...previous,group];hiddenRef.current=next;setHidden(next);setNotice(group+(showing?' shown.':' hidden.'));};
 return <section className="surface-card muscle-trend" aria-label="Sets by Muscle Group">
  <div className="primary-filters flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-lg font-bold text-ink">Sets by Muscle Group</h2><Select label="Timeframe" value={timeframe} options={setTimeframes} onChange={value=>setTimeframe(value as SetTimeframe)}/></div>
  <div className="mt-3 h-80 min-w-0" data-aggregation={aggregation} data-period-count={data.length} data-timeframe={timeframe} data-domain={axis.domain.join(",")}>{data.length?<ResponsiveContainer minWidth={0}><LineChart key={timeframe} data={data}><CartesianGrid stroke="#e5e5e5"/><SetTrendXAxis dates={data.map(row=>row.date)} aggregation={aggregation}/><YAxis allowDecimals={false} domain={axis.domain} ticks={axis.ticks} width={32}/><Tooltip filterNull position={{x:0,y:0}} content={({active,payload,label})=>{const bucket=data.find(row=>row.date===label);return active&&bucket?<div className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-xl"><strong>{setPeriodLabel(bucket.date,aggregation)}{bucket.partial?' (Partial)':''}</strong><p>Total: {bucket.total} sets</p>{payload?.filter(item=>visible.includes(String(item.name))&&typeof item.value==='number'&&item.value>=0).map(item=><p key={String(item.name)} style={{color:item.color}}>{item.name}: {String(item.value)} sets</p>)}</div>:null;}}/>{setGroups.map((group,index)=><Line type="linear" connectNulls={true} key={group} hide={hidden.includes(group)} dataKey={group} name={group} stroke={setGroupColors[index]} strokeWidth={1.5} dot={<SetTrendDot/>} activeDot={<SetTrendDot active r={4}/>} isAnimationActive={false}/>)}</LineChart></ResponsiveContainer>:<p className="py-8 text-sm">No completed Strength sets for this location yet.</p>}</div>
  <div className="flex flex-wrap gap-2" aria-label="Muscle group legend">{setGroups.map((group,index)=><button key={group} className={`secondary-button muscle-legend-button ${hidden.includes(group)?"muscle-legend-hidden":""}`} aria-pressed={!hidden.includes(group)} onClick={()=>toggle(group)}><span aria-hidden="true" className="mr-2 inline-block size-2 rounded-full" style={{background:hidden.includes(group)?"transparent":setGroupColors[index],border:`2px solid ${setGroupColors[index]}`}}/>{group}</button>)}</div>
  <span className="sr-only" role="status" aria-live="polite">{notice}</span>
 </section>;
}
