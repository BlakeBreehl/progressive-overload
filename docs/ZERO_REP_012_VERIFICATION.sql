-- READ-ONLY PREFLIGHT: run manually before applying migration 012.
select conname, pg_get_constraintdef(oid) from pg_constraint
where conrelid in ('public.strength_sets'::regclass,'public.historical_strength_records'::regclass) and contype='c';
select pg_get_functiondef('public.enforce_strength_set_load_mode()'::regprocedure);
select pg_get_functiondef('public.save_strength_workout(jsonb,jsonb)'::regprocedure);
select pg_get_functiondef('public.private_group_summary(uuid,text,text,text)'::regprocedure);
select count(*) filter(where reps < 0 or reps > 9007199254740991 or reps <> trunc(reps) or reps::text in ('NaN','Infinity','-Infinity')) as invalid_reps,
       count(*) filter(where tracking_type='repetitions' and reps=0) as attempts
from public.strength_sets;
-- POSTFLIGHT: run manually after applying 012. Expect all booleans true.
select position('new.reps < 0' in pg_get_functiondef('public.enforce_strength_set_load_mode()'::regprocedure))>0 as accepts_zero,
       position('new.reps > 9007199254740991' in pg_get_functiondef('public.enforce_strength_set_load_mode()'::regprocedure))>0 as safe_integer_bound,
       position('set_row.reps>0' in pg_get_functiondef('public.private_group_summary(uuid,text,text,text)'::regprocedure))>0 as ignores_attempts;
select p.proname,p.prosecdef,p.proconfig,p.proacl from pg_proc p
where p.oid in ('public.enforce_strength_set_load_mode()'::regprocedure,'public.private_group_summary(uuid,text,text,text)'::regprocedure);
select relname,relrowsecurity from pg_class where oid in ('public.strength_sets'::regclass,'public.strength_workouts'::regclass);
-- Re-run the preflight counts and compare: applying 012 must not change any data.

-- PRESERVATION SNAPSHOT: run this identical block BEFORE and AFTER 012,
-- with application writes paused; export results and compare every value.
-- These are reads only. No record should change during migration application.
select 'strength_workouts' as source, count(*) as rows,
 count(duration_seconds) as timed_rows, sum(duration_seconds) as duration_sum
from public.strength_workouts;
select 'strength_sets' as source, count(*) as rows, count(distinct workout_id) as workouts,
 sum(weight) as weight_sum, sum(reps) as reps_sum, sum(load) as load_sum,
 sum(distance) as distance_sum, sum(laps) as laps_sum,
 count(duration_seconds) as timed_rows, sum(duration_seconds) as duration_sum,
 count(*) filter(where tracking_type='repetitions' and reps=0) as attempts,
 count(*) filter(where tracking_type='distance' or reps>0) as successful_sets
from public.strength_sets;
select 'historical_strength_records' as source, count(*) as rows,
 sum(weight) as weight_sum, sum(reps) as reps_sum, sum(load) as load_sum,
 sum(distance) as distance_sum, sum(laps) as laps_sum, sum(duration_seconds) as duration_sum
from public.historical_strength_records;
select 'cardio_sessions' as source, count(*) as rows, sum(duration_seconds) as duration_sum,
 sum(distance) as distance_sum, sum(steps) as steps_sum from public.cardio_sessions;
select 'mobility_sets' as source, count(*) as rows, sum(duration_seconds) as duration_sum,
 sum(reps) as reps_sum from public.mobility_sets;
select 'weigh_ins' as source, count(*) as rows, sum(weight) as weight_sum from public.weigh_ins;
-- Compare function owners, ACLs, SECURITY DEFINER and search paths before/after.
select p.oid::regprocedure as function, pg_get_userbyid(p.proowner) as owner,
 p.prosecdef, p.proconfig, p.proacl from pg_proc p where p.oid in
 ('public.enforce_strength_set_load_mode()'::regprocedure,
 'public.private_group_summary(uuid,text,text,text)'::regprocedure,
 'public.save_strength_workout(jsonb,jsonb)'::regprocedure);
select tgname, pg_get_triggerdef(oid) from pg_trigger
 where tgrelid='public.strength_sets'::regclass and not tgisinternal;
