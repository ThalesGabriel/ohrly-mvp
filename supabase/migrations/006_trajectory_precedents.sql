-- Ohrly MVP v0.2.3 — Trajectory-first precedents
-- Precedent matching now prefers structured Episode trajectories over free-text similarity.
-- This migration only expands the categorical evidence vocabulary; no free text is persisted.

alter table public.episode_precedent_suggestions
  drop constraint if exists episode_precedent_suggestions_evidence_codes_check;

alter table public.episode_precedent_suggestions
  add constraint episode_precedent_suggestions_evidence_codes_check check (
    evidence_codes <@ array[
      'same_change_type',
      'similar_trajectory',
      'shared_context_terms',
      'same_intervention_type',
      'same_continuity_type',
      'same_age_bucket'
    ]::text[]
  );
