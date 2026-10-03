# Atheris — Compliance Intelligence Hub

## Project Structure

```
atheris-compliance-backend/atheris-compliance/  — Spring Boot 3.2 backend (Java 21, Maven multi-module)
  atheris-compliance-intelligence-backend/                    — main application module (port 9090)
  atheris-compliance-tenant-backend/                      — tenant-facing compliance service (port 9091)
  atheris-compliance-common/                      — shared DTOs, constants, utilities
  atheris-compliance-intelligence-backend/
    src/main/java/com/atheris/compliance/intelligence/backend/
      modules/
        instruments/                   — Instrument entity, repository, controller
        regulators/                    — Regulator entity, scraper service, controller
        jobs/                          — JobQueue entity, service, processors, controller
        classification/                — AI classification service
        browser/                       — ObligationBrowser controller + service (inbox/lib)
        tenants/                       — Tenant management
        webhooks/                      — Webhook delivery
        auth/                          — JWT auth
        notifications/                 — ObligationWatch (classification per tenant)
        obligations/                   — ObligationMapping (extracted obligations)
        sanctions/                     — Sanctions
      shared/
        ai/                            — AiClient (Spring AI ChatModel wrapper)
        ocr/                           — PDF extraction
        storage/                       — S3/local storage abstraction

atheris-intelligence-frontend/         — React 19 + Vite 8 + MUI 7 frontend
  src/
    features/
      intelligence/                    — InboxPage, LibraryPage, WatchlistPage
      admin/                           — TenantAdminPage, RegulatorAdminPage, JobQueuePage
      dashboard/                       — DashboardPage
      auth/                            — LoginForm, authSlice
      settings/                        — ApiSettingsPage, ComplianceSettingsPage
    services/api.js                    — API client (fetch wrapper)
    utils/constants.js                 — Routes, labels, nav sections, branding
    components/layout/                 — MainLayout, Sidebar, TopBar
    routes/AppRoutes.jsx               — Route definitions
```

## How to Run

### Backend
- Docker PostgreSQL: container `db`, port 5432, DB `atheris_intel`, user `atheris` (password via `DB_PASSWORD` env, default only in local `application.yml`)
- Start platform: `mvn spring-boot:run` from `atheris-compliance-backend/atheris-compliance/atheris-compliance-intelligence-backend` (port 9090)
- Start tenant: `mvn spring-boot:run -pl atheris-compliance-tenant-backend -am` from `atheris-compliance-backend/atheris-compliance` (port 9091)
- Default admin login is set via `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars (see `application.yml`) — never commit real credentials

### Frontend
- `npm run dev` from `atheris-intelligence-frontend`
- Proxies API to `http://localhost:9090/api/v1`

## How to Use System

- **Prerequisites**
  - Docker PostgreSQL `atheris` on `5432`
  - Java 21, Maven, Node 18+, npm
  - Copy `cp .env.example .env` (see `.env.example` and `application.yml` for `DB_*`, `PORT`, `ADMIN_*`, `JWT_SECRET`, `ENCRYPTION_KEY`, `GEMINI_API_KEY`, `PLATFORM_BASE_URL`, storage, email)
- **Start databases**
  - `docker run --name db -e POSTGRES_USER=atheris -e POSTGRES_PASSWORD=changeme -p 5432:5432 -d postgres:17` or use existing `db` container
  - `psql -U postgres -c "CREATE DATABASE atheris_intel OWNER atheris"`
  - `psql -U postgres -c "CREATE DATABASE atheris_tenant OWNER atheris"`
- **Start backends**
  - Intel `atheris-compliance-intelligence-backend` → `mvn spring-boot:run` `:9090`
  - Tenant `atheris-compliance-tenant-backend` → `mvn spring-boot:run -pl atheris-compliance-tenant-backend -am` `:9091`
  - Flyway `15+25` auto-migrates; toolkit `~390` instruments seeds on first start (`ToolkitStartupSeeder`)
- **Start frontends**
  - Intel `atheris-compliance-intelligence-frontend` → `npm run dev` `:5173` (`VITE_INTEL_TARGET=http://localhost:9090`)
  - Tenant `atheris-compliance-tenant-frontend` → `npm run dev` `:5174` (`VITE_TENANT_TARGET=http://localhost:9091`)
- **First admin**
  - Login `:5173` with `ADMIN_USERNAME` / `ADMIN_PASSWORD` (env vars)
  - Manage regulators, tenants, licenses; run `POST /admin/acts/toolkit/import` if seed missing
  - Dev tenant users: set SEED_USERS_ENABLED=true + SEED_USERS_PASSWORD in .env → tenant backend seeds admin@/cco@/analyst@/auditor@<SEED_USERS_DOMAIN> on start (idempotent, dev only).
- **Tenant use**
  - Onboard organization on `:5174` (license → institution → user setup → confirm)
  - Use dashboard, Review Inbox/Edit, Instruments, Obligations Register/Details, Controls, Returns, Sanctions, Findings
- **Verify**
  - `mvn clean compile` + `npm run build`
  - Check logs `%TEMP%\opencode\{intel,tenant}-{out,err}.log` for clean start
  - Manual onboarding via browser; verify UI loads at `http://localhost:5174`
- **Reference**
  - See `ARCHITECTURE.md` and `ATERHIS_ONBOARDING_E2E_TESTING.md` for full system and API details

## Pipeline Flow

| Step | Schedule | Batch | Job Type | Description |
|------|----------|-------|----------|-------------|
| Horizon Scanner | 15m | — | — | `scraperService.scrapeAllDue()` |
| OCR Processor | 2m | 3 | `ocr_document` | Download PDF from storage, extract text, save Instrument, enqueue classify |
| Classifier | 5m | 10 | `classify_instrument` | Call AI to classify, extract obligations/sanctions, publish instrument |
| Applicability | 5m | 10 | `evaluate_applicability` | Match instrument to tenants, enqueue webhook jobs |
| Webhook Sender | 5m | 20 | `send_webhooks` | Deliver webhooks to tenant URLs |
| Webhook Retry | 30m | 10 | — | Retry failed webhook deliveries |

## AI Provider

- Uses Spring AI `ChatModel` interface — swappable via config only
- Current: Google Gemini (`gemini-3.1-flash-lite` on free tier)
- Configured in `application.yml` under `spring.ai.google.genai.chat.*`
- API key: `GEMINI_API_KEY` env var (no fallback in config)
- Previously tested: Anthropic Claude, DeepSeek, Ollama (llama3:8b)

## Configuration Files

- `application.yml` — DB, JWT, storage, admin creds, AI model, scraper, job schedules
- `Constants.java` — All shared constants (job types, statuses, retry backoff, classification states)
- `vite.config.js` — Dev proxy to backend on port 9090

## Key Constants

- Job types: `ocr_document`, `classify_instrument`, `evaluate_applicability`, `send_webhooks`
- Statuses: `pending`, `processing`, `completed`, `failed`
- Classification: `unclassified`, `applicable`, `not_applicable`, `under_review`
- Retry backoff (minutes): `[5, 15, 60, 240, 1440]`

## Sub-Agents

MUST use these sub-agents for all non-trivial tasks. MUST NEVER do the work directly — act as a coordinator only.

| Task | Agent | When to Use |
|------|-------|-------------|
| Frontend page work | `frontend-page` | Any MUI table page — new, modified, or bugfixed (KPIs, filters, drawer, pagination) |
| Schema changes | `db-migration` | Any CREATE TABLE, ALTER TABLE, column add/edit, Flyway repair |
| Backend module work | `backend-scaffold` | Any entity + repository + service + controller + DTOs + migration — new, refactored, or bugfixed |
| API mismatch check | `api-sync` | After adding/changing endpoints, verify frontend api.js matches |

Full agent definitions: `.opencode/agents/`

### Agent Conventions
- **frontend-page**: React 19, Vite 8, MUI 7. Pages follow stats cards → filters → sortable table → detail drawer. Max 5 columns. API via `api.js`.
- **db-migration**: Always edit existing migrations in place. Only create new V<next> files for genuinely new tables. Run Flyway repair after editing. Use POSTGRES superuser for drops.
- **backend-scaffold**: Java 21, Spring Boot 3.2. `findBy` for simple lookups, native `@Query` for complex joins. `@Builder.Default` on all initialized fields. Thin controllers.
- **api-sync**: Scans all `@RestController` classes vs all `api.js` files. Reports missing frontend calls, dead calls, parameter/auth/shape mismatches.

## MCP Servers

| Server | Package | Scope |
|--------|---------|-------|
| postgres | `@modelcontextprotocol/server-postgres` | Direct SQL on `atheris_intel` |
| playwright | `@playwright/mcp` | Browser automation (Chromium) |
| filesystem | `@modelcontextprotocol/server-filesystem` | File read/write (scoped to project) |

Config: `opencode.json`

## Recent Changes

### Backend Verification & Cleanup (latest)
- **DB-driven tenant identity** — tenant backend no longer reads `atheris.tenant-id`/`TENANT_ID`; `TenantIdentityService` resolves the single `tenant_profile` row. `LicenseService.activate()` calls intel `POST /api/v1/internal/tenants/provision` (idempotent) to learn the real tenant id, stored on `tenant_profile` (`UNIQUE(tenant_id)`, tenant V26). All 13 `@Value tenant-id` sites converted; `InternalTenantController.onboard` idempotent. One tenant per instance — the `TENANT_ID=2` sacrificial-tenant pattern is obsolete.

### Backend Verification & Cleanup (earlier)
- Clean startup verified (no seeder warnings / auto-generated password). Dormant webhook delivery code removed end to end (commit `09cccd1`); delivery is polling-only via `ObligationSyncService`.
- Toolkit import idempotent — dedup by natural key (obligations = regulation+statement+section; sanctions = regulation+section+description+penalty); counts now **1541 obligations / 597 sanctions** (commit `520d70e`).
- Intel "Tenant Overview" dashboard widget (`8d423c8`); `@Builder.Default` on 100 fields in 35 files (`5310dc3`); never-enforced `maxRegulators`/`maxControls`/`maxReturns` removed everywhere, V12 edited in place (`48ba65d`); backlog marked done (`ed3270c`).

### Backend (intel)
- **Toolkit seed (Phase A)** — `modules/regulations/` (`Regulation`, `RegulationAlias`, `AreaOfFocus`, `ToolkitImportService`, `AdminRegulationController`, `AdminUniverseController`), Flyway V15. Parses `classpath:toolkit/compliance_toolkits.md` into instruments (`upload_source='toolkit_seed'`, never enter OCR/AI), regulations, obligation_mappings, sanctions, returns (139), regulators. Atomic (TransactionTemplate `setRollbackOnly()`); returns an UNMAPPED report. `parseMoney` honours `M`/`k` suffixes and takes the largest compound per-role amount (replaced the digit-stripping `parseNaira`).
- Endpoints: `GET/PUT /admin/regulations[/{id}]`, `POST /admin/regulations/toolkit/import`, `GET /admin/universe/{instruments,areas-of-focus,stats}`.
- Pipeline: Spring AI `ChatModel` (replaced custom Anthropic client); `AdminJobQueueController`; DB-backed CORS whitelist (V9, `modules/cors/`); Pending Manual Downloads (V10, `modules/pending/` — PDF magic-byte check, SHA-256, enqueue OCR); webhooks removed from the pipeline; License KPIs; batch loops (OCR_BATCH=3, CLASSIFY_BATCH=10).
- Resilience rules: `markFailed()` is `REQUIRES_NEW`; `em.clear()` + `setRollbackOnly()` in processor catch blocks; catch `Throwable` (JNA `Error` kills the scheduler thread otherwise); Tesseract DPI 200 / 4000px clamp; classifier rejects text <100 chars → `INST_TRIAGE`; `safeUri()` for CBN URLs; Playwright downloads inside the same `BrowserContext` (keeps Cloudflare `cf_clearance`).

### Frontend (intel)
- Inbox/Regulators/Tenants/Dashboard wired to real APIs (mock data removed); JobQueuePage `/admin/pipeline`; Pending Manual Downloads widget; View PDF via `/admin/jobs/{id}/pdf` or `/intelligence/obligations/{id}/pdf`; `authSlice` reads `res.accessToken`.
- Demo login: `api.js` `demoRequest()` serves mock data when `authToken === DEMO_TOKEN`.
- LibraryPage removed; its Refresh button moved to `/admin/instruments`.

## Admin API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/admin/jobs` | PLATFORM_ADMIN | List jobs (?jobType=&status=&page=&size=) — includes `payload` |
| GET | `/api/v1/admin/jobs/stats` | PLATFORM_ADMIN | Aggregate counts per type+status |
| GET | `/api/v1/admin/jobs/{id}` | PLATFORM_ADMIN | Full job detail with payload + instrument |
| GET | `/api/v1/admin/jobs/{id}/pdf` | PLATFORM_ADMIN | Presigned PDF URL for in-flight jobs |
| GET | `/api/v1/admin/pending-downloads` | PLATFORM_ADMIN | List pending docs (?status=) |
| GET | `/api/v1/admin/pending-downloads/{id}` | PLATFORM_ADMIN | Get one pending download |
| POST | `/api/v1/admin/pending-downloads/{id}/upload` | PLATFORM_ADMIN | Upload PDF → S3 → enqueue OCR job |
| POST | `/api/v1/admin/pending-downloads/{id}/skip` | PLATFORM_ADMIN | Mark as skipped |
| GET | `/api/v1/admin/pending-downloads/stats` | PLATFORM_ADMIN | Counts by status |
| GET | `/api/v1/intelligence/inbox` | Any auth | Inbox items (?status=) |
| GET | `/api/v1/intelligence/obligations` | Any auth | Search library (?q=&regulatorId=&riskRating=) |
| GET | `/api/v1/intelligence/obligations/{id}/pdf` | Any auth | Presigned PDF URL for instruments |
| GET | `/api/v1/platform/regulators` | PLATFORM_ADMIN | List regulators (?activeOnly=) |
| GET | `/api/v1/platform/tenants` | PLATFORM_ADMIN | List tenants |

## Frontend Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/dashboard` | DashboardPage | KPIs, charts, activity feed |
| `/inbox` | InboxPage | Classify incoming instruments |
| `/library` | LibraryPage | Browse obligation library |
| `/watchlist` | WatchlistPage | Track watched instruments |
| `/admin/regulators` | RegulatorAdminPage | Scraper management |
| `/admin/tenants` | TenantAdminPage | Tenant + webhook management |
| `/admin/pipeline` | JobQueuePage | Pipeline job status |
| `/settings/api` | ApiSettingsPage | Webhook config |
| `/settings/compliance` | ComplianceSettingsPage | Compliance profile |

## DB Notes

- Instruments have unique constraint on `source_url` (`idx_instruments_source_url`)
- Duplicate PDFs are skipped at OCR-time via `existsBySourceUrl()` check
- Old classify jobs with null subject_id can be cleaned: `DELETE FROM job_queue WHERE job_type = 'classify_instrument' AND subject_id IS NULL`

## TODO / Next — Client-readiness follow-ups

Harmonization (tenant pages, intel explorers, dashboards, skill) is DONE — see the Done sections below.

**Bulk import** — all four phases (obligations, controls, returns, findings) DONE, see below.

**Known follow-ups**
- **55 seeded returns show "Due date needed"** — their platform wording has no deadline ("Annually", "Monthly", "As specified by CBN"); a CCO/admin must set each via Edit schedule. A bulk "set due dates" screen would speed this up.
- Seeded return frequency labels can be lossy copies of the platform text (e.g. LCR shows "Quarterly" but correctly runs MONTHLY from the platform's full wording).
- FindingsPage has 7 table columns (rule: max 5) and still uses raw useState/useEffect (no TanStack Query); default status filter 'Open' hides imported Remediated/Closed findings until the filter is changed.
- Settings → Organization shows mojibake ("Â·") in the team/owner counts.
- "New Control" form still writes only the control side of obligation links (import writes both).
- `ObligationService.createObligation`/`updateObligation` check `obligationRepo.existsById(instrumentId)` — the wrong repository (no local instrument table).
- Intel frontend `api.js:244` still treats 403 as session expiry (the tenant was fixed — see below); check the intel `SecurityConfig` entry point too.
- `PlatformApiClient` swallows platform failures, so "platform down" surfaces as 404 instead of 502.
- `changePassword` does not apply the password-strength rule that invite/reset use.

## Done — Return Due Dates (no more overdue-on-day-one)

Seeded returns had no due date (the platform has none: intel `deadline` is a copy of `frequency`, `remarks` is empty, and intel `filing_date` is an artifact stamped onto Sep 2026), so they fell back to "due the 1st of this month" → 92 periods overdue on day one.

- **Schedule model** (`regulatory_returns`, V6 edited in place): `due_days_after_period_end` (offset rule — due = calendar-aligned period end + N days), `due_date_source` (`platform_text` | `user` | null), `deadline_text` (the regulator's wording). The fixed-date rule stays in `filing_date`. "N months after period end" is stored as a fixed date (e.g. 3 months after year-end → 31 Mar). Period labels stay = month of the due date (the rendition grid selects by due date but buckets by period). Monthly offsets 1–28.
- **Generation** (`ReturnService.ensureInstances`): a return WITH a rule is always generated from the rule (never "continue from the latest instance" — that produced wrong dates after a rule change); Monthly-or-longer with no rule → **no periods** ("Due date needed"); only rule-less Daily/Weekly continue from the latest.
- **`ReturnDeadlineParser`** turns platform wording into a rule ("Annually by June 30" → 30 Jun; "10th day of the following month" → 10 days after period end; "on or before 5th of January, April, July, and October" → 5 Jan/Apr/Jul/Oct; "within 3 months after year-end" → 31 Mar); statutory basis tried when the frequency text has none; event-relative wording (AGM, anniversary) → none. `ReturnDeadlineParserTest` 31 cases.
- **Seed** no longer trusts platform `filing_date`, stores `deadline_text`, and applies the parsed rule (source `platform_text`).
- **Repair** (`ReturnFrequencyRepairService`) now also proposes due-rule changes for platform-matched, non-user returns (one row per return; `toReschedule`, `currentRule`/`proposedRule`, `rescheduled`); untouched-instance logic shared via `UntouchedInstances`.
- **Edit path:** `PUT /returns/{id}/schedule` (CCO/TENANT_ADMIN) — frequency + rule (DATE / OFFSET) + prep days; sets source `user`, rebuilds untouched periods. UI: `EditScheduleDialog` (shows the regulator's wording), "Edit schedule" on register rows and the detail header, a "Due date needed" chip, status filter and stat card; the Add Return form warns when no due date is given.

### Verified (live, browser pane, 2026-10-03)
Repair applied: 75 rescheduled (21 parsed rules, 54 → Due date needed), 186 untouched periods removed, 1 kept, 42 created; overdue **92 → 1** (a user-imported test return), second dry run proposes 0. Edit schedule on that return (10 days after period end) → periods due 10 Oct/Nov/Dec/Jan; overdue **0**. Zero backend errors.

## Done — Bulk Import Phase 4 (Findings)

Findings page → Import (CCO / TENANT_ADMIN — closed rows carry a CCO sign-off). `FindingImportHandler`.

- **Template:** Reference | Description* | Finding Type* (Gap/Control Failure/Process Weakness) | Severity* | Status* (Open/In Remediation/Remediated/Closed) | Date Raised | Remediation Deadline | Root Cause | Linked Control Number | Linked Obligation ID | Owner | Remediation Notes | Date Remediated | Date Closed, plus "Obligations" and new "Controls" lookup sheets (`ImportParsing.controlsReferenceSheet`).
- **Historical findings keep their history:** `Finding.@PrePersist` now sets `createdAt` only when null, so Date Raised is preserved; Remediated/Closed rows set `remediationSubmittedAt`, `closedAt`, `ccoSignOffAt` (= Date Closed) and `ccoSignOffUserId` (= importing user). Status consistency enforced (In Remediation needs an owner; Remediated needs owner + Date Remediated; Closed needs both dates; raised ≤ remediated ≤ closed; nothing in the future). Deadline defaults to Date Raised + SLA days (`FindingService.slaDays`, now public static).
- **Reference (new column):** `findings.external_reference` + unique index on `lower(external_reference)` (V5 edited in place; dev DB got ALTER + Flyway repair). Dedup on reference (case-insensitive), else description + control + obligation. Shown under the finding ID in the register and in the detail view.
- Register/detail show the real **control number** (batch-loaded, no N+1) instead of `CTRL-%03d` of the id.
- **Dashboard refresh:** afterCommit calls `DashboardService.recomputeInNewTransaction()` (REQUIRES_NEW — a plain `@Transactional` call from afterCommit joins the finished transaction and its insert is never committed). `getLatest` now orders by snapshot date then id, because several snapshots can share a date.

### Verified (live, browser pane)
8-row file → 5 valid (one per status + unreferenced) / 2 invalid / 1 case-insensitive reference duplicate; stored dates 2025-11-05 → 2026-01-20 preserved, SLA deadlines derived, CCO sign-off on the Closed row, controls linked by number; dashboard snapshot recomputed at import; re-upload → 0 valid / 6 duplicate. Zero backend errors.

## Done — Bulk Import Phase 3 (Returns) + Return Frequency Fixes

Returns page → Import (CCO / TENANT_ADMIN only). `ReturnImportHandler`; shared parsing moved to `ImportParsing` (verbatim, no behaviour change).

- **Template:** Return Name* | Regulator* | Frequency* | First Due Date | Prep Days Before Due | Act | Return Type | Filing Channel | Responsible Unit | Responsible Person | Return Owner (email) | Linked Obligation IDs, plus the "Obligations" lookup sheet. Frequency = Daily, Weekly, Monthly, Quarterly, Semi-Annual, Annual, Biennial, Event-driven. First Due Date required for Quarterly/Semi-Annual/Annual/Biennial. Owner matched to an active user by email. Duplicates = name + regulator. Links via the existing `insertReturnLink`. Audit `returns_imported`.
- **Per-type import roles:** `ImportHandler.requiredRoles()`; returns → CCO/TENANT_ADMIN (matches POST /returns). Checked on preview, commit, errors and batch history (history hides types the role can't use).
- **Why every tenant return was MONTHLY:** intel's `InternalRegulationSeed.ReturnItem` never carried `frequencyType`, so the seed fell back to MONTHLY; manual `ReturnService.create` never set it either. Both fixed. `ReturnFrequency` (modules/returns/entity) is the single mapper: labels/aliases + `classify(text)`. Classifier rules, in order: an explicit cycle adjective anywhere wins (most frequent if several: daily > … > biennial); then period-end anchors (month-/quarter-/year-end, "each calendar quarter", "financial year (FY) end"); then event phrasing (within/upon/immediately/on request…); bare durations ("within 1 year of the incident") are event-driven. `ReturnFrequencyTest` holds 26 real platform strings.
- **Filing cycle anchored on the First Due Date** (imports AND the Add Return form): a future date is the first due date; a past one rolls forward on the cycle (month dates computed from the original anchor, no drift). The first anchored instance is always created even beyond the 120-day lookahead. No date → old behaviour. Daily returns are left to the 5-minute scheduler on import.
- **Register:** returns with no instances (event-driven) are now listed, not hidden. Frequency filter uses the stored type. ISO week label uses `WEEK_BASED_YEAR`. `linkObligations` evicts the obligations register cache.
- **Repair action** for already-seeded tenants: `GET/POST /api/v1/returns/frequency-repair` (TENANT_ADMIN). Dry run first; retypes from the platform's text (classified by the tenant's stricter classifier; platform MONTHLY treated as "no answer"), deletes only untouched instances (Not Started, no stage owner/data, no submission, notes or evidence; system escalation ignored), rebuilds via `ensureInstances`, audits `returns_frequency_repaired`. Idempotent. UI: warning banner + `ReturnRepairDialog` on the Returns page for admins.

### Verified (live, browser pane)
8-row file → 4 valid / 3 invalid / 1 duplicate; Annual 31 Mar 2027 → single 2027-03 period; Quarterly 15 Jan 2027 → starts 15 Jan; Event-driven listed with no period, not overdue; re-upload → 0 valid / 5 duplicate; analyst → 403 on returns import. Add Return form: Annual + 30 Jun 2027 → ANNUAL, one 2027-06 period. Repair applied on the dev tenant (2026-10-03): 113 of 143 retyped (37 Annual, 58 Event-driven, 11 Quarterly…), 564 untouched periods removed, 1 kept, 96 rebuilt; overdue 268 → 92; second dry run proposes 0.

**Dev gotcha:** running `mvn clean compile` while a backend is running deletes its classes underneath it — requests then 401 and the UI logs out. Restart the backend after any clean build.

## Done — Bulk Import Phase 2 (Controls)

Controls page → Import, same 3-step dialog and endpoints (`{type}=controls`). New `ControlImportHandler`; `ImportService` stayed generic (no type branches).

- **Template:** 15 columns (Control Name* … Linked Obligation IDs). Strict dropdowns for Control Type (Preventive/Detective/Corrective/Directive), Test Frequency (Monthly/Quarterly/Semi-Annual/Annual), Inherent Risk (Critical/High/Moderate/Low, "Medium" accepted) and Owner. **Theme is free text** — its suggestions are listed via the new `ImportHandler.suggestions()` (anything in `allowedValues()` becomes a STOP-style dropdown). A read-only **"Obligations" sheet** (`ImportHandler.referenceSheets()`) lists every obligation's ID/title/section/regulator/act, from the new `ObligationService.registerRows()`.
- **Linking by obligation ID** — the only reliable key: `obligation_number` is NOT unique (seed and review number 1..n per instrument). The column is Text-formatted so Excel doesn't turn `12,345` into a number; `;` or `,` separators. IDs are validated with one `findAllById` (exists, not deleted).
- **Both link lists are written:** `controls.linked_obligation_ids` (control detail, `?obligationId=` filter) AND each obligation's `ObligationClassification.linked_control_ids` (register "N controls", "No Control" KPI, every coverage dashboard). Manual `ControlService.create` writes only the control side — the lists are still not kept in sync elsewhere. Classifications load with the new derived `findByObligationIdIn`; a missing one is created applicable/active. No classification history is written (the batch audit `controls_imported` covers it).
- **Numbers:** blank → `CTL-%04d` from the highest existing or in-file `CTL-n`, allocated once per batch (seeded numbers use other formats and are ignored). Duplicates: same number (register or file), or — when no number — same name + act.
- Test Frequency Days derived when blank (30/90/182/365). Name capped at 500 (`control_tasks.control_name`).
- **Frontend:** `ImportDialog` gained `itemLabel`, `contextLabel` and `invalidateKeys` props (controls invalidates `controls`, `obligations`, `dashboard`). No DB migration.

### Verified (live, browser pane)
7-row file → 3 valid / 2 invalid / 2 duplicate; commit → CTL-0100 (explicit) + CTL-0101/0102 (auto), both link lists written (obligation 5 kept its 3 existing links), register showed "2 controls" and No Control 2 → 0; re-upload → 0 valid / 5 duplicate. Zero backend errors.

## Done — Bulk Import Phase 1 (Obligations) + Auth Status Codes

**Flow (tenant `:5174`, Obligations Register → Import):** download the `.xlsx` template → upload → row-by-row preview (valid / invalid with reasons / duplicate) → "Import N obligations". Imported rows go **straight to the register** (`source='imported'`, `applicability='applicable'`) — the preview confirm is the human check, by user decision; they do NOT pass through the Review Inbox. Invalid rows download as an errors `.xlsx` with an "Error" column to fix and re-upload.

### Backend (`modules/imports/`)
- `ImportHandler` interface + `ObligationImportHandler`; `ImportService`; `ImportWorkbooks` (all POI read/write, zip-bomb guards, ≤5000 rows, ≤10 MB, header match case/space-insensitive); thin `ImportController`.
- Endpoints (`ANALYST/CCO/TENANT_ADMIN`): `GET /imports/{type}/template`, `POST /imports/{type}/preview` (multipart `file`), `POST /imports/batches/{id}/commit` (409 `already_committed` on repeat; batch row-locked), `GET /imports/batches/{id}/errors`, `GET /imports/batches?type=`.
- New table `import_batches` (**V31**) keeps each upload's parsed rows (JSONB), counts and status.
- Validation: title + regulator required (tenant regulator by name/abbrev); Impact `Insignificant..Severe` (aliases Low/Medium/High/Critical → Minor/Moderate/Major/Severe); Likelihood `Rare..Almost Certain`; Owner must match an active owner; dates numeric or `yyyy-MM-dd`/`dd/MM/yyyy`. Duplicate key = normalised title + section + act, against the register and earlier rows in the file.
- Commit: one transaction; obligation numbers allocated once per batch; inherent risk computed by `@PrePersist`; **one** `obligations_imported` audit event per batch (with all ids), not one per row; register cache evicted.
- **Schema:** `obligations.tenant_regulator_id` (V3 edited in place, index only — `tenant_regulators` is created later in V14). Register/detail fall back to the tenant regulator when there is no platform instrument, so standalone obligations no longer show "–". Dev DB got `ALTER TABLE` + Flyway repair.
- Dependency: Apache POI `poi-ooxml` 5.3.0 (`poi.version` in the parent pom).

### Frontend
- Reusable `components/modals/ImportDialog.jsx` (3 steps, 5-column preview table, clickable result chips); "Import" button beside "New Obligation".
- `api.js` `rawRequest` (multipart + blob download, keeps the 401 refresh) and `api.imports.*`.

### Auth status codes (tenant)
- `SecurityConfig` had no entry point, so Spring answered an expired/missing token with **403** — which is why `api.js` treated 403 as session expiry. Now: bad/missing token → **401** `unauthorized`; role denial → **403** `forbidden`. `api.js` refreshes/logs out only on 401; a 403 shows the server message and keeps the user logged in. License-blocked 402/403 from `LicenseFilter` unchanged.
- Client disconnects (`ClientAbortException`, broken pipe) log at DEBUG instead of "Unhandled exception".

### Dev user seeder (tenant)
- `config/DevUserSeeder.java`: with `SEED_USERS_ENABLED=true` + `SEED_USERS_PASSWORD` in `.env`, seeds `admin@ / cco@ / analyst@ / auditor@<SEED_USERS_DOMAIN>` (one per role) on start. Idempotent, never resets existing users, rejects weak passwords. Off by default — dev only.

### Verified (live, browser pane, `admin@mamcorp.test`)
6-row test file → preview 2 valid / 2 invalid / 2 duplicate; errors file held exactly the 2 invalid rows; commit imported 2 (register 1541 → 1543, CBN + act + High risk shown, Under Review unchanged); re-upload → 0 valid / 4 duplicate, Import disabled. No token → 401; analyst on admin endpoint → 403 without logout.

## Done — PDF Routes Return 404 Instead of 500

`Instrument.pdfUrl` is null for toolkit-imported instruments; `LocalStorageService.resolve(null)` threw an NPE → 500. Now 404 `DOCUMENT_UNAVAILABLE` (intel `ResourceNotFoundException`/`DocumentUnavailableException`; tenant `{"error":"document_unavailable"}`), and `pdfErrorMessage(res, fallback)` in each app's `api.js` shows "No document is available for this instrument." Verified live in both apps.
- **Two PDF call sites:** `ObligationBrowserService.openPdfStream` AND `InternalInstrumentService.openPdfStream` (the tenant proxies the latter) — fix both.
- `NoSuchFileException` maps to 404, but under `STORAGE_PROVIDER=s3` `NoSuchKeyException` is untranslated and would still 500.
- Remaining 500s: `findById` and `classify` in `ObligationBrowserService` still throw bare `RuntimeException` for a missing obligation.

## Done — Dashboards Harmonized (risk / area / act)

Dashboard V2 routed at `/dashboard/v2` and fixed (inverted quarter date range, all-zero heatmap, total/submitted unit mismatch, ignored thresholds, per-row query in escalation-matrix). `/dashboard/v2/thresholds` no longer takes `tenantId` as a request param (cross-tenant read/write) — resolved via `TenantIdentityService`. Added `control-coverage?by=act` and `RiskProfileDto.byAct`. Tenant `CcoDashboardPage` gained risk profile / area / act sections (TanStack Query, 30s poll); intel `DashboardPage` gained a `RegulatoryCoverage` section.
- **Only link to filters a page reads:** `ObligationsRegisterPage` reads only `risk`, `regulator`, `areaOfFocus`, `owner`, `status`, `hasGap`; `impact`/`likelihood`/`act` links are silent no-ops (adding them is an open follow-up).

## Done — `atheris-register-page` Skill

`.claude/skills/atheris-register-page/` (SKILL.md, `references/traps.md`, `references/data-model.md`, `scripts/check_dto_binding.py`, `scripts/grid_codemod.py`); `.opencode/agents/frontend-page.md` points at it. Supply **all** backing DTOs to `check_dto_binding.py` or it reports false positives. Verified factually but NOT run through the skill-creator eval loop.

## Done — Risk Matrix Defaults Repaired

`RiskMatrixConfig` entity `@Builder.Default` axes/bands disagreed with V28 and `computeInherentRisk` (High band unreachable; likelihood axis matched no stored value; `>` vs `>=` at boundaries). `V30__repair_risk_matrix_defaults.sql` repairs only exact broken rows.
- **Rule:** entity `@Builder.Default` wins over migration column defaults for JPA-created rows — when a default exists in both, they must agree.

## Done — MUI 7 Grid Migration

154 legacy `<Grid item xs md>` usages in 19 files converted to `size={{ xs, md }}` (MUI 7.3.11 `Grid` is v2; legacy props were silently ignored).
- **Verify MUI against the installed `node_modules/@mui/material/Grid/Grid.d.ts`**, not memory.

## Done — Intel Explorers (obligations, sanctions, returns, controls)

`GET /api/v1/admin/<entity>` + `/stats` + `/{id}` (PLATFORM_ADMIN) plus explorer/detail pages modelled on `RegulationExplorerPage`/`RegulationDetailPage`; act names batch-loaded per page (no N+1).
- **Naming differs per entity:** `ObligationMapping` uses `regulationId` + `specificSectionReference` (tenant DTOs use `sectionReference`); `SanctionsPenalty` `regulationId` + `sourceSectionReference`; `RegulatoryReturn` `actId` + `sectionReference`; `ComplianceControl` `actId` with `actName` denormalised on the row.
- **`actName` is service-resolved** on ObligationMapping/SanctionsPenalty/RegulatoryReturn: `sort=actName` throws `PropertyReferenceException` (sort on the id instead).
- **Intel frontend has no TanStack Query** (no dependency, no provider) — the TanStack rule applies to the tenant app only; intel uses raw `useEffect` with race guards.
- Pre-existing lint debt: ~316 eslint problems in intel; the tenant frontend has no eslint config.

## Done — Returns Register/Details Harmonized (incl. backend linkage)

`GET /returns/{returnId}/obligations` enriched in place to `LinkedObligationItem` (native projection, no migration); rows lazily fetch linked obligations on expand; `overcomeCount` typo → `overdueCount`. Known: `ReturnService.getRegister` ignores `Pageable` sort (always `currentDueDate`).

## Done — Controls Register/Details Harmonized

`ControlsPage.jsx` now shows `actName`/`actId`, linked obligations navigate to `/obligations/{obligationId}`, 9 columns trimmed to 5. `api.controls.*` takes no `opts`, so no abort signal is passed.

## Done — Instruments / Obligations / Sanctions Harmonized

Pages now render DTO enrichment they never read (verbatim vs interpreted text, section/area/type/deadline chips, act linkage, expandable sanction panels). Fixed: Instruments drawer read non-existent `obl.section`/`obl.type`/`s.type`; Instruments pagination capped at one page; register `hasGap` filter shadowed (renamed `hasGapFilter`).
- **Sanction amount field:** `InstrumentDetailResponse.SanctionItem.amountNaira` vs `sanctionAmountNaira` on every other sanction DTO.
- **Query keys for by-id details must be stringified** (`['x', String(id)]`) — `useParams()` gives strings, list ids are numbers.
- Concurrent agents must not share `dist/`; verify with `npx vite build --outDir dist-verify-<name> --emptyOutDir`.

## Done — Review Inbox Harmonized (enriched obligation summary)

`ReviewInboxPage.jsx` mirrors `ReviewEditPage.jsx`: expandable rows lazily load `GET /review/{reviewId}` (key `['review', String(reviewId)]`, shared with the edit page), migrated to TanStack Query with `keepPreviousData`, outer table trimmed to 5 columns. No backend change.

## Done — Dashboard V2 (Rendition Tracker + Control Coverage)

`DashboardV2Page` (Rendition tab + Control Coverage tab, `RiskHeatmap`) backed by `DashboardV2Controller`/`DashboardV2Service` (`/dashboard/v2/{rendition-grid,escalation-matrix,risk-heatmap,control-coverage,returns-by-period,risk-profile,thresholds}`) and `risk_matrix_config` (V28). Risk scoring: Impact Insignificant..Severe × Likelihood Rare..Almost Certain (1–25); bands Low / Moderate (≥6) / High (≥12) / Critical (≥18). `computeResidualRisk()` not yet wired into control tests. Returns seeding fix: `filing_due_day_of_month` was NULL on all returns → `parseDueDayFromFrequency()` added.
- The live tenant `/dashboard` is **`CcoDashboardPage.jsx`** (imported under alias `DashboardPage`); V2 was unreachable until routed at `/dashboard/v2`.
- **Grep the import PATH, not the identifier** (aliased imports give false positives).

## Done — Pipeline Stage Breakdown

`GET /platform/regulators/{id}/pipeline-stats` (discovered/downloaded/extracted/classified + drill-downs), RegulatorDetailPage stage cards, Dashboard Pipeline Health banner, regulator table Discovered/Downloaded/Failed columns. Pushed at `5787d9f` (merge of `99008da`).

## Done — Tenant Backend Aligned as Submodule

Standalone tenant service copied in as Maven submodule `atheris-compliance-tenant-backend` (port 9091, DB `atheris_tenant`, schema `tenant`, migrations under `db/migration/tenant/`); modules: auth, users, onboarding, subscriptions, obligations, controls, findings, returns, notifications, dashboard, audit (hash chain). Run commands are in "How to Run" above.

## Done — Tenant Frontend Portal Built

Tenant portal at `atheris-compliance-frontend/atheris-compliance-tenant-frontend/` (`:5174`). No webhooks: tenant polls via `ObligationSyncService` (`tenant_polling_config`); uploads go through `POST /subscriptions/upload-document` → platform `/internal/instruments/ingest` (SHA-256 dedup). Onboarding/license calls must target `TENANT_API_BASE` (`:9091`) — they previously hit `:9090` and bounced to `/login`. E2E script: `ATERHIS_ONBOARDING_E2E_TESTING.md`.

## Done — Backend Verification & Cleanup (backlog completed)

Clean startup, onboarding E2E, Tenant Overview widget, `@Builder.Default` cleanup (`5310dc3`), license limit fields removed (`48ba65d`); webhook delivery CANCELLED in favour of polling. See "Recent Changes" above.

## Done — Tenant Obligations Register Rebuilt (Per-Obligation)

`ObligationService.getRegisterList()` now pages the `obligations` table (one row per obligation, in-memory filter/sort) instead of `ObligationClassification`; added `GET /obligations/stats`, `GET /obligations/obligation/{id}`, `PUT /obligations/obligation/{id}/returns`, `GET /returns/list`; Flyway V20 `obligation_returns`. Theme filter maps to `obligation_type`; "Under Review" KPI = not yet `applicable`. CCO approval excluded.

## Done — Per-Obligation Review Workflow (Edit & Save gate)

**Rule: NO document reaches the Obligations Register without a human "Edit & Save" on the Review page; instruments carry NO classification — it lives per obligation** (`obligation_classifications.obligation_id UNIQUE`). Flow: upload/sync → `pending_reviews` (V21) → `/review` → `/review/edit/:id` (per-row classification) → save → `/instruments` (confirmed only) → `/obligations`.
- **Review save deletes obligations by `instrument_id`:** `ReviewService.save()` deletes the instrument's existing obligations + classifications (`deleteByInstrumentId`), then recreates one `Obligation` + one `ObligationClassification` per applicable obligation.
- Register classify calls use `selected.obligationId`, NOT `instrumentId`.
- **`published_at` is never populated; use `dateIssued`** (AI-extracted) — tenant maps `publishedAt ?? dateIssued`.

## Done — Returns Module Enhancements (enums, regulator FK, lazy instances + escalation, bidirectional obligation linking)

**No scheduler:** filing instances materialize idempotently on read (`getCalendar`/`getDetail`) and after `create()` (`ensureInstances`, frequency-aware, `UNIQUE(return_id, period)`); escalation catches up lazily (L1 >0d, L2 >2d, L3 >5d; `submit()` resets). Enums `ReturnStage`/`ReturnFilingStatus`/`RegulatoryReturnStatus` use `@Converter(autoApply=true)` so DB keeps display strings. `regulatory_returns.tenant_regulator_id` FK (+ name snapshot). Return→obligation linking via `GET/PUT /returns/{returnId}/obligations`. V6/V14 edited in place.
- **flyway-maven-plugin needs the fully-qualified goal** (`mvn org.flywaydb:flyway-maven-plugin:10.12.0:repair` + `-Dflyway.` props) — it is not in the module pom.

## Done — Configurable License Seed & Toolkit Regulator Fix

License flags `autoSubscribeRegulators` / `autoSeedObligations` (intel V12 + tenant V28, default false) drive onboarding; toolkit seeds go straight to the Register (Inbox 0 is expected), AI/uploads stay gated via Review. Toolkit regulator inference chain (`inferRegulatorFromTitle → inferRegulatorForAct → mapAreaToRegulator → Federal Govt`) took null-regulator instruments 29 → 0. Review Inbox sync fixed: `findRecentForTenant` uses `coalesce(publishedAt, dateIssued)`, onboarding salvage subscribes regulators when none chosen, sync watermark not advanced on error.

## Done — Classifier/Toolkit Harmonization (backend-only, verbatim + plain, 60+ cap)

One register row = one enforceable duty for both `toolkit_seed` and `ai_extracted`. Classifier prompt is atomic (one "shall" = one obligation), separates verbatim `description` (≤500) from interpreted `statement` (≤250), emits risk/likelihood/impact/controlOwner/sanctions/act_name and 12 unified areas of focus; `max 3500` tokens with 80k → 2×40k chunk merge. `ObligationMapping` gains `description`/`title`/risk/owner/`act_id` (intel V3 edited); the 14-column item propagates through `InternalInstrumentDetail` → `ObligationSyncService` → Review DTOs → `ReviewService.save()`. Seeder order `AdminUserSeeder @Order(0)` → `ToolkitStartupSeeder @Order(1)`; scraper/storage logging INFO → DEBUG.

# CRITICAL RULES - MUST FOLLOW
## PLANNING MODE

- Always ask clarifying questions
- Use deep-dive sub-agents to assist with research
- Use deep-dive sub-agents to review the different aspects of your plan before presenting to the user

## CHANGE / EDIT MODE

- MUST use sub-agents — never implement features yourself when possible
- MUST identify changes from the plan that can be implemented in parallel, and use sub-agents to implement the features efficiently
- when using sub-agents to implement features, act as a coordinator only

## CODING STYLE

- controllers must be using thin and delegate to service classes
- always try to use jpa query methods where possible
- for filtering and searching, use jpa criteria unless otherwise
- avoid using jpql no matter what, when necessary use native query after prompting me for approval
- avoid n+1 queries
- use `@Builder.Default` on all initialized entity/DTO fields
- all `@Transactional` catch blocks must call `setRollbackOnly()`
- catch `Throwable` (not `Exception`) in processor/scheduler code
- use `em.clear()` in catch blocks to prevent Hibernate stale-state issues
- frontend must use TanStack Query (`@tanstack/react-query`) for all data fetching — never raw useEffect + fetch
- wrap fetch calls in AbortController to prevent race conditions on unmounted components
- all mutation endpoints must validate inputs server-side and return the updated entity for cache invalidation
- testing E2E flows: MUST use Playwright via the frontend UI — NEVER curl to simulate frontend calls

## DATABASE SCHEMA CHANGES

- Whenever you are recreating and dropping databases, ALWAYS use POSTGRES superuser
- Whenever you make changes to the database schema, ALWAYS edit the existing migrations if they are the ones updated
- Only create new migration files where necessary for new entities/tables added later
- MUST NEVER insert/update data via raw SQL — always use the application APIs (controllers/endpoints) to create or modify data. Direct SQL mutations bypass business logic, validation, and audit trails, and will produce incorrect test results
- drop and recreate the tables and check the databases and intel backends and verify that the fix is correct, prompt me to start backends and onboard and then we test on the Tenant

## TESTING

- MUST use Playwright (`@playwright/test`) ONLY for single-page UI checks (e.g. verify one table, drawer, or chip renders at `http://localhost:5174/<page>`) — do NOT use Playwright for multi-step onboarding wizard (`/onboarding` 4 steps) which is flaky in headless automation
- For onboarding E2E, prompt the user to test manually via the browser using the parameters below; do NOT automate it with Playwright
- MUST NEVER use manual curl/PowerShell to test API endpoints that are called through the frontend — this bypasses the real request chain and produces misleading results
- ONLY use curl for pure backend-only internal endpoints (e.g. `/api/v1/internal/` server-to-server callbacks) that have no frontend path
- MUST NEVER assume changes work — always verify builds compile (`mvn clean compile`, `npm run build`) and check backend logs for errors after any manual onboarding (`%TEMP%\opencode\{intel,tenant}-{out,err}.log`)
- if onboarding fails, MUST STOP and fix before proceeding with any new work
- after every database drop/recreate, MUST prompt the user to start the backends themselves and then run manual onboarding — NEVER start backends automatically; do NOT proceed with automated testing without user confirmation
- use the following onboarding parameters (values are examples; credentials via env vars only)
 organization name: Mam Corp
 address: No 121, Lewis Street, Lagos Island, Lagos
 email: env var `ORG_EMAIL`
 cco email: env var `CCO_EMAIL`
 user type: local 
 local user email: env var `TENANT_USERNAME`
 local user password: env var `TENANT_PASSWORD`
 after onboarding: MUST inform me to check the UI and verify

## VERIFICATION

- after every backend restart, MUST verify builds compile and prompt user to start backends + run manual onboarding (do NOT start backends or automate onboarding with Playwright)
- after onboarding, MUST verify the UI loads and check the backend logs for errors
- if onboarding fails, MUST STOP and fix before proceeding with any new work
- use the following onboarding parameters (values are examples; credentials via env vars only)
 organization name: Mam Corp
 address: No 121, Lewis Street, Lagos Island, Lagos
 email: env var `ORG_EMAIL`
 cco email: env var `CCO_EMAIL`
 user type: local 
 local user email: env var `TENANT_USERNAME`
 local user password: env var `TENANT_PASSWORD`
 after onboarding: MUST inform me to check the UI and verify
- for frontend single-page checks, MAY use Playwright to verify one table/drawer/chip at `http://localhost:5174/<page>` — never for full onboarding flow
- admin login (intel backend): env var `ADMIN_USERNAME` / env var `ADMIN_PASSWORD`

## MAINTENANCE

- after every confirmed feature completion, update AGENTS.md:
  - add a `## Done — <feature name>` section with architecture, backend changes, frontend changes
  - remove any stale "planned" or "in-progress" references
  - compress old Done sections into 1-2 line summaries if the file exceeds 600 lines
- keep the context window fresh — the AI reads AGENTS.md at session start, so it must reflect current state

## GIT WORKFLOW

- always create a feature branch before starting work: `feature/<short-description>` or `bugfix/<short-description>`
- never commit directly to `main`
- after completing a feature, ask the user for approval before committing and pushing
- commit message format: `<type>: <description>` (e.g. `feature: add TanStack Query to obligations page`)
- only push after the user explicitly confirms

## UI DESIGN

- in pages with tables, MUST use similar styling as the obligations register pages
- in the tables MUST use maximum of five columns to ensure visibility
- the card stats MUST have a drop down
