output "api_uri" {
  value = module.api.uri
}
output "web_uri" {
  value = module.web.uri
}
output "api_runtime_sa" {
  value = module.api.runtime_sa_email
}
output "datasets" {
  value = module.data_stack.dataset_ids
}
output "dataform_release_config" {
  value = module.data_stack.release_config
}
