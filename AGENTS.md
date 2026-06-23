# Atheris — Compliance Intelligence Hub

## Project Structure

```
atheris-intelligence-backend/atheris/  — Spring Boot 3.2 backend (Java 21, Maven multi-module)
  atheris-platform/                    — main application module
    src/main/java/com/atheris/platform/
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
- Start: `mvn spring-boot:run` from `atheris-intelligence-backend/atheris/atheris-platform`
- Port: `9090`
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

## Pending Manual Downloads — What to Test

### Prerequisites
- Start backend: `mvn spring-boot:run` from `atheris-platform/atheris/atheris-platform`
- Start frontend: `npm run dev` from `atheris-compliance-intelligence-hub`
- Flyway V10 migration automatically creates `pending_downloads` table

### Test Flow
1. **Scraper failure creates pending record** — Run a scraper on a regulator with Cloudflare/Playwright (e.g. CBN). When `processNewDocument()` throws, a `PendingDownload` row is saved to `pending_downloads` with status `pending` and the error message.
   - Verify: `docker exec db psql -U atheris -d atheris_platform -c "SELECT id, title, status, error_message FROM pending_downloads;"`
2. **Dashboard shows pending downloads** — Open `http://localhost:5173/dashboard`. The "Pending Manual Downloads" card (top-right of bottom section) should show each record with title, URL, regulator ID, and discovered date.
3. **Upload a PDF** — Click the cloud-download icon on a pending row. Select a genuine PDF file. The upload button is hidden until you pick a file.
   - Expected: Snackbar shows "PDF uploaded successfully"
   - Verify job enqueued: `docker exec db psql -U atheris -d atheris_platform -c "SELECT * FROM job_queue WHERE job_type='ocr_document' ORDER BY created_at DESC LIMIT 1;"`
4. **Pipeline processes uploaded PDF** — Wait for OCR scheduler (2min cycle) or force by restarting. Verify the instrument appears and classification proceeds.
5. **Skip a record** — Click the X icon on a pending row. Expected: Snackbar shows "Marked as skipped", record disappears from widget.
   - Verify: `SELECT status FROM pending_downloads WHERE id=<id>;` → `skipped`
6. **Empty state** — Once all pending records are resolved, the widget should show "No pending downloads" with the cloud icon.

### Known Considerations
- The widget only shows `status=pending` records. "uploaded" and "skipped" records are hidden from the list.
- Uploaded PDFs go to S3 under `raw/reg<regulatorId>/` prefix.
- Magic bytes check (`%PDF`) happens on upload — non-PDF files are rejected with 400 error.
- The `source_page_url` is set if `PdfLink.getDiscoveredOnPage()` was populated during scraping (may be null for headless strategy).
