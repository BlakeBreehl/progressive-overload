-- PROGRESSIVE OVERLOAD — WHOLE REPETITION VALIDATION
-- Forward-only. Review and apply manually after confirming no existing fractional rep values.
alter table public.strength_sets
  add constraint strength_sets_reps_whole
  check (reps is null or reps = trunc(reps)) not valid;

alter table public.historical_strength_records
  add constraint historical_strength_records_reps_whole
  check (reps is null or reps = trunc(reps)) not valid;

alter table public.strength_sets validate constraint strength_sets_reps_whole;
alter table public.historical_strength_records validate constraint historical_strength_records_reps_whole;

-- One browser call, one database transaction. This function is security invoker;
-- existing RLS policies still scope every statement to auth.uid().
create or replace function public.save_strength_workout(p_workout jsonb, p_sets jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_workout_id uuid := nullif(p_workout ->> 'id', '')::uuid;
  v_set jsonb;
  v_set_id uuid;
  v_keep_ids uuid[] := array[]::uuid[];
  v_rows integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_sets) <> 'array' or jsonb_array_length(p_sets) = 0 then raise exception 'At least one set is required'; end if;

  if v_workout_id is null then
    insert into public.strength_workouts(user_id, performed_at, location_id, notes, duration_seconds)
    values(v_user_id, (p_workout ->> 'performed_at')::timestamptz, nullif(p_workout ->> 'location_id','')::uuid, nullif(trim(p_workout ->> 'notes'),''), nullif(p_workout ->> 'duration_seconds','')::numeric)
    returning id into v_workout_id;
  else
    update public.strength_workouts set performed_at=(p_workout ->> 'performed_at')::timestamptz, location_id=nullif(p_workout ->> 'location_id','')::uuid,
      notes=nullif(trim(p_workout ->> 'notes'),''), duration_seconds=nullif(p_workout ->> 'duration_seconds','')::numeric
    where id=v_workout_id and user_id=v_user_id;
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then raise exception 'Workout not found'; end if;
  end if;

  -- Move existing orders out of the target range so reorder/update operations cannot
  -- collide with the foundation's unique (workout_id, set_order) constraint.
  update public.strength_sets set set_order=set_order+1000000 where workout_id=v_workout_id and user_id=v_user_id;

  for v_set in select value from jsonb_array_elements(p_sets)
  loop
    v_set_id := nullif(v_set ->> 'id','')::uuid;
    if v_set_id is null then
      insert into public.strength_sets(user_id,workout_id,exercise_id,set_order,tracking_type,weight,reps,load,distance,distance_unit,laps,duration_seconds,notes)
      values(v_user_id,v_workout_id,(v_set->>'exercise_id')::uuid,(v_set->>'set_order')::integer,(v_set->>'tracking_type')::public.exercise_tracking_type,
        nullif(v_set->>'weight','')::numeric,nullif(v_set->>'reps','')::numeric,nullif(v_set->>'load','')::numeric,nullif(v_set->>'distance','')::numeric,
        nullif(v_set->>'distance_unit','')::public.distance_unit,nullif(v_set->>'laps','')::numeric,nullif(v_set->>'duration_seconds','')::numeric,nullif(trim(v_set->>'notes'),''))
      returning id into v_set_id;
    else
      update public.strength_sets set exercise_id=(v_set->>'exercise_id')::uuid,set_order=(v_set->>'set_order')::integer,tracking_type=(v_set->>'tracking_type')::public.exercise_tracking_type,
        weight=nullif(v_set->>'weight','')::numeric,reps=nullif(v_set->>'reps','')::numeric,load=nullif(v_set->>'load','')::numeric,distance=nullif(v_set->>'distance','')::numeric,
        distance_unit=nullif(v_set->>'distance_unit','')::public.distance_unit,laps=nullif(v_set->>'laps','')::numeric,duration_seconds=nullif(v_set->>'duration_seconds','')::numeric,notes=nullif(trim(v_set->>'notes'),'')
      where id=v_set_id and workout_id=v_workout_id and user_id=v_user_id;
      get diagnostics v_rows = row_count;
      if v_rows <> 1 then raise exception 'Set not found'; end if;
    end if;
    v_keep_ids := array_append(v_keep_ids,v_set_id);
  end loop;
  delete from public.strength_sets where workout_id=v_workout_id and user_id=v_user_id and not(id=any(v_keep_ids));
  return v_workout_id;
end;
$$;

revoke all on function public.save_strength_workout(jsonb,jsonb) from public;
grant execute on function public.save_strength_workout(jsonb,jsonb) to authenticated;

create or replace function public.save_strength_exercise(p_exercise jsonb, p_muscle_tags text[])
returns uuid language plpgsql set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_id uuid := nullif(p_exercise->>'id','')::uuid; v_name text := regexp_replace(trim(p_exercise->>'name'),'\s+',' ','g'); v_rows integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if v_name = '' then raise exception 'Exercise name is required'; end if;
  if coalesce(array_length(p_muscle_tags,1),0)=0 then raise exception 'At least one muscle tag is required'; end if;
  perform pg_advisory_xact_lock(hashtext(v_user_id::text));
  if exists(select 1 from public.exercises where user_id=v_user_id and id is distinct from v_id and lower(regexp_replace(trim(name),'\s+',' ','g'))=lower(v_name)) then raise exception 'An exercise with this name already exists'; end if;
  if v_id is null then
    insert into public.exercises(user_id,name,tracking_type,major_muscle_group,is_compound)
    values(v_user_id,v_name,(p_exercise->>'tracking_type')::public.exercise_tracking_type,p_exercise->>'major_muscle_group',(p_exercise->>'is_compound')::boolean) returning id into v_id;
  else
    update public.exercises set name=v_name,tracking_type=(p_exercise->>'tracking_type')::public.exercise_tracking_type,major_muscle_group=p_exercise->>'major_muscle_group',is_compound=(p_exercise->>'is_compound')::boolean where id=v_id and user_id=v_user_id;
    get diagnostics v_rows=row_count; if v_rows<>1 then raise exception 'Exercise not found'; end if;
    if exists(select 1 from public.strength_sets where exercise_id=v_id and user_id=v_user_id and tracking_type<>(p_exercise->>'tracking_type')::public.exercise_tracking_type) then raise exception 'Tracking type cannot change after incompatible sets exist'; end if;
  end if;
  delete from public.exercise_muscle_assignments where exercise_id=v_id and user_id=v_user_id;
  insert into public.exercise_muscle_assignments(user_id,exercise_id,muscle_tag) select v_user_id,v_id,tag from unnest(p_muscle_tags) tag;
  return v_id;
end; $$;
revoke all on function public.save_strength_exercise(jsonb,text[]) from public;
grant execute on function public.save_strength_exercise(jsonb,text[]) to authenticated;

create or replace function public.set_default_location(p_location_id uuid)
returns void language plpgsql set search_path = '' as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.locations where id=p_location_id and user_id=v_user_id and not archived) then raise exception 'Active location not found'; end if;
  update public.locations set is_default=false where user_id=v_user_id and is_default;
  update public.locations set is_default=true where id=p_location_id and user_id=v_user_id;
end; $$;
revoke all on function public.set_default_location(uuid) from public;
grant execute on function public.set_default_location(uuid) to authenticated;
