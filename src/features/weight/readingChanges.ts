import { localDateKey } from '../strength/logic';
import type { Reading } from './logic';
/** Compare the latest reading on the same local day last week, period, and unit. */
export function readingChanges(readings: Reading[]) {
  const days=new Map<string,Reading>();
  const key=(reading:Reading,date=localDateKey(reading.measuredAt))=>`${date}:${reading.period}:${reading.unit}`;
  for(const reading of readings){const previous=days.get(key(reading));if(!previous||reading.measuredAt>previous.measuredAt)days.set(key(reading),reading);}
  return new Map(readings.map(reading=>{
    const date=new Date(reading.measuredAt);date.setDate(date.getDate()-7);
    const previous=days.get(key(reading,localDateKey(date.toISOString())));
    const change=previous&&previous.weight>0?{absolute:reading.weight-previous.weight,percent:(reading.weight-previous.weight)/previous.weight*100}:null;
    return [reading.id,change];
  }));
}
