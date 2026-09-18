-- Ohrly MVP v0.1 — OPTIONAL DEMO SEED
-- Use apenas se você quiser testar a tela de contas em um ambiente sem episódios.
--
-- PRÉ-REQUISITO:
-- Importe primeiro ohrly_test_accounts.csv pela UI.
--
-- O seed roda APENAS para o user_id informado abaixo e usa
-- as 20 contas mais recentes desse usuário.
-- Ele é propositalmente para DEV/TESTE. Não execute em produção.
--
-- Antes de rodar:
-- 1) Descubra seu UUID:
--    select id, email from auth.users order by created_at desc;
-- 2) Substitua SEU_USER_ID_AQUI pelo UUID da sua conta.

do $$
declare
  -- IMPORTANTE: substitua pelo UUID da SUA conta antes de executar.
  v_user_id uuid := 'SEU_USER_ID_AQUI'::uuid;

  v_accounts uuid[];
  v_account_count integer;
begin
  if v_user_id is null then
    raise exception 'user_id não informado.';
  end if;

  if not exists (
    select 1
    from auth.users u
    where u.id = v_user_id
  ) then
    raise exception 'user_id % não existe em auth.users.', v_user_id;
  end if;

  if not exists (
    select 1
    from public.accounts a
    where a.user_id = v_user_id
  ) then
    raise exception 'Nenhuma conta encontrada para o usuário %. Importe o CSV logado nessa conta antes de executar o seed.', v_user_id;
  end if;

  if exists (
    select 1
    from public.telemetry_events t
    where t.user_id = v_user_id
      and t.event_name = 'demo_seed_v01_accounts'
  ) then
    raise notice 'Seed demo v0.1 já executado para este usuário.';
    return;
  end if;

  select array_agg(x.id order by x.created_at asc, x.id asc)
    into v_accounts
  from (
    select a.id, a.created_at
    from public.accounts a
    where a.user_id = v_user_id
    order by a.created_at desc, a.id desc
    limit 20
  ) x;

  v_account_count := coalesce(array_length(v_accounts, 1), 0);

  if v_account_count < 10 then
    raise exception 'O seed precisa de pelo menos 10 contas. Encontradas: %', v_account_count;
  end if;

  create temporary table tmp_ohrly_seed (
    seed_key text primary key,
    account_ord integer not null,
    change_type text not null,
    age_bucket text not null,
    initial_state text not null,
    opened_days_ago integer not null,
    closed_days_ago integer null,
    intervention_type text null,
    execution_state text null,
    executed_days_ago integer null,
    review_window_days integer null,
    outcome text null,
    decision_impact text null,
    review_days_ago integer null,
    episode_id uuid not null default gen_random_uuid(),
    intervention_id uuid not null default gen_random_uuid()
  ) on commit drop;

  insert into tmp_ohrly_seed (
    seed_key, account_ord, change_type, age_bucket, initial_state,
    opened_days_ago, closed_days_ago, intervention_type, execution_state,
    executed_days_ago, review_window_days, outcome, decision_impact, review_days_ago
  ) values
    ('ep01',1,'engagement_drop','gt_14d','act',21,null,'csm_contact','executed',19,7,'partial_recovery','noticed_recovery',12),
    ('ep02',1,'key_user_silence','3_7d','investigate',5,null,null,null,null,null,null,null,null),
    ('ep03',2,'onboarding_delay','7_14d','act',12,2,'onboarding_adjustment','executed',10,7,'recovered','acted_earlier',4),
    ('ep04',3,'support_friction','7_14d','act',9,null,'internal_escalation','exception',null,5,null,null,null),
    ('ep05',4,'relationship_change','lt_3d','watch',2,null,null,null,null,null,null,null,null),
    ('ep06',5,'engagement_drop','gt_14d','act',24,null,'csm_contact','executed',23,7,'worsened','changed_intervention',15),
    ('ep07',6,'key_user_silence','3_7d','investigate',6,null,null,null,null,null,null,null,null),
    ('ep08',7,'other','gt_14d','act',31,10,'review_meeting','executed',29,10,'recovered','noticed_recovery',12),
    ('ep09',8,'support_friction','3_7d','investigate',4,null,null,null,null,null,null,null,null),
    ('ep10',9,'onboarding_delay','7_14d','act',11,null,'onboarding_adjustment','planned',null,7,null,null,null),
    ('ep11',10,'relationship_change','gt_14d','act',22,null,'review_meeting','executed',20,7,'relapse','changed_intervention',5),
    ('ep12',2,'engagement_drop','lt_3d','watch',1,null,null,null,null,null,null,null,null),
    ('ep13',3,'key_user_silence','gt_14d','act',18,6,'csm_contact','executed',16,7,'recovered','acted_earlier',7),
    ('ep14',5,'support_friction','7_14d','investigate',8,null,null,null,null,null,null,null,null);

  insert into public.episodes (
    id, user_id, account_id, change_type, age_bucket, initial_state, created_at, closed_at
  )
  select
    s.episode_id,
    v_user_id,
    v_accounts[s.account_ord],
    s.change_type,
    s.age_bucket,
    s.initial_state,
    now() - make_interval(days => s.opened_days_ago),
    case
      when s.closed_days_ago is null then null
      else now() - make_interval(days => s.closed_days_ago)
    end
  from tmp_ohrly_seed s;

  insert into public.interventions (
    id, episode_id, user_id, intervention_type, owner_role,
    execution_deadline_hours, review_window_days, execution_state,
    executed_at, execution_updated_at, exception_type, created_at
  )
  select
    s.intervention_id,
    s.episode_id,
    v_user_id,
    s.intervention_type,
    'CSM responsável',
    24,
    coalesce(s.review_window_days, 7),
    s.execution_state,
    case
      when s.execution_state = 'executed' and s.executed_days_ago is not null
        then now() - make_interval(days => s.executed_days_ago)
      else null
    end,
    case
      when s.execution_state in ('executed','exception')
        then now() - make_interval(days => greatest(s.opened_days_ago - 2, 0))
      else null
    end,
    case when s.execution_state = 'exception' then 'blocked_by_context' else null end,
    now() - make_interval(days => greatest(s.opened_days_ago - 1, 0))
  from tmp_ohrly_seed s
  where s.intervention_type is not null;

  insert into public.reviews (
    id, intervention_id, episode_id, user_id, outcome, decision_impact, created_at
  )
  select
    gen_random_uuid(),
    s.intervention_id,
    s.episode_id,
    v_user_id,
    s.outcome,
    s.decision_impact,
    now() - make_interval(days => s.review_days_ago)
  from tmp_ohrly_seed s
  where s.outcome is not null
    and s.review_days_ago is not null;

  -- Updates para deixar algumas timelines mais ricas.
  insert into public.episode_updates (episode_id, user_id, update_type, created_at)
  select s.episode_id, v_user_id, u.update_type, now() - make_interval(days => u.days_ago)
  from (
    values
      ('ep01','meeting_happened',19),
      ('ep01','customer_replied',18),
      ('ep01','new_signal',13),
      ('ep03','meeting_happened',10),
      ('ep03','customer_replied',8),
      ('ep04','exception',7),
      ('ep06','customer_replied',22),
      ('ep06','new_signal',16),
      ('ep08','meeting_happened',29),
      ('ep08','customer_replied',20),
      ('ep08','new_signal',13),
      ('ep10','new_signal',9),
      ('ep11','customer_replied',20),
      ('ep11','new_signal',7),
      ('ep13','meeting_happened',16),
      ('ep13','customer_replied',14)
  ) as u(seed_key, update_type, days_ago)
  join tmp_ohrly_seed s on s.seed_key = u.seed_key;

  insert into public.telemetry_events (
    user_id, event_name, properties
  ) values (
    v_user_id,
    'demo_seed_v01_accounts',
    jsonb_build_object(
      'source', '004_optional_seed_demo_episodes.sql',
      'accounts_available', v_account_count,
      'episodes_seeded', (select count(*) from tmp_ohrly_seed)
    )
  );

  raise notice 'Seed concluído: % episódios adicionados para o usuário %.',
    (select count(*) from tmp_ohrly_seed), v_user_id;
end $$;

-- Consultas úteis após o seed:
--
-- select account_id, count(*) as episodes
-- from public.episodes
-- group by account_id
-- order by episodes desc;
--
-- select
--   e.account_id,
--   e.change_type,
--   e.initial_state,
--   e.created_at,
--   i.execution_state,
--   r.outcome
-- from public.episodes e
-- left join public.interventions i on i.episode_id = e.id
-- left join public.reviews r on r.episode_id = e.id
-- order by e.created_at desc;
