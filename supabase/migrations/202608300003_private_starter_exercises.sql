-- PROGRESSIVE OVERLOAD — PRIVATE STARTER EXERCISES AND MULTI-GROUP ASSIGNMENTS
-- Forward-only. Apply manually once after 202608300002_strength_whole_reps.sql.

create table public.exercise_group_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  major_group text not null check (major_group in ('Legs','Core','Arms','Back','Chest','Shoulders','Olympic Lifts')),
  created_at timestamptz not null default now(),
  unique(exercise_id, major_group),
  constraint exercise_group_assignment_owned_fk foreign key(exercise_id,user_id) references public.exercises(id,user_id) on delete cascade
);

create table public.starter_library_installations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  library_version integer not null default 1 check(library_version > 0),
  installed_at timestamptz not null default now()
);

alter table public.exercise_group_assignments enable row level security;
alter table public.starter_library_installations enable row level security;
create policy exercise_group_assignments_select_own on public.exercise_group_assignments for select to authenticated using ((select auth.uid())=user_id);
create policy exercise_group_assignments_insert_own on public.exercise_group_assignments for insert to authenticated with check ((select auth.uid())=user_id);
create policy exercise_group_assignments_update_own on public.exercise_group_assignments for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy exercise_group_assignments_delete_own on public.exercise_group_assignments for delete to authenticated using ((select auth.uid())=user_id);
create policy starter_library_installations_select_own on public.starter_library_installations for select to authenticated using ((select auth.uid())=user_id);
create policy starter_library_installations_insert_own on public.starter_library_installations for insert to authenticated with check ((select auth.uid())=user_id);
create policy starter_library_installations_update_own on public.starter_library_installations for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy starter_library_installations_delete_own on public.starter_library_installations for delete to authenticated using ((select auth.uid())=user_id);

-- Preserve every existing legacy group before the application switches to many-to-many reads.
insert into public.exercise_group_assignments(user_id,exercise_id,major_group)
select user_id,id,major_muscle_group from public.exercises
on conflict(exercise_id,major_group) do nothing;

create or replace function public.install_private_starter_exercises(p_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_template record; v_name text; v_exercise_id uuid;
begin
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'User not found'; end if;
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));
  if exists(select 1 from public.starter_library_installations where user_id=p_user_id) then return; end if;

  for v_template in
    select exercise_name, groups, tags, compound, tracking from (
      select unnest(names) exercise_name, groups, tags, compound, tracking from (values
        (array['Bench Press','Chest Press','Machine Chest Press','Lying Chest Press','Cable Fly','Chest Fly','Dumbbell Bench','Dumbbell Chest Fly','Push Up'],array['Chest'],array['Mid Chest'],true,'repetitions'),
        (array['Incline Bench Press','Incline Chest Press','Dumbbell Incline Bench'],array['Chest'],array['Upper Chest'],false,'repetitions'),
        (array['Decline Chest Press','Decline Bench Press'],array['Chest'],array['Lower Chest'],false,'repetitions'),
        (array['Shoulder Press','Machine Shoulder Press','Military Press','Dumbbell Shoulder Press'],array['Shoulders'],array['Front Delts'],true,'repetitions'),
        (array['Lateral Raise','Machine Lateral Raise','Seated Lateral Raise','Dumbbell Lateral Raise'],array['Shoulders'],array['Side Delts'],false,'repetitions'),
        (array['Rear Delt Fly','Single Rear Delt Fly'],array['Shoulders'],array['Rear Delts'],false,'repetitions'),
        (array['Dumbbell Front Raise'],array['Shoulders'],array['Front Delts'],false,'repetitions'),
        (array['Leg Press','Machine Leg Press','Hack Squat','Pendulum Squat','V Squat','Bulgarian Split Squat','Romanian Deadlift','Hip Lift','Dumbbell Lunge','Dumbbell Split Squat','Dumbbell Romanian Deadlift'],array['Legs'],array['Quads','Glutes'],true,'repetitions'),
        (array['Leg Extension','Single Leg Extension'],array['Legs'],array['Quads'],false,'repetitions'),
        (array['Hamstring Extension','Seated Leg Curl','Lying Leg Curl','Standing Leg Curl'],array['Legs'],array['Hamstrings'],false,'repetitions'),
        (array['Calf Raise','Machine Calf Raise','Seated Calf Raise','Incline Calf Raise','Calf Extension','Dumbbell Calf Raise'],array['Legs'],array['Calves'],false,'repetitions'),
        (array['Hip Thrust','Glute Press','Dumbbell Glute Press'],array['Legs'],array['Glutes'],false,'repetitions'),
        (array['Hip Abduction'],array['Legs'],array['Abductors'],false,'repetitions'),
        (array['Hip Adduction'],array['Legs'],array['Adductors'],false,'repetitions'),
        (array['Sled Push','Yoke Carry'],array['Legs'],array['Quads','Glutes'],true,'distance'),
        (array['Row','Machine Row','Low Row','Cable Row','Bent Over Row','Lying Row','Pendlay Row','Lever Row','Reverse Grip Row','Pull Over','Seated Pullover','Machine Pullover','Dumbbell Row','Pull Up','Weighted Pull Up','Chin Up','Weighted Chin Up'],array['Back'],array['Lats'],true,'repetitions'),
        (array['Lat Pull Down','Machine Lat Pulldown','Wide Pulldown','Front Pulldown'],array['Back'],array['Lats'],false,'repetitions'),
        (array['Shrug','Machine Shrug','Hex Shrug','Dumbbell Shrug'],array['Back'],array['Traps'],false,'repetitions'),
        (array['Back Extension','Machine Back Extension','Seated Back Extension'],array['Back'],array['Erectors','Lower Back'],false,'repetitions'),
        (array['Forearm Pull','Seated Forearm Pull','Wrist Curl','Seated Wrist Curl','Dumbbell Wrist Curl','Dumbbell Forearm Curl'],array['Arms'],array['Forearms'],false,'repetitions'),
        (array['Overhead Extension','Tricep Extension','Tricep Pushdown','Tricep Press','Machine Tricep Press','Skullcrusher','Dumbbell Extension','Dumbbell Skullcrusher'],array['Arms'],array['Triceps'],false,'repetitions'),
        (array['Cable Curl','Preacher Curl','Machine Preacher Curl','Bar Curl','Banded Bar Curl','Dumbbell Bicep Curl'],array['Arms'],array['Biceps'],false,'repetitions'),
        (array['Reverse Curl'],array['Arms'],array['Biceps','Forearms'],false,'repetitions'),
        (array['Torso Rotation','Russian Twist'],array['Core'],array['Obliques'],false,'repetitions'),
        (array['Weighted Crunch','Machine Crunch','Rope Crunch','Leg Lift','Sit Up','Decline Sit Up'],array['Core'],array['Abdominals'],false,'repetitions'),
        (array['Deadlift','Hex Lift'],array['Back','Legs'],array['Erectors','Hamstrings','Glutes'],true,'repetitions'),
        (array['Clean and Jerk','Snatch'],array['Olympic Lifts'],array['Erectors','Traps','Glutes'],true,'repetitions')
      ) as templates(names,groups,tags,compound,tracking)
    ) expanded
  loop
    select id into v_exercise_id from public.exercises
      where user_id=p_user_id and lower(regexp_replace(trim(name),'\s+',' ','g'))=lower(regexp_replace(trim(v_template.exercise_name),'\s+',' ','g')) limit 1;
    if v_exercise_id is null then
      insert into public.exercises(user_id,name,tracking_type,major_muscle_group,is_compound)
      values(p_user_id,v_template.exercise_name,v_template.tracking::public.exercise_tracking_type,(v_template.groups)[1],v_template.compound)
      returning id into v_exercise_id;
      insert into public.exercise_group_assignments(user_id,exercise_id,major_group) select p_user_id,v_exercise_id,unnest(v_template.groups);
      insert into public.exercise_muscle_assignments(user_id,exercise_id,muscle_tag) select p_user_id,v_exercise_id,unnest(v_template.tags);
    end if;
    v_exercise_id := null;
  end loop;
  insert into public.starter_library_installations(user_id,library_version) values(p_user_id,1);
end; $$;
revoke all on function public.install_private_starter_exercises(uuid) from public;

-- Replace the applied v2 function without changing its signature. The legacy column keeps
-- the first selected group while the assignment table stores every selected group.
create or replace function public.save_strength_exercise(p_exercise jsonb,p_muscle_tags text[])
returns uuid language plpgsql set search_path='' as $$
declare v_user_id uuid:=auth.uid();v_id uuid:=nullif(p_exercise->>'id','')::uuid;v_name text:=regexp_replace(trim(p_exercise->>'name'),'\s+',' ','g');v_groups text[];v_rows integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select coalesce(array_agg(value),array[p_exercise->>'major_muscle_group']) into v_groups from jsonb_array_elements_text(coalesce(p_exercise->'major_muscle_groups','[]'::jsonb));
  if v_name='' then raise exception 'Exercise name is required'; end if;
  if coalesce(array_length(v_groups,1),0)=0 then raise exception 'At least one major group is required'; end if;
  if exists(select 1 from unnest(v_groups) g where g not in('Legs','Core','Arms','Back','Chest','Shoulders','Olympic Lifts')) then raise exception 'Invalid major group'; end if;
  if coalesce(array_length(p_muscle_tags,1),0)=0 then raise exception 'At least one muscle tag is required'; end if;
  perform pg_advisory_xact_lock(hashtext(v_user_id::text));
  if exists(select 1 from public.exercises where user_id=v_user_id and id is distinct from v_id and lower(regexp_replace(trim(name),'\s+',' ','g'))=lower(v_name)) then raise exception 'An exercise with this name already exists'; end if;
  if v_id is null then
    insert into public.exercises(user_id,name,tracking_type,major_muscle_group,is_compound) values(v_user_id,v_name,(p_exercise->>'tracking_type')::public.exercise_tracking_type,v_groups[1],(p_exercise->>'is_compound')::boolean) returning id into v_id;
  else
    if exists(select 1 from public.strength_sets where exercise_id=v_id and user_id=v_user_id and tracking_type<>(p_exercise->>'tracking_type')::public.exercise_tracking_type) then raise exception 'Tracking type cannot change after incompatible sets exist'; end if;
    update public.exercises set name=v_name,tracking_type=(p_exercise->>'tracking_type')::public.exercise_tracking_type,major_muscle_group=v_groups[1],is_compound=(p_exercise->>'is_compound')::boolean where id=v_id and user_id=v_user_id;
    get diagnostics v_rows=row_count;if v_rows<>1 then raise exception 'Exercise not found';end if;
  end if;
  delete from public.exercise_group_assignments where exercise_id=v_id and user_id=v_user_id;
  insert into public.exercise_group_assignments(user_id,exercise_id,major_group) select v_user_id,v_id,unnest(v_groups);
  delete from public.exercise_muscle_assignments where exercise_id=v_id and user_id=v_user_id;
  insert into public.exercise_muscle_assignments(user_id,exercise_id,muscle_tag) select v_user_id,v_id,unnest(p_muscle_tags);
  return v_id;
end; $$;
revoke all on function public.save_strength_exercise(jsonb,text[]) from public;
grant execute on function public.save_strength_exercise(jsonb,text[]) to authenticated;

create or replace function public.handle_new_user_starter_library() returns trigger language plpgsql security definer set search_path='' as $$
begin perform public.install_private_starter_exercises(new.id);return new;end; $$;
create trigger on_auth_user_seed_private_starter_library after insert on auth.users for each row execute function public.handle_new_user_starter_library();

-- Existing accounts receive their private library once as part of this migration transaction.
do $$ declare v_user_id uuid;begin for v_user_id in select id from auth.users loop perform public.install_private_starter_exercises(v_user_id);end loop;end $$;
