-- REVIEW ONLY. Do not apply automatically. Requires migrations 001-009.
-- One transaction: preserve personal records and membership; replace long invitations.
begin;

create schema group_security;
revoke all on schema group_security from public, anon, authenticated;

-- pgcrypto can be installed in public or extensions. Bind wrappers to its actual
-- extension-owned namespace; never resolve cryptography through a caller search_path.
do $install_crypto$
declare ns text;
begin
 select n.nspname into ns from pg_catalog.pg_extension e join pg_catalog.pg_namespace n on n.oid=e.extnamespace where e.extname='pgcrypto';
 if ns is null then raise exception 'Migration 010 requires the existing pgcrypto extension'; end if;
 execute format('create function group_security.random_bytes(integer) returns bytea language sql volatile security definer set search_path='''' as %L',format('select %I.gen_random_bytes($1)',ns));
 execute format('create function group_security.encrypt_code(text,text) returns bytea language sql volatile security definer set search_path='''' as %L',format('select %I.pgp_sym_encrypt($1,$2,''cipher-algo=aes256,compress-algo=0'')',ns));
 execute format('create function group_security.decrypt_code(bytea,text) returns text language sql stable security definer set search_path='''' as %L',format('select %I.pgp_sym_decrypt($1,$2)',ns));
 execute format('create function group_security.code_hmac(text,bytea) returns text language sql immutable security definer set search_path='''' as %L',format('select encode(%I.hmac(convert_to($1,''UTF8''),$2,''sha256''),''hex'')',ns));
end $install_crypto$;

create table group_security.secrets (
 singleton boolean primary key default true check(singleton),
 hash_key bytea not null, encryption_key text not null
);
insert into group_security.secrets values(true,group_security.random_bytes(32),encode(group_security.random_bytes(32),'hex'));
-- Hash is the acceptance index. Ciphertext exists only so an owner can retrieve
-- the same short code after reload. No raw code, keys or ciphertext are selectable.
create table group_security.codes (
 group_id uuid primary key references public.groups(id) on delete cascade,
 code_hash text not null unique references public.group_invites(code_hash),
 encrypted_code bytea not null
);
create table group_security.attempts (
 scope text not null, subject text not null, window_start timestamptz not null,
 attempts integer not null check(attempts>=0), primary key(scope,subject)
);
create table group_security.creation_requests (
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null, group_id uuid references public.groups(id) on delete cascade,
 primary key(user_id,request_id)
);
create table public.group_progress_privacy (
 user_id uuid primary key references auth.users(id) on delete cascade,
 share_progress boolean not null default true
);
alter table public.group_progress_privacy enable row level security;
revoke all on public.group_progress_privacy from public, anon, authenticated;
-- No direct policies/grants. Only self-scoped authenticated RPCs below can access it.
-- No backfill: absence of a preference means enabled for existing/new accounts.

create function group_security.shares_progress(p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select share_progress from public.group_progress_privacy where user_id=p_user),true);
$$;
create function public.get_group_progress_sharing() returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 return group_security.shares_progress(auth.uid());
end $$;
create function public.set_group_progress_sharing(p_enabled boolean) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_enabled is null then raise exception 'Choose a sharing preference'; end if;
 insert into public.group_progress_privacy(user_id,share_progress) values(auth.uid(),p_enabled)
 on conflict(user_id) do update set share_progress=excluded.share_progress;
 return p_enabled;
end $$;

create function group_security.take_attempt(p_scope text,p_subject text,p_limit integer,p_seconds integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare bucket timestamptz:=to_timestamp(floor(extract(epoch from clock_timestamp())/p_seconds)*p_seconds); n integer;
begin
 insert into group_security.attempts(scope,subject,window_start,attempts) values(p_scope,p_subject,bucket,1)
 on conflict(scope,subject) do update set
 attempts=case when group_security.attempts.window_start=excluded.window_start then least(group_security.attempts.attempts+1,p_limit+1) else 1 end,
 window_start=excluded.window_start returning attempts into n;
 return n<=p_limit;
end $$;

create function group_security.issue_code(p_group uuid) returns text
language plpgsql security definer set search_path='' as $$
declare alphabet constant text:='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; bytes bytea; code text; digest text; secret group_security.secrets; owner_id uuid; retry integer; i integer;
begin
 select owner_user_id into owner_id from public.groups where id=p_group for update;
 if not found then raise exception 'Group unavailable'; end if;
 select * into strict secret from group_security.secrets where singleton;
 -- 256 is divisible by 32: each of eight bytes supplies an unbiased five-bit
 -- alphabet index. Eight independent characters = 40 random bits.
 for retry in 1..32 loop
  bytes:=group_security.random_bytes(8); code:='';
  for i in 0..7 loop code:=code||substr(alphabet,(get_byte(bytes,i)&31)+1,1); end loop;
  digest:=group_security.code_hmac(code,secret.hash_key);
  begin
   -- The unique hash also prevents reusing any historical short code.
   insert into public.group_invites(code_hash,group_id,created_by,expires_at,max_uses)
   values(digest,p_group,owner_id,'infinity',2147483647);
  exception when unique_violation then continue;
  end;
  update public.group_invites set revoked_at=now() where group_id=p_group and code_hash<>digest and revoked_at is null;
  insert into group_security.codes(group_id,code_hash,encrypted_code)
   values(p_group,digest,group_security.encrypt_code(code,secret.encryption_key))
   on conflict(group_id) do update set code_hash=excluded.code_hash,encrypted_code=excluded.encrypted_code;
  return code;
 end loop;
 raise exception 'Could not create a Group Code. Please retry.';
end $$;

create function public.get_private_group_code(p_group_id uuid) returns text
language plpgsql security definer set search_path='' as $$
declare result text;
begin
 perform 1 from public.groups where id=p_group_id and owner_user_id=auth.uid() for share;
 if not found then raise exception 'Group unavailable' using errcode='42501'; end if;
 select group_security.decrypt_code(c.encrypted_code,s.encryption_key) into result
 from group_security.codes c cross join group_security.secrets s where c.group_id=p_group_id and s.singleton;
 if result is null then raise exception 'Group Code unavailable. Please retry.'; end if;
 return result;
end $$;

create function public.create_private_group_with_code(p_name text,p_display_name text,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_group uuid; v_code text;
begin
 if v_user is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_request_id is null then raise exception 'Request identifier required'; end if;
 -- A retry after a lost network response returns the same group and code.
 insert into group_security.creation_requests(user_id,request_id) values(v_user,p_request_id) on conflict do nothing;
 select group_id into v_group from group_security.creation_requests where user_id=v_user and request_id=p_request_id for update;
 if v_group is not null then return jsonb_build_object('ok',true,'group_id',v_group,'code',public.get_private_group_code(v_group)); end if;
 if not group_security.take_attempt('create-day',v_user::text,20,86400) then
  delete from group_security.creation_requests where user_id=v_user and request_id=p_request_id and group_id is null;
  return jsonb_build_object('ok',false);
 end if;
 v_group:=public.create_private_group(p_name,p_display_name);
 v_code:=group_security.issue_code(v_group);
 update group_security.creation_requests set group_id=v_group where user_id=v_user and request_id=p_request_id;
 return jsonb_build_object('ok',true,'group_id',v_group,'code',v_code);
end $$;

create function public.replace_private_group_code(p_group_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.groups where id=p_group_id and owner_user_id=auth.uid() for update;
 if not found then raise exception 'Group unavailable' using errcode='42501'; end if;
 if not group_security.take_attempt('replace-hour',auth.uid()::text,10,3600) then return jsonb_build_object('ok',false); end if;
 return jsonb_build_object('ok',true,'code',group_security.issue_code(p_group_id));
end $$;

create function public.join_private_group_code(p_code text,p_display_name text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); canonical text; digest text; v_group uuid; invitation public.group_invites;
begin
 if v_user is null then raise exception 'Sign in required' using errcode='42501'; end if;
 -- Failures RETURN, never RAISE after counting: exceptions would roll back the
 -- limiter along with the request. Counts serialize under row locks.
 if not group_security.take_attempt('join-quarter-hour',v_user::text,20,900) then return jsonb_build_object('ok',false); end if;
 if not group_security.take_attempt('join-day',v_user::text,100,86400) then return jsonb_build_object('ok',false); end if;
 if not group_security.take_attempt('join-global-hour','all',5000,3600) then return jsonb_build_object('ok',false); end if;
 if p_code is null or length(p_code)>128 or nullif(trim(p_display_name),'') is null or length(trim(p_display_name))>80 or position('@' in p_display_name)>0 then return jsonb_build_object('ok',false); end if;
 canonical:=upper(regexp_replace(p_code,'[[:space:]-]','','g'));
 if canonical !~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$' then return jsonb_build_object('ok',false); end if;
 select group_security.code_hmac(canonical,hash_key) into digest from group_security.secrets where singleton;
 select group_id into v_group from public.group_invites where code_hash=digest;
 if v_group is null then return jsonb_build_object('ok',false); end if;
 -- Same lock order as replacement/removal/deletion.
 perform 1 from public.groups where id=v_group for update;
 if not found then return jsonb_build_object('ok',false); end if;
 select * into invitation from public.group_invites where code_hash=digest for update;
 if not found or invitation.revoked_at is not null or invitation.expires_at<=now() or invitation.uses>=invitation.max_uses then return jsonb_build_object('ok',false); end if;
 if not exists(select 1 from public.group_members where group_id=v_group and user_id=v_user) then
  insert into public.group_members(group_id,user_id,role,display_name) values(v_group,v_user,'member',trim(p_display_name));
  update public.group_invites set uses=uses+1 where code_hash=digest;
 end if;
 return jsonb_build_object('ok',true,'group_id',v_group);
end $$;

-- Remove legacy mutation entry points: old clients fail closed, not into token UI.
revoke all on function public.create_private_group(text,text),public.join_private_group(text,text) from public,anon,authenticated;

create or replace function public.manage_private_group(p_group_id uuid,p_action text,p_member_id uuid default null,p_name text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_group public.groups; v_target public.group_members;
begin
 select * into v_group from public.groups where id=p_group_id for update;
 if not found or v_user is null or not public.is_group_member(p_group_id) then raise exception 'Group unavailable or membership removed' using errcode='42501'; end if;
 if p_action='leave' then
  if v_group.owner_user_id=v_user then raise exception 'The owner must delete the group before leaving'; end if;
  delete from public.group_members where group_id=p_group_id and user_id=v_user;
  return '{}'::jsonb;
 end if;
 if v_group.owner_user_id<>v_user then raise exception 'Only the group owner can do this' using errcode='42501'; end if;
 if p_action='rename' then
  if nullif(trim(p_name),'') is null or char_length(trim(p_name))>80 then raise exception 'Enter a group name'; end if;
  update public.groups set name=trim(p_name),updated_at=now() where id=p_group_id;
 elsif p_action='delete' then
  delete from public.groups where id=p_group_id;
 elsif p_action='remove' then
  select * into v_target from public.group_members where id=p_member_id and group_id=p_group_id;
  if not found then raise exception 'Member no longer in this group'; end if;
  if v_target.user_id=v_group.owner_user_id then raise exception 'Cannot remove the group owner'; end if;
  delete from public.group_members where id=p_member_id and group_id=p_group_id;
 else raise exception 'Unsupported group action';
 end if;
 return '{}'::jsonb;
end $$;


create or replace function public.private_group_summary(p_group_id uuid,p_period text default 'month',p_timezone text default 'UTC',p_activity text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_now timestamptz:=now(); v_local timestamp; v_start timestamptz; v_month timestamptz; v_eligible uuid[]; v_members jsonb; v_sets jsonb; v_prs jsonb; v_cardio jsonb; v_activities jsonb; v_name text;
begin
 -- Share lock serializes against membership revocation/group deletion during a read.
 select name into v_name from public.groups where id=p_group_id for share;
 if v_name is null or auth.uid() is null or not public.is_group_member(p_group_id) then raise exception 'Group unavailable or membership removed' using errcode='42501'; end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'Invalid calendar timezone'; end if;
 v_local:=v_now at time zone p_timezone;
 v_month:=date_trunc('month',v_local) at time zone p_timezone;
 v_start:=(case p_period when 'week' then date_trunc('week',v_local) when 'month' then date_trunc('month',v_local) when '3m' then date_trunc('month',v_local)-interval '2 months' when '6m' then date_trunc('month',v_local)-interval '5 months' when 'year' then date_trunc('year',v_local) else null end) at time zone p_timezone;
 if v_start is null then raise exception 'Invalid calendar period'; end if;
 -- Freeze the eligible member population once for every returned aggregate.
 select coalesce(array_agg(m.user_id),array[]::uuid[]) into v_eligible from public.group_members m
 left join public.group_progress_privacy p on p.user_id=m.user_id
 where m.group_id=p_group_id and coalesce(p.share_progress,true);
 select coalesce(jsonb_agg(jsonb_build_object('member_id',id,'display_name',display_name,'role',role,'is_self',user_id=auth.uid(),'sharing_progress',user_id=any(v_eligible)) order by lower(display_name),id),'[]') into v_members from public.group_members where group_id=p_group_id;
 with counted as (
  select m.id member_id,case when e.major_muscle_group in ('Legs','Chest','Back','Arms','Shoulders','Core') then e.major_muscle_group else 'Olympic/Other' end muscle,count(*) total
  from public.group_members m join public.strength_sets s on s.user_id=m.user_id
  join public.strength_workouts w on w.id=s.workout_id and w.user_id=s.user_id
  join public.exercises e on e.id=s.exercise_id and e.user_id=s.user_id
  where m.group_id=p_group_id and m.user_id=any(v_eligible) and w.performed_at>=v_start and w.performed_at<=v_now
  group by m.id,2
 ) select coalesce(jsonb_agg(to_jsonb(counted)),'[]') into v_sets from counted;
 -- Mirror the exclusive client PR pipeline. Canonical comparison grid = 0.000001 kg.
 with source as (
  select m.id member_id,s.id,s.exercise_id,s.workout_id,s.set_order,w.performed_at,w.created_at,s.reps,
   case when s.weight is null then null else round(s.weight*case when s.weight_unit='kg' then 1 else 0.45359237 end,6) end kg
  from public.group_members m join public.strength_sets s on s.user_id=m.user_id
  join public.strength_workouts w on w.id=s.workout_id and w.user_id=s.user_id
  where m.group_id=p_group_id and m.user_id=any(v_eligible) and s.tracking_type='repetitions' and s.reps is not null and w.performed_at<=v_now
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
  select m.id member_id,lower(regexp_replace(trim(a.name),'\s+',' ','g')) activity,s.duration_seconds,
   case when s.distance is null then null else s.distance*case s.distance_unit when 'meters' then 1 when 'kilometers' then 1000 when 'miles' then 1609.344 when 'yards' then 0.9144 when 'feet' then 0.3048 else null end end meters
  from public.group_members m join public.cardio_sessions s on s.user_id=m.user_id
  join public.cardio_activities a on a.id=s.activity_id and a.user_id=s.user_id
  where m.group_id=p_group_id and m.user_id=any(v_eligible) and s.performed_at>=v_start and s.performed_at<=v_now
 ), counts as (
  select member_id,activity,count(*) entries,sum(coalesce(duration_seconds,0)) duration_seconds,sum(meters) distance_meters,count(meters) distance_entries
  from entries where p_activity='' or activity=p_activity group by member_id,activity
 ) select coalesce(jsonb_agg(to_jsonb(counts)),'[]') into v_cardio from counts;
 select coalesce(jsonb_agg(activity order by activity),'[]') into v_activities from (
  select distinct lower(regexp_replace(trim(a.name),'\s+',' ','g')) activity from public.group_members m
  join public.cardio_sessions s on s.user_id=m.user_id join public.cardio_activities a on a.id=s.activity_id and a.user_id=s.user_id
  where m.group_id=p_group_id and m.user_id=any(v_eligible) and s.performed_at>=v_start and s.performed_at<=v_now
 ) names;
 return jsonb_build_object('name',v_name,'timezone',p_timezone,'period_start',v_start,'month_start',v_month,'through',v_now,'members',v_members,'sets',v_sets,'prs',v_prs,'cardio',v_cardio,'activities',v_activities);
end $$;

-- Backfill ONLY invitation state. Personal records and memberships are untouched.
-- In the same transaction, retire long active tokens and give every group a code.
update public.group_invites set revoked_at=now() where revoked_at is null;
do $existing_groups$
declare existing record;
begin
 for existing in select id from public.groups order by id loop
  perform group_security.issue_code(existing.id);
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
notify pgrst, 'reload schema';
commit;
