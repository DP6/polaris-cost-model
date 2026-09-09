import { AreaTrend } from "../charts/AreaTrend";
import { HBars } from "../charts/HBars";
import { Card, Chip, DataTable, LoadingOrError, MetricGrid, MetricTile } from "../components/ui";
import { useApi } from "../lib/api";
import { brl, dayLabel, monthLabel, pct, pctPlain, usd } from "../lib/format";
import { filterParams, useFilters } from "../lib/useFilters";
import type { DailyPoint, ReconRow, Scorecard, ServiceCost } from "../types";

export function VisaoGeral() {
  const [f] = useFilters();
  const p = filterParams(f);
  const sc = useApi<Scorecard>("/scorecard", { currency: f.currency });
  const daily = useApi<DailyPoint[]>("/cost/daily", p);
  const svc = useApi<ServiceCost[]>("/cost/by-service", p);
  const recon = useApi<ReconRow[]>("/reconciliation", { currency: f.currency });

  const s = sc.data;

  return (
    <>
      <header style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <span className="eyebrow">{s ? `${monthLabel(s.invoice_month)} · mês corrente (MTD, ${s.days_elapsed} dias)` : "Mês corrente"}</span>
        <h1 style={{ fontSize: 22 }}>Visão geral</h1>
        <p style={{ margin: 0, color: "var(--ink-dim)", fontSize: 13.5, maxWidth: "70ch" }}>
          Custo faturado do projeto <span className="mono">dp6-ci-polaris</span> a partir do billing export.
          Fatura em BRL; USD pela taxa da linha.
        </p>
      </header>

      <LoadingOrError loading={sc.loading} error={sc.error} />
      {s && (
        <MetricGrid>
          <MetricTile label="Custo líquido · MTD" value={brl(s.net_cost_mtd_brl)} sub={<span className="mono">{usd(s.net_cost_mtd_usd)}</span>} />
          <MetricTile label="Run-rate fim de mês" value={brl(s.run_rate_eom_brl)} sub={`projeção linear · ${s.days_elapsed} de ${s.days_in_month} dias`} />
          <MetricTile label="Δ vs. mês anterior" value={pct(s.mom_pct)} tone={s.mom_pct <= 0 ? "ok" : "bad"} sub={<>run-rate vs. <span className="mono">{brl(s.prev_month_net_brl)}</span></>} />
          <MetricTile label="Créditos no mês" value={brl(s.credits_mtd_brl)} sub="só DISCOUNT (Cloud Run)" />
          <MetricTile
            label="Custo vs. orçamento"
            value={pctPlain(s.budget_used_pct)}
            accent
            sub={
              <>
                de <span className="mono">{brl(s.budget_brl)}</span> · run-rate {pctPlain(s.run_rate_vs_budget_pct)}
                <br />
                <Chip tone={s.run_rate_vs_budget_pct <= 1 ? "ok" : "bad"}>
                  {s.run_rate_vs_budget_pct <= 1 ? "✓ dentro do orçamento" : "▲ acima no ritmo atual"}
                </Chip>
              </>
            }
          />
          <MetricTile label="Economia efetiva" value={pctPlain(s.effective_savings_pct)} sub="só créditos · sem desconto negociado" />
        </MetricGrid>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 16 }}>
        <Card title="Custo líquido diário" cap="Área = custo do dia · linha tracejada = média móvel 7 dias.">
          <LoadingOrError loading={daily.loading} error={daily.error} />
          {daily.data && (
            <AreaTrend
              data={daily.data.map((d) => ({ label: dayLabel(d.usage_date), value: d.net_cost_brl, ma7: d.ma7_brl }))}
            />
          )}
        </Card>

        <Card title="Custo por serviço" cap="Período filtrado. Cloud Run concentra a maior parte.">
          <LoadingOrError loading={svc.loading} error={svc.error} />
          {svc.data && (
            <HBars rows={svc.data.map((r) => ({ label: r.service_description, value: r.net_cost_brl, pct: r.pct_of_total }))} />
          )}
        </Card>
      </div>

      <Card title="Reconciliação com a fatura" cap="net = custo bruto + créditos. Cada mês confere com o relatório de faturamento do console.">
        <LoadingOrError loading={recon.loading} error={recon.error} />
        {recon.data && (
          <DataTable
            rows={recon.data}
            cols={[
              { key: "m", label: "Mês da fatura", render: (r: ReconRow) => <span className="mono">{monthLabel(r.invoice_month)}</span> },
              { key: "g", label: "Custo bruto", num: true, render: (r: ReconRow) => brl(r.gross_cost_brl) },
              { key: "c", label: "Créditos", num: true, render: (r: ReconRow) => brl(r.credits_total_brl) },
              { key: "n", label: "Líquido", num: true, render: (r: ReconRow) => <strong>{brl(r.net_cost_brl)}</strong> },
              { key: "ok", label: "Confere", render: (r: ReconRow) => <span style={{ color: "var(--ok)" }}>{r.matches_invoice ? "✓" : "✗"}</span> },
            ]}
          />
        )}
      </Card>
    </>
  );
}
