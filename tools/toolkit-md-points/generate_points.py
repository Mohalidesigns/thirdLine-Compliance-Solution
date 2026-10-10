#!/usr/bin/env python3
"""
One-time offline points generator for compliance_toolkits.json.

Reads the committed toolkit JSON, asks an LLM (OpenAI-compatible gateway) to split each
obligation into verbatim markers and interpreted points, then cuts the verbatim text out
of the authored description with the Python port of VerbatimMarkerMatcher (see
verbatim_matcher.py). Writes a sidecar `points_generated.json` keyed by a stable natural
key; export_json.py --fill-points merges it into the committed JSON.

After this pass, the JSON already carries `points`, so the importer needs NO LLM at seed
time and no points scheduler.

Usage:
  export AI_GATEWAY_API_KEY=...            # OpenAI-compatible key (never committed)
  python3 generate_points.py \
      --base-url https://ai-gateway.isw.la/v1 \
      --model deepseek-v4.1 \
      --batch-size 15 --concurrency 3 --stagger-ms 300 \
      [--limit 40] [--out points_generated.json]

Pages are written after every batch, so the pass is resumable: re-running skips rows that
already have points in the sidecar.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

import verbatim_matcher as vm

ROOT = Path(__file__).resolve().parents[2]
TOOLKIT_JSON = (ROOT / "atheris-compliance-backend" / "atheris-compliance" /
                "atheris-compliance-intelligence-backend" / "src" / "main" /
                "resources" / "toolkit" / "compliance_toolkits.json")
DEFAULT_OUT = Path(__file__).resolve().parent / "points_generated.json"

PROMPT = """You are a Nigerian financial regulatory compliance expert.
Given a batch of obligations (KEY | Title | Desc | Statement), split each into points.

Return ONLY valid JSON:
{{"obligations":{{"<KEY>":{{"verbatim":[{{"marker":"a","level":1}}],"interpreted":[{{"marker":"1","text":"plain...","level":0}}]}}}}}}

CRITICAL: NEVER hallucinate, NEVER invent, NEVER guess. verbatim = markers/levels ONLY, NEVER text. interpreted = plain English statement only. NEVER invent markers/text not in the input. If the Description has (a)-(d), return 4 verbatim items. If not in the input, return an empty list. Fail-closed. Keys are the exact KEY strings. Include ALL keys. marker without parentheses. level 0 top, 1 sub, 2 sub-sub. No preamble. Pure JSON only.

{batch}
"""


def natural_key(row):
    """Stable key independent of DB ids.

    source | sectionRef | title identifies the obligation, but the toolkit legitimately
    repeats one (source, section, title) with a DIFFERENT interpreted `plain` statement
    (97 such rows). `description` is identical within those groups, so it is safe to add
    `plain` to keep every row distinct and never cross-assign points.
    """
    parts = [row.get("source") or "", row.get("sectionRef") or "",
             row.get("title") or "", row.get("plain") or ""]
    return "|".join(p.strip() for p in parts)


# The model echoes the KEY back but treats "|" as a field separator and drops everything
# after the third field (and some sources embed "|"), so the wire key joins the three
# fields with a visible, non-colliding delimiter that survives the round-trip.
WIRE_SEP = " >> "


def model_key(row):
    """The KEY the model sees and echoes: no `plain`; fields joined by WIRE_SEP."""
    fields = [(row.get(k) or "").strip().replace(">>", ">")
              for k in ("source", "sectionRef", "title")]
    return WIRE_SEP.join(fields)


def load_rows(path):
    doc = json.loads(Path(path).read_text(encoding="utf-8"))
    rows = []
    for section, items in (doc.get("obligations") or {}).items():
        for r in items:
            if r.get("status") != "saved":
                continue
            rows.append(r)
    return doc, rows


def call_model(base_url, model, api_key, batch_text, timeout=180, retries=4):
    url = base_url.rstrip("/") + "/chat/completions"
    body = json.dumps({
        "model": model,
        "temperature": 0,
        "messages": [{"role": "user", "content": PROMPT.format(batch=batch_text)}],
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
            content = payload["choices"][0]["message"]["content"]
            return _extract_json(content)
        except Exception as e:  # noqa: BLE001
            last = e
            if attempt < retries:
                time.sleep(min(30, 2 ** attempt))
    raise RuntimeError(f"model call failed after {retries} attempts: {last}")


def normalize_returned_key(k):
    """The model may echo 'KEY <k>' verbatim (prompt wording) — reduce it to <k>."""
    if k is None:
        return None
    return re.sub(r"^\s*KEY\s+", "", k, flags=re.IGNORECASE).strip()


def get_entry(got, mk):
    """Find the entry for `mk`, tolerating a leading 'KEY ' and case differences."""
    if mk in got:
        return got[mk]
    mk_norm = mk.strip().lower()
    for k, v in got.items():
        if normalize_returned_key(k).strip().lower() == mk_norm:
            return v
    return None


def _extract_json(text):
    """Parse the model's JSON, tolerating ```json fences or surrounding prose."""
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
    """Escape raw control characters (newlines inside strings) that break json.loads."""
    out = []
    in_str = False
    esc = False
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


def build_points(row, llm_entry):
    """Verbatim points cut from the description + interpreted points from the LLM text."""
    points = []
    description = row.get("description")
    plain = row.get("plain")
    for p in (llm_entry.get("verbatim") or []):
        marker = p.get("marker")
        exact = vm.extract_exact_span(description, marker, p.get("level"))
        if exact is None:
            continue
        exact = vm.strip_marker_prefix(exact, marker)
        if not exact:
            continue
        points.append(vm.to_point_map_exact(marker, exact, p.get("level"), p.get("children"), "verbatim"))
    for p in (llm_entry.get("interpreted") or []):
        text = p.get("text")
        marker = p.get("marker")
        if text is None:
            continue
        text = vm.strip_marker_prefix(text, marker)
        if text is None or not text.strip():
            continue
        points.append({
            "marker": marker,
            "text": text,
            "content": text,
            "pointType": "interpreted",
            "level": p.get("level") if p.get("level") is not None else 0,
            "children": [],
        })
    return points


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--json", default=str(TOOLKIT_JSON))
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    ap.add_argument("--base-url", default=os.environ.get("AI_GATEWAY_BASE_URL", "https://ai-gateway.isw.la/v1"))
    ap.add_argument("--model", default=os.environ.get("AI_GATEWAY_MODEL", "deepseek-v4.1"))
    ap.add_argument("--api-key", default=os.environ.get("AI_GATEWAY_API_KEY", ""))
    ap.add_argument("--batch-size", type=int, default=15)
    ap.add_argument("--concurrency", type=int, default=3)
    ap.add_argument("--stagger-ms", type=int, default=300)
    ap.add_argument("--limit", type=int, default=0, help="max rows this run (0 = all)")
    args = ap.parse_args()

    if not args.api_key:
        print("ERROR: set AI_GATEWAY_API_KEY (or pass --api-key)", file=sys.stderr)
        return 2

    out_path = Path(args.out)
    sidecar = {}
    if out_path.exists():
        sidecar = json.loads(out_path.read_text(encoding="utf-8")).get("points", {})
        print(f"Resuming: {len(sidecar)} rows already have points")

    _doc, rows = load_rows(args.json)
    todo = [r for r in rows if natural_key(r) not in sidecar]
    if args.limit and args.limit > 0:
        todo = todo[:args.limit]
    print(f"Obligations: {len(rows)}; to generate: {len(todo)} (batch={args.batch_size}, concurrency={args.concurrency})")
    if not todo:
        print("Nothing to do.")
        return 0

    lock = threading.Lock()
    done = 0
    failed_batches = 0

    def flush():
        out_path.write_text(json.dumps({
            "meta": {"generator": "tools/toolkit-md-points/generate_points.py",
                     "model": args.model, "generatedAt": datetime.now(timezone.utc).isoformat(),
                     "pointsFilled": len(sidecar)},
            "points": sidecar,
        }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    def call_one(mk):
        r = batch_lookup[mk][0]
        line = (f"KEY {mk} | Title: {r.get('title') or ''} | "
                f"Desc: {r.get('description') or ''} | Statement: {r.get('plain') or ''}")
        got = (call_model(args.base_url, args.model, args.api_key, line).get("obligations") or {})
        return get_entry(got, mk)

    def run_batch(batch):
        nonlocal done, failed_batches
        # `batch` maps a wire key to [rows]; a multi-row group means the three-field key
        # is ambiguous and those rows travel alone (same batch, one KEY).
        lines = []
        for mk in batch:
            r = batch[mk][0]
            lines.append(f"KEY {mk} | Title: {r.get('title') or ''} | Desc: {r.get('description') or ''} | Statement: {r.get('plain') or ''}")
        n = sum(len(v) for v in batch.values())
        try:
            got = (call_model(args.base_url, args.model, args.api_key, "\n".join(lines)).get("obligations") or {})
            resolved = {mk: get_entry(got, mk) for mk in batch}
            # Fail-closed: any key the model failed to echo is retried alone.
            for mk in list(batch):
                if resolved.get(mk) is None:
                    try:
                        resolved[mk] = call_one(mk)
                    except Exception as e:  # noqa: BLE001
                        print(f"  (single retry failed for {mk[:50]}: {e})", file=sys.stderr)
            with lock:
                for mk, group in batch.items():
                    entry = resolved.get(mk)
                    for r in group:
                        sidecar[natural_key(r)] = build_points(r, entry) if entry else []
                done += n
                flush()
            missing = [mk for mk in batch if not resolved.get(mk)]
            print(f"  batch ok: +{n} (total {len(sidecar)})" + (f" [missing {len(missing)}]" if missing else ""))
        except Exception as e:  # noqa: BLE001
            failed_batches += 1
            print(f"  batch FAILED ({n} rows): {e}", file=sys.stderr)

    # Group by the three-field model key so a repeated key is sent once; an ambiguous key
    # (more than one row) is sent alone so the model cannot merge the interpreted statements.
    grouped = {}
    for r in todo:
        grouped.setdefault(model_key(r), []).append(r)
    batch_lookup = grouped  # closed over by run_batch/call_one
    batches = []
    cur = {}
    cur_n = 0
    for mk, rows_ in grouped.items():
        if len(rows_) > 1:
            batches.append({mk: rows_})
            continue
        cur[mk] = rows_
        cur_n += 1
        if cur_n >= args.batch_size:
            batches.append(cur); cur = {}; cur_n = 0
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
    print(f"\nDONE. points for {len(sidecar)} rows written to {out_path}. Failed batches: {failed_batches}")
    return 0 if failed_batches == 0 else 1


if __name__ == "__main__":
    sys.exit(main())