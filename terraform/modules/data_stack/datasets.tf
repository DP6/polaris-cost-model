locals {
  # billing_polaris_{stg,mart,reporting,assertions}_{env}
  datasets = ["stg", "mart", "reporting", "assertions"]
}

resource "google_bigquery_dataset" "this" {
  for_each                        = toset(local.datasets)
  project                         = var.project_id
  dataset_id                      = "billing_polaris_${each.value}_${var.env}"
  location                        = var.location
  description                     = "Painel FinOps CI Polaris - camada ${each.value} (${var.env})"
  delete_contents_on_destroy      = var.env == "dev"
  default_partition_expiration_ms = null

  labels = {
    app         = "polaris-cost-model"
    environment = var.env
    managed-by  = "terraform"
  }
}

# SA do Dataform: escreve em stg/mart/reporting/assertions
resource "google_bigquery_dataset_iam_member" "dataform_editor" {
  for_each   = google_bigquery_dataset.this
  project    = var.project_id
  dataset_id = each.value.dataset_id
  role       = "roles/bigquery.dataEditor"
  member     = "serviceAccount:${var.dataform_sa_email}"
}

# SA de runtime da API: le SO o reporting
resource "google_bigquery_dataset_iam_member" "api_reporting_viewer" {
  project    = var.project_id
  dataset_id = google_bigquery_dataset.this["reporting"].dataset_id
  role       = "roles/bigquery.dataViewer"
  member     = "serviceAccount:${var.api_runtime_sa_email}"
}
