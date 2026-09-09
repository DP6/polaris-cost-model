# Repositorio unico de imagens (billing-api / billing-web, dev + prod) — padrao do Atlas.
resource "google_artifact_registry_repository" "apps" {
  location      = var.region
  repository_id = "apps"
  format        = "DOCKER"
  description   = "Imagens do billing-api e billing-web (dev + prod)"
  depends_on    = [google_project_service.this]
}
