#!/usr/bin/env python3
"""
One-time offline penalty parser for the sanctions grid (`sanctions.xlsx`).

Reads each `Sanction or Penalty` cell and asks an LLM (OpenAI-compatible gateway) to turn
the free text into a structured representation:

  penaltyType : ["MONETARY", "MONETARY_PER_UNIT", ...]     (set of kinds present)
  penalties   : [{kind, target?, amountNaira?, unit?, percent?, basis?, minYears?, maxYears?, note?}]
  confidence  : 0..1

Writes a resumable sidecar `sanctions_parsed.json` keyed by
`source|section|offence|penalty`. `enrich_sanctions.py` merges it into the committed JSON.
No other column is touched here — the pass-through columns are verified separately by
`verify_sanctions.py`.

Usage:
  export AI_GATEWAY_API_KEY=...            # OpenAI-compatible key (never committed)
  python3 parse_sanctions.py \
      --base-url https://ai-gateway.isw.la/v1 \
      --model deepseek-v4.1 \
      --batch-size 12 --concurrency 3 --stagger-ms 300 \
      [--limit 30] [--out sanctions_parsed.json]
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import threading
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

import sanctions_source as src

DEFAULT_OUT = Path(__file__).resolve().parent / "sanctions_parsed.json"

KINDS = ("MONETARY", "MONETARY_PER_UNIT", "MONETARY_PER_DAY", "PERCENTAGE",
         "IMPRISONMENT", "LICENCE_ACTION", "FORFEITURE", "RECOVERY",
         "CRIMINAL", "DISCRETIONARY", "QUALITATIVE")

PROMPT = """You are a Nigerian financial-regulatory compliance expert.
For each sanction (KEY | Section | Offence | Penalty), classify the penalty text into a
structured form. The penalty is often a LIST (per-role amounts) or non-monetary.

Return ONLY valid JSON:
{{"sanctions":{{"<KEY>":{{"penaltyType":["MONETARY"],"penalties":[{{"kind":"MONETARY","target":"MD & ECO","amountNaira":1500000}}],"confidence":0.9}}}}}}

penaltyType = array of one or more kinds from: {kinds}.

penalties = itemised list; each item may use:
  kind (one of the kinds)
  target (role/party, e.g. "MD & ECO","CCO","DMB","customer","staff","Bank") — omit if none
  amountNaira (INTEGER Naira; ₦1.5M->1500000, ₦500k->500000, N250,000->250000, ₦20M->20000000)
  unit (e.g. "per customer","per transaction","per day") — omit for a fixed one-off amount
  percent (number) + basis (text) — for PERCENTAGE (e.g. 50, "annual listing fee")
  minYears/maxYears (numbers) — for IMPRISONMENT
  note (qualifier text, e.g. "≥5x value of crime")

RULES:
- Convert every money figure to plain INTEGER Naira. NEVER invent amounts; omit amountNaira if none.
- "per customer"/"/customer"/"per account"/"per transaction"/"per staff" -> MONETARY_PER_UNIT (set unit).
- "per day"/"each day"/"daily"/"continues" -> MONETARY_PER_DAY.
- "X%" -> PERCENTAGE (percent + basis).
- "N years imprisonment"/"N years in prison" -> IMPRISONMENT (minYears/maxYears).
- revocation/suspension/withdrawal/removal from a register -> LICENCE_ACTION.
- arrears/refund/compensation/recovery of sums -> RECOVERY; asset forfeiture -> FORFEITURE.
- prosecution/criminal offence/court -> CRIMINAL.
- "as determined by CBN"/"appropriate sanctions"/"administrative penalty"/no specific amount -> DISCRETIONARY.
- non-monetary obligation with no penalty stated -> QUALITATIVE.
- "Same as above" -> {{"penaltyType":["DISCRETIONARY"],"penalties":[],"confidence":0.3}}.
- A cell may have several kinds (e.g. money OR imprisonment) — list them all.
- confidence 0..1 for your certainty.
- Include ALL keys and echo each KEY EXACTLY. No preamble. Pure JSON only.

{batch}
"""


def load_rows(path):
    return src.read_rows(path)


def natural_key(row):
    return src.natural_key(row)


WIRE_SEP = " >> "


def model_key(row):
    # Collapse whitespace/newlines in the fields the model must echo: embedded newlines and
    # long multi-line penalties made the model mangle the KEY on the round-trip.
    fields = [re.sub(r"\s+", " ", (row.get(k) or "")).strip().replace(">>", ">")
              for k in ("source", "section", "penalty")]
    return WIRE_SEP.join(fields)


def call_model(base_url, model, api_key, batch_text, timeout=180, retries=4):
    url = base_url.rstrip("/") + "/chat/completions"
    body = json.dumps({
        "model": model,
        "temperature": 0,
        "messages": [{"role": "user", "content": PROMPT.format(kinds=", ".join(KINDS), batch=batch_text)}],
    }).encode("utf-8")
    last = None
    for attempt in range(1, retries + 1):
        req = urllib.request.Request(
            url, data=body,
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            return _extract_json(payload["choices"][0]["message"]["content"])
        except Exception as e:  # noqa: BLE001
            last = e
            if attempt < retries:
                time.sleep(min(30, 2 ** attempt))
    raise RuntimeError(f"model call failed after {retries} attempts: {last}")


def _extract_json(text):
    if text is None:
        raise ValueError("empty completion")
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r"^```[a-zA-Z]*\s*", "", t)
        t = re.sub(r"\s*```$", "", t)
    for candidate in (t, _slice_object(t), _escape_controls(_slice_object(t))):
        if candidate is None:
            continue
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            continue
    raise ValueError("model returned unparseable JSON")


def _slice_object(t):
    start, end = t.find("{"), t.rfind("}")
    return t[start:end + 1] if start >= 0 and end > start else None


def _escape_controls(t):
    out, in_str, esc = [], False, False
    for ch in t:
        if esc:
            out.append(ch); esc = False; continue
        if ch == "\\":
            out.append(ch); esc = True; continue
        if ch == '"':
            in_str = not in_str; out.append(ch); continue
        if in_str and ord(ch) < 0x20:
            out.append("\\n" if ch == "\n" else "\\r" if ch == "\r" else "\\t"
                       if ch == "\t" else "\\u%04x" % ord(ch))
            continue
        out.append(ch)
    return "".join(out)


def get_entry(got, mk):
    if mk in got:
        return got[mk]
    mk_norm = mk.strip().lower()
    for k, v in got.items():
        if re.sub(r"^\s*KEY\s+", "", k, flags=re.IGNORECASE).strip().lower() == mk_norm:
            return v
    return None


def normalize_result(entry):
    """Coerce the model's entry into our canonical shape (defensive)."""
    if not isinstance(entry, dict):
        return None
    kinds = [k for k in (entry.get("penaltyType") or []) if k in KINDS]
    items = []
    for it in (entry.get("penalties") or []):
        if not isinstance(it, dict):
            continue
        kind = it.get("kind")
        if kind not in KINDS:
            continue
        clean = {"kind": kind}
        for k in ("target", "unit", "basis", "note"):
            v = it.get(k)
            if isinstance(v, str) and v.strip():
                clean[k] = v.strip()
        amt = it.get("amountNaira")
        if isinstance(amt, (int, float)):
            clean["amountNaira"] = int(amt)
        elif isinstance(amt, str) and re.fullmatch(r"\d[\d,]*", amt.strip()):
            clean["amountNaira"] = int(amt.strip().replace(",", ""))
        for k in ("percent", "minYears", "maxYears"):
            v = it.get(k)
            if isinstance(v, (int, float)):
                clean[k] = v
        items.append(clean)
    if not kinds:
        kinds = list({i["kind"] for i in items}) or ["QUALITATIVE"]
    conf = entry.get("confidence")
    conf = float(conf) if isinstance(conf, (int, float)) else None
    amounts = [i["amountNaira"] for i in items if "amountNaira" in i]
    return {"penaltyType": kinds, "penalties": items,
            "maxAmountNaira": max(amounts) if amounts else None, "confidence": conf}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--xlsx", default=str(src.DEFAULT_XLSX))
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    ap.add_argument("--base-url", default=os.environ.get("AI_GATEWAY_BASE_URL", "https://ai-gateway.isw.la/v1"))
    ap.add_argument("--model", default=os.environ.get("AI_GATEWAY_MODEL", "deepseek-v4.1"))
    ap.add_argument("--api-key", default=os.environ.get("AI_GATEWAY_API_KEY", ""))
    ap.add_argument("--batch-size", type=int, default=12)
    ap.add_argument("--concurrency", type=int, default=3)
    ap.add_argument("--stagger-ms", type=int, default=300)
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    if not args.api_key:
        print("ERROR: set AI_GATEWAY_API_KEY (or pass --api-key)", file=sys.stderr)
        return 2

    out_path = Path(args.out)
    sidecar = {}
    if out_path.exists():
        sidecar = json.loads(out_path.read_text(encoding="utf-8")).get("sanctions", {})
        print(f"Resuming: {len(sidecar)} rows already parsed")

    rows = load_rows(args.xlsx)
    todo = [r for r in rows if natural_key(r) not in sidecar]
    if args.limit and args.limit > 0:
        todo = todo[:args.limit]
    print(f"Sanctions: {len(rows)}; to parse: {len(todo)} (batch={args.batch_size}, concurrency={args.concurrency})")
    if not todo:
        print("Nothing to do.")
        return 0

    lock = threading.Lock()
    failed = 0

    def flush():
        out_path.write_text(json.dumps({
            "meta": {"generator": "tools/toolkit-md-points/parse_sanctions.py",
                     "model": args.model, "generatedAt": datetime.now(timezone.utc).isoformat(),
                     "rowsParsed": len(sidecar)},
            "sanctions": sidecar,
        }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    def one_line(s):
        return re.sub(r"\s+", " ", (s or "")).strip()

    def line_for(r):
        return (f"KEY {model_key(r)} | Section: {one_line(r.get('section'))} | "
                f"Offence: {one_line(r.get('offence'))} | Penalty: {one_line(r.get('penalty'))}")

    def run_batch(batch):
        nonlocal failed
        lines = [line_for(batch[mk][0]) for mk in batch]
        try:
            got = (call_model(args.base_url, args.model, args.api_key, "\n".join(lines)).get("sanctions") or {})
            resolved = {mk: get_entry(got, mk) for mk in batch}
            for mk in list(batch):
                if resolved.get(mk) is None:
                    try:
                        one = call_model(args.base_url, args.model, args.api_key, line_for(batch[mk][0]))
                        resolved[mk] = get_entry(one.get("sanctions") or {}, mk)
                    except Exception as e:  # noqa: BLE001
                        print(f"  (single retry failed for {mk[:50]}: {e})", file=sys.stderr)
            with lock:
                for mk, group in batch.items():
                    norm = normalize_result(resolved.get(mk))
                    for r in group:
                        sidecar[natural_key(r)] = norm
                flush()
            missing = [mk for mk in batch if resolved.get(mk) is None]
            print(f"  batch ok: +{sum(len(v) for v in batch.values())} (total {len(sidecar)})"
                  + (f" [missing {len(missing)}]" if missing else ""))
        except Exception as e:  # noqa: BLE001
            failed += 1
            print(f"  batch FAILED: {e}", file=sys.stderr)

    grouped = {}
    for r in todo:
        grouped.setdefault(model_key(r), []).append(r)
    batches, cur = [], {}
    for mk, rows_ in grouped.items():
        cur[mk] = rows_
        if len(cur) >= args.batch_size:
            batches.append(cur); cur = {}
    if cur:
        batches.append(cur)

    with ThreadPoolExecutor(max_workers=args.concurrency) as ex:
        futures = []
        for b in batches:
            futures.append(ex.submit(run_batch, b))
            time.sleep(args.stagger_ms / 1000.0)
        for f in futures:
            f.result()

    flush()
    print(f"\nDONE. parsed {len(sidecar)} rows -> {out_path}. Failed batches: {failed}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
