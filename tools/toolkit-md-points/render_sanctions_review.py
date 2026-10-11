#!/usr/bin/env python3
"""
Render `sanctions_review.csv` from the source grid + the LLM parse sidecar.

One row per sanction, for human eyeballing of the DERIVED classification (the pass-through
text is proven unchanged by verify_sanctions.py):

  sn, source, section, offence, penaltyText, penaltyType, parsedPenalties,
  maxAmountNaira, confidence, needsReview

`needsReview` = low confidence, or a cell that clearly looked structured (money/%/imprisonment)
but yielded no penalty items.
"""
from __future__ import annotations

import csv
import json
import re
from pathlib import Path

import sanctions_source as src

HERE = Path(__file__).resolve().parent
PARSED = HERE / "sanctions_parsed.json"
OUT = HERE / "sanctions_review.csv"

STRUCTURED = re.compile(r"[₦]|%|\b(imprison|revoc|suspend|forfeit|arrears)\b|\b\d{4,}", re.I)


def render_items(items):
    out = []
    for it in items or []:
        bits = [it.get("kind", "")]
        if it.get("target"):
            bits.append(it["target"])
        if "amountNaira" in it:
            bits.append(f"₦{it['amountNaira']:,}")
        if "percent" in it:
            bits.append(f"{it['percent']}%")
        if it.get("basis"):
            bits.append(f"of {it['basis']}")
        if it.get("minYears") is not None or it.get("maxYears") is not None:
            bits.append(f"{it.get('minYears','')}-{it.get('maxYears','')}y")
        if it.get("unit"):
            bits.append(it["unit"])
        if it.get("note"):
            bits.append(f"({it['note']})")
        out.append(" ".join(b for b in bits if b))
    return " | ".join(out)


def needs_review(text, entry):
    if not entry:
        return True
    conf = entry.get("confidence")
    if conf is None or conf < 0.7:
        return True
    if not entry.get("penalties") and STRUCTURED.search(text or ""):
        return True
    return False


def main():
    sidecar = json.loads(PARSED.read_text(encoding="utf-8")).get("sanctions", {})
    rows = src.read_rows()
    n_review = 0
    with OUT.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["sn", "source", "section", "offence", "penaltyText", "penaltyType",
                    "parsedPenalties", "maxAmountNaira", "confidence", "needsReview"])
        for r in rows:
            e = sidecar.get(src.natural_key(r))
            nr = needs_review(r["penalty"], e)
            n_review += 1 if nr else 0
            w.writerow([
                r["sn"], r["source"], r["section"], r["offence"], r["penalty"],
                ",".join((e or {}).get("penaltyType") or []),
                render_items((e or {}).get("penalties")),
                (e or {}).get("maxAmountNaira") or "",
                (e or {}).get("confidence") if e and e.get("confidence") is not None else "",
                "Y" if nr else "",
            ])
    print(f"wrote {OUT}  ({len(rows)} rows, {n_review} flagged needsReview)")


if __name__ == "__main__":
    main()
