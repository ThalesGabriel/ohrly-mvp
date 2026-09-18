"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button, Card, Field, inputClass, Pill } from "@/components/ui";
import { ErrorBox } from "@/components/error-box";
import { parseCsv, type CsvTable } from "@/lib/csv";
import { createAccounts, listAccounts, trackEvent } from "@/lib/repository";
import { getAllAccountPrivateData, getAccountPrivateData, setAccountPrivateData } from "@/lib/local-private";

type Mapping = { id: string; name: string; owner: string };

export default function ImportAccountsPage() {
  const router = useRouter();
  const [table, setTable] = useState<CsvTable | null>(null);
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<Mapping>({ id: "", name: "", owner: "" });
  const [attributeColumns, setAttributeColumns] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number } | null>(null);

  const preview = useMemo(() => table?.rows.slice(0, 5) ?? [], [table]);

  async function readFile(file: File) {
    try {
      setError("");
      setResult(null);
      const parsed = parseCsv(await file.text());
      setTable(parsed);
      setFileName(file.name);
      const lower = parsed.headers.map((h) => h.toLowerCase());
      const pick = (terms: string[]) => parsed.headers[lower.findIndex((h) => terms.some((term) => h.includes(term)))] || "";
      const id = pick(["company id", "account id", "customer id", "client id", "id_cliente", "id cliente", "external id", "codigo", "código"]);
      const name = pick(["company name", "account name", "customer name", "client name", "nome", "razao", "razão", "empresa"]);
      const owner = pick(["owner", "responsavel", "responsável", "csm", "gerente"]);
      setMapping({ id, name, owner });
      setAttributeColumns(parsed.headers.filter((h) => ![id, name, owner].includes(h)).slice(0, 20));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível ler o CSV.");
      setTable(null);
    }
  }

  function toggleAttribute(header: string) {
    setAttributeColumns((current) => current.includes(header) ? current.filter((x) => x !== header) : [...current, header]);
  }

  async function runImport() {
    if (!table || !mapping.id || !mapping.name) return;
    try {
      setSaving(true);
      setError("");
      const idIndex = table.headers.indexOf(mapping.id);
      const nameIndex = table.headers.indexOf(mapping.name);
      const ownerIndex = mapping.owner ? table.headers.indexOf(mapping.owner) : -1;
      const trackedColumns = attributeColumns.filter((header) => ![mapping.id, mapping.name, mapping.owner].includes(header));
      const accountIds = new Set((await listAccounts()).map((account) => account.id));
      const privateData = getAllAccountPrivateData();
      const accountIdByExternalId = new Map(Object.entries(privateData).filter(([, value]) => value.externalId).map(([id, value]) => [value.externalId, id]));
      const normalized = new Map<string, { externalId: string; name: string; owner?: string; attributes: Record<string, string> }>();
      let skipped = 0;

      for (const row of table.rows) {
        const externalId = (row[idIndex] || "").trim();
        const name = (row[nameIndex] || "").trim();
        if (!externalId || !name) { skipped++; continue; }

        const attributes: Record<string, string> = {};
        for (const header of trackedColumns) {
          const index = table.headers.indexOf(header);
          const value = (row[index] || "").trim();
          if (value) attributes[header] = value;
        }
        const owner = ownerIndex >= 0 ? (row[ownerIndex] || "").trim() : "";
        normalized.set(externalId, { externalId, name, owner: owner || undefined, attributes });
      }

      let updated = 0;
      const pending: Array<{ externalId: string; name: string; owner?: string; attributes: Record<string, string> }> = [];

      for (const entry of normalized.values()) {
        const existingId = accountIdByExternalId.get(entry.externalId) ?? null;
        if (existingId && accountIds.has(existingId)) {
          const old = getAccountPrivateData(existingId);
          setAccountPrivateData(existingId, {
            ...entry,
            owner: entry.owner || old.owner,
            attributes: { ...old.attributes, ...entry.attributes },
            source: fileName,
            importedAt: new Date().toISOString(),
          });
          updated++;
        } else {
          pending.push(entry);
        }
      }

      const createdAccounts = await createAccounts(pending.length);
      if (createdAccounts.length !== pending.length) throw new Error("A importação criou uma quantidade inesperada de contas. Tente novamente.");
      createdAccounts.forEach((account, index) => {
        setAccountPrivateData(account.id, { ...pending[index], source: fileName, importedAt: new Date().toISOString() });
      });

      const created = createdAccounts.length;
      await trackEvent("accounts_csv_imported", null, null, { created, updated, skipped, rows: table.rows.length, unique_accounts: normalized.size, tracked_attributes: trackedColumns.length });
      setResult({ created, updated, skipped });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao importar contas.");
    } finally {
      setSaving(false);
    }
  }

  if (result) return <AppShell><div className="mx-auto max-w-2xl"><Card className="text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><CheckCircle2 size={22} /></div><h1 className="mt-4 text-2xl font-extrabold tracking-[-0.03em]">Carteira importada</h1><p className="mt-2 text-sm text-gray-500">{result.created} contas criadas · {result.updated} atualizadas · {result.skipped} ignoradas.</p><p className="mx-auto mt-3 max-w-lg text-sm leading-5 text-gray-500">Nenhum episódio foi criado automaticamente. A importação remove o cadastro braçal; decidir o que merece investigação continua sendo trabalho do CSM.</p><div className="mt-5 flex justify-center gap-2"><Button onClick={() => router.push("/accounts")}>Ver contas</Button><Button variant="secondary" onClick={() => router.push("/episodes/new")}>Criar episódio</Button></div></Card></div></AppShell>;

  return <AppShell><div className="mb-6"><Pill tone="blue">ASSISTED SETUP · CSV</Pill><h1 className="mt-3 text-3xl font-extrabold tracking-[-0.04em]">Importar carteira</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">Envie um CSV em que cada linha representa uma conta. Você mapeia ID, nome e responsável; os demais campos escolhidos viram contexto local da conta.</p></div>{error ? <div className="mb-4"><ErrorBox message={error} /></div> : null}{!table ? <Card className="max-w-3xl"><label className="flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center transition hover:border-gray-400"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100"><Upload size={20} /></div><div className="mt-4 text-sm font-semibold">Escolher CSV</div><div className="mt-1 text-sm text-gray-500">Vírgula, ponto e vírgula ou tabulação. Cabeçalho obrigatório.</div><input type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file) readFile(file); }} /></label><div className="mt-4 rounded-xl bg-gray-50 p-3 text-sm leading-5 text-gray-500"><strong className="text-gray-700">Privacidade:</strong> nome da conta, ID externo, responsável e atributos do CSV ficam somente neste navegador. O backend recebe apenas uma conta pseudônima e a relação com episódios.</div></Card> : <div className="space-y-4"><Card><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100"><FileSpreadsheet size={18} /></div><div><div className="text-sm font-semibold">{fileName}</div><div className="text-sm text-gray-500">{table.rows.length} linhas · {table.headers.length} colunas</div></div><Button variant="secondary" className="ml-auto" onClick={() => { setTable(null); setResult(null); }}>Trocar arquivo</Button></div></Card><Card><h2 className="font-semibold">1. Mapear a conta</h2><p className="mt-1 text-sm leading-5 text-gray-500">O Ohrly não impõe nomes de coluna. Diga apenas como identificar e exibir cada conta.</p><div className="mt-4 grid gap-4 md:grid-cols-3"><Field label="Identificador único"><select className={inputClass} value={mapping.id} onChange={(e) => setMapping({ ...mapping, id: e.target.value })}><option value="">Selecione...</option>{table.headers.map((h) => <option key={h} value={h}>{h}</option>)}</select></Field><Field label="Nome da conta"><select className={inputClass} value={mapping.name} onChange={(e) => setMapping({ ...mapping, name: e.target.value })}><option value="">Selecione...</option>{table.headers.map((h) => <option key={h} value={h}>{h}</option>)}</select></Field><Field label="Responsável" hint="Opcional"><select className={inputClass} value={mapping.owner} onChange={(e) => setMapping({ ...mapping, owner: e.target.value })}><option value="">Não mapear</option>{table.headers.map((h) => <option key={h} value={h}>{h}</option>)}</select></Field></div></Card><Card><h2 className="font-semibold">2. Escolher contexto importado</h2><p className="mt-1 text-sm leading-5 text-gray-500">Marque apenas os campos que ajudam o CSM a entender a conta. Eles não geram episódios nem gatilhos nesta versão.</p><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{table.headers.filter((h) => ![mapping.id, mapping.name, mapping.owner].includes(h)).map((header) => <label key={header} className="flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 p-3 text-sm font-medium"><input type="checkbox" checked={attributeColumns.includes(header)} onChange={() => toggleAttribute(header)} /> <span className="truncate">{header}</span></label>)}</div></Card><Card><h2 className="font-semibold">3. Prévia</h2><div className="mt-3 overflow-x-auto"><table className="min-w-full border-collapse text-left text-sm"><thead><tr className="border-b border-gray-200 text-gray-400">{table.headers.slice(0, 8).map((h) => <th key={h} className="whitespace-nowrap px-2 py-2 font-semibold">{h}</th>)}</tr></thead><tbody>{preview.map((row, ri) => <tr key={ri} className="border-b border-gray-100">{row.slice(0, 8).map((value, ci) => <td key={ci} className="max-w-[180px] truncate px-2 py-2 text-gray-600">{value || "—"}</td>)}</tr>)}</tbody></table></div><div className="mt-5 flex gap-2"><Button onClick={runImport} disabled={saving || !mapping.id || !mapping.name}>{saving ? "Importando..." : `Importar ${table.rows.length} linhas`}</Button><Button variant="secondary" onClick={() => router.push("/accounts")}>Cancelar</Button></div></Card></div>}</AppShell>;
}
