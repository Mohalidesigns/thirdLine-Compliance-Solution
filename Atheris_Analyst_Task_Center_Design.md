# Atheris — Analyst Task Center ("Tasks") — Design Spec

Status: **Design agreed, not implemented.** Scope decisions locked (see §2).
Owner: to be picked up by the next agent/engineer.
Target app: **tenant portal only** (`atheris-compliance-tenant-frontend`, `:5174` + `atheris-compliance-tenant-backend`, `:9091`).

> This document is self-contained. It records the agreed design, the exact data sources and
> signals discovered during recon (with module-relative paths), the backend/frontend shape,
> and the verification recipe, so the work can be resumed without re-doing discovery.

---

## 1. Goal & persona

A single, prioritized, filterable **work queue** that answers an analyst's question:
*"What do I need to do today to stay compliant?"* — submit returns, follow up findings,
resolve obligations with no control, run/review control tests, action runbook executions
and approvals, sign off board packs.

It must be **actionable** (each row has a primary CTA that deep-links into the owning
module) and additionally surface **monitoring/adherence** (on-time %, SLA adherence, team
workload) for CCO / TENANT_ADMIN.

Non-goals (this spec): it is **not** a second dashboard KPI wall, and it does **not**
duplicate the workflow logic of the module pages (rows deep-link to them).

---

## 2. Locked design decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Scope of first build | **Everything at once** — Returns, Findings, Controls, Obligations, Review Inbox, Runbooks, Governance (board packs). |
| 2 | Default lens | **"My work"**, with a toggle to **"Whole organisation"** (CCO/ADMIN get org-wide by default). |
| 3 | Actions | **Deep-link primary CTA** (a `linkPath` + `actionLabel` per row); row opens an `EntityDrawer` preview. No inline workflow actions in v1. |
| 4 | Nav placement | **Top-level item `Tasks`** in the `main` sidebar section (next to Review Inbox), Heroicon `QueueListIcon`, with a live open-task **badge** (poll, like Review Inbox). |
| 5 | Persistence | **Derived read model — NO new table, NO migration, NO DB drop.** Everything computed live from existing rows. |
| 6 | Architecture | New tenant backend module `modules/tasks`; thin controller delegating to a `TaskCenterService`. |

---

## 3. Current state (discovery summary)

### 3.1 There is no cross-module task aggregator today

The closest existing things (none is a task list):

- `GET /api/v1/tasks` and `GET /api/v1/tasks/overdue` — real, but **control tests only**.
  Defined in `modules/controls/controller/ControlTestController.java`
  (`/tasks` = current user's open tasks; `/tasks/overdue` = all overdue, roles ANALYST/CCO/TENANT_ADMIN).
  The entity is `ControlTask` (table `control_tasks`, only `taskType = scheduled_test`).
- `GET /api/v1/dashboard/attention-items` → `DashboardService.getAttentionItems()` returns
  4 **counts** only: `{high_risk_findings, overdue_returns, obligations_no_control, controls_failing}`.
- `ComplianceMetricsDto.attentionItems` (`GET /api/v1/dashboard/metrics`) → richer
  `{category, label, count, severity}` counts, still no per-item navigation.

**Frontend already half-expects this page:** `src/services/api.js` has an **unused**
`api.tasks` module (`mine(opts)` → `GET /tasks`, `overdue(opts)` → `GET /tasks/overdue`).
Reuse/extend this module rather than creating a new one.

### 3.2 Every actionable item already exists as data, just scattered

The whole design is possible as a **derived read model**. Join keys already present:
`controlId`, `obligationId`, `returnId`, `findingId`, `actId`, and owner/user ids:
`assignedToUserId`, `returnOwnerUserId`, `controlOwnerUserId`, `assignedToOwnerId`,
`stageOwnerUserId`, `assigneeUserId`.

### 3.3 Key IDs / routes in the tenant frontend

- Routes are **string literals** in `src/AppRoutes.jsx` (protected subtree; `MainLayout`
  renders `<Outlet/>`, so a new `tasks` child route "just works"). No `ROUTES` constants
  module is consumed by the tenant app.
- Sidebar is `src/components/layout/Sidebar.jsx` — a thin wrapper over shared `AppSidebar`.
  Nav model = `sections: [{ key, items: [{ text, path, icon, badge?, exact? }] }]`.
  Icons come from the shared **Heroicons** bundle only.
- Shared UI kit resolves via npm workspace symlink (`import { … } from 'shared'`); the app
  is already wrapped in a TanStack `QueryClientProvider` (`main.jsx`).
- Query-key/staleness conventions: one `useQuery` per widget, keys like
  `['<module>', '<thing>']`, `placeholderData: keepPreviousData` for lists; `refetchInterval`
  used on dashboards (30 s). Mutations invalidate the affected keys.

---

## 4. Backend design (tenant `modules/tasks`)

### 4.1 Module layout

```
modules/tasks/
  controller/TaskCenterController.java     (thin; delegates)
  service/TaskCenterService.java           (@Transactional(readOnly=true), fans out, merges, sorts, pages)
  service/TaskMapperUtils.java             (shared priority/due helpers; optional)
  dto/TaskItemDto.java
  dto/TaskStatsDto.java
  dto/TaskCategory.java                    (enum or String constants)
  dto/TaskPriority.java                    (enum or String constants)
```

Rationale: mirrors the existing `modules/*` convention (entity-less read modules are
acceptable — `modules/dashboard` is similar). **Read-only**, so no repository, no migration.

### 4.2 DTOs

```java
// TaskItemDto
Long   id;                 // synthetic stable id (see §4.4)
String type;               // e.g. "RETURN_OVERDUE" (see §5 taxonomy)
String category;           // RETURNS | FINDINGS | CONTROLS | OBLIGATIONS | REVIEW | RUNBOOKS | GOVERNANCE
String title;              // human task title
String caption;            // secondary line (act / control no. / return name / period)
String priority;           // OVERDUE | HIGH | MEDIUM | SOON | LOW
String severity;           // optional (findings / control risk)
LocalDate dueDate;         // nullable for non-dated tasks
Integer daysRemaining;     // negative = overdue
String ownerName;
Integer ownerUserId;       // null = unassigned / org-only
String linkPath;           // frontend route to act on, e.g. "/returns/123"
String actionLabel;        // e.g. "Submit return", "Review finding"
Map<String,Object> sourceRef; // { returnId, instanceId, findingId, controlId, taskId, obligationId, executionId, reviewId, boardPackId }
```

```java
// TaskStatsDto
long total, overdue, dueToday, dueThisWeek, unassigned, completedLast7d;
Map<String,Long> byCategory;   // category -> count
Map<String,Long> byPriority;   // priority -> count
```

All DTO fields initialised with `@Builder.Default` per repo rules.

### 4.3 Service — `TaskCenterService`

Signature sketch:

```java
List<TaskItemDto> build(assigneeFilter, categoryFilter, priorityFilter, q, ownerUserId, currentUser);
TaskStatsDto stats(assigneeFilter, ownerUserId, currentUser);
Page<TaskItemDto> page(..., Pageable);   // in-memory sort + page (rows come from N modules)
```

Rules:
- One method per **mapper** (returns, findings, controls, obligations, review, runbooks,
  governance) → each returns `List<TaskItemDto>`.
- **Batch-load, no N+1**: e.g. for findings, resolve linked control/obligation names in one
  `findAllById` per page; for controls, one `ControlTask` query + one latest-test query.
- Merge → filter (category/priority/q/owner) → sort by `priority` rank then `dueDate` asc
  (nulls last) → in-memory page.
- Assignee filter: `me` keeps items whose `ownerUserId == currentUser.userId`; `all` keeps
  everything (org-only task types are only visible under `all`, though assignee can be null).
- Null-safe for empty modules (fresh tenant) — a mapper with no data returns an empty list;
  empty categories are simply absent from `byCategory`.

### 4.4 Stable synthetic id

Use a namespaced string id: `"return:<instanceId>"`, `"finding:<findingId>"`,
`"controlTask:<taskId>"`, `"test:<testId>"`, `"obligation:<obligationId>"`,
`"review:<reviewId>"`, `"execution:<executionId>"`, `"approval:<versionId>"`,
`"boardPack:<id>"`. (If `TaskItemDto.id` must be `Long`, expose the string as a separate
`key` field; frontend `rowKey` uses `key`.)

### 4.5 Controller — endpoints (thin, delegate to service)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/v1/tasks/center` | any auth | params: `assignee=me\|all` (default `me`), `category`, `priority`, `q`, `ownerUserId`, `page`, `size` |
| GET | `/api/v1/tasks/center/stats` | any auth | params: `assignee`, `ownerUserId` → `TaskStatsDto` |

Existing `/api/v1/tasks` (ControlTask) is **untouched** — no path collision.
All reads are `authenticated()`; no `@PreAuthorize` writes needed (read-only module).
`assignee=all` is allowed for every role (org-wide visibility is not sensitive here); if a
policy decision is needed, restrict `all` to CCO/TENANT_ADMIN/AUDITOR.

---

## 5. Task taxonomy (one mapper each)

Priority ranks: `OVERDUE` (0) > `HIGH` (1) > `MEDIUM` (2) > `SOON` (3) > `LOW` (4).

| Category | `type` | Source table | Signal | Priority | linkPath |
|---|---|---|---|---|---|
| **Returns** | `RETURN_SUBMIT_READY` | `return_filing_instances` | `currentStage = SIGN_OFF` | HIGH | `/returns/{returnId}` |
| | `RETURN_OVERDUE` | `return_filing_instances` | `dueDate < today` & not submitted | OVERDUE | `/returns/{returnId}` |
| | `RETURN_DUE_SOON` | `return_filing_instances` | not submitted & `dueDate <= today+30` (`DUE_SOON_DAYS`) | SOON | `/returns/{returnId}` |
| | `RETURN_ESCALATED` | `return_filing_instances` | `escalationLevel > 0` | HIGH | `/returns/{returnId}` |
| | `RETURN_DUE_DATE_NEEDED` | `regulatory_returns` | register row `dueDateNeeded = true` | MEDIUM | `/returns` |
| **Findings** | `FINDING_OVERDUE` | `findings` | status ∈ {Open, In Remediation} & `remediationDeadline < today` | OVERDUE | `/findings?findingId={id}` |
| | `FINDING_AWAITING_REVIEW` | `findings` | `status = Remediated` | HIGH | `/findings?findingId={id}` |
| | `FINDING_GAP_UNRESOLVED` | `findings` | `findingType = Gap` & `linkedControlId IS NULL` | HIGH | `/findings?findingId={id}` |
| | `FINDING_UNASSIGNED` | `findings` | `status = Open` & no assignee | MEDIUM | `/findings?findingId={id}` |
| | `FINDING_DUE_SOON` | `findings` | open & `remediationDeadline <= today+7` | SOON | `/findings?findingId={id}` |
| **Controls** | `CONTROL_TEST_OVERDUE` | `control_tasks` | status `Overdue` OR (`Pending` & `dueDate < today`) | OVERDUE | `/controls?controlId={id}` |
| | `CONTROL_TEST_DUE` | `control_tasks` | `Pending` & `dueDate <= today+30` | SOON | `/controls?controlId={id}` |
| | `CONTROL_TEST_AWAITING_REVIEW` | `control_test_results` | `reviewStatus = Pending` | HIGH | `/controls?controlId={id}` |
| | `CONTROL_TEST_FAILED` | `control_test_results` (latest per control) | latest result ∈ {Failed, Partial} | HIGH | `/controls?controlId={id}` |
| **Obligations** | `OBLIGATION_NO_CONTROL` | `obligation_classifications` | `linkedControlIds` null/empty (applicable only) | HIGH if high-risk else MEDIUM | `/obligations?noControl=true` |
| **Review** | `REVIEW_PENDING` | `pending_reviews` | one row per pending review | MEDIUM | `/review/{reviewId}` |
| **Runbooks** | `RUNBOOK_OVERDUE` | `runbook_executions` | `status = NOT_STARTED` & `dueAt < now` | OVERDUE | `/runbooks/executions/{executionId}` |
| | `RUNBOOK_DUE` | `runbook_executions` | `NOT_STARTED` & `dueAt <= now+7d` | SOON | `/runbooks/executions/{executionId}` |
| | `RUNBOOK_PENDING_SIGNOFF` | `runbook_executions` | `status = PENDING_SIGNOFF` | HIGH | `/runbooks/executions/{executionId}/summary` |
| | `RUNBOOK_APPROVAL` | runbook versions | pending approval (`/runbooks/approvals/pending`) | HIGH | `/runbooks/approvals` |
| | `RUNBOOK_REVIEW` | `runbook_review_events` | status OPEN | MEDIUM | `/runbooks` |
| **Governance** | `BOARD_PACK_SIGNOFF` | `board_packs` | `status = DRAFT` | MEDIUM | `/reports` |

Assignee ("My work") resolution per mapper:
- Returns → `returnOwnerUserId` or `stageOwnerUserId`
- Findings → `assignedToUserId` (fallback `assignedToOwnerId` resolved to a user where possible)
- Controls → `controlOwnerUserId` / `ControlTask.assignedToUserId`
- Obligations → obligation owner (if present); else unassigned
- Review / Runbooks approvals / Governance → typically org-only (null owner)

---

## 6. Frontend design (`atheris-compliance-tenant-frontend`)

### 6.1 Files

- **New page**: `src/pages/TasksPage.jsx`
- **Optional components**: `src/components/tasks/TaskDrawer.jsx` (row preview + CTA),
  `src/components/tasks/taskConstants.js` (category/priority → tone/icon/label maps).
- **Edit** `src/AppRoutes.jsx`: lazy import + `<Route path="tasks" element={<TasksPage/>} />`
  inside the protected subtree (~near `findings`, line ~99).
- **Edit** `src/components/layout/Sidebar.jsx`: add `{ text: 'Tasks', path: '/tasks',
  icon: <QueueListIcon/>, badge: openCount }` to the `main` section; poll the count with
  `api.tasks.centerStats()` (mirror the existing Review-Inbox badge poll, 60 s).
- **Edit** `src/services/api.js`: extend the existing `api.tasks` module:
  ```js
  tasks: {
    mine: (opts = {}) => request('/tasks', { signal: opts.signal }),          // existing
    overdue: (opts = {}) => request('/tasks/overdue', { signal: opts.signal }),// existing
    center: (params = {}, opts = {}) => request(`/tasks/center${toQuery(params)}`, { signal: opts.signal }),
    centerStats: (params = {}, opts = {}) => request(`/tasks/center/stats${toQuery(params)}`, { signal: opts.signal }),
  },
  ```

### 6.2 Page recipe (follow the modern TanStack pattern — Controls/Obligations, NOT Findings)

1. `PageHeader` (first child) — title "Tasks", subtitle, actions: "Refresh"; a
   **My work / Whole org** toggle in the header actions.
2. Clickable `KpiCards` (`columns={5}`): **Overdue** (red) · **Due today** · **Due this
   week** · **Unassigned** · **Completed (7d)**. Selecting a KPI applies the corresponding
   filter (set `active` accordingly). Include `breakdown` where meaningful (by category).
3. `FilterBar`: `search` (title/q) + `filters` = category, priority, due window; owner filter
   for CCO/admin. URL-backed (e.g. `?category=&priority=&assignee=`) so deep links work.
4. `SectionTable` — **max 5 columns**: **Task** (title + category chip) · **Related**
   (act/control/return caption) · **Due** (relative; overdue in red) · **Owner** · **Action**
   (primary CTA button). Rows grouped by urgency band (Overdue → Today → This week → Later)
   using group header rows or section dividers. `onRowClick` opens the drawer.
5. `EntityDrawer` — item summary + full details + the same primary CTA (`linkPath`).
6. **Adherence rail** (CCO/TENANT_ADMIN only): "Team workload" (tasks by owner, from
   `byCategory`/owner grouping) + an adherence strip reusing `ComplianceMetricsDto`
   (on-time returns, findings within SLA). Reuse `CoverageStrip`/`KpiCard` — do **not**
   recompute metrics.

Data fetching: `queryKey: ['tasks','center', params]` / `['tasks','center-stats', params]`,
`placeholderData: keepPreviousData`, `refetchInterval` ~30–60 s. Each query owns its state so
one failing endpoint never blanks the page. All reads forward `{ signal }` from TanStack for
abort-on-unmount.

### 6.3 Shared components to reuse (already exported from `shared`)

`PageHeader`, `KpiCards`/`KpiCard` (tone/icon/caption/breakdown/active/tooltip),
`FilterBar`/`FilterField`/`SearchInput`, `DataCard`/`CardLink`, `StatusBadge`/`RiskBadge`/
`StateBadge`, `SectionTable`, `DetailHeader` (band), `EntityDrawer`, `CoverageStrip`,
`SectionTabs`, tokens `TL`/`tone`/`riskTone`/`statusTone`, formatters, and the Heroicons
bundle. Suggested icon: `QueueListIcon` (alternatives: `InboxIcon`,
`ClipboardDocumentListIcon`, `ClockIcon`).

---

## 7. Verification recipe (per AGENTS.md rules)

1. Backend: `mvn clean compile` in the tenant module (and reactor if `common` changed — it
   doesn't here).
2. Frontend: `npm run build:tenant` (from the frontend workspace root).
3. **No migration** ⇒ no DB drop needed. Restart the tenant backend (prompt the user to do
   this — do NOT start it automatically). If the DB was reset for any reason, prompt the
   user to run manual onboarding.
4. Onboarding params (values are examples; credentials via env vars only):
   org `Mam Corp`, address `No 121, Lewis Street, Lagos Island, Lagos`, email `ORG_EMAIL`,
   CCO `CCO_EMAIL`, user type local, local user `TENANT_USERNAME` / `TENANT_PASSWORD`.
   Admin (intel) `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
5. After the backend is up: `GET /api/v1/tasks/center` + `/stats` return well-formed JSON;
   check `%TEMP%\opencode\{intel,tenant}-{out,err}.log` for errors.
6. **Playwright is allowed only for a single-page check** of `/tasks` at
   `http://localhost:5174/tasks` (render KPI strip, table, one drawer, one CTA). Never
   automate the onboarding wizard.
7. Run the `atheris-register-page` skill's `check_dto_binding.py` against the new DTOs to
   confirm every `TaskItemDto`/`TaskStatsDto` field the page binds actually exists.
8. `api-sync` skill: confirm the two new `api.tasks.*` calls match the controller.

---

## 8. Open questions / follow-ups

- **`assignee=all` authorization** — open to all roles by default; restrict if a policy
  decision says otherwise.
- **"Completed (7d)" KPI** — bounded by data availability. Only `control_tasks` carry a
  clean completed timestamp today; other "completed" signals (submitted returns, closed
  findings) need a per-mapper definition. v1 may label this tile "Recently completed" and
  document exactly which sources contribute.
- **Board pack / runbook modules may be empty** on a fresh tenant — mappers must be null-safe
  and empty categories hidden.
- **Synthetic id type** — confirm whether `TaskItemDto.id` can be a `String`; if not, add a
  string `key` field for the frontend `rowKey`.
- **Lint debt:** if the page uses raw hooks it will trip `react-hooks/set-state-in-effect`
  (pre-existing across the app). Use TanStack Query to stay clean; the tenant app has no
  eslint config.
- **Not in v1:** inline actions, calendar view, per-task snooze/assign, push/email digest.

---

## 9. Detailed data-source reference (from recon)

Modules are under
`atheris-compliance-backend/atheris-compliance/atheris-compliance-tenant-backend/src/main/java/com/atheris/compliance/tenant/backend/`.

### 9.1 Control tasks (the only real task table)

- Entity `modules/controls/entity/ControlTask.java` (table `control_tasks`): `taskId, controlId,
  controlNumber, controlName, taskType (only "scheduled_test"), assignedToUserId,
  assignedToName, dueDate, status (Pending default), escalationLevel (0), escalatedAt,
  completedByTestId, createdAt`. Statuses: `Pending, In Progress, Overdue, Completed`.
- `modules/controls/service/ControlTestService.java`: `scheduleNextTest()` (task factory:
  `dueDate = today + testFrequencyDays`), `recordTest()` marks tasks Completed, `reviewTest()`
  (Rejected → new Pending task +3d), `processOverdueTasks()` (`@Scheduled` 01:00: Pending→Overdue,
  sets escalationLevel).
- Endpoints in `modules/controls/controller/ControlTestController.java`: `/controls/{id}/tasks`
  (any auth), `/tests/pending-review` (ANALYST/CCO/TENANT_ADMIN), `/tasks` (any auth, own),
  `/tasks/overdue` (ANALYST/CCO/TENANT_ADMIN).

### 9.2 Returns

- Entities `modules/returns/entity/ReturnFilingInstance.java` (+ `RegulatoryReturn.java`).
  Instance fields of interest: `instanceId, returnId, period, dueDate, prepStartDate,
  currentStage (NOT_STARTED default), status, stageOwnerUserId, submittedDate,
  submittedByUserId, daysLate, escalationLevel, escalatedAt`.
  Stages: `NOT_STARTED, DATA_GATHERING, DRAFT, REVIEW, SIGN_OFF, SUBMITTED`.
  Filing statuses: `NOT_STARTED, IN_PROGRESS, SUBMITTED, SUBMITTED_LATE`.
- DTOs `modules/returns/dto/ReturnRegisterItem.java` (incl. `dueDateNeeded, currentStage,
  currentDueDate, currentStatus, overdueCount, hasOverdue, escalationLevel`),
  `ReturnStatsDto` (+ `StatusBuckets{ tracked, filedOnTime, filedLate, overdue, inProgressNotDue,
  notYetDue, dueSoon }`), `ReturnInstanceItem.java`.
- `modules/returns/service/ReturnService.java`: `getRegister()`, `statusBuckets()` with
  `DUE_SOON_DAYS = 30`, `ensureInstances()`, `advanceStage()` (stage order; CCO notified at
  SIGN_OFF), `submit()` (only from SIGN_OFF; sets SUBMITTED/SUBMITTED_LATE + daysLate),
  `catchUpEscalations()`.
- Endpoints `modules/returns/controller/ReturnController.java`: reads any auth;
  `PUT /returns/instances/{id}/advance` ANALYST/CCO/TENANT_ADMIN;
  `PUT /returns/instances/{id}/submit` CCO/TENANT_ADMIN.

### 9.3 Findings

- Entity `modules/findings/entity/Finding.java` (table `findings`): `findingId, findingType
  (Control Failure | Gap), severity, description, assignedToUserId/Name, assignedToOwnerId,
  status (Open default), remediationDeadline, slaDays, remediationSubmittedAt,
  remediationSubmittedViaLink, remediationSubmittedByOwnerId, closedAt, …`.
  Statuses: `Open, In Remediation, Remediated, Closed`.
- DTOs `FindingRegisterItem.java` (`displayId "FIND-%03d"`, `slaRemainingDays`,
  `linkedControlIdentifier`, `linkedObligationId`), `FindingStatsDto.java` (`open` = Open +
  In Remediation; `overdueRemediation`; `highSeverity`; `byStatus/bySeverity`).
- `modules/findings/service/FindingService.java`: `getRegisterList()` (Specification + batch
  linked-control numbers), `getStats()`, `slaDays()` (Critical 1 / High 14 / Medium 30 /
  default 60), `autoRaiseFromTest()`, `manualRaise()`, `assign()`, `submitRemediation()`,
  `reviewRemediation()` (self-review blocked), `closeGapFinding()`, `linkControl()`.
- Endpoints `modules/findings/controller/FindingController.java`: reads any auth;
  raise/assign/link-control/close-gap/review ANALYST/CCO/TENANT_ADMIN; `PUT /{id}/remediate`
  ANALYST/TENANT_ADMIN.

### 9.4 Controls

- Entity `modules/controls/entity/Control.java` (table `controls`): `controlId, controlNumber,
  name, controlOwnerUserId/Name/Id, testFrequency, testFrequencyDays, linkedObligationIds
  (jsonb), inherentRisk, residualRisk, residualRiskRating, dueDate, actId, actName,
  obligationId, status`.
  `ControlTestResult`: `testId, controlId, testDate, result (Passed/Partial/Failed),
  reviewStatus (Pending default), remediationDeadline, …`.
- `modules/controls/service/ControlService.java`: `getRegisterList()` (incl.
  `nextTestDueDate, lastTestResult, lastTestReviewStatus, openFindings`),
  `getOpenFindingCounts()` (open statuses = Open + In Remediation + Remediated), `getStats()`.
- `ResidualRisk.java` — band rule (Passed→Low, Partial→Medium, Failed→inherent, capped).
- DTOs `ControlRegisterItem.java`, `ControlStatsDto.java`, `ControlDetailResponse.java`.

### 9.5 Obligations

- "No control" = `ObligationClassification.linkedControlIds` null/empty.
  `modules/obligations/service/ObligationService.java` sets `controlCount`; `getStats()` exposes
  `gaps`; register filter param `noControl` (`ObligationController.register`).
  `ComplianceMetricsService.hasNoControl()` mirrors it; `countHighRiskGaps()` boosts priority.
  Register holds only `applicable` obligations; under-review live in `pending_reviews`.
- DTOs `ObligationRegisterItem.java` (`controlCount, linkedControlIds, applicability,
  tenantRiskRating, inherentRiskRating, assignedOwnerName, activeFindingsCount`),
  `ObligationStats.java` (`gaps, highRisk, underReview, …`).

### 9.6 Dashboard metrics (reuse, do not recompute)

- `modules/dashboard/service/ComplianceMetricsService.java` → `ComplianceMetricsDto`:
  obligations/controls/returns/findings/sanctions counts, score + `scoreBreakdown`,
  and `attentionItems` (`{category, label, count, severity}`). Score weights default 30/25/30/15
  (`controlCoverage`, `controlTests`, `returnsOnTime`, `findingsWithinSla`).
- Controllers: `DashboardController` (`/api/v1/dashboard/{summary,trends,attention-items,metrics,
  refresh,score-weights}`) and `DashboardV2Controller` (`/api/v1/dashboard/v2/...`).
  `refresh` CCO/TENANT_ADMIN; `score-weights` PUT CCO.

### 9.7 Runbooks & Governance

- `modules/runbooks`: executions (`NOT_STARTED` default, `PENDING_SIGNOFF`, overdue),
  schedules (`nextRunAt`, `leadDays`, `assigneeUserId/Role`), review events (`OPEN`),
  pending approvals. Aggregations already exist:
  `GET /runbooks/executions?overdue=true`, `/runbooks/executions/stats`,
  `/runbooks/dashboard`, `/runbooks/approvals/pending`, `/runbooks?dueWithinDays=&needsReview=`.
  Role groups in `RunbookRoles.java`.
- Board packs (`board_packs.status = "DRAFT"` awaiting CCO sign-off) → `/reports`.
- Other latent sources: unread `ObligationNotification`, `PendingReview`, pending
  `RemediationLink` / `ReturnUploadLink`.

---

## 10. Changelog

- Initial design captured from recon. Scope/decisions locked per §2. Not yet implemented.

---

## 11. Returns slice — alignment with the escalation/reminder model (IMPLEMENTED)

The Returns escalation/reminder engine now defines who owns a filing and what "actionable" means.
This section reconciles §5's Returns taxonomy with that model and records the deltas from the
original design.

### 11.1 Model deltas that affect the task page

- **Responsible person vs owner.** A return now has a **responsible person** (submits the data; may
  be an external/owner-entity with **no login**) and an **owner = the analyst** (CC'd on every
  reminder). The task page's **"My work"** must resolve the assignee to the **analyst**
  (`stageOwnerUserId ?? returnOwnerUserId`) — never the external responsible person.
- **Filings are gated.** `ReturnService.ensureInstances` no longer generates filings when a return has
  **no responsible person** (seeded toolkit returns have only a unit string). So "no responsible
  person" becomes a first-class, actionable gap.
- **Frequency-scoped policies.** `escalation_policies` gained `frequency_scope` (DAILY…BIENNIAL) and
  `EscalationDefaultSeeder` seeds a default per frequency. Resolution: filing override → return policy
  → **frequency default** → catch-all. The policy's **reminder-start lead** is the natural
  "start-ready / due-soon" window (replaces a hard-coded 30 days, with 30 as the fallback).
- **Data-gathering email.** A new engine trigger (`GATHERING`) fires **once**, when a filing enters
  **Data Gathering**, to the responsible person (public filing link), owner CC'd. A task's inline
  **Start** action is what moves a filing into Data Gathering and therefore triggers that email.

### 11.2 Returns taxonomy (as implemented)

| type | signal | priority | CTA (`actionType`) | linkPath |
|---|---|---|---|---|
| `RETURN_OVERDUE` | not submitted & `dueDate < today` | OVERDUE | OPEN | `/returns/{returnId}` |
| `RETURN_SUBMIT_READY` | `stage = SIGN_OFF` & not submitted | HIGH | SUBMIT | `/returns/{returnId}` |
| `RETURN_ESCALATED` | `escalationLevel > 0` & not submitted | HIGH | OPEN | `/returns/{returnId}` |
| `RETURN_START_READY` | `stage = NOT_STARTED` & `now ≥ due − policyLead` | SOON | **START** (inline) | `/returns/{returnId}` |
| `RETURN_DUE_SOON` | not submitted & `dueDate ≤ today + policyLead` | SOON | OPEN | `/returns/{returnId}` |
| `RETURN_NO_RESPONSIBLE_PERSON` | return has no responsible person | MEDIUM | ASSIGN (deep-link) | `/returns/{returnId}` |
| `RETURN_DUE_DATE_NEEDED` | register `dueDateNeeded = true` | MEDIUM | OPEN | `/returns` |

- **One row per filing** (the highest-priority matching type), plus one row per *return* for the two
  org gaps. Priority ranks OVERDUE 0 > HIGH 1 > MEDIUM 2 > SOON 3 > LOW 4; sort rank then `dueDate` asc.
- `key` = `"return:<instanceId>"` (string) alongside `Long id` = instanceId.
- `actionType ∈ {START, SUBMIT, OPEN, ASSIGN}` drives the inline button (deviation from §2 #3, which
  said deep-links only — the page is meant to be actionable).

### 11.3 API (as implemented)

```
GET /api/v1/tasks/center?assignee=me|all&category=RETURNS&priority=&q=&ownerUserId=&page=&size=
GET /api/v1/tasks/center/stats?assignee=&ownerUserId=
```

`modules/tasks/` ships with **only the Returns mapper** wired; the other six category mappers return
empty lists so they can be lifted in one at a time. My interim `GET /returns/tasks` /
`ReturnService.getTasks` / `ReturnTaskItem` were **removed** in favour of this module.

### 11.4 Returns task lifecycle

1. Seeded return, no responsible person → task **`RETURN_NO_RESPONSIBLE_PERSON`** ("Assign a responsible person").
2. Person set → filings generate; within the policy lead → **`RETURN_START_READY`** ("Start filing").
3. Analyst clicks **Start** → `PUT /returns/instances/{id}/advance` → stage **Data Gathering**.
4. Next engine tick fires the **GATHERING** email (link) to the responsible person, owner CC'd → task
   shows **`RETURN_DUE_SOON`** until due.
5. Past due → **`RETURN_OVERDUE`** / **`RETURN_ESCALATED`** as reminders and the L1→L2→L3 ladder fire.
6. Filed → status SUBMITTED → the task disappears (and reminders stop).

