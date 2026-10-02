-- REVIEW ONLY. Forward-only from 001?012. Never run as browser roles.
BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE oid IN
 ('public.cardio_activities'::regclass,'public.cardio_sessions'::regclass) AND NOT relrowsecurity)
 THEN RAISE EXCEPTION 'Required ownership RLS is disabled'; END IF;
END $$;
-- Preservation snapshot excludes only the newly added configuration column.
CREATE TEMP TABLE cardio_013_snapshot ON COMMIT DROP AS
 SELECT id, to_jsonb(s) AS original FROM public.cardio_sessions s;
ALTER TABLE public.cardio_activities ADD COLUMN tracking_mode text NOT NULL DEFAULT 'timed'
 CHECK (tracking_mode IN ('timed','steps'));
ALTER TABLE public.cardio_sessions ADD COLUMN tracking_mode text NOT NULL DEFAULT 'timed'
 CHECK (tracking_mode IN ('timed','steps'));
ALTER TABLE public.cardio_sessions ALTER COLUMN tracking_mode DROP DEFAULT;
-- duration_seconds was already nullable in 001. No historical metric is changed.
CREATE FUNCTION public.install_private_steps_activity(p_user_id uuid) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE existing_id uuid; matches integer;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('cardio:'||p_user_id::text));
 SELECT count(*),(array_agg(id ORDER BY created_at,id))[1] INTO matches,existing_id
 FROM public.cardio_activities WHERE user_id=p_user_id
 AND regexp_replace(lower(trim(name)),'[^a-z0-9]','','g')='steps';
 IF matches>1 THEN RAISE EXCEPTION 'Ambiguous normalized Steps activities; resolve before migration'; END IF;
 IF matches=0 THEN INSERT INTO public.cardio_activities(user_id,name,tracking_mode) VALUES(p_user_id,'Steps','steps');
 ELSE UPDATE public.cardio_activities SET tracking_mode='steps' WHERE id=existing_id AND tracking_mode<>'steps'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.install_private_steps_activity(uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.handle_new_user_steps_activity() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM public.install_private_steps_activity(new.id); RETURN new; END $$;
REVOKE ALL ON FUNCTION public.handle_new_user_steps_activity() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER on_auth_user_seed_zz_steps_activity AFTER INSERT ON auth.users
 FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_steps_activity();
DO $$ DECLARE account_id uuid; BEGIN
 FOR account_id IN SELECT id FROM auth.users LOOP PERFORM public.install_private_steps_activity(account_id); END LOOP;
END $$;
-- Renaming/archiving remains allowed. Configuration cannot reinterpret historical entries.
CREATE FUNCTION public.protect_cardio_tracking_mode() RETURNS trigger
 LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF new.tracking_mode IS DISTINCT FROM old.tracking_mode THEN RAISE EXCEPTION 'Activity tracking mode cannot be changed'; END IF;
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION public.protect_cardio_tracking_mode() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER protect_cardio_tracking_mode BEFORE UPDATE ON public.cardio_activities
 FOR EACH ROW EXECUTE FUNCTION public.protect_cardio_tracking_mode();
CREATE FUNCTION public.validate_cardio_tracking_entry() RETURNS trigger
 LANGUAGE plpgsql SET search_path='' AS $$
DECLARE mode text; legacy boolean:=false;
BEGIN
 -- Invoker rights plus composite ownership FK/RLS. Lock serializes activity changes.
 SELECT tracking_mode INTO mode FROM public.cardio_activities
 WHERE id=new.activity_id AND user_id=new.user_id FOR SHARE;
 IF mode IS NULL THEN RAISE EXCEPTION 'Owned Cardio activity required' USING errcode='42501'; END IF;
 IF TG_OP='INSERT' THEN new.tracking_mode:=coalesce(new.tracking_mode,mode);
 ELSE
  IF new.user_id IS DISTINCT FROM old.user_id THEN RAISE EXCEPTION 'Cannot transfer entry ownership'; END IF;
  legacy:=old.tracking_mode='timed' AND new.tracking_mode='timed' AND new.activity_id=old.activity_id;
 END IF;
 IF new.tracking_mode IS DISTINCT FROM mode AND NOT legacy THEN RAISE EXCEPTION 'Incompatible activity tracking mode'; END IF;
 IF new.tracking_mode='steps' THEN
  IF new.step_count IS NULL OR new.step_count<=0 THEN RAISE EXCEPTION 'Positive whole steps required'; END IF;
  IF new.duration_seconds IS NOT NULL OR new.distance IS NOT NULL OR new.distance_unit IS NOT NULL
    OR new.speed IS NOT NULL OR new.laps IS NOT NULL OR new.incline IS NOT NULL OR new.difficulty IS NOT NULL
  THEN RAISE EXCEPTION 'Steps entries cannot contain timed metrics'; END IF;
 ELSE
  -- Historical null/zero duration is preserved only when its original value is unchanged.
  IF legacy AND new.duration_seconds IS NOT DISTINCT FROM old.duration_seconds THEN RETURN new; END IF;
  IF new.duration_seconds IS NULL OR new.duration_seconds<1 OR new.duration_seconds>359999
    OR new.duration_seconds<>trunc(new.duration_seconds) THEN RAISE EXCEPTION 'Timed entries require whole seconds from 1 to 359999'; END IF;
 END IF;
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION public.validate_cardio_tracking_entry() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER validate_cardio_tracking_entry BEFORE INSERT OR UPDATE ON public.cardio_sessions
 FOR EACH ROW EXECUTE FUNCTION public.validate_cardio_tracking_entry();
-- Existing ownership FKs, RLS, table grants, and timestamp triggers stay intact.

-- Steps is excluded from timed leaderboards; no step ranking is invented.
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
  where member_row.group_id=p_group_id and member_row.user_id=any(v_eligible) and (set_row.tracking_type='distance' or set_row.reps>0) and workout_row.performed_at>=v_start and workout_row.performed_at<=v_now
  group by member_row.id,2
 ) select coalesce(jsonb_agg(to_jsonb(counted)),'[]') into v_sets from counted;
 -- Mirror the exclusive client PR pipeline. Canonical comparison grid = 0.000001 kg.
 with source as (
  select member_row.id member_id,set_row.id,set_row.exercise_id,set_row.workout_id,set_row.set_order,workout_row.performed_at,workout_row.created_at,set_row.reps,exercise_row.progression_direction,
   case when set_row.weight is null then null else round(set_row.weight*case when set_row.weight_unit='kg' then 1 else 0.45359237 end,6) end kg
  from public.group_members member_row join public.strength_sets set_row on set_row.user_id=member_row.user_id
  join public.strength_workouts workout_row on workout_row.id=set_row.workout_id and workout_row.user_id=set_row.user_id
  join public.exercises exercise_row on exercise_row.id=set_row.exercise_id and exercise_row.user_id=set_row.user_id
  where member_row.group_id=p_group_id and member_row.user_id=any(v_eligible) and set_row.tracking_type='repetitions' and set_row.reps>0 and (exercise_row.progression_direction<>'lower_is_better' or set_row.weight is not null) and workout_row.performed_at<=v_now
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
  where member_row.group_id=p_group_id and member_row.user_id=any(v_eligible) and session_row.tracking_mode='timed' and session_row.performed_at>=v_start and session_row.performed_at<=v_now
 ), counts as (
  select member_id,activity,count(*) entries,sum(coalesce(duration_seconds,0)) duration_seconds,sum(meters) distance_meters,count(meters) distance_entries
  from entries where p_activity='' or activity=p_activity group by member_id,activity
 ) select coalesce(jsonb_agg(to_jsonb(counts)),'[]') into v_cardio from counts;
 select coalesce(jsonb_agg(activity order by activity),'[]') into v_activities from (
  select distinct lower(regexp_replace(trim(activity_row.name),'\s+',' ','g')) activity from public.group_members member_row
  join public.cardio_sessions session_row on session_row.user_id=member_row.user_id join public.cardio_activities activity_row on activity_row.id=session_row.activity_id and activity_row.user_id=session_row.user_id
  where member_row.group_id=p_group_id and member_row.user_id=any(v_eligible) and session_row.tracking_mode='timed' and session_row.performed_at>=v_start and session_row.performed_at<=v_now
 ) names;
 return jsonb_build_object('name',v_name,'timezone',p_timezone,'period_start',v_start,'month_start',v_month,'through',v_now,'members',v_members,'sets',v_sets,'prs',v_prs,'cardio',v_cardio,'activities',v_activities);
end $$;

revoke all on function public.private_group_summary(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.private_group_summary(uuid,text,text,text) to authenticated;

DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM cardio_013_snapshot p FULL JOIN public.cardio_sessions s USING(id)
 WHERE p.id IS NULL OR s.id IS NULL OR p.original IS DISTINCT FROM (to_jsonb(s)-'tracking_mode'))
 THEN RAISE EXCEPTION 'Cardio preservation check failed'; END IF;
END $$;
COMMIT;
