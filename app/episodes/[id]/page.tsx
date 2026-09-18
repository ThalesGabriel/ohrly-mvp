"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, GitBranch, MessageSquarePlus, Plus, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { Button, Field, inputClass } from "@/components/ui";
import { ErrorBox } from "@/components/error-box";
import { LoadingBlock } from "@/components/loading";
import { StateBadge } from "@/components/state-badge";
import { PrecedentTabPanel } from "@/components/precedent-tab";
import { deriveDisplayState, nextStepForState } from "@/lib/display";
import { buildEpisodeSignature, type EpisodeSignature } from "@/lib/episode-signature";
import { findBestPrecedentCandidate, PRECEDENT_MATCHER_VERSION } from "@/lib/precedent-matcher";
import {
  getAccountPrivateData,
  getAllAccountPrivateData,
  getEpisodeAlias,
  getEpisodeNote,
  getEpisodeUpdateText,
  getInterventionObjective,
  setEpisodeUpdateText,
  setInterventionObjective,
} from "@/lib/local-private";
import {
  closeEpisode,
  createEpisodeUpdate,
  createIntervention,
  createPrecedentSuggestion,
  createReview,
  getEpisode,
  listAccounts,
  listAllEpisodeUpdates,
  listEpisodeRelationships,
  listEpisodes,
  listInterventions,
  listPrecedentSuggestionsForEpisode,
  listReviews,
  markPrecedentPresented,
  trackEvent,
  updateEpisodeAccount,
  updateEpisodeDecision,
  updateExecutionState,
} from "@/lib/repository";
import {
  ageBucketLabels,
  changeTypeLabels,
  decisionImpactLabels,
  episodeRelationshipTypeLabels,
  episodeUpdateTypeLabels,
  interventionTypeLabels,
  outcomeLabels,
  type Account,
  type DecisionImpact,
  type Episode,
  type EpisodeRelationship,
  type EpisodeUpdate,
  type EpisodeUpdateType,
  type ExecutionState,
  type Intervention,
  type InterventionType,
  type Outcome,
  type PrecedentSuggestion,
  type Review,
} from "@/lib/types";

type TimelineItem =
  | { kind: "episode"; at: string; key: string }
  | { kind: "update"; at: string; key: string; update: EpisodeUpdate }
  | { kind: "intervention"; at: string; key: string; intervention: Intervention }
  | { kind: "execution"; at: string; key: string; intervention: Intervention }
  | { kind: "review"; at: string; key: string; review: Review };

type EpisodeTab = "current" | "action" | "precedent" | "continuity" | "history";

export default function EpisodeWorkspacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id;
  const requestedTab = searchParams.get("tab");

  const [episode, setEpisode] = useState<Episode | null>(null);
  const [intervention, setIntervention] = useState<Intervention | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [updates, setUpdates] = useState<EpisodeUpdate[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [relationships, setRelationships] = useState<EpisodeRelationship[]>([]);
  const [relatedEpisodes, setRelatedEpisodes] = useState<Episode[]>([]);
  const [precedentSuggestion, setPrecedentSuggestion] = useState<PrecedentSuggestion | null>(null);
  const [precedentEpisode, setPrecedentEpisode] = useState<Episode | null>(null);
  const [precedentIntervention, setPrecedentIntervention] = useState<Intervention | null>(null);
  const [precedentReview, setPrecedentReview] = useState<Review | null>(null);
  const [currentSignature, setCurrentSignature] = useState<EpisodeSignature | null>(null);
  const [precedentSignature, setPrecedentSignature] = useState<EpisodeSignature | null>(null);
  const [legacyAccountId, setLegacyAccountId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showIntervention, setShowIntervention] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);
  const [showReview, setShowReview] = useState(false);

  const [interventionType, setInterventionType] = useState<InterventionType>("csm_contact");
  const [objective, setObjective] = useState("");
  const [ownerRole, setOwnerRole] = useState("CSM responsável");
  const [deadlineHours, setDeadlineHours] = useState(24);
  const [reviewDays, setReviewDays] = useState(7);

  const [updateType, setUpdateType] = useState<EpisodeUpdateType>("customer_replied");
  const [updateText, setUpdateText] = useState("");

  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [impact, setImpact] = useState<DecisionImpact>("maybe");

  const load = useCallback(async () => {
    try {
      setError("");
      const ep = await getEpisode(id);
      setEpisode(ep);
      if (!ep) return;
      if (!ep.account_id) setAccounts(await listAccounts());
      else setAccounts([]);

      const [allRelationships, allEpisodes, allInterventions, allReviews, allUpdates] = await Promise.all([
        listEpisodeRelationships(),
        listEpisodes(),
        listInterventions(),
        listReviews(),
        listAllEpisodeUpdates(),
      ]);

      const relevantRelationships = allRelationships.filter((relationship) =>
        relationship.source_episode_id === id || relationship.target_episode_id === id,
      );
      const relatedIds = new Set(relevantRelationships.flatMap((relationship) => [relationship.source_episode_id, relationship.target_episode_id]));
      relatedIds.delete(id);
      setRelationships(relevantRelationships);
      setRelatedEpisodes(allEpisodes.filter((candidate) => relatedIds.has(candidate.id)));

      const currentInterventions = allInterventions
        .filter((candidate) => candidate.episode_id === id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      const int = currentInterventions[0] ?? null;
      const currentUpdates = allUpdates
        .filter((candidate) => candidate.episode_id === id)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
      const currentReviews = allReviews
        .filter((candidate) => candidate.episode_id === id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));

      setIntervention(int);
      setUpdates(currentUpdates);
      setReviews(currentReviews);
      setObjective(int ? getInterventionObjective(int.id) : "");
      setCurrentSignature(buildEpisodeSignature({
        episode: ep,
        updates: allUpdates,
        interventions: allInterventions,
        reviews: allReviews,
        relationships: allRelationships,
      }));

      setPrecedentSuggestion(null);
      setPrecedentEpisode(null);
      setPrecedentIntervention(null);
      setPrecedentReview(null);
      setPrecedentSignature(null);

      // Precedents are deliberately non-blocking: an unapplied migration or matcher failure
      // must never prevent the CSM from working the Episode itself.
      // The v2 matcher reads the structured trajectory first; local free text only reinforces
      // a structural match. Accepted precedents remain visible after the Episode closes.
      if (ep.account_id) {
        try {
          const existingSuggestions = await listPrecedentSuggestionsForEpisode(id);
          const acceptedSuggestion = existingSuggestions.find((suggestion) =>
            Boolean(suggestion.feedback && suggestion.feedback !== "not_relevant")
          ) ?? null;
          let activeSuggestion = acceptedSuggestion
            ?? (!ep.closed_at ? existingSuggestions.find((suggestion) => !suggestion.feedback) ?? null : null);

          if (!ep.closed_at && !activeSuggestion && existingSuggestions.length === 0) {
            const match = findBestPrecedentCandidate({
              currentEpisode: ep,
              episodes: allEpisodes,
              updates: allUpdates,
              interventions: allInterventions,
              reviews: allReviews,
              relationships: allRelationships,
              existingSuggestions,
            });

            if (match) {
              activeSuggestion = await createPrecedentSuggestion({
                current_episode_id: ep.id,
                precedent_episode_id: match.precedentEpisode.id,
                origin: "heuristic",
                evidence_codes: match.evidenceCodes,
                rank_score: match.rankScore,
                matcher_version: PRECEDENT_MATCHER_VERSION,
              });
            }
          }

          if (activeSuggestion) {
            const priorEpisode = allEpisodes.find((candidate) => candidate.id === activeSuggestion!.precedent_episode_id) ?? null;
            const priorIntervention = priorEpisode
              ? allInterventions
                  .filter((candidate) => candidate.episode_id === priorEpisode.id)
                  .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null
              : null;
            const priorReviews = priorEpisode
              ? allReviews
                  .filter((candidate) => candidate.episode_id === priorEpisode.id)
                  .sort((a, b) => b.created_at.localeCompare(a.created_at))
              : [];
            const priorReview = priorReviews.find((review) => review.outcome !== "too_early") ?? null;

            if (priorEpisode && priorReview) {
              setPrecedentSuggestion(activeSuggestion);
              setPrecedentEpisode(priorEpisode);
              setPrecedentIntervention(priorIntervention);
              setPrecedentReview(priorReview);
              setPrecedentSignature(buildEpisodeSignature({
                episode: priorEpisode,
                updates: allUpdates,
                interventions: allInterventions,
                reviews: allReviews,
                relationships: allRelationships,
              }));
            }
          }
        } catch (precedentError) {
          console.warn("Precedent discovery unavailable", precedentError);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load().then(() => trackEvent("episode_viewed", id, null, {}));
  }, [id, load]);

  const hasContinuity = relationships.length > 0;

  const episodeTabs: { id: EpisodeTab; label: string }[] = [
    { id: "current", label: "Agora" },
    { id: "action", label: "Ação" },
    ...(precedentSuggestion ? [{ id: "precedent" as const, label: "Precedente" }] : []),
    ...(hasContinuity ? [{ id: "continuity" as const, label: "Continuidade" }] : []),
    { id: "history", label: "Histórico" },
  ];

  const activeTab: EpisodeTab = episodeTabs.some((tab) => tab.id === requestedTab)
    ? requestedTab as EpisodeTab
    : "current";

  useEffect(() => {
    if (activeTab !== "precedent" || !precedentSuggestion || precedentSuggestion.presented_at) return;

    let cancelled = false;
    markPrecedentPresented(precedentSuggestion)
      .then((updated) => {
        if (!cancelled) setPrecedentSuggestion(updated);
      })
      .catch((presentedError) => {
        console.warn("Could not mark precedent as presented", presentedError);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, precedentSuggestion]);

  const latestReview = reviews[0] ?? null;
  const state = episode ? deriveDisplayState(episode, intervention, latestReview) : "attention";

  const timeline = useMemo<TimelineItem[]>(() => {
    if (!episode) return [];
    const items: TimelineItem[] = [{ kind: "episode", at: episode.created_at, key: `ep-${episode.id}` }];
    for (const update of updates) items.push({ kind: "update", at: update.created_at, key: `up-${update.id}`, update });
    if (intervention) {
      items.push({ kind: "intervention", at: intervention.created_at, key: `int-${intervention.id}`, intervention });
      if (intervention.execution_updated_at) {
        items.push({ kind: "execution", at: intervention.execution_updated_at, key: `exec-${intervention.id}-${intervention.execution_updated_at}`, intervention });
      }
    }
    for (const review of reviews) items.push({ kind: "review", at: review.created_at, key: `rev-${review.id}`, review });
    return items.sort((a, b) => a.at.localeCompare(b.at));
  }, [episode, intervention, reviews, updates]);

  async function withSaving(fn: () => Promise<void>) {
    try {
      setSaving(true);
      setError("");
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setSaving(false);
    }
  }

  async function saveIntervention() {
    if (!episode) return;
    await withSaving(async () => {
      const int = await createIntervention({
        episode_id: episode.id,
        intervention_type: interventionType,
        owner_role: ownerRole,
        execution_deadline_hours: deadlineHours,
        review_window_days: reviewDays,
      });
      if (objective.trim()) setInterventionObjective(int.id, objective.trim());
      setShowIntervention(false);
    });
  }

  async function setExecution(next: ExecutionState) {
    if (!episode || !intervention) return;
    await withSaving(async () => {
      await updateExecutionState(intervention.id, episode.id, next);
    });
  }

  async function addUpdate() {
    if (!episode) return;
    await withSaving(async () => {
      const update = await createEpisodeUpdate({ episode_id: episode.id, update_type: updateType });
      if (updateText.trim()) setEpisodeUpdateText(update.id, updateText.trim());
      setUpdateText("");
      setShowUpdate(false);
    });
  }

  async function saveReview() {
    if (!episode || !intervention || !outcome) return;
    await withSaving(async () => {
      await createReview({ intervention_id: intervention.id, episode_id: episode.id, outcome, decision_impact: impact });
      setOutcome(null);
      setImpact("maybe");
      setShowReview(false);
    });
  }

  async function linkAccount() {
    if (!episode || !legacyAccountId) return;
    await withSaving(async () => {
      await updateEpisodeAccount(episode.id, legacyAccountId);
      setLegacyAccountId("");
    });
  }

  async function keepWatching() {
    if (!episode) return;
    await withSaving(async () => {
      await updateEpisodeDecision(episode.id, "watch");
    });
  }

  async function closeCycle() {
    if (!episode) return;
    await withSaving(async () => {
      await closeEpisode(episode.id);
    });
  }

  function primaryAction() {
    if (!episode || episode.closed_at) return;
    if (!intervention) {
      setShowIntervention(true);
      router.replace(`/episodes/${episode.id}?tab=action`);
      return;
    }
    if (state === "execution_pending") {
      setExecution("executed");
      return;
    }
    if (state === "exception") {
      setExecution("planned");
      return;
    }
    if (["waiting_response", "recovering", "review_due"].includes(state)) {
      setShowReview(true);
      router.replace(`/episodes/${episode.id}?tab=action`);
      return;
    }
    setShowUpdate(true);
    router.replace(`/episodes/${episode.id}?tab=action`);
  }

  if (loading) return <AppShell><LoadingBlock /></AppShell>;
  if (error && !episode) return <AppShell><ErrorBox message={error} /></AppShell>;
  if (!episode) return <AppShell><ErrorBox message="Episódio não encontrado." /></AppShell>;

  const alias = getEpisodeAlias(episode.id);
  const accountData = episode.account_id ? getAccountPrivateData(episode.account_id) : null;
  const accountPrivateData = getAllAccountPrivateData();
  const note = getEpisodeNote(episode.id);
  const canClose = Boolean(latestReview && latestReview.outcome !== "too_early" && !episode.closed_at);
  const incomingRelationship = relationships.find((relationship) => relationship.target_episode_id === episode.id) ?? null;
  const previousEpisode = incomingRelationship ? relatedEpisodes.find((candidate) => candidate.id === incomingRelationship.source_episode_id) ?? null : null;
  const outgoingRelationships = relationships.filter((relationship) => relationship.source_episode_id === episode.id);

  return (
    <AppShell>
      <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="text-sm font-extrabold uppercase tracking-[0.11em] text-gray-400">{accountData ? <>CONTA · <Link href={`/accounts/${episode.account_id}`} className="hover:text-gray-700 hover:underline">{accountData.name}</Link></> : "CONTA NÃO VINCULADA"}</div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.04em]">{alias}</h1>
          <p className="mt-2 text-sm text-gray-500">{changeTypeLabels[episode.change_type]} · mudança percebida há {ageBucketLabels[episode.age_bucket]}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/" className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-gray-50"><ArrowLeft size={15} /> Voltar à fila</Link>
          {!episode.closed_at ? <button type="button" onClick={() => { setShowUpdate(true); router.replace(`/episodes/${episode.id}?tab=action`); }} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-100"><MessageSquarePlus size={15} /> Atualização</button> : null}
        </div>
      </div>

      {error ? <div className="mb-4"><ErrorBox message={error} /></div> : null}

      {!episode.account_id ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm font-semibold text-amber-950">Este é um episódio legado sem conta vinculada.</div>
          <div className="mt-1 text-sm leading-5 text-amber-800">A v0.1 preserva episódios antigos, mas novos ciclos passam a pertencer a uma conta.</div>
          {accounts.length ? <div className="mt-3 flex max-w-xl gap-2"><select className={inputClass} value={legacyAccountId} onChange={(e) => setLegacyAccountId(e.target.value)}><option value="">Escolha a conta...</option>{accounts.map((account) => <option key={account.id} value={account.id}>{accountPrivateData[account.id]?.name || `Conta ${account.id.slice(0, 6).toUpperCase()}`}</option>)}</select><Button onClick={linkAccount} disabled={!legacyAccountId || saving}>Vincular</Button></div> : <Link href="/accounts" className="mt-3 inline-flex text-sm font-semibold text-amber-900 underline underline-offset-4">Cadastrar ou importar contas</Link>}
        </div>
      ) : null}

      <nav className="mb-5 overflow-x-auto border-b border-gray-200" aria-label="Seções do episódio">
        <div className="flex min-w-max gap-6">
          {episodeTabs.map((tab) => {
            const hasUnreadPrecedent = tab.id === "precedent" && Boolean(precedentSuggestion && !precedentSuggestion.presented_at);
            return (
              <Link
                key={tab.id}
                href={`/episodes/${episode.id}?tab=${tab.id}`}
                className={`relative border-b-2 px-1 pb-3 text-sm font-semibold transition ${activeTab === tab.id ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-700"}`}
              >
                <span className="relative inline-flex items-center">
                  {tab.label}
                  {hasUnreadPrecedent ? (
                    <span
                      aria-label="Novo precedente"
                      className="absolute -right-2.5 h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white"
                    />
                  ) : null}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {activeTab === "current" ? <div className="space-y-4">
        <section className="rounded-[18px] border border-gray-200 bg-white p-5 shadow-soft">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-extrabold uppercase tracking-[0.1em] text-gray-400">Estado atual</div>
              <div className="mt-3 flex flex-wrap items-center gap-3"><StateBadge state={state} />{episode.closed_at ? <span className="text-sm font-semibold text-gray-400">Encerrado em {formatShortDate(episode.closed_at)}</span> : null}</div>
              <div className="mt-4 text-2xl font-extrabold tracking-[-0.03em]">{nextStepForState(state)}</div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">Comece pelo que este ciclo pede agora. Ação e histórico ficam disponíveis quando você precisar aprofundar; continuidade aparece quando houver um vínculo entre ciclos.</p>
            </div>

            <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-[360px] lg:grid-cols-2">
              {accountData ? <Info label="Conta" value={accountData.name} /> : null}
              <Info label="Sinal" value={changeTypeLabels[episode.change_type]} />
              <Info label="Persistência" value={ageBucketLabels[episode.age_bucket]} />
              {latestReview ? <Info label="Última revisão" value={outcomeLabels[latestReview.outcome]} /> : <Info label="Última revisão" value="Ainda não realizada" />}
            </div>
          </div>
          {!episode.closed_at ? 
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={primaryAction} disabled={saving}>
                    {PrimaryActionLabel(state, Boolean(intervention))}
                  </Button>
                  
                  {!intervention ? 
                    <Button variant="secondary" onClick={keepWatching} disabled={saving}>
                      Continuar observando
                    </Button> 
                    : 
                    null
                  }
                  
                  {canClose ? 
                    <Button variant="secondary" onClick={closeCycle} disabled={saving}>
                      Fechar ciclo
                    </Button> 
                    : 
                    null
                  }
                </div> 
                : 
                <div className="mt-4 flex flex-wrap gap-2 justify-between">
                  <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                    <Check size={15} /> 
                    Ciclo encerrado e preservado
                  </div>

                  {episode.account_id ? 
                    <Link href={`/episodes/new?accountId=${episode.account_id}&relatedTo=${episode.id}`} className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800">
                      <Plus size={15} /> 
                      Algo relacionado aconteceu
                    </Link> 
                    : 
                    null
                  }
                </div>
              }

        </section>

        {incomingRelationship && previousEpisode ? <section className="rounded-[18px] border border-indigo-100 bg-indigo-50/40 p-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2"><GitBranch size={14} className="text-indigo-600" /><span className="text-sm font-bold text-indigo-800">{episodeRelationshipTypeLabels[incomingRelationship.relationship_type]} de um ciclo anterior</span><span className="text-sm font-semibold text-indigo-500">· {elapsedLabel(previousEpisode.closed_at ?? previousEpisode.created_at, episode.created_at)}</span></div>
              <div className="mt-2 text-sm font-semibold text-gray-900">{getEpisodeAlias(previousEpisode.id)}</div>
              <div className="mt-1 text-sm text-gray-500">{changeTypeLabels[previousEpisode.change_type]} · {previousEpisode.closed_at ? `fechado em ${formatShortDate(previousEpisode.closed_at)}` : "ainda aberto"}</div>
            </div>
            <Link href={`/episodes/${episode.id}?tab=continuity`} className="text-sm font-semibold text-indigo-700 hover:underline">Ver continuidade →</Link>
          </div>
        </section> : outgoingRelationships.length ? <section className="rounded-[18px] border border-gray-200 bg-white p-4 shadow-soft"><div className="flex items-center justify-between gap-3"><div><div className="text-sm font-extrabold uppercase tracking-[0.1em] text-gray-400">Continuidade</div><div className="mt-1 text-sm font-semibold">Este ciclo tem {outgoingRelationships.length} continuidade(s) registrada(s)</div></div><Link href={`/episodes/${episode.id}?tab=continuity`} className="text-sm font-semibold text-indigo-700 hover:underline">Ver →</Link></div></section> : null}

      </div> : null}

      {activeTab === "precedent" && precedentSuggestion && precedentEpisode && precedentReview && currentSignature && precedentSignature ? (
        <PrecedentTabPanel
          currentEpisode={episode}
          precedentEpisode={precedentEpisode}
          currentSignature={currentSignature}
          precedentSignature={precedentSignature}
          precedentIntervention={precedentIntervention}
          precedentReview={precedentReview}
          suggestion={precedentSuggestion}
          onReviewed={(updated) => {
            if (updated.feedback === "not_relevant") {
              setPrecedentSuggestion(null);
              setPrecedentEpisode(null);
              setPrecedentIntervention(null);
              setPrecedentReview(null);
              setPrecedentSignature(null);
              router.replace(`/episodes/${episode.id}?tab=current`);
              return;
            }
            setPrecedentSuggestion(updated);
          }}
        />
      ) : null}

      {activeTab === "action" ? <div className="space-y-4">
        <section className="rounded-[18px] border border-gray-200 bg-white p-5 shadow-soft">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <div className="text-sm font-extrabold uppercase tracking-[0.1em] text-gray-400">Ação</div>
              <h2 className="mt-1 font-semibold">Decisão, intervenção e resposta</h2>
              <p className="mt-1 max-w-3xl text-sm leading-5 text-gray-500">Aqui ficam as ações do ciclo. Exposição não é execução; execução não é outcome.</p>
            </div>
            {!episode.closed_at ? <StateBadge state={state} /> : null}
          </div>

          {!intervention ? <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <div className="text-sm font-semibold">Nenhuma intervenção registrada</div>
            <p className="mt-1 text-sm leading-5 text-gray-500">Continue observando enquanto ainda não houver evidência suficiente ou registre uma ação quando este ciclo pedir intervenção.</p>
            {!episode.closed_at ? <div className="mt-3 flex flex-wrap gap-2"><Button variant="secondary" onClick={keepWatching} disabled={saving}>Continuar observando</Button><Button onClick={() => setShowIntervention((value) => !value)} disabled={saving}>Intervir</Button><Button variant="secondary" onClick={() => setShowUpdate(true)}>Adicionar atualização</Button></div> : null}
          </div> : <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 p-4">
              <div className="text-sm font-bold uppercase tracking-wider text-gray-400">Intervenção</div>
              <div className="mt-2 text-sm font-semibold">{interventionTypeLabels[intervention.intervention_type]}</div>
              {getInterventionObjective(intervention.id) ? <p className="mt-2 text-sm leading-5 text-gray-500">{getInterventionObjective(intervention.id)}</p> : null}
              <div className="mt-3 grid gap-2 sm:grid-cols-2"><Info label="Owner" value={intervention.owner_role} /><Info label="Execução" value={intervention.execution_state.toUpperCase()} /></div>
            </div>
            <div className="rounded-2xl border border-gray-200 p-4">
              <div className="text-sm font-bold uppercase tracking-wider text-gray-400">Resposta observada</div>
              {latestReview ? <><div className="mt-2 text-sm font-semibold">{outcomeLabels[latestReview.outcome]}</div><div className="mt-2 text-sm text-gray-500">Impacto percebido na decisão: <span className="font-semibold text-gray-700">{decisionImpactLabels[latestReview.decision_impact]}</span></div></> : <div className="mt-2 text-sm font-semibold text-gray-500">Ainda sem revisão</div>}
            </div>
          </div>}

          {intervention?.execution_state === "planned" && !episode.closed_at ? <div className="mt-3 flex flex-wrap gap-2"><Button onClick={() => setExecution("executed")} disabled={saving}>Marcar como executada</Button><Button variant="danger" onClick={() => setExecution("exception")} disabled={saving}>Registrar exceção</Button><Button variant="secondary" onClick={() => setShowUpdate(true)}>Adicionar atualização</Button></div> : null}
          {intervention?.execution_state === "exception" && !episode.closed_at ? <div className="mt-3 flex flex-wrap gap-2"><Button onClick={() => setExecution("planned")} disabled={saving}><span className="inline-flex items-center gap-2"><RotateCcw size={14} /> Nova tentativa</span></Button><Button variant="secondary" onClick={() => setShowUpdate(true)}>Adicionar contexto</Button></div> : null}
          {intervention?.execution_state === "executed" && !episode.closed_at ? <div className="mt-3 flex flex-wrap gap-2"><Button onClick={() => setShowReview((value) => !value)} disabled={saving}>Revisar resposta</Button><Button variant="secondary" onClick={() => setShowUpdate(true)}>Adicionar atualização</Button>{canClose ? <Button variant="secondary" onClick={closeCycle} disabled={saving}>Fechar ciclo</Button> : null}</div> : null}

          {showIntervention && !intervention ? (
            <InlinePanel title="Registrar intervenção" onClose={() => setShowIntervention(false)}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="O que vamos fazer?">
                  <select className={inputClass} value={interventionType} onChange={(e) => setInterventionType(e.target.value as InterventionType)}>
                    {Object.entries(interventionTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </Field>
                <Field label="Owner / papel"><input className={inputClass} value={ownerRole} onChange={(e) => setOwnerRole(e.target.value)} /></Field>
              </div>
              <Field label="Objetivo" hint="Texto livre fica somente neste navegador."><input className={inputClass} value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Entender bloqueio e recuperar engajamento" /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Prazo de execução"><select className={inputClass} value={deadlineHours} onChange={(e) => setDeadlineHours(Number(e.target.value))}><option value={8}>8 horas</option><option value={24}>24 horas</option><option value={48}>48 horas</option><option value={72}>3 dias</option></select></Field>
                <Field label="Revisar em"><select className={inputClass} value={reviewDays} onChange={(e) => setReviewDays(Number(e.target.value))}><option value={3}>3 dias</option><option value={7}>7 dias</option><option value={14}>14 dias</option><option value={30}>30 dias</option></select></Field>
              </div>
              <div className="flex gap-2"><Button onClick={saveIntervention} disabled={saving}>{saving ? "Salvando..." : "Registrar intervenção"}</Button><Button variant="secondary" onClick={() => setShowIntervention(false)}>Cancelar</Button></div>
            </InlinePanel>
          ) : null}

          {showUpdate ? (
            <InlinePanel title="Adicionar atualização" onClose={() => setShowUpdate(false)}>
              <Field label="Tipo de atualização">
                <select className={inputClass} value={updateType} onChange={(e) => setUpdateType(e.target.value as EpisodeUpdateType)}>
                  {Object.entries(episodeUpdateTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
              <Field label="Contexto" hint="Este texto fica somente no navegador; o backend recebe apenas o tipo estruturado."><textarea className={`${inputClass} min-h-20 resize-y`} value={updateText} onChange={(e) => setUpdateText(e.target.value)} placeholder="Ex.: usuário-chave respondeu e confirmou um bloqueio técnico." /></Field>
              <div className="flex gap-2"><Button onClick={addUpdate} disabled={saving}>{saving ? "Salvando..." : "Adicionar à timeline"}</Button><Button variant="secondary" onClick={() => setShowUpdate(false)}>Cancelar</Button></div>
            </InlinePanel>
          ) : null}

          {showReview && intervention ? (
            <InlinePanel title="Revisar resposta" onClose={() => setShowReview(false)}>
              <p className="mb-3 text-sm leading-5 text-gray-500">Não estamos afirmando causalidade. Registre apenas a leitura do estado atual depois da intervenção.</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {(Object.entries(outcomeLabels) as [Outcome, string][]).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setOutcome(value)} className={`rounded-xl border p-3 text-left text-sm font-semibold transition ${outcome === value ? "border-gray-900 bg-gray-50" : "border-gray-200 bg-white hover:border-gray-400"}`}>{label}</button>
                ))}
              </div>
              <div className="mt-3">
                <Field label="Isso mudou alguma decisão que você teria tomado sem o Ohrly?">
                  <select className={inputClass} value={impact} onChange={(e) => setImpact(e.target.value as DecisionImpact)}>
                    {(Object.entries(decisionImpactLabels) as [DecisionImpact, string][]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </Field>
              </div>
              <div className="flex gap-2"><Button onClick={saveReview} disabled={!outcome || saving}>{saving ? "Salvando..." : "Salvar revisão"}</Button><Button variant="secondary" onClick={() => setShowReview(false)}>Cancelar</Button></div>
            </InlinePanel>
          ) : null}
        </section>
      </div> : null}

      {activeTab === "continuity" ? <section className="rounded-[18px] border border-gray-200 bg-white p-5 shadow-soft">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <div className="text-sm font-extrabold uppercase tracking-[0.1em] text-gray-400">Continuidade</div>
            <h2 className="mt-1 font-semibold">Este ciclo dentro da história da conta</h2>
            <p className="mt-1 max-w-3xl text-sm leading-5 text-gray-500">O episódio preserva o que foi decidido neste ciclo. Relações mostram o que continuou, voltou ou ganhou contexto depois.</p>
          </div>
          {episode.closed_at && episode.account_id ? <Link href={`/episodes/new?accountId=${episode.account_id}&relatedTo=${episode.id}`} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"><Plus size={15} /> Algo relacionado aconteceu</Link> : null}
        </div>

        {incomingRelationship && previousEpisode ? <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
          <div className="flex flex-wrap items-center gap-2"><GitBranch size={14} className="text-indigo-600" /><span className="text-sm font-bold text-indigo-800">{episodeRelationshipTypeLabels[incomingRelationship.relationship_type]} do ciclo anterior</span><span className="text-sm font-semibold text-indigo-500">· {elapsedLabel(previousEpisode.closed_at ?? previousEpisode.created_at, episode.created_at)}</span></div>
          <Link href={`/episodes/${previousEpisode.id}`} onClick={() => trackEvent("continuity_context_viewed", episode.id, null, { source_episode_id: previousEpisode.id })} className="mt-3 block rounded-xl border border-indigo-100 bg-white p-3 transition hover:border-indigo-300">
            <div className="text-sm font-bold uppercase tracking-wider text-gray-400">Ciclo anterior</div>
            <div className="mt-1 text-sm font-semibold text-gray-900">{getEpisodeAlias(previousEpisode.id)}</div>
            <div className="mt-1 text-sm text-gray-500">{changeTypeLabels[previousEpisode.change_type]} · {previousEpisode.closed_at ? `fechado em ${formatShortDate(previousEpisode.closed_at)}` : "ainda aberto"}</div>
          </Link>
        </div> : null}

        {outgoingRelationships.length ? <div className="mt-4">
          <div className="text-sm font-bold uppercase tracking-wider text-gray-400">O que veio depois deste ciclo</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">{outgoingRelationships.map((relationship) => {
            const target = relatedEpisodes.find((candidate) => candidate.id === relationship.target_episode_id);
            if (!target) return null;
            return <Link key={relationship.id} href={`/episodes/${target.id}`} className="rounded-xl border border-gray-200 bg-gray-50 p-3 transition hover:border-gray-300">
              <div className="text-sm font-bold text-indigo-700">{episodeRelationshipTypeLabels[relationship.relationship_type]} · {elapsedLabel(episode.closed_at ?? episode.created_at, target.created_at)}</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">{getEpisodeAlias(target.id)}</div>
              <div className="mt-1 text-sm text-gray-500">{changeTypeLabels[target.change_type]}</div>
            </Link>;
          })}</div>
        </div> : null}

      </section> : null}

      {activeTab === "history" ? <section className="rounded-[18px] border border-gray-200 bg-white p-5 shadow-soft">
        <div>
          <div className="text-sm font-extrabold uppercase tracking-[0.1em] text-gray-400">Histórico</div>
          <h2 className="mt-1 font-semibold">História deste ciclo</h2>
          <p className="mt-1 text-sm leading-5 text-gray-500">Mudança, atualizações, intervenção, execução e resposta ficam aqui quando você precisa reconstruir como a decisão evoluiu.</p>
        </div>

        <div className="relative ml-2 mt-5 border-l-2 border-gray-200 pl-6">
          {timeline.map((item) => <TimelineEvent key={item.key} item={item} />)}
          {episode.closed_at ? <div className="relative pb-2"><div className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-600 ring-1 ring-gray-300" /><div className="text-sm font-bold uppercase tracking-wider text-gray-400">{formatShortDate(episode.closed_at)}</div><div className="mt-1 text-sm font-semibold">Ciclo encerrado</div><div className="mt-1 text-sm text-gray-500">A história deste episódio permanece preservada mesmo que outro ciclo seja relacionado depois.</div></div> : <div className="relative pb-2"><div className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-white bg-gray-300 ring-1 ring-gray-300" /><div className="text-sm font-bold uppercase tracking-wider text-gray-400">Próximo passo</div><div className="mt-1 text-sm font-semibold">{nextStepForState(state)}</div></div>}
        </div>
      </section> : null}
    </AppShell>
  );
}

function elapsedLabel(from: string, to: string) {
  const diff = Math.max(0, new Date(to).getTime() - new Date(from).getTime());
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "no mesmo dia";
  if (days === 1) return "1 dia depois";
  return `${days} dias depois`;
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function Signal({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-gray-200 bg-gray-50 p-3"><div className="text-sm font-bold uppercase tracking-wider text-gray-400">{label}</div><div className="mt-1 text-sm font-semibold text-gray-800">{value}</div></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-gray-100 bg-gray-50 p-3"><div className="text-sm font-bold uppercase tracking-wider text-gray-400">{label}</div><div className="mt-1 text-sm font-semibold text-gray-800">{value}</div></div>;
}

function InlinePanel({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">{title}</h3><button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-white hover:text-gray-700"><X size={16} /></button></div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function TimelineEvent({ item }: { item: TimelineItem }) {
  const date = new Date(item.at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  let title = "";
  let desc = "";
  let dot = "bg-gray-900";

  if (item.kind === "episode") {
    title = "Episódio registrado";
    desc = "O CSM percebeu uma mudança e decidiu acompanhá-la como um ciclo.";
  } else if (item.kind === "update") {
    title = episodeUpdateTypeLabels[item.update.update_type];
    desc = getEpisodeUpdateText(item.update.id) || "Atualização estruturada registrada no episódio.";
    if (item.update.update_type === "exception") dot = "bg-red-600";
  } else if (item.kind === "intervention") {
    title = `Intervenção planejada · ${interventionTypeLabels[item.intervention.intervention_type]}`;
    const objective = getInterventionObjective(item.intervention.id);
    desc = objective ? `Objetivo: ${objective}` : `Owner: ${item.intervention.owner_role}. Revisão em ${item.intervention.review_window_days} dias.`;
    dot = "bg-violet-600";
  } else if (item.kind === "execution") {
    title = item.intervention.execution_state === "executed" ? "Intervenção executada" : item.intervention.execution_state === "exception" ? "Exceção de execução" : "Nova tentativa planejada";
    desc = item.intervention.execution_state === "executed" ? "A ação foi confirmada. O ciclo agora acompanha a resposta posterior." : item.intervention.execution_state === "exception" ? "A execução saiu do planejado e precisa de uma decisão." : "A intervenção voltou ao estado planejado.";
    dot = item.intervention.execution_state === "executed" ? "bg-emerald-600" : item.intervention.execution_state === "exception" ? "bg-red-600" : "bg-violet-600";
  } else {
    title = `Revisão · ${outcomeLabels[item.review.outcome]}`;
    desc = `Impacto percebido na decisão: ${decisionImpactLabels[item.review.decision_impact]}.`;
    dot = item.review.outcome === "partial_recovery" || item.review.outcome === "recovered" ? "bg-emerald-600" : item.review.outcome === "worsened" || item.review.outcome === "relapse" ? "bg-red-600" : "bg-blue-600";
  }

  return (
    <div className="relative pb-6 last:pb-4">
      <div className={`absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-white ring-1 ring-gray-300 ${dot}`} />
      <div className="text-sm font-bold uppercase tracking-wider text-gray-400">{date}</div>
      <div className="mt-1 text-sm font-semibold">{title}</div>
      <div className="mt-1 max-w-3xl text-sm leading-5 text-gray-500">{desc}</div>
    </div>
  );
}

function PrimaryActionLabel(state: ReturnType<typeof deriveDisplayState>, hasIntervention: boolean) {
  if (!hasIntervention) return "Intervir";
  if (state === "execution_pending") return "Marcar como executada";
  if (state === "exception") return "Nova tentativa";
  if (state === "review_due") return "Revisar agora";
  if (state === "waiting_response" || state === "recovering") return "Revisar resposta";
  if (state === "closed") return "Ciclo fechado";
  return "Adicionar atualização";
}
