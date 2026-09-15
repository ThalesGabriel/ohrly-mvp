-- Ohrly Field MVP — queries de validação
-- Rode no SQL Editor do Supabase com acesso administrativo.

-- 1) Funil principal por usuário
with per_user as (
  select
    user_id,
    count(*) filter (where event_name = 'episode_created') as episodes_created,
    count(*) filter (where event_name = 'intervention_created') as interventions_created,
    count(*) filter (where event_name = 'execution_updated' and properties->>'execution_state' = 'executed') as executions_confirmed,
    count(*) filter (where event_name = 'episode_reviewed') as reviews_created,
    count(*) filter (where event_name = 'episode_closed') as episodes_closed
  from public.telemetry_events
  group by user_id
)
select
  count(*) filter (where episodes_created > 0) as users_created_episode,
  count(*) filter (where interventions_created > 0) as users_created_intervention,
  count(*) filter (where executions_confirmed > 0) as users_confirmed_execution,
  count(*) filter (where reviews_created > 0) as users_returned_for_review,
  count(*) filter (where episodes_closed > 0) as users_closed_cycle,
  count(*) filter (where episodes_created >= 2) as users_created_second_episode
from per_user;

-- 2) Closed Loop Completion Rate
with actionable as (
  select count(*)::numeric as n from public.episodes where initial_state = 'act'
), closed as (
  select count(*)::numeric as n from public.episodes where closed_at is not null
)
select
  actionable.n as actionable_episodes,
  closed.n as closed_episodes,
  case when actionable.n = 0 then null else round((closed.n / actionable.n) * 100, 1) end as closed_loop_completion_pct
from actionable, closed;

-- 3) Outcomes / maturidade observada
select outcome, count(*) as reviews
from public.reviews
group by outcome
order by reviews desc;

-- 4) Impacto percebido na decisão
select decision_impact, count(*) as reviews
from public.reviews
group by decision_impact
order by reviews desc;

-- 5) Persistência percebida antes do registro
select age_bucket, count(*) as episodes
from public.episodes
group by age_bucket
order by episodes desc;

-- 6) Conversão episode -> intervention
select
  count(distinct e.id) as episodes,
  count(distinct i.episode_id) as episodes_with_intervention,
  round(100.0 * count(distinct i.episode_id) / nullif(count(distinct e.id), 0), 1) as intervention_rate_pct
from public.episodes e
left join public.interventions i on i.episode_id = e.id;

-- 7) Execution Reality: planejado, executado, exceção
select execution_state, count(*) as interventions
from public.interventions
group by execution_state
order by interventions desc;

-- 8) Atualizações intermediárias — o mundo real cabe no modelo?
select update_type, count(*) as updates
from public.episode_updates
group by update_type
order by updates desc;

-- 9) Segundo episódio — sinal inicial de recorrência de uso
select
  count(*) as users_with_any_episode,
  count(*) filter (where episode_count >= 2) as users_with_second_episode,
  round(100.0 * count(*) filter (where episode_count >= 2) / nullif(count(*), 0), 1) as second_episode_rate_pct
from (
  select user_id, count(*) as episode_count
  from public.episodes
  group by user_id
) x;
