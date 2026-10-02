import { displayWeight, type WeightUnit } from '../../lib/weightUnits';
import type { Exercise, ExerciseSummarySet } from './types';
import { isRepsOnlyExercise } from './logic';

const distanceLabels: Record<string, string> = { feet: 'ft', yards: 'yd', meters: 'm', kilometers: 'km', miles: 'mi' };
function distanceText(set: ExerciseSummarySet, includeLaps: boolean) {
  if (set.distance != null && set.distanceUnit) return `${set.distance} ${distanceLabels[set.distanceUnit] ?? set.distanceUnit}${includeLaps && set.laps != null ? ` × ${set.laps} lap${set.laps === 1 ? '' : 's'}` : ''}`;
  if (set.laps != null) return `${set.laps} lap${set.laps === 1 ? '' : 's'}`;
  if (set.durationSeconds != null) return `${set.durationSeconds} sec`;
  return '';
}
export function exerciseLogSubtitle(exercise: Exercise, unit: string) {
  const summary = exercise.logSummary;
  if (summary?.state === 'loading') return 'Loading history…';
  if (summary?.state === 'unavailable') return 'History summary unavailable';
  const best = summary?.best, last = summary?.last;
  if (!best || !last) return summary?.attempts ? 'Attempts logged · No successful entries yet' : 'No successful entries yet';
  if (exercise.trackingType === 'distance') {
    const result = (set: ExerciseSummarySet, laps: boolean) => [distanceText(set, laps), set.load == null ? '' : `${displayWeight(set.load, set.weightUnit ?? 'lb', unit as WeightUnit)} ${unit} load`].filter(Boolean).join(' · ');
    const bestText = result(best, false), lastText = result(last, true);
    return [bestText && `Best: ${bestText}`, lastText && `Last: ${lastText}`].filter(Boolean).join(' · ') || 'Distance entries logged';
  }
  if (isRepsOnlyExercise(exercise)) return `Rep PR: ${best.reps} reps · Last: ${last.reps} reps`;
  const weight = (set: ExerciseSummarySet) => `${displayWeight(set.weight!, set.weightUnit ?? 'lb', unit as WeightUnit)} ${unit}`;
  return `${exercise.progressionDirection === 'lower_is_better' ? 'Best assistance' : 'Weight PR'}: ${weight(best)} · Last: ${weight(last)} × ${last.reps}`;
}
