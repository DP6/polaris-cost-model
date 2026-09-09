variable "project_id" {
  type    = string
  default = "dp6-ci-polaris"
}
variable "project_number" {
  type    = string
  default = "209825626529"
}
variable "region" {
  type    = string
  default = "us-central1"
}
variable "location" {
  type    = string
  default = "US"
}

# do bootstrap (valores deterministicos — sobrescreva em dev.auto.tfvars se mudarem)
variable "dataform_repository" {
  type    = string
  default = "polaris-cost-model"
}
variable "dataform_sa_email" {
  type    = string
  default = "sa-billing-dataform@dp6-ci-polaris.iam.gserviceaccount.com"
}

variable "git_commitish" {
  type    = string
  default = "develop" # dev compila a branch develop; prod compila main
}

# imagens: no 1o apply usa o hello (placeholder); o CI faz o deploy real e o TF ignora `image`
variable "api_image" {
  type    = string
  default = "us-docker.pkg.dev/cloudrun/container/hello"
}
variable "web_image" {
  type    = string
  default = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "iap_allowed_members" {
  type    = list(string)
  default = ["group:gcp-ci-polaris@dp6.com.br"]
}

variable "alert_email" {
  type    = string
  default = "gcp-ci-polaris@dp6.com.br"
}
