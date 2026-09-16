"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, MessageSquarePlus, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { Button, Field, inputClass } from "@/components/ui";
import { ErrorBox } from "@/components/error-box";
import { LoadingBlock } from "@/components/loading";
import { StateBadge } from "@/components/state-badge";
import { deriveDisplayState, nextStepForState } from "@/lib/display";
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
  createReview,
  getEpisode,
  getInterventionForEpisode,
  listAccounts,
  listEpisodeUpdates,
  listReviewsForIntervention,
  trackEvent,
  updateEpisodeAccount,
  updateEpisodeDecision,
  updateExecutionState,
} from "@/lib/repository";
import {
  ageBucketLabels,
  changeTypeLabels,
  decisionImpactLabels,
  episodeUpdateTypeLabels,
  interventionTypeLabels,
  outcomeLabels,
  type Account,
  type DecisionImpact,
  type Episode,
  type EpisodeUpdate,
  type EpisodeUpdateType,
  type ExecutionState,
  type Intervention,
  type InterventionType,
  type Outcome,
  type Review,
} from "@/lib/types";

type TimelineItem =
  | { kind: "episode"; at: string; key: string }
  | { kind: "update"; at: string; key: string; update: EpisodeUpdate }
  | { kind: "intervention"; at: string; key: string; intervention: Intervention }
  | { kind: "execution"; at: string; key: string; intervention: Intervention }
  | { kind: "review"; at: string; key: string; review: Review };

export default function EpisodeWorkspacePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [episode, setEpisode] = useState<Episode | null>(null);
  const [intervention, setIntervention] = useState<Intervention | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [updates, setUpdates] = useState<EpisodeUpdate[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
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
      const int = await getInterventionForEpisode(id);
      setIntervention(int);
      setUpdates(await listEpisodeUpdates(id));
      if (int) {
        const rs = await listReviewsForIntervention(int.id);
        setReviews(rs);
        setObjective(getInterventionObjective(int.id));
      } else {
        setReviews([]);
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
      return;
    }
    setShowUpdate(true);
  }

  if (loading) return <AppShell><LoadingBlock /></AppShell>;
  if (error && !episode) return <AppShell><ErrorBox message={error} /></AppShell>;
  if (!episode) return <AppShell><ErrorBox message="Episódio não encontrado." /></AppShell>;

  const alias = getEpisodeAlias(episode.id);
  const accountData = episode.account_id ? getAccountPrivateData(episode.account_id) : null;
  const accountPrivateData = getAllAccountPrivateData();
  const note = getEpisodeNote(episode.id);
  const canClose = Boolean(latestReview && latestReview.outcome !== "too_early" && !episode.closed_at);

  return (
    <AppShell>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-[0.11em] text-gray-400">{accountData ? <>CONTA · <Link href={`/accounts/${episode.account_id}`} className="hover:text-gray-700 hover:underline">{accountData.name}</Link></> : "CONTA NÃO VINCULADA"}</div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.04em]">{alias}</h1>
          <p className="mt-2 text-sm text-gray-500">{changeTypeLabels[episode.change_type]} · mudança percebida há {ageBucketLabels[episode.age_bucket]} · toda a história fica no mesmo workspace.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/" className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-gray-50"><ArrowLeft size={15} /> Voltar à fila</Link>
          {!episode.closed_at ? <Button variant="light" onClick={() => setShowUpdate(true)}><span className="inline-flex items-center gap-2"><MessageSquarePlus size={15} /> Atualização</span></Button> : null}
        </div>
      </div>

      {error ? <div className="mb-4"><ErrorBox message={error} /></div> : null}

      {!episode.account_id ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm font-semibold text-amber-950">Este é um episódio legado sem conta vinculada.</div>
          <div className="mt-1 text-xs leading-5 text-amber-800">A v0.1 preserva episódios antigos, mas novos ciclos passam a pertencer a uma conta.</div>
          {accounts.length ? <div className="mt-3 flex max-w-xl gap-2"><select className={inputClass} value={legacyAccountId} onChange={(e) => setLegacyAccountId(e.target.value)}><option value="">Escolha a conta...</option>{accounts.map((account) => <option key={account.id} value={account.id}>{accountPrivateData[account.id]?.name || `Conta ${account.id.slice(0, 6).toUpperCase()}`}</option>)}</select><Button onClick={linkAccount} disabled={!legacyAccountId || saving}>Vincular</Button></div> : <Link href="/accounts" className="mt-3 inline-flex text-xs font-semibold text-amber-900 underline underline-offset-4">Cadastrar ou importar contas</Link>}
        </div>
      ) : null}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_310px]">
        <div className="space-y-4">
          <section className="rounded-[18px] border border-gray-200 bg-white p-5 shadow-soft">
            <div>
              <h2 className="font-semibold">Trajetória do episódio</h2>
              <p className="mt-1 text-xs leading-5 text-gray-500">O ponto não é um alerta isolado, mas a história de uma mudança que persiste, recebe uma intervenção e produz uma resposta.</p>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-b from-white to-gray-50 p-4">
              <svg viewBox="0 0 800 145" className="h-40 w-full" preserveAspectRatio="none" aria-label="Trajetória ilustrativa do episódio">
                <line x1="0" y1="42" x2="800" y2="42" stroke="#d1d5db" strokeWidth="2" strokeDasharray="6 6" />
                <path d="M0 43 C90 39 150 45 220 41 C300 36 350 42 400 48 C455 55 500 72 548 82 C610 96 682 99 800 112" fill="none" stroke="#111827" strokeWidth="4" strokeLinecap="round" />
                <circle cx="400" cy="48" r="5" fill="#f59e0b" />
                <circle cx="548" cy="82" r="5" fill="#f59e0b" />
                <circle cx="800" cy="112" r="6" fill="#111827" />
                <text x="374" y="24" fontSize="11" fill="#6b7280">mudança</text>
                <text x="525" y="66" fontSize="11" fill="#6b7280">persistência</text>
                <text x="750" y="134" fontSize="11" fill="#111827">agora</text>
              </svg>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <Signal label="Sinal" value={changeTypeLabels[episode.change_type]} />
              <Signal label="Persistência percebida" value={ageBucketLabels[episode.age_bucket]} />
              <Signal label="Estado de entrada" value={episode.initial_state === "watch" ? "Observando" : episode.initial_state === "investigate" ? "Investigando" : "Ação considerada"} />
            </div>
            {note ? <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900"><strong>Nota local:</strong> {note}</div> : null}
          </section>

          <section className="rounded-[18px] border border-gray-200 bg-white p-5 shadow-soft">
            <div>
              <h2 className="font-semibold">Ciclo atual</h2>
              <p className="mt-1 text-xs leading-5 text-gray-500">Mudança, decisão, execução e resposta aparecem como uma única história em andamento.</p>
            </div>

            <div className="relative ml-2 mt-5 border-l-2 border-gray-200 pl-6">
              {timeline.map((item) => <TimelineEvent key={item.key} item={item} />)}

              {!episode.closed_at ? (
                <div className="relative pb-2">
                  <div className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-white bg-gray-300 ring-1 ring-gray-300" />
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Próximo passo</div>
                  <div className="mt-1 text-sm font-semibold">{nextStepForState(state)}</div>

                  {!intervention ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={keepWatching} disabled={saving}>Continuar observando</Button>
                      <Button onClick={() => setShowIntervention((v) => !v)} disabled={saving}>Intervir</Button>
                    </div>
                  ) : null}

                  {intervention?.execution_state === "planned" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button onClick={() => setExecution("executed")} disabled={saving}>Marcar como executada</Button>
                      <Button variant="danger" onClick={() => setExecution("exception")} disabled={saving}>Registrar exceção</Button>
                    </div>
                  ) : null}

                  {intervention?.execution_state === "exception" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button onClick={() => setExecution("planned")} disabled={saving}><span className="inline-flex items-center gap-2"><RotateCcw size={14} /> Nova tentativa</span></Button>
                      <Button variant="secondary" onClick={() => setShowUpdate(true)}>Adicionar contexto</Button>
                    </div>
                  ) : null}

                  {intervention?.execution_state === "executed" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button onClick={() => setShowReview((v) => !v)} disabled={saving}>Revisar resposta</Button>
                      <Button variant="secondary" onClick={() => setShowUpdate(true)}>Adicionar atualização</Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

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
                <p className="mb-3 text-xs leading-5 text-gray-500">Não estamos afirmando causalidade. Registre apenas a leitura do estado atual depois da intervenção.</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {(Object.entries(outcomeLabels) as [Outcome, string][]).map(([value, label]) => (
                    <button key={value} type="button" onClick={() => setOutcome(value)} className={`rounded-xl border p-3 text-left text-xs font-semibold transition ${outcome === value ? "border-gray-900 bg-gray-50" : "border-gray-200 bg-white hover:border-gray-400"}`}>{label}</button>
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
        </div>

        <aside className="xl:sticky xl:top-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-soft">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-gray-400">Estado atual</div>
            <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <StateBadge state={state} />
              <div className="mt-3 text-lg font-extrabold tracking-[-0.02em]">{nextStepForState(state)}</div>
              <p className="mt-2 text-xs leading-5 text-gray-500">A interface sempre aponta para a próxima decisão, não para uma próxima página.</p>
            </div>

            <div className="mt-3 space-y-2">
              {accountData ? <Info label="Conta" value={accountData.name} /> : null}
              <Info label="Episódio" value={alias} />
              <Info label="Sinal" value={changeTypeLabels[episode.change_type]} />
              <Info label="Persistência" value={ageBucketLabels[episode.age_bucket]} />
              <Info label="Intervenção" value={intervention ? interventionTypeLabels[intervention.intervention_type] : "Ainda não registrada"} />
              {intervention ? <Info label="Execution Reality" value={intervention.execution_state.toUpperCase()} /> : null}
              {latestReview ? <Info label="Última revisão" value={outcomeLabels[latestReview.outcome]} /> : null}
            </div>

            {!episode.closed_at ? <Button className="mt-4 w-full" onClick={primaryAction} disabled={saving}>{PrimaryActionLabel(state, Boolean(intervention))}</Button> : null}
            {canClose ? <Button variant="secondary" className="mt-2 w-full" onClick={closeCycle} disabled={saving}>Fechar ciclo</Button> : null}
            {episode.closed_at ? <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800"><Check size={15} /> Ciclo encerrado e preservado.</div> : null}
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-gray-200 bg-gray-50 p-3"><div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</div><div className="mt-1 text-xs font-semibold text-gray-800">{value}</div></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-gray-100 bg-gray-50 p-3"><div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</div><div className="mt-1 text-xs font-semibold text-gray-800">{value}</div></div>;
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
      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{date}</div>
      <div className="mt-1 text-sm font-semibold">{title}</div>
      <div className="mt-1 max-w-3xl text-xs leading-5 text-gray-500">{desc}</div>
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
