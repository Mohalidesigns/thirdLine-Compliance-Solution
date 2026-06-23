# Atheris — Compliance Pain Points, Solutions & Implementation Map

> **Version:** 2.0 — 19 May 2026
> **Purpose:** Human-centred analysis connecting each compliance pain point to its Atheris solution and the specific implementation components that deliver it. Read this before reading the Technical Implementation document.

---

## Who This Is About

Meet **Ngozi**. She is a compliance analyst at a mid-size Nigerian commercial bank. Her job, on paper, is simple: make sure the bank follows every rule that applies to it.

In practice, she manages 350+ regulatory obligations across CBN, SEC, NDIC, FCCPC, NAICOM, PenCom and more. She tracks 187 regulatory return deadlines per year. She tests controls, chases colleagues, files reports, and builds board packs — most of it in Excel, email, and shared drives.

> *"I spend 60% of my time on admin — chasing people, formatting reports, checking websites. The actual compliance thinking gets maybe 2 hours a day."*

---

## The Six Pain Points

| # | Pain Point | Current tool | Risk if unaddressed |
|---|---|---|---|
| 1 | Finding new regulations manually | Manual website checks, email forwards | 30-day compliance window half gone before action starts |
| 2 | 350+ obligations in an unstructured spreadsheet | 1,200-row Excel | Cannot answer "what High-risk obligations have no control?" |
| 3 | 187 return deadlines in a shared calendar | Shared Outlook calendar, no workflow | ₦50m+ fine for a missed CBN return |
| 4 | Producing evidence for examiners takes days | Email search, SharePoint, WhatsApp history | Cannot prove compliance even when bank did the right thing |
| 5 | Chasing colleagues for tests and attestations | WhatsApp, email | Tasks forgotten, no escalation, no audit trail |
| 6 | Board pack takes 4 days from stale data | Manual PowerPoint from spreadsheets | Board makes governance decisions on 2-week-old information |

---

## Pain Point 1 — Finding New Regulations

### The Problem
Ngozi manually checks 12 regulator websites every week. She sometimes finds out about a new CBN circular because a colleague forwarded an email. By then, the 30-day compliance window may already be 2 weeks gone. CBN alone issues 80–150 instruments per year.

### What Atheris Does
Every night, the **Horizon Scanner** visits the publication pages of all 43 configured Nigerian regulators. When it finds a new document it downloads the PDF, extracts the text, and passes it to the AI classifier. By morning Ngozi sees a structured, plain-English summary in her dashboard — without visiting a single website.

### The Data It Produces
```
New obligation detected:
  Title      : Re: Guidelines on ATM Cash Disbursement — ATM Operations 2026
  Regulator  : Central Bank of Nigeria
  Detected   : 2026-05-31 02:14 AM
  AI Summary : "Banks must ensure all ATMs are funded within 24 hours of
                cash depletion. Branches with 3+ failures face ₦1m/branch fine."
  Status     : Triage — awaiting your review
```

### Implementation Components

| Component | What It Does | Where Designed |
|---|---|---|
| `ScraperService` | Orchestrates all regulator scrapes, routes to correct strategy | §3 Scraper |
| `HtmlScraperStrategy` | JSoup-based scraper for static HTML sites (SEC, NDIC, NAICOM) | §3 Scraper |
| `PlaywrightHeadlessStrategy` | Playwright Chromium for JS-rendered sites (CBN) | §3 Scraper |
| `PlaywrightBrowserPool` | Shared Chromium singleton — one browser process, lightweight contexts per scrape | §3 Scraper |
| `PdfExtractionService` | PDFBox for digital PDFs (95%), Tesseract fallback for scanned images | §3 Scraper |
| `StorageService.streamUpload()` | Streams PDF directly to S3 via DigestInputStream — never loads full file into RAM | §3 Scraper |
| `ClassificationService` | Calls Claude API with Nigerian regulatory prompt — extracts risk rating, obligations, sanctions, applicable licence types | §4 Classification |
| `job_queue` table | PostgreSQL queue — scraper → OCR → classify → applicability → webhook, ~17-22 min end to end | §4 Cron |
| `regulators` table | Admin-configurable per regulator: URL, CSS selector, frequency, strategy — no code changes when site restructures | §2 Data Models |
| Anomaly detection | Alerts if 3 consecutive runs find 0 docs or volume drops >90% — catches silent selector breakage | §3 Scraper |
| Two scrape modes | Incremental monitoring (every 15 min, HIGH priority) and historical backfill (LOW priority, resumable) | §3 Scraper |

**Time from CBN publishing to Ngozi's inbox:** ~17–22 minutes (automated). Previously: days to weeks (manual).

**Applicable to:** Pain Point 1 is fully solved by the **central intelligence platform**. Tenants on both Product 1 (Intelligence API) and Product 2 (Full Platform) benefit.

---

## Pain Point 2 — 350+ Obligations in an Unstructured Spreadsheet

### The Problem
Every obligation lives in a 1,200-row Excel sheet. Different columns mean different things to different people. There is no enforced structure, no ownership, no audit trail of who changed a risk rating or why. Nobody can reliably answer "show me all High-risk AML obligations with no linked control."

### What Atheris Does — First Half (Central Platform)
When the AI classifier processes a new circular, it produces 17 structured fields — not free text. The obligation is stored in the `instruments` table with area of focus, risk rating, applicable licence types, specific duties, and penalty amount. Every tenant subscribing to the relevant regulator receives this structured record via webhook.

### What Atheris Does — Second Half (Tenant App — Next Session)
The compliance analyst reviews the received obligation in their dashboard. She fills in the tenant-specific fields: assigns an owner, links existing controls, confirms applicability, and adds the risk justification. This becomes the live obligations register — always current, always queryable.

### The Data It Produces
```
Obligation record:
  S/N                : 353
  Instrument         : CBN Circular — Cash Disbursement 2026
  Area of Focus      : Cash Management
  Risk Rating        : High
  Compliance Owner   : Head, Operations Compliance
  Linked Controls    : CTRL-044, CTRL-045
  Return Required    : Yes → Monthly
  Penalty            : ₦1,000,000 per branch
  Status             : Active
  Last Reviewed      : 2026-06-06 by Ngozi Eze
```

### Implementation Components

| Component | What It Does | Where Designed |
|---|---|---|
| `instruments` table | Central store of every Nigerian regulation — 17 structured fields, immutable text | §2 Central Schema |
| `obligation_mappings` table | Breaks each instrument into specific duties (one circular → 2-3 specific obligations) | §2 Central Schema |
| `sanctions_and_penalties` table | Penalty amounts, liable roles, severity scores, enforcement history | §2 Central Schema |
| `received_obligations` table | Tenant's copy of received obligations — tenant-specific fields (owner, controls, applicability decision) | §2 Tenant Schema |
| AI classification prompt | Extracts area_of_focus, nature, risk_rating, licence_types_applicable, obligations list, sanctions | §4 Classification |
| Applicability filter | 6-condition check before webhook delivery — regulator, doc type, licence type, per-regulator override | §4 Webhooks |
| `tenant_eligibility_rules` | Pre-computed routing rules — which tenants get which obligation | §2 Central Schema |
| Obligation classification API | `PUT /api/v1/obligations/{id}/classify` — tenant assigns owner, links controls, confirms applicable | §5 Service APIs |

**Immutability note:** The CBN circular text, AI classification, and sanctions data are computed once and shared to all tenants. What each tenant does with it (who they assign it to, which controls they link) lives only in their own isolated schema.

---

## Pain Point 3 — 187 Return Deadlines With No Safety Net

### The Problem
187 regulatory returns per year tracked in a shared calendar with no preparation workflow. Returns are missed because the calendar was not updated when a regulator changed their deadline. When it goes wrong the bank pays the fine even though the work was done.

### What Atheris Does
Every return has a multi-stage workflow: Data Gathering → Draft → Review → Sign-off → Submitted. Each stage has its own owner, its own deadline, and auto-escalation if it slips. Submission receipts are stored as permanent evidence.

### The Data It Produces
```
Returns calendar — next 30 days:
  Due Jun 10  CBN Monetary Policy Return    → OVERDUE — escalated to CCO
  Due Jun 15  NDIC Premium Return           → On track — Ngozi, 3 days left
  Due Jun 22  CBN Foreign Exchange Weekly   → Not started — prep starts Jun 17
  Due Jun 30  AML Suspicious Transaction    → Not started — auto-assigned Jun 20
```

### Implementation Components

| Component | What It Does | Where Designed |
|---|---|---|
| `regulatory_returns` table | 187 returns with frequency, channel, owner, legal basis | §2 Tenant Schema |
| `return_filing_instances` table | Each filing instance — status, due date, submitted date, evidence URL | §2 Tenant Schema |
| Multi-stage workflow | Data Gathering → Draft → Review → Sign-off → Submitted with per-stage owners | §5 Service APIs |
| Auto-escalation | If stage overdue → escalate to manager → CCO (via manager chain in `users` table) | §6 User Management |
| Submission evidence | Receipt uploaded, stored in S3, linked to filing instance — permanent proof | §2 Tenant Schema |
| Returns calendar API | `GET /api/v1/returns/calendar` — returns due in next 30/60/90 days with status | §5 Service APIs |

**Status:** Tenant app module — not yet fully designed. Data model is defined. API endpoints are specified. Implementation detail is next session.

---

## Pain Point 4 — Producing Evidence Takes Days

### The Problem
CBN examiners ask for evidence of a control test from 8 months ago. Ngozi spends 2 days searching email, SharePoint, and messaging colleagues. Evidence is scattered. The bank cannot prove it did the right thing — even when it actually did.

### What Atheris Does
Every action in the system writes a permanent, append-only, hash-chained audit record automatically. No manual logging. Every document is stored in S3 and linked to the record. Examiners get a read-only portal login — no need to export anything to email.

### The Data It Produces
```
Evidence pack — Control CTRL-044 (2026):
  Jan 13  FAILED — 3 ATMs unfunded >24h   [evidence ↗]  hash: 7b92de...
  Jan 13  Finding raised (High severity)                  hash: 4d11fa...
  Jan 13  Remediation assigned → IT Ops                   hash: 9e33bc...
  Jan 27  Remediation completed             [IT report ↗] hash: 2f88ad...
  Feb 01  Finding closed — CCO signed off                  hash: 1a55ef...
  Feb 13  Re-test: PASSED ✓                [evidence ↗]  hash: 8c21da...

  Hash chain: VERIFIED ✓ — no tampering detected
```

### Implementation Components

| Component | What It Does | Where Designed |
|---|---|---|
| `audit_events` table | Append-only, hash-chained. Every action logged with before/after JSON, actor, timestamp, evidence URL | §2 Tenant Schema |
| Cryptographic chain | Each row: `this_hash = SHA256(prev_hash + row_data)`. Tamper breaks chain immediately | §2 Tenant Schema |
| S3 evidence vault | All uploaded documents stored immutably. Linked by URL in audit_events | §3 Scraper (StorageService) |
| VIEWER role | Read-only portal access for CBN examiners — no data export needed | §6 User Management |
| Evidence pack API | `GET /api/v1/audit?subject_type=control&subject_id=44` — full audit trail for any subject | §5 Service APIs |

**Status:** Data model and audit logging defined. Examiner portal UI is next session.

---

## Pain Point 5 — Chasing Colleagues by WhatsApp

### The Problem
"Did you test that control?" "Did Retail submit their compliance attestation?" All done by email and WhatsApp. This is invisible, untracked work that disappears into chat history. No escalation, no record that the task was assigned.

### What Atheris Does
When a control test is due, the system creates a task and assigns it to the right person — not Ngozi. If they don't act by the internal deadline, the system escalates to their manager. Ngozi's dashboard shows her a live summary of all task statuses. Every assignment, completion, and escalation is logged.

### The Data It Produces
```
Ngozi's dashboard — Task overview (today):
  ✅ On track (12)
     CTRL-031 Monthly liquidity test      → Emeka, due Jun 18
     CTRL-056 NDPC data inventory review  → IT Security, due Jun 20

  ⚠ Overdue (3)
     CTRL-012 KYC refresh — Retail        → Amaka, was Jun 08
               Escalated to: Head, Retail Compliance (Jun 09)
     CTRL-087 AML rule review             → Risk Team, was Jun 05
               Escalated to: MLRO (Jun 06)
```

### Implementation Components

| Component | What It Does | Where Designed |
|---|---|---|
| `controls` table | Controls register — what each control does, owner, frequency, linked obligations | §2 Tenant Schema |
| `control_test_results` table | Every test result — result, evidence, reviewer, remediation owner | §2 Tenant Schema |
| `findings` table | Gaps and failures — severity, root cause, remediation deadline, SLA | §2 Tenant Schema |
| Manager chain | `manager_user_id` in `users` table — escalation path automatically derived | §6 User Management |
| RBAC | First line (Operations) records tests. Second line (Compliance) reviews. CCO approves findings | §6 User Management |
| Three lines of defence | Business self-tests (1st), Compliance reviews (2nd), Internal Audit verifies (3rd) | §6 User Management |
| Task APIs | `POST /api/v1/controls/{id}/tests`, `PUT /api/v1/findings/{id}/assign` | §5 Service APIs |

**Status:** Data model and API endpoints defined. Task scheduling and notification logic next session.

---

## Pain Point 6 — Board Pack Takes 4 Days From Stale Data

### The Problem
Every quarter, 3–4 days are spent pulling data from multiple spreadsheets into a PowerPoint. By the time it is presented, the data is 2 weeks old. If a board member asks a follow-up question in the meeting, the answer requires a manual lookup afterwards.

### What Atheris Does
Every compliance action updates the underlying metrics automatically. The CCO opens the dashboard the morning of the board meeting and the data is accurate as of that morning. A "Generate Board Pack" button produces a formatted PDF in under 10 minutes — no manual assembly.

### The Data It Produces
```
Board pack — Q2 2026 (generated 08:45 AM today — live data):
  Overall compliance score    : 84%  (↑3% from Q1)
  Obligations tracked         : 353 active
  High-risk items             : 47   (12 with open gaps)
  Control tests completed     : 91%  (target: 95%)
  Returns filed on time       : 100% this quarter
  Open AML cases              : 14   (avg age 6.2 days)
  Data protection breaches    : 0

  ⚠ Board attention:
    — CTRL-087 AML rule test overdue 11 days (MLRO informed)
    — ISA 2025 implementation gap: 4 obligations uncontrolled
```

### Implementation Components

| Component | What It Does | Where Designed |
|---|---|---|
| `dashboard_snapshots` table | Pre-computed daily aggregates — compliance score, counts, overdue items, penalty exposure | §2 Tenant Schema |
| Board pack API | `POST /api/v1/dashboard/board-pack/export` — generates formatted PDF from live data | §5 Service APIs |
| Dashboard summary API | `GET /api/v1/dashboard/summary` — live metrics, zero manual work | §5 Service APIs |
| Drill-down | Every metric is clickable — "12 open gaps" → shows the 12 obligations | §5 Service APIs |

**Status:** Data model defined. Dashboard UI and board pack PDF generation next session.

---

## The Architectural Split — What Solves What

```
CENTRAL INTELLIGENCE PLATFORM (Atheris operates this)
  Fully solves: Pain Point 1 (finding new regulations)
  Partially solves: Pain Point 2 first half (structuring obligations)
  
  Delivers to ALL tenants — banks, fintechs, PFAs — regardless
  of whether they use the full platform or just the Intelligence API.

TENANT APPLICATION (one per institution)
  Fully solves: Pain Points 2 (second half), 3, 4, 5, 6
  
  Designed but not yet implemented:
    - Obligation classification workflow   (Pain Point 2)
    - Controls register + CRMP             (Pain Point 5)
    - Control testing + task management    (Pain Point 5)
    - Findings + remediation               (Pain Point 5)
    - Returns calendar + filing            (Pain Point 3)
    - Evidence vault + examiner portal     (Pain Point 4)
    - Board dashboard + board pack         (Pain Point 6)
```

---

## Design Status (19 May 2026)

### ✅ Fully Designed — Central Platform

| Component | Pain Point | Document Section |
|---|---|---|
| Horizon scanner (JSoup + Playwright, two modes) | 1 | §3 |
| OCR pipeline (PDFBox + Tesseract) | 1 | §3 |
| AI classifier (Claude API) | 1, 2 | §4 |
| Regulator management (UI-configurable) | 1 | §3 |
| Central data model (8 tables) | 1, 2 | §2 |
| Applicability routing (6-condition filter) | 2 | §4 |
| Webhook delivery (3 types, HMAC, retry) | 2 | §4 |
| Job queue pipeline (replaces Kafka) | All | §4 |
| Tenant registry + onboarding wizard | All | §7 |
| Regulator + document type subscriptions | All | §7 |
| User management + invite flow | All | §6 |
| JWT + refresh token auth | All | §6 |
| Schema-per-tenant isolation | All | §6 |
| RBAC (5 roles) | All | §6 |
| Regulatory Intelligence API (Product 1) | 1, 2 | §7 |

### ❌ Next Design Session — Tenant Application

| Component | Pain Point |
|---|---|
| Obligation classification workflow | 2 |
| Controls register + CRMP management | 5 |
| Control testing + task scheduling | 5 |
| Findings + remediation workflow | 5 |
| Returns calendar + filing workflow | 3 |
| Evidence vault + examiner portal | 4 |
| Board dashboard + board pack | 6 |
