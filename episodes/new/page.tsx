"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button, Card, Field, inputClass, Pill } from "@/components/ui";
import { ErrorBox } from "@/components/error-box";
import { LoadingBlock } from "@/components/loading";
import { createEpisode, listAccounts } from "@/lib/repository";
import { getAllAccountPrivateData, setEpisodeAlias, setEpisodeNote } from "@/lib/local-private";
import type { Account, AgeBucket, ChangeType, InitialState } from "@/lib/types";
import { ageBucketLabels, changeTypeLabels, initialStateLabels } from "@/lib/types";

export default function NewEpisodePage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountId, setAccountId] = useState("");
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
        const loaded = await listAccounts();
        setAccounts(loaded);
        const preferred = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("accountId") : null;
        if (preferred && loaded.some((account) => account.id === preferred)) setAccountId(preferred);
        else if (loaded.length === 1) setAccountId(loaded[0].id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao carregar contas.");
      } finally {
        setAccountsLoading(false);
      }
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId) return;
    try {
      setSaving(true);
      setError("");
      const episode = await createEpisode({ account_id: accountId, change_type: changeType, age_bucket: ageBucket, initial_state: initialState });
      if (alias.trim()) setEpisodeAlias(episode.id, alias);
      if (note.trim()) setEpisodeNote(episode.id, note);
      router.push(`/episodes/${episode.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setSaving(false);
    }
  }

  if (accountsLoading) return <AppShell><LoadingBlock /></AppShell>;

  if (accounts.length === 0) {
    return <AppShell><div className="mb-6"><Pill tone="indigo">OBSERVE · NEW</Pill><h1 className="mt-3 text-3xl font-extrabold tracking-[-0.04em]">Primeiro, traga uma conta</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">Na v0.1 todo episódio pertence a uma conta. Isso permite preservar a história da relação sem transformar o Ohrly em um CRM.</p></div>{error ? <div className="mb-4"><ErrorBox message={error} /></div> : null}<Card className="max-w-2xl"><h2 className="font-semibold">Sua carteira ainda está vazia</h2><p className="mt-2 text-sm leading-6 text-gray-500">Importe um CSV para evitar cadastro manual ou crie uma conta individualmente.</p><div className="mt-4 flex flex-wrap gap-2"><Link href="/accounts/import" className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white">Importar CSV</Link><Link href="/accounts/new" className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold">Cadastrar conta</Link></div></Card></AppShell>;
  }

  return (
    <AppShell>
      <div className="mb-6">
        <Pill tone="indigo">OBSERVE · NEW</Pill>
        <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.04em]">Registrar algo que começou a mudar</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">Escolha a conta e abra somente os casos que realmente merecem acompanhamento. A importação da carteira não cria episódios automaticamente.</p>
      </div>

      <Card className="max-w-2xl">
        <form className="space-y-4" onSubmit={submit}>
          {error ? <ErrorBox message={error} /> : null}
          <Field label="Conta" hint="Contexto longitudinal deste episódio.">
            <select className={inputClass} value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
              <option value="">Selecione uma conta...</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{accountPrivateData[account.id]?.name || `Conta ${account.id.slice(0, 6).toUpperCase()}`}</option>)}
            </select>
          </Field>

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
            <Button type="button" variant="secondary" onClick={() => router.push("/")}>Cancelar</Button>
            <Button type="submit" disabled={saving || !accountId}>{saving ? "Criando..." : "Criar episódio"}</Button>
          </div>
        </form>
      </Card>
    </AppShell>
  );
}
