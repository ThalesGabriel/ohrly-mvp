-- Ohrly MVP v0.2.3 — Seed de teste para Trajectory Precedents
--
-- Objetivo:
--   1) criar um precedente estrutural forte (Beta -> Acme);
--   2) criar um precedente fechado de controle com trajetória diferente (Gamma);
--   3) criar um caso ainda raso que NÃO deve receber precedente (Delta).
--
-- Como usar:
--   * aplique antes as migrations 001..006;
--   * entre no Ohrly ao menos uma vez com seu usuário;
--   * execute este arquivo no SQL Editor do Supabase;
--   * o seed usa automaticamente o usuário permanente que fez login mais recentemente.
--
-- Privacidade:
--   nomes, aliases e notas continuam fora do Supabase.
--   Use scripts/seed-precedent-private-console.js no console do navegador
--   para dar nomes aos casos.
--
-- IDs determinísticos permitem reexecutar este seed com segurança.

DO $$
DECLARE
  v_user uuid;

  v_beta_episode uuid  := 'be7a1000-0000-4000-8000-000000000001'::uuid;
  v_acme_episode uuid  := 'ac1e1000-0000-4000-8000-000000000002'::uuid;
  v_gamma_episode uuid := '6a6d1000-0000-4000-8000-000000000003'::uuid;
  v_delta_episode uuid := 'de171000-0000-4000-8000-000000000004'::uuid;

BEGIN
  ---------------------------------------------------------------------------
  -- 1. Usuário
  ---------------------------------------------------------------------------

  SELECT id
  INTO v_user
  FROM auth.users
  WHERE email IS NOT NULL
  ORDER BY COALESCE(last_sign_in_at, created_at) DESC
  LIMIT 1;

  IF v_user IS NULL THEN
    RAISE EXCEPTION
      'Nenhum usuário permanente encontrado em auth.users. Faça login no Ohrly antes de rodar o seed.';
  END IF;

  ---------------------------------------------------------------------------
  -- 2. Limpeza idempotente
  --
  -- IMPORTANTE:
  -- accounts -> episodes usa ON DELETE SET NULL.
  -- Portanto, apagar Accounts primeiro NÃO remove os Episodes.
  --
  -- Limpamos explicitamente:
  --   suggestions
  --   relationships
  --   reviews
  --   interventions
  --   updates
  --   episodes
  --   accounts
  ---------------------------------------------------------------------------

  DELETE FROM public.episode_precedent_suggestions
  WHERE current_episode_id IN (
    v_beta_episode,
    v_acme_episode,
    v_gamma_episode,
    v_delta_episode
  )
  OR precedent_episode_id IN (
    v_beta_episode,
    v_acme_episode,
    v_gamma_episode,
    v_delta_episode
  );

  DELETE FROM public.episode_relationships
  WHERE source_episode_id IN (
    v_beta_episode,
    v_acme_episode,
    v_gamma_episode,
    v_delta_episode
  )
  OR target_episode_id IN (
    v_beta_episode,
    v_acme_episode,
    v_gamma_episode,
    v_delta_episode
  );

  DELETE FROM public.reviews
  WHERE episode_id IN (
    v_beta_episode,
    v_acme_episode,
    v_gamma_episode,
    v_delta_episode
  );

  DELETE FROM public.interventions
  WHERE episode_id IN (
    v_beta_episode,
    v_acme_episode,
    v_gamma_episode,
    v_delta_episode
  );

  DELETE FROM public.episode_updates
  WHERE episode_id IN (
    v_beta_episode,
    v_acme_episode,
    v_gamma_episode,
    v_delta_episode
  );

  DELETE FROM public.episodes
  WHERE id IN (
    v_beta_episode,
    v_acme_episode,
    v_gamma_episode,
    v_delta_episode
  );

  DELETE FROM public.accounts
  WHERE id IN (
    'be7a0000-0000-4000-8000-000000000001'::uuid,
    'ac1e0000-0000-4000-8000-000000000002'::uuid,
    '6a6d0000-0000-4000-8000-000000000003'::uuid,
    'de170000-0000-4000-8000-000000000004'::uuid
  );

  ---------------------------------------------------------------------------
  -- 3. Accounts
  ---------------------------------------------------------------------------

  INSERT INTO public.accounts (
    id,
    user_id,
    created_at
  )
  VALUES
    (
      'be7a0000-0000-4000-8000-000000000001',
      v_user,
      now() - interval '30 days'
    ),
    (
      'ac1e0000-0000-4000-8000-000000000002',
      v_user,
      now() - interval '10 days'
    ),
    (
      '6a6d0000-0000-4000-8000-000000000003',
      v_user,
      now() - interval '25 days'
    ),
    (
      'de170000-0000-4000-8000-000000000004',
      v_user,
      now() - interval '5 days'
    );

  ---------------------------------------------------------------------------
  -- 4. BETA
  --
  -- Precedente forte e encerrado.
  --
  -- Trajetória:
  --
  -- engagement_drop
  --   -> investigate
  --   -> new_signal
  --   -> csm_contact
  --   -> executed
  --   -> partial_recovery
  --
  -- A trajetória é propositalmente mais longa que a da Acme.
  ---------------------------------------------------------------------------

  INSERT INTO public.episodes (
    id,
    user_id,
    account_id,
    change_type,
    age_bucket,
    initial_state,
    created_at,
    closed_at
  )
  VALUES (
    v_beta_episode,
    v_user,
    'be7a0000-0000-4000-8000-000000000001',
    'engagement_drop',
    '3_7d',
    'investigate',
    now() - interval '20 days',
    now() - interval '15 days'
  );

  INSERT INTO public.episode_updates (
    id,
    episode_id,
    user_id,
    update_type,
    created_at
  )
  VALUES (
    'be7a4000-0000-4000-8000-000000000001',
    v_beta_episode,
    v_user,
    'new_signal',
    now() - interval '19 days'
  );

  INSERT INTO public.interventions (
    id,
    episode_id,
    user_id,
    intervention_type,
    owner_role,
    execution_deadline_hours,
    review_window_days,
    execution_state,
    executed_at,
    execution_updated_at,
    exception_type,
    created_at
  )
  VALUES (
    'be7a2000-0000-4000-8000-000000000001',
    v_beta_episode,
    v_user,
    'csm_contact',
    'CSM responsável',
    24,
    7,
    'executed',
    now() - interval '17 days',
    now() - interval '17 days',
    null,
    now() - interval '18 days'
  );

  INSERT INTO public.reviews (
    id,
    intervention_id,
    episode_id,
    user_id,
    outcome,
    decision_impact,
    created_at
  )
  VALUES (
    'be7a3000-0000-4000-8000-000000000001',
    'be7a2000-0000-4000-8000-000000000001',
    v_beta_episode,
    v_user,
    'partial_recovery',
    'noticed_recovery',
    now() - interval '16 days'
  );

  ---------------------------------------------------------------------------
  -- 5. GAMMA
  --
  -- Controle negativo fechado.
  --
  -- Mesmo change_type da Beta/Acme, porém outra trajetória:
  --
  -- engagement_drop
  --   -> investigate
  --   -> meeting_happened
  --   -> review_meeting
  --   -> executed
  --   -> recovered
  --
  -- O matcher não deve preferir Gamma como precedente da Acme.
  ---------------------------------------------------------------------------

  INSERT INTO public.episodes (
    id,
    user_id,
    account_id,
    change_type,
    age_bucket,
    initial_state,
    created_at,
    closed_at
  )
  VALUES (
    v_gamma_episode,
    v_user,
    '6a6d0000-0000-4000-8000-000000000003',
    'engagement_drop',
    '3_7d',
    'investigate',
    now() - interval '18 days',
    now() - interval '13 days'
  );

  INSERT INTO public.episode_updates (
    id,
    episode_id,
    user_id,
    update_type,
    created_at
  )
  VALUES (
    '6a6d4000-0000-4000-8000-000000000003',
    v_gamma_episode,
    v_user,
    'meeting_happened',
    now() - interval '17 days'
  );

  INSERT INTO public.interventions (
    id,
    episode_id,
    user_id,
    intervention_type,
    owner_role,
    execution_deadline_hours,
    review_window_days,
    execution_state,
    executed_at,
    execution_updated_at,
    exception_type,
    created_at
  )
  VALUES (
    '6a6d2000-0000-4000-8000-000000000003',
    v_gamma_episode,
    v_user,
    'review_meeting',
    'CSM responsável',
    24,
    7,
    'executed',
    now() - interval '15 days',
    now() - interval '15 days',
    null,
    now() - interval '16 days'
  );

  INSERT INTO public.reviews (
    id,
    intervention_id,
    episode_id,
    user_id,
    outcome,
    decision_impact,
    created_at
  )
  VALUES (
    '6a6d3000-0000-4000-8000-000000000003',
    '6a6d2000-0000-4000-8000-000000000003',
    v_gamma_episode,
    v_user,
    'recovered',
    'noticed_recovery',
    now() - interval '14 days'
  );

  ---------------------------------------------------------------------------
  -- 6. ACME
  --
  -- Caso atual aberto.
  --
  -- Repete estruturalmente o início da Beta:
  --
  -- engagement_drop
  --   -> investigate
  --   -> new_signal
  --   -> csm_contact
  --   -> executed
  --
  -- A Beta continua depois desse ponto até partial_recovery.
  --
  -- RESULTADO ESPERADO:
  --   Acme deve receber a tab "Precedente".
  --   Beta deve ser escolhida em vez de Gamma.
  ---------------------------------------------------------------------------

  INSERT INTO public.episodes (
    id,
    user_id,
    account_id,
    change_type,
    age_bucket,
    initial_state,
    created_at,
    closed_at
  )
  VALUES (
    v_acme_episode,
    v_user,
    'ac1e0000-0000-4000-8000-000000000002',
    'engagement_drop',
    '3_7d',
    'investigate',
    now() - interval '2 days',
    null
  );

  INSERT INTO public.episode_updates (
    id,
    episode_id,
    user_id,
    update_type,
    created_at
  )
  VALUES (
    'ac1e4000-0000-4000-8000-000000000002',
    v_acme_episode,
    v_user,
    'new_signal',
    now() - interval '36 hours'
  );

  INSERT INTO public.interventions (
    id,
    episode_id,
    user_id,
    intervention_type,
    owner_role,
    execution_deadline_hours,
    review_window_days,
    execution_state,
    executed_at,
    execution_updated_at,
    exception_type,
    created_at
  )
  VALUES (
    'ac1e2000-0000-4000-8000-000000000002',
    v_acme_episode,
    v_user,
    'csm_contact',
    'CSM responsável',
    24,
    7,
    'executed',
    now() - interval '20 hours',
    now() - interval '20 hours',
    null,
    now() - interval '1 day'
  );

  ---------------------------------------------------------------------------
  -- 7. DELTA
  --
  -- Caso propositalmente raso.
  --
  -- Trajetória:
  --
  -- engagement_drop
  --   -> investigate
  --   -> new_signal
  --
  -- Não possui intervenção nem review.
  --
  -- RESULTADO ESPERADO:
  --   Delta NÃO deve receber a tab "Precedente".
  ---------------------------------------------------------------------------

  INSERT INTO public.episodes (
    id,
    user_id,
    account_id,
    change_type,
    age_bucket,
    initial_state,
    created_at,
    closed_at
  )
  VALUES (
    v_delta_episode,
    v_user,
    'de170000-0000-4000-8000-000000000004',
    'engagement_drop',
    '3_7d',
    'investigate',
    now() - interval '1 day',
    null
  );

  INSERT INTO public.episode_updates (
    id,
    episode_id,
    user_id,
    update_type,
    created_at
  )
  VALUES (
    'de174000-0000-4000-8000-000000000004',
    v_delta_episode,
    v_user,
    'new_signal',
    now() - interval '12 hours'
  );

  ---------------------------------------------------------------------------
  -- 8. Resultado
  ---------------------------------------------------------------------------

  RAISE NOTICE 'Seed criado para user_id=%', v_user;
  RAISE NOTICE 'Precedente: Beta = %', v_beta_episode;
  RAISE NOTICE 'Teste positivo: Acme = %', v_acme_episode;
  RAISE NOTICE 'Controle estrutural: Gamma = %', v_gamma_episode;
  RAISE NOTICE 'Controle raso: Delta = %', v_delta_episode;

END $$;


-------------------------------------------------------------------------------
-- Diagnóstico 1 — Episodes criados
-------------------------------------------------------------------------------

SELECT
  e.id AS episode_id,

  CASE e.id
    WHEN 'be7a1000-0000-4000-8000-000000000001'::uuid
      THEN 'Beta — precedente forte'

    WHEN '6a6d1000-0000-4000-8000-000000000003'::uuid
      THEN 'Gamma — precedente fechado de controle'

    WHEN 'ac1e1000-0000-4000-8000-000000000002'::uuid
      THEN 'Acme — deve receber Precedente'

    WHEN 'de171000-0000-4000-8000-000000000004'::uuid
      THEN 'Delta — NÃO deve receber Precedente'
  END AS scenario,

  e.change_type,
  e.initial_state,
  e.created_at,
  e.closed_at

FROM public.episodes e

WHERE e.id IN (
  'be7a1000-0000-4000-8000-000000000001'::uuid,
  '6a6d1000-0000-4000-8000-000000000003'::uuid,
  'ac1e1000-0000-4000-8000-000000000002'::uuid,
  'de171000-0000-4000-8000-000000000004'::uuid
)

ORDER BY e.created_at;


-------------------------------------------------------------------------------
-- Diagnóstico 2 — Trajetórias estruturadas
-------------------------------------------------------------------------------

SELECT
  e.id AS episode_id,

  e.change_type,

  ARRAY_AGG(
    DISTINCT u.update_type
  ) FILTER (
    WHERE u.update_type IS NOT NULL
  ) AS updates,

  ARRAY_AGG(
    DISTINCT i.intervention_type
  ) FILTER (
    WHERE i.intervention_type IS NOT NULL
  ) AS interventions,

  ARRAY_AGG(
    DISTINCT r.outcome
  ) FILTER (
    WHERE r.outcome IS NOT NULL
  ) AS outcomes

FROM public.episodes e

LEFT JOIN public.episode_updates u
  ON u.episode_id = e.id

LEFT JOIN public.interventions i
  ON i.episode_id = e.id

LEFT JOIN public.reviews r
  ON r.episode_id = e.id

WHERE e.id IN (
  'be7a1000-0000-4000-8000-000000000001'::uuid,
  '6a6d1000-0000-4000-8000-000000000003'::uuid,
  'ac1e1000-0000-4000-8000-000000000002'::uuid,
  'de171000-0000-4000-8000-000000000004'::uuid
)

GROUP BY
  e.id,
  e.change_type,
  e.created_at

ORDER BY e.created_at;


-------------------------------------------------------------------------------
-- Diagnóstico 3 — Suggestions
--
-- IMPORTANTE:
-- imediatamente após executar o seed essa consulta deve retornar 0 linhas.
--
-- O matcher roda na aplicação, não neste SQL.
--
-- Depois de abrir o Episode da Acme no Ohrly, execute novamente.
-- O esperado é surgir:
--
-- current_episode_id   = Acme
-- precedent_episode_id = Beta
-- origin               = heuristic
-- matcher_version      = v2-trajectory-high-precision
-------------------------------------------------------------------------------

SELECT
  current_episode_id,
  precedent_episode_id,
  origin,
  evidence_codes,
  rank_score,
  matcher_version,
  presented_at,
  feedback,
  reviewed_at,
  created_at

FROM public.episode_precedent_suggestions

WHERE current_episode_id IN (
  'ac1e1000-0000-4000-8000-000000000002'::uuid,
  'de171000-0000-4000-8000-000000000004'::uuid
)

ORDER BY created_at;