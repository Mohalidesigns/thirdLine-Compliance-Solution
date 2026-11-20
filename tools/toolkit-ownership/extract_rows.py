#!/usr/bin/env python3
"""Extract control-bearing rows + the monitoring-plan tester map from the DRAFT toolkit.

Read-only over the .xlsm (never runs macros, never drives Excel). Reads the raw
sheet XML directly. Emits:
  - rows.json     : one record per control row (primary + additional control)
  - testers.json  : the Compliance Monitoring Plan "Responsible Officer" map keyed by control ID
"""
import json
import os
import re
import sys
import zipfile

XLSM = os.environ.get(
    "TOOLKIT_XLSM", os.path.expanduser("~/Downloads/Compliance Management Toolkits DRAFT.xlsm")
)
OUT_DIR = os.path.dirname(os.path.abspath(__file__))


def load_shared_strings(z):
    data = z.read("xl/sharedStrings.xml").decode("utf-8", "ignore")
    out = []
    for si in re.findall(r"<si>(.*?)</si>", data, re.S):
        parts = re.findall(r"<t[^>]*>(.*?)</t>", si, re.S)
        out.append("".join(parts))
    return out


def resolve(v, ss):
    v = re.sub(r"<[^>]+>", "", v)
    return v


def parse_sheet(z, target, ss):
    data = z.read(target).decode("utf-8", "ignore")
    rows = {}
    for rnum, body in re.findall(r'<row[^>]*r="(\d+)"[^>]*>(.*?)</row>', data, re.S):
        cells = {}
        for ref, inner in re.findall(r'<c[^>]*r="([A-Z]+\d+)"(.*?)(?:</c>|/>)', body, re.S):
            col = re.match(r"([A-Z]+)", ref).group(1)
            t = re.search(r't="([^"]+)"', inner)
            v = re.search(r"<v>(.*?)</v>", inner, re.S)
            if v is None:
                continue
            val = resolve(v.group(1), ss)
            if t and t.group(1) == "s":
                try:
                    val = ss[int(v.group(1))]
                except (ValueError, IndexError):
                    pass
            cells[col] = val
        rows[int(rnum)] = cells
    return rows


def main():
    if not os.path.exists(XLSM):
        sys.exit(f"workbook not found: {XLSM}")
    z = zipfile.ZipFile(XLSM)
    ss = load_shared_strings(z)

    rows = pickle_rows if False else None  # noqa
    import pickle

    rows = pickle.load(open("/tmp/toolkit_rows.pkl", "rb"))

    records = []
    for sheet, sheet_rows in rows.items():
        for r in sheet_rows:
            control = (r.get("control") or "").strip()
            if not control:
                continue
            records.append(
                {
                    "sheet": sheet,
                    "row": r.get("row"),
                    "theme": (r.get("theme") or "").strip(),
                    "act": (r.get("act") or "").strip(),
                    "section": (r.get("section") or "").strip(),
                    "title": (r.get("title") or "").strip(),
                    "responsibility": (r.get("resp") or "").strip(),
                    "control": control,
                    "additionalControl": (r.get("addl") or "").strip(),
                    "additionalResponsibility": (r.get("resp2") or "").strip(),
                }
            )

    monitor = parse_sheet(z, "xl/worksheets/sheet22.xml", ss)
    testers = []
    for rnum in sorted(monitor):
        c = monitor[rnum]
        cid = (c.get("C") or "").strip()
        control_text = (c.get("G") or "").strip()
        officer = (c.get("J") or "").strip()
        area = (c.get("E") or "").strip()
        if not cid or not re.match(r"^[A-Z]{2,8}\d{2,4}$", cid):
            continue
        testers.append(
            {"id": cid, "control": control_text, "area": area, "responsibleOfficer": officer}
        )

    json.dump(records, open(os.path.join(OUT_DIR, "rows.json"), "w"), indent=1, ensure_ascii=False)
    json.dump(testers, open(os.path.join(OUT_DIR, "testers.json"), "w"), indent=1, ensure_ascii=False)

    print(f"wrote {len(records)} control rows -> rows.json")
    print(f"wrote {len(testers)} monitoring-plan rows -> testers.json")
    print("sheets:", {k: sum(1 for r in v if (r.get('control') or '').strip()) for k, v in rows.items()})


if __name__ == "__main__":
    main()