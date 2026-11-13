import { displayWeight, type WeightUnit } from '../../lib/weightUnits'
import { performances, setIdentity } from './dropSets'
import type { Workout } from './types'

export function WorkoutCard({workout,onOpen,unit,prs}:{workout:Workout;unit:string;prs:Map<string,string[]>;onOpen:()=>void}) {
  return <button className="surface-card w-full text-left" onClick={onOpen}>
    <div className="flex justify-between">
      <strong className="text-ink">{new Date(workout.performedAt).toLocaleDateString()}</strong>
      <span className="text-xs text-slate-500">{workout.sets.length} sets</span>
    </div>
    <p className="text-xs text-slate-500">{workout.location?.name??'No location'}</p>
    <div className="mt-3 space-y-1">{workout.sets.map(set=><div className="text-sm text-slate-600" key={setIdentity(set)}>
      {set.exercise.name}:
      {performances(set).map(performance=><span key={setIdentity(performance)} className={performance.dropOrder?'drop-set-history block':'block'}>
        {performance.dropOrder?`Drop Set ${performance.dropOrder}: `:set.dropSets?.length?'Main Set: ':''}
        {performance.trackingType==='repetitions'&&performance.reps===0&&<span className="tag">Attempt</span>}
        {performance.trackingType==='repetitions'
          ?performance.weight===undefined?`${performance.reps} reps`:`${displayWeight(performance.weight,performance.weightUnit??'lb',unit as WeightUnit)} ${unit}${set.exercise.progressionDirection==='lower_is_better'?' assistance':''} × ${performance.reps}`
          :`${performance.distance} ${performance.distanceUnit}`}
        {(performance.reps===0?[]:prs.get(performance.id??''))?.map(kind=><span key={kind} className={kind==='first'?'pr-first':kind==='weight'?'pr-weight':'pr-reps'}>{kind==='first'?'First Entry':kind==='weight'?'Weight PR':'Rep PR'}</span>)}
      </span>)}
    </div>)}</div>
  </button>
}
