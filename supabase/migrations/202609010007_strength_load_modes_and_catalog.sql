-- Forward-only Strength load modes and canonical catalog v2.
-- Review and apply manually. Migrations 001-006 remain unchanged.
begin;

alter table public.exercises
  add column if not exists load_mode text;

do $$ begin
  if (select data_type from information_schema.columns where table_schema='public' and table_name='exercises' and column_name='load_mode') <> 'text' then
    raise exception 'public.exercises.load_mode exists with an incompatible type';
  end if;
end $$;
alter table public.exercises alter column load_mode set default 'weight_reps';
update public.exercises set load_mode='weight_reps' where load_mode is null;
alter table public.exercises alter column load_mode set not null;
do $$ declare v record; begin
  for v in select conname from pg_constraint where conrelid='public.exercises'::regclass and contype='c' and pg_get_constraintdef(oid) ilike '%load_mode%'
  loop execute format('alter table public.exercises drop constraint %I',v.conname); end loop;
end $$;
alter table public.exercises drop constraint if exists exercises_load_mode_check;
alter table public.exercises add constraint exercises_load_mode_check check(load_mode in('weight_reps','reps_only'));

-- Rename in place only where it cannot create a normalized-name conflict.
update public.exercises old
set name = 'Dumbbell Bench Press'
where lower(regexp_replace(trim(old.name),'\s+',' ','g')) = 'dumbbell bench'
  and not exists (
    select 1 from public.exercises target
    where target.user_id=old.user_id and target.id<>old.id
      and lower(regexp_replace(trim(target.name),'\s+',' ','g'))='dumbbell bench press'
  );

create or replace function public.install_strength_catalog_v2(p_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v record;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));
  for v in select * from (values
    ('Pull Up','Back','reps_only',true),
    ('Weighted Pull Up','Back','weight_reps',true),
    ('Chin Up','Back','reps_only',true),
    ('Weighted Chin Up','Back','weight_reps',true),
    ('Dip','Chest','reps_only',true),
    ('Weighted Dip','Chest','weight_reps',true),
    ('Push Up','Chest','reps_only',true),
    ('Leg Lift','Core','reps_only',false),
    ('Squat','Legs','weight_reps',true),
    ('Dumbbell Bench Press','Chest','weight_reps',true)
  ) as catalog(name,major_group,load_mode,compound)
  loop
    if not exists(select 1 from public.exercises e where e.user_id=p_user_id and lower(regexp_replace(trim(e.name),'\s+',' ','g'))=lower(v.name)) then
      insert into public.exercises(user_id,name,tracking_type,load_mode,major_muscle_group,is_compound)
      values(p_user_id,v.name,'repetitions',v.load_mode,v.major_group,v.compound);
    end if;
  end loop;
  update public.exercises set load_mode='reps_only'
  where user_id=p_user_id and lower(regexp_replace(trim(name),'\s+',' ','g')) in ('pull up','chin up','dip','push up','leg lift');
  update public.starter_library_installations set library_version=greatest(library_version,2) where user_id=p_user_id;
end $$;

revoke all on function public.install_strength_catalog_v2(uuid) from public;

create or replace function public.enforce_strength_set_load_mode()
returns trigger language plpgsql set search_path='' as $$
declare v_mode text;
begin
  if tg_op='UPDATE' and new.exercise_id=old.exercise_id and new.tracking_type=old.tracking_type
    and new.weight is not distinct from old.weight and new.reps is not distinct from old.reps
    and new.load is not distinct from old.load and new.distance is not distinct from old.distance
    and new.distance_unit is not distinct from old.distance_unit and new.laps is not distinct from old.laps
    and new.duration_seconds is not distinct from old.duration_seconds then return new; end if;
  select load_mode into v_mode from public.exercises where id=new.exercise_id and user_id=new.user_id;
  if new.tracking_type='repetitions' and v_mode='reps_only' then
    if new.weight is not null then raise exception 'Reps-only exercises cannot store weight'; end if;
    if new.reps is null or new.reps < 1 or new.reps <> trunc(new.reps) then raise exception 'Reps must be a positive whole number'; end if;
  end if;
  if new.tracking_type='repetitions' and v_mode='weight_reps' then
    if new.weight is null or new.weight < 0 then raise exception 'Weight + Reps exercises require nonnegative weight'; end if;
    if new.reps is null or new.reps < 1 or new.reps <> trunc(new.reps) then raise exception 'Reps must be a positive whole number'; end if;
  end if;
  return new;
end $$;
drop trigger if exists enforce_strength_set_load_mode on public.strength_sets;
create trigger enforce_strength_set_load_mode before insert or update on public.strength_sets for each row execute function public.enforce_strength_set_load_mode();

create or replace function public.handle_new_user_strength_catalog_v2()
returns trigger language plpgsql security definer set search_path='' as $$
begin perform public.install_strength_catalog_v2(new.id); return new; end $$;
drop trigger if exists on_auth_user_seed_strength_catalog_v2 on auth.users;
create trigger on_auth_user_seed_strength_catalog_v2 after insert on auth.users for each row execute function public.handle_new_user_strength_catalog_v2();

do $$ declare v_user_id uuid; begin for v_user_id in select id from auth.users loop perform public.install_strength_catalog_v2(v_user_id); end loop; end $$;

-- Exercise edits are security-invoker and remain protected by existing RLS.
create or replace function public.save_strength_exercise(p_exercise jsonb, p_muscle_tags text[])
returns uuid language plpgsql set search_path='' as $$
declare v_user_id uuid:=auth.uid();v_id uuid:=nullif(p_exercise->>'id','')::uuid;v_name text:=regexp_replace(trim(p_exercise->>'name'),'\s+',' ','g');v_tracking public.exercise_tracking_type:=(p_exercise->>'tracking_type')::public.exercise_tracking_type;v_mode text:=coalesce(nullif(p_exercise->>'load_mode',''),'weight_reps');v_rows integer;
begin
  if v_user_id is null then raise exception 'Authentication required';end if;
  if v_name='' then raise exception 'Exercise name is required';end if;
  if v_mode not in ('weight_reps','reps_only') then raise exception 'Invalid load mode';end if;
  if v_tracking='distance' and v_mode<>'weight_reps' then raise exception 'Distance exercises cannot use reps-only mode';end if;
  if coalesce(array_length(p_muscle_tags,1),0)=0 then raise exception 'At least one muscle tag is required';end if;
  perform pg_advisory_xact_lock(hashtext(v_user_id::text));
  if exists(select 1 from public.exercises where user_id=v_user_id and id is distinct from v_id and lower(regexp_replace(trim(name),'\s+',' ','g'))=lower(v_name)) then raise exception 'An exercise with this name already exists';end if;
  if v_id is null then
    insert into public.exercises(user_id,name,tracking_type,load_mode,major_muscle_group,is_compound) values(v_user_id,v_name,v_tracking,v_mode,p_exercise->>'major_muscle_group',(p_exercise->>'is_compound')::boolean) returning id into v_id;
  else
    update public.exercises set name=v_name,tracking_type=v_tracking,load_mode=v_mode,major_muscle_group=p_exercise->>'major_muscle_group',is_compound=(p_exercise->>'is_compound')::boolean where id=v_id and user_id=v_user_id;
    get diagnostics v_rows=row_count;if v_rows<>1 then raise exception 'Exercise not found';end if;
  end if;
  delete from public.exercise_muscle_assignments where exercise_id=v_id and user_id=v_user_id;
  insert into public.exercise_muscle_assignments(user_id,exercise_id,muscle_tag) select v_user_id,v_id,tag from unnest(p_muscle_tags)tag;
  return v_id;
end $$;
revoke all on function public.save_strength_exercise(jsonb,text[]) from public;
grant execute on function public.save_strength_exercise(jsonb,text[]) to authenticated;

create index if not exists strength_workouts_user_performed_created_id_idx on public.strength_workouts(user_id,performed_at desc,created_at desc,id desc);
create index if not exists strength_sets_user_exercise_workout_idx on public.strength_sets(user_id,exercise_id,workout_id);
create index if not exists cardio_sessions_user_activity_location_performed_idx on public.cardio_sessions(user_id,activity_id,location_id,performed_at desc,created_at desc,id desc);
create index if not exists mobility_sessions_user_activity_performed_idx on public.mobility_sessions(user_id,activity_id,performed_at desc,created_at desc,id desc);
create index if not exists weigh_ins_user_period_measured_idx on public.weigh_ins(user_id,period,measured_at desc,created_at desc,id desc);

commit;
