# Valores não-sensíveis do ambiente dev — carregado automaticamente.
# Sobrescreve os defaults de variables.tf quando necessário.

git_commitish = "develop"

# depois que o CI publicar as imagens reais, aponte para elas (o TF ignora mudanca de `image`
# via lifecycle, entao isso so vale pro 1o create):
# api_image = "us-central1-docker.pkg.dev/dp6-ci-polaris/apps/billing-api:dev"
# web_image = "us-central1-docker.pkg.dev/dp6-ci-polaris/apps/billing-web:dev"
