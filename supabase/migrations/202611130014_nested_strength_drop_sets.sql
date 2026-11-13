-- Migration 014: resumable from clean post-013, partial 014, or compatible completed 014.
-- Review/run the COMPLETE FILE manually. No frontend deployment is part of this file.
-- Each DO is one atomic server statement; there is no cross-statement/session state.
-- No existing workout, main-set or drop-set rows are written during installation.
-- Read-only before/after aggregate procedure: docs/NESTED_DROP_SETS_014_REVIEW.md.
DO $migration_014$
DECLARE
  v_columns constant jsonb := $contract$[{"name":"id","type":"uuid","notnull":true,"default":"gen_random_uuid()","ddl":"uuid not null default gen_random_uuid()"},
{"name":"parent_set_id","type":"uuid","notnull":true,"default":null,"ddl":"uuid not null"},
{"name":"user_id","type":"uuid","notnull":true,"default":null,"ddl":"uuid not null"},
{"name":"workout_id","type":"uuid","notnull":true,"default":null,"ddl":"uuid not null"},
{"name":"exercise_id","type":"uuid","notnull":true,"default":null,"ddl":"uuid not null"},
{"name":"tracking_type","type":"public.exercise_tracking_type","notnull":true,"default":"'repetitions'::exercise_tracking_type","ddl":"public.exercise_tracking_type not null default 'repetitions'"},
{"name":"drop_order","type":"integer","notnull":true,"default":null,"ddl":"integer not null"},
{"name":"weight","type":"numeric","notnull":false,"default":null,"ddl":"numeric"},
{"name":"weight_unit","type":"public.weight_unit","notnull":true,"default":"'lb'::weight_unit","ddl":"public.weight_unit not null default 'lb'"},
{"name":"reps","type":"numeric","notnull":true,"default":null,"ddl":"numeric not null"},
{"name":"created_at","type":"timestamp with time zone","notnull":true,"default":"now()","ddl":"timestamptz not null default now()"}]$contract$::jsonb;
  v_constraints constant jsonb := $contract$[{"table":"strength_sets","name":"strength_main_drop_owner_key","kind":"u","cols":["id","user_id","workout_id","exercise_id","tracking_type"],"ddl":"unique(id,user_id,workout_id,exercise_id,tracking_type)"},
{"table":"strength_drop_sets","name":"strength_drop_sets_pkey","kind":"p","cols":["id"],"ddl":"primary key(id)"},
{"table":"strength_drop_sets","name":"strength_drop_sets_user_id_fkey","kind":"f","cols":["user_id"],"target":"auth.users","refcols":["id"],"delete":"c","update":"a","ddl":"foreign key(user_id) references auth.users(id) on delete cascade"},
{"table":"strength_drop_sets","name":"strength_drop_sets_tracking_type_check","kind":"c","expr":"tracking_type='repetitions'","boolops":[],"ddl":"check(tracking_type='repetitions')"},
{"table":"strength_drop_sets","name":"strength_drop_sets_drop_order_check","kind":"c","expr":"drop_order>0","boolops":[],"ddl":"check(drop_order>0)"},
{"table":"strength_drop_sets","name":"strength_drop_sets_weight_check","kind":"c","expr":"weightISNULLORweight>=0ANDweight<>ALLARRAY['NaN','Infinity','-Infinity']","boolops":["or","and"],"ddl":"check(weight is null or (weight>=0 and weight::text not in ('NaN','Infinity','-Infinity')))"},
{"table":"strength_drop_sets","name":"strength_drop_sets_reps_check","kind":"c","expr":"reps>=0ANDreps<=9007199254740991ANDreps=truncrepsANDreps<>ALLARRAY['NaN','Infinity','-Infinity']","boolops":["and"],"ddl":"check(reps>=0 and reps<=9007199254740991 and reps=trunc(reps) and reps::text not in ('NaN','Infinity','-Infinity'))"},
{"table":"strength_drop_sets","name":"strength_drop_sets_parent_set_id_drop_order_key","kind":"u","cols":["parent_set_id","drop_order"],"ddl":"unique(parent_set_id,drop_order)"},
{"table":"strength_drop_sets","name":"strength_drop_parent_owned_fk","kind":"f","cols":["parent_set_id","user_id","workout_id","exercise_id","tracking_type"],"target":"public.strength_sets","refcols":["id","user_id","workout_id","exercise_id","tracking_type"],"delete":"c","update":"c","ddl":"foreign key(parent_set_id,user_id,workout_id,exercise_id,tracking_type) references public.strength_sets(id,user_id,workout_id,exercise_id,tracking_type) on delete cascade on update cascade"}]$contract$::jsonb;
  v_policies constant jsonb := $contract$[{"name":"strength_drop_select","cmd":"r","op":"select","gate":"using(user_id=auth.uid())"},
{"name":"strength_drop_insert","cmd":"a","op":"insert","gate":"with check(user_id=auth.uid())"},
{"name":"strength_drop_update","cmd":"w","op":"update","gate":"using(user_id=auth.uid()) with check(user_id=auth.uid())"},
{"name":"strength_drop_delete","cmd":"d","op":"delete","gate":"using(user_id=auth.uid())"}]$contract$::jsonb;
  v_functions constant jsonb := $contract$[{"sig":"public.enforce_strength_drop_load_mode()","result":"trigger","args":[],"definer":false,"execute":false},
{"sig":"public.save_strength_workout(jsonb,jsonb)","result":"uuid","args":["p_workout","p_sets"],"definer":false,"execute":true},
{"sig":"public.private_group_summary(uuid,text,text,text)","result":"jsonb","args":["p_group_id","p_period","p_timezone","p_activity"],"definer":true,"execute":true}]$contract$::jsonb;

  v_phase text;
  v_spec jsonb;
  v_col jsonb;
  v_table oid;
  v_drop oid;
  v_constraint pg_catalog.pg_constraint%rowtype;
  v_attribute record;
  v_proc record;
  v_policy pg_catalog.pg_policy%rowtype;
  v_index record;
  v_expected_cols smallint[];
  v_expected_refs smallint[];
  v_names text[];
  v_boolops text[];
  v_expression text;
  v_expected text;
  v_populated boolean;
  v_role oid;
  v_oid oid;
  v_privilege text;
  v_authenticated oid := to_regrole('authenticated');
  v_anon oid := to_regrole('anon');

BEGIN

  -- READ-ONLY prerequisite assertions. No DDL or row writes precede these checks.
  if v_authenticated is null or v_anon is null or to_regclass('auth.users') is null
    or to_regprocedure('auth.uid()') is null or to_regclass('pg_catalog.pg_timezone_names') is null
    or to_regprocedure('public.is_group_member(uuid)') is null then
    raise exception '014 prerequisite missing: Supabase auth/roles, timezone catalog or group membership helper';
  end if;
  for v_spec in select value from jsonb_array_elements($prerequisites$[{"table":"strength_workouts","columns":[{"name":"id","type":"uuid"},{"name":"user_id","type":"uuid"},{"name":"performed_at","type":"timestamp with time zone"},{"name":"created_at","type":"timestamp with time zone"},{"name":"location_id","type":"uuid"},{"name":"notes","type":"text"},{"name":"duration_seconds","type":"numeric"}]},{"table":"strength_sets","columns":[{"name":"id","type":"uuid"},{"name":"user_id","type":"uuid"},{"name":"workout_id","type":"uuid"},{"name":"exercise_id","type":"uuid"},{"name":"set_order","type":"integer"},{"name":"tracking_type","type":"public.exercise_tracking_type"},{"name":"weight","type":"numeric"},{"name":"weight_unit","type":"public.weight_unit"},{"name":"reps","type":"numeric"},{"name":"load","type":"numeric"},{"name":"distance","type":"numeric"},{"name":"distance_unit","type":"public.distance_unit"},{"name":"laps","type":"numeric"},{"name":"duration_seconds","type":"numeric"},{"name":"notes","type":"text"}]},{"table":"exercises","columns":[{"name":"id","type":"uuid"},{"name":"user_id","type":"uuid"},{"name":"load_mode","type":"text"},{"name":"progression_direction","type":"text"},{"name":"major_muscle_group","type":"text"}]},{"table":"groups","columns":[{"name":"id","type":"uuid"},{"name":"name","type":"text"}]},{"table":"group_members","columns":[{"name":"id","type":"uuid"},{"name":"group_id","type":"uuid"},{"name":"user_id","type":"uuid"},{"name":"display_name","type":"text"},{"name":"role","type":"text"}]},{"table":"group_progress_privacy","columns":[{"name":"user_id","type":"uuid"},{"name":"share_progress","type":"boolean"}]},{"table":"cardio_sessions","columns":[{"name":"user_id","type":"uuid"},{"name":"activity_id","type":"uuid"},{"name":"performed_at","type":"timestamp with time zone"},{"name":"tracking_mode","type":"text"},{"name":"duration_seconds","type":"numeric"},{"name":"distance","type":"numeric"},{"name":"distance_unit","type":"public.distance_unit"}]},{"table":"cardio_activities","columns":[{"name":"id","type":"uuid"},{"name":"user_id","type":"uuid"},{"name":"name","type":"text"}]}]$prerequisites$::jsonb) loop
    v_table := to_regclass('public.'||(v_spec->>'table'));
    if v_table is null then raise exception '014 prerequisite table missing: public.%',v_spec->>'table'; end if;
    for v_col in select value from jsonb_array_elements(v_spec->'columns') loop
      if to_regtype(v_col->>'type') is null or not exists(
        select 1 from pg_catalog.pg_attribute where attrelid=v_table and attname=v_col->>'name'
          and not attisdropped and attnum>0 and atttypid=to_regtype(v_col->>'type') and atttypmod=-1
      ) then raise exception '014 prerequisite column missing/incompatible: %.%',v_spec->>'table',v_col->>'name'; end if;
    end loop;
  end loop;
  if (select prorettype from pg_catalog.pg_proc where oid=to_regprocedure('auth.uid()'))<>'uuid'::regtype
    or (select prorettype from pg_catalog.pg_proc where oid=to_regprocedure('public.is_group_member(uuid)'))<>'boolean'::regtype then
    raise exception '014 prerequisite incompatible: auth/group helper result types';
  end if;
  if not exists(select 1 from pg_catalog.pg_attribute where attrelid='auth.users'::regclass and attname='id' and atttypid='uuid'::regtype and attnotnull and not attisdropped)
    or exists(select 1 from pg_catalog.pg_class where oid in ('public.strength_sets'::regclass,'public.strength_workouts'::regclass) and not relrowsecurity) then
    raise exception '014 prerequisite missing: auth.users.id UUID or existing Strength RLS';
  end if;
  if to_regprocedure('public.save_strength_workout(jsonb,jsonb)') is null
    or to_regprocedure('public.private_group_summary(uuid,text,text,text)') is null then
    raise exception '014 prerequisite missing: post-013 save/group RPC signatures';
  end if;

  -- Locks last only for this atomic statement. They do not provide cross-editor guarantees.
  lock table public.strength_sets in share row exclusive mode;
  if to_regclass('public.strength_drop_sets') is not null then
    if not exists(select 1 from pg_catalog.pg_class where oid=to_regclass('public.strength_drop_sets') and relkind='r') then
      raise exception '014 incompatible strength_drop_sets: not an ordinary table';
    end if;
    lock table public.strength_drop_sets in share row exclusive mode;
  end if;
  -- Complete catalog-only preflight before the first permanent schema mutation.
  foreach v_phase in array array['preflight','install','postflight'] loop

    v_drop := to_regclass('public.strength_drop_sets');
    if v_drop is null then
      if v_phase='postflight' then raise exception '014 postflight: strength_drop_sets missing'; end if;
      if v_phase='install' then
        create table public.strength_drop_sets (
          id uuid not null default gen_random_uuid(),
          parent_set_id uuid not null,
          user_id uuid not null,
          workout_id uuid not null,
          exercise_id uuid not null,
          tracking_type public.exercise_tracking_type not null default 'repetitions',
          drop_order integer not null,
          weight numeric,
          weight_unit public.weight_unit not null default 'lb',
          reps numeric not null,
          created_at timestamptz not null default now()
        );
        v_drop := 'public.strength_drop_sets'::regclass;
      end if;
    elsif not exists(select 1 from pg_catalog.pg_class where oid=v_drop and relkind='r' and relpersistence='p' and not relispartition)
      or exists(select 1 from pg_catalog.pg_inherits where inhrelid=v_drop or inhparent=v_drop)
      or exists(select 1 from pg_catalog.pg_class where oid=v_drop and relowner in (v_authenticated,v_anon)) then
      raise exception '014 incompatible strength_drop_sets: expected a permanent ordinary table without inheritance';
    end if;

    if v_drop is not null then
      -- Unexpected columns are not silently accepted or removed.
      if exists(select 1 from pg_catalog.pg_attribute a where a.attrelid=v_drop and a.attnum>0 and not a.attisdropped
        and not exists(select 1 from jsonb_array_elements(v_columns) e where e->>'name'=a.attname)) then
        raise exception '014 incompatible strength_drop_sets: unexpected column; review manually';
      end if;
      execute 'select exists(select 1 from public.strength_drop_sets)' into v_populated;
      for v_col in select value from jsonb_array_elements(v_columns) loop
        select a.*,pg_get_expr(d.adbin,d.adrelid) as default_expression into v_attribute
        from pg_catalog.pg_attribute a left join pg_catalog.pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
        where a.attrelid=v_drop and a.attname=v_col->>'name' and a.attnum>0 and not a.attisdropped;
        if not found then
          if v_phase='postflight' or v_populated then
            raise exception '014 missing column %: cannot add to a populated table or pass postflight',v_col->>'name';
          end if;
          if v_phase='install' then execute format('alter table public.strength_drop_sets add column %I %s',v_col->>'name',v_col->>'ddl'); end if;
        else
          v_expression := regexp_replace(regexp_replace(v_attribute.default_expression,'(public|pg_catalog)\.','','g'),'[[:space:]]','','g');
          v_expected := regexp_replace(v_col->>'default','[[:space:]]','','g');
          if v_attribute.atttypid<>to_regtype(v_col->>'type') or v_attribute.atttypmod<>-1
            or v_attribute.attnotnull<>(v_col->>'notnull')::boolean or v_attribute.attidentity<>'' or v_attribute.attgenerated<>''
            or v_expression is distinct from v_expected then
            raise exception '014 incompatible column %: type, nullability, identity/generated status or default differs',v_col->>'name';
          end if;
        end if;
      end loop;
    end if;

    -- Each named constraint is checked through pg_constraint, including ordered keys.
    for v_spec in select value from jsonb_array_elements(v_constraints) loop
      v_table := to_regclass('public.'||(v_spec->>'table'));
      select * into v_constraint from pg_catalog.pg_constraint where conrelid=v_table and conname=v_spec->>'name';
      if not found then
        if v_phase='postflight' then raise exception '014 postflight: missing constraint %',v_spec->>'name'; end if;
        if v_spec->>'kind' in ('p','u') and to_regclass('public.'||(v_spec->>'name')) is not null then
          raise exception '014 conflicting backing-index name without required constraint: %',v_spec->>'name';
        end if;
        if v_spec->>'kind'='p' and exists(select 1 from pg_catalog.pg_constraint where conrelid=v_table and contype='p') then
          raise exception '014 incompatible primary key already exists on %',v_spec->>'table';
        end if;
        if v_phase='install' then execute format('alter table public.%I add constraint %I %s',v_spec->>'table',v_spec->>'name',v_spec->>'ddl'); end if;
      else
        if v_constraint.contype::text<>v_spec->>'kind' or not v_constraint.convalidated
          or v_constraint.condeferrable or v_constraint.condeferred or not v_constraint.conislocal or v_constraint.coninhcount<>0
          or (v_spec->>'kind'='c' and v_constraint.connoinherit) then
          raise exception '014 incompatible constraint type/validation/deferral: %',v_spec->>'name';
        end if;
        if v_spec->>'kind' in ('p','u','f') then
          select array_agg(a.attnum order by x.ordinality) into v_expected_cols
          from jsonb_array_elements_text(v_spec->'cols') with ordinality x(name,ordinality)
          left join pg_catalog.pg_attribute a on a.attrelid=v_table and a.attname=x.name and not a.attisdropped;
          if v_constraint.conkey is distinct from v_expected_cols then
            raise exception '014 incompatible ordered constraint columns: %',v_spec->>'name';
          end if;
        end if;
        if v_spec->>'kind' in ('p','u') and not exists(
          select 1 from pg_catalog.pg_index where indexrelid=v_constraint.conindid and indisunique and indisvalid and indisready
            and indimmediate and indexprs is null and indpred is null
        ) then raise exception '014 incompatible constraint backing index: %',v_spec->>'name'; end if;
        if v_spec->>'kind'='f' then
          select array_agg(a.attnum order by x.ordinality) into v_expected_refs
          from jsonb_array_elements_text(v_spec->'refcols') with ordinality x(name,ordinality)
          left join pg_catalog.pg_attribute a on a.attrelid=to_regclass(v_spec->>'target') and a.attname=x.name and not a.attisdropped;
          if v_constraint.confrelid is distinct from to_regclass(v_spec->>'target') or v_constraint.confkey is distinct from v_expected_refs
            or v_constraint.confdeltype::text<>v_spec->>'delete' or v_constraint.confupdtype::text<>v_spec->>'update' or v_constraint.confmatchtype<>'s' then
            raise exception '014 incompatible ownership foreign key target/columns/cascades: %',v_spec->>'name';
          end if;
        elsif v_spec->>'kind'='c' then
          -- Cast/format normalization plus Boolean-tree topology prevents accepting regrouped AND/OR checks.
          v_expression := pg_get_expr(v_constraint.conbin,v_constraint.conrelid);
          -- Fold ONLY the exact safe-integer literal's lossless bigint cast.
          -- Never strip bigint casts from columns or other expressions (they can round reps).
          v_expression := regexp_replace(v_expression,'''9007199254740991''[[:space:]]*::[[:space:]]*(pg_catalog\.)?(bigint|int8)\y','9007199254740991','g');
          v_expression := regexp_replace(v_expression,'::[[:space:]]*((public|pg_catalog)\.)?(numeric|text|exercise_tracking_type)\y','','g');
          v_expression := regexp_replace(v_expression,'[[:space:]()]','','g');
          -- PostgreSQL deparses large numeric constants with quotes.
          v_expression := replace(v_expression,'''9007199254740991''','9007199254740991');
          v_expected := regexp_replace(v_spec->>'expr','[[:space:]()]','','g');
          select coalesce(array_agg(m.parts[1] order by m.ordinality),array[]::text[]) into v_boolops
          from regexp_matches(v_constraint.conbin::text,':boolop (and|or|not)','g') with ordinality m(parts,ordinality);
          select array_agg(e.value order by e.ordinality) into v_names
          from jsonb_array_elements_text(v_spec->'boolops') with ordinality e(value,ordinality);
          if v_expression is distinct from v_expected or v_boolops is distinct from coalesce(v_names,array[]::text[]) then
            raise exception '014 incompatible check expression: % (%)',v_spec->>'name',pg_get_expr(v_constraint.conbin,v_constraint.conrelid);
          end if;
        end if;
      end if;
    end loop;

    v_oid := to_regclass('public.strength_drop_user_parent_idx');
    if v_oid is null then
      if v_phase='postflight' then raise exception '014 postflight: required index missing'; end if;
      if v_phase='install' then create index strength_drop_user_parent_idx on public.strength_drop_sets(user_id,parent_set_id); end if;
    else
      select i.*,c.relam,am.amname into v_index from pg_catalog.pg_index i
      join pg_catalog.pg_class c on c.oid=i.indexrelid join pg_catalog.pg_am am on am.oid=c.relam where i.indexrelid=v_oid;
      if not found then raise exception '014 conflicting index name: not an index'; end if;
      select array_agg(a.attname::text order by k.ordinality) into v_names
      from unnest(v_index.indkey::smallint[]) with ordinality k(num,ordinality)
      left join pg_catalog.pg_attribute a on a.attrelid=v_drop and a.attnum=k.num;
      if v_index.indrelid is distinct from v_drop or v_names is distinct from array['user_id','parent_set_id']::text[]
        or v_index.amname<>'btree' or v_index.indisunique or not v_index.indisvalid or not v_index.indisready
        or v_index.indnatts<>2 or v_index.indnkeyatts<>2 or v_index.indexprs is not null or v_index.indpred is not null
        or exists(select 1 from unnest(v_index.indoption::smallint[]) x where x<>0)
        or exists(select 1 from unnest(v_index.indcollation::oid[]) x where x<>0)
        or exists(select 1 from unnest(v_index.indclass::oid[]) x join pg_catalog.pg_opclass o on o.oid=x where o.opcname<>'uuid_ops' or not o.opcdefault) then
        raise exception '014 incompatible strength_drop_user_parent_idx definition';
      end if;
    end if;

    for v_spec in select value from jsonb_array_elements(v_policies) loop
      select * into v_policy from pg_catalog.pg_policy where polrelid=v_drop and polname=v_spec->>'name';
      if not found then
        if v_phase='postflight' then raise exception '014 postflight: missing policy %',v_spec->>'name'; end if;
        if v_phase='install' then execute format('create policy %I on public.strength_drop_sets for %s to authenticated %s',v_spec->>'name',v_spec->>'op',v_spec->>'gate'); end if;
      else
        if v_policy.polcmd::text<>v_spec->>'cmd' or not v_policy.polpermissive or v_policy.polroles<>array[v_authenticated] then
          raise exception '014 incompatible policy command/roles: %',v_spec->>'name';
        end if;
        v_expression := regexp_replace(pg_get_expr(v_policy.polqual,v_drop),'[[:space:]]','','g');
        v_expected := case when v_spec->>'cmd' in ('r','w','d') then '(user_id=auth.uid())' else null end;
        if v_expression is distinct from v_expected then raise exception '014 incompatible policy USING: %',v_spec->>'name'; end if;
        v_expression := regexp_replace(pg_get_expr(v_policy.polwithcheck,v_drop),'[[:space:]]','','g');
        v_expected := case when v_spec->>'cmd' in ('a','w') then '(user_id=auth.uid())' else null end;
        if v_expression is distinct from v_expected then raise exception '014 incompatible policy WITH CHECK: %',v_spec->>'name'; end if;
      end if;
    end loop;
    -- Preserve unrelated policies; refuse ones that would undermine the owned-row contract.
    for v_policy in select * from pg_catalog.pg_policy where polrelid=v_drop
      and polname not in ('strength_drop_select','strength_drop_insert','strength_drop_update','strength_drop_delete') loop
      foreach v_role in array v_policy.polroles loop
        if v_role=0 then
          raise exception '014 unrelated policy targets PUBLIC: %; review without modifying it',v_policy.polname;
        end if;
        if pg_has_role('anon',v_role,'MEMBER') then
          raise exception '014 unrelated policy exposes drop table to public/anon: %; review without modifying it',v_policy.polname;
        end if;
        if v_policy.polpermissive and pg_has_role('authenticated',v_role,'MEMBER') then
          if (v_policy.polcmd in ('r','w','d','*') and regexp_replace(pg_get_expr(v_policy.polqual,v_drop),'[[:space:]]','','g') is distinct from '(user_id=auth.uid())')
            or (v_policy.polcmd in ('a','w','*') and regexp_replace(pg_get_expr(v_policy.polwithcheck,v_drop),'[[:space:]]','','g') is distinct from '(user_id=auth.uid())') then
            raise exception '014 unrelated policy weakens ownership: %; review without modifying it',v_policy.polname;
          end if;
        end if;
      end loop;
    end loop;

    for v_spec in select value from jsonb_array_elements(v_functions) loop
      v_oid := to_regprocedure(v_spec->>'sig');
      if v_oid is null then
        if v_phase='postflight' then raise exception '014 postflight: missing function %',v_spec->>'sig'; end if;
      else
        select * into v_proc from pg_catalog.pg_proc where oid=v_oid;
        select array_agg(value) into v_names from jsonb_array_elements_text(v_spec->'args');
        if v_proc.prokind<>'f' or v_proc.proretset or v_proc.prorettype<>to_regtype(v_spec->>'result')
          or v_proc.proargnames is distinct from v_names or v_proc.proargmodes is not null
          or v_proc.proowner in (v_authenticated,v_anon) then
          raise exception '014 incompatible function signature/owner: %',v_spec->>'sig';
        end if;
        if v_phase='postflight' and (v_proc.prosecdef<>(v_spec->>'definer')::boolean
          or v_proc.proconfig is distinct from array['search_path=""']::text[]
          or (select lanname from pg_catalog.pg_language where oid=v_proc.prolang)<>'plpgsql') then
          raise exception '014 postflight: function security/search_path/language differs: %',v_spec->>'sig';
        end if;
      end if;
    end loop;


    if v_phase='install' then
      if not exists(select 1 from pg_catalog.pg_class where oid=v_drop and relrowsecurity) then
        alter table public.strength_drop_sets enable row level security;
      end if;
      execute $definition_0$create or replace function public.enforce_strength_drop_load_mode() returns trigger language plpgsql set search_path='' as $$
declare v_mode text;
begin
  select load_mode into v_mode from public.exercises where id=new.exercise_id and user_id=new.user_id;
  if v_mode='reps_only' and new.weight is not null then raise exception 'Reps-only drop cannot store weight'; end if;
  if v_mode='weight_reps' and new.weight is null then raise exception 'Weight + Reps drop requires weight'; end if;
  return new;
end $$;$definition_0$;
      execute $definition_1$create or replace function public.save_strength_workout(p_workout jsonb, p_sets jsonb)
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
  v_drop jsonb;
  v_drop_created jsonb;
  v_drop_id uuid;
  v_drop_ids uuid[] := array[]::uuid[];
  v_parent_ids uuid[] := array[]::uuid[];
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_sets is null or jsonb_typeof(p_sets) <> 'array' or jsonb_array_length(p_sets) = 0 then raise exception 'At least one set is required'; end if;

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
    -- A repeated parent ID must never overwrite another payload group.
    v_set_id := nullif(v_set ->> 'id','')::uuid;
    if v_set_id is not null and v_set_id=any(v_parent_ids) then raise exception 'Duplicate main set ID'; end if;
    -- Validate child IDs before removing anything; RLS also applies to every statement.
    if v_set ? 'drop_sets' then
      if jsonb_typeof(v_set->'drop_sets') <> 'array' then raise exception 'Drop sets must be an array'; end if;
      for v_drop in select value from jsonb_array_elements(v_set->'drop_sets') loop
        v_drop_id := nullif(v_drop->>'id','')::uuid;
        if v_drop_id is not null then
          if v_drop_id=any(v_drop_ids) or not exists(select 1 from public.strength_drop_sets where id=v_drop_id and parent_set_id=v_set_id and user_id=v_user_id and workout_id=v_workout_id) then raise exception 'Drop set not found or duplicate ID'; end if;
          v_drop_ids := array_append(v_drop_ids,v_drop_id);
        end if;
      end loop;
      select coalesce(jsonb_object_agg(id::text,created_at),'{}'::jsonb) into v_drop_created
      from public.strength_drop_sets where parent_set_id=v_set_id and user_id=v_user_id;
      -- Remove before a compatible exercise/load-mode change. IDs are restored below.
      delete from public.strength_drop_sets where parent_set_id=v_set_id and user_id=v_user_id;
    end if;
    if v_set_id is null then
      insert into public.strength_sets(user_id,workout_id,exercise_id,set_order,tracking_type,weight,weight_unit,reps,load,distance,distance_unit,laps,duration_seconds,notes)
      values(v_user_id,v_workout_id,(v_set->>'exercise_id')::uuid,(v_set->>'set_order')::integer,(v_set->>'tracking_type')::public.exercise_tracking_type,
        nullif(v_set->>'weight','')::numeric,coalesce(nullif(v_set->>'weight_unit','')::public.weight_unit,'lb'),nullif(v_set->>'reps','')::numeric,nullif(v_set->>'load','')::numeric,nullif(v_set->>'distance','')::numeric,
        nullif(v_set->>'distance_unit','')::public.distance_unit,nullif(v_set->>'laps','')::numeric,nullif(v_set->>'duration_seconds','')::numeric,nullif(trim(v_set->>'notes'),''))
      returning id into v_set_id;
    else
      update public.strength_sets set exercise_id=(v_set->>'exercise_id')::uuid,set_order=(v_set->>'set_order')::integer,tracking_type=(v_set->>'tracking_type')::public.exercise_tracking_type,
        weight_unit=coalesce(nullif(v_set->>'weight_unit','')::public.weight_unit,'lb'),weight=nullif(v_set->>'weight','')::numeric,reps=nullif(v_set->>'reps','')::numeric,load=nullif(v_set->>'load','')::numeric,distance=nullif(v_set->>'distance','')::numeric,
        distance_unit=nullif(v_set->>'distance_unit','')::public.distance_unit,laps=nullif(v_set->>'laps','')::numeric,duration_seconds=nullif(v_set->>'duration_seconds','')::numeric,notes=nullif(trim(v_set->>'notes'),'')
      where id=v_set_id and workout_id=v_workout_id and user_id=v_user_id;
      get diagnostics v_rows = row_count;
      if v_rows <> 1 then raise exception 'Set not found'; end if;
    end if;
    v_parent_ids := array_append(v_parent_ids,v_set_id);
    if v_set ? 'drop_sets' then
      for v_drop in select value from jsonb_array_elements(v_set->'drop_sets') loop
        insert into public.strength_drop_sets(id,parent_set_id,user_id,workout_id,exercise_id,tracking_type,drop_order,weight,weight_unit,reps,created_at)
        values(coalesce(nullif(v_drop->>'id','')::uuid,gen_random_uuid()),v_set_id,v_user_id,v_workout_id,(v_set->>'exercise_id')::uuid,
          (v_set->>'tracking_type')::public.exercise_tracking_type,(v_drop->>'drop_order')::integer,
          nullif(v_drop->>'weight','')::numeric,coalesce(nullif(v_drop->>'weight_unit','')::public.weight_unit,'lb'),(v_drop->>'reps')::numeric,coalesce((v_drop_created->>(v_drop->>'id'))::timestamptz,now()));
      end loop;
    end if;
    v_keep_ids := array_append(v_keep_ids,v_set_id);
  end loop;
  delete from public.strength_sets where workout_id=v_workout_id and user_id=v_user_id and not(id=any(v_keep_ids));
  return v_workout_id;
end;
$$;$definition_1$;
      execute $definition_2$create or replace function public.private_group_summary(p_group_id uuid,p_period text default 'month',p_timezone text default 'UTC',p_activity text default '') returns jsonb
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
  where member_row.group_id=p_group_id and member_row.user_id=any(v_eligible) and (set_row.tracking_type='distance' or set_row.reps>0) and workout_row.performed_at>=v_start and workout_row.performed_at<=v_now
  group by member_row.id,2
 ) select coalesce(jsonb_agg(to_jsonb(counted)),'[]') into v_sets from counted;
 -- Mirror the exclusive client PR pipeline. Canonical comparison grid = 0.000001 kg.
 with source as (
  select member_row.id member_id,set_row.id,set_row.exercise_id,set_row.workout_id,set_row.main_order,set_row.drop_order,workout_row.performed_at,workout_row.created_at,set_row.reps,exercise_row.progression_direction,
   case when set_row.weight is null then null else round(set_row.weight*case when set_row.weight_unit='kg' then 1 else 0.45359237 end,6) end kg
  from public.group_members member_row join (
    select id,user_id,workout_id,exercise_id,tracking_type,weight,weight_unit,reps,set_order::bigint main_order,0 drop_order from public.strength_sets
    union all
    select d.id,d.user_id,d.workout_id,d.exercise_id,d.tracking_type,d.weight,d.weight_unit,d.reps,m.set_order::bigint,d.drop_order
    from public.strength_drop_sets d join public.strength_sets m on m.id=d.parent_set_id and m.user_id=d.user_id
  ) set_row on set_row.user_id=member_row.user_id
  join public.strength_workouts workout_row on workout_row.id=set_row.workout_id and workout_row.user_id=set_row.user_id
  join public.exercises exercise_row on exercise_row.id=set_row.exercise_id and exercise_row.user_id=set_row.user_id
  where member_row.group_id=p_group_id and member_row.user_id=any(v_eligible) and set_row.tracking_type='repetitions' and set_row.reps>0 and (exercise_row.progression_direction<>'lower_is_better' or set_row.weight is not null) and workout_row.performed_at<=v_now
 ), evidence as (
  select *,first_value(workout_id) over chronology first_workout,first_value(id) over chronology first_set,
   min(kg) over (partition by member_id,exercise_id order by performed_at,created_at,main_order,drop_order,id rows between unbounded preceding and 1 preceding) prior_assistance,
   max(kg) over (partition by member_id,exercise_id order by performed_at,created_at,main_order,drop_order,id rows between unbounded preceding and 1 preceding) prior_weight,
   max(reps) over (partition by member_id,exercise_id,kg order by performed_at,created_at,main_order,drop_order,id rows between unbounded preceding and 1 preceding) prior_reps
  from source window chronology as (partition by member_id,exercise_id order by performed_at,created_at,main_order,drop_order,id)
 ), events as (
  select *,case when (progression_direction='lower_is_better' and id=first_set) or (progression_direction='higher_is_better' and workout_id=first_workout) then null when kg is not null and ((progression_direction='lower_is_better' and prior_assistance is not null and kg<prior_assistance) or (progression_direction='higher_is_better' and prior_weight is not null and kg>prior_weight)) then 'weight' when prior_reps is not null and reps>prior_reps then 'reps' else null end achievement from evidence
 ), counts as (
  select member_id,count(*) filter(where achievement='weight') weight_prs,count(*) filter(where achievement='reps') rep_prs
  from events where performed_at>=v_month group by member_id
 ) select coalesce(jsonb_agg(to_jsonb(counts)),'[]') into v_prs from counts;
 with entries as (
  select member_row.id member_id,lower(regexp_replace(trim(activity_row.name),'\s+',' ','g')) activity,session_row.duration_seconds,
   case when session_row.distance is null then null else session_row.distance*case session_row.distance_unit when 'meters' then 1 when 'kilometers' then 1000 when 'miles' then 1609.344 when 'yards' then 0.9144 when 'feet' then 0.3048 else null end end meters
  from public.group_members member_row join public.cardio_sessions session_row on session_row.user_id=member_row.user_id
  join public.cardio_activities activity_row on activity_row.id=session_row.activity_id and activity_row.user_id=session_row.user_id
  where member_row.group_id=p_group_id and member_row.user_id=any(v_eligible) and session_row.tracking_mode='timed' and session_row.performed_at>=v_start and session_row.performed_at<=v_now
 ), counts as (
  select member_id,activity,count(*) entries,sum(coalesce(duration_seconds,0)) duration_seconds,sum(meters) distance_meters,count(meters) distance_entries
  from entries where p_activity='' or activity=p_activity group by member_id,activity
 ) select coalesce(jsonb_agg(to_jsonb(counts)),'[]') into v_cardio from counts;
 select coalesce(jsonb_agg(activity order by activity),'[]') into v_activities from (
  select distinct lower(regexp_replace(trim(activity_row.name),'\s+',' ','g')) activity from public.group_members member_row
  join public.cardio_sessions session_row on session_row.user_id=member_row.user_id join public.cardio_activities activity_row on activity_row.id=session_row.activity_id and activity_row.user_id=session_row.user_id
  where member_row.group_id=p_group_id and member_row.user_id=any(v_eligible) and session_row.tracking_mode='timed' and session_row.performed_at>=v_start and session_row.performed_at<=v_now
 ) names;
 return jsonb_build_object('name',v_name,'timezone',p_timezone,'period_start',v_start,'month_start',v_month,'through',v_now,'members',v_members,'sets',v_sets,'prs',v_prs,'cardio',v_cardio,'activities',v_activities);
end $$;$definition_2$;
      -- The known trigger is replaced atomically inside this one DO statement.
      drop trigger if exists strength_drop_load_mode on public.strength_drop_sets;
      create trigger strength_drop_load_mode before insert or update on public.strength_drop_sets
        for each row execute function public.enforce_strength_drop_load_mode();
      -- Remove table AND column ACL leakage; grant only required CRUD, never grant options.
      revoke all on public.strength_drop_sets from public,anon,authenticated;
      select string_agg(quote_ident(attname),',' order by attnum) into v_expression
        from pg_catalog.pg_attribute where attrelid=v_drop and attnum>0 and not attisdropped;
      execute format('revoke all privileges (%s) on table public.strength_drop_sets from public,anon,authenticated',v_expression);
      grant select,insert,update,delete on public.strength_drop_sets to authenticated;
      revoke all on function public.enforce_strength_drop_load_mode() from public,anon,authenticated;
      revoke all on function public.save_strength_workout(jsonb,jsonb) from public,anon,authenticated;
      grant execute on function public.save_strength_workout(jsonb,jsonb) to authenticated;
      revoke all on function public.private_group_summary(uuid,text,text,text) from public,anon,authenticated;
      grant execute on function public.private_group_summary(uuid,text,text,text) to authenticated;
    end if;

  end loop;

  -- Explicit, independently rerunnable postflight assertions; no shared state or writes.
  if not exists(select 1 from pg_catalog.pg_class where oid=v_drop and relrowsecurity) then
    raise exception '014 postflight: RLS is not enabled';
  end if;
  if (select count(*) from pg_catalog.pg_policy where polrelid=v_drop
    and polname in ('strength_drop_select','strength_drop_insert','strength_drop_update','strength_drop_delete'))<>4 then
    raise exception '014 postflight: expected four known policies';
  end if;
  if not exists(select 1 from pg_catalog.pg_trigger where tgrelid=v_drop and tgname='strength_drop_load_mode'
    and not tgisinternal and tgfoid=to_regprocedure('public.enforce_strength_drop_load_mode()')
    and tgtype=23 and tgenabled='O' and tgnargs=0 and tgqual is null and tgattr=''::int2vector) then
    raise exception '014 postflight: load-mode trigger definition differs';
  end if;
  foreach v_privilege in array array['SELECT','INSERT','UPDATE','DELETE'] loop
    if not has_table_privilege('authenticated',v_drop,v_privilege) then
      raise exception '014 postflight: authenticated missing %',v_privilege;
    end if;
    if has_table_privilege('authenticated',v_drop,v_privilege||' WITH GRANT OPTION') then
      raise exception '014 postflight: inherited authenticated table grant option %',v_privilege;
    end if;
  end loop;
  foreach v_privilege in array array['TRUNCATE','REFERENCES','TRIGGER'] loop
    if has_table_privilege('authenticated',v_drop,v_privilege) then
      raise exception '014 postflight: authenticated has excess privilege %',v_privilege;
    end if;
  end loop;
  if has_any_column_privilege('authenticated',v_drop,'REFERENCES')
    or has_any_column_privilege('authenticated',v_drop,'SELECT WITH GRANT OPTION,INSERT WITH GRANT OPTION,UPDATE WITH GRANT OPTION,REFERENCES WITH GRANT OPTION')
    or has_table_privilege('anon',v_drop,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or has_any_column_privilege('anon',v_drop,'SELECT,INSERT,UPDATE,REFERENCES')
    or exists(select 1 from pg_catalog.pg_class c, lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
      where c.oid=v_drop and (a.grantee=0 or (a.grantee=v_authenticated and a.is_grantable)))
    or exists(select 1 from pg_catalog.pg_attribute c,lateral aclexplode(c.attacl) a
      where c.attrelid=v_drop and (a.grantee in (0,v_anon) or (a.grantee=v_authenticated and a.is_grantable))) then
    raise exception '014 postflight: public/anon table or column access, or authenticated grant option';
  end if;
  for v_spec in select value from jsonb_array_elements(v_functions) loop
    v_oid := to_regprocedure(v_spec->>'sig');
    if has_function_privilege('authenticated',v_oid,'EXECUTE WITH GRANT OPTION')
      or has_function_privilege('anon',v_oid,'EXECUTE')
      or has_function_privilege('authenticated',v_oid,'EXECUTE')<>(v_spec->>'execute')::boolean
      or exists(select 1 from pg_catalog.pg_proc p,lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
        where p.oid=v_oid and (a.grantee=0 or (a.grantee=v_authenticated and a.is_grantable))) then
      raise exception '014 postflight: function privileges differ: %',v_spec->>'sig';
    end if;
  end loop;
  raise notice 'Migration 014 postflight passed: columns, constraints, index, RLS, policies, trigger, functions and privileges verified';

END
$migration_014$;

DO $postflight_014$
DECLARE
  v_columns constant jsonb := $contract$[{"name":"id","type":"uuid","notnull":true,"default":"gen_random_uuid()","ddl":"uuid not null default gen_random_uuid()"},
{"name":"parent_set_id","type":"uuid","notnull":true,"default":null,"ddl":"uuid not null"},
{"name":"user_id","type":"uuid","notnull":true,"default":null,"ddl":"uuid not null"},
{"name":"workout_id","type":"uuid","notnull":true,"default":null,"ddl":"uuid not null"},
{"name":"exercise_id","type":"uuid","notnull":true,"default":null,"ddl":"uuid not null"},
{"name":"tracking_type","type":"public.exercise_tracking_type","notnull":true,"default":"'repetitions'::exercise_tracking_type","ddl":"public.exercise_tracking_type not null default 'repetitions'"},
{"name":"drop_order","type":"integer","notnull":true,"default":null,"ddl":"integer not null"},
{"name":"weight","type":"numeric","notnull":false,"default":null,"ddl":"numeric"},
{"name":"weight_unit","type":"public.weight_unit","notnull":true,"default":"'lb'::weight_unit","ddl":"public.weight_unit not null default 'lb'"},
{"name":"reps","type":"numeric","notnull":true,"default":null,"ddl":"numeric not null"},
{"name":"created_at","type":"timestamp with time zone","notnull":true,"default":"now()","ddl":"timestamptz not null default now()"}]$contract$::jsonb;
  v_constraints constant jsonb := $contract$[{"table":"strength_sets","name":"strength_main_drop_owner_key","kind":"u","cols":["id","user_id","workout_id","exercise_id","tracking_type"],"ddl":"unique(id,user_id,workout_id,exercise_id,tracking_type)"},
{"table":"strength_drop_sets","name":"strength_drop_sets_pkey","kind":"p","cols":["id"],"ddl":"primary key(id)"},
{"table":"strength_drop_sets","name":"strength_drop_sets_user_id_fkey","kind":"f","cols":["user_id"],"target":"auth.users","refcols":["id"],"delete":"c","update":"a","ddl":"foreign key(user_id) references auth.users(id) on delete cascade"},
{"table":"strength_drop_sets","name":"strength_drop_sets_tracking_type_check","kind":"c","expr":"tracking_type='repetitions'","boolops":[],"ddl":"check(tracking_type='repetitions')"},
{"table":"strength_drop_sets","name":"strength_drop_sets_drop_order_check","kind":"c","expr":"drop_order>0","boolops":[],"ddl":"check(drop_order>0)"},
{"table":"strength_drop_sets","name":"strength_drop_sets_weight_check","kind":"c","expr":"weightISNULLORweight>=0ANDweight<>ALLARRAY['NaN','Infinity','-Infinity']","boolops":["or","and"],"ddl":"check(weight is null or (weight>=0 and weight::text not in ('NaN','Infinity','-Infinity')))"},
{"table":"strength_drop_sets","name":"strength_drop_sets_reps_check","kind":"c","expr":"reps>=0ANDreps<=9007199254740991ANDreps=truncrepsANDreps<>ALLARRAY['NaN','Infinity','-Infinity']","boolops":["and"],"ddl":"check(reps>=0 and reps<=9007199254740991 and reps=trunc(reps) and reps::text not in ('NaN','Infinity','-Infinity'))"},
{"table":"strength_drop_sets","name":"strength_drop_sets_parent_set_id_drop_order_key","kind":"u","cols":["parent_set_id","drop_order"],"ddl":"unique(parent_set_id,drop_order)"},
{"table":"strength_drop_sets","name":"strength_drop_parent_owned_fk","kind":"f","cols":["parent_set_id","user_id","workout_id","exercise_id","tracking_type"],"target":"public.strength_sets","refcols":["id","user_id","workout_id","exercise_id","tracking_type"],"delete":"c","update":"c","ddl":"foreign key(parent_set_id,user_id,workout_id,exercise_id,tracking_type) references public.strength_sets(id,user_id,workout_id,exercise_id,tracking_type) on delete cascade on update cascade"}]$contract$::jsonb;
  v_policies constant jsonb := $contract$[{"name":"strength_drop_select","cmd":"r","op":"select","gate":"using(user_id=auth.uid())"},
{"name":"strength_drop_insert","cmd":"a","op":"insert","gate":"with check(user_id=auth.uid())"},
{"name":"strength_drop_update","cmd":"w","op":"update","gate":"using(user_id=auth.uid()) with check(user_id=auth.uid())"},
{"name":"strength_drop_delete","cmd":"d","op":"delete","gate":"using(user_id=auth.uid())"}]$contract$::jsonb;
  v_functions constant jsonb := $contract$[{"sig":"public.enforce_strength_drop_load_mode()","result":"trigger","args":[],"definer":false,"execute":false},
{"sig":"public.save_strength_workout(jsonb,jsonb)","result":"uuid","args":["p_workout","p_sets"],"definer":false,"execute":true},
{"sig":"public.private_group_summary(uuid,text,text,text)","result":"jsonb","args":["p_group_id","p_period","p_timezone","p_activity"],"definer":true,"execute":true}]$contract$::jsonb;

  v_phase text;
  v_spec jsonb;
  v_col jsonb;
  v_table oid;
  v_drop oid;
  v_constraint pg_catalog.pg_constraint%rowtype;
  v_attribute record;
  v_proc record;
  v_policy pg_catalog.pg_policy%rowtype;
  v_index record;
  v_expected_cols smallint[];
  v_expected_refs smallint[];
  v_names text[];
  v_boolops text[];
  v_expression text;
  v_expected text;
  v_populated boolean;
  v_role oid;
  v_oid oid;
  v_privilege text;
  v_authenticated oid := to_regrole('authenticated');
  v_anon oid := to_regrole('anon');

BEGIN
  v_phase := 'postflight';

  -- READ-ONLY prerequisite assertions. No DDL or row writes precede these checks.
  if v_authenticated is null or v_anon is null or to_regclass('auth.users') is null
    or to_regprocedure('auth.uid()') is null or to_regclass('pg_catalog.pg_timezone_names') is null
    or to_regprocedure('public.is_group_member(uuid)') is null then
    raise exception '014 prerequisite missing: Supabase auth/roles, timezone catalog or group membership helper';
  end if;
  for v_spec in select value from jsonb_array_elements($prerequisites$[{"table":"strength_workouts","columns":[{"name":"id","type":"uuid"},{"name":"user_id","type":"uuid"},{"name":"performed_at","type":"timestamp with time zone"},{"name":"created_at","type":"timestamp with time zone"},{"name":"location_id","type":"uuid"},{"name":"notes","type":"text"},{"name":"duration_seconds","type":"numeric"}]},{"table":"strength_sets","columns":[{"name":"id","type":"uuid"},{"name":"user_id","type":"uuid"},{"name":"workout_id","type":"uuid"},{"name":"exercise_id","type":"uuid"},{"name":"set_order","type":"integer"},{"name":"tracking_type","type":"public.exercise_tracking_type"},{"name":"weight","type":"numeric"},{"name":"weight_unit","type":"public.weight_unit"},{"name":"reps","type":"numeric"},{"name":"load","type":"numeric"},{"name":"distance","type":"numeric"},{"name":"distance_unit","type":"public.distance_unit"},{"name":"laps","type":"numeric"},{"name":"duration_seconds","type":"numeric"},{"name":"notes","type":"text"}]},{"table":"exercises","columns":[{"name":"id","type":"uuid"},{"name":"user_id","type":"uuid"},{"name":"load_mode","type":"text"},{"name":"progression_direction","type":"text"},{"name":"major_muscle_group","type":"text"}]},{"table":"groups","columns":[{"name":"id","type":"uuid"},{"name":"name","type":"text"}]},{"table":"group_members","columns":[{"name":"id","type":"uuid"},{"name":"group_id","type":"uuid"},{"name":"user_id","type":"uuid"},{"name":"display_name","type":"text"},{"name":"role","type":"text"}]},{"table":"group_progress_privacy","columns":[{"name":"user_id","type":"uuid"},{"name":"share_progress","type":"boolean"}]},{"table":"cardio_sessions","columns":[{"name":"user_id","type":"uuid"},{"name":"activity_id","type":"uuid"},{"name":"performed_at","type":"timestamp with time zone"},{"name":"tracking_mode","type":"text"},{"name":"duration_seconds","type":"numeric"},{"name":"distance","type":"numeric"},{"name":"distance_unit","type":"public.distance_unit"}]},{"table":"cardio_activities","columns":[{"name":"id","type":"uuid"},{"name":"user_id","type":"uuid"},{"name":"name","type":"text"}]}]$prerequisites$::jsonb) loop
    v_table := to_regclass('public.'||(v_spec->>'table'));
    if v_table is null then raise exception '014 prerequisite table missing: public.%',v_spec->>'table'; end if;
    for v_col in select value from jsonb_array_elements(v_spec->'columns') loop
      if to_regtype(v_col->>'type') is null or not exists(
        select 1 from pg_catalog.pg_attribute where attrelid=v_table and attname=v_col->>'name'
          and not attisdropped and attnum>0 and atttypid=to_regtype(v_col->>'type') and atttypmod=-1
      ) then raise exception '014 prerequisite column missing/incompatible: %.%',v_spec->>'table',v_col->>'name'; end if;
    end loop;
  end loop;
  if (select prorettype from pg_catalog.pg_proc where oid=to_regprocedure('auth.uid()'))<>'uuid'::regtype
    or (select prorettype from pg_catalog.pg_proc where oid=to_regprocedure('public.is_group_member(uuid)'))<>'boolean'::regtype then
    raise exception '014 prerequisite incompatible: auth/group helper result types';
  end if;
  if not exists(select 1 from pg_catalog.pg_attribute where attrelid='auth.users'::regclass and attname='id' and atttypid='uuid'::regtype and attnotnull and not attisdropped)
    or exists(select 1 from pg_catalog.pg_class where oid in ('public.strength_sets'::regclass,'public.strength_workouts'::regclass) and not relrowsecurity) then
    raise exception '014 prerequisite missing: auth.users.id UUID or existing Strength RLS';
  end if;
  if to_regprocedure('public.save_strength_workout(jsonb,jsonb)') is null
    or to_regprocedure('public.private_group_summary(uuid,text,text,text)') is null then
    raise exception '014 prerequisite missing: post-013 save/group RPC signatures';
  end if;


    v_drop := to_regclass('public.strength_drop_sets');
    if v_drop is null then
      if v_phase='postflight' then raise exception '014 postflight: strength_drop_sets missing'; end if;
      
    elsif not exists(select 1 from pg_catalog.pg_class where oid=v_drop and relkind='r' and relpersistence='p' and not relispartition)
      or exists(select 1 from pg_catalog.pg_inherits where inhrelid=v_drop or inhparent=v_drop)
      or exists(select 1 from pg_catalog.pg_class where oid=v_drop and relowner in (v_authenticated,v_anon)) then
      raise exception '014 incompatible strength_drop_sets: expected a permanent ordinary table without inheritance';
    end if;

    if v_drop is not null then
      -- Unexpected columns are not silently accepted or removed.
      if exists(select 1 from pg_catalog.pg_attribute a where a.attrelid=v_drop and a.attnum>0 and not a.attisdropped
        and not exists(select 1 from jsonb_array_elements(v_columns) e where e->>'name'=a.attname)) then
        raise exception '014 incompatible strength_drop_sets: unexpected column; review manually';
      end if;
      execute 'select exists(select 1 from public.strength_drop_sets)' into v_populated;
      for v_col in select value from jsonb_array_elements(v_columns) loop
        select a.*,pg_get_expr(d.adbin,d.adrelid) as default_expression into v_attribute
        from pg_catalog.pg_attribute a left join pg_catalog.pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
        where a.attrelid=v_drop and a.attname=v_col->>'name' and a.attnum>0 and not a.attisdropped;
        if not found then
          if v_phase='postflight' or v_populated then
            raise exception '014 missing column %: cannot add to a populated table or pass postflight',v_col->>'name';
          end if;
          
        else
          v_expression := regexp_replace(regexp_replace(v_attribute.default_expression,'(public|pg_catalog)\.','','g'),'[[:space:]]','','g');
          v_expected := regexp_replace(v_col->>'default','[[:space:]]','','g');
          if v_attribute.atttypid<>to_regtype(v_col->>'type') or v_attribute.atttypmod<>-1
            or v_attribute.attnotnull<>(v_col->>'notnull')::boolean or v_attribute.attidentity<>'' or v_attribute.attgenerated<>''
            or v_expression is distinct from v_expected then
            raise exception '014 incompatible column %: type, nullability, identity/generated status or default differs',v_col->>'name';
          end if;
        end if;
      end loop;
    end if;

    -- Each named constraint is checked through pg_constraint, including ordered keys.
    for v_spec in select value from jsonb_array_elements(v_constraints) loop
      v_table := to_regclass('public.'||(v_spec->>'table'));
      select * into v_constraint from pg_catalog.pg_constraint where conrelid=v_table and conname=v_spec->>'name';
      if not found then
        if v_phase='postflight' then raise exception '014 postflight: missing constraint %',v_spec->>'name'; end if;
        if v_spec->>'kind' in ('p','u') and to_regclass('public.'||(v_spec->>'name')) is not null then
          raise exception '014 conflicting backing-index name without required constraint: %',v_spec->>'name';
        end if;
        if v_spec->>'kind'='p' and exists(select 1 from pg_catalog.pg_constraint where conrelid=v_table and contype='p') then
          raise exception '014 incompatible primary key already exists on %',v_spec->>'table';
        end if;
        
      else
        if v_constraint.contype::text<>v_spec->>'kind' or not v_constraint.convalidated
          or v_constraint.condeferrable or v_constraint.condeferred or not v_constraint.conislocal or v_constraint.coninhcount<>0
          or (v_spec->>'kind'='c' and v_constraint.connoinherit) then
          raise exception '014 incompatible constraint type/validation/deferral: %',v_spec->>'name';
        end if;
        if v_spec->>'kind' in ('p','u','f') then
          select array_agg(a.attnum order by x.ordinality) into v_expected_cols
          from jsonb_array_elements_text(v_spec->'cols') with ordinality x(name,ordinality)
          left join pg_catalog.pg_attribute a on a.attrelid=v_table and a.attname=x.name and not a.attisdropped;
          if v_constraint.conkey is distinct from v_expected_cols then
            raise exception '014 incompatible ordered constraint columns: %',v_spec->>'name';
          end if;
        end if;
        if v_spec->>'kind' in ('p','u') and not exists(
          select 1 from pg_catalog.pg_index where indexrelid=v_constraint.conindid and indisunique and indisvalid and indisready
            and indimmediate and indexprs is null and indpred is null
        ) then raise exception '014 incompatible constraint backing index: %',v_spec->>'name'; end if;
        if v_spec->>'kind'='f' then
          select array_agg(a.attnum order by x.ordinality) into v_expected_refs
          from jsonb_array_elements_text(v_spec->'refcols') with ordinality x(name,ordinality)
          left join pg_catalog.pg_attribute a on a.attrelid=to_regclass(v_spec->>'target') and a.attname=x.name and not a.attisdropped;
          if v_constraint.confrelid is distinct from to_regclass(v_spec->>'target') or v_constraint.confkey is distinct from v_expected_refs
            or v_constraint.confdeltype::text<>v_spec->>'delete' or v_constraint.confupdtype::text<>v_spec->>'update' or v_constraint.confmatchtype<>'s' then
            raise exception '014 incompatible ownership foreign key target/columns/cascades: %',v_spec->>'name';
          end if;
        elsif v_spec->>'kind'='c' then
          -- Cast/format normalization plus Boolean-tree topology prevents accepting regrouped AND/OR checks.
          v_expression := pg_get_expr(v_constraint.conbin,v_constraint.conrelid);
          -- Fold ONLY the exact safe-integer literal's lossless bigint cast.
          -- Never strip bigint casts from columns or other expressions (they can round reps).
          v_expression := regexp_replace(v_expression,'''9007199254740991''[[:space:]]*::[[:space:]]*(pg_catalog\.)?(bigint|int8)\y','9007199254740991','g');
          v_expression := regexp_replace(v_expression,'::[[:space:]]*((public|pg_catalog)\.)?(numeric|text|exercise_tracking_type)\y','','g');
          v_expression := regexp_replace(v_expression,'[[:space:]()]','','g');
          -- PostgreSQL deparses large numeric constants with quotes.
          v_expression := replace(v_expression,'''9007199254740991''','9007199254740991');
          v_expected := regexp_replace(v_spec->>'expr','[[:space:]()]','','g');
          select coalesce(array_agg(m.parts[1] order by m.ordinality),array[]::text[]) into v_boolops
          from regexp_matches(v_constraint.conbin::text,':boolop (and|or|not)','g') with ordinality m(parts,ordinality);
          select array_agg(e.value order by e.ordinality) into v_names
          from jsonb_array_elements_text(v_spec->'boolops') with ordinality e(value,ordinality);
          if v_expression is distinct from v_expected or v_boolops is distinct from coalesce(v_names,array[]::text[]) then
            raise exception '014 incompatible check expression: % (%)',v_spec->>'name',pg_get_expr(v_constraint.conbin,v_constraint.conrelid);
          end if;
        end if;
      end if;
    end loop;

    v_oid := to_regclass('public.strength_drop_user_parent_idx');
    if v_oid is null then
      if v_phase='postflight' then raise exception '014 postflight: required index missing'; end if;
      
    else
      select i.*,c.relam,am.amname into v_index from pg_catalog.pg_index i
      join pg_catalog.pg_class c on c.oid=i.indexrelid join pg_catalog.pg_am am on am.oid=c.relam where i.indexrelid=v_oid;
      if not found then raise exception '014 conflicting index name: not an index'; end if;
      select array_agg(a.attname::text order by k.ordinality) into v_names
      from unnest(v_index.indkey::smallint[]) with ordinality k(num,ordinality)
      left join pg_catalog.pg_attribute a on a.attrelid=v_drop and a.attnum=k.num;
      if v_index.indrelid is distinct from v_drop or v_names is distinct from array['user_id','parent_set_id']::text[]
        or v_index.amname<>'btree' or v_index.indisunique or not v_index.indisvalid or not v_index.indisready
        or v_index.indnatts<>2 or v_index.indnkeyatts<>2 or v_index.indexprs is not null or v_index.indpred is not null
        or exists(select 1 from unnest(v_index.indoption::smallint[]) x where x<>0)
        or exists(select 1 from unnest(v_index.indcollation::oid[]) x where x<>0)
        or exists(select 1 from unnest(v_index.indclass::oid[]) x join pg_catalog.pg_opclass o on o.oid=x where o.opcname<>'uuid_ops' or not o.opcdefault) then
        raise exception '014 incompatible strength_drop_user_parent_idx definition';
      end if;
    end if;

    for v_spec in select value from jsonb_array_elements(v_policies) loop
      select * into v_policy from pg_catalog.pg_policy where polrelid=v_drop and polname=v_spec->>'name';
      if not found then
        if v_phase='postflight' then raise exception '014 postflight: missing policy %',v_spec->>'name'; end if;
        
      else
        if v_policy.polcmd::text<>v_spec->>'cmd' or not v_policy.polpermissive or v_policy.polroles<>array[v_authenticated] then
          raise exception '014 incompatible policy command/roles: %',v_spec->>'name';
        end if;
        v_expression := regexp_replace(pg_get_expr(v_policy.polqual,v_drop),'[[:space:]]','','g');
        v_expected := case when v_spec->>'cmd' in ('r','w','d') then '(user_id=auth.uid())' else null end;
        if v_expression is distinct from v_expected then raise exception '014 incompatible policy USING: %',v_spec->>'name'; end if;
        v_expression := regexp_replace(pg_get_expr(v_policy.polwithcheck,v_drop),'[[:space:]]','','g');
        v_expected := case when v_spec->>'cmd' in ('a','w') then '(user_id=auth.uid())' else null end;
        if v_expression is distinct from v_expected then raise exception '014 incompatible policy WITH CHECK: %',v_spec->>'name'; end if;
      end if;
    end loop;
    -- Preserve unrelated policies; refuse ones that would undermine the owned-row contract.
    for v_policy in select * from pg_catalog.pg_policy where polrelid=v_drop
      and polname not in ('strength_drop_select','strength_drop_insert','strength_drop_update','strength_drop_delete') loop
      foreach v_role in array v_policy.polroles loop
        if v_role=0 then
          raise exception '014 unrelated policy targets PUBLIC: %; review without modifying it',v_policy.polname;
        end if;
        if pg_has_role('anon',v_role,'MEMBER') then
          raise exception '014 unrelated policy exposes drop table to public/anon: %; review without modifying it',v_policy.polname;
        end if;
        if v_policy.polpermissive and pg_has_role('authenticated',v_role,'MEMBER') then
          if (v_policy.polcmd in ('r','w','d','*') and regexp_replace(pg_get_expr(v_policy.polqual,v_drop),'[[:space:]]','','g') is distinct from '(user_id=auth.uid())')
            or (v_policy.polcmd in ('a','w','*') and regexp_replace(pg_get_expr(v_policy.polwithcheck,v_drop),'[[:space:]]','','g') is distinct from '(user_id=auth.uid())') then
            raise exception '014 unrelated policy weakens ownership: %; review without modifying it',v_policy.polname;
          end if;
        end if;
      end loop;
    end loop;

    for v_spec in select value from jsonb_array_elements(v_functions) loop
      v_oid := to_regprocedure(v_spec->>'sig');
      if v_oid is null then
        if v_phase='postflight' then raise exception '014 postflight: missing function %',v_spec->>'sig'; end if;
      else
        select * into v_proc from pg_catalog.pg_proc where oid=v_oid;
        select array_agg(value) into v_names from jsonb_array_elements_text(v_spec->'args');
        if v_proc.prokind<>'f' or v_proc.proretset or v_proc.prorettype<>to_regtype(v_spec->>'result')
          or v_proc.proargnames is distinct from v_names or v_proc.proargmodes is not null
          or v_proc.proowner in (v_authenticated,v_anon) then
          raise exception '014 incompatible function signature/owner: %',v_spec->>'sig';
        end if;
        if v_phase='postflight' and (v_proc.prosecdef<>(v_spec->>'definer')::boolean
          or v_proc.proconfig is distinct from array['search_path=""']::text[]
          or (select lanname from pg_catalog.pg_language where oid=v_proc.prolang)<>'plpgsql') then
          raise exception '014 postflight: function security/search_path/language differs: %',v_spec->>'sig';
        end if;
      end if;
    end loop;


  -- Explicit, independently rerunnable postflight assertions; no shared state or writes.
  if not exists(select 1 from pg_catalog.pg_class where oid=v_drop and relrowsecurity) then
    raise exception '014 postflight: RLS is not enabled';
  end if;
  if (select count(*) from pg_catalog.pg_policy where polrelid=v_drop
    and polname in ('strength_drop_select','strength_drop_insert','strength_drop_update','strength_drop_delete'))<>4 then
    raise exception '014 postflight: expected four known policies';
  end if;
  if not exists(select 1 from pg_catalog.pg_trigger where tgrelid=v_drop and tgname='strength_drop_load_mode'
    and not tgisinternal and tgfoid=to_regprocedure('public.enforce_strength_drop_load_mode()')
    and tgtype=23 and tgenabled='O' and tgnargs=0 and tgqual is null and tgattr=''::int2vector) then
    raise exception '014 postflight: load-mode trigger definition differs';
  end if;
  foreach v_privilege in array array['SELECT','INSERT','UPDATE','DELETE'] loop
    if not has_table_privilege('authenticated',v_drop,v_privilege) then
      raise exception '014 postflight: authenticated missing %',v_privilege;
    end if;
    if has_table_privilege('authenticated',v_drop,v_privilege||' WITH GRANT OPTION') then
      raise exception '014 postflight: inherited authenticated table grant option %',v_privilege;
    end if;
  end loop;
  foreach v_privilege in array array['TRUNCATE','REFERENCES','TRIGGER'] loop
    if has_table_privilege('authenticated',v_drop,v_privilege) then
      raise exception '014 postflight: authenticated has excess privilege %',v_privilege;
    end if;
  end loop;
  if has_any_column_privilege('authenticated',v_drop,'REFERENCES')
    or has_any_column_privilege('authenticated',v_drop,'SELECT WITH GRANT OPTION,INSERT WITH GRANT OPTION,UPDATE WITH GRANT OPTION,REFERENCES WITH GRANT OPTION')
    or has_table_privilege('anon',v_drop,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or has_any_column_privilege('anon',v_drop,'SELECT,INSERT,UPDATE,REFERENCES')
    or exists(select 1 from pg_catalog.pg_class c, lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
      where c.oid=v_drop and (a.grantee=0 or (a.grantee=v_authenticated and a.is_grantable)))
    or exists(select 1 from pg_catalog.pg_attribute c,lateral aclexplode(c.attacl) a
      where c.attrelid=v_drop and (a.grantee in (0,v_anon) or (a.grantee=v_authenticated and a.is_grantable))) then
    raise exception '014 postflight: public/anon table or column access, or authenticated grant option';
  end if;
  for v_spec in select value from jsonb_array_elements(v_functions) loop
    v_oid := to_regprocedure(v_spec->>'sig');
    if has_function_privilege('authenticated',v_oid,'EXECUTE WITH GRANT OPTION')
      or has_function_privilege('anon',v_oid,'EXECUTE')
      or has_function_privilege('authenticated',v_oid,'EXECUTE')<>(v_spec->>'execute')::boolean
      or exists(select 1 from pg_catalog.pg_proc p,lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
        where p.oid=v_oid and (a.grantee=0 or (a.grantee=v_authenticated and a.is_grantable))) then
      raise exception '014 postflight: function privileges differ: %',v_spec->>'sig';
    end if;
  end loop;
  raise notice 'Migration 014 postflight passed: columns, constraints, index, RLS, policies, trigger, functions and privileges verified';

END
$postflight_014$;
