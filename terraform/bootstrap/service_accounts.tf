# ---- SAs de CI ----
resource "google_service_account" "gh_plan" {
  account_id   = "gh-plan-cost-model"
  display_name = "GitHub Actions - terraform plan (read-only)"
}

resource "google_service_account" "gh_apply" {
  account_id   = "gh-apply-cost-model"
  display_name = "GitHub Actions - terraform apply (main only)"
}

# ---- SA dedicada do Dataform ----
# Le a view dp6-billing-voucher.billing_dp6_ci_polaris.vw_dp6_ci_polaris.
# O acesso a view vem de FORA (a TI concede roles/bigquery.dataViewer direto no recurso da view;
# a view precisa ser authorized view sobre billing_export). Ver README, "Depois do apply".
# Se a SA ja foi criada a mao para desbloquear a TI: `terraform import` antes do apply (README).
resource "google_service_account" "dataform" {
  account_id   = "sa-billing-dataform"
  display_name = "Dataform - le a view de billing export do CI Polaris"
}

# ---- quem pode impersonar via WIF ----
resource "google_service_account_iam_member" "plan_wif" {
  service_account_id = google_service_account.gh_plan.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.gh.name}/attribute.repository/${var.github_repo}"
}

resource "google_service_account_iam_member" "apply_wif" {
  service_account_id = google_service_account.gh_apply.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.gh.name}/attribute.repository/${var.github_repo}"
}

# ---- Dataform service agent impersona a SA dedicada ----
# (o Dataform executa os jobs BigQuery como sa-billing-dataform quando o repository/workflow_config
#  define service_account = essa SA — ver terraform/modules e environments/)
resource "google_service_account_iam_member" "dataform_agent_impersonate" {
  service_account_id = google_service_account.dataform.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:service-${var.project_number}@gcp-sa-dataform.iam.gserviceaccount.com"
}
