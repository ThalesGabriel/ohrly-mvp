"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ErrorBox } from "@/components/error-box";
import { LoadingBlock } from "@/components/loading";
import { StateBadge } from "@/components/state-badge";
import { deriveDisplayState } from "@/lib/display";
import { getAccountPrivateData, getEpisodeAlias } from "@/lib/local-private";
import { getAccount, getInterventionForEpisode, listEpisodes, listReviewsForIntervention } from "@/lib/repository";
import { ageBucketLabels, changeTypeLabels, type Account, type Episode, type Intervention, type Review } from "@/lib/types";

type EpisodeRow = { episode: Episode; intervention: Intervention | null; latestReview: Review | null };

export default function AccountPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [account, setAccount] = useState<Account | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const acc = await getAccount(id);
      setAccount(acc);
      if (!acc) return;
      const allEpisodes = (await listEpisodes()).filter((episode) => episode.account_id === id);
      const enriched = await Promise.all(allEpisodes.map(async (episode) => {
        const intervention = await getInterventionForEpisode(episode.id);
        const reviews = intervention ? await listReviewsForIntervention(intervention.id) : [];
        return { episode, intervention, latestReview: reviews[0] ?? null };
      }));
      setEpisodes(enriched);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const accountData = useMemo(() => account ? getAccountPrivateData(account.id) : null, [account]);

  if (loading) return <AppShell><LoadingBlock /></AppShell>;
  if (error && !account) return <AppShell><ErrorBox message={error} /></AppShell>;
  if (!account || !accountData) return <AppShell><ErrorBox message="Conta não encontrada." /></AppShell>;

  const attributeEntries = Object.entries(accountData.attributes);

  return <AppShell>
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div>
        <div className="text-[10px] font-extrabold uppercase tracking-[0.11em] text-gray-400">CONTA · MEMÓRIA DA RELAÇÃO</div>
        <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.04em]">{accountData.name}</h1>
        <p className="mt-2 text-sm text-gray-500">{accountData.owner ? `Responsável: ${accountData.owner}` : "Responsável não informado"} · {episodes.length} episódio(s)</p>
      </div>
      <div className="flex flex-wrap gap-2"><Link href="/accounts" className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-gray-50"><ArrowLeft size={15} /> Voltar às contas</Link><Link href={`/episodes/new?accountId=${account.id}`} className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"><Plus size={15} /> Novo episódio</Link></div>
    </div>

    {error ? <div className="mb-4"><ErrorBox message={error} /></div> : null}

    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="space-y-4">
        <section className="rounded-[18px] border border-gray-200 bg-white p-5 shadow-soft">
          <h2 className="font-semibold">Histórico de episódios</h2>
          <p className="mt-1 text-xs leading-5 text-gray-500">Cada episódio é uma investigação separada. Juntos, eles formam a memória longitudinal desta relação.</p>
          {episodes.length === 0 ? <div className="mt-5 rounded-2xl bg-gray-50 p-6 text-center"><div className="text-sm font-semibold">Nenhum episódio ainda</div><div className="mt-1 text-xs text-gray-500">Abra um episódio quando algo começar a mudar e merecer acompanhamento.</div><Link href={`/episodes/new?accountId=${account.id}`} className="mt-4 inline-flex rounded-xl bg-gray-900 px-4 py-2.5 text-xs font-semibold text-white">Criar primeiro episódio</Link></div> : <div className="mt-4 divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200">{episodes.map(({ episode, intervention, latestReview }) => { const state = deriveDisplayState(episode, intervention, latestReview); return <Link key={episode.id} href={`/episodes/${episode.id}`} className="flex items-center justify-between gap-4 p-4 transition hover:bg-gray-50"><div className="min-w-0"><div className="truncate text-sm font-semibold text-gray-900">{getEpisodeAlias(episode.id)}</div><div className="mt-1 text-xs text-gray-500">{changeTypeLabels[episode.change_type]} · {ageBucketLabels[episode.age_bucket]}</div></div><StateBadge state={state} /></Link>; })}</div>}
        </section>
      </div>

      <aside className="xl:sticky xl:top-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-soft">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-gray-400">Contexto atual</div>
          <div className="mt-3 space-y-2"><Info label="Nome" value={accountData.name} />{accountData.externalId ? <Info label="ID externo" value={accountData.externalId} /> : null}{accountData.owner ? <Info label="Responsável" value={accountData.owner} /> : null}{accountData.source ? <Info label="Fonte" value={accountData.source} /> : null}</div>
          {attributeEntries.length ? <><div className="mt-5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-gray-400">Campos importados</div><div className="mt-3 max-h-[420px] space-y-2 overflow-auto">{attributeEntries.map(([key, value]) => <Info key={key} label={key} value={value} />)}</div></> : <div className="mt-4 rounded-xl bg-gray-50 p-3 text-xs leading-5 text-gray-500">Sem atributos importados. Isso não impede criar e acompanhar episódios.</div>}
        </div>
      </aside>
    </div>
  </AppShell>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-gray-100 bg-gray-50 p-3"><div className="break-all text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</div><div className="mt-1 break-words text-xs font-semibold text-gray-800">{value}</div></div>;
}
