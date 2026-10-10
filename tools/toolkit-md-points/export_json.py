#!/usr/bin/env python3
"""
Toolkit markdown -> compliance_toolkits.json generator + parity verifier.

Replicates ToolkitImportService's table parsing and count logic EXACTLY so the
generated JSON preserves DB parity (1541 obligations / 597 sanctions / 139 returns)
without re-reading the raw markdown at import time.

Milestone 1 (this file's current scope): --analyze
  - parse the md into sections (mirrors parseSections)
  - replicate importUniverse free-text sanctions + importCrmp obligation dedup +
    importSanctions + importReturns counting
  - report per-section raw/deduped counts and the duplicate-obligation-rows-with-
    controls cross-tab (drives the design of what must stay in the JSON)

Subsequent milestones: --emit (write compliance_toolkits.json with points: []),
--fill-points (offline LLM points pass).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

TOOLKIT_MD = Path(__file__).resolve().parents[2] / "atheris-compliance-backend" / "atheris-compliance" / \
    "atheris-compliance-intelligence-backend" / "src" / "main" / "resources" / "toolkit" / "compliance_toolkits.md"

TOOLKIT_JSON = TOOLKIT_MD.with_suffix(".json")

CRMP_SECTIONS = ["conduct_risk", "corporate_governance", "data_protection",
                 "capital_market", "crmp", "esg", "cybersecurity", "consumer_protection",
                 "abac", "amlcft", "actmgt", "cash_mgt"]

SECTION_AREA_OF_FOCUS = {
    "conduct_risk": "Conduct Risk",
    "corporate_governance": "Corporate Governance",
    "data_protection": "Data Protection",
    "capital_market": "Capital Market",
    "crmp": "Compliance Risk Management",
    "esg": "ESG",
    "cybersecurity": "Cybersecurity",
    "consumer_protection": "Consumer Protection",
    "abac": "Anti-Bribery & Corruption",
    "amlcft": "AML/CFT",
    "actmgt": "Account Management",
    "cash_mgt": "Cash Management",
}

UNIVERSE = "compliance_universe"
SANCTIONS = "sanctions_and_penalties"
RETURNS = "returns_and_remittance"
CMP = "compliance_monitoring_plan"

# ── TextCleaner stripMarkdown port ──
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


def shorten(s, maxlen):
    if s is None or len(s) <= maxlen:
        return s
    return s[:maxlen]


def normalize(s):
    if s is None:
        return ""
    return re.sub(r"[^a-z0-9]", "", s.lower())


def norm_section_name(raw):
    s = re.sub(r"\s+", "_", raw.lower().strip())
    return re.sub(r"[^a-z0-9_]", "", s)


def get(row, idx, fallback=None):
    if idx < 0 or idx >= len(row):
        return fallback
    v = row[idx]
    if v is None or v.strip() == "" or v.lower() == "none" or v.lower() == "n/a":
        return fallback
    return v


# ── Java ToolkitImportService.extractReference port ──
_REF_RE = re.compile(r"\b[A-Z]{2,6}/DIR/[A-Z/0-9]+", re.IGNORECASE)


def extract_reference(row):
    for cell in row:
        if cell is None or cell.strip() == "":
            continue
        m = _REF_RE.search(cell)
        if m:
            return m.group().strip()
    return None


# ── Section parsing (mirrors parseSections) ──
def parse_sections(lines):
    sections = {}
    current = None
    rows = None
    in_table = False
    for line in lines:
        if line.startswith("## "):
            if current is not None and rows is not None:
                sections[current] = rows
            current = norm_section_name(line[3:].strip())
            rows = []
            in_table = False
        elif current is not None:
            if line.startswith("|"):
                in_table = True
                # Java String.split("\\|") drops trailing empty strings
                raw = line.split("|")
                while raw and raw[-1] == "":
                    raw.pop()
                cells = [c.strip() for c in raw]
                if cells and cells[0] == "":
                    cells.pop(0)
                if cells and cells[-1] == "":
                    cells.pop()
                if cells and not (all(c == "" or re.fullmatch(r"-+", c) for c in cells)):
                    rows.append(cells)
            elif in_table:
                in_table = False
    if current is not None and rows is not None:
        sections[current] = rows
    return sections


def header_index(header):
    idx = {}
    for i, h in enumerate(header):
        idx[normalize(h)] = i  # last wins (duplicate "Responsibility" headers)
    return idx


def col(idx, *candidates):
    for c in candidates:
        if c in idx:
            return idx[c]
    for c in candidates:
        for k, v in idx.items():
            if k.startswith(c):
                return v
    return -1


def is_sub_header(row, c_title, c_desc):
    return (get(row, c_title) is None and get(row, c_desc) is None
            and len(row) >= 8 and get(row, 8, "") != "")


# ── Column resolver shared by importCrmp / importCmpControlsFromSections ──
def resolve_columns(section_rows):
    idx = header_index(section_rows[0])
    col_format = "col0" in idx
    if col_format:
        source = 2
        section = 3
        title = 4
        desc = 5
        plain = 6
    else:
        source = col(idx, "complianceobligationsource", "acts")
        section = col(idx, "section")
        title = col(idx, "title")
        desc = col(idx, "descriptionincludespecificsection", "description")
        plain = col(idx, "translatetoclearandplainlanguagecomplianceobligation")
    type_col = col(idx, "obligationtype")
    deadline = col(idx, "recurringdeadlinetype", "duedate")
    has_theme = "theme" in idx
    if col_format:
        risk_desc = 7
        lik_inh = 8
        imp_inh = 9
        owner = 10
    elif has_theme:
        risk_desc = 7
        lik_inh = 8
        imp_inh = 9
        owner = 10
    else:
        risk_desc = 6
        lik_inh = 7
        imp_inh = 8
        owner = 9
    points = col(idx, "points")
    # controls (importCmpControlsFromSections)
    if col_format:
        c_control = 11
        c_lik_res = 12
        c_imp_res = 13
        c_add = -1
        c_ctrl_owner = -1
    else:
        c_control = col(idx, "control")
        c_lik_res = col(idx, "likelihoodresidual", "residuerisk")
        c_imp_res = col(idx, "impactresidual", "col13", "col12")
        c_add = col(idx, "additionalcontrol")
        c_ctrl_owner = col(idx, "responsibility")
    return {
        "colFormat": col_format, "cSource": source, "cSection": section,
        "cTitle": title, "cDesc": desc, "cPlain": plain, "cType": type_col,
        "cDeadline": deadline, "cRiskDesc": risk_desc, "cLikInh": lik_inh,
        "cImpInh": imp_inh, "cOwner": owner, "cPoints": points,
        "cControl": c_control, "cLikRes": c_lik_res, "cImpRes": c_imp_res,
        "cAdd": c_add, "cCtrlOwner": c_ctrl_owner,
    }


def universe_columns(u_idx):
    return {
        "title": col(u_idx, "complianceobligationsource"),
        "desc": col(u_idx, "objectivesdescription"),
        "issue": col(u_idx, "dateofissue"),
        "comm": col(u_idx, "dateofcommencement"),
        "reg": col(u_idx, "regulatoryenforcementbodyindustrybody"),
        "type": col(u_idx, "typeofregulatoryitem"),
        "nature": col(u_idx, "natureofcomplianceitemcoretopicalpertinentsecondaryorothers", "natureofcomplianceitem"),
        "area": col(u_idx, "areaoffocus"),
        "sanctions": col(u_idx, "sanctionsincludespecificsectionanddetaiilswherenotexplicitlystatedincludenotspecified", "sanctions"),
        "status": col(u_idx, "statuscurrentoutdated", "status"),
        "comment": col(u_idx, "commentonstatus"),
        "link": col(u_idx, "linkofdocument"),
        "risk": col(u_idx, "riskratingwithinthecommercialbankcontext", "riskrating"),
        "riskExp": col(u_idx, "riskratingexplanation"),
        "rel": col(u_idx, "commercialbankrelevance"),
        "context": col(u_idx, "commercialbankcompliancecontext"),
        "app": col(u_idx, "applicabilitytocommercialbanks"),
    }


def build_model(sections):
    """
    Java-faithful transcription of ToolkitImportService into a single model used by
    BOTH --analyze (parity report) and --emit (the JSON). Design decision:
      - Obligation / sanctions / returns / CMP rows are emitted VERBATIM (all rows with a
        source; duplicate rows kept) — the reworked importer keeps the existsBy dedup and
        the single global control-number sequence, so parity is preserved by construction.
      - Universe duplicate-title rows are pre-skipped (Java's existsBySourceTitle skips the
        ENTIRE row including its free-text sanctions).
      - Returns: the markdown header row is NOT emitted (the reworked importer has no header
        to count -> 139, which is the recorded DB value).
    """
    model = {
        "universe": [], "universeSanctions": [],
        "obligations": {s: [] for s in CRMP_SECTIONS},
        "sanctionsGrid": [], "returns": [], "monitoringPlan": [],
        "perSection": {}, "counts": {},
    }

    acts = {}            # normalized name -> act id (fresh-DB semantics)
    next_act_id = 1

    def find_or_create_act(title, regulator_id=None):
        nonlocal next_act_id
        key = normalize(title) if title else ""
        if key and key in acts:
            return acts[key]
        aid = next_act_id
        next_act_id += 1
        if key:
            acts[key] = aid
        return aid

    # ── importUniverse ──
    universe_rows = sections.get(UNIVERSE, [])
    u_idx = header_index(universe_rows[0]) if universe_rows else {}
    uc = universe_columns(u_idx)
    seen_titles = set()
    for r in universe_rows[1:]:
        if is_sub_header(r, uc["title"], uc["desc"]):
            continue
        title = get(r, uc["title"])
        if title is None or title.strip() == "":
            continue
        if title in seen_titles:
            continue
        seen_titles.add(title)
        find_or_create_act(title)
        san = get(r, uc["sanctions"])
        model["universe"].append({
            "title": title,
            "reference": extract_reference(r),
            "description": get(r, uc["desc"]),
            "dateIssued": get(r, uc["issue"]),
            "dateCommencement": get(r, uc["comm"]),
            "regulatoryBody": get(r, uc["reg"]),
            "type": get(r, uc["type"]),
            "nature": get(r, uc["nature"]),
            "areaOfFocus": get(r, uc["area"]),
            "sanctions": san,
            "status": get(r, uc["status"]),
            "commentOnStatus": get(r, uc["comment"]),
            "documentUrl": get(r, uc["link"]),
            "riskRating": get(r, uc["risk"]),
            "riskRatingExplanation": get(r, uc["riskExp"]),
            "commercialBankRelevance": get(r, uc["rel"]),
            "commercialBankComplianceContext": get(r, uc["context"]),
            "applicabilityToCommercialBanks": get(r, uc["app"]),
        })
        if san is not None and not (san.lower() in ("not specified", "notspecified")):
            model["universeSanctions"].append({"regulation": title, "violation": san})

    # ── importCrmp obligations + importCmpControlsFromSections ──
    total_saved = {}
    total_dupes = {s: 0 for s in CRMP_SECTIONS}
    total_no_plain = {s: 0 for s in CRMP_SECTIONS}
    total_obligations = 0
    obligation_keys_seen = set()
    for section_name in CRMP_SECTIONS:
        rows = sections.get(section_name, [])
        if not rows:
            model["perSection"][section_name] = {"rows": 0}
            total_saved[section_name] = 0
            continue
        c = resolve_columns(rows)
        prim_by_status = {"saved": 0, "dup": 0, "no_plain": 0, "no_source": 0}
        add_by_status = {"saved": 0, "dup": 0, "no_plain": 0, "no_source": 0}
        n_plain_ok = n_dup = n_no_plain = n_no_source = 0
        last_source = None
        sin = model["obligations"][section_name]
        for i in range(1, len(rows)):
            r = rows[i]
            if is_sub_header(r, c["cTitle"], c["cDesc"]):
                continue
            source = get(r, c["cSource"])
            if source is None or source.strip() == "":
                source = last_source
            if source is None or source.strip() == "":
                n_no_source += 1
                continue
            last_source = source
            plain = get(r, c["cPlain"])
            if plain is None or plain.strip() == "":
                plain = get(r, c["cDesc"])
            if plain is None or plain.strip() == "":
                n_no_plain += 1
                status = "no_plain"
            else:
                statement = strip_quotes(strip_markdown(plain.strip()))
                section_ref = shorten(get(r, c["cSection"]), 100)
                act_id = find_or_create_act(source)
                key = (act_id, statement, section_ref)
                if section_ref is not None and key in obligation_keys_seen:
                    n_dup += 1
                    status = "dup"
                else:
                    if section_ref is not None:
                        obligation_keys_seen.add(key)
                    n_plain_ok += 1
                    status = "saved"
            sin.append({
                "source": source,
                "sectionRef": get(r, c["cSection"]),
                "title": get(r, c["cTitle"]),
                "description": get(r, c["cDesc"]),
                "plain": get(r, c["cPlain"]),
                "obligationType": get(r, c["cType"]),
                "deadlineType": get(r, c["cDeadline"]),
                "riskDescription": get(r, c["cRiskDesc"]),
                "likelihoodInherent": get(r, c["cLikInh"]),
                "impactInherent": get(r, c["cImpInh"]),
                "owner": get(r, c["cOwner"]),
                "responsibility": get(r, c["cCtrlOwner"]),
                "primaryControl": get(r, c["cControl"]),
                "additionalControl": get(r, c["cAdd"]),
                "residualLikelihood": get(r, c["cLikRes"]),
                "residualImpact": get(r, c["cImpRes"]),
                "status": status,
                "points": [],
            })
            ctrl = get(r, c["cControl"])
            addt = get(r, c["cAdd"])
            if ctrl is not None and ctrl.strip() != "":
                prim_by_status[status] += 1
            if addt is not None and addt.strip() != "":
                add_by_status[status] += 1
        total_saved[section_name] = n_plain_ok
        total_dupes[section_name] = n_dup
        total_no_plain[section_name] = n_no_plain
        total_obligations += n_plain_ok
        model["perSection"][section_name] = {
            "rows": len(rows) - 1,
            "saved": n_plain_ok, "dup": n_dup, "no_plain": n_no_plain, "no_source": n_no_source,
            "primary_controls": prim_by_status,
            "added_controls": add_by_status,
        }

    # ── importSanctions grid (all rows emitted; importer re-dedups) ──
    grid = sections.get(SANCTIONS, [])
    seen_sanctions = set()
    last_reg = None
    grid_saved = 0
    grid_dupes = 0
    for r in grid:
        first = normalize(get(r, 0))
        if first in ("col0", "sn"):
            continue
        reg = get(r, 1)
        if reg is None or reg.strip() == "":
            reg = last_reg
        if reg is None or reg.strip() == "":
            continue
        last_reg = reg
        section = get(r, 2)
        violation = get(r, 3)
        if violation is None or violation.strip() == "":
            continue
        penalty = get(r, 4)
        act_id = find_or_create_act(reg)
        violation_trim = violation.strip()
        key = (act_id, section, violation_trim, penalty)
        is_dup = None not in key and key in seen_sanctions
        if not is_dup and None not in key:
            seen_sanctions.add(key)
        if is_dup:
            grid_dupes += 1
        else:
            grid_saved += 1
        model["sanctionsGrid"].append({
            "regulation": reg,
            "sectionRef": section,
            "violation": violation,
            "penalty": penalty,
            "riskExplanation": get(r, 5),
            "liableRoles": get(r, 6),
        })
    total_sanctions = len(model["universeSanctions"]) + grid_saved

    # ── importReturns (header row excluded from the JSON -> 139) ──
    ret_rows = sections.get(RETURNS, [])
    seen_returns = set()
    return_data = 0
    last_act = None
    for i, r in enumerate(ret_rows):
        if i == 0:
            continue
        act_name = get(r, 1)
        if act_name is None or act_name.strip() == "":
            act_name = last_act
        if act_name is None or act_name.strip() == "":
            continue
        last_act = act_name
        title = get(r, 2)
        if title is None or title.strip() == "":
            continue
        act_id = find_or_create_act(act_name)
        if (title, act_id) in seen_returns:
            continue
        seen_returns.add((title, act_id))
        return_data += 1
        model["returns"].append({
            "act": act_name,
            "title": title,
            "sectionRef": get(r, 3),
            "description": get(r, 4),
            "frequency": get(r, 5),
            "responsibleUnit": get(r, 6),
            "responsiblePerson": get(r, 7),
        })

    # ── importCmpControls ──
    cmp_rows = sections.get(CMP, [])
    current_theme = None
    for r in cmp_rows:
        if len(r) < 6:
            continue
        theme_cell = get(r, 0)
        if theme_cell is not None and theme_cell.strip() != "":
            if theme_cell.strip().lower() == "theme" or (get(r, 1) or "").strip().lower() == "id":
                continue
            current_theme = theme_cell.strip()
        if current_theme is None:
            continue
        control_number = get(r, 1)
        if control_number is None or control_number.strip() == "":
            continue
        control_number = control_number.strip()
        if control_number.lower() == "id":
            continue
        model["monitoringPlan"].append({
            "theme": current_theme,
            "controlNumber": control_number,
            "regulatoryRequirement": get(r, 2),
            "complianceArea": get(r, 3),
            "riskLevel": get(r, 4),
            "complianceControl": get(r, 5),
            "monitoringActivity": get(r, 6),
            "frequency": get(r, 7),
            "responsibleOfficer": get(r, 8),
            "dueDate": get(r, 9),
            "status": get(r, 10),
            "controlEffectivenessMeasure": get(r, 11),
        })

    model["counts"] = {
        "universeInstruments": len(model["universe"]),
        "universeSanctions": len(model["universeSanctions"]),
        "obligationRows": sum(len(v) for v in model["obligations"].values()),
        "obligationRowsSaved": total_obligations,
        "obligationRowsDuplicate": sum(total_dupes.values()),
        "obligationRowsNoPlain": sum(total_no_plain.values()),
        "sanctionsGridRows": len(model["sanctionsGrid"]),
        "sanctionsGridSaved": grid_saved,
        "sanctionsGridDuplicate": grid_dupes,
        "sanctionsTotal": total_sanctions,
        "returns": len(model["returns"]),
        "monitoringPlanRows": len(model["monitoringPlan"]),
    }
    return model


def emit_json(model, out_path):
    doc = {
        "meta": {
            "generator": "tools/toolkit-md-points/export_json.py",
            "generatedFrom": TOOLKIT_MD.name,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            # Rows are emitted verbatim; the importer re-applies the existsBy dedup and the
            # single global control-number sequence (parity preserved by construction).
            "dedupApplied": False,
            "totals": model["counts"],
        },
        "universe": model["universe"],
        "universeSanctions": model["universeSanctions"],
        "obligations": model["obligations"],
        "sanctions": model["sanctionsGrid"],
        "returns": model["returns"],
        "monitoringPlan": model["monitoringPlan"],
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def report(model):
    c = model["counts"]
    print("\n=== PARITY REPORT (fresh-import ground truth: 1541 / 597 / 139) ===")
    print(f"Obligations saved (deduped): {c['obligationRowsSaved']}  (expected 1541)  [JSON rows {c['obligationRows']}]")
    print(f"Sanctions (universe {c['universeSanctions']} + grid saved {c['sanctionsGridSaved']} of {c['sanctionsGridRows']}) = {c['sanctionsTotal']}  (expected 597)")
    print(f"Returns: {c['returns']}  (expected 139)")
    print(f"Universe instruments: {c['universeInstruments']}  | CMP controls: {c['monitoringPlanRows']}")

    print("\n=== PER-SECTION OBLIGATIONS ===")
    hdr = (f"{'section':<22}{'rows':>6}{'saved':>7}{'dup':>5}{'no_plain':>9}{'no_src':>7}"
           f" {'primSaved':>9}{'primDup':>7}{'primNoPlain':>11}{'primNoSrc':>9}"
           f" {'addDup':>6}{'addNoPlain':>10}")
    print(hdr)
    for s in CRMP_SECTIONS:
        p = model["perSection"][s]
        if p["rows"] == 0:
            print(f"{s:<22}{0:>6}{0:>7}{0:>5}{0:>9}{0:>7}")
            continue
        pc, ac = p["primary_controls"], p["added_controls"]
        print(f"{s:<22}{p['rows']:>6}{p['saved']:>7}{p['dup']:>5}{p['no_plain']:>9}{p['no_source']:>7}"
              f" {pc['saved']:>9}{pc['dup']:>7}{pc['no_plain']:>11}{pc['no_source']:>9}"
              f" {ac['dup']:>6}{ac['no_plain']:>10}")

    print("\n=== CONTROLS-ON-SKIPPED-ROWS (control text living on rows that produce no obligation) ===")
    total_prim_on_dup = sum(p["primary_controls"]["dup"] for p in model["perSection"].values())
    total_prim_on_noplain = sum(p["primary_controls"]["no_plain"] for p in model["perSection"].values())
    total_prim_on_nosrc = sum(p["primary_controls"]["no_source"] for p in model["perSection"].values())
    total_add_on_dup = sum(p["added_controls"]["dup"] for p in model["perSection"].values())
    total_add_on_noplain = sum(p["added_controls"]["no_plain"] for p in model["perSection"].values())
    total_add_on_nosrc = sum(p["added_controls"]["no_source"] for p in model["perSection"].values())
    print(f"primary controls on duplicate-obligation rows: {total_prim_on_dup}")
    print(f"primary controls on no-plain rows:            {total_prim_on_noplain}")
    print(f"primary controls on no-source rows:           {total_prim_on_nosrc}")
    print(f"additional controls on duplicate-obligation rows: {total_add_on_dup}")
    print(f"additional controls on no-plain rows:             {total_add_on_noplain}")
    print(f"additional controls on no-source rows:            {total_add_on_nosrc}")

    ok = (c["obligationRowsSaved"] == 1541 and c["sanctionsTotal"] == 597 and c["returns"] == 139)
    print(f"\nPARITY {'OK' if ok else 'MISMATCH'}")
    return ok


def fill_points(out_path, sidecar_path):
    """Merge points from the generate_points.py sidecar into an existing compliance_toolkits.json.

    Keyed by natural key (source | sectionRef | title) so DB ids are never needed. Only rows
    with empty points are filled; existing points are left untouched. Idempotent.
    """
    doc = json.loads(out_path.read_text(encoding="utf-8"))
    sidecar = json.loads(Path(sidecar_path).read_text(encoding="utf-8")).get("points", {})

    def key(row):
        # Must match generate_points.py natural_key exactly (plain disambiguates repeats).
        return "|".join((row.get(k) or "").strip()
                        for k in ("source", "sectionRef", "title", "plain"))

    filled = 0
    missing = 0
    for section, rows in (doc.get("obligations") or {}).items():
        for r in rows:
            if r.get("status") != "saved":
                continue
            if r.get("points"):
                continue
            pts = sidecar.get(key(r))
            if pts is None:
                missing += 1
                continue
            r["points"] = pts
            filled += 1
    doc.setdefault("meta", {}).setdefault("totals", {})["pointsFilled"] = filled
    out_path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Filled points on {filled} rows (sidecar has {len(sidecar)}); saved rows with no sidecar entry: {missing}")
    return filled, missing


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--md", default=str(TOOLKIT_MD))
    ap.add_argument("--out", default=str(TOOLKIT_JSON), help="output path for --emit / target for --fill-points")
    ap.add_argument("--emit", action="store_true", help="write compliance_toolkits.json (default: analyze only)")
    ap.add_argument("--fill-points", metavar="SIDECAR",
                    help="merge points from the generate_points.py sidecar into --out (idempotent)")
    args = ap.parse_args()

    if args.fill_points:
        fill_points(Path(args.out), args.fill_points)
        return 0

    lines = Path(args.md).read_text(encoding="utf-8").splitlines()
    sections = parse_sections(lines)

    print(f"Parsed {len(sections)} sections")
    for k in list(sections):
        print(f"  {k}: {len(sections[k])} rows (header+{len(sections[k])-1 if sections[k] else 0})")

    expected_keys = {UNIVERSE, SANCTIONS, RETURNS, CMP} | set(CRMP_SECTIONS)
    missing = expected_keys - set(sections)
    if missing:
        print(f"!! missing sections: {sorted(missing)}")
        return 1

    model = build_model(sections)

    if args.emit:
        emit_json(model, Path(args.out))
        print(f"\nWROTE {Path(args.out)}")

    ok = report(model)
    return 0 if ok else 2


if __name__ == "__main__":
    sys.exit(main())
