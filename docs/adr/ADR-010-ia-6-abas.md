# ADR-010 — IA de 8 para 6 abas + sem filtro de projeto

Data: 2026-09-12 · Status: aceito

## Contexto

`specs/002-camada-de-consumo-e-entrega.md` fixou a IA em 8 abas ("canvas aprovado
com 8 abas"), e o app (`App.tsx`) foi construído sobre essa IA: Visão geral,
Orçamento, Tendência, Alocação, Serviços & SKUs, Otimização, Unit economics,
Anomalias — 7 delas como `Stub` (só JSON cru dos endpoints já ligados).
`specs/005-telas.md` (rascunho de 2026-09-10) revisou essa IA para **6 abas**,
fundindo Orçamento dentro de Visão Geral e Otimização + Unit economics numa aba
nova "Eficiência & economia", mas essa revisão nunca chegou a ser aplicada no
código — o `App.tsx` seguiu com as 8 rotas antigas.

Na prática o conteúdo de Orçamento (burn-down, previsão, tiles de orçamento) já
tinha sido implementado dentro de `VisaoGeral.tsx` antes desta rodada — a aba
`/orcamento` sobrevivia só como rota redundante, sem conteúdo próprio.

Esta rodada também equalizou `polaris-cost-model` com o `dp6-billing-platform`
(que já tinha removido o filtro de moeda no commit `32b5b2c`), e essa equalização
trouxe a mesma pergunta que o billing-platform já tinha resolvido para si —
adicionar um filtro de seletor de projeto — mas com uma resposta diferente aqui:
a fonte de dado deste repo (`definitions/sources/vw_dp6_ci_polaris.sqlx`) é
filtrada em `project.id = 'dp6-ci-polaris'`, um único projeto sempre. Um seletor
de projeto neste app sempre teria exatamente 1 opção.

## Decisão

1. Aplicar a IA de 6 abas de `specs/005-telas.md` §0: remover a rota `/orcamento`
   (conteúdo já vive em `VisaoGeral.tsx`, sem perda) e fundir `/otimizacao` +
   `/unit-economics` numa única `/eficiencia` ("Eficiência & economia"), por ora
   como `Stub` combinado dos endpoints que as duas telas antigas já ligavam — a
   tela visual completa da spec 005 §5 (Waterfall, Gauge) fica para depois.
2. **Não** adicionar filtro de seletor de projeto neste repo, ao contrário do
   `dp6-billing-platform`. A fonte é escopada a 1 projeto por design (ADR-003) —
   um seletor de projeto seria um dropdown de opção única, sem função real.

## Alternativas consideradas

- **Manter as 8 abas** — mais simples, mas perpetua uma rota morta (`/orcamento`)
  e a spec 005 já documentada como a IA revisada nunca vira código.
- **Adicionar o filtro de projeto mesmo assim**, só por paridade estrutural com o
  billing-platform — descartado por decisão explícita do usuário: não há dado
  real para esse filtro operar, e um seletor de 1 opção só confunde quem usa.

## Consequências

- `Orcamento.tsx`, `Otimizacao.tsx`, `UnitEconomics.tsx` apagados; `Eficiencia.tsx`
  novo substitui os 2 últimos.
- `polaris-cost-model` e `dp6-billing-platform` voltam a ter a mesma IA de rotas,
  mas divergem intencionalmente no filtro de projeto (documentado aqui para não
  ser "corrigido" de volta depois por engano).
- Se a fonte de dado deste repo algum dia deixar de ser escopada a 1 projeto só,
  revisitar esta decisão.
