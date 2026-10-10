#!/usr/bin/env python3
"""
Independent verifier for compliance_toolkits.json.

Re-derives the dedup Java will apply (existsBy natural keys, Hibernate '= NULL'
never-matches semantics) from the VERBATIM JSON rows and asserts it reproduces the
recorded fresh-import ground truth:

    obligations 1541 (of 1648 emitted rows)
    sanctions    597  (= 246 universe + 351 grid, of 355 grid rows)
    returns      139
    universe     363 instruments
    CMP          192 controls

Run:  python3 verify_json.py [path/to/compliance_toolkits.json]
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

DEFAULT_JSON = Path(__file__).resolve().parents[2] / "atheris-compliance-backend" / "atheris-compliance" / \
    "atheris-compliance-intelligence-backend" / "src" / "main" / "resources" / "toolkit" / "compliance_toolkits.json"

EXPECTED = {
    "obligationRows": 1648,
    "obligationRowsSaved": 1541,
    "universeInstruments": 363,
    "universeSanctions": 246,
    "sanctionsGridRows": 355,
    "sanctionsGridSaved": 351,
    "sanctionsGridDuplicate": 4,
    "sanctionsTotal": 597,
    "returns": 139,
    "monitoringPlanRows": 192,
}


def normalize(s):
    if s is None:
        return ""
    return re.sub(r"[^a-z0-9]", "", s.lower())


def strip_markdown(text):
    if text is None:
        return None
    out = text
    out = re.sub(r"\*\*(.+?)\*\*", r"\1", out)
    out = re.sub(r"(?m)^\s*[*+-]\s+", "", out)
    out = re.sub(r"(?m)^\s{1,3}\d+\.\s+", "", out)
    out = re.sub(r"(?m)^\s*#{1,6}\s+", "", out)
    out = out.replace("`", "")
    out = re.sub(r"\*", "", out)
    out = re.sub(r"\s+", " ", out).strip()
    return out


def strip_quotes(s):
    if s is None or len(s) < 2:
        return s
    if s.startswith('"') and s.endswith('"'):
        return s[1:-1]
    return s


def main():
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_JSON
    if not path.exists():
        print(f"!! file not found: {path}")
        return 1
    d = json.load(open(path, encoding="utf-8"))

    totals = d["meta"]["totals"]
    failures = []

    # ── meta header counts must match what the JSON actually contains ──
    actual = {
        "obligationRows": sum(len(v) for v in d["obligations"].values()),
        "universeInstruments": len(d["universe"]),
        "universeSanctions": len(d["universeSanctions"]),
        "sanctionsGridRows": len(d["sanctions"]),
        "returns": len(d["returns"]),
        "monitoringPlanRows": len(d["monitoringPlan"]),
    }
    for k, v in actual.items():
        if totals[k] != v:
            failures.append(f"meta.totals[{k}]={totals[k]} != actual {v}")

    # ── obligations: apply Java's existsBy dedup on verbatim rows ──
    # Java dedup key: (act_id, statement, section_ref) where act_id is per-normalized-title,
    # statement = stripQuotes(stripMarkdown(plain)) — plain pre-deduped as the description
    # fallback and already-translated rows. Hibernate '= NULL' never matches: a NULL
    # section_ref therefore never dedups (it can neither match nor be stored in the set).
    acts = {}
    next_act = 1
    seen = set()
    saved = 0
    no_plain = 0
    dup = 0
    for section_rows in d["obligations"].values():
        for r in section_rows:
            status = r["status"]
            if status == "no_plain":
                no_plain += 1
                continue
            if status == "dup":
                dup += 1
                continue
            title = normalize(r["source"]) if r.get("source") else ""
            if title not in acts:
                acts[title] = next_act
                next_act += 1
            act_id = acts[title]
            plain = r.get("plain") or r.get("description")
            statement = strip_quotes(strip_markdown((plain or "").strip()))
            section_ref = r.get("sectionRef")
            key = (act_id, statement, section_ref)
            if section_ref is not None and key in seen:
                dup += 1
            else:
                if section_ref is not None:
                    seen.add(key)
                saved += 1
    if saved != EXPECTED["obligationRowsSaved"]:
        failures.append(f"re-derived obligations saved={saved} expected {EXPECTED['obligationRowsSaved']}")
    if saved + dup + no_plain != actual["obligationRows"]:
        failures.append("obligation status buckets do not add up to emitted rows")

    # ── sanctions: 597 = 246 universe (verbatim) + 351 grid (re-derived dedup) ──
    # Java semantics: a key component that is NULL never matches (Hibernate '= NULL'
    # is never true) and is never stored — such rows are saved but never deduped.
    grid_seen = set()
    grid_saved = 0
    dup = 0
    for r in d["sanctions"]:
        act_key = normalize(r["regulation"]) if r.get("regulation") else ""
        if act_key not in acts:
            acts[act_key] = next_act
            next_act += 1
        act_id = acts[act_key]
        key = (act_id, r.get("sectionRef"), r["violation"].strip(), r.get("penalty"))
        is_dup = None not in key and key in grid_seen
        if not is_dup and None not in key:
            grid_seen.add(key)
        if is_dup:
            dup += 1
        else:
            grid_saved += 1
    if dup != EXPECTED["sanctionsGridDuplicate"]:
        failures.append(f"re-derived grid sanctions dup={dup} expected {EXPECTED['sanctionsGridDuplicate']}")
    sanctions_total = len(d["universeSanctions"]) + grid_saved
    if grid_saved != EXPECTED["sanctionsGridSaved"]:
        failures.append(f"re-derived grid sanctions saved={grid_saved} expected {EXPECTED['sanctionsGridSaved']}")
    if sanctions_total != EXPECTED["sanctionsTotal"]:
        failures.append(f"sanctions total={sanctions_total} expected {EXPECTED['sanctionsTotal']}")

    # ── returns: just the count (JSON is already deduped by generator) ──
    if len(d["returns"]) != EXPECTED["returns"]:
        failures.append(f"returns={len(d['returns'])} expected {EXPECTED['returns']}")

    # ── points presence: every saved obligation whose description has a real list marker
    #    must carry at least one verbatim point, and no point may have empty text. ──
    points_filled = 0
    saved_with_marker = 0
    saved_missing_points = 0
    empty_text = 0
    for section_rows in d["obligations"].values():
        for r in section_rows:
            if r.get("status") != "saved":
                continue
            pts = r.get("points") or []
            if pts:
                points_filled += 1
            for p in pts:
                if not (p.get("text") or "").strip():
                    empty_text += 1
            desc = r.get("description")
            if desc and _has_real_marker(desc):
                saved_with_marker += 1
                if not pts:
                    saved_missing_points += 1
    if empty_text:
        failures.append(f"{empty_text} points have empty text")
    if saved_missing_points:
        failures.append(f"{saved_missing_points} saved obligations with a real marker have no points "
                        f"(of {saved_with_marker} such rows)")

    if failures:
        print("VERIFY FAILED:")
        for f in failures:
            print("  -", f)
        return 2
    print("VERIFY OK — JSON reproduces fresh-import parity "
          f"({saved} obligations / {sanctions_total} sanctions / {len(d['returns'])} returns / "
          f"{actual['universeInstruments']} universe / {actual['monitoringPlanRows']} CMP); "
          f"points on {points_filled} rows "
          f"({saved_with_marker} rows have a real verbatim marker)")
    return 0


def _has_real_marker(text):
    """True when `text` contains at least one real list marker (not a cross-reference)."""
    import verbatim_matcher as vm
    m = vm.ANY_MARKER.search(text, 0)
    pos = 0
    while m:
        cand = m.group(1) if m.group(1) is not None else (m.group(2) if m.group(2) is not None else m.group(3))
        if vm.is_plausible(cand) and not vm._is_cross_reference(text, m.start(), m.group(1) is not None):
            return True
        pos = m.start() + 1
        m = vm.ANY_MARKER.search(text, pos)
    return False


if __name__ == "__main__":
    sys.exit(main())
