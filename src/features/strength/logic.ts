import { comparisonWeight } from "../../lib/weightUnits";
import type { Exercise, Location, PrResult, StrengthSet, WorkoutDraft } from './types'

export const normalizeExerciseName = (name:string) => name.trim().replace(/\s+/g,' ').toLocaleLowerCase()
const repsOnlyNames = new Set(['pull up','chin up','dip','push up','leg lift'])
export const isRepsOnlyExercise = (exercise: Pick<Exercise,'name'|'loadMode'>) => exercise.loadMode === 'reps_only' || repsOnlyNames.has(normalizeExerciseName(exercise.name))
export function isDuplicateExerciseName(name:string, exercises:Exercise[], excludeId?:string){const normalized=normalizeExerciseName(name);return exercises.some(e=>e.id!==excludeId&&normalizeExerciseName(e.name)===normalized)}
export type ExerciseFilters={query?:string;group?:string;muscle?:string;compoundOnly?:boolean;includeArchived?:boolean}
export function filterExercises(exercises:Exercise[], filters:ExerciseFilters){const q=normalizeExerciseName(filters.query??'');return exercises.filter(e=>(filters.includeArchived||!e.archived)&&(!q||normalizeExerciseName(e.name).includes(q))&&(!filters.group||e.majorMuscleGroups.includes(filters.group as Exercise['majorMuscleGroups'][number]))&&(!filters.muscle||e.muscleTags.includes(filters.muscle))&&(!filters.compoundOnly||e.isCompound))}
export function rankExercises(exercises:Exercise[]){return [...exercises].sort((a,b)=>b.usageCount-a.usageCount||(b.lastUsedAt?Date.parse(b.lastUsedAt):0)-(a.lastUsedAt?Date.parse(a.lastUsedAt):0)||a.name.localeCompare(b.name))}
export function validateSet(set:StrengthSet){const errors:string[]=[];const finite=(v:number|undefined)=>v===undefined||Number.isFinite(v);if(!finite(set.weight)||!finite(set.reps)||!finite(set.load)||!finite(set.distance)||!finite(set.laps)||!finite(set.durationSeconds))errors.push('All numbers must be finite.');if(set.trackingType==='repetitions'){if(set.reps===undefined||!Number.isInteger(set.reps)||set.reps<1)errors.push('Reps must be a positive whole number.');if(set.loadMode==='reps_only'&&set.weight!==undefined)errors.push('Reps-only sets cannot include weight.');if(set.loadMode!=='reps_only'&&(set.weight===undefined||set.weight<0))errors.push('Weight must be zero or more.');if(set.distance!==undefined||set.distanceUnit!==undefined||set.laps!==undefined)errors.push('Repetition sets cannot include distance fields.')}else{if(set.load===undefined||set.load<0)errors.push('Load must be zero or more.');if(set.distance===undefined||set.distance<=0)errors.push('Distance per lap must be greater than zero.');if(!set.distanceUnit)errors.push('Choose a distance unit.');if(set.laps===undefined||!Number.isInteger(set.laps)||set.laps<1)errors.push('Laps must be a whole number of at least one.');if(set.durationSeconds!==undefined&&set.durationSeconds<0)errors.push('Duration cannot be negative.');if(set.weight!==undefined||set.reps!==undefined)errors.push('Distance sets cannot include repetition fields.')}return errors}
export function orderedSets(draft:WorkoutDraft){let order=0;return draft.exercises.flatMap(block=>block.sets.map(set=>({...set,exerciseId:block.exercise?.id??'',trackingType:block.exercise?.trackingType??set.trackingType,loadMode:block.exercise?.loadMode??set.loadMode,setOrder:++order}))) }
export function validateWorkout(draft:WorkoutDraft){const errors:string[]=[];if(!draft.date)errors.push('Choose a workout date.');if(!draft.exercises.length)errors.push('Add at least one exercise.');draft.exercises.forEach((block,i)=>{if(!block.exercise)errors.push(`Exercise ${i+1}: choose an exercise.`);if(!block.sets.length)errors.push(`Exercise ${i+1}: add at least one set.`);block.sets.forEach((set,j)=>validateSet({...set,trackingType:block.exercise?.trackingType??set.trackingType}).forEach(e=>errors.push(`${block.exercise?.name??`Exercise ${i+1}`} set ${j+1}: ${e}`))) });return errors}
export function localDateToIso(date:string, now=new Date()){const [y,m,d]=date.split('-').map(Number);const local=new Date(y,m-1,d,now.getHours(),now.getMinutes(),now.getSeconds());return local.toISOString()}
export function localDateKey(iso:string){const d=new Date(iso);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
export type DailyStrengthGroup={date:string;exerciseId:string;exerciseName:string;locationId:string|null;locationName:string|null;workouts:string[];sets:(StrengthSet&{exercise:Exercise})[]}
export function groupDailyStrength(workouts:import('./types').Workout[]):DailyStrengthGroup[]{const groups:DailyStrengthGroup[]=[];for(const workout of [...workouts].sort((a,b)=>b.performedAt.localeCompare(a.performedAt)||(b.createdAt??'').localeCompare(a.createdAt??'')||b.id.localeCompare(a.id))){const byExercise=new Map<string,DailyStrengthGroup>();for(const set of workout.sets){const current=byExercise.get(set.exerciseId)??{date:localDateKey(workout.performedAt),exerciseId:set.exerciseId,exerciseName:set.exercise.name,locationId:workout.location?.id??null,locationName:workout.location?.name??null,workouts:[workout.id],sets:[]};current.sets.push(set);byExercise.set(set.exerciseId,current)}groups.push(...byExercise.values())}return groups.map(group=>({...group,sets:group.sets.sort((a,b)=>a.setOrder-b.setOrder)}))}
export function chooseDefaultLocation(locations:Location[], nextId:string){return locations.map(l=>({...l,isDefault:!l.archived&&l.id===nextId}))}
export type TimedSet=StrengthSet&{id?:string;performedAt:string;createdAt?:string;workoutId?:string}
export function detectRepetitionPrs(sets:TimedSet[]):PrResult[]{
 const sorted=[...sets].sort((a,b)=>Date.parse(a.performedAt)-Date.parse(b.performedAt)||(a.createdAt??'').localeCompare(b.createdAt??'')||a.setOrder-b.setOrder||(a.id??'').localeCompare(b.id??''));
 const firstEntry=new Map<string,string>(),maxWeight=new Map<string,number>(),maxReps=new Map<string,number>();
 return sorted.map((set,index)=>{
  const setKey=set.id??String(index),kinds:PrResult['kinds']=[],entry=set.workoutId??setKey;
  if(set.trackingType!=='repetitions'||!Number.isFinite(set.reps))return{setKey,kinds};
  const first=!firstEntry.has(set.exerciseId);
  if(first)firstEntry.set(set.exerciseId,entry);
  const weight=set.weight===undefined?undefined:comparisonWeight(set.weight,set.weightUnit);
  const repsOnly=weight===undefined,key=set.exerciseId+':'+(repsOnly?'reps':weight),prior=maxReps.get(key),weightPrior=maxWeight.get(set.exerciseId);
  if(first)kinds.push('first');
  else if(firstEntry.get(set.exerciseId)!==entry){
   if(!repsOnly&&weightPrior!==undefined&&weight!>weightPrior)kinds.push('weight');
   else if(prior!==undefined&&set.reps!>prior)kinds.push('reps');
  }
  if(!repsOnly&&Number.isFinite(set.weight))maxWeight.set(set.exerciseId,Math.max(weightPrior??-Infinity,weight!));
  maxReps.set(key,Math.max(prior??-Infinity,set.reps!));
  return{setKey,kinds};
 });
}
