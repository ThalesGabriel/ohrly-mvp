"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button, Card, Field, inputClass, Pill } from "@/components/ui";
import { ErrorBox } from "@/components/error-box";
import { createAccount } from "@/lib/repository";
import { setAccountPrivateData } from "@/lib/local-private";

export default function NewAccountPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [externalId, setExternalId] = useState("");
  const [owner, setOwner] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setSaving(true);
      setError("");
      const account = await createAccount();
      setAccountPrivateData(account.id, { externalId: externalId.trim(), name: name.trim(), owner: owner.trim() || undefined, attributes: {}, source: "manual" });
      router.push(`/accounts/${account.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setSaving(false);
    }
  }

  return <AppShell><div className="mb-6"><Pill tone="blue">ACCOUNT · NEW</Pill><h1 className="mt-3 text-3xl font-extrabold tracking-[-0.04em]">Cadastrar conta</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">A conta é o contexto longitudinal. Nome, identificador externo e responsável ficam apenas neste navegador.</p></div><Card className="max-w-2xl"><form className="space-y-4" onSubmit={submit}>{error ? <ErrorBox message={error} /> : null}<Field label="Nome da conta"><input autoFocus className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme" /></Field><Field label="ID externo" hint="Opcional. Útil para reencontrar a mesma conta em futuros imports."><input className={inputClass} value={externalId} onChange={(e) => setExternalId(e.target.value)} placeholder="company_123" /></Field><Field label="Responsável" hint="Opcional."><input className={inputClass} value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="CSM responsável" /></Field><div className="flex gap-2 pt-1"><Button type="button" variant="secondary" onClick={() => router.push("/accounts")}>Cancelar</Button><Button type="submit" disabled={saving || !name.trim()}>{saving ? "Criando..." : "Criar conta"}</Button></div></form></Card></AppShell>;
}
