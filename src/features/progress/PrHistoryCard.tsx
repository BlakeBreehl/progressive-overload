import {useEffect,useMemo,useRef,useState} from 'react';
import {prHistory} from './prHistory';
import type {StrengthProgressRow} from './repository';
export function PrHistory({rows,location,locationLabel}:{rows:StrengthProgressRow[];location:string;locationLabel:string}){
 const [period,setPeriod]=useState<'monthly'|'yearly'>('monthly');
 const periods=useMemo(()=>prHistory(rows,period,location),[rows,period,location]);
 const scroll=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(scroll.current)scroll.current.scrollLeft=scroll.current.scrollWidth;},[periods]);
 return <section className="surface-card min-w-0 max-w-full" aria-label="PRs Over Time">
  <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-display text-lg font-bold text-ink">PRs Over Time</h2><div className="flex gap-1" role="group" aria-label="PR history period">{(['monthly','yearly'] as const).map(value=><button key={value} type="button" className={period===value?'primary-button':'secondary-button'} aria-pressed={period===value} onClick={()=>setPeriod(value)}>{value==='monthly'?'Monthly':'Yearly'}</button>)}</div></div>
  <p className="mt-2 text-xs text-slate-600">All exercises · All performance dates · {locationLabel}. PRs classified across all locations.</p>
  <p className="mt-1 text-xs"><span style={{color:'#15803d'}}>Weight PR (green)</span> · <span style={{color:'#1d4ed8'}}>Rep PR (blue)</span></p>
  <div ref={scroll} className="mt-2 max-w-full overflow-x-auto" role="region" aria-label="PR counts by period; scroll horizontally for earlier periods" tabIndex={0}>
   {periods.length?<table className="pr-history-table"><caption className="sr-only">Historical Weight PR and Rep PR counts by {period==='monthly'?'calendar month':'calendar year'}</caption><thead><tr><th scope="row">Period</th>{periods.map(item=><th scope="col" key={item.period}>{period==='yearly'?item.period:new Date(Number(item.period.slice(0,4)),Number(item.period.slice(5))-1,1).toLocaleDateString('en-US',{month:'short',year:'numeric'})}</th>)}</tr></thead><tbody>{(['weight','reps'] as const).map(kind=><tr key={kind} style={{color:kind==='weight'?'#15803d':'#1d4ed8'}}><th scope="row">{kind==='weight'?'Weight PR':'Rep PR'}</th>{periods.map(item=><td key={item.period}>{item[kind]}</td>)}</tr>)}</tbody></table>:<p className="text-sm">No Strength entries in this location.</p>}
  </div>
 </section>;
}
