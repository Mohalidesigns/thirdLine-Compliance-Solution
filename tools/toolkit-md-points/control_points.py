#!/usr/bin/env python3
"""
Split each CRMP control cell into a clean, ordered list of control points.

Why: the CRMP source packs several distinct controls into one `Primary Control` /
`Additional Control` cell as an inline, often run-together bullet list, e.g.

    "- Payroll system enforces maximum deduction limits.- Written consents required
     for union dues and fund contributions.- Overpayment recovery tracked..."

The importer maps one CRMP row = one control, so the whole list lands as one control's
text. This offline pass asks the AI gateway to split each such cell into its individual
control statements (cleaning the dashes / spacing), and writes the result back into BOTH
compliance_toolkits.json (as `primaryControlPoints` / `additionalControlPoints`, using the
same point shape as obligations) and compliance_toolkits.md (so a re-export stays consistent).

A cell that already holds a single control produces a single point; cells the model cannot
cleanly split are left alone and reported (fail-closed — never invented).

Usage:
  export AI_GATEWAY_API_KEY=...            # OpenAI-compatible key (never committed)
  python3 control_points.py \
      --base-url https://ai-gateway.isw.la/v1 \
      --model deepseek-v4.1

Resumable: results are cached in control_points.json keyed by
section|source|sectionRef|title|field. Re-running only processes cells still missing points.
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
DEFAULT_SIDECAR = HERE / "control_points.json"
REVIEW_CSV = HERE / "control_points_review.csv"

CRMP_SECTIONS = ["conduct_risk", "corporate_governance", "data_protection",
                 "capital_market", "crmp", "esg", "cybersecurity", "consumer_protection",
                 "abac", "amlcft", "actmgt", "cash_mgt"]
FIELDS = ["primaryControl", "additionalControl"]
POINT_FIELD = {"primaryControl": "primaryControlPoints",
               "additionalControl": "additionalControlPoints"}

WIRE_SEP = " >> "

PROMPT = """You are a compliance documentation editor. Each entry below is ONE control cell
from a bank's Compliance Risk Management Plan (CRMP). A cell may contain several DISTINCT
control statements, often pasted together as an inline bullet list (dashes used as
separators, sometimes with no space between items, e.g. "...limits.- Written consents...").

Split each cell into its individual control statements and clean them:
- One control statement per point. Do NOT merge distinct controls; do NOT split a single
  control that merely has sub-clauses.
- Remove the leading bullet/dash and any leading punctuation; trim whitespace.
- Keep the wording faithful — do NOT paraphrase, summarise, add or drop meaning.
- Fix the run-together separator (e.g. "...limits.- Written" -> "...limits." / "Written ...").
- Preserve order as written. If the cell is already a single control, return exactly one point.

Return STRICT JSON, no prose:
{"results":[{"key":"<KEY>","points":["first control statement","second control statement", ...],"confidence":0.0-1.0}]}

Echo each KEY EXACTLY as given.

Cells:
{batch}
"""


def cell_key(section, row, field):
    parts = [section, row.get("source") or "", row.get("sectionRef") or "",
             row.get("title") or "", field]
    return "|".join(p.strip() for p in parts)


def model_key(section, row, field):
    return WIRE_SEP.join([(row.get(k) or "").strip().replace(">>", ">")
                          for k in ("source", "sectionRef", "title")] + [field])


def load_cells(path):
    doc = json.loads(Path(path).read_text(encoding="utf-8"))
    cells = []  # (section, row, field, text)
    for section, items in (doc.get("obligations") or {}).items():
        if section not in CRMP_SECTIONS:
            continue
        for r in items:
            for f in FIELDS:
                t = (r.get(f) or "").strip()
                if t:
                    cells.append((section, r, f, t))
    return doc, cells


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


def entry_line(section, row, field, text):
    return (f"KEY {model_key(section, row, field)}\n"
            f"  Cell: {text}\n")


def to_points(statements):
    """Build the obligation-shaped point list: marker a,b,c...; pointType 'control'."""
    points = []
    for i, stmt in enumerate(statements):
        stmt = stmt.strip()
        if not stmt:
            continue
        marker = chr(ord("a") + i) if i < 26 else str(i + 1)
        points.append({
            "marker": marker,
            "text": stmt,
            "content": stmt,
            "pointType": "control",
            "level": 1,
            "children": [],
        })
    return points


def clean_points(raw):
    """Normalise the model's `points` list: strings only, de-dashed, non-empty, de-duped."""
    out = []
    for p in raw or []:
        if not isinstance(p, str):
            continue
        s = re.sub(r"^[\s\-•*]+", "", p).strip()
        s = re.sub(r"\s+", " ", s)
        if s and s not in out:
            out.append(s)
    return out


def join_statements(statements):
    """The cleaned control text: statements joined into running prose (dashes removed)."""
    parts = []
    for s in statements:
        s = s.strip()
        if not s:
            continue
        if not s.endswith((".", "!", "?", ";", ":")):
            s += "."
        parts.append(s)
    return " ".join(parts)


def _has_todo(json_path, sidecar_path):
    """True when at least one control cell has no baked points yet."""
    done = {}
    sp = Path(sidecar_path)
    if sp.exists():
        done = json.loads(sp.read_text(encoding="utf-8")).get("cells", {})
    _doc, cells = load_cells(json_path)
    return any(cell_key(s, r, f) not in done for (s, r, f, _t) in cells)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--json", default=str(TOOLKIT_JSON))
    ap.add_argument("--sidecar", default=str(DEFAULT_SIDECAR))
    ap.add_argument("--base-url", default=os.environ.get("AI_GATEWAY_BASE_URL", "https://ai-gateway.isw.la/v1"))
    ap.add_argument("--model", default=os.environ.get("AI_GATEWAY_MODEL", "deepseek-v4.1"))
    ap.add_argument("--api-key", default=os.environ.get("AI_GATEWAY_API_KEY", ""))
    ap.add_argument("--batch-size", type=int, default=15)
    ap.add_argument("--concurrency", type=int, default=3)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--apply", action="store_true", help="write points into the JSON")
    args = ap.parse_args()

    if args.api_key:
        pass
    elif _has_todo(args.json, args.sidecar):
        print("ERROR: set AI_GATEWAY_API_KEY (or pass --api-key)", file=sys.stderr)
        return 2

    sidecar_path = Path(args.sidecar)
    done_cells = {}
    if sidecar_path.exists():
        done_cells = json.loads(sidecar_path.read_text(encoding="utf-8")).get("cells", {})
        print(f"Resuming: {len(done_cells)} cells already processed")

    doc, cells = load_cells(args.json)
    todo = [(s, r, f, t) for (s, r, f, t) in cells if cell_key(s, r, f) not in done_cells]
    if args.limit and args.limit > 0:
        todo = todo[:args.limit]
    print(f"Control cells: {len(cells)}; needing points: {len(todo)} "
          f"(batch={args.batch_size}, concurrency={args.concurrency})")

    if todo:
        lock = threading.Lock()

        def flush():
            sidecar_path.write_text(json.dumps({
                "meta": {"generator": "tools/toolkit-md-points/control_points.py",
                         "model": args.model, "generatedAt": datetime.now(timezone.utc).isoformat(),
                         "cells": len(done_cells)},
                "cells": done_cells,
            }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

        batches = [todo[i:i + args.batch_size] for i in range(0, len(todo), args.batch_size)]
        progress = {"done": 0, "failed": 0}

        def run_batch(batch):
            text = "\n".join(entry_line(s, r, f, t) for (s, r, f, t) in batch)
            try:
                payload = call_model(args.base_url, args.model, args.api_key, text)
            except Exception as e:  # noqa: BLE001
                progress["failed"] += 1
                print(f"  ! batch failed ({len(batch)} cells): {e}")
                return
            by_key = {}
            for res in (payload.get("results") or []):
                by_key[(res.get("key") or "").strip()] = res
            with lock:
                for (s, r, f, t) in batch:
                    mk = model_key(s, r, f)
                    res = by_key.get(mk)
                    if not res:
                        for k, v in by_key.items():
                            if k.replace("KEY ", "").strip() == mk:
                                res = v
                                break
                    if not res:
                        continue
                    pts = clean_points(res.get("points"))
                    if not pts:
                        continue
                    done_cells[cell_key(s, r, f)] = {
                        "points": pts,
                        "confidence": res.get("confidence"),
                    }
                progress["done"] += len(batch)
                flush()
                print(f"  batch done: {progress['done']}/{len(todo)} "
                      f"(failed batches: {progress['failed']})")

        with ThreadPoolExecutor(max_workers=args.concurrency) as ex:
            futs = [ex.submit(run_batch, b) for b in batches]
            for _ in as_completed(futs):
                pass

    # ---- apply + report ----
    applied = 0
    multi = 0
    cells_reviewed = 0
    for (s, r, f, t) in cells:
        entry = done_cells.get(cell_key(s, r, f))
        if not entry:
            continue
        pts = to_points(entry["points"])
        cells_reviewed += 1
        if len(pts) > 1:
            multi += 1
        if args.apply:
            r[POINT_FIELD[f]] = pts
            # Clean the control text too: the statements joined into prose, dashes removed.
            r[f] = join_statements([p["content"] for p in pts])
            applied += 1

    if args.apply:
        Path(args.json).write_text(
            json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"WROTE {args.json}: {applied} cells updated")

    # review CSV: multi-point cells are the ones that were split
    with REVIEW_CSV.open("w", encoding="utf-8", newline="") as fh:
        fh.write("section,source,sectionRef,title,field,pointCount,points\n")
        for (s, r, f, t) in cells:
            entry = done_cells.get(cell_key(s, r, f))
            if not entry:
                continue
            pts = entry["points"]
            def q(v):
                v = (v or "").replace('"', '""')
                return f'"{v}"'
            fh.write(",".join([q(s), q(r.get("source")), q(r.get("sectionRef")),
                               q(r.get("title")), q(f), str(len(pts)),
                               q(" | ".join(pts))]) + "\n")
    print(f"Cells processed: {cells_reviewed}; multi-point (split): {multi}")
    print(f"Review CSV: {REVIEW_CSV}")
    return 0


if __name__ == "__main__":
    sys.exit(main())