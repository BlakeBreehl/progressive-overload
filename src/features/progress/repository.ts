import type{SupabaseClient}from"@supabase/supabase-js";
import{relationObject}from"../../lib/supabaseError";
export type StrengthProgressRow={weight_unit?:"lb"|"kg";id?:string;set_order?:number;exercise_id:string;tracking_type:"repetitions"|"distance";weight:number|null;reps:number|null;load:number|null;distance:number|null;distance_unit:string|null;laps:number|null;duration_seconds:number|null;workout:unknown;exercise:unknown};
export async function loadStrengthProgressRows(client:SupabaseClient,userId:string){
 const rows:StrengthProgressRow[]=[];
 for(let offset=0;;offset+=500){
  const{data,error}=await client.from("strength_sets").select("id,set_order,exercise_id,tracking_type,weight,weight_unit,reps,load,distance,distance_unit,laps,duration_seconds,exercise:exercises!strength_set_exercise_type_owned_fk(id,name,tracking_type,major_muscle_group),workout:strength_workouts!strength_set_workout_owned_fk(id,performed_at,created_at,location:locations!strength_workout_location_owned_fk(id,name))").eq("user_id",userId).order("id").range(offset,offset+499);
  if(error)throw error;rows.push(...(data??[]) as StrengthProgressRow[]);if((data??[]).length<500)return rows;
 }
}
export function strengthPrEvidence(rows:StrengthProgressRow[]){return rows.flatMap(row=>{
 const workout=relationObject<{id:string;performed_at:string;created_at:string}>(row.workout,"progress.pr.workout");
 return workout?[{id:row.id,workoutId:workout.id,createdAt:workout.created_at,performedAt:workout.performed_at,weightUnit:row.weight_unit??"lb",exerciseId:row.exercise_id,setOrder:row.set_order??0,trackingType:row.tracking_type,weight:row.weight==null?undefined:Number(row.weight),reps:row.reps==null?undefined:Number(row.reps)}]:[];
})}
export function strengthExerciseUsage(rows:StrengthProgressRow[]){return rows.flatMap(row=>{const exercise=relationObject<{id:string;name:string;tracking_type:"repetitions"|"distance"}>(row.exercise,"progress.strength.default.exercise"),workout=relationObject<{performed_at:string;location:{id:string;name:string}|null}>(row.workout,"progress.strength.default.workout");return exercise&&workout?[{exerciseId:exercise.id,exerciseName:exercise.name,trackingType:exercise.tracking_type,date:workout.performed_at.slice(0,10),locationId:workout.location?.id??"",location:workout.location?.name??null,distance:row.distance,distanceUnit:row.distance_unit,laps:row.laps,durationSeconds:row.duration_seconds,load:row.load}]:[]})}
