# terraform/bootstrap/

Recursos fundacionais do CI/CD e da ingestão. **State local, apply manual, uma vez.**
Fora dos workflows de CI (que só tocam `terraform/environments/**`).

Cria: APIs · bucket de state remoto · WIF pool + 2 providers (plan / apply-main) ·
SAs `gh-plan-cost-model` / `gh-apply-cost-model` / **`sa-billing-dataform`** · Artifact Registry
`apps` · Secret Manager (container do token do Git) · `google_dataform_repository` executando
como `sa-billing-dataform` · IAM de projeto para as SAs.

## Aplicar

```bash
cd terraform/bootstrap
gcloud auth application-default login
terraform init

# 0) se voce ja criou a SA sa-billing-dataform a mao (para desbloquear o grant da TI na view),
#    adote ela no state antes do apply:
terraform import google_service_account.dataform \
  projects/dp6-ci-polaris/serviceAccounts/sa-billing-dataform@dp6-ci-polaris.iam.gserviceaccount.com

# 1) token do Git para o Dataform ler o repo (repo:read em DP6/polaris-cost-model):
terraform apply -target=google_secret_manager_secret.dataform_git_token   # cria só o container

GH_TOKEN=$(gh auth token)   # ou um PAT fine-grained com Contents:read
printf '%s' "$GH_TOKEN" | gcloud secrets versions add polaris-cost-model-dataform-git-token --data-file=-

# 2) resto:
terraform apply
```

## Depois do apply

```bash
terraform output -raw github_secrets_cmd          # cola no terminal (confere com o passo 1)
terraform output -raw external_access_request     # texto do pedido para a TI / dono do billing
```

1. **Rodar o `github_secrets_cmd`** — confere/atualiza os 4 secrets de WIF no repo GitHub.
2. **Pedido externo** — encaminhar o `external_access_request`: adicionar
   `sa-billing-dataform@dp6-ci-polaris.iam.gserviceaccount.com` ao grupo
   `gcp-ci-polaris@dp6.com.br` (ou `dataViewer` só na view). Sem isso, o Dataform não lê a origem.
3. **`vw_dp6_ci_polaris` tem que ser _authorized view_** sobre `billing_export` — confirmar com
   o dono do `dp6-billing-voucher`.
4. Seguir para `terraform/environments/` (via CI, depois do primeiro push).

## Não versionar

`terraform.tfstate*` (state local — não perder), `terraform.tfvars`, `.terraform/`.
