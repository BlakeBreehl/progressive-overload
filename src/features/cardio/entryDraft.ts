import { durationParts, durationToSeconds, parseStepCount } from './logic'
import { localDateKey, localDateToIso } from '../strength/logic'
import type { CardioSession } from './repository'
export type Form = {
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
    const p = durationParts(entry.durationSeconds);
    return {
      id: entry.id,
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
 return {
          activity_id: form.activityId,
          step_count: stepCount,
          performed_at: form.originalPerformedAt && localDateKey(form.originalPerformedAt) === form.date ? form.originalPerformedAt : localDateToIso(form.date),
          duration_seconds: durationToSeconds(form.h, form.m, form.s),
          distance: form.distance ?? null,
          distance_unit:
            form.distance !== undefined
              ? form.distanceUnit
              : null,
          speed: form.speed ?? null,
          laps: form.laps ?? null,
          incline: form.incline ?? null,
          difficulty: form.difficulty ?? null,
          location_id: form.locationId || null,
          notes: form.notes || null,
        }
}
