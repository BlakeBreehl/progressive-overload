import type { StrengthSet } from './types'

export const setIdentity = (set: StrengthSet) => set.clientKey ?? set.id
export function duplicateSet(set: StrengthSet): StrengthSet {
  return { ...set, id: undefined, clientKey: crypto.randomUUID(), parentSetId: undefined,
    dropSets: set.dropSets?.map(duplicateSet) }
}
export function blankDropSet(main: StrengthSet): StrengthSet {
  return { clientKey: crypto.randomUUID(), exerciseId: main.exerciseId, setOrder: main.setOrder,
    trackingType: 'repetitions', loadMode: main.loadMode, progressionDirection: main.progressionDirection,
    weightUnit: main.weightUnit }
}
/** The only expansion boundary: counts keep main rows; performance consumers expand them. */
export function performances<T extends StrengthSet>(main: T): T[] {
  const { dropSets, ...values } = main
  return [values as T, ...(dropSets ?? []).map((drop, index) => ({ ...values, ...drop,
    dropSets: undefined, parentSetId: main.id ?? main.clientKey, dropOrder: index + 1,
    setOrder: main.setOrder } as T))]
}
export function isCountableMainSet(row: { parentSetId?: string; parent_set_id?: string; trackingType?: string; tracking_type?: string; reps?: number | null }) {
  return !row.parentSetId && !row.parent_set_id &&
    ((row.trackingType ?? row.tracking_type) !== 'repetitions' ||
      (row.reps != null && Number.isSafeInteger(row.reps) && row.reps > 0))
}
