#!/usr/bin/env python3
"""One-off AI pass: attribute each toolkit control to an accountable department + unit,
an accountable role title, contributing units and a verifying unit.

Uses the ISW AI gateway (OpenAI-compatible) with the model id from the opencode config.
Reads rows.json + org_vocab.json, writes attributions.json (per row, per control).

Nothing here runs at seed time and nothing is committed to a running app; the output is a
static JSON consumed by export_json.py.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request
import concurrent.futures as cf

HERE = os.path.dirname(os.path.abspath(__file__))
GATEWAY = os.environ.get("AI_GATEWAY_URL", "https://ai-gateway.isw.la/v1")
API_KEY = os.environ.get("AI_GATEWAY_KEY")
MODEL = os.environ.get("AI_GATEWAY_MODEL", "deepseek-v4.1")
if not API_KEY:
    sys.exit("Set AI_GATEWAY_KEY (the ISW AI gateway key) before running.")
BATCH = int(os.environ.get("AI_BATCH", "12"))
WORKERS = int(os.environ.get("AI_WORKERS", "6"))
RETRIES = 4
SHEETS = os.environ.get("AI_SHEETS", "").split(",") if os.environ.get("AI_SHEETS") else None
LIMIT = int(os.environ.get("AI_LIMIT", "0"))

SYSTEM = (
    "You are a bank compliance operating-model analyst. You assign accountable ownership for "
    "regulatory controls using a fixed org structure. You never invent departments, units or role "
    "titles outside the supplied vocabulary. You reply with strict JSON only."
)


def build_prompt(vocab, rows):
    dept_lines = []
    for d in vocab["departments"]:
        dept_lines.append(f"- {d['name']}: {', '.join(d['units'])}")
    depts = "\n".join(dept_lines)
    roles = ", ".join(vocab["roleTitles"])
    verifiers = ", ".join(vocab["verificationDepartments"])

    items = []
    for i, r in enumerate(rows):
        items.append(
            {
                "idx": i,
                "sheet": r["sheet"],
                "act": r["act"],
                "section": r["section"],
                "title": r["title"],
                "theme": r["theme"],
                "primaryControl": r["control"],
                "primaryResponsibilityText": r["responsibility"],
                "additionalControl": r["additionalControl"],
                "additionalResponsibilityText": r["additionalResponsibility"],
            }
        )

    return (
        "ORG STRUCTURE (departments and their units):\n"
        f"{depts}\n\n"
        "ROLE TITLES (pick exactly one accountable role title, or empty string if none fits):\n"
        f"{roles}\n\n"
        "VERIFYING DEPARTMENTS (pick one, usually Internal Audit or Compliance):\n"
        f"{verifiers}\n\n"
        "For EVERY control row below, attribute ownership. The raw responsibility text is often a "
        "list of parties; choose the SINGLE most accountable department/unit/role, list the others as "
        "contributors, and name the independent verifier (internal audit or compliance function).\n\n"
        "Rules:\n"
        "- department and unit MUST come from the org structure above; unit MUST belong to the department.\n"
        "- roleTitle MUST be from the role list or empty string.\n"
        "- contributors: list of party labels from the raw text (departments or role titles), may be empty.\n"
        "- verifierDepartment MUST be one of the verifying departments.\n"
        "- confidence: 0-100. Use <70 when the text is ambiguous, a stray value, or multiple parties "
        "compete to be accountable. Never guess silently.\n"
        "- If responsibility text is nonsense (e.g. 'High', 'Same as above'), set department/unit to the "
        "best inference, roleTitle empty, confidence <= 40.\n\n"
        "Controls:\n"
        f"{json.dumps(items, ensure_ascii=False)}\n\n"
        "Reply as strict JSON: {\"items\":[{\"idx\":int,\"department\":str,\"unit\":str,"
        "\"roleTitle\":str,\"contributors\":[str],\"verifierDepartment\":str,\"confidence\":int,"
        "\"reason\":str}]}"
    )


def call_gateway(prompt):
    body = json.dumps(
        {
            "model": MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0,
            "max_tokens": 8000,
            "response_format": {"type": "json_object"},
        }
    ).encode()
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
    raise ValueError(f"unexpected response shape: {list(data)[:5] if isinstance(data,dict) else type(data)}")


def classify_batch(vocab, rows, base):
    prompt = build_prompt(vocab, rows)
    for attempt in range(1, RETRIES + 1):
        try:
            items = parse_items(call_gateway(prompt))
            got = {it["idx"]: it for it in items}
            return [got.get(i) for i in range(len(rows))]
        except Exception as e:  # noqa: BLE001 - gateway throws timeouts/ssl/400s; retry all
            wait = 2 ** attempt
            print(f"  batch@{base} attempt {attempt} failed: {type(e).__name__}: {e} (retry in {wait}s)", flush=True)
            time.sleep(wait)
    raise RuntimeError(f"batch@{base} failed after {RETRIES} attempts")


def main():
    vocab = json.load(open(os.path.join(HERE, "org_vocab.json")))
    rows = json.load(open(os.path.join(HERE, "rows.json")))

    if SHEETS:
        rows = [r for r in rows if r["sheet"] in SHEETS]
    if LIMIT:
        rows = rows[:LIMIT]

    ckpt_path = os.path.join(HERE, "attributions.ckpt.json")
    ckpt = {}
    if os.path.exists(ckpt_path):
        ckpt = {int(k): v for k, v in json.load(open(ckpt_path)).items()}
        print(f"resuming: {len(ckpt)} rows already classified", flush=True)

    batches = [rows[i : i + BATCH] for i in range(0, len(rows), BATCH)]
    print(f"classifying {len(rows)} rows in {len(batches)} batches (model={MODEL})", flush=True)

    results = [None] * len(rows)
    for i, a in ckpt.items():
        if a:
            results[i] = a

    pending = [
        (i * BATCH, b)
        for i, b in enumerate(batches)
        if any(results[i * BATCH + j] is None for j in range(len(b)))
    ]
    done = len(batches) - len(pending)
    with cf.ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futs = {ex.submit(classify_batch, vocab, b, base): base for base, b in pending}
        for fut in cf.as_completed(futs):
            base = futs[fut]
            items = fut.result()
            for j, it in enumerate(items):
                results[base + j] = it
                ckpt[base + j] = it
            done += 1
            json.dump({str(k): v for k, v in ckpt.items()}, open(ckpt_path, "w"), ensure_ascii=False)
            print(f"  {done}/{len(batches)} batches done", flush=True)

    for r, a in zip(rows, results):
        r["attribution"] = a

    json.dump(rows, open(os.path.join(HERE, "attributions.json"), "w"), indent=1, ensure_ascii=False)
    low = [r for r in rows if not r["attribution"] or (r["attribution"].get("confidence", 0) < 70)]
    print(f"wrote attributions.json ({len(rows)} rows, {len(low)} low-confidence)")


if __name__ == "__main__":
    main()