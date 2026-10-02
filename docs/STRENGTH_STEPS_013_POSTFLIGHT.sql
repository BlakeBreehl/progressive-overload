-- REVIEW ONLY; NOT EXECUTED. Run after an independently approved application of 013.
-- Compare preservation exports, policies, grants, owners and original timestamps with preflight.
SELECT id,to_jsonb(s)-'tracking_mode' original FROM public.cardio_sessions s ORDER BY id;
SELECT id,user_id,name,archived,created_at FROM public.cardio_activities ORDER BY id;
SELECT a.id FROM auth.users a WHERE NOT EXISTS(
 SELECT 1 FROM public.cardio_activities c WHERE c.user_id=a.id AND c.tracking_mode='steps');
SELECT s.id FROM public.cardio_sessions s JOIN public.cardio_activities a ON a.id=s.activity_id
WHERE s.user_id<>a.user_id OR (s.tracking_mode='steps' AND
 (a.tracking_mode<>'steps' OR s.step_count IS NULL OR s.step_count<=0 OR s.duration_seconds IS NOT NULL
 OR s.distance IS NOT NULL OR s.distance_unit IS NOT NULL OR s.speed IS NOT NULL
 OR s.laps IS NOT NULL OR s.incline IS NOT NULL OR s.difficulty IS NOT NULL));
SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies
WHERE schemaname='public' AND tablename IN ('cardio_activities','cardio_sessions');
SELECT relname,relrowsecurity,relforcerowsecurity,relowner::regrole,relacl
FROM pg_class WHERE oid IN ('public.cardio_activities'::regclass,'public.cardio_sessions'::regclass);
SELECT p.oid::regprocedure,p.proowner::regrole,p.prosecdef,p.proconfig,p.proacl,
 has_function_privilege('anon',p.oid,'EXECUTE') anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') browser_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('install_private_steps_activity','handle_new_user_steps_activity','validate_cardio_tracking_entry','protect_cardio_tracking_mode','private_group_summary','install_private_cardio_activities');
-- Only private_group_summary should be browser-executable among the new/replaced functions.
SELECT event_object_schema,event_object_table,trigger_name,action_statement
FROM information_schema.triggers WHERE trigger_name IN
 ('on_auth_user_seed_zz_steps_activity','validate_cardio_tracking_entry','protect_cardio_tracking_mode');
