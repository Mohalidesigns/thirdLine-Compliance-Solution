#!/usr/bin/env python3
"""
Assign a control-test frequency to every control point in compliance_toolkits.json.

Runs ONCE, offline, against the AI gateway (OpenRouter, OpenAI-compatible). It reads
each control point (primaryControlPoints / additionalControlPoints, including nested
children), asks the model for a cadence from {Monthly, Quarterly, Semi-Annual, Annual}
using the control text plus the obligation's risk/theme as context, and writes a
`"frequency"` field onto the point. Idempotent: points that already carry a frequency
are skipped, so re-running only fills gaps.

The tenant later turns the frequency into a due date (today + N days), so no scheduling
logic lives here.

Env (from .env or the shell):
  OPENROUTER_API_KEY   required
  AI_BASE_URL          default https://openrouter.ai/api
  AI_MODEL             default google/gemini-2.5-flash-lite

Usage:
  python3 add_control_frequency.py --dry-run --limit 20
  python3 add_control_frequency.py            # full run, writes the JSON in place
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

TOOLKIT_JSON = Path(__file__).resolve().parents[2] / "atheris-compliance-backend" / "atheris-compliance" / \
    "atheris-compliance-intelligence-backend" / "src" / "main" / "resources" / "toolkit" / "compliance_toolkits.json"

FREQUENCIES = ["Monthly", "Quarterly", "Semi-Annual", "Annual"]

SYSTEM_PROMPT = (
    "You are a banking compliance specialist. For each control, choose the most appropriate "
    "control-testing frequency from exactly this list: Monthly, Quarterly, Semi-Annual, Annual. "
    "Guidance: use Monthly for high-frequency, transactional or high-risk controls (e.g. daily/monthly "
    "reporting, limit checks, reconciliation); Quarterly for periodic governance, reporting and review "
    "controls; Semi-Annual for oversight and monitoring controls; Annual for policy, strategy, training "
    "and framework controls. Reply ONLY with a JSON array of objects "
    "{\"id\": <int>, \"frequency\": <one of the four strings>} — no prose, no markdown."
)


def control_point_risk(row: dict) -> str:
    """A short risk context for the obligation the control belongs to."""
    parts = []
    if row.get("likelihoodInherent") or row.get("impactInherent"):
        parts.append(f"likelihood={row.get('likelihoodInherent') or '?'} impact={row.get('impactInherent') or '?'}")
    if row.get("riskDescription"):
        parts.append(str(row["riskDescription"])[:120])
    return "; ".join(parts)


def collect_items(doc: dict):
    """Yield (id, node, context) for every control point lacking a frequency."""
    obligations = doc.get("obligations") or {}
    items = []

    def walk(points, section, row):
        for cp in points or []:
            if not cp.get("frequency"):
                items.append({
                    "id": len(items),
                    "node": cp,
                    "text": (cp.get("text") or cp.get("content") or "").strip(),
                    "section": section,
                    "obligationType": row.get("obligationType"),
                    "risk": control_point_risk(row),
                })
            walk(cp.get("children"), section, row)

    for section, rows in obligations.items():
        for row in rows or []:
            walk(row.get("primaryControlPoints"), section, row)
            walk(row.get("additionalControlPoints"), section, row)
    return items


def call_gateway(batch, api_key, base_url, model, retries=3):
    """Ask the model for a frequency for each item in the batch."""
    payload_items = [
        {"id": it["id"], "control": it["text"][:400], "area": it["section"],
         "obligationType": it["obligationType"], "risk": it["risk"]}
        for it in batch
    ]
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps(payload_items)},
        ],
        "temperature": 0.1,
    }
    data = json.dumps(body).encode("utf-8")
    url = base_url.rstrip("/") + "/v1/chat/completions"
    req = urllib.request.Request(url, data=data, headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    })
    last_err = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                out = json.loads(resp.read().decode("utf-8"))
            content = out["choices"][0]["message"]["content"]
            return parse_frequencies(content)
        except (urllib.error.HTTPError, urllib.error.URLError, KeyError, ValueError) as e:
            last_err = e
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"gateway call failed after {retries} attempts: {last_err}")


def parse_frequencies(content: str):
    """Tolerate fenced/loose JSON; return {id: frequency}."""
    text = content.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
    start, end = text.find("["), text.rfind("]")
    if start == -1 or end == -1:
        raise ValueError(f"no JSON array in response: {content[:200]}")
    arr = json.loads(text[start:end + 1])
    result = {}
    for row in arr:
        if not isinstance(row, dict):
            continue
        freq = row.get("frequency")
        if freq in FREQUENCIES:
            result[int(row["id"])] = freq
    return result


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true", help="do not write the JSON")
    ap.add_argument("--limit", type=int, default=0, help="only process N control points")
    ap.add_argument("--batch", type=int, default=25, help="items per gateway request")
    args = ap.parse_args()

    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    base_url = os.environ.get("AI_BASE_URL", "https://openrouter.ai/api")
    model = os.environ.get("AI_MODEL", "google/gemini-2.5-flash-lite")
    if not api_key or api_key.startswith("sk-local-placeholder"):
        print("ERROR: set a real OPENROUTER_API_KEY (currently placeholder/unset).", file=sys.stderr)
        sys.exit(2)

    doc = json.loads(TOOLKIT_JSON.read_text(encoding="utf-8"))
    items = collect_items(doc)
    if args.limit:
        items = items[:args.limit]
    print(f"control points needing a frequency: {len(items)}")
    if not items:
        print("nothing to do — all control points already have a frequency.")
        return

    assigned = 0
    for i in range(0, len(items), args.batch):
        batch = items[i:i + args.batch]
        try:
            freq_by_id = call_gateway(batch, api_key, base_url, model)
        except Exception as e:  # noqa: BLE001 — report and continue with the next batch
            print(f"  batch {i // args.batch + 1}: FAILED ({e})", file=sys.stderr)
            continue
        for it in batch:
            freq = freq_by_id.get(it["id"])
            if freq:
                it["node"]["frequency"] = freq
                assigned += 1
        print(f"  batch {i // args.batch + 1}/{(len(items) + args.batch - 1) // args.batch}: "
              f"{len(freq_by_id)}/{len(batch)} assigned")

    print(f"assigned {assigned}/{len(items)}")
    if args.dry_run:
        print("dry-run: JSON not written")
        return
    TOOLKIT_JSON.write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {TOOLKIT_JSON}")


if __name__ == "__main__":
    main()
