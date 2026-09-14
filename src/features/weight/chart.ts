import { localDateKey } from '../strength/logic';
import type { Reading } from './logic';
export type LineStyle = 'straight' | 'smooth';
export const defaultLineStyle: LineStyle = 'straight';
export const lineType = (style: LineStyle) => style === 'smooth' ? 'monotone' as const : 'linear' as const;
/** Each row is a real reading. Null connections are rendering only, never synthetic values. */
export function bodyweightChart(readings: Reading[]) {
  return [...readings].sort((a,b)=>Date.parse(a.measuredAt)-Date.parse(b.measuredAt)||a.id.localeCompare(b.id)).map(reading=>({
    id:reading.id,date:localDateKey(reading.measuredAt),
    morning:reading.period==='morning'?reading.weight:null,
    evening:reading.period==='evening'?reading.weight:null,
  }));
}
