# Repositorio Dataform (um so; os release/workflow configs sao por ambiente, em environments/).
# Executa como sa-billing-dataform (que le a view de billing export).
# NOTA: os recursos google_dataform_* sao do provider google-beta.

# Forca a criacao do Dataform service agent (nao existe so por habilitar a API).
resource "google_project_service_identity" "dataform" {
  provider = google-beta
  project  = var.project_id
  service  = "dataform.googleapis.com"

  depends_on = [google_project_service.this]
}

# Secret com um GitHub token (repo:read em DP6/polaris-cost-model). O CONTAINER e criado aqui;
# a VERSAO (o token) e adicionada A MAO antes do primeiro apply — ver README.
resource "google_secret_manager_secret" "dataform_git_token" {
  secret_id = "polaris-cost-model-dataform-git-token"
  replication {
    auto {}
  }
  depends_on = [google_project_service.this]
}

resource "google_secret_manager_secret_iam_member" "dataform_agent_reads_token" {
  secret_id = google_secret_manager_secret.dataform_git_token.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_project_service_identity.dataform.email}"
}

resource "google_dataform_repository" "billing" {
  provider        = google-beta
  name            = "polaris-cost-model"
  region          = var.region
  service_account = google_service_account.dataform.email

  git_remote_settings {
    url                                 = "https://github.com/${var.github_repo}.git"
    default_branch                      = "main"
    authentication_token_secret_version = "${google_secret_manager_secret.dataform_git_token.id}/versions/latest"
  }

  workspace_compilation_overrides {
    default_database = var.project_id
  }

  depends_on = [
    google_project_service.this,
    google_service_account_iam_member.dataform_agent_impersonate,
    google_secret_manager_secret_iam_member.dataform_agent_reads_token,
  ]
}
