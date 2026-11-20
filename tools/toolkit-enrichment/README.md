# Toolkit enrichment — Phase 2 (one-off)

Splits every toolkit obligation into **requirements** (the distinct enforceable duties), tags each
with a risk from a curated taxonomy, and maps each requirement to the row's own control(s). Runs
**once**, offline; the result is written back into the committed toolkit seed. No AI runs at seed
time. See `Atheris_Phase2_Requirements_Risks.md` §4.

## Pipeline

```
extract_obligations.py   -> obligations.json   (1,630 obligation rows, read-only from the toolkit JSON)
enrich.py                -> enrichment.json    (AI pass: requirements + riskCode + control map; resumable)
assemble.py              -> requirements.json / risks.json / coverage.csv / compliance_toolkits.enriched.json
```

Run order: `extract_obligations.py` → `enrich.py` → `assemble.py`.

## Inputs / config

- Toolkit seed: `.../atheris-compliance-intelligence-backend/src/main/resources/toolkit/compliance_toolkits.json`
  (override with `TOOLKIT_JSON`).
- `risk_taxonomy.json` — the curated risk catalogue (~41 codes). **Stable `code` is the identity**;
  review/edit before the full run.

## AI gateway

OpenAI-compatible endpoint (`https://ai-gateway.isw.la/v1`, model `deepseek-v4.1`). **The key is
never committed** — set `AI_GATEWAY_KEY` (or it is read from the opencode config). Other vars:
`AI_BATCH`/`AI_WORKERS` (8/5), `AI_LIMIT` (smoke test).

## Output & QA

- `coverage.csv` — per obligation: requirement count, **uncovered** count, confidence. Review this
  before swapping the seed: obligations should have 1-4 requirements, most with a specific
  (non-`RC-01`) risk, and uncovered duties are expected where no control exists.
- `compliance_toolkits.enriched.json` — the toolkit seed with a top-level `risks[]` and per-row
  `requirements[]`; this becomes the committed `compliance_toolkits.json` once signed off.

Generated outputs are gitignored (regenerable).
