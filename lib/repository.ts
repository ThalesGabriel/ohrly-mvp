"use client";

import { getAuthenticatedUser, getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type {
  AgeBucket,
  ChangeType,
  DecisionImpact,
  Episode,
  EpisodeUpdate,
  EpisodeUpdateType,
  ExecutionState,
  InitialState,
  Intervention,
  InterventionType,
  Outcome,
  Review,
} from "@/lib/types";

const LOCAL_KEY = "ohrly:field-mvp:data:v1";
const LOCAL_USER_ID = "local-demo-user";

type LocalDb = {
  episodes: Episode[];
  interventions: Intervention[];
  reviews: Review[];
  updates: EpisodeUpdate[];
  telemetry: Array<Record<string, unknown>>;
};

function emptyDb(): LocalDb {
  return { episodes: [], interventions: [], reviews: [], updates: [], telemetry: [] };
}

function localDb(): LocalDb {
  if (typeof window === "undefined") return emptyDb();
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return emptyDb();
    const parsed = JSON.parse(raw) as Partial<LocalDb>;
    return {
      episodes: parsed.episodes ?? [],
      interventions: parsed.interventions ?? [],
      reviews: parsed.reviews ?? [],
      updates: parsed.updates ?? [],
      telemetry: parsed.telemetry ?? [],
    };
  } catch {
    return emptyDb();
  }
}

function saveLocal(db: LocalDb) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(db));
}

function uid() {
  return crypto.randomUUID();
}

export function repositoryMode(): "supabase" | "local" {
  return isSupabaseConfigured() ? "supabase" : "local";
}

async function getUserId() {
  if (!isSupabaseConfigured()) return LOCAL_USER_ID;
  const user = await getAuthenticatedUser();
  if (!user) throw new Error("Sua sessão expirou. Entre novamente para continuar.");
  return user.id;
}

export async function listEpisodes(): Promise<Episode[]> {
  if (!isSupabaseConfigured()) {
    return localDb().episodes.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  await getUserId();
  const supabase = getSupabase()!;
  const { data, error } = await supabase.from("episodes").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Episode[];
}

export async function getEpisode(id: string): Promise<Episode | null> {
  if (!isSupabaseConfigured()) return localDb().episodes.find((x) => x.id === id) ?? null;
  await getUserId();
  const supabase = getSupabase()!;
  const { data, error } = await supabase.from("episodes").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Episode | null;
}

export async function createEpisode(input: {
  change_type: ChangeType;
  age_bucket: AgeBucket;
  initial_state: InitialState;
}): Promise<Episode> {
  const userId = await getUserId();
  const row = { user_id: userId, ...input };

  if (!isSupabaseConfigured()) {
    const db = localDb();
    const episode: Episode = { id: uid(), ...row, created_at: new Date().toISOString(), closed_at: null };
    db.episodes.push(episode);
    saveLocal(db);
    await trackEvent("episode_created", episode.id, null, input);
    return episode;
  }

  const supabase = getSupabase()!;
  const { data, error } = await supabase.from("episodes").insert(row).select("*").single();
  if (error) throw error;
  await trackEvent("episode_created", data.id, null, input);
  return data as Episode;
}

export async function updateEpisodeDecision(id: string, next: InitialState): Promise<Episode> {
  if (!isSupabaseConfigured()) {
    const db = localDb();
    const index = db.episodes.findIndex((x) => x.id === id);
    if (index < 0) throw new Error("Episódio não encontrado.");
    db.episodes[index] = { ...db.episodes[index], initial_state: next };
    saveLocal(db);
    await trackEvent("episode_decision_updated", id, null, { initial_state: next });
    return db.episodes[index];
  }
  await getUserId();
  const supabase = getSupabase()!;
  const { data, error } = await supabase.from("episodes").update({ initial_state: next }).eq("id", id).select("*").single();
  if (error) throw error;
  await trackEvent("episode_decision_updated", id, null, { initial_state: next });
  return data as Episode;
}

export async function closeEpisode(id: string): Promise<Episode> {
  const closedAt = new Date().toISOString();
  if (!isSupabaseConfigured()) {
    const db = localDb();
    const index = db.episodes.findIndex((x) => x.id === id);
    if (index < 0) throw new Error("Episódio não encontrado.");
    db.episodes[index] = { ...db.episodes[index], closed_at: closedAt };
    saveLocal(db);
    await trackEvent("episode_closed", id, null, {});
    return db.episodes[index];
  }
  await getUserId();
  const supabase = getSupabase()!;
  const { data, error } = await supabase.from("episodes").update({ closed_at: closedAt }).eq("id", id).select("*").single();
  if (error) throw error;
  await trackEvent("episode_closed", id, null, {});
  return data as Episode;
}

export async function getIntervention(id: string): Promise<Intervention | null> {
  if (!isSupabaseConfigured()) return localDb().interventions.find((x) => x.id === id) ?? null;
  await getUserId();
  const supabase = getSupabase()!;
  const { data, error } = await supabase.from("interventions").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Intervention | null;
}

export async function getInterventionForEpisode(episodeId: string): Promise<Intervention | null> {
  if (!isSupabaseConfigured()) {
    return localDb().interventions.filter((x) => x.episode_id === episodeId).sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
  }
  await getUserId();
  const supabase = getSupabase()!;
  const { data, error } = await supabase.from("interventions").select("*").eq("episode_id", episodeId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data as Intervention | null;
}

export async function createIntervention(input: {
  episode_id: string;
  intervention_type: InterventionType;
  owner_role: string;
  execution_deadline_hours: number;
  review_window_days: number;
}): Promise<Intervention> {
  const userId = await getUserId();
  const row = { ...input, user_id: userId, execution_state: "planned" as const };

  if (!isSupabaseConfigured()) {
    const db = localDb();
    const intervention: Intervention = { id: uid(), ...row, executed_at: null, execution_updated_at: null, exception_type: null, created_at: new Date().toISOString() };
    db.interventions.push(intervention);
    saveLocal(db);
    await trackEvent("intervention_created", input.episode_id, intervention.id, {
      intervention_type: input.intervention_type,
      execution_deadline_hours: input.execution_deadline_hours,
      review_window_days: input.review_window_days,
    });
    return intervention;
  }

  const supabase = getSupabase()!;
  const { data, error } = await supabase.from("interventions").insert(row).select("*").single();
  if (error) throw error;
  await trackEvent("intervention_created", input.episode_id, data.id, {
    intervention_type: input.intervention_type,
    execution_deadline_hours: input.execution_deadline_hours,
    review_window_days: input.review_window_days,
  });
  return data as Intervention;
}

export async function updateExecutionState(
  interventionId: string,
  episodeId: string,
  executionState: ExecutionState,
  exceptionType?: string,
): Promise<Intervention> {
  const now = new Date().toISOString();
  const patch = {
    execution_state: executionState,
    executed_at: executionState === "executed" ? now : null,
    execution_updated_at: now,
    exception_type: executionState === "exception" ? exceptionType || "other" : null,
  };

  if (!isSupabaseConfigured()) {
    const db = localDb();
    const index = db.interventions.findIndex((x) => x.id === interventionId);
    if (index < 0) throw new Error("Intervenção não encontrada.");
    db.interventions[index] = { ...db.interventions[index], ...patch };
    saveLocal(db);
    await trackEvent("execution_updated", episodeId, interventionId, { execution_state: executionState });
    return db.interventions[index];
  }

  await getUserId();
  const supabase = getSupabase()!;
  const { data, error } = await supabase.from("interventions").update(patch).eq("id", interventionId).select("*").single();
  if (error) throw error;
  await trackEvent("execution_updated", episodeId, interventionId, { execution_state: executionState });
  return data as Intervention;
}

export async function listReviewsForIntervention(interventionId: string): Promise<Review[]> {
  if (!isSupabaseConfigured()) {
    return localDb().reviews.filter((x) => x.intervention_id === interventionId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  await getUserId();
  const supabase = getSupabase()!;
  const { data, error } = await supabase.from("reviews").select("*").eq("intervention_id", interventionId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Review[];
}

export async function createReview(input: {
  intervention_id: string;
  episode_id: string;
  outcome: Outcome;
  decision_impact: DecisionImpact;
}): Promise<Review> {
  const userId = await getUserId();
  const row = { ...input, user_id: userId };

  if (!isSupabaseConfigured()) {
    const db = localDb();
    const review: Review = { id: uid(), ...row, created_at: new Date().toISOString() };
    db.reviews.push(review);
    saveLocal(db);
    await trackEvent("episode_reviewed", input.episode_id, input.intervention_id, {
      outcome: input.outcome,
      decision_impact: input.decision_impact,
    });
    return review;
  }

  const supabase = getSupabase()!;
  const { data, error } = await supabase.from("reviews").insert(row).select("*").single();
  if (error) throw error;
  await trackEvent("episode_reviewed", input.episode_id, input.intervention_id, {
    outcome: input.outcome,
    decision_impact: input.decision_impact,
  });
  return data as Review;
}

export async function listEpisodeUpdates(episodeId: string): Promise<EpisodeUpdate[]> {
  if (!isSupabaseConfigured()) {
    return localDb().updates.filter((x) => x.episode_id === episodeId).sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  await getUserId();
  const supabase = getSupabase()!;
  const { data, error } = await supabase.from("episode_updates").select("*").eq("episode_id", episodeId).order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as EpisodeUpdate[];
}

export async function createEpisodeUpdate(input: { episode_id: string; update_type: EpisodeUpdateType }): Promise<EpisodeUpdate> {
  const userId = await getUserId();
  const row = { ...input, user_id: userId };

  if (!isSupabaseConfigured()) {
    const db = localDb();
    const update: EpisodeUpdate = { id: uid(), ...row, created_at: new Date().toISOString() };
    db.updates.push(update);
    saveLocal(db);
    await trackEvent("episode_update_added", input.episode_id, null, { update_type: input.update_type });
    return update;
  }

  const supabase = getSupabase()!;
  const { data, error } = await supabase.from("episode_updates").insert(row).select("*").single();
  if (error) throw error;
  await trackEvent("episode_update_added", input.episode_id, null, { update_type: input.update_type });
  return data as EpisodeUpdate;
}

export async function trackEvent(
  eventName: string,
  episodeId: string | null,
  interventionId: string | null,
  properties: Record<string, unknown> = {},
) {
  if (!isSupabaseConfigured()) {
    const db = localDb();
    db.telemetry.push({ id: uid(), event_name: eventName, episode_id: episodeId, intervention_id: interventionId, properties, created_at: new Date().toISOString() });
    saveLocal(db);
    return;
  }

  const userId = await getUserId();
  const supabase = getSupabase()!;
  const { error } = await supabase.from("telemetry_events").insert({ user_id: userId, event_name: eventName, episode_id: episodeId, intervention_id: interventionId, properties });
  if (error) console.warn("Telemetry insert failed", error.message);
}
