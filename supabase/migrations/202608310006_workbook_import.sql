-- Forward-only authenticated workbook import provenance. Do not run migrations 001-005 again.
create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null check (char_length(filename) between 1 and 255),
  file_checksum text not null check (char_length(file_checksum) = 64),
  parser_version text not null,
  status text not null default 'previewed' check (status in ('previewed','importing','completed','failed','rolled_back')),
  counts jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  rolled_back_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id,user_id)
);

create unique index import_batches_completed_checksum
  on public.import_batches(user_id,file_checksum)
  where status = 'completed';

create table public.import_source_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  import_batch_id uuid not null,
  source_key text not null,
  record_kind text not null check (record_kind in ('daily','monthly','yearly','morning_weight','evening_weight','exercise')),
  record_id uuid,
  created_at timestamptz not null default now(),
  foreign key (import_batch_id,user_id) references public.import_batches(id,user_id) on delete cascade,
  unique (user_id,source_key)
);

alter table public.strength_workouts add column import_batch_id uuid;
alter table public.historical_strength_records add column import_batch_id uuid;
alter table public.weigh_ins add column import_batch_id uuid;

alter table public.strength_workouts add constraint strength_workouts_import_batch_owned_fk
  foreign key (import_batch_id,user_id) references public.import_batches(id,user_id) on delete restrict;
alter table public.historical_strength_records add constraint historical_strength_import_batch_owned_fk
  foreign key (import_batch_id,user_id) references public.import_batches(id,user_id) on delete restrict;
alter table public.weigh_ins add constraint weigh_ins_import_batch_owned_fk
  foreign key (import_batch_id,user_id) references public.import_batches(id,user_id) on delete restrict;

alter table public.import_batches enable row level security;
alter table public.import_source_items enable row level security;

create policy import_batches_select_own on public.import_batches for select to authenticated using ((select auth.uid())=user_id);
create policy import_batches_insert_own on public.import_batches for insert to authenticated with check ((select auth.uid())=user_id);
create policy import_batches_update_own on public.import_batches for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy import_batches_delete_own on public.import_batches for delete to authenticated using ((select auth.uid())=user_id);
create policy import_source_items_select_own on public.import_source_items for select to authenticated using ((select auth.uid())=user_id);
create policy import_source_items_insert_own on public.import_source_items for insert to authenticated with check ((select auth.uid())=user_id);
create policy import_source_items_update_own on public.import_source_items for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy import_source_items_delete_own on public.import_source_items for delete to authenticated using ((select auth.uid())=user_id);

create trigger import_batches_updated_at before update on public.import_batches
for each row execute function public.set_updated_at();

create or replace function public.rollback_workbook_import(p_batch_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_user uuid := auth.uid(); v_counts jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.import_batches where id=p_batch_id and user_id=v_user and status in ('completed','failed')) then
    raise exception 'Import batch is not available for rollback';
  end if;
  with deleted as (delete from public.strength_workouts where import_batch_id=p_batch_id and user_id=v_user returning id)
    select jsonb_build_object('daily',count(*)) into v_counts from deleted;
  with deleted as (delete from public.historical_strength_records where import_batch_id=p_batch_id and user_id=v_user returning id)
    select v_counts||jsonb_build_object('historical',count(*)) into v_counts from deleted;
  with deleted as (delete from public.weigh_ins where import_batch_id=p_batch_id and user_id=v_user returning id)
    select v_counts||jsonb_build_object('weigh_ins',count(*)) into v_counts from deleted;
  delete from public.import_source_items where import_batch_id=p_batch_id and user_id=v_user;
  update public.import_batches set status='rolled_back',rolled_back_at=now(),counts=counts||jsonb_build_object('rollback',v_counts) where id=p_batch_id and user_id=v_user;
  return v_counts;
end $$;

revoke all on function public.rollback_workbook_import(uuid) from public;
grant execute on function public.rollback_workbook_import(uuid) to authenticated;

create index import_batches_user_created on public.import_batches(user_id,created_at desc);
create index import_source_items_batch on public.import_source_items(user_id,import_batch_id);
