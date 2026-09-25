import type { Exercise, Workout, WorkoutDraft, WorkoutExercise } from './types'
import { localDateKey } from './logic'

export function exerciseChangeWarning(from: Exercise | null, to: Exercise): string {
  if (!from) return ''
  if (from.trackingType !== to.trackingType) return to.trackingType === 'distance'
    ? 'Reps and repetition weight cannot transfer to Distance/Laps and will be removed. Existing load, duration, notes, set identities and workout details remain. Enter distance and laps before saving.'
    : 'Distance, distance unit and laps cannot transfer to Weight/Reps and will be removed. Load, duration, notes, set identities and workout details remain. Enter reps and any required weight before saving.'
  if (to.trackingType === 'distance') return ''
  if (from.loadMode !== 'reps_only' && to.loadMode === 'reps_only') return 'Weight values will be removed. Reps, all sets, notes, duration and workout details remain.'
  if (from.loadMode !== 'reps_only' && to.loadMode !== 'reps_only' && (from.progressionDirection ?? 'higher_is_better') !== (to.progressionDirection ?? 'higher_is_better')) return `All weight and rep values remain, but weight now means ${to.progressionDirection === 'lower_is_better' ? 'assistance weight (lower is better)' : 'lifted weight (higher is better)'}.`
  return ''
}

// Call only after any required confirmation. Never replace rows or their identities.
export function changeExercise(block: WorkoutExercise, exercise: Exercise): WorkoutExercise {
  return { ...block, exercise, sets: block.sets.map(set => {
    const next = { ...set, exerciseId: exercise.id, trackingType: exercise.trackingType, loadMode: exercise.loadMode, progressionDirection: exercise.progressionDirection }
    if (exercise.trackingType === 'distance') { delete next.weight; delete next.reps }
    else { delete next.distance; delete next.distanceUnit; delete next.laps; if (exercise.loadMode === 'reps_only') delete next.weight }
    return next
  }) }
}

export function workoutEditDraft(workout: Workout): WorkoutDraft {
  // Consecutive blocks preserve interleaved exercise/set order as well as row IDs.
  const exercises: WorkoutExercise[] = []
  for (const set of workout.sets) {
    let block = exercises.at(-1)
    if (block?.exercise?.id !== set.exerciseId) {
      block = { key: crypto.randomUUID(), exercise: set.exercise, sets: [] }
      exercises.push(block)
    }
    const { exercise: _definition, ...values } = set
    block!.sets.push({ ...values, clientKey: set.clientKey ?? set.id ?? crypto.randomUUID() })
  }
  return { id: workout.id, originalPerformedAt: workout.performedAt, date: localDateKey(workout.performedAt), locationId: workout.location?.id ?? null, notes: workout.notes ?? '', durationSeconds: workout.durationSeconds ?? undefined, exercises }
}
