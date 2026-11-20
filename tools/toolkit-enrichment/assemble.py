#!/usr/bin/env python3
"""Assemble the enrichment into review artefacts and the enriched toolkit seed.

Reads obligations.json + enrichment.json + risk_taxonomy.json and writes:
  - requirements.json  : per obligation, its requirements with risk + mapped controls
  - risks.json         : the risk catalogue with the obligations/controls attached
  - coverage.csv       : QA — per obligation, requirement count, uncovered count, confidence
  - compliance_toolkits.enriched.json : the toolkit seed with `risks` + per-row `requirements`

Nothing is applied to the app; a human reviews coverage.csv before the seed is swapped in.
"""
import csv
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
DEFAULT_JSON = (
    "atheris-compliance-backend/atheris-compliance/atheris-compliance-intelligence-backend"
    "/src/main/resources/toolkit/compliance_toolkits.json"
)
TOOLKIT_JSON = os.environ.get("TOOLKIT_JSON", os.path.join(ROOT, DEFAULT_JSON))
VALID_CONTROLS = {"primary", "additional"}


def norm(s):
    return " ".join((s or "").split()).lower()


def map_controls(returned, row):
    """Accept ['primary'/'additional'] tokens, or control TEXT that matches a row control."""
    primary = row.get("primaryControl") or ""
    additional = row.get("additionalControl") or ""
    out = set()
    pn, an = norm(primary), norm(additional)
    for c in returned or []:
        token = norm(c)
        if token in ("primary", "additional"):
            out.add(token)
        elif pn and (token == pn or token in pn or pn in token):
            out.add("primary")
        elif an and (token == an or token in an or an in token):
            out.add("additional")
    return [c for c in ("primary", "additional") if c in out]


def main():
    obligations = json.load(open(os.path.join(HERE, "obligations.json")))
    enrichment = json.load(open(os.path.join(HERE, "enrichment.json")))
    taxonomy = json.load(open(os.path.join(HERE, "risk_taxonomy.json")))["risks"]
    tax_by_code = {r["code"]: r for r in taxonomy}

    requirements = {}
    risks = {r["code"]: {**r, "obligations": [], "controls": []} for r in taxonomy}
    coverage = []
    total_reqs = total_uncovered = bad_code = 0

    for o in obligations:
        e = enrichment.get(str(o["idx"])) or {}
        reqs = []
        ordinal = 0
        for r in (e.get("requirements") or []):
            text = (r.get("text") or "").strip()
            if not text:
                continue
            code = r.get("riskCode")
            if code not in tax_by_code:
                bad_code += 1
                code = "RC-01"
            controls = map_controls(r.get("controls"), o)
            reqs.append({"ordinal": ordinal, "text": text, "riskCode": code, "controls": controls})
            ordinal += 1
            total_reqs += 1
            if not controls:
                total_uncovered += 1
            risks[code]["obligations"].append(o["key"])
            for c in controls:
                risks[code]["controls"].append(
                    o["primaryControl"] if c == "primary" else o["additionalControl"])

        requirements[o["key"]] = {
            "idx": o["idx"], "act": o["source"], "section": o["sectionRef"],
            "title": o["title"], "requirements": reqs,
            "confidence": (e.get("confidence") if e else None),
        }
        coverage.append({
            "idx": o["idx"], "act": o["source"], "section": o["sectionRef"], "title": o["title"],
            "requirements": len(reqs), "uncovered": sum(1 for r in reqs if not r["controls"]),
            "confidence": (e.get("confidence") if e else ""),
            "hasRowControls": bool(o["primaryControl"] or o["additionalControl"]),
        })

    # dedup risk membership
    for code, r in risks.items():
        r["obligations"] = sorted(set(r["obligations"]))
        r["controls"] = sorted(set(r["controls"]))

    json.dump(requirements, open(os.path.join(HERE, "requirements.json"), "w"), indent=1, ensure_ascii=False)
    json.dump({"risks": list(risks.values())}, open(os.path.join(HERE, "risks.json"), "w"), indent=1, ensure_ascii=False)

    with open(os.path.join(HERE, "coverage.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(coverage[0].keys()))
        w.writeheader()
        w.writerows(coverage)

    # enriched toolkit seed: add risks[] + per-row requirements[]
    doc = json.load(open(TOOLKIT_JSON))
    by_key = {}
    for o in obligations:
        by_key.setdefault(o["key"], o)
    for sheet, rowlist in (doc.get("obligations") or {}).items():
        for r in rowlist:
            import re
            k = "|".join([
                " ".join((r.get("source") or "").split()).lower(),
                " ".join((r.get("sectionRef") or "").split()).lower(),
                " ".join((r.get("title") or "").split()).lower(),
                " ".join((r.get("plain") or "").split()).lower()[:120],
            ])
            o = by_key.get(k)
            if o is not None:
                reqs = requirements[o["key"]]["requirements"]
                r["requirements"] = [{"ordinal": x["ordinal"], "text": x["text"],
                                      "riskCode": x["riskCode"], "controls": x["controls"]} for x in reqs]
    doc["risks"] = [
        {"code": r["code"], "name": r["name"], "type": r["type"], "area": r["area"]}
        for r in taxonomy
    ]
    doc.setdefault("meta", {})["enrichment"] = {
        "generator": "tools/toolkit-enrichment",
        "model": os.environ.get("AI_GATEWAY_MODEL", "deepseek-v4.1"),
        "totalRequirements": total_reqs,
        "uncoveredRequirements": total_uncovered,
        "risksInTaxonomy": len(taxonomy),
        "risksUsed": sum(1 for r in risks.values() if r["obligations"]),
    }
    json.dump(doc, open(os.path.join(HERE, "compliance_toolkits.enriched.json"), "w"), indent=1, ensure_ascii=False)

    print(f"requirements.json: {len(requirements)} obligations, {total_reqs} requirements "
          f"({total_uncovered} uncovered)")
    print(f"risks.json: {len(taxonomy)} risks, {sum(1 for r in risks.values() if r['obligations'])} used")
    if bad_code:
        print(f"WARNING: {bad_code} requirements had an out-of-taxonomy risk code (defaulted to RC-01)")
    print("wrote coverage.csv + compliance_toolkits.enriched.json")


if __name__ == "__main__":
    main()