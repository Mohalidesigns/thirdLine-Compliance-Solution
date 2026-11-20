#!/usr/bin/env python3
"""One-off AI pass: split each toolkit obligation into requirements and map them.

For every obligation row, ask the gateway to (a) split the obligation into 1..N distinct
enforceable REQUIREMENTS (duties), (b) tag each requirement with a risk code from the curated
taxonomy, and (c) say which of the row's own controls (primary / additional) satisfy it.

Reads obligations.json + risk_taxonomy.json, writes enrichment.json (per-idx, per row).
Resumable via enrichment.ckpt.json; a batch retries 4x with backoff.
"""
import concurrent.futures as cf
import json
import os
import sys
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
GATEWAY = os.environ.get("AI_GATEWAY_URL", "https://ai-gateway.isw.la/v1")
API_KEY = os.environ.get("AI_GATEWAY_KEY")
MODEL = os.environ.get("AI_GATEWAY_MODEL", "deepseek-v4.1")
BATCH = int(os.environ.get("AI_BATCH", "8"))
WORKERS = int(os.environ.get("AI_WORKERS", "5"))
LIMIT = int(os.environ.get("AI_LIMIT", "0"))
RETRIES = 4
if not API_KEY:
    sys.exit("Set AI_GATEWAY_KEY (the ISW AI gateway key) before running.")

SYSTEM = (
    "You are a bank regulatory-compliance analyst. You break a regulatory obligation into its "
    "distinct enforceable REQUIREMENTS (the individual duties a bank must perform), assign each a "
    "risk code from a fixed taxonomy, and say which of the obligation's given controls satisfy it. "
    "You never invent risk codes outside the taxonomy. You reply with strict JSON only."
)


def build_prompt(taxonomy, rows):
    tax = "\n".join(f"- {r['code']}: {r['name']} ({r['type']}, {r['area']})" for r in taxonomy)
    items = []
    for i, r in enumerate(rows):
        items.append({
            "idx": i,
            "act": r["source"],
            "section": r["sectionRef"],
            "title": r["title"],
            "obligation": r["plain"] or r["description"],
            "primaryControl": r["primaryControl"],
            "additionalControl": r["additionalControl"],
        })
    return (
        "RISK TAXONOMY (use exactly one `riskCode` per requirement; never invent a code):\n"
        f"{tax}\n\n"
        "For EVERY obligation below:\n"
        "1. Split it into individual REQUIREMENTS — one per distinct enforceable duty. Most have "
        "1-4. Do not merge separate duties; do not invent duties not in the text.\n"
        "2. For each requirement write `text` as a single concise imperative sentence (\"The Bank "
        "must ...\").\n"
        "3. Assign the SINGLE MOST SPECIFIC `riskCode` — the concrete risk that materialises if "
        "that exact duty is missed (e.g. a pension duty -> HR/People or Financial, not RC-01). "
        "The generic catch-all `RC-01` (regulatory breach) is a LAST RESORT: use it only when no "
        "specific risk in the taxonomy fits. Most requirements must get a specific, non-RC-01 code.\n"
        "4. `controls` = ONLY the controls below that genuinely PERFORM that specific duty. Read "
        "each control text and match it to the duty. An empty list [] is normal and expected for "
        "a duty no control covers; do NOT tick a control unless its text maps to the duty. Do not "
        "default to both.\n"
        "5. `confidence` 0-100 for the whole row; <70 if the text is vague or you had to guess.\n\n"
        "Obligations:\n"
        f"{json.dumps(items, ensure_ascii=False)}\n\n"
        "Reply as strict JSON: {\"items\":[{\"idx\":int,\"confidence\":int,\"requirements\":"
        "[{\"text\":str,\"riskCode\":str,\"controls\":[str]}]}]}"
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
        f"{GATEWAY}/chat/completions", data=body,
        headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=240) as resp:
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


def enrich_batch(taxonomy, rows, base):
    prompt = build_prompt(taxonomy, rows)
    for attempt in range(1, RETRIES + 1):
        try:
            got = {it["idx"]: it for it in parse_items(call_gateway(prompt))}
            return [got.get(i) for i in range(len(rows))]
        except Exception as e:  # noqa: BLE001
            wait = 2 ** attempt
            print(f"  batch@{base} attempt {attempt}: {type(e).__name__}: {e} (retry {wait}s)", flush=True)
            time.sleep(wait)
    raise RuntimeError(f"batch@{base} failed after {RETRIES} attempts")


def main():
    taxonomy = json.load(open(os.path.join(HERE, "risk_taxonomy.json")))["risks"]
    rows = json.load(open(os.path.join(HERE, "obligations.json")))
    if LIMIT:
        rows = rows[:LIMIT]

    ckpt_path = os.path.join(HERE, "enrichment.ckpt.json")
    ckpt = {int(k): v for k, v in json.load(open(ckpt_path)).items()} if os.path.exists(ckpt_path) else {}
    if ckpt:
        print(f"resuming: {len(ckpt)} rows done", flush=True)

    batches = [rows[i:i + BATCH] for i in range(0, len(rows), BATCH)]
    print(f"enriching {len(rows)} rows in {len(batches)} batches (model={MODEL})", flush=True)

    results = [ckpt.get(i) for i in range(len(rows))]
    pending = [(i * BATCH, b) for i, b in enumerate(batches)
               if any(results[i * BATCH + j] is None for j in range(len(b)))]
    done = len(batches) - len(pending)
    with cf.ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futs = {ex.submit(enrich_batch, taxonomy, b, base): base for base, b in pending}
        for fut in cf.as_completed(futs):
            base = futs[fut]
            for j, it in enumerate(fut.result()):
                results[base + j] = it
                ckpt[base + j] = it
            done += 1
            json.dump({str(k): v for k, v in ckpt.items()}, open(ckpt_path, "w"), ensure_ascii=False)
            print(f"  {done}/{len(batches)} batches done", flush=True)

    json.dump({str(i): results[i] for i in range(len(results))},
              open(os.path.join(HERE, "enrichment.json"), "w"), indent=1, ensure_ascii=False)
    empty = sum(1 for r in results if not r or not r.get("requirements"))
    print(f"wrote enrichment.json ({len(results)} rows, {empty} with no requirements)")


if __name__ == "__main__":
    main()
