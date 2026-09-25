-- READ ONLY. Run manually immediately before AND after 011 in a quiet maintenance window.
-- Save both result sets privately and compare every row/count/fingerprint exactly.
-- Cardio comparison treats an absent step_count column as null, retaining any partial-state values.
-- These are fingerprints, not personal record contents. Do not publish them with account metadata.
select 'strength_workouts' as relation,count(*) as rows,md5(coalesce(string_agg(md5((to_jsonb(t))::text),'' order by md5((to_jsonb(t))::text)),'')) as value_fingerprint from public.strength_workouts t
union all
select 'strength_sets' as relation,count(*) as rows,md5(coalesce(string_agg(md5((to_jsonb(t))::text),'' order by md5((to_jsonb(t))::text)),'')) as value_fingerprint from public.strength_sets t
union all
select 'historical_strength_records' as relation,count(*) as rows,md5(coalesce(string_agg(md5((to_jsonb(t))::text),'' order by md5((to_jsonb(t))::text)),'')) as value_fingerprint from public.historical_strength_records t
union all
select 'cardio_sessions' as relation,count(*) as rows,md5(coalesce(string_agg(md5((to_jsonb(t)||jsonb_build_object('step_count',to_jsonb(t)->'step_count'))::text),'' order by md5((to_jsonb(t)||jsonb_build_object('step_count',to_jsonb(t)->'step_count'))::text)),'')) as value_fingerprint from public.cardio_sessions t
union all
select 'mobility_sessions' as relation,count(*) as rows,md5(coalesce(string_agg(md5((to_jsonb(t))::text),'' order by md5((to_jsonb(t))::text)),'')) as value_fingerprint from public.mobility_sessions t
union all
select 'mobility_sets' as relation,count(*) as rows,md5(coalesce(string_agg(md5((to_jsonb(t))::text),'' order by md5((to_jsonb(t))::text)),'')) as value_fingerprint from public.mobility_sets t
union all
select 'weigh_ins' as relation,count(*) as rows,md5(coalesce(string_agg(md5((to_jsonb(t))::text),'' order by md5((to_jsonb(t))::text)),'')) as value_fingerprint from public.weigh_ins t
union all
select 'profiles' as relation,count(*) as rows,md5(coalesce(string_agg(md5((to_jsonb(t))::text),'' order by md5((to_jsonb(t))::text)),'')) as value_fingerprint from public.profiles t
union all
select 'user_settings' as relation,count(*) as rows,md5(coalesce(string_agg(md5((to_jsonb(t))::text),'' order by md5((to_jsonb(t))::text)),'')) as value_fingerprint from public.user_settings t
union all
select 'groups' as relation,count(*) as rows,md5(coalesce(string_agg(md5((to_jsonb(t))::text),'' order by md5((to_jsonb(t))::text)),'')) as value_fingerprint from public.groups t
union all
select 'group_members' as relation,count(*) as rows,md5(coalesce(string_agg(md5((to_jsonb(t))::text),'' order by md5((to_jsonb(t))::text)),'')) as value_fingerprint from public.group_members t
union all
select 'group_invites' as relation,count(*) as rows,md5(coalesce(string_agg(md5((to_jsonb(t))::text),'' order by md5((to_jsonb(t))::text)),'')) as value_fingerprint from public.group_invites t
union all
select 'group_progress_privacy' as relation,count(*) as rows,md5(coalesce(string_agg(md5((to_jsonb(t))::text),'' order by md5((to_jsonb(t))::text)),'')) as value_fingerprint from public.group_progress_privacy t
union all
select 'release_announcements' as relation,count(*) as rows,md5(coalesce(string_agg(md5((to_jsonb(t))::text),'' order by md5((to_jsonb(t))::text)),'')) as value_fingerprint from public.release_announcements t
order by relation;

-- Compare protected group-code metadata without revealing codes, hashes or secrets.
select 'codes' as relation,count(*) as rows,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) as value_fingerprint from group_security.codes t
union all select 'secrets',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from group_security.secrets t;

-- Catalog baseline: every PRE-existing ID must remain with the SAME fingerprint.
-- New IDs are expected only for missing assisted starters. Keep these results private.
-- The only permitted existing exercise changes are direction, primary group, and updated_at.
select id,md5((to_jsonb(e)-'progression_direction'-'major_muscle_group'-'updated_at')::text) as protected_fingerprint
from public.exercises e order by id;
-- Existing assignments must remain; additive catalog tags/groups are allowed.
select exercise_id,muscle_tag from public.exercise_muscle_assignments order by exercise_id,muscle_tag;
select exercise_id,major_group from public.exercise_group_assignments order by exercise_id,major_group;
