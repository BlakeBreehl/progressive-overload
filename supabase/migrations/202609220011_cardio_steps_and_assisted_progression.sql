-- Progressive Overload 2.1. REVIEW ONLY: apply manually after 001-010.
-- No historical performance writes. No companion repair: production cause unconfirmed.
begin;

alter table public.cardio_sessions add column if not exists step_count integer;
alter table public.exercises add column if not exists progression_direction text;
do $$ begin
 if exists(select 1 from information_schema.columns where table_schema='public' and ((table_name='cardio_sessions' and column_name='step_count') or (table_name='exercises' and column_name='progression_direction')) and (is_generated<>'NEVER' or is_identity<>'NO')) then raise exception 'Generated/identity progression columns are incompatible';end if;
 if exists(select 1 from pg_catalog.pg_class where oid in ('public.cardio_sessions'::regclass,'public.exercises'::regclass) and not relrowsecurity) then raise exception 'Required ownership RLS is disabled';end if;
 if (select data_type from information_schema.columns where table_schema='public' and table_name='cardio_sessions' and column_name='step_count') is distinct from 'integer' then
  raise exception 'Incompatible cardio_sessions.step_count; expected integer';
 end if;
 if (select data_type from information_schema.columns where table_schema='public' and table_name='exercises' and column_name='progression_direction') is distinct from 'text' then
  raise exception 'Incompatible exercises.progression_direction; expected text';
 end if;
 if exists(select 1 from public.cardio_sessions where step_count<=0) then raise exception 'Invalid existing steps; no values were changed';end if;
 if exists(select 1 from public.exercises where progression_direction is not null and (progression_direction not in ('higher_is_better','lower_is_better') or (progression_direction='lower_is_better' and (tracking_type<>'repetitions' or load_mode<>'weight_reps')))) then raise exception 'Incompatible existing progression metadata';end if;
end $$;
alter table public.cardio_sessions alter column step_count drop default;
alter table public.cardio_sessions alter column step_count drop not null;
alter table public.cardio_sessions drop constraint if exists cardio_sessions_step_count_positive;
alter table public.cardio_sessions add constraint cardio_sessions_step_count_positive check(step_count is null or step_count>0);
update public.exercises set progression_direction='higher_is_better' where progression_direction is null;
alter table public.exercises alter column progression_direction set default 'higher_is_better';
alter table public.exercises alter column progression_direction set not null;
alter table public.exercises drop constraint if exists exercises_progression_direction_check;
alter table public.exercises add constraint exercises_progression_direction_check check(
 progression_direction in ('higher_is_better','lower_is_better') and
 (progression_direction='higher_is_better' or (tracking_type='repetitions' and load_mode='weight_reps'))
);
-- Existing ownership FKs, RLS, grants and ordered Cardio indexes remain authoritative.
-- Cardio uses one atomic insert/update, not an RPC. No step index is needed.

create or replace function public.install_strength_catalog_v21(p_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v record;v_id uuid;v_count integer;
begin
 perform pg_advisory_xact_lock(hashtext(p_user_id::text));
 for v in select * from (values ('Assisted Dip','Arms','Triceps'),('Assisted Pull Up','Back','Lats'),('Assisted Chin Up','Back','Biceps')) as catalog(name,major_group,tag)
 loop
  select count(*), (array_agg(e.id))[1] into v_count,v_id from public.exercises e where e.user_id=p_user_id
   and regexp_replace(regexp_replace(lower(e.name),'[^a-z0-9]','','g'),'s$','')=regexp_replace(lower(v.name),'[^a-z0-9]','','g');
  if v_count>1 then raise exception 'Ambiguous assisted catalog equivalents; review preflight';end if;
  if v_count=0 then
   insert into public.exercises(user_id,name,tracking_type,load_mode,progression_direction,major_muscle_group,is_compound)
    values(p_user_id,v.name,'repetitions','weight_reps','lower_is_better',v.major_group,true) returning id into v_id;
  else
   if exists(select 1 from public.exercises where id=v_id and (tracking_type<>'repetitions' or load_mode<>'weight_reps')) then
    raise exception 'Incompatible existing assisted exercise; no historical values were changed';
   end if;
   -- Exact normalized catalog equivalents only. Preserve user spelling and other customization.
   update public.exercises set progression_direction='lower_is_better' where id=v_id and progression_direction is distinct from 'lower_is_better';
  end if;
  insert into public.exercise_group_assignments(user_id,exercise_id,major_group)
   select p_user_id,v_id,major_muscle_group from public.exercises where id=v_id on conflict(exercise_id,major_group) do nothing;
  insert into public.exercise_muscle_assignments(user_id,exercise_id,muscle_tag) values(p_user_id,v_id,v.tag) on conflict do nothing;
 end loop;
 -- Only exact canonical private names; retain secondary tags and performance values.
 update public.exercises set major_muscle_group='Arms'
  where user_id=p_user_id and regexp_replace(regexp_replace(lower(name),'[^a-z0-9]','','g'),'s$','') in ('dip','weighteddip','assisteddip') and major_muscle_group is distinct from 'Arms';
 insert into public.exercise_group_assignments(user_id,exercise_id,major_group)
  select user_id,id,'Arms' from public.exercises where user_id=p_user_id and regexp_replace(regexp_replace(lower(name),'[^a-z0-9]','','g'),'s$','') in ('dip','weighteddip','assisteddip') on conflict(exercise_id,major_group) do nothing;
 insert into public.exercise_muscle_assignments(user_id,exercise_id,muscle_tag)
  select user_id,id,'Triceps' from public.exercises where user_id=p_user_id and regexp_replace(regexp_replace(lower(name),'[^a-z0-9]','','g'),'s$','') in ('dip','weighteddip','assisteddip') on conflict do nothing;
end $$;
revoke all on function public.install_strength_catalog_v21(uuid) from public,anon,authenticated;

create or replace function public.handle_new_user_strength_catalog_v21()
returns trigger language plpgsql security definer set search_path='' as $$
begin perform public.install_strength_catalog_v21(new.id);return new;end $$;
revoke all on function public.handle_new_user_strength_catalog_v21() from public,anon,authenticated;
-- Alphabetically after both existing starter triggers; older migrations remain unchanged.
drop trigger if exists on_auth_user_seed_zz_strength_catalog_v21 on auth.users;
create trigger on_auth_user_seed_zz_strength_catalog_v21 after insert on auth.users for each row execute function public.handle_new_user_strength_catalog_v21();
do $$ declare v_user uuid;begin for v_user in select id from auth.users loop perform public.install_strength_catalog_v21(v_user);end loop;end $$;

create or replace function public.save_strength_exercise(p_exercise jsonb, p_muscle_tags text[])
returns uuid language plpgsql set search_path='' as $$
declare v_user_id uuid:=auth.uid();v_id uuid:=nullif(p_exercise->>'id','')::uuid;v_name text:=regexp_replace(trim(p_exercise->>'name'),'\s+',' ','g');v_tracking public.exercise_tracking_type:=(p_exercise->>'tracking_type')::public.exercise_tracking_type;v_mode text:=coalesce(nullif(p_exercise->>'load_mode',''),'weight_reps');v_rows integer;v_direction text:=coalesce(nullif(p_exercise->>'progression_direction',''),(select progression_direction from public.exercises where id=v_id and user_id=v_user_id),'higher_is_better');
begin
  if v_user_id is null then raise exception 'Authentication required';end if;
  if v_name is null or v_name='' then raise exception 'Exercise name is required';end if;
  if v_mode not in ('weight_reps','reps_only') then raise exception 'Invalid load mode';end if;
  if v_direction not in ('higher_is_better','lower_is_better') or (v_direction='lower_is_better' and (v_tracking is distinct from 'repetitions' or v_mode<>'weight_reps')) then raise exception 'Invalid progression direction';end if;
  if v_tracking='distance' and v_mode<>'weight_reps' then raise exception 'Distance exercises cannot use reps-only mode';end if;
  if coalesce(array_length(p_muscle_tags,1),0)=0 then raise exception 'At least one muscle tag is required';end if;
  perform pg_advisory_xact_lock(hashtext(v_user_id::text));
  if exists(select 1 from public.exercises where user_id=v_user_id and id is distinct from v_id and lower(regexp_replace(trim(name),'\s+',' ','g'))=lower(v_name)) then raise exception 'An exercise with this name already exists';end if;
  if v_id is null then
    insert into public.exercises(user_id,name,tracking_type,load_mode,progression_direction,major_muscle_group,is_compound) values(v_user_id,v_name,v_tracking,v_mode,v_direction,p_exercise->>'major_muscle_group',(p_exercise->>'is_compound')::boolean) returning id into v_id;
  else
    update public.exercises set name=v_name,tracking_type=v_tracking,load_mode=v_mode,progression_direction=v_direction,major_muscle_group=p_exercise->>'major_muscle_group',is_compound=(p_exercise->>'is_compound')::boolean where id=v_id and user_id=v_user_id;
    get diagnostics v_rows=row_count;if v_rows<>1 then raise exception 'Exercise not found';end if;
  end if;
  delete from public.exercise_muscle_assignments where exercise_id=v_id and user_id=v_user_id;
  insert into public.exercise_muscle_assignments(user_id,exercise_id,muscle_tag) select v_user_id,v_id,tag from unnest(p_muscle_tags)tag;
  delete from public.exercise_group_assignments where exercise_id=v_id and user_id=v_user_id;
  insert into public.exercise_group_assignments(user_id,exercise_id,major_group)
  select v_user_id,v_id,group_name from (
    select p_exercise->>'major_muscle_group' group_name
    union select jsonb_array_elements_text(coalesce(p_exercise->'major_muscle_groups','[]'::jsonb))
  ) groups;
  return v_id;
end $$;
revoke all on function public.save_strength_exercise(jsonb,text[]) from public,anon,authenticated;
grant execute on function public.save_strength_exercise(jsonb,text[]) to authenticated;


create or replace function public.private_group_summary(p_group_id uuid,p_period text default 'month',p_timezone text default 'UTC',p_activity text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_now timestamptz:=now(); v_local timestamp; v_start timestamptz; v_month timestamptz; v_eligible uuid[]; v_members jsonb; v_sets jsonb; v_prs jsonb; v_cardio jsonb; v_activities jsonb; v_name text;
begin
 -- Share lock serializes against membership revocation/group deletion during a read.
 select group_row.name into v_name from public.groups group_row where group_row.id=p_group_id for share;
 if v_name is null or auth.uid() is null or not public.is_group_member(p_group_id) then raise exception 'Group unavailable or membership removed' using errcode='42501'; end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names timezone_row where timezone_row.name=p_timezone) then raise exception 'Invalid calendar timezone'; end if;
 v_local:=v_now at time zone p_timezone;
 v_month:=date_trunc('month',v_local) at time zone p_timezone;
 v_start:=(case p_period when 'week' then date_trunc('week',v_local) when 'month' then date_trunc('month',v_local) when '3m' then date_trunc('month',v_local)-interval '2 months' when '6m' then date_trunc('month',v_local)-interval '5 months' when 'year' then date_trunc('year',v_local) else null end) at time zone p_timezone;
 if v_start is null then raise exception 'Invalid calendar period'; end if;
 -- Freeze the eligible member population once for every returned aggregate.
 select coalesce(array_agg(member_row.user_id),array[]::uuid[]) into v_eligible from public.group_members member_row
 left join public.group_progress_privacy privacy_row on privacy_row.user_id=member_row.user_id
 where member_row.group_id=p_group_id and coalesce(privacy_row.share_progress,true);
 select coalesce(jsonb_agg(jsonb_build_object('member_id',member_row.id,'display_name',member_row.display_name,'role',member_row.role,'is_self',member_row.user_id=auth.uid(),'sharing_progress',member_row.user_id=any(v_eligible)) order by lower(member_row.display_name),member_row.id),'[]') into v_members from public.group_members member_row where member_row.group_id=p_group_id;
 with counted as (
  select member_row.id member_id,case when exercise_row.major_muscle_group in ('Legs','Chest','Back','Arms','Shoulders','Core') then exercise_row.major_muscle_group else 'Olympic/Other' end muscle,count(*) total
  from public.group_members member_row join public.strength_sets set_row on set_row.user_id=member_row.user_id
  join public.strength_workouts workout_row on workout_row.id=set_row.workout_id and workout_row.user_id=set_row.user_id
  join public.exercises exercise_row on exercise_row.id=set_row.exercise_id and exercise_row.user_id=set_row.user_id
  where member_row.group_id=p_group_id and member_row.user_id=any(v_eligible) and workout_row.performed_at>=v_start and workout_row.performed_at<=v_now
  group by member_row.id,2
 ) select coalesce(jsonb_agg(to_jsonb(counted)),'[]') into v_sets from counted;
 -- Mirror the exclusive client PR pipeline. Canonical comparison grid = 0.000001 kg.
 with source as (
  select member_row.id member_id,set_row.id,set_row.exercise_id,set_row.workout_id,set_row.set_order,workout_row.performed_at,workout_row.created_at,set_row.reps,exercise_row.progression_direction,
   case when set_row.weight is null then null else round(set_row.weight*case when set_row.weight_unit='kg' then 1 else 0.45359237 end,6) end kg
  from public.group_members member_row join public.strength_sets set_row on set_row.user_id=member_row.user_id
  join public.strength_workouts workout_row on workout_row.id=set_row.workout_id and workout_row.user_id=set_row.user_id
  join public.exercises exercise_row on exercise_row.id=set_row.exercise_id and exercise_row.user_id=set_row.user_id
  where member_row.group_id=p_group_id and member_row.user_id=any(v_eligible) and set_row.tracking_type='repetitions' and set_row.reps is not null and (exercise_row.progression_direction<>'lower_is_better' or set_row.weight is not null) and workout_row.performed_at<=v_now
 ), evidence as (
  select *,first_value(workout_id) over chronology first_workout,first_value(id) over chronology first_set,
   min(kg) over (partition by member_id,exercise_id order by performed_at,created_at,set_order,id rows between unbounded preceding and 1 preceding) prior_assistance,
   max(kg) over (partition by member_id,exercise_id order by performed_at,created_at,set_order,id rows between unbounded preceding and 1 preceding) prior_weight,
   max(reps) over (partition by member_id,exercise_id,kg order by performed_at,created_at,set_order,id rows between unbounded preceding and 1 preceding) prior_reps
  from source window chronology as (partition by member_id,exercise_id order by performed_at,created_at,set_order,id)
 ), events as (
  select *,case when (progression_direction='lower_is_better' and id=first_set) or (progression_direction='higher_is_better' and workout_id=first_workout) then null when kg is not null and ((progression_direction='lower_is_better' and prior_assistance is not null and kg<prior_assistance) or (progression_direction='higher_is_better' and prior_weight is not null and kg>prior_weight)) then 'weight' when prior_reps is not null and reps>prior_reps then 'reps' else null end achievement from evidence
 ), counts as (
  select member_id,count(*) filter(where achievement='weight') weight_prs,count(*) filter(where achievement='reps') rep_prs
  from events where performed_at>=v_month group by member_id
 ) select coalesce(jsonb_agg(to_jsonb(counts)),'[]') into v_prs from counts;
 with entries as (
  select member_row.id member_id,lower(regexp_replace(trim(activity_row.name),'\s+',' ','g')) activity,session_row.duration_seconds,
   case when session_row.distance is null then null else session_row.distance*case session_row.distance_unit when 'meters' then 1 when 'kilometers' then 1000 when 'miles' then 1609.344 when 'yards' then 0.9144 when 'feet' then 0.3048 else null end end meters
  from public.group_members member_row join public.cardio_sessions session_row on session_row.user_id=member_row.user_id
  join public.cardio_activities activity_row on activity_row.id=session_row.activity_id and activity_row.user_id=session_row.user_id
  where member_row.group_id=p_group_id and member_row.user_id=any(v_eligible) and session_row.performed_at>=v_start and session_row.performed_at<=v_now
 ), counts as (
  select member_id,activity,count(*) entries,sum(coalesce(duration_seconds,0)) duration_seconds,sum(meters) distance_meters,count(meters) distance_entries
  from entries where p_activity='' or activity=p_activity group by member_id,activity
 ) select coalesce(jsonb_agg(to_jsonb(counts)),'[]') into v_cardio from counts;
 select coalesce(jsonb_agg(activity order by activity),'[]') into v_activities from (
  select distinct lower(regexp_replace(trim(activity_row.name),'\s+',' ','g')) activity from public.group_members member_row
  join public.cardio_sessions session_row on session_row.user_id=member_row.user_id join public.cardio_activities activity_row on activity_row.id=session_row.activity_id and activity_row.user_id=session_row.user_id
  where member_row.group_id=p_group_id and member_row.user_id=any(v_eligible) and session_row.performed_at>=v_start and session_row.performed_at<=v_now
 ) names;
 return jsonb_build_object('name',v_name,'timezone',p_timezone,'period_start',v_start,'month_start',v_month,'through',v_now,'members',v_members,'sets',v_sets,'prs',v_prs,'cardio',v_cardio,'activities',v_activities);
end $$;

revoke all on function public.private_group_summary(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.private_group_summary(uuid,text,text,text) to authenticated;
-- Existing release ledger RPCs accept the new stable ID without schema changes.
commit;
