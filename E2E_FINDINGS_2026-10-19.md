# Tenant E2E walk-through — findings (2026-10-19)

Branch `bugfix/dashboard-consistency`. Services: intel :9090, tenant :9091, intel UI :5173, tenant UI :5174.
Order follows the tenant sidebar. Acted as five seeded users — Dev CCO, Dev Analyst, Dev Tenant Admin, Dev IT Operations, Dev Auditor (`@mamcorp.test`).

## Summary

79 findings — **17 High**, 28 Med, 34 Low. Every module in the sidebar was exercised, using five role users (CCO, Analyst, Tenant Admin, IT Ops, Auditor) for the maker/checker steps.

**Fix first (High):**

- **Q1/Q2** — AI classification is down (model API key rejected, 401), and a failed classification leaves the upload stuck in "Processing" forever, so nothing new can reach the Review Inbox.
- **F3** — No email is delivered (SMTP needs STARTTLS), but the UI says the remediation link was emailed.
- **S1** — Token refresh isn't single-flight, so parallel 401s log the user out.
- **O1 / O2 / C2** — 216 duplicate obligations (from intel), and control↔obligation links that are both inflated (100+ per obligation) and out of sync, so "coverage 100%" means nothing.
- **R1 / R3** — The rendition tracker ignores daily/weekly periods ("0 overdue" vs 14), and escalations always show 0 days late.
- **R2** — The seed stores the responsible unit as the return's regulator, which spreads to the returns register, the tracker and the escalation matrix.
- **R6** — On the Risk Profile tab the heatmap says 1373 Critical while the panel below says 5.
- **I1** — Instruments KPIs, filters and sort work on the current 20-row page only.
- **G1** — Every regulator shows 0 obligations.
- **N1 / B3** — No segregation of duties in return filing, and runbook step roles aren't enforced (an analyst passed the "CCO sign-off" step).
- **F1** — Findings can't be assigned without an org owner, and only a tenant admin can create owners.
- **E1** — Evidence can be linked to a control that doesn't exist.

Severity: **High** = broken / wrong data / security, **Med** = misleading or partial, **Low** = polish.

## Startup / cross-cutting

| # | Sev | Area | Finding | Evidence / where |
|---|-----|------|---------|------------------|
| S1 | High — **Fixed** | Auth (tenant UI) | Token refresh is not single-flight. Every concurrent 401 calls `doRefresh()`; the refresh token rotates, so the 2nd+ refresh calls get 401 and the user is logged out ("Your session has expired"). Seen on page load: 4× refresh 200, then 7× refresh 401. | `tenant-frontend/src/services/api.js:59` — share one in-flight promise |
| S2 | Med | Tenant backend startup | Tenant validates its license at startup before intel is reachable → `Failed to validate license … Connection refused` (logged twice), no retry until the next schedule. | `LicenseService` startup + `@Scheduled` |
| S3 | Low | Intel scraper | Six regulator scrape URLs are dead: CAC `/publications` 404, NAICOM TLS name mismatch, NFIU 404, NDPC 404, SEC `/regulations/` 404, PenCom 404. | intel log at start |
| S4 | Info | Test users | Added an `itops@` IT_OPS user to `DevUserSeeder`; enabled `SEED_USERS_ENABLED` in `.env` with a generated password (`SEED_USERS_PASSWORD`). 5 role users now exist: admin/cco/analyst/auditor/itops `@mamcorp.test`. | `config/DevUserSeeder.java` |

## 1. Dashboard (`/dashboard`) — as CCO

Totals agree (universe 54+37+1+20 = 112; returns 14 overdue + 441 not yet due = 455; risk 5+1316+213+1 = 1535). High-risk breakdown by regulator sums to 54; drill → `/universe?riskRating=High&regulator=CBN` = 41 rows ✓.

| # | Sev | Finding | Evidence / where |
|---|-----|---------|------------------|
| D1 | Med | "Controls passing 0.0%" (trend card) next to "Effectiveness 100%" (controls card) for the same 1 passing control — two different denominators (all controls vs tested) with near-identical labels. | `CcoDashboardPage` trend + controls cards |
| D2 | Low | Refresh only refetches 9 queries — not the Runbooks widget or the risk-by-area/act panels; it does not recompute today's snapshot. | `CcoDashboardPage.jsx:141` |
| D3 | Low | At ~1000 px wide the 5 universe KPI labels and Top Regulator names truncate ("TOTA…", "Central Bank of …"). | Universe section |
| D4 | Low | Near-duplicate acts split rows in Risk by Act (NDPA 2023 ×2, Consumer Protection Framework ×2, Cybercrime Act ×2, BVN framework ×2). Already a known follow-up. | Risk by Act table |

## 2. Rendition & Coverage (`/dashboard/v2`)

| # | Sev | Finding | Evidence / where |
|---|-----|---------|------------------|
| R1 | High — **Fixed** | Rendition tracker header says "0 overdue" while the escalation matrix lists 14 overdue periods. The grid looks instances up by month key (`2026-10`) but daily/weekly periods are `2026-10-16` / `2026-W42`, so they never land in a cell (shown "-") and are never counted. | `DashboardV2Service.java:~220` (`periodMap.get(month)`) |
| R2 | High — **Fixed** | "Regulator" column shows the responsible unit (e.g. "Trade & Exchange / Financial Markets Department", "NSEN") in the tracker, the escalation matrix and anywhere `filingRegulator` is read. Root cause: the seed writes `responsibleUnit` into `filingRegulator`. | `RegulationSeedService.java:185-196` |
| R3 | High — **Fixed** | Escalation matrix "Days late" = 0 for periods due 3 days ago (at L2). `daysLate` is only written on submission; open periods never get it. Compute from `dueDate` for open periods. | `DashboardV2Service.java:425`, `ReturnService.java:596` |
| R4 | Med | Department is "Unassigned" for every return (no department set by seed) so the default grouping is one bucket "Unassigned 0/17". | rendition grid |
| R5 | Low | Escalation matrix has 9 columns (UI rule max 5). | `DashboardV2Page` |
| R6 | High — **Fixed** | Risk Profile tab contradicts itself: the heatmap says "1535 rated — **1373 critical, 161 high**, 1 moderate" while the Risk Profile panel right below (and the main dashboard) says **Critical 5, High 1316, Moderate 213, Low 1**. The heatmap still bands with its own matrix (cells score up to 40 — likelihood axis gets extra Medium/High/Low columns appended, so a 5×8 grid) instead of the shared `RiskBands` rule. Heatmap drill-downs therefore open 1373 "critical" obligations that the register calls High. | `DashboardV2Service` risk-heatmap / `resolveAxis`; vs `RiskBands` |
| R7 | Low | Control Coverage tab: 1535/1535 covered, all areas 100% — consistent with dashboard ✓ (no issue, recorded for completeness). | |

## 3. Review Inbox (`/review`)

Empty on arrival (0 pending — all 153 platform instruments already synced). Tried to feed it with an upload — **blocked**, see Q1/Q2.

| # | Sev | Finding | Evidence / where |
|---|-----|---------|------------------|
| Q1 | High — config | **AI classification is down**: every call to the model returns 401 (`HttpRetryException: cannot retry due to server authentication`) → "All AI models unavailable". The `OPENROUTER_API_KEY` in `.env` is rejected. No uploaded or scraped document can reach the Review Inbox. Last 2 intel classify jobs (15 Oct) failed the same way. | intel console, 19 Oct 23:58:41 |
| Q2 | High — **Fixed** | When classification fails the upload is **never marked FAILED**: `UploadClassificationHandler` catches the error but its REQUIRES_NEW transaction is already rollback-only (set inside `ClassificationService.classifyAsync`) → `UnexpectedRollbackException`; `upload_records.status` stays `EXTRACTED`, tenant `upload_jobs.status` stays `processing` and the Uploads page shows "Processing…" forever with no retry. | `UploadClassificationHandler.java:42-73` |
| Q3 | Med | Upload title is stored as filename + typed title glued together: `cbn_cyber_circular_testE2E Test - CBN Cyber …` (tenant `upload_jobs.title` and intel `upload_records.title`). | `/uploads` → upload_jobs id 1 |
| Q4 | Low | Intel's log file (`$TMPDIR/opencode/intel.log`) has only ~160 lines; the upload/classification INFO/ERROR lines appear on the console but not in the file. | logging config |

## 4. Compliance Universe (`/universe`)

Drill from dashboard → 41 rows (= breakdown) ✓; drawer shows details, AI summary, 16 obligations ✓.

| # | Sev | Finding | Evidence / where |
|---|-----|---------|------------------|
| U1 | Low | Drawer field "Document type" shows the nature ("Core"); same label on the Instruments detail. | `UniversePage` drawer, `InstrumentsPage` detail |

## 5. Instruments (`/instruments`)

| # | Sev | Finding | Evidence / where |
|---|-----|---------|------------------|
| I1 | High — **Fixed** | KPI cards are computed from the **current page** (20 rows), not the register: "High Risk 14", "With Obligations 20", "Critical 0" while the register holds 112 (Universe says High 54). The Risk/Regulator filters and column sort are also applied client-side to that one page. | `InstrumentsPage.jsx:335-348` (`items.filter`) and the `useMemo` above it |
| I2 | Low | Detail opens in place; the URL stays `/instruments`, so browser Back leaves the page and the detail can't be shared (a `?id=` deep link exists but isn't pushed). | `InstrumentsPage` |
| I3 | Low | "View Instrument" / "Download" are shown for toolkit instruments that never have a PDF — click → 404 → "No document is available". Could be disabled up front. | `/subscriptions/instruments/{id}/pdf` |
| I4 | Low | "Upload Instrument" goes to `/uploads`, a page with no sidebar entry. | Sidebar |

## 6. Acts (`/acts`)

| # | Sev | Finding | Evidence / where |
|---|-----|---------|------------------|
| A1 | Med | Lists **389** acts (every platform act), most with 0 obligations/controls/returns/sanctions; dashboard says the register spans **112** acts. No "in my register" filter or default. | `/acts` |
| A2 | Low | KPI cards are page-scoped and labelled "(PAGE)" — honest, but of little use (Obligations (page) 7). | `ActsPage` |
| A3 | Low | Same act listed under two regulators ("Advance Fee Fraud … Act 2006" under EFCC and CBN). | |
| — | ✓ | Act detail (`/acts/39`) tabs Obligations/Controls/Returns/Sanctions load. | |

## 7. Obligations (`/obligations`, `/obligations/:id`) — as CCO

1536 rows = 1535 applicable + 1 under review ✓; High Risk 1321 matches dashboard ✓.

| # | Sev | Finding | Evidence / where |
|---|-----|---------|------------------|
| O1 | High — plan proposed | **Duplicate obligations**: 97 groups / 216 rows share instrument + title + section + identical text (e.g. "Failure to Complete CDD" ids 323 & 361). They come from the platform: intel `obligation_mappings` has 96 such groups; tenant `obligations` has 128. Inflates every count and risk total. | intel toolkit import dedup; tenant seed |
| O2 | High — plan proposed | **Control over-linking makes coverage meaningless**: 471 obligations have 100+ linked controls, 699 have 20–99 (e.g. "Data Privacy Impact Assessment" → 210 controls). Every obligation in an act appears linked to every control of that act, so "Control coverage 100% / No control 0" says nothing. | seeded `linked_control_ids` |
| O3 | Med | Assess Risk saves `impactRating`/`likelihoodRating` but leaves `inherentImpact`/`inherentLikelihood` ("Medium") and `tenantRiskRating` unchanged, although the dialog says "Inherent risk is computed automatically from impact × likelihood". Two parallel sets of impact/likelihood fields. | `PUT` risk assessment → obligation 225 |
| O4 | Med | Risk dialog mixes scales: Impact = Critical/High/Medium/Low (4), Likelihood = Rare…Almost Certain (5), while the risk matrix/heatmap uses Insignificant…Severe for impact. "Risk Rating" is also hand-selectable next to the computed one. | Assess Risk dialog |
| O5 | Med | Assign Owner: owners are a separate org list, not tenant users — the 5 users can't be picked. "Add new owner" is offered to the CCO but `POST /org/owners` is TENANT_ADMIN-only → 403 "You do not have permission". | `OrgController.java:85` |
| O6 | Low | Weak seeded titles: "Circular (FPR/DIR/CIR/GEN/02/001)", "Circular"; plain-English text is a copy of the source text. | toolkit seed |
| O7 | Med | Marking a gap (Gap → "Has gap") saves `hasGap=true` but the KPIs ignore it: register filter `hasGap=true` → 2 rows, register "No Control" KPI → 1, dashboard "No Control" → 0. Three numbers for one question (KPIs count `controlCount==0`, the filter reads the flag; dashboard counts applicable only). Dialog text "no control covers this obligation" also contradicts an obligation with 2 linked controls. | `/obligations/stats`, `/dashboard/metrics`, register filter |
| O8 | Med | Owner filter has **844** options — the seeded `controlOwner` free text, many multi-line bullet lists ("- Board of Directors - Managing Director/CEO - …"). Unusable as a filter. | `/obligations/stats` → `owners` |

## 8. Regulators (`/regulators`)

| # | Sev | Finding | Evidence / where |
|---|-----|---------|------------------|
| G1 | High — **Fixed** | **Obligations = 0 for every regulator** (and the "Obligations" KPI = 0) although the register has 1536 obligations (CBN alone ≥ 1000). Detail page `/regulators/1` shows "Linked obligations —". Obligations are not linked to `tenant_regulator` (they carry `regulatorAbbreviation`/name only). | `/regulators`, `/regulators/1` |
| G2 | Low | Returns total 137 here vs 143 returns tracked elsewhere (returns with no regulator link aren't counted). | KPI "Returns 137" |

## 9. Controls (`/controls`) — as CCO

| # | Sev | Finding | Evidence / where |
|---|-----|---------|------------------|
| C1 | Med | "Tests due" KPI = 0 here, dashboard "Tests due (30 days)" = 6. | `/controls` vs `/dashboard` |
| C2 | High — plan proposed | Control ↔ obligation links are out of sync: control CORPA119 lists **4** linked obligations, while obligations of the same act list 58–210 controls each (see O2). | control detail vs register |
| C3 | Med | Record Test → "Remediation Owner" offers only org owners ("No owners yet"), and the entered **Remediation Deadline (20 Nov) is ignored** — the auto-raised finding gets the SLA default (3 Nov). | `Record Test` dialog → FIND-002 |
| C4 | Low | Inconsistent seed data: "Annual policy review, internal audit." with test frequency Monthly. | row 2 |
| — | ✓ | Failed test recorded → review "Pending"; the tester (CCO) cannot review own test ("a different analyst must review it") — SoD works. FIND-002 (High) auto-raised from the failed test. | |

## 10. Runbooks (`/runbooks/*`) — as CCO

| # | Sev | Finding | Evidence / where |
|---|-----|---------|------------------|
| B1 | Low | Scheduled run RBX-2026-000003 is overdue by 3d 7h and still "Not started"; nothing nudges or reassigns it (operator "Mohammed" = admin@admin.com). | Executions list |
| B2 | Med | "Open escalations 4" (dashboard + executions KPI) although the only failed run (RBX-000002) was **aborted** — escalations stay open after abort. | `/runbooks/executions` |
| B3 | High — **Fixed** | **Step roles are not enforced**: steps tagged Analyst were passed by IT_OPS, and step 4.2 "CCO sign-off" (role CCO, attestation "recorded against your name") was passed by the **Analyst**. | RBX-2026-000005 steps 1.1, 4.2 |
| B4 | Med | **Any signed-in user can work another operator's run**: the analyst (who had just verified 3.1) started and passed 3.2, 4.1 and 4.2 on IT_OPS's execution, and sees Pause / Trigger rollback / Abort on it. The verifier of a dual-control step then also performs the following steps. | `/runbooks/executions/5` |
| B5 | Low | Evidence type isn't checked against the requirement: a `.txt` file was accepted as the "Screenshot" evidence of step 3.1. | Capture evidence |
| B6 | Low | "Confirm & start execution" in the pre-flight dialog navigates back to the executions list instead of staying in the console. | Pre-flight checklist |
| B7 | Low | IT_OPS (meant to execute + capture evidence only) lands on the full compliance dashboard and sees the full sidebar. | sign-in as itops@ |
| — | ✓ | **Full run with 3 users** (RB-ACC-001 v1, 12 steps): IT_OPS started (pre-flight 4 mandatory acks enforced), Pass disabled until mandatory evidence, 13 evidence items hashed; dual-control step 3.1 → "Awaiting verification", operator has no Verify button, analyst verify with wrong password → 400 "The password is incorrect" (no logout), correct password → verified; reviewer sign-off (analyst, role-limited to "Reviewer") + CCO sign-off → **Completed pass**; evidence pack ZIP re-hashed in the browser = displayed pack SHA-256. | |
| — | ✓ | Approvals: CCO approved & published RB-ACC-001 v1 (HIGH) authored by another user; change summary min 10 chars enforced; queue → 0. | |

## 11. Findings (`/findings`)

| # | Sev | Finding | Evidence / where |
|---|-----|---------|------------------|
| F1 | High — **Fixed** | A finding can't be assigned unless an org owner exists, and only TENANT_ADMIN can create owners — a CCO-only tenant is stuck at "Open". Owners are not tenant users. | Assign dialog → "No owners yet" |
| F2 | Low | US date format (`11/3/2026`, `10/20/2026`) on Findings, `20 Oct 2026` everywhere else. | Findings list + detail |
| F3 | High — **Fixed** | **All outbound email fails**: SMTP rejects with `530-5.7.0 Must issue a STARTTLS command first` (control-test, runbook-due, return-ready, remediation emails). The UI still says the remediation link "has been emailed to the owner". Enable STARTTLS in the mail config and surface send failures. | tenant log `EmailService [email-failed]` |
| F3a | Info | **Mail fixed (20 Oct):** SMTP now server377.web-hosting.com:465 (SSL, new `SMTP_SSL` switch); seed users renamed to real Gmail inboxes via `SEED_USERS_EMAILS`; runbook approval, dual-control verification, runbook sign-off and control-test review now send email. Verified: `[email-sent] to=sabrclay@gmail.com` for a control-test review. `BASE_URL` set to http://localhost:5174 so links in mails open locally (fixes F4 in dev). | `.env`, `NotificationService`, `DevUserSeeder` |
| F4 | Med | Remediation link uses `https://app.atheris.com/remediate/…` in dev — `BASE_URL` points at production; the link doesn't work locally. | Remediation link dialog |
| F5 | Med | Findings list is stale after returning from a detail: FIND-002 still "Open / – / 11/3" after it was assigned; only a reload refreshes it (page uses raw state, no query invalidation — known FindingsPage debt). | Back to Findings |
| F6 | Low | Assign dialog doesn't prefill the current deadline; extending past the 14-day SLA needs no justification ("SLA: 14 days · 31 days remaining"). | Assign Finding |
| F7 | Low | Sign-off dialog only offers "Accept — close"; no reject / send back to owner. Closing the finding does not require or schedule a control re-test (control stays Failing). | Review Remediation |
| — | ✓ | Lifecycle: raised (auto) → assigned to owner (CCO) → remediation + PDF evidence submitted via public token page → CCO "Accept & Close" → Closed; timeline records every step. | |

## 17. Settings (`/settings`) — as Tenant Admin (tested before §12, to create the owners the findings flow needed)

| # | Sev | Finding | Evidence / where |
|---|-----|---------|------------------|
| T1 | Med | `UserService.deactivate` has no guard: an admin can deactivate **themselves** or the **last TENANT_ADMIN** (the Deactivate button is shown on the admin's own row). | `UserService.java:84` |
| T2 | Low | System Users hides the inactive invited CCO (`mohalidesigns@…`, `is_active=false`) — no way to see, resend or reactivate the pending invite. | System Users tab |
| T3 | Low | Organization tab has "Add Department / Add team" but no "Add owner"; owners can only be created from inside an Assign dialog. | Organization tab |
| — | ✓ | Admin created owner "Dev Analyst — Compliance" and assigned it to obligation 225 (history → 3 entries). | |
| C5 | Low | Test review only offers **Accept** — the checker can't reject or send the result back. | Review Test Result dialog |
| C6 | Med | 1832 of 2137 controls still carry residual risk High (`controlsHighResidualRisk`), after the re-band commit — check whether the repair ran on this tenant. | `/dashboard/metrics` |
| — | ✓ | Analyst (different user) accepted the CCO's failed test → dashboard: 1 passing / 1 failing, effectiveness 50%. | |

## 12. Returns (`/returns`) — as Analyst

| # | Sev | Finding | Evidence / where |
|---|-----|---------|------------------|
| N1 | High — **Fixed** | **No segregation of duties in the filing workflow**: one analyst advanced instance 437 Not Started → Data Gathering → Draft → Review → Sign-off with no second person, no evidence and no name required. Only the final "Mark as Submitted" is restricted (analyst → 403). | `/returns` → Quarterly Unaudited Accounts 2026-10 |
| N2 | Med | "Mark as Submitted" is shown to the analyst and fails with 403 "You do not have permission". Hide or explain. | `PUT /returns/instances/437/submit` |
| N3 | Med | Stage labels are off by one: the page button says "Mark complete → Draft" and the dialog button "Advance to Draft", while the dialog text (and the real transition) is "advance to Data Gathering". Same at every stage. | Advance Stage dialog |
| N4 | Med | Rows show the **next** due date with the status of an **older** missed period: weekly returns "Due 22 Oct 2026 — OVERDUE" on 20 Oct; daily "Due 20 Oct — OVERDUE". | register rows 1–5 |
| N5 | Low | KPI "Total Returns 458" counts filing periods; the header says "137 returns". | KPI label |
| N7 | Low | Submission evidence is a URL text field only (no file upload into the Evidence Vault); stages don't record who completed them. | Mark as Submitted dialog |
| — | ✓ | CCO marked instance 437 Submitted with a receipt URL; all stages show completed 20 Oct. | |
| N6 | Med | Regulator column shows the responsible unit (see R2) — "NSEN" for the NSE return; "Responsible party" repeats the same value. | register |

## 13. Sanctions (`/sanctions`) — as CCO

351 sanctions, exposure ₦2,434,492,728 = dashboard ₦2.4B ✓; min-amount filter (≥ ₦10m → 95) and drawer work ✓.

| # | Sev | Finding | Evidence / where |
|---|-----|---------|------------------|
| X1 | Low | "Enforced 0" and no way to record an enforcement / mark a sanction as applied to the institution. | Sanction drawer |
| X2 | Low | Per-day penalties ("₦1m – ₦25m per day") count once at the maximum in Exposure; daily accrual isn't reflected. | drawer "Maximum exposure ₦25,000,000" |

## 14. Reports (`/reports`) — as CCO

Generate → draft #3; PDF download 200, `%PDF-1.4`, SHA-256 matches `fileSha256` ✓; sign-off removes draft ✓.

| # | Sev | Finding | Evidence / where |
|---|-----|---------|------------------|
| P1 | Med | **Maker = checker on board packs**: the CCO who generated pack #3 signed it off. A second person (e.g. admin/board secretary) should sign. | `/reports/board-packs/3/sign-off` |
| P2 | Med | Period preset "This quarter" = **30 Sep → 19 Oct** on 20 Oct (should be 1 Oct → 20 Oct): dates are shifted by the UTC conversion (WAT = UTC+1). All three packs carry the 30 Sep start. | Generate dialog |
| P3 | Low | "Generated" column shows raw ISO (`2026-10-19T23:13:52.635180Z`), and in UTC — reads as the 19th for a pack made on the 20th. | Reports table |
| P4 | Low | Score stays 45% after a control failed and a return was filed — it reads the daily snapshot (refreshed hourly), so the board pack can lag the live dashboard by up to an hour. | preview + pack |

## 15. Audit Trail (`/audit`)

Hash chain "Verified" ✓; 105 events; every action taken today appears (risk/gap update, owner assign, test recorded/reviewed, finding raised/assigned/link/remediation/sign-off, return stages + submit, runbook approve/publish, board pack generate/download/sign-off).

| # | Sev | Finding | Evidence / where |
|---|-----|---------|------------------|
| L1 | Med | Not audited: **document upload** (`/uploads`, 19 Oct 23:58), **org owner created** (only the assignment is logged), sign-ins. | audit_events by subject type |
| L2 | Med | "board pack downloaded" has **no actor** (User -) although the download is an authenticated request. | board_pack #1–#3 |
| L3 | Low | Actor column shows "User 4" / "User 5" instead of names; filters take a numeric "Actor user id". | Audit table |

## 16. Evidence Vault (`/evidence`)

Remediation evidence submitted via the public link is listed (finding #2) ✓; runbook step files + pack ✓; no edit/delete (immutable) ✓.

| # | Sev | Finding | Evidence / where |
|---|-----|---------|------------------|
| E1 | High — **Fixed** | Upload Evidence accepts a **non-existent source**: linked to Control #999999 → saved, listed as "control #999999". Source type/id are not validated server-side. | Upload Evidence dialog |
| E2 | Med | "Source ID" is a raw number field — the user must know internal ids; no picker by control number / finding ref / return name. | Upload Evidence dialog |
| E3 | Low | US date format (`10/20/2026`). | Uploaded column |

## 18. Auditor role (read-only) — auditor@mamcorp.test

| # | Sev | Finding | Evidence / where |
|---|-----|---------|------------------|
| AU1 | Med | The UI shows create/edit actions to the read-only auditor — Import + New Obligation, Import + New Control, Raise Finding, Add Return, Upload Evidence, Save Interval. The backend correctly answers 403 (`POST /findings`, `PUT /settings/polling`), so the auditor fills a form only to get "You do not have permission". Hide by role. | all register pages |
| — | ✓ | All 10 main pages load for the auditor with no API errors. | |

## Test data created during this walk-through

Obligation 225 (risk High×Likely, gap flag, owner "Dev Analyst"); org owner "Dev Analyst — Compliance"; control CORPA119 failed test + accepted review; FIND-002 raised → closed; return instance 437 submitted; runbook RB-ACC-001 v1 published, execution RBX-2026-000005 completed + evidence pack; board pack #3 signed off; evidence upload linked to control #999999; upload "E2E Test - CBN Cyber Incident…" stuck in Processing. Code/config: `DevUserSeeder` gained the IT_OPS user; `.env` has `SEED_USERS_ENABLED=true` + a generated `SEED_USERS_PASSWORD` (uncommitted).

## Fix log — branch `bugfix/tenant-e2e-high-findings` (2026-10-20)

Verified with `mvn compile` + `mvn test` (both backends, new unit tests `RenditionGridRulesTest`, `ReturnRegulatorRepairServiceTest`, `RunbookStepRoleTest`), `npm run build:tenant`, and live in the browser pane after restarting both backends on this branch.

| # | Fix | Live check |
|---|-----|-----------|
| S1 | `api.js` `doRefresh()` shares one in-flight promise; a request whose token was already rotated retries with the current one instead of refreshing again. `rawRequest` uses the same path. | Not reproducible on demand (needs concurrent expiry) — code + build only |
| Q1 | Config only: `OPENROUTER_API_KEY` in `.env` is rejected (401). Needs a valid key. | — |
| Q2 | Intel `UploadClassificationHandler` is no longer one transaction: instrument + classification run in a `REQUIRES_NEW` `TransactionTemplate`; FAILED (with the root-cause message) is saved in its own transaction. New `StaleUploadRecovery` (every 10 min) fails uploads stuck in-flight >30 min; re-uploading the same PDF after a failure retries it instead of "duplicate". Tenant Upload History shows the error under "failed". | Stuck upload 1 → FAILED "Processing was interrupted…"; tenant `/uploads` shows **Failed** |
| F3 | Tenant `spring.mail…starttls.enable` defaults to `true` (`SMTP_STARTTLS`); `.env.example` documents `SMTP_AUTH`/`SMTP_STARTTLS`. `EmailService.send` returns an `Outcome`; `POST /findings/{id}/remediation-link` returns `emailStatus` + `ownerEmail`; the dialog says "Emailed to …" only on `SENT`, otherwise why not + "copy the link". **Still needed:** `SMTP_USER`/`SMTP_PASSWORD` (Gmail app password) and `SMTP_AUTH=true` in `.env`. | FIND-001 (no owner) → "The owner has no email address on file — copy the link…" |
| R1 | Rendition grid buckets each instance into its due month (daily/weekly periods were never matched); a cell aggregates the month's periods (worst state wins, `OD 5/17`, tooltip with counts); filed-late no longer counts as overdue. | Header **17 overdue** = escalation matrix 17 (was 0) |
| R3 | Escalation "Days late" computed from the due date for open periods. | 1–5 days shown (was 0) |
| R2 | Seed writes the regulator (abbreviation, else name) to `filingRegulator`; `ReturnRegulatorRepairService` (once per start, idempotent) restores it where the unit had been copied. | 122 returns restored; tracker/register show CBN; 0 rows left with the unit |
| R6 | Heatmap cells band with `ObligationClassification.inherentBand` (→ `RiskBands`), same as the Risk Profile panel; axes ordered by level instead of appending extra columns. | Heatmap 5 / 1317 / 212 / 1 = panel (was 1373 Critical) |
| I1 | Instruments page uses `/subscriptions/instruments/universe` (server filters, sort, paging) + `universe-stats` for KPIs and breakdowns; universe sort gained `obligationCount`. | KPIs 112/54/37/1/20; High → 54 rows; CBN breakdown 41; sort spans all 112 |
| G1 | Obligations get `tenantRegulatorId` in the seed and on review save; `SeedDataRepairService.linkRegulators` backfills (via seed bundles, else pending reviews). | 1535 linked; KPI Obligations 1535, CBN 750 (was 0) |
| N1 | Return filing maker/checker: whoever completed Data Gathering/Draft can't complete Review, nor submit (409 `segregation_of_duties`). | Same user Draft→Review→Sign-off blocked with the message |
| B3 | Runbook step `assignedRole` enforced on start/pass/fail/skip (403 `step_role_required`); CCO may do Analyst steps; CISO/DPO (no app role) stay open. | Unit-tested only — the shared browser was signed in by someone else mid-check |
| F1 | `POST /org/owners` (+ quick-add departments/teams) open to CCO; Add Owner dialog can prefill from a system user. | CCO created "E2E Owner (created by CCO)", preselected in Assign |
| E1 | `EvidenceVaultService.uploadLinked` validates source type (control, control_test, finding, return_instance, obligation) and that the record exists. | Control #999999 → "No control #999999 exists" |

Test data added: org owner "E2E Owner (created by CCO)"; remediation links for FIND-001; return instance "Basel III Leverage Ratio" 2026-11 advanced to Review by Dev CCO.

O1/O2/C2: root causes and a fix plan are in the session notes (`O1-O2-C2-investigation.md`); nothing changed yet.
