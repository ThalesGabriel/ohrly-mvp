-- Ohrly Field MVP — Episode Workspace
-- Adds the minimum structured persistence required by the single-page cycle timeline.
-- Free-text context for updates remains only in the browser (localStorage).

alter table public.interventions
  add column if not exists execution_updated_at timestamptz null;

create table if not exists public.episode_updates (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.episodes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  update_type text not null check (update_type in ('customer_replied','meeting_happened','new_signal','exception','note')),
  created_at timestamptz not null default now()
);

create index if not exists idx_episode_updates_episode_created
  on public.episode_updates(episode_id, created_at asc);

alter table public.episode_updates enable row level security;

drop policy if exists "episode_updates_owner_select" on public.episode_updates;
drop policy if exists "episode_updates_owner_insert" on public.episode_updates;
drop policy if exists "episode_updates_owner_update" on public.episode_updates;
drop policy if exists "episode_updates_owner_delete" on public.episode_updates;

create policy "episode_updates_owner_select" on public.episode_updates
  for select using (auth.uid() = user_id);

create policy "episode_updates_owner_insert" on public.episode_updates
  for insert with check (
    auth.uid() = user_id
    and exists(select 1 from public.episodes e where e.id = episode_id and e.user_id = auth.uid())
  );

create policy "episode_updates_owner_update" on public.episode_updates
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "episode_updates_owner_delete" on public.episode_updates
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.episode_updates to authenticated;
