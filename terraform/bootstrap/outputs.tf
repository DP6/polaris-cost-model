output "state_bucket" {
  value = google_storage_bucket.tfstate.name
}

output "wif_provider_plan" {
  value = google_iam_workload_identity_pool_provider.plan.name
}

output "wif_provider_apply" {
  value = google_iam_workload_identity_pool_provider.apply.name
}

output "sa_plan" {
  value = google_service_account.gh_plan.email
}

output "sa_apply" {
  value = google_service_account.gh_apply.email
}

output "sa_dataform" {
  value = google_service_account.dataform.email
}

output "artifact_registry" {
  value = data.google_artifact_registry_repository.apps.id
}

output "dataform_repository" {
  value = google_dataform_repository.billing.id
}

# cola no terminal para setar os secrets do GitHub (confere com o passo 1 que voce ja rodou)
output "github_secrets_cmd" {
  value = <<-EOT
    gh secret set WIF_PROVIDER_PLAN  --repo ${var.github_repo} --body "${google_iam_workload_identity_pool_provider.plan.name}"
    gh secret set WIF_PROVIDER_APPLY --repo ${var.github_repo} --body "${google_iam_workload_identity_pool_provider.apply.name}"
    gh secret set WIF_SA_PLAN        --repo ${var.github_repo} --body "${google_service_account.gh_plan.email}"
    gh secret set WIF_SA_APPLY       --repo ${var.github_repo} --body "${google_service_account.gh_apply.email}"
  EOT
}

# texto do pedido externo (grant direto na view — TI ja confirmou que vai liberar)
output "external_access_request" {
  value = <<-EOT
    Conceder roles/bigquery.dataViewer para a service account
      ${google_service_account.dataform.email}
    SO no recurso  dp6-billing-voucher:billing_dp6_ci_polaris.vw_dp6_ci_polaris.
    Comando: bq add-iam-policy-binding \
      --member="serviceAccount:${google_service_account.dataform.email}" \
      --role="roles/bigquery.dataViewer" \
      "dp6-billing-voucher:billing_dp6_ci_polaris.vw_dp6_ci_polaris"
    Confirmar tambem que a view e AUTHORIZED VIEW sobre billing_export
    (senao a query falha na tabela de origem). Pipeline nao-assistido, 1x/dia, le SO essa view.
  EOT
}
