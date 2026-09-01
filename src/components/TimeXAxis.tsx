import{useEffect,useState}from"react";
import{XAxis}from"recharts";
import{compactTimeLabel,selectFormattedTimeTicks,timeTickLimit,type TimeAxisMode}from"../lib/timeAxis";
export function TimeXAxis({dates,dataKey="date",mode="auto"}:{dates:string[];dataKey?:string;mode?:TimeAxisMode}){const[width,setWidth]=useState(()=>typeof window==="undefined"?1024:window.innerWidth);useEffect(()=>{const resize=()=>setWidth(window.innerWidth);window.addEventListener("resize",resize);return()=>window.removeEventListener("resize",resize)},[]);const ticks=selectFormattedTimeTicks(dates,timeTickLimit(width),mode);return <XAxis dataKey={dataKey} ticks={ticks} tickFormatter={value=>compactTimeLabel(String(value),dates,mode)} minTickGap={18} tick={{fontSize:11,fill:"#777"}} interval={0}/>}
