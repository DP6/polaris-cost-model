# polaris-cost-model

Modelagem analítica de custo do **CI Polaris** a partir do billing export do GCP.
Projeto GCP único da iniciativa: `dp6-ci-polaris`. Billing account:
`008012-F93445-DFD798` ("DP6 Self Billing (Voucher)", BRL).

Camada de custo confiável em cima da view de billing export
(`dp6-billing-voucher.billing_dp6_ci_polaris.vw_dp6_ci_polaris`): custo líquido, economia,
evolução temporal e showback por `app`×`environment`, num grão diário — materializada por
Dataform, orquestrada pelo agendamento nativo do Dataform, com alerta de falha por e-mail
para `gcp-ci-polaris@dp6.com.br` (mesmo canal do budget alert do `polaris-cost-control`).

## Estado

| Fase | Entrega | Status |
|---|---|---|
| 1 — Spec | `specs/001-modelagem-billing-export-bq.md` — indicadores, granularidade, regras | 🟡 rascunho para revisão |
| 2 — Validação | `validation/*.sql` + `validation/RESULTADOS.md` | ✅ consolidado (location `US`) |
| 2.5 — Consumo e entrega | `specs/002` + `docs/data-contract.md` | ✅ entrega = **app standalone**; IA = 4 abas; 6 views `rpt_*` |
| 2.6 — Mock visual | `mock/index.html` (interativo, 4 abas) · `mock/canvas/*.dc.html` + `mock/painel-finops-ci-polaris.html` (canvas de design, **8 telas FinOps, aprovado**) | ✅ |
| 2.5 A (2º passe) | `docs/data-contract.md` §6–§7 — 13 views `rpt_*`, matriz das 8 telas, o que não vem do billing export | ✅ |
| 3 — Spec do app | `specs/003-app-standalone.md` — arquitetura, 8 telas, 21 endpoints + schemas, auth IAP, ACs | ✅ rascunho |
| 4 — Dataform | `workflow_settings.yaml` + `includes/constants.js` + `definitions/` (source · staging · 4 marts · 13 `reporting/` · 4 assertions) | ✅ **`dataform compile` → 23 ações OK** |
| 5 — App | `apps/api/` (FastAPI, 22 endpoints, **testes ✅ em mock**) + `apps/web/` (React+Recharts, shell + Visão geral + 7 stubs, **`tsc` ✅**) | ✅ rascunho — ver `apps/README.md` |
| 6 — Terraform | `terraform/bootstrap/` (WIF, SAs, state bucket, Artifact Registry, Secret, Dataform repo) + `terraform/modules/{data_stack,app_service}` + `terraform/environments/{dev,prod}` + `.github/workflows/` (5) | ✅ rascunho — **`terraform fmt` OK**; `validate` pende de `init` |
| 7 — Docs | 7 ADRs (`docs/adr/ADR-001..007`), `CLAUDE.md`, `SESSIONLOG.md`, `CHANGELOG.md` | ✅ |

**Rascunho completo (Fases 1–7).** Nada aplicado no GCP. Bloqueador: grant da TI para
`sa-billing-dataform` na view (em andamento). **Próximos passos exatos em `SESSIONLOG.md`.**

## Dataform — rodar local

```bash
cd ~/ci-polaris/polaris-cost-model
npx -y @dataform/cli@3.0.0 compile          # offline, resolve refs (✅)
# dry-run / run precisam de: datasets billing_polaris_* criados em US,
# grant cross-project bigquery.dataViewer em dp6-billing-voucher, e .df-credentials.json
```

Ainda **não** é um repositório Git nem tem infra provisionada. Entrega decidida: app React
standalone (`apps/api` FastAPI fino + `apps/web` React+Recharts com o DP6 Design System),
Cloud Run + IAP. Plano completo: `~/.claude/plans/consegui-acesso-a-elegant-possum.md`.

## Fase 2 — como rodar as validações

```bash
# autenticar com um identity que tenha bigquery.dataViewer no dataset de origem
gcloud auth application-default login

for f in validation/0*.sql validation/1*.sql; do
  echo "=== $f ==="
  bq query --use_legacy_sql=false --format=pretty < "$f"
done
```

Cada arquivo tem, no cabeçalho, o que ele decide e o que olhar no resultado. Anotar as
conclusões em `validation/RESULTADOS.md` (criar ao rodar) — elas alimentam a versão final da
spec e os `vars` do `workflow_settings.yaml`.
