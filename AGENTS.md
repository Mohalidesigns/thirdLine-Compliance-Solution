# Atheris — Compliance Intelligence Hub

## Project Structure

```
atheris-compliance-backend/atheris/  — Spring Boot 3.2 backend (Java 21, Maven multi-module)
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
- Start platform: `mvn spring-boot:run` from `atheris-compliance-backend/atheris/atheris-compliance-intelligence-backend` (port 9090)
- Start tenant: `mvn spring-boot:run -pl atheris-compliance-tenant-backend -am` from `atheris-compliance-backend/atheris` (port 9091)
- Default admin login is set via `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars (see `application.yml`) — never commit real credentials

### Frontend
- `npm run dev` from `atheris-intelligence-frontend`
- Proxies API to `http://localhost:9090/api/v1`

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

## Recent Changes

### Backend Verification & Cleanup (latest)
- **Verify clean startup** — Both backends boot with no seeder warnings / no auto-generated password (logs `%TEMP%\opencode\{intel,tenant}-{out,err}.log`).
- **Dormant webhook delivery code removed** — Tenant `WebhookReceiverController`/`WebhookReceiverService` (wrote stale per-instrument `ObligationClassification`) deleted; intel `WebhookService`, `JOB_WEBHOOK`, commented schedulers + `WEBHOOK_BATCH` gone; `WebhookController` retry endpoint dropped (stats/failed kept); `TenantService.testWebhook` returns a polling-disabled stub; tenant `SecurityConfig`/`LicenseFilter` `/api/v1/webhooks/**` permits removed; frontend `send_webhooks` labels/cases + `testWebhook`/`rotateSecret` helpers + mock job removed. Commit `09cccd1`.
- **Toolkit import made idempotent** — Re-running `POST /admin/regulations/toolkit/import` previously duplicated obligation_mappings and sanctions (no dedup in `importCrmp`/`importSanctions`). Now dedups by natural key: obligations = regulation+statement+section; sanctions = regulation+section+description+penalty. Fresh import restores the full seed; re-run is a clean 0/0 no-op with an empty UNMAPPED report. Dedup also collapses genuine duplicate rows in the source register (counts now **1541 obligations**, **597 sanctions** instead of 1638/601). Commit `520d70e`.
- **Onboarding E2E verified** — Tested on a sacrificial tenant-2 (:9092, `TENANT_ID=2`): all 6 wizard steps → login → register seed (779 obligations) → residue cleaned from both DBs. Tenant data delivery is polling-only via `ObligationSyncService` (webhooks CANCELLED by user; dormant code retained).
- **Dashboard "Tenant Overview" widget** — `DashboardPage.jsx` added card with 4 KPI mini-cards (Active, Licence Types, Subscription Tiers, Regulator Subscriptions) + sticky-header table driving `/admin/tenants/{id}`. Commit `8d423c8`.
- **`@Builder.Default` cleanup** — 100 annotations across 35 entity/DTO files so Lombok builders no longer drop field initializers (status/tier/counters/enums). Commit `5310dc3`.
- **`maxRegulators`/`maxControls`/`maxReturns` removed** — never enforced; removed from License entity, CreateLicenseRequest/UpdateLicenseRequest/LicenseDto, LicenseService, V12 migration (edited in place), license admin form/detail drawer, and demo mock data. Commit `48ba65d`. Both DBs recreated fresh (15 intel + 25 tenant migrations) and re-seeded (toolkit import; Mam Corp tenant/license `ATH-263D-A80D-AD15-561C`/api-key; tenant profile + regulators CBN/NDIC + admin user). Sync verified: 6 pending reviews created.
- **AGENTS.md backlog marked done** — Commit `ed3270c`.

### Backend
- **Phase A — Nigerian Toolkit: regulations module + one-time seed** — New `modules/regulations/` package (entity `Regulation`, `RegulationAlias`, `AreaOfFocus` + repositories + `RegulationService` + `ToolkitImportService` + `AdminRegulationController` + `AdminUniverseController`). Flyway V15 `regulations` table. `ToolkitImportService` parses `classpath:toolkit/compliance_toolkits.md` (a 3.5 MB DRAFT toolkit) and seeds: **390 instruments** (`upload_source='toolkit_seed'`, never enters OCR/AI pipeline), **389 regulations** (each linked to a canonical instrument), **1,638 obligation_mappings**, **601 sanctions**, **28 regulators** (non-scraper). Import is fully atomic (TransactionTemplate `setRollbackOnly()` on any failure); UNMAPPED report returned for CRMP/sanctions-only sources (27 stub instruments created). Robustness fixes found live: duplicate-authority resolution in `ensureRegulator` (abbreviation/normalized-name matching), `recurring_deadline_type`/section reference truncation to schema limits, `sanction_amount` overflow guard for `numeric(15,2)`. `RegulationRepository` is a `JpaSpecificationExecutor` for the q/regulatorId list filter.
- **Sanctions grid corruption fixed + Returns register seeded** — `parseNaira` (concatenated digit-strip: `₦20M`→`20`) replaced by `parseMoney` honoring `M`/`k` suffixes, comma thousands, and compound per-role amounts (takes largest, e.g. `₦1.5M (MD & ECO), ₦1M (CCO), ₦20M (DMB)` → 20,000,000). `importSanctions` now populates `liable_roles` (col6), `risk_explanation` (col5 impact) and `penalty_details` (col4 raw). Flyway V15 edited in place: sanctions gain `risk_explanation`/`penalty_details` TEXT columns; new `regulatory_returns` table (title, section_reference, statutory_basis, recipient, frequency, deadline, remarks). New `importReturns` parses the Returns & Remittance register (139 rows seeded, dedup via `existsByTitleAndRegulationId`, 4 extra stub instruments for returns-only sources). `returnCount` added to list/detail DTOs; `RegulationDetailDto.ReturnItem` + `SanctionItem.riskExplanation/penaltyDetails` surfaced. Verified on a pristine DB (drop schema → 15 migrations re-run → import) and live API.
- **New admin endpoints** — `GET /api/v1/admin/regulations` (paginated, q + regulatorId filter, per-regulation instrument/obligation/sanction/return counts), `GET /api/v1/admin/regulations/{id}` (drill-down: instruments + obligations + sanctions + returns), `PUT /api/v1/admin/regulations/{id}`, `POST /api/v1/admin/regulations/toolkit/import` (re-runnable seed; wipe `toolkit_seed` data first or re-drop if already imported), `GET /api/v1/admin/universe/instruments` (multi-filter spec: regulatorId/areaOfFocus/riskRating/nature/status/q), `GET /api/v1/admin/universe/areas-of-focus`, `GET /api/v1/admin/universe/stats` (totals by regulator/area/risk/nature).
- **Webhooks removed from pipeline** — `JobQueueProcessors.processApplicabilityQueue()` no longer enqueues `send_webhooks` jobs; `@Scheduled` on `processWebhookQueue()` and `retryFailedWebhooks()` commented out (code kept for future re-enablement). Tenant data is now delivered via polling only.
- **License Dashboard KPIs** — `LicenseAdminPage.jsx` now fetches `GET /admin/licenses/stats` and displays 6 KPI cards (Active, Inactive, Grace Period, Expired, Revoked, Total).
- **TenantAdminPage cleaned up** — Removed webhook URL field from create tenant dialog and "Webhook Enabled" KPI card; webhook column kept in table for visibility.
- Migrated from custom Anthropic HTTP client to Spring AI ChatModel
- Added AdminJobQueueController: `GET /admin/jobs` (paginated, filterable) + `GET /admin/jobs/stats` (aggregate counts) + `GET /admin/jobs/{id}` (full detail with payload + related instrument)
- Added Flyway V9: `cors_whitelist` table seeded with `localhost:5173` and `localhost:9090`
- Added `modules/cors/` package: CorsWhitelist entity, repository, and `AdminCorsController` (CRUD at `GET/POST/PUT/DELETE /api/v1/admin/cors`)
- Updated SecurityConfig with DB-backed `CorsConfigurationSource` reading active origins at startup
- Fixed ObligationBrowserService to populate `regulatorAbbreviation` in summary DTO
- Added batch processing loops (OCR_BATCH=3, CLASSIFY_BATCH=10, etc.)
- Added `existsBySourceUrl()` duplicate check in OCR processor
- All `@Transactional` catch blocks call `setRollbackOnly()` to prevent Hibernate AssertionFailure
- Changed processor lambdas to for-loops with `continue` for batch processing
- **Plan B: Pending Manual Downloads** — Flyway V10 adds `pending_downloads` table; new `modules/pending/` package with entity, repository, controller; when scraper download fails, `ScraperService` saves record to `pending_downloads`; admin upload endpoint verifies PDF magic bytes, computes SHA-256 hash, uploads to S3, and enqueues `ocr_document` job
- **Fixed Playwright download** — `PlaywrightHeadlessStrategy` now downloads PDFs inside the same `BrowserContext` that scraped the circulars page (preserves Cloudflare `cf_clearance` cookie); `PdfLink.pdfBytes` carries bytes back to `ScraperService.processNewDocument` so no separate download call is needed
- **REQUIRES_NEW on markFailed** — `JobQueueService.markFailed()` runs in separate transaction to persist failure independently of outer rollback
- **em.clear() in catch blocks** — prevents Hibernate stale-state issues after rollback in all four processors
- **Tesseract OCR resilience** — DPI reduced 300→200, image dimension clamped at 4000px, each page wrapped in `catch (Throwable)`, TESSDATA_PREFIX read from env var
- **All catch (Exception → Throwable)** — prevents JNA `Error` (e.g. `Invalid memory access`) from killing the scheduler thread
- **Classifier empty-text guard** — rejects text < 100 chars, marks instrument as `INST_TRIAGE` for manual review
- **CBN scraper URL encoding** — `safeUri()` helper in `ScraperService` encodes spaces/parentheses/brackets rejected by `URI.create()`
- **CBN scraper Cloudflare bypass** — Playwright downloads within existing authenticated `BrowserContext`

### Frontend
- Fixed `authSlice.js` — was reading `res.data.accessToken` (doesn't exist), now reads `res.accessToken` directly
- Wired InboxPage to `GET /intelligence/inbox?status=` (removed mock data)
- Wired LibraryPage to `GET /intelligence/obligations` (removed mock data)
- Wired RegulatorAdminPage to `GET /platform/regulators?activeOnly=true` (removed mock data)
- Added drill-down drawer on RegulatorAdminPage — click a regulator to see its discovered documents
- Created JobQueuePage (`/admin/pipeline`) showing pipeline jobs with filters, pagination, stats, per-type breakdown, and drill-down drawer (click a job to see payload, errors, and related instrument)
- Added `platform.jobs.list()`, `platform.jobs.stats()`, `platform.jobs.get(id)`, and `platform.instruments.list()` API endpoints in api.js
- Added Pipeline Jobs nav item under PLATFORM in sidebar
- **Pending Manual Downloads widget** on DashboardPage — replaces mock "Jurisdiction Coverage" card; fetches live `pending_downloads` records; each item shows title/URL/regulator/date with upload (file picker) and skip buttons; Snackbar feedback for actions
- **Dashboard redesign** — removed ALL mock data. Page now has: (1) KPI cards from `GET /admin/jobs/stats` (OCR Queue / Awaiting Classify / Classified / Failed+Stuck), (2) Document Pipeline Table combining jobs + instruments + pending_downloads into a unified view with pipeline progress indicators (Download→OCR→Classify→Publish) and View PDF button, (3) Pending Manual Downloads widget, (4) Quick Actions card
- **TenantAdminPage** — removed `demoTenants` mock data, now calls real `GET /api/v1/platform/tenants` API; table adapted to `TenantDto` fields (`legalName`, `licenceType`, `isActive`, `webhookEnabled`, `onboardedAt`)
- **api.js** — added `jobs.getPdfUrl(id)`, `instruments.getPdfUrl(id)` for PDF viewing; `JobQueueDto` now includes `payload` field so dashboard can read title/regulator/URL without fetching each job individually
- **View PDF** — Dashboard "PDF" column calls `GET /admin/jobs/{id}/pdf` (for in-flight items) or `GET /intelligence/obligations/{id}/pdf` (for classified instruments), opens presigned S3 URL in new tab
- **Demo login uses client-side mock data** — `api.js` now has a `demoRequest()` function that intercepts all API calls when `authToken === DEMO_TOKEN` and returns realistic mock data for Inbox, Library, Jobs, Regulators, Tenants, Pending Downloads, and Dashboard; `loginDemo()` reducer now calls `setToken(APP.DEMO_TOKEN)` so the API client is aware of demo mode
- **LibraryPage removed** — The old `/library` route (Obligation Library) was deleted. Its Refresh button was moved to `/admin/instruments` (InstrumentsPage), placed just before the "Upload Instrument" button.

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

## Done — Pipeline Stage Breakdown
- **Per-regulator pipeline stage breakdown** — Backend: `InstrumentRepository` adds `findExtractedByRegulatorId` (non-null pdfOcrText) and `findClassifiedByRegulatorId` (status != Triage); `RegulatorService.getPipelineStats()` returns discovered/downloaded/extracted/classified counts + drill-down lists with `jobStatus` for uploaded items; new endpoint `GET /platform/regulators/{id}/pipeline-stats`. Frontend: RegulatorDetailPage shows 4 clickable pipeline stage cards with inline scrollable tables (Title | URL | Status | Action columns); uploaded docs appear alongside pending with green checkmark + job status chip (OCR Pending/Processing/Done/Failed); Scraper Config moved to modal.
- **Dashboard Pipeline Health alert** — Banner between KPI cards and pipeline table shows total discovered vs processed vs pending downloads; amber Warning with "View Failed" link when pendings exist, green success when clear.
- **Regulators table stage columns** — "Documents" column split into "Discovered" (instruments + pending), "Downloaded" (instruments, green), "Failed" (pending count in red chip); `RegulatorDto.pendingDownloadCount` populated via `PendingDownloadRepository.countPendingByRegulator()`.
- **Remote push synced** — `origin/main` now matches local `main` at `5787d9f` (merge commit with `99008da` pipeline stage breakdown); stale Windows Credential Manager entries cleared, `gh` CLI token used for auth.

## Done — Tenant Backend Aligned as Submodule

The standalone `atheris-compliance-tenant-backend` service at `C:\Users\hp\Documents\atheris-compliance-tenant-backend` was copied and adapted as a Maven submodule at `atheris-compliance-backend/atheris/atheris-compliance-tenant-backend/`.

### Module Structure

```
atheris-compliance-tenant-backend/
  pom.xml                              — depends on atheris-compliance-common + Spring Boot + JPA + Security + JWT
  src/main/java/com/atheris/compliance/tenant/backend/
    AtherisTenantBackendApplication.java       — @SpringBootApplication on port 9091
    config/SecurityConfig.java          — JWT filter, BCrypt, stateless sessions
    modules/
      auth/                             — JWT login/refresh/logout, invite tokens, password reset
      users/                            — CRUD, invite flow, role management, password change
      onboarding/                       — Multi-step wizard (institution → regulators → doc types → confirm)
      subscriptions/                    — Regulator subscriptions, per-regulator overrides
      obligations/                      — Per-instrument classification, CCO approval, versioned history
      controls/                         — Control inventory, test scheduling, test result recording
      findings/                         — Auto-raised from failed tests, remediation workflow
      returns/                          — Regulatory return calendar, stage-based filing
      notifications/                    — Obligation change alerts (read/acknowledge)
      dashboard/                        — Compliance score, KPIs, daily snapshots
      audit/                            — Tamper-evident hash chain audit log
      webhook/                          — Webhook receiver from main platform
  src/main/resources/
    application.yml                     — DB: atheris_tenant, schema: tenant, port 9091
    db/migration/tenant/
      V1__create_users.sql              — users, invite_tokens, refresh_tokens
      V2__create_tenant_profile.sql     — tenant_profile, tenant_regulator_preferences
      V3__create_obligations.sql        — obligation_classifications, classification_history
      V4__create_controls.sql           — controls, control_tasks, control_test_results
      V5__create_findings.sql           — findings
      V6__create_returns.sql            — regulatory_returns, return_filing_instances
      V7__create_audit.sql              — audit_events (hash chain)
      V8__create_notifications.sql      — obligation_notifications
      V9__create_dashboard.sql          — dashboard_snapshots
```

### Code Practices Applied
- **All queries are native SQL** (`nativeQuery = true`) — zero JPQL
- **All business logic in service layer** — controllers are thin (just delegate + return)
- **Repository methods use JPA `findBy` naming** where possible
- **No JPQL `@Query` annotations** — only native queries where `findBy` naming isn't enough
- **WebhookReceiverService** extracted from inline controller logic
- **NotificationController** delegates status filtering to service

### How to Run
```bash
# Create tenant database
docker exec -it db psql -U atheris -c "CREATE DATABASE atheris_tenant;"

# Start tenant service
cd atheris-compliance-backend/atheris
mvn spring-boot:run -pl atheris-compliance-tenant-backend -am

# Tenant service runs on port 9091
# API base: http://localhost:9091/api/v1/
```

## Done — Tenant Frontend Portal Built

Full tenant portal frontend at `atheris-compliance-frontend/atheris-compliance-tenant-frontend/` (port 5174):

### Pages
| Route | Component | Description |
|-------|-----------|-------------|
| `/login` | LoginPage | Dark gradient, gold Shield icon, "Africa's Premier Compliance Solution" subtitle, "Get Started — Register Your Institution" link to `:5173/onboarding` |
| `/dashboard` | DashboardPage | KPI cards (pending, classified, failed) + recent uploads table |
| `/regulators` | RegulatorsPage | CRUD table with inline active toggle, add/edit dialog |
| `/upload` | UploadPage | File picker + regulator/doc-type form, triggers `POST /subscriptions/upload-document` |
| `/upload-history` | UploadStatusPage | Table with status chips (Processing/Done/Failed), polls upload status |
| `/library` | LibraryPage | Search instruments from platform, detail drawer |
| `/settings` | SettingsPage | Polling interval config via `GET/PUT /api/v1/settings/polling` |

### Architecture
- No webhooks — tenant polls platform via `ObligationSyncService` at configurable interval (DB-backed `tenant_polling_config` table)
- Upload flow: `POST /api/v1/subscriptions/upload-document` → platform `POST /api/v1/internal/instruments/ingest` (SHA-256 dedup) → async processing → tenant polls `GET /api/v1/subscriptions/upload-status/{id}`
- Tenant regulators stored in `tenant_regulators` table (optional `platform_regulator_id` FK)
- Single license covers everything; 6-step onboarding (license → institution → user → regulators → doc types → confirm)

### Fixes
- `LicenseAdminPage.jsx` — handle paginated API responses (`.content \|\| data`, `Array.isArray(data) ? data : data.content \|\| []`)
- `DashboardPage.jsx` — added missing `import api`
- Intelligence `SecurityConfig` — `internalApiKeyFilter` placed before `UsernamePasswordAuthenticationFilter.class` (was `JwtAuthFilter.class`)
- Tenant `SecurityConfig` — added `noopUserDetailsService()` bean to suppress auto-generated Spring Security password
- `AdminUserSeeder.java` — **deleted entirely** (no more startup seeder warnings)
- Tenant frontend `package.json` — reordered deps, added Inter + Roboto Mono Google Fonts
- Tenant frontend `main.jsx` — replaced placeholder stub with proper `<StrictMode><App /></StrictMode>` bootstrap
- Vite 8 Rolldown resolution — added missing `package.json` in `node_modules/@mui/icons-material/` for resolution
- **Onboarding redirect to login fix** — `api.js` hardcoded `API_BASE = 'http://localhost:9090/api/v1'`, so onboarding/license API calls went to the intelligence backend (no `/onboarding/` routes) which returned 401 → `window.location.href = '/login'`. Added `TENANT_API_BASE = 'http://localhost:9091/api/v1'` + `tenantRequest()`; onboarding and license methods now target the correct backend directly.

### How to Run
```bash
# Tenant frontend (separate terminal)
cd atheris-compliance-frontend/atheris-compliance-tenant-frontend
npm run dev
# → http://localhost:5174
```

### E2E Testing
See `ATERHIS_ONBOARDING_E2E_TESTING.md` for architecture diagram, API reference, and full testing script with curl commands.

## Done — Backend Verification & Cleanup (backlog completed)

- [x] Start both backends, verify clean startup (no seeder warnings, no auto-generated password) — intel :9090 (pid via maven spring-boot:run) + tenant :9091, logs in `%TEMP%\opencode\{intel,tenant}-{out,err}.log`
- [x] Test onboarding E2E on sacrificial tenant-2 (port 9092, `TENANT_ID=2`): all 6 wizard steps → login → register seed (779 obligations) → residue cleaned from both DBs
- [x] ~~Wire up `evaluate_applicability` processor to send webhooks to tenant service~~ — CANCELLED by user; tenant delivers via polling (`ObligationSyncService`) instead. Webhook code left dormant.
- [x] Add tenant dashboard widgets — "Tenant Overview" card in `DashboardPage.jsx` (active tenants, licence types, subscription tiers, regulator subscriptions; row → `/admin/tenants/{id}`)
- [x] Cleanup: `@Builder.Default` added to all initialized entity/DTO fields (100 annotations across 35 files) — commit `5310dc3`
- [x] Cleanup: `maxRegulators`, `maxControls`, `maxReturns` REMOVED everywhere (License entity, CreateLicenseRequest/UpdateLicenseRequest/LicenseDto, LicenseService, V12 migration edited in place, license admin form/detail drawer, demo mock data). They were never enforced — tenant backend manages its own limits. Commit `48ba65d`. Both DBs recreated fresh (15 intel + 25 tenant migrations re-applied) and re-seeded (toolkit import, Mam Corp tenant/license/api-key, tenant profile + regulators CBN/NDIC + admin user; sync verified: 6 pending reviews created).

## Done — Tenant Obligations Register Rebuilt (Per-Obligation)

Rebuilt the tenant **Obligations Register** page to match `Atheris_Frontend_Design_Specification.md` Screen 4. CCO approval explicitly excluded (once applicable = final).

### Backend (`atheris-compliance-tenant-backend`)
- **Root cause fixed**: `ObligationService.getRegisterList()` previously paged `ObligationClassification` (one row per instrument). Now pages the `obligations` table directly — one register row per obligation — inheriting risk/owner/gap/status from the instrument's classification and enriching title/regulator via `PlatformApiClient.getInstrumentDetail()`.
- **Flyway V20**: `obligation_returns` join table (`obligation_id` ↔ `return_id`).
- **`ObligationRepository`**: added `findAllReturnLinks()`, `findLinkedReturnIds()`, `deleteReturnLinks()`, `insertReturnLink()` (native queries + projection row).
- **`ObligationService`**:
  - `getRegisterList(q, risk, regulator, theme, owner, status, hasGap, pageable)` — in-memory filter + sort (obligationNumber/sourceTitle/risk/owner/status) over all tenant obligations.
  - `getStats()` → `GET /obligations/stats`: total / highRisk / gaps / underReview + distinct regulators, themes, owners, risk levels for filter dropdowns.
  - `getObligationDetail(obligationId)` → `GET /obligations/obligation/{id}`: obligation + classification + linked controls (with names) + linked returns (with names/frequency) + evidence (`sourceType='obligation'`) + version history with usernames.
  - `linkReturns(obligationId, returnIds)` → `PUT /obligations/obligation/{id}/returns`.
  - `classify()` extended: accepts `linkedReturnIds` + `linkedObligationId` to persist return mapping in the same transaction.
- **`ReturnService`**: `listActive()` + `GET /returns/list` (return templates for the mapping dropdown).
- DTOs: `ObligationRegisterItem` (rewritten, per-obligation), new `ObligationStats`, `ObligationDetailView`, `LinkReturnRequest`.

### Frontend (`atheris-compliance-tenant-frontend`)
- **`ObligationsRegisterPage.jsx` fully rebuilt**: 4 KPI cards (Total / High Risk / Gaps / Under Review, clickable → set filters), search box, Risk/Regulator/Theme/Owner filters + "Has gap" checkbox, sortable table (# / Obligation / Instrument / Risk / Owner / Status / Returns), right-side detail drawer (classification, risk assessment, owner, linked controls, return mapping, gap alert, evidence with download, View PDF), version history tab, and a full edit drawer (owner, risk, impact/likelihood, justification, linked controls multi-select, return-required multi-select, gap toggle, evidence upload, reason for update).
- `api.js`: added `obligations.stats`, `obligations.obligationDetail`, `obligations.linkReturns`, `returns.list`.

### Notes
- Theme filter maps to `obligation_type` (no dedicated theme column on obligations).
- Status filter values: `active` / `unclassified` / `under_review`.
- KPI "Under Review" = obligations not yet `applicable` (unclassified / under_review).

## Done — Per-Obligation Review Workflow (Edit & Save gate)

**The single most important rule: NO document reaches the Obligations Register without a human "Edit & Save" on the Review page. Instruments carry NO classification — every classification detail lives on an individual obligation.**

### Current Flow (tenant portal, `:5174`)

1. **Upload / Sync** — Documents arrive via manual upload (`POST /subscriptions/upload-document`) or platform sync. They land in the `pending_reviews` table (Flyway V21) as **Review Inbox** items.
2. **Review Inbox** (`/review`, `ReviewInboxPage.jsx`) — list of incoming instruments with stats (Pending / Saved / Skipped / Failed). Click → Review Edit.
3. **Review Edit** (`/review/edit/:id`, `ReviewEditPage.jsx`) — human edits the extracted obligations and **classifies each obligation inline per-row** (Applicability, Risk Rating, Impact, Likelihood, Owner, Department, reasoning, Has gap, linked returns). Footer has a "Reason for Update" field.
4. **Save** — `ReviewService.save()` deletes the instrument's existing obligations + classifications, then re-creates each applicable obligation with **one `ObligationClassification` keyed by `obligation_id`** (status `active`). The instrument is now "confirmed" (has obligations).
5. **Instruments** (`/instruments`, `InstrumentsPage.jsx`) — lists **only confirmed instruments** (filtered by `ObligationRepository.findDistinctInstrumentIds()`). Table = Title | Regulator | Obligations | Published | Actions. Detail view = metadata, AI Summary, collapsible raw OCR, penalties, obligations list. **No risk/status/classification on the instrument.**
6. **Obligations Register** (`/obligations`) — one row per obligation, inherits classification from its own `ObligationClassification`. Detail/edit drawer, linked controls + returns, version history.

### Key Backend Facts
- `SaveReviewRequest.java` — top-level classification fields removed; classification nested per `ObligationDto` (applicability, risk, impact, likelihood, owner, department, gap, `linkedReturnIds`). Top level keeps only `changeReason` + `obligations`.
- `ReviewService.save()` — deletes old `obligations` + `obligation_classifications` for the instrument, then saves one `Obligation` + one `ObligationClassification` (keyed `obligation_id`) per applicable obligation, links returns.
- `ObligationClassificationRepository.deleteByInstrumentId()` — native DELETE.
- `ObligationService` — register/detail/history/classify all keyed on `obligation_id` (`findByObligationId`, `findByObligationIdOrderByChangedAtDesc`). `classify()` accepts `linkedObligationId` for return linking.
- `InstrumentsService.search()` — returns only confirmed instruments (have obligations), in-memory pagination; `InstrumentSummaryResponse` has `obligationCount`; `InstrumentDetailResponse` has `aiSummary` + `pdfOcrText`.
- **Published date mapping** — the platform's `instruments.published_at` is NEVER populated. The real issue date lives in `instruments.date_issued`, extracted by the AI classifier from the document text during classification. The tenant instruments table maps `publishedAt = publishedAt != null ? publishedAt : dateIssued`, so the **Published** column = the document's own issue date (falls back to `-` when the AI couldn't extract one). Manual uploads pass `date_issued` on `POST /subscriptions/upload-document`.
- Schema already supported per-obligation: `obligation_classifications.obligation_id BIGINT UNIQUE` (V3) — no migration needed. V21 adds `pending_reviews`.

### Frontend Files
- `ReviewInboxPage.jsx`, `ReviewEditPage.jsx` (new), `InstrumentsPage.jsx` (new, replaces deleted `InboxPage.jsx`), `UploadReviewPage.jsx` deleted.
- `ObligationsRegisterPage.jsx` — classify call uses `selected.obligationId` (NOT `instrumentId`).
- Routes in `AppRoutes.jsx`; Sidebar: Review Inbox → Instruments → Obligations Register.

## Done — Returns Module Enhancements (enums, regulator FK, lazy instances + escalation, bidirectional obligation linking)

**No scheduler anywhere** — instances materialize idempotently on read (`getCalendar`/`getDetail`) + after `create()`; escalation catches up lazily on the same reads. Quartz/cron rejected.

### Backend (`atheris-compliance-tenant-backend`, `modules/returns/`)
- **Enums (returns-only scope)** — `ReturnStage` (Not Started→Submitted 6 steps), `ReturnFilingStatus` (Not Started / In Progress / Submitted / Submitted Late), `RegulatoryReturnStatus` (Active / Inactive). Each has a `@Converter(autoApply=true)` so DB keeps friendly strings (`"In Progress"`) — existing rows and JSONB stage-key strings untouched. DTOs continue to emit `.db()` display strings so the frontend keeps rendering status/stage text.
- **Regulator normalization** — `regulatory_returns.tenant_regulator_id BIGINT` FK → `tenant_regulators(id)`. `CreateReturnRequest.tenantRegulatorId`; `ReturnService.create()` resolves name/abbrev via `TenantRegulatorRepository.findByIdAndTenantId`, persists both FK + display snapshot (`filing_regulator` kept as snapshot). `regulatorLabel()` = snapshot first, FK fallback.
- **Lazy instance materialization** — `ensureInstances(ret)` generates frequency-aware instances (Monthly +1 / Quarterly +3 / Semi-Annual +6 / Annual +12), clamps month-end due day, dedup via `existsByReturnIdAndPeriod` + new `UNIQUE (return_id, period)`, `findTopByReturnIdOrderByPeriodDesc` cursor, 60-iteration guard. Replaces the old buggy `createNextInstance` (skipped current month, monthly-only). Lookahead `atheris.returns.instance-lookahead-days: 120`. `getCalendar()` window widened to `today−60 … +90` so missed timelines surface as OVERDUE.
- **Lazy escalation catch-up** — `catchUpEscalations()` runs inside `getCalendar()`/`getDetail()`: implied level from missed days (`>0→L1`, `>2→L2`, `>5→L3` via `atheris.returns.escalation-thresholds: "2,5"`, capped L3), writes `escalation_level` + `escalated_at`, audits `return_escalated` with `SYSTEM_USER_ID=0`. `submit()` resets escalation. `Map.of` → `Collections.singletonMap` for nullable audit maps.
- **Bidirectional obligation↔return linking** — pre-existing `PUT /obligations/obligation/{id}/returns` (obligation→returns). NEW return→obligation side: `GET/PUT /api/v1/returns/{returnId}/obligations` (`LinkObligationsRequest.linkedObligationIds`), backed by `ObligationRepository.findLinkedObligationIds` + `deleteObligationLinks`, audits `link_obligations`; validate return + each obligation exists, replace-style set.
- **Migrations (edited in place, no new ALTER files)** — `V6__create_returns.sql` now creates `tenant_regulator_id`, `escalation_level`, `escalated_at`, `UNIQUE(return_id, period)` on `return_filing_instances`; `V14` appends FK `fk_returns_regulator`, backfill UPDATE (lowercase name/abbrev match, tenant 1), index `idx_returns_regulator`. Dev DB delta applied manually via `docker exec db psql`, then `mvn org.flywaydb:flyway-maven-plugin:10.12.0:repair` realigned checksums (flyway-maven-plugin is NOT in the module pom — invoke with the fully-qualified goal + `-Dflyway.` properties).
- `DashboardService` — enum-backed `findByStatusNotInAndDueDateBefore(List.of(ReturnFilingStatus.SUBMITTED, SUBMITTED_LATE), …)`, `countByStatus(...)` enum calls. `ReturnFilingInstanceRepository.findByStatus`/`countByStatus`/`findByStatusNotInAndDueDateBefore` now take enums (DB strings unchanged).

### Frontend (`atheris-compliance-tenant-frontend`)
- `ReturnsPage.jsx` — escalation chip on list cards (`Escalated · L{n}`, `WarningAmber` icon, escalated-since tooltip) + detail-view `Alert severity="error"` (L1 Analyst / L2 Manager / L3 CCO); OVERDUE chips already present.
- `CreateReturnDialog.jsx` — Regulator field is now an `Autocomplete` over `api.regulators.list()` (sends `tenantRegulatorId`, `freeSolo` free-text fallback); new **Linked Obligations** section opens existing `LinkObligationsPicker` (removable chips), chains `api.returns.linkObligations(returnId, ids)` after create.
- `ReturnPicker.jsx` / `MapReturnModal.jsx` / `CreateObligationDialog.jsx` — prior return-modal redesign (search + table picker, Create-Return button, `Save (n)` disabled at 0, `maxWidth="md"`; obligation picker keeps the same table style as `LinkControlsPicker` plus an inline "Add New Obligation" button).
- `api.js` — `returns.linkObligations` / `returns.linkedObligations`.

### Verified (live on 9091, test data cleaned up afterwards)
Lazy materialization across 5–6 periods; past-due instances escalated (L2 at >2d, L3 at >5d); submit flips to `Submitted Late` + resets escalation; quarterly return stepped Aug→Nov; return-to-obligation link `[8,5,1]` → join rows + `link_obligations` audit; obligation detail lists linked returns.
