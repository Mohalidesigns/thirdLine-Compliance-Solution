import json, sys

PATH = sys.argv[1] if len(sys.argv) > 1 else (
    "atheris-compliance-backend/atheris-compliance/"
    "atheris-compliance-intelligence-backend/src/main/resources/toolkit/compliance_toolkits.json"
)

RISK = {"High", "Medium", "Low", "Critical", "Very High", "Very Low"}


def derive_unit(responsibility):
    t = (responsibility or "").lower()
    if "company secretary" in t:
        return "Company Secretary"
    if "governance" in t:
        return "Corporate Governance"
    if "board" in t:
        return "Board"
    if "compliance" in t:
        return "Compliance"
    if "human resource" in t or "hr" in t:
        return "HR"
    if "legal" in t:
        return "Legal"
    if "risk" in t:
        return "Risk Management"
    return "Corporate Governance"


def main():
    with open(PATH) as f:
        doc = json.load(f)
    obligations = doc["obligations"]
    changed = 0
    per_section = {}
    for section, rows in obligations.items():
        for r in rows:
            owner = r.get("owner")
            if owner in RISK:
                new = derive_unit(r.get("responsibility"))
                r["owner"] = new
                changed += 1
                per_section[section] = per_section.get(section, 0) + 1
    with open(PATH, "w") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    print(f"changed {changed} owners; per section: {per_section}")


if __name__ == "__main__":
    main()
