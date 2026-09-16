-- Ohrly MVP v0.2 — Episode Continuity
-- A closed episode remains an immutable record of that cycle.
-- When something happens later, a new episode can be linked to the prior cycle as:
--   continuation: the prior case was not really over
--   recurrence: the problem had recovered / been closed and returned
--   related: a different situation where the prior episode still matters as context

create table if not exists public.episode_relationships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_episode_id uuid not null references public.episodes(id) on delete cascade,
  target_episode_id uuid not null references public.episodes(id) on delete cascade,
  relationship_type text not null check (relationship_type in ('continuation','recurrence','related')),
  created_at timestamptz not null default now(),
  check (source_episode_id <> target_episode_id),
  unique (source_episode_id, target_episode_id)
);

create index if not exists idx_episode_relationships_user_created
  on public.episode_relationships(user_id, created_at desc);

create index if not exists idx_episode_relationships_source
  on public.episode_relationships(source_episode_id);

create index if not exists idx_episode_relationships_target
  on public.episode_relationships(target_episode_id);

alter table public.episode_relationships enable row level security;

drop policy if exists "episode_relationships_owner_select" on public.episode_relationships;
drop policy if exists "episode_relationships_owner_insert" on public.episode_relationships;
drop policy if exists "episode_relationships_owner_update" on public.episode_relationships;
drop policy if exists "episode_relationships_owner_delete" on public.episode_relationships;

create policy "episode_relationships_owner_select" on public.episode_relationships
  for select using (auth.uid() = user_id);

create policy "episode_relationships_owner_insert" on public.episode_relationships
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.episodes source
      join public.episodes target on target.id = target_episode_id
      where source.id = source_episode_id
        and source.user_id = auth.uid()
        and target.user_id = auth.uid()
        and source.account_id is not null
        and source.account_id = target.account_id
    )
  );

create policy "episode_relationships_owner_update" on public.episode_relationships
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.episodes source
      join public.episodes target on target.id = target_episode_id
      where source.id = source_episode_id
        and source.user_id = auth.uid()
        and target.user_id = auth.uid()
        and source.account_id is not null
        and source.account_id = target.account_id
    )
  );

create policy "episode_relationships_owner_delete" on public.episode_relationships
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.episode_relationships to authenticated;
