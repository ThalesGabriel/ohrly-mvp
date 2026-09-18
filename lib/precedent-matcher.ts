"use client";

import { buildEpisodeSignature, type EpisodeSignature } from "@/lib/episode-signature";
import {
  getEpisodePrivateContext,
  getEpisodeUpdateText,
  getInterventionObjective,
} from "@/lib/local-private";
import type {
  Episode,
  EpisodeRelationship,
  EpisodeUpdate,
  Intervention,
  PrecedentEvidenceCode,
  PrecedentSuggestion,
  Review,
} from "@/lib/types";

export const PRECEDENT_MATCHER_VERSION = "v2-trajectory-high-precision";

const STOPWORDS = new Set([
  "a", "ao", "aos", "aquela", "aquele", "aqueles", "as", "ate", "com", "como", "da", "das", "de", "dela", "dele", "deles",
  "depois", "do", "dos", "e", "ela", "ele", "eles", "em", "entre", "era", "essa", "esse", "esta", "este", "foi", "foram", "ha",
  "isso", "ja", "mais", "mas", "mesmo", "na", "nas", "no", "nos", "o", "os", "ou", "para", "pela", "pelo", "por", "porque", "que",
  "se", "sem", "ser", "sua", "suas", "seu", "seus", "tambem", "tem", "teve", "um", "uma", "quando", "cliente", "clientes", "conta",
  "caso", "casos", "csm", "time", "equipe", "ohrly", "mudanca", "mudancas", "problema", "situacao", "contexto", "episodio", "episode",
]);

const TOKEN_ALIASES: Record<string, string> = {
  implantacao: "onboarding",
  implementacao: "onboarding",
  onboarding: "onboarding",
  champion: "stakeholder",
  sponsor: "stakeholder",
  stakeholder: "stakeholder",
  patrocinador: "stakeholder",
  reuniao: "meeting",
  reunioes: "meeting",
  meeting: "meeting",
};

export type PrecedentMatch = {
  precedentEpisode: Episode;
  currentSignature: EpisodeSignature;
  precedentSignature: EpisodeSignature;
  evidenceCodes: PrecedentEvidenceCode[];
  rankScore: number;
  sharedTerms: string[];
  matchedTrajectoryTokens: string[];
  trajectoryCoverage: number;
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTerms(value: string) {
  const normalized = normalizeText(value);
  if (!normalized) return new Set<string>();

  const terms = normalized
    .split(" ")
    .map((raw) => raw.replace(/^-+|-+$/g, ""))
    .filter((raw) => raw.length >= 4)
    .filter((raw) => !STOPWORDS.has(raw))
    .map((raw) => TOKEN_ALIASES[raw] ?? raw);

  return new Set(terms);
}

function episodeFreeText(input: {
  episode: Episode;
  updates: EpisodeUpdate[];
  interventions: Intervention[];
}) {
  const privateContext = getEpisodePrivateContext(input.episode.id);
  const updateText = input.updates
    .filter((update) => update.episode_id === input.episode.id)
    .map((update) => getEpisodeUpdateText(update.id))
    .filter(Boolean)
    .join(" ");
  const interventionText = input.interventions
    .filter((intervention) => intervention.episode_id === input.episode.id)
    .map((intervention) => getInterventionObjective(intervention.id))
    .filter(Boolean)
    .join(" ");

  return `${privateContext.alias} ${privateContext.note} ${updateText} ${interventionText}`;
}

function sharedTermsForEpisodes(input: {
  current: Episode;
  precedent: Episode;
  updates: EpisodeUpdate[];
  interventions: Intervention[];
}) {
  const currentTerms = extractTerms(episodeFreeText({ episode: input.current, updates: input.updates, interventions: input.interventions }));
  const precedentTerms = extractTerms(episodeFreeText({ episode: input.precedent, updates: input.updates, interventions: input.interventions }));
  return [...currentTerms].filter((term) => precedentTerms.has(term));
}

function longestCommonSubsequence(a: string[], b: string[]) {
  const dp = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const sequence: string[] = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      sequence.unshift(a[i - 1]);
      i -= 1;
      j -= 1;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i -= 1;
    } else {
      j -= 1;
    }
  }
  return sequence;
}

function isSpecificTrajectoryToken(token: string) {
  return !token.startsWith("change:") && !token.startsWith("decision:");
}

function latestKnownReview(episode: Episode, reviews: Review[]) {
  return reviews
    .filter((review) => review.episode_id === episode.id && review.outcome !== "too_early")
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
}

export function findBestPrecedentCandidate(input: {
  currentEpisode: Episode;
  episodes: Episode[];
  updates: EpisodeUpdate[];
  interventions: Intervention[];
  reviews: Review[];
  relationships: EpisodeRelationship[];
  existingSuggestions: PrecedentSuggestion[];
}): PrecedentMatch | null {
  const {
    currentEpisode,
    episodes,
    updates,
    interventions,
    reviews,
    relationships,
    existingSuggestions,
  } = input;

  if (!currentEpisode.account_id || currentEpisode.closed_at) return null;
  if (existingSuggestions.length > 0) return null; // v0.2.2: at most one precedent per current Episode.

  const currentSignature = buildEpisodeSignature({
    episode: currentEpisode,
    updates,
    interventions,
    reviews,
    relationships,
  });

  // Do not surface a precedent while the current trajectory is still almost empty.
  // At least one meaningful event beyond change + initial decision is required, and
  // the high-precision gate below generally requires two unless free-text context reinforces it.
  if (currentSignature.matchTokens.length < 3) return null;
  const hasProgressEvent = currentSignature.trajectory.some((step) =>
    step.matchable && ["update", "intervention", "execution", "review"].includes(step.kind),
  );
  if (!hasProgressEvent) return null;

  const candidates: PrecedentMatch[] = [];

  for (const precedent of episodes) {
    if (precedent.id === currentEpisode.id) continue;
    if (!precedent.account_id || precedent.account_id === currentEpisode.account_id) continue;
    if (!precedent.closed_at) continue;
    if (precedent.created_at >= currentEpisode.created_at) continue;
    if (precedent.change_type !== currentEpisode.change_type) continue;
    if (!latestKnownReview(precedent, reviews)) continue;

    const precedentSignature = buildEpisodeSignature({
      episode: precedent,
      updates,
      interventions,
      reviews,
      relationships,
    });

    const matchedTrajectoryTokens = longestCommonSubsequence(
      currentSignature.matchTokens,
      precedentSignature.matchTokens,
    );
    const trajectoryCoverage = currentSignature.matchTokens.length
      ? matchedTrajectoryTokens.length / currentSignature.matchTokens.length
      : 0;
    const matchedSpecificTokens = matchedTrajectoryTokens.filter(isSpecificTrajectoryToken);
    const sharedTerms = sharedTermsForEpisodes({ current: currentEpisode, precedent, updates, interventions });

    const strongTrajectory = matchedTrajectoryTokens.length >= 3 && trajectoryCoverage >= 0.75;
    const enoughSpecificStructure = matchedSpecificTokens.length >= 2;
    const contextReinforcedStructure = matchedSpecificTokens.length >= 1 && sharedTerms.length >= 2;

    // Same change type is only the entry gate. A precedent is surfaced only when the trajectory
    // itself matches strongly enough to be useful, or when a thinner structural match is reinforced
    // by local context. This intentionally optimizes precision over recall.
    if (!strongTrajectory || (!enoughSpecificStructure && !contextReinforcedStructure)) continue;

    const evidenceCodes: PrecedentEvidenceCode[] = ["same_change_type", "similar_trajectory"];
    let score = 0.18 + Math.min(0.46, trajectoryCoverage * 0.46);

    if (sharedTerms.length >= 2) {
      evidenceCodes.push("shared_context_terms");
      score += Math.min(0.12, 0.06 + (sharedTerms.length - 2) * 0.02);
    }

    if (
      currentSignature.interventionType
      && currentSignature.interventionType === precedentSignature.interventionType
    ) {
      evidenceCodes.push("same_intervention_type");
      score += 0.1;
    }

    if (
      currentSignature.continuityType
      && currentSignature.continuityType === precedentSignature.continuityType
    ) {
      evidenceCodes.push("same_continuity_type");
      score += 0.06;
    }

    if (currentEpisode.age_bucket === precedent.age_bucket) {
      evidenceCodes.push("same_age_bucket");
      score += 0.03;
    }

    score += Math.min(0.04, Math.max(0, matchedSpecificTokens.length - 2) * 0.02);

    candidates.push({
      precedentEpisode: precedent,
      currentSignature,
      precedentSignature,
      evidenceCodes,
      rankScore: Math.min(score, 0.97),
      sharedTerms,
      matchedTrajectoryTokens,
      trajectoryCoverage,
    });
  }

  candidates.sort((a, b) => {
    if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
    if (b.matchedTrajectoryTokens.length !== a.matchedTrajectoryTokens.length) {
      return b.matchedTrajectoryTokens.length - a.matchedTrajectoryTokens.length;
    }
    return b.precedentEpisode.created_at.localeCompare(a.precedentEpisode.created_at);
  });

  return candidates[0] ?? null;
}
