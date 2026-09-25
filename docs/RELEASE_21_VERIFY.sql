-- READ ONLY. Run manually after the separately reviewed migration 011.
select count(*) as invalid_steps from public.cardio_sessions where step_count<=0;
select count(*) as invalid_directions from public.exercises where progression_direction not in ('higher_is_better','lower_is_better') or progression_direction is null or (progression_direction='lower_is_better' and (tracking_type<>'repetitions' or load_mode<>'weight_reps'));
select count(*) as missing_assisted_starters from auth.users u cross join (values ('assisteddip'),('assistedpullup'),('assistedchinup')) c(name)
where not exists(select 1 from public.exercises e where e.user_id=u.id and regexp_replace(regexp_replace(lower(e.name),'[^a-z0-9]','','g'),'s$','')=c.name and e.progression_direction='lower_is_better');
select count(*) as incorrect_dip_classifications from public.exercises e where regexp_replace(regexp_replace(lower(e.name),'[^a-z0-9]','','g'),'s$','') in ('dip','weighteddip','assisteddip') and
(e.major_muscle_group<>'Arms' or not exists(select 1 from public.exercise_muscle_assignments a where a.exercise_id=e.id and a.user_id=e.user_id and a.muscle_tag='Triceps'));
select p.proname,p.prosecdef,p.proconfig,has_function_privilege('anon',p.oid,'execute') as anon_execute,has_function_privilege('authenticated',p.oid,'execute') as authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('install_strength_catalog_v21','handle_new_user_strength_catalog_v21','save_strength_exercise','private_group_summary');
-- Only save_strength_exercise and private_group_summary should allow authenticated execute; anon always false.
select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('exercises','cardio_sessions','strength_sets','group_members','group_progress_privacy');
-- Run RELEASE_21_PRESERVATION.sql again. EVERY original count and value fingerprint must match.
-- Do not call mutation RPCs in read-only verification. Authenticated QA is a separate approved step.
