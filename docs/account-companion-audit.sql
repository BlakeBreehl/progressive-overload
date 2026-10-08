-- Read-only diagnostic for an operator to run manually. Never applied by the app.
-- Missing libraries are evidence for investigation, not permission to reseed them.
SELECT u.id,
 NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id=u.id) AS missing_profile,
 NOT EXISTS (SELECT 1 FROM public.user_settings s WHERE s.user_id=u.id) AS missing_settings,
 NOT EXISTS (SELECT 1 FROM public.exercises e WHERE e.user_id=u.id) AS empty_strength_library,
 NOT EXISTS (SELECT 1 FROM public.cardio_activities c WHERE c.user_id=u.id) AS empty_cardio_library,
 NOT EXISTS (SELECT 1 FROM public.mobility_activities s WHERE s.user_id=u.id) AS empty_stretch_library
FROM auth.users u;
