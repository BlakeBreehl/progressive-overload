# Strength catalog v2 manual application

Migration `202609010007_strength_load_modes_and_catalog.sql` is forward-only and has not been applied.

1. Back up the target database and confirm migrations 001–006 are recorded.
2. Check normalized-name conflicts with `select user_id, lower(regexp_replace(trim(name),'\s+',' ','g')) normalized, count(*) from public.exercises group by 1,2 having count(*) > 1;`.
3. Run migration 007 in the Supabase SQL editor as one transaction.
4. Verify all three editor choices save: Weight + Reps, Reps Only, and Distance/Laps. Confirm the custom warning appears when changing a used exercise.
5. Verify one normalized Squat per user and that conflicting Dumbbell Bench names were not merged.
6. Test reps-only, weighted-repetition, and distance saves under two authenticated accounts.

The previous `42710` means the first run created `enforce_strength_set_load_mode` before stopping at its unconditional `CREATE TRIGGER`. Earlier statements may therefore be committed. The repaired file starts an explicit transaction, normalizes the column and constraint, drops/recreates both named triggers on their exact target tables, and commits only after catalog/RPC/index work succeeds.

After running the repaired file, verify:

```sql
-- Exactly one correctly attached trigger of each kind.
select n.nspname,c.relname,t.tgname,p.proname,pg_get_triggerdef(t.oid)
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace join pg_proc p on p.oid=t.tgfoid
where not t.tgisinternal and t.tgname in ('enforce_strength_set_load_mode','on_auth_user_seed_strength_catalog_v2');

-- Column/default/nullability and the single canonical check constraint.
select column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name='exercises' and column_name='load_mode';
select conname,pg_get_constraintdef(oid) from pg_constraint where conrelid='public.exercises'::regclass and conname='exercises_load_mode_check';

-- Catalog definitions, per-user counts, and normalized duplicates.
select user_id,name,load_mode from public.exercises where lower(regexp_replace(trim(name),'\s+',' ','g')) in ('pull up','chin up','dip','push up','leg lift','weighted pull up','weighted chin up','weighted dip','squat') order by user_id,name;
select user_id,lower(regexp_replace(trim(name),'\s+',' ','g')) normalized,count(*) from public.exercises group by 1,2 having count(*)>1;

-- All five indexes.
select indexname from pg_indexes where schemaname='public' and indexname in ('strength_workouts_user_performed_created_id_idx','strength_sets_user_exercise_workout_idx','cardio_sessions_user_activity_location_performed_idx','mobility_sessions_user_activity_performed_idx','weigh_ins_user_period_measured_idx') order by indexname;

-- Capture these before and after execution; counts and sums must match.
select count(*) set_count,count(weight) weighted_rows,sum(weight) stored_weight_total,sum(reps) stored_rep_total from public.strength_sets;
```

Legacy weights remain attached to their original historical exercise. New reps-only sets reject weight; no history is reassigned automatically.

Migration 007 also replaces the exercise-save RPC to validate arbitrary load modes, adds a Strength-set trigger that validates future writes against the exercise’s current definition, and adds the user-scoped history indexes documented in `DATA_ORDERING_AND_INDEXES.md`. Existing rows are deliberately not rewritten.
