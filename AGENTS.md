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
- Docker PostgreSQL: container `atheris-postgres-intel`, port 5432, DBs `atheris_intel` + `atheris_tenant` (both owned by `atheris`), user via `DB_USERNAME` / `DB_PASSWORD` env vars — no hardcoded defaults in `application.yml` (strong password set on the `atheris` role)
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

### Done — Workflow Notifications, Escalation, SoD & Public Remediation Links (tenant, Part 1)
Branch `feature/workflow-notifications-sod`. **93→97 tenant tests pass; tenant backend + frontend build green. Not yet live-verified** (needs a tenant restart for the V1/V8 edits + V37).
- **Notifications (per-recipient)** — `obligation_notifications` (V8 edited in place: `instrument_id` nullable, `recipient_user_id`, `recipient_role`, `category`, `link`, recipient indexes). `NotificationService` (notifyUser/notifyRole/[…]Emailed + scoped reads/counts/mark-read); `NotificationController` scoped to `@AuthenticationPrincipal` (a caller sees only their own + their role's broadcasts).
- **Escalation** — `EscalationNotifier.escalate(level, assigneeUserId, …)`: L1 assignee, L2 `User.managerUserId` (falls back to CCO), L3 CCO; in-app + email, once per level. Wired into `ReturnService.catchUpEscalations` and `ControlTestService.processOverdueTasks`. Managers set via `PUT /users/{id}/manager`; `UserDto` gains `managerUserId`/`managerName`.
- **Control-test scheduling** — `ControlTaskBackfill` (`ApplicationRunner @Order(40)`) gives every active control with a frequency a pending task; tasks created on control create, on frequency change, after a test, and on backfill. Fixed the `0 0 1 * * *` scheduler that marked Pending→Overdue then filtered for Pending in the same run (never escalated): it now escalates already-Overdue tasks (>2d L2, >5d L3) once each.
- **Segregation of duties** — control-test review by a **different analyst** than the recorder (409 `self_review`); findings: owner remediates → an **Analyst/TenantAdmin** approves (close) / rejects (needs reason, returns to In Remediation) — **CCO not involved and cannot submit**; approver ≠ submitter (409); returns `PUT /instances/{id}/submit` gated to the **Sign-off** stage (409 `not_ready_to_submit`).
- **Public remediation links** — `V37__create_remediation_links.sql` (token stored SHA-256, `finding_id`, `owner_id`, `expires_at` = deadline **+7 days**, revoked, use-count). `RemediationLinkService` creates + emails the link (`/remediate/{token}`); `RemediationLinkController` `POST /findings/{id}/remediation-link` (ANALYST/CCO/TENANT_ADMIN); `PublicRemediationController` `GET/POST /api/v1/public/remediation/{token}` (permitAll in `SecurityConfig` + `LicenseFilter`) accepts notes + ≤5 files ≤20 MB (PDF/PNG/JPG/DOCX/XLSX) into the Evidence Vault (`sourceType=finding`), moves the finding to Remediated, notifies analysts. Reusable until approved; dies on Closed/revoke.
- **Shared** — `EmailService` (`spring-boot-starter-mail`; no-op + log when `SMTP_HOST` unset); `shared/util/{AppRole,NotificationConstants,WorkflowStatus}` constants; all tenant `@PreAuthorize` role strings built from `AppRole` (javac folds them to the original literals).
- **Frontend (tenant)** — `PublicRemediatePage` (`/remediate/:token`, outside `ProtectedRoute`); FindingsPage review dialog + copy-link + SoD guard; ControlsPage per-test review action; SettingsPage manager dropdown; `api.controls.tests/reviewTest/tasks`, `api.tasks.*`, `api.findings.review/remediationLink`, `api.users.updateManager`.
- **Fix folded in** — `CryptoUtil` read `atheris.encryption-key` but the yaml nests it under `atheris.platform.encryption-key`, so `ENCRYPTION_KEY` never applied (encrypt/decrypt used the dev fallback); property path corrected.

### Done — LDAP Login + Onboarding Provisioning + Docker Test Bed (tenant, Part 2)
Same branch. **Invite-first**: onboarding provisions the user rows; LDAP only authenticates (no auto-provisioning).
- **Onboarding** (`UserSetupRequest`/`OnboardingService.saveUserSetup`) — **both** auth types now create the **TenantAdmin + CCO + Analyst** rows (CCO/Analyst always; TenantAdmin from `localAdmin` or, for LDAP, from a **break-glass** local admin flagged `users.is_break_glass`, V1 edited in place). LDAP bind password is **encrypted at rest** (`CryptoUtil`) into `tenant_profile.ldap_config` (JSONB, no new migration). New `POST /onboarding/ldap/test-connection` (service-account bind only).
- **LDAP login** (`modules/ldap`, `spring-boot-starter-data-ldap`) — `LdapAuthService`: bind as the service account → search `userSearchBase` for the email (`mail` default) → **re-bind as the found DN** to verify the password. `AuthService.login` authenticates via LDAP when the tenant is `authType=ldap`, then matches the **email to an existing provisioned row** (unknown email → `invalid_credentials`; deactivated/pending → blocked). Directory outage → `login_blocked` (403), not a 500. `spring.data.ldap.repositories.enabled=false` so the app boots with no directory.
- **Frontend (tenant)** — OnboardingPage step 2: full LDAP fields (url/bindDn/bindPassword/userSearchBase/search+name attributes) + **Test connection**, break-glass admin fields, and CCO + Analyst identity fields; `api.onboarding.testLdap`.
- **Docker test bed** — `devenv/docker-compose.testenv.yml` (Mailpit 1025/8025, OpenLDAP `ldap://localhost:1389` seeded from `devenv/ldif/atheris.ldif`, phpLDAPadmin 8080) + `devenv/README.md`. Mailpit needs no auth/TLS; SMTP_*/EMAIL_FROM + `ENCRYPTION_KEY` added to `~/.zshrc`/`~/.bash_profile`.
- **Verify:** tenant `mvn test` **97/97** (4 new `LdapAuthServiceTest`); tenant frontend build green; DTO-binding check clean. *Live LDAP/Mailpit run pending user-started backends + onboarding.*

### Board Pack & Reporting + metric corrections (tenant)
- **Single source of metrics** — new `ComplianceMetricsService` (`modules/dashboard/service/`) computes every figure period-aware (from/to) for the dashboards, the nightly snapshot and the board pack. Fixes carried in: high-risk uses the canonical bands **Critical + High** (was "Extreme"); **one** control-gap definition (applicable obligation with no `linkedControlIds`); findings "open" = Open + In Remediation and "high severity" = Critical + High; control-test completion now derives from `control_tasks` (was "controls without a High residual"); penalty exposure restricted to sanctions on applicable obligations. Backend N+1 in the department rendition grid removed (preloads departments).
- **Compliance score** — weighted 4-part (control coverage 30 / control tests 25 / returns on time 30 / findings within SLA 15), weights per-tenant in `compliance_score_weights`, missing components re-normalise. `GET/PUT /dashboard/score-weights` (GET any auth, PUT **CCO**). Replaces the old formula whose last 30 points were hard-coded.
- **Endpoints** — `GET /dashboard/metrics?from=&to=` (canonical metrics), `GET /findings/stats`; role checks added to `POST /dashboard/refresh` and `PUT /dashboard/v2/thresholds` (CCO/TENANT_ADMIN).
- **Board pack (module `modules/reports`)** — `V36__create_board_packs.sql` (`board_packs`, `compliance_score_weights`). `BoardPack` entity/repo, `BoardPackRenderer` (**openhtmltopdf 1.0.10**, HTML→PDF; openhtmltopdf is strict XHTML — **no named entities** like `&ndash;`/`&middot;` and **no flexbox**, use tables/inline-block), `ReportsService`, `ReportsController` (`/api/v1/reports/board-packs`) — generate (DRAFT, watermarked, CCO/TENANT_ADMIN), list/get/download, `preview` (JSON metrics), and `POST /{id}/sign-off` (**CCO only** — re-renders without the watermark, stores new SHA-256, audit-logged, immutable). Files stored via `FileStorageService.storeBytes`; every action writes a hash-chained audit event. Pack sections: summary, attention, risk, coverage, returns, findings, sanctions.
- **Frontend (tenant)** — new `/reports` `ReportsPage` (KPI cards w/ breakdown dropdowns, 5-col table, Generate dialog with period presets + section toggles + live preview, detail drawer with Download/Sign-off). Sidebar "Reports" entry. CCO dashboard gained a board-pack-ready KPI row (breakdown dropdowns, from `/dashboard/metrics`) + a "Generate Board Pack" button (CCO/TENANT_ADMIN). Dead `DashboardPage.jsx` deleted; V2 breakdown table trimmed 7→5 cols. `api.reports.*`, `api.dashboard.metrics/refresh/scoreWeights`, `api.findings.stats`.
- **Verify (done):** tenant `mvn test` 93/93 (8 new: score formula + PDF render); tenant + intel frontends build green; api-sync aligned; DTO-binding check clean. *Live run pending user restart of the tenant backend so Flyway applies V36.*

### Pipeline cleanup + NDIC scrape scope + Tesseract OCR enabled
- **`evaluate_applicability` stage removed end-to-end** — enqueue removed from `ClassificationService`, `JobQueueProcessors.processApplicabilityQueue`+`findMatchingTenants` deleted, `Constants.JOB_APPLICABILITY` deleted, `JobQueue` comment updated, `JobDetailPage` labels → "Extract Text"/"Analyze & Tag", 2 legacy jobs purged from `job_queue`, and the whole `modules/applicability` package (ApplicabilityService/TenantEligibilityRule/Repo) deleted. It was a no-op stub.
- **NDIC scrapes policy frameworks only** — `V1__create_regulators.sql` NDIC `publication_page_url` → `https://ndic.gov.ng/publications?category=policy-frameworks&view=reader&id=0` **and** `pdf_link_selector = a[href*="/storage/cms/media/"]` (the page's site-wide "latest publications" sidebar emits a dead `NDIC-Quarterly.pdf` link ×14 returning HTML; the selector restricts NDIC to CMS media = the actual frameworks). Live row updated via `PUT /platform/regulators/3` (not SQL). Dry-run before: 20 links/14 failed → after: **6 links / 5 new / 1 skipped / 0 failed**. Caveat: the `category=` param is only honored for `policy-frameworks` (other categories return a generic list) and Jsoup does not run the site's JS filtering.
- **Flyway repair is now runnable from the module** — added `flyway-maven-plugin` (with `flyway-database-postgresql` + `postgresql` plugin deps) to the intel `pom.xml`, so `mvn flyway:repair -Dflyway.url=… -Dflyway.user=… -Dflyway.password=…` works (previously the driver/db-module were absent from the plugin classpath → "No database found to handle jdbc:postgresql"). V1 & V5 edited in place + repaired.
- **Tesseract OCR fallback actually enabled** — `PdfExtractionService` already fell back to Tesseract when PDFBox yields <100 chars, but Tesseract was not installed and Tess4J could not load `libtesseract.dylib` via JNA. `brew install tesseract` (binary + `eng.traineddata` at `/opt/homebrew/share/tessdata`); `PdfExtractionService` now (a) auto-detects tessdata across common paths (incl. `/opt/homebrew/share/tessdata`) and (b) a `@PostConstruct` appends existing lib dirs to `jna.library.path` (`/opt/homebrew/lib:…`) so OCR works with no external JVM flags. Verified: OCR'd a stored PDF to ~16k chars with no flags. OCR runs only at ingest, so already-stored image PDFs need re-ingest.
- **Dead change-notification chain pruned** — removed `ChangeNotificationService.notifyWatchers`+`computeSeverity`, the `ObligationChange` entity/repo, `EmailService.sendChangeNotification`, `Constants.JOB_CHANGE_NOTIFICATION`/`CHANGE_TYPE_*`, the `obligation_changes` table (V5 edited + repaired + dropped), and the `deliver_change_notification` mention in `JobQueue`. Kept `upsertWatch`/`removeWatch` (used by `ObligationBrowserService`). *Still dead (out of scope): `EmailService.sendScraperAlert`/`sendSupersededNotification` — the class has no injection sites.*
- **Verify:** intel + tenant + intel-frontend all build green; intel restarted clean (Flyway validated 16 migrations; log shows `jna.library.path = /opt/homebrew/lib:…`).

### Reusable UI kit + Intel Act Explorer & Detail (tabs)
- **`shared/src/components/`** (imported by BOTH frontends via `import { … } from 'shared'`; `shared` is already a workspace dep of each) — `DataCard`, `DetailHeader`, `CoverageStrip` (clickable tiles), `SectionTabs` (count badges), `SectionTable` (≤5 cols, single-line truncated cells + hover tooltip, server pagination/sort/search, optional `actions(row)` for tenant CRUD), `formatters` (`formatNaira`/`formatDate`/`friendlyPenaltyTypes`/`PENALTY_TYPE_LABEL`/`RISK_COLOR`/`STATUS_COLOR`). `@mui/icons-material` added to `shared` deps. **Intel act pages adopt it first; tenant + other pages migrate later (deferred).**
- **Act Explorer** (`RegulationExplorerPage.jsx`) — 5 columns `Act | Regulator | Obligations | Sanctions | Returns` (Status column + filter dropped); TanStack + `useSearchParams`; filters **Search · Regulator**; 5 KPI cards with breakdown dropdowns (Total Acts→by Regulator; counts→top Acts). Backend `RegulationService`: fix N+1 (grouped counts per page), `controlCount` added, `stats()` via Criteria aggregates + `regulators:[{regulatorId,name}]` facet (fixes the old name-vs-id filter bug). **Count columns are sorted via correlated subqueries** (`countOrder`) because they are service-resolved, not entity properties — a plain `Sort` on them throws `PropertyReferenceException` (mapped to 401). Only `name` is a native sort; `regulatorName` is not sortable.
- **Act Detail** (`RegulationDetailPage.jsx`) — `DetailHeader` + `CoverageStrip` (Instruments/Obligations/Sanctions/Returns/**Controls**, clickable→tab) + `SectionTabs`; each tab **reuses the standalone register endpoint + shared column definition** (see "Act-detail tabs reuse register tables" below), filtered by this act. `GET /admin/acts/{id}` stays header+counts only. **Both `useQuery` hooks run before any early return** (Rules of Hooks — otherwise the detail page crashes).
- **Verify (done):** intel + tenant builds green; `mvn clean compile` (GraalVM 21); headless: explorer `Act|Regulator|Obligations|Sanctions|Returns`, regulator filter 419→297, KPI drill OK. **No DB change → no reseed.**

### Act-detail tabs reuse register tables (single column source; tab endpoints removed)
- **Problem:** the Act-detail tabs had their own endpoints (`GET /admin/acts/{id}/{instruments|obligations|sanctions|returns|controls}`), their own nested DTOs, and their own column markup — which had already drifted from the standalone registers (different fields held, different headers).
- **Discovery:** every register endpoint already filters by act — sanctions `?regulationId=`, returns/controls/obligations `?actId=` (obligations also `?regulationId=`); only `/platform/instruments` lacked it. So the tab endpoints were pure duplication.
- **Backend (removed duplication, one added filter):** deleted the 5 tab endpoints from `AdminRegulationController`, the 5 tab methods + `actRegulatorAbbreviation()` from `RegulationService`, and the nested `InstrumentItem/ObligationItem/SanctionItem/ReturnItem/ControlItem` classes from `RegulationDetailDto` (header+counts remain). Added optional `regulationId` + `q` (title LIKE) to `InstrumentController.search` / `InstrumentService.search` — the one gap.
- **Frontend (`shared/src/components/columns.jsx`, new):** one column definition per entity, keyed by the **register DTO** field names — `obligationColumns` (`title‖plainEnglishStatement`, `regulatorAbbreviation`, `riskRating`, `hasPoints`), `sanctionColumns` (`description`, `penaltyType`, `penaltyDetails`, `liableRoles`), `returnColumns` (`title`, `frequencyType‖frequency`, `deadline`, `responsibleUnit`+`responsiblePerson`), `controlColumns({withAct})` (`controlSummary‖controlNumber`, `complianceArea‖theme`, `riskLevel`, `status`, [actName]), `instrumentColumns({regMap})`. Also exports shared `riskChip`/`statusChip`. Column shape `{ id, label, minWidth, maxWidth?, truncate?, sortable, sortField?, render?(row) }`; `SectionTable` now sorts by `sortField ?? id`.
- **Registers import the shared columns** (render via `col.render`): intel `ObligationsExplorerPage` (`#`+`obligationColumns`+Actions), `InstrumentsPage` (`instrumentColumns({regMap})`+Actions), `SanctionExplorerPage`, `ReturnExplorerPage`, `ControlExplorerPage` (`withAct:true`).
- **Act tabs call the register API with the act filter** (`TAB_API` map in `RegulationDetailPage`) and render the same shared columns via `SectionTable` (Controls tab uses `withAct:false`). Row-click routes to each entity's detail page. `api.js` `acts.*` tab methods removed; `instruments.list` now takes a params object via `toQuery`.
- **Verify (done, headless via :5173):** all five act tabs render the register headers — Instruments `Title|Reference No|Regulator|Risk|Status`, Obligations `Obligation|Regulator|Risk|Points`, Sanctions `Obligation|Penalty Type|Penalty|Responsible Party`, Returns `Return|Frequency|Deadline|Responsible`, Controls `Control|Theme / Area|Risk|Status`; all 5 registers render the same columns (+`#`/Actions/Act page chrome) — zero HTTP/console errors. intel + tenant builds green; `mvn clean compile` (GraalVM 21). *Note: a dev-only React "unique key" warning appears under `<StrictMode>` + MUI `TableBody`; not present in the production build.*

### Interconnected detail pages → right drawers (Act + Obligation only)
- **Motivation:** from Act detail, clicking a row navigated **away** to the entity's register detail page, losing the act context. Detail pages that actually hold linked collections should drill in place via a right drawer; registers are **unchanged**.
- **Verified relations (which pages benefit):** Act (instruments/obligations/sanctions/returns/controls), Obligation (controls/returns/sanctions/evidence/history), Instrument (`obligations[]`/`sanctions[]`) — but the Instrument detail is opened inline, and **Sanction/Return/Control detail DTOs carry no back-links** (`AdminReturnDetailDto`/`AdminControlDetailDto` have no linked obligations; `SanctionsPenalty` has no obligation field), so those pages get no tabs (left untouched this round).
- **Shared:** new `EntityDrawer` (right drawer, title/subtitle, scroll body, **"Open full page →" pinned at the end**); `SectionTable.search.action` renders a node (e.g. an action button) inline after the search box. Both exported from `shared`.
- **Extracted panel components** (`features/admin/components/detail/`): `SanctionDetailContent`, `ControlDetailContent`, `ReturnDetailContent`, `InstrumentDetailContent` — the presentational bodies of the four detail pages, re-imported by their pages so the drawer and the full page render **identical** fields (no drift). `EntityDrillDrawer` loads one small entity by id (TanStack `['entity', String(id)]`, `staleTime 60s`) and renders the matching panel; it deliberately does NOT handle obligations (avoids an import cycle) and suppresses "Open full page" for instruments (no standalone detail route — `InstrumentsPage` opens its detail inline).
- **Act detail (`RegulationDetailPage`):** all 5 tabs stay; `onRowClick` opens the drawer for that row instead of `navigate`. Obligations render the tabbed `ObligationDetailView` inside an `EntityDrawer`; the other four use `EntityDrillDrawer`. Verified: each tab's row opens the correct drawer, **URL unchanged**, "Open full page" routes to the entity page, zero console/HTTP errors.
- **Obligation detail repurposed** (`ObligationDetailView.jsx`, new — used by `ObligationExplorerDetailPage` as a full page AND inside the Act drawer): `DetailHeader` (title, applicability chip, regulator/act/area/section/type chips, plain-English description) → verbatim/plain `FormattedText` panel → clickable `CoverageStrip` (**Controls·Returns·Sanctions·Evidence·History**) → `SectionTabs` + a `SectionTable` per tab. Each tab's **action button sits next to the search box** (`search.action`): Controls→Link controls, Returns→Map return, Evidence→Upload; the six edit modals are retained. Client-side search + local paging (the lists are embedded, no per-tab endpoint). `ObligationExplorerDetailPage` is now a 10-line wrapper. Skips a standalone "Coverage" title capture gotcha (CSS uppercases it).
- **Controls tab = the controls register, exactly:** the obligation detail now carries a `controls: List<AdminControlDto>` (the SAME DTO the register serves), built by `ObligationExplorerService.mergedControls(id)` (the two link styles — `obligation_id` FK and the comma-separated `linked_obligation_ids` — unioned) → `AdminControlService.toDtoList(...)`. The tab renders it with `controlColumns({ withAct:false })`, so `Control` (summary text), `Theme / Area`, `Risk`, `Status` are all populated (the older embedded `ControlInfo` had no `controlSummary`/`complianceArea`, so those cells fell back to the number/theme). Row id = `complianceControlId`.
- **Deferred (same pattern):** registers adopting drawer row-click; exposing `ComplianceControl.linkedObligationIds` so Control detail can show a linked-obligations tab; Sanction/Return/Control detail tabs.
- **Verify (done, headless via :5173):** all 5 act tabs open drawers with the right panel text and no URL change; `/admin/obligations/:id` shows tabs + coverage strip; refactored `/admin/sanctions/:id`, `/admin/returns/:id`, `/admin/controls/:id` still render their full bodies (direct nav); `check_dto_binding.py` clean on the new files; intel + tenant builds green; **no backend change (no `mvn`)**.

### Sanctions Penalty Type + Amount (offline LLM bake)
- **Problem:** the sanctions grid (`sanctions.xlsx`, repo root, 357 penalty rows) had a free-text `Sanction or Penalty` cell (often a per-role list like `₦1.5M (MD & ECO), ₦1M (CCO), ₦20M (DMB)`); the DB stored the text but `severity_score` was null on every sanction and amounts were re-parsed ad hoc. Not sortable/filterable by amount.
- **Offline bake (`tools/toolkit-md-points/`)** — `sanctions_source.py` (shared Excel reader; forward-fills merged `source`; cleans numeric cells e.g. `2.3`), `parse_sanctions.py` (**LLM-only**, gateway `deepseek-v4.1`, resumable batches) classifies each `penalty` into `penaltyType[]` (MONETARY / MONETARY_PER_UNIT / MONETARY_PER_DAY / PERCENTAGE / IMPRISONMENT / LICENCE_ACTION / FORFEITURE / RECOVERY / CRIMINAL / DISCRETIONARY / QUALITATIVE) + `maxAmountNaira` + `confidence` → `sanctions_parsed.json`. `enrich_sanctions.py` merges into the committed JSON (`penaltyType`, `maxAmountNaira`, `severityScore`; **no** itemized list, **no** `amountPerDay`). Result: 355/355 grid rows typed (338 monetary), 250 with a numeric amount, severity 1–10.
- **Responsible-party prefill** — 14 grid rows had a genuinely blank "Responsible Party" cell in the Excel (Advance Fee Fraud ×2, EFCC ×2, ISA 2025 ×1, NSE Rulebook ×9). `enrich_sanctions.py → prefill_roles` derives the liable party from the offence/penalty wording and sets `liableRoles` **+ a `liableRolesDerived: true` flag** (auditable). `verify_sanctions.py` allows a prefilled value only when the source cell is blank AND the flag is set. Result: 351/351 rows have roles.
- **Fidelity gate** — `verify_sanctions.py` compares the JSON grid against the Excel on all 6 **pass-through** columns (`source→regulation`, `section→sectionRef`, `offence→violation`, `penalty→penalty`, `implication→riskExplanation`, `responsible→liableRoles`); PASS = identical after whitespace/newline-collapse only. `verify_json.py` also asserts `penaltyType`+`severityScore` on every grid row. `render_sanctions_review.py` emits `sanctions_review.csv` (357 rows, `needsReview` flag; only 8 narrative rows flagged).
- **Only the sanctions GRID is imported.** The register is **351 sanctions** (the `sanctions.xlsx` grid, 355 rows − 4 dupes). The **246 universe-sheet sanctions were dropped entirely** — they were instrument-level free text ("non-compliance shall attract appropriate sanctions…") with no section/penalty/responsible/severity and polluted the register with empty rows. Removed end-to-end: `ToolkitImportService.importUniverse` no longer creates them, `ToolkitSeedDoc` lost the `UniverseSanction` type + `Universe.sanctions` field, `compliance_toolkits.json` lost the `universeSanctions` array + the universe rows' `sanctions` key, and `export_json.py`/`verify_json.py` no longer emit/expect them (`sanctionsTotal=351`). No `universeSanction` mention remains anywhere.
- **Backend** — single paginated `AdminSanctionDto` (the separate `AdminSanctionDetailDto` was deleted) carrying every field; `SanctionsPenalty.penaltyType` (JSONB List<String>); reused `sanctionAmountNaira` as the numeric filter/sort value (set from baked `maxAmountNaira`, fallback `parseMoney`); `severityScore` populated at import; V15 edited in place (+ `penalty_type JSONB`). **No backfill** — fresh seed (or wiped DB + re-import) only. Fresh-seed coverage: **351/351** `penalty_type` + `severity_score` + roles, 351 with penalty text, 337 with an amount (14 roles prefilled from offence wording; the JSON grid keeps 355 rows).
- **UI (intel Sanction Explorer + detail)** — 4 columns (`Obligation | Penalty Type | Penalty | Responsible Party`; the Act column was dropped to keep the table narrow — Act stays as a filter), single-line rows with vertical spacing + hover tooltips, friendly penalty-type labels, row-click → detail page (which shows the full DTO). Filters (JPA Criteria): global search = **obligation only** (`q` on `description`), Act (`regulationId`), Penalty Type (`jsonb_exists` on `penalty_type`), Amount min/max (`sanctionAmountNaira`), Responsible Party (`jsonb_exists` on `liable_roles`, single-select). KPI cards with breakdown dropdowns (Total→by penalty type, Monetary Exposure→top acts, High Severity→by penalty type, Enforced→by penalty type). TanStack Query + `useSearchParams`; nullable sorts use NULLS LAST.
- **Verify live (done):** wiped `atheris_intel`, restarted intel → seeder imported 1541 obligations / **351 sanctions** / 2361 controls; `/admin/sanctions` shows 351 fully-populated rows + working filters/KPI drills; verified headlessly.

### Controls: CRMP-only source, fixed inherent-risk columns, pruned uncontrolled obligations
- **Single control source.** Controls come ONLY from the CRMP obligation rows (`primaryControl` + `additionalControl`) via `importCmpControlsFromSections`. The **Compliance Monitoring Plan** sheet is gone end-to-end: `ToolkitImportService.importCmpControls(...)` + its `extractActName`/`extractSectionRef`/`normalizeControlStatus` helpers deleted; `ToolkitSeedDoc` lost the `monitoringPlan` field + `MonitoringRow` class; the committed JSON lost the `monitoringPlan` array + `meta.totals.monitoringPlanRows`; `export_json.py`/`verify_json.py` no longer emit/expect it. (The Monitoring-Plan path produced 140 controls, of which only 1 was ever linked to an obligation — it added rows, not coverage.)
- **18 uncontrolled CRMP obligation rows are pruned** from the JSON (both control columns blank — incl. 2 cross-section duplicates and 2 junk rows). `importCmpControlsFromSections` also logs `obligation rows skipped (no control)`. Counts: `obligationRows` **1648 → 1630**, `obligationRowsSaved` **1541 → 1533**; controls **2221 → 2170**.
- **Column-resolution bug fixed in `export_json.py`** (the root cause of blank control risk): `resolve_columns` decided layout by `"col0" in header`, so `S/N`-headed sheets fell into the wrong branch and read the risk-description column as `likelihoodInherent` (232 dirty rows). Risk columns are now resolved **by header label** (`Likelihood (Inherent)` / `Impact (Inherent)` / residual labels), scanned across the two header rows — ABAC (7/8), most sheets (8/9), AMLCFT (16-col) all resolve correctly. Dirty control-risk rows dropped **232 → 19**.
- **Offline AI bake for the last 19** — `tools/toolkit-md-points/fix_inherent_risk.py` (gateway `deepseek-v4.1`, key `AI_GATEWAY_API_KEY`, resumable `inherent_risk_fixed.json` sidecar, `inherent_risk_review.csv`) classifies the 19 cells that were genuinely labels-with-text or sentences, writing clean `Very Low|Low|Medium|High|Very High` back into **both** `compliance_toolkits.json` and the `.md` (matched by title + header-derived column indices; only dirty→clean cells written, never clean cells). 31 cells fixed (`High (…)`→High, `Medium to High`→High, `- High`→High; 4 Trade-Marks sentences→Medium). `ToolkitImportService.normalizeRiskLabel` hardened to strip leading list punctuation, so a future re-import is robust without the bake.
- **Baked points + sanctions enrichment survive a re-`--emit`:** after editing/re-emitting the JSON, re-apply `export_json.py --fill-points points_generated.json` and `enrich_sanctions.py --apply` (the raw emit carries neither).
- **Verify live (done):** wiped `atheris_intel`, reseeded → **1535 obligations / 351 sanctions / 2170 controls / 139 returns**; `compliance_controls.risk_level` **0 nulls**, bands `Critical/High/Moderate` (no `Medium`); Controls register + obligation Controls tab show populated, identical Risk; `verify_json.py` + `verify_sanctions.py` PASS; intel + tenant builds green; `mvn clean compile` (GraalVM 21).

### Control points — controls display like obligations (clean bullets, split list)
- **Problem:** a CRMP `Primary Control`/`Additional Control` cell often packs several distinct controls into one inline bullet list (`"- A.- B.- C"`), and the importer maps **one row = one control**, so the register showed the whole run-together list as the control's name (488/2170 controls).
- **Offline bake** (`tools/toolkit-md-points/control_points.py`, gateway `deepseek-v4.1`, key `AI_GATEWAY_API_KEY`, resumable `control_points.json` sidecar, `control_points_review.csv`): splits each CRMP control cell into its individual statements, cleans the dashes/spacing, keeps wording faithful. Writes `primaryControlPoints`/`additionalControlPoints` (**obligation point shape** `{marker,text,content,pointType:"control",level,children}`) **and** the cleaned prose back into `compliance_toolkits.json` (2414 cells, 970 multi-point). *(The entire offline toolchain under `tools/toolkit-md-points/` has since been removed — `compliance_toolkits.json` is now the committed source of truth and is not regenerated from the markdown.)*
- **Backend:** typed `dto/ControlPoint` (no `Map`), `ComplianceControl.points` JSONB (`@Builder.Default`), `ObligationRow.primaryControlPoints`/`additionalControlPoints` (`ToolkitSeedDoc`), `ToolkitImportService` passes the points through; `AdminControlDto` gains `firstPoint`+`pointCount` (register), `AdminControlDetailDto` gains `points` (detail).
- **Frontend:** shared `controlColumns` Control cell renders `firstPoint` + a `(+N)` badge (falls back to `controlSummary`); `ControlDetailContent` renders the points via `FormattedText` (`pointType="control"`), falling back to the text.
- **Dedup side effect:** cleaning makes cross-section duplicate CRMP rows (same act+type+text, e.g. `conduct_risk`/`crmp`) collide, so controls dropped **2170 → 2137** (cells unchanged at 2414 — no distinct control lost; `ToolkitControlDedup` now catches them).
- **Migration cleanup (requested):** V2/V3/V15 ALTERs folded into their base `CREATE TABLE`s (10 removed: instruments curation columns + `search_vector`, sanctions `risk_explanation`/`penalty_details`/`penalty_type`). Only the 3 `act_id` FK ALTERs remain in V15 (genuine mutual reference with `acts.canonical_instrument_id`). `compliance_controls.points JSONB` added inline to V16.
- **Verify live (done):** wiped `atheris_intel`, reseeded → **2137 controls, all with points** (776 multi-point), 0 dash-starts; register Control cell shows `first point + (+N)`, detail renders the `(a)…(d)` list; zero console/HTTP errors; intel + tenant builds green; `mvn clean compile` (GraalVM 21).

### Intel admin detail pages — richer, organized (control · return · sanction)
- **Problem:** the intel `*DetailContent` bodies looked sparse. Against the DB, the **sanction** and **return** detail DTOs already carried every column; the **control** `AdminControlDetailDto` was missing 8 (`controlType`, `residualLikelihood`/`residualImpact`/`residualRiskRating`, `ownerName`, `obligationId`, `linkedObligationIds`, `createdAt`). Read-only — no new endpoints/migration.
- **Register Control cell:** dropped the `(+N)` badge; now shows the **first cleaned point** only, with a **hover tooltip** listing all points. `AdminControlDto` carries `controlPoints` (list of strings) instead of `firstPoint`+`pointCount`; shared `controlColumns` renders the `Tooltip`.
- **New shared kit** `features/admin/components/detail/detailKit.jsx`: `Section`, `Field`, `FieldGrid`, `StatTile`, `RiskChip`, `MonoChip`, `LongTextBlock`, plus resolvers `InstrumentRef` and `LinkedObligationChips`. Responsive so the same component renders full-page **and** inside the 680px `EntityDrillDrawer`.
- **Linked-obligation titles are resolved in the frontend** (Option B): the DTO returns the raw id list; `LinkedObligationChips` fetches each via `api.platform.obligations.get` with TanStack `useQueries` (n cached GETs; no batch endpoint exists) and renders **title chips** linking to `/admin/obligations/:id`. `InstrumentRef` similarly resolves an instrument title. **No raw row ids are ever displayed** — ids only travel as link targets.
- **Control page:** header (number + inherent-risk chip + status + `controlType`) → 4 stat tiles (Inherent Risk, Residual Risk, Frequency, Owner) → Classification grid → Risk Assessment (Inherent rating vs Residual L/I/rating) → Control Statement (points) → Regulatory Requirement / Monitoring Activity / Control Effectiveness → Linked Obligations → recorded date. **Return/Sanction:** same section language, every DB field surfaced, no ids (return/sanction show the instrument title; sanction uses `friendlyPenaltyTypes`, per-day amount, role chips, enforcement history).
- **Verify live (done):** headless `/admin/controls/49|1`, `/admin/returns/1`, `/admin/sanctions/1` render all sections with **no raw-id labels**; linked obligations resolve to real titles; the Obligation-detail Controls drawer renders the same content with the URL unchanged; `check_dto_binding.py` clean on all three; zero console/HTTP errors; intel build green; `mvn clean compile` (GraalVM 21). **No reseed.**

### Toolkit instrument reference numbers (`TKL-0001`)
- **Problem:** the toolkit source's Reference column is empty for 362 of 363 universe rows, so the instruments register's monospace **Reference No** was blank for every seeded document.
- **Offline bake** `tools/toolkit-md-points/assign_instrument_references.py` (`--apply`): gives each universe row its 1-based position as `TKL-%04d` (deterministic, stable across reseeds — universe order is fixed). **Never overwrites** a real regulator reference (1 row keeps `BSD/DIR/GEN/LAB/08/016`). *(Tooling since removed; the baked reference numbers are committed in `compliance_toolkits.json`.)*
- **Auto-generated act stubs** (31) are NOT universe docs, but cannot be deleted: they are the canonical instrument an act needs so the **tenant seed** (`RegulationSeedService`) does not skip it — the tenant obligation model is instrument-centric (`countByInstrumentId`/`findByInstrumentId`), so removing them would drop ~361 obligations / 160 sanctions / 33 returns from tenants. They are kept and, like every other instrument, get a reference (below).
- **Universal reference hook (covers scraper/upload too):** `Instrument.assignGeneratedReference()` is a **`@PostPersist`** hook — after the INSERT (so the id exists) it stamps `TKL-%04d` for `upload_source='toolkit_seed'` and `GEN-%04d` for everything else (scraper/upload/jobs), and is a no-op when a real reference was supplied. So **no instrument of any kind is ever blank**, not just toolkit ones. `InstrumentReferenceBackfill` (an `ApplicationRunner`, `@Order(50)`) is the idempotent safety net for rows created before the hook existed (existing DBs).
- **Backend:** `importUniverse` maps `reference` → `source_reference_number` (the JSON bake); the `@PostPersist` hook covers universe stubs and all scraped/uploaded instruments. No importer-side ref code.
- **Verify live (done):** reseeded `atheris_intel` → **394 instruments, 0 blank** (363 universe `TKL-`/real + 31 stubs `TKL-0364…`); then ran the scraper (`POST /platform/regulators/{id}/test-scraper`) → the newly ingested instrument got `GEN-0395`; `/admin/instruments` Reference No column fully populated; `verify_json.py` PASS.

### Tenant: Acts explorer + Act detail, and richer detail views
- **New tenant acts module** (`modules/acts/`): `Act` entity + `ActRepository` + `ActService` + `ActController` (`GET /api/v1/acts` list w/ counts, `/acts/stats`, `/acts/{id}`), tenant V35 `acts` table (`regulation_id UNIQUE`, `canonical_instrument_id`, name/abbrev/regulator). Seeded inside `RegulationSeedService.seedBundle` (`upsertAct`, idempotent) so every platform regulation becomes a browsable act. Counts: obligations `countByInstrumentId(canonical)`, controls `countByActId`, returns `countByActId`, sanctions `countByRegulationId`.
- **Obligations register** gained an `instrumentId` filter (`ObligationController`/`ObligationService.matches`) so the Act detail tabs can filter by the act's canonical instrument.
- **Tenant frontend**: new `ActsPage` (KPIs w/ breakdown dropdown, Search+Regulator filters, 5 cols `Act|Regulator|Obligations|Sanctions|Returns`, row→detail) and `ActDetailPage` (`DetailHeader` + clickable `CoverageStrip` + `SectionTabs` + `SectionTable` per tab). Tabs reuse existing registers, filtered: obligations `?instrumentId=`, controls `?actId=regulationId`, returns `?act=name`, sanctions `?actName=name`. **Column defs are local and bound to the TENANT DTO field names** (`ObligationRegisterItem.tenantRiskRating`, `ControlRegisterItem.residualRisk`, `ReturnRegisterItem.returnName`/`currentDueDate`, `SanctionListItem.sanctionType`) — the shared intel `*Columns` factories bind different names and would render blanks. Routes `/acts`, `/acts/:id`; Sidebar nav; `api.acts.*`.
- **Detail redesign** (presentation-only): new tenant `components/detailKit.jsx` (`Section`/`Field`/`FieldGrid`/`StatTile`/`RiskChip`/`MonoChip`/`LongTextBlock`; no api resolvers — tenant DTOs already carry linked titles). `ControlsPage`/`ReturnsPage`/`SanctionsPage`/`ObligationDetailPage` restructured into sectioned cards + stat tiles; **no raw numeric row IDs displayed**; all edit/test/schedule modals preserved.
- **Verify (done):** `mvn -pl atheris-compliance-tenant-backend -am clean compile` + tenant `npm run build` green; `check_dto_binding.py` clean on `ActsPage`/`ActDetailPage` (only local-state/false-positive hits). **Live tenant verification pending**: the acts populate on `POST /subscriptions/seed` (or re-onboard) after the tenant restarts onto V35.

### Backend Verification & Cleanup (latest)
- **DB-driven tenant identity** — tenant backend no longer reads `atheris.tenant-id`/`TENANT_ID`; `TenantIdentityService` resolves the single `tenant_profile` row. `LicenseService.activate()` calls intel `POST /api/v1/internal/tenants/provision` (idempotent) to learn the real tenant id, stored on `tenant_profile` (`UNIQUE(tenant_id)`, tenant V26). All 13 `@Value tenant-id` sites converted; `InternalTenantController.onboard` idempotent. One tenant per instance — the `TENANT_ID=2` sacrificial-tenant pattern is obsolete.

### Backend Verification & Cleanup (earlier)
- Clean startup verified (no seeder warnings / auto-generated password). Dormant webhook delivery code removed end to end (commit `09cccd1`); delivery is polling-only via `ObligationSyncService`.
- Toolkit import idempotent — dedup by natural key (obligations = regulation+statement+section; sanctions = regulation+section+description+penalty); counts now **1541 obligations / 351 sanctions** (commit `520d70e`; sanction count later reduced to the grid only).
- Intel "Tenant Overview" dashboard widget (`8d423c8`); `@Builder.Default` on 100 fields in 35 files (`5310dc3`); never-enforced `maxRegulators`/`maxControls`/`maxReturns` removed everywhere, V12 edited in place (`48ba65d`); backlog marked done (`ed3270c`).

### Backend (intel)
- **Toolkit seed (Phase A)** — `modules/regulations/` (`Regulation`, `RegulationAlias`, `AreaOfFocus`, `ToolkitImportService`, `AdminRegulationController`, `AdminUniverseController`), Flyway V15. Parses `classpath:toolkit/compliance_toolkits.md` into instruments (`upload_source='toolkit_seed'`, never enter OCR/AI), regulations, obligation_mappings, sanctions, returns (139), regulators. Atomic (TransactionTemplate `setRollbackOnly()`); returns an UNMAPPED report. `parseMoney` honours `M`/`k` suffixes and takes the largest compound per-role amount (replaced the digit-stripping `parseNaira`).
- Endpoints: `GET/PUT /admin/regulations[/{id}]`, `POST /admin/acts/toolkit/import` ("Re-import toolkit" button on `/admin/acts`), `GET /admin/universe/{instruments,areas-of-focus,stats}`.
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
- **OpenRouter free tier = 50 free-model requests/day** (shared by classification and points; ~150 points batches remain → multi-day backfill). $10 of credits raises it to 1000/day.
- Toolkit sanction amounts are stored wrong (e.g. ₦2 / ₦500 for millions) — `parseMoney` on the seed rows.
- Tenant `RegulationSeedService` mixes intel `linkedObligationIds` with tenant obligation ids in one list.
- Intel logging was raised to DEBUG by main; intel obligations explorer has 6 columns (rule: 5).
- **~50 seeded returns show "Due date needed"** — their platform wording has no deadline ("Annually", "Quarterly", "As specified by CBN"); a CCO/admin must set each via Edit schedule. A bulk "set due dates" screen would speed this up.
- Seeded return frequency labels can be lossy copies of the platform text (e.g. LCR shows "Quarterly" but correctly runs MONTHLY from the platform's full wording).
- FindingsPage has 7 table columns (rule: max 5) and still uses raw useState/useEffect (no TanStack Query); default status filter 'Open' hides imported Remediated/Closed findings until the filter is changed.
- Settings → Organization shows mojibake ("Â·") in the team/owner counts.
- "New Control" form still writes only the control side of obligation links (import writes both).
- `ObligationService.createObligation`/`updateObligation` check `obligationRepo.existsById(instrumentId)` — the wrong repository (no local instrument table).
- Intel frontend `api.js:244` still treats 403 as session expiry (the tenant was fixed — see below); check the intel `SecurityConfig` entry point too.
- `PlatformApiClient` swallows platform failures, so "platform down" surfaces as 404 instead of 502.
- `changePassword` does not apply the password-strength rule that invite/reset use.

## Done — AI Points Pipeline Fixes + OpenRouter Free Models

- **One model call per `AiClient.completeEntity`** — Spring AI 1.1.0 `content()` and `entity()` each call the model; now the `BeanOutputConverter` format is appended manually and one reply is converted (verified with a capture server: 2 → 1 requests).
- **Toolkit `description` backfill** — the dev DB was seeded before the parser mapped `description` (all 1541 NULL → every verbatim point discarded). Re-import fills only NULL fields on rows matched by natural key (`obligationsUpdated`), clears points on repaired rows; points job skips obligations with no description (no wasted quota).
- **`VerbatimMarkerMatcher`** — verbatim markers must be real list markers at a token boundary ("c" inside "accept" no longer matches); cross-references ("paragraphs (b) to (g)") ignored.
- **Control import idempotent** — CRMP controls deduplicated by act + normalised text + type (`ToolkitControlDedup`); numbers allocated collision-free. The re-run's 1631 re-inserted duplicates were removed by the import itself (rows newer than their group's oldest import date only; same-day seed repeats kept). Result key `controlsDeduplicated`.
- **Reasoning switch** — `AI_REASONING_ENABLED=false` sends OpenRouter `"reasoning":{"enabled":false}` via `ReasoningToggleInterceptor` (Spring AI `extraBody` is silently dropped in 1.1.0). Env-configurable `POINTS_BATCH_SIZE` / `POINTS_CONCURRENCY` / `POINTS_STAGGER_MS` / `AI_MAX_TOKENS`.
- **Models:** `AI_MODEL=nvidia/nemotron-3-super-120b-a12b:free`, `AI_FALLBACK_MODEL=qwen/qwen3.8-27b:free`, reasoning off. Local `granite4:micro` (Ollama) evaluated and rejected (no valid JSON on long docs, invented verbatim, ~20h for points). AgentRouter tokens only serve approved coding clients.
- **`.env` gotcha:** the backends read `.env` as properties — a trailing `# comment` on a value line becomes part of the value.

### Verified (live, 2026-10-04)
Re-import via the UI button: 1631 duplicate controls removed (4237 → 2606), descriptions 0 → 1541; second run all zeros. Points generated with exact verbatim markers (a)–(d); intel obligations explorer list/stats/hasPoints OK.

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

## Done — Fix intel Controls/Sanctions/Dashboard rendering empty

Controls and Sanctions explorers (and the dashboard Regulatory Coverage) rendered empty in dev despite the API returning 2361 controls / 351 sanctions. Root cause: the raw-hook pages guard their async loads with `const alive = useRef(true)` + `useEffect(() => () => { alive.current = false; }, [])`. Under `<StrictMode>` the effect runs mount→unmount→mount, so the simulated-unmount cleanup leaves `alive.current=false` **permanently** (the setup never resets it) and every `if (!alive.current) return;` aborts → `rows` stays `[]`. Returns/Obligations were unaffected (TanStack, no such guard). Fix: reset the ref in the effect **body** — `useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, [])` — in `ControlExplorerPage`, `SanctionExplorerPage`, `RegulatoryCoverage`. Rule: any `useRef`-based alive/abort guard must be re-armed on setup, never only disarmed on cleanup.

## Done — Intel Returns Explorer Harmonized (Phase 1)

Brings the intel Return Explorer to the obligations-explorer pattern so it can later be ported to the tenant.

- **Frontend** (`features/admin/components/ReturnExplorerPage.jsx`): migrated from raw `useState/useCallback/useEffect` to **TanStack Query + `useSearchParams`** (URL-synced, debounced search) — matches `ObligationsExplorerPage`. KPIs are **clickable cards with a breakdown dropdown** (Total & Unassigned → by Frequency Type; Frequency Types → counts; Responsible Units → counts), clicking a row filters. Filters: search, Frequency type, Responsible unit, **Act** (new). Table trimmed to 4 data columns (Return / Frequency / Deadline / Responsible) + `#`; **Act and Actions columns removed**, whole row clickable to `/admin/returns/:id`; Frequency cell shows a **single** chip (`frequencyType`, falls back to `frequency`); section-ref chip removed (lives on the detail page).
- **Backend** (`AdminReturnService`): `list` sorting moved **into the JPA Criteria specification** (`query.orderBy`) with a property whitelist, `actName → actId` alias, unknown-property ignore and a stable `returnId` tiebreaker — no more `PropertyReferenceException` on `actName`/unknown sorts (previously raw `Pageable`). `stats()` now uses **criteria aggregates** (`multiselect`+`groupBy`) instead of `findAll()` in-memory, and adds **`acts: [{actId,name}]`** for the Act filter. Response stays `Map<String,Object>`.
- **Verified:** `mvn -q clean compile` + `npm run build:intelligence` green; DTO-binding check has **0 row-field mismatches**; live: `/admin/returns/stats` returns `acts`, `totalReturns=139`, `sort=actName`/`sort=bogusField` both return 200. Tenant port is Phase 2 (pending).

## Done — Event-Triggered Return Filings (initial implementation)

- **Federal holidays:** tenant V33 `federal_public_holidays`; tenant-scoped `/api/v1/federal-public-holidays` GET/POST/PUT/DELETE endpoints; CCO/TENANT_ADMIN Settings tab maintains Nigerian federal holiday and separately observed dates. Mutations are audited.
- **Event filings:** V34 adds one trigger label/rule per event-driven return plus per-instance trigger date, evidence reference/file, base due date, effective due date, and adjustment flag. Record occurrences as separate filing instances. Working-day offsets skip weekends and configured actual/observed holidays; calculated offset deadlines on non-working days move forward. Manual request/directive dates are used as explicitly stated. Evidence Vault files attach to the filing instance.
- **UI:** Returns rows configure triggers, record occurrences, and expand to event-filing history; detail shows trigger date/reference/evidence and deadline adjustment.
- **Verified:** GraalVM Java 21 tenant backend test suite and tenant frontend production build pass; API client paths match the new routes. Live DB migration/API/UI flow still requires user-started backends and manual verification.

## Done — Bulk Import Phase 4 (Findings)

Findings page → Import (CCO / TENANT_ADMIN — closed rows carry a CCO sign-off). `FindingImportHandler`.

- **Template:** Reference | Description* | Finding Type* (Gap/Control Failure/Process Weakness) | Severity* | Status* (Open/In Remediation/Remediated/Closed) | Date Raised | Remediation Deadline | Root Cause | Linked Control Number | Linked Obligation ID | Owner | Remediation Notes | Date Remediated | Date Closed, plus "Obligations" and new "Controls" lookup sheets (`ImportParsing.controlsReferenceSheet`).
- **Historical findings keep their history:** `Finding.@PrePersist` now sets `createdAt` only when null, so Date Raised is preserved; Remediated/Closed rows set `remediationSubmittedAt`, `closedAt`, `ccoSignOffAt` (= Date Closed) and `ccoSignOffUserId` (= importing user). Status consistency enforced (In Remediation needs an owner; Remediated needs owner + Date Remediated; Closed needs both dates; raised ≤ remediated ≤ closed; nothing in the future). Deadline defaults to Date Raised + SLA days (`FindingService.slaDays`, now public static).
- **Reference (new column):** `findings.external_reference` + unique index on `lower(external_reference)` (V5 edited in place; dev DB got ALTER + Flyway repair). Dedup on reference (case-insensitive), else description + control + obligation. Shown under the finding ID in the register and in the detail view.
- Register/detail show the real **control number** (batch-loaded, no N+1) instead of `CTRL-%03d` of the id.
- **Dashboard refresh:** afterCommit calls `DashboardService.recomputeInNewTransaction()` (REQUIRES_NEW — a plain `@Transactional` call from afterCommit joins the finished transaction and its insert is never committed). `getLatest` now orders by snapshot date then id, because several snapshots can share a date.

### Verified (live, browser pane)
- **Phase 1:** 6-row file → 2 valid / 2 invalid / 2 duplicate; errors file held exactly the 2 invalid rows; commit imported 2 (register 1541 → 1543, CBN + act + High risk shown); re-upload → 0 valid / 4 duplicate, Import disabled. No token → 401; analyst on admin endpoint → 403 without logout.
- **Phase 2 (controls):** 7-row file → 3 valid / 2 invalid / 2 duplicate; commit → CTL-0100 (explicit) + CTL-0101/0102 (auto), both link lists written (obligation 5 kept its 3 existing links), register "2 controls", No Control 2 → 0; re-upload → 0 valid / 5 duplicate.
- **Phase 3 (returns):** 8-row file → 4 valid / 3 invalid / 1 duplicate; Annual 31 Mar 2027 → single 2027-03 period; Quarterly 15 Jan 2027 → starts 15 Jan; Event-driven listed, not overdue; re-upload → 0 valid / 5 duplicate; analyst → 403 on returns import. Repair (2026-10-03): 113/143 retyped, 564 untouched periods removed, 96 rebuilt; overdue 268 → 92; second dry run → 0.
- **Phase 4 (findings):** 8-row file → 5 valid / 2 invalid / 1 case-insensitive duplicate; stored dates 2025-11-05 → 2026-01-20 preserved, SLA deadlines derived, CCO sign-off on the Closed row, controls linked by number; re-upload → 0 valid / 6 duplicate.

**Dev gotcha:** running `mvn clean compile` while a backend is running deletes its classes underneath it — requests then 401 and the UI logs out. Restart the backend after any clean build.

## Done — Bulk Import Phase 3 (Returns) + Return Frequency Fixes

Returns page → Import (CCO / TENANT_ADMIN only). `ReturnImportHandler`; shared parsing moved to `ImportParsing` (verbatim, no behaviour change).

- **Template:** Return Name* | Regulator* | Frequency* | First Due Date | Prep Days Before Due | Act | Return Type | Filing Channel | Responsible Unit | Responsible Person | Return Owner (email) | Linked Obligation IDs, plus the "Obligations" lookup sheet. Frequency = Daily, Weekly, Monthly, Quarterly, Semi-Annual, Annual, Biennial, Event-driven. First Due Date required for Quarterly/Semi-Annual/Annual/Biennial. Owner matched to an active user by email. Duplicates = name + regulator. Links via the existing `insertReturnLink`. Audit `returns_imported`.
- **Per-type import roles:** `ImportHandler.requiredRoles()`; returns → CCO/TENANT_ADMIN (matches POST /returns). Checked on preview, commit, errors and batch history (history hides types the role can't use).
- **Why every tenant return was MONTHLY:** intel's `InternalRegulationSeed.ReturnItem` never carried `frequencyType`, so the seed fell back to MONTHLY; manual `ReturnService.create` never set it either. Both fixed. `ReturnFrequency` (modules/returns/entity) is the single mapper: labels/aliases + `classify(text)`. Classifier rules, in order: an explicit cycle adjective anywhere wins (most frequent if several: daily > … > biennial); then period-end anchors (month-/quarter-/year-end, "each calendar quarter", "financial year (FY) end"); then event phrasing (within/upon/immediately/on request…); bare durations ("within 1 year of the incident") are event-driven. `ReturnFrequencyTest` holds 26 real platform strings.
- **Filing cycle anchored on the First Due Date** (imports AND the Add Return form): a future date is the first due date; a past one rolls forward on the cycle (month dates computed from the original anchor, no drift). The first anchored instance is always created even beyond the 120-day lookahead. No date → old behaviour. Daily returns are left to the 5-minute scheduler on import.
- **Register:** returns with no instances (event-driven) are now listed, not hidden. Frequency filter uses the stored type. ISO week label uses `WEEK_BASED_YEAR`. `linkObligations` evicts the obligations register cache.
- **Repair action** for already-seeded tenants: `GET/POST /api/v1/returns/frequency-repair` (TENANT_ADMIN). Dry run first; retypes from the platform's text (classified by the tenant's stricter classifier; platform MONTHLY treated as "no answer"), deletes only untouched instances (Not Started, no stage owner/data, no submission, notes or evidence; system escalation ignored), rebuilds via `ensureInstances`, audits `returns_frequency_repaired`. Idempotent. UI: warning banner + `ReturnRepairDialog` on the Returns page for admins.

## Done — Bulk Import Phase 2 (Controls)

Controls page → Import, same 3-step dialog and endpoints (`{type}=controls`). New `ControlImportHandler`; `ImportService` stayed generic (no type branches).

- **Template:** 15 columns (Control Name* … Linked Obligation IDs). Strict dropdowns for Control Type (Preventive/Detective/Corrective/Directive), Test Frequency (Monthly/Quarterly/Semi-Annual/Annual), Inherent Risk (Critical/High/Moderate/Low, "Medium" accepted) and Owner. **Theme is free text** — its suggestions are listed via the new `ImportHandler.suggestions()` (anything in `allowedValues()` becomes a STOP-style dropdown). A read-only **"Obligations" sheet** (`ImportHandler.referenceSheets()`) lists every obligation's ID/title/section/regulator/act, from the new `ObligationService.registerRows()`.
- **Linking by obligation ID** — the only reliable key: `obligation_number` is NOT unique (seed and review number 1..n per instrument). The column is Text-formatted so Excel doesn't turn `12,345` into a number; `;` or `,` separators. IDs are validated with one `findAllById` (exists, not deleted).
- **Both link lists are written:** `controls.linked_obligation_ids` (control detail, `?obligationId=` filter) AND each obligation's `ObligationClassification.linked_control_ids` (register "N controls", "No Control" KPI, every coverage dashboard). Manual `ControlService.create` writes only the control side — the lists are still not kept in sync elsewhere. Classifications load with the new derived `findByObligationIdIn`; a missing one is created applicable/active. No classification history is written (the batch audit `controls_imported` covers it).
- **Numbers:** blank → `CTL-%04d` from the highest existing or in-file `CTL-n`, allocated once per batch (seeded numbers use other formats and are ignored). Duplicates: same number (register or file), or — when no number — same name + act.
- Test Frequency Days derived when blank (30/90/182/365). Name capped at 500 (`control_tasks.control_name`).
- **Frontend:** `ImportDialog` gained `itemLabel`, `contextLabel` and `invalidateKeys` props (controls invalidates `controls`, `obligations`, `dashboard`). No DB migration.

## Done — Bulk Import Phase 1 (Obligations) + Auth Status Codes

**Flow (tenant `:5174`, Obligations Register → Import):** download the `.xlsx` template → upload → row-by-row preview (valid / invalid with reasons / duplicate) → "Import N obligations". Imported rows go **straight to the register** (`source='imported'`, `applicability='applicable'`) — the preview confirm is the human check, by user decision; they do NOT pass through the Review Inbox. Invalid rows download as an errors `.xlsx` with an "Error" column to fix and re-upload.

### Backend (`modules/imports/`)
- `ImportHandler` + `ObligationImportHandler`; `ImportService`; `ImportWorkbooks` (POI read/write, zip-bomb guards, ≤5000 rows, ≤10 MB, header match case/space-insensitive); thin `ImportController`. Endpoints (`ANALYST/CCO/TENANT_ADMIN`): `GET /imports/{type}/template`, `POST /imports/{type}/preview` (multipart `file`), `POST /imports/batches/{id}/commit` (409 `already_committed`, batch row-locked), `GET /imports/batches/{id}/errors`, `GET /imports/batches?type=`. New table `import_batches` (**V31**, JSONB rows/counts/status).
- Validation: title + regulator required; Impact `Insignificant..Severe` (aliases Low/Medium/High/Critical); Likelihood `Rare..Almost Certain`; owner must be active; dates numeric or `yyyy-MM-dd`/`dd/MM/yyyy`. Duplicate key = normalised title + section + act. Commit: one transaction, numbers allocated once per batch, `@PrePersist` inherent risk, **one** `obligations_imported` audit per batch, register cache evicted.
- **Schema:** `obligations.tenant_regulator_id` (V3 edited in place) — register/detail fall back to the tenant regulator when there is no platform instrument. Dependency: Apache POI `poi-ooxml` 5.3.0.

### Frontend
- Reusable `components/modals/ImportDialog.jsx` (3 steps, 5-column preview, result chips); "Import" button beside "New Obligation"; `api.js` `rawRequest` (multipart + blob, keeps the 401 refresh) + `api.imports.*`.

### Auth status codes (tenant)
- `SecurityConfig` got an entry point: bad/missing token → **401** `unauthorized`; role denial → **403** `forbidden`. `api.js` refreshes/logs out only on 401 (403 keeps the user logged in). License 402/403 unchanged. `ClientAbortException`/broken pipe log at DEBUG.

### Dev user seeder (tenant)
- `config/DevUserSeeder.java`: with `SEED_USERS_ENABLED=true` + `SEED_USERS_PASSWORD`, seeds `admin@ / cco@ / analyst@ / auditor@<SEED_USERS_DOMAIN>` on start (idempotent, never resets existing users, off by default).

### Verified (live, browser pane, `admin@mamcorp.test`)
6-row test file → preview 2 valid / 2 invalid / 2 duplicate; errors file held exactly the 2 invalid rows; commit imported 2 (register 1541 → 1543, CBN + act + High risk shown, Under Review unchanged); re-upload → 0 valid / 4 duplicate, Import disabled. No token → 401; analyst on admin endpoint → 403 without logout.


## Done — Review Edit Page Overhaul (inline editing, linked returns, header enrichment)

Review Edit page (`ReviewEditPage.jsx`) rewritten for CCO/analyst workflow. Commit `0ad5e72`.

### Backend (`ReviewDetail.java` + `ReviewService.java`)
- `ReviewDetail` DTO gains `dateCommencement`, `nature` (from `PlatformInstrumentDetail`)
- `ReviewObligationDto` gains `linkedReturnIds`, `linkedReturnNames` — populated from `obligationRepo.findLinkedReturnIds()` for re-reviews (saved obligations exist)

### Frontend (`ReviewEditPage.jsx` — 763 lines)
- **Removed**: AI Summary card, OCR/Extracted Text collapsible section, `ocrOpen` state
- **Obligations table (5 cols)**: `#` | `Obligation` (title conditional + verbatim inline) | `Interpreted` (inline) | `Risk` (editable dropdown) | `Actions` (apply + delete)
- **Title**: conditional — shows bold text when present, hidden when empty; clicks into TextField for editing
- **Risk**: editable `TextField select` in table row (Critical/High/Moderate/Low) — analyst overrides AI assessment directly
- **Expanded section**: Area of Focus / Obligation Type / Deadline dropdowns, AI Risk Assessment (likelihood/impact/risk + description + control owner + act name), Classification tenant overrides (applicability, risk, impact, likelihood, owner, gap), Linked Regulatory Returns (Autocomplete multi-select via `api.returns.list()`)
- **Header**: `dateCommencement` + `nature` in metadata grid; re-review chip when `status !== 'pending'`

## Done — Instruments Page Overhaul (KPIs, risk filter, enriched detail)

Tenant `InstrumentsPage.jsx` (commit `71d9097`, merged with the harmonize version): KPI cards with per-regulator dropdowns, debounced search, risk/regulator filters, server paging, 5 columns; detail shows DTO-correct obligations (5 cols) and expandable sanction cards (`amountNaira`). KPI counts and filters cover the current server page only (no stats endpoint).

## Done — Intel Obligation Explorer Detail Page (Replicated from Tenant)

Intel `ObligationExplorerDetailPage.jsx` mirrors the tenant obligation detail (header chips, metadata grid, verbatim/plain text, controls/returns/sanctions previews, right drawer). Backend `ObligationExplorerDetail` extended (gap, applicability, controls, evidence, history); since the main merge it is the single `/admin/obligations` controller (DB-side criteria filters, stats, `hasPoints`). Commit `db252c8`. Modal saves (`linkControls`, `assignOwner`, …) have no intel endpoints yet.

## Done — PDF Routes Return 404 Instead of 500

`Instrument.pdfUrl` is null for toolkit-imported instruments; `LocalStorageService.resolve(null)` threw an NPE → 500. Now 404 `DOCUMENT_UNAVAILABLE` (intel `ResourceNotFoundException`/`DocumentUnavailableException`; tenant `{"error":"document_unavailable"}`), and `pdfErrorMessage(res, fallback)` in each app's `api.js` shows "No document is available for this instrument." Verified live in both apps.
- **Two PDF call sites:** `ObligationBrowserService.openPdfStream` AND `InternalInstrumentService.openPdfStream` (the tenant proxies the latter) — fix both.
- `NoSuchFileException` maps to 404, but under `STORAGE_PROVIDER=s3` `NoSuchKeyException` is untranslated and would still 500.
- Remaining 500s: `findById` and `classify` in `ObligationBrowserService` still throw bare `RuntimeException` for a missing obligation.

## Done — Dashboards Harmonized (risk / area / act)

Dashboard V2 routed at `/dashboard/v2` and fixed (inverted quarter date range, all-zero heatmap, total/submitted unit mismatch, ignored thresholds, per-row query in escalation-matrix). `/dashboard/v2/thresholds` no longer takes `tenantId` as a request param (cross-tenant read/write) — resolved via `TenantIdentityService`. Added `control-coverage?by=act` and `RiskProfileDto.byAct`. Tenant `CcoDashboardPage` gained risk profile / area / act sections (TanStack Query, 30s poll); intel `DashboardPage` gained a `RegulatoryCoverage` section.
- **Only link to filters a page reads:** `ObligationsRegisterPage` reads only `risk`, `regulator`, `areaOfFocus`, `owner`, `status`, `hasGap`; `impact`/`likelihood`/`act` links are silent no-ops (adding them is an open follow-up).

## Done — `atheris-register-page` Skill

`.claude/skills/atheris-register-page/` encodes the register/details pattern and the defects found building it. The `frontend-register-page` skill points at it, so both toolchains share one source of truth.

- **SKILL.md** — the per-app fork (tenant has TanStack Query; intel has neither the dependency nor a provider and must not get one as a side effect), the page recipe, the five highest-frequency traps, and a verification checklist that does not stop at a green build.
- **references/traps.md** — the full catalogue with evidence, grouped by failure mode.
- **references/data-model.md** — the field drift table and the canonical risk vocabulary.
- **scripts/check_dto_binding.py** — mechanises the field-vs-DTO diff. Validated against the pre-fix `InstrumentsPage`: catches all three real bugs, zero false positives, and reports OK on the fixed version. Supply **all** backing types (list + detail + stats DTO) — under-supplying them is the main source of false positives.
- **scripts/grid_codemod.py** — the MUI 7 Grid conversion.

**Note:** the skill was verified factually (every claim re-checked against the code) but has NOT been through the skill-creator's eval loop — no with-skill vs baseline runs, no trigger-description optimization. Worth doing before relying on it to trigger on its own.

## Done — Risk Matrix Defaults Repaired

`RiskMatrixConfig` entity `@Builder.Default` axes/bands disagreed with V28 and `computeInherentRisk` (High band unreachable; likelihood axis matched no stored value; `>` vs `>=` at boundaries). `V30__repair_risk_matrix_defaults.sql` repairs only exact broken rows.
- **Rule:** entity `@Builder.Default` wins over migration column defaults for JPA-created rows — when a default exists in both, they must agree.

## Done — MUI 7 Grid Migration

154 legacy `<Grid item xs md>` usages in 19 files converted to `size={{ xs, md }}` (MUI 7.3.11 `Grid` is v2; legacy props were silently ignored).
- **Verify MUI against the installed `node_modules/@mui/material/Grid/Grid.d.ts`**, not memory.

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

### Intel frontend now HAS TanStack Query (migrated since the original slice)
`@tanstack/react-query` is a dependency of `atheris-compliance-intelligence-frontend` with a `QueryClientProvider` in `main.jsx`; `ObligationsExplorerPage`, `ObligationExplorerDetailPage`, `RegulatorAdminPage` and (since the April returns harmonization) `ReturnExplorerPage` use `useQuery` + `useSearchParams`. The older intel explorers (`RegulationExplorerPage`, `ControlExplorerPage`, sanctions) still use the raw `useState`/`useCallback`/`useEffect` + race-guard pattern — both styles coexist. The `frontend-register-page` convention's "use TanStack Query, never raw useEffect" now applies to intel too for **new/changed** pages; migrate old ones deliberately, not as a side effect.

### Known lint debt (pre-existing, not new)
The raw fetch-in-effect idiom trips `react-hooks/set-state-in-effect` — 3 errors per explorer/detail pair. The reference `RegulationExplorerPage`/`RegulationDetailPage` produce the identical 3 errors, and `npx eslint .` over the intel frontend already reports ~316 problems. No suppressions were added. Note the intel `npm run lint` script covers only the intel app; the tenant frontend has no eslint config at all.
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

## Done — Toolkit Seed via Committed JSON (points baked offline, no runtime LLM)

`classpath:toolkit/compliance_toolkits.md` never travelled into the JAR, so a fresh boot parsed nothing and points were generated per-startup via LLM calls (429/quota). Fixed by converting the markdown **once, offline** to a committed typed JSON (`src/main/resources/toolkit/compliance_toolkits.json`, ~4.8 MB) with baked points (verbatim + interpreted) — the importer reads a single deterministic file, **no LLM at seed time**. `ToolkitImportService` (six typed importers: universe/CRMP/sanctions/returns/controls + CRMP-sections), `ToolkitImportResult`, `ToolkitControlDedup` idempotency (PR #3), keep `AiClient` for the classifier. Deleted `PointsRetryScheduler`/`BatchPointsResponse`/`atheris.points.*`. Datasource reads `DB_USERNAME`/`DB_PASSWORD` (no hardcoded fallbacks). The offline toolchain under `tools/toolkit-md-points/` (Python points bake, `export_json.py --fill-points`, sanction/control/return bakes, verdicts, reconcile with `origin/main`) has since been **removed** — the JSON is now hand-edited in place (re-apply bakes only when re-emitting). Result was 1541 obligations / 351 sanctions / 139 returns with points on all 1278 marker-bearing rows. Always compile with GraalVM 21 (default JDK 27 breaks Lombok).

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
