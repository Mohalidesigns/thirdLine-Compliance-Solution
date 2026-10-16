# Atheris Compliance — Compliance Runbook Module

**Specification & Implementation Guide v1.0**
Module code: `runbooks` · Target: `atheris-compliance-tenant-backend` (:9091) + `atheris-compliance-tenant-frontend` (:5174) · Template authoring in `atheris-compliance-intelligence-backend` (:9090)
Status: Draft for build · Owner: Atheris Product · Last reviewed: 2026-10-16

---

## 0. Why this is the USP

Every GRC tool on the market tells a bank *what* it must comply with. Almost none tell the compliance officer, the sysadmin or the internal auditor *exactly how* — step by step, command by command — to meet, maintain and **prove** that compliance. That gap is where Nigerian institutions actually fail CBN and NDPC examinations: the control exists on paper, but nobody can produce the evidence trail of the procedure being run.

The **Compliance Runbook** closes that gap. It turns every obligation and control in Atheris into an *executable operating procedure*:

| Today (Obligations + Controls) | With Runbooks |
|---|---|
| "Quarterly user access review is required (CBN RBCSF §3.4.2)" | A guided 11-step procedure with the exact `psql`/AD/Finacle queries to pull, a reviewer sign-off per system, and auto-filed evidence |
| "Data breach must be reported to NDPC within 72 hours (NDPA s.40)" | A timed incident runbook with a countdown, the NDPC notification template pre-filled, and an escalation ladder to the DPO → CCO → MD |
| "Evidence: see Evidence Vault" | Evidence is captured *inside* the step that produced it, hashed, time-stamped and linked to obligation, control and framework clause |

**Positioning line:** *Atheris doesn't just tell you what the regulator wants — it walks your team through doing it, and hands the examiner the proof.*

---

## 1. Scope & Definitions

### 1.1 In scope (v1.0)

- Runbook library, authoring (builder), versioning, review cycles
- Guided execution console with per-step evidence capture
- Scheduled and ad-hoc executions; time-boxed executions (regulatory deadlines)
- Escalation and rollback paths
- Evidence pack generation (auditor export)
- Framework/clause mapping to Nigerian and global standards
- Platform-authored template library pushed to tenants (via existing webhook/applicability pipeline)
- Linkage to existing modules: Obligations, Controls, Findings, Evidence Vault, Audit Trail, Returns, Notifications, Remediation

### 1.2 Out of scope (v1.0 — roadmap)

- Direct execution of commands against customer infrastructure (v1 is *guided*, operators run commands; v2 adds connector-based automation with approval gates)
- AI-generated runbooks from raw instruments (v1.5 — uses existing `AiClient`)
- Mobile execution

### 1.3 Glossary

| Term | Meaning |
|---|---|
| **Runbook** | A versioned, executable procedure that satisfies one or more obligations/controls. |
| **Runbook Version** | An immutable snapshot of a runbook's content. Only `PUBLISHED` versions can be executed. |
| **Section** | Logical grouping of steps (Pre-checks, Execution, Verification, Close-out). |
| **Step** | Atomic action with instruction text, optional command block, expected result, evidence requirement, and pass/fail outcome. |
| **Execution** | One run of a published version by an operator, producing step results and evidence. |
| **Evidence Requirement** | What must be captured at a step (screenshot, log file, query output, ticket ref, attestation). |
| **Evidence Item** | The actual captured artefact: file in Evidence Vault + SHA-256 + capturer + timestamp. |
| **Escalation Path** | Ordered list of roles/people and timers triggered on step failure or SLA breach. |
| **Rollback Path** | Steps that safely reverse changes made by the runbook. |
| **Evidence Pack** | Export (PDF + ZIP) of an execution: steps, outcomes, evidence, sign-offs, hash manifest. |
| **Review Cycle** | Mandatory periodic review (quarterly/annual) or event-triggered (regulation changed, infra changed). |

---

## 2. Regulatory Framework Coverage

Runbooks map to clauses in a **Framework Library** (`runbook_framework_clauses`). Seed with the frameworks below; the platform (intelligence) side owns the master list, tenants may add internal policies.

### 2.1 Nigerian frameworks (primary market)

| Code | Framework | Issuer | Runbook relevance |
|---|---|---|---|
| `CBN-RBCSF-DMB` | Risk-Based Cybersecurity Framework & Guidelines for DMBs and PSPs (2018, rev.) | CBN | Access control, vulnerability mgmt, incident reporting, config baselines, log retention |
| `CBN-RBCSF-OFI` | Risk-Based Cybersecurity Framework for Other Financial Institutions (2022) — **applies to mortgage banks, MFBs, DFIs, FCs** | CBN | Same as above, OFI-scaled; mandatory CISO function, annual self-assessment |
| `CBN-ITSB` | IT Standards Blueprint | CBN | Config management, change control, DR/BCP |
| `CBN-BCP` | Guidelines on Business Continuity Planning for Banks | CBN | Backup/restore testing, DR drills |
| `CBN-ORM` | Guidelines for Operational Risk Management | CBN | Incident classification, loss event capture |
| `CBN-AML` | AML/CFT/CPF Regulations (2022) | CBN / NFIU | STR/CTR filing runbooks, sanctions screening procedures |
| `CBN-CPF` | Consumer Protection Framework & Regulations | CBN | Complaint handling SLAs |
| `CBN-RETURNS` | Prudential / e-FASS / FinA returns schedule | CBN | Returns preparation and submission runbooks (links to `returns` module) |
| `NDPA-2023` | Nigeria Data Protection Act 2023 | NDPC | Breach notification (72h to NDPC, s.40), DSAR handling, DPIA, DPO duties |
| `NDPR-2019` / `NDPA-GAID-2025` | NDPR + General Application & Implementation Directive | NDPC | Annual audit filing (CAF), data inventory, consent records |
| `NG-CYBERCRIMES` | Cybercrimes (Prohibition, Prevention etc.) Act 2015, as amended 2024 | ONSA / NGCERT | Incident reporting to sectoral CERT, data retention |
| `NITDA-NCPS` | Nigeria Cloud Computing Policy / NITDA guidelines | NITDA | Cloud hosting and data residency checks |
| `SEC-NG` | SEC Nigeria Rules (capital market operators) | SEC | For tenants with CMO licences |
| `NAICOM` | NAICOM Guidelines (insurers) | NAICOM | Insurance tenants |
| `PENCOM` | PenCom ICT Guidelines | PenCom | PFAs/PFCs |
| `NIBSS-BVN` | BVN Operational Guidelines | NIBSS/CBN | BVN data handling |
| `NG-FIRS` | FIRS e-filing obligations | FIRS | Tax filing runbooks (optional) |

> **Deadline rules to encode as `sla_minutes` on templates (verify against the current circular on publish):**
> - NDPA s.40 — notify NDPC within **72 hours** of becoming aware of a breach likely to cause harm; notify data subjects "without undue delay" where high risk.
> - CBN RBCSF — report cyber incidents to CBN **within 24 hours** of detection (initial report), full report thereafter.
> - CBN AML/CFT — STR to NFIU **within 24 hours** of suspicion; CTR within **7 days**.
> - Cybercrimes Act — report to sectoral CERT/ngCERT per Act and NCC/CBN circulars (**7 days** general; shorter for critical infrastructure).

### 2.2 Global frameworks

| Code | Framework | Runbook relevance |
|---|---|---|
| `ISO-27001-2022` | ISO/IEC 27001:2022 Annex A (93 controls) | A.5.15–5.18 access, A.8.8 vuln mgmt, A.8.9 config mgmt, A.5.24–5.28 incident mgmt, A.8.15 logging, A.8.24 crypto |
| `ISO-27002-2022` | Implementation guidance | Step wording source |
| `ISO-22301-2019` | Business continuity | BCP/DR exercise runbooks |
| `ISO-27701` | Privacy information management | NDPA/GDPR alignment |
| `NIST-CSF-2.0` | NIST Cybersecurity Framework 2.0 | Govern/Identify/Protect/Detect/Respond/Recover tagging |
| `NIST-800-53r5` | Security & privacy controls | AC-2, RA-5, CM-6, IR-6, AU-6, SC-12 |
| `NIST-800-61r3` | Incident handling | IR runbook phases |
| `PCI-DSS-4.0.1` | Payment card security | Req 2 (config), 6 (patching), 7–8 (access), 10 (logging), 12.10 (IR plan) |
| `SOC2-TSC` | Trust Services Criteria (CC6, CC7, CC8) | Evidence-pack formatting for SOC 2 auditors |
| `COBIT-2019` | Governance | DSS05, DSS06, BAI10, MEA03 |
| `CIS-v8` | CIS Critical Security Controls v8 / CIS Benchmarks | Config audit step content |
| `GDPR` | EU GDPR (Art. 33/34 — 72h) | Multinational tenants |
| `SWIFT-CSP` | SWIFT Customer Security Programme CSCF | Banks on SWIFT |
| `BASEL-OPRISK` | Basel III operational risk / BCBS 239 | Loss data, reporting |
| `COSO-2013` | Internal control framework | Control-owner attestations |
| `IIA-GIAS-2024` | Global Internal Audit Standards | Audit evidence sufficiency for `AUDITOR` role |

### 2.3 Clause mapping rules

- A runbook **must** map to ≥1 framework clause **or** ≥1 internal policy.
- A step **may** map to a clause (fine-grained evidence for examiners).
- Clause mapping is many-to-many: one runbook can evidence CBN RBCSF §3.4, ISO 27001 A.5.18 and PCI 7.2 simultaneously → the **Coverage Matrix** page shows framework-by-framework coverage.

---

## 3. Core Components → Data Model

Each core component from the brief becomes a first-class structure.

### 3.1 Component mapping

| Core component | Model element | UI element |
|---|---|---|
| Objective & Scope | `runbooks.objective`, `scope_systems[]`, `scope_teams[]`, `framework_clause_ids[]`, `linked_obligation_ids[]`, `linked_control_ids[]` | Builder Step 1 "Objective & Scope" |
| Pre-requisites & Permissions | `runbook_prerequisites` (type: ACCESS / TOOL / CREDENTIAL / APPROVAL / DATA) | Builder Step 2; Execution "Pre-flight checklist" |
| Step-by-Step Instructions | `runbook_sections` → `runbook_steps` (instruction md, `command_block`, `command_lang`, `expected_result`, `duration_estimate_min`, `is_blocking`) | Builder Step 3; Execution Console |
| Audit Trail & Evidence Collection | `runbook_step_evidence_reqs` → `runbook_evidence_items` (→ `evidence_files` in Vault) + `audit_events` | Evidence drawer per step; Evidence Pack |
| Escalation & Rollback Paths | `runbook_escalation_paths` (levels, timers, roles); `runbook_rollback_steps` | Builder Step 4; Execution "Fail → Escalate/Rollback" |
| Version Control | `runbook_versions` (immutable, `change_summary`, diff), `runbook_version_approvals` | Version History tab, Diff modal |
| Regular Reviews | `runbook_review_schedules`, `runbook_review_events` + triggers from instrument changes | Review Queue page |
| Actionable Language | Authoring linter (`RunbookLintService`) | Inline builder warnings |

### 3.2 Entity-relationship overview

```
runbooks 1──* runbook_versions 1──* runbook_sections 1──* runbook_steps
   │                │                                        │
   │                ├──* runbook_prerequisites                ├──* runbook_step_evidence_reqs
   │                ├──* runbook_escalation_paths             └──* runbook_step_clause_map ──> runbook_framework_clauses
   │                ├──* runbook_rollback_steps
   │                └──* runbook_version_approvals
   │
   ├──* runbook_clause_map ──> runbook_framework_clauses ──> runbook_frameworks
   ├──* runbook_review_schedules 1──* runbook_review_events
   ├──* runbook_schedules (cron/frequency)
   └──* runbook_executions 1──* runbook_step_executions 1──* runbook_evidence_items ──> evidence_files
                        │
                        ├──* runbook_execution_escalations
                        ├──* runbook_execution_signoffs
                        └──1 findings (on failure, optional)   obligations / controls (existing)
```

### 3.3 Flyway migrations (tenant DB, continue from V9)

Create under `atheris-compliance-tenant-backend/src/main/resources/db/migration/tenant/`:

- `V10__create_runbook_frameworks.sql`
- `V11__create_runbooks.sql`
- `V12__create_runbook_executions.sql`
- `V13__create_runbook_reviews_schedules.sql`
- `V14__seed_runbook_frameworks.sql` (frameworks + top clauses)

#### V10 — frameworks & clauses

```sql
CREATE TABLE IF NOT EXISTS runbook_frameworks (
    framework_id      SERIAL PRIMARY KEY,
    code              VARCHAR(50) NOT NULL UNIQUE,         -- e.g. CBN-RBCSF-OFI
    name              TEXT NOT NULL,
    issuer            VARCHAR(100),
    jurisdiction      VARCHAR(10) NOT NULL DEFAULT 'NG',   -- NG | GLOBAL | EU | US
    version_label     VARCHAR(50),
    source_url        TEXT,
    is_internal       BOOLEAN NOT NULL DEFAULT FALSE,      -- tenant internal policy
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS runbook_framework_clauses (
    clause_id         BIGSERIAL PRIMARY KEY,
    framework_id      INT NOT NULL REFERENCES runbook_frameworks(framework_id),
    clause_ref        VARCHAR(100) NOT NULL,               -- e.g. "A.5.18", "s.40", "§3.4.2"
    title             TEXT NOT NULL,
    requirement_text  TEXT,
    domain            VARCHAR(100),                        -- Access | VulnMgmt | IR | Config | Crypto | BCP | Privacy | AML
    deadline_rule     TEXT,                                -- "72 hours from awareness"
    sla_minutes       INT,
    UNIQUE (framework_id, clause_ref)
);
CREATE INDEX idx_rfc_domain ON runbook_framework_clauses(domain);
```

#### V11 — runbooks, versions, structure

```sql
CREATE TABLE IF NOT EXISTS runbooks (
    runbook_id            BIGSERIAL PRIMARY KEY,
    runbook_code          VARCHAR(50) NOT NULL UNIQUE,      -- RB-ACC-001
    title                 TEXT NOT NULL,
    category              VARCHAR(50) NOT NULL,             -- ACCESS_REVIEW | VULN_MGMT | INCIDENT | CONFIG_AUDIT | CRYPTO | BCP_DR | PRIVACY | AML | RETURNS | VENDOR | CHANGE | LOGGING | CUSTOM
    objective             TEXT,
    scope_systems         JSONB NOT NULL DEFAULT '[]',      -- ["Finacle UBS","AD","Core DB"]
    scope_teams           JSONB NOT NULL DEFAULT '[]',
    owner_user_id         INT,
    owner_name            TEXT,
    criticality           VARCHAR(20) NOT NULL DEFAULT 'MEDIUM', -- LOW|MEDIUM|HIGH|CRITICAL
    frequency             VARCHAR(30),                      -- ON_DEMAND|DAILY|WEEKLY|MONTHLY|QUARTERLY|SEMI_ANNUAL|ANNUAL|EVENT_DRIVEN
    sla_minutes           INT,                              -- for time-boxed regulatory runbooks
    status                VARCHAR(30) NOT NULL DEFAULT 'DRAFT',  -- DRAFT|IN_REVIEW|PUBLISHED|DEPRECATED|ARCHIVED
    current_version_id    BIGINT,
    source_template_id    BIGINT,                           -- platform template origin
    source_template_ver   INT,
    linked_obligation_ids JSONB NOT NULL DEFAULT '[]',
    linked_control_ids    JSONB NOT NULL DEFAULT '[]',
    tags                  JSONB NOT NULL DEFAULT '[]',
    created_by_user_id    INT,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_runbooks_category_status ON runbooks(category, status);
CREATE INDEX idx_runbooks_owner ON runbooks(owner_user_id);

CREATE TABLE IF NOT EXISTS runbook_versions (
    version_id        BIGSERIAL PRIMARY KEY,
    runbook_id        BIGINT NOT NULL REFERENCES runbooks(runbook_id),
    version_number    INT NOT NULL,
    change_summary    TEXT,
    content_hash      CHAR(64),                             -- SHA-256 of canonical JSON
    status            VARCHAR(30) NOT NULL DEFAULT 'DRAFT', -- DRAFT|IN_REVIEW|PUBLISHED|SUPERSEDED
    authored_by_user_id INT,
    approved_by_user_id INT,
    approved_at       TIMESTAMPTZ,
    published_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (runbook_id, version_number)
);

CREATE TABLE IF NOT EXISTS runbook_sections (
    section_id    BIGSERIAL PRIMARY KEY,
    version_id    BIGINT NOT NULL REFERENCES runbook_versions(version_id) ON DELETE CASCADE,
    sort_order    INT NOT NULL,
    section_type  VARCHAR(30) NOT NULL,     -- PRECHECK|EXECUTION|VERIFICATION|CLOSEOUT|ROLLBACK
    title         TEXT NOT NULL,
    description   TEXT
);

CREATE TABLE IF NOT EXISTS runbook_steps (
    step_id               BIGSERIAL PRIMARY KEY,
    section_id            BIGINT NOT NULL REFERENCES runbook_sections(section_id) ON DELETE CASCADE,
    sort_order            INT NOT NULL,
    step_code             VARCHAR(20),                 -- 3.2
    title                 TEXT NOT NULL,
    instruction_md        TEXT NOT NULL,               -- imperative, ≤ 3 sentences (lint)
    command_block         TEXT,                        -- exact command/query/UI path
    command_lang          VARCHAR(30),                 -- bash|powershell|sql|finacle|ui|api|none
    expected_result       TEXT,
    duration_estimate_min INT,
    assigned_role         VARCHAR(30),                 -- ANALYST|CCO|TENANT_ADMIN|AUDITOR|IT_OPS|DPO|CUSTOM
    is_blocking           BOOLEAN NOT NULL DEFAULT TRUE,  -- failure halts execution
    requires_dual_control BOOLEAN NOT NULL DEFAULT FALSE, -- second approver to pass
    allow_skip            BOOLEAN NOT NULL DEFAULT FALSE,
    safety_note           TEXT                         -- "This step modifies production"
);
CREATE INDEX idx_runbook_steps_section ON runbook_steps(section_id, sort_order);

CREATE TABLE IF NOT EXISTS runbook_step_evidence_reqs (
    req_id          BIGSERIAL PRIMARY KEY,
    step_id         BIGINT NOT NULL REFERENCES runbook_steps(step_id) ON DELETE CASCADE,
    evidence_type   VARCHAR(30) NOT NULL,    -- SCREENSHOT|LOG_FILE|QUERY_OUTPUT|TICKET_REF|ATTESTATION|DOCUMENT|CONFIG_EXPORT|EMAIL|SIGNED_FORM
    label           TEXT NOT NULL,           -- "AD inactive-accounts export (CSV)"
    is_mandatory    BOOLEAN NOT NULL DEFAULT TRUE,
    retention_years INT DEFAULT 7,           -- CBN: min 5–7; NDPA: purpose-bound
    accepted_mime   JSONB DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS runbook_prerequisites (
    prereq_id     BIGSERIAL PRIMARY KEY,
    version_id    BIGINT NOT NULL REFERENCES runbook_versions(version_id) ON DELETE CASCADE,
    prereq_type   VARCHAR(20) NOT NULL,      -- ACCESS|TOOL|CREDENTIAL|APPROVAL|DATA|WINDOW
    label         TEXT NOT NULL,
    detail        TEXT,                      -- "Read-only on AD OU=Users; Nessus Pro licence"
    is_mandatory  BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS runbook_escalation_paths (
    escalation_id   BIGSERIAL PRIMARY KEY,
    version_id      BIGINT NOT NULL REFERENCES runbook_versions(version_id) ON DELETE CASCADE,
    level           INT NOT NULL,            -- 1,2,3
    trigger_type    VARCHAR(30) NOT NULL,    -- STEP_FAILED|SLA_50|SLA_80|SLA_BREACH|MANUAL
    notify_role     VARCHAR(30),
    notify_user_id  INT,
    notify_channel  VARCHAR(20) DEFAULT 'EMAIL',  -- EMAIL|IN_APP|WEBHOOK|SMS
    wait_minutes    INT DEFAULT 0,           -- time before escalating to this level
    instructions    TEXT                     -- "Call CISO on duty; open P1 in ServiceDesk"
);

CREATE TABLE IF NOT EXISTS runbook_rollback_steps (
    rollback_id   BIGSERIAL PRIMARY KEY,
    version_id    BIGINT NOT NULL REFERENCES runbook_versions(version_id) ON DELETE CASCADE,
    sort_order    INT NOT NULL,
    reverses_step_id BIGINT REFERENCES runbook_steps(step_id),
    title         TEXT NOT NULL,
    instruction_md TEXT NOT NULL,
    command_block TEXT,
    verification  TEXT
);

CREATE TABLE IF NOT EXISTS runbook_clause_map (
    runbook_id  BIGINT NOT NULL REFERENCES runbooks(runbook_id) ON DELETE CASCADE,
    clause_id   BIGINT NOT NULL REFERENCES runbook_framework_clauses(clause_id),
    PRIMARY KEY (runbook_id, clause_id)
);

CREATE TABLE IF NOT EXISTS runbook_step_clause_map (
    step_id   BIGINT NOT NULL REFERENCES runbook_steps(step_id) ON DELETE CASCADE,
    clause_id BIGINT NOT NULL REFERENCES runbook_framework_clauses(clause_id),
    PRIMARY KEY (step_id, clause_id)
);

CREATE TABLE IF NOT EXISTS runbook_version_approvals (
    approval_id   BIGSERIAL PRIMARY KEY,
    version_id    BIGINT NOT NULL REFERENCES runbook_versions(version_id),
    approver_user_id INT NOT NULL,
    approver_role VARCHAR(30),
    decision      VARCHAR(20) NOT NULL,      -- APPROVED|REJECTED|CHANGES_REQUESTED
    comment       TEXT,
    decided_at    TIMESTAMPTZ DEFAULT NOW()
);
```

#### V12 — executions & evidence

```sql
CREATE TABLE IF NOT EXISTS runbook_executions (
    execution_id      BIGSERIAL PRIMARY KEY,
    execution_ref     VARCHAR(40) NOT NULL UNIQUE,  -- RBX-2026-000123
    runbook_id        BIGINT NOT NULL REFERENCES runbooks(runbook_id),
    version_id        BIGINT NOT NULL REFERENCES runbook_versions(version_id),
    trigger_type      VARCHAR(20) NOT NULL,         -- SCHEDULED|MANUAL|INCIDENT|FINDING|REVIEW
    trigger_ref_id    BIGINT,                       -- finding_id / incident id / schedule id
    operator_user_id  INT NOT NULL,
    operator_name     TEXT,
    status            VARCHAR(30) NOT NULL DEFAULT 'NOT_STARTED', -- NOT_STARTED|PREFLIGHT|IN_PROGRESS|PAUSED|ESCALATED|ROLLING_BACK|COMPLETED_PASS|COMPLETED_FAIL|ABORTED|PENDING_SIGNOFF|CLOSED
    started_at        TIMESTAMPTZ,
    due_at            TIMESTAMPTZ,                  -- started_at + sla_minutes
    completed_at      TIMESTAMPTZ,
    closed_at         TIMESTAMPTZ,
    outcome_summary   TEXT,
    steps_total       INT DEFAULT 0,
    steps_passed      INT DEFAULT 0,
    steps_failed      INT DEFAULT 0,
    steps_skipped     INT DEFAULT 0,
    evidence_count    INT DEFAULT 0,
    finding_id        BIGINT,                       -- auto-raised finding on fail
    pack_file_id      BIGINT,                       -- evidence pack in evidence_files
    pack_hash         CHAR(64),
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_rbx_runbook ON runbook_executions(runbook_id, started_at DESC);
CREATE INDEX idx_rbx_status_due ON runbook_executions(status, due_at);

CREATE TABLE IF NOT EXISTS runbook_step_executions (
    step_exec_id    BIGSERIAL PRIMARY KEY,
    execution_id    BIGINT NOT NULL REFERENCES runbook_executions(execution_id) ON DELETE CASCADE,
    step_id         BIGINT NOT NULL REFERENCES runbook_steps(step_id),
    sort_order      INT NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING|IN_PROGRESS|PASSED|FAILED|SKIPPED|BLOCKED|NA
    actual_result   TEXT,
    operator_notes  TEXT,
    performed_by_user_id INT,
    verified_by_user_id  INT,          -- dual control
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    skip_reason     TEXT,
    UNIQUE (execution_id, step_id)
);

CREATE TABLE IF NOT EXISTS runbook_evidence_items (
    evidence_id     BIGSERIAL PRIMARY KEY,
    step_exec_id    BIGINT NOT NULL REFERENCES runbook_step_executions(step_exec_id) ON DELETE CASCADE,
    req_id          BIGINT REFERENCES runbook_step_evidence_reqs(req_id),
    evidence_type   VARCHAR(30) NOT NULL,
    file_id         BIGINT,                          -- evidence_files.file_id (Vault)
    external_ref    TEXT,                            -- ticket no., email id
    attestation_text TEXT,
    sha256          CHAR(64),
    captured_by_user_id INT NOT NULL,
    captured_at     TIMESTAMPTZ DEFAULT NOW(),
    is_immutable    BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS runbook_execution_escalations (
    exec_esc_id    BIGSERIAL PRIMARY KEY,
    execution_id   BIGINT NOT NULL REFERENCES runbook_executions(execution_id) ON DELETE CASCADE,
    level          INT NOT NULL,
    trigger_type   VARCHAR(30) NOT NULL,
    notified_user_id INT,
    notified_role  VARCHAR(30),
    channel        VARCHAR(20),
    sent_at        TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by_user_id INT,
    notes          TEXT
);

CREATE TABLE IF NOT EXISTS runbook_execution_signoffs (
    signoff_id    BIGSERIAL PRIMARY KEY,
    execution_id  BIGINT NOT NULL REFERENCES runbook_executions(execution_id) ON DELETE CASCADE,
    signoff_role  VARCHAR(30) NOT NULL,     -- OPERATOR|REVIEWER|CCO|AUDITOR
    user_id       INT NOT NULL,
    decision      VARCHAR(20) NOT NULL,     -- ACCEPTED|REJECTED
    comment       TEXT,
    signed_at     TIMESTAMPTZ DEFAULT NOW()
);
```

#### V13 — schedules & reviews

```sql
CREATE TABLE IF NOT EXISTS runbook_schedules (
    schedule_id    BIGSERIAL PRIMARY KEY,
    runbook_id     BIGINT NOT NULL REFERENCES runbooks(runbook_id) ON DELETE CASCADE,
    cron_expr      VARCHAR(100),             -- or frequency-derived
    timezone       VARCHAR(50) DEFAULT 'Africa/Lagos',
    lead_days      INT DEFAULT 5,            -- create execution N days before due
    assignee_user_id INT,
    assignee_role  VARCHAR(30),
    next_run_at    TIMESTAMPTZ,
    last_run_at    TIMESTAMPTZ,
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    skip_holidays  BOOLEAN NOT NULL DEFAULT TRUE   -- uses holidays module
);

CREATE TABLE IF NOT EXISTS runbook_review_schedules (
    review_sched_id BIGSERIAL PRIMARY KEY,
    runbook_id      BIGINT NOT NULL REFERENCES runbooks(runbook_id) ON DELETE CASCADE,
    cadence         VARCHAR(20) NOT NULL DEFAULT 'ANNUAL',  -- QUARTERLY|SEMI_ANNUAL|ANNUAL
    next_review_at  DATE NOT NULL,
    reviewer_user_id INT,
    reviewer_role   VARCHAR(30) DEFAULT 'CCO'
);

CREATE TABLE IF NOT EXISTS runbook_review_events (
    review_id       BIGSERIAL PRIMARY KEY,
    runbook_id      BIGINT NOT NULL REFERENCES runbooks(runbook_id),
    trigger_type    VARCHAR(30) NOT NULL,   -- SCHEDULED|INSTRUMENT_CHANGED|INFRA_CHANGED|EXEC_FAILURE_RATE|MANUAL
    trigger_ref     TEXT,                   -- instrument id / change ticket
    status          VARCHAR(20) NOT NULL DEFAULT 'OPEN',  -- OPEN|IN_PROGRESS|NO_CHANGE|REVISED|CLOSED
    opened_at       TIMESTAMPTZ DEFAULT NOW(),
    reviewer_user_id INT,
    outcome_notes   TEXT,
    resulting_version_id BIGINT,
    closed_at       TIMESTAMPTZ
);
CREATE INDEX idx_rb_review_open ON runbook_review_events(status, opened_at);
```

> Follow `.opencode/skills/db-migration` for naming, idempotency and `IF NOT EXISTS` conventions already used in V4–V9.

---

## 4. Key Use Cases → Seed Runbook Templates

Each template below ships in the **platform template library** (intelligence side) and is pushed to tenants by licence tier. Steps are written in actionable, imperative form. Commands are examples; tenants edit `command_block` for their stack (Finacle, AD, Oracle/PostgreSQL, Fortinet, etc.).

### 4.1 RB-ACC-001 — Quarterly User Access Review

- **Objective:** Verify every active account on in-scope systems maps to a current employee/contractor with least-privilege role; remove dormant/orphaned accounts.
- **Clauses:** CBN-RBCSF-OFI §Access Control; ISO 27001 A.5.15/A.5.16/A.5.18; PCI 7.2.4/8.2.6; NIST AC-2(3); COBIT DSS05.04
- **Frequency:** QUARTERLY · **Criticality:** HIGH · **Roles:** IT_OPS performs, ANALYST reviews, CCO signs
- **Prerequisites:** Read access to AD / core banking user table; current HR headcount export (DATA); approval ticket for the review window.

| § | Step | Command block (example) | Evidence |
|---|---|---|---|
| 1.1 | Export HR active staff list as of review date | HRIS export → CSV | DOCUMENT (HR export) |
| 1.2 | Export all AD accounts with lastLogon, enabled flag | `Get-ADUser -Filter * -Properties LastLogonDate,Enabled,MemberOf \| Export-Csv ad_users.csv` | QUERY_OUTPUT |
| 1.3 | Export core banking users & roles | Finacle: `SELECT USER_ID, USER_NAME, ROLE, LAST_LOGIN, STATUS FROM UPR WHERE BANK_ID='01'` (adapt) | QUERY_OUTPUT |
| 1.4 | Export DB privileged roles | `SELECT rolname, rolsuper, rolcreaterole FROM pg_roles;` | QUERY_OUTPUT |
| 2.1 | Reconcile system users vs HR list; flag not-in-HR | Spreadsheet / Atheris reconciliation helper | QUERY_OUTPUT |
| 2.2 | Flag accounts with no login > 90 days | Filter `LastLogonDate < today-90` | QUERY_OUTPUT |
| 2.3 | Flag privileged accounts; confirm each has approval on file | Compare to privileged access register | DOCUMENT |
| 2.4 | Send role-appropriateness attestation to each line manager | Atheris notification → manager attests in-app | ATTESTATION |
| 3.1 | Disable dormant/orphaned accounts (**dual control**) | `Disable-ADAccount -Identity <sam>`; Finacle user disable per SOP | SCREENSHOT + TICKET_REF |
| 3.2 | Verify disabled accounts cannot authenticate | Test login attempt / `Get-ADUser <sam> -Properties Enabled` | SCREENSHOT |
| 4.1 | Compile review summary: counts, exceptions, actions | Auto-generated by Atheris | DOCUMENT |
| 4.2 | CCO sign-off | In-app sign-off | ATTESTATION |

- **Escalation:** L1 ANALYST (step fail, 0 min) → L2 CCO (SLA 80%) → L3 TENANT_ADMIN/CISO (SLA breach).
- **Rollback:** Re-enable account `Enable-ADAccount -Identity <sam>`; document in ticket; re-verify login.
- **Auto-outputs:** Finding per orphaned privileged account; Control test result on linked control.

### 4.2 RB-VUL-001 — Monthly Vulnerability Scan, Patch & Report

- **Clauses:** CBN-RBCSF §Vulnerability Mgmt; ISO 27001 A.8.8; PCI 6.3/11.3; NIST RA-5/SI-2; CIS 7
- **Frequency:** MONTHLY (internal), QUARTERLY (external/ASV) · **Criticality:** HIGH
- **Steps (summary):** Confirm scan scope = asset register → run authenticated scan (`nessuscli`, Qualys, OpenVAS `gvm-cli`) → export results → triage by CVSS ≥ 7 within 30 days (PCI: critical ≤ 30d; CBN RBCSF high-risk per policy) → raise change tickets → patch in test → patch prod in window → rescan to verify → report to CISO/CCO.
- **Evidence:** Scan report (DOCUMENT), ticket refs, pre/post rescan outputs (QUERY_OUTPUT), exception approvals for deferred patches (SIGNED_FORM).
- **Escalation:** critical CVE unpatched > SLA → CISO → MD/Board risk committee.
- **Rollback:** Snapshot/backup before patch; `yum history undo <id>` / Windows uninstall KB / VM snapshot revert; verify service health.

### 4.3 RB-INC-001 — Data Breach Response & Regulatory Notification (NDPA / CBN)

- **Clauses:** NDPA s.40; NDPA-GAID; CBN-RBCSF incident reporting (24h); Cybercrimes Act reporting; ISO 27001 A.5.24–A.5.28; NIST IR-4/IR-6; GDPR Art.33/34; PCI 12.10
- **Frequency:** EVENT_DRIVEN · **Criticality:** CRITICAL · **SLA:** `sla_minutes = 4320` (72h) with milestones at 24h (CBN) and 72h (NDPC)
- **Sections:**
  - **Pre-check (T+0–1h):** Confirm incident commander; open incident ticket; start evidence log; preserve logs (`cp -a /var/log /forensics/<id>/; sha256sum`).
  - **Containment (T+1–8h):** Isolate affected hosts (firewall rule / NAC quarantine); revoke compromised credentials; rotate keys/tokens; block IOCs.
  - **Assessment (T+8–24h):** Determine personal data categories & data subject count; classify severity; determine "likely to result in harm" (NDPA trigger).
  - **Regulatory notification — CBN (≤24h):** Fill Atheris CBN Initial Incident Report template → CISO approves → submit per CBN channel → capture acknowledgement.
  - **Regulatory notification — NDPC (≤72h):** Fill NDPC breach notification form (nature, categories, approx number, DPO contact, likely consequences, measures taken) → DPO & CCO approve → submit → capture acknowledgement.
  - **Data subject notification (if high risk):** Draft notice; legal review; dispatch; log.
  - **Eradication & Recovery:** Patch root cause; restore from clean backup; monitor 14 days.
  - **Close-out:** Post-incident review within 10 business days; update controls; raise Findings; feed loss event to op-risk.
- **Escalation:** L1 SOC → L2 CISO (15 min) → L3 CCO + DPO (30 min) → L4 MD/CEO & Board Chair of Risk (2h or if ≥ 1,000 subjects).
- **Rollback:** Remove containment rules after validation; restore service; document.
- **Evidence:** forensic hash manifest, timeline, regulator submission receipts (EMAIL/DOCUMENT), approvals (SIGNED_FORM).

### 4.4 RB-CFG-001 — Server/Firewall/DB Configuration Baseline Audit

- **Clauses:** CBN-ITSB; ISO 27001 A.8.9; PCI 2.2; NIST CM-6; CIS Benchmarks
- **Frequency:** QUARTERLY · **Criticality:** HIGH
- **Steps:** Pull baseline (CIS Benchmark / internal hardening std) → run checker (`oscap xccdf eval --profile cis ...`, `Lynis audit system`, `Invoke-CISBenchmark`, FortiGate `show full-configuration`, `pg_settings` dump) → diff vs baseline → classify deviations → approve exceptions or remediate via change → rescan → sign-off.
- **Evidence:** CONFIG_EXPORT (hashed), deviation report, change tickets.
- **Rollback:** Restore last known-good config (`execute restore config`, `git checkout <tag>` for IaC), verify connectivity & services.

### 4.5 RB-CRY-001 — Encryption Key & Certificate Rotation

- **Clauses:** ISO 27001 A.8.24; PCI 3.6/3.7; NIST SC-12; CBN-RBCSF cryptography
- **Frequency:** ANNUAL (keys), per-expiry (certs) · **Criticality:** HIGH · **Dual control mandatory**
- **Steps:** Inventory keys/certs → pre-rotation backup to HSM/escrow → generate new key (`openssl`, KMS `aws kms rotate-key-on-demand`, HSM procedure) → re-encrypt/re-issue → cutover → verify (`openssl s_client -connect host:443`) → retire old key after grace → update register.
- **Rollback:** Re-activate previous key version; revert cert binding; verify.

### 4.6 RB-BCP-001 — Backup Integrity & DR Restore Test

- **Clauses:** CBN-BCP; ISO 22301; ISO 27001 A.8.13/A.8.14; NIST CP-9/CP-10
- **Frequency:** QUARTERLY (restore test), ANNUAL (full DR drill)
- **Steps:** Select sample backups → verify checksum → restore to isolated env (`pg_restore`, Finacle DR procedure) → run integrity queries → measure RTO/RPO achieved vs targets → report.

### 4.7 RB-LOG-001 — Privileged Activity & Security Log Review

- **Clauses:** ISO 27001 A.8.15/A.8.16; PCI 10.4; CBN-RBCSF monitoring
- **Frequency:** WEEKLY (privileged), DAILY (SIEM alerts)
- **Steps:** Pull privileged session logs (SIEM query), failed logins, after-hours access, DB admin actions (`pgaudit`), Finacle maker-checker overrides → review → raise exceptions → attest.

### 4.8 RB-RET-001 — Regulatory Return Preparation & Submission

- **Clauses:** CBN-RETURNS (links to existing `returns` module)
- **Frequency:** per return calendar
- **Steps:** Pull data extract → validate against prior period (variance > X% flagged) → maker prepares → checker reviews → CCO approves → submit on CBN portal → capture acknowledgement → file in Vault.

### 4.9 RB-PRV-001 — Data Subject Access Request (NDPA)

- **Clauses:** NDPA ss.34–38; NDPA-GAID; GDPR Art.15
- **SLA:** 30 days (configurable)
- **Steps:** Verify identity → log request → locate data across systems → compile → legal/DPO review → respond → record.

### 4.10 RB-AML-001 — Suspicious Transaction Report Filing

- **Clauses:** CBN-AML; NFIU goAML
- **SLA:** 24h
- **Steps:** Alert triage → investigate → MLRO decision → draft STR on goAML → submit → capture ref → retain 5 years.

### 4.11 RB-VND-001 — Third-Party / Vendor Security Review

- **Clauses:** CBN-RBCSF third-party risk; ISO 27001 A.5.19–A.5.23; NDPA processor obligations
- **Frequency:** ANNUAL per critical vendor

### 4.12 RB-CHG-001 — Emergency Change Control

- **Clauses:** CBN-ITSB; ISO 27001 A.8.32; COBIT BAI06
- **Frequency:** EVENT_DRIVEN · includes mandatory rollback plan validation step.

> **Template content is produced in Phase 6 (see §12); each template includes full step text, command blocks per stack variant (AD/LDAP, Finacle/T24/BankOne, PostgreSQL/Oracle/MSSQL, Linux/Windows, Fortinet/Cisco/Palo Alto), evidence reqs, escalation and rollback.**

---

## 5. Pages (Tenant Frontend `:5174`)

Follow `atheris-register-page` + `frontend-register-page` skills: MUI 7 table pages, server-side pagination, filter bar, detail drawers/pages, role-gated actions. Add nav section **"Runbooks"** in sidebar between *Controls* and *Findings*.

| # | Route | Page component | Purpose | Roles |
|---|---|---|---|---|
| P1 | `/runbooks` | `RunbooksLibraryPage.jsx` | Register of all runbooks; filters: category, status, framework, owner, criticality, frequency, "due this month", "needs review". KPI tiles: Published, Due in 30d, Overdue reviews, Failed last run. | all |
| P2 | `/runbooks/new`, `/runbooks/:id/edit` | `RunbookBuilderPage.jsx` | 5-step wizard (see §7). Autosaves draft version. Inline linter. | CCO, TENANT_ADMIN, ANALYST (draft only) |
| P3 | `/runbooks/:id` | `RunbookDetailPage.jsx` | Tabs: Overview · Steps · Prerequisites · Escalation & Rollback · Framework Mapping · Versions · Executions · Reviews · Schedule. Actions: Execute, Schedule, Request Review, Publish, Deprecate, Clone, Export (PDF/MD). | all (actions gated) |
| P4 | `/runbooks/executions` | `ExecutionsPage.jsx` | All executions; filters: status, runbook, operator, date, overdue. Columns: ref, runbook, version, operator, started, due (countdown chip), status, pass/fail counts, evidence count. | all |
| P5 | `/runbooks/executions/:execId` | `ExecutionConsolePage.jsx` | **The core UX.** Left: step list with status icons & progress. Centre: current step card (instruction, command block with copy button, expected result, evidence slots, Pass/Fail/Skip/N/A). Right: SLA timer, escalation status, prerequisites checklist, operator notes. Sticky footer: Prev / Next / Pause / Abort / Trigger Rollback. | operator, reviewers |
| P6 | `/runbooks/executions/:execId/summary` | `ExecutionSummaryPage.jsx` | Read-only outcome; evidence gallery; sign-off panel; Generate Evidence Pack; Raise Finding; link to Control Test Result. | all |
| P7 | `/runbooks/calendar` | `RunbookCalendarPage.jsx` | Month/quarter view of scheduled executions & review due dates; Nigerian public holidays shaded (holidays module). | all |
| P8 | `/runbooks/reviews` | `ReviewQueuePage.jsx` | Open review events (scheduled + triggered by instrument changes from intelligence webhooks). Actions: Mark no-change / Open revision / Assign. | CCO, TENANT_ADMIN, ANALYST |
| P9 | `/runbooks/approvals` | `ApprovalsPage.jsx` | Versions awaiting approval; diff viewer; Approve/Reject/Request changes. | CCO, TENANT_ADMIN |
| P10 | `/runbooks/coverage` | `CoverageMatrixPage.jsx` | Framework × clause grid: covered by runbook (green), covered by control only (amber), uncovered (red). Filter by framework (CBN RBCSF OFI, ISO 27001, PCI…). Export. | all |
| P11 | `/runbooks/templates` | `TemplateLibraryPage.jsx` | Platform templates available to tenant; "Adopt" → creates tenant runbook v1 draft with provenance. Shows template version updates ("Template updated: NDPA GAID 2025 clause added"). | CCO, TENANT_ADMIN |
| P12 | `/runbooks/analytics` | `RunbookAnalyticsPage.jsx` | Execution pass rate trend, mean time to complete, SLA breaches, evidence completeness, top failing steps, coverage % by framework, operator workload. | CCO, TENANT_ADMIN, AUDITOR |
| P13 | `/runbooks/evidence/:execId` (or Vault filter) | reuse `EvidenceVaultPage` with `sourceType=RUNBOOK_EXECUTION` | Evidence browsing | AUDITOR, CCO |
| P14 | `/settings` → tab **Runbooks** | `RunbookSettingsTab.jsx` | Default SLA warnings (50/80%), evidence retention, mandatory dual-control categories, escalation defaults, lint strictness, numbering scheme. | TENANT_ADMIN |

**Dashboard integration:** add "Runbooks" widget to `DashboardV2Page` and `CcoDashboardPage`: upcoming executions (7d), overdue, open escalations, review backlog.

**Public page (optional, reuse remediation pattern):** `/public/attest/:token` — manager attestation link for access reviews without login (mirrors `PublicRemediatePage`).

---

## 6. Modals & Drawers

| ID | Name | Opens from | Content / fields | Validation |
|---|---|---|---|---|
| M1 | **Create Runbook** | P1 "+ New" | Title, Category, Criticality, Owner, Frequency, "Start from template?" (select) | Title ≥ 5 chars; category required |
| M2 | **Adopt Template** | P11 | Template preview (steps count, clauses), target owner, rename, "map to obligations" multiselect (prefills from category) | owner required |
| M3 | **Add/Edit Step** | Builder step 3 | Title, Instruction (markdown, lint hints), Command block + language, Expected result, Duration, Assigned role, Blocking toggle, Dual-control toggle, Allow skip, Safety note, Evidence requirements (repeater), Clause tags | Instruction imperative; ≤ 400 chars warning; evidence req label required if mandatory |
| M4 | **Add Prerequisite** | Builder step 2 | Type, Label, Detail, Mandatory | |
| M5 | **Add Escalation Level** | Builder step 4 | Level, Trigger, Role/User, Channel, Wait minutes, Instructions | levels unique & ascending |
| M6 | **Add Rollback Step** | Builder step 4 | Reverses step (select), Title, Instruction, Command, Verification | |
| M7 | **Map Framework Clauses** | Builder step 1 / Detail | Framework select → clause search (ref/title/domain) → multi-add; shows already-mapped | ≥1 clause or internal policy |
| M8 | **Link Obligations/Controls** | Builder step 1 | Search existing obligations & controls; chips | |
| M9 | **Publish Version** | Detail / Approvals | Change summary (required), diff preview, approval routing (CCO), effective date | summary ≥ 10 chars; lint errors = 0 |
| M10 | **Version Diff** | Versions tab | Side-by-side step diff (added/removed/changed) | |
| M11 | **Start Execution** | Detail / Library row / Calendar | Version (latest published default), Operator, Trigger type/ref, Due override (if no SLA), Notify list | prerequisites acknowledged |
| M12 | **Pre-flight Checklist** | Execution console (first open) | Each prerequisite with checkbox + optional evidence; "I have required access" attestation | all mandatory ticked |
| M13 | **Capture Evidence** | Step card | Tabs: Upload file (drag-drop → Vault), Paste output (saved as .txt), Ticket/External ref, Attestation text; shows SHA-256 on save | mandatory reqs satisfied before Pass |
| M14 | **Fail Step** | Step card | Actual result, failure category (Blocked / Deviation / Error / Not applicable), Raise Finding? (prefill), Trigger escalation level, Continue / Pause / Rollback choice | actual result required |
| M15 | **Skip Step** | Step card (if allow_skip) | Reason, approver (if dual control) | reason ≥ 10 chars |
| M16 | **Dual-Control Verify** | Step with `requires_dual_control` | Second user re-auth (password) + confirm | verifier ≠ performer |
| M17 | **Escalate Now** | Console right panel | Level select, message, channel | |
| M18 | **Trigger Rollback** | Console footer | Confirm; shows rollback steps; reason | reason required |
| M19 | **Abort Execution** | Console footer | Reason, notify list | |
| M20 | **Sign-off** | Summary page | Role, decision, comment; shows evidence completeness % | 100% mandatory evidence for ACCEPT |
| M21 | **Generate Evidence Pack** | Summary | Options: include commands, include screenshots inline, redact fields, auditor name/firm; produces PDF + ZIP + manifest.json (hashes) | |
| M22 | **Schedule Runbook** | Detail / Calendar | Frequency → cron builder, timezone, lead days, assignee, skip holidays | |
| M23 | **Review Decision** | P8 | No change / Revise (opens builder with new draft version) / Deprecate; notes | |
| M24 | **Approve Version** | P9 | Decision, comment | |
| M25 | **Deprecate / Archive** | Detail | Reason, replacement runbook (optional) | |
| M26 | **Clone Runbook** | Detail | New title/code | |
| M27 | **Export Runbook** | Detail | PDF / Markdown / JSON (portable format for Git) | |
| M28 | **Import Runbook (JSON/MD)** | Library | Upload; validation report | schema valid |
| M29 | **Lint Report** | Builder | List of warnings/errors with jump-to-step | |
| M30 | **Template Update Available** | P11 / Detail banner | Shows platform template diff → "Create revision from update" | |

---

## 7. Runbook Builder — Wizard Steps

```
Step 1  Objective & Scope      → title, code (auto RB-<CAT>-NNN), category, objective, systems, teams,
                                  owner, criticality, frequency, SLA, clause mapping (M7), obligations/controls (M8)
Step 2  Prerequisites          → repeater (M4); suggested prereqs by category
Step 3  Procedure              → sections (PRECHECK/EXECUTION/VERIFICATION/CLOSEOUT) with drag-sort steps (M3);
                                  live linter; "Insert from template step library"
Step 4  Escalation & Rollback  → escalation ladder (M5), rollback steps (M6), SLA warning thresholds
Step 5  Review & Publish       → lint summary (M29), preview as operator, review cadence, schedule (M22),
                                  Save Draft | Submit for Approval | Publish (if role allows & lint clean)
```

**Linter rules (`RunbookLintService`):**

| Rule | Severity | Check |
|---|---|---|
| L1 Imperative voice | WARN | Instruction starts with a verb (Pull, Run, Verify, Export, Disable…) |
| L2 Length | WARN | Instruction > 400 chars or > 3 sentences |
| L3 Evidence coverage | ERROR | Any EXECUTION step without ≥1 evidence requirement |
| L4 Expected result | WARN | Missing `expected_result` on steps with a command block |
| L5 Prod-change safety | ERROR | Step whose command matches destructive patterns (`DROP`, `rm -rf`, `Disable-`, `Remove-`, `DELETE`) must have `safety_note` and a rollback step referencing it |
| L6 Escalation | ERROR | No escalation level defined for CRITICAL/HIGH runbooks |
| L7 Clause mapping | ERROR | No framework clause or internal policy mapped |
| L8 Role | WARN | Step without `assigned_role` |
| L9 Secrets | ERROR | Command block contains apparent password/token literal |
| L10 Timing | WARN | SLA set but no SLA_80 escalation trigger |

---

## 8. Process Flows & State Machines

### 8.1 Runbook lifecycle

```
DRAFT ──submit──▶ IN_REVIEW ──approve──▶ PUBLISHED ──new draft──▶ (DRAFT vN+1, PUBLISHED vN stays executable)
  ▲                  │ reject                  │
  └──────────────────┘                         ├──deprecate──▶ DEPRECATED ──archive──▶ ARCHIVED
                                               └──review event (scheduled/instrument change)──▶ REVIEW OPEN
```

Rules: only PUBLISHED versions execute; publishing vN+1 sets vN → SUPERSEDED (running executions continue on vN); content hash computed at publish; approvals required for HIGH/CRITICAL (configurable).

### 8.2 Execution lifecycle

```
NOT_STARTED → PREFLIGHT → IN_PROGRESS ⇄ PAUSED
                               │
                               ├─ step FAILED (blocking) → ESCALATED → (resume | ROLLING_BACK → COMPLETED_FAIL | ABORTED)
                               ├─ all steps terminal → PENDING_SIGNOFF → CLOSED (COMPLETED_PASS | COMPLETED_FAIL)
                               └─ abort → ABORTED
SLA timers: at 50% → in-app warn; 80% → escalation L(SLA_80); 100% → SLA_BREACH escalation + audit event
```

### 8.3 Step execution

```
PENDING → IN_PROGRESS → [evidence captured ≥ mandatory] → PASSED
                      → FAILED (M14) → raise finding? / escalate? / rollback?
                      → SKIPPED (if allow_skip, reason) | NA
Dual control: PASSED requires verifier ≠ performer (M16)
```

### 8.4 Review cycle

```
Scheduled (cadence) ─┐
Instrument changed  ─┼─▶ runbook_review_events(OPEN) ─▶ reviewer ─▶ NO_CHANGE | REVISED (new version) | DEPRECATE
Infra change ticket ─┤
Failure rate > 30%  ─┘
```

Trigger source for "Instrument changed": intelligence backend `evaluate_applicability` → webhook → tenant `notifications` → `RunbookReviewTriggerListener` matches instrument's obligations to `linked_obligation_ids` / clause codes.

### 8.5 Evidence integrity

1. File uploaded → stored via `FileStorageService` → `evidence_files` row (`source_type='RUNBOOK_STEP'`, `source_id=step_exec_id`).
2. SHA-256 computed server-side; stored on `runbook_evidence_items.sha256`; `is_immutable=true` → no update/delete endpoints (only supersede with reason, audited).
3. Evidence pack `manifest.json` lists every file + hash + capturer + UTC timestamp; pack itself hashed and stored (`pack_hash`).
4. All actions emit `audit_events` (existing `AuditService`): `RUNBOOK_PUBLISHED`, `EXECUTION_STARTED`, `STEP_PASSED/FAILED`, `EVIDENCE_CAPTURED`, `ESCALATION_SENT`, `ROLLBACK_TRIGGERED`, `SIGNOFF`, `PACK_GENERATED`.

### 8.6 Cross-module hooks

| Event | Effect |
|---|---|
| Execution COMPLETED_PASS/FAIL on runbook linked to control | Create `control_test_results` row (pass/fail, tester, date, evidence refs); complete matching `control_tasks` |
| Step FAILED with "Raise finding" | Create `findings` row (severity from criticality; linked obligation; owner = runbook owner; evidence linked) |
| Execution for RB-RET-* | Updates `returns` submission status + stores acknowledgement in Vault |
| Finding REMEDIATION requires procedure | Finding detail "Run remediation runbook" → execution with `trigger_type=FINDING` |
| Incident runbook started | Notification fan-out via `notifications` module to escalation L1 |
| Template updated on platform | Webhook → `runbook_review_events(trigger_type=INSTRUMENT_CHANGED)` + banner M30 |

---

## 9. API Endpoints (Tenant Backend `/api/v1`)

Follow `backend-module-scaffold` (entity/repository/service/controller/dto) and `api-sync` (mirror into `services/api.js`). Security via `@PreAuthorize("hasAnyRole(...)")` using `AppRole` constants.

### 9.1 Frameworks
```
GET    /runbooks/frameworks                         all + clause counts            [all]
GET    /runbooks/frameworks/{id}/clauses?q=&domain= search clauses                 [all]
POST   /runbooks/frameworks                         internal policy framework      [TENANT_ADMIN, CCO]
POST   /runbooks/frameworks/{id}/clauses                                            [TENANT_ADMIN, CCO]
```

### 9.2 Runbooks & versions
```
GET    /runbooks?page=&size=&category=&status=&frameworkId=&ownerId=&criticality=&dueWithinDays=&needsReview=
GET    /runbooks/stats                               KPI tiles
POST   /runbooks                                     create (DRAFT v1)             [ANALYST, CCO, TENANT_ADMIN]
GET    /runbooks/{id}                                detail incl. current version
PUT    /runbooks/{id}                                metadata                      [owner, CCO, TENANT_ADMIN]
DELETE /runbooks/{id}                                only DRAFT, no executions     [CCO, TENANT_ADMIN]
POST   /runbooks/{id}/clone
POST   /runbooks/{id}/deprecate | /archive
GET    /runbooks/{id}/versions
POST   /runbooks/{id}/versions                       new draft from current
GET    /runbooks/{id}/versions/{vid}                 full tree (sections, steps, prereqs, escalations, rollback)
PUT    /runbooks/{id}/versions/{vid}                 bulk save draft tree (autosave)
GET    /runbooks/{id}/versions/{vid}/diff/{otherVid}
POST   /runbooks/{id}/versions/{vid}/lint
POST   /runbooks/{id}/versions/{vid}/submit          → IN_REVIEW
POST   /runbooks/{id}/versions/{vid}/approve|reject  [CCO, TENANT_ADMIN]
POST   /runbooks/{id}/versions/{vid}/publish         [CCO, TENANT_ADMIN]
GET    /runbooks/{id}/export?format=pdf|md|json
POST   /runbooks/import                               JSON/MD                        [CCO, TENANT_ADMIN]
PUT    /runbooks/{id}/clauses   {clauseIds[]}
PUT    /runbooks/{id}/links     {obligationIds[], controlIds[]}
```

### 9.3 Schedules & reviews
```
GET/POST/PUT/DELETE /runbooks/{id}/schedules
GET    /runbooks/calendar?from=&to=                  executions due + reviews due
GET    /runbooks/reviews?status=
POST   /runbooks/{id}/reviews                        manual review event
POST   /runbooks/reviews/{reviewId}/decide           {decision, notes}             [ANALYST, CCO, TENANT_ADMIN]
GET    /runbooks/approvals/pending                                                  [CCO, TENANT_ADMIN]
```

### 9.4 Executions
```
GET    /runbooks/executions?status=&runbookId=&operatorId=&from=&to=&overdue=
GET    /runbooks/executions/stats
POST   /runbooks/{id}/executions                     start {versionId?, triggerType, triggerRefId, operatorId, dueAt?}
GET    /runbooks/executions/{execId}                 header + step executions + evidence + escalations
POST   /runbooks/executions/{execId}/preflight       {prereqAcks[]}
POST   /runbooks/executions/{execId}/steps/{stepExecId}/start
POST   /runbooks/executions/{execId}/steps/{stepExecId}/pass   {actualResult, notes}
POST   /runbooks/executions/{execId}/steps/{stepExecId}/fail   {actualResult, category, raiseFinding, escalateLevel, nextAction}
POST   /runbooks/executions/{execId}/steps/{stepExecId}/skip   {reason}
POST   /runbooks/executions/{execId}/steps/{stepExecId}/verify {password}  dual control
POST   /runbooks/executions/{execId}/steps/{stepExecId}/evidence   multipart | {externalRef|attestationText}
GET    /runbooks/executions/{execId}/steps/{stepExecId}/evidence
POST   /runbooks/executions/{execId}/pause | /resume | /abort {reason}
POST   /runbooks/executions/{execId}/escalate        {level, message}
POST   /runbooks/executions/{execId}/escalations/{id}/ack
POST   /runbooks/executions/{execId}/rollback        {reason} → creates rollback step executions
POST   /runbooks/executions/{execId}/signoff         {role, decision, comment}
POST   /runbooks/executions/{execId}/pack            generate evidence pack → file ids
GET    /runbooks/executions/{execId}/pack            download
GET    /runbooks/executions/{execId}/timeline        audit events
```

### 9.5 Templates (tenant ↔ platform)
```
GET    /runbooks/templates                           from platform via PlatformClient (shared/platform)
GET    /runbooks/templates/{tid}
POST   /runbooks/templates/{tid}/adopt               {ownerId, title?, obligationIds[]}
GET    /runbooks/templates/updates                   adopted templates with newer platform version
```

### 9.6 Analytics & coverage
```
GET    /runbooks/analytics/summary?from=&to=
GET    /runbooks/analytics/failing-steps
GET    /runbooks/coverage?frameworkId=
```

### 9.7 Platform (intelligence backend `:9090`, admin)
```
GET/POST/PUT   /admin/runbook-templates             CRUD, versioning, publish to tiers
POST           /admin/runbook-templates/{id}/publish → enqueue job `push_runbook_template` → webhooks to tenants
GET/POST       /admin/runbook-frameworks, /clauses   master framework library
```

**DTO naming:** `RunbookSummaryDto`, `RunbookDetailDto`, `RunbookVersionTreeDto`, `StepDto`, `ExecutionSummaryDto`, `ExecutionDetailDto`, `StepExecutionDto`, `EvidenceItemDto`, `CoverageCellDto`, `RunbookStatsDto`. Use Lombok `@Builder.Default` for collections per scaffold skill.

---

## 10. Role & Permission Matrix

| Action | ANALYST | CCO | TENANT_ADMIN | AUDITOR | IT_OPS* |
|---|---|---|---|---|---|
| View runbooks / executions / evidence | ✔ | ✔ | ✔ | ✔ (read-only) | ✔ |
| Create / edit draft | ✔ | ✔ | ✔ | ✖ | ✖ |
| Submit for approval | ✔ | ✔ | ✔ | ✖ | ✖ |
| Approve / publish | ✖ | ✔ | ✔ | ✖ | ✖ |
| Execute runbook | ✔ | ✔ | ✔ | ✖ | ✔ |
| Dual-control verify | ✔ (≠ performer) | ✔ | ✔ | ✖ | ✔ |
| Capture evidence | ✔ | ✔ | ✔ | ✖ | ✔ |
| Sign-off (CCO level) | ✖ | ✔ | ✔ | ✖ | ✖ |
| Auditor acceptance | ✖ | ✖ | ✖ | ✔ | ✖ |
| Generate evidence pack | ✔ | ✔ | ✔ | ✔ | ✖ |
| Manage schedules / settings | ✖ | ✔ | ✔ | ✖ | ✖ |
| Adopt templates | ✖ | ✔ | ✔ | ✖ | ✖ |
| Deprecate / archive | ✖ | ✔ | ✔ | ✖ | ✖ |

\*`IT_OPS` is a new `AppRole` constant (operator who runs technical steps but has no compliance authority). Add to `AppRole.java`, user admin UI, and LDAP role mapping.

---

## 11. Best-Practice Features Baked Into the Product

| Best practice | Product mechanism |
|---|---|
| **Version control** | Immutable `runbook_versions` with content hash, author, approver, change summary; side-by-side diff; JSON/MD export committed to tenant's Git via "Export" (v1) and Git webhook sync (v2). |
| **Regular reviews** | `runbook_review_schedules` (quarterly/annual) + event-triggered reviews when an instrument mapped to the runbook's obligations changes (horizon scanner → applicability → webhook), when a change ticket tag matches scope systems, or when execution failure rate > threshold. |
| **Actionable language** | Linter L1–L10 at authoring; operator view renders instruction → command → expected result in a fixed card so nothing is buried in prose. |
| **Evidence by design** | A step cannot pass without its mandatory evidence; evidence hashed, immutable, retention-tagged. |
| **Separation of duties** | Dual control on destructive/privileged steps; approver ≠ author; auditor acceptance distinct from CCO sign-off. |
| **Time-boxing** | SLA timers with 50/80/100% escalations — maps directly to NDPA 72h / CBN 24h / NFIU 24h. |
| **Rollback readiness** | Lint forces rollback step for destructive commands; rollback executed as tracked steps with their own evidence. |
| **Examiner-ready output** | Evidence Pack: cover page (framework clauses satisfied), procedure as executed, evidence index with hashes, sign-offs, deviation log. Formats aligned to CBN examination requests and ISO/SOC 2 auditor PBC lists. |
| **Nigerian calendar awareness** | Scheduler skips public holidays (holidays module) and shifts to prior business day for regulatory deadlines. |
| **Tenant isolation** | All tables tenant-scoped via existing `shared/tenant` context; storage path prefixed by tenant. |

---

## 12. Implementation Plan — Phases, Agents & Models

### 12.1 Working model

Per `AGENTS.md`, this repo is skill-driven: **load the matching skill, implement directly**. Use Claude Code sessions (one per phase or per workstream) and the built-in `Plan` / `Explore` / `general-purpose` agents only where parallelism helps. Model choice below balances cost against risk:

| Model | Use for |
|---|---|
| **Claude Opus 5.5** | Architecture decisions, state machines, security-sensitive services (evidence immutability, dual control, escalation timers), migration design, code review of the whole module |
| **Claude Sonnet 5.5** | Bulk CRUD backend modules, React pages/modals following the register-page skill, API client sync, tests |
| **Claude Haiku 5.5** | Seed data (framework clauses), template content drafting from outlines, lint rule fixtures, i18n/labels, docs, repetitive DTO mapping |
| **Claude Fable 5.1** (if available in the account) | Final cross-cutting review, regulatory content QA of templates (NDPA/CBN wording), BRD/TRD reconciliation |

Skills to load per task: `db-migration`, `backend-module-scaffold`, `api-sync`, `frontend-register-page`, `atheris-register-page`, `obligations-page` (for linking UX patterns).

### 12.2 Phases

| Phase | Deliverable | Skill(s) | Agent / model | Est. |
|---|---|---|---|---|
| **0. Spec reconciliation** | Add Runbook module to `Atheris_Compliance_BRD_v3_0.md` (new section) and `Atheris_Compliance_TRD_v2_0.md`; update `ARCHITECTURE.md` endpoint map & DB design; update `AGENTS.md` project structure | — | `Plan` agent → Opus 5.5 | 0.5 d |
| **1. Data layer** | V10–V14 migrations; JPA entities; repositories with specifications (filters) | `db-migration`, `backend-module-scaffold` | Sonnet 5.5; Opus 5.5 reviews schema | 1.5 d |
| **2. Core services** | `RunbookService` (CRUD, versioning, hash, diff), `RunbookLintService`, `RunbookApprovalService`, `RunbookClauseService`, `RunbookTemplateAdoptService` | `backend-module-scaffold` | Opus 5.5 (versioning/diff/lint), Sonnet 5.5 (CRUD) | 2 d |
| **3. Execution engine** | `RunbookExecutionService` (state machine), `StepExecutionService`, `EvidenceCaptureService` (Vault integration + SHA-256), `EscalationService` + `@Scheduled` SLA monitor, `RollbackService`, `SignoffService`, `EvidencePackService` (PDF via existing reports stack + ZIP + manifest), audit event emission, cross-module hooks (controls test results, findings, returns) | `backend-module-scaffold` | **Opus 5.5** | 3 d |
| **4. Schedules & reviews** | `RunbookSchedulerService` (cron + holidays), `ReviewTriggerListener` (webhook/notification → review events), approvals queue | `backend-module-scaffold` | Sonnet 5.5 | 1 d |
| **5. API & client sync** | Controllers (§9), DTOs, `@PreAuthorize`, OpenAPI annotations; `services/api.js` functions; constants (routes, labels, nav) | `api-sync` | Sonnet 5.5 | 1 d |
| **6. Frontend — register pages** | P1 Library, P4 Executions, P7 Calendar, P8 Reviews, P9 Approvals, P11 Templates, P10 Coverage, P12 Analytics; sidebar nav; dashboard widgets | `frontend-register-page`, `atheris-register-page` | Sonnet 5.5 (parallel `general-purpose` agents: one per 2–3 pages) | 3 d |
| **7. Frontend — builder** | P2 wizard + M1–M10, M22, M26–M29; autosave; inline linter UI | `atheris-register-page` | Opus 5.5 for wizard state, Sonnet 5.5 for modals | 2.5 d |
| **8. Frontend — execution console** | P5 console + M11–M21; SLA timer; evidence drawer; dual-control; rollback flow; P6 summary & pack download | `atheris-register-page` | **Opus 5.5** | 3 d |
| **9. Platform template library** | Intelligence backend `runbook_templates` module + admin pages (intelligence frontend); `push_runbook_template` job type; webhook payload; tenant `templates` endpoints | `backend-module-scaffold`, `frontend-register-page` | Sonnet 5.5 | 2 d |
| **10. Seed content** | 12 templates (§4) with full steps, stack variants, evidence reqs, escalation, rollback; framework clause seed (CBN RBCSF OFI/DMB, NDPA, ISO 27001:2022 Annex A, PCI 4.0.1, NIST CSF 2.0, CIS v8) | — | Haiku 5.5 drafts from §4 outlines → Opus 5.5 / Fable 5.1 regulatory QA | 2 d |
| **11. Tests** | Unit: lint rules, state transitions, hash, SLA calc, holiday shift. Integration: execution happy path, fail→escalate→rollback, dual control, evidence immutability, tenant isolation. E2E (Playwright, extend `ATERHIS_ONBOARDING_E2E_TESTING.md`): adopt template → publish → execute → pack | — | Sonnet 5.5; Opus 5.5 for security tests | 2 d |
| **12. Docs & release** | Tenant user guide (operator + CCO), auditor guide, release notes, sales one-pager "Compliance Runbooks" | — | Haiku 5.5 → Sonnet 5.5 edit | 1 d |

**Total:** ~25 engineering days single-track; ~12–14 days with two parallel tracks (backend Opus/Sonnet; frontend Sonnet) after Phase 1.

### 12.3 Suggested Claude Code session prompts (copy-paste starters)

**Phase 1**
> Load skills `db-migration` and `backend-module-scaffold`. Implement the Runbook data layer from `Atheris_Compliance_Runbook_v1_0.md` §3.3: migrations V10–V14 under tenant, JPA entities with Lombok (@Builder.Default on collections), repositories with JPA Specifications for the filters in §9.2/§9.4. Run `mvn clean compile` and a Flyway dry-run against a fresh `atheris_tenant` DB. Do not touch existing migrations.

**Phase 3**
> Load `backend-module-scaffold`. Implement the execution engine per §8.2–§8.6 and §9.4. Enforce: only PUBLISHED versions executable; step PASS blocked until mandatory evidence present; dual control verifier ≠ performer; evidence rows immutable (no PUT/DELETE); SHA-256 computed server-side; SLA scheduler emits escalations at 50/80/100%; every transition emits an AuditEvent. Write unit tests for the state machine and an integration test for fail → escalate → rollback.

**Phase 8**
> Load `atheris-register-page`. Build `ExecutionConsolePage.jsx` per §5 P5 and modals M11–M21 per §6. Three-pane layout (steps / current step / SLA & escalation). Command block with copy button and language label. Evidence drawer uploads to `/runbooks/executions/{execId}/steps/{stepExecId}/evidence`. Pass button disabled until mandatory evidence satisfied. Verify with `npm run build` and the skill's DTO-binding check script.

**Phase 10**
> Using §4 outlines, write full template JSON for RB-ACC-001, RB-VUL-001, RB-INC-001, RB-CFG-001 (then the rest). Each step: imperative instruction ≤ 3 sentences, command_block variants for AD/LDAP, Finacle, PostgreSQL/Oracle, Linux/Windows, Fortinet; expected_result; evidence requirements; clause tags. Include escalation ladder and rollback steps. Mark any deadline (24h CBN, 72h NDPC) with the clause citation and a "verify against current circular" note.

### 12.4 Definition of done (per phase)

- `mvn clean compile` and `npm run build` pass; no new warnings from the register-page check script.
- All new endpoints in `ARCHITECTURE.md` API map; `api.js` synced.
- Audit events emitted for every state change; verified in `AuditTrailPage`.
- Tenant isolation test passes (tenant A cannot read tenant B execution/evidence).
- Lint rules L3, L5, L7, L9 cannot be bypassed via API.

---

## 13. Acceptance Criteria (Product)

1. A CCO can adopt "RB-ACC-001 Quarterly User Access Review", map it to the bank's CBN RBCSF (OFI) obligations, publish v1, and schedule it quarterly skipping Nigerian public holidays — in under 10 minutes.
2. An analyst executing the runbook cannot mark step 3.1 (disable accounts) as passed without (a) uploading evidence and (b) a second user verifying.
3. Failing a blocking step offers Raise Finding / Escalate / Rollback; escalation notifies the configured role within 60 seconds; the rollback steps appear as tracked steps.
4. Starting RB-INC-001 shows a 72-hour countdown with 24-hour and 72-hour milestones; at 80% elapsed, the CCO and DPO receive an escalation.
5. The Evidence Pack for any closed execution contains every evidence file, a SHA-256 manifest, all sign-offs and the framework clauses satisfied, and re-hashing the pack matches `pack_hash`.
6. The Coverage Matrix shows, per framework, which clauses have ≥1 published runbook, controls only, or nothing.
7. When the intelligence platform publishes an updated template or a new instrument affecting a linked obligation, a review event opens within the next applicability cycle and a banner appears on the runbook.
8. An AUDITOR sees everything read-only and can record an acceptance decision without being able to alter evidence.
9. Exported runbook (Markdown/JSON) re-imports losslessly.
10. All of the above are tenant-isolated and fully recorded in the Audit Trail.

---

## 14. Non-Functional Requirements

- **Security:** evidence immutable; secrets never stored in `command_block` (lint L9 + server-side regex reject); dual control re-auth; all endpoints `@PreAuthorize`; file type allow-list on upload; ClamAV hook optional.
- **Retention:** evidence retention tag per requirement (default 7 years; NDPA purpose-bound override); legal hold flag blocks purge.
- **Performance:** library and executions lists paginated server-side; console loads version tree once and patches step state; evidence uploads streamed to storage.
- **Time:** all timestamps UTC in DB, rendered in `Africa/Lagos` (tenant setting); SLA computed in UTC.
- **Availability:** SLA monitor idempotent (safe on restart); scheduled execution creation idempotent per (schedule, due date).
- **Observability:** metrics `runbook_executions_active`, `runbook_sla_breaches_total`, `runbook_escalations_total`.
- **Accessibility:** console operable by keyboard (Next/Pass shortcuts), high-contrast status chips.

---

## 15. Open Decisions

| # | Decision | Options | Recommendation |
|---|---|---|---|
| D1 | Evidence pack PDF engine | Reuse `reports` module stack vs. new (OpenPDF/Flying Saucer) | Reuse `reports` |
| D2 | Template distribution | Push via webhook job vs. tenant pull on login | Push (consistent with pipeline) + pull fallback |
| D3 | Git sync of runbooks (v2) | GitHub/GitLab app vs. generic webhook | Defer; export JSON/MD in v1 |
| D4 | Automated command execution (v2) | Agent on customer infra vs. SSH/WinRM connectors | Agent with approval gates; out of v1 |
| D5 | `IT_OPS` as new role vs. permission flag on ANALYST | — | New role (clear SoD for examiners) |

---

## 16. References

- CBN Risk-Based Cybersecurity Framework and Guidelines for Other Financial Institutions (2022); for DMBs/PSPs (2018, as amended)
- CBN IT Standards Blueprint; CBN BCP Guidelines; CBN AML/CFT/CPF Regulations 2022
- Nigeria Data Protection Act 2023; NDPR 2019; NDPC General Application and Implementation Directive 2025
- Cybercrimes (Prohibition, Prevention, etc.) (Amendment) Act 2024
- ISO/IEC 27001:2022, 27002:2022, 22301:2019, 27701:2019
- NIST CSF 2.0; NIST SP 800-53 Rev.5; NIST SP 800-61 Rev.3
- PCI DSS v4.0.1; AICPA SOC 2 Trust Services Criteria; COBIT 2019; CIS Controls v8
- IIA Global Internal Audit Standards (2024)
- Runbook practice sources used in the brief: Nobl9, Neumetric SOC runbook guide, PagerDuty, incident.io, Runme, Uptime Labs, Checkflow

---

*Internal file locations referenced:* `atheris-compliance-tenant-backend/.../modules/{controls,findings,evidence,audit,obligations,returns,remediation,notifications,holidays}`, `atheris-compliance-tenant-frontend/src/{pages,services/api.js,AppRoutes.jsx}`, `.opencode/skills/*`, `.claude/skills/atheris-register-page`.
