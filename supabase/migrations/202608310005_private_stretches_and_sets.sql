-- Forward-only migration. Apply once after 202608300004_activity_modules.sql.
alter table public.mobility_activities add column if not exists tracking_type text;
do $$ begin
 if exists(select 1 from pg_attribute where attrelid='public.mobility_activities'::regclass and attname='tracking_type' and not attisdropped and atttypid<>'text'::regtype) then
  raise exception 'Existing mobility_activities.tracking_type is incompatible: expected text';
 end if;
end $$;
update public.mobility_activities set tracking_type='time' where tracking_type is null;
do $$ declare bad text; begin
 select string_agg(distinct tracking_type,', ') into bad from public.mobility_activities where tracking_type not in('time','reps');
 if bad is not null then raise exception 'Invalid mobility_activities.tracking_type values must be resolved before migration 005: %',bad; end if;
end $$;
alter table public.mobility_activities alter column tracking_type set default 'time';
alter table public.mobility_activities alter column tracking_type set not null;
do $$ begin
 if exists(select 1 from pg_constraint where conrelid='public.mobility_activities'::regclass and conname='mobility_activities_tracking_type_check') then
  if not exists(select 1 from pg_constraint where conrelid='public.mobility_activities'::regclass and conname='mobility_activities_tracking_type_check' and contype='c' and pg_get_constraintdef(oid) ~* 'tracking_type.*time.*reps') then
   raise exception 'Existing mobility_activities_tracking_type_check is incompatible';
  end if;
 else alter table public.mobility_activities add constraint mobility_activities_tracking_type_check check(tracking_type in('time','reps')); end if;
end $$;
do $$ declare duplicates text; definition text; begin
 select string_agg(format('user_id=%s normalized_name=%L',user_id,normalized_name),'; ') into duplicates from(
  select user_id,lower(regexp_replace(trim(name),'\s+',' ','g')) normalized_name from public.mobility_activities group by 1,2 having count(*)>1
 ) d;
 if duplicates is not null then raise exception 'Normalized duplicate stretch names must be renamed manually before migration 005: %',duplicates; end if;
 select indexdef into definition from pg_indexes where schemaname='public' and indexname='mobility_activities_user_normalized_name_unique';
 if definition is not null and not(definition ~* 'unique index' and definition ~* 'user_id' and definition ~* 'lower' and definition ~* 'regexp_replace') then
  raise exception 'Existing mobility_activities_user_normalized_name_unique is incompatible: %',definition;
 elsif definition is null then create unique index mobility_activities_user_normalized_name_unique on public.mobility_activities(user_id,lower(regexp_replace(trim(name),'\s+',' ','g'))); end if;
end $$;

-- PostgreSQL requires an explicit unique key matching the composite ownership FK.
do $$ declare named_definition text; begin
 select pg_get_constraintdef(oid) into named_definition from pg_constraint where conrelid='public.mobility_sessions'::regclass and conname='mobility_sessions_id_user_unique';
 if named_definition is not null and not exists(
  select 1 from pg_constraint c where c.conrelid='public.mobility_sessions'::regclass and c.conname='mobility_sessions_id_user_unique' and c.contype in('p','u')
  and (select array_agg(a.attname::text order by k.ordinality) from unnest(c.conkey) with ordinality k(attnum,ordinality) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum)=array['id','user_id']::text[]
 ) then raise exception 'Existing mobility_sessions_id_user_unique is incompatible: %',named_definition; end if;
 if not exists(
  select 1 from pg_constraint c where c.conrelid='public.mobility_sessions'::regclass and c.contype in('p','u')
  and (select array_agg(a.attname::text order by k.ordinality) from unnest(c.conkey) with ordinality k(attnum,ordinality) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum)=array['id','user_id']::text[]
 ) then alter table public.mobility_sessions add constraint mobility_sessions_id_user_unique unique(id,user_id); end if;
end $$;

create table if not exists public.mobility_sets(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 session_id uuid not null, set_order integer not null, duration_seconds integer, reps integer,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint mobility_sets_session_owned_fk foreign key(session_id,user_id) references public.mobility_sessions(id,user_id) on delete cascade,
 constraint mobility_sets_order_unique unique(session_id,set_order), constraint mobility_sets_order_positive check(set_order>0),
 constraint mobility_sets_value_check check((duration_seconds is not null and duration_seconds>0 and reps is null) or (reps is not null and reps>0 and duration_seconds is null))
);
do $$ begin
 if not exists(select 1 from pg_constraint c where c.conrelid='public.mobility_sets'::regclass and c.conname='mobility_sets_session_owned_fk' and c.contype='f' and c.confrelid='public.mobility_sessions'::regclass and pg_get_constraintdef(c.oid) ~* 'FOREIGN KEY \(session_id, user_id\).*REFERENCES (public\.)?mobility_sessions\(id, user_id\)') then raise exception 'Existing public.mobility_sets is incompatible: missing same-user mobility_sets_session_owned_fk'; end if;
 if not exists(select 1 from pg_constraint where conrelid='public.mobility_sets'::regclass and conname='mobility_sets_value_check' and contype='c') then raise exception 'Existing public.mobility_sets is incompatible: missing mobility_sets_value_check'; end if;
end $$;
alter table public.mobility_sets enable row level security;
drop policy if exists mobility_sets_select_own on public.mobility_sets; create policy mobility_sets_select_own on public.mobility_sets for select to authenticated using((select auth.uid())=user_id);
drop policy if exists mobility_sets_insert_own on public.mobility_sets; create policy mobility_sets_insert_own on public.mobility_sets for insert to authenticated with check((select auth.uid())=user_id);
drop policy if exists mobility_sets_update_own on public.mobility_sets; create policy mobility_sets_update_own on public.mobility_sets for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
drop policy if exists mobility_sets_delete_own on public.mobility_sets; create policy mobility_sets_delete_own on public.mobility_sets for delete to authenticated using((select auth.uid())=user_id);
do $$ declare definition text; begin
 select indexdef into definition from pg_indexes where schemaname='public' and indexname='mobility_sets_user_session';
 if definition is not null and not(definition ~* 'mobility_sets.*\(user_id, session_id, set_order\)') then raise exception 'Existing mobility_sets_user_session is incompatible: %',definition;
 elsif definition is null then create index mobility_sets_user_session on public.mobility_sets(user_id,session_id,set_order); end if;
end $$;

do $$ declare bad text; begin
 select string_agg(id::text,', ') into bad from public.mobility_sessions where duration_seconds>0 and (duration_seconds<>trunc(duration_seconds) or duration_seconds>2147483647);
 if bad is not null then raise exception 'Legacy Flexibility durations must be positive whole seconds within integer range before migration 005; affected entry ids: %',bad; end if;
end $$;
insert into public.mobility_sets(user_id,session_id,set_order,duration_seconds)
select user_id,id,n,duration_seconds from public.mobility_sessions cross join lateral generate_series(1,set_count)n
where duration_seconds>0 and not exists(select 1 from public.mobility_sets s where s.session_id=mobility_sessions.id);

create table if not exists public.mobility_library_installations(user_id uuid primary key references auth.users(id) on delete cascade,version integer not null,installed_at timestamptz not null default now());
do $$ begin
 if not exists(select 1 from pg_constraint c where c.conrelid='public.mobility_library_installations'::regclass and c.contype='p' and pg_get_constraintdef(c.oid)='PRIMARY KEY (user_id)') then raise exception 'Existing public.mobility_library_installations is incompatible: user_id must be the primary key'; end if;
end $$;
alter table public.mobility_library_installations enable row level security;
drop policy if exists mobility_install_select_own on public.mobility_library_installations; create policy mobility_install_select_own on public.mobility_library_installations for select to authenticated using((select auth.uid())=user_id);
drop policy if exists mobility_install_insert_own on public.mobility_library_installations; create policy mobility_install_insert_own on public.mobility_library_installations for insert to authenticated with check((select auth.uid())=user_id);
drop policy if exists mobility_install_update_own on public.mobility_library_installations; create policy mobility_install_update_own on public.mobility_library_installations for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
drop policy if exists mobility_install_delete_own on public.mobility_library_installations; create policy mobility_install_delete_own on public.mobility_library_installations for delete to authenticated using((select auth.uid())=user_id);

create or replace function public.install_private_stretch_library(p_user_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare item jsonb; aid uuid; area text;
begin
 if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'User not found'; end if;
 perform pg_advisory_xact_lock(hashtext('stretch-library:'||p_user_id::text));
 if exists(select 1 from public.mobility_library_installations where user_id=p_user_id and version>=1) then return; end if;
 for item in select value from jsonb_array_elements('[
  {"n":"Standing Hamstring Stretch","t":"time","a":["Hamstrings"]},{"n":"Elephant Walks","t":"reps","a":["Hamstrings"]},{"n":"Arm Circles","t":"reps","a":["Shoulders"]},{"n":"Seated Hamstring Stretch","t":"time","a":["Hamstrings"]},{"n":"Child’s Pose","t":"time","a":["Back"]},{"n":"Front Splits","t":"time","a":["Hamstrings","Hip Flexors"]},{"n":"Side Splits","t":"time","a":["Hip Flexors","Adductors"]},{"n":"Doorway Chest Stretch","t":"time","a":["Chest","Shoulders"]},{"n":"Cross-Body Shoulder Stretch","t":"time","a":["Shoulders","Rear Delts"]},{"n":"Overhead Triceps Stretch","t":"time","a":["Triceps","Shoulders"]},{"n":"Wall Biceps Stretch","t":"time","a":["Biceps","Chest"]},{"n":"Wrist Flexor Stretch","t":"time","a":["Forearms","Wrists"]},{"n":"Wrist Extensor Stretch","t":"time","a":["Forearms","Wrists"]},{"n":"Kneeling Hip Flexor Stretch","t":"time","a":["Hip Flexors","Quads"]},{"n":"Couch Stretch","t":"time","a":["Hip Flexors","Quads"]},{"n":"Figure Four Stretch","t":"time","a":["Glutes","Hips"]},{"n":"Pigeon Pose","t":"time","a":["Glutes","Hips"]},{"n":"Butterfly Stretch","t":"time","a":["Adductors","Hips"]},{"n":"Frog Stretch","t":"time","a":["Adductors","Hips"]},{"n":"Standing Quad Stretch","t":"time","a":["Quads"]},{"n":"Wall Calf Stretch","t":"time","a":["Calves"]},{"n":"Cat-Cow","t":"reps","a":["Back","Core"]},{"n":"Thread the Needle","t":"reps","a":["Upper Back","Shoulders"]},{"n":"Thoracic Rotations","t":"reps","a":["Upper Back","Core"]},{"n":"Deep Squat Hold","t":"time","a":["Hips","Adductors","Ankles"]}
 ]'::jsonb) loop
  select id into aid from public.mobility_activities where user_id=p_user_id and lower(regexp_replace(trim(name),'\s+',' ','g'))=lower(regexp_replace(trim(item->>'n'),'\s+',' ','g'));
  if aid is null then insert into public.mobility_activities(user_id,name,tracking_type) values(p_user_id,item->>'n',item->>'t') returning id into aid;
   for area in select jsonb_array_elements_text(item->'a') loop insert into public.mobility_activity_area_assignments(user_id,activity_id,body_area) values(p_user_id,aid,area) on conflict do nothing; end loop;
  end if;
 end loop;
 insert into public.mobility_library_installations(user_id,version) values(p_user_id,1) on conflict(user_id) do update set version=greatest(public.mobility_library_installations.version,excluded.version);
end$$;
revoke all on function public.install_private_stretch_library(uuid) from public;
revoke all on function public.install_private_stretch_library(uuid) from anon;
revoke all on function public.install_private_stretch_library(uuid) from authenticated;
create or replace function public.handle_new_user_stretch_library() returns trigger language plpgsql security definer set search_path='' as $$begin perform public.install_private_stretch_library(new.id);return new;end$$;
revoke all on function public.handle_new_user_stretch_library() from public;
revoke all on function public.handle_new_user_stretch_library() from anon;
revoke all on function public.handle_new_user_stretch_library() from authenticated;
do $$ begin
 if exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass and tgname='on_auth_user_seed_private_stretch_library' and not tgisinternal) then
  if not exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass and tgname='on_auth_user_seed_private_stretch_library' and tgfoid='public.handle_new_user_stretch_library()'::regprocedure and not tgisinternal) then raise exception 'Existing on_auth_user_seed_private_stretch_library trigger is incompatible'; end if;
 else create trigger on_auth_user_seed_private_stretch_library after insert on auth.users for each row execute function public.handle_new_user_stretch_library(); end if;
end $$;
do $$declare u record;begin for u in select id from auth.users loop perform public.install_private_stretch_library(u.id);end loop;end$$;

-- Extend the existing account-scoped activity editor with tracking type.
create or replace function public.save_flexibility_activity(p_activity jsonb,p_areas text[]) returns uuid language plpgsql set search_path='' as $$
declare uid uuid:=auth.uid(); aid uuid:=nullif(p_activity->>'id','')::uuid; tracking text:=coalesce(nullif(p_activity->>'tracking_type',''),'time'); affected integer;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 if trim(coalesce(p_activity->>'name',''))='' or coalesce(array_length(p_areas,1),0)=0 then raise exception 'Name and at least one body area are required'; end if;
 if tracking not in('time','reps') then raise exception 'Tracking type must be time or reps'; end if;
 if aid is null then insert into public.mobility_activities(user_id,name,tracking_type) values(uid,trim(p_activity->>'name'),tracking) returning id into aid;
 else update public.mobility_activities set name=trim(p_activity->>'name'),tracking_type=tracking where id=aid and user_id=uid; get diagnostics affected=row_count; if affected<>1 then raise exception 'Stretch not found'; end if; end if;
 delete from public.mobility_activity_area_assignments where activity_id=aid and user_id=uid;
 insert into public.mobility_activity_area_assignments(user_id,activity_id,body_area) select uid,aid,unnest(p_areas);
 return aid;
end$$;
revoke all on function public.save_flexibility_activity(jsonb,text[]) from public;
grant execute on function public.save_flexibility_activity(jsonb,text[]) to authenticated;

create or replace function public.save_stretch_entry(p_entry jsonb,p_sets jsonb) returns uuid language plpgsql set search_path='' as $$
declare uid uuid:=auth.uid(); sid uuid:=nullif(p_entry->>'id','')::uuid; activity uuid:=(p_entry->>'activity_id')::uuid; tracking text; item jsonb; ord integer:=0; value_integer integer; legacy_duration integer;
begin
 if uid is null then raise exception 'Authentication required';end if;
 select tracking_type into tracking from public.mobility_activities where id=activity and user_id=uid;
 if tracking is null then raise exception 'Stretch not found';end if;
 if jsonb_typeof(p_sets) is distinct from 'array' or jsonb_array_length(p_sets)<1 then raise exception 'At least one set is required';end if;
 for item in select value from jsonb_array_elements(p_sets) loop
  if jsonb_typeof(item)<>'object' then raise exception 'Each set must be an object'; end if;
  if tracking='time' then
   if not(item ? 'duration_seconds') or item ? 'reps' or (item->>'duration_seconds')!~'^[1-9][0-9]*$' then raise exception 'Time stretch sets require positive whole-number duration_seconds only'; end if;
   value_integer:=(item->>'duration_seconds')::integer; if legacy_duration is null then legacy_duration:=value_integer; end if;
  else
   if not(item ? 'reps') or item ? 'duration_seconds' or (item->>'reps')!~'^[1-9][0-9]*$' then raise exception 'Rep stretch sets require positive whole-number reps only'; end if;
   value_integer:=(item->>'reps')::integer;
  end if;
 end loop;
 if sid is null then insert into public.mobility_sessions(user_id,activity_id,performed_at,duration_seconds,set_count,notes) values(uid,activity,(p_entry->>'performed_at')::timestamptz,legacy_duration,jsonb_array_length(p_sets),nullif(p_entry->>'notes','')) returning id into sid;
 else update public.mobility_sessions set activity_id=activity,performed_at=(p_entry->>'performed_at')::timestamptz,duration_seconds=legacy_duration,set_count=jsonb_array_length(p_sets),notes=nullif(p_entry->>'notes','') where id=sid and user_id=uid; if not found then raise exception 'Stretch entry not found';end if; delete from public.mobility_sets where session_id=sid and user_id=uid; end if;
 for item in select value from jsonb_array_elements(p_sets) loop ord:=ord+1; if tracking='time' then insert into public.mobility_sets(user_id,session_id,set_order,duration_seconds) values(uid,sid,ord,(item->>'duration_seconds')::integer);else insert into public.mobility_sets(user_id,session_id,set_order,reps) values(uid,sid,ord,(item->>'reps')::integer);end if;end loop;
 return sid;
end$$;
revoke all on function public.save_stretch_entry(jsonb,jsonb) from public;grant execute on function public.save_stretch_entry(jsonb,jsonb) to authenticated;
