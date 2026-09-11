import { useCallback, useSyncExternalStore } from "react";

const KEY = "pcm:theme";
type Theme = "dark" | "light";

function readInitial(): Theme {
  try {
    return localStorage.getItem(KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function applyTheme(t: Theme) {
  document.documentElement.classList.toggle("dark", t === "dark");
  try {
    if (t === "light") localStorage.setItem(KEY, "light");
    else localStorage.removeItem(KEY);
  } catch {
    /* modo privado */
  }
}

let theme: Theme = readInitial();
const listeners = new Set<() => void>();

function setTheme(t: Theme) {
  theme = t;
  applyTheme(theme);
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Tema por classe `.dark` em <html>, compartilhado via useSyncExternalStore entre todos os
 *  componentes que chamam este hook — sem isso, só quem chamava useTheme() (o TopBar)
 *  re-renderizava no toggle, e os gráficos (que leem a cor via getComputedStyle em palette.ts)
 *  ficavam com a cor do tema anterior até algum outro re-render acidental (filtro, refetch).
 *  Dark é o padrão; só persiste "light". O script bloqueante em index.html já aplicou a classe
 *  antes do 1º paint; aqui sincronizamos o estado do React. Espelha hooks/useTheme do
 *  atlas/apps/frontend. */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const current = useSyncExternalStore(subscribe, () => theme);
  const toggle = useCallback(() => setTheme(theme === "dark" ? "light" : "dark"), []);
  return { theme: current, toggle };
}
