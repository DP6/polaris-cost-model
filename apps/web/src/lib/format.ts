// Formatação PT-BR (DP6: R$ 1.284,93 · +3,84% · milhar "." decimal ",").

const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const usdFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" });

export const brl = (v: number | null | undefined) => (v == null ? "—" : brlFmt.format(v));
export const usd = (v: number | null | undefined) => (v == null ? "—" : usdFmt.format(v));

export const pct = (v: number | null | undefined, digits = 1) =>
  v == null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;

export const pctPlain = (v: number | null | undefined, digits = 1) =>
  v == null ? "—" : `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;

export const num = (v: number | null | undefined, digits = 0) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** "202609" -> "set/26" */
export const monthLabel = (ym: string) => {
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const y = ym.slice(2, 4);
  const mi = Number(ym.slice(4, 6)) - 1;
  return `${meses[mi] ?? ym}/${y}`;
};

/** "2026-08-21" -> "21/ago" */
export const dayLabel = (iso: string) => {
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const [, mm, dd] = iso.split("-");
  return `${dd}/${meses[Number(mm) - 1] ?? mm}`;
};
