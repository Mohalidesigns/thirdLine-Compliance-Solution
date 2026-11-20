#!/usr/bin/env python3
"""Gate the Phase-0 ownership output before Phase 2 consumes it.

Checks:
  - every control row has an attribution
  - every department/unit/verifier/role is valid against org_vocab.json
  - unit belongs to its department
  - counts match rows.json
Exits non-zero on any failure.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    vocab = json.load(open(os.path.join(HERE, "org_vocab.json")))
    rows = json.load(open(os.path.join(HERE, "rows.json")))
    own = json.load(open(os.path.join(HERE, "ownership.json")))["controls"]

    depts = {d["name"]: set(d["units"]) for d in vocab["departments"]}
    roles = set(vocab["roleTitles"])
    verifiers = set(vocab["verificationDepartments"])

    errors = []
    if len(own) != len(rows):
        errors.append(f"control count mismatch: ownership={len(own)} rows={len(rows)}")

    for c in own:
        tag = f"{c['sheet']} r{c['row']}"
        d, u = c["accountableDepartment"], c["accountableUnit"]
        if d not in depts:
            errors.append(f"{tag}: unknown department {d!r}")
        elif u not in depts[d]:
            errors.append(f"{tag}: unit {u!r} not under {d!r}")
        if c["verifierDepartment"] not in verifiers:
            errors.append(f"{tag}: unknown verifier {c['verifierDepartment']!r}")
        if c["accountableRoleTitle"] and c["accountableRoleTitle"] not in roles:
            errors.append(f"{tag}: unknown role {c['accountableRoleTitle']!r}")
        if not (0 <= c["confidence"] <= 100):
            errors.append(f"{tag}: bad confidence {c['confidence']}")

    if errors:
        print(f"FAILED ({len(errors)} errors):")
        for e in errors[:50]:
            print("  " + e)
        return 1

    low = sum(1 for c in own if c["confidence"] < 70)
    print(f"OK: {len(own)} controls, all attributes valid; {low} low-confidence for review")
    return 0


if __name__ == "__main__":
    sys.exit(main())