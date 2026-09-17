"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownUp,
  CheckCircle2,
  Clock3,
  Eye,
  Filter,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  addHours,
  differenceInCalendarDays,
  differenceInHours,
  format,
  isPast,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppShell } from "@/components/app-shell";
import { ErrorBox } from "@/components/error-box";
import { LoadingBlock } from "@/components/loading";
import { Pagination } from "@/components/pagination";
import { StateBadge } from "@/components/state-badge";
import {
  deriveDisplayState,
  displayStateLabels,
  nextStepForState,
  reviewDueAt,
  type DisplayState,
} from "@/lib/display";
import { getAllAccountPrivateData, getEpisodeAlias } from "@/lib/local-private";
import { listEpisodes, listInterventions, listReviews } from "@/lib/repository";
import {
  CHANGE_TYPES,
  ageBucketLabels,
  changeTypeLabels,
  interventionTypeLabels,
  outcomeLabels,
  type ChangeType,
  type Episode,
  type Intervention,
  type Review,
} from "@/lib/types";

type Row = {
  episode: Episode;
  intervention: Intervention | null;
  latestReview: Review | null;
  state: DisplayState;
  alias: string;
  accountName: string;
};

type QuickView = "needs_me" | "all" | "review" | "recovering" | "exceptions";
type SortMode = "urgency" | "oldest" | "newest" | "type";

const ACTIVE_STATES: DisplayState[] = [
  "attention",
  "watch",
  "execution_pending",
  "exception",
  "waiting_response",
  "recovering",
  "review_due",
];

const URGENCY: Record<DisplayState, number> = {
  review_due: 0,
  exception: 1,
  execution_pending: 2,
  attention: 3,
  recovering: 4,
  waiting_response: 5,
  watch: 6,
  closed: 7,
};

export default function HomePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [quickView, setQuickView] = useState<QuickView>("all");
  const [typeFilter, setTypeFilter] = useState<ChangeType | "all">("all");
  const [stateFilter, setStateFilter] = useState<DisplayState | "all">("all");
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("urgency");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  async function load() {
    try {
      setLoading(true);
      setError("");
      const [episodes, interventions, reviews] = await Promise.all([
        listEpisodes(),
        listInterventions(),
        listReviews(),
      ]);
      const accountData = getAllAccountPrivateData();

      const latestInterventionByEpisode = new Map<string, Intervention>();
      for (const intervention of interventions) {
        if (!latestInterventionByEpisode.has(intervention.episode_id)) {
          latestInterventionByEpisode.set(intervention.episode_id, intervention);
        }
      }

      const latestReviewByIntervention = new Map<string, Review>();
      for (const review of reviews) {
        if (!latestReviewByIntervention.has(review.intervention_id)) {
          latestReviewByIntervention.set(review.intervention_id, review);
        }
      }

      const enriched = episodes.map((episode) => {
        const intervention = latestInterventionByEpisode.get(episode.id) ?? null;
        const latestReview = intervention ? (latestReviewByIntervention.get(intervention.id) ?? null) : null;
        return {
          episode,
          intervention,
          latestReview,
          state: deriveDisplayState(episode, intervention, latestReview),
          alias: getEpisodeAlias(episode.id),
          accountName: episode.account_id ? (accountData[episode.account_id]?.name || `Conta ${episode.account_id.slice(0, 6).toUpperCase()}`) : "Conta não vinculada",
        };
      });
      setRows(enriched);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const metrics = useMemo(
    () => ({
      review: rows.filter((r) => r.state === "review_due").length,
      action: rows.filter((r) => ["attention", "execution_pending", "exception"].includes(r.state)).length,
      exceptions: rows.filter((r) => r.state === "exception").length,
      observing: rows.filter((r) => ["watch", "waiting_response", "recovering"].includes(r.state)).length,
    }),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");

    let result = rows.filter((row) => {
      if (!matchesQuickView(row, quickView)) return false;
      if (typeFilter !== "all" && row.episode.change_type !== typeFilter) return false;
      if (stateFilter !== "all" && row.state !== stateFilter) return false;
      if (normalizedQuery) {
        const haystack = `${row.accountName} ${row.alias} ${changeTypeLabels[row.episode.change_type]} ${displayStateLabels[row.state]}`.toLocaleLowerCase("pt-BR");
        if (!haystack.includes(normalizedQuery)) return false;
      }
      return true;
    });

    result = [...result].sort((a, b) => {
      if (sortMode === "urgency") {
        const byUrgency = URGENCY[a.state] - URGENCY[b.state];
        if (byUrgency !== 0) return byUrgency;
        return actionTimestamp(a) - actionTimestamp(b);
      }
      if (sortMode === "oldest") return new Date(a.episode.created_at).getTime() - new Date(b.episode.created_at).getTime();
      if (sortMode === "newest") return new Date(b.episode.created_at).getTime() - new Date(a.episode.created_at).getTime();
      return changeTypeLabels[a.episode.change_type].localeCompare(changeTypeLabels[b.episode.change_type], "pt-BR");
    });

    return result;
  }, [rows, quickView, typeFilter, stateFilter, query, sortMode]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = useMemo(
    () => filteredRows.slice((page - 1) * pageSize, page * pageSize),
    [filteredRows, page, pageSize],
  );

  useEffect(() => {
    setPage(1);
  }, [quickView, typeFilter, stateFilter, query, sortMode, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const hasExplicitFilters = typeFilter !== "all" || stateFilter !== "all" || query.trim().length > 0;

  function clearFilters() {
    setTypeFilter("all");
    setStateFilter("all");
    setQuery("");
  }

  return (
    <AppShell>
      <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-3xl font-extrabold tracking-[-0.04em] text-gray-900">O que precisa de você hoje?</h1>
        </div>
        <div>
          <Link
            href="/episodes/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
          >
            <Plus size={16} /> Registrar episódio
          </Link>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="grid gap-2 lg:grid-cols-[minmax(240px,1fr)_220px_220px_190px_auto]">
          <label className="relative block">
            <span className="sr-only">Buscar episódio</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por conta ou episódio..."
              className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-gray-400"
            />
          </label>

          <SelectFilter
            icon={<Filter size={14} />}
            value={typeFilter}
            onChange={(value) => setTypeFilter(value as ChangeType | "all")}
            ariaLabel="Filtrar por tipo"
          >
            <option value="all">Tipo: todos</option>
            {CHANGE_TYPES.map((type) => <option key={type} value={type}>{changeTypeLabels[type]}</option>)}
          </SelectFilter>

          <SelectFilter
            icon={<Filter size={14} />}
            value={stateFilter}
            onChange={(value) => setStateFilter(value as DisplayState | "all")}
            ariaLabel="Filtrar por estado"
          >
            <option value="all">Estado: todos</option>
            {ACTIVE_STATES.map((state) => <option key={state} value={state}>{displayStateLabels[state]}</option>)}
            <option value="closed">CICLO FECHADO</option>
          </SelectFilter>

          <SelectFilter
            icon={<ArrowDownUp size={14} />}
            value={sortMode}
            onChange={(value) => setSortMode(value as SortMode)}
            ariaLabel="Ordenar episódios"
          >
            <option value="urgency">Ordenar: urgência</option>
            <option value="oldest">Mais antigos</option>
            <option value="newest">Mais recentes</option>
            <option value="type">Tipo</option>
          </SelectFilter>

          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasExplicitFilters}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-default disabled:opacity-35"
          >
            <X size={14} /> Limpar
          </button>

        </div>
      </div>

      {error ? <ErrorBox message={error} /> : null}
      {loading ? <LoadingBlock /> : null}

      {!loading && !error && rows.length === 0 ? (
        <div className="rounded-[18px] border border-gray-200 bg-white p-8 text-center shadow-soft">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-gray-100"><Plus size={19} /></div>
          <h2 className="mt-4 font-semibold">Comece com um caso real</h2>
          <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-gray-500">Registre algo que começou a mudar e acompanhe a história inteira no mesmo episódio.</p>
          <Link href="/episodes/new" className="mt-4 inline-flex rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white">Criar primeiro episódio</Link>
        </div>
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-soft">
          {filteredRows.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="text-sm font-semibold text-gray-800">Nenhum episódio encontrado</div>
              <div className="mt-1 text-sm text-gray-500">Ajuste os filtros ou escolha outra visão da fila.</div>
              <button onClick={clearFilters} className="mt-4 text-sm font-semibold text-gray-700 underline underline-offset-4">Limpar filtros</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] border-collapse text-left">
                <thead className="bg-gray-50/80">
                  <tr className="border-b border-gray-100 text-sm font-extrabold uppercase tracking-[0.08em] text-gray-400">
                    <th className="px-4 py-3">Conta / episódio</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Estado atual</th>
                    <th className="px-4 py-3">Há quanto tempo</th>
                    <th className="px-4 py-3">Última ação</th>
                    <th className="px-4 py-3">Próximo passo</th>
                    <th className="px-4 py-3">Quando</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedRows.map((row) => <EpisodeTableRow key={row.episode.id} row={row} />)}
                </tbody>
              </table>
            </div>
          )}

          {filteredRows.length > 0 ? (
            <Pagination
              page={page}
              pageSize={pageSize}
              total={filteredRows.length}
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setPage(1);
              }}
            />
          ) : null}
        </div>
      ) : null}
    </AppShell>
  );
}

function MetricButton({ icon, value, label, active, onClick }: { icon: ReactNode; value: number; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${active ? "border-gray-900 bg-gray-900 text-white shadow-soft" : "border-gray-200 bg-white hover:border-gray-300"}`}
    >
      <div className={`flex items-center justify-between ${active ? "text-gray-300" : "text-gray-400"}`}>{icon}<span className="text-sm font-bold uppercase tracking-wider">atalho</span></div>
      <div className="mt-3 text-3xl font-extrabold tracking-[-0.04em]">{value}</div>
      <div className={`mt-1 text-sm ${active ? "text-gray-300" : "text-gray-500"}`}>{label}</div>
    </button>
  );
}

function QuickViewButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold transition ${active ? "bg-gray-900 text-white" : "border border-gray-200 bg-white text-gray-600 hover:border-gray-300"}`}
    >
      {children}
    </button>
  );
}

function SelectFilter({ icon, value, onChange, children, ariaLabel }: { icon: ReactNode; value: string; onChange: (value: string) => void; children: ReactNode; ariaLabel: string }) {
  return (
    <label className="relative block">
      <span className="sr-only">{ariaLabel}</span>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className="h-10 w-full appearance-none rounded-xl border border-gray-200 bg-white pl-8 pr-8 text-sm font-semibold text-gray-700 outline-none transition focus:border-gray-400"
      >
        {children}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">▼</span>
    </label>
  );
}

function EpisodeTableRow({ row }: { row: Row }) {
  const { episode, intervention, latestReview, state, alias, accountName } = row;
  const lastAction = describeLastAction(intervention, latestReview);
  const timing = describeTiming(row);

  return (
    <tr className="group relative transition hover:bg-gray-50/80">
      <td className="p-0">
        <Link href={`/episodes/${episode.id}`} className="block px-4 py-4">
          <div className="font-semibold text-gray-900 group-hover:underline group-hover:underline-offset-2">{accountName}</div>
          <div className="mt-1 max-w-[250px] truncate text-sm text-gray-500">{alias}</div>
        </Link>
      </td>
      <td className="p-0"><Link href={`/episodes/${episode.id}`} className="block px-4 py-4 text-sm text-gray-600">{changeTypeLabels[episode.change_type]}</Link></td>
      <td className="p-0"><Link href={`/episodes/${episode.id}`} className="block px-4 py-4"><StateBadge state={state} /></Link></td>
      <td className="p-0"><Link href={`/episodes/${episode.id}`} className="block px-4 py-4 text-sm font-medium text-gray-700">{ageBucketLabels[episode.age_bucket]}</Link></td>
      <td className="p-0"><Link href={`/episodes/${episode.id}`} className="block max-w-[190px] px-4 py-4 text-sm text-gray-600">{lastAction}</Link></td>
      <td className="p-0"><Link href={`/episodes/${episode.id}`} className="block max-w-[260px] px-4 py-4 text-sm font-medium leading-5 text-gray-800">{nextStepForState(state)}</Link></td>
      <td className="p-0"><Link href={`/episodes/${episode.id}`} className={`block whitespace-nowrap px-4 py-4 text-sm font-semibold ${timing.urgent ? "text-red-600" : "text-gray-600"}`}>{timing.label}</Link></td>
    </tr>
  );
}

function matchesQuickView(row: Row, view: QuickView) {
  if (view === "all") return true;
  if (view === "review") return row.state === "review_due";
  if (view === "exceptions") return row.state === "exception";
  if (view === "recovering") return ["watch", "waiting_response", "recovering"].includes(row.state);
  return ["attention", "execution_pending", "exception", "review_due"].includes(row.state);
}

function describeLastAction(intervention: Intervention | null, latestReview: Review | null) {
  if (latestReview) return `Review · ${outcomeLabels[latestReview.outcome]}`;
  if (!intervention) return "—";
  const interventionLabel = interventionTypeLabels[intervention.intervention_type];
  if (intervention.execution_state === "exception") return `Exceção · ${interventionLabel}`;
  if (intervention.execution_state === "executed") return `${interventionLabel} executada`;
  return `${interventionLabel} planejada`;
}

function describeTiming(row: Row): { label: string; urgent: boolean } {
  const { state, intervention, latestReview, episode } = row;
  const now = new Date();

  if (state === "review_due") return { label: "Agora", urgent: true };
  if (state === "exception" || state === "attention") return { label: "Agora", urgent: state === "exception" };
  if (state === "watch") return { label: "—", urgent: false };
  if (state === "closed") {
    return { label: episode.closed_at ? format(new Date(episode.closed_at), "dd MMM", { locale: ptBR }) : "Fechado", urgent: false };
  }

  if (state === "execution_pending" && intervention) {
    const due = addHours(new Date(intervention.created_at), intervention.execution_deadline_hours);
    return relativeMoment(due, now);
  }

  if ((state === "waiting_response" || state === "recovering") && intervention) {
    return relativeMoment(reviewDueAt(intervention, latestReview), now);
  }

  return { label: "—", urgent: false };
}

function relativeMoment(target: Date, now: Date): { label: string; urgent: boolean } {
  if (isPast(target)) {
    const hours = Math.abs(differenceInHours(target, now));
    if (hours < 24) return { label: `${Math.max(hours, 1)}h atrasado`, urgent: true };
    const days = Math.abs(differenceInCalendarDays(target, now));
    return { label: `${Math.max(days, 1)}d atrasado`, urgent: true };
  }

  const hours = differenceInHours(target, now);
  if (hours < 1) return { label: "< 1h", urgent: false };
  if (hours < 24) return { label: `em ${hours}h`, urgent: false };
  const days = differenceInCalendarDays(target, now);
  if (days === 1) return { label: "Amanhã", urgent: false };
  return { label: `em ${days}d`, urgent: false };
}

function actionTimestamp(row: Row) {
  if (row.state === "review_due" && row.intervention) return reviewDueAt(row.intervention, row.latestReview).getTime();
  if (row.state === "execution_pending" && row.intervention) return addHours(new Date(row.intervention.created_at), row.intervention.execution_deadline_hours).getTime();
  if ((row.state === "waiting_response" || row.state === "recovering") && row.intervention) return reviewDueAt(row.intervention, row.latestReview).getTime();
  return new Date(row.episode.created_at).getTime();
}
