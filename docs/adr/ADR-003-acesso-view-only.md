# ADR-003 — Acesso à origem: view-only, SA dedicada

Data: 2026-09-09 · Status: aceito (aguardando grant da TI)

## Contexto

Ninguém ganha acesso à tabela bruta `dp6-billing-voucher.billing_export`. Só a
`vw_dp6_ci_polaris` (filtrada por `project.id = 'dp6-ci-polaris'`) é acessível, e hoje só pelo
grupo `gcp-ci-polaris@dp6.com.br`. O Dataform roda não-assistido, como service account — que
não é membro de grupo e não tem esse acesso.

## Decisão

- Service account **dedicada** `sa-billing-dataform@dp6-ci-polaris.iam.gserviceaccount.com`
  (não o Dataform service agent compartilhado), definida como `service_account` do
  `google_dataform_repository`.
- A TI concede **`roles/bigquery.dataViewer` direto no recurso da view** `vw_dp6_ci_polaris` —
  nada no dataset, nada na `billing_export`.
- A `vw_dp6_ci_polaris` **precisa ser authorized view** sobre `billing_export` (a própria view
  lê a tabela em nome de quem chama). Confirmado indiretamente: membros do grupo consultam a
  view sem ter acesso à tabela → já é authorized view.
- O código lê **apenas a view** — `source` declaration + `assert_source_freshness` +
  `assert_fct_reconciliation` apontam para `vw_dp6_ci_polaris`, nunca para a tabela.

## Alternativas consideradas

- **SA membro de `gcp-ci-polaris@dp6.com.br`** — mesmo acesso que os humanos; funciona, mas
  alarga o grupo e algumas orgs bloqueiam SA em grupo. O grant direto na view é mais restrito.
- **Authorized dataset** (staging vira view + `_mat`, dataset autorizado no `billing_dp6_ci_polaris`)
  — não precisaria de IAM nenhum pra SA, mas exige reestruturar o staging. Reservado como
  plano B se o grant direto for recusado.
- **Cópia agendada por um humano do grupo** para uma landing table em `dp6-ci-polaris` — não
  depende do lado billing, mas a scheduled query fica "dona" de uma pessoa. Plano C.

## Consequências

- Ordem obrigatória: a SA precisa **existir** antes do grant (`gcloud iam service-accounts
  create`, depois `terraform import` no bootstrap).
- Se a view não for authorized view, a query falha na `billing_export` — pedir à TI que
  confirme no momento do grant.
- IAM da origem fica **fora do Terraform** (análogo ao ADR-002 do `polaris-cost-control`).
