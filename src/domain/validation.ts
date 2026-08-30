export type StrengthSetInput = {
  trackingType: 'repetitions' | 'distance'
  weight?: number
  reps?: number
  load?: number
  distance?: number
  distanceUnit?: 'meters' | 'kilometers' | 'miles' | 'yards' | 'feet'
  laps?: number
  durationSeconds?: number
  difficulty?: number
}

export function validateStrengthSet(input: StrengthSetInput): string[] {
  const errors: string[] = []
  const numeric = ['weight', 'reps', 'load', 'laps', 'durationSeconds'] as const
  numeric.forEach((field) => { if (input[field] !== undefined && input[field]! < 0) errors.push(`${field} cannot be negative`) })
  if (input.difficulty !== undefined && (input.difficulty < 0 || input.difficulty > 10)) errors.push('difficulty must be between 0 and 10')
  if (input.trackingType === 'repetitions') {
    if (input.reps === undefined) errors.push('repetition sets require reps')
    if (input.distance !== undefined || input.distanceUnit !== undefined || input.laps !== undefined) errors.push('repetition sets cannot contain distance fields')
  } else {
    if (input.distance === undefined || input.distance <= 0) errors.push('distance sets require a positive distance')
    if (!input.distanceUnit) errors.push('distance sets require a distance unit')
    if (input.weight !== undefined || input.reps !== undefined) errors.push('distance sets cannot contain repetition fields')
  }
  return errors
}

export function isValidHistoricalPeriod(type: 'monthly' | 'yearly', date: string): boolean {
  const [year, month, day] = date.split('-').map(Number)
  return Boolean(year && month && day === 1 && (type === 'monthly' || month === 1))
}
