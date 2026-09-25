-- READ ONLY. Review outputs before manually considering migration 011.
-- User reports 001-010 applied. Never rerun them.
select table_name,column_name,data_type,is_nullable,column_default,is_generated
from information_schema.columns where table_schema='public' and
 ((table_name='cardio_sessions' and column_name='step_count') or
 (table_name='exercises' and column_name in ('load_mode','progression_direction')));
-- Optional columns may be absent. If present: integer steps, text direction, no generated columns.
select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('exercises','cardio_sessions','strength_sets','group_members','group_progress_privacy');
select to_regprocedure('public.save_strength_exercise(jsonb,text[])') is not null as exercise_rpc,
 to_regprocedure('public.private_group_summary(uuid,text,text,text)') is not null as group_rpc,
 to_regprocedure('public.get_release_acknowledgement(text)') is not null as release_lookup,
 to_regprocedure('public.acknowledge_release(text)') is not null as release_save;
-- All counts must be zero. Resolve collisions deliberately; 011 fails closed without rewriting values.
with equivalents as (
 select user_id,regexp_replace(regexp_replace(lower(name),'[^a-z0-9]','','g'),'s$','') canonical,count(*) copies,
 bool_or(tracking_type<>'repetitions' or load_mode<>'weight_reps') incompatible
 from public.exercises where regexp_replace(regexp_replace(lower(name),'[^a-z0-9]','','g'),'s$','') in ('assisteddip','assistedpullup','assistedchinup')
 group by user_id,2
) select count(*) filter(where copies>1) as ambiguous_equivalents,count(*) filter(where incompatible) as incompatible_equivalents from equivalents;
-- This does NOT establish the cause of a real startup failure. No repair is performed.
select count(*) filter(where p.user_id is null) as missing_profiles,count(*) filter(where s.user_id is null) as missing_settings
from auth.users u left join public.profiles p on p.user_id=u.id left join public.user_settings s on s.user_id=u.id;
-- Also run RELEASE_21_PRESERVATION.sql and save results before application.
-- Inspect narrow catalog scope privately: aggregate counts only, no workout values.
select regexp_replace(regexp_replace(lower(e.name),'[^a-z0-9]','','g'),'s$','') as catalog_name,
 count(*) as matching_exercises,
 count(*) filter(where exists(select 1 from public.strength_sets s where s.exercise_id=e.id and s.user_id=e.user_id)) as with_saved_history,
 count(*) filter(where e.archived) as archived_matches
from public.exercises e
where regexp_replace(regexp_replace(lower(e.name),'[^a-z0-9]','','g'),'s$','') in ('dip','weighteddip','assisteddip','assistedpullup','assistedchinup')
group by 1;
-- Inspect all current constraints/policies, including unexpected partial-state additions.
select c.relname,k.conname,pg_get_constraintdef(k.oid) as definition
from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('exercises','cardio_sessions','strength_sets');
select tablename,policyname,roles,cmd,qual,with_check from pg_policies
where schemaname='public' and tablename in ('exercises','cardio_sessions','strength_sets','exercise_group_assignments','exercise_muscle_assignments');
select tgname,pg_get_triggerdef(oid) from pg_trigger
where tgrelid='auth.users'::regclass and not tgisinternal order by tgname;
-- Optional partial-state values without directly referencing possibly absent columns.
select count(*) filter(where to_jsonb(c)->>'step_count' is not null and
 case when to_jsonb(c)->>'step_count' ~ '^[0-9]+$' then
  (to_jsonb(c)->>'step_count')::numeric not between 1 and 2147483647
 else true end) as malformed_partial_steps
from public.cardio_sessions c;
select count(*) as incompatible_partial_directions from public.exercises e
where to_jsonb(e)->>'progression_direction' is not null and
 (to_jsonb(e)->>'progression_direction' not in ('higher_is_better','lower_is_better') or
 (to_jsonb(e)->>'progression_direction'='lower_is_better' and (e.tracking_type<>'repetitions' or e.load_mode<>'weight_reps')));
