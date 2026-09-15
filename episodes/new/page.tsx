"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button, Card, Field, inputClass, Pill } from "@/components/ui";
import { ErrorBox } from "@/components/error-box";
import { createEpisode } from "@/lib/repository";
import { setEpisodeAlias, setEpisodeNote } from "@/lib/local-private";
import type { AgeBucket, ChangeType, InitialState } from "@/lib/types";
import { ageBucketLabels, changeTypeLabels, initialStateLabels } from "@/lib/types";

export default function NewEpisodePage() {
  const router = useRouter();
  const [alias, setAlias] = useState("");
  const [note, setNote] = useState("");
  const [changeType, setChangeType] = useState<ChangeType>("engagement_drop");
  const [ageBucket, setAgeBucket] = useState<AgeBucket>("7_14d");
  const [initialState, setInitialState] = useState<InitialState>("act");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      setError("");
      const episode = await createEpisode({ change_type: changeType, age_bucket: ageBucket, initial_state: initialState });
      if (alias.trim()) setEpisodeAlias(episode.id, alias);
      if (note.trim()) setEpisodeNote(episode.id, note);
      router.push(`/episodes/${episode.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-6">
        <Pill tone="indigo">OBSERVE · NEW</Pill>
        <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.04em]">Registrar algo que começou a mudar</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
          Use um alias interno. O objetivo deste MVP é acompanhar o ciclo sem coletar nomes de clientes ou texto operacional no backend.
        </p>
      </div>

      <Card className="max-w-2xl">
        <form className="space-y-4" onSubmit={submit}>
          {error ? <ErrorBox message={error} /> : null}
          <Field label="Alias do caso" hint="Fica somente neste navegador. Ex.: Conta A / Onboarding 04.">
            <input className={inputClass} value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Conta A / Onboarding Enterprise" />
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
            <Button type="submit" disabled={saving}>{saving ? "Criando..." : "Criar episódio"}</Button>
          </div>
        </form>
      </Card>
    </AppShell>
  );
}
