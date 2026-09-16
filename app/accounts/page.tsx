"use client";

import Link from "next/link";
import { FileUp, Plus, Search, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ErrorBox } from "@/components/error-box";
import { LoadingBlock } from "@/components/loading";
import { getAllAccountPrivateData } from "@/lib/local-private";
import { listAccounts, listEpisodes } from "@/lib/repository";
import type { Account, Episode } from "@/lib/types";

type Row = { account: Account; name: string; owner?: string; attributes: Record<string, string>; episodeCount: number; openCount: number };

export default function AccountsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [accounts, episodes] = await Promise.all([listAccounts(), listEpisodes()]);
        const privateData = getAllAccountPrivateData();
        setRows(accounts.map((account) => {
          const data = privateData[account.id] || { name: `Conta ${account.id.slice(0, 6).toUpperCase()}`, owner: undefined, attributes: {} };
          const accountEpisodes = episodes.filter((episode) => episode.account_id === account.id);
          return {
            account,
            name: data.name,
            owner: data.owner,
            attributes: data.attributes,
            episodeCount: accountEpisodes.length,
            openCount: accountEpisodes.filter((episode) => !episode.closed_at).length,
          };
        }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro inesperado.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    if (!needle) return rows;
    return rows.filter((row) => `${row.name} ${row.owner ?? ""}`.toLocaleLowerCase("pt-BR").includes(needle));
  }, [rows, query]);

  return (
    <AppShell>
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-[0.11em] text-gray-400">CONTEXTO LONGITUDINAL</div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.04em]">Contas</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">A conta preserva a história. Cada episódio continua sendo uma investigação criada deliberadamente pelo CSM.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/accounts/import" className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-gray-50"><FileUp size={16} /> Importar CSV</Link>
          <Link href="/accounts/new" className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"><Plus size={16} /> Nova conta</Link>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        <label className="relative block max-w-xl">
          <span className="sr-only">Buscar conta</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por conta ou responsável..." className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-gray-400" />
        </label>
      </div>

      {error ? <ErrorBox message={error} /> : null}
      {loading ? <LoadingBlock /> : null}

      {!loading && !error && rows.length === 0 ? (
        <div className="rounded-[18px] border border-gray-200 bg-white p-8 text-center shadow-soft">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-gray-100"><UsersRound size={19} /></div>
          <h2 className="mt-4 font-semibold">Traga sua carteira para o Ohrly</h2>
          <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-gray-500">Importe um CSV com uma linha por conta ou cadastre a primeira manualmente. Os dados identificáveis ficam apenas neste navegador.</p>
          <div className="mt-4 flex justify-center gap-2"><Link href="/accounts/import" className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white">Importar CSV</Link><Link href="/accounts/new" className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold">Cadastrar manualmente</Link></div>
        </div>
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-soft">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3"><div><div className="text-sm font-semibold">Carteira</div><div className="mt-0.5 text-[11px] text-gray-500">{filtered.length} de {rows.length} contas</div></div><div className="text-[11px] text-gray-400">Conta = contexto · episódio = trabalho</div></div>
          {filtered.length === 0 ? <div className="px-6 py-12 text-center text-sm text-gray-500">Nenhuma conta encontrada.</div> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[720px] border-collapse text-left"><thead className="bg-gray-50/80"><tr className="border-b border-gray-100 text-[10px] font-extrabold uppercase tracking-[0.08em] text-gray-400"><th className="px-4 py-3">Conta</th><th className="px-4 py-3">Responsável</th><th className="px-4 py-3">Episódios</th><th className="px-4 py-3">Abertos</th><th className="px-4 py-3">Contexto importado</th></tr></thead><tbody className="divide-y divide-gray-100">{filtered.map((row) => <AccountRow key={row.account.id} row={row} />)}</tbody></table></div>
          )}
        </div>
      ) : null}
    </AppShell>
  );
}

function AccountRow({ row }: { row: Row }) {
  return <tr className="group hover:bg-gray-50/80"><td className="p-0"><Link href={`/accounts/${row.account.id}`} className="block px-4 py-4"><div className="font-semibold text-gray-900 group-hover:underline group-hover:underline-offset-2">{row.name}</div><div className="mt-1 text-[11px] text-gray-400">Conta #{row.account.id.slice(0, 8)}</div></Link></td><td className="p-0"><Link href={`/accounts/${row.account.id}`} className="block px-4 py-4 text-xs text-gray-600">{row.owner || "—"}</Link></td><td className="p-0"><Link href={`/accounts/${row.account.id}`} className="block px-4 py-4 text-xs font-semibold text-gray-700">{row.episodeCount}</Link></td><td className="p-0"><Link href={`/accounts/${row.account.id}`} className="block px-4 py-4 text-xs font-semibold text-gray-700">{row.openCount}</Link></td><td className="p-0"><Link href={`/accounts/${row.account.id}`} className="block px-4 py-4 text-xs text-gray-600">{Object.keys(row.attributes).length} campos</Link></td></tr>;
}
