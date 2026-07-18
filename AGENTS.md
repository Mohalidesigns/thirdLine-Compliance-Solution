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
- Docker PostgreSQL: container `db`, port 5432, DB `atheris_platform`, user `atheris`/`changeme`
- Start platform: `mvn spring-boot:run` from `atheris-compliance-backend/atheris/atheris-compliance-intelligence-backend` (port 9090)
- Start tenant: `mvn spring-boot:run -pl atheris-compliance-tenant-backend -am` from `atheris-compliance-backend/atheris` (port 9091)
- Default admin: `admin@atheris.ng` / `admin123`

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

### Backend
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

## Next — Backend Verification & Integration
- [ ] Start both backends, verify clean startup (no seeder warnings, no auto-generated password)
- [ ] Test onboarding E2E: open `:5173`, complete 6-step wizard → login at `:5174`
- [ ] Wire up `evaluate_applicability` processor to send webhooks to tenant service
- [ ] Add tenant dashboard widgets (active tenants, webhook health) in main platform
- [ ] Cleanup: add `@Builder.Default` to entity fields flagged by Lombok warnings
