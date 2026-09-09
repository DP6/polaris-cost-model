# polaris-cost-model

Parte da iniciativa **CI Polaris**. Ver contexto geral em `~/ci-polaris/CLAUDE.md`.
Projeto GCP único: `dp6-ci-polaris`. Billing account `008012-F93445-DFD798` (BRL).

## Propósito

Camada analítica de custo do CI Polaris a partir do billing export
(`dp6-billing-voucher.billing_dp6_ci_polaris.vw_dp6_ci_polaris`) + painel FinOps standalone.
Custo líquido, economia, evolução, showback por `app`×`environment`, anomalia — grão diário.

## Estrutura

```
.
├── workflow_settings.yaml · includes/ · definitions/   # projeto Dataform (na raiz — o Dataform linka a raiz do repo)
│   ├── sources/           # declaration da view
│   ├── staging/           # stg_billing_polaris (incremental, dedup)
│   ├── marts/             # fct diário · agg mensal · dim_service_sku · vw_billing_daily_anomaly
│   ├── reporting/         # 13 views rpt_* — a fronteira que a API lê
│   └── assertions/        # 4
├── validation/            # SQL da Fase 2 + RESULTADOS.md (referência, não roda no pipeline)
├── apps/
│   ├── api/               # FastAPI fino — lê só rpt_* (Cloud Run billing-api-{dev,prod})
│   └── web/               # React+Vite+Recharts, DP6 Design System (Cloud Run billing-web-{dev,prod})
├── terraform/
│   ├── bootstrap/         # state LOCAL, apply manual 1x — WIF, SAs, state bucket, Dataform repo
│   ├── modules/           # data_stack · app_service
│   └── environments/{dev,prod}/   # state remoto GCS, aplicado pelo CI
├── mock/                  # mock/index.html (interativo) + mock/canvas/ (canvas de design, 8 telas)
├── specs/                 # spec-driven — uma por mudança relevante
├── docs/adr/ · docs/data-contract.md
└── .github/workflows/     # terraform-plan/apply · dataform-ci · apps-ci · apps-deploy
```

## Stack

- **Dataform** Core 3.0 (BigQuery, location US). `schema_suffix` por ambiente — os `.sqlx` não mudam.
- **API**: Python 3.12 + FastAPI, `uv`. Modo mock (`BILLING_API_MOCK=1`) serve fixtures da validação.
- **Web**: React 19 + Vite + Recharts + Tailwind, `pnpm`/`npm`.
- **IaC**: Terraform `google ~> 6.0` (Cloud Run usa `google-beta` por `iap_enabled`). Diretório por
  ambiente, **não** workspaces (ADR-007).
- **CI/CD**: GitHub Actions + WIF (sem chave de SA).

## Ambientes

| | Projeto | Dataform | Cloud Run | Branch |
|---|---|---|---|---|
| dev | `dp6-ci-polaris` | `release_config` dev, datasets `*_dev` | `billing-{api,web}-dev` | `develop` |
| prod | `dp6-ci-polaris` | `release_config` prod, datasets `*_prod` | `billing-{api,web}-prod` | `main` |

## Acesso à origem (ADR-003)

O Dataform lê **só a view** `vw_dp6_ci_polaris`, como `sa-billing-dataform@dp6-ci-polaris`.
A TI concede `dataViewer` direto na view; a view é authorized view sobre `billing_export`.
IAM da origem fica **fora do Terraform**.

## Convenções

- Toda mudança relevante começa por uma **spec** em `specs/` (`NNN-nome.md`), revisada antes de virar código.
- Decisão de arquitetura → **ADR** novo em `docs/adr/` (contexto → decisão → alternativas →
  consequências). Nunca apagar um ADR.
- Fim de fase / mudança relevante → atualizar `CHANGELOG.md`. Contexto de sessão alto ou antes de
  encerrar → atualizar `SESSIONLOG.md` (ler ao iniciar qualquer sessão).
- Commits: `<escopo>: <descrição>` (ex.: `dataform: adiciona rpt_budget_daily`).
- Nunca commitar `*.tfstate*`, `*.tfvars` reais (só `.example`), `.df-credentials.json`, `node_modules/`.
- Antes de `terraform apply`: `fmt` + `validate` + `plan` revisado no PR.

## Regras de Git (obrigatórias — de `~/ci-polaris/CLAUDE.md`)

- **Nunca `git push`** sem confirmação explícita minha logo antes do comando.
- **Sempre trabalhar em branch separada**, nunca commitar direto em `main`. (Exceção única: o
  seed inicial do repo — combinado à parte.)
- **Nunca aprovar ou mergear PR** sem eu dizer explicitamente naquele momento.
- Confirmação anterior não vale para as próximas.

## Comandos úteis

```bash
npx -y @dataform/cli@3.0.0 compile        # Dataform, offline
cd apps/api && BILLING_API_MOCK=1 uv run uvicorn billing_api.main:app --port 8080
cd apps/web && npm run dev                # proxy /api -> :8080
cd terraform && terraform fmt -recursive .
```
