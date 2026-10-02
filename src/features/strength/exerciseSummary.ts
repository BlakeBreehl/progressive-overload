import { comparisonWeight, convertWeight } from '../../lib/weightUnits';
import { convertDistance } from '../../lib/distanceUnits';
import { performedTimestamp } from '../../lib/performedOrder';
import { relationObject } from '../../lib/supabaseError';
import { isRepsOnlyExercise } from './logic';
import type { Exercise, ExerciseSummarySet } from './types';

export type ExerciseSummaryRow = {
  id?: string; exercise_id: string; set_order?: number;
  weight: number | null; weight_unit?: 'lb' | 'kg'; reps: number | null;
  load?: number | null; distance?: number | null; distance_unit?: string | null;
  laps?: number | null; duration_seconds?: number | null; workout: unknown;
};
type Evidence = { value: ExerciseSummarySet; workoutId: string; performed: number; created: number; order: number; id: string; date: string };
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const chronology = (a: Evidence, b: Evidence) => a.performed - b.performed || a.created - b.created || a.order - b.order || a.id.localeCompare(b.id);
const distanceMetric = (set: ExerciseSummarySet) => set.distance == null ? undefined : convertDistance(set.distance, set.distanceUnit ?? '', 'meters');

function comparePerformance(exercise: Exercise, a: Evidence, b: Evidence) {
  const left = a.value, right = b.value;
  if (exercise.trackingType === 'distance') {
    // Compare per-lap distance across units; never add laps to distance or time.
    const metric = (set: ExerciseSummarySet): [number, number] => {
      const distance = distanceMetric(set);
      return finite(distance) ? [3, distance] : set.laps != null ? [2, set.laps] : set.durationSeconds != null ? [1, set.durationSeconds] : [0, 0];
    };
    const [aKind, aValue] = metric(left), [bKind, bValue] = metric(right);
    return aKind - bKind || aValue - bValue;
  }
  if (isRepsOnlyExercise(exercise)) return left.reps! - right.reps!;
  const weight = comparisonWeight(left.weight!, left.weightUnit) - comparisonWeight(right.weight!, right.weightUnit);
  return (exercise.progressionDirection === 'lower_is_better' ? -weight : weight) || left.reps! - right.reps!;
}

/** One pass groups existing account evidence; no queries or stored-value changes. */
export function summarizeExercises(exercises: Exercise[], rows: ExerciseSummaryRow[]): Exercise[] {
  const definitions = new Map(exercises.map(exercise => [exercise.id, exercise]));
  const grouped = new Map<string, Evidence[]>(), attempts = new Map<string, number>();
  for (const row of rows) {
    const exercise = definitions.get(row.exercise_id);
    if (!exercise) continue;
    if (exercise.trackingType === 'repetitions') {
      if (row.reps === 0) attempts.set(exercise.id, (attempts.get(exercise.id) ?? 0) + 1);
      if (!Number.isSafeInteger(row.reps) || row.reps! <= 0 || (!isRepsOnlyExercise(exercise) && !finite(row.weight))) continue;
    }
    const workout = relationObject<{ id?: string; performed_at: string; created_at?: string }>(row.workout, 'strength.summary.workout');
    if (!workout || !Number.isFinite(performedTimestamp(workout.performed_at))) continue;
    const value: ExerciseSummarySet = {
      weight: finite(row.weight) ? row.weight : undefined, weightUnit: row.weight_unit ?? 'lb',
      reps: finite(row.reps) ? row.reps : undefined,
      load: finite(row.load) ? row.load : undefined,
      distance: finite(row.distance) && finite(convertDistance(row.distance, row.distance_unit ?? '', 'meters')) ? row.distance : undefined,
      distanceUnit: row.distance_unit ?? undefined,
      laps: finite(row.laps) && row.laps > 0 ? row.laps : undefined,
      durationSeconds: finite(row.duration_seconds) ? row.duration_seconds : undefined,
    };
    if (exercise.trackingType === 'distance' && !(value.distance != null && value.distance > 0) && !(value.laps != null && Number.isSafeInteger(value.laps)) && !(value.durationSeconds != null && value.durationSeconds > 0)) continue;
    const list = grouped.get(exercise.id) ?? [];
    list.push({ value, workoutId: workout.id ?? workout.performed_at, performed: performedTimestamp(workout.performed_at), created: performedTimestamp(workout.created_at ?? workout.performed_at) || 0, order: row.set_order ?? 0, id: row.id ?? '', date: workout.performed_at });
    grouped.set(exercise.id, list);
  }
  return exercises.map(exercise => {
    const successful = (grouped.get(exercise.id) ?? []).sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id));
    const latest = successful.reduce<Evidence | undefined>((best, row) => !best || chronology(row, best) > 0 ? row : best, undefined);
    const bestOf = (records: Evidence[]) => records.reduce<Evidence | undefined>((best, row) => !best || comparePerformance(exercise, row, best) > 0 ? row : best, undefined);
    const best = bestOf(successful)?.value;
    const last = bestOf(successful.filter(row => row.workoutId === latest?.workoutId))?.value;
    return { ...exercise, usageCount: successful.length, lastUsedAt: latest?.date ?? null,
      prWeight: best?.weight == null ? undefined : convertWeight(best.weight, best.weightUnit ?? 'lb', 'lb'),
      lastWeight: last?.weight == null ? undefined : convertWeight(last.weight, last.weightUnit ?? 'lb', 'lb'), lastReps: last?.reps,
      logSummary: { state: 'ready', attempts: attempts.get(exercise.id) ?? 0, best, last },
    };
  });
}
