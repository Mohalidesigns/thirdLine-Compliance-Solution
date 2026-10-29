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

### One stable filing link, honoured first due dates, single Edit dialog, templates-only Settings — `feature/findings-action-ux`
The "Send link" story, a first-due-date bug and the Settings/schedule UX.
- **One stable link per filing period.** `FilingLinkTokens` = `base64url(HMAC_SHA256(secret, "filing:" + instanceId))` — deterministic, so the same URL is reproducible without storing it; only `sha256(token)` is ever persisted. Secret `atheris.returns.upload-link-secret` → `UPLOAD_LINK_SECRET` → `ENCRYPTION_KEY` → a dev fallback (`application.yml`, with `upload-link-expiry-days`). `ReturnUploadLinkService.createFilingLink` is now **get-or-create** (`REQUIRES_NEW`): it re-points the recipient, clears any revocation and extends the expiry to `max(now, dueDate) + 30 days`, so the link lives while the period is open (submitting stays state-gated: Not Started / Data Gathering, not pending-review, not completed). `FilingLinkTokensTest` (4 cases).
- **Every sender carries the same URL** — the APPROACHING/REMINDER/OVERDUE mails, the Draft-rejection re-send, the **Start** hook (Not Started → Data Gathering in `advanceStage`, try/catch so Start can never fail on mail) and the new manual action **`POST /returns/{id}/send-filing-link`** (ANALYST/CCO/TENANT_ADMIN). Recipients = the responsible people (all of them) with the **owner Cc'd**; names resolve through the new `PersonDirectoryService` (active users + owners + LDAP). `ReturnService.sendFilingLink` returns `FilingLinkSentResponse {path, recipients, cc, subject, body}` where `body` is `EmailService.compose(body, link)` — i.e. **exactly** what was mailed, so a preview can't drift. Body rendered from the new `return.filing.request` template via `ReturnFilingDetails.messageVars`, with an inline fallback.
- **FE** — header **Send link** button on periodic returns with an open period (`SendFilingLinkDialog`): it shows the **real email** (To / Cc / Subject / Message, pre-wrap), then a labelled read-only **Link** field with a contained **Copy link** — same pattern as the event-link modal; the earlier explanatory paragraph and "Sent. The link is:" were removed.
- **An explicitly-set first due date is honoured.** `ReturnPeriods.next` now uses cycle index **0** for a `DATE` rule when `due_date_source = 'user'` (schedule edit / Add Return / import) — so a first due date that has already passed creates that period and it reads **Overdue**. Platform-derived anchors (`platform_text`) keep rolling forward, preserving the "no overdue on day one" fix. `ReturnPeriodsTest` +3 (`userAnchorInThePastIsHonoured…`, `userMonthlyAnchor…`, `platformAnchorInThePastStillRollsForwardToToday`).
- **Stale periods self-heal.** New `ReturnService.reconcileFirstDueDate` (runs before the open-period guard, so it also fires on the 5-minute `scheduledMaintenance`): if a user-set DATE return has periods that don't include its own anchor period **and every existing period is untouched**, they're removed and regenerated from the anchor; logs/audits `return_periods_reconciled`. Any drafted/started/filed period aborts it. (Added because `ReturnEditDialog` skips the schedule PUT when the form is unchanged — re-saving the same date sent nothing, so the stale period stayed.) Deploying this fixed the live tenant's "daily NFIU" return without a re-save.
- **Single Edit dialog** — `components/returns/ReturnEditDialog.jsx` (Schedule + Escalation tabs, `initialSchedule`/`scheduleBody`/`validateSchedule`) replaces `EditScheduleDialog.jsx` + `ReturnEscalationPolicyDialog.jsx` (both deleted); one **Edit** button; the return-detail Escalation card no longer has its own policy buttons. `SCHEDULE_ROLES`/`EDIT_ROLES` = **ANALYST**/CCO/TENANT_ADMIN (analyst may edit a schedule; backend `PUT /{returnId}/schedule` + `/event-trigger` widened to match).
- **Create Return** — first-due-date hint on DAILY/WEEKLY, "no rule" only offered for event-driven, `obligationContext` prefills the linked obligation + regulator when opened from the obligation dialog (`ReturnPicker` forwards it). `CreateObligationDialog` passes that context.
- **Settings → Notifications is templates-only** — `GET /escalation/policies?defaultsOnly=true` (repo `findByIsDefaultTrueOrderBySubjectTypeAscNameAsc`, `list(subjectType, defaultsOnly)`), relabelled "Escalation templates", new entries created as `isDefault: true`; per-return escalation is edited on the return. Copy fixes: Tasks/panel now say the filing's data can be submitted as soon as it's started.
- **Verify:** tenant compiles; **165 tests green**; tenant FE builds. Live: Send link preview == Mailpit mail, `return_periods_reconciled` fired for return 1 (period 2026-10-29 → 2026-10-28, audit `{firstDueDate, removed:1}`). No DB migration in this batch.

### One open filing period (Option A), draft upload, review emails & CCO badge — `feature/findings-action-ux`
The returns slice: a return now holds **one** rolling filing period, the Draft gate takes a real document, and the review flow actually notifies the right people.
- **One open period per return (Option A)** — new `returns/service/ReturnPeriods.java` is the single source of the period math: `next(ret, step, rule, lastDue, today)` = the successor occurrence (offset rules advance from the **period end** — last due minus offset — so quarterly 30-day never skips a month; date rules ride the anchor cycle; rule-less daily/weekly just advance) and `project(...)` = the next N occurrences, **computed and never persisted**. `ReturnService.ensureInstances` materialises **at most one open period** (open = anything not `SUBMITTED`/`SUBMITTED_LATE`); `rollForward(returnId)` runs on the **CCO accept** (stage → COMPLETED) and creates exactly the successor the register projected. Register `current` = earliest non-completed period (past-due included) else the latest; `ReturnRegisterItem.projectedPeriods` (+ DTO `ReturnEscalationResponse`, `ReturnInstanceItem.pendingReview`/`reviewDecision`) feed the UI. `ReturnPeriodsTest` (7 cases) covers the successor math.
- **Returns detail page rebuilt** (`ReturnsDetailPage.jsx` + `components/returns/{ReturnDetailsCard,ReturnFilingPanel,ReturnHistoryTable,returnCommon}.jsx`) — URL-backed state (`?tab=filings|history` default Filings, `?instanceId=`, `?review=data|report` scrolls + gold-rings the review panel); a **Details card** at the top (grounding, schedule, event trigger, full escalation ladder from the new `GET /returns/{id}/escalation`, linked obligations); tabs **Filings / History** (history = completed only, with a Review column); a 4-step stepper (**Not Started filtered out**, FE-only `WORKFLOW_STAGES`); period switcher over the periods needing action ("N of M"); "Periods on record" + "Next periods (projected)" with the "next period is created only when this one is accepted by the CCO" hint; "Send link" on register rows. `detailKit`'s `Field` value is now `component="div"` (fixes every `<p>`-nesting warning app-wide).
- **Draft → Review now uploads the report** — `PUT /returns/instances/{id}/submit-draft` (multipart `files` + optional `notes`, ANALYST/CCO/TENANT_ADMIN, declared exactly like findings `remediate`) → `ReturnService.submitDraft`: **≥1 file required** (409 `draft_evidence_required`), each stored via `EvidenceVaultService` on the filing (`sourceType=return_instance`, description `Draft report <period> (vN)` so revisions are labelled and kept as history), then the shared `advanceToReview(...)`. The old URL-only JSON `advance` is now **blocked** for Draft (`409 draft_upload_required`) and only starts a filing. FE `SubmitDraftDialog.jsx` (multi-file picker, optional cover note); the dead `AdvanceDialog` was deleted. `ReviewPanel` is gate-aware ("Submitted data" vs "Drafted report") and `EvidenceFileList` shows each file's description.
- **Four filing emails, one shared layout** — keys `return.filing.{report_review,data_review,data_receipt,changes_requested}` seeded by `NotificationTemplateSeeder` (`ensure`, insert-only ⇒ **no migration**; edit in Settings → Email Templates). Body = `{{returnName}} / Act/Obligation: {{actObligation}} / Regulator / Responsible person / Due date / Period`, where `actObligation` is the act name else the linked obligation title (the register's own fallback). Recipients: report-ready → **role CCO** (+ owner Cc) linking `?review=report`; data-submitted → **the stage-owner analyst** (fallback role ANALYST) (+ owner Cc) linking `?review=data`; **submitter receipt** → the email captured from the public link; changes-requested → role ANALYST (+ owner Cc) linking the filing. In-app notifications keep the short summary (`NotificationService` gained `emailBody`/`cc` overloads).
- **CCO sees their review tasks** — `assignee=me` now also counts **unassigned** tasks the caller's role may action (`TaskCenterService.actionableByRole` → `RETURN_REPORT_REVIEW` for CCO/TENANT_ADMIN); `TaskCenterController` passes `u.getRole()`; the sidebar badge moved to TanStack `useQuery` (`refetchInterval: 60s`). Before this the report-review task (`ownerUserId=null`, org-wide) never counted as "mine", so the CCO's badge was 0.
- **Escalation fixes found while testing "I created a return and no email came"** — (1) `EscalationPolicyService.toInstanceDto` never populated `notifyOnStart` (only `fromPolicy` did), and since **every return filing has a frozen `escalation_instances` row**, `resolve()` short-circuited to a config with `notifyOnStart=null` ⇒ the "please prepare" mail was **unreachable for every return filing**. (2) Escalation emails **Cc the owner *and* the responsible person(s)** (`EscalationDeliveryService.ccTargets`, for person *and* role targets — the responsible person used to be invisible when the ladder's L1 was a hand-picked person) and role targets now receive the **rendered template body** instead of the raw summary (new `NotificationService.notifyRoleEmailed(..., emailBody, cc)` overloads).
- **GATHERING was retired, not fixed** — having found ① unreachable, the decision was that **APPROACHING is sufficient**: it already fires for un-started filings (`remindUnstarted`), carries the filing link, repeats per policy, and lands with a *fresh* (30-day) link inside the lead window — which also removes the "link mailed months early" wart and the deploy backlog it would have caused. Removed: the `notifyOnStart` gate block in `EscalationEngine`, `gatheringReady` on `EscalationCandidate` (+ both handlers' args), `TRIGGER_GATHERING`/`KEY_RETURN_GATHERING`, the `return.filing.gathering` template, the **"Notify when started"** checkbox (Settings → Notifications) and Details-card row. `return.filing.approaching/reminder/overdue` bodies were enriched to the shared per-line block (`Act/Obligation` via the new `{{actObligation}}` var = act name else the linked obligation title, plus `Regulator` and `Responsible person` — vars supplied by `ReturnsEscalationHandler`). The **DAILY** seeded ladder moved from `+0/+1/+2 d` to **`+1/+2/+3 d`** (a `+0 d` L1 fired "0 day(s) late" *on* the due date). This tenant's 4 stale template rows and the DAILY levels were reset surgically (DELETE/UPDATE) so the app re-seeded them; the `escalation_policies.notify_on_start` column remains (inert). Mail signature is now **"— Verity Compliance Platform"**.
- **Reminder semantics, unchanged but worth knowing:** `dueAt = dueDate.atStartOfDay()`, so APPROACHING/REMINDER only fire **before** the due date; the OVERDUE ladder then fires at `dueAt + level.after`. A period created **on/after** its due date is therefore notified by the OVERDUE rung (the reason a due-today filing never gets an "approaching" mail). Filing links are minted per email, never revoked, valid **30 days** (`atheris.returns.upload-link-expiry-days`); submitting is state-gated (`view()` editable only at Not Started/Data Gathering and not `pendingReview`; else 409 `already_submitted` / `not_awaiting_data`).
- **Verify (done):** tenant compiles, **158 tests green** (incl. new `EscalationCcTargetsTest`), tenant FE builds. Live: intel seeded 139 returns with **0 null `act_id`** and the 33 toolkit due dates; prepare mail delivered `To: treasury@…` / `Cc: analyst@…` with a working `/return-upload/{token}`; L1 overdue delivered with the rendered template body; `escalation_events` shows the GATHERING rows appearing only after fixes (1)+(2). **Not yet UI-verified:** the four review emails, the CCO badge, and the draft upload (need a browser pass). `application.yml` drops the retired `atheris.returns.{instance-lookahead-days,escalation-thresholds}`. Backend Java comments added earlier in the session were stripped.

### Reusable Escalation & Reminder engine — returns + controls (tenant) — `feature/findings-action-ux`
Policy-driven escalation and reminders for return filings and control tests, replacing the old ad-hoc ladders.
- **Scheduling** — `config/SchedulingConfig` provides a virtual-thread `SimpleAsyncTaskScheduler`; `EscalationEngine.tick()` (`@Scheduled`, 5 min, 90 s initial) scans every `EscalationSubjectHandler`. Scheduled tasks only use virtual threads (request handling / `@Async` are untouched).
- **Model (tenant V45 `escalation_*` + V46 `notification_templates`)** — `escalation_policies` (+`_levels`), `escalation_instances` (+`_instance_levels`) for per-subject overrides, `escalation_events` (unique `subject_type/subject_id/trigger_type/level` = fire-once ledger; reminders upsert), and ALTERs `regulatory_returns`/`controls` add `escalation_policy_id`. Defaults (`EscalationDefaultSeeder`): **RETURN** (remind 10 d before, repeat 2 d, sendLink, L1 assignee +0 d / L2 manager +3 d / L3 manager-of-manager +7 d fallback **CCO**) and **CONTROL** (remind 5 d, repeat 2 d, no link, L1 assignee +0 d / L2 manager +2 d / L3 **CCO** +5 d). Offsets are `DAYS|HOURS`; L3 chains the manager ladder and falls back to CCO.
- **Resolution** — `EscalationPolicyService.resolve(subjectType, subjectId, subjectPolicyId)`: an instance override wins, else the subject's policy, else the tenant default for the type. Returns **freeze** the policy into an instance row at filing creation (`materializeAt` → `ensureFrozen`); the per-filing dialog edits the instance, the return-detail dialog sets the subject policy (`PUT /returns/{returnId}/escalation-policy`).
- **Delivery** — `EscalationTargetResolver` (ASSIGNEE / MANAGER / MANAGER_OF_MANAGER / PERSON / ROLE, CCO fallback), `EscalationDeliveryService` (in-app notification + email, **owner CC'd**, `{{placeholder}}` templates via `NotificationTemplateService`). Email via `EmailService.send(to, cc[], subject, body, link)`.
- **Templates** — five seeded defaults, runtime-editable at `GET/PUT /api/v1/settings/notification-templates[/{key}]`; FE **Settings → Notifications** tab.
- **Returns handler** (`ReturnsEscalationHandler`) — approaching/reminder/overdue per open filing; name→directory resolution; `markEscalated`. The old `catchUpEscalations`/thresholds/`EscalationNotifier` were removed.
- **Controls handler** (`ControlsEscalationHandler`) — open `control_tasks` (±150 d) → approaching/reminder/overdue; assignee = task user, owner = control owner (CC'd), link `/controls?controlId=`. `ControlTestService.processOverdueTasks` now only flips Pending→Overdue (the bespoke 2/5-day ladder and `EscalationNotifier` were deleted).
- **Public filing link (phase 3)** — `return_upload_links.instance_id`; `ReturnUploadLinkService.createFilingLink` + filing `view`/`submit` (evidence via `EvidenceVaultService` or a reference) → `ReturnService.submitFromLink` marks the filing **Submitted** (attributed to the link, stops reminders). Approaching/reminder **emails carry `/return-upload/{token}`** (in-app notifications stay on the internal link); the public page handles `mode=FILING`.
- **FE** — Settings → Notifications tab; Create-Return + return-detail **Escalation policy** pickers; per-filing **Escalation override** dialog; `MultiPersonPicker`/`PersonPicker` converted to TanStack Query.
- **Commits:** `07cf383`, `41eba77`, `00bd9b8`, `4333549`, `90a221b`. **V43 edit + V45/V46 → drop/recreate the tenant DB and re-onboard.**
- **Follow-ups:** per-control policy override (the `controls.escalation_policy_id` column exists but has no entity field/UI — the tenant default applies); manual "Send link" for periodic returns (engine-driven only).

### Returns Act/Obligation grounding + reliability (tenant) — `feature/findings-action-ux`
A return is now grounded to a governing **Act** (required) and its **Obligation** links are surfaced as a data-quality signal — plus several reliability fixes.
- **Act is required on create.** `CreateReturnRequest.actId` is `@NotNull`; `ReturnService.doCreate` resolves it via `acts.findByRegulationId` (`resolveAct`), 400 `invalid_act` if unknown, and snapshots **both** `act_id` and `act_name` (previously `actName` was never set — every manual return was `act_id=null`/`act_name=null`, "No act recorded"). `CreateReturnDialog` gained a required **Governing Act** picker (over `GET /acts`, value = `regulationId`); `ActListItem` gained `regulationId`. Linking an obligation auto-fills the act from the obligation's `regulationId`.
- **DB integrity + semantics.** `regulatory_returns.act_id` stores `acts.regulation_id` (the platform id — matches the seed and `ActService.returnCount`); **V44** adds `fk_returns_act` → `acts(regulation_id)` + `idx_returns_act`. The seed's `upsertAct` now returns the act and only grounds a return when a real act row exists.
- **Detail + register exposure.** `ReturnInstanceDetailResponse` gained `actId`/`actName` (shown in the detail Schedule grid); `ReturnRegisterItem` gained `actId`, `linkedObligationCount` (batched, one `findAllReturnLinks`) and `stats.unlinkedCount`/`missingActCount`; the register shows a "No obligations" badge and a "No obligations" KPI that filters via a new `unlinked=true` register param. The Act filter is sourced from all acts. `ReturnPicker` shows an Act column.
- **Import.** The "Act / Regulation" column is now **required** and resolved to an `acts` row (name/abbreviation) → sets `act_id` + `act_name`; unresolvable rows are invalid. The Acts are a dropdown in the template.
- **Reliability.** Register now honours `Pageable` sort for whitelisted fields (`returnName`/`filingRegulator`/`currentDueDate`/`currentStatus`; unknown fields fall back to due-date asc — `registerComparator`, unit-tested in `ReturnRegisterSortTest`). Create supports an OFFSET due rule (`ruleType` + `dueDaysAfterPeriodEnd`). `linkObligations` backfills a missing act from the first linked obligation. New **`DELETE /returns/{returnId}`** (CCO/TENANT_ADMIN) removes upload links → obligation links → untouched periods → the return; **409 `return_in_use`** if any period has work.
- **FE stepper fix.** `STAGE_NAMES` now includes **Not Started** (aligning with the backend `STAGE_ORDER`); active step comes from `detail.stages`; Sign-off (`SIGN_OFF_IDX`) is the submit trigger — previously the off-by-one index made Not Started show no active step.
- **Deferred:** obligation-detail Findings tab.
- **Verify:** tenant compiles; `ReturnRegisterSortTest` + returns suite green; `npm run build:tenant` green; DTO binding check clean for the new fields. **DB must be dropped/recreated** (V44 changes the schema) — start backends + onboard manually.

### Gap = obligation with no control; gap findings; finding-type cleanup (tenant) — `feature/controls-testing`
- **One definition of "gap": an obligation with no linked control.** The stored `obligation_classifications.has_gap` / `gap_description` columns (and `classification_history.has_gap`) were **removed in place in `V3__create_obligations.sql`** (no new migration), along with every reference: `ObligationClassification`/`ClassificationHistory` fields, `ObligationClassificationRepository.findByHasGapTrue`/`countByHasGapTrue`, the `ObligationSpecification.hasGap` filter, the DTOs (`ObligationRequest`, `ClassifyObligationRequest`, `ObligationDetailResponse`, `InboxItemResponse`, `ObligationDetailView`, `ObligationClassificationDto`, `ObligationRegisterItem`, `SaveReviewRequest`), `ObligationService.updateGap`/`getGaps` + all `.hasGap`/`.gapDescription` maps, `ReviewService` propagation, the `GET /obligations/gaps` + `PUT /obligations/{id}/gap` endpoints, and the "Has Gap"/"Gap Description" **import columns** (`GapRequest` deleted). The register's `noControl` filter (`controlCount == 0`) is now the only gap filter; the dashboard gap links point at `/obligations?noControl=true` (they previously passed `hasGap=true`, which the register ignored — landing unfiltered). Labels relabelled "Gaps" → "No Control".
- **Finding types are now just `Control Failure` and `Gap`** (`Process Weakness` removed). `WorkflowStatus.FINDING_TYPE_CONTROL_FAILURE`/`FINDING_TYPE_GAP` added; `FindingImportHandler.FINDING_TYPES` reduced.
- **Raise Finding requires a real link, chosen with a picker.** `RaiseDialog` no longer uses numeric ID fields: a **Control** single-select picker (new reusable `components/modals/EntityPicker.jsx`, over `GET /controls/register`) for a control failure, or an **Obligation** picker (filtered `noControl=true`) for a gap. `FindingService.manualRaise` enforces it: `Control Failure` ⇒ `linkedControlId` required (obligation derived from the control); `Gap` ⇒ `linkedObligationId` required and control forced null.
- **Gap finding workflow.** A gap finding links to the **obligation only**; its stepper is obligation-first (Obligation → Gap raised → **Control linked** → In remediation → Review & sign off → Closed). Closing is **blocked** (`409 gap_open`) until the obligation has ≥1 linked control (`FindingService.gapResolved` checks `ObligationClassificationRepository.findByObligationId`), so linking a control (via `PUT /obligations/{id}/controls`) both unblocks the finding and clears the register `no control` gap. Gaps are raised **manually only** — from the Raise modal or the per-row "Raise gap finding" action on the register's `no control` rows (`/findings?raise=gap&obligationId=`).
- **Verify:** compiled + `vite build` clean; tenant DB dropped/recreated (in-place `V3` edit changes the Flyway checksum) → Flyway reapplied V1..V43, `has_gap`/`gap_description` gone; tenant backend + FE up, login/onboarding render with no console errors. **Tenant must be re-onboarded** (manual) on the fresh DB.

### Residual-risk rule: capped at inherent + re-evaluated on finding close (tenant) — `feature/controls-testing`
- **Single band rule** — new `ResidualRisk.fromTestResult(result, inherentRisk)` (controls/service/ResidualRisk.java): Passed → **Low**, Partial → **Medium**, Failed → **the control's inherent risk**. `ControlTestService.updateResidualRisk` (on test **record**) and the finding-close path both use it.
- **Residual risk can no longer exceed inherent risk** — `ResidualRisk.capAtInherent` caps the result (a control cannot make exposure worse than having no control). Previously a Partial test on an inherent-Low control produced residual `Medium` (> inherent).
- **Closing a finding re-evaluates the control** (`FindingService.reEvaluateControlResidualRisk`, called on `reviewRemediation` Accepted): while the control still has another open finding the failed test stands (residual = inherent); once the **last** finding is closed, remediation is treated as effective and residual reverts to **Low (capped at inherent)**. If the latest test is Passed the control keeps Low anyway. No re-test is scheduled on close — the normal test cadence re-proves it.
- **The reason is shown** — `ControlDetailResponse.residualRiskReason` is rendered under Risk Assessment on the control detail (e.g. *"Latest test failed on 2026-10-18, but FIND-001 was remediated and closed — residual risk restored to Low."*). Verified live: accepting FIND-001 flipped CTL-0001 residual `Moderate` → `Low` with that message.
- Unit test `ResidualRiskTest` (Passed→Low, Partial→Medium, Failed→inherent, never > inherent).

### Control → finding workflow visibility & remediation-evidence review (tenant) — `feature/controls-testing`
- **Auto-raised findings now link to their control.** `FindingService.autoRaiseFromTest` set only `triggeredByTestId`; it now sets `linkedControlId` (+ `linkedObligationId` when the control has exactly one linked obligation). Without this the control's "Has Finding" was always `None` and there was no control↔finding navigation. Existing rows were backfilled in the dev DB: `UPDATE findings f SET linked_control_id = t.control_id FROM control_test_results t WHERE f.triggered_by_test_id = t.test_id AND f.linked_control_id IS NULL`.
- **Control detail lists its findings** — `ControlDetailResponse.findings` (+ `FindingRepository.findByLinkedControlIdOrderByFindingIdDesc`), each row deep-links to `/findings?findingId=`; conversely the finding's "Control" workflow step links to `/controls?controlId=`.
- **Control finding count now includes not-yet-closed findings** (`ControlService` open statuses = Open + In Remediation + **Remediated**), so a remediated-awaiting-review finding still shows in "Has Finding" / the "Open Findings" KPI.
- **Findings register**: default status filter is now **All** (was `Open`, which hid a finding the instant it moved to `Remediated`) and a 5-tile KPI strip (Open / In Remediation / Awaiting Review / Overdue / Closed) filters on click.
- **Finding detail gained a Workflow stepper** (Control → Test failed → Finding raised → In remediation → Review & sign off → Closed) with the current stage highlighted and a next-action hint. `FindingsPage` supports `?findingId=` and `ControlsPage` `?controlId=` for deep links.
- **Remediation evidence is now viewable/downloadable.** New `GET /api/v1/evidence/by-source?sourceType&sourceId` (the repo method already existed) and `EvidenceFile.storagePath` is `@JsonIgnore`. New shared `components/evidence/EvidenceFiles.jsx` (`EvidenceFileList`/`EvidenceFileButton`) downloads via an authenticated blob fetch — the old `<a href="/api/v1/evidence/{id}/download">` **401'd**, because `/api/v1/evidence/**` is not `permitAll`. The **Review Remediation** dialog now shows a "Submitted remediation" panel (owner, submitted-at, submitted-by incl. via-link, notes) plus the evidence; the finding detail lists **all** evidence files (before, only the first `remediationEvidenceUrl` was ever exposed — files 2..n were invisible).
- **Note:** residual risk is driven by the test result and, on finding close, by the remediation being effective (see the residual-risk section above). A failed test sets residual = inherent risk; closing the linked finding restores it to Low.

### One-directional obligation↔control link, LDAP-only owner pickers & register cleanup (tenant) — `feature/controls-testing`
- **Obligation↔control link is now one-directional (obligation → control).** The link used to be stored twice and edited from both sides (`obligation_classifications.linked_control_ids` **and** `controls.linked_obligation_ids`), which drifted. Now the obligation side is the single source of truth: `ControlService.create/update` ignore `linkedObligationIds` from the request, the control create modal and Edit-Control dialog no longer expose it (`LinkControlsPicker` is select-only), and `ObligationService.syncControlLinks` keeps the control's mirror in step on link/create/update/delete obligation so the controls "Linked Obligation" filter and detail keep working.
- **Owner pickers are LDAP-only for inline add** (`PersonPicker` owner mode): the "Add new owner" button/form renders only on non-LDAP tenants (local); on LDAP you search existing owners + the directory. Applied everywhere (findings assign, review, controls, remediation owner) — no per-caller flag needed. `PersonPicker` gained `allowAddInline` (default true) for explicit opt-out.
- **Returns**: `CreateReturnDialog`'s raw "Owner User ID" field is now a **Return Owner** user picker (searches LDAP directory / local users, sets owner name + user id).
- **Record Test** (`ControlsPage`): the Remediation Owner defaults to the control's owner when the dialog opens.
- **Obligations register cleanup**: removed the **Under Review** KPI and the **Has gap** filter — the register holds only `applicable` obligations (under-review items live in the Review Inbox), so both were meaningless. KPIs are now Total / High Risk / No Control (`columns={3}`).
- **Manual obligation fixes**: `createObligation`/`loadOrCreateClassification` now set `applicability="applicable"` (they defaulted to `under_review`, so a manually created obligation wrongly counted as Under Review). The create/edit obligation modal gained a **Regulator** selector (`tenantRegulatorId` added to `ObligationRequest` + `ObligationRegisterItem`) and dropped the "Has gap" checkbox.

### Cross-linking pickers, owner directory search & recursion fix (tenant) — `feature/controls-testing`
- **Create-and-link from the pickers**: the obligation create/edit dialog's **Link controls** picker (`LinkControlsPicker`) now has an **"Add New Control"** that reuses `CreateControlDialog`; `ReturnPicker` ("Add New Return" → `CreateReturnDialog`) already did. All three pickers (`LinkControlsPicker`, `LinkObligationsPicker`, `ReturnPicker`) now **auto-select** the item just created, so it's linked when you save. On the obligation-detail `LinkControlsModal`, "Add New Control" also auto-selects the new control.
- **Infinite component recursion fixed (blank/hanging Obligations & Controls pages).** The pickers mount their nested create dialog as an unconditional *sibling*, so adding `LinkControlsPicker → CreateControlDialog` closed the chain `CreateObligationDialog → LinkControlsPicker → CreateControlDialog → LinkObligationsPicker → CreateObligationDialog → …`, which React nested forever (frozen main thread, nav spinner stuck). Fix: render each nested dialog only when open — `{createOpen && <CreateControlDialog open …/>}` — in `CreateObligationDialog`, `LinkControlsPicker`, `LinkObligationsPicker`, `LinkControlsModal`, `ReturnPicker`, `CreateControlDialog` (`{pickerOpen && …}`) and `CreateReturnDialog` (`{linksOpen && …}`). Behaviour when open is unchanged.
- **Owner picker searches the LDAP directory** (`PersonPicker` owner mode / `OwnerPicker`): it detects the tenant auth mode once (`GET /ldap/users` → `enabled`, cached module-level) and, on LDAP, merges directory users into the options (deduped by email/fullname, shown `· directory`). Picking a directory user resolves to an owner — it reuses an existing owner with that email, or creates one with `POST /org/owners` — so `controlOwnerId` stays a real owner id. The inline **"Add new owner"** dialog (`QuickAddOwnerDialog`) gained a **"Search directory"** autocomplete on LDAP that prefills full name + email.
- **Returns can be created by ANALYST**: `POST /returns` and `PUT /returns/{returnId}/obligations` now allow `ANALYST` (was CCO/TENANT_ADMIN), matching controls/obligations create.

### Owner-submitted remediation evidence (tenant) — `feature/controls-testing`
- **Owner is the remediation submitter** (`Finding` entity, `RemediationLinkService`, `FindingService`/`FindingController`, `FindingsPage`, `api.js`): the account-less public link (`POST /api/v1/public/remediation/{token}`, page `/remediate/:token`) is the **primary** path — the owner submits the evidence themselves. Link submissions now record attribution: `findings.remediation_submitted_via_link = true` and `remediation_submitted_by_owner_id` (with `remediation_submitted_by_user_id` left null, since the owner has no login).
- **In-app path is the fallback** — `PUT /findings/{id}/remediate` is now **multipart** (real files via `EvidenceVaultService`, mirroring the link), relabelled **"Record remediation on behalf of owner"**, and role-gated: the in-app button shows for `ANALYST`/`TENANT_ADMIN` (the link button for `ANALYST`/`CCO`/`TENANT_ADMIN`). It sets `remediation_submitted_by_user_id`, so the recording analyst still cannot sign it off (self-review SoD is unchanged). **Any** ANALYST/CCO/TENANT_ADMIN reviewer may approve an owner-link submission (the owner has no login, so the guard does not fire). `SubmitRemediationRequest` DTO retired.
- **Schema — in-place edits, no new migration:** `findings.remediation_submitted_via_link BOOLEAN NOT NULL DEFAULT FALSE` added to `V5__create_findings.sql`; `remediation_submitted_by_owner_id INT REFERENCES owners(owner_id)` + `idx_findings_remediation_owner` added to the findings block of `V23__add_assignment_owner_columns.sql` (owners exists by V22). Editing applied migrations changes their Flyway checksums → the tenant DB must be dropped/recreated (normal flow). `FindingDetailResponse` exposes both fields; the Findings detail shows a "Submitted by <owner> (via link)" row.

### Controls testing, person picker & returns upload link (tenant) — `feature/controls-testing`
- **Controls register columns** (`pages/ControlsPage.jsx`): now Control · Due Date · Has Finding · Test Frequency · Owner (Risk and Next Test Due columns dropped). "Due Date" shows the scheduled next-test date (from the pending `control_tasks` row) — the entity's own `controls.due_date` is never populated by the seed, so it is NOT used. Detail headline tile renamed Next Test Due → Due Date; the always-empty "Due Date" field in the Act/Regulation panel was removed.
- **Owner is a control concept** (tenant obligations): removed the obligation **Owner filter** (`ObligationsRegisterPage`) and the obligation detail **Assign Owner** button + `OwnerModal` (`ObligationDetailPage`). Owner selection stays on controls/findings. Backend obligation-owner fields were left in place (UI-only removal); `components/modals/OwnerModal.jsx` is now unreferenced.
- **Obligation → controls** (`ControlsPage`, `ObligationDetailPage`): a searchable **Linked Obligation** filter (typeahead over `GET /obligations/register?q=`) stores the choice in `?obligationId=` with a removable chip; obligation detail has a **View controls** button → `/controls?obligationId=<id>`. Backend `GET /controls/register?obligationId=` + `ControlSpecification` jsonb_contains already supported this.
- **PersonPicker** (`components/common/PersonPicker.jsx`) — one searchable person picker, three modes: `user` (LDAP directory pick, or local search + invite-by-email; used by onboarding CCO/Analyst), `owner` (compliance owners + inline create), `link` (email for tokenised links). `components/org/OwnerPicker.jsx` is now a thin wrapper over `PersonPicker mode="owner"`, so all existing call sites became searchable with no edits. New backend reads: `GET /users?q=` (also widened to ANALYST), `GET /ldap/users?q=` (uses saved settings), `POST /onboarding/ldap/users?q=` (searches a candidate, not-yet-saved config). `LdapAuthService.searchUsers(settings,q)` searches the login attribute and the full-name attribute and merges by DN.
- **Onboarding roles** (`OnboardingPage.jsx`): CCO/Analyst are chosen with `PersonPicker` (directory pick on LDAP; email+name + invite on local) plus a read-only **role confirmation** recap that warns when both are the same person. This addresses the earlier swapped-email incident — the picker shows name + email and the summary makes a swap visible.
- **Control `howTested` duplicate** (`RegulationSeedService`, `SeedControlRepairService`): the seed no longer copies the single toolkit control text into `howTested` (it still sets `name`/`description`). The idempotent repair clears `howTested` only where it still equals `description` (analyst-authored text is kept) and logs `howTested cleared=`. Verified live: 1032 cleared, 0 duplicates remain.
- **Permissions** (`OrgController`, `UserController`): `POST /org/owners` and `POST /users/invite` now allow `TENANT_ADMIN, CCO, ANALYST` (was TENANT_ADMIN only). Departments/teams stay TENANT_ADMIN.
- **Relative remediation link** (`RemediationLinkService`/`Controller`, `FindingsPage`): the API returns `path` (`/remediate/{token}`) and the client composes it with `window.location.origin`; emails still use the configured `atheris.email.base-url`.
- **Returns public event-filing upload** (tenant V43 `return_upload_links`): analysts create a link with `POST /returns/{returnId}/upload-link` (Returns register → "Send link", recipient chosen via `PersonPicker mode="link"`; defaults to the return owner's email). Public, no-login: `GET /api/v1/public/returns/{token}` (view — shows return name, **regulator**, act, frequency, trigger, deadline rule, responsibility) and multipart `POST /api/v1/public/returns/{token}` → records the event filing through `ReturnEventService.recordUploaded`/`record` with a null user. FE page `pages/PublicReturnUploadPage.jsx` at `/return-upload/:token`. `/api/v1/public/**` is already permitAll and skipped by `LicenseFilter`.
- **Verify (done):** tenant backend compiles + `SeedControlRepairServiceTest` green; tenant FE `vite build` green; backend restarted → Flyway applied **V43** cleanly; `/ldap/users` 401, `/users?q=` 401, `/onboarding/ldap/users` 200, `/public/returns/{token}` 404 with our message (public), `/returns/{id}/upload-link` 401; LDAP search returns name+email (all 4 directory users).

### Default org structure + expanded LDAP directory (tenant) — `feature/controls-testing`
- **Org seed on onboarding confirm** — new `modules/org/service/DefaultOrgSeedService.seedDefaults()` is called inside `OnboardingService.confirm(...)`. It creates a curated department+team template (Compliance, Risk Management, Information Technology, Operations, Finance & Treasury, Internal Audit, Legal & Company Secretariat, Human Resources; IT carries Core Banking / Database Administration / Networking / System Administration / IT Security). Idempotent **per name**: an existing department (or team) is reused untouched and only the missing template entries are created. This is now the **single source** of the default org — the stray `Compliance`/`COMP` department that `V22__create_org.sql` used to insert was removed (it also defeated the old "skip if any department exists" guard, so the tree never appeared). Departments have no heads and teams no owners — people are added later in Settings or the person picker. Names mirror the return `responsible_unit` vocabulary so seeded returns map onto real units.
- **LDAP directory expanded to 14** (`devenv/ldif/atheris.ldif`, recreate the volume to apply): added 10 **directory-only** identities — `itsecurity@`, `dba@`, `network@`, `sysadmin@`, `corebanking@` (IT), `aml@`, `regreporting@` (Compliance), `ops@`, `treasury@`, `internalaudit@`. These are **not** tenant app accounts (no `users` row, no role) — they exist so onboarding's CCO/Analyst picker and SoD tests have more choices. **LDAP login does not auto-provision a `users` row**, so a directory user can only sign in once a `users` row exists. `POST /users/invite` on an LDAP tenant now creates the user **active** (directory owns the password), matching onboarding; on a local tenant it still issues a pending invite token. The Settings → Users **Invite User** dialog uses `PersonPicker mode="user"` (directory pick on LDAP) so the invited email must be a real directory entry. Flat `ou=people` kept so the onboarded search base is unchanged.
- **Fresh-DB reset verified:** dropped/recreated `atheris_intel` + `atheris_tenant` (`WITH (FORCE)`), recreated the LDAP volume, restarted both backends. Intel → Flyway V17 + `ToolkitStartupSeeder` (394 instr / 1535 obligations / 351 sanctions / 139 returns / 2137 controls) + `RunbookTemplateStartupSeeder` (12); tenant → Flyway v43 + `RunbookFrameworkSeeder` (34/243). `POST /onboarding/ldap/users` returns all 14 directory users with human names.

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

**Analyst Task Center ("Tasks" page, tenant `:5174` `/tasks`)** — implemented (Returns + Controls + Findings + Obligations). Design in **`Atheris_Analyst_Task_Center_Design.md`** (root). A derived, read-only work queue over existing repos — **no migration / no new table / no DB drop**. Tenant backend `modules/tasks` (`TaskCenterService` fans out to the returns/controls/findings/obligations repos; `GET /api/v1/tasks/center` + `/tasks/center/stats`, both take `assignee=me|all`, `category`, `priority`, `q`); `TaskItemDto` carries `category`, `regulator`, `responsiblePerson`, `dueDate`/`daysRemaining`, `actionType ∈ {START, SUBMIT, OPEN, ASSIGN}` (the only inline action is **Start filing**; everything else deep-links). FE `src/pages/TasksPage.jsx` (TanStack) — `SectionTabs` **Controls · Returns · Findings · Obligations** (tab counts from `stats.byCategory`), `My work / Whole organisation` toggle (**defaults to Whole organisation for every role**, incl. analyst), 5 KPIs, `FilterBar`, columns **Task · Due date · Regulator · Responsible person · Actions** (due date shows the ISO date first with the relative in parentheses, e.g. `2026-10-25 (3 days)`). Sidebar `Tasks` item with a live badge from `api.tasks.centerStats()` (**"my work"**, 60 s poll).
- **Category taxonomies** (per the design doc §5/§11): Returns → `RETURN_OVERDUE`/`ESCALATED`/`START_READY`/`DUE_SOON` + the two review gates `RETURN_DATA_REVIEW` (analyst reviews the responsible person's data at **Data Gathering**) and `RETURN_REPORT_REVIEW` (CCO reviews the drafted report at **Review**), each HIGH (**the `RETURN_DUE_DATE_NEEDED` and `RETURN_NO_RESPONSIBLE_PERSON` gap rows and the old `RETURN_SUBMIT_READY`/`SIGN_OFF` were dropped** — the tab holds only real filing tasks/decisions). Controls → `CONTROL_TEST_OVERDUE`/`CONTROL_TEST_DUE` (`control_tasks` Pending/In Progress/Overdue, due ≤ +30 d; 319 on the seeded tenant — the inflated seed cadence is a known follow-up), `CONTROL_TEST_AWAITING_REVIEW` (`review_status=Pending`), `CONTROL_TEST_FAILED` (latest result Failed/Partial). Findings → `FINDING_OVERDUE`/`AWAITING_REVIEW`/`GAP_UNRESOLVED`/`UNASSIGNED`/`DUE_SOON`. Obligations → `OBLIGATION_NO_CONTROL` (applicable classifications with empty `linkedControlIds`; 0 on the seeded tenant). Empty categories render an empty state.
- **Return owner persistence fix:** `ReturnService.doCreate` now resolves a missing `returnOwnerUserId` from the owner email/name via `UserRepository` (the create dialog can submit a free-typed owner name with no user id, which silently broke the "My work" count/assignment). `UserRepository.findFirstByFullNameIgnoreCase` added.
- **Escalation recipient fix (LDAP + owner-CC):** `ReturnsEscalationHandler` now resolves responsible persons against the **LDAP directory** as well as local users/owners (`LdapAuthService.searchUsers("")` merged into the directory map), and it **no longer appends the owner** into the assignees list — the owner is passed separately and **CC'd**. Before this, an LDAP responsible person never resolved and the owner wrongly became the **To** recipient. (Control targets were already user-based.)
- **Settings visibility:** Settings → **Email / SMTP**, **Notifications** (escalation policies) and **Email Templates** are now shown for every role (analyst included), not just TENANT_ADMIN/CCO; `GET/PUT/POST /settings/smtp` and `PUT /settings/notification-templates/{key}` accept `ANALYST`. (Per the analyst-first rule.) Templates were split out of Notifications into their own tab (`components/settings/TemplatesTab.jsx`; NotificationsTab is policy-only). `SmtpSettingsForm`'s `load` prop now tolerates a plain value (`Promise.resolve(...)`) and loads once on mount (the Settings caller passes `() => query.data`, which previously threw `load(...).then is not a function`).
- **Email link base URL:** every email link (returns *and* controls) is `EmailService.baseUrl()` = `atheris.email.base-url` ← env **`BASE_URL`** (was the `https://app.atheris.com` placeholder; set to `http://localhost:5174` locally). There is no separate "dynamic" path for controls.
- **Known:** the Controls "Regulator" column shows the control's `act_name` (the seed act name, not an abbreviation); the Controls tab is volume-heavy on the seeded tenant; the sidebar badge counts "my work" (matches the analyst's own filings) while the page defaults to org-wide.

**Known follow-ups**
- **Returns (this round):** the four review emails, the CCO badge and the draft upload still need a browser pass; a filing whose due date is already today/past is notified only by the **OVERDUE** rung (APPROACHING needs `now < due`), so for DAILY returns the first mail is the L1 overdue one; escalation links are neither revoked nor single-use (30-day valid, submission is state-gated instead).
- **~50 seeded returns show "Due date needed"** — their platform wording has no deadline ("Annually", "Quarterly", "As specified by CBN"); a CCO/admin must set each via Edit schedule. A bulk "set due dates" screen would speed this up.
- Seeded return frequency labels can be lossy copies of the platform text (e.g. LCR shows "Quarterly" but correctly runs MONTHLY from the platform's full wording).
- FindingsPage has 7 table columns (rule: max 5) and still uses raw useState/useEffect (no TanStack Query); default status filter 'Open' hides imported Remediated/Closed findings until the filter is changed.
- "New Control" form still writes only the control side of obligation links (import writes both).
- `ObligationService.createObligation`/`updateObligation` check `obligationRepo.existsById(instrumentId)` — the wrong repository (no local instrument table).
- Intel frontend `api.js:244` still treats 403 as session expiry (the tenant was fixed — see below); check the intel `SecurityConfig` entry point too.
- `PlatformApiClient` swallows platform failures, so "platform down" surfaces as 404 instead of 502.
- `changePassword` does not apply the password-strength rule that invite/reset use.
- Seeded **control** risk (`compliance_controls.risk_level`, tenant `controls.inherent_risk`/`residual_risk`) still carries the old inflated toolkit band and drives test frequency (1835 tests due in 30 days) — being fixed in its own session.
- **Escalation**: no per-control policy override UI (column exists, entity field does not); no manual "Send link" for periodic returns; `PersonPicker` owner-mode still creates owners on directory pick.
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

### Done — Runbook Template Library UX (tenant `/runbooks/templates`)
- **Analyst can adopt.** `POST /runbooks/templates/{code}/adopt` moved from `RunbookRoles.APPROVERS` to `AUTHORS` (ANALYST/CCO/TENANT_ADMIN) — adopting only creates a DRAFT; publish approval stays with CCO/Tenant Admin. `CreateRunbookDialog` and `TemplateLibraryPage`/`TemplateDetailPage` gates updated to `AUTHOR_ROLES`.
- **Table columns** are now Template (title only, no code chip) · Category · Area of focus · Criticality · Status. Area of focus is derived from `category` via `AREA_OF_FOCUS`/`areaOfFocus(category)` in `runbookConstants.js` (no new backend field).
- **Row click opens a detail page**, not the drawer: new `TemplateDetailPage.jsx` at `/runbooks/templates/:code` with tabs Overview · Steps · Prerequisites · Escalation & Rollback · Framework Mapping (read-only; reuses `DetailVersionView` `StepsView`/`PrerequisitesView`/`EscalationRollbackView` and `AdoptTemplateDialog`). The old drawer + `TemplatePreview` were removed from `TemplateLibraryPage`.

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

Four slices (`GET /api/v1/admin/<entity>` + `/stats` + `/{id}`, `PLATFORM_ADMIN`) each with an explorer + detail page (pattern: `AdminRegulationController` / `RegulationExplorerPage`).
- **Act FK / section field differ per module** — `ObligationMapping` (`regulationId`→`act_id`, section **`specificSectionReference`**, actName batch-resolved), `SanctionsPenalty` (`regulationId`, `sourceSectionReference`), `RegulatoryReturn` (`actId`, `sectionReference`), `ComplianceControl` (`actId`, actName denormalised on the row). Tenant obligation DTOs use `sectionReference`, so intel's `specificSectionReference` is a genuine porting trap.
- **Never sort a service-resolved field** — `actName` is resolved in the service on `ObligationMapping`/`SanctionsPenalty`/`RegulatoryReturn`, so `sort=actName` throws `PropertyReferenceException`; sort on `regulationId`/`actId` instead (`ComplianceControl.actName` IS a column). Act names resolved via one `findAllById` per page (no N+1); obligation stats aggregate in SQL.
- **Intel has NO TanStack Query** (no dependency, no `QueryClientProvider`) — intel explorers use raw `useState`/`useCallback`/`useEffect` with race guards; do not add TanStack as a side effect. Known lint debt is pre-existing: the raw fetch-in-effect idiom trips `react-hooks/set-state-in-effect` (~3 errors per page; ~316 across the intel app), no suppressions, and the tenant frontend has no eslint config.
## Done — Returns Register/Details Harmonized (incl. backend linkage)

`GET /returns/{returnId}/obligations` enriched to `LinkedObligationItem` (rows lazily fetch on expand); `overcomeCount` → `overdueCount`. Known: `ReturnService.getRegister` ignores `Pageable` sort.
## Done — Controls Register/Details Harmonized

`ControlsPage.jsx` shows `actName`/`actId`, linked obligations navigate to `/obligations/{obligationId}`, columns trimmed 9 → 5; `api.controls.*` takes no `opts` (no abort signal).

## Done — Instruments / Obligations / Sanctions Harmonized

Pages render DTO enrichment they previously ignored (verbatim vs interpreted text, section/area/type/deadline chips, act linkage, expandable sanction panels). Fixed the Instruments drawer reading non-existent `obl.section`/`obl.type`/`s.type`, a one-page pagination cap, and the shadowed `hasGap` filter. **Traps:** `InstrumentDetailResponse.SanctionItem.amountNaira` vs `sanctionAmountNaira` elsewhere; by-id detail query keys must be `['x', String(id)]`; concurrent builds must not share `dist/`.

## Done — Review Inbox Harmonized (enriched obligation summary)

`ReviewInboxPage` mirrors `ReviewEditPage`: expandable rows lazily `GET /review/{reviewId}` (no N+1 on load, `staleTime 5m`), read-only enriched obligation table; list/stats/skip on TanStack with `keepPreviousData`; outer table trimmed to 5 data columns (source folded into the Document cell). Shared detail cache key must be stringified: `['review', String(reviewId)]`.
## Done — Dashboard V2 (Rendition Tracker + Control Coverage)

`DashboardV2Page` (Rendition + Control Coverage tabs, `RiskHeatmap`) via `DashboardV2Controller`/`DashboardV2Service` (`/dashboard/v2/{rendition-grid,escalation-matrix,risk-heatmap,control-coverage,returns-by-period,risk-profile,thresholds}`) and `risk_matrix_config` (V28); scoring Impact(1–5)×Likelihood(1–5), bands Low/Moderate≥6/High≥12/Critical≥18. The live tenant `/dashboard` is `CcoDashboardPage` (aliased as `DashboardPage`). **Grep the import PATH, not the identifier.**

## Done — Pipeline Stage Breakdown

`GET /platform/regulators/{id}/pipeline-stats` (discovered/downloaded/extracted/classified + drill-downs), RegulatorDetailPage stage cards, Dashboard Pipeline Health banner, regulator table Discovered/Downloaded/Failed columns. Pushed at `5787d9f` (merge of `99008da`).

## Done — Tenant Backend Aligned as Submodule

Standalone tenant service copied in as Maven submodule `atheris-compliance-tenant-backend` (port 9091, DB `atheris_tenant`, schema `tenant`, migrations under `db/migration/tenant/`); modules: auth, users, onboarding, subscriptions, obligations, controls, findings, returns, notifications, dashboard, audit (hash chain). Run commands are in "How to Run" above.

## Done — Tenant Frontend Portal Built

Tenant portal `:5174`; polls via `ObligationSyncService` (no webhooks); uploads → platform `/internal/instruments/ingest` (SHA-256 dedup); onboarding/license calls target `:9091`. E2E: `ATERHIS_ONBOARDING_E2E_TESTING.md`.

## Done — Tenant Obligations Register Rebuilt (Per-Obligation)

`ObligationService.getRegisterList()` now pages the `obligations` table (one row per obligation, in-memory filter/sort) instead of `ObligationClassification`; added `GET /obligations/stats`, `GET /obligations/obligation/{id}`, `PUT /obligations/obligation/{id}/returns`, `GET /returns/list`; Flyway V20 `obligation_returns`. Theme filter maps to `obligation_type`; "Under Review" KPI = not yet `applicable`. CCO approval excluded.

## Done — Per-Obligation Review Workflow (Edit & Save gate)

**NO document reaches the Obligations Register without a human "Edit & Save"; instruments carry no classification — it lives per obligation** (`obligation_classifications.obligation_id UNIQUE`). Flow: upload/sync → `pending_reviews` (V21) → `/review` → `/review/edit/:id` → save (deletes + recreates obligations & classifications by `instrument_id`) → `/instruments`. Register classify calls use `selected.obligationId`, not `instrumentId`. **`published_at` is never populated — use `dateIssued`.**

## Done — Returns Module Enhancements (enums, regulator FK, lazy instances + escalation, bidirectional obligation linking)

**No scheduler:** filing instances materialize idempotently on read/after `create()` (`ensureInstances`, frequency-aware, `UNIQUE(return_id, period)`); enums via `@Converter(autoApply=true)` keep display strings; `regulatory_returns.tenant_regulator_id` FK (+ name snapshot); return↔obligation linking via `GET/PUT /returns/{returnId}/obligations`. The lazy escalation ladder it introduced was **replaced by the escalation engine above**. **flyway-maven-plugin needs the fully-qualified goal** (`org.flywaydb:flyway-maven-plugin:10.12.0:repair`) — not in the module pom.

## Done — Configurable License Seed & Toolkit Regulator Fix

License flags `autoSubscribeRegulators`/`autoSeedObligations` (intel V12 + tenant V28, default false) drive onboarding; toolkit seeds go straight to the Register (Inbox 0 is expected). Toolkit regulator inference chain took null-regulator instruments 29→0; Review-Inbox sync uses `coalesce(publishedAt, dateIssued)`.

## Done — Classifier/Toolkit Harmonization (verbatim + plain, atomic obligations)

One register row = one enforceable duty for both `toolkit_seed` and `ai_extracted`: atomic prompt (one "shall" = one obligation), verbatim `description` (≤500) vs interpreted `statement` (≤250), risk/likelihood/impact/controlOwner/sanctions/act_name + 12 unified areas; `ObligationMapping` gains `description`/`title`/risk/owner/`act_id` (intel V3 edited); seeder order `AdminUserSeeder @Order(0)` → `ToolkitStartupSeeder @Order(1)`.

## Done — Toolkit Seed via Committed JSON (no LLM points)

The toolkit markdown is converted once, offline, to a committed typed JSON (`tools/toolkit-md-points/export_json.py` → `compliance_toolkits.json`, ~4.8 MB; `verify_json.py` parity 1541/597/139/363/192) and read at startup by `ToolkitImportService` (rewritten over typed DTOs, `ToolkitImportResult` added) — **no LLM calls at seed time**. `PointsRetryScheduler`/`BatchPointsResponse`/`atheris.points.*` deleted. Datasource creds come only from `DB_USERNAME`/`DB_PASSWORD` (no fallbacks in `application.yml`; compile with GraalVM 21 — default JDK 27 breaks Lombok).



## Done — Return filing review workflow (5 stages, two gates) — `feature/findings-action-ux`

A return filing no longer completes on "submit": it runs **Not Started → Data Gathering → Draft → Review → Completed**, with an explicit accept/reject gate at each review. The task only drops when the CCO accepts at Review (→ **Completed**).
- **Model** — `ReturnStage` is now the 5 stages above (removed `SIGN_OFF`/`SUBMITTED`; `ReturnStage.fromDb` maps legacy `"Sign-off"→REVIEW`, `"Submitted"→COMPLETED` so pre-change rows still read). `ReturnFilingStatus` values are unchanged; `SUBMITTED`/`SUBMITTED_LATE` now mean **completed on time / late** (set at CCO accept) and are **relabelled "Completed"/"Completed Late" in the FE**. New columns (tenant **V47** sign-off leftovers + **V48** review) on `return_filing_instances`: `pending_review`, `review_evidence_ref`, `review_submitted_at/by_name/by_email/by_user_id`, `reviewed_at`, `reviewed_by_user_id`, `review_decision`, `review_notes`, `completed_at`. (V47 was accidentally applied with the sign-off columns before renaming, so V47 keeps that content and the review columns live in V48 — do not renumber.)
- **Flow / endpoints** — Data Gathering: the responsible person submits the filing data via the public link (`ReturnUploadLinkService.submitFiling → ReturnService.submitFromLink`, which now sets the review fields + `pending_review` instead of completing; auto-starts NOT_STARTED→DATA_GATHERING; only allowed at Data Gathering). `PUT /returns/instances/{id}/data-review` (`ANALYST/CCO/TENANT_ADMIN`) `{decision: ACCEPT|REJECT, notes}` → ACCEPT advances to **Draft**; REJECT clears the submission and **re-emails a filing link** (new token — the stored token is hashed, so the exact URL can't be reused). Draft → **Review** via the normal `advance` (sets `pending_review`, notifies the CCO). `PUT /returns/instances/{id}/review` (**CCO/TENANT_ADMIN**) → ACCEPT completes (stage COMPLETED, status SUBMITTED/SUBMITTED_LATE by due date, `completed_at`); REJECT = `CHANGES_REQUESTED` → back to **Draft** (notifies ANALYST). The old `PUT /instances/{id}/submit` is gone; `advanceStage` blocks Data-Gathering→Draft and Review→Completed (must go through review).
- **Tasks** — my mapper emits `RETURN_DATA_REVIEW` (stage Data Gathering + pendingReview, owner = the analyst) and `RETURN_REPORT_REVIEW` (stage Review + pendingReview, org-wide) at HIGH; `completedLast7d` now counts `completed_at` (repo `countByStatusInAndCompletedAtGreaterThanEqual`). **FE** `ReturnsDetailPage`: 5-step horizontal stepper; stage-aware actions (Start filing / review panel with evidence + Accept/Reject / Submit report to CCO / Complete banner); `api.returns.dataReview` + `api.returns.review`; `SubmitDialog` removed.
- **Verify (done):** tenant compiles + FE builds; tenant booted with V48; `fromDb` legacy mapping OK; tasks RETURNS, register, detail, stats all 200; `/data-review` on a non-pending filing → 409; `/review` as ANALYST → 403. Boundary: pre-change "Submitted" filings read as Completed (no gate history), so they don't appear as review tasks.

## Done — Escalation reminder semantics, per-return policy pinning & filing-policy repair — `feature/findings-action-ux`

The pre-due window, the recipient of the overdue link and the filing↔policy binding were all wrong; testers saw "Remind before" do nothing, no email for un-started filings, and an overdue email pointing at the internal page.
- **The pre-due window is the policy lead only** — `EscalationEngine.approachAt` now prefers the policy's `reminderStartValue` and falls back to the candidate's `approachAt` (prep start date) only when the policy has no lead. Previously the returns handler's `prepStartDate` (always set, `due − filingDeadlineOffsetDays`, default 5) shadowed the policy, so "Remind before" was dead on every return.
- **Reminders now reach un-started filings** — the gate is `candidate.started() || handler.remindUnstarted()` (`EscalationSubjectHandler.remindUnstarted`, returns → true, controls → false). Before, an un-started filing could never be reminded (chicken-and-egg: the Gathering trigger needs `stage == DATA_GATHERING`), so the first email anyone got was the overdue escalation. Daily returns with the old `0 days` lead could never remind at all (window `[dueAt, dueAt)`).
- **First repeat no longer duplicates the approaching email** — `reminderIfDue` bases the first repeat on the **approaching** fire time (else the window start), so the two never land in the same tick.
- **Overdue emails carry the upload link** — the OVERDUE levels passed `includePublicLink = false` (hard-coded); they now honour the policy's `sendLink`, so the filing link is minted (`/return-upload/{token}`) instead of the internal `/returns/{id}`.
- **Filings are pinned to the right policy** — `ensureFrozen(..., frequencyScope)` falls back to the **frequency** default, not the catch-all; a return's policy edit **re-pins its untouched filings** (`refreshUntouchedFrozen`, matched against the source policy so per-filing overrides survive) on `updateEscalation`/`updateEscalationPolicy`. `ReturnEscalationRepairService` (`@Order(21)`) re-pins pre-existing rows once at startup — on the dev tenant it logged 241 (121 → the return's policy, 120 → the other's). Before this, **every** filing was frozen against the 10 d catch-all, ignoring both the return's policy and the frequency default.
- **Latent crash fixed** — `policyLevels.deleteByPolicyId` / `instanceLevels.deleteByOverrideId` are *derived* deletes, so Hibernate flushed the new levels **before** the deletes and hit `uq_escalation_instance_level`; both now `flush()` right after the delete (this also broke the existing `POST /escalation/instances/{type}/{id}/reapply` for any instance that already had levels).
- **A filing awaiting review stops chasing the submitter** — `ReturnsEscalationHandler.findCandidates` skips `pendingReview` filings (the review chase lives in the Tasks page).
- **Seeded defaults repaired in place** — DAILY is now `Remind before 12 HOURS / repeat 12 HOURS` (was the dead `0 / 1 day`), every RETURN default has `notify_on_start = true` (the "please prepare, here's the link" Gathering email — the Tasks "Start" snackbar promised it, nothing sent it), and `EscalationDefaultSeeder` + `refreshSeededDefault` upgrade an existing default **only where it is still exactly as seeded** (user edits are never touched). Per-return policies built by the Create Return dialog also set `notifyOnStart(true)`.
- **Negatives rejected** — `EscalationPolicyService.validate` 400s on `reminderStartValue < 0`, `reminderRepeatValue < 0` and level `afterValue < 0` (`invalid_reminder_start`/`invalid_reminder_repeat`/`invalid_level_offset`); a negative lead inverts the window and silently kills reminders. FE number inputs carry `min: 0` everywhere (Create Return, Settings → Notifications, per-filing override) and the dialog hints when `0` = "no advance reminder is sent".
- **Create Return UI** — the escalation accordion is now two rows of `Escalate to · Level N · Unit`: **Escalate to** is a searchable **person** picker (LDAP/local; empty → level 1 the responsible person's manager, level 2 the CCO), **Level 2** only appears after **"+ Add another level"** (optional). `UpdateReturnEscalationRequest` now carries a `levels` list (`targetType`/`afterValue`/`afterUnit`) instead of `level1/2/3…` fields; `buildEscalationLevels` normalises `CCO` → `ROLE + AppRole.CCO`. **Creating a return no longer requires an act** (`CreateReturnRequest.actId` dropped `@NotNull`) — an act **or** linked obligations suffices (`linkObligations` backfills the act from the first linked obligation). Removed the "People" section label and the ladder caption.
- **Verify (live, dev tenant):** DAILY default + all RETURN defaults read `12 HOURS/12 HOURS` + `notify_on_start = t`; the repair logged `re-pinned 121 … policy 10` / `120 … policy 11`; DB spot-check shows each filing mirroring its return (`instance 122 → policy 11: 1 DAY, L1 Chioma Okafor +1 HOUR`; `instance 1 → policy 10: -18 DAYS, L1 Halima Sani +2 HOURS`); the next tick fired the first pre-due reminders for un-started filings (ledger `APPROACHING`/`REMINDER` for the two returns) after which the corrected windows stop the burst. **Known:** the dev tenant's ~6 wrongly-early approaching events are already in the fired-once ledger (drop/recreate for a clean run), and return 1's policy #10 still holds the pre-guard `-18` (edit it in Settings → Notifications).

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
- NEVER add comments to backend Java code — no line comments, no block/multiline comments, no Javadoc. New backend code must be self-explanatory.
- always try to use jpa query methods where possible
- for filtering and searching, use jpa criteria unless otherwise
- avoid using jpql no matter what, when necessary use native query after prompting me for approval
- avoid n+1 queries
- use `@Builder.Default` on all initialized entity/DTO fields
- all `@Transactional` catch blocks must call `setRollbackOnly()`
- catch `Throwable` (not `Exception`) in processor/scheduler code
- use `em.clear()` in catch blocks to prevent Hibernate stale-state issues
- frontend must use TanStack Query (`@tanstack/react-query`) for ALL data fetching — never raw `useEffect` + `fetch`/`.then()`. This applies **everywhere**, not just routed pages: modals, dialogs and pickers (e.g. `LinkControlsPicker`, `ReturnPicker`, `PersonPicker`, `EntityPicker`) must read via `useQuery` (`enabled` on open, a stable `queryKey`) and invalidate via `useQueryClient` after a create/edit — never `.then()` inside a `useEffect`. `useEffect` is only for local UI state (resetting selection/fields on open), never for loading data.
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
- the ANALYST is the primary user of the tenant system — NEVER restrict, hide or gate an analyst-facing view without informing the user first; default org-wide/aggregate views to visible for every role (e.g. the Tasks Center defaults to "Whole organisation" for analysts too, with "My work" as an explicit toggle)
