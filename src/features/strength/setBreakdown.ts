import type { SupabaseClient } from '@supabase/supabase-js';
import { relationObject } from '../../lib/supabaseError';
export function setPeriodStart(months:number,now=new Date()){return new Date(now.getFullYear(),now.getMonth()-(months-1),1);}
export const setGroups=['Chest','Back','Legs','Arms','Shoulders','Core','Olympic/Other'];
export const setGroupColors=['#dc2626','#15803d','#2563eb','#111111','#ea580c','#9333ea','#0891b2'];
export function countSetGroups(rows:{id:string;exercise:unknown}[]){
  const seen=new Set<string>(),counts=new Map(setGroups.map(group=>[group,0]));
  for(const row of rows){if(seen.has(row.id))continue;seen.add(row.id);
    const exercise=relationObject<{major_muscle_group:string}>(row.exercise,'set breakdown exercise');
    const primary=exercise?.major_muscle_group??'',group=counts.has(primary)?primary:'Olympic/Other';
    counts.set(group,counts.get(group)!+1);
  }
  return {total:seen.size,groups:[...counts].map(([name,value])=>({name,value}))};
}
export async function loadSetBreakdown(client:SupabaseClient,userId:string,months:number,now=new Date()){
  const rows:{id:string;exercise:unknown}[]=[];
  for(let offset=0;;offset+=500){
    const {data,error}=await client.from('strength_sets').select('id,exercise:exercises!strength_set_exercise_type_owned_fk(major_muscle_group),workout:strength_workouts!strength_set_workout_owned_fk!inner(performed_at)').eq('user_id',userId).gte('workout.performed_at',setPeriodStart(months,now).toISOString()).lte('workout.performed_at',now.toISOString()).order('id').range(offset,offset+499);
    if(error)throw error;rows.push(...(data??[]));if((data??[]).length<500)return countSetGroups(rows);
  }
}
