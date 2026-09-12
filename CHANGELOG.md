# CHANGELOG

Formato: o que foi feito, decisões, erros/aprendizados, status. Data em ordem decrescente.

## 2026-09-12 — Design system: fonte única em `ci-polaris` (ver ADR-009)

Piloto da Fase 1 do rollout do [DP6 Design System](https://github.com/DP6/ci-polaris)
na iniciativa — cost-model foi o primeiro repo a receber a mudança (Atlas depois,
replicando o padrão validado aqui), invertendo a ordem original do plano porque os
conflitos pré-existentes (raio, vermelho) estavam documentados justamente nas specs
deste repo.

- **Proveniência**: `DESIGN.md`/`CLAUDE.md`/`specs/003` passam a apontar pra
  `ci-polaris/DP6-Design-System.md` + `MAPA-DE-TOKENS.md` em vez de espelhar
  `atlas/apps/frontend/src/index.css` direto (ADR-009). Tirada a menção incorreta
  a Tailwind (o repo nunca usou).
- **Migração de 10 aliases legados** (`--surface/--well/--ink/--ink-dim/--hair/
  --hair-strong/--accent/--ok/--warn/--bad`) pra nomes canônicos já existentes —
  zero mudança de valor, `index.css` já os declarava via `var()`.
- **3 bugs reais achados ao validar** (não previstos no plano original):
  `palette.ts` lia aliases deprecados em vez dos `--chart-*` já existentes, com
  fallback cobrindo só uma de cinco séries; o gráfico empilhado (`TemporalChart`)
  só diferenciava as 2 primeiras séries de um stack de até 6 (as demais caíam
  todas em cinza); o toggle de tema não repintava os gráficos de forma
  confiável (`useTheme` era estado local por componente) — convertido pra
  `useSyncExternalStore` compartilhado.
- **Vermelho de status** (`--status-error`) passa a variar por tema (`#d64500`
  claro / `#e53e3e` escuro, igual já era) — decisão de produto confirmada pelo
  usuário; `#d64500` já era o valor documentado em `specs/002`/`specs/003`/
  `mock/README.md`, o código é que estava fora de sincronia.
- **Bug achado nas próprias salvaguardas**: `check_contrast.py`
  (`ci-polaris/scripts/`) tinha colisão de seletor — `.dark` batia primeiro num
  comentário do `index.css`, não na regra CSS real, fazendo o tema escuro ser
  checado com os valores do claro. Corrigido em `ci-polaris`.
- Raio, tipografia, cor de texto mudo: mantidos como estão — divergência do DS
  aceita e documentada em `ci-polaris/MAPA-DE-TOKENS.md`, não forçada.
- **Fora de escopo, registrado como dívida**: hardcode não-cor (~62 `style={{}}`
  com `borderRadius`/`fontSize`/`gap` literais em vez de token) — maior, sem
  urgência de bug, fica pra outra rodada. `mock/canvas/` (691 hex literais, tema
  claro, protótipo das 7 telas ainda em `Stub.tsx`) e `mock/index.html` (3ª
  nomenclatura de token, candidato a deprecação) não fizeram parte deste
  rollout — escopo original era só o app real. As 3 IAs de navegação em
  circulação (8 tabs em `App.tsx`/canvas, 6 em `specs/005`, 5 no mock)
  continuam divergentes, sem reconciliação nesta rodada.
- PR [#14](https://github.com/DP6/polaris-cost-model/pull/14), validado
  visualmente pelo usuário (toggle de tema, stack de cores, vermelho por tema).

## 2026-09-11 — Fluxo de promoção dev → prod (branch → develop → main)

Formaliza em CD o que o ADR-007 já declarava (`dev` compila `develop`, `prod` compila `main`)
mas nunca teve workflow — até aqui só `main` disparava deploy, e só pra dev; `prod` nunca foi
aplicado.

**Fluxo:** push de qualquer branch → `pr-to-develop.yml` abre PR pra `develop` automaticamente
→ merge manual (sem trava do GitHub — sem review count obrigatório) → `deploy-dev.yml` dispara,
cada job atrás do gate do Environment `dev-deploy` (reviewers obrigatórios) → se aprovado,
`terraform apply` (dev) + build/deploy do app rodam de verdade → se ambos sucederem, o job
`promote-to-main` abre PR `develop → main` automaticamente → merge manual → `deploy-prod.yml`
dispara, gate `prod-deploy` → se aprovado, aplica prod pela primeira vez.

- Substituídos `terraform-apply.yml` + `apps-deploy.yml` (só main→dev, sem gate) por
  `deploy-dev.yml` + `deploy-prod.yml` (um por ambiente, cada um atrás do Environment gate).
- Novo `pr-to-develop.yml`.
- `terraform/bootstrap/wif.tf`: provider `apply` liberado pra `refs/heads/develop` também
  (antes só `main` — bloquearia qualquer deploy disparado por push em `develop`).
- **Trava real é só o gate de reviewers do Environment** (`dev-deploy`/`prod-deploy`, GitHub
  Environments configurados via `gh api`, reviewers: matheus.fuzati, sara.santana,
  gabrielly.andrade) — merge de PR continua manual e sem enforcement (decisão explícita, não
  branch protection).
- `prod` builda a própria imagem a partir de `main` (não reaproveita/retag a imagem de dev) —
  mais simples, e o conteúdo é garantidamente igual já que `develop→main` é sempre promoção
  automática sem edição no meio.
- **Risco registrado, não bloqueante:** mesma SA `gh-apply-cost-model` (roles amplas de
  projeto) usada pra dev e prod — isolamento é 100% procedural (gate de reviewers), não um
  limite técnico de IAM.

## 2026-09-11 — Incidente: duplicação nas tabelas incrementais

**Sintoma:** alerta do Monitoring (`billing-polaris dev - Dataform workflow FAILED`) na
execução agendada `dev-daily` das 06:30 (America/Sao_Paulo). `assert_stg_no_exact_duplicate`
e `assert_fct_reconciliation` falharam. Dado ao vivo ficou incorreto: `fct_billing_cost_daily`
mostrou agosto em R$ 70,96 (era R$ 23,65) e o scorecard marcou 112% do orçamento.

**Causa raiz:** `stg_billing_polaris` e `fct_billing_cost_daily` são `type: incremental` com
`bigquery.updatePartitionFilter` mas **sem `uniqueKey`**. Sem `uniqueKey`, o Dataform não
substitui a partição — cada run incremental faz `INSERT` puro dos `lookback_days` (45 dias)
reprocessados, duplicando (dobrando) toda a janela de lookback a cada execução, indefinidamente.
Confirmado por query: linhas fora do lookback (`usage_date < hoje-45d`) com `n == distinct
source_row_fp`; dentro do lookback, `n` ≈ `2×` `distinct source_row_fp`.

**Fix:** `uniqueKey` em ambas — `stg_billing_polaris` usa `source_row_fp` (nunca nulo, já
existia); `fct_billing_cost_daily` usa um `grain_key` sintético (`MD5` das colunas de grão
com `IFNULL(...,'')`) em vez das colunas de grão cruas — `label_environment`/`app`/
`managed_by` são NULL em ~90-96% das linhas (cobertura de label 4-10%) e o MERGE do BigQuery
não casa `NULL = NULL` (vira `UNKNOWN`), então um `uniqueKey` direto nunca daria `MATCH` pra
essas linhas. As colunas de label continuam NULL de verdade na tabela — `rpt_label_coverage`
e `rpt_showback_monthly` dependem disso (`IS NOT NULL`, `COALESCE(...,'(sem label)')`).

**Remediação:** `--full-refresh` (`fullyRefreshIncrementalTablesEnabled: true`) no
`workflowConfig` `dev-daily` pra descartar as linhas duplicadas e reconstruir do zero.

## 2026-09-10 — UX dos dashboards (PR A: modelo + Visão Geral)

- `specs/004-ux-dashboards.md` — modelo de período (presets `Mês corrente` · 30d · 90d · Este
  ano · Personalizado; widgets mês-âncora ignoram o período mas respeitam Serviço/Ambiente/App),
  comportamento dos filtros (tudo parametrizado, valores de `/api/dimensions`, estado na URL +
  `pcm:filters`), fundação de DS (espelhar o `atlas/apps/frontend` — Tailwind v4 + shadcn +
  TanStack + dark-default), Visão Geral item a item, checklist de replicação das 7 abas.
- **Faseado:** PR A = tokens/visual + FilterBar + Visão Geral no stack leve atual;
  PR B = swap de framework (Tailwind v4 + shadcn + TanStack).
- `apps/web/src/index.css` — re-base dos tokens para os valores do Atlas (`--background`,
  `--foreground`, `--card`, `--primary`, `--status-*`, `--accent-*`, `--text-*`, `--radius` 5px),
  **dark por padrão** (`:root` claro / `.dark` escuro; script bloqueante em `index.html`;
  `src/lib/useTheme.ts`). Aliases legados mantidos. `apps/web/DESIGN.md`.
- `apps/web` — `FilterBar` global nova (Período com presets + range custom · Serviço ·
  Ambiente · App de `/api/dimensions` · Moeda · Limpar filtros), `useFilters` com
  `resolveWindow`/`scopeParams`, `PageHeader`/`Panel`/`StatusBadge` locais, **Visão Geral
  reconstruída** (tira de saúde dos dados, scorecard filtro-aware, reconciliação "(parcial)").
- `apps/api` — `GET /api/dimensions` (`DimensionsDTO`); `/scorecard`, `/reconciliation`,
  `/budget` aceitam `service`/`environment`/`app` e recalculam de `rpt_cost_daily`/
  `rpt_cost_monthly`; `/forecast` aceita os params (projeto-inteiro por ora — view sem grão).
  `meta()` corrigido: `fct_billing_cost_daily` não tem `export_time` (é agregado) → frescor por
  `MAX(usage_date)` como proxy (um `rpt_meta` com o timestamp real fica p/ depois).

## 2026-09-09 — Fases 1 a 7 (rascunho completo)

### Fase 1 — Spec de indicadores
- `specs/001-modelagem-billing-export-bq.md`: camadas, grão, dicionário de indicadores, regras.

### Fase 2 — Validação da view
- `validation/*.sql` (12 consultas) rodadas pelo usuário; `validation/RESULTADOS.md` consolidado.
- **Achados:** R$ 26,41 em ~2 meses · Cloud Run 82% · 1 projeto · location **US** · a view é
  `SELECT * FROM gcp_billing_export_resource_v1_… WHERE project.id='dp6-ci-polaris'` (sem dedup,
  tipos nativos) · créditos só `DISCOUNT` (R$ -0,57) · `cost_at_list == cost` (sem desconto
  negociado) · cobertura de label 4–10% · restatement até 31 dias (fechamento de fatura).
- **Travado:** `lookback_days=45`, `freshness=36h`, dedup por `TO_JSON_STRING(r.* EXCEPT export_time)`.
- Bugs corrigidos nas consultas 04/06/07 (`GROUP BY` via alias, `ARRAY_AGG` em CSV).

### Fase 2.5 — Camada de consumo
- `specs/002` (IA dos dashboards) + `docs/data-contract.md` (matriz widget→endpoint→view→coluna).
- IA cresceu de 4 → **8 abas** após o canvas de design aprovado (Visão geral · Orçamento &
  previsão · Tendência · Alocação · Serviços & SKUs · Otimização & waste · Unit economics ·
  Anomalias). **13 views `rpt_*`**.
- Mocks: `mock/index.html` (interativo, 4 abas, tema claro/escuro) + `mock/canvas/*.dc.html`
  (canvas de design, 8 telas — Artifact publicado).
- Paleta de gráficos validada com o `dataviz` validator: só azul/verde como série categórica.

### Fase 3 — Projeto Dataform
- `workflow_settings.yaml` (Core 3.0, **sem `package.json`** — o 3.x recusa), `includes/constants.js`.
- `definitions/`: source · `stg_billing_polaris` (incremental) · 4 marts · **13 `reporting/rpt_*`**
  (dataset `billing_polaris_reporting`) · 4 assertions.
- `npx @dataform/cli@3.0.0 compile` → **23 ações, sem erro.**
- `cost_at_list` saiu de "dormante" — alimenta o waterfall de Unit economics.

### specs/003 — App standalone
- Arquitetura (`apps/api` FastAPI + `apps/web` React), 8 telas, 21 endpoints + schemas, IAP, ACs.

### Fase 5 — App (rascunho)
- `apps/api/`: 22 endpoints + `/healthz`, DTOs Pydantic, cache TTL, **modo mock** (fixtures da
  validação), `recommendations.yaml`. `pytest` → 23 rotas 200. ✅
- `apps/web/`: React+Vite+Recharts, tokens DP6 DS, shell (tabs + filtros na URL + tema),
  **tela Visão geral completa**, 7 telas stub (chamam os endpoints, mostram payload).
  `tsc --noEmit` limpo. ✅

### Fase 6 — Terraform (rascunho, dev + prod)
- `terraform/bootstrap/`: APIs, state bucket, WIF pool + 2 providers, SAs (`gh-plan/apply`,
  **`sa-billing-dataform`**), Artifact Registry, Secret (token Git), `google_dataform_repository`.
- `terraform/modules/`: `data_stack` (datasets + Dataform release/workflow + alerta e-mail) ·
  `app_service` (Cloud Run v2 + IAP + SA runtime).
- `terraform/environments/{dev,prod}/`: root modules, backend GCS por prefixo.
- `.github/workflows/`: `terraform-plan`, `terraform-apply`, `dataform-ci`, `apps-ci`, `apps-deploy`.
- `terraform fmt` OK. `validate` pendente (precisa de `init`).

### Fase 7 — Docs
- 7 ADRs (`docs/adr/ADR-001..007`), `CLAUDE.md`, `SESSIONLOG.md`, este `CHANGELOG.md`.

### Decisões-chave
- Repo novo standalone (ADR-001) · Dataform nativo (ADR-002) · acesso view-only com SA dedicada
  (ADR-003) · app React standalone (ADR-004) · **orçamento R$ 20** (ADR-005) · alerta e-mail
  (ADR-006) · dev+prod por diretório (ADR-007).

### Erros / aprendizados
- Dataform Core 3.x **recusa `package.json`** — usar só `workflow_settings.yaml` + `dataformCoreVersion`.
- IAM da UI recusa principal que **não existe** — criar a SA antes de a TI conceder acesso
  (ovo-galinha); depois `terraform import` no bootstrap.
- `dataViewer` na view só funciona se ela for **authorized view** sobre `billing_export`.

### Status
- Escrito: tudo (Fases 1–7). Aplicado: nada. Bloqueador: grant da TI (em andamento).
