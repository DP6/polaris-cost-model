import type { ReactNode } from "react";

export function Card({ title, cap, children }: { title?: string; cap?: string; children: ReactNode }) {
  return (
    <div className="card">
      {title && <h3>{title}</h3>}
      {cap && <p className="cap">{cap}</p>}
      {children}
    </div>
  );
}

export function MetricTile({
  label, value, sub, accent, tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: boolean;
  tone?: "ok" | "bad" | "neutral";
}) {
  const color = tone === "ok" ? "var(--ok)" : tone === "bad" ? "var(--bad)" : "var(--ink)";
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--hair)",
        borderTop: accent ? "2px solid var(--accent)" : undefined,
        borderRadius: 8,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <span
        style={{
          font: "500 10px/1.3 Ubuntu, sans-serif",
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: "var(--ink-dim)",
        }}
      >
        {label}
      </span>
      <span
        className="mono"
        style={{ fontWeight: 700, fontSize: 24, letterSpacing: "-.02em", lineHeight: 1.05, color }}
      >
        {value}
      </span>
      {sub && <span style={{ fontSize: 12, color: "var(--ink-dim)" }}>{sub}</span>}
    </div>
  );
}

export function MetricGrid({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
      {children}
    </div>
  );
}

export function Chip({ tone, children }: { tone: "ok" | "warn" | "bad"; children: ReactNode }) {
  const c = tone === "ok" ? "var(--ok)" : tone === "warn" ? "var(--warn)" : "var(--bad)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        alignSelf: "flex-start",
        padding: "3px 8px",
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 500,
        color: c,
        background: `color-mix(in srgb, ${c} 15%, transparent)`,
      }}
    >
      {children}
    </span>
  );
}

export function DataTable<T>({
  cols, rows,
}: {
  cols: { key: string; label: string; num?: boolean; render: (r: T) => ReactNode }[];
  rows: T[];
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="dt">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {cols.map((c) => (
                <td key={c.key} className={c.num ? "num" : undefined}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LoadingOrError({ loading, error }: { loading?: boolean; error?: string }) {
  if (error)
    return <div style={{ color: "var(--bad)", fontSize: 13 }}>Erro ao carregar: {error}</div>;
  if (loading) return <div style={{ color: "var(--ink-mute)", fontSize: 13 }}>Carregando…</div>;
  return null;
}
