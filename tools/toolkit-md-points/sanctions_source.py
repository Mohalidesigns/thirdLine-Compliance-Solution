#!/usr/bin/env python3
"""
Reader for the source sanctions grid (`sanctions.xlsx`, repo root).

The workbook has one sheet:
  row 1: banner ("SANCTIONS GRID")
  row 2: header  S/N | Compliance Obligation Source | Section | Offence / Obligation |
                 Sanction or Penalty | Implication for Commercial Banks | Responsible Party
  row 3+: data, with `source` only on the first row of each merged group (forward-fill).

Returns one dict per data row. The pass-through columns map 1:1 to the toolkit JSON
sanction fields; only `penalty` gains derived fields downstream.
"""
from __future__ import annotations

import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_XLSX = ROOT / "sanctions.xlsx"

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

# Column index -> field name (0-based, header row is index 1).
COLS = {0: "sn", 1: "source", 2: "section", 3: "offence",
        4: "penalty", 5: "implication", 6: "responsible"}

# Excel field -> toolkit JSON grid field (pass-through, must not change).
PASSTHROUGH_MAP = {
    "source": "regulation",
    "section": "sectionRef",
    "offence": "violation",
    "penalty": "penalty",
    "implication": "riskExplanation",
    "responsible": "liableRoles",
}


def _shared_strings(z: zipfile.ZipFile):
    if "xl/sharedStrings.xml" not in z.namelist():
        return []
    root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    return ["".join(t.text or "" for t in si.iter(f"{NS}t"))
            for si in root.findall(f"{NS}si")]


def _num_fix(raw: str) -> str:
    """Excel stores some section cells as numbers (e.g. `2.3` as 2.2999999999999998).
    Reformat numeric cells cleanly so a source `2.3` reads back as "2.3", not fp noise."""
    try:
        f = float(raw)
    except (TypeError, ValueError):
        return raw
    if f == int(f):
        return str(int(f))
    return repr(round(f, 10))


def _cell_value(c, ss):
    v = c.find(f"{NS}v")
    if v is None:
        istr = c.find(f"{NS}is")
        return "".join(t.text or "" for t in istr.iter(f"{NS}t")) if istr is not None else ""
    if c.get("t") == "s":
        return ss[int(v.text)]
    return _num_fix(v.text or "")


def read_rows(path=DEFAULT_XLSX):
    """All data rows (header + banner skipped), `source` forward-filled."""
    path = Path(path)
    z = zipfile.ZipFile(path)
    ss = _shared_strings(z)
    sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    raw = [[_cell_value(c, ss) for c in r] for r in sheet.iter(f"{NS}row")]
    out = []
    cur_source = ""
    for r in raw[2:]:  # skip banner + header
        r = (r + [""] * 7)[:7]
        row = {COLS[i]: (r[i] or "").strip() for i in COLS}
        if row["source"]:
            cur_source = row["source"]
        row["source"] = cur_source
        if not (row["penalty"] or row["offence"]):
            continue  # fully blank separator row
        out.append(row)
    return out


def natural_key(row) -> str:
    """Stable key independent of DB ids: source | section | offence | penalty text."""
    return "|".join((row.get(k) or "").strip()
                    for k in ("source", "section", "offence", "penalty"))


if __name__ == "__main__":
    rows = read_rows()
    print(f"rows: {len(rows)}")
    for r in rows[:3]:
        print(" ", {k: (v[:50] + "…" if len(v) > 50 else v) for k, v in r.items()})
