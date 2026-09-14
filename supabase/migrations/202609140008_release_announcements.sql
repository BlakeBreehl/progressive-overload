-- Forward-only release acknowledgement storage. Apply manually; never backfill existing rows.
begin;
create table public.release_announcements (
  user_id uuid not null references auth.users(id) on delete cascade,
  release_id text not null check (length(release_id) between 1 and 100),
  seen_at timestamptz not null default now(),
  primary key (user_id, release_id)
);
alter table public.release_announcements enable row level security;
revoke all on public.release_announcements from anon, authenticated;
grant select, insert on public.release_announcements to authenticated;
create policy "Read own release acknowledgements" on public.release_announcements
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Acknowledge own release" on public.release_announcements
  for insert to authenticated with check ((select auth.uid()) = user_id);
commit;
