import { useState } from 'react';
import { Select } from '../../components/SelectionControls';
import { Pagination } from '../../components/Pagination';
import type { WeightUnit } from '../../lib/weightUnits';
import type { Reading } from './logic';
import { weeklySummaries,weeklyPage,weeklyNumber,type ReadingPeriod,type WeeklyRange } from './weeklySummary';
export function WeeklyChangeTable({readings,unit,period}:{readings:Reading[];unit:WeightUnit;period:ReadingPeriod}){
 const [range,setRange]=useState<WeeklyRange>('3'),[page,setPage]=useState(1);
 const now=new Date(),result=weeklyPage(weeklySummaries(readings,unit,period,now),range,page,now);
 return <section className="surface-card mt-8" aria-labelledby="weekly-bodyweight-title">
  <div className="flex flex-wrap items-end justify-between gap-3"><h2 id="weekly-bodyweight-title" className="font-display text-xl font-bold text-ink">Weekly Bodyweight Change</h2><Select label="Weekly time range" value={range} options={[{value:'3',label:'3 Months'},{value:'6',label:'6 Months'},{value:'12',label:'12 Months'},{value:'all',label:'All Time'}]} onChange={value=>{setRange(value as WeeklyRange);setPage(1);}}/></div>
  <p className="mt-3 text-xs text-slate-600">{period==='both'?'Morning & Evening':period==='morning'?'Morning':'Evening'} ? Displayed in {unit}. Ranges include complete calendar weeks; the current week is partial.</p>
  <div className="mt-4 overflow-x-auto rounded-xl focus-visible:outline-2 focus-visible:outline-red" role="region" aria-label="Weekly Bodyweight comparison table; scroll horizontally for all columns" tabIndex={0}>
   <table className="w-full min-w-[560px] text-left text-sm text-ink">
    <caption className="pb-3 text-left text-xs text-slate-600">Monday?Sunday averages give each measured day equal weight after averaging its matching readings. Missing days are ignored. Changes use only the immediately preceding calendar week; a dash means insufficient data.</caption>
    <thead><tr className="border-b border-slate-200"><th scope="col" className="px-3 py-3">Week</th><th scope="col" className="px-3 py-3 text-right">Average ({unit})</th><th scope="col" className="px-3 py-3 text-right">Change ({unit})</th><th scope="col" className="px-3 py-3 text-right">Change (%)</th></tr></thead>
    <tbody>{result.items.map(row=><tr key={row.key} className="border-b border-slate-200"><th scope="row" className="whitespace-nowrap px-3 py-3 font-normal">{row.label}{row.partial&&<span className="ml-2 rounded bg-slate-200 px-2 py-1 text-xs">Partial</span>}<span className="mt-1 block text-xs text-slate-500">{row.measuredDays} measured {row.measuredDays===1?'day':'days'}</span></th><td className="px-3 py-3 text-right tabular-nums">{weeklyNumber(row.average,1)}</td><td className="px-3 py-3 text-right tabular-nums">{weeklyNumber(row.change,1,true)}</td><td className="px-3 py-3 text-right tabular-nums">{weeklyNumber(row.percentChange,2,true)}</td></tr>)}</tbody>
   </table>
  </div>
  {!result.total&&<p className="py-6 text-sm text-slate-500">No readings in this weekly range.</p>}
  <Pagination {...result} label="Weekly Bodyweight pages" onChange={setPage}/>
 </section>;
}
