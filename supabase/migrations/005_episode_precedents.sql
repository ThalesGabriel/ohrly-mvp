-- Ohrly MVP v0.2.2 — Cross-account precedents
-- A precedent is NOT a domain relationship and does not assert that two cases are the same.
-- It records that an earlier, completed Episode from another Account was surfaced as
-- potentially useful context for the decision in the current Episode.
--
-- Privacy: no free text or matched terms are stored here. The heuristic may inspect local-only
-- text in the browser, but Supabase receives only categorical evidence codes and feedback.

create table if not exists public.episode_precedent_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  current_episode_id uuid not null references public.episodes(id) on delete cascade,
  precedent_episode_id uuid not null references public.episodes(id) on delete cascade,
  origin text not null check (origin in ('heuristic','research')),
  evidence_codes text[] not null default '{}'::text[] check (
    evidence_codes <@ array['same_change_type','shared_context_terms','same_intervention_type','same_age_bucket']::text[]
  ),
  rank_score numeric(5,4) null check (rank_score is null or (rank_score >= 0 and rank_score <= 1)),
  matcher_version text not null,
  presented_at timestamptz null,
  feedback text null check (
    feedback is null
    or feedback in ('not_relevant','context_only','changed_investigation','changed_timing','changed_action')
  ),
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  check (current_episode_id <> precedent_episode_id),
  unique (current_episode_id)
);

create index if not exists idx_episode_precedent_suggestions_user_created
  on public.episode_precedent_suggestions(user_id, created_at desc);

create index if not exists idx_episode_precedent_suggestions_precedent
  on public.episode_precedent_suggestions(precedent_episode_id);

alter table public.episode_precedent_suggestions enable row level security;

drop policy if exists "episode_precedents_owner_select" on public.episode_precedent_suggestions;
drop policy if exists "episode_precedents_owner_insert" on public.episode_precedent_suggestions;
drop policy if exists "episode_precedents_owner_update" on public.episode_precedent_suggestions;
drop policy if exists "episode_precedents_owner_delete" on public.episode_precedent_suggestions;

create policy "episode_precedents_owner_select" on public.episode_precedent_suggestions
  for select using (auth.uid() = user_id);

create policy "episode_precedents_owner_insert" on public.episode_precedent_suggestions
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.episodes current_ep
      join public.episodes precedent_ep on precedent_ep.id = precedent_episode_id
      where current_ep.id = current_episode_id
        and current_ep.user_id = auth.uid()
        and precedent_ep.user_id = auth.uid()
        and current_ep.account_id is not null
        and precedent_ep.account_id is not null
        and current_ep.account_id <> precedent_ep.account_id
        and precedent_ep.closed_at is not null
        and exists (
          select 1
          from public.reviews r
          where r.episode_id = precedent_ep.id
            and r.user_id = auth.uid()
            and r.outcome <> 'too_early'
        )
    )
  );

create policy "episode_precedents_owner_update" on public.episode_precedent_suggestions
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.episodes current_ep
      join public.episodes precedent_ep on precedent_ep.id = precedent_episode_id
      where current_ep.id = current_episode_id
        and current_ep.user_id = auth.uid()
        and precedent_ep.user_id = auth.uid()
        and current_ep.account_id is not null
        and precedent_ep.account_id is not null
        and current_ep.account_id <> precedent_ep.account_id
        and precedent_ep.closed_at is not null
    )
  );

create policy "episode_precedents_owner_delete" on public.episode_precedent_suggestions
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.episode_precedent_suggestions to authenticated;
