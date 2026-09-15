# Ohrly Field MVP — Episode Workspace

Primeira versão funcional do **Ohrly Loop** em Next.js + TypeScript + Tailwind + Supabase.

A unidade principal da interface agora é o **episódio**, não uma sequência de páginas. O CSM trabalha em duas superfícies:

1. **Work Queue** — o que precisa de atenção agora;
2. **Episode Workspace** — a história inteira do caso em uma timeline viva.

O ciclo testado é:

**Observe → Act → Execution Reality → Learn**

```text
mudança percebida
→ decisão
→ intervenção
→ execução / exceção
→ resposta
→ revisão
→ recuperação / piora / recaída / novo acompanhamento
```

## O que mudou nesta versão

- a home virou uma fila operacional por próximo passo;
- `Intervir` não navega mais para outra página: o formulário abre inline;
- `PLANNED / EXECUTED / EXCEPTION` é gerenciado no mesmo episódio;
- reviews acontecem inline na mesma timeline;
- o CSM pode registrar atualizações intermediárias (`cliente respondeu`, `reunião aconteceu`, `novo sinal`, `exceção`, `nota`);
- o painel lateral mostra **estado atual + próximo passo**;
- reviews não fecham mais o episódio automaticamente;
- fechamento do ciclo é uma decisão explícita;
- `partial_recovery`, `too_early`, recaída etc. podem continuar gerando novas revisões.

As rotas antigas de intervenção/review continuam existindo apenas como redirects para o Episode Workspace.

## Privacidade por padrão

O Supabase recebe somente dados estruturados do experimento:

- tipo de mudança;
- faixa de persistência;
- decisão atual;
- tipo de intervenção;
- estado de execução;
- tipo de atualização;
- outcome;
- impacto percebido na decisão.

Ficam apenas em `localStorage`:

- alias da conta;
- notas livres;
- objetivo textual da intervenção;
- texto livre das atualizações.

A autenticação usa Supabase Anonymous Sign-Ins. O `auth.uid()` é um identificador pseudônimo técnico para RLS e continuidade de sessão.

## Rodando localmente

Sem `.env.local`, o app funciona em modo local e persiste no navegador.

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Supabase

### Projeto novo

Execute, nesta ordem:

```text
supabase/migrations/001_field_mvp.sql
supabase/migrations/002_episode_workspace.sql
```

### Projeto que já estava rodando a versão anterior

Execute **somente a migration nova**:

```text
supabase/migrations/002_episode_workspace.sql
```

Ela adiciona:

- `interventions.execution_updated_at`;
- tabela `episode_updates` com RLS.

Sem essa migration, ações de execução e atualizações da timeline vão falhar no Supabase.

### Anonymous Sign-Ins

No dashboard do Supabase, habilite **Anonymous Sign-Ins** em Authentication.

### Ambiente

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Eventos de telemetria

Principais eventos:

- `episode_created`
- `episode_viewed`
- `episode_decision_updated`
- `intervention_created`
- `execution_updated`
- `episode_update_added`
- `episode_reviewed`
- `episode_closed`

Isso permite acompanhar:

```text
Created Episode
→ Intervention
→ Executed / Exception
→ Review
→ Explicit Close
→ Second Episode
```

A métrica principal continua sendo **Closed Loop Completion Rate**, complementada por:

- episode → intervention rate;
- execution confirmation rate;
- review return rate;
- decision impact;
- second episode rate;
- frequência de updates intermediários;
- exceções de execução.

## Estrutura principal

```text
app/
  page.tsx                          Work Queue
  episodes/new/page.tsx            novo episódio
  episodes/[id]/page.tsx           Episode Workspace completo
  episodes/[id]/intervention/      redirect legado
  interventions/[id]/review/       redirect legado
components/
lib/
supabase/migrations/
```

## Fora do MVP por enquanto

- detecção automática de degradação;
- health score;
- múltiplas variantes/coortes;
- Evidence Readiness sofisticado;
- rollout progressivo;
- rollback automático;
- inferência causal;
- workflow builder;
- roteamento contextual automático;
- prescrição automática de intervenção.

A regra segue a mesma: **não construir o próximo nível até que o uso dos design partners peça por ele.**
