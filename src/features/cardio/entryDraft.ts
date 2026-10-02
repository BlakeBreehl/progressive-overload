import { durationParts, durationToSeconds, parseStepCount } from './logic'
import { localDateKey, localDateToIso } from '../strength/logic'
import type { CardioSession } from './repository'
export type Form = {
  trackingMode?: 'timed'|'steps';
  id?: string;
  originalPerformedAt?: string;
  activityId: string;
  steps: string;
  date: string;
  h: number;
  m: number;
  s: number;
  distance?: number;
  distanceUnit: string;
  speed?: number;
  laps?: number;
  incline?: number;
  difficulty?: number;
  locationId: string;
  notes: string;
};

export function cardioEditDraft(entry: CardioSession): Form {
    const p = durationParts(entry.durationSeconds??0);
    return {
      id: entry.id,
      trackingMode: entry.trackingMode??'timed',
      originalPerformedAt: entry.performedAt,
      activityId: entry.activityId,
      steps: entry.stepCount == null ? "" : String(entry.stepCount),
      date: localDateKey(entry.performedAt),
      h: p.hours,
      m: p.minutes,
      s: p.seconds,
      distance: entry.distance,
      distanceUnit: entry.distanceUnit ?? "miles",
      speed: entry.speed,
      laps: entry.laps,
      incline: entry.incline,
      difficulty: entry.difficulty,
      locationId: entry.locationId ?? "",
      notes: entry.notes ?? "",
    };
}
export function cardioEntryPayload(form: Form) {
 const stepCount = parseStepCount(form.steps);
 const steps=form.trackingMode==='steps';
 if(steps && stepCount===null)throw new Error('Enter a positive whole number of steps.');
 return {
          activity_id: form.activityId,
          tracking_mode: form.trackingMode??'timed',
          step_count: stepCount,
          performed_at: form.originalPerformedAt && localDateKey(form.originalPerformedAt) === form.date ? form.originalPerformedAt : localDateToIso(form.date),
          duration_seconds: steps ? null : durationToSeconds(form.h, form.m, form.s),
          distance: steps ? null : form.distance ?? null,
          distance_unit:
            !steps && form.distance !== undefined
              ? form.distanceUnit
              : null,
          speed: steps ? null : form.speed ?? null,
          laps: steps ? null : form.laps ?? null,
          incline: steps ? null : form.incline ?? null,
          difficulty: steps ? null : form.difficulty ?? null,
          location_id: form.locationId || null,
          notes: form.notes || null,
        }
}

/** Ask before discarding any populated incompatible metric. Timed-to-timed preserves legacy values. */
export function cardioActivityChange(form:Form,activityId:string,trackingMode:'timed'|'steps'){
 const removed:string[]=[];
 if(trackingMode==='steps'){
  if(form.h||form.m||form.s)removed.push('Duration');
  for(const key of ['distance','speed','laps','incline','difficulty'] as const)if(form[key]!==undefined)removed.push(key==='distance'?'Distance and distance unit':key[0].toUpperCase()+key.slice(1));
 }else if(form.trackingMode==='steps'&&form.steps!=='')removed.push('Steps');
 const next:Form=trackingMode==='steps'?{...form,activityId,trackingMode,h:0,m:0,s:0,distance:undefined,distanceUnit:'miles',speed:undefined,laps:undefined,incline:undefined,difficulty:undefined}:{...form,activityId,trackingMode,steps:form.trackingMode==='steps'?'':form.steps};
 return {removed,next};
}
