export const CHANGE_TYPES = [
  "engagement_drop",
  "key_user_silence",
  "onboarding_delay",
  "support_friction",
  "relationship_change",
  "other",
] as const;

export type ChangeType = (typeof CHANGE_TYPES)[number];
export type AgeBucket = "lt_3d" | "3_7d" | "7_14d" | "gt_14d";
export type InitialState = "watch" | "investigate" | "act";

export type InterventionType =
  | "csm_contact"
  | "review_meeting"
  | "internal_escalation"
  | "onboarding_adjustment"
  | "other";

export type ExecutionState = "planned" | "executed" | "exception";

export type Outcome =
  | "recovered"
  | "partial_recovery"
  | "no_change"
  | "worsened"
  | "relapse"
  | "too_early";

export type DecisionImpact =
  | "acted_earlier"
  | "waited_for_more_evidence"
  | "changed_intervention"
  | "noticed_intervention_failed"
  | "noticed_recovery"
  | "avoided_unnecessary_action"
  | "maybe"
  | "none";

export type EpisodeUpdateType =
  | "customer_replied"
  | "meeting_happened"
  | "new_signal"
  | "exception"
  | "note";

export interface Episode {
  id: string;
  user_id: string;
  change_type: ChangeType;
  age_bucket: AgeBucket;
  initial_state: InitialState;
  created_at: string;
  closed_at: string | null;
}

export interface Intervention {
  id: string;
  episode_id: string;
  user_id: string;
  intervention_type: InterventionType;
  owner_role: string;
  execution_deadline_hours: number;
  review_window_days: number;
  execution_state: ExecutionState;
  executed_at: string | null;
  execution_updated_at: string | null;
  exception_type: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  intervention_id: string;
  episode_id: string;
  user_id: string;
  outcome: Outcome;
  decision_impact: DecisionImpact;
  created_at: string;
}

export interface EpisodeUpdate {
  id: string;
  episode_id: string;
  user_id: string;
  update_type: EpisodeUpdateType;
  created_at: string;
}

export const changeTypeLabels: Record<ChangeType, string> = {
  engagement_drop: "Queda de engajamento",
  key_user_silence: "Silêncio do usuário-chave",
  onboarding_delay: "Atraso no onboarding",
  support_friction: "Aumento de tickets / fricção",
  relationship_change: "Mudança de relacionamento",
  other: "Outro",
};

export const ageBucketLabels: Record<AgeBucket, string> = {
  lt_3d: "< 3 dias",
  "3_7d": "3–7 dias",
  "7_14d": "7–14 dias",
  gt_14d: "> 14 dias",
};

export const initialStateLabels: Record<InitialState, string> = {
  watch: "Continuar observando",
  investigate: "Investigar",
  act: "Agir",
};

export const interventionTypeLabels: Record<InterventionType, string> = {
  csm_contact: "Contato do CSM",
  review_meeting: "Reunião de revisão",
  internal_escalation: "Escalação interna",
  onboarding_adjustment: "Ajuste de onboarding",
  other: "Outro",
};

export const outcomeLabels: Record<Outcome, string> = {
  recovered: "Recuperou",
  partial_recovery: "Melhorou parcialmente",
  no_change: "Não mudou",
  worsened: "Piorou",
  relapse: "Recaída",
  too_early: "Ainda é cedo",
};

export const decisionImpactLabels: Record<DecisionImpact, string> = {
  acted_earlier: "Sim — agi antes",
  waited_for_more_evidence: "Sim — esperei mais evidência",
  changed_intervention: "Sim — mudei a intervenção",
  noticed_intervention_failed: "Sim — percebi que a intervenção não funcionou",
  noticed_recovery: "Sim — identifiquei recuperação",
  avoided_unnecessary_action: "Sim — evitei outra ação desnecessária",
  maybe: "Talvez",
  none: "Não",
};

export const episodeUpdateTypeLabels: Record<EpisodeUpdateType, string> = {
  customer_replied: "Cliente respondeu",
  meeting_happened: "Reunião aconteceu",
  new_signal: "Novo sinal observado",
  exception: "Exceção",
  note: "Nota",
};
