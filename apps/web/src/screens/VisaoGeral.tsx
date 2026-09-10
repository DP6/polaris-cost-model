import { AreaTrend } from "../charts/AreaTrend";
import { HBars } from "../charts/HBars";
import {
  DataTable,
  LoadingOrError,
  MetricGrid,
  MetricTile,
  PageHeader,
  Panel,
  StatusBadge,
} from "../components/ui";
import { useApi } from "../lib/api";
import { brl, dayLabel, monthLabel, monthLong, pct, pctPlain, relativeToNow, usd } from "../lib/format";
import { filterParams, PERIOD_LABELS, resolveWindow, scopeParams, useFilters } from "../lib/useFilters";
import type { DailyPoint, Dimensions, ReconRow, Scorecard, ServiceCost } from "../types";

export function VisaoGeral() {
  const [f] = useFilters();
  const win = resolveWindow(f);
  const dims = useApi<Dimensions>("/dimensions");
  const sc = useApi<Scorecard>("/scorecard", scopeParams(f));
  const daily = useApi<DailyPoint[]>("/cost/daily", filterParams(f));
  const svc = useApi<ServiceCost[]>("/cost/by-service", filterParams(f));
  const recon = useApi<ReconRow[]>("/reconciliation", scopeParams(f));

  const s = sc.data;
  const d = dims.data;
  const nowIso = new Date().toISOString();
  const stale = d?.data_updated_at && Date.now() - new Date(d.data_updated_at).getTime() > 36 * 3600 * 1000;
  const janela = f.period === "custom" ? `${win.from} a ${win.to}` : PERIOD_LABELS[f.period].toLowerCase();

  return (
    <>
      <PageHeader
        eyebrow={
          s ? `${monthLong(s.invoice_month)} · mês corrente (MTD, ${s.days_elapsed} dias)` : "Mês corrente"
        }
        title="Visão geral"
        desc={
          <>
            Custo faturado do projeto <span className="mono">dp6-ci-polaris</span> a partir do billing export.
            Fatura em BRL; USD pela taxa da linha.
          </>
        }
      />

      {/* tira de saúde dos dados */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "9px 14px",
          background: "var(--muted)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          fontSize: 12.5,
          color: "var(--muted-foreground)",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            flex: "none",
            background: stale ? "var(--status-warn)" : "var(--status-ok)",
          }}
        />
        {d ? (
          <>
            {d.export_ok ? "Export íntegro" : "Export com pendência"} · última carga{" "}
            <span className="mono">{relativeToNow(d.data_updated_at || nowIso)}</span> ·{" "}
            <span className="mono">{d.source_rows.toLocaleString("pt-BR")}</span> linhas ·{" "}
            <span className="mono">{d.invoice_months.length}</span> meses
          </>
        ) : (
          "carregando saúde dos dados…"
        )}
      </div>

      <LoadingOrError loading={sc.loading} error={sc.error} />
      {s && (
        <MetricGrid>
          <MetricTile
            label="Custo líquido · MTD"
            value={f.currency === "USD" ? usd(s.net_cost_mtd_usd) : brl(s.net_cost_mtd_brl)}
            sub={
              <span className="mono">
                {f.currency === "USD" ? brl(s.net_cost_mtd_brl) : usd(s.net_cost_mtd_usd)}
              </span>
            }
          />
          <MetricTile
            label="Run-rate fim de mês"
            value={brl(s.run_rate_eom_brl)}
            sub={`projeção linear · ${s.days_elapsed} de ${s.days_in_month} dias`}
          />
          <MetricTile
            label="Δ vs. mês anterior"
            value={pct(s.mom_pct)}
            tone={s.mom_pct <= 0 ? "ok" : "bad"}
            sub={
              <>
                run-rate vs. <span className="mono">{brl(s.prev_month_net_brl)}</span>
              </>
            }
          />
          <MetricTile label="Créditos no mês" value={brl(s.credits_mtd_brl)} sub="só DISCOUNT (Cloud Run)" />
          <MetricTile
            label="Custo vs. orçamento"
            value={pctPlain(s.budget_used_pct)}
            accent
            sub={
              <>
                de <span className="mono">{brl(s.budget_brl)}</span> · run-rate{" "}
                {pctPlain(s.run_rate_vs_budget_pct)}
                <br />
                <StatusBadge tone={s.run_rate_vs_budget_pct <= 1 ? "ok" : "warn"}>
                  {s.run_rate_vs_budget_pct <= 1 ? "dentro do orçamento" : "acima no ritmo atual"}
                </StatusBadge>
              </>
            }
          />
          <MetricTile
            label="Economia efetiva"
            value={pctPlain(s.effective_savings_pct)}
            sub="só créditos · sem desconto negociado"
          />
        </MetricGrid>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 16 }}>
        <Panel
          title="Custo líquido diário"
          cap={`Área = custo do dia · linha tracejada = média móvel 7 dias · ${janela}.`}
        >
          <LoadingOrError loading={daily.loading} error={daily.error} />
          {daily.data &&
            (daily.data.length === 0 ? (
              <p style={{ color: "var(--ink-mute)", fontSize: 13 }}>Sem custo no período/recorte.</p>
            ) : (
              <AreaTrend
                data={daily.data.map((x) => ({
                  label: dayLabel(x.usage_date),
                  value: x.net_cost_brl,
                  ma7: x.ma7_brl,
                }))}
              />
            ))}
        </Panel>

        <Panel title="Custo por serviço" cap="Acumulado no período. Cloud Run concentra a maior parte.">
          <LoadingOrError loading={svc.loading} error={svc.error} />
          {svc.data &&
            (svc.data.length === 0 ? (
              <p style={{ color: "var(--ink-mute)", fontSize: 13 }}>Sem custo no período/recorte.</p>
            ) : (
              <HBars
                rows={svc.data.map((r) => ({
                  label: r.service_description,
                  value: r.net_cost_brl,
                  pct: r.pct_of_total,
                }))}
              />
            ))}
        </Panel>
      </div>

      <Panel
        title="Reconciliação com a fatura"
        cap="net = custo bruto + créditos. Cada mês confere com o relatório de faturamento do console."
      >
        <LoadingOrError loading={recon.loading} error={recon.error} />
        {recon.data && (
          <DataTable
            rows={recon.data}
            cols={[
              {
                key: "m",
                label: "Mês da fatura",
                render: (r: ReconRow, i: number) => (
                  <span className="mono">
                    {monthLabel(r.invoice_month)}
                    {i === recon.data!.length - 1 && (
                      <span style={{ color: "var(--ink-mute)" }}> (parcial)</span>
                    )}
                  </span>
                ),
              },
              { key: "g", label: "Custo bruto", num: true, render: (r: ReconRow) => brl(r.gross_cost_brl) },
              { key: "c", label: "Créditos", num: true, render: (r: ReconRow) => brl(r.credits_total_brl) },
              {
                key: "n",
                label: "Líquido",
                num: true,
                render: (r: ReconRow) => <strong>{brl(r.net_cost_brl)}</strong>,
              },
              {
                key: "ok",
                label: "Confere",
                render: (r: ReconRow) => (
                  <StatusBadge tone={r.matches_invoice ? "ok" : "error"}>
                    {r.matches_invoice ? "confere" : "diverge"}
                  </StatusBadge>
                ),
              },
            ]}
          />
        )}
      </Panel>
    </>
  );
}
