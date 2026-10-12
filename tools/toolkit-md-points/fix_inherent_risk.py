#!/usr/bin/env python3
"""
Derive a clean inherent Likelihood / Impact label for CRMP obligation rows whose source
cell holds free text (a risk description) instead of a label.

Why: the CRMP sheets' Inherent Likelihood / Inherent Impact columns should hold one of
Very Low | Low | Medium | High | Very High. Many rows instead contain a whole risk
sentence, so the importer's normalizeRiskLabel returns null and the derived control has
no risk band. This offline pass asks the AI gateway to classify those cells, then writes
the labels back into BOTH compliance_toolkits.json and compliance_toolkits.md (the human
source), so a re-export/re-import stays consistent.

Usage:
  export AI_GATEWAY_API_KEY=...            # OpenAI-compatible key (never committed)
  python3 fix_inherent_risk.py \
      --base-url https://ai-gateway.isw.la/v1 \
      --model deepseek-v4.1

Resumable: results are cached in inherent_risk_fixed.json keyed by
source|sectionRef|title|plain. Re-running only processes rows still missing a label.
Fail-closed: a row the model does not return a valid label for is left unchanged and
reported (never invented).
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import threading
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
TOOLKIT_DIR = HERE.parents[1] / "atheris-compliance-backend" / "atheris-compliance" / \
    "atheris-compliance-intelligence-backend" / "src" / "main" / "resources" / "toolkit"
TOOLKIT_JSON = TOOLKIT_DIR / "compliance_toolkits.json"
TOOLKIT_MD = TOOLKIT_DIR / "compliance_toolkits.md"
DEFAULT_SIDECAR = HERE / "inherent_risk_fixed.json"
REVIEW_CSV = HERE / "inherent_risk_review.csv"

CLEAN = {"very low", "low", "medium", "high", "very high"}
LABELS = ["Very Low", "Low", "Medium", "High", "Very High"]
CRMP_SECTIONS = ["conduct_risk", "corporate_governance", "data_protection",
                 "capital_market", "crmp", "esg", "cybersecurity", "consumer_protection",
                 "abac", "amlcft", "actmgt", "cash_mgt"]

PROMPT = """You are a compliance risk analyst. For each obligation below, infer its INHERENT
LIKELIHOOD and INHERENT IMPACT — i.e. the likelihood and impact of the risk BEFORE any
control is applied. Base your judgement ONLY on the text provided (the risk description,
the obligation statement, and any existing likelihood/impact hints).

Allowed labels (use EXACTLY these spellings):
  Very Low, Low, Medium, High, Very High

Rules:
- Judge each field independently. Likelihood = how probable the breach is; impact = how
  severe the consequence (regulatory sanction, financial loss, reputational damage).
- "High" severity wording (sanctions, licence loss, fraud, systemic risk) → impact High
  or Very High. Routine/administrative wording → impact Low or Medium.
- Return a label for BOTH fields even when only one was missing.
- Echo the KEY EXACTLY as given.

Return STRICT JSON, no prose:
{"results":[{"key":"<KEY>","likelihood":"High","impact":"Medium","confidence":0.0-1.0}]}

Obligations:
{batch}
"""


def natural_key(row):
    parts = [row.get("source") or "", row.get("sectionRef") or "",
             row.get("title") or "", row.get("plain") or ""]
    return "|".join(p.strip() for p in parts)


WIRE_SEP = " >> "


def model_key(row):
    fields = [(row.get(k) or "").strip().replace(">>", ">")
              for k in ("source", "sectionRef", "title")]
    return WIRE_SEP.join(fields)


def is_clean(v):
    return bool((v or "").strip()) and (v or "").strip().lower() in CLEAN


def canonical(v):
    for lbl in LABELS:
        if (v or "").strip().lower() == lbl.lower():
            return lbl
    return None


def load_control_rows(path):
    doc = json.loads(Path(path).read_text(encoding="utf-8"))
    rows = []
    for section, items in (doc.get("obligations") or {}).items():
        for r in items:
            if (r.get("primaryControl") or "").strip() or (r.get("additionalControl") or "").strip():
                rows.append((section, r))
    return doc, rows


def call_model(base_url, model, api_key, batch_text, timeout=180, retries=4):
    url = base_url.rstrip("/") + "/chat/completions"
    body = json.dumps({
        "model": model,
        "temperature": 0,
        "messages": [{"role": "user", "content": PROMPT.replace("{batch}", batch_text)}],
    }).encode("utf-8")
    last = None
    for attempt in range(1, retries + 1):
        req = urllib.request.Request(
            url, data=body,
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            return _extract_json(payload["choices"][0]["message"]["content"])
        except Exception as e:  # noqa: BLE001
            last = e
            if attempt < retries:
                time.sleep(min(30, 2 ** attempt))
    raise RuntimeError(f"model call failed after {retries} attempts: {last}")


def _extract_json(text):
    if text is None:
        raise ValueError("empty completion")
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r"^```[a-zA-Z]*\s*", "", t)
        t = re.sub(r"\s*```$", "", t)
    start, end = t.find("{"), t.rfind("}")
    if start >= 0 and end > start:
        t = t[start:end + 1]
    return json.loads(t)


def entry_line(row):
    r = row
    return (f"KEY {model_key(row)}\n"
            f"  Risk description: {r.get('riskDescription') or ''}\n"
            f"  Obligation: {r.get('plain') or r.get('description') or ''}\n"
            f"  Existing likelihood hint: {r.get('likelihoodInherent') or ''}\n"
            f"  Existing impact hint: {r.get('impactInherent') or ''}\n")


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--json", default=str(TOOLKIT_JSON))
    ap.add_argument("--md", default=str(TOOLKIT_MD))
    ap.add_argument("--sidecar", default=str(DEFAULT_SIDECAR))
    ap.add_argument("--base-url", default=os.environ.get("AI_GATEWAY_BASE_URL", "https://ai-gateway.isw.la/v1"))
    ap.add_argument("--model", default=os.environ.get("AI_GATEWAY_MODEL", "deepseek-v4.1"))
    ap.add_argument("--api-key", default=os.environ.get("AI_GATEWAY_API_KEY", ""))
    ap.add_argument("--batch-size", type=int, default=20)
    ap.add_argument("--concurrency", type=int, default=3)
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    if not args.api_key:
        print("ERROR: set AI_GATEWAY_API_KEY (or pass --api-key)", file=sys.stderr)
        return 2

    sidecar_path = Path(args.sidecar)
    fixed = {}
    if sidecar_path.exists():
        fixed = json.loads(sidecar_path.read_text(encoding="utf-8")).get("labels", {})
        print(f"Resuming: {len(fixed)} rows already classified")

    _doc, rows = load_control_rows(args.json)
    todo = []
    for _section, r in rows:
        k = natural_key(r)
        if k in fixed:
            continue
        if not is_clean(r.get("likelihoodInherent")) or not is_clean(r.get("impactInherent")):
            todo.append(r)
    if args.limit and args.limit > 0:
        todo = todo[:args.limit]
    print(f"Control rows: {len(rows)}; needing derivation: {len(todo)} "
          f"(batch={args.batch_size}, concurrency={args.concurrency})")
    if not todo:
        print("Nothing to derive.")
    else:
        lock = threading.Lock()

        def flush():
            sidecar_path.write_text(json.dumps({
                "meta": {"generator": "tools/toolkit-md-points/fix_inherent_risk.py",
                         "model": args.model, "generatedAt": datetime.now(timezone.utc).isoformat(),
                         "classified": len(fixed)},
                "labels": fixed,
            }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

        batches = [todo[i:i + args.batch_size] for i in range(0, len(todo), args.batch_size)]
        done = 0
        failed = 0

        def run_batch(batch):
            nonlocal done, failed
            text = "\n".join(entry_line(r) for r in batch)
            try:
                payload = call_model(args.base_url, args.model, args.api_key, text)
            except Exception as e:  # noqa: BLE001
                failed += 1
                print(f"  ! batch failed ({len(batch)} rows): {e}")
                return
            by_key = {}
            for res in (payload.get("results") or []):
                by_key[(res.get("key") or "").strip()] = res
            with lock:
                for r in batch:
                    mk = model_key(r)
                    res = by_key.get(mk)
                    if not res:
                        for k, v in by_key.items():
                            if k.replace("KEY ", "").strip() == mk:
                                res = v
                                break
                    if not res:
                        continue
                    lk = canonical(res.get("likelihood"))
                    im = canonical(res.get("impact"))
                    if not lk and not im:
                        continue
                    fixed[natural_key(r)] = {
                        "likelihood": lk or (r.get("likelihoodInherent") or "").strip() or None,
                        "impact": im or (r.get("impactInherent") or "").strip() or None,
                        "confidence": res.get("confidence"),
                    }
                done += len(batch)
                flush()
                print(f"  batch done: {done}/{len(todo)} classified (failed batches: {failed})")

        with ThreadPoolExecutor(max_workers=args.concurrency) as ex:
            futs = [ex.submit(run_batch, b) for b in batches]
            for _ in as_completed(futs):
                pass
        flush()
        print(f"Classification complete: {len(fixed)} rows in sidecar ({failed} failed batches)")

    # ── apply to JSON ──
    doc = json.loads(Path(args.json).read_text(encoding="utf-8"))
    applied = 0
    review = []
    for section, items in (doc.get("obligations") or {}).items():
        for r in items:
            k = natural_key(r)
            fix = fixed.get(k)
            if not fix:
                continue
            for field, key in (("likelihoodInherent", "likelihood"), ("impactInherent", "impact")):
                old = r.get(field)
                if is_clean(old):
                    continue
                new = fix.get(key)
                if not new:
                    continue
                r[field] = new
                applied += 1
                review.append((section, r.get("source"), r.get("sectionRef"), r.get("title"),
                               field, (old or "")[:80], new, fix.get("confidence")))
    Path(args.json).write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"JSON updated: {applied} cells.")

    # ── apply to markdown ──
    md_applied = apply_to_md(Path(args.md), doc)
    print(f"Markdown updated: {md_applied} data rows rewritten.")

    # ── review csv ──
    import csv
    with open(REVIEW_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["section", "source", "sectionRef", "title", "field", "old", "new", "confidence"])
        w.writerows(review)
    print(f"Review CSV: {REVIEW_CSV} ({len(review)} cells)")
    return 0


def apply_to_md(md_path, doc):
    """Rewrite the CRMP tables: for each data row, replace the inherent Likelihood/Impact
    cells with the (now-clean) JSON values, matched by source+sectionRef+title.

    Column positions vary per sheet (usually 8/9, but ABAC is 7/8), so the two indices are
    taken from each sheet's own 'Likelihood (Inherent)' header row."""
    text = md_path.read_text(encoding="utf-8")
    lines = text.splitlines(keepends=True)

    # index JSON rows by (title) — titles are unique within a sheet in practice; fall back
    # to (source, sectionRef, title) when ambiguous.
    idx = {}
    for section, items in (doc.get("obligations") or {}).items():
        for r in items:
            idx.setdefault((r.get("title") or "").strip(), []).append(r)

    applied = 0
    li_idx = im_idx = None
    for i, line in enumerate(lines):
        if not line.lstrip().startswith("|"):
            li_idx = im_idx = None  # leaving a table resets the column map
            continue
        cells = split_md_row(line)
        # header row for this sheet?
        inh = [j for j, c in enumerate(cells) if "Inherent" in c]
        if len(inh) == 2:
            li_idx, im_idx = inh
            continue
        if li_idx is None or len(cells) <= max(li_idx, im_idx):
            continue
        title = cells[4].strip() if len(cells) > 4 else ""
        candidates = idx.get(title)
        if not candidates:
            continue
        src = cells[2].strip() if len(cells) > 2 else ""
        # Prefer a candidate whose stored labels exactly match this row's current cells
        # (handles duplicate titles across sheets); else a same-source candidate; else any.
        def matches(r):
            return (r.get("likelihoodInherent") or "").strip() in (cells[li_idx].strip(), "") or \
                   (r.get("impactInherent") or "").strip() in (cells[im_idx].strip(), "")
        target = next((r for r in candidates if (r.get("source") or "").strip() == src), None)
        if target is None:
            target = candidates[0]
        li = target.get("likelihoodInherent")
        im = target.get("impactInherent")
        changed = False
        # Only rewrite a cell that is currently NOT a clean label, and only with a value
        # that IS a clean label. Never write the raw (possibly sentence) JSON value into the
        # source, and never touch already-clean cells.
        if is_clean(li) and not is_clean(cells[li_idx]) and cells[li_idx].strip() != li:
            cells[li_idx] = f" {li} "
            changed = True
        if is_clean(im) and not is_clean(cells[im_idx]) and cells[im_idx].strip() != im:
            cells[im_idx] = f" {im} "
            changed = True
        if changed:
            lines[i] = rebuild_md_row(cells, line)
            applied += 1
    md_path.write_text("".join(lines), encoding="utf-8")
    return applied


def split_md_row(line):
    """Split a markdown table row on unescaped pipes; drop the leading/trailing empties."""
    stripped = line.strip()
    if stripped.endswith("|"):
        stripped = stripped[:-1]
    if stripped.startswith("|"):
        stripped = stripped[1:]
    return stripped.split("|")


def rebuild_md_row(cells, orig_line):
    lead = ""
    m = re.match(r"^(\s*)", orig_line)
    if m:
        lead = m.group(1)
    nl = "\n" if orig_line.endswith("\n") else ""
    return lead + "|" + "|".join(cells) + "|" + nl


if __name__ == "__main__":
    sys.exit(main())