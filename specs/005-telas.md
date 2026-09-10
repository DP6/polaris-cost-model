# Spec 005 — Telas do painel (detalhe por aba)

Status: 🟡 rascunho para revisão · Data: 2026-09-10
Depende de: `specs/004` (modelo de período/filtros, DS), `docs/data-contract.md` (matriz
widget→endpoint→view→coluna), `specs/003` (21 endpoints + DTOs), `mock/canvas/*.dc.html` (visual)
Substitui: a IA de 8 abas da `specs/002` "Revisão pós-canvas" → **6 abas** (ver §0).

## 0. Estrutura e convenções

### 6 abas (era 8)

| # | Rota | Aba | Público | Cadência |
|---|---|---|---|---|
| 1 | `/` | **Visão Geral** | exec + entrada operacional | diária |
| 2 | `/tendencia` | **Tendência** | exec | mensal |
| 3 | `/servicos` | **Serviços & SKUs** | operacional | diária |
| 4 | `/alocacao` | **Alocação & showback** | exec | mensal |
| 5 | `/eficiencia` | **Eficiência & economia** | exec | mensal |
| 6 | `/anomalias` | **Anomalias** | operacional | diária |

Consolidação: **Orçamento & previsão** virou seção da Visão Geral; **Otimização & waste** +
**Unit economics & eficiência** viraram **Eficiência & economia**.

### Convenções (recap `specs/004`)

- **Período** (`specs/004` §1): presets `Mês corrente` (default) · 30d · 90d · Este ano ·
  Personalizado. Widgets **janela** (`usage_date`) reagem; widgets **mês-âncora**
  (`invoice_month`) mostram janela fixa própria + caption, mas respeitam Serviço/Ambiente/App.
- **Filtros globais** na URL: `period`/`from`/`to` · `service` · `environment` · `app` ·
  `currency`. `currency` é só display (`_brl`/`_usd`). Valores de `/api/dimensions`.
- **Primitivas** (`apps/web/src/components/ui.tsx`): `PageHeader`, `Panel`, `MetricGrid`/
  `MetricTile`, `StatusBadge`, `Chip`, `DataTable`, `LoadingOrError`. Charts (`src/charts/`):
  `AreaTrend`, `HBars`; a criar: `StackedBar`, `ComboChart`, `Waterfall`, `Donut`, `Gauge`,
  `Sparkline`, `CalendarHeat` (opcional).
- **Estados** por `Panel`: `LoadingOrError` (loading/erro) + linha "Sem custo no
  período/recorte." quando a lista vem vazia. `PageHeader` + tira de saúde sempre renderizam.
- **Paleta de gráfico** (tokens de `index.css`, validada `dataviz`): `--chart-net`
  (`--accent-blue`) neutro/net · `--chart-alt` (`--accent-green`) positivo/2ª série ·
  `--chart-other` cinza "outros" · `--chart-alert` (status error) só anomalia/negativo com
  rótulo · `--chart-credit` (`--accent-purple`) só crédito. ≤2 acentos por tela.
- **Números** pt-BR (`R$ 1.284,93`), Ubuntu Mono nas figuras/tabelas.
- **Honestidade do dado**: toda tela com dado parcial/curado abre com um `WarningCallout`
  dizendo o que é confiável e o que não é (ver notas por aba).

---

## 1. Visão Geral — `/`

**Propósito:** a foto do mês em 10 segundos + o orçamento do mês.
**Layout (topo → base):**

1. **`PageHeader`** — eyebrow `"<Mês> <Ano> · mês corrente (MTD, N dias)"` · `<h1>` "Visão
   geral" · descrição (billing export, BRL/USD). *(já implementado, PR A)*
2. **Tira de saúde dos dados** — callout full-width: bolinha `--status-ok`/`--status-warn` +
   "Export íntegro · última carga <relativo> · N linhas · M meses". *(já implementado)*
3. **Scorecard** — 6 `MetricTile` num grid **fixo de 6 colunas** (3 em telas médias, 2 em
   estreitas) — não `auto-fit`, que distribui 5+1. Ajustar o `MetricGrid` / a VG ao
   implementar. *(parcial — layout a corrigir)*
4. **Linha** `grid 1.55fr / 1fr`: área "Custo líquido diário" (`AreaTrend`) + "Custo por
   serviço" (`HBars`). *(já implementado)*
5. **`Panel` "Reconciliação com a fatura"** — 3 meses, mês corrente "(parcial)". *(já implementado)*
6. **Seção "Orçamento do mês"** *(nova — ex-aba Orçamento)*:
   - **Faixa de 4 tiles** — Consumido MTD (`R$ · % de R$ 20`) · Projeção fim de mês
     (`R$ · % · run-rate linear`) · Folga projetada (`orçamento − projeção`) · Estouro
     projetado (`data` ou "sem estouro").
   - **`ComboChart` "Consumo acumulado vs. orçamento"** — linha cheia = realizado MTD,
     tracejada = projeção linear até o fim do mês; 4 linhas de referência horizontais
     (50/80/100/120% = R$ 10/16/20/24).
   - **Escada de thresholds** — barra segmentada 50/80/100/120% com marcador na projeção EOM.
   - **`ComboChart` "Previsão — próximos 3 meses"** — barra = tendência estimada, whisker
     vertical = faixa `lo–hi`. `WarningCallout`: "3 meses de histórico, agosto atípico → faixa
     larga de propósito".

**Widgets → dados:**

| Widget | Tipo | Endpoint | View / colunas |
|---|---|---|---|
| Scorecard (6 tiles) | mês-âncora | `GET /api/scorecard?currency&service&environment&app` | `rpt_cost_scorecard` (sem recorte) / recomputa de `rpt_cost_daily`+`rpt_cost_monthly` (com recorte) |
| Custo líquido diário + MA7 | **janela** | `GET /api/cost/daily?from&to&…` | `rpt_cost_daily` agg por `usage_date` |
| Custo por serviço | **janela** | `GET /api/cost/by-service?from&to&…` | `rpt_cost_daily` agg por `service_description` |
| Reconciliação (3 meses) | mês-âncora | `GET /api/reconciliation?currency&service&environment&app` | `rpt_cost_monthly` agg por `invoice_month` |
| Tiles de orçamento | mês-âncora | `GET /api/budget?currency&service&environment&app` | `rpt_cost_scorecard` + `rpt_budget_daily` |
| Burn-down + thresholds | mês-âncora | `GET /api/budget/burndown?month&currency` | `rpt_budget_daily` (`usage_date`, `net_cost_cum_brl`, `budget_brl`, `is_realized`) |
| Previsão 3 meses | mês-âncora | `GET /api/forecast?horizon=3&currency` | `rpt_forecast_monthly` (`invoice_month`, `is_actual`, `value_brl`, `forecast_lo_brl`, `forecast_hi_brl`) |

**Confiança:** alta, exceto a previsão (faixa larga — comunicar). **Status:** itens 1–5
implementados na PR A; falta a seção 6 + o fix do filtro (§7).

---

## 2. Tendência — `/tendencia`

**Propósito:** como o custo evolui mês a mês e dentro do mês.
**Layout:**

1. **`PageHeader`** — eyebrow "Evolução mês a mês" · `<h1>` "Tendência".
2. **`Panel` "Custo líquido mensal por serviço"** — `StackedBar` (barras empilhadas por
   `invoice_month`, ≤5 serviços da paleta + "Outros" cinza). Legenda Cloud Run / BigQuery /
   Outros. Caption "só o par azul/verde como série categórica (validado daltonismo)".
3. **`Panel` "Variação mês a mês"** — barras mensais de `net_cost` com rótulo Δ MoM; no mês
   aberto, barra tracejada de run-rate ("fantasma") ao lado da realizada. Sub "−90,7%
   realizado MTD · −69% run-rate".
4. **`Panel` "Ritmo acumulado"** — 2 linhas sobrepostas: acúmulo dia-a-dia do mês corrente
   (sólida, `--chart-net`) vs mês anterior no mesmo ponto do mês (cinza). Eixo X = dia do mês.
5. *(opcional MVP)* **`Panel` "Calendário"** — heatmap de `net_cost` diário, escala
   sequencial de azul. Cortar se apertar o prazo.
6. **`WarningCallout` ◆** — "o custo se concentra em dias úteis de deploy/carga; fora dessas
   janelas ~R$ 0,25/dia".

**Widgets → dados:**

| Widget | Tipo | Endpoint | View / colunas |
|---|---|---|---|
| Empilhado mensal por serviço | mês-âncora | `GET /api/cost/monthly?environment&app&currency` | `rpt_cost_monthly` (`invoice_month`, `service_description`, `net_cost_brl`) |
| Barras mensais + Δ MoM + run-rate | mês-âncora | `GET /api/cost/monthly` + `GET /api/scorecard` (run-rate) | `rpt_cost_monthly` (`net_cost_brl`, `mom_abs_brl`, `mom_pct`) + `rpt_cost_scorecard` (`run_rate_eom_brl`) |
| Ritmo acumulado (2 meses) | **janela** (fixa em 2 meses) | `GET /api/cost/daily?from=<início mês anterior>&to=<hoje>` | `rpt_cost_daily` (`usage_date`, `net_cost_brl`) — acúmulo no cliente |
| Heatmap calendário (opc.) | **janela** | `GET /api/cost/daily?from&to` | `rpt_cost_daily` |

**Confiança:** alta no mês-a-mês; sazonalidade rasa (3 meses). O "ritmo acumulado" tem
janela própria (mês anterior + corrente), não o período global.

---

## 3. Serviços & SKUs — `/servicos`

**Propósito:** onde o dinheiro está, no detalhe.
**Layout:**

1. **`PageHeader`** — eyebrow "Detalhe por SKU" · `<h1>` "Serviços & SKUs".
2. **`WarningCallout` ◆ "SKU novo"** — quando há SKU com `is_new_30d`: "Cloud Run · Requests
   — primeira ocorrência 2026-08-28. Sem histórico para comparar." (some se não houver).
3. **`Panel` "Custo por serviço → SKU"** — lista/treemap: serviço (barra + total) →
   expande em SKUs (`sku_description`, uso na `pricing_unit`, `net_cost`). Cloud Run
   detalhado por padrão (82%).
4. **`Panel` "Top movers · ago → set"** — `DataTable` ordenável: Serviço · mês anterior ·
   mês corrente (MTD) · Δ (absoluto, com cor+rótulo). Maior variação absoluta no topo.
5. **`Panel` "Custo unitário por SKU"** — `DataTable` ordenável: SKU (`serviço · sku`) ·
   Uso · Unidade (`pricing_unit`) · Custo unitário (`net / uso`, Ubuntu Mono, até 7 casas) ·
   Custo. Caption "amostra do período".

**Widgets → dados:**

| Widget | Tipo | Endpoint | View / colunas |
|---|---|---|---|
| Composição serviço → SKU | **janela** | `GET /api/cost/by-sku?from&to&service&environment&app&currency` | `rpt_cost_daily` agg por `service_description, sku_description, pricing_unit` (`net_cost_brl`, `usage_amount_pricing_units`) |
| Top movers | mês-âncora | `GET /api/cost/monthly` (2 últimos meses, agg por serviço) | `rpt_cost_monthly` (`invoice_month`, `service_description`, `net_cost_brl`) |
| Custo unitário por SKU | **janela** | `GET /api/cost/by-sku?…` | `rpt_cost_daily` → `unit_cost = net_cost_brl / NULLIF(usage_amount_pricing_units,0)` |
| Callout SKU novo | — | `GET /api/sku/new` | `rpt_service_sku` (`service_description`, `sku_description`, `first_seen_date`, `is_new_30d`) |

**Confiança:** alta. Todos os widgets principais são janela — respeitam o período global.

---

## 4. Alocação & showback — `/alocacao`

**Propósito:** de quem é esse custo? dá para fazer chargeback?
**Layout:**

1. **`PageHeader`** — eyebrow "Rateio por app / ambiente" · `<h1>` "Alocação & showback".
2. **`WarningCallout` ▲ (topo, sempre)** — "Cobertura de label 4–10% do custo. O rateio
   abaixo cobre só a fração já rotulada — não use para chargeback ainda."
3. **`Panel` "Cobertura de label · por custo"** — 3 `Donut` + número: `managed-by` (10%,
   R$ 2,63) · `app` (4%, R$ 1,07) · `environment` (4%, R$ 1,10). Fração do `net_cost` total
   com cada chave preenchida.
4. **`Panel` "Progressão da cobertura (por semana)"** — 3 linhas (`pct_app`,
   `pct_environment`, `pct_managed_by`) por `week_start`; sobe conforme labels são aplicadas.
5. **`MetricTile` destacado "Custo não-alocado"** — R$ 23,78 · "90% do custo · sem app nem
   environment". Régua amarela.
6. **`Panel` "Prontidão de chargeback"** — "10% — não pronto" + checklist com `StatusBadge`:
   ✓ labels padrão via `default_labels` · ✗ cobertura ≥ 95% · ✗ dono por app · ~ recursos
   manuais (secrets) sem label.
7. **Linha** `grid 1fr / 1fr`: **`HBars` "Custo alocado por app"** (atlas / polaris-cost-control
   / observability-hub) + **`HBars` "Custo alocado por ambiente"** (prod / dev). Cada um com
   nota: "da fração com label X (R$ Y)"; "observability-hub = nome antigo do atlas".

**Widgets → dados:**

| Widget | Tipo | Endpoint | View / colunas |
|---|---|---|---|
| 3 donuts de cobertura | mês-âncora | `GET /api/allocation/coverage?months=1` | `rpt_label_coverage` (`pct_app`, `pct_environment`, `pct_managed_by`, `net_cost_*_brl`) |
| Progressão semanal | **janela** | `GET /api/allocation/coverage/weekly?from&to` | `rpt_label_coverage_weekly` (`week_start`, `pct_*`) |
| Custo não-alocado | mês-âncora | `GET /api/allocation/by-app?from&to&currency` | `rpt_showback_monthly` (`unallocated_net_cost_brl`, `unallocated_pct`) |
| Prontidão de chargeback | — | `GET /api/allocation/chargeback-readiness` | `rpt_label_coverage` + checklist config |
| Custo por app / por ambiente | mês-âncora | `GET /api/allocation/by-app`, `GET /api/allocation/by-env` | `rpt_showback_monthly` (`label_app`/`label_environment`, `net_cost_brl`) |

**Confiança:** baixa (cobertura 4–10%). A tela existe para mostrar a **progressão** da
cobertura e a prontidão — não o rateio final. O callout de topo é obrigatório.

---

## 5. Eficiência & economia — `/eficiencia`

**Propósito:** estamos pagando o mínimo? o que dá para cortar?
**Layout:**

1. **`PageHeader`** — eyebrow "Rate + workload optimization" · `<h1>` "Eficiência & economia"
   · descrição "a este volume o ganho é hábito e governança; as recomendações escalam com o
   projeto".
2. **Faixa de 4 `MetricTile` (unit economics)** — Custo por deploy (`R$ 0,04 · ~540/mês CI`)
   · Custo por 1k requests (`R$ 0,0006`) · Custo por GB de log (`R$ 0,00 · free tier`) ·
   Custo médio por dia (`R$ 0,88 · média móvel 30d`).
3. **`Panel` "Do preço de tabela ao custo real"** — `Waterfall`: `cost_at_list` (R$ 26,41)
   → −desconto negociado (R$ 0,00) → −créditos (R$ 0,57) → `net_cost` (R$ 25,84). Sub "taxa
   de economia efetiva 2,2% — só créditos".
4. **Linha** `grid 1fr / 1fr`:
   - **`MetricTile` "Custo evitado (acumulado)"** — R$ 0,00 · "sem CUD/SUD/negociação nesta
     billing account".
   - **`Gauge` "Cobertura de compromissos"** — 0% · "100% on-demand". `WarningCallout`:
     "CUD/SUD não compensa abaixo de ~R$ 30/mês estável; reavaliar quando Cloud Run passar de
     R$ 50/mês sustentado".
5. **`Panel` "Eficiência do Cloud Run"** — 3 linhas: Custo por vCPU·s · Custo por GiB·s ·
   Razão CPU:memória (76:24).
6. **`Panel` "Custo por request · por dia"** — `AreaTrend`/`Sparkline` da série
   `cost_per_1k_req` no período. Sub "estável em ~R$ 0,0006/1k req — sem regressão".
7. **`Panel` "Recomendações"** — `DataTable`: Ação · Evidência · Economia est./mês · Esforço
   (`Chip`). 5 linhas curadas (escalar dev a zero, CPU only-on-request, limpeza Artifact
   Registry, retenção de log dev, budget por label). **`MetricTile` "Economia potencial"**
   acima: `R$ 4–7/mês · 15–27% do run-rate · soma das de baixo esforço`.

**Widgets → dados:**

| Widget | Tipo | Endpoint | View / colunas |
|---|---|---|---|
| 4 tiles unit economics | mês-âncora | `GET /api/unit-economics?currency` | `rpt_unit_economics` (+ `deploy_count` config) |
| Waterfall preço→líquido | mês-âncora | `GET /api/efficiency/waterfall?period&currency` | `rpt_savings_waterfall` (`step`, `kind`, `value_brl`) |
| Custo evitado | mês-âncora | `GET /api/unit-economics` / `rpt_savings_waterfall` | `cost_avoided_brl` |
| Gauge cobertura de compromissos | mês-âncora | `GET /api/optimization/commitment-coverage` | `rpt_commitment_coverage` (`covered_pct`=0, `eligible_spend_brl`, `on_demand_spend_brl`) |
| Eficiência Cloud Run | mês-âncora | `GET /api/unit-economics` | `cost_per_vcpu_s_brl`, `cost_per_gib_s_brl`, `cpu_mem_ratio` |
| Série custo/request | **janela** | `GET /api/unit-economics/series?metric=cost_per_1k_req&from&to` | `rpt_cost_daily` (SKU Requests) |
| Recomendações + economia potencial | — | `GET /api/optimization/recommendations` | `apps/api/recommendations.yaml` (curado) |

**Confiança:** mista. Waterfall, série custo/request, eficiência Cloud Run = billing export
(alta). `deploy_count` e recomendações = config/curado (baixa) — marcar cada tile/linha com
um `Chip` "config" ou "curado" e um `WarningCallout` no bloco de recomendações.

---

## 6. Anomalias — `/anomalias`

**Propósito:** teve algum dia fora da curva? por quê?
**Layout:**

1. **`PageHeader`** — eyebrow "Dias fora do padrão" · `<h1>` "Anomalias".
2. **Faixa de 4 `MetricTile`** — Em aberto (`2 · sem baixa`) · No mês (`2 · de 52 dias
   analisados`) · Impacto acima da média (`R$ 10,83 · soma dos desvios`) · Regra ativa
   (`z > 3 & > R$ 1 · janela 28 dias`).
3. **`Panel` "Ocorrências"** — lista/`DataTable`, uma linha por dia sinalizado:
   - Data (`25/08 2026`), Serviço · valor do dia (`Cloud Run · R$ 5,68`), `z 4,1`,
     "média 28d R$ 0,46 · desvio +R$ 5,22 (+1135%)".
   - **`Sparkline`** do custo diário do serviço nos ~30 dias ao redor, com o dia sinalizado
     em `--chart-alert` (ponto + rótulo).
   - Botão **"Dar baixa"** — só visual no MVP (`localStorage` `pcm:anomaly-dismissed`).
   - Expandir a linha → **drill do dia → SKUs** (`DataTable` `sku_description` · `net_cost`).
4. **`WarningCallout` ◆** — "ambos os dias caem na janela de deploy/carga de 21–26/ago
   (mesma da aba Tendência). Padrão de teste de carga, não incidente."

**Widgets → dados:**

| Widget | Tipo | Endpoint | View / colunas |
|---|---|---|---|
| 4 tiles de resumo | mês-âncora | `GET /api/anomalies` (agrega no cliente) + config da regra | `rpt_anomaly_daily` (`WHERE is_anomaly`) |
| Tabela de ocorrências | mês-âncora | `GET /api/anomalies?from&to&currency` | `rpt_anomaly_daily` (`usage_date`, `service_description`, `net_cost_day_brl`, `avg_28d_brl`, `z_score`, `deviation_abs_brl`, `deviation_pct`) |
| Sparkline por linha | **janela** (fixa: ±15d do evento) | `GET /api/cost/daily?from&to&service` | `rpt_cost_daily` (`usage_date`, `net_cost_brl`) |
| Drill dia → SKUs | — | `GET /api/cost/by-sku?from=<dia>&to=<dia>&service=<svc>` | `rpt_cost_daily` (`sku_description`, `net_cost_brl`) |

**Confiança:** alta na detecção; poucos eventos a R$ 26/mês. "Dar baixa" não persiste no MVP.

---

## 7. Bug conhecido — filtro de Período não aplica

Sintoma: mudar o preset de Período (ou as datas do "Personalizado") não muda visivelmente a
Visão Geral.

Diagnóstico a fazer no 1º passo da implementação:
- Confirmar que **os widgets de janela** (`AreaTrend` diário, `HBars` por serviço) refazem o
  fetch — `useApi` refaz quando a `key` (`path + JSON.stringify(params)`) muda; `filterParams(f)`
  chama `resolveWindow(f)` que usa `new Date()`. Verificar se `from`/`to` de fato mudam entre
  presets e se a `key` muda.
- Candidatos de causa: `customOpen` (estado local do `FilterBar`) dessincronizado da URL após
  navegação/reload; `resolveWindow` recalculado a cada render sem memo (não deveria importar
  para a `key`, mas confirmar); `<Routes>` sem `key` no elemento fazendo o React reusar a
  instância da tela.
- Lembrar: **scorecard e reconciliação NÃO reagem ao período por design** (mês-âncora,
  `specs/004` §1) — se a expectativa era essa, é comportamento, não bug; a tela deve deixar
  claro na caption de cada bloco qual é a janela.

## 8. Mudanças de rota/arquivo (na implementação)

- `apps/web/src/App.tsx` — `TABS` de 8 → 6; remover `/orcamento`, `/otimizacao`,
  `/unit-economics`; adicionar `/eficiencia`.
- `apps/web/src/screens/` — apagar `Orcamento.tsx`, `Otimizacao.tsx`, `UnitEconomics.tsx`;
  criar `Eficiencia.tsx`; `VisaoGeral.tsx` ganha a seção "Orçamento do mês"; reescrever
  `Tendencia.tsx`, `Servicos.tsx`, `Alocacao.tsx`, `Anomalias.tsx` (hoje `Stub`).
- `apps/web/src/charts/` — novos: `StackedBar`, `ComboChart`, `Waterfall`, `Donut`, `Gauge`,
  `Sparkline`, (`CalendarHeat` opc.). Todos lêem os tokens `--chart-*` e usam `ChartTooltip`
  (que entra na PR B).
- `apps/api` — sem novo endpoint; confirmar nesta spec se algum precisa de `service`/
  `environment`/`app` que ainda não tem (`/cost/monthly`, `/unit-economics/series`,
  `/anomalies` já aceitam ou aceitarão).
- `docs/data-contract.md` — nota de que a IA passou a 6 abas; `docs/adr/` — ADR curto
  "IA de 8 → 6 abas".

## 9. Sequenciamento

1. Fix do filtro de Período (§7) + seção "Orçamento do mês" na Visão Geral.
2. **PR B** (`specs/004` §3) — Tailwind v4 + shadcn + TanStack + catálogo de componentes +
   `ChartTooltip`. Fazer **antes** das telas 2–6 para não retrabalhar cada uma.
3. Mocks das 6 telas (canvas/HTML, DP6 DS) → aprovação.
4. Telas 2–6, uma por PR ou em 2 PRs (janela + mês-âncora), seguindo esta spec.

## Verificação

- Cada widget desta spec mapeia para um endpoint/`rpt_*`/coluna que **já existe** em
  `docs/data-contract.md` (§3/§6/§7). Exceções viram item de mudança registrado.
- Mocks conferidos contra os tokens de `apps/web/src/index.css` e a paleta `dataviz`.
- Implementação: `tsc` + `vite build` + `pytest` verdes; smoke mock (6 abas renderizam,
  período aplica nos widgets de janela, filtros na URL); dev real após deploy (mudar Ambiente
  recalcula scorecard/alocação; reconciliação bate com a fatura num mês fechado).
