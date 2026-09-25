import { niceAxis } from './niceAxis';
export type Metric='weight'|'reps'|'percentage'|'duration'|'distance'|'speed'|'pace'|'steps';
export function formatMetric(value:number,metric:Metric){
  if(!Number.isFinite(value))return '';
  if(metric==='duration'||metric==='pace'){
    const seconds=Math.round(Math.abs(value)),prefix=value<0?'-':'';
    return prefix+(seconds>=3600?`${Math.floor(seconds/3600)}:${String(Math.floor(seconds/60)%60).padStart(2,'0')}`:String(Math.floor(seconds/60)))+`:${String(seconds%60).padStart(2,'0')}`;
  }
  const number=Number(value.toFixed(metric==='reps'||metric==='steps'?0:metric==='speed'?1:3));
  return `${number}${metric==='percentage'?'%':''}`;
}
export function metricAxis(values:number[],metric:Metric){return niceAxis(values,metric==='weight'?5:metric==='reps'||metric==='steps'?1:metric==='duration'||metric==='pace'?1:0);}
