"""Leitura de secrets do Secret Manager em runtime -- nunca via variavel de
ambiente estatica (mesmo padrao do polaris-atlas, core/secrets.py). Usado so
pelo login OAuth (google_oauth.py/oauth_session.py): client id/secret do
Google, JWT_SECRET, allowlist de quem pode logar.
"""

from __future__ import annotations

import json
from functools import lru_cache

from google.cloud import secretmanager

from .config import get_settings

# GOOGLE_OAUTH_CLIENT_ID/SECRET e JWT_SECRET tem um secret por ambiente
# (_DEV/_PROD) -- dev e prod rodam no mesmo projeto GCP (dp6-ci-polaris),
# entao sem o sufixo seria literalmente o mesmo secret pros dois ambientes;
# pra JWT_SECRET isso seria uma falha de isolamento grave (sessao assinada
# em dev valeria em prod). Nomes prefixados com COST_MODEL_ pra nao colidir
# com os mesmos secrets do dp6-billing-platform/polaris-atlas, que rodam no
# mesmo projeto. OAUTH_ALLOWLIST e o unico sem sufixo de ambiente, de
# proposito: controla so quem pode logar, nao isolamento de sessao.


@lru_cache
def _is_prod() -> bool:
    return get_settings().environment == "prod"


@lru_cache
def get_secret(secret_id: str) -> str:
    """access_secret_version na versao "latest" -- cacheado por processo,
    secrets nao mudam com frequencia e cada leitura e uma chamada de API."""
    client = secretmanager.SecretManagerServiceClient()
    name = f"projects/{get_settings().gcp_project}/secrets/{secret_id}/versions/latest"
    response = client.access_secret_version(name=name)
    return response.payload.data.decode("utf-8")


def get_oauth_client_id() -> str:
    secret_id = "COST_MODEL_GOOGLE_OAUTH_CLIENT_ID_" + ("PROD" if _is_prod() else "DEV")
    return get_secret(secret_id)


def get_oauth_client_secret() -> str:
    secret_id = "COST_MODEL_GOOGLE_OAUTH_CLIENT_SECRET_" + ("PROD" if _is_prod() else "DEV")
    return get_secret(secret_id)


def get_jwt_secret() -> str:
    secret_id = "COST_MODEL_JWT_SECRET_" + ("PROD" if _is_prod() else "DEV")
    return get_secret(secret_id)


def get_oauth_allowlist() -> dict:
    """{"allowed_domains": [...], "allowed_emails": [...]}"""
    return json.loads(get_secret("COST_MODEL_OAUTH_ALLOWLIST"))
