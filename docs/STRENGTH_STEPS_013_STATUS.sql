-- Read-only. Run first whether you believe 013 is applied or not. Never rerun 013 based on Git status.
BEGIN TRANSACTION READ ONLY;
SELECT table_name,column_name,data_type,is_nullable,column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name IN ('cardio_activities','cardio_sessions')
AND column_name IN ('tracking_mode','step_count','duration_seconds')
ORDER BY table_name,column_name;
SELECT p.oid::regprocedure function_name,p.prosecdef,p.proconfig,
 has_function_privilege('anon',p.oid,'EXECUTE') anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute,
 pg_get_functiondef(p.oid) definition
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN
 ('install_private_steps_activity','handle_new_user_steps_activity',
 'protect_cardio_tracking_mode','validate_cardio_tracking_entry','private_group_summary');
SELECT t.tgname,t.tgenabled,t.tgrelid::regclass table_name,pg_get_triggerdef(t.oid) definition
FROM pg_trigger t WHERE NOT t.tgisinternal AND t.tgname IN
 ('on_auth_user_seed_zz_steps_activity','protect_cardio_tracking_mode','validate_cardio_tracking_entry');
SELECT c.conrelid::regclass table_name,c.conname,pg_get_constraintdef(c.oid) definition
FROM pg_constraint c WHERE c.conrelid IN
 ('public.cardio_activities'::regclass,'public.cardio_sessions'::regclass);
SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check
FROM pg_policies WHERE schemaname='public' AND tablename IN ('cardio_activities','cardio_sessions');
COMMIT;
-- Complete 013: both NOT NULL text tracking_mode columns, four new functions, three enabled triggers,
-- activity/session timed/steps CHECKs, and both private_group_summary Cardio queries exclude Steps.
-- Compare definitions to the local migration. Partial/different evidence: stop and investigate; do not rerun.
