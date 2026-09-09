import { useEffect, useState } from "react";
import { NavLink, Route, Routes, useSearchParams } from "react-router-dom";
import { useApi } from "./lib/api";
import type { Meta } from "./types";
import { VisaoGeral } from "./screens/VisaoGeral";
import { Orcamento } from "./screens/Orcamento";
import { Tendencia } from "./screens/Tendencia";
import { Alocacao } from "./screens/Alocacao";
import { Servicos } from "./screens/Servicos";
import { Otimizacao } from "./screens/Otimizacao";
import { UnitEconomicsScreen } from "./screens/UnitEconomics";
import { Anomalias } from "./screens/Anomalias";

const TABS = [
  ["/", "Visão geral", VisaoGeral],
  ["/orcamento", "Orçamento", Orcamento],
  ["/tendencia", "Tendência", Tendencia],
  ["/alocacao", "Alocação", Alocacao],
  ["/servicos", "Serviços & SKUs", Servicos],
  ["/otimizacao", "Otimização", Otimizacao],
  ["/unit-economics", "Unit economics", UnitEconomicsScreen],
  ["/anomalias", "Anomalias", Anomalias],
] as const;

function useTheme(): [string | null, () => void] {
  const [theme, setTheme] = useState<string | null>(() => {
    try {
      return localStorage.getItem("pcm-theme");
    } catch {
      return null;
    }
  });
  useEffect(() => {
    const el = document.documentElement;
    if (theme) el.setAttribute("data-theme", theme);
    else el.removeAttribute("data-theme");
    try {
      theme ? localStorage.setItem("pcm-theme", theme) : localStorage.removeItem("pcm-theme");
    } catch {
      /* private mode */
    }
  }, [theme]);
  const toggle = () => {
    const sysDark = matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme((t) => (t ? (t === "dark" ? "light" : "dark") : sysDark ? "light" : "dark"));
  };
  return [theme, toggle];
}

function TopBar() {
  const [, toggle] = useTheme();
  const meta = useApi<Meta>("/meta");
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        gap: 14,
        height: 52,
        padding: "0 28px",
        background: "var(--ink)",
        color: "#f2f1ec",
      }}
    >
      <svg width="24" height="16" viewBox="0 0 26 18" aria-hidden="true">
        <path d="M2 18 L2 12 L7 10 L7 18 Z" fill="#ffb302" />
        <path d="M10 18 L10 7 L15 5 L15 18 Z" fill="#ffb302" />
        <path d="M18 18 L18 2 L23 0 L23 18 Z" fill="#ffb302" />
      </svg>
      <span style={{ fontWeight: 500 }}>CI Polaris</span>
      <span style={{ color: "#a7abb0", fontSize: 13 }}>· controle de custo</span>
      <span style={{ flex: 1 }} />
      {meta.data && (
        <span className="mono" style={{ fontSize: 11, color: "#d9d6cc", border: "1px solid #4a4a44", borderRadius: 999, padding: "4px 9px" }}>
          dados de {new Date(meta.data.data_updated_at).toLocaleString("pt-BR")}
        </span>
      )}
      <button
        onClick={toggle}
        aria-label="Alternar tema"
        style={{ width: 34, height: 34, background: "transparent", border: "1px solid #4a4a44", borderRadius: 4, cursor: "pointer", color: "#f2f1ec" }}
      >
        ☾
      </button>
    </header>
  );
}

function FilterBar() {
  const [sp, setSp] = useSearchParams();
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    v ? n.set(k, v) : n.delete(k);
    setSp(n, { replace: true });
  };
  const field = (label: string, key: string, opts: string[]) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ font: "500 10px/1 Ubuntu, sans-serif", letterSpacing: ".18em", textTransform: "uppercase", color: "var(--ink-dim)" }}>{label}</span>
      <select
        value={sp.get(key) ?? ""}
        onChange={(e) => set(key, e.target.value)}
        style={{ padding: "7px 10px", background: "var(--surface)", border: "1px solid var(--hair-strong)", borderRadius: 4, minWidth: 130 }}
      >
        {opts.map((o) => (
          <option key={o} value={o === "Todos" || o === "Últimos 30 dias" ? "" : o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "14px 22px", padding: "14px 28px", background: "var(--well)", borderBottom: "1px solid var(--hair)" }}>
      {field("Ambiente", "environment", ["Todos", "prod", "dev"])}
      {field("App", "app", ["Todos", "atlas", "polaris-cost-control", "observability-hub"])}
      {field("Moeda", "currency", ["BRL", "USD"])}
      <p style={{ marginLeft: "auto", alignSelf: "center", fontSize: 12, color: "var(--ink-mute)", maxWidth: 260 }}>
        Filtros na URL — links compartilháveis. Período: últimos 30 dias.
      </p>
    </div>
  );
}

export default function App() {
  return (
    <>
      <TopBar />
      <FilterBar />
      <nav style={{ display: "flex", padding: "0 20px", borderBottom: "1px solid var(--hair)", overflowX: "auto" }}>
        {TABS.map(([to, label]) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            style={({ isActive }) => ({
              padding: "14px 13px 12px",
              whiteSpace: "nowrap",
              fontSize: 14,
              textDecoration: "none",
              color: isActive ? "var(--ink)" : "var(--ink-dim)",
              fontWeight: isActive ? 500 : 400,
              borderBottom: `2px solid ${isActive ? "var(--accent)" : "transparent"}`,
            })}
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: 28, display: "flex", flexDirection: "column", gap: 24 }}>
        <Routes>
          {TABS.map(([to, , Comp]) => (
            <Route key={to} path={to} element={<Comp />} />
          ))}
        </Routes>
      </main>
      <footer style={{ borderTop: "1px solid var(--hair)", background: "var(--ink)", color: "#a7abb0", padding: "16px 28px", font: '400 11.5px/1.5 "Ubuntu Mono", monospace' }}>
        polaris-cost-model / apps/web · painel FinOps do CI Polaris · dados via apps/api (rpt_* no BigQuery, ou modo mock)
      </footer>
    </>
  );
}
