#!/usr/bin/env python3
"""
Assign a stable, human-readable reference number to each toolkit instrument.

Why: the toolkit source's Reference column is empty for almost every row (only 1 of 363
has a real regulator reference). The instruments register shows a monospace "Reference No"
that is therefore blank for every seeded instrument. This offline pass fills the gap with a
deterministic `TKL-0001`-style code so the register is readable and stable across reseeds.

Rules:
  - Only the compliant universe documents are given a generated code (the auto-generated
    act stubs are intentionally left alone).
  - A row that already has a real regulator reference (e.g. BSD/DIR/GEN/LAB/08/016) is
    NEVER overwritten.
  - The code is the row's 1-based position in the universe array -> `TKL-%04d`, so it is
    deterministic and stays stable across re-imports (the universe order is fixed).

Idempotent: re-running only fills empty references. Default is PREVIEW; pass --apply to write.

After a future `export_json.py --emit` (which re-reads the md and clears the generated
codes), re-run this with --apply.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
TOOLKIT_JSON = (HERE.parents[1] / "atheris-compliance-backend" / "atheris-compliance" /
                "atheris-compliance-intelligence-backend" / "src" / "main" /
                "resources" / "toolkit" / "compliance_toolkits.json")

PREFIX = "TKL"


def reference_for(position: int) -> str:
    return f"{PREFIX}-{position:04d}"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--json", default=str(TOOLKIT_JSON))
    ap.add_argument("--apply", action="store_true", help="write the generated references into the JSON")
    ap.add_argument("--sample", type=int, default=6)
    args = ap.parse_args()

    path = Path(args.json)
    doc = json.loads(path.read_text(encoding="utf-8"))
    universe = doc.get("universe") or []

    assigned, kept = 0, 0
    samples = []
    for i, row in enumerate(universe, start=1):
        current = (row.get("reference") or "").strip()
        if current:
            kept += 1
            continue
        ref = reference_for(i)
        if args.apply:
            row["reference"] = ref
        assigned += 1
        if len(samples) < args.sample:
            samples.append((ref, (row.get("title") or "")[:60]))

    print(f"Universe rows: {len(universe)} | would assign: {assigned} | kept existing: {kept}")
    for ref, title in samples:
        print(f"  {ref}  {title}")

    if args.apply:
        path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"WROTE {path}")
    else:
        print("(preview only — pass --apply to write)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
