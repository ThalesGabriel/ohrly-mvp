-- Wizard-of-Oz helper for design-partner research.
-- Run in the Supabase SQL Editor with administrative privileges.
-- Replace the two UUIDs below. This intentionally creates only one suggestion per current Episode.
-- No free text is stored.

with selected as (
  select
    current_ep.id as current_episode_id,
    current_ep.user_id,
    precedent_ep.id as precedent_episode_id
  from public.episodes current_ep
  join public.episodes precedent_ep on precedent_ep.id = 'PRECEDENT_EPISODE_UUID'::uuid
  where current_ep.id = 'CURRENT_EPISODE_UUID'::uuid
    and current_ep.user_id = precedent_ep.user_id
    and current_ep.account_id is not null
    and precedent_ep.account_id is not null
    and current_ep.account_id <> precedent_ep.account_id
    and precedent_ep.closed_at is not null
    and exists (
      select 1 from public.reviews r
      where r.episode_id = precedent_ep.id
        and r.outcome <> 'too_early'
    )
)
insert into public.episode_precedent_suggestions (
  user_id,
  current_episode_id,
  precedent_episode_id,
  origin,
  evidence_codes,
  rank_score,
  matcher_version
)
select
  user_id,
  current_episode_id,
  precedent_episode_id,
  'research',
  array['same_change_type','similar_trajectory']::text[],
  null,
  'research-trajectory-v1'
from selected
on conflict (current_episode_id) do nothing;
