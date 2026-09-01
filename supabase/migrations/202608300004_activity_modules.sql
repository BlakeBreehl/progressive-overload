-- PROGRESSIVE OVERLOAD — CARDIO STARTERS AND FLEXIBILITY DETAILS
-- Forward-only and safely resumable after a partial execution. Apply manually once after migration 003.

create table if not exists public.cardio_library_installations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  installed_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'cardio_library_installations'
      and c.contype = 'p' and pg_get_constraintdef(c.oid) = 'PRIMARY KEY (user_id)'
  ) then
    raise exception 'Existing cardio_library_installations table has an incompatible primary key';
  end if;
end $$;

alter table public.cardio_library_installations enable row level security;
do $$
begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='cardio_library_installations' and policyname='cardio_library_installations_select_own') then
    if not exists (select 1 from pg_policies where schemaname='public' and tablename='cardio_library_installations' and policyname='cardio_library_installations_select_own' and cmd='SELECT' and 'authenticated'=any(roles) and qual like '%auth.uid()%user_id%') then
      raise exception 'Existing cardio_library_installations_select_own policy is incompatible';
    end if;
  else
    create policy cardio_library_installations_select_own on public.cardio_library_installations for select to authenticated using((select auth.uid())=user_id);
  end if;
end $$;

-- Migration 001 normally creates this key. Add it only if a compatible installation is missing it.
do $$
begin
  if not exists (
    select 1 from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='mobility_activities' and c.conname='mobility_activities_id_user_unique'
      and c.contype='u' and pg_get_constraintdef(c.oid)='UNIQUE (id, user_id)'
  ) then
    if exists (
      select 1 from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
      where n.nspname='public' and t.relname='mobility_activities' and c.conname='mobility_activities_id_user_unique'
    ) then raise exception 'Existing mobility_activities_id_user_unique constraint is incompatible'; end if;
    alter table public.mobility_activities add constraint mobility_activities_id_user_unique unique(id,user_id);
  end if;
end $$;

create table if not exists public.mobility_activity_area_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_id uuid not null references public.mobility_activities(id) on delete cascade,
  body_area text not null,
  created_at timestamptz not null default now(),
  unique(activity_id,body_area),
  constraint mobility_area_owned_fk foreign key(activity_id,user_id) references public.mobility_activities(id,user_id) on delete cascade
);

do $$
begin
  if not exists (
    select 1 from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='mobility_activity_area_assignments' and c.conname='mobility_area_owned_fk'
      and c.contype='f' and pg_get_constraintdef(c.oid) like 'FOREIGN KEY (activity_id, user_id) REFERENCES mobility_activities(id, user_id)%'
  ) then raise exception 'mobility_activity_area_assignments is missing its compatible same-user foreign key'; end if;
end $$;

alter table public.mobility_activity_area_assignments enable row level security;
do $$
declare p record;
begin
  for p in select * from (values
    ('mobility_activity_areas_select_own','SELECT','USING'),
    ('mobility_activity_areas_insert_own','INSERT','CHECK'),
    ('mobility_activity_areas_update_own','UPDATE','BOTH'),
    ('mobility_activity_areas_delete_own','DELETE','USING')
  ) as expected(name,command,mode) loop
    if exists(select 1 from pg_policies where schemaname='public' and tablename='mobility_activity_area_assignments' and policyname=p.name) then
      if not exists(select 1 from pg_policies where schemaname='public' and tablename='mobility_activity_area_assignments' and policyname=p.name and cmd=p.command and 'authenticated'=any(roles)) then
        raise exception 'Existing policy % is incompatible',p.name;
      end if;
    elsif p.command='SELECT' then create policy mobility_activity_areas_select_own on public.mobility_activity_area_assignments for select to authenticated using((select auth.uid())=user_id);
    elsif p.command='INSERT' then create policy mobility_activity_areas_insert_own on public.mobility_activity_area_assignments for insert to authenticated with check((select auth.uid())=user_id);
    elsif p.command='UPDATE' then create policy mobility_activity_areas_update_own on public.mobility_activity_area_assignments for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
    else create policy mobility_activity_areas_delete_own on public.mobility_activity_area_assignments for delete to authenticated using((select auth.uid())=user_id);
    end if;
  end loop;
end $$;

alter table public.mobility_sessions add column if not exists set_count integer;
update public.mobility_sessions set set_count=1 where set_count is null;
alter table public.mobility_sessions alter column set_count set default 1;
alter table public.mobility_sessions alter column set_count set not null;
do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.mobility_sessions'::regclass and conname='mobility_sessions_set_count_positive') then
    alter table public.mobility_sessions add constraint mobility_sessions_set_count_positive check(set_count>0);
  end if;
end $$;

create or replace function public.install_private_cardio_activities(p_user_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_name text;
begin
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'User not found'; end if;
  perform pg_advisory_xact_lock(hashtext('cardio:'||p_user_id::text));
  foreach v_name in array array['Running','Treadmill','StairMaster','Jacob''s Ladder','Spin Bike'] loop
    if not exists(select 1 from public.cardio_activities where user_id=p_user_id and lower(trim(name))=lower(trim(v_name))) then
      insert into public.cardio_activities(user_id,name) values(p_user_id,v_name);
    end if;
  end loop;
  insert into public.cardio_library_installations(user_id,installed_at) values(p_user_id,now())
  on conflict(user_id) do update set installed_at=excluded.installed_at;
end;$$;
revoke all on function public.install_private_cardio_activities(uuid) from public;

create or replace function public.handle_new_user_cardio_library() returns trigger language plpgsql security definer set search_path='' as $$
begin perform public.install_private_cardio_activities(new.id); return new; end;$$;
revoke all on function public.handle_new_user_cardio_library() from public;

do $$ begin
  if exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass and tgname='on_auth_user_seed_private_cardio_library' and not tgisinternal) then
    if not exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass and tgname='on_auth_user_seed_private_cardio_library' and tgfoid='public.handle_new_user_cardio_library()'::regprocedure and not tgisinternal) then
      raise exception 'Existing on_auth_user_seed_private_cardio_library trigger is incompatible';
    end if;
  else
    create trigger on_auth_user_seed_private_cardio_library after insert on auth.users for each row execute function public.handle_new_user_cardio_library();
  end if;
end $$;

-- Always run the installer: a marker from a partial/manual attempt must not suppress missing starters.
do $$ declare v_user_id uuid; begin
  for v_user_id in select id from auth.users loop perform public.install_private_cardio_activities(v_user_id); end loop;
end $$;

create or replace function public.save_flexibility_activity(p_activity jsonb,p_areas text[]) returns uuid language plpgsql set search_path='' as $$
declare v_user_id uuid:=auth.uid(); v_id uuid:=nullif(p_activity->>'id','')::uuid; v_rows integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if trim(p_activity->>'name')='' or coalesce(array_length(p_areas,1),0)=0 then raise exception 'Name and at least one body area are required'; end if;
  if v_id is null then insert into public.mobility_activities(user_id,name) values(v_user_id,trim(p_activity->>'name')) returning id into v_id;
  else update public.mobility_activities set name=trim(p_activity->>'name') where id=v_id and user_id=v_user_id; get diagnostics v_rows=row_count; if v_rows<>1 then raise exception 'Flexibility activity not found'; end if; end if;
  delete from public.mobility_activity_area_assignments where activity_id=v_id and user_id=v_user_id;
  insert into public.mobility_activity_area_assignments(user_id,activity_id,body_area) select v_user_id,v_id,unnest(p_areas);
  return v_id;
end;$$;
revoke all on function public.save_flexibility_activity(jsonb,text[]) from public;
grant execute on function public.save_flexibility_activity(jsonb,text[]) to authenticated;
