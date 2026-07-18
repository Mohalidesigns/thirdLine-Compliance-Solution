# Atheris Compliance Platform — Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DNS / Load Balancer                          │
└──────────┬──────────────────────────────────────┬───────────────────┘
           │                                      │
     ┌─────▼──────────────┐             ┌─────────▼──────────┐
     │  Intelligence FE   │             │    Tenant FE       │
     │  (Vite 8, React 19)│             │  (Vite 8, React 19)│
     │  :5173             │             │  :5174             │
     └──────┬─────────────┘             └──────────┬──────────┘
            │ proxy /api/v1/*                      │ proxy /api/v1/*
            │ to :9090                             │ to :9091
     ┌──────▼──────────────────────────────────────▼──────────────────┐
     │                  npm Workspace (shared/)                        │
     └────────────────────────────────────────────────────────────────┘
            │                                      │
     ┌──────▼──────────────┐             ┌─────────▼──────────┐
     │  Intelligence BE    │             │   Tenant BE        │
     │  Spring Boot 3.2    │◄────HTTP────►   Spring Boot 3.2  │
     │  :9090              │   webhooks   │  :9091             │
     └──────┬──────────────┘             └─────────┬──────────┘
            │                                      │
     ┌──────▼──────────────┐             ┌─────────▼──────────┐
     │  PostgreSQL         │             │  PostgreSQL         │
     │  atheris_platform   │             │  atheris_tenant     │
     │  (Flyway migrations)│             │  (Flyway migrations)│
     └─────────────────────┘             └─────────────────────┘
```

---

## Component Descriptions

### 1. Intelligence Frontend (`:5173`)
Admin-facing SPA for platform operators. Dashboard, pipeline management, regulator configuration, tenant administration, license management.

### 2. Tenant Frontend (`:5174`)
Tenant-facing SPA for regulated entities. Onboarding wizard, obligation classification, control testing, findings management, regulatory returns filing.

### 3. Intelligence Backend (`:9090`)
Central platform service. Scrapers, OCR pipeline, AI classification, webhook dispatch, job queue, tenant/regulator/license CRUD.

### 4. Tenant Backend (`:9091`)
Per-tenant compliance management service. Auth, onboarding, obligations, controls, findings, returns, dashboards, audit logging.

---

## Database Design

```
┌─────────────────────────────────────┐   ┌─────────────────────────────────────┐
│         atheris_platform            │   │         atheris_tenant              │
│                                     │   │                                     │
│  regulators           ──────────────┼───┼─── subscription/tenant_profile     │
│  instruments          ──────────────┼───┼─── obligation_classifications       │
│  obligations/sanctions              │   │   controls/control_tasks           │
│  job_queue                          │   │   findings                         │
│  tenants               ────────────┼───┼─── users (tenant-scoped)            │
│  pending_downloads                  │   │   regulatory_returns               │
│  licenses                           │   │   audit_events                     │
│  users (platform admin)             │   │   dashboard_snapshots              │
│  webhook_delivery_log               │   │   notifications                    │
│  platform_audit_log                 │   │   refresh_tokens / invite_tokens   │
└─────────────────────────────────────┘   └─────────────────────────────────────┘
```

---

## API Endpoints Map

### Intelligence Backend — Public / Auth

```
POST   /api/v1/auth/login                         Login
POST   /api/v1/auth/refresh                       Refresh token
GET    /api/v1/auth/me                            Current user profile
```

### Intelligence Backend — Intelligence (authenticated)

```
GET    /api/v1/intelligence/obligations            Library search (q, regulatorId, riskRating)
GET    /api/v1/intelligence/obligations/{id}       Obligation detail
GET    /api/v1/intelligence/obligations/{id}/pdf   Stream PDF
GET    /api/v1/intelligence/obligations/export     Export library (CSV/XLSX)
GET    /api/v1/intelligence/inbox                  Inbox items (?status=)
POST   /api/v1/intelligence/obligations/{id}/classify    Classify obligation
PUT    /api/v1/intelligence/obligations/{id}/classify    Update classification
GET    /api/v1/intelligence/obligations/{id}/classification  Get classification
GET    /api/v1/intelligence/watches                Watched instruments
DELETE /api/v1/intelligence/watches/{instrumentId} Remove watch
PUT    /api/v1/intelligence/watches/{instrumentId}/preferences  Update watch prefs
```

### Intelligence Backend — Platform Admin

```
── Regulators ──
GET    /api/v1/platform/regulators                 List (?activeOnly, search)
GET    /api/v1/platform/regulators/{id}            Detail
POST   /api/v1/platform/regulators                 Create
PUT    /api/v1/platform/regulators/{id}            Update
DELETE /api/v1/platform/regulators/{id}            Deactivate
POST   /api/v1/platform/regulators/{id}/test-scraper       Test scraper (?dryRun)
GET    /api/v1/platform/regulators/{id}/scraper-history     Run history
GET    /api/v1/platform/regulators/{id}/pipeline-stats      Stage breakdown

── Tenants ──
GET    /api/v1/platform/tenants                    List
GET    /api/v1/platform/tenants/{id}               Detail
POST   /api/v1/platform/tenants                    Create
PUT    /api/v1/platform/tenants/{id}               Update
DELETE /api/v1/platform/tenants/{id}               Deactivate
POST   /api/v1/platform/tenants/{id}/rotate-webhook-secret  Rotate secret
POST   /api/v1/platform/tenants/{id}/test-webhook           Test webhook
GET    /api/v1/platform/tenants/{id}/webhook-history        Delivery history
POST   /api/v1/platform/tenants/{id}/webhook-history/{did}/resend  Resend delivery

── Webhooks ──
GET    /api/v1/platform/webhooks/stats             Delivery health
GET    /api/v1/platform/webhooks/failed            Failed deliveries
POST   /api/v1/platform/webhooks/retry/{deliveryId}  Manual retry

── Instruments ──
GET    /api/v1/platform/instruments                List (?regulatorId, riskRating, status)
GET    /api/v1/platform/instruments/{id}           Detail
POST   /api/v1/platform/instruments/upload         Upload PDF
POST   /api/v1/platform/instruments/{id}/classify-now  Trigger classification
POST   /api/v1/platform/instruments/{id}/publish   Publish
PUT    /api/v1/platform/instruments/{id}           Update metadata

── Admin Jobs ──
GET    /api/v1/admin/jobs                          List (?jobType, status, page, size)
GET    /api/v1/admin/jobs/{id}                     Detail (payload + instrument)
GET    /api/v1/admin/jobs/stats                    Aggregate counts
GET    /api/v1/admin/jobs/{id}/pdf                 Presigned PDF URL

── Admin CORS ──
GET    /api/v1/admin/cors                          List
GET    /api/v1/admin/cors/{id}                     Detail
POST   /api/v1/admin/cors                          Create
PUT    /api/v1/admin/cors/{id}                     Update
DELETE /api/v1/admin/cors/{id}                     Delete

── Admin Licenses ──
GET    /api/v1/admin/licenses                      List (?status, tenantId, search)
GET    /api/v1/admin/licenses/{id}                 Detail
POST   /api/v1/admin/licenses                      Create
PUT    /api/v1/admin/licenses/{id}                 Update
POST   /api/v1/admin/licenses/{id}/revoke          Revoke
POST   /api/v1/admin/licenses/{id}/renew           Renew
POST   /api/v1/admin/licenses/validate             Validate key
DELETE /api/v1/admin/licenses/{lid}/devices/{did}  Remove device
GET    /api/v1/admin/licenses/stats                Stats (active/expired/revoked)

── Pending Downloads ──
GET    /api/v1/admin/pending-downloads             List (?status)
GET    /api/v1/admin/pending-downloads/{id}        Detail
POST   /api/v1/admin/pending-downloads/{id}/upload Upload PDF
POST   /api/v1/admin/pending-downloads/{id}/skip   Mark skipped
GET    /api/v1/admin/pending-downloads/stats       Counts by status

── Admin Instruments ──
GET    /api/v1/admin/instruments/{id}/tenant-classifications  Per-tenant breakdown
```

### Tenant Backend — Auth

```
POST   /api/v1/auth/login                          Login
POST   /api/v1/auth/refresh                        Refresh token
POST   /api/v1/auth/logout                         Logout
GET    /api/v1/auth/invite/validate                Validate invite token
POST   /api/v1/auth/invite/accept                  Accept invite
POST   /api/v1/auth/password/reset-request         Request password reset
POST   /api/v1/auth/password/reset                 Reset password
```

### Tenant Backend — Onboarding

```
── Onboarding Wizard ──
GET    /api/v1/onboarding/status                   Current step
POST   /api/v1/onboarding/activate-license         Step 1: Activate license
POST   /api/v1/onboarding/institution              Step 2: Institution details
POST   /api/v1/onboarding/intelligence-mode        Step 3: Intelligence mode
POST   /api/v1/onboarding/user-setup               Step 4: Admin user setup
POST   /api/v1/onboarding/regulators               Step 5: Subscribe regulators
POST   /api/v1/onboarding/document-types           Step 6: Document types
POST   /api/v1/onboarding/confirm                  Step 7: Confirm & complete

── License ──
POST   /api/v1/license/activate                    Activate license
GET    /api/v1/license/status                      License status
POST   /api/v1/license/checkup                     Heartbeat checkup
POST   /api/v1/license/deactivate                  Deactivate
GET    /api/v1/license/audit                       Activation audit log

── Recommendations ──
GET    /api/v1/recommendations                     Regulator recommendations
POST   /api/v1/recommendations                     Create recommendation
PUT    /api/v1/recommendations/{id}                Update
DELETE /api/v1/recommendations/{id}                Delete
```

### Tenant Backend — Core Compliance

```
── Users ──
GET    /api/v1/users/me                            Current profile
PUT    /api/v1/users/me/password                   Change password
GET    /api/v1/users                               List users
POST   /api/v1/users/invite                        Invite user
PUT    /api/v1/users/{id}/role                     Update role
PUT    /api/v1/users/{id}/deactivate               Deactivate
PUT    /api/v1/users/{id}/reactivate               Reactivate

── Subscriptions ──
GET    /api/v1/subscriptions                       Summary
PUT    /api/v1/subscriptions/regulators            Update subscribed regulators
POST   /api/v1/subscriptions/regulators/{id}       Add regulator
DELETE /api/v1/subscriptions/regulators/{id}       Remove regulator
PUT    /api/v1/subscriptions/regulators/{id}/preferences  Per-regulator prefs
DELETE /api/v1/subscriptions/regulators/{id}/preferences  Reset prefs
PUT    /api/v1/subscriptions/document-types        Update doc types
PUT    /api/v1/subscriptions/notifications         Update notification frequency

── Obligations ──
GET    /api/v1/obligations                         List (?applicability, status)
GET    /api/v1/obligations/inbox                   Unclassified items
GET    /api/v1/obligations/gaps                    Compliance gaps
GET    /api/v1/obligations/pending-approval        Pending CCO approval
GET    /api/v1/obligations/{id}                    Detail
POST   /api/v1/obligations/{id}/classify           Classify
PUT    /api/v1/obligations/{id}/classify           Update classification
POST   /api/v1/obligations/{id}/approve            CCO approve
GET    /api/v1/obligations/{id}/history            Classification history

── Controls ──
GET    /api/v1/controls                            List (?theme, ownerId)
GET    /api/v1/controls/high-risk                  High-risk controls
GET    /api/v1/controls/{id}                       Detail
POST   /api/v1/controls                            Create
PUT    /api/v1/controls/{id}                       Update
GET    /api/v1/controls/{id}/tests                 Test history
POST   /api/v1/controls/{id}/tests                 Record test result
PUT    /api/v1/controls/{id}/tests/{tid}/review    Review test
GET    /api/v1/tests/pending-review                Tests pending review
GET    /api/v1/tasks                               User's tasks
GET    /api/v1/tasks/overdue                       Overdue tasks

── Findings ──
GET    /api/v1/findings                            List (?status)
GET    /api/v1/findings/open                       Open findings
GET    /api/v1/findings/overdue                    Overdue findings
GET    /api/v1/findings/{id}                       Detail
POST   /api/v1/findings                            Raise finding
PUT    /api/v1/findings/{id}/assign                Assign for remediation
PUT    /api/v1/findings/{id}/remediate             Submit remediation
PUT    /api/v1/findings/{id}/close                 Close finding

── Returns ──
GET    /api/v1/returns                             List
GET    /api/v1/returns/calendar                    Filing calendar
GET    /api/v1/returns/overdue                     Overdue filings
GET    /api/v1/returns/{id}/instances              Filing instances
PUT    /api/v1/returns/{id}/instances/{iid}/advance  Advance stage
PUT    /api/v1/returns/{id}/instances/{iid}/submit   Submit filing
POST   /api/v1/returns                             Create return

── Notifications ──
GET    /api/v1/notifications                       List (?status)
GET    /api/v1/notifications/count                 Count
GET    /api/v1/notifications/{id}                  Detail
PUT    /api/v1/notifications/{id}/read             Mark read
PUT    /api/v1/notifications/{id}/acknowledge      Acknowledge
PUT    /api/v1/notifications/mark-all-read         Mark all read

── Audit ──
GET    /api/v1/audit                               List events (paginated)
GET    /api/v1/audit/{subjectType}/{subjectId}     Events by subject
GET    /api/v1/audit/verify                        Verify hash chain

── Dashboard ──
GET    /api/v1/dashboard/summary                   Latest snapshot
GET    /api/v1/dashboard/trends                    Trend data
GET    /api/v1/dashboard/attention-items           Alerts & overdue
POST   /api/v1/dashboard/refresh                   Compute fresh snapshot

── Webhook Receiver ──
POST   /api/v1/webhooks/receive                    Receive platform webhook
```

---

## User Flows

### Flow 1: Admin Creates License → Tenant Onboards

```
Platform Admin                    Intelligence BE          Tenant BE               Tenant User
     │                                │                      │                        │
     │  1. POST /auth/login           │                      │                        │
     │  {email, password}             │                      │                        │
     ├───────────────────────────────►│                      │                        │
     │◄───────────────────────────────┤                      │                        │
     │  {accessToken, refreshToken}   │                      │                        │
     │                                │                      │                        │
     │  2. POST /admin/licenses       │                      │                        │
     │  {tenantId, tier, maxUsers}    │                      │                        │
     ├───────────────────────────────►│                      │                        │
     │◄───────────────────────────────┤                      │                        │
     │  {licenseKey: "XXXX-XXXX"}     │                      │                        │
     │                                │                      │                        │
     │  3. Send license key to tenant (out of band)          │                        │
     │                                │                      │                        │
     │                                │                      │  4. POST /license/activate│
     │                                │                      │  {licenseKey, deviceFP}  │
     │                                │◄─────────────────────├────────────────────────│
     │                                │  POST /admin/licenses/validate                 │
     │                                ├──────────────────────►                        │
     │                                │◄──────────────────────┤                        │
     │                                │  {valid: true}        │                        │
     │                                ├──────────────────────►│                        │
     │                                │  Webhook: license_activated                    │
     │                                │◄──────────────────────┤                        │
     │                                │                      │◄────────────────────────│
     │                                │                      │  {valid: true, tier}    │
     │                                │                      │                        │
     │                                │                      │  5. GET /onboarding/status│
     │                                │                      │◄────────────────────────│
     │                                │                      ├────────────────────────►│
     │                                │                      │  {currentStep: 1}       │
     │                                │                      │                        │
     │                                │                      │  6. POST /onboarding/institution│
     │                                │                      │  {legalName, licenceType, ...}│
     │                                │                      │◄────────────────────────│
     │                                │                      ├────────────────────────►│
     │                                │                      │                        │
     │                                │                      │  7. POST /onboarding/user-setup│
     │                                │                      │  {email, password, name}│
     │                                │                      │◄────────────────────────│
     │                                │                      ├────────────────────────►│
     │                                │                      │                        │
     │                                │                      │  8. POST /onboarding/confirm│
     │                                │                      │◄────────────────────────│
     │                                │                      ├────────────────────────►│
     │                                │                      │  {status: "complete"}   │
     │                                │                      │                        │
```

### Flow 2: Document Pipeline

```
                   ┌──────────┐    ┌─────────┐    ┌──────────┐    ┌───────────┐
                   │ Scraper  │    │   OCR   │    │Classifier│    │Applicability│
                   │ (15 min) │    │ (2 min) │    │ (5 min)  │    │  (5 min)    │
                   └────┬─────┘    └────┬────┘    └────┬─────┘    └─────┬───────┘
                        │               │              │                │
  ┌──────────┐          │               │              │                │
  │ Regulator│          │               │              │                │
  │ CBN, SEC │──────────►               │              │                │
  │ NAFDAC   │  scrape  │               │              │                │
  └──────────┴──────────┘               │              │                │
                        │               │              │                │
               ┌────────▼───────┐       │              │                │
               │  instruments   │       │              │                │
               │  (raw, triage) │       │              │                │
               └────────────────┘       │              │                │
                        │               │              │                │
                        │  enqueue OCR  │              │                │
                        ├──────────────►│              │                │
                        │               │  download    │                │
                        │               │  PDF, Tesseract              │
                        │               │  extract text│               │
                        │               ├─────────────►│                │
                        │               │  enqueue     │                │
                        │               │  classify    │                │
                        │               │              │  AI classify   │
                        │               │              │  extract obls  │
                        │               │              │  extract sanc  │
                        │               │              ├───────────────►│
                        │               │              │  enqueue       │
                        │               │              │  applicability │
                        │               │              │                │  match
                        │               │              │                │  tenants
                        │               │              │                ├──────► webhook
                        │               │              │                │        sender
                        │               │              │                │
  ┌───────────────────────────────────────────────────────────────────────────────────┐
  │  Job Queue (job_queue table)                                                      │
  │                                                                                    │
  │  ocr_document (batch 3)  →  classify_instrument (batch 10)  →  evaluate_          │
  │                                                               applicability (10)  │
  │                                                                  → send_webhooks   │
  │                                                                  (batch 20)        │
  └───────────────────────────────────────────────────────────────────────────────────┘
```

### Flow 3: Classification & Compliance

```
     Tenant User        Tenant BE           Intelligence BE        External AI
         │                  │                     │                   │
         │  GET /obligations/inbox                │                   │
         ├─────────────────►                      │                   │
         │◄────────────────┤                      │                   │
         │  [list of uncategorized instruments]   │                   │
         │                  │                     │                   │
         │  POST /obligations/{id}/classify       │                   │
         │  {applicable: true, notes: "..."}      │                   │
         ├─────────────────►                      │                   │
         │◄────────────────┤                      │                   │
         │  {status: "pending_approval"}          │                   │
         │                  │                     │                   │
         │  (CCO user)                             │                   │
         │  POST /obligations/{id}/approve        │                   │
         ├─────────────────►                      │                   │
         │◄────────────────┤                      │                   │
         │  {status: "approved"}                  │                   │
         │                  │                     │                   │
         │  (If control needed)                   │                   │
         │  POST /controls                        │                   │
         │  {obligationId, theme, tester}         │                   │
         ├─────────────────►                      │                   │
         │◄────────────────┤                      │                   │
         │  {control created}                     │                   │
         │                  │                     │                   │
         │  POST /controls/{id}/tests             │                   │
         │  {result: "pass", evidence: ...}       │                   │
         ├─────────────────►                      │                   │
         │◄────────────────┤                      │                   │
         │                  │                     │                   │
         │  (If test fails)                       │                   │
         │  Finding auto-raised                   │                   │
         │  PUT /findings/{id}/remediate          │                   │
         ├─────────────────►                      │                   │
         │◄────────────────┤                      │                   │
```

---

## Authentication & Authorization

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Token Flow                                    │
│                                                                      │
│  ┌──────────┐              ┌──────────────┐                         │
│  │  Client  │              │   Backend    │                         │
│  └────┬─────┘              └──────┬───────┘                         │
│       │  POST /auth/login         │                                 │
│       │  {email, password}        │                                 │
│       ├──────────────────────────►│                                 │
│       │◄──────────────────────────┤                                 │
│       │  {accessToken (1h),       │                                 │
│       │   refreshToken (30d)}     │                                 │
│       │                          │                                  │
│       │  GET /api/v1/*           │                                  │
│       │  Authorization: Bearer   │                                  │
│       │  <accessToken>           │                                  │
│       ├──────────────────────────►│                                 │
│       │◄──────────────────────────┤                                 │
│       │  200 OK / 401            │                                  │
│       │                          │                                  │
│       │  POST /auth/refresh      │                                  │
│       │  {refreshToken}          │                                  │
│       ├──────────────────────────►│                                 │
│       │◄──────────────────────────┤                                 │
│       │  {newAccessToken}        │                                  │
└─────────────────────────────────────────────────────────────────────┘

Roles:
  PLATFORM_ADMIN  → Intelligence BE (manage all)
  TENANT_ADMIN    → Tenant BE (admin within tenant)
  CCO            → Tenant BE (approve classifications)
  ANALYST        → Tenant BE (classify, test, find)
  AUDITOR        → Tenant BE (read-only audit)
```

---

## Job Pipeline States

```
                         ┌──────────┐
                         │  pending │
                         └────┬─────┘
                              │
                         ┌────▼─────┐
                         │processing│
                         └────┬─────┘
                      ┌───────┴───────┐
                      │               │
                 ┌────▼────┐    ┌────▼────┐
                 │completed│    │ failed  │
                 └─────────┘    └────┬────┘
                                     │ retry (backoff: 5, 15, 60, 240, 1440 min)
                                     │ after max attempts → stays failed
                                     ▼
```

---

## License Validation Flow

```
    Tenant BE                    Intelligence BE
       │                              │
       │  POST /license/activate      │
       │  {licenseKey, deviceFP}      │
       ├─────────────────────────────►│
       │                              │  POST /admin/licenses/validate
       │                              │  (internal, validates key + status)
       │                              │
       │                              │  Check: exists? active? expired?
       │                              │  Check: device limit?
       │                              │  Check: grace period?
       │                              │
       │◄─────────────────────────────┤
       │  {valid, tier,               │
       │   deviceRegistered,          │
       │   intelligenceEnabled,       │
       │   expiresAt}                 │
       │                              │
       │  Store tenant_id + license   │
       │  in tenant_profile           │
       │                              │
       │  LicenseFilter (every req)   │
       │  checks validity (cached)    │
       │                              │
```

---

## Tech Stack Summary

| Layer | Technology |
|---|---|
| Backend | Java 21, Spring Boot 3.2.5, Spring AI 1.1 |
| Frontend | React 19, Vite 8, MUI 7, Redux Toolkit |
| Database | PostgreSQL 17 (Flyway migrations) |
| AI | Google Gemini 3.1 Flash Lite (swappable via config) |
| Scraping | Playwright (headless Chromium), Jsoup |
| OCR | Tesseract (Tess4J) |
| Storage | S3 / Local filesystem |
| Auth | JWT (access + refresh tokens), BCrypt |
| Security | Spring Security, CORS whitelist |
| Scheduler | Spring @Scheduled / ThreadPoolTaskScheduler |
