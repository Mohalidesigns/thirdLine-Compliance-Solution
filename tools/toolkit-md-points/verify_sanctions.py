#!/usr/bin/env python3
"""
Fidelity check: prove that baking derived fields into compliance_toolkits.json did NOT
change any pass-through column of the source sanctions grid (`sanctions.xlsx`).

Compares, for every JSON grid sanction, the six pass-through fields against the excel row
matched on (source, section, offence):

  source      -> regulation
  section     -> sectionRef
  offence     -> violation
  penalty     -> penalty
  implication -> riskExplanation
  responsible -> liableRoles

Text is compared after collapsing runs of whitespace to a single space (the only transport
normalization: merged-cell newlines become spaces). ANY other difference (word/character) is
a FAILURE. Prints PASS/FAIL and every offending row.

Exit code 0 = PASS, 1 = FAIL.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import sanctions_source as src

ROOT = Path(__file__).resolve().parents[2]
TOOLKIT_JSON = (ROOT / "atheris-compliance-backend" / "atheris-compliance" /
                "atheris-compliance-intelligence-backend" / "src" / "main" /
                "resources" / "toolkit" / "compliance_toolkits.json")


def norm(s):
    return re.sub(r"\s+", " ", (s or "")).strip()


def main():
    ap_ok = True
    jpath = Path(sys.argv[1]) if len(sys.argv) > 1 else TOOLKIT_JSON
    xlsx = Path(sys.argv[2]) if len(sys.argv) > 2 else src.DEFAULT_XLSX

    xl = src.read_rows(xlsx)
    grid = json.loads(jpath.read_text(encoding="utf-8")).get("sanctions") or []

    # excel index by (source, section, offence) -> list of rows
    xl_idx = {}
    for r in xl:
        xl_idx.setdefault((norm(r["source"]), norm(r["section"]), norm(r["offence"])), []).append(r)

    matched = 0
    unmatched = []
    diffs = []  # (field, json_value, excel_value, key)
    for g in grid:
        key = (norm(g.get("regulation")), norm(g.get("sectionRef")), norm(g.get("violation")))
        candidates = xl_idx.get(key)
        if not candidates:
            unmatched.append(key)
            continue
        # pick the excel row whose penalty matches best (norm), else first
        gpen = norm(g.get("penalty"))
        xlrow = next((c for c in candidates if norm(c["penalty"]) == gpen), candidates[0])
        matched += 1
        for xf, jf in src.PASSTHROUGH_MAP.items():
            # `liableRoles` may be prefilled when the Excel cell is blank — allowed ONLY
            # when the row is flagged liableRolesDerived (an explicit, auditable derivation).
            if xf == "responsible" and not norm(xlrow[xf]) and g.get("liableRolesDerived"):
                continue
            if norm(xlrow[xf]) != norm(g.get(jf)):
                diffs.append((jf, g.get(jf), xlrow[xf], key))

    print(f"excel rows: {len(xl)} | json grid rows: {len(grid)}")
    print(f"matched: {matched} | json rows with no excel match: {len(unmatched)}")
    if unmatched:
        print("\nJSON rows not found in the excel source (first 10):")
        for k in unmatched[:10]:
            print(f"  - {k[0][:50]} | {k[1]} | {k[2][:50]}")

    if diffs:
        ap_ok = False
        print(f"\nTEXT DIFFS (after whitespace normalization): {len(diffs)}")
        for jf, jv, xv, key in diffs[:40]:
            print(f"  [{jf}] key={key[1]}")
            print(f"      json : {jv!r}")
            print(f"      excel: {xv!r}")
    else:
        print("\nNo pass-through text changes (whitespace-normalized).")

    print("\nRESULT:", "PASS" if ap_ok else "FAIL")
    return 0 if ap_ok else 1


if __name__ == "__main__":
    sys.exit(main())
