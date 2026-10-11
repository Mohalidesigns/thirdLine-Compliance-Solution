#!/usr/bin/env python3
"""
Bake the offline penalty parse into the committed toolkit JSON.

Merges `sanctions_parsed.json` (from parse_sanctions.py) into the `sanctions[]` grid rows of
compliance_toolkits.json, matched by natural key (source|sectionRef|violation|penalty), and
adds the derived fields — NEVER touching the pass-through text (verify_sanctions.py proves it):

  penaltyType    ["MONETARY", ...]                         (filter)
  maxAmountNaira largest amount in the penalty (integer Naira), or null   (numeric filter/sort)
  severityScore  1..10 band from the amount, escalated by kind/wording
  liableRoles    prefilled ONLY when the Excel cell is blank, from the offence text
                 (flagged `liableRolesDerived: true` so verify_sanctions.py can allow it)

The itemized per-role list is NOT stored (the verbatim `penalty` text carries the breakdown).

Deterministic, idempotent. Default is PREVIEW; pass --apply to write the JSON.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import sanctions_source as src

ROOT = Path(__file__).resolve().parents[2]
TOOLKIT_JSON = (ROOT / "atheris-compliance-backend" / "atheris-compliance" /
                "atheris-compliance-intelligence-backend" / "src" / "main" /
                "resources" / "toolkit" / "compliance_toolkits.json")
PARSED = Path(__file__).resolve().parent / "sanctions_parsed.json"

ESCALATORS = re.compile(r"revoc|imprison|licen|suspension|withdraw|blacklist|forfeit", re.I)


def amount_band(amount):
    if amount is None:
        return 2
    if amount < 500_000:
        return 3
    if amount < 5_000_000:
        return 4
    if amount < 20_000_000:
        return 6
    if amount < 100_000_000:
        return 7
    if amount < 1_000_000_000:
        return 8
    return 9


def severity(entry, text):
    kinds = set(entry.get("penaltyType") or [])
    score = amount_band(entry.get("maxAmountNaira"))
    if "IMPRISONMENT" in kinds:
        score = max(score, 7)
    if "CRIMINAL" in kinds:
        score = max(score, 8)
    if "LICENCE_ACTION" in kinds:
        score = max(score, 8)
    if "FORFEITURE" in kinds or "RECOVERY" in kinds:
        score = max(score, 6)
    if ESCALATORS.search(text or ""):
        score = min(10, score + 1)
    return score


def _norm(s):
    return re.sub(r"\s+", " ", (s or "")).strip()


# ── Responsible-party prefill for the 16 grid rows whose Excel cell is blank ──
# Every value is read directly from the offence/penalty wording; applied only when the
# source cell is empty and flagged liableRolesDerived so the fidelity check allows it.
def _nse_role(section, violation):
    sec = _norm(section)
    vio = (violation or "").lower()
    if "beneficial ownership" in vio or sec.startswith("Rule 17.13"):
        return "Listed Company / Substantial Shareholder"
    return "Listed Company / Issuer"


def prefill_roles(regulation, section, violation, penalty):
    reg = (regulation or "").lower()
    sec = _norm(section)
    vio = (violation or "").lower()
    if "advance fee fraud" in reg:
        pen = (penalty or "").lower()
        # the (b) rows carry no sectionRef in the Excel — match the sub-clause on wording
        if "director, secretary or other officer" in pen:
            return "Director, Secretary or Other Officer"
        if "director, secretary, employee or other staff" in pen:
            return "Director, Secretary, Employee or Other Staff"
        if "financial institution or corporate body" in pen or sec == "Section 7(2)":
            return "Financial Institution / Corporate Body"
        if sec in ("Section 7(3)",) or "the financial institution commits an offence" in pen:
            return "Financial Institution"
    if "economic and financial crimes" in reg:
        if sec == "14(1)":
            return "Bank / Financial Institution Officer"
        if sec == "32(2)":
            return "Bank Manager / Person in Control"
    if "investment and securities act" in reg and sec == "92(1)":
        return "Public Company"
    if "stock exchange" in reg and sec.lower().startswith("rule"):
        return _nse_role(section, violation)
    return None


def build_lookup(sidecar):
    """(source, section, offence) [normalized] -> list of (penalty_norm, entry).

    The JSON `penalty` text differs from the excel only by newline/space collapse, so the
    natural key cannot be matched exactly — index on the three stable columns instead and
    break ties on the normalized penalty."""
    idx = {}
    for r in src.read_rows():
        e = sidecar.get(src.natural_key(r))
        if e is None:
            continue
        idx.setdefault((_norm(r["source"]), _norm(r["section"]), _norm(r["offence"])), []).append(
            (_norm(r["penalty"]), e))
    return idx


def find_entry(g, idx):
    cands = idx.get((_norm(g.get("regulation")), _norm(g.get("sectionRef")), _norm(g.get("violation"))))
    if not cands:
        return None
    gp = _norm(g.get("penalty"))
    for pen, e in cands:
        if pen == gp:
            return e
    return cands[0][1]


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--json", default=str(TOOLKIT_JSON))
    ap.add_argument("--parsed", default=str(PARSED))
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--sample", type=int, default=4)
    args = ap.parse_args()

    jpath = Path(args.json)
    doc = json.loads(jpath.read_text(encoding="utf-8"))
    sidecar = json.loads(Path(args.parsed).read_text(encoding="utf-8")).get("sanctions", {})
    grid = doc.get("sanctions") or []
    idx = build_lookup(sidecar)

    filled = 0
    missing = 0
    roles_prefilled = 0
    for g in grid:
        entry = find_entry(g, idx)
        if not entry:
            missing += 1
            continue
        g["penaltyType"] = entry.get("penaltyType") or ["QUALITATIVE"]
        g["maxAmountNaira"] = entry.get("maxAmountNaira")
        g["severityScore"] = severity(entry, g.get("penalty") or "")
        # remove fields from earlier iterations / not part of the final shape
        g.pop("penalties", None)
        g.pop("amountNaira", None)
        g.pop("amountPerDay", None)
        # prefill responsible party only where the Excel cell is blank
        if not (g.get("liableRoles") or "").strip():
            roles = prefill_roles(g.get("regulation"), g.get("sectionRef"),
                                  g.get("violation"), g.get("penalty"))
            if roles:
                g["liableRoles"] = roles
                g["liableRolesDerived"] = True
                roles_prefilled += 1
        filled += 1

    print(f"grid rows: {len(grid)} | enriched: {filled} | no sidecar entry: {missing} "
          f"| roles prefilled: {roles_prefilled}")
    sev = {}
    for g in grid:
        if "severityScore" in g:
            sev[g["severityScore"]] = sev.get(g["severityScore"], 0) + 1
    print("severity distribution:", dict(sorted(sev.items())))
    for g in grid[:args.sample]:
        print(f"  [{g.get('severityScore')}] {g.get('penaltyType')} "
              f"max=₦{g.get('maxAmountNaira')}  <= {g.get('penalty','')[:50]}")

    if args.apply:
        jpath.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"\nWROTE {jpath}")
    else:
        print("\n(preview only — pass --apply to write)")


if __name__ == "__main__":
    main()
