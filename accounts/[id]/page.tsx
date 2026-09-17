"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, GitBranch, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ErrorBox } from "@/components/error-box";
import { LoadingBlock } from "@/components/loading";
import { StateBadge } from "@/components/state-badge";
import { Pill } from "@/components/ui";
import { deriveDisplayState } from "@/lib/display";
import { getAccountPrivateData, getEpisodeAlias } from "@/lib/local-private";
import { getAccount, getInterventionForEpisode, listEpisodeRelationships, listEpisodes, listReviewsForIntervention } from "@/lib/repository";
import {
  ageBucketLabels,
  changeTypeLabels,
  episodeRelationshipTypeLabels,
  outcomeLabels,
  type Account,
  type Episode,
  type EpisodeRelationship,
  type EpisodeRelationshipType,
  type Intervention,
  type Review,
} from "@/lib/types";

type EpisodeRow = { episode: Episode; intervention: Intervention | null; latestReview: Review | null };
type AccountTab = "current" | "continuity" | "history" | "data";

const accountTabs: { id: AccountTab; label: string }[] = [
  { id: "current", label: "Contexto atual" },
  { id: "continuity", label: "Continuidade" },
  { id: "history", label: "Histórico" },
  { id: "data", label: "Dados" },
];

export default function AccountPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params.id;
  const requestedTab = searchParams.get("tab");
  const activeTab: AccountTab = accountTabs.some((tab) => tab.id === requestedTab) ? requestedTab as AccountTab : "current";

  const [account, setAccount] = useState<Account | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeRow[]>([]);
  const [relationships, setRelationships] = useState<EpisodeRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const acc = await getAccount(id);
      setAccount(acc);
      if (!acc) return;

      const [allEpisodes, allRelationships] = await Promise.all([listEpisodes(), listEpisodeRelationships()]);
      const accountEpisodes = allEpisodes.filter((episode) => episode.account_id === id);
      const accountEpisodeIds = new Set(accountEpisodes.map((episode) => episode.id));
      const accountRelationships = allRelationships.filter((relationship) =>
        accountEpisodeIds.has(relationship.source_episode_id) && accountEpisodeIds.has(relationship.target_episode_id),
      );

      const enriched = await Promise.all(accountEpisodes.map(async (episode) => {
        const intervention = await getInterventionForEpisode(episode.id);
        const reviews = intervention ? await listReviewsForIntervention(intervention.id) : [];
        return { episode, intervention, latestReview: reviews[0] ?? null };
      }));

      setEpisodes(enriched);
      setRelationships(accountRelationships);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const accountData = useMemo(() => account ? getAccountPrivateData(account.id) : null, [account]);
  const rowById = useMemo(() => new Map(episodes.map((row) => [row.episode.id, row])), [episodes]);
  const incomingByTarget = useMemo(() => new Map(relationships.map((relationship) => [relationship.target_episode_id, relationship])), [relationships]);
  const outgoingBySource = useMemo(() => {
    const map = new Map<string, EpisodeRelationship[]>();
    for (const relationship of relationships) {
      const current = map.get(relationship.source_episode_id) ?? [];
      current.push(relationship);
      map.set(relationship.source_episode_id, current);
    }
    return map;
  }, [relationships]);

  if (loading) return <AppShell><LoadingBlock /></AppShell>;
  if (error && !account) return <AppShell><ErrorBox message={error} /></AppShell>;
  if (!account || !accountData) return <AppShell><ErrorBox message="Conta não encontrada." /></AppShell>;

  const attributeEntries = Object.entries(accountData.attributes) as [string, string][];
  const currentContextEntries = selectCurrentContext(attributeEntries);
  const activeEpisodes = episodes.filter(({ episode }) => !episode.closed_at);
  const continuityRows = relationships
    .map((relationship) => ({ relationship, source: rowById.get(relationship.source_episode_id), target: rowById.get(relationship.target_episode_id) }))
    .filter((row): row is { relationship: EpisodeRelationship; source: EpisodeRow; target: EpisodeRow } => Boolean(row.source && row.target))
    .sort((a, b) => b.target.episode.created_at.localeCompare(a.target.episode.created_at));
  const recurrenceCount = relationships.filter((relationship) => relationship.relationship_type === "recurrence").length;

  return <AppShell>
    <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div>
        <div className="text-sm font-extrabold uppercase tracking-[0.11em] text-gray-400">CONTA · MEMÓRIA DA RELAÇÃO</div>
        <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.04em]">{accountData.name}</h1>
        <p className="mt-2 text-sm text-gray-500">{accountData.owner ? `Responsável: ${accountData.owner}` : "Responsável não informado"} · {episodes.length} episódio(s)</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/accounts" className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-gray-50"><ArrowLeft size={15} /> Voltar às contas</Link>
        <Link href={`/episodes/new?accountId=${account.id}`} className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"><Plus size={15} /> Novo episódio</Link>
      </div>
    </div>

    {error ? <div className="mb-4"><ErrorBox message={error} /></div> : null}

    <nav className="mb-5 overflow-x-auto border-b border-gray-200" aria-label="Seções da conta">
      <div className="flex min-w-max gap-6">
        {accountTabs.map((tab) => <Link key={tab.id} href={`/accounts/${account.id}?tab=${tab.id}`} className={`border-b-2 px-1 pb-3 text-sm font-semibold transition ${activeTab === tab.id ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-700"}`}>{tab.label}</Link>)}
      </div>
    </nav>

    {activeTab === "current" ? <div className="space-y-4">
      <section className="rounded-[18px] border border-gray-200 bg-white p-5 shadow-soft">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <div className="text-sm font-extrabold uppercase tracking-[0.1em] text-gray-400">Contexto atual</div>
            <h2 className="mt-1 font-semibold">O que preciso saber sobre esta conta agora?</h2>
            <p className="mt-1 text-sm leading-5 text-gray-500">O primeiro olhar reúne apenas contexto útil para retomar a conta e decidir onde colocar atenção.</p>
          </div>
          <div className="flex flex-wrap gap-2"><Pill tone={activeEpisodes.length ? "amber" : "green"}>{activeEpisodes.length} ativo(s)</Pill>{recurrenceCount ? <Pill tone="indigo">{recurrenceCount} recorrência(s)</Pill> : null}</div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {accountData.owner ? <Info label="Responsável" value={accountData.owner} /> : <Info label="Responsável" value="Não informado" />}
          {accountData.source ? <Info label="Fonte" value={accountData.source} /> : null}
          {currentContextEntries.map(([key, value]) => <Info key={key} label={humanizeKey(key)} value={value} />)}
        </div>
        {attributeEntries.length > currentContextEntries.length ? <Link href={`/accounts/${account.id}?tab=data`} className="mt-3 inline-flex text-sm font-semibold text-gray-600 underline underline-offset-4 hover:text-gray-900">Ver todos os dados importados</Link> : null}
      </section>

      <section className="rounded-[18px] border border-gray-200 bg-white p-5 shadow-soft">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <div className="text-sm font-extrabold uppercase tracking-[0.1em] text-gray-400">Atenção agora</div>
            <h2 className="mt-1 font-semibold">Episódios que ainda pedem uma decisão</h2>
          </div>
          {continuityRows.length ? <Link href={`/accounts/${account.id}?tab=continuity`} className="text-sm font-semibold text-indigo-700 hover:underline">Ver continuidade da conta →</Link> : null}
        </div>

        {activeEpisodes.length === 0 ? (
          <div className="mt-5 rounded-2xl bg-gray-50 p-5">
            <div className="text-sm font-semibold">Nenhum episódio ativo agora</div>
            <div className="mt-1 text-sm leading-5 text-gray-500">A conta não tem um ciclo aberto. O histórico permanece preservado para quando um novo contexto surgir.</div>
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            {activeEpisodes.map((row) => {
              const state = deriveDisplayState(row.episode, row.intervention, row.latestReview);
              const previous = incomingByTarget.get(row.episode.id);
              const source = previous ? rowById.get(previous.source_episode_id) : null;
              return <Link key={row.episode.id} href={`/episodes/${row.episode.id}`} className="rounded-2xl border border-gray-200 p-4 transition hover:border-gray-300 hover:bg-gray-50">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900">{getEpisodeAlias(row.episode.id)}</div>
                    <div className="mt-1 text-sm text-gray-500">{changeTypeLabels[row.episode.change_type]} · {ageBucketLabels[row.episode.age_bucket]}</div>
                    {previous && source ? <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-sm font-semibold text-indigo-700"><GitBranch size={13} /> {episodeRelationshipTypeLabels[previous.relationship_type]} de {getEpisodeAlias(source.episode.id)}</div> : null}
                  </div>
                  <StateBadge state={state} />
                </div>
              </Link>;
            })}
          </div>
        )}
      </section>
    </div> : null}

    {activeTab === "continuity" ? <section className="rounded-[18px] border border-gray-200 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-extrabold uppercase tracking-[0.1em] text-gray-400">Continuidade</div>
          <h2 className="mt-1 font-semibold">Como os ciclos desta conta se conectam</h2>
          <p className="mt-1 max-w-3xl text-sm leading-5 text-gray-500">Aqui aparecem apenas relações entre episódios. O ciclo anterior permanece intacto; o novo registro mostra se algo continuou, voltou ou se tornou contexto relevante.</p>
        </div>
        <Pill tone="indigo">{continuityRows.length} vínculo(s)</Pill>
      </div>

      {continuityRows.length ? <div className="mt-4 space-y-3">
        {continuityRows.map(({ relationship, source, target }) => {
          const elapsed = elapsedLabel(source.episode.closed_at ?? source.episode.created_at, target.episode.created_at);
          return <div key={relationship.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <RelationshipPill type={relationship.relationship_type} />
              <span className="text-sm font-semibold text-gray-400">{elapsed}</span>
            </div>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
              <EpisodeMiniCard row={source} label="Ciclo anterior" />
              <ArrowRight className="hidden text-gray-300 md:block" size={18} />
              <EpisodeMiniCard row={target} label="Novo ciclo" />
            </div>
          </div>;
        })}
      </div> : <div className="mt-5 rounded-2xl bg-gray-50 p-6 text-center"><div className="text-sm font-semibold">Nenhuma continuidade registrada ainda</div><div className="mt-1 text-sm leading-5 text-gray-500">Quando um novo episódio usar outro ciclo como contexto, essa relação aparecerá aqui.</div></div>}
    </section> : null}

    {activeTab === "history" ? <section className="rounded-[18px] border border-gray-200 bg-white p-5 shadow-soft">
      <div>
        <div className="text-sm font-extrabold uppercase tracking-[0.1em] text-gray-400">Histórico</div>
        <h2 className="mt-1 font-semibold">História da relação</h2>
        <p className="mt-1 text-sm leading-5 text-gray-500">A conta mostra os ciclos importantes. As atividades internas de cada investigação permanecem dentro do Episode Workspace para esta visão não virar uma megatimeline.</p>
      </div>
      {episodes.length === 0 ? <div className="mt-5 rounded-2xl bg-gray-50 p-6 text-center"><div className="text-sm font-semibold">Nenhum episódio ainda</div><div className="mt-1 text-sm text-gray-500">Abra um episódio quando algo começar a mudar e merecer acompanhamento.</div><Link href={`/episodes/new?accountId=${account.id}`} className="mt-4 inline-flex rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white">Criar primeiro episódio</Link></div> : <div className="relative ml-2 mt-5 border-l-2 border-gray-200 pl-6">{episodes.map((row) => {
        const { episode, intervention, latestReview } = row;
        const state = deriveDisplayState(episode, intervention, latestReview);
        const incoming = incomingByTarget.get(episode.id);
        const source = incoming ? rowById.get(incoming.source_episode_id) : null;
        const outgoing = outgoingBySource.get(episode.id) ?? [];
        return <div key={episode.id} className="relative pb-6 last:pb-1">
          <div className={`absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-white ring-1 ring-gray-300 ${episode.closed_at ? "bg-gray-400" : "bg-gray-900"}`} />
          <div className="text-sm font-bold uppercase tracking-wider text-gray-400">{formatDate(episode.created_at)}{episode.closed_at ? ` → ${formatDate(episode.closed_at)}` : " → agora"}</div>
          <Link href={`/episodes/${episode.id}`} className="mt-1 inline-block text-sm font-semibold text-gray-900 hover:underline">{getEpisodeAlias(episode.id)}</Link>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500"><span>{changeTypeLabels[episode.change_type]}</span><StateBadge state={state} /></div>
          {latestReview ? <div className="mt-2 text-sm text-gray-500">Último outcome: <span className="font-semibold text-gray-700">{outcomeLabels[latestReview.outcome]}</span></div> : null}
          {incoming && source ? <div className="mt-2 text-sm font-semibold text-indigo-700">↳ {episodeRelationshipTypeLabels[incoming.relationship_type]} de <Link href={`/episodes/${source.episode.id}`} className="underline underline-offset-2">{getEpisodeAlias(source.episode.id)}</Link></div> : null}
          {outgoing.length ? <div className="mt-2 space-y-1">{outgoing.map((relationship) => {
            const target = rowById.get(relationship.target_episode_id);
            return target ? <div key={relationship.id} className="text-sm font-semibold text-gray-500">↳ depois virou <Link href={`/episodes/${target.episode.id}`} className="text-indigo-700 underline underline-offset-2">{episodeRelationshipTypeLabels[relationship.relationship_type].toLowerCase()} em {getEpisodeAlias(target.episode.id)}</Link></div> : null;
          })}</div> : null}
        </div>;
      })}</div>}
    </section> : null}

    {activeTab === "data" ? <section className="rounded-[18px] border border-gray-200 bg-white p-5 shadow-soft">
      <div>
        <div className="text-sm font-extrabold uppercase tracking-[0.1em] text-gray-400">Dados</div>
        <h2 className="mt-1 font-semibold">Contexto importado da conta</h2>
        <p className="mt-1 max-w-3xl text-sm leading-5 text-gray-500">Os dados ajudam a recuperar contexto, mas ficam fora da primeira leitura para não disputar atenção com o trabalho atual.</p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Info label="Nome" value={accountData.name} />
        {accountData.externalId ? <Info label="ID externo" value={accountData.externalId} /> : null}
        {accountData.owner ? <Info label="Responsável" value={accountData.owner} /> : null}
        {accountData.source ? <Info label="Fonte" value={accountData.source} /> : null}
        {attributeEntries.map(([key, value]) => <Info key={key} label={humanizeKey(key)} value={value} />)}
      </div>

      {!attributeEntries.length ? <div className="mt-4 rounded-xl bg-gray-50 p-3 text-sm leading-5 text-gray-500">Sem atributos importados. Isso não impede criar e acompanhar episódios.</div> : null}
    </section> : null}
  </AppShell>;
}

function EpisodeMiniCard({ row, label }: { row: EpisodeRow; label: string }) {
  const state = deriveDisplayState(row.episode, row.intervention, row.latestReview);
  return <Link href={`/episodes/${row.episode.id}`} className="block rounded-xl border border-gray-200 bg-white p-3 transition hover:border-gray-300">
    <div className="text-sm font-bold uppercase tracking-wider text-gray-400">{label}</div>
    <div className="mt-1 text-sm font-semibold text-gray-900">{getEpisodeAlias(row.episode.id)}</div>
    <div className="mt-1 text-sm text-gray-500">{formatDate(row.episode.created_at)}{row.episode.closed_at ? ` → ${formatDate(row.episode.closed_at)}` : " → agora"}</div>
    <div className="mt-2 flex flex-wrap items-center gap-2"><StateBadge state={state} />{row.latestReview ? <span className="text-sm font-semibold text-gray-500">{outcomeLabels[row.latestReview.outcome]}</span> : null}</div>
  </Link>;
}

function RelationshipPill({ type }: { type: EpisodeRelationshipType }) {
  const tone = type === "recurrence" ? "amber" : type === "continuation" ? "indigo" : "gray";
  return <Pill tone={tone}>{episodeRelationshipTypeLabels[type]}</Pill>;
}

function selectCurrentContext(entries: [string, string][]) {
  const preferred = /(health|score|renew|renov|mrr|arr|usage|uso|segment|journey|stage|nps|ticket|contact|contato|status|plan|plano)/i;
  const prioritized = entries.filter(([key]) => preferred.test(key));
  const remainder = entries.filter(([key]) => !preferred.test(key));
  return [...prioritized, ...remainder].slice(0, 4);
}

function humanizeKey(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function elapsedLabel(from: string, to: string) {
  const diff = Math.max(0, new Date(to).getTime() - new Date(from).getTime());
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "no mesmo dia";
  if (days === 1) return "1 dia entre os ciclos";
  return `${days} dias entre os ciclos`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-gray-100 bg-gray-50 p-3"><div className="break-all text-sm font-bold uppercase tracking-wider text-gray-400">{label}</div><div className="mt-1 break-words text-sm font-semibold text-gray-800">{value}</div></div>;
}
