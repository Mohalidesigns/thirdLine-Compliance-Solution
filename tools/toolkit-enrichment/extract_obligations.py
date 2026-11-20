#!/usr/bin/env python3
"""Flatten the committed toolkit seed into per-obligation rows to enrich.

Reads compliance_toolkits.json and emits obligations.json: one record per obligation row
(sheet + position preserved so enrich.py output can be written back), carrying the row's own
controls (primary/additional) and inherent risk so the AI can split it into requirements and
map each requirement to the control that satisfies it.

Read-only; nothing here touches the app or a database.
"""
import json
import os
import sys

DEFAULT_JSON = (
    "atheris-compliance-backend/atheris-compliance/atheris-compliance-intelligence-backend"
    "/src/main/resources/toolkit/compliance_toolkits.json"
)
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
TOOLKIT_JSON = os.environ.get("TOOLKIT_JSON", os.path.join(ROOT, DEFAULT_JSON))
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "obligations.json")


def norm(s):
    return " ".join((s or "").split()).lower()


def main():
    if not os.path.exists(TOOLKIT_JSON):
        sys.exit(f"toolkit json not found: {TOOLKIT_JSON}")
    doc = json.load(open(TOOLKIT_JSON))
    obligations = doc.get("obligations") or {}

    records = []
    idx = 0
    for sheet, rows in obligations.items():
        for pos, r in enumerate(rows):
            records.append(
                {
                    "idx": idx,
                    "sheet": sheet,
                    "pos": pos,
                    "source": (r.get("source") or "").strip(),
                    "sectionRef": (r.get("sectionRef") or "").strip(),
                    "title": (r.get("title") or "").strip(),
                    "plain": (r.get("plain") or "").strip(),
                    "description": (r.get("description") or "").strip(),
                    "riskDescription": (r.get("riskDescription") or "").strip(),
                    "likelihoodInherent": (r.get("likelihoodInherent") or "").strip(),
                    "impactInherent": (r.get("impactInherent") or "").strip(),
                    "primaryControl": (r.get("primaryControl") or "").strip(),
                    "additionalControl": (r.get("additionalControl") or "").strip(),
                    "key": f"{norm(r.get('source'))}|{norm(r.get('sectionRef'))}|"
                           f"{norm(r.get('title'))}|{norm(r.get('plain'))[:120]}",
                }
            )
            idx += 1

    json.dump(records, open(OUT, "w"), indent=1, ensure_ascii=False)
    with_controls = sum(1 for r in records if r["primaryControl"] or r["additionalControl"])
    print(f"wrote {len(records)} obligation rows -> obligations.json "
          f"({with_controls} carry a control, {len(records) - with_controls} have none)")


if __name__ == "__main__":
    main()
