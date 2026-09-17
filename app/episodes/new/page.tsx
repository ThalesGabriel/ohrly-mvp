"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GitBranch } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button, Card, Field, inputClass, Pill } from "@/components/ui";
import { ErrorBox } from "@/components/error-box";
import { LoadingBlock } from "@/components/loading";
import { createEpisode, createEpisodeRelationship, listAccounts, listEpisodes } from "@/lib/repository";
import { getAllAccountPrivateData, getEpisodeAlias, setEpisodeAlias, setEpisodeNote } from "@/lib/local-private";
import type { Account, AgeBucket, ChangeType, Episode, EpisodeRelationshipType, InitialState } from "@/lib/types";
import { ageBucketLabels, changeTypeLabels, episodeRelationshipQuestionLabels, initialStateLabels } from "@/lib/types";

export default function NewEpisodePage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [existingEpisodes, setExistingEpisodes] = useState<Episode[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountId, setAccountId] = useState("");
  const [sourceEpisodeId, setSourceEpisodeId] = useState("");
  const [relationshipType, setRelationshipType] = useState<EpisodeRelationshipType | "">("");
  const [alias, setAlias] = useState("");
  const [note, setNote] = useState("");
  const [changeType, setChangeType] = useState<ChangeType>("engagement_drop");
  const [ageBucket, setAgeBucket] = useState<AgeBucket>("7_14d");
  const [initialState, setInitialState] = useState<InitialState>("act");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const accountPrivateData = useMemo(() => getAllAccountPrivateData(), [accounts]);

  useEffect(() => {
    (async () => {
      try {
        const [loadedAccounts, loadedEpisodes] = await Promise.all([listAccounts(), listEpisodes()]);
        setAccounts(loadedAccounts);
        setExistingEpisodes(loadedEpisodes);

        const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
        const preferredAccount = params?.get("accountId");
        const relatedTo = params?.get("relatedTo");
        const relatedEpisode = relatedTo ? loadedEpisodes.find((episode) => episode.id === relatedTo) : null;

        if (relatedEpisode?.account_id && loadedAccounts.some((account) => account.id === relatedEpisode.account_id)) {
          setAccountId(relatedEpisode.account_id);
          setSourceEpisodeId(relatedEpisode.id);
        } else if (preferredAccount && loadedAccounts.some((account) => account.id === preferredAccount)) {
          setAccountId(preferredAccount);
        } else if (loadedAccounts.length === 1) {
          setAccountId(loadedAccounts[0].id);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao carregar contas.");
      } finally {
        setAccountsLoading(false);
      }
    })();
  }, []);

  const historicalEpisodes = useMemo(() => existingEpisodes.filter((episode) => episode.account_id === accountId && episode.closed_at), [accountId, existingEpisodes]);
  const sourceEpisode = sourceEpisodeId ? existingEpisodes.find((episode) => episode.id === sourceEpisodeId) ?? null : null;

  function changeAccount(nextAccountId: string) {
    setAccountId(nextAccountId);
    if (sourceEpisodeId) {
      const source = existingEpisodes.find((episode) => episode.id === sourceEpisodeId);
      if (!source || source.account_id !== nextAccountId) {
        setSourceEpisodeId("");
        setRelationshipType("");
      }
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId) return;
    if (sourceEpisodeId && !relationshipType) {
      setError("Escolha como a nova situação se relaciona com o episódio anterior.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      const episode = await createEpisode({ account_id: accountId, change_type: changeType, age_bucket: ageBucket, initial_state: initialState });
      if (alias.trim()) setEpisodeAlias(episode.id, alias);
      if (note.trim()) setEpisodeNote(episode.id, note);
      if (sourceEpisodeId && relationshipType) {
        await createEpisodeRelationship({
          source_episode_id: sourceEpisodeId,
          target_episode_id: episode.id,
          relationship_type: relationshipType,
        });
      }
      router.push(`/episodes/${episode.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setSaving(false);
    }
  }

  if (accountsLoading) return <AppShell><LoadingBlock /></AppShell>;

  if (accounts.length === 0) {
    return <AppShell><div className="mb-6"><Pill tone="indigo">OBSERVE · NEW</Pill><h1 className="mt-3 text-3xl font-extrabold tracking-[-0.04em]">Primeiro, traga uma conta</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">Todo episódio pertence a uma conta. Isso permite preservar a história da relação sem transformar o Ohrly em um CRM.</p></div>{error ? <div className="mb-4"><ErrorBox message={error} /></div> : null}<Card className="max-w-2xl"><h2 className="font-semibold">Sua carteira ainda está vazia</h2><p className="mt-2 text-sm leading-6 text-gray-500">Importe um CSV para evitar cadastro manual ou crie uma conta individualmente.</p><div className="mt-4 flex flex-wrap gap-2"><Link href="/accounts/import" className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white">Importar CSV</Link><Link href="/accounts/new" className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold">Cadastrar conta</Link></div></Card></AppShell>;
  }

  return (
    <AppShell>
      <div className="mb-6">
        <Pill tone="indigo">OBSERVE · NEW</Pill>
        <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.04em]">Registrar algo que começou a mudar</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">Abra um novo ciclo para o que merece acompanhamento. Se algo anterior importa para entender o caso atual, relacione os episódios sem reescrever o ciclo que já foi encerrado.</p>
      </div>

      <Card className="max-w-2xl">
        <form className="space-y-4" onSubmit={submit}>
          {error ? <ErrorBox message={error} /> : null}
          <Field label="Conta" hint="Contexto longitudinal deste episódio.">
            <select className={inputClass} value={accountId} onChange={(e) => changeAccount(e.target.value)} required>
              <option value="">Selecione uma conta...</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{accountPrivateData[account.id]?.name || `Conta ${account.id.slice(0, 6).toUpperCase()}`}</option>)}
            </select>
          </Field>

          {accountId && historicalEpisodes.length ? <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-indigo-900"><GitBranch size={15} /> Continuidade opcional</div>
            <p className="mt-1 text-sm leading-5 text-indigo-700">Use quando esta nova situação ganha contexto a partir de um ciclo anterior já encerrado.</p>
            <div className="mt-3 space-y-3">
              <Field label="Isso se relaciona com algo que já aconteceu antes?">
                <select className={inputClass} value={sourceEpisodeId} onChange={(e) => { setSourceEpisodeId(e.target.value); if (!e.target.value) setRelationshipType(""); }}>
                  <option value="">Não / ainda não sei</option>
                  {historicalEpisodes.map((episode) => <option key={episode.id} value={episode.id}>{getEpisodeAlias(episode.id)} · fechado em {formatDate(episode.closed_at!)}</option>)}
                </select>
              </Field>

              {sourceEpisode ? <>
                <div className="rounded-xl border border-indigo-100 bg-white p-3">
                  <div className="text-sm font-bold uppercase tracking-wider text-gray-400">Ciclo anterior</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">{getEpisodeAlias(sourceEpisode.id)}</div>
                  <div className="mt-1 text-sm text-gray-500">{changeTypeLabels[sourceEpisode.change_type]} · {sourceEpisode.closed_at ? `encerrado em ${formatDate(sourceEpisode.closed_at)}` : "ainda aberto"}</div>
                </div>
                <Field label="Como esta nova situação se relaciona?" hint="A classificação pertence ao novo ciclo; o episódio anterior permanece preservado.">
                  <div className="grid gap-2">
                    {(Object.entries(episodeRelationshipQuestionLabels) as [EpisodeRelationshipType, string][]).map(([value, label]) => <button key={value} type="button" onClick={() => setRelationshipType(value)} className={`rounded-xl border p-3 text-left text-sm font-semibold transition ${relationshipType === value ? "border-indigo-500 bg-white text-indigo-900 ring-2 ring-indigo-100" : "border-indigo-100 bg-white text-gray-700 hover:border-indigo-300"}`}>{label}</button>)}
                  </div>
                </Field>
              </> : null}
            </div>
          </div> : null}

          <Field label="Título do episódio" hint="Fica somente neste navegador. Ex.: Champion deixou de participar.">
            <input className={inputClass} value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Champion deixou de participar" />
          </Field>

          <Field label="O que começou a mudar?">
            <select className={inputClass} value={changeType} onChange={(e) => setChangeType(e.target.value as ChangeType)}>
              {Object.entries(changeTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Há quanto tempo?">
              <select className={inputClass} value={ageBucket} onChange={(e) => setAgeBucket(e.target.value as AgeBucket)}>
                {Object.entries(ageBucketLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            <Field label="Estado atual">
              <select className={inputClass} value={initialState} onChange={(e) => setInitialState(e.target.value as InitialState)}>
                {Object.entries(initialStateLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Nota opcional" hint="Esta nota também fica local. Evite nomes, e-mails ou qualquer dado pessoal.">
            <textarea className={`${inputClass} min-h-24 resize-y`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: interação caiu depois do último checkpoint." />
          </Field>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => router.push(accountId ? `/accounts/${accountId}` : "/")}>Cancelar</Button>
            <Button type="submit" disabled={saving || !accountId || Boolean(sourceEpisodeId && !relationshipType)}>{saving ? "Criando..." : sourceEpisodeId ? "Criar episódio relacionado" : "Criar episódio"}</Button>
          </div>
        </form>
      </Card>
    </AppShell>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}
