-- Forward-only private Groups. REVIEW ONLY: this file has not been applied.
-- No activity backfill, unit conversion, automatic enrolment, or existing profile update.
begin;

-- Per-set unit provenance is necessary for comparable group PR totals. NULL legacy = lb.
-- Nullable, no default/backfill: no existing numeric value or row is rewritten.
alter table public.strength_sets add column weight_unit public.weight_unit;

create table public.groups (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (char_length(trim(name)) between 1 and 80),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.group_members (
 id uuid not null unique default gen_random_uuid(),
 group_id uuid not null references public.groups(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check (role in ('owner','member')),
 display_name text not null check (char_length(trim(display_name)) between 1 and 80 and position('@' in display_name)=0),
 joined_at timestamptz not null default now(), primary key(group_id,user_id)
);
create unique index group_one_owner on public.group_members(group_id) where role='owner';
create index group_members_user on public.group_members(user_id,group_id);
create table public.group_invites (
 code_hash text primary key,
 group_id uuid not null references public.groups(id) on delete cascade,
 created_by uuid not null references auth.users(id) on delete cascade,
 expires_at timestamptz not null default now()+interval '7 days',
 uses integer not null default 0 check(uses>=0), max_uses integer not null default 100 check(max_uses>0),
 revoked_at timestamptz, created_at timestamptz not null default now()
);
create index group_invites_group on public.group_invites(group_id);
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;
revoke all on public.groups,public.group_members,public.group_invites from public,anon,authenticated;
-- Only names/IDs of groups are directly selectable. Memberships, invite hashes and
-- personal activity remain RPC-only/private; no new grants on existing activity tables.
grant select(id,name,created_at,updated_at) on public.groups to authenticated;

create function public.is_group_member(p_group_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.group_members m where m.group_id=p_group_id and m.user_id=(select auth.uid()));
$$;
revoke all on function public.is_group_member(uuid) from public,anon;
grant execute on function public.is_group_member(uuid) to authenticated;
create policy groups_member_read on public.groups for select to authenticated using(public.is_group_member(id));
-- These policies remain safe if a later migration grants SELECT; currently no direct grants.
create policy memberships_member_read on public.group_members for select to authenticated using(public.is_group_member(group_id));
-- No invite SELECT policy: valid codes/hashes cannot be enumerated even by members.

create function public.create_private_group(p_name text,p_display_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_group uuid;
begin
 if v_user is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if nullif(trim(p_display_name),'') is null or char_length(trim(p_display_name))>80 or position('@' in p_display_name)>0 then raise exception 'Enter a display name'; end if;
 if nullif(trim(p_name),'') is null or char_length(trim(p_name))>80 then raise exception 'Enter a group name'; end if;
 insert into public.groups(owner_user_id,name) values(v_user,trim(p_name)) returning id into v_group;
 insert into public.group_members(group_id,user_id,role,display_name) values(v_group,v_user,'owner',trim(p_display_name));
 return v_group;
end $$;

create function public.join_private_group(p_code text,p_display_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_group uuid; v_invite public.group_invites; v_hash text;
begin
 if v_user is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if nullif(trim(p_display_name),'') is null or char_length(trim(p_display_name))>80 or position('@' in p_display_name)>0 then raise exception 'Enter a display name'; end if;
 if p_code is null or p_code !~ '^[a-f0-9]{64}$' then raise exception 'Invite invalid, expired or revoked'; end if;
 v_hash:=encode(sha256(convert_to(p_code,'UTF8')),'hex');
 select group_id into v_group from public.group_invites where code_hash=v_hash;
 if v_group is null then raise exception 'Invite invalid, expired or revoked'; end if;
 -- Same lock order as owner actions, serializing removal, rotation and joining.
 perform 1 from public.groups where id=v_group for update;
 select * into v_invite from public.group_invites where code_hash=v_hash for update;
 if not found or v_invite.revoked_at is not null or v_invite.expires_at<=now() or v_invite.uses>=v_invite.max_uses then raise exception 'Invite invalid, expired or revoked'; end if;
 if not exists(select 1 from public.group_members where group_id=v_group and user_id=v_user) then
  insert into public.group_members(group_id,user_id,role,display_name) values(v_group,v_user,'member',trim(p_display_name));
  update public.group_invites set uses=uses+1 where code_hash=v_hash;
 end if;
 return v_group;
end $$;

create function public.manage_private_group(p_group_id uuid,p_action text,p_member_id uuid default null,p_name text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_group public.groups; v_target public.group_members; v_code text;
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
 elsif p_action in ('invite','revoke') then
  update public.group_invites set revoked_at=now() where group_id=p_group_id and revoked_at is null;
  if p_action='invite' then
   v_code:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
   insert into public.group_invites(code_hash,group_id,created_by) values(encode(sha256(convert_to(v_code,'UTF8')),'hex'),p_group_id,v_user);
   return jsonb_build_object('code',v_code,'expires_at',now()+interval '7 days');
  end if;
 else raise exception 'Unsupported group action';
 end if;
 return '{}'::jsonb;
end $$;

-- Current member summaries only. No email, auth metadata, raw sets, notes,
-- locations or Bodyweight are returned. IDs below are opaque membership handles.
create function public.private_group_summary(p_group_id uuid,p_period text default 'month',p_timezone text default 'UTC',p_activity text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_now timestamptz:=now(); v_local timestamp; v_start timestamptz; v_month timestamptz; v_members jsonb; v_sets jsonb; v_prs jsonb; v_cardio jsonb; v_activities jsonb; v_name text;
begin
 -- Share lock serializes against membership revocation/group deletion during a read.
 select name into v_name from public.groups where id=p_group_id for share;
 if v_name is null or auth.uid() is null or not public.is_group_member(p_group_id) then raise exception 'Group unavailable or membership removed' using errcode='42501'; end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'Invalid calendar timezone'; end if;
 v_local:=v_now at time zone p_timezone;
 v_month:=date_trunc('month',v_local) at time zone p_timezone;
 v_start:=(case p_period when 'week' then date_trunc('week',v_local) when 'month' then date_trunc('month',v_local) when '3m' then date_trunc('month',v_local)-interval '2 months' when '6m' then date_trunc('month',v_local)-interval '5 months' when 'year' then date_trunc('year',v_local) else null end) at time zone p_timezone;
 if v_start is null then raise exception 'Invalid calendar period'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('member_id',id,'display_name',display_name,'role',role,'is_self',user_id=auth.uid()) order by lower(display_name),id),'[]') into v_members from public.group_members where group_id=p_group_id;
 with counted as (
  select m.id member_id,case when e.major_muscle_group in ('Legs','Chest','Back','Arms','Shoulders','Core') then e.major_muscle_group else 'Olympic/Other' end muscle,count(*) total
  from public.group_members m join public.strength_sets s on s.user_id=m.user_id
  join public.strength_workouts w on w.id=s.workout_id and w.user_id=s.user_id
  join public.exercises e on e.id=s.exercise_id and e.user_id=s.user_id
  where m.group_id=p_group_id and w.performed_at>=v_start and w.performed_at<=v_now
  group by m.id,2
 ) select coalesce(jsonb_agg(to_jsonb(counted)),'[]') into v_sets from counted;
 -- Mirror the exclusive client PR pipeline. Canonical comparison grid = 0.000001 kg.
 with source as (
  select m.id member_id,s.id,s.exercise_id,s.workout_id,s.set_order,w.performed_at,w.created_at,s.reps,
   case when s.weight is null then null else round(s.weight*case when s.weight_unit='kg' then 1 else 0.45359237 end,6) end kg
  from public.group_members m join public.strength_sets s on s.user_id=m.user_id
  join public.strength_workouts w on w.id=s.workout_id and w.user_id=s.user_id
  where m.group_id=p_group_id and s.tracking_type='repetitions' and s.reps is not null and w.performed_at<=v_now
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
  where m.group_id=p_group_id and s.performed_at>=v_start and s.performed_at<=v_now
 ), counts as (
  select member_id,activity,count(*) entries,sum(coalesce(duration_seconds,0)) duration_seconds,sum(meters) distance_meters,count(meters) distance_entries
  from entries where p_activity='' or activity=p_activity group by member_id,activity
 ) select coalesce(jsonb_agg(to_jsonb(counts)),'[]') into v_cardio from counts;
 select coalesce(jsonb_agg(activity order by activity),'[]') into v_activities from (
  select distinct lower(regexp_replace(trim(a.name),'\s+',' ','g')) activity from public.group_members m
  join public.cardio_sessions s on s.user_id=m.user_id join public.cardio_activities a on a.id=s.activity_id and a.user_id=s.user_id
  where m.group_id=p_group_id and s.performed_at>=v_start and s.performed_at<=v_now
 ) names;
 return jsonb_build_object('name',v_name,'timezone',p_timezone,'period_start',v_start,'month_start',v_month,'through',v_now,'members',v_members,'sets',v_sets,'prs',v_prs,'cardio',v_cardio,'activities',v_activities);
end $$;

revoke all on function public.create_private_group(text,text),public.join_private_group(text,text),public.manage_private_group(uuid,text,uuid,text),public.private_group_summary(uuid,text,text,text) from public,anon;
grant execute on function public.create_private_group(text,text),public.join_private_group(text,text),public.manage_private_group(uuid,text,uuid,text),public.private_group_summary(uuid,text,text,text) to authenticated;
create index if not exists group_strength_chronology on public.strength_workouts(user_id,performed_at,created_at,id);
create index if not exists group_strength_evidence on public.strength_sets(user_id,exercise_id,workout_id,set_order,id);
create index if not exists group_cardio_period on public.cardio_sessions(user_id,performed_at,activity_id);

-- Future explicit user saves record their entered unit without converting weights.
create or replace function public.save_strength_workout(p_workout jsonb, p_sets jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_workout_id uuid := nullif(p_workout ->> 'id', '')::uuid;
  v_set jsonb;
  v_set_id uuid;
  v_keep_ids uuid[] := array[]::uuid[];
  v_rows integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_sets) <> 'array' or jsonb_array_length(p_sets) = 0 then raise exception 'At least one set is required'; end if;

  if v_workout_id is null then
    insert into public.strength_workouts(user_id, performed_at, location_id, notes, duration_seconds)
    values(v_user_id, (p_workout ->> 'performed_at')::timestamptz, nullif(p_workout ->> 'location_id','')::uuid, nullif(trim(p_workout ->> 'notes'),''), nullif(p_workout ->> 'duration_seconds','')::numeric)
    returning id into v_workout_id;
  else
    update public.strength_workouts set performed_at=(p_workout ->> 'performed_at')::timestamptz, location_id=nullif(p_workout ->> 'location_id','')::uuid,
      notes=nullif(trim(p_workout ->> 'notes'),''), duration_seconds=nullif(p_workout ->> 'duration_seconds','')::numeric
    where id=v_workout_id and user_id=v_user_id;
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then raise exception 'Workout not found'; end if;
  end if;

  -- Move existing orders out of the target range so reorder/update operations cannot
  -- collide with the foundation's unique (workout_id, set_order) constraint.
  update public.strength_sets set set_order=set_order+1000000 where workout_id=v_workout_id and user_id=v_user_id;

  for v_set in select value from jsonb_array_elements(p_sets)
  loop
    v_set_id := nullif(v_set ->> 'id','')::uuid;
    if v_set_id is null then
      insert into public.strength_sets(user_id,workout_id,exercise_id,set_order,tracking_type,weight,weight_unit,reps,load,distance,distance_unit,laps,duration_seconds,notes)
      values(v_user_id,v_workout_id,(v_set->>'exercise_id')::uuid,(v_set->>'set_order')::integer,(v_set->>'tracking_type')::public.exercise_tracking_type,
        nullif(v_set->>'weight','')::numeric,coalesce(nullif(v_set->>'weight_unit','')::public.weight_unit,'lb'),nullif(v_set->>'reps','')::numeric,nullif(v_set->>'load','')::numeric,nullif(v_set->>'distance','')::numeric,
        nullif(v_set->>'distance_unit','')::public.distance_unit,nullif(v_set->>'laps','')::numeric,nullif(v_set->>'duration_seconds','')::numeric,nullif(trim(v_set->>'notes'),''))
      returning id into v_set_id;
    else
      update public.strength_sets set exercise_id=(v_set->>'exercise_id')::uuid,set_order=(v_set->>'set_order')::integer,tracking_type=(v_set->>'tracking_type')::public.exercise_tracking_type,
        weight=nullif(v_set->>'weight','')::numeric,reps=nullif(v_set->>'reps','')::numeric,load=nullif(v_set->>'load','')::numeric,distance=nullif(v_set->>'distance','')::numeric,
        distance_unit=nullif(v_set->>'distance_unit','')::public.distance_unit,laps=nullif(v_set->>'laps','')::numeric,duration_seconds=nullif(v_set->>'duration_seconds','')::numeric,notes=nullif(trim(v_set->>'notes'),'')
      where id=v_set_id and workout_id=v_workout_id and user_id=v_user_id;
      get diagnostics v_rows = row_count;
      if v_rows <> 1 then raise exception 'Set not found'; end if;
    end if;
    v_keep_ids := array_append(v_keep_ids,v_set_id);
  end loop;
  delete from public.strength_sets where workout_id=v_workout_id and user_id=v_user_id and not(id=any(v_keep_ids));
  return v_workout_id;
end;
$$;
revoke all on function public.save_strength_workout(jsonb,jsonb) from public,anon;
grant execute on function public.save_strength_workout(jsonb,jsonb) to authenticated;
commit;
