# Toolkit control ownership — Phase 0 (one-off)

Attributes every toolkit control to an accountable department + unit, an accountable role
title, its contributors and an independent verifier, so the seeded org and controls carry real
ownership. Runs **once**, offline; the output is a static JSON committed to the repo. No AI runs
at seed time.

## Input

`~/Downloads/Compliance Management Toolkits DRAFT.xlsm` — read-only over the raw sheet XML.
**Never enables macros, never drives Excel.** Override the path with `TOOLKIT_XLSM`.

## Pipeline

```
extract_rows.py        -> rows.json (1,649 control rows) + testers.json (191 monitoring-plan rows)
classify_controls.py   -> attributions.json  (AI pass via the ISW gateway, resumable checkpoint)
build_review.py        -> ownership.json + review_low_conf.csv + spotcheck.csv + summary.txt
build_testers.py       -> tester_catalog.json (role titles + per-area proposed tester)
```

Run order: `extract_rows.py` → `classify_controls.py` → `build_review.py` → `build_testers.py`.

## AI gateway

OpenAI-compatible endpoint from the opencode config (`provider.aigateway`).

| var | default |
|---|---|
| `AI_GATEWAY_URL` | `https://ai-gateway.isw.la/v1` |
| `AI_GATEWAY_MODEL` | `deepseek-v4.1` |
| `AI_GATEWAY_KEY` | the opencode gateway key (override via env; never commit a different secret) |
| `AI_BATCH` / `AI_WORKERS` | `12` / `6` |
| `AI_SHEETS` / `AI_LIMIT` | unset — full run; set for a smoke test |

The run is idempotent and resumable: per-row results land in `attributions.ckpt.json`; a re-run
skips completed batches. A single batch retries 4× with backoff before failing.

## Output

`ownership.json` — one record per control row: `sheet, row, act, section, title, control,
additionalControl, responsibilityText, additionalResponsibilityText, accountableDepartment,
accountableUnit, accountableRoleTitle, contributors, verifierDepartment, confidence, reason`.

`review_low_conf.csv` — every row with confidence < 70 (the human review sheet).
`spotcheck.csv` — a 5% random sample (seed 42) for spot-checking.
`tester_catalog.json` — role titles from the Monitoring Plan + a proposed tester per area.

## Findings (2026-11-08)

- 1,649 control rows across 13 sheets; 100% attributed with a department/unit/verifier that is
  valid against `org_vocab.json`. Confidence min/avg/max = 30 / 74.4 / 95; 319 rows < 70.
- The **Compliance Monitoring Plan is a parallel curated list** (191 controls across 7 themes:
  PCR FRC ESG CASH CYB CAP ABAC) with a "Responsible Officer" per control. It does **not** map
  onto the obligation-sheet controls (no exact text match; only 23 pairs at 0.5–0.7 fuzzy). It is
  therefore treated as a **tester/role source**, not a control-keyed override.
- 22 workbook responsibility cells are garbage ("High", "Same as above", "Business Unit Heads");
  these are in `review_low_conf.csv` with confidence <= 40.
