#!/usr/bin/env python3
"""Turn the Compliance Monitoring Plan into a tester catalog.

The plan is a parallel curated monitoring list (7 themes: PCR FRC ESG CASH CYB CAP ABAC),
not a mapping onto the obligation-sheet controls. It contributes two things:
  1. a set of role-holder titles to seed as Owners (the "Responsible Officer" column),
  2. a per-theme proposed tester, used as an initial suggestion where a control's
     area of focus matches and no explicit tester exists.
"""
import html
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))

PREFIX_AREA = {
    "ABAC": "Anti-Bribery & Corruption",
    "CASH": "Cash Management",
    "ESG": "ESG",
    "CYB": "Cybersecurity",
    "CAP": "Capital Market",
    "PCR": "Conduct Risk",
    "FRC": "Financial Reporting",
}

UNIT_WORDS = (
    "department", "unit", "team", "units", "committee", "management", "affairs",
    "operations", "reporting", "governance", "relations", "communication", "communications",
)


def clean(s):
    return html.unescape((s or "").replace("&amp;", "&")).strip()


def is_role_title(officer):
    o = officer.lower()
    if not officer:
        return False
    if "&" in officer:
        return False
    if any(w == o.strip() or o.strip().endswith(w) for w in UNIT_WORDS):
        return False
    return True


def main():
    testers = json.load(open(os.path.join(HERE, "testers.json")))

    role_titles = sorted({clean(t["responsibleOfficer"]) for t in testers if is_role_title(clean(t["responsibleOfficer"]))})

    by_area = {}
    for t in testers:
        pref = "".join(c for c in t["id"] if c.isalpha())
        area = PREFIX_AREA.get(pref, pref)
        officer = clean(t["responsibleOfficer"])
        d = by_area.setdefault(area, {})
        d[officer] = d.get(officer, 0) + 1

    proposed = {}
    for area, d in by_area.items():
        top = sorted(d.items(), key=lambda x: (-x[1], x[0]))
        proposed[area] = {"primary": top[0][0], "counts": dict(top)}

    out = {
        "source": "Compliance Monitoring Plan (sheet22)",
        "planControlCount": len(testers),
        "roleTitles": role_titles,
        "proposedTesterByArea": proposed,
    }
    json.dump(out, open(os.path.join(HERE, "tester_catalog.json"), "w"), indent=1, ensure_ascii=False)

    print(f"role titles: {len(role_titles)}")
    for r in role_titles:
        print(f"  {r}")
    print("\nproposed tester by area:")
    for a, v in proposed.items():
        print(f"  {a:<26} -> {v['primary']}")


if __name__ == "__main__":
    main()