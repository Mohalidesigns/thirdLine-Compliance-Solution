#!/usr/bin/env python3
"""Offline AI pass: assign every toolkit return a responsible team.

Reads the committed compliance_toolkits.json returns, asks the ISW AI gateway to pick the
single most relevant department (and team) for each return from the fixed tenant org
vocabulary, and writes the department back into the return's ``responsibleUnit`` so every
seeded return carries a canonical team. Resumable via teams.ckpt.json.

Run once; the result is committed into the toolkit seed. No AI runs at seed time.
"""
import json
import os
import sys
import time
import urllib.request
import concurrent.futures as cf
from pathlib import Path

HERE = Path(__file__).resolve().parent
TOOLKIT_JSON = (HERE.parents[1] / "atheris-compliance-backend" / "atheris-compliance" /
                "atheris-compliance-intelligence-backend" / "src" / "main" / "resources" /
                "toolkit" / "compliance_toolkits.json")
CKPT = HERE / "teams.ckpt.json"

GATEWAY = os.environ.get("AI_GATEWAY_URL", "https://ai-gateway.isw.la/v1")
MODEL = os.environ.get("AI_GATEWAY_MODEL", "deepseek-v4.1")
API_KEY = os.environ.get("AI_GATEWAY_KEY")
if not API_KEY:
    sys.exit("Set AI_GATEWAY_KEY (the ISW AI gateway key) before running.")

BATCH = int(os.environ.get("AI_BATCH", "15"))
WORKERS = int(os.environ.get("AI_WORKERS", "5"))
RETRIES = 4
LIMIT = int(os.environ.get("AI_LIMIT", "0"))

SYSTEM = (
    "You are a bank compliance operating-model analyst. You assign the single most relevant "
    "accountable team to each regulatory return using a fixed org structure. You never invent a "
    "department or team outside the supplied vocabulary. Reply with strict JSON only."
)


def build_prompt(vocab, rows):
    dept_lines = [f"- {d['name']}: {', '.join(d['teams'])}" for d in vocab["departments"]]
    items = [
        {"idx": i, "act": r.get("act"), "title": r.get("title"),
         "description": r.get("description"), "frequency": r.get("frequency")}
        for i, r in enumerate(rows)
    ]
    return (
        "ORG STRUCTURE (departments and their teams):\n"
        + "\n".join(dept_lines) + "\n\n"
        "For EVERY regulatory return below, choose the SINGLE most accountable department/team that "
        "prepares and files it.\n\n"
        "Rules:\n"
        "- department MUST be one of the departments above.\n"
        "- team MUST belong to the chosen department (or empty string when none fits).\n"
        "- confidence: 0-100; use <70 when the description is ambiguous.\n\n"
        "Returns:\n"
        + json.dumps(items, ensure_ascii=False)
        + "\n\nReply as strict JSON: {\"items\":[{\"idx\":int,\"department\":str,\"team\":str,"
          "\"confidence\":int,\"reason\":str}]}"
    )


def call_gateway(prompt):
    body = json.dumps({
        "model": MODEL,
        "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": prompt}],
        "temperature": 0,
        "max_tokens": 8000,
        "response_format": {"type": "json_object"},
    }).encode()
    req = urllib.request.Request(
        f"{GATEWAY}/chat/completions",
        data=body,
        headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        out = json.loads(resp.read().decode())
    return out["choices"][0]["message"]["content"]


def parse_items(content):
    content = content.strip()
    if content.startswith("```"):
        content = content.split("```", 2)[1]
        if content.startswith("json"):
            content = content[4:]
    data = json.loads(content)
    if isinstance(data, dict) and "items" in data:
        return data["items"]
    if isinstance(data, list):
        return data
    raise ValueError("unexpected response shape")


def assign_batch(vocab, rows, base):
    prompt = build_prompt(vocab, rows)
    for attempt in range(1, RETRIES + 1):
        try:
            items = parse_items(call_gateway(prompt))
            got = {it["idx"]: it for it in items}
            return [got.get(i) for i in range(len(rows))]
        except Exception as e:  # noqa: BLE001
            wait = 2 ** attempt
            print(f"  batch@{base} attempt {attempt} failed: {type(e).__name__}: {e} (retry in {wait}s)", flush=True)
            time.sleep(wait)
    raise RuntimeError(f"batch@{base} failed after {RETRIES} attempts")


def main():
    vocab = json.load(open(HERE / "vocab.json"))
    doc = json.loads(TOOLKIT_JSON.read_text(encoding="utf-8"))
    rows = doc["returns"]

    def blank(v):
        return v is None or not str(v).strip()

    rows = [r for r in rows if blank(r.get("responsibleUnit")) and blank(r.get("responsiblePerson"))]
    print(f"returns needing a team (no unit and no person): {len(rows)}", flush=True)
    if LIMIT:
        rows = rows[:LIMIT]

    ckpt = {}
    if CKPT.exists():
        ckpt = {int(k): v for k, v in json.loads(CKPT.read_text()).items()}
        print(f"resuming: {len(ckpt)} returns already assigned", flush=True)

    batches = [rows[i:i + BATCH] for i in range(0, len(rows), BATCH)]
    print(f"assigning {len(rows)} returns in {len(batches)} batches (model={MODEL})", flush=True)

    results = [None] * len(rows)
    for i, a in ckpt.items():
        if i < len(results):
            results[i] = a

    pending = [(i * BATCH, b) for i, b in enumerate(batches)
               if any(results[i * BATCH + j] is None for j in range(len(b)))]
    done = len(batches) - len(pending)
    with cf.ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futs = {ex.submit(assign_batch, vocab, b, base): base for base, b in pending}
        for fut in cf.as_completed(futs):
            base = futs[fut]
            for j, it in enumerate(fut.result()):
                results[base + j] = it
                ckpt[base + j] = it
            done += 1
            CKPT.write_text(json.dumps({str(k): v for k, v in ckpt.items()}, ensure_ascii=False))
            print(f"  {done}/{len(batches)} batches done", flush=True)

    valid = {d["name"] for d in vocab["departments"]}
    changed = 0
    for r, a in zip(rows, results):
        dept = (a or {}).get("department")
        if dept in valid:
            r["responsibleUnit"] = dept
            changed += 1
        else:
            print(f"  UNRESOLVED: {r.get('title')!r} -> {a}", flush=True)
    TOOLKIT_JSON.write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"assigned {changed}/{len(rows)} returns; wrote {TOOLKIT_JSON.name}")


if __name__ == "__main__":
    main()
