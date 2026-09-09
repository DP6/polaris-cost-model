import { useSearchParams } from "react-router-dom";

export interface Filters {
  from: string;
  to: string;
  service?: string;
  environment?: string;
  app?: string;
  currency: "BRL" | "USD";
}

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Estado dos filtros globais na querystring (links compartilháveis). */
export function useFilters(): [Filters, (patch: Partial<Filters>) => void] {
  const [sp, setSp] = useSearchParams();
  const f: Filters = {
    from: sp.get("from") ?? isoDaysAgo(30),
    to: sp.get("to") ?? isoDaysAgo(0),
    service: sp.get("service") ?? undefined,
    environment: sp.get("environment") ?? undefined,
    app: sp.get("app") ?? undefined,
    currency: (sp.get("currency") as "BRL" | "USD") ?? "BRL",
  };
  const set = (patch: Partial<Filters>) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "") next.delete(k);
      else next.set(k, String(v));
    }
    setSp(next, { replace: true });
  };
  return [f, set];
}

export const filterParams = (f: Filters): Record<string, string | undefined> => ({
  from: f.from,
  to: f.to,
  service: f.service,
  environment: f.environment,
  app: f.app,
  currency: f.currency,
});
