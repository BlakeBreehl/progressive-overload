-- READ ONLY POST-RECOVERY VERIFICATION. Run the entire file as admin.
-- All expected objects must exist; expected RPCs: security_definer=true,
-- configuration contains search_path="", owner=migration owner.
-- Legacy create_private_group/join_private_group: all browser/PUBLIC execute=false.
-- Other expected PUBLIC RPCs: authenticated=true, anon/PUBLIC=false.
-- Helpers: authenticated/anon/PUBLIC=false. Private schema/table access=false.
-- All six tables RLS=true; singleton rows=1; groups=mappings;
-- missing/invalid/orphan/noncurrent counts=0. Compare every baseline count with
-- the saved diagnostic. Privacy and acknowledgement row counts must be preserved.
-- IMPORTANT: A post-only query cannot prove historical values were never rewritten.
-- Compare a trusted before/after snapshot privately if that proof is required;
-- do not paste records or sensitive hashes into reports. No such proof is claimed.

-- READ ONLY. Run as the migration/admin role in Supabase SQL Editor.
-- No DDL/DML, raw records, code material, function bodies or account identifiers.
-- Save all safe results BEFORE recovery, for comparison with GROUPS_010_VERIFY.sql.
select exists(select 1 from pg_catalog.pg_namespace where nspname='group_security') as private_schema_exists;
select t as expected_table,c.oid is not null as exists,c.relkind,c.relrowsecurity as rls_enabled,
 pg_catalog.pg_get_userbyid(c.relowner) as owner
from unnest(array['group_security.secrets','group_security.codes','group_security.attempts','group_security.creation_requests','public.group_progress_privacy','public.release_announcements']) t left join pg_catalog.pg_class c on c.oid=pg_catalog.to_regclass(t);

select a.attrelid::regclass as table_name,a.attname as column_name,pg_catalog.format_type(a.atttypid,a.atttypmod) as type,
 a.attnotnull as required,case when a.attname in ('hash_key','encryption_key','encrypted_code','code_hash') then
 case when d.oid is null then null else '[sensitive default redacted]' end else pg_catalog.pg_get_expr(d.adbin,d.adrelid) end as default_expression
from pg_catalog.pg_attribute a left join pg_catalog.pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
where a.attrelid in (select pg_catalog.to_regclass(t) from unnest(array['group_security.secrets','group_security.codes','group_security.attempts','group_security.creation_requests','public.group_progress_privacy','public.release_announcements']) t) and a.attnum>0 and not a.attisdropped
order by table_name,column_name;
select c.conrelid::regclass as table_name,c.conname,c.contype,c.convalidated,c.condeferrable,
 case when c.contype='c' and pg_catalog.pg_get_constraintdef(c.oid) ~ '(hash_key|encryption_key|encrypted_code|code_hash)' then '[sensitive check definition redacted]' else pg_catalog.pg_get_constraintdef(c.oid) end as definition
from pg_catalog.pg_constraint c where c.conrelid in (select pg_catalog.to_regclass(t) from unnest(array['group_security.secrets','group_security.codes','group_security.attempts','group_security.creation_requests','public.group_progress_privacy','public.release_announcements']) t);
select i.indrelid::regclass as table_name,i.indexrelid::regclass as index_name,i.indisunique,i.indisprimary,i.indisvalid,i.indisready
from pg_catalog.pg_index i where i.indrelid in (select pg_catalog.to_regclass(t) from unnest(array['group_security.secrets','group_security.codes','group_security.attempts','group_security.creation_requests','public.group_progress_privacy','public.release_announcements']) t);
select p.polrelid::regclass as table_name,p.polname,p.polcmd,p.polpermissive,
 array(select case when r=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(r) end from unnest(p.polroles) r) as roles,
 position('auth.uid()' in coalesce(pg_catalog.pg_get_expr(p.polqual,p.polrelid),''))>0 as self_scoped_using,
 position('auth.uid()' in coalesce(pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid),''))>0 as self_scoped_check
from pg_catalog.pg_policy p where p.polrelid in (select pg_catalog.to_regclass(t) from unnest(array['group_security.secrets','group_security.codes','group_security.attempts','group_security.creation_requests','public.group_progress_privacy','public.release_announcements']) t);

with expected(signature,return_type) as (values ('group_security.random_bytes(integer)','bytea'),
('group_security.encrypt_code(text,text)','bytea'),
('group_security.decrypt_code(bytea,text)','text'),
('group_security.code_hmac(text,bytea)','text'),
('group_security.shares_progress(uuid)','boolean'),
('public.get_group_progress_sharing()','boolean'),
('public.set_group_progress_sharing(boolean)','boolean'),
('group_security.take_attempt(text,text,integer,integer)','boolean'),
('group_security.issue_code(uuid)','text'),
('public.get_private_group_code(uuid)','text'),
('public.create_private_group_with_code(text,text,uuid)','jsonb'),
('public.replace_private_group_code(uuid)','jsonb'),
('public.join_private_group_code(text,text)','jsonb'),
('public.manage_private_group(uuid,text,uuid,text)','jsonb'),
('public.private_group_summary(uuid,text,text,text)','jsonb'),
('public.get_release_acknowledgement(text)','boolean'),
('public.acknowledge_release(text)','void'),
('public.is_group_member(uuid)','boolean'),
('public.create_private_group(text,text)','uuid'),
('public.join_private_group(text,text)','uuid'))
select e.signature,p.oid is not null as exists,pg_catalog.pg_get_function_result(p.oid) as actual_return,
 pg_catalog.pg_get_userbyid(p.proowner) as owner,p.prosecdef as security_definer,array(select setting from unnest(p.proconfig) setting where setting like 'search_path=%') as configuration,
 case when p.oid is null then null else pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') end as anon_execute,
 case when p.oid is null then null else pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') end as authenticated_execute,
 exists(select 1 from pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE') as public_execute,
 array(select case when a.grantee=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(a.grantee) end from pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a where a.privilege_type='EXECUTE') as execute_grantees
from expected e left join pg_catalog.pg_proc p on p.oid=pg_catalog.to_regprocedure(e.signature);
select r as browser_role,case when pg_catalog.to_regnamespace('group_security') is null then null else pg_catalog.has_schema_privilege(r,'group_security','USAGE') end as private_schema_usage,
 case when pg_catalog.to_regnamespace('group_security') is null then null else pg_catalog.has_schema_privilege(r,'group_security','CREATE') end as private_schema_create
from unnest(array['anon','authenticated']) r;
select t as table_name,r as browser_role,pg_catalog.has_table_privilege(r,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as any_table_access,
 pg_catalog.has_any_column_privilege(r,c.oid,'SELECT,INSERT,UPDATE,REFERENCES') as any_column_access
from unnest(array['group_security.secrets','group_security.codes','group_security.attempts','group_security.creation_requests','public.group_progress_privacy','public.release_announcements']) t join pg_catalog.pg_class c on c.oid=pg_catalog.to_regclass(t) cross join unnest(array['anon','authenticated']) r;

-- Dynamic SELECTs avoid referencing absent prefix tables. Only aggregate results leave the server.
select 'singleton' as check_name,case when pg_catalog.to_regclass('group_security.secrets') is not null and exists(select 1 from pg_catalog.pg_attribute where attrelid=pg_catalog.to_regclass('group_security.secrets') and attname='singleton' and not attisdropped) and exists(select 1 from pg_catalog.pg_attribute where attrelid=pg_catalog.to_regclass('group_security.secrets') and attname='hash_key' and not attisdropped) and exists(select 1 from pg_catalog.pg_attribute where attrelid=pg_catalog.to_regclass('group_security.secrets') and attname='encryption_key' and not attisdropped)
 then pg_catalog.query_to_xml('select count(*) as secret_rows,count(*) filter(where singleton is true) as singleton_rows from group_security.secrets',false,true,'') else null end as safe_counts;
select 'current_codes' as check_name,case when pg_catalog.to_regclass('group_security.codes') is not null and pg_catalog.to_regclass('public.groups') is not null and pg_catalog.to_regclass('public.group_invites') is not null and exists(select 1 from pg_catalog.pg_attribute where attrelid=pg_catalog.to_regclass('group_security.codes') and attname='group_id' and not attisdropped) and exists(select 1 from pg_catalog.pg_attribute where attrelid=pg_catalog.to_regclass('group_security.codes') and attname='code_hash' and not attisdropped) and exists(select 1 from pg_catalog.pg_attribute where attrelid=pg_catalog.to_regclass('group_security.codes') and attname='encrypted_code' and not attisdropped)
 then pg_catalog.query_to_xml('select (select count(*) from public.groups) as groups,
 (select count(*) from group_security.codes) as mappings,
 (select count(*) from public.groups g where (select count(*) from group_security.codes c where c.group_id=g.id)<>1) as groups_without_exactly_one_code,
 (select count(*) from group_security.codes c left join public.groups g on g.id=c.group_id left join public.group_invites i on i.code_hash=c.code_hash where g.id is null or i.code_hash is null) as orphan_mappings,
 (select count(*) from group_security.codes c join public.groups g on g.id=c.group_id join public.group_invites i on i.code_hash=c.code_hash where i.group_id<>c.group_id or i.created_by<>g.owner_user_id or i.revoked_at is not null or i.expires_at<>''infinity''::timestamptz or i.max_uses<>2147483647 or i.uses>=i.max_uses or octet_length(c.encrypted_code)=0) as incompatible_current_invitations,
 (select count(*) from public.group_invites i where i.revoked_at is null and not exists(select 1 from group_security.codes c where c.code_hash=i.code_hash)) as active_noncurrent_invitations',false,true,'') else null end as safe_counts;
select 'invitation_orphans' as check_name,case when pg_catalog.to_regclass('public.group_invites') is not null and pg_catalog.to_regclass('public.groups') is not null
 then pg_catalog.query_to_xml('select count(*) as orphan_invitation_groups from public.group_invites i left join public.groups g on g.id=i.group_id where g.id is null',false,true,'') else null end as safe_counts;
select 'privacy' as check_name,case when pg_catalog.to_regclass('public.group_progress_privacy') is not null and pg_catalog.to_regclass('auth.users') is not null and exists(select 1 from pg_catalog.pg_attribute where attrelid=pg_catalog.to_regclass('public.group_progress_privacy') and attname='user_id' and not attisdropped) and exists(select 1 from pg_catalog.pg_attribute where attrelid=pg_catalog.to_regclass('public.group_progress_privacy') and attname='share_progress' and not attisdropped)
 then pg_catalog.query_to_xml('select count(*) as preference_rows,count(*) filter(where u.id is null or u.role is distinct from ''authenticated'' or p.share_progress is null) as invalid_preferences from public.group_progress_privacy p left join auth.users u on u.id=p.user_id',false,true,'') else null end as safe_counts;
select 'announcement_contract' as check_name,case when pg_catalog.to_regclass('public.release_announcements') is not null and pg_catalog.to_regclass('auth.users') is not null and exists(select 1 from pg_catalog.pg_attribute where attrelid=pg_catalog.to_regclass('public.release_announcements') and attname='user_id' and not attisdropped) and exists(select 1 from pg_catalog.pg_attribute where attrelid=pg_catalog.to_regclass('public.release_announcements') and attname='release_id' and not attisdropped) and exists(select 1 from pg_catalog.pg_attribute where attrelid=pg_catalog.to_regclass('public.release_announcements') and attname='seen_at' and not attisdropped)
 then pg_catalog.query_to_xml('select count(*) as acknowledgement_rows,count(*) filter(where u.id is null or a.release_id is null or length(a.release_id) not between 1 and 100 or a.seen_at is null) as invalid_acknowledgements from public.release_announcements a left join auth.users u on u.id=a.user_id',false,true,'') else null end as safe_counts;
select 'groups_baseline' as check_name,case when pg_catalog.to_regclass('public.groups') is not null
 then pg_catalog.query_to_xml('select count(*) as records from public.groups',false,true,'') else null end as safe_counts;
select 'group_members_baseline' as check_name,case when pg_catalog.to_regclass('public.group_members') is not null
 then pg_catalog.query_to_xml('select count(*) as records from public.group_members',false,true,'') else null end as safe_counts;
select 'strength_workouts_baseline' as check_name,case when pg_catalog.to_regclass('public.strength_workouts') is not null
 then pg_catalog.query_to_xml('select count(*) as records from public.strength_workouts',false,true,'') else null end as safe_counts;
select 'strength_sets_baseline' as check_name,case when pg_catalog.to_regclass('public.strength_sets') is not null
 then pg_catalog.query_to_xml('select count(*) as records from public.strength_sets',false,true,'') else null end as safe_counts;
select 'cardio_sessions_baseline' as check_name,case when pg_catalog.to_regclass('public.cardio_sessions') is not null
 then pg_catalog.query_to_xml('select count(*) as records from public.cardio_sessions',false,true,'') else null end as safe_counts;
select 'mobility_sessions_baseline' as check_name,case when pg_catalog.to_regclass('public.mobility_sessions') is not null
 then pg_catalog.query_to_xml('select count(*) as records from public.mobility_sessions',false,true,'') else null end as safe_counts;
select 'mobility_sets_baseline' as check_name,case when pg_catalog.to_regclass('public.mobility_sets') is not null
 then pg_catalog.query_to_xml('select count(*) as records from public.mobility_sets',false,true,'') else null end as safe_counts;
select 'weigh_ins_baseline' as check_name,case when pg_catalog.to_regclass('public.weigh_ins') is not null
 then pg_catalog.query_to_xml('select count(*) as records from public.weigh_ins',false,true,'') else null end as safe_counts;

-- Migration 008 contract: public.release_announcements(user_id,release_id,seen_at),
-- PK(user_id,release_id), auth.users FK, self-only SELECT/INSERT policies.
-- Repaired 010 preserves rows and uses get_release_acknowledgement(text) and
-- acknowledge_release(text), auth.uid()-scoped, with direct browser grants revoked.
-- A stored invitation hash does NOT reveal whether its original token was long.
-- Therefore require ZERO active noncurrent invitations, a stronger safe condition.
-- Counts are baselines, NOT proof of unchanged row values. Without saved before-state
-- or a trusted audit/snapshot, historical record preservation is NOT VERIFIABLE here.

-- Missing expected constraints and their backing indexes are explicit failures.
with expected(table_name,constraint_name,definition) as (values ('group_security.secrets','secrets_pkey','PRIMARY KEY (singleton)'),
('group_security.secrets','secrets_singleton_check','CHECK (singleton)'),
('group_security.codes','codes_pkey','PRIMARY KEY (group_id)'),
('group_security.codes','codes_code_hash_key','UNIQUE (code_hash)'),
('group_security.codes','codes_group_id_fkey','FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE'),
('group_security.codes','codes_code_hash_fkey','FOREIGN KEY (code_hash) REFERENCES public.group_invites(code_hash)'),
('group_security.attempts','attempts_pkey','PRIMARY KEY (scope, subject)'),
('group_security.attempts','attempts_attempts_check','CHECK (attempts >= 0)'),
('group_security.creation_requests','creation_requests_pkey','PRIMARY KEY (user_id, request_id)'),
('group_security.creation_requests','creation_requests_user_id_fkey','FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'),
('group_security.creation_requests','creation_requests_group_id_fkey','FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE'),
('public.group_progress_privacy','group_progress_privacy_pkey','PRIMARY KEY (user_id)'),
('public.group_progress_privacy','group_progress_privacy_user_id_fkey','FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'),
('public.release_announcements','release_announcements_pkey','PRIMARY KEY (user_id, release_id)'),
('public.release_announcements','release_announcements_user_id_fkey','FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'),
('public.release_announcements','release_announcements_release_id_check','CHECK (length(release_id) >= 1 AND length(release_id) <= 100)'))
select e.table_name,e.constraint_name,c.oid is not null as exists,c.convalidated,
 case when c.contype in ('p','u') then coalesce(i.indisvalid and i.indisready,false) else true end as backing_index_valid,
 regexp_replace(replace(lower(pg_catalog.pg_get_constraintdef(c.oid)),'public.',''),'[[:space:]()]','','g') = regexp_replace(replace(lower(e.definition),'public.',''),'[[:space:]()]','','g') as definition_matches
from expected e left join pg_catalog.pg_constraint c on c.conrelid=pg_catalog.to_regclass(e.table_name) and c.conname=e.constraint_name
left join pg_catalog.pg_index i on i.indexrelid=c.conindid;
