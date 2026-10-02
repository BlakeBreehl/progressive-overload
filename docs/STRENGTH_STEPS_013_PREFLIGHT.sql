-- REVIEW ONLY; NOT EXECUTED. Export each result before applying migration 013.
-- Preflight after 001–012, before 013. Ambiguities must be reviewed without deleting history.
SELECT user_id, count(*), array_agg(id ORDER BY created_at,id) ids
FROM public.cardio_activities
WHERE regexp_replace(lower(trim(name)),'[^a-z0-9]','','g')='steps'
GROUP BY user_id HAVING count(*)>1;
SELECT table_name,column_name,data_type,is_nullable,column_default
FROM information_schema.columns WHERE table_schema='public'
AND table_name IN ('cardio_activities','cardio_sessions') ORDER BY table_name,ordinal_position;
SELECT conrelid::regclass,conname,pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid IN ('public.cardio_activities'::regclass,'public.cardio_sessions'::regclass);
-- Preservation export: compare this exact result after 013. No live values are rewritten.
SELECT id,to_jsonb(s)-'tracking_mode' original FROM public.cardio_sessions s ORDER BY id;
SELECT id,user_id,name,archived,created_at FROM public.cardio_activities ORDER BY id;
SELECT p.oid::regprocedure,p.proowner::regrole,p.prosecdef,p.proconfig,p.proacl,md5(pg_get_functiondef(p.oid)) definition_hash
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('private_group_summary','install_private_cardio_activities');
SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies
WHERE schemaname='public' AND tablename IN ('cardio_activities','cardio_sessions');
SELECT relname,relrowsecurity,relforcerowsecurity,relowner::regrole,relacl
FROM pg_class WHERE oid IN ('public.cardio_activities'::regclass,'public.cardio_sessions'::regclass);
SELECT event_object_table,trigger_name,action_statement FROM information_schema.triggers
WHERE event_object_schema='public' AND event_object_table IN ('cardio_activities','cardio_sessions');
