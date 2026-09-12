# ADR-009 — Fonte do design system passa a ser `ci-polaris`, não mais `atlas`

Data: 2026-09-12 · Status: aceito

## Contexto

Desde o início, `apps/web/DESIGN.md` declarava espelhar
`atlas/apps/frontend/src/index.css` — o Atlas era a fonte de valor dos tokens de
design, e este repo copiava/replicava manualmente (`--background`, `--status-*`,
`--radius` etc. nasceram idênticos aos do Atlas, com uma camada de aliases legados
por cima).

Isso criava uma dependência textual de um repo standalone (ADR-001) para outro —
`polaris-cost-model` não deveria precisar ler o código do Atlas para saber a cor
certa de um token. Além disso, nenhum dos dois repos (nem o `polaris-heap`, que
também tinha uma cópia do arquivo de design system da marca) estava de fato
sincronizado com a guideline oficial — cada um divergiu um pouco por conta própria
(raio, vermelho de status, texto secundário).

## Decisão

`ci-polaris/DP6-Design-System.md` (repo guarda-chuva da iniciativa) passa a ser a
**fonte canônica única** do padrão visual pra toda a iniciativa CI Polaris —
`polaris-atlas` (app + GitHub Pages), `polaris-cost-model` (app web) e
`polaris-heap` (site, espelha em vez de definir). `ci-polaris/MAPA-DE-TOKENS.md`
resolve a correspondência entre os tokens canônicos e os nomes/valores usados em
cada repo, o que fazer com token sem equivalente dos dois lados, e os conflitos já
identificados (ex.: vermelho de status varia por tema no DS, era fixo no código —
alinhado nesta mesma rodada).

`apps/web/DESIGN.md` e `apps/web/index.css` (deste repo) atualizados pra apontar
pra `ci-polaris/DP6-Design-System.md` + `MAPA-DE-TOKENS.md` em vez de
`atlas/apps/frontend/src/index.css`.

## Alternativas consideradas

- **Manter o Atlas como fonte** — mais simples de continuar, mas perpetua a
  dependência textual entre dois repos standalone e não resolve a divergência
  frente à guideline oficial de marca.
- **Cada repo com sua própria cópia do design system, sem fonte comum** — é
  essencialmente o que já estava acontecendo (drift silencioso); descartado.

## Consequências

- Nenhuma ruptura de nome ou valor nos tokens já existentes — a estratégia de
  aplicação foi híbrida (camada canônica como base, nomes locais derivando dela
  via `var()`), confirmada viável pelo mapa antes de qualquer mudança de código.
- Mudança de valor real desta rodada: `--status-error` passa a variar por tema
  (`#D64500` claro / `#E53E3E` escuro, igual já era), alinhado ao DS — decisão de
  produto, não técnica, confirmada explicitamente pelo usuário.
- `ci-polaris/scripts/` (safeguards de var órfã e contraste WCAG) passam a ser a
  ferramenta de validação reutilizável entre os repos da iniciativa, em vez de
  cada um ter a sua.
- Mudança futura de token (Atlas, cost-model ou GH Pages do Atlas) deve consultar
  o mapa antes de decidir valor — não herdar do outro repo em silêncio.
