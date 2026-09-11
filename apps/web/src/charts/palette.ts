// Paleta de gráficos DP6 — lê os tokens --chart-* (paleta de gráfico, index.css) resolvidos
// do :root/.dark pra acompanhar o tema; ver DESIGN.md e ci-polaris/MAPA-DE-TOKENS.md §3
// (nomes de papel — rede/alternativa/outros/alerta/crédito — não de cor).
// Só o par azul/verde como série categórica (ΔE ~29 CVD); roxo/rosa reservados; vermelho só status.

const VAR = {
  net: "--chart-net",
  alt: "--chart-alt",
  other: "--chart-other",
  alert: "--chart-alert",
  credit: "--chart-credit",
} as const;

// Fallback = valor claro de cada var, só usado se a var não resolver (ex. antes do CSS carregar).
const FALLBACK: Record<keyof typeof VAR, string> = {
  net: "#1a365d",
  alt: "#059669",
  other: "#8a8f96",
  alert: "#e53e3e",
  credit: "#6b46c1",
};

export function chartColor(name: keyof typeof VAR): string {
  return getComputedStyle(document.documentElement).getPropertyValue(VAR[name]).trim() || FALLBACK[name];
}

export const axisStyle = {
  fontSize: 10,
  fontFamily: '"Ubuntu Mono", monospace',
  fill: "var(--muted-foreground)",
};
