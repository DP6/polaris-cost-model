# ADR-005 — Orçamento de referência: R$ 20/mês

Data: 2026-09-09 · Status: aceito (pendente PR no polaris-cost-control)

## Contexto

A validação mostrou custo real de **R$ 26,41 em ~2 meses** (Cloud Run 82%), com agosto
atípico (janela de deploy/carga 21–26/ago). O `polaris-cost-control` tem um budget nativo de
**R$ 50/mês** com thresholds 50/80/100/120%.

## Decisão

Adotar **R$ 20/mês** como orçamento de referência em todo o `polaris-cost-model`
(`includes/constants.js`, `apps/api/config.py`, canvas de design). Thresholds R$ 10 / 16 / 20 / 24.
Abrir PR no `polaris-cost-control` mudando o budget nativo R$ 50 → R$ 20 para o ecossistema ter
um valor só.

## Alternativas consideradas

- **Manter R$ 50** — alinha com o alerta nativo atual, mas a projeção (run-rate ~R$ 7–11/mês)
  ficaria sempre em ~15–37% do orçamento, sem tensão útil no painel.
- **R$ 20 aqui, R$ 50 no alerta nativo** — meta interna mais apertada no painel, alerta
  externo mais folgado. Rejeitado: dois valores confundem.

## Consequências

- Enquanto o PR no `polaris-cost-control` não mergear, o alerta por e-mail nativo dispara em
  50/80/100/120% de **R$ 50** e o painel mostra 50/80/100/120% de **R$ 20** — divergência
  temporária, documentada aqui.
- `monthly_budget_brl` é constante em dois lugares (Dataform `includes/` e API `config.py`) —
  manter em sincronia; candidato a virar uma GitHub Actions variable no futuro.
