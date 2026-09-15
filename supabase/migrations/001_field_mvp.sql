-- Ohrly Field MVP
-- Privacy model:
--   * Supabase stores structured categorical data only.
--   * Aliases, free-text notes and intervention objective text stay in localStorage.
--   * Users authenticate with Supabase Anonymous Sign-Ins; auth.uid() gates every row with RLS.

create extension if not exists pgcrypto;

create table if not exists public.episodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  change_type text not null check (change_type in ('engagement_drop','key_user_silence','onboarding_delay','support_friction','relationship_change','other')),
  age_bucket text not null check (age_bucket in ('lt_3d','3_7d','7_14d','gt_14d')),
  initial_state text not null check (initial_state in ('watch','investigate','act')),
  created_at timestamptz not null default now(),
  closed_at timestamptz null
);

create table if not exists public.interventions (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.episodes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  intervention_type text not null check (intervention_type in ('csm_contact','review_meeting','internal_escalation','onboarding_adjustment','other')),
  owner_role text not null default 'CSM responsável',
  execution_deadline_hours integer not null default 24 check (execution_deadline_hours > 0),
  review_window_days integer not null default 7 check (review_window_days > 0),
  execution_state text not null default 'planned' check (execution_state in ('planned','executed','exception')),
  executed_at timestamptz null,
  exception_type text null,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references public.interventions(id) on delete cascade,
  episode_id uuid not null references public.episodes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  outcome text not null check (outcome in ('recovered','partial_recovery','no_change','worsened','relapse','too_early')),
  decision_impact text not null check (decision_impact in ('acted_earlier','waited_for_more_evidence','changed_intervention','noticed_intervention_failed','noticed_recovery','avoided_unnecessary_action','maybe','none')),
  created_at timestamptz not null default now()
);

create table if not exists public.telemetry_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null,
  episode_id uuid null references public.episodes(id) on delete set null,
  intervention_id uuid null references public.interventions(id) on delete set null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_episodes_user_created on public.episodes(user_id, created_at desc);
create index if not exists idx_interventions_episode_created on public.interventions(episode_id, created_at desc);
create index if not exists idx_reviews_intervention_created on public.reviews(intervention_id, created_at desc);
create index if not exists idx_telemetry_user_created on public.telemetry_events(user_id, created_at desc);

alter table public.episodes enable row level security;
alter table public.interventions enable row level security;
alter table public.reviews enable row level security;
alter table public.telemetry_events enable row level security;

create policy "episodes_owner_select" on public.episodes for select using (auth.uid() = user_id);
create policy "episodes_owner_insert" on public.episodes for insert with check (auth.uid() = user_id);
create policy "episodes_owner_update" on public.episodes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "episodes_owner_delete" on public.episodes for delete using (auth.uid() = user_id);

create policy "interventions_owner_select" on public.interventions for select using (auth.uid() = user_id);
create policy "interventions_owner_insert" on public.interventions for insert with check (
  auth.uid() = user_id and exists(select 1 from public.episodes e where e.id = episode_id and e.user_id = auth.uid())
);
create policy "interventions_owner_update" on public.interventions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "interventions_owner_delete" on public.interventions for delete using (auth.uid() = user_id);

create policy "reviews_owner_select" on public.reviews for select using (auth.uid() = user_id);
create policy "reviews_owner_insert" on public.reviews for insert with check (
  auth.uid() = user_id and exists(select 1 from public.episodes e where e.id = episode_id and e.user_id = auth.uid())
);
create policy "reviews_owner_update" on public.reviews for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "reviews_owner_delete" on public.reviews for delete using (auth.uid() = user_id);

create policy "telemetry_owner_select" on public.telemetry_events for select using (auth.uid() = user_id);
create policy "telemetry_owner_insert" on public.telemetry_events for insert with check (auth.uid() = user_id);
create policy "telemetry_owner_delete" on public.telemetry_events for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.episodes to authenticated;
grant select, insert, update, delete on public.interventions to authenticated;
grant select, insert, update, delete on public.reviews to authenticated;
grant select, insert, delete on public.telemetry_events to authenticated;
