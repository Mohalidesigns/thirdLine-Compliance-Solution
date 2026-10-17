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
- Docker PostgreSQL: container `db` (`atheris-postgres-intel`), port 5432, DB `atheris_intel`, user via `DB_USERNAME` / `DB_PASSWORD` env vars — no hardcoded defaults in `application.yml` (strong password set on the `atheris` role)
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
  - `docker run --name db -e POSTGRES_USER=atheris -e "POSTGRES_PASSWORD=$DB_PASSWORD" -p 5432:5432 -d postgres:17` — never hardcode a password; the `atheris` role password lives in the `DB_PASSWORD` env var
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

## Skills

MUST load the matching skill before doing any non-trivial task and implement the work directly — there are no project sub-agents, only skills. Use the built-in `general`/`explore` agents only when genuinely parallel or exploratory work exists.

| Skill | Location | When to Use | Load for... |
|-------|----------|-------------|-------------|
| `frontend-register-page` | `.opencode/skills/frontend-register-page/SKILL.md` | Any MUI table page — new, modified, or bugfixed (KPIs, filters, drawer, pagination) | Per-page pattern: stats cards → filters → sortable 5-col table → detail drawer; tenant (TanStack Query) vs intel (raw useEffect) fetching |
| `obligations-page` | `.opencode/skills/obligations-page/SKILL.md` | Obligations register/detail pages (tenant `/obligations`, intel Obligations Explorer) | Obligations-specific spec: FormattedText verbatim/interpreted, DTO mapping, tenant vs intel differences |
| `backend-module-scaffold` | `.opencode/skills/backend-module-scaffold/SKILL.md` | Any entity + repository + service + controller + DTOs + migration — new, refactored, or bugfixed | Entity/Repository/Service/Controller/DTO patterns, `@Builder.Default`, `@Transactional` error handling, compile checks |
| `db-migration` | `.opencode/skills/db-migration/SKILL.md` | Any CREATE TABLE, ALTER TABLE, column add/edit, Flyway repair | In-place migration edits, V<next> rules, POSTGRES superuser drops, no raw-SQL data mutations |
| `api-sync` | `.opencode/skills/api-sync/SKILL.md` | After adding/changing endpoints, verify frontend api.js matches | Scan all `@RestController` vs all `api.js`; report missing/dead/parameter/auth/shape mismatches |
| `atheris-register-page` | `.claude/skills/atheris-register-page/SKILL.md` | Any register/explorer/detail page or dashboard in either app | The authority: cross-app recipe, field-drift tables, verified trap catalogue, `check_dto_binding.py` |

## MCP Servers

| Server | Package | Scope |
|--------|---------|-------|
| postgres | `@modelcontextprotocol/server-postgres` | Direct SQL on `atheris_intel` |
| playwright | `@playwright/mcp` | Browser automation (Chromium) |
| filesystem | `@modelcontextprotocol/server-filesystem` | File read/write (scoped to project) |

Config: `opencode.json`

## Recent Changes

### Verity Compliance branding (both frontends) — `feature/verity-branding`
- Logo set (`Verity/` — light/dark logo, mark, favicon) in intel `public/` and tenant `src/`. Shared `AppSidebar` shows the full logo, or the mark when collapsed; both apps pass them.
- Login pages, tenant onboarding and the public remediation page use the logos; favicons and tab titles read "Verity Compliance"; intel `BRAND.NAME` is "Verity". Presentation only — no backend change.

### Tenant Compliance Universe (dashboard section + page) — `feature/tenant-dashboard-universe`
- **Page `/universe`** (`pages/UniversePage.jsx`, sidebar "Compliance Universe", first under registers) mirrors intel `/admin/universe`: risk KPIs (click = risk filter, dropdown = by regulator → drill sets risk+regulator), Top Regulators rows and Nature Mix chips (click = filter), Areas of Focus chips (click toggles the table filter), FilterBar (search, regulator, area, risk, nature, status), sortable server-paged `SectionTable` (Instrument | Regulator | Area of Focus | Risk | Status). All filters live in the URL. Row click opens an `EntityDrawer` (details, AI summary, obligations → `/obligations/:id`, sanctions); "Open in Instruments" uses the new `/instruments?id=` deep link.
- **Dashboard** (`CcoDashboardPage`) opens with `components/dashboard/ComplianceUniverseSection` above the attention cards; every card, regulator, nature and area deep-links into `/universe` with the filter applied.
- **Backend:** `GET /api/v1/subscriptions/instruments/universe-stats` → `UniverseStatsResponse` (`total`, `byRiskRating`, `byRegulator`, `byNature`, `byAreaOfFocus`, `byStatus`, `regulatorsByRisk`; count-ordered) and `GET /subscriptions/instruments/universe` → `Page<UniverseInstrumentItem>` (filters `q`/`regulator`/`areaOfFocus`/`riskRating`/`nature`/`status`, whitelisted sorts, in-memory because rows come from the platform API). Universe = platform instruments of the tenant's active regulators confirmed into the register (`InstrumentsService.confirmedUniverse`).
- **Bug fixed:** `InstrumentsService.search` read only the first 200 platform results (register showed 50 of 112); it now shares `confirmedUniverse`, which pages the whole platform search.
- **Verify (done, live):** 112/54/37/1 = `count(distinct instrument_id)`; area chip 112→23; area+High 22; +CBN drill 19; regulator row 7; Clear → 112; drawer + `/instruments?id=` open; dashboard area/drill links land filtered (19, 14); no console errors. **Gotcha:** restarting the tenant backend signs tenant users out.
- **Carried onto `feature/tenant-compliance-universe`** (on top of the heatmap/runbook branches) by a 3-way apply of the uncommitted draft; on the dashboard the Universe section sits above the restored KPI row. Re-verified live: 112/54/37/1, AML/CFT/CPF → 23, drawer opens.

### Thirdline UI adoption (both frontends) — `feature/thirdline-ui-adoption`
- **One design system for both apps, modelled on Thirdline Internal Audit** (thirdline.atherislimited.com). Tokens lifted from Thirdline's CSS vars: navy `#1A365D`, gold accent `#D4AF37`, bg `#F7FAFC`, Figtree font, Tailwind gray scale, `.badge-*` tones.
- **`shared/src/theme/`** — `thirdlineTheme.js` (each app's `theme/lightTheme.js` now just re-exports it) + `tokens.js` (`TL`, `TONES`, `tone()`, `riskTone()`, `statusTone()`). Component overrides do most of the work: 12px cards with gray-100 hairline + shadow-sm, uppercase gray-500 table heads, pill chips (filled chips render as soft badges), 8px inputs/buttons, Dialog title/actions rules (no `dividers` needed). `palette.warning` is now orange `#DD6B20`; gold lives in `palette.accent`.
- **`shared/src/icons/heroicons.jsx`** — Heroicons v2 outline (stroke 1.5) as `XxxIcon` components (`size`, `sx`). Icons Thirdline uses are copied from its app verbatim. Prefer these over `@mui/icons-material` (MUI kept only where no heroicon exists: ContentCopy, VisibilityOff, Block).
- **App shell** (`shared/src/components/shell/`): `AppShell` (collapsible 260/72px sidebar persisted in localStorage, temporary drawer below `lg`, 64px top bar, 32px content padding), `AppSidebar` (navy, 40px items, gold 3px active border, sections split by white/10 rules, Collapse at the foot), `AppTopBar` (gray-50 search, bell with red pill, avatar dropdown with Logout). Each app's `components/layout/{MainLayout,Sidebar,TopBar}.jsx` are thin wrappers. Top-bar search routes to `/obligations?q=` (tenant) / `/admin/instruments?q=` (intel) — both pages now read `q`.
- **Page kit** (all exported from `shared`): `PageHeader` (white full-bleed title band — FIRST child of a routed page only), `KpiCards`/`KpiCard` (Thirdline stat card: uppercase label, tinted icon tile, `tone`, `caption`, `active`, breakdown dropdown kept), `FilterBar`/`FilterField`/`SearchInput` (labels ABOVE controls), `DataCard`/`CardLink` (panel + "View All"), `StatusBadge`/`RiskBadge`/`StateBadge`, restyled `DetailHeader` (`band` prop for routed pages; in-flow inside drawers), `SectionTable`, `SectionTabs`, `CoverageStrip` (now KpiCards), `EntityDrawer`; `riskChip`/`statusChip` now return badges.
- **Every routed page in both apps swept onto the kit** (presentation only — no query/field/route changes). Tables over 5 columns folded secondary fields into captions (intel Acts lost `status`/`instrumentCount` sort; Universe, Licenses, Regulators, Inbox, Watchlist, tenant Findings/Uploads/Evidence trimmed). Unrouted intel feature folders (carbon, ESG, dataHub…) were left untouched.
- **Bugs fixed on the way:** StrictMode alive-ref regression was back in intel `ControlExplorerPage`/`SanctionExplorerPage`/`RegulatoryCoverage` (pages empty in dev) — re-armed on setup again; tenant `ControlsPage` used `navigate` without `useNavigate()` (Open Findings KPI crashed); intel `RegulatorAdminPage` called an undefined `setError` and rendered an `Error` object as a child; tenant Settings "Â·" mojibake.
- **Verify (done):** intel + tenant `vite build` green; every routed page in both apps loaded live (headers, KPIs, rows, no crashes); collapsed + mobile shell checked. **No backend change.**


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
- **~50 seeded returns show "Due date needed"** — their platform wording has no deadline ("Annually", "Quarterly", "As specified by CBN"); a CCO/admin must set each via Edit schedule. A bulk "set due dates" screen would speed this up.
- Seeded return frequency labels can be lossy copies of the platform text (e.g. LCR shows "Quarterly" but correctly runs MONTHLY from the platform's full wording).
- FindingsPage has 7 table columns (rule: max 5) and still uses raw useState/useEffect (no TanStack Query); default status filter 'Open' hides imported Remediated/Closed findings until the filter is changed.
- "New Control" form still writes only the control side of obligation links (import writes both).
- `ObligationService.createObligation`/`updateObligation` check `obligationRepo.existsById(instrumentId)` — the wrong repository (no local instrument table).
- Intel frontend `api.js:244` still treats 403 as session expiry (the tenant was fixed — see below); check the intel `SecurityConfig` entry point too.
- `PlatformApiClient` swallows platform failures, so "platform down" surfaces as 404 instead of 502.
- `changePassword` does not apply the password-strength rule that invite/reset use.
- Seeded **control** risk (`compliance_controls.risk_level`, tenant `controls.inherent_risk`/`residual_risk`) still carries the old inflated toolkit band and drives test frequency (1835 tests due in 30 days) — being fixed in its own session.
- Near-duplicate seeded act names (e.g. "Consumer Protection Framework" vs "CBN Consumer Protection Framework") split Risk by Act rows.

## Done — Dashboard Consistency (tenant `/dashboard`) — `bugfix/dashboard-consistency`

Every widget now adds up and agrees with the others; `DashboardConsistencyTest` cross-checks the totals.
- **Shared rules (`atheris-compliance-common`):** `risk/RiskBands` — one band rule for both backends (likelihood × impact on 1..5, Low <6 / Moderate 6–11 / High 12–17 / Critical ≥18; accepts toolkit Very Low..Very High and the matrix axes; missing = `Unrated`, never a default band). `taxonomy/AreasOfFocus` — one area vocabulary (universe names): obligation area = instrument area, else its toolkit-section area via aliases (AML/CFT→AML/CFT/CPF, Conduct Risk→People and Conduct Risk, Capital Market→Capital Market Operations); the generic CRMP sheet "Compliance Risk Management" is never an area → `Unassigned`.
- **Root causes fixed:** intel toolkit import used 3×3 cut-offs on a 5×5 score (High×Medium = Critical → 86% Critical); tenant seed never set `actName`/`regulationId` (every obligation "Unassigned" act); "Failing (High Risk)" counted controls with residual risk High (a seeded copy of inherent risk), not test results; test coverage read only tasks due before today; score dropped components without data so coverage alone gave 100%; returns % used all 449 periods as denominator; `/returns/calendar` is a Spring Page but the dashboard expected an array (upcoming/"Coming Soon" always 0); `getRiskProfile` defaulted a missing rating to Low; trend only had days the 2am cron ran.
- **Data repairs (idempotent, app code, no SQL):** intel `ToolkitDataRepairService` (run by `ToolkitStartupSeeder`) re-bands toolkit obligations and reassigns areas; tenant `SeedDataRepairService` (`@Scheduled`, runs until it succeeds once per start — the platform may start later) links act, inherits area, re-bands risk only where the rating still equals `RiskBands.legacyToolkitBand` (user edits kept), then refreshes today's snapshot. Live result: platform risk High 1316 / Moderate 213 / Critical 5 / Low 1; 199 obligations Unassigned area; all 1535 tenant obligations got an act (112 acts).
- **Metrics (`ComplianceMetricsService`):** controls pass/fail from the latest `control_test_results` row; `controlTestCompletion` = tested ÷ total; `controlEffectivenessPct` = passing ÷ tested; tests due = open tasks due ≤30 days; returns on time = on time ÷ (filed + overdue) (`returnsDue`); empty denominators are `null` (UI "N/A"). **Score** = weighted mean of coverage 30 / control effectiveness (passing ÷ all controls) 25 / returns on time 30 / findings within SLA 15 (stored tenant weights; weight key `controlTests` kept); components without data are left out; `scoreBreakdown` drives the KPI tooltip (`ScoreBreakdown.jsx`). Board pack: "Controls Tested", "Critical/High Obligations", N/A metrics.
- **Returns stats:** `ReturnStatsDto.buckets` (`ReturnService.statusBuckets`) — exhaustive: filedOnTime + filedLate + overdue + inProgressNotDue + notYetDue = tracked, plus `dueSoon`.
- **Universe / risk profile:** `byRiskRating` includes `Unrated`, `byAreaOfFocus` includes `Unassigned` (filters accept both); `RiskProfileDto` rows gained `unrated`, summary `unratedCount` + `actCount` (excludes Unassigned).
- **Snapshots:** one row per day (upsert); today's refreshed on startup and hourly (`:15`); trend = last 30 days, missing days drawn as gaps (history can't be backfilled — metrics are point-in-time).
- **Frontend:** Controls card on live metrics (passing/failing/not yet tested/tests due), Returns card with all statuses + total + on-time %, Sanctions "Potential exposure (maximum statutory penalties)", Universe "Unrated" card + outlined "Unassigned" chip (dashboard + `/universe`), KPI "Critical/High Obligations", shared `KpiCard` gained `tooltip`.
- **Verified live (2026-10-17):** universe 54+37+1+20 = 112, areas sum 112; score 45.0%; returns 8 overdue + 441 not yet due = 449; controls 1 passing / 0 failing / 2136 untested; risk by area sums 1535; 112 acts; no console errors. Tests: common 18, intel repair 3, tenant 119 (new: `ComplianceMetricsServiceTest`, `DashboardConsistencyTest`, `ReturnStatusBucketsTest`, `SeedDataRepairServiceTest`).
- **Gotcha:** on JDK 25 Mockito can't mock concrete classes — run tests with `-DargLine="-Dnet.bytebuddy.experimental=true"` (pre-existing `WorkingDayServiceTest` needs it too).

## Done — Compliance Runbooks (core slice of `Atheris_Compliance_Runbook_v1_0.md`)

Executable, evidence-producing procedures linked to obligations/controls/framework clauses. Branch `feature/compliance-runbooks` (built on `bugfix/restore-28ca694-regressions`). API contract: DTO/endpoint names in the runbook spec §9 plus the shapes below.

### Tenant backend (`modules/runbooks/`)
- **Migrations V38–V41** (spec said V10–V14; tenant was already at V37): frameworks/clauses, runbooks + immutable versions tree (sections → steps → evidence reqs, prerequisites, escalation paths, rollback steps, clause maps, approvals), executions (step executions, evidence items, escalations, sign-offs; `runbook_execution_ref_seq`; unique `(schedule_id, scheduled_for)`), schedules + review schedules/events. Extra columns vs spec: `runbooks.source_template_code/status_reason/review_cadence`, `runbook_versions.submitted_at`, rollback `reverses_step_code`, step-exec `rollback_id/failure_category`, execution `outcome/status_before_pause/preflight_*/schedule_id/scheduled_for/pack_generated_at`. Hashes are `VARCHAR(64)` (Hibernate `validate`).
- **Framework library** seeded idempotently at startup by `RunbookFrameworkSeeder` from `resources/runbooks/runbook_frameworks.json` (34 frameworks / 243 clauses: CBN RBCSF DMB+OFI, NDPA, ISO 27001:2022, PCI 4.0.1, NIST CSF/800-53, CIS v8, GDPR…; clause SLAs e.g. NDPA s.40 = 4320 min, CBN incident = 1440). Insert-only. Tenants may add internal-policy frameworks/clauses via the API.
- **Services:** `RunbookService` (CRUD, Criteria filters, versions DRAFT→IN_REVIEW→PUBLISHED, previous → SUPERSEDED, SHA-256 canonical content hash at publish, diff, approvals — approver ≠ author, HIGH/CRITICAL must be approved, JSON export/import in the portable `atheris-runbook/1` format); `RunbookTreeService` (batch load/replace/copy of a version tree, portable format, diff); `RunbookLintService` (L1–L10; ERROR rules L3/L5/L6/L7/L9 block submit/publish; L9 secrets also rejected on save as 400 `secret_in_command`); `RunbookExecutionService` (state machine §8.2: only PUBLISHED executes, pre-flight acks, blocking-step order, PASS blocked until mandatory evidence, dual control = second user + password re-auth (400 `verification_failed`, never 401), FAIL → finding/escalation/pause/rollback, blocking failure → ESCALATED, rollback steps become tracked step rows, PENDING_SIGNOFF when all terminal, CCO acceptance closes → `control_test_results` row per linked control; evidence stored via `FileStorageService` + `evidence_files` (`RUNBOOK_STEP`), SHA-256 server-side, extension allow-list, 25 MB, no update/delete endpoints); `RunbookEvidencePackService` (ZIP: evidence files + `manifest.json` + `manifest.sha256` + openhtmltopdf report; re-verifies every file hash; `pack_hash` = SHA-256 of the ZIP); `RunbookScheduleService` (frequency from anchor, weekend/public-holiday shift to the previous business day, review cadence); `RunbookJobs` (`@Scheduled` SLA monitor every 60 s: 50 % in-app, 80 % SLA_80 levels, 100 % SLA_BREACH + audit; hourly schedule runner creates NOT_STARTED executions `leadDays` ahead, idempotent; opens due periodic reviews); `RunbookTemplateService` (pulls templates from intel, adopt with provenance, `POST /runbooks/{id}/template-revision`).
- Every state change writes an audit event (`runbook_*`, `execution_*`, `step_*`, `evidence_captured`, `escalation_sent`, `rollback_triggered`, `signoff`, `pack_generated`).
- **New role `IT_OPS`** (`AppRole`): execute + capture evidence only. Invite and role change now validate against `AppRole.ALL`; onboarding normalisation and the Settings role picker know it. There is no LDAP group→role mapping in the codebase (roles live on user rows).
- `GET /runbooks/assignees` — active users for owner/operator pickers (GET `/users` is admin-only).

### Intel (`modules/runbooktemplates/`, V17)
`runbook_templates` (content JSONB, content hash, `step_count`/`section_count`), seeded by `RunbookTemplateStartupSeeder` (`@Order(2)`) from `resources/runbooks/runbook_templates.json` — 12 templates: RB-ACC/VUL/INC/CFG-001 in full, 8 outlines; a changed content hash bumps `template_version`. `GET /api/v1/internal/runbook-templates[/{code}]` (X-Api-Key) and `GET /api/v1/admin/runbook-templates[/stats|/{code}]` (PLATFORM_ADMIN). Read-only explorer + detail pages under COMPLIANCE → "Runbook Templates". **Note:** intel now has TanStack Query (provider in `main.jsx`); the explorer uses it like `RegulationExplorerPage`.

### Tenant frontend (`src/pages/runbooks/`, `src/components/runbooks/`)
Sidebar "Runbooks" (between Controls and Findings) + `RunbooksNav` tabs. Pages: Library (P1), Builder 5-step wizard with 2 s autosave + live lint (P2), Detail with 8 tabs (P3), Executions (P4), Execution Console 3-pane with SLA timer/milestones, evidence capture, dual-control verify, rollback (P5), Summary with sign-off + evidence pack (P6), Approvals with diff (P9), Coverage Matrix (P10), Template Library + Adopt (P11); `RunbooksWidget` on `CcoDashboardPage`. `api.runbooks.*` in `services/api.js`; `request()` errors now carry `err.status` / `err.code`.

### Verified (live, browser pane :5184 against backends from this branch, 2026-10-16)
Startup: tenant V38–V41 + `RunbookFrameworkSeeder` (34 frameworks / 243 clauses), intel V17 + 12 templates seeded. Template Library lists all 12 from intel; adopt RB-ACC-001 (HIGH) → DRAFT v1 with provenance, lint clean, submit → Approvals shows it with "You (cannot approve)" (single-user tenant, so approval + dual control were not exercised end to end). Adopt RB-LOG-001 (MEDIUM, linked control) → publish v1; weekly schedule from Sat 17 Oct shifted to Fri 16 Oct; hourly runner created scheduled RBX-2026-000003 and advanced to 23 Oct. Manual run RBX-2026-000001: pre-flight, PASS blocked server-side (409 `evidence_required`), out-of-order start blocked (409 `blocked_by_previous_step`), evidence hashed, 7/7 passed → PENDING_SIGNOFF → operator + CCO sign-off → COMPLETED_PASS → control test result "Passed" recorded on the linked control; evidence pack ZIP (7 files + manifest + PDF) re-hashed in the browser = `pack_hash`. Run RBX-2026-000002: blocking step failed with "raise finding" → ESCALATED, finding #1 (Medium) raised, L1 escalation sent; aborted. Coverage 6 covered / 9 partial / 228 uncovered; dashboard widget live. Intel explorer (12 templates, KPIs) and RB-INC-001 detail (8 sections / 27 steps / 5 escalation levels / 2 rollback steps) checked live on :5183.

### Not in this slice (follow-ups)
Calendar (P7), Review Queue UI + instrument-change review triggers (P8; review events are created but not yet actionable), Analytics (P12), Settings → Runbooks tab (P14), MD/PDF runbook export, public attestation page, returns hook for RB-RET-*, coverage "control only" (amber = mapped to unpublished runbooks instead), dual-control re-auth for LDAP users, the spec's unit/integration/E2E tests.

## Done — Risk Heatmap Drill-down

Tenant Dashboard → Risk Profile → Risk Heatmap is clickable: a populated cell, a band in the legend (now shows per-band counts, e.g. "Critical 1373"), or a row in the table view opens `/obligations?cells=<impact|likelihood;…>&riskView=inherent|residual&drill=<label>`. The register shows a removable "Risk heatmap (…)" chip.
- **Backend:** `GET /obligations/register` gained `cells` + `riskView`; `ObligationRegisterItem` gained `impactRating`/`likelihoodRating` (from the classification). The filter uses the heatmap's own population and axes (applicable only; impact = classification impact, or residual rating in residual view) so the register total equals the clicked count. Bands are sent as their populated cells, so band membership is never recomputed on the server.
- Verified live: Critical band 1373 → register 1373; Very High × Medium 3 → 3 rows; clearing the chip → 1535.
- **Data oddity (pre-existing):** the likelihood axis shows Medium/High/Low columns after Almost Certain — some classifications store likelihood on a 3-level scale, which `resolveAxis` appends.

## Done — Restored work reverted by 28ca694

Commit `28ca694` was made from a stale working copy and overwrote 30 frontend files with old versions (tenant Acts/Reports/public `/remediate/:token` routes, LDAP onboarding, Settings holidays/manager, event-triggered returns, sanctions parity, CCO metrics, control test review; intel Act-detail tabs + drawers, `ObligationExplorerDetailPage` → `ObligationDetailView`, explorers, Document Pipeline, nav groups, api abort signals, RegulationExplorer `regulatorId`). Restored by per-file 3-way merge (base = the stale version copied), then the Thirdline restyle (`49e31cb`) merged on top. Intel nav keeps COMPLIANCE / OPERATIONS / TENANTS. Tenant sidebar: Acts under registers, Reports under assurance.
- **Lesson:** before committing a large multi-file change, diff against the branch tip (`git diff HEAD --stat`) — a file whose diff deletes recently merged features is a stale copy.

## Done — Return Due Dates (no more overdue-on-day-one)

Seeded returns had no due date (the platform has none: intel `deadline` is a copy of `frequency`, `remarks` is empty, and intel `filing_date` is an artifact stamped onto Sep 2026), so they fell back to "due the 1st of this month" → 92 periods overdue on day one.

- **Schedule model** (`regulatory_returns`, V6 edited in place): `due_days_after_period_end` (offset rule — due = calendar-aligned period end + N days), `due_date_source` (`platform_text` | `user` | null), `deadline_text` (the regulator's wording). The fixed-date rule stays in `filing_date`. "N months after period end" is stored as a fixed date (e.g. 3 months after year-end → 31 Mar). Period labels stay = month of the due date (the rendition grid selects by due date but buckets by period). Monthly offsets 1–28.
- **Generation** (`ReturnService.ensureInstances`): a return WITH a rule is always generated from the rule (never "continue from the latest instance" — that produced wrong dates after a rule change); Monthly-or-longer with no rule → **no periods** ("Due date needed"); only rule-less Daily/Weekly continue from the latest.
- **`ReturnDeadlineParser`** turns platform wording into a rule ("Annually by June 30" → 30 Jun; "10th day of the following month" → 10 days after period end; "on or before 5th of January, April, July, and October" → 5 Jan/Apr/Jul/Oct; "within 3 months after year-end" → 31 Mar); statutory basis tried when the frequency text has none; event-relative wording (AGM, anniversary) → none. Monthly only: a bare day of month ("Monthly, on or before 5th", "by the 10th", "15th of each month") → N days after period end; the ordinal must close the clause ("5th working day", "5th of January" don't match) and this rule is never read from the statutory basis. `ReturnDeadlineParserTest` 45 cases.
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

## Done — Onboarding Regulator Split (intelligence vs toolkit) + Intel Document Pipeline + Gemini-primary AI

Branch `feature/intel-obligations-parity` @ `1ffb0af`. **Not merged to `main`.**

### Two regulator sets at onboarding
The license flag `autoSeedObligations` already decided *whether* toolkit obligations seed; onboarding now also decides *which* regulators feed each of the two distinct paths:

| Path | Stored on `tenant_profile` | Feeds | Lands in |
|---|---|---|---|
| **Intelligence** | `subscribed_regulators` (jsonb) | AI pipeline / `ObligationSyncService.syncNow` | **Review Inbox** → human Edit & Save → Register |
| **Toolkit** | `toolkit_regulators` (jsonb, **new**, V2 edited in place next to `subscribed_regulators`) | `RegulationSeedService.seedAll` | **Obligations Register** directly |

- **Intel:** `RegulatorDto` gains `toolkitCount`/`intelligenceCount` (built in `RegulatorService.buildInstrumentStats`); `InternalInstrumentService.findRecentForTenant` excludes `upload_source='toolkit_seed'`; `Constants.UPLOAD_SOURCE_{TOOLKIT,SCRAPER,MANUAL,BACKFILL}`.
- **Tenant:** `TenantProfile.toolkitRegulators`; `POST /onboarding/toolkit-regulators` (`saveToolkitRegulators` — selection may be empty; ignored when the license lacks toolkit obligations); `OnboardingStatusResponse` gains `toolkitRegulators`/`autoSeedObligations`; `RegulatorSummary` gains `toolkitCount`/`intelligenceCount`; `RegulationSeedService.seedAll` reads `toolkit_regulators`; `SeedService.seedAsync` requires `autoSeedObligations` AND a non-empty `toolkit_regulators`; `ObligationSyncService.syncNow` reads only `subscribed_regulators` (+ a defensive toolkit skip); `RegulatorService.syncFromProfile` uses the union.
- **Onboarding wizard is 7 fixed steps** (backend `currentStep` numbering is authoritative): 0 License → 1 Institution → 2 User Setup → **3 Intelligence** → **4 Toolkit** → 5 SMTP → 6 Confirm. The Toolkit step only shows its table when `autoSeedObligations`; otherwise it explains there is nothing to select. Both regulator steps render via the shared `SectionTable` with a **search box**, Select-all that respects the filter, and a per-step count column (`intelligenceCount` → "Documents", `toolkitCount` → "Obligations").

### Intel Document Pipeline page (`/admin/pipeline`)
- New `modules/pipeline`: `AdminPipelineController` (`GET /api/v1/admin/pipeline` list + `/stats`, `PLATFORM_ADMIN`), `PipelineService`, `PipelineItemDto`, `PipelineStatsDto`. One row = one **non-toolkit** document: instruments (stage from status) plus `pending_downloads` failure rows. Server-side filter (`q`, `regulatorId`, `stage`, discovered date range) + paging.
- Stage vocabulary (`PipelineService.stageOf`): `failed` | `extracting` | `classified` | `published` | `superseded` | `withdrawn`.
- FE `JobQueuePage.jsx` rebuilt on the shared kit: 5 columns (Document · Regulator · Stage · Status · Discovered), **server-side** paging/filters (previously it fetched up to 1000 instruments and filtered client-side), KPIs **Failed Downloads / Total Downloads / Total Completed** with breakdown dropdowns. `api.platform.pipeline.list/stats` added to the intel `api.js`.

### AI provider (env-only; no secrets in the repo)
- **Gemini is primary** via its OpenAI-compatible endpoint (`spring.ai.openai.*` → `AI_PRIMARY_BASE_URL=/v1beta`, `completions-path=/openai/chat/completions`, `GEMINI_API_KEY`); **ISW gateway** (`AI_FALLBACK_BASE_URL=https://ai-gateway.isw.la`, `AI_FALLBACK_API_KEY`) is a *separate-provider* fallback. `spring-ai-starter-model-google-genai` is **not downloadable** here (private nexus times out) — use the OpenAI-compatible path with the existing `spring-ai-openai` starter.
- `AiConfig` registers a **JSON-tolerant** `RestClient` (a `MappingJackson2HttpMessageConverter` that also accepts `application/octet-stream`/`*/*`, plus a `JsonContentTypeInterceptor` that rewrites a missing/octet-stream response `Content-Type` to `application/json`) for BOTH providers.
- `AiClient.completeEntity` uses **Spring AI native structured output** — `ChatClient.create(model).prompt().user(prompt).call().entity(ClassificationResult.class)` — replacing hand-rolled JSON parsing. Response class: `modules/classification/dto/ClassificationResult` (nested `ObligationItem`/`SanctionItem`).
- **OCR cap removed:** `atheris.ai.max-ocr-chars` (default `0` = no cap) + `atheris.ai.chunk-size` (default `15000`); `ClassificationService.callLLm` splits the whole document into N chunks and merges. Cooldowns retuned (60s initial / 300s max, ×3).
- **OPEN ISSUE:** Gemini calls still fail (`Error while extracting response for type OpenAiApi$ChatCompletion`; earlier `application/octet-stream`, now `application/json`) and silently fall back to the gateway, and the classifier yields **0 obligations** for the seeded docs. Pipeline mechanics (scrape → OCR → queue → classify → publish) are verified working; the AI *output* is not.

### Verified (live)
Fresh-DB boot: intel 16 migrations (v16), toolkit auto-import `40 regulators / 393 acts / 394 instruments / 1535 obligations / 351 sanctions / 139 returns / 2137 controls`, 0 tenants / 0 licenses; tenant 35 migrations (v38). Pipeline observed: 13 OCR completed, 6 non-toolkit instruments, 4 classify jobs completed, `gemini-3.8-flash` reachable. Both frontends build green; intel backend compiles.

### Recovery note (this branch)
A working tree clobbered to the old `28ca694` state was committed by `git add -A` (27+ files — the intel sidebar grouping, the explorer suite, tenant `Reports`/`Acts` nav, `publicApi`). Fixed by restoring from `700166d` and redoing the genuinely-lost post-`700166d` work (intel pipeline client + page, tenant toolkit onboarding), then `git commit --amend` + `push --force-with-lease` → `1ffb0af`. **Rule: never `git add -A` on this repo — stage explicitly and diff each file first.** `PipelineStatsDto.completed` was also added (it was computed but never returned, so the "Total Completed" KPI drilled to 0).

## Done — Merge origin/main into the intel-parity branch (Thirdline UI + runbooks)

Branch `feature/merge-main-intel-parity` (merge commit `f62e6ef`, parents `1ffb0af` + `b9ef5b1`). **Not merged to `main`.** Integration of `feature/intel-obligations-parity` with everything main had added (Verity/Thirdline UI restyle, Compliance Runbooks, tenant Compliance Universe, heatmap drill-down, dashboard consistency, seed risk-band repair).

- **Resolution rules:** main deleted nothing and neither did we; 322 of main's 356 changed files are main-only (came in clean), 52 ours-only, 34 conflicted. Of the 34: **23 taken from main verbatim** (intel explorers/detail pages, `constants.js`, `Sidebar.jsx`, tenant `AppRoutes`/`Sidebar`/`CcoDashboardPage`/`ControlsPage`/`DashboardV2Page`/`ReturnsPage`/`SanctionsPage`, `shared/columns.jsx`), **5 main's + our feature re-applied**, **1 our version wins**.
- **main already had the same things** — so taking main's lost nothing: the `COMPLIANCE`/`OPERATIONS`/`TENANTS` grouping (main landed it independently), our `ensureRegulator` toolkit fix (81 calls), `reports`/`acts`/`universe` + runbook routes, `publicApi`, the full Thirdline kit. Verified with a **no-main-loss gate**: `git diff origin/main HEAD -- <the 23 files>` is empty.
- **The one deliberate override:** tenant `OnboardingPage.jsx` — main's 4-step simplification (no regulator picker, auto-subscribes nothing) is replaced by **our 7-step flow** (Intelligence + Toolkit), re-skinned onto main's Verity shell using main's `SectionTable` + `TL`.
- **Re-applied on top of main's UI:** intel `api.js` `platform.pipeline`; `JobQueuePage.jsx` server-side pipeline KPIs on main's kit; tenant `api.js` `toolkitRegulators`; `SettingsPage.jsx` **Email/SMTP tab** (5th `SectionTabs` tab).
- **TanStack kept:** main's UI is already TanStack (58 files vs our 35). Only intel `ControlExplorerPage.jsx` + `ControlDetailPage.jsx` regressed to raw hooks on main — both converted back to `useQuery`/`keepPreviousData`, and `JobQueuePage` is TanStack too.
- **Backend conflicts auto-merged correctly** (both sides kept): `OnboardingService` = our toolkit steps + main's `IT_OPS` role; `RegulationSeedService` = main's `seedBand()`/`AreasOfFocus` **and** our `toolkitRegulatorIds()`; `ToolkitImportService` = main's version (already has `ensureRegulator`).
- **Flyway V38 collision:** main owns tenant V38–V41 (runbooks); our SMTP migration renumbered **`V38__add_tenant_smtp_config.sql` → `V42__...`**. Intel unaffected (ours V16, main V17).
- **`spring-boot:run` gotcha:** after a merge that adds classes to `atheris-compliance-common` (e.g. `RiskBands`), you MUST `mvn install` the reactor — `spring-boot:run` resolves sibling modules from `~/.m2`, so a stale common jar gives `ClassNotFoundException`. And a **renamed migration lingers in `target/classes`** → `Found more than one migration with version 38`; `mvn clean` the module.
- **Verified (fresh DBs):** intel at Flyway **v17** + 12 runbook templates seeded + toolkit parity `394 instruments / 1535 obligations / 351 sanctions / 139 returns / 2137 controls`, 0 tenants; tenant at Flyway **v42** + 21 runbook tables + **34 frameworks / 243 clauses** + our 7 `smtp_*` columns + `toolkit_regulators`. Both backends start with zero errors; both frontends build green.

## Done — Review Edit Page Overhaul (inline editing, linked returns, header enrichment)

`ReviewEditPage.jsx` rewritten (`0ad5e72`): 5-col obligations table with inline title/verbatim/interpreted/risk editing, expandable classification overrides + linked returns; `ReviewDetail` gains `dateCommencement`/`nature`, `ReviewObligationDto` gains linked return ids/names.

## Done — Instruments Page Overhaul (KPIs, risk filter, enriched detail)

`InstrumentsPage.jsx` rewritten (`71d9097`): KPI cards, search/risk/regulator filters, 5-col sortable table; detail with obligations + sanctions tables. Field fixes: `sectionReference`, `obligationType`, `sanctionType`.

## Done — Intel Obligation Explorer Detail Page (Replicated from Tenant)

Intel `ObligationExplorerDetailPage.jsx` mirrors the tenant detail page (`db252c8`); `ObligationExplorerDetail` DTO extended (gap, applicability, controls, evidence, history), `GET /admin/obligation-explorer/{id}/controls|pdf`, 6 modal stubs.

## Done — PDF Routes Return 404 Instead of 500

Null `Instrument.pdfUrl` (toolkit instruments) now yields 404 `DOCUMENT_UNAVAILABLE` instead of an NPE 500 in both PDF call sites (`ObligationBrowserService.openPdfStream`, `InternalInstrumentService.openPdfStream`); both apps' `pdfErrorMessage` shows "No document is available". Still open: S3 `NoSuchKeyException` untranslated (500); `ObligationBrowserService.findById`/`classify` throw bare `RuntimeException`.

## Done — Dashboards Harmonized (risk / area / act)

Dashboard V2 routed at `/dashboard/v2` and fixed (inverted quarter date range, all-zero heatmap, total/submitted unit mismatch, ignored thresholds, per-row query in escalation-matrix). `/dashboard/v2/thresholds` no longer takes `tenantId` as a request param (cross-tenant read/write) — resolved via `TenantIdentityService`. Added `control-coverage?by=act` and `RiskProfileDto.byAct`. Tenant `CcoDashboardPage` gained risk profile / area / act sections (TanStack Query, 30s poll); intel `DashboardPage` gained a `RegulatoryCoverage` section.
- **Only link to filters a page reads:** `ObligationsRegisterPage` reads only `risk`, `regulator`, `areaOfFocus`, `owner`, `status`, `hasGap`; `impact`/`likelihood`/`act` links are silent no-ops; heatmap drill-downs use `cells`/`riskView` instead.

## Done — `atheris-register-page` Skill

`.claude/skills/atheris-register-page/` encodes the register/details pattern and the defects found building it. The `frontend-register-page` skill points at it, so both toolchains share one source of truth.

- **SKILL.md** — the per-app fork (tenant has TanStack Query; intel has neither the dependency nor a provider and must not get one as a side effect), the page recipe, the five highest-frequency traps, and a verification checklist that does not stop at a green build.
- **references/traps.md** — the full catalogue with evidence, grouped by failure mode.
- **references/data-model.md** — the field drift table and the canonical risk vocabulary.
- **scripts/check_dto_binding.py** — mechanises the field-vs-DTO diff. Validated against the pre-fix `InstrumentsPage`: catches all three real bugs, zero false positives, and reports OK on the fixed version. Supply **all** backing types (list + detail + stats DTO) — under-supplying them is the main source of false positives.
- **scripts/grid_codemod.py** — the MUI 7 Grid conversion.

**Note:** the skill was verified factually (every claim re-checked against the code) but has NOT been through the skill-creator's eval loop — no with-skill vs baseline runs, no trigger-description optimization. Worth doing before relying on it to trigger on its own.

## Done — Risk Matrix Defaults Repaired

`RiskMatrixConfig` `@Builder.Default` axes/bands disagreed with V28 and `computeInherentRisk`; `V30__repair_risk_matrix_defaults.sql` repairs only the broken rows. Rule: entity `@Builder.Default` wins over migration defaults for JPA-created rows — keep them in agreement.

## Done — MUI 7 Grid Migration

154 legacy `<Grid item xs md>` usages converted to `size={{ xs, md }}` (MUI 7.3.11 `Grid` is v2; legacy props are silently ignored). Verify MUI APIs against `node_modules/@mui/material/Grid/Grid.d.ts`, not memory.

## Done — Intel Explorers (obligations, sanctions, returns, controls)

Four vertical slices, each a `GET /api/v1/admin/<entity>` + `/stats` + `/{id}` behind `@PreAuthorize("hasRole('PLATFORM_ADMIN')")`, following the `AdminRegulationController` pattern, plus an explorer and detail page following `RegulationExplorerPage`/`RegulationDetailPage`. Routes, nav and API client live in one shared commit made up front.

### Entity naming differs per module — check before copying code between them
| Entity | Act FK | Section field | actName |
|---|---|---|---|
| `ObligationMapping` | `regulationId` → column `act_id` | **`specificSectionReference`** | resolved (batch-loaded) |
| `SanctionsPenalty` | `regulationId` → column `act_id` | `sourceSectionReference` | resolved (batch-loaded) |
| `RegulatoryReturn` | **`actId`** directly | `sectionReference` | resolved (batch-loaded) |
| `ComplianceControl` | **`actId`** directly | — | **denormalised on the row** |

The tenant obligation DTOs use `sectionReference`, so intel's `specificSectionReference` is a genuine trap when porting a page across.

### Sorting on a service-resolved field throws at runtime
`actName` is not persisted on `ObligationMapping`, `SanctionsPenalty` or `RegulatoryReturn` — it is resolved in the service. Passing `sort=actName` into `Pageable` raises `PropertyReferenceException`. The explorers therefore sort Act on `regulationId`/`actId`, or leave it unsortable. `ComplianceControl` is the exception: `actName` IS a column there, so it sorts normally.

### N+1 avoided
Act names are resolved by collecting the page's distinct act ids into a `Set` and issuing one `findAllById` — one extra query per page regardless of page size. Obligation stats aggregate in SQL via new group-by queries rather than loading all ~1541 rows.

### The Intel frontend has NO TanStack Query
`@tanstack/react-query` is not a dependency of `atheris-compliance-intelligence-frontend` and there is no `QueryClientProvider` in its `main.jsx`. The `frontend-register-page` convention's "use TanStack Query, never raw useEffect" applies to the TENANT app only. Intel explorers use the raw `useState`/`useCallback`/`useEffect` pattern with race guards, matching `RegulationExplorerPage`. Aligning Intel with the tenant app would be a separate, deliberate migration.

### Known lint debt (pre-existing, not new)
The raw fetch-in-effect idiom trips `react-hooks/set-state-in-effect` — 3 errors per explorer/detail pair. The reference `RegulationExplorerPage`/`RegulationDetailPage` produce the identical 3 errors, and `npx eslint .` over the intel frontend already reports ~316 problems. No suppressions were added. Note the intel `npm run lint` script covers only the intel app; the tenant frontend has no eslint config at all.
## Done — Returns Register/Details Harmonized (incl. backend linkage)

`GET /returns/{returnId}/obligations` enriched to `LinkedObligationItem` (rows lazily fetch on expand); `overcomeCount` → `overdueCount`. Known: `ReturnService.getRegister` ignores `Pageable` sort.
## Done — Controls Register/Details Harmonized

`ControlsPage.jsx` shows `actName`/`actId`, linked obligations navigate to `/obligations/{obligationId}`, columns trimmed 9 → 5; `api.controls.*` takes no `opts` (no abort signal).

## Done — Instruments / Obligations / Sanctions Harmonized

Pages now render DTO enrichment they never read (verbatim vs interpreted text, section/area/type/deadline chips, act linkage, expandable sanction panels). Fixed: Instruments drawer read non-existent `obl.section`/`obl.type`/`s.type`; Instruments pagination capped at one page; register `hasGap` filter shadowed (renamed `hasGapFilter`).
- **Sanction amount field:** `InstrumentDetailResponse.SanctionItem.amountNaira` vs `sanctionAmountNaira` on every other sanction DTO.
- **Query keys for by-id details must be stringified** (`['x', String(id)]`) — `useParams()` gives strings, list ids are numbers.
- Concurrent agents must not share `dist/`; verify with `npx vite build --outDir dist-verify-<name> --emptyOutDir`.

## Done — Review Inbox Harmonized (enriched obligation summary)

`ReviewInboxPage.jsx` now mirrors `ReviewEditPage.jsx` (the harmonization reference).

- **Expandable rows** — each review row has a chevron; expanding lazily calls `GET /review/{reviewId}` (`api.review.get`) and renders a read-only enriched obligation table: `#`, Obligation (bold title + grey `plainEnglishStatement` caption, verbatim `description` behind an `InfoOutlined` tooltip), Section (mono chip), Area (`areaOfFocus`), Risk (`inherentRiskChip` with `likelihood × impact` tooltip), Act (`actName`, falls back to `Reg #{regulationId}`). `applicable === false` renders at 0.45 opacity with a "Not applicable" chip.
- **No backend change** — `ReviewItem` (list DTO) stays instrument-level; enrichment comes from the existing detail endpoint. `enabled: open` means collapsed rows fire no request (no N+1 on list load); `staleTime: 5min` makes re-expanding free.
- **Shared detail cache** — query key is `['review', String(reviewId)]`, matching `ReviewEditPage`'s `useParams()` string key, so expanding a row warms the detail page and vice-versa. The key must be stringified: `useParams()` gives a string while `item.reviewId` is a JSON number, and TanStack hashes `['review',12]` and `['review','12']` differently.
- **TanStack Query migration** — list / stats / skip moved off raw `useEffect` + `useState` per the register-page convention; list uses `placeholderData: keepPreviousData` so paging and sorting no longer flash a spinner. All queries pass `{ signal }` through to `api.review.*`.
- **Outer table trimmed to 5 data columns** (+ chevron + actions): Document (Source chip folded inline before the title), Regulator, Risk, Obligations, Received. Nothing previously shown was dropped; the standalone `source` sort header is gone, but source remains filterable via the dropdown and the Intel/Upload KPI cards.
## Done — Dashboard V2 (Rendition Tracker + Control Coverage)

`DashboardV2Page` (Rendition tab + Control Coverage tab, `RiskHeatmap`) backed by `DashboardV2Controller`/`DashboardV2Service` (`/dashboard/v2/{rendition-grid,escalation-matrix,risk-heatmap,control-coverage,returns-by-period,risk-profile,thresholds}`) and `risk_matrix_config` (V28). Risk scoring: Impact Insignificant..Severe × Likelihood Rare..Almost Certain (1–25); bands Low / Moderate (≥6) / High (≥12) / Critical (≥18). `computeResidualRisk()` not yet wired into control tests. Returns seeding fix: `filing_due_day_of_month` was NULL on all returns → `parseDueDayFromFrequency()` added.
- The live tenant `/dashboard` is **`CcoDashboardPage.jsx`** (imported under alias `DashboardPage`); V2 was unreachable until routed at `/dashboard/v2`.
- **Grep the import PATH, not the identifier** (aliased imports give false positives).

## Done — Pipeline Stage Breakdown

`GET /platform/regulators/{id}/pipeline-stats` (discovered/downloaded/extracted/classified + drill-downs), RegulatorDetailPage stage cards, Dashboard Pipeline Health banner, regulator table Discovered/Downloaded/Failed columns. Pushed at `5787d9f` (merge of `99008da`).

## Done — Tenant Backend Aligned as Submodule

Standalone tenant service copied in as Maven submodule `atheris-compliance-tenant-backend` (port 9091, DB `atheris_tenant`, schema `tenant`, migrations under `db/migration/tenant/`); modules: auth, users, onboarding, subscriptions, obligations, controls, findings, returns, notifications, dashboard, audit (hash chain). Run commands are in "How to Run" above.

## Done — Tenant Frontend Portal Built

Tenant portal `:5174`; polls via `ObligationSyncService` (no webhooks); uploads → platform `/internal/instruments/ingest` (SHA-256 dedup); onboarding/license calls target `:9091`. E2E: `ATERHIS_ONBOARDING_E2E_TESTING.md`.

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

## Done — Toolkit Seed via Committed JSON (no LLM points)

**Problem:** `classpath:toolkit/compliance_toolkits.md` never travelled into the JAR, so a fresh boot parsed nothing; points were generated per-startup via batched LLM calls (62 batches × 25, then virtual-threads/concurrency-5) — Gemini 429 / cooldown / quota burned, points backlog never finished, obligating an AI call for data the markdown already contained.

**Solution:** the markdown is converted once, offline, to a committed typed JSON (`tools/toolkit-md-points/export_json.py` → `compliance_toolkits.json`, ~4.8 MB), verified by `verify_json.py` (parity 1541 obligations / 597 sanctions / 139 returns / 363 universe / 192 CMP), and read at startup by the importer. Points and interpreted text are authored in the markdown and pass through verbatim — **no LLM calls at seed time**, no `OPENROUTER_API_KEY` needed to seed, no per-startup points job.

### Changes
- **`compliance_toolkits.json`** (committed, `src/main/resources/toolkit/`) — typed `ToolkitSeedDoc`: `meta` (with per-table totals), `universe`/`universeSanctions` (informational), `obligations` (Map<String, List<ObligationRow>>), `sanctions`, `returns`, `monitoringPlan` (CMP controls). `compliance_toolkits.md` retained as the human source.
- **`ToolkitImportService`** — all six importers rewritten over typed DTOs (`importUniverse`, `importCrmp`, `importSanctions`, `importReturns`, `importCmpControls`, `importCmpControlsFromSections`); markdown row-parsing helpers (`parseSections`, `normalizeSectionName`, `col`, `headerIndex`, `isSubHeader`, `get`×2, `extractReference`, `parsePointsCell`, `CELL_SPLIT`) deleted. Business logic kept: findOrCreateAct chain, canonical instrument linking, verbatim/interpreted split with plain→description fallback, points passthrough, existsBy dedup, global CMP numbering (`PREF C%03d`/`PREF A%03d`).
- **`ToolkitImportResult`** (new, `dto/seed/`) — typed result DTO (`@Data @Builder @NoArgsConstructor @AllArgsConstructor @JsonInclude(NON_NULL)`; regulators/acts/instruments/obligations/sanctions/returns/controls/unmappedSources/unmappedList/error/cause), same JSON shape as the legacy `Map<String, Object>`; `importToolkit()`/`successResult()`/`errorResult()` return it; `AdminRegulationController` → `ResponseEntity<ToolkitImportResult>`; `ToolkitStartupSeeder` reads `result.getError()`.
- **Deleted** — `PointsRetryScheduler` (scheduler), `BatchPointsResponse` (DTO), `atheris.points.*` config (the `compliance_toolkits.md`-only bulges that survived the md→JSON refactor) — points fill from the JSON, not the LLM.
- **DB env vars** — datasource username reads `DB_USERNAME` (was `DB_USER`), password reads `DB_PASSWORD`; **no hardcoded fallbacks** in `application.yml` (both backends). Credentials come only from the OS env; `.env.example` and AGENTS.md How-to-run updated.

### Verified
- `verify_json.py` → `VERIFY OK … (1541/597/139/363/192)` EXIT 0.
- `JAVA_HOME=<graalvm-ce-21.0.2> mvn -q -pl atheris-compliance-intelligence-backend -am compile` clean (default JDK 27 breaks Lombok — always compile with GraalVM 21).
- Fresh-DB boot parity check is the outstanding verification (Flyway migrate → `ToolkitStartupSeeder` → SQL counts vs 1541/597/139/363/192).



# CRITICAL RULES - MUST FOLLOW
## PLANNING MODE

- Always ask clarifying questions
- Use the `explore` agent to research the codebase and review the different aspects of your plan before presenting to the user

## CHANGE / EDIT MODE

- MUST load the matching skill (see the Skills table) before starting any non-trivial task, then implement the work directly
- MUST identify changes from the plan that can be implemented in parallel, and use the built-in `general` agent to implement disjoint slices when that genuinely speeds things up
- when delegating parallel slices to `general`, give each agent a disjoint file set and pin exact files/APIs in the brief; wire shared files yourself

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
