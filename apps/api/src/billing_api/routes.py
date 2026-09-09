"""Todos os endpoints. Cada um: se mock_active() -> fixtures; senão -> SQL contra rpt_*.
As SQLs assumem as views de definitions/reporting/ (specs/001, docs/data-contract.md)."""

from __future__ import annotations

from pathlib import Path

import yaml
from fastapi import APIRouter, Query

from . import fixtures as fx
from . import models as m
from .bq import mock_active, query
from .config import get_settings

router = APIRouter(prefix="/api")
S = get_settings()
RPT = f"{S.gcp_project}.{S.reporting_dataset}"

DateStr = str


def _pct_of_total(rows: list[dict], total: float) -> list[dict]:
    return [{**r, "pct_of_total": (r["net_cost_brl"] / total if total else 0.0)} for r in rows]


# ---------------------------------------------------------------- meta / scorecard

@router.get("/meta", response_model=m.MetaDTO)
def meta() -> m.MetaDTO:
    if mock_active():
        return m.MetaDTO(**fx.META)
    r = query(f"""
        SELECT
          FORMAT_TIMESTAMP('%FT%TZ', (SELECT MAX(export_time) FROM `{S.gcp_project}.{S.mart_dataset}.fct_billing_cost_daily`)) AS data_updated_at
    """)
    months = [x["invoice_month"] for x in query(
        f"SELECT DISTINCT invoice_month FROM `{S.gcp_project}.{S.mart_dataset}.agg_billing_cost_monthly` ORDER BY 1"
    )]
    rows = query(f"SELECT SUM(line_count) n FROM `{S.gcp_project}.{S.mart_dataset}.fct_billing_cost_daily`")
    return m.MetaDTO(
        data_updated_at=r[0]["data_updated_at"] or "",
        source_rows=int(rows[0]["n"] or 0),
        invoice_months=months,
        export_ok=True,
    )


@router.get("/scorecard", response_model=m.ScorecardDTO)
def scorecard(currency: str = "BRL") -> m.ScorecardDTO:
    if mock_active():
        return m.ScorecardDTO(**fx.SCORECARD)
    r = query(f"SELECT * FROM `{RPT}.rpt_cost_scorecard`")[0]
    return m.ScorecardDTO(**r)


# ---------------------------------------------------------------- cost

@router.get("/cost/daily", response_model=list[m.DailyPointDTO])
def cost_daily(
    from_: DateStr = Query(alias="from"), to: DateStr = Query(...),
    service: str | None = None, environment: str | None = None, app: str | None = None,
    currency: str = "BRL",
) -> list[m.DailyPointDTO]:
    if mock_active():
        pts = [p for p in fx.daily_points() if from_ <= p["usage_date"] <= to]
        return [m.DailyPointDTO(**p) for p in pts]
    where = ["usage_date BETWEEN @from AND @to"]
    params: dict = {"from": from_, "to": to}
    for col, val in (("service_description", service), ("label_environment", environment), ("label_app", app)):
        if val:
            where.append(f"{col} = @{col}")
            params[col] = val
    rows = query(f"""
        WITH d AS (
          SELECT usage_date, SUM(net_cost_brl) net_cost_brl, SUM(net_cost_usd) net_cost_usd
          FROM `{RPT}.rpt_cost_daily` WHERE {" AND ".join(where)} GROUP BY usage_date
        )
        SELECT usage_date, net_cost_brl, net_cost_usd,
          AVG(net_cost_brl) OVER (ORDER BY usage_date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS ma7_brl
        FROM d ORDER BY usage_date
    """, params)
    return [m.DailyPointDTO(usage_date=str(r["usage_date"]), net_cost_brl=r["net_cost_brl"],
                            net_cost_usd=r["net_cost_usd"] or 0.0, ma7_brl=r["ma7_brl"] or 0.0) for r in rows]


@router.get("/cost/by-service", response_model=list[m.ServiceCostDTO])
def cost_by_service(
    from_: DateStr = Query(alias="from"), to: DateStr = Query(...),
    environment: str | None = None, app: str | None = None, currency: str = "BRL",
) -> list[m.ServiceCostDTO]:
    if mock_active():
        total = sum(v for _, v in fx.SERVICES)
        return [m.ServiceCostDTO(service_description=s, net_cost_brl=v, pct_of_total=v / total)
                for s, v in fx.SERVICES]
    rows = query(f"""
        SELECT service_description, SUM(net_cost_brl) net_cost_brl
        FROM `{RPT}.rpt_cost_daily` WHERE usage_date BETWEEN @from AND @to
        GROUP BY service_description ORDER BY net_cost_brl DESC
    """, {"from": from_, "to": to})
    total = sum(r["net_cost_brl"] for r in rows) or 1.0
    return [m.ServiceCostDTO(service_description=r["service_description"],
                             net_cost_brl=r["net_cost_brl"], pct_of_total=r["net_cost_brl"] / total)
            for r in rows]


@router.get("/cost/monthly", response_model=list[m.MonthlyServicePointDTO])
def cost_monthly(
    from_: DateStr | None = Query(default=None, alias="from"), to: DateStr | None = None,
    environment: str | None = None, app: str | None = None, currency: str = "BRL",
) -> list[m.MonthlyServicePointDTO]:
    if mock_active():
        out = []
        for ym, cr, bq, ot, *_ in fx.MONTHS:
            out += [m.MonthlyServicePointDTO(invoice_month=ym, service_description=s, net_cost_brl=v)
                    for s, v in (("Cloud Run", cr), ("BigQuery", bq), ("Outros", ot)) if v]
        return out
    rows = query(f"""
        SELECT invoice_month, service_description, SUM(net_cost_brl) net_cost_brl
        FROM `{RPT}.rpt_cost_monthly` GROUP BY 1,2 ORDER BY 1,3 DESC
    """)
    return [m.MonthlyServicePointDTO(**r) for r in rows]


@router.get("/reconciliation", response_model=list[m.ReconRowDTO])
def reconciliation(currency: str = "BRL") -> list[m.ReconRowDTO]:
    if mock_active():
        return [m.ReconRowDTO(invoice_month=ym, gross_cost_brl=g, credits_total_brl=cr,
                              net_cost_brl=n, matches_invoice=True)
                for ym, _, _, _, g, cr, n in fx.MONTHS]
    rows = query(f"""
        SELECT invoice_month, SUM(gross_cost_brl) gross_cost_brl,
               SUM(credits_total_brl) credits_total_brl, SUM(net_cost_brl) net_cost_brl
        FROM `{RPT}.rpt_cost_monthly` GROUP BY 1 ORDER BY 1
    """)
    return [m.ReconRowDTO(**r, matches_invoice=True) for r in rows]


# ---------------------------------------------------------------- budget & forecast

@router.get("/budget", response_model=m.BudgetDTO)
def budget(currency: str = "BRL") -> m.BudgetDTO:
    sc = scorecard(currency)
    thresholds = [m.ThresholdDTO(pct=p, value_brl=S.monthly_budget_brl * p) for p in S.budget_thresholds]
    breach: str | None = None
    if mock_active():
        rows = []
    else:
        rows = query(f"SELECT usage_date, net_cost_cum_brl FROM `{RPT}.rpt_budget_daily` ORDER BY usage_date")
        for r in rows:
            if r["net_cost_cum_brl"] and r["net_cost_cum_brl"] >= S.monthly_budget_brl:
                breach = str(r["usage_date"])
                break
    return m.BudgetDTO(
        budget_brl=S.monthly_budget_brl,
        net_cost_mtd_brl=sc.net_cost_mtd_brl,
        run_rate_eom_brl=sc.run_rate_eom_brl,
        budget_used_pct=sc.budget_used_pct,
        run_rate_vs_budget_pct=sc.run_rate_vs_budget_pct,
        headroom_brl=S.monthly_budget_brl - sc.run_rate_eom_brl,
        projected_breach_date=breach,
        thresholds=thresholds,
    )


@router.get("/budget/burndown", response_model=list[m.BurndownPointDTO])
def burndown(month: str | None = None, currency: str = "BRL") -> list[m.BurndownPointDTO]:
    if mock_active():
        cum, out = 0.0, []
        for p in fx.daily_points():
            if not p["usage_date"].startswith("2026-09"):
                continue
            cum += p["net_cost_brl"]
            out.append(m.BurndownPointDTO(usage_date=p["usage_date"], net_cost_cum_brl=cum,
                                          budget_brl=20.0, is_realized=True))
        return out
    rows = query(f"""
        SELECT usage_date, net_cost_cum_brl, budget_brl, is_realized
        FROM `{RPT}.rpt_budget_daily` ORDER BY usage_date
    """)
    return [m.BurndownPointDTO(usage_date=str(r["usage_date"]), net_cost_cum_brl=r["net_cost_cum_brl"],
                               budget_brl=r["budget_brl"], is_realized=bool(r["is_realized"])) for r in rows]


@router.get("/forecast", response_model=list[m.ForecastMonthDTO])
def forecast(horizon: int = 3, currency: str = "BRL") -> list[m.ForecastMonthDTO]:
    if mock_active():
        return [
            m.ForecastMonthDTO(invoice_month="202608", is_actual=True, value_brl=23.65,
                               forecast_lo_brl=None, forecast_hi_brl=None),
            m.ForecastMonthDTO(invoice_month="202609", is_actual=True, value_brl=2.19,
                               forecast_lo_brl=None, forecast_hi_brl=None),
            m.ForecastMonthDTO(invoice_month="202610", is_actual=False, value_brl=9.0,
                               forecast_lo_brl=5.0, forecast_hi_brl=16.0),
            m.ForecastMonthDTO(invoice_month="202611", is_actual=False, value_brl=10.0,
                               forecast_lo_brl=5.0, forecast_hi_brl=20.0),
            m.ForecastMonthDTO(invoice_month="202612", is_actual=False, value_brl=11.0,
                               forecast_lo_brl=6.0, forecast_hi_brl=22.0),
        ]
    rows = query(f"SELECT invoice_month, is_actual, value_brl, forecast_lo_brl, forecast_hi_brl "
                 f"FROM `{RPT}.rpt_forecast_monthly` ORDER BY month_date")
    return [m.ForecastMonthDTO(**r) for r in rows]


# ---------------------------------------------------------------- allocation

@router.get("/allocation/coverage", response_model=list[m.LabelCoverageDTO])
def alloc_coverage(months: int = 3) -> list[m.LabelCoverageDTO]:
    if mock_active():
        return [m.LabelCoverageDTO(**c) for c in fx.COVERAGE]
    rows = query(f"SELECT invoice_month, pct_app, pct_environment, pct_managed_by, net_cost_total_brl "
                 f"FROM `{RPT}.rpt_label_coverage` ORDER BY invoice_month DESC LIMIT @months",
                 {"months": months})
    return [m.LabelCoverageDTO(**r) for r in rows]


@router.get("/allocation/coverage/weekly", response_model=list[m.CoverageWeekDTO])
def alloc_coverage_weekly(
    from_: DateStr | None = Query(default=None, alias="from"), to: DateStr | None = None,
) -> list[m.CoverageWeekDTO]:
    if mock_active():
        return [m.CoverageWeekDTO(**w) for w in fx.COVERAGE_WEEKLY]
    rows = query(f"SELECT CAST(week_start AS STRING) week_start, pct_app, pct_environment, pct_managed_by "
                 f"FROM `{RPT}.rpt_label_coverage_weekly` ORDER BY week_start")
    return [m.CoverageWeekDTO(**r) for r in rows]


@router.get("/allocation/by-app", response_model=m.AppAllocationDTO)
def alloc_by_app(
    from_: DateStr | None = Query(default=None, alias="from"), to: DateStr | None = None,
    currency: str = "BRL",
) -> m.AppAllocationDTO:
    if mock_active():
        return m.AppAllocationDTO(**fx.ALLOC_BY_APP)
    rows = query(f"""
        SELECT label_app, SUM(net_cost_brl) net_cost_brl,
               ANY_VALUE(unallocated_net_cost_brl) un, ANY_VALUE(net_cost_total_brl) tot
        FROM `{RPT}.rpt_showback_monthly` WHERE label_app != '(sem label)'
        GROUP BY label_app ORDER BY net_cost_brl DESC
    """)
    un = rows[0]["un"] if rows else 0.0
    tot = rows[0]["tot"] if rows else 1.0
    return m.AppAllocationDTO(
        rows=[m.AppRowDTO(label_app=r["label_app"], net_cost_brl=r["net_cost_brl"]) for r in rows],
        unallocated_net_cost_brl=un, unallocated_pct=(un / tot if tot else 0.0),
    )


@router.get("/allocation/by-env", response_model=list[m.EnvCostDTO])
def alloc_by_env(
    from_: DateStr | None = Query(default=None, alias="from"), to: DateStr | None = None,
    currency: str = "BRL",
) -> list[m.EnvCostDTO]:
    if mock_active():
        return [m.EnvCostDTO(**e) for e in fx.ALLOC_BY_ENV]
    rows = query(f"""
        SELECT label_environment, SUM(net_cost_brl) net_cost_brl
        FROM `{RPT}.rpt_showback_monthly` WHERE label_environment != '(sem label)'
        GROUP BY label_environment ORDER BY net_cost_brl DESC
    """)
    return [m.EnvCostDTO(**r) for r in rows]


@router.get("/allocation/chargeback-readiness", response_model=m.ChargebackReadinessDTO)
def chargeback_readiness() -> m.ChargebackReadinessDTO:
    if mock_active():
        return m.ChargebackReadinessDTO(**fx.CHARGEBACK)
    cov = query(f"SELECT pct_app FROM `{RPT}.rpt_label_coverage` ORDER BY invoice_month DESC LIMIT 1")
    pct = cov[0]["pct_app"] if cov else 0.0
    return m.ChargebackReadinessDTO(
        coverage_pct=pct, ready=pct >= 0.95,
        criteria=[m.CriterionDTO(**c) for c in fx.CHARGEBACK["criteria"]],
    )


# ---------------------------------------------------------------- services & skus

@router.get("/cost/by-sku", response_model=list[m.SkuCostDTO])
def cost_by_sku(
    from_: DateStr = Query(alias="from"), to: DateStr = Query(...),
    service: str | None = None, environment: str | None = None, app: str | None = None,
    currency: str = "BRL",
) -> list[m.SkuCostDTO]:
    if mock_active():
        return [m.SkuCostDTO(service_description=s, sku_description=k, pricing_unit=u,
                             net_cost_brl=c, usage_qty=q, unit_cost_brl=uc)
                for s, k, u, c, q, uc in fx.SKU_COST
                if not service or s == service]
    where = ["usage_date BETWEEN @from AND @to"]
    params: dict = {"from": from_, "to": to}
    if service:
        where.append("service_description = @service")
        params["service"] = service
    rows = query(f"""
        SELECT service_description, sku_description, ANY_VALUE(pricing_unit) pricing_unit,
               SUM(net_cost_brl) net_cost_brl, SUM(usage_amount_pricing_units) usage_qty,
               SAFE_DIVIDE(SUM(net_cost_brl), NULLIF(SUM(usage_amount_pricing_units),0)) unit_cost_brl
        FROM `{RPT}.rpt_cost_daily` WHERE {" AND ".join(where)}
        GROUP BY 1,2 ORDER BY net_cost_brl DESC
    """, params)
    return [m.SkuCostDTO(**r, ) for r in rows]


@router.get("/sku/new", response_model=list[m.NewSkuDTO])
def sku_new() -> list[m.NewSkuDTO]:
    if mock_active():
        return [m.NewSkuDTO(**s) for s in fx.NEW_SKUS]
    rows = query(f"""
        SELECT service_description, sku_description, CAST(first_seen_date AS STRING) first_seen_date
        FROM `{RPT}.rpt_service_sku` WHERE is_new_30d ORDER BY first_seen_date DESC
    """)
    return [m.NewSkuDTO(**r) for r in rows]


# ---------------------------------------------------------------- optimization

@router.get("/optimization/commitment-coverage", response_model=m.CommitmentCoverageDTO)
def commitment_coverage(currency: str = "BRL") -> m.CommitmentCoverageDTO:
    if mock_active():
        return m.CommitmentCoverageDTO(**fx.COMMITMENT)
    r = query(f"SELECT * FROM `{RPT}.rpt_commitment_coverage`")[0]
    return m.CommitmentCoverageDTO(**r)


@router.get("/optimization/recommendations", response_model=m.RecommendationsDTO)
def recommendations() -> m.RecommendationsDTO:
    path = Path(__file__).resolve().parents[2] / "recommendations.yaml"
    items = yaml.safe_load(path.read_text(encoding="utf-8")) if path.exists() else []
    recs = [m.RecommendationDTO(**it) for it in items]
    return m.RecommendationsDTO(
        items=recs,
        potential_savings_min_brl=sum(r.savings_min_brl for r in recs),
        potential_savings_max_brl=sum(r.savings_max_brl for r in recs),
    )


# ---------------------------------------------------------------- unit economics

@router.get("/unit-economics", response_model=m.UnitEconomicsDTO)
def unit_economics(currency: str = "BRL") -> m.UnitEconomicsDTO:
    if mock_active():
        return m.UnitEconomicsDTO(**fx.UNIT_ECON)
    r = query(f"SELECT * FROM `{RPT}.rpt_unit_economics`")[0]
    r["cost_per_gib_log_brl"] = r.get("cost_per_gib_log_brl") or 0.0
    return m.UnitEconomicsDTO(**r)


@router.get("/unit-economics/series", response_model=list[m.UnitSeriesPointDTO])
def unit_economics_series(
    metric: str = "cost_per_1k_req", from_: DateStr = Query(alias="from"), to: DateStr = Query(...),
    currency: str = "BRL",
) -> list[m.UnitSeriesPointDTO]:
    if mock_active():
        return [m.UnitSeriesPointDTO(usage_date=p["usage_date"], value_brl=0.0006)
                for p in fx.daily_points() if from_ <= p["usage_date"] <= to][-10:]
    rows = query(f"""
        SELECT usage_date,
          SAFE_DIVIDE(SUM(IF(sku_description='Requests', net_cost_brl, 0)),
                      NULLIF(SUM(IF(sku_description='Requests', usage_amount_pricing_units, 0)),0)) * 1000 AS value_brl
        FROM `{RPT}.rpt_cost_daily` WHERE usage_date BETWEEN @from AND @to
        GROUP BY usage_date ORDER BY usage_date
    """, {"from": from_, "to": to})
    return [m.UnitSeriesPointDTO(usage_date=str(r["usage_date"]), value_brl=r["value_brl"] or 0.0) for r in rows]


@router.get("/efficiency/waterfall", response_model=list[m.WaterfallStepDTO])
def efficiency_waterfall(period: str | None = None, currency: str = "BRL") -> list[m.WaterfallStepDTO]:
    if mock_active():
        return [m.WaterfallStepDTO(**s) for s in fx.WATERFALL]
    rows = query(f"SELECT step label, kind, value_brl FROM `{RPT}.rpt_savings_waterfall` "
                 f"WHERE kind != 'meta' ORDER BY ord")
    return [m.WaterfallStepDTO(label=r["label"], value_brl=r["value_brl"], kind=r["kind"]) for r in rows]


# ---------------------------------------------------------------- anomalies

@router.get("/anomalies", response_model=list[m.AnomalyRowDTO])
def anomalies(
    from_: DateStr | None = Query(default=None, alias="from"), to: DateStr | None = None,
    currency: str = "BRL",
) -> list[m.AnomalyRowDTO]:
    if mock_active():
        return [m.AnomalyRowDTO(**a) for a in fx.ANOMALIES]
    rows = query(f"""
        SELECT CAST(usage_date AS STRING) usage_date, service_description,
               net_cost_day_brl AS net_cost_brl, avg_28d_brl, z_score,
               deviation_abs_brl, deviation_pct
        FROM `{RPT}.rpt_anomaly_daily` WHERE is_anomaly
        ORDER BY usage_date DESC
    """)
    return [m.AnomalyRowDTO(**r) for r in rows]
