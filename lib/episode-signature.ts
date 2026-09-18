import {
  changeTypeLabels,
  episodeRelationshipTypeLabels,
  episodeUpdateTypeLabels,
  initialStateLabels,
  interventionTypeLabels,
  outcomeLabels,
  type Episode,
  type EpisodeRelationship,
  type EpisodeUpdate,
  type Intervention,
  type Review,
} from "@/lib/types";

export type EpisodeTrajectoryStepKind =
  | "continuity"
  | "change"
  | "decision"
  | "update"
  | "intervention"
  | "execution"
  | "review";

export type EpisodeTrajectoryStep = {
  kind: EpisodeTrajectoryStepKind;
  token: string;
  label: string;
  at: string;
  matchable: boolean;
};

export type EpisodeSignature = {
  episodeId: string;
  trajectory: EpisodeTrajectoryStep[];
  matchTokens: string[];
  continuityType: EpisodeRelationship["relationship_type"] | null;
  interventionType: Intervention["intervention_type"] | null;
  structuralDepth: number;
};

export function buildEpisodeSignature(input: {
  episode: Episode;
  updates: EpisodeUpdate[];
  interventions: Intervention[];
  reviews: Review[];
  relationships: EpisodeRelationship[];
}): EpisodeSignature {
  const { episode } = input;
  const updates = input.updates
    .filter((update) => update.episode_id === episode.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const interventions = input.interventions
    .filter((intervention) => intervention.episode_id === episode.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const reviews = input.reviews
    .filter((review) => review.episode_id === episode.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const incomingRelationship = input.relationships
    .filter((relationship) => relationship.target_episode_id === episode.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))[0] ?? null;

  const steps: Array<EpisodeTrajectoryStep & { order: number }> = [];
  let order = 0;

  if (incomingRelationship) {
    steps.push({
      kind: "continuity",
      token: `continuity:${incomingRelationship.relationship_type}`,
      label: episodeRelationshipTypeLabels[incomingRelationship.relationship_type],
      at: episode.created_at,
      matchable: true,
      order: order++,
    });
  }

  steps.push({
    kind: "change",
    token: `change:${episode.change_type}`,
    label: changeTypeLabels[episode.change_type],
    at: episode.created_at,
    matchable: true,
    order: order++,
  });

  steps.push({
    kind: "decision",
    token: `decision:${episode.initial_state}`,
    label: initialStateLabels[episode.initial_state],
    at: episode.created_at,
    matchable: true,
    order: order++,
  });

  for (const update of updates) {
    steps.push({
      kind: "update",
      token: `update:${update.update_type}`,
      label: episodeUpdateTypeLabels[update.update_type],
      at: update.created_at,
      // A generic note is valuable in the timeline, but is not a strong structural signal by itself.
      matchable: update.update_type !== "note",
      order: order++,
    });
  }

  for (const intervention of interventions) {
    steps.push({
      kind: "intervention",
      token: `intervention:${intervention.intervention_type}`,
      label: interventionTypeLabels[intervention.intervention_type],
      at: intervention.created_at,
      matchable: true,
      order: order++,
    });

    if (intervention.execution_updated_at) {
      const executionLabel = intervention.execution_state === "executed"
        ? "Intervenção executada"
        : intervention.execution_state === "exception"
          ? "Exceção de execução"
          : "Nova tentativa planejada";
      steps.push({
        kind: "execution",
        token: `execution:${intervention.execution_state}`,
        label: executionLabel,
        at: intervention.execution_updated_at,
        matchable: true,
        order: order++,
      });
    }
  }

  for (const review of reviews) {
    steps.push({
      kind: "review",
      token: `review:${review.outcome}`,
      label: outcomeLabels[review.outcome],
      at: review.created_at,
      // "Ainda é cedo" expresses an incomplete review, not a stable trajectory outcome.
      matchable: review.outcome !== "too_early",
      order: order++,
    });
  }

  const trajectory = steps
    .sort((a, b) => a.at.localeCompare(b.at) || a.order - b.order)
    .map(({ order: _order, ...step }) => step);
  const matchTokens = trajectory.filter((step) => step.matchable).map((step) => step.token);
  const latestIntervention = interventions[interventions.length - 1] ?? null;

  return {
    episodeId: episode.id,
    trajectory,
    matchTokens,
    continuityType: incomingRelationship?.relationship_type ?? null,
    interventionType: latestIntervention?.intervention_type ?? null,
    structuralDepth: Math.max(0, matchTokens.length - 2),
  };
}

export function trajectoryPreview(signature: EpisodeSignature, maxSteps = 6) {
  const meaningful = signature.trajectory.filter((step) => step.matchable && step.kind !== "decision");
  if (meaningful.length <= maxSteps) return meaningful;
  return meaningful.slice(0, maxSteps);
}
