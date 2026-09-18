-- REVIEW ONLY. Do not apply automatically. Requires migrations 001-009.
-- One transaction: preserve personal records and membership; replace long invitations.
begin;

-- Fail closed on incompatible existing objects; never infer rollback from a failed run.
set local search_path='';
-- Serializes recovery attempts and prevents concurrent group creation during backfill.
select pg_catalog.pg_advisory_xact_lock(20260915,10);
lock table public.groups, public.group_invites in share row exclusive mode;
do $preflight$
declare v_expected_row record; v_table_oid oid; v_column_row record;
begin
 if exists(select 1 from pg_catalog.pg_namespace namespace_row where namespace_row.nspname='group_security' and namespace_row.nspowner<>(select role_row.oid from pg_catalog.pg_roles role_row where role_row.rolname=current_user)) then
  raise exception 'Migration 010 incompatible schema group_security: owner must be migration role';
 end if;
 for v_expected_row in select distinct expected_row.table_name from (values
  ('group_security.secrets','singleton','boolean',true,'true'),
  ('group_security.secrets','hash_key','bytea',true,null),
  ('group_security.secrets','encryption_key','text',true,null),
  ('group_security.codes','group_id','uuid',true,null),
  ('group_security.codes','code_hash','text',true,null),
  ('group_security.codes','encrypted_code','bytea',true,null),
  ('group_security.attempts','scope','text',true,null),
  ('group_security.attempts','subject','text',true,null),
  ('group_security.attempts','window_start','timestamp with time zone',true,null),
  ('group_security.attempts','attempts','integer',true,null),
  ('group_security.creation_requests','user_id','uuid',true,null),
  ('group_security.creation_requests','request_id','uuid',true,null),
  ('group_security.creation_requests','group_id','uuid',false,null),
  ('public.group_progress_privacy','user_id','uuid',true,null),
  ('public.group_progress_privacy','share_progress','boolean',true,'true'),
  ('public.release_announcements','user_id','uuid',true,null),
  ('public.release_announcements','release_id','text',true,null),
  ('public.release_announcements','seen_at','timestamp with time zone',true,'now()')
 ) expected_row(table_name,column_name,type_name,required,default_expr) loop
  v_table_oid:=pg_catalog.to_regclass(v_expected_row.table_name);
  if v_table_oid is null then
   if v_expected_row.table_name='public.release_announcements' then raise exception 'Migration 010 requires migration 008: public.release_announcements'; end if;
   continue;
  end if;
  if not exists(select 1 from pg_catalog.pg_class class_row where class_row.oid=v_table_oid and class_row.relkind='r' and not class_row.relispartition and class_row.relowner=(select role_row.oid from pg_catalog.pg_roles role_row where role_row.rolname=current_user)) then
   raise exception 'Migration 010 incompatible table %: kind or owner',v_expected_row.table_name;
  end if;
  execute format('lock table %s in access exclusive mode',v_table_oid::regclass);
  if exists(select 1 from pg_catalog.pg_trigger trigger_row where trigger_row.tgrelid=v_table_oid and not trigger_row.tgisinternal)
   or exists(select 1 from pg_catalog.pg_inherits inheritance_row where inheritance_row.inhrelid=v_table_oid or inheritance_row.inhparent=v_table_oid)
   or exists(select 1 from pg_catalog.pg_rewrite rewrite_row where rewrite_row.ev_class=v_table_oid) then
   raise exception 'Migration 010 incompatible table %: trigger, inheritance or rule',v_expected_row.table_name;
  end if;
  if v_expected_row.table_name<>'public.release_announcements' and exists(select 1 from pg_catalog.pg_policy policy_row where policy_row.polrelid=v_table_oid) then
   raise exception 'Migration 010 incompatible policies on % (expected none)',v_expected_row.table_name;
  end if;
 end loop;
 for v_expected_row in select expected_row.* from (values
  ('group_security.secrets','singleton','boolean',true,'true'),
  ('group_security.secrets','hash_key','bytea',true,null),
  ('group_security.secrets','encryption_key','text',true,null),
  ('group_security.codes','group_id','uuid',true,null),
  ('group_security.codes','code_hash','text',true,null),
  ('group_security.codes','encrypted_code','bytea',true,null),
  ('group_security.attempts','scope','text',true,null),
  ('group_security.attempts','subject','text',true,null),
  ('group_security.attempts','window_start','timestamp with time zone',true,null),
  ('group_security.attempts','attempts','integer',true,null),
  ('group_security.creation_requests','user_id','uuid',true,null),
  ('group_security.creation_requests','request_id','uuid',true,null),
  ('group_security.creation_requests','group_id','uuid',false,null),
  ('public.group_progress_privacy','user_id','uuid',true,null),
  ('public.group_progress_privacy','share_progress','boolean',true,'true'),
  ('public.release_announcements','user_id','uuid',true,null),
  ('public.release_announcements','release_id','text',true,null),
  ('public.release_announcements','seen_at','timestamp with time zone',true,'now()')
 ) expected_row(table_name,column_name,type_name,required,default_expr) loop
  v_table_oid:=pg_catalog.to_regclass(v_expected_row.table_name); if v_table_oid is null then continue; end if;
  select attribute_row.atttypid,attribute_row.attnotnull,attribute_row.attgenerated,attribute_row.attidentity,pg_catalog.pg_get_expr(default_row.adbin,default_row.adrelid) default_expr into v_column_row
   from pg_catalog.pg_attribute attribute_row left join pg_catalog.pg_attrdef default_row on default_row.adrelid=attribute_row.attrelid and default_row.adnum=attribute_row.attnum
   where attribute_row.attrelid=v_table_oid and attribute_row.attname=v_expected_row.column_name and attribute_row.attnum>0 and not attribute_row.attisdropped;
  if not found or v_column_row.atttypid<>pg_catalog.to_regtype(v_expected_row.type_name) or v_column_row.attnotnull<>v_expected_row.required
   or v_column_row.attgenerated<>'' or v_column_row.attidentity<>'' or v_column_row.default_expr is distinct from v_expected_row.default_expr then
   raise exception 'Migration 010 incompatible column %.% (type, nullability, default or generated value)',v_expected_row.table_name,v_expected_row.column_name;
  end if;
 end loop;
 for v_expected_row in select expected_row.table_name,count(*) expected from (values
  ('group_security.secrets','singleton','boolean',true,'true'),
  ('group_security.secrets','hash_key','bytea',true,null),
  ('group_security.secrets','encryption_key','text',true,null),
  ('group_security.codes','group_id','uuid',true,null),
  ('group_security.codes','code_hash','text',true,null),
  ('group_security.codes','encrypted_code','bytea',true,null),
  ('group_security.attempts','scope','text',true,null),
  ('group_security.attempts','subject','text',true,null),
  ('group_security.attempts','window_start','timestamp with time zone',true,null),
  ('group_security.attempts','attempts','integer',true,null),
  ('group_security.creation_requests','user_id','uuid',true,null),
  ('group_security.creation_requests','request_id','uuid',true,null),
  ('group_security.creation_requests','group_id','uuid',false,null),
  ('public.group_progress_privacy','user_id','uuid',true,null),
  ('public.group_progress_privacy','share_progress','boolean',true,'true'),
  ('public.release_announcements','user_id','uuid',true,null),
  ('public.release_announcements','release_id','text',true,null),
  ('public.release_announcements','seen_at','timestamp with time zone',true,'now()')
 ) expected_row(table_name,column_name,type_name,required,default_expr) group by expected_row.table_name loop
  if pg_catalog.to_regclass(v_expected_row.table_name) is not null and (select count(*) from pg_catalog.pg_attribute attribute_row where attribute_row.attrelid=pg_catalog.to_regclass(v_expected_row.table_name) and attribute_row.attnum>0 and not attribute_row.attisdropped)<>v_expected_row.expected then
   raise exception 'Migration 010 incompatible extra columns on %',v_expected_row.table_name;
  end if;
 end loop;
 -- Existing constraints must match; missing constraints are added below, before data writes.
 for v_expected_row in select catalog_row.*,expected_row.definition,expected_row.table_name from pg_catalog.pg_constraint catalog_row
  join (values
  ('group_security.secrets','secrets_pkey','PRIMARY KEY (singleton)'),
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
  ('public.release_announcements','release_announcements_release_id_check','CHECK (length(release_id) >= 1 AND length(release_id) <= 100)')
  ) expected_row(table_name,constraint_name,definition) on catalog_row.conrelid=pg_catalog.to_regclass(expected_row.table_name) and catalog_row.conname=expected_row.constraint_name loop
  if regexp_replace(lower(pg_catalog.pg_get_constraintdef(v_expected_row.oid)),'[[:space:]()]','','g')<>regexp_replace(lower(v_expected_row.definition),'[[:space:]()]','','g') or not v_expected_row.convalidated or v_expected_row.condeferrable then
   raise exception 'Migration 010 incompatible constraint %.%',v_expected_row.table_name,v_expected_row.conname;
  end if;
 end loop;
 if exists(select 1 from pg_catalog.pg_constraint catalog_row where catalog_row.conrelid in (select pg_catalog.to_regclass(table_entry.table_name) from unnest(array['group_security.secrets','group_security.codes','group_security.attempts','group_security.creation_requests','public.group_progress_privacy','public.release_announcements']) table_entry(table_name)) and catalog_row.contype in ('p','u','f','c','x')
 and not exists(select 1 from (values ('group_security.secrets','secrets_pkey','PRIMARY KEY (singleton)'),
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
  ('public.release_announcements','release_announcements_release_id_check','CHECK (length(release_id) >= 1 AND length(release_id) <= 100)')) expected_row(table_name,constraint_name,definition) where catalog_row.conrelid=pg_catalog.to_regclass(expected_row.table_name) and catalog_row.conname=expected_row.constraint_name)) then
  raise exception 'Migration 010 incompatible unexpected constraint on recovery tables';
 end if;
 if exists(select 1 from pg_catalog.pg_class catalog_row join pg_catalog.pg_namespace namespace_row on namespace_row.oid=catalog_row.relnamespace
  where namespace_row.nspname='group_security' and catalog_row.relkind not in ('i') and catalog_row.relname not in ('secrets','codes','attempts','creation_requests')) then
  raise exception 'Migration 010 incompatible unexpected relation in group_security';
 end if;
 if exists(select 1 from pg_catalog.pg_index index_row where index_row.indrelid in (select pg_catalog.to_regclass(table_entry.table_name) from unnest(array['group_security.secrets','group_security.codes','group_security.attempts','group_security.creation_requests','public.group_progress_privacy','public.release_announcements']) table_entry(table_name))
  and not exists(select 1 from pg_catalog.pg_constraint catalog_row where catalog_row.conindid=index_row.indexrelid)) then
  raise exception 'Migration 010 incompatible unexpected index on recovery tables';
 end if;
end $preflight$;

create schema if not exists group_security;
revoke all on schema group_security from public, anon, authenticated;

do $function_compatibility$
declare v_expected_row record; v_proc_row record;
begin
 for v_expected_row in select expected_row.* from (values ('group_security.random_bytes(integer)','bytea'),
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
  ('public.acknowledge_release(text)','void')) expected_row(signature,return_type) loop
  select proc_row.* into v_proc_row from pg_catalog.pg_proc proc_row where proc_row.oid=pg_catalog.to_regprocedure(v_expected_row.signature);
  if found and (v_proc_row.proowner<>(select role_row.oid from pg_catalog.pg_roles role_row where role_row.rolname=current_user) or v_proc_row.prorettype<>pg_catalog.to_regtype(v_expected_row.return_type) or v_proc_row.prokind<>'f' or v_proc_row.proretset) then
   raise exception 'Migration 010 incompatible function %: owner or return contract',v_expected_row.signature;
  end if;
 end loop;
 if exists(select 1 from pg_catalog.pg_proc proc_row join pg_catalog.pg_namespace namespace_row on namespace_row.oid=proc_row.pronamespace
  where (namespace_row.nspname='group_security' or namespace_row.nspname||'.'||proc_row.proname in (select split_part(expected_row.signature,'(',1) from (values ('group_security.random_bytes(integer)','bytea'),
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
  ('public.acknowledge_release(text)','void')) expected_row(signature,return_type)))
  and not exists(select 1 from (values ('group_security.random_bytes(integer)','bytea'),
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
  ('public.acknowledge_release(text)','void')) expected_row(signature,return_type) where pg_catalog.to_regprocedure(expected_row.signature)=proc_row.oid)) then
  raise exception 'Migration 010 incompatible unexpected helper function or RPC overload';
 end if;
end $function_compatibility$;

-- pgcrypto can be installed in public or extensions. Bind wrappers to its actual
-- extension-owned namespace; never resolve cryptography through a caller search_path.
do $install_crypto$
declare v_crypto_namespace text;
begin
 select namespace_row.nspname into v_crypto_namespace from pg_catalog.pg_extension extension_row join pg_catalog.pg_namespace namespace_row on namespace_row.oid=extension_row.extnamespace where extension_row.extname='pgcrypto';
 if v_crypto_namespace is null then raise exception 'Migration 010 requires the existing pgcrypto extension'; end if;
 execute format('create or replace function group_security.random_bytes(integer) returns bytea language sql volatile security definer set search_path='''' as %L',format('select %I.gen_random_bytes($1)',v_crypto_namespace));
 execute format('create or replace function group_security.encrypt_code(text,text) returns bytea language sql volatile security definer set search_path='''' as %L',format('select %I.pgp_sym_encrypt($1,$2,''cipher-algo=aes256,compress-algo=0'')',v_crypto_namespace));
 execute format('create or replace function group_security.decrypt_code(bytea,text) returns text language sql stable security definer set search_path='''' as %L',format('select %I.pgp_sym_decrypt($1,$2)',v_crypto_namespace));
 execute format('create or replace function group_security.code_hmac(text,bytea) returns text language sql immutable security definer set search_path='''' as %L',format('select encode(%I.hmac(convert_to($1,''UTF8''),$2,''sha256''),''hex'')',v_crypto_namespace));
end $install_crypto$;

create table if not exists group_security.secrets (
 singleton boolean primary key default true check(singleton),
 hash_key bytea not null, encryption_key text not null
);

-- Hash is the acceptance index. Ciphertext exists only so an owner can retrieve
-- the same short code after reload. No raw code, keys or ciphertext are selectable.
create table if not exists group_security.codes (
 group_id uuid primary key references public.groups(id) on delete cascade,
 code_hash text not null unique references public.group_invites(code_hash),
 encrypted_code bytea not null
);
create table if not exists group_security.attempts (
 scope text not null, subject text not null, window_start timestamptz not null,
 attempts integer not null check(attempts>=0), primary key(scope,subject)
);
create table if not exists group_security.creation_requests (
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null, group_id uuid references public.groups(id) on delete cascade,
 primary key(user_id,request_id)
);
create table if not exists public.group_progress_privacy (
 user_id uuid primary key references auth.users(id) on delete cascade,
 share_progress boolean not null default true
);
-- Restore only missing constraints. A conflicting named index must stop recovery.
do $constraints$
declare v_expected_row record;
begin
 for v_expected_row in select expected_row.* from (values
  ('group_security.secrets','secrets_pkey','PRIMARY KEY (singleton)'),
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
  ('public.release_announcements','release_announcements_release_id_check','CHECK (length(release_id) >= 1 AND length(release_id) <= 100)')
 ) expected_row(table_name,constraint_name,definition) loop
  if not exists(select 1 from pg_catalog.pg_constraint constraint_row where constraint_row.conrelid=pg_catalog.to_regclass(v_expected_row.table_name) and constraint_row.conname=v_expected_row.constraint_name) then
   if pg_catalog.to_regclass(split_part(v_expected_row.table_name,'.',1)||'.'||v_expected_row.constraint_name) is not null then
    raise exception 'Migration 010 conflicting index %.%',split_part(v_expected_row.table_name,'.',1),v_expected_row.constraint_name;
   end if;
   begin
    execute format('alter table %s add constraint %I %s',pg_catalog.to_regclass(v_expected_row.table_name),v_expected_row.constraint_name,v_expected_row.definition);
   exception when others then
    raise exception 'Migration 010 cannot restore constraint %.%: incompatible existing data or object (details suppressed)',v_expected_row.table_name,v_expected_row.constraint_name;
   end;
  end if;
 end loop;
 if exists(select 1 from pg_catalog.pg_index index_row where index_row.indrelid in ('group_security.secrets'::regclass,'group_security.codes'::regclass,'group_security.attempts'::regclass,'group_security.creation_requests'::regclass,'public.group_progress_privacy'::regclass,'public.release_announcements'::regclass) and (not index_row.indisvalid or not index_row.indisready)) then
  raise exception 'Migration 010 incompatible invalid index on recovery tables';
 end if;
 if (select count(*) from group_security.secrets)>1 or exists(select 1 from group_security.secrets secret_row where secret_row.singleton is distinct from true or octet_length(secret_row.hash_key)<>32 or secret_row.encryption_key !~ '^[0-9a-f]{64}$') then
  raise exception 'Migration 010 incompatible group_security.secrets singleton';
 end if;
 if exists(select 1 from group_security.codes) and not exists(select 1 from group_security.secrets) then
  raise exception 'Migration 010 group_security.codes exists without its original secrets; restore original secrets, never regenerate';
 end if;
 if exists(select 1 from group_security.codes code_row left join public.groups group_row on group_row.id=code_row.group_id left join public.group_invites invite_row on invite_row.code_hash=code_row.code_hash
  where group_row.id is null or invite_row.code_hash is null or invite_row.group_id<>code_row.group_id or invite_row.created_by<>group_row.owner_user_id or invite_row.revoked_at is not null or invite_row.expires_at<>'infinity'::timestamptz or invite_row.max_uses<>2147483647 or invite_row.uses>=invite_row.max_uses or octet_length(code_row.encrypted_code)=0) then
  raise exception 'Migration 010 incompatible current code mapping/invitation; no codes have been rotated';
 end if;
 if exists(select 1 from public.group_progress_privacy privacy_row left join auth.users user_row on user_row.id=privacy_row.user_id where user_row.id is null or user_row.role is distinct from 'authenticated') then
  raise exception 'Migration 010 incompatible public.group_progress_privacy account references';
 end if;
 -- Use the original keys internally; the query returns only a boolean, never key/code material.
 begin
  if exists(select 1 from group_security.codes code_row cross join group_security.secrets secret_row
   where group_security.decrypt_code(code_row.encrypted_code,secret_row.encryption_key) !~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$'
    or group_security.code_hmac(group_security.decrypt_code(code_row.encrypted_code,secret_row.encryption_key),secret_row.hash_key)<>code_row.code_hash) then
   raise exception 'invalid';
  end if;
 exception when others then
  raise exception 'Migration 010 incompatible encrypted current code state; original keys/codes require investigation';
 end;
end $constraints$;
-- Existing keys are never regenerated. This SELECT produces new keys only for empty state.
insert into group_security.secrets(singleton,hash_key,encryption_key)
select true,group_security.random_bytes(32),encode(group_security.random_bytes(32),'hex')
where not exists(select 1 from group_security.secrets);

alter table public.group_progress_privacy enable row level security;
revoke all on public.group_progress_privacy from public, anon, authenticated;
-- No direct policies/grants. Only self-scoped authenticated RPCs below can access it.
-- No backfill: absence of a preference means enabled for existing/new accounts.

create or replace function group_security.shares_progress(p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select privacy_row.share_progress from public.group_progress_privacy privacy_row where privacy_row.user_id=p_user),true);
$$;
create or replace function public.get_group_progress_sharing() returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 return group_security.shares_progress(auth.uid());
end $$;
create or replace function public.set_group_progress_sharing(p_enabled boolean) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_enabled is null then raise exception 'Choose a sharing preference'; end if;
 insert into public.group_progress_privacy(user_id,share_progress) values(auth.uid(),p_enabled)
 on conflict(user_id) do update set share_progress=excluded.share_progress;
 return p_enabled;
end $$;

create or replace function group_security.take_attempt(p_scope text,p_subject text,p_limit integer,p_seconds integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_bucket timestamptz:=to_timestamp(floor(extract(epoch from clock_timestamp())/p_seconds)*p_seconds); v_attempt_count integer;
begin
 insert into group_security.attempts as attempt_row(scope,subject,window_start,attempts) values(p_scope,p_subject,v_bucket,1)
 on conflict(scope,subject) do update set
 attempts=case when attempt_row.window_start=excluded.window_start then least(attempt_row.attempts+1,p_limit+1) else 1 end,
 window_start=excluded.window_start returning attempt_row.attempts into v_attempt_count;
 return v_attempt_count<=p_limit;
end $$;

create or replace function group_security.issue_code(p_group uuid) returns text
language plpgsql security definer set search_path='' as $$
declare v_alphabet constant text:='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; v_bytes bytea; v_code text; v_digest text; v_secret_row group_security.secrets; v_owner_id uuid; v_retry integer; v_byte_index integer;
begin
 select group_row.owner_user_id into v_owner_id from public.groups group_row where group_row.id=p_group for update;
 if not found then raise exception 'Group unavailable'; end if;
 select secret_row.* into strict v_secret_row from group_security.secrets secret_row where secret_row.singleton;
 -- 256 is divisible by 32: each of eight bytes supplies an unbiased five-bit
 -- alphabet index. Eight independent characters = 40 random bits.
 for v_retry in 1..32 loop
  v_bytes:=group_security.random_bytes(8); v_code:='';
  for v_byte_index in 0..7 loop v_code:=v_code||substr(v_alphabet,(get_byte(v_bytes,v_byte_index)&31)+1,1); end loop;
  v_digest:=group_security.code_hmac(v_code,v_secret_row.hash_key);
  begin
   -- The unique hash also prevents reusing any historical short code.
   insert into public.group_invites(code_hash,group_id,created_by,expires_at,max_uses)
   values(v_digest,p_group,v_owner_id,'infinity',2147483647);
  exception when unique_violation then continue;
  end;
  update public.group_invites invite_row set revoked_at=now() where invite_row.group_id=p_group and invite_row.code_hash<>v_digest and invite_row.revoked_at is null;
  insert into group_security.codes(group_id,code_hash,encrypted_code)
   values(p_group,v_digest,group_security.encrypt_code(v_code,v_secret_row.encryption_key))
   on conflict(group_id) do update set code_hash=excluded.code_hash,encrypted_code=excluded.encrypted_code;
  return v_code;
 end loop;
 raise exception 'Could not create a Group Code. Please retry.';
end $$;

create or replace function public.get_private_group_code(p_group_id uuid) returns text
language plpgsql security definer set search_path='' as $$
declare v_code text;
begin
 perform 1 from public.groups group_row where group_row.id=p_group_id and group_row.owner_user_id=auth.uid() for share;
 if not found then raise exception 'Group unavailable' using errcode='42501'; end if;
 select group_security.decrypt_code(code_row.encrypted_code,secret_row.encryption_key) into v_code
 from group_security.codes code_row cross join group_security.secrets secret_row where code_row.group_id=p_group_id and secret_row.singleton;
 if v_code is null then raise exception 'Group Code unavailable. Please retry.'; end if;
 return v_code;
end $$;

create or replace function public.create_private_group_with_code(p_name text,p_display_name text,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_group uuid; v_code text;
begin
 if v_user is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_request_id is null then raise exception 'Request identifier required'; end if;
 -- A retry after a lost network response returns the same group and code.
 insert into group_security.creation_requests(user_id,request_id) values(v_user,p_request_id) on conflict do nothing;
 select request_row.group_id into v_group from group_security.creation_requests request_row where request_row.user_id=v_user and request_row.request_id=p_request_id for update;
 if v_group is not null then return jsonb_build_object('ok',true,'group_id',v_group,'code',public.get_private_group_code(v_group)); end if;
 if not group_security.take_attempt('create-day',v_user::text,20,86400) then
  delete from group_security.creation_requests request_row where request_row.user_id=v_user and request_row.request_id=p_request_id and request_row.group_id is null;
  return jsonb_build_object('ok',false);
 end if;
 v_group:=public.create_private_group(p_name,p_display_name);
 v_code:=group_security.issue_code(v_group);
 update group_security.creation_requests request_row set group_id=v_group where request_row.user_id=v_user and request_row.request_id=p_request_id;
 return jsonb_build_object('ok',true,'group_id',v_group,'code',v_code);
end $$;

create or replace function public.replace_private_group_code(p_group_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.groups group_row where group_row.id=p_group_id and group_row.owner_user_id=auth.uid() for update;
 if not found then raise exception 'Group unavailable' using errcode='42501'; end if;
 if not group_security.take_attempt('replace-hour',auth.uid()::text,10,3600) then return jsonb_build_object('ok',false); end if;
 return jsonb_build_object('ok',true,'code',group_security.issue_code(p_group_id));
end $$;

create or replace function public.join_private_group_code(p_code text,p_display_name text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_canonical text; v_digest text; v_group uuid; v_invitation_row public.group_invites;
begin
 if v_user is null then raise exception 'Sign in required' using errcode='42501'; end if;
 -- Failures RETURN, never RAISE after counting: exceptions would roll back the
 -- limiter along with the request. Counts serialize under row locks.
 if not group_security.take_attempt('join-quarter-hour',v_user::text,20,900) then return jsonb_build_object('ok',false); end if;
 if not group_security.take_attempt('join-day',v_user::text,100,86400) then return jsonb_build_object('ok',false); end if;
 if not group_security.take_attempt('join-global-hour','all',5000,3600) then return jsonb_build_object('ok',false); end if;
 if p_code is null or length(p_code)>128 or nullif(trim(p_display_name),'') is null or length(trim(p_display_name))>80 or position('@' in p_display_name)>0 then return jsonb_build_object('ok',false); end if;
 v_canonical:=upper(regexp_replace(p_code,'[[:space:]-]','','g'));
 if v_canonical !~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$' then return jsonb_build_object('ok',false); end if;
 select group_security.code_hmac(v_canonical,secret_row.hash_key) into v_digest from group_security.secrets secret_row where secret_row.singleton;
 select invite_row.group_id into v_group from public.group_invites invite_row where invite_row.code_hash=v_digest;
 if v_group is null then return jsonb_build_object('ok',false); end if;
 -- Same lock order as replacement/removal/deletion.
 perform 1 from public.groups group_row where group_row.id=v_group for update;
 if not found then return jsonb_build_object('ok',false); end if;
 select invite_row.* into v_invitation_row from public.group_invites invite_row where invite_row.code_hash=v_digest for update;
 if not found or v_invitation_row.revoked_at is not null or v_invitation_row.expires_at<=now() or v_invitation_row.uses>=v_invitation_row.max_uses then return jsonb_build_object('ok',false); end if;
 if not exists(select 1 from public.group_members member_row where member_row.group_id=v_group and member_row.user_id=v_user) then
  insert into public.group_members(group_id,user_id,role,display_name) values(v_group,v_user,'member',trim(p_display_name));
  update public.group_invites invite_row set uses=invite_row.uses+1 where invite_row.code_hash=v_digest;
 end if;
 return jsonb_build_object('ok',true,'group_id',v_group);
end $$;

-- Remove legacy mutation entry points: old clients fail closed, not into token UI.
revoke all on function public.create_private_group(text,text),public.join_private_group(text,text) from public,anon,authenticated;

create or replace function public.manage_private_group(p_group_id uuid,p_action text,p_member_id uuid default null,p_name text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_group_row public.groups; v_member_row public.group_members;
begin
 select group_row.* into v_group_row from public.groups group_row where group_row.id=p_group_id for update;
 if not found or v_user is null or not public.is_group_member(p_group_id) then raise exception 'Group unavailable or membership removed' using errcode='42501'; end if;
 if p_action='leave' then
  if v_group_row.owner_user_id=v_user then raise exception 'The owner must delete the group before leaving'; end if;
  delete from public.group_members member_row where member_row.group_id=p_group_id and member_row.user_id=v_user;
  return '{}'::jsonb;
 end if;
 if v_group_row.owner_user_id<>v_user then raise exception 'Only the group owner can do this' using errcode='42501'; end if;
 if p_action='rename' then
  if nullif(trim(p_name),'') is null or char_length(trim(p_name))>80 then raise exception 'Enter a group name'; end if;
  update public.groups group_row set name=trim(p_name),updated_at=now() where group_row.id=p_group_id;
 elsif p_action='delete' then
  delete from public.groups group_row where group_row.id=p_group_id;
 elsif p_action='remove' then
  select member_row.* into v_member_row from public.group_members member_row where member_row.id=p_member_id and member_row.group_id=p_group_id;
  if not found then raise exception 'Member no longer in this group'; end if;
  if v_member_row.user_id=v_group_row.owner_user_id then raise exception 'Cannot remove the group owner'; end if;
  delete from public.group_members member_row where member_row.id=p_member_id and member_row.group_id=p_group_id;
 else raise exception 'Unsupported group action';
 end if;
 return '{}'::jsonb;
end $$;


create or replace function public.private_group_summary(p_group_id uuid,p_period text default 'month',p_timezone text default 'UTC',p_activity text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_now timestamptz:=now(); v_local timestamp; v_start timestamptz; v_month timestamptz; v_eligible uuid[]; v_members jsonb; v_sets jsonb; v_prs jsonb; v_cardio jsonb; v_activities jsonb; v_name text;
begin
 -- Share lock serializes against membership revocation/group deletion during a read.
 select group_row.name into v_name from public.groups group_row where group_row.id=p_group_id for share;
 if v_name is null or auth.uid() is null or not public.is_group_member(p_group_id) then raise exception 'Group unavailable or membership removed' using errcode='42501'; end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names timezone_row where timezone_row.name=p_timezone) then raise exception 'Invalid calendar timezone'; end if;
 v_local:=v_now at time zone p_timezone;
 v_month:=date_trunc('month',v_local) at time zone p_timezone;
 v_start:=(case p_period when 'week' then date_trunc('week',v_local) when 'month' then date_trunc('month',v_local) when '3m' then date_trunc('month',v_local)-interval '2 months' when '6m' then date_trunc('month',v_local)-interval '5 months' when 'year' then date_trunc('year',v_local) else null end) at time zone p_timezone;
 if v_start is null then raise exception 'Invalid calendar period'; end if;
 -- Freeze the eligible member population once for every returned aggregate.
 select coalesce(array_agg(member_row.user_id),array[]::uuid[]) into v_eligible from public.group_members member_row
 left join public.group_progress_privacy privacy_row on privacy_row.user_id=member_row.user_id
 where member_row.group_id=p_group_id and coalesce(privacy_row.share_progress,true);
 select coalesce(jsonb_agg(jsonb_build_object('member_id',member_row.id,'display_name',member_row.display_name,'role',member_row.role,'is_self',member_row.user_id=auth.uid(),'sharing_progress',member_row.user_id=any(v_eligible)) order by lower(member_row.display_name),member_row.id),'[]') into v_members from public.group_members member_row where member_row.group_id=p_group_id;
 with counted as (
  select member_row.id member_id,case when exercise_row.major_muscle_group in ('Legs','Chest','Back','Arms','Shoulders','Core') then exercise_row.major_muscle_group else 'Olympic/Other' end muscle,count(*) total
  from public.group_members member_row join public.strength_sets set_row on set_row.user_id=member_row.user_id
  join public.strength_workouts workout_row on workout_row.id=set_row.workout_id and workout_row.user_id=set_row.user_id
  join public.exercises exercise_row on exercise_row.id=set_row.exercise_id and exercise_row.user_id=set_row.user_id
  where member_row.group_id=p_group_id and member_row.user_id=any(v_eligible) and workout_row.performed_at>=v_start and workout_row.performed_at<=v_now
  group by member_row.id,2
 ) select coalesce(jsonb_agg(to_jsonb(counted)),'[]') into v_sets from counted;
 -- Mirror the exclusive client PR pipeline. Canonical comparison grid = 0.000001 kg.
 with source as (
  select member_row.id member_id,set_row.id,set_row.exercise_id,set_row.workout_id,set_row.set_order,workout_row.performed_at,workout_row.created_at,set_row.reps,
   case when set_row.weight is null then null else round(set_row.weight*case when set_row.weight_unit='kg' then 1 else 0.45359237 end,6) end kg
  from public.group_members member_row join public.strength_sets set_row on set_row.user_id=member_row.user_id
  join public.strength_workouts workout_row on workout_row.id=set_row.workout_id and workout_row.user_id=set_row.user_id
  where member_row.group_id=p_group_id and member_row.user_id=any(v_eligible) and set_row.tracking_type='repetitions' and set_row.reps is not null and workout_row.performed_at<=v_now
 ), evidence as (
  select *,first_value(workout_id) over chronology first_workout,
   max(kg) over (partition by member_id,exercise_id order by performed_at,created_at,set_order,id rows between unbounded preceding and 1 preceding) prior_weight,
   max(reps) over (partition by member_id,exercise_id,kg order by performed_at,created_at,set_order,id rows between unbounded preceding and 1 preceding) prior_reps
  from source window chronology as (partition by member_id,exercise_id order by performed_at,created_at,set_order,id)
 ), events as (
  select *,case when workout_id=first_workout then null when kg is not null and prior_weight is not null and kg>prior_weight then 'weight' when prior_reps is not null and reps>prior_reps then 'reps' else null end achievement from evidence
 ), counts as (
  select member_id,count(*) filter(where achievement='weight') weight_prs,count(*) filter(where achievement='reps') rep_prs
  from events where performed_at>=v_month group by member_id
 ) select coalesce(jsonb_agg(to_jsonb(counts)),'[]') into v_prs from counts;
 with entries as (
  select member_row.id member_id,lower(regexp_replace(trim(activity_row.name),'\s+',' ','g')) activity,session_row.duration_seconds,
   case when session_row.distance is null then null else session_row.distance*case session_row.distance_unit when 'meters' then 1 when 'kilometers' then 1000 when 'miles' then 1609.344 when 'yards' then 0.9144 when 'feet' then 0.3048 else null end end meters
  from public.group_members member_row join public.cardio_sessions session_row on session_row.user_id=member_row.user_id
  join public.cardio_activities activity_row on activity_row.id=session_row.activity_id and activity_row.user_id=session_row.user_id
  where member_row.group_id=p_group_id and member_row.user_id=any(v_eligible) and session_row.performed_at>=v_start and session_row.performed_at<=v_now
 ), counts as (
  select member_id,activity,count(*) entries,sum(coalesce(duration_seconds,0)) duration_seconds,sum(meters) distance_meters,count(meters) distance_entries
  from entries where p_activity='' or activity=p_activity group by member_id,activity
 ) select coalesce(jsonb_agg(to_jsonb(counts)),'[]') into v_cardio from counts;
 select coalesce(jsonb_agg(activity order by activity),'[]') into v_activities from (
  select distinct lower(regexp_replace(trim(activity_row.name),'\s+',' ','g')) activity from public.group_members member_row
  join public.cardio_sessions session_row on session_row.user_id=member_row.user_id join public.cardio_activities activity_row on activity_row.id=session_row.activity_id and activity_row.user_id=session_row.user_id
  where member_row.group_id=p_group_id and member_row.user_id=any(v_eligible) and session_row.performed_at>=v_start and session_row.performed_at<=v_now
 ) names;
 return jsonb_build_object('name',v_name,'timezone',p_timezone,'period_start',v_start,'month_start',v_month,'through',v_now,'members',v_members,'sets',v_sets,'prs',v_prs,'cardio',v_cardio,'activities',v_activities);
end $$;

-- Reuse migration 008 rows through self-scoped RPCs, with no client account argument.
create or replace function public.get_release_acknowledgement(p_release_id text) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 return exists(select 1 from public.release_announcements release_row where release_row.user_id=auth.uid() and release_row.release_id=p_release_id);
end $$;
create or replace function public.acknowledge_release(p_release_id text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_release_id is null or length(p_release_id) not between 1 and 100 then raise exception 'Invalid release identifier'; end if;
 insert into public.release_announcements(user_id,release_id) values(auth.uid(),p_release_id)
 on conflict(user_id,release_id) do nothing;
end $$;
alter table public.release_announcements enable row level security;
revoke all on public.release_announcements from public,anon,authenticated;
revoke all on function public.get_release_acknowledgement(text),public.acknowledge_release(text) from public,anon,authenticated;
grant execute on function public.get_release_acknowledgement(text),public.acknowledge_release(text) to authenticated;

-- Backfill ONLY invitation state. Personal records and memberships are untouched.
-- In the same transaction, retire long active tokens and give every group a code.
update public.group_invites invite_row set revoked_at=now() where invite_row.revoked_at is null
 and not exists(select 1 from group_security.codes code_row where code_row.code_hash=invite_row.code_hash);
do $existing_groups$
declare v_group_row record;
begin
 for v_group_row in select group_row.id from public.groups group_row where not exists(select 1 from group_security.codes code_row where code_row.group_id=group_row.id) order by group_row.id loop
  perform group_security.issue_code(v_group_row.id);
 end loop;
end $existing_groups$;

-- No browser role can access the private schema, its tables or helper functions.
alter table group_security.secrets enable row level security;
alter table group_security.codes enable row level security;
alter table group_security.attempts enable row level security;
alter table group_security.creation_requests enable row level security;
revoke all on all tables in schema group_security from public,anon,authenticated;
revoke all on all functions in schema group_security from public,anon,authenticated;
revoke all on function public.get_group_progress_sharing(),public.set_group_progress_sharing(boolean),public.get_private_group_code(uuid),public.create_private_group_with_code(text,text,uuid),public.replace_private_group_code(uuid),public.join_private_group_code(text,text),public.manage_private_group(uuid,text,uuid,text),public.private_group_summary(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.get_group_progress_sharing(),public.set_group_progress_sharing(boolean),public.get_private_group_code(uuid),public.create_private_group_with_code(text,text,uuid),public.replace_private_group_code(uuid),public.join_private_group_code(text,text),public.manage_private_group(uuid,text,uuid,text),public.private_group_summary(uuid,text,text,text) to authenticated;
-- Effective privileges catch inherited browser-role access that REVOKE cannot remove.
do $effective_permissions$
declare v_browser_role text; v_object_row record;
begin
 foreach v_browser_role in array array['anon','authenticated'] loop
  if pg_catalog.has_schema_privilege(v_browser_role,'group_security','USAGE') or pg_catalog.has_schema_privilege(v_browser_role,'group_security','CREATE') then
   raise exception 'Migration 010 unsafe inherited schema privilege for %',v_browser_role;
  end if;
  for v_object_row in select class_row.oid from pg_catalog.pg_class class_row where (class_row.relnamespace='group_security'::regnamespace or class_row.oid in ('public.group_progress_privacy'::regclass,'public.release_announcements'::regclass)) and class_row.relkind='r' loop
   if pg_catalog.has_table_privilege(v_browser_role,v_object_row.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or pg_catalog.has_any_column_privilege(v_browser_role,v_object_row.oid,'SELECT,INSERT,UPDATE,REFERENCES') then
    raise exception 'Migration 010 unsafe inherited private table privilege for %',v_browser_role;
   end if;
  end loop;
  for v_object_row in select proc_row.oid from pg_catalog.pg_proc proc_row where proc_row.pronamespace='group_security'::regnamespace loop
   if pg_catalog.has_function_privilege(v_browser_role,v_object_row.oid,'EXECUTE') then raise exception 'Migration 010 unsafe inherited helper execute for %',v_browser_role; end if;
  end loop;
 end loop;
 for v_object_row in select proc_row.oid,proc_row.oid::regprocedure as signature from pg_catalog.pg_proc proc_row where proc_row.oid in (
  'public.get_group_progress_sharing()'::regprocedure,'public.set_group_progress_sharing(boolean)'::regprocedure,'public.get_private_group_code(uuid)'::regprocedure,'public.create_private_group_with_code(text,text,uuid)'::regprocedure,'public.replace_private_group_code(uuid)'::regprocedure,'public.join_private_group_code(text,text)'::regprocedure,'public.manage_private_group(uuid,text,uuid,text)'::regprocedure,'public.private_group_summary(uuid,text,text,text)'::regprocedure,'public.get_release_acknowledgement(text)'::regprocedure,'public.acknowledge_release(text)'::regprocedure) loop
  if pg_catalog.has_function_privilege('anon',v_object_row.oid,'EXECUTE') or not pg_catalog.has_function_privilege('authenticated',v_object_row.oid,'EXECUTE') then
   raise exception 'Migration 010 unexpected effective public RPC permissions on %',v_object_row.signature;
  end if;
 end loop;
 foreach v_browser_role in array array['anon','authenticated'] loop
  if pg_catalog.has_function_privilege(v_browser_role,'public.create_private_group(text,text)','EXECUTE') or pg_catalog.has_function_privilege(v_browser_role,'public.join_private_group(text,text)','EXECUTE') then
   raise exception 'Migration 010 unsafe effective legacy RPC execution for %',v_browser_role;
  end if;
 end loop;
end $effective_permissions$;
notify pgrst, 'reload schema';
commit;
