-- PROGRESSIVE OVERLOAD FOUNDATION — PASTE THIS ENTIRE FILE INTO THE SUPABASE SQL EDITOR
-- Forward-only migration. It creates application tables, constraints, triggers, and RLS policies.
-- It does not seed workout data and contains no estimated-strength metrics.

create extension if not exists pgcrypto;

create type public.exercise_tracking_type as enum ('repetitions', 'distance');
create type public.distance_unit as enum ('meters', 'kilometers', 'miles', 'yards', 'feet');
create type public.weight_unit as enum ('kg', 'lb');
create type public.record_period as enum ('monthly', 'yearly');
create type public.weigh_in_period as enum ('morning', 'evening');

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 80),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  strength_enabled boolean not null default true,
  cardio_enabled boolean not null default true,
  mobility_enabled boolean not null default false,
  weight_enabled boolean not null default true,
  preferred_weight_unit public.weight_unit not null default 'lb',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  is_default boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);
create unique index locations_one_default_per_user on public.locations(user_id) where is_default and not archived;

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  tracking_type public.exercise_tracking_type not null,
  major_muscle_group text not null check (char_length(trim(major_muscle_group)) between 1 and 80),
  is_compound boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.exercise_muscle_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  muscle_tag text not null check (char_length(trim(muscle_tag)) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (exercise_id, muscle_tag)
);

create table public.strength_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  performed_at timestamptz not null,
  duration_seconds numeric check (duration_seconds is null or duration_seconds >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.strength_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid not null references public.strength_workouts(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  set_order integer not null check (set_order > 0),
  tracking_type public.exercise_tracking_type not null,
  weight numeric check (weight is null or weight >= 0),
  reps numeric check (reps is null or reps >= 0),
  load numeric check (load is null or load >= 0),
  distance numeric check (distance is null or distance > 0),
  distance_unit public.distance_unit,
  laps numeric check (laps is null or laps >= 0),
  duration_seconds numeric check (duration_seconds is null or duration_seconds >= 0),
  difficulty numeric check (difficulty is null or difficulty between 0 and 10),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workout_id, set_order),
  constraint strength_set_fields_match_type check (
    (tracking_type = 'repetitions' and reps is not null and distance is null and distance_unit is null and laps is null)
    or
    (tracking_type = 'distance' and distance is not null and distance_unit is not null and weight is null and reps is null)
  )
);

create table public.historical_strength_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  period_type public.record_period not null,
  period_start date not null,
  tracking_type public.exercise_tracking_type not null,
  weight numeric check (weight is null or weight >= 0),
  reps numeric check (reps is null or reps >= 0),
  load numeric check (load is null or load >= 0),
  distance numeric check (distance is null or distance > 0),
  distance_unit public.distance_unit,
  laps numeric check (laps is null or laps >= 0),
  duration_seconds numeric check (duration_seconds is null or duration_seconds >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint historical_period_start check (
    (period_type = 'monthly' and period_start = date_trunc('month', period_start)::date)
    or (period_type = 'yearly' and period_start = date_trunc('year', period_start)::date)
  ),
  constraint historical_record_fields_match_type check (
    (tracking_type = 'repetitions' and reps is not null and distance is null and distance_unit is null and laps is null)
    or (tracking_type = 'distance' and distance is not null and distance_unit is not null and weight is null and reps is null)
  )
);

create table public.cardio_activities (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120), archived boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id, name)
);
create table public.cardio_sessions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  activity_id uuid not null references public.cardio_activities(id) on delete restrict, location_id uuid references public.locations(id) on delete set null,
  performed_at timestamptz not null, duration_seconds numeric check(duration_seconds is null or duration_seconds >= 0),
  distance numeric check(distance is null or distance >= 0), distance_unit public.distance_unit,
  laps numeric check(laps is null or laps >= 0), incline numeric check(incline is null or incline >= 0),
  speed numeric check(speed is null or speed >= 0), difficulty numeric check(difficulty is null or difficulty between 0 and 10), notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((distance is null and distance_unit is null) or (distance is not null and distance_unit is not null))
);
create table public.mobility_activities (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120), archived boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id, name)
);
create table public.mobility_sessions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  activity_id uuid not null references public.mobility_activities(id) on delete restrict, performed_at timestamptz not null,
  duration_seconds numeric check(duration_seconds is null or duration_seconds >= 0), difficulty numeric check(difficulty is null or difficulty between 0 and 10), notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.weigh_ins (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  measured_at timestamptz not null, period public.weigh_in_period not null, weight numeric not null check(weight > 0),
  weight_unit public.weight_unit not null, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- Composite ownership keys prevent cross-user references even when both rows independently pass RLS.
alter table public.locations add constraint locations_id_user_unique unique (id, user_id);
alter table public.exercises add constraint exercises_id_user_unique unique (id, user_id);
alter table public.exercises add constraint exercises_id_user_tracking_unique unique (id, user_id, tracking_type);
alter table public.strength_workouts add constraint strength_workouts_id_user_unique unique (id, user_id);
alter table public.cardio_activities add constraint cardio_activities_id_user_unique unique (id, user_id);
alter table public.mobility_activities add constraint mobility_activities_id_user_unique unique (id, user_id);
alter table public.exercise_muscle_assignments add constraint exercise_muscles_owned_fk foreign key (exercise_id, user_id) references public.exercises(id, user_id) on delete cascade;
alter table public.strength_workouts add constraint strength_workout_location_owned_fk foreign key (location_id, user_id) references public.locations(id, user_id);
alter table public.strength_sets add constraint strength_set_workout_owned_fk foreign key (workout_id, user_id) references public.strength_workouts(id, user_id) on delete cascade;
alter table public.strength_sets add constraint strength_set_exercise_type_owned_fk foreign key (exercise_id, user_id, tracking_type) references public.exercises(id, user_id, tracking_type);
alter table public.historical_strength_records add constraint historical_exercise_type_owned_fk foreign key (exercise_id, user_id, tracking_type) references public.exercises(id, user_id, tracking_type);
alter table public.cardio_sessions add constraint cardio_activity_owned_fk foreign key (activity_id, user_id) references public.cardio_activities(id, user_id);
alter table public.cardio_sessions add constraint cardio_location_owned_fk foreign key (location_id, user_id) references public.locations(id, user_id);
alter table public.mobility_sessions add constraint mobility_activity_owned_fk foreign key (activity_id, user_id) references public.mobility_activities(id, user_id);

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;
create or replace function public.enforce_owned_reference() returns trigger language plpgsql set search_path = '' as $$
declare owner_id uuid;
begin
  execute format('select user_id from public.%I where id = $1', TG_ARGV[0]) into owner_id using new.exercise_id;
  if owner_id is distinct from new.user_id then raise exception 'Referenced record must belong to the same user'; end if;
  return new;
end; $$;

do $$ declare t text; begin
  foreach t in array array['profiles','user_settings','locations','exercises','strength_workouts','strength_sets','historical_strength_records','cardio_activities','cardio_sessions','mobility_activities','mobility_sessions','weigh_ins']
  loop execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t); end loop;
end $$;

create trigger exercise_muscles_same_owner before insert or update on public.exercise_muscle_assignments for each row execute function public.enforce_owned_reference('exercises');

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(user_id, display_name) values(new.id, nullif(new.raw_user_meta_data ->> 'display_name',''));
  insert into public.user_settings(user_id) values(new.id);
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Backfill only identity companion rows when the project already contains auth users.
insert into public.profiles(user_id, display_name)
select id, nullif(raw_user_meta_data ->> 'display_name', '') from auth.users
on conflict (user_id) do nothing;
insert into public.user_settings(user_id)
select id from auth.users
on conflict (user_id) do nothing;

do $$ declare t text; begin
  foreach t in array array['profiles','user_settings','locations','exercises','exercise_muscle_assignments','strength_workouts','strength_sets','historical_strength_records','cardio_activities','cardio_sessions','mobility_activities','mobility_sessions','weigh_ins']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I_select_own on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t, t);
    execute format('create policy %I_insert_own on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t, t);
    execute format('create policy %I_update_own on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t, t);
    execute format('create policy %I_delete_own on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t, t);
  end loop;
end $$;

create index strength_workouts_user_date on public.strength_workouts(user_id, performed_at desc);
create index strength_sets_user_exercise on public.strength_sets(user_id, exercise_id);
create index historical_strength_user_period on public.historical_strength_records(user_id, period_type, period_start desc);
create index cardio_sessions_user_date on public.cardio_sessions(user_id, performed_at desc);
create index mobility_sessions_user_date on public.mobility_sessions(user_id, performed_at desc);
create index weigh_ins_user_date on public.weigh_ins(user_id, measured_at desc);
