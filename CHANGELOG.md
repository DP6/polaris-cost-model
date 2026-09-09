# CHANGELOG

Formato: o que foi feito, decisões, erros/aprendizados, status. Data em ordem decrescente.

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
