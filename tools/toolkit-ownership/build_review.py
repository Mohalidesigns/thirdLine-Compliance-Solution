#!/usr/bin/env python3
"""Build the Phase-0 review artefacts from attributions.json:

  - ownership.json      : the committable per-control attribution keyed by (sheet, row)
  - testers.json        : the monitoring-plan tester map (already written by extract_rows)
  - review_low_conf.csv : every row with confidence < 70, plus the unmatched/garbage rows
  - spotcheck.csv       : a ~5% random sample across all sheets for human spot-check
  - summary.txt         : counts, department rollup, confidence histogram
"""
import csv
import json
import os
import random

HERE = os.path.dirname(os.path.abspath(__file__))
LOW_CONF = 70
SPOT_PCT = 5


def main():
    rows = json.load(open(os.path.join(HERE, "attributions.json")))

    ownership = []
    low = []
    for r in rows:
        a = r.get("attribution") or {}
        rec = {
            "sheet": r["sheet"],
            "row": r["row"],
            "act": r["act"],
            "section": r["section"],
            "title": r["title"],
            "control": r["control"],
            "additionalControl": r["additionalControl"],
            "responsibilityText": r["responsibility"],
            "additionalResponsibilityText": r["additionalResponsibility"],
            "accountableDepartment": a.get("department"),
            "accountableUnit": a.get("unit"),
            "accountableRoleTitle": a.get("roleTitle") or "",
            "contributors": a.get("contributors") or [],
            "verifierDepartment": a.get("verifierDepartment"),
            "confidence": a.get("confidence", 0),
            "reason": a.get("reason", ""),
        }
        ownership.append(rec)
        if rec["confidence"] < LOW_CONF:
            low.append(rec)

    json.dump(
        {"generatedBy": "tools/toolkit-ownership/classify_controls.py", "controls": ownership},
        open(os.path.join(HERE, "ownership.json"), "w"),
        indent=1,
        ensure_ascii=False,
    )

    cols = [
        "sheet", "row", "act", "section", "title", "control", "additionalControl",
        "responsibilityText", "additionalResponsibilityText", "accountableDepartment",
        "accountableUnit", "accountableRoleTitle", "contributors", "verifierDepartment",
        "confidence", "reason",
    ]
    with open(os.path.join(HERE, "review_low_conf.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for rec in sorted(low, key=lambda x: x["confidence"]):
            w.writerow({**rec, "contributors": "; ".join(rec["contributors"])})

    n = max(1, len(ownership) * SPOT_PCT // 100)
    random.seed(42)
    sample = random.sample(ownership, n)
    with open(os.path.join(HERE, "spotcheck.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for rec in sample:
            w.writerow({**rec, "contributors": "; ".join(rec["contributors"])})

    import collections

    by_dept = collections.Counter(r["accountableDepartment"] for r in ownership)
    conf = [r["confidence"] for r in ownership]
    lines = [
        f"controls attributed : {len(ownership)}",
        f"low-confidence (<{LOW_CONF}) : {len(low)}",
        f"spot-check sample    : {n}",
        f"confidence min/avg/max : {min(conf)}/{round(sum(conf)/len(conf),1)}/{max(conf)}",
        "",
        "by department:",
    ]
    for d, c in by_dept.most_common():
        lines.append(f"  {c:5d}  {d}")
    uniq_roles = sorted({r["accountableRoleTitle"] for r in ownership if r["accountableRoleTitle"]})
    lines += ["", f"distinct accountable role titles: {len(uniq_roles)}"]
    lines += [f"  {t}" for t in uniq_roles]
    open(os.path.join(HERE, "summary.txt"), "w").write("\n".join(lines) + "\n")

    print("\n".join(lines))


if __name__ == "__main__":
    main()