// Constantes e helpers compartilhados. Ver specs/001 (deltas da Fase 2) e docs/data-contract.md.

const V = dataform.projectConfig.vars;

// --- parâmetros travados (validation/RESULTADOS.md) ---
const LOOKBACK_DAYS = Number(V.lookback_days || 45);
const FRESHNESS_HOURS = Number(V.freshness_threshold_hours || 36);
const TIMEZONE = V.timezone || "America/Sao_Paulo";
const LABEL_KEYS = (V.label_keys || "environment,app,managed-by").split(",").map((s) => s.trim());

// --- constantes de negócio ---
const ANOMALY_Z = 3;              // z-score mínimo para sinalizar
const ANOMALY_MIN_BRL = 1.0;      // piso absoluto (senão vira ruído a R$ 26/mês)
const MONTHLY_BUDGET_BRL = 20;    // revisto de 50 pós-canvas — reconciliar com polaris-cost-control
const BUDGET_THRESHOLDS = [0.5, 0.8, 1.0, 1.2];
const CUD_REEVAL_THRESHOLD_BRL = 30;   // abaixo disso, CUD/SUD não compensa
const DEPLOY_COUNT_PER_MONTH = 540;    // placeholder — specs/003 decisao #3 (denominador de custo-por-deploy)

// datasets
const STG = V.staging_dataset || "billing_polaris_stg";
const MART = V.mart_dataset || "billing_polaris_mart";
const RPT = V.reporting_dataset || "billing_polaris_reporting";

// FQN da view de origem, com crase para SQL
function sourceRef() {
  return "`" + V.source_project + "." + V.source_dataset + "." + V.source_view + "`";
}

// Origem deduplicada por fingerprint (mesma logica do CTE keyed/deduped de
// stg_billing_polaris.sqlx: fingerprint de todas as colunas exceto export_time, mantendo o
// export mais recente). Extraida pra ca porque assert_fct_reconciliation.sqlx tambem precisa
// dela: comparar o fato (ja deduplicado) contra a origem CRUA falso-positiva sempre que a GCP
// reexporta uma linha identica (comum em dia de baixa atividade -- ver assert_source_freshness)
// dentro da janela, porque o SUM bruto conta a mesma linha 2x. Incidente 2026-09-21: reconciliacao
// falhando em dev e prod por causa exatamente disso, sem nenhum problema real de dado.
function dedupedSourceSql(alias) {
  const a = alias || "s";
  return (
    "SELECT " + a + ".*\n" +
    "  FROM (\n" +
    "    SELECT " + a + ".*,\n" +
    "      FARM_FINGERPRINT(TO_JSON_STRING((SELECT AS STRUCT " + a + ".* EXCEPT (export_time)))) AS source_row_fp\n" +
    "    FROM " + sourceRef() + " AS " + a + "\n" +
    "  ) AS " + a + "\n" +
    "  QUALIFY ROW_NUMBER() OVER (PARTITION BY source_row_fp ORDER BY export_time DESC) = 1"
  );
}

// nome de coluna de label achatada (managed-by -> label_managed_by)
function labelCol(key) {
  return "label_" + key.replace(/-/g, "_");
}

// gera a lista de colunas "(SELECT value FROM UNNEST(<alias>.labels) WHERE key = '<k>') AS label_<k>"
function labelColumns(alias) {
  const a = alias || "s";
  return LABEL_KEYS.map(
    (k) => "(SELECT value FROM UNNEST(" + a + ".labels) WHERE key = '" + k + "') AS " + labelCol(k)
  ).join(",\n  ");
}

// janela incremental / updatePartitionFilter
function lookbackFilter(dateCol) {
  return dateCol + " >= DATE_SUB(CURRENT_DATE('" + TIMEZONE + "'), INTERVAL " + LOOKBACK_DAYS + " DAY)";
}

// --- reconciliação de custo não-alocado por nome de recurso (plano "conciliar Cloud Run +
// Secret Manager + BigQuery com label", ver docs/adr). Cloud Run "Services" CPU/Memory e a
// maioria dos secrets do Secret Manager quase nunca carregam labels no billing export
// (limitação do GCP pra essas linhas) — reconciliamos pelo nome do recurso, que sempre vem
// preenchido em `resource.global_name`. Listas fechadas e conhecidas (só os recursos deste
// projeto) — atualizar aqui quando um recurso novo for criado.
const CLOUD_RUN_APP_MAP = [
  { match: "name LIKE 'backend-%'", app: "atlas" },
  { match: "name LIKE 'frontend-%'", app: "atlas" },
  { match: "name LIKE 'billing-platform-api-%'", app: "dp6-billing-platform" },
  { match: "name LIKE 'billing-web-%'", app: "polaris-cost-model" },
  { match: "name LIKE 'billing-api-%'", app: "polaris-cost-model" },
  { match: "name = 'polaris'", app: "polaris" },
];
const SECRET_APP_MAP = [
  { match: "name LIKE 'GOOGLE_OAUTH_CLIENT_SECRET_%'", app: "atlas" },
  { match: "name LIKE 'GOOGLE_OAUTH_CLIENT_ID_%'", app: "atlas" },
  { match: "name LIKE 'JWT_SECRET_%'", app: "atlas" },
  { match: "name = 'OAUTH_ALLOWLIST'", app: "atlas" },
  { match: "name = 'polaris-cost-model-dataform-git-token'", app: "polaris-cost-model" },
  { match: "name = 'dp6-billing-platform-dataform-git-token'", app: "dp6-billing-platform" },
  { match: "name LIKE 'polaris-%'", app: "polaris" },
];

// Componentes onde "cobertura de label" faz sentido medir por RECURSO: resource.global_name
// identifica um recurso persistente e taggeavel de verdade (o proprio Cloud Run
// service/Secret Manager secret, que carrega label no GCP mesmo quando o billing export
// nao repassa pra linha de custo). BigQuery fica de fora de proposito: resource.global_name
// la e um Job ID -- uma EXECUCAO/acao pontual, nao um recurso permanente com label proprio,
// entao "cobertura de label" nao se aplica (nao existe label pra medir, so heuristica de
// nome de job, que e coisa de allocation, nao de cobertura). Dataplex/Cloud Scheduler tambem
// ficam de fora -- resource.global_name vem sempre NULL pra eles, sem como identificar
// recurso individual.
const LABEL_COVERAGE_APPLICABLE_SERVICES = ["Cloud Run", "Secret Manager"];

function resourceNameAfter(expr, segment) {
  return "REGEXP_EXTRACT(" + expr + ", r'/" + segment + "/([^/]+)$')";
}
function appCaseFromMap(nameExpr, map) {
  // replacer como funcao, nao string: nameExpr tem REGEXP_EXTRACT(...([^/]+)$') -- o "$'" no
  // fim e um padrao especial de substituicao do String.replace ("texto apos o match") quando
  // a substituicao e uma string; com funcao o retorno e usado ao pe da letra.
  const whens = map
    .map(({ match, app }) => "WHEN " + match.replace(/\bname\b/g, () => nameExpr) + " THEN '" + app + "'")
    .join("\n    ");
  return "CASE\n    " + whens + "\n    ELSE NULL\n  END";
}
function cloudRunAppCase(expr) {
  return appCaseFromMap(resourceNameAfter(expr, "(?:services|jobs)"), CLOUD_RUN_APP_MAP);
}
function cloudRunEnvCase(expr) {
  const name = resourceNameAfter(expr, "(?:services|jobs)");
  return (
    "CASE\n" +
    "    WHEN " + name + " LIKE '%-dev%' THEN 'dev'\n" +
    "    WHEN " + name + " LIKE '%-prod%' THEN 'prod'\n" +
    "    WHEN " + name + " = 'polaris' THEN 'prod'\n" +
    "    ELSE NULL\n" +
    "  END"
  );
}
function secretAppCase(expr) {
  return appCaseFromMap(resourceNameAfter(expr, "secrets"), SECRET_APP_MAP);
}
function secretEnvCase(expr) {
  const name = resourceNameAfter(expr, "secrets");
  return (
    "CASE\n" +
    "    WHEN " + name + " LIKE '%_DEV' OR " + name + " LIKE '%-dev%' THEN 'dev'\n" +
    "    WHEN " + name + " LIKE '%_PROD' OR " + name + " LIKE '%-prod%' THEN 'prod'\n" +
    "    ELSE NULL\n" +
    "  END"
  );
}
// BigQuery: sem resource.global_name utilizavel alem do Job ID. Jobs disparados pelo proprio
// pipeline Dataform sempre nomeiam o job "script_job_<hash>_<n>" (confirmado direto na tabela
// real) — labels de job do Dataform (defaultLabels/labels no dataform.json) existem na doc
// mas sao relatados como pouco confiaveis, por isso usamos essa heuristica de nome em vez de
// depender de label. Demais jobs (UUID solto) sao majoritariamente o proprio backend deste
// painel (apps/api/src/billing_api/bq.py) rodando queries ao vivo — uma vez que bq.py passar
// a setar label de job (roadmap), essas linhas caem no WHEN de label nativo antes de chegar
// aqui e esse branch esvazia sozinho.
function bigQueryJobId(expr) {
  return "REGEXP_EXTRACT(" + expr + ", r'/jobs/([^/]+)$')";
}
function bigQueryAppCase(expr) {
  const jobId = bigQueryJobId(expr);
  return (
    "CASE\n" +
    "    WHEN REGEXP_CONTAINS(" + jobId + ", r'^script_job_') THEN '(BigQuery · pipeline Dataform)'\n" +
    "    WHEN " + jobId + " IS NOT NULL THEN '(BigQuery · outras queries)'\n" +
    "    ELSE NULL\n" +
    "  END"
  );
}

module.exports = {
  LOOKBACK_DAYS, FRESHNESS_HOURS, TIMEZONE, LABEL_KEYS,
  ANOMALY_Z, ANOMALY_MIN_BRL, MONTHLY_BUDGET_BRL, BUDGET_THRESHOLDS,
  CUD_REEVAL_THRESHOLD_BRL, DEPLOY_COUNT_PER_MONTH,
  STG, MART, RPT,
  sourceRef, dedupedSourceSql, labelCol, labelColumns, lookbackFilter,
  CLOUD_RUN_APP_MAP, SECRET_APP_MAP, LABEL_COVERAGE_APPLICABLE_SERVICES,
  resourceNameAfter, appCaseFromMap, cloudRunAppCase, cloudRunEnvCase,
  secretAppCase, secretEnvCase, bigQueryAppCase,
};
