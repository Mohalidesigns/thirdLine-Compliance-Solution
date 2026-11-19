#!/usr/bin/env python3
"""
One-off repair for the corporate_governance sheet column shift.

The generator's resolve_columns() resolved the header -> index map with an
"else" branch (risk_desc=6, lik=7, imp=8, owner=9) for sheets that have neither
Theme nor Col0. corporate_governance is the only CRMP sheet with an "Area of
Focus" column at index 1, so every one of those four fields read one column to
the left: owner landed on Impact (Inherent) -> "High"/"Medium"/"Low", and
riskDescription landed on the plain-language text.

The committed compliance_toolkits.json also carries the Phase-2 enrichment
(requirements[]), so it cannot be regenerated with export_json.py --emit.
This script repairs the two affected fields in place from the raw markdown:

  owner           = the "Responsibility" column immediately before "Control" (index 10)
  riskDescription = the "Risk Description" column (index 7)

likelihoodInherent / impactInherent are already correct in the committed JSON.
Rows are aligned by (title, sectionRef).
"""
import json
import re
from pathlib import Path

TOOLKIT_DIR = (Path(__file__).resolve().parents[2] / "atheris-compliance-backend" / "atheris-compliance" /
               "atheris-compliance-intelligence-backend" / "src" / "main" / "resources" / "toolkit")
TOOLKIT_MD = TOOLKIT_DIR / "compliance_toolkits.md"
TOOLKIT_JSON = TOOLKIT_DIR / "compliance_toolkits.json"

SECTION = "corporate_governance"
COL_RISK_DESCRIPTION = 7
COL_OWNER = 10
COL_OWNER_SHIFTED = 11

RISK_WORDS = {"high", "medium", "low", "critical", "very high", "very low"}


def norm_section(raw):
    s = re.sub(r"\s+", "_", raw.lower().strip())
    return re.sub(r"[^a-z0-9_]", "", s)


def section_rows(lines, target):
    cur = None
    rows = []
    for line in lines:
        if line.startswith("## "):
            if cur == target:
                break
            cur = norm_section(line[3:].strip())
            rows = []
        elif cur == target and line.startswith("|"):
            raw = line.split("|")
            while raw and raw[-1] == "":
                raw.pop()
            cells = [c.strip() for c in raw]
            if cells and cells[0] == "":
                cells.pop(0)
            if cells and cells[-1] == "":
                cells.pop()
            rows.append(cells)
    return rows


def get(row, idx):
    if idx < 0 or idx >= len(row):
        return None
    v = row[idx]
    if v is None or v.strip() == "" or v.lower() in ("none", "n/a"):
        return None
    return v


def is_sub_header(row):
    return get(row, 4) is None and get(row, 5) is None and len(row) >= 8 and get(row, 8) is not None


def main():
    lines = TOOLKIT_MD.read_text(encoding="utf-8").splitlines()
    rows = section_rows(lines, SECTION)[1:]
    md_by_key = {}
    for r in rows:
        if is_sub_header(r):
            continue
        md_by_key.setdefault((get(r, 4), get(r, 3)), r)

    doc = json.loads(TOOLKIT_JSON.read_text(encoding="utf-8"))
    jrows = doc["obligations"][SECTION]

    fixed_owner = 0
    fixed_risk = 0
    missing = 0
    for j in jrows:
        md = md_by_key.get((j.get("title"), j.get("sectionRef")))
        if md is None:
            missing += 1
            continue
        owner = get(md, COL_OWNER)
        if owner is not None and owner.lower() in RISK_WORDS:
            owner = get(md, COL_OWNER_SHIFTED)
        risk = get(md, COL_RISK_DESCRIPTION)
        if j.get("owner") != owner:
            j["owner"] = owner
            fixed_owner += 1
        if j.get("riskDescription") != risk:
            j["riskDescription"] = risk
            fixed_risk += 1

    TOOLKIT_JSON.write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"rows={len(jrows)} unmatched={missing} owner_fixed={fixed_owner} risk_description_fixed={fixed_risk}")


if __name__ == "__main__":
    main()
