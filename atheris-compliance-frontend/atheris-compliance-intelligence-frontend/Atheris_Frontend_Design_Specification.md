# Atheris — Frontend Design Specification
## Ngozi's Compliance Workspace

> **Version:** 2.0 — July 2026
> **Point of view:** Ngozi Eze, Compliance Analyst, Guaranty Trust Bank
> **Scope:** Every screen Ngozi sees, every action she takes, every pain point it solves.

---

## Who Is Ngozi

Ngozi is a compliance analyst at GTB. She has been doing this job for 6 years.
Her job, on paper, is simple: make sure the bank follows every regulation that applies to it.

In practice, she manages 350+ obligations across CBN, NDIC, NFIU, NDPC, FCCPC and more.
She tracks 187 regulatory return deadlines per year.
She tests controls, collects evidence, files reports, and produces board packs.
Most of it in Excel, email, and shared drives.

She opens her laptop at 8 AM every morning and starts chasing.

This is what her day looks like before Atheris:

```
8:00 AM   Check CBN website for new circulars (manually)
8:30 AM   Check SEC website
8:45 AM   Check NDIC website
9:00 AM   WhatsApp Emeka: "Did you complete the ATM cash test?"
9:15 AM   Email the Risk team: "Reminder — KYC refresh due Friday"
10:00 AM  Try to find evidence from March for a CBN query
11:00 AM  Still looking. Check SharePoint. Check email.
12:00 PM  Still looking. Call Emeka.
2:00 PM   Start pulling data for the board pack
6:00 PM   Board pack still not done. Data is from two weeks ago.
```

This is what her day looks like with Atheris:

```
8:00 AM   Open Atheris. Dashboard shows everything.
8:05 AM   Review 2 new obligations in inbox. Classify both.
8:10 AM   Upload evidence for CTRL-044. Mark test complete.
8:12 AM   Advance NDIC return to sign-off stage.
8:15 AM   Done. Everything else is automatic.
```

---

## The Six Pain Points

Before describing each screen, here is what Atheris is solving.

**Pain Point 1 — She checks regulator websites manually**
CBN alone publishes 80–150 instruments per year. Ngozi checks their website every morning. She sometimes finds out about a new circular because a colleague forwarded an email — 2 weeks after it was published. Half the compliance window is already gone.

**Pain Point 2 — 350+ obligations live in an Excel spreadsheet**
1,200 rows. Different columns mean different things to different people. No ownership. No audit trail. Nobody can answer: *"Show me all High-risk AML obligations with no linked control."*

**Pain Point 3 — 187 return deadlines in a shared Outlook calendar**
No preparation workflow. No reminder that prep needs to start 2 weeks before the deadline. Returns are missed because the calendar was not updated when a regulator changed their deadline.

**Pain Point 4 — Producing evidence takes days**
CBN examiners arrive. Ngozi spends 2 days searching email, SharePoint, and messaging colleagues for evidence of a test done 8 months ago. Sometimes she cannot find it — even though the test was done correctly.

**Pain Point 5 — She chases colleagues by WhatsApp**
*"Did you complete the ATM test?"* *"Did Retail submit their attestation?"* All done by WhatsApp and email. No tracking, no escalation, no record that the task was assigned.

**Pain Point 6 — The board pack takes 4 days and uses stale data**
Every quarter, 3–4 days are spent pulling data from multiple spreadsheets into a PowerPoint. By the time it is presented, the data is 2 weeks old.

---

## The Application Shell

Every page Ngozi sees shares the same outer frame.

```
┌─────────────────────────────────────────────────────────────────┐
│  🔴 Atheris · GTB Compliance              Ngozi Eze ▼   🔔 3  │
├──────────────┬──────────────────────────────────────────────────┤
│              │                                                  │
│  Navigation  │              Page content                        │
│              │                                                  │
└──────────────┴──────────────────────────────────────────────────┘
```

**Top bar:**
Left: Atheris logo and bank name — "GTB Compliance".
Right: Ngozi's name with a dropdown (profile, change password, logout). Notification bell showing unread count — clicking it opens the notifications panel.

**Left navigation — what Ngozi sees:**
```
📊  Dashboard
📥  Inbox                    [5]
📋  Obligations
🛡   Controls
⚠️   Findings
📅  Returns
📁  Audit Trail
⚙️   Settings
```

The badge on Inbox shows how many obligations are waiting for her classification.
The badge on the bell shows how many change notifications are unread.

---

## Screen 1 — The Dashboard

### The Pain Point This Solves

**Pain Point 6 — Board pack takes 4 days from stale data.**

Before Atheris, Ngozi spent 3–4 days every quarter manually pulling compliance data from spreadsheets into a PowerPoint. By the time the board saw it, the numbers were 2 weeks old. If a director asked a question in the meeting, the answer required a manual lookup the next day.

### What the Screen Looks Like

```
┌─────────────────────────────────────────────────────────────────┐
│  Good morning, Ngozi. Today is Monday 2 June 2026.              │
│  3 items need your attention before Friday's board meeting.     │
└─────────────────────────────────────────────────────────────────┘

┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│   84%    │  │   91%    │  │  100%    │  │   14     │
│Compliance│  │ Controls │  │ Returns  │  │  Open    │
│  score   │  │  tested  │  │ on time  │  │ Findings │
│ ↑3% MoM  │  │ ↓4% MoM  │  │  Q2 2026 │  │ 3 High   │
└──────────┘  └──────────┘  └──────────┘  └──────────┘

┌─────────────────────────────────┐  ┌───────────────────────────┐
│  ⚠ Needs your attention         │  │  Obligations by risk       │
│                                 │  │                            │
│  CTRL-087 AML rule review       │  │  High   ████████░░   47   │
│  Overdue 11 days                │  │  Medium █████░░░░░   116  │
│                                 │  │  Low    ███░░░░░░░    78  │
│  ISA 2025 — 4 obligations       │  │                            │
│  No linked control              │  │  12 with no control  →     │
│                                 │  │                            │
│  CBN ATM Circular updated       │  └───────────────────────────┘
│  Risk rating: Med → High        │
└─────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Returns due in the next 30 days                                │
│                                                                 │
│  Jun 10  CBN Monetary Policy Return    🔴 OVERDUE — 2 days     │
│  Jun 15  NDIC Premium Return           🟡 In progress          │
│  Jun 22  CBN FX Weekly                 ⚪ Not started           │
│  Jun 30  AML Suspicious Transaction    ⚪ Not started           │
└─────────────────────────────────────────────────────────────────┘

                        [ Generate Board Pack ]
```

### How It Works

The four metric cards pull from the nightly snapshot computed by the system. Ngozi does not compute them. She does not update them. They are correct as of this morning.

Every number is a link. "47 High risk" takes her to the obligations list filtered to High risk. "12 with no control" takes her to the gaps view. "3 Open findings" takes her to the findings screen. She clicks what she needs, she sees what matters.

The attention items panel shows the 3 most urgent things she needs to act on today. Overdue control tests. Obligations with no control. Platform notifications requiring her review.

The returns mini-calendar shows what is due in the next 30 days with colour-coded status so she knows at a glance what is on track and what is not.

The **Generate Board Pack** button calls the backend, collects all live compliance data, and downloads a formatted PDF. It contains the executive summary, compliance score trend for the past 12 months, high-risk items, control testing summary, open findings with remediation status, next quarter's returns calendar, and regulatory changes this quarter. This used to take Ngozi 4 days. Now it takes 30 seconds and the data is from this morning.

### What Ngozi Says

*"I open this at 8 AM and I already know what kind of day it is. If everything is green, I can focus on the strategic work. If something is red, I know exactly what it is and where to go. Before, I had to open 6 spreadsheets and call three people just to answer those same questions."*

---

## Screen 2 — The Obligation Inbox

### The Pain Point This Solves

**Pain Point 1 — She checks regulator websites manually.**

Before Atheris, Ngozi's morning started with manually visiting CBN, SEC, NDIC, NFIU, and FCCPC websites looking for new publications. She sometimes found out about a new CBN circular because a colleague forwarded an email. By then, the 30-day compliance window was already half gone.

### What the Screen Looks Like

```
┌─────────────────────────────────────────────────────────────────┐
│  📥 Inbox   5 obligations awaiting your review                  │
│                                                                 │
│  [ All ]  [ High risk ]  [ New this week ]                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  🔴 HIGH                                         CBN · Circular │
│  Re: Guidelines on ATM Cash Disbursement Operations             │
│  Detected 2 hours ago · Effective 1 July 2026                   │
│                                                                 │
│  "Banks must ensure all ATMs are funded within 24 hours of cash │
│  depletion. Branches with 3+ consecutive failures face          │
│  ₦1,000,000 per branch fine."                                   │
│                                                                 │
│  2 specific obligations · ₦1,000,000 per branch penalty        │
│                                                                 │
│  [ View full detail ]  [ Mark applicable ]  [ Not applicable ]  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  🟡 MEDIUM                                       CBN · Circular │
│  Framework for Regulatory Sandbox Operations                    │
│  Detected yesterday · Effective immediately                     │
│                                                                 │
│  "Banks and fintechs seeking to test innovative products must   │
│  apply to the CBN Sandbox before public launch."               │
│                                                                 │
│  1 specific obligation · ₦5,000,000 penalty                    │
│                                                                 │
│  [ View full detail ]  [ Mark applicable ]  [ Not applicable ]  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  🔴 HIGH                                        NDPC · Guideline│
│  Data Protection Compliance Framework for Financial Institutions│
│  Detected 3 days ago · Effective immediately                    │
│                                                                 │
│  "Financial institutions must appoint a qualified DPO, register │
│  with NDPC, and maintain a data processing register."          │
│                                                                 │
│  3 specific obligations · ₦10,000,000 or 2% gross revenue     │
│                                                                 │
│  [ View full detail ]  [ Mark applicable ]  [ Not applicable ]  │
└─────────────────────────────────────────────────────────────────┘
```

### How It Works

The Atheris scraper visits 43 Nigerian regulator websites every 15 minutes. When it finds a new document, it downloads the PDF, extracts the text, and sends it to Claude for classification. Claude reads the full document and produces a plain English summary, a risk rating, the specific obligations inside it, the sanctions and liable roles, and which licence types it applies to.

By the time Ngozi opens her laptop in the morning, the inbox card already shows her a 2-sentence summary of what the circular says. She does not open the PDF unless she wants to verify something. She reads the card, decides, and moves on.

Cards are sorted: High risk first, then Medium, then Low. Within the same risk level, newest first.

**"Mark applicable"** opens a small drawer on the right. Ngozi types a one-line reasoning (*"GTB operates ATMs in 500+ locations"*) and confirms. The obligation moves to the Obligations Register. The platform records that GTB is watching this obligation — if it ever gets updated or superseded, Ngozi will be notified automatically.

**"Not applicable"** asks for a one-line reason (*"GTB does not hold a capital markets licence"*) and removes the card from the inbox. The decision is recorded permanently in the audit trail.

**"View full detail"** takes Ngozi to Screen 3.

### What Ngozi Says

*"Before, I found out about the CBN ATM circular when my manager forwarded an email — 16 days after it was published. I had 14 days left out of a 30-day window. Now I see it 2 hours after CBN publishes it, with a plain English summary already written. I do not visit a single website anymore."*

---

## Screen 3 — Obligation Detail

### The Pain Point This Solves

**Pain Point 2 — 350+ obligations in an unstructured spreadsheet (first half).**

Before Atheris, when Ngozi received an email about a new circular she had to open the PDF, read 40 pages of legalese, figure out which parts applied to GTB, extract the specific duties, note the penalty amounts and liable roles, and paste it all into her spreadsheet — manually. This took 30–60 minutes per circular.

### What the Screen Looks Like

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to inbox                                                │
│                                                                 │
│  Re: Guidelines on ATM Cash Disbursement Operations             │
│  CBN · Circular · Issued 28 May 2026 · Effective 1 July 2026   │
│                                                                 │
│  🔴 High risk (platform rating)             [ View original PDF]│
└─────────────────────────────────────────────────────────────────┘

┌───────────────────────────┐  ┌───────────────────────────────┐
│  AI Summary               │  │  Your classification          │
│                           │  │                               │
│  Banks must ensure all    │  │  Status: Unclassified         │
│  ATMs are funded within   │  │                               │
│  24 hours of cash         │  │  [ ✓ Mark applicable ]        │
│  depletion. Branches      │  │  [ ✗ Mark not applicable ]    │
│  with 3+ consecutive      │  │  [ ? Under review ]           │
│  failures face ₦1m per    │  │                               │
│  branch fine. Effective   │  │  After marking applicable,    │
│  1 July 2026.             │  │  assign owner + link controls │
└───────────────────────────┘  └───────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Specific obligations extracted by AI                           │
│                                                                 │
│  1.  All ATMs must be funded within 24 hours of cash depletion  │
│      Section 4.1 · Type: Operational · Frequency: Continuous    │
│                                                                 │
│  2.  Banks must report ATM downtime exceeding 48 hours to CBN   │
│      Section 5.2 · Type: Reporting · Frequency: As needed       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Sanctions and penalties                                        │
│                                                                 │
│  ₦1,000,000 per branch · Per incident                          │
│  Liable roles: MD, Head Operations, Chief Compliance Officer    │
│  Severity: 8 / 10                                               │
│  ⚠ Recently enforced — November 2025                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Applicable to                                                  │
│  Commercial Bank · Merchant Bank                                │
│  Platform confidence: 97%                                       │
└─────────────────────────────────────────────────────────────────┘
```

### How It Works

Everything on this screen was produced by the AI classifier reading the original PDF. Ngozi did not write any of it. She reads the summary (2 sentences), the specific obligations (numbered, with section references), the sanctions (exact naira amounts, liable roles, enforcement history), and the applicable licence types.

If she wants to read the original, she clicks **"View original PDF"** which opens the PDF in a new tab via a signed link from S3.

When she clicks **"Mark applicable"**, a drawer slides in from the right:

```
┌─────────────────────────────────────────────────────────────────┐
│  Mark as applicable                                             │
│                                                                 │
│  Reasoning (optional but recommended for audit trail)           │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ GTB operates ATMs in 500+ locations across Nigeria.       │ │
│  │ This obligation applies directly to our operations.       │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [ Confirm — Mark applicable ]           [ Cancel ]             │
│                                                                 │
│  After this, assign an owner and link controls                  │
│  in the Obligations Register.                                   │
└─────────────────────────────────────────────────────────────────┘
```

On confirm the obligation moves to the Obligations Register with status "Classified". The audit trail records who made the decision, when, and what reasoning they gave.

### What Ngozi Says

*"Before, I had to open the CBN PDF, read 40 pages, figure out which sections applied to GTB, write the summary myself, note the penalty, and paste everything into my spreadsheet. Now I read 2 sentences and click a button. The AI already did the 40 pages."*

---

## Screen 4 — Obligations Register

### The Pain Point This Solves

**Pain Point 2 — 350+ obligations in an unstructured spreadsheet (complete solution).**

Before Atheris, every obligation lived in a 1,200-row Excel spreadsheet. There was no enforced structure, no ownership column that was kept up to date, no way to filter to *"show me all High-risk obligations with no linked control"*, and no audit trail of who changed what.

### What the Screen Looks Like

```
┌─────────────────────────────────────────────────────────────────┐
│  📋 Obligations Register   353 active obligations               │
│                                                                 │
│  🔍 Search obligations...                                       │
│                                                                 │
│  Risk: [ All ▼ ]  Regulator: [ All ▼ ]  Theme: [ All ▼ ]      │
│  Owner: [ All ▼ ]  Status: [ All ▼ ]         [ Has gap ☐ ]     │
└─────────────────────────────────────────────────────────────────┘

┌──┬──────────────────────────────────────┬───────┬────────┬──────┐
│# │  Obligation                          │ Risk  │ Owner  │Status│
├──┼──────────────────────────────────────┼───────┼────────┼──────┤
│353│ ATM Cash Disbursement 2026          │🔴 High│ Ngozi  │Active│
│352│ Sandbox Framework                   │🟡 Med │ Ngozi  │Active│
│351│ Data Protection Compliance          │🔴 High│ Ngozi  │⚠ Gap │
│350│ KYC Refresh — Retail                │🔴 High│ Ngozi  │Active│
│349│ AML Suspicious Transaction Rep.     │🔴 High│ Ngozi  │Active│
└──┴──────────────────────────────────────┴───────┴────────┴──────┘

                    Showing 1–20 of 353  [ < 1 2 3 ... 18 > ]
```

### The Detail Panel

Clicking any row opens a detail panel on the right without navigating away:

```
┌──────────────────────┬──────────────────────────────────────────┐
│  [353 rows]          │  ATM Cash Disbursement 2026              │
│                      │  CBN · Circular · High risk              │
│                      │                                          │
│  [list continues]    │  Your classification                     │
│                      │  Applicable — confirmed by Ngozi Eze     │
│                      │  3 June 2026                             │
│                      │  Reasoning: GTB operates ATMs in 500+    │
│                      │  locations across Nigeria.               │
│                      │                                          │
│                      │  Internal risk rating: High              │
│                      │  Risk justification: ₦1m per branch,     │
│                      │  CBN actively enforces. GTB has 500+     │
│                      │  ATM locations.                          │
│                      │                                          │
│                      │  Compliance owner: Ngozi Eze             │
│                      │  Department: Compliance                  │
│                      │                                          │
│                      │  Linked controls                         │
│                      │  ✅ CTRL-044 Monthly ATM monitoring      │
│                      │  ✅ CTRL-045 Automated ATM alert         │
│                      │                                          │
│                      │  Return required: Yes → Monthly          │
│                      │  CCO approved: ✅ 3 June 2026            │
│                      │  Version: 1                              │
│                      │                                          │
│                      │  [ Edit classification ]                 │
│                      │  [ View history ]                        │
└──────────────────────┴──────────────────────────────────────────┘
```

### The Edit Classification Drawer

When Ngozi clicks "Edit classification" she fills in all the deeper compliance fields:

```
┌─────────────────────────────────────────────────────────────────┐
│  Edit classification: ATM Cash Disbursement 2026                │
│                                                                 │
│  Compliance owner (who is responsible at GTB?)                  │
│  [ Ngozi Eze — Head, Compliance ▼ ]                            │
│                                                                 │
│  Internal risk rating                                           │
│  (●) High   ( ) Medium   ( ) Low                               │
│                                                                 │
│  Risk justification                                             │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ ₦1m per branch, CBN actively enforces. GTB has 500+       │ │
│  │ ATM locations across Nigeria.                             │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Linked controls                                                │
│  ✅ CTRL-044  ✅ CTRL-045   [ + Add control ]                  │
│                                                                 │
│  Is there a gap? (no control covers this obligation)            │
│  ( ) Yes   (●) No                                              │
│                                                                 │
│  Upload supporting evidence (optional)                          │
│  [ 📎 GTB_ATM_Operations_Policy.pdf   ✓ Uploaded ]             │
│                                                                 │
│  Reason for update                                              │
│  [ Controls confirmed after internal CRMP review      ]        │
│                                                                 │
│  [ Save changes ]                                               │
└─────────────────────────────────────────────────────────────────┘
```

Ngozi can upload evidence at this point — a policy document, an internal memo, or a board approval document that supports the classification. It is stored in S3 and linked to this version of the classification in the audit trail.

### The Gap Filter

The **"Has gap"** checkbox is the most powerful filter in the entire application. Ngozi ticks it and sees every obligation where she has marked `has gap = true` — meaning the obligation applies to GTB but there is no control that covers it. This is her exposure list. This is what she brings to the board when they ask: *"Where are we unprotected?"*

### The History Tab

Clicking "View history" shows every version of the classification:

```
┌─────────────────────────────────────────────────────────────────┐
│  Classification history: ATM Cash Disbursement 2026             │
│                                                                 │
│  Version 2 — 10 June 2026 — Ngozi Eze                          │
│  Changed: Risk rating Medium → High                             │
│  Reason: Platform notification — CBN updated risk classification│
│  Evidence: [ATM_Policy_June2026.pdf ↗]                         │
│                                                                 │
│  Version 1 — 3 June 2026 — Ngozi Eze                           │
│  Initial classification: Applicable                             │
│  Reasoning: GTB operates ATMs in 500+ locations                 │
└─────────────────────────────────────────────────────────────────┘
```

Every change is preserved. Every piece of evidence is linked. The hash chain underneath means none of this can be altered after the fact.

### What Ngozi Says

*"My Excel had 1,200 rows and zero structure. I could not answer basic questions. Now I can filter by risk, by regulator, by theme, by owner, by gap status. If the CBN examiner asks 'show me all your High-risk AML obligations and their controls' — I have that answer in 5 seconds."*

---

## Screen 5 — Controls Register

### The Pain Point This Solves

**Pain Point 5 — Chasing colleagues by WhatsApp (the control testing side).**

Before Atheris, control tests were scheduled in Ngozi's head or in the spreadsheet. She sent WhatsApp messages to remind Emeka to run the ATM cash test. Sometimes he forgot. Sometimes she forgot to remind him. There was no formal record that the test was assigned.

### What the Screen Looks Like

```
┌─────────────────────────────────────────────────────────────────┐
│  🛡 Controls Register   150 active controls                     │
│                                                                 │
│  Theme: [ All ▼ ]  Owner: [ All ▼ ]  Residual risk: [ All ▼ ]  │
│                                                  [ + Add control]│
└─────────────────────────────────────────────────────────────────┘

┌────────┬──────────────────────────────┬────────┬───────┬───────┐
│ Number │ Control                      │ Owner  │Resid. │ Next  │
│        │                              │        │ Risk  │ Test  │
├────────┼──────────────────────────────┼────────┼───────┼───────┤
│CTRL-044│ Monthly ATM Cash Monitoring  │ Ngozi  │🟢 Low │Jun 30 │
│CTRL-045│ Automated ATM Cash Alert     │ Ngozi  │🟢 Low │Jun 30 │
│CTRL-087│ AML Rule Review              │ Ngozi  │🔴 High│OVERDUE│
│CTRL-031│ Monthly Liquidity Test       │ Ngozi  │🟢 Low │Jun 18 │
│CTRL-056│ NDPC Data Inventory Review   │ Ngozi  │🟡 Med │Jul 5  │
└────────┴──────────────────────────────┴────────┴───────┴───────┘
```

### Control Detail Screen

```
┌─────────────────────────────────────────────────────────────────┐
│  CTRL-044 · Monthly ATM Cash Monitoring                         │
│  Theme: Cash Management · Owner: Ngozi Eze                      │
│  Inherent risk: High · Residual risk: 🟢 Low (test passing)    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  What this control does                                         │
│                                                                 │
│  Reviews ATM cash levels monthly against minimum thresholds.    │
│  Pulls the ATM cash position report from core banking and       │
│  verifies no branch fell below the minimum for the period.      │
│                                                                 │
│  How it is tested                                               │
│                                                                 │
│  Pull the ATM daily cash position report for the month.         │
│  Verify no branch recorded cash below ₦500,000 for more than   │
│  4 consecutive hours. Upload the monthly summary as evidence.   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Linked obligations                                             │
│  → ATM Cash Disbursement 2026 (CBN)                             │
│  → ATM Operations Framework 2024 (CBN)                          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Test history                               Next test: Jun 30   │
│                                                                 │
│  May 2026  ✅ Passed  Reviewed: Ngozi Eze   [📄 May_Report.pdf]│
│  Apr 2026  ✅ Passed  Reviewed: Ngozi Eze   [📄 Apr_Report.pdf]│
│  Mar 2026  ❌ Failed  Finding: FIND-012     [📄 Mar_Report.pdf]│
│  Feb 2026  ✅ Passed  Reviewed: Ngozi Eze   [📄 Feb_Report.pdf]│
│                                                                 │
│  [ Record test result ]                                         │
└─────────────────────────────────────────────────────────────────┘
```

The residual risk is computed automatically from test results. When a test passes, residual risk drops to Low. When it fails, residual risk jumps back to the inherent risk level. Ngozi does not set this manually.

The failed March 2026 row is clickable — it links directly to Finding FIND-012 which was auto-raised when that test failed.

### Recording a Test Result

Ngozi clicks "Record test result" from the control detail screen:

```
┌─────────────────────────────────────────────────────────────────┐
│  Record test result: CTRL-044                                   │
│  Monthly ATM Cash Monitoring                                    │
│                                                                 │
│  Test date   [ 2 June 2026          ]                           │
│                                                                 │
│  Result                                                         │
│  ( ) ✅ Passed    (●) ❌ Failed    ( ) ⚠ Partial               │
│                                                                 │
│  What did you test?                                             │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Reviewed ATM cash position report for May 2026. Kano      │ │
│  │ Sabon Gari branch recorded cash below ₦500k for 6 hours   │ │
│  │ on 14 May. All other branches within threshold.           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Failure details                                                │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Kano Sabon Gari branch · 14 May · 6 hours below minimum  │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Failure severity   ( ) Low   (●) Medium   ( ) High            │
│                                                                 │
│  Evidence (upload your test documentation)                      │
│  [ 📎 ATM_Cash_Report_May2026.pdf   ✓ Uploaded ]               │
│                                                                 │
│  Remediation required?   (●) Yes   ( ) No                      │
│  Deadline:  [ 15 June 2026 ]                                    │
│                                                                 │
│  [ Submit test result ]                                         │
└─────────────────────────────────────────────────────────────────┘
```

Ngozi uploads the ATM cash report as evidence directly from this screen. It goes to S3 and is permanently linked to this test result. When she clicks Submit:

1. Test result saved
2. Because result is Failed → Finding FIND-022 auto-raised
3. Control residual risk updated to Medium
4. Next test scheduled for July 30 automatically
5. Audit trail entry written: *"Ngozi Eze recorded test result for CTRL-044 (Failed). Evidence: ATM_Cash_Report_May2026.pdf. Finding FIND-022 raised."*

No WhatsApp. No email. No manual finding creation. It all happened when she clicked Submit.

### What Ngozi Says

*"Before, I used to WhatsApp Emeka to remind him to run the ATM test. Then wait. Then remind him again. Then manually create the finding in my spreadsheet when he told me it failed. Now I run the test myself, upload the evidence, and the finding appears automatically. The whole process went from 3 days to 5 minutes."*

---

## Screen 6 — Findings

### The Pain Point This Solves

**Pain Point 5 — Chasing colleagues by WhatsApp (the remediation side).**

Before Atheris, when a control failed Ngozi had to manually create a finding in her spreadsheet, assign a remediation owner by email, chase them weekly for updates, and manually mark it closed when they were done. There was no SLA tracking, no escalation, and no record that any of this happened.

### What the Screen Looks Like

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠ Findings   14 open                                          │
│                                                                 │
│  Status: [ Open ▼ ]  Severity: [ All ▼ ]  [ Overdue only ☐ ]  │
└─────────────────────────────────────────────────────────────────┘

┌────────┬──────────────────────────────────┬───────┬────────────┐
│  ID    │  Finding                         │ Sev.  │  Status    │
├────────┼──────────────────────────────────┼───────┼────────────┤
│FIND-022│ CTRL-044 failed · Kano branch    │🟡 Med │ Open       │
│FIND-021│ AML rule review overdue 8 days   │🔴 High│ Open       │
│FIND-018│ NDPC DPO not yet appointed       │🔴 High│ Remediation│
│FIND-012│ CTRL-044 failed · March 2026     │🟢 Low │ Closed ✓   │
└────────┴──────────────────────────────────┴───────┴────────────┘
```

### Finding Detail — The Full Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│  FIND-018 · High Severity · In Remediation                      │
│  NDPC Data Protection Officer not yet appointed                 │
│  SLA: 14 days · 4 days remaining                                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Timeline                                                       │
│                                                                 │
│  ● 10 Apr 2026   Finding raised by Ngozi Eze (manual discovery) │
│                  "No DPO appointed. NDPC registration overdue." │
│                                                                 │
│  ● 10 Apr 2026   Assigned to Head, IT Security                  │
│                  Deadline: 10 May 2026                          │
│                                                                 │
│  ● 11 May 2026   SLA breached — auto-escalated to CCO          │
│                                                                 │
│  ● 15 May 2026   Progress note added by Head, IT Security       │
│                  "DPO candidate shortlisted. Interview 20 May"  │
│                                                                 │
│  ● 2 Jun 2026    Remediation submitted by Ngozi Eze             │
│                  "DPO appointed. Appointment letter uploaded."  │
│                  Evidence: [📄 DPO_Appointment_Letter.pdf ↗]   │
│                                                                 │
│  ○ Pending       CCO sign-off to close finding                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Linked obligation                                              │
│  NDPC Data Protection Compliance Framework                      │
│  Potential penalty: ₦10,000,000 or 2% gross revenue            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Submit remediation evidence                                    │
│                                                                 │
│  Remediation notes                                              │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ DPO has been appointed. Appointment letter attached.       │ │
│  │ NDPC registration submitted 1 June 2026.                  │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Evidence                                                       │
│  [ 📎 DPO_Appointment_Letter_June2026.pdf   ✓ Uploaded ]       │
│  [ 📎 NDPC_Registration_Confirmation.pdf   ✓ Uploaded ]        │
│  [ + Add another document ]                                     │
│                                                                 │
│  [ Submit remediation ]                                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  CCO sign-off                        (visible to CCO role only) │
│                                                                 │
│  Remediation submitted — evidence reviewed                      │
│                                                                 │
│  [ ✓ Close finding ]                                            │
└─────────────────────────────────────────────────────────────────┘
```

### Raising a Finding Manually

When Ngozi discovers a gap that was not caught by a control test, she raises it manually:

```
┌─────────────────────────────────────────────────────────────────┐
│  Raise new finding                                              │
│                                                                 │
│  Finding type                                                   │
│  (●) Gap (no control exists)                                    │
│  ( ) Control failure (test failed)                              │
│  ( ) Process weakness                                           │
│                                                                 │
│  Severity                                                       │
│  ( ) Critical   (●) High   ( ) Medium   ( ) Low                │
│                                                                 │
│  Description                                                    │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ GTB has not yet appointed a Data Protection Officer as    │ │
│  │ required by the NDPC Data Protection Compliance Framework.│ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Root cause                                                     │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Obligation was classified as applicable in April 2026 but │ │
│  │ action was not immediately taken.                         │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Linked obligation (optional)                                   │
│  [ NDPC Data Protection Compliance Framework ▼ ]               │
│                                                                 │
│  Assign remediation to                                          │
│  [ Head, IT Security ▼ ]                                        │
│                                                                 │
│  Remediation deadline   [ 10 May 2026 ]                         │
│  SLA: 14 days (High severity)                                   │
│                                                                 │
│  Supporting evidence (optional)                                 │
│  [ 📎 Upload document ]                                         │
│                                                                 │
│  [ Raise finding ]                                              │
└─────────────────────────────────────────────────────────────────┘
```

### What Ngozi Says

*"Before, findings lived in my spreadsheet and remediation was tracked by email. I had no idea if IT Security had actually done anything until I chased them. Now I raise the finding, the system tracks it, the SLA countdown starts, and if the deadline passes the CCO is automatically notified. I do not chase anyone for finding remediation anymore."*

---

## Screen 7 — Returns Calendar

### The Pain Point This Solves

**Pain Point 3 — 187 return deadlines with no safety net.**

Before Atheris, all 187 regulatory returns were tracked in a shared Outlook calendar. No preparation workflow. No reminder that data gathering needed to start 2 weeks before the filing date. Returns were missed because the calendar was not updated when a regulator changed their deadline. When a return was missed, Ngozi found out when someone called her.

### What the Screen Looks Like

```
┌─────────────────────────────────────────────────────────────────┐
│  📅 Returns Calendar                                            │
│                                                                 │
│  [ Next 30 days ▼ ]   [ All regulators ▼ ]    [ + Add return ] │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  🔴 OVERDUE                                                     │
│  CBN Monetary Policy Return                    Was due Jun 10   │
│  Prep ✅ · Draft ✅ · Review ✅ · ⏳ Sign-off · Submit         │
│  Stage: Sign-off · CCO · 2 days overdue                        │
│                                                                 │
│  [ Advance to submitted ]                                       │
├─────────────────────────────────────────────────────────────────┤
│  🟡 In progress                                                 │
│  NDIC Premium Return                           Due Jun 15       │
│  Prep ✅ · Draft ✅ · ⏳ Review · Sign-off · Submit            │
│  Stage: Review · Ngozi Eze · 3 days left                       │
│                                                                 │
│  [ Advance to sign-off ]                                        │
├─────────────────────────────────────────────────────────────────┤
│  ⚪ Not started                                                  │
│  CBN Foreign Exchange Weekly Return            Due Jun 22       │
│  Prep starts: Jun 17 (auto-calculated)                          │
│                                                                 │
│  [ Start preparation ]                                          │
├─────────────────────────────────────────────────────────────────┤
│  ⚪ Not started                                                  │
│  AML Suspicious Transaction Report             Due Jun 30       │
│  Prep starts: Jun 20 (auto-calculated)                          │
│                                                                 │
│  [ Start preparation ]                                          │
└─────────────────────────────────────────────────────────────────┘
```

### Filing Instance Detail

Clicking on a return card opens the full filing instance:

```
┌─────────────────────────────────────────────────────────────────┐
│  NDIC Premium Return · June 2026 · Due 15 June 2026             │
│  Filing channel: NDIC Portal                                    │
│  Return owner: Ngozi Eze                                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Stages                                                         │
│                                                                 │
│  ✅ Data Gathering    Completed 1 Jun · [📄 Raw_Data.xlsx ↗]   │
│  ✅ Draft             Completed 3 Jun · [📄 Draft_Return.pdf ↗] │
│  ⏳ Review            In progress · Ngozi Eze · 3 days left    │
│  ○  Sign-off          CCO                                       │
│  ○  Submitted         NDIC Portal                               │
│                                                                 │
│  Upload stage evidence                                          │
│  [ 📎 NDIC_Reviewed_June2026.pdf   ✓ Uploaded ]                │
│                                                                 │
│  [ Mark Review complete → advance to Sign-off ]                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Submit return                                                  │
│  (available after Sign-off stage is completed)                  │
│                                                                 │
│  After filing on the NDIC portal, upload the submission receipt │
│                                                                 │
│  [ 📎 Upload submission receipt ]                               │
│                                                                 │
│  [ Mark as submitted ]                                          │
└─────────────────────────────────────────────────────────────────┘
```

### How the Stages Work

Each return has 5 stages: Data Gathering → Draft → Review → Sign-off → Submitted.

Ngozi manages all stages for most returns. For each stage she:
1. Does the work
2. Uploads the stage evidence directly from the screen
3. Clicks to advance to the next stage

The system auto-calculates when preparation needs to start based on the filing deadline and a configurable offset (e.g. "start prep 7 days before due date"). Ngozi does not track preparation start dates in a calendar anymore.

When she advances to Sign-off, the CCO is notified automatically. When the CCO approves, Ngozi uploads the submission receipt from the regulator's portal, marks the return as submitted, and the stage is permanently recorded.

If a return is not in the Submitted status by its due date, it turns red and the escalation logic fires.

### What Ngozi Says

*"187 returns in an Outlook calendar with no workflow was an accident waiting to happen. We missed a CBN return in 2024 because the date changed and nobody updated the calendar. The fine was ₦2 million. Now every return has a prep start date, a staged workflow, and auto-escalation if anything slips. We have not missed a return since we started using Atheris."*

---

## Screen 8 — Audit Trail and Evidence Vault

### The Pain Point This Solves

**Pain Point 4 — Producing evidence takes days.**

Before Atheris, when CBN examiners arrived for a regulatory examination, Ngozi spent 2 days searching email, SharePoint, and WhatsApp conversations to find evidence of tests done 8 months ago. Sometimes the evidence simply could not be found — even when the test had actually been done correctly. The bank looked non-compliant even when it was compliant.

### What the Screen Looks Like

```
┌─────────────────────────────────────────────────────────────────┐
│  📁 Audit Trail                                                 │
│                                                                 │
│  Subject: [ All ▼ ]  Actor: [ All ▼ ]  Date: [ Jun 2026 ▼ ]   │
│                                                                 │
│  🔗 Hash chain: VERIFIED ✓                     [ Export pack ] │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┬──────────────────────────────────┬──────────────┐
│  Time        │  Action                          │  Evidence    │
├──────────────┼──────────────────────────────────┼──────────────┤
│Jun 02 11:32  │ Ngozi recorded CTRL-044 test     │ 📄 Report.pdf│
│Jun 02 11:33  │ Finding FIND-022 auto-raised     │              │
│Jun 02 14:15  │ Ngozi reviewed test — Submitted  │              │
│Jun 02 09:12  │ Ngozi advanced NDIC return stage │ 📄 Draft.pdf │
│Jun 01 09:00  │ Ngozi classified CBN circular    │              │
│May 31 02:14  │ Platform detected CBN circular   │              │
└──────────────┴──────────────────────────────────┴──────────────┘
```

### Filtering by Subject

When CBN examiners ask Ngozi to prove that CTRL-044 was tested consistently throughout 2026, she filters by subject:

```
Subject: [ Control ▼ ]   Control: [ CTRL-044 ]

Results — CTRL-044 (Monthly ATM Cash Monitoring) — Jan to Jun 2026

Jun 02  Ngozi recorded test (Failed) · Evidence: [📄 May_Report.pdf]
Jun 02  Finding FIND-022 auto-raised
May 01  Ngozi recorded test (Passed) · Evidence: [📄 Apr_Report.pdf]
Apr 03  Ngozi recorded test (Passed) · Evidence: [📄 Mar_Report.pdf]
Mar 05  Ngozi recorded test (Failed) · Evidence: [📄 Feb_Report.pdf]
Mar 05  Finding FIND-012 auto-raised
Mar 20  Finding FIND-012 remediated · Evidence: [📄 Remediation.pdf]
Feb 05  Ngozi recorded test (Passed) · Evidence: [📄 Jan_Report.pdf]
Jan 02  Ngozi created control CTRL-044
```

Six months of tests, findings, and evidence — visible in 5 seconds. Every evidence document is downloadable directly from this screen.

### The Hash Chain Verification Banner

At the top of every audit trail: **🔗 Hash chain: VERIFIED ✓**

This calls the verify endpoint on page load and checks that no record in the audit trail has been altered after the fact. If the chain is broken: **⚠ Hash chain: BROKEN — contact your system administrator.** This means someone attempted to tamper with the records. This makes the audit trail credible to external examiners.

### The Evidence Pack Button

When CBN examiners arrive, Ngozi clicks **Export pack**. The system generates a ZIP file containing:

- `audit_trail.csv` — the full audit log for the selected period and subject
- `evidence/` folder — all evidence documents linked in the log
- `hash_verification.txt` — proof that the chain is intact

She hands the examiner the ZIP. Or she gives them a VIEWER login so they can browse it themselves.

No 2-day search. No calling colleagues. No digging through SharePoint.

### What Ngozi Says

*"CBN examiners showed up in March and asked for evidence of all our AML control tests for 2025. Before Atheris I would have spent 2 days finding emails and documents. With Atheris I filtered the audit trail to AML controls, date range 2025, clicked Export pack, and handed them a ZIP file in 3 minutes. They were visibly surprised."*

---

## Screen 9 — Change Notifications Panel

### The Pain Point This Solves

**Pain Point 1 — Being notified when existing regulations are updated.**

The inbox handles new regulations. But regulations also get updated after Ngozi has already classified them. A CBN circular she marked applicable in January might be amended in July — risk rating changed, new obligation added. Without a notification system, Ngozi would not know.

### How It Opens

Ngozi clicks the 🔔 bell in the top bar. A panel slides in from the right. The badge on the bell shows the number from `GET /api/v1/notifications/count`.

### What the Panel Looks Like

```
┌─────────────────────────────────────────────────────────────────┐
│  🔔 Notifications (3 unread)              [ Mark all read ]     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  🔴 HIGH · Unread                                               │
│  CBN ATM Cash Disbursement circular updated                     │
│                                                                 │
│  What changed:                                                  │
│  Risk rating: ~~Medium~~  →  High                               │
│  New obligation added: Section 6.1 — "Banks must submit         │
│  monthly ATM uptime reports to CBN"                             │
│                                                                 │
│  Your classification: Applicable                                │
│  Owner: Ngozi Eze · Controls: CTRL-044, CTRL-045               │
│                                                                 │
│  [ Review and update ]    [ Confirm — no change needed ]        │
├─────────────────────────────────────────────────────────────────┤
│  🟡 MEDIUM · Unread                                             │
│  CBN Sandbox Framework — applicability now confirmed            │
│                                                                 │
│  What changed:                                                  │
│  Applicability confidence: 40%  →  92%                          │
│  Confirmed licence types: Commercial Bank, Fintech              │
│                                                                 │
│  Your classification: Under review                              │
│                                                                 │
│  [ Review and update ]                                          │
├─────────────────────────────────────────────────────────────────┤
│  🟢 LOW · Read                                                  │
│  NFIU Threshold Reporting Directive — penalty updated           │
│                                                                 │
│  What changed:                                                  │
│  Penalty per incident: ₦500,000  →  ₦1,000,000                │
│                                                                 │
│  Your classification: Applicable                                │
│                                                                 │
│  [ Confirm — no change needed ]                                 │
└─────────────────────────────────────────────────────────────────┘
```

### "Review and update" Action

Clicking "Review and update" opens the obligation classification screen directly, with the diff shown at the top:

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠ This obligation was updated by the platform                  │
│                                                                 │
│  Risk rating changed: Medium → High                             │
│  New obligation in Section 6.1 added                            │
│                                                                 │
│  Please review your classification and confirm it is still      │
│  correct, or update it below.                                   │
└─────────────────────────────────────────────────────────────────┘

[ full classification edit form below — same as Screen 4 ]
```

If Ngozi decides the change affects her controls she updates the classification, links an additional control, or raises a gap finding. If nothing needs to change she clicks "Confirm — no change needed" and the notification is acknowledged. Either way, the audit trail records: *"Ngozi Eze reviewed platform update on [date]. Action taken: [confirmed / updated]."*

### "Confirm — no change needed" Action

This is a one-click acknowledgement. It records in the audit trail that Ngozi reviewed the change and confirmed her classification remains correct. CBN examiners will see this record if they ask: *"Were you aware that this circular was updated?"*

### What Ngozi Says

*"Before, if CBN updated a circular I had already classified, I had no way of knowing. I might find out months later when an examiner pointed it out. Now I get a notification within the hour, I see exactly what changed, and I confirm or update my classification. The examiner can see that I reviewed every single update."*

---

## The Complete Morning — Ngozi at 8 AM

This is what Ngozi's morning looks like with Atheris. Everything she does is on one screen. All of it is recorded automatically.

```
8:00  Opens Atheris. Dashboard loads.

      She sees:
        Compliance score: 84% ↑3%
        2 new obligations in inbox
        1 notification: a circular was updated
        CTRL-087 test overdue (auto-escalated already)
        NDIC return: Review stage due today

8:01  Opens notification panel.
      Reads: CBN ATM circular — risk rating Medium → High.
      New obligation in Section 6.1 added.
      Her classification is still correct — CTRL-044 covers it.
      Clicks "Confirm — no change needed."
      Time: 45 seconds. Audit trail: written.

8:02  Opens inbox.
      Reads card 1: NDPC circular about transaction monitoring.
      2-sentence AI summary. High risk. ₦5m penalty.
      Clicks "Mark applicable."
      Types reasoning: "GTB processes thousands of transactions daily."
      Confirms.
      Time: 90 seconds. Obligation in register. Watch created.

8:04  Reads card 2: SEC exposure draft on margin lending limits.
      Low risk. GTB does not offer margin lending.
      Clicks "Not applicable."
      Types reason: "GTB does not offer margin lending products."
      Confirms.
      Time: 30 seconds. Classified. Audit trail written.

8:05  Goes to Controls Register.
      Clicks CTRL-044. Clicks "Record test result."
      Result: Passed.
      Writes: "Reviewed May ATM cash position report. All branches
      within threshold for the full month."
      Uploads: ATM_Cash_Report_May2026.pdf
      Clicks Submit.
      Time: 3 minutes. Test recorded. Evidence stored.
      Next test auto-scheduled for Jul 2.

8:08  Goes to Returns Calendar.
      Clicks NDIC Premium Return.
      Uploads: NDIC_Review_June2026.pdf
      Clicks "Mark Review complete → advance to Sign-off."
      CCO notified automatically.
      Time: 1 minute.

8:09  Done. Opens her actual compliance work.

Previously: This took until noon.
```

---

## Pain Points vs Screens — Summary

| Pain Point | Before Atheris | Screen | What Changed |
|---|---|---|---|
| 1 — Checks websites manually | Visits 12 regulator websites every morning. Finds out about circulars via forwarded emails weeks later. | Inbox + Notifications | Obligations detected within 15 minutes of publication. Change notifications fire when classified obligations are updated. Ngozi never visits a regulator website. |
| 2 — 350+ obligations in Excel | 1,200-row spreadsheet. No structure. No ownership. Cannot filter. No audit trail. | Inbox + Obligations Register | Structured register with full-text search, risk filter, gap filter, owner filter. AI writes the plain-English summary. Every change is logged. |
| 3 — 187 deadlines in calendar | Shared Outlook calendar. No workflow. No prep reminders. Returns missed when deadlines change. | Returns Calendar | Multi-stage workflow per return. Prep start dates auto-calculated. Escalation fires if stages slip. Ngozi sees every return's exact stage at a glance. |
| 4 — Evidence takes 2 days | Searches email and SharePoint. Calls colleagues. Sometimes cannot find it. | Audit Trail | Every action auto-logged. Every uploaded document permanently linked. Evidence pack generated in one click. VIEWER login for examiners. |
| 5 — Chases colleagues by WhatsApp | Sends reminder messages. Manually creates findings. No tracking. No escalation. | Controls + Findings | Ngozi runs tests herself and uploads evidence directly. Findings auto-raised on failure. SLA countdown automatic. Escalation automatic. |
| 6 — Board pack takes 4 days | Pulls from spreadsheets manually. Data is 2 weeks old. Board asks questions she cannot answer. | Dashboard | Live metrics computed nightly. Board pack generated in 30 seconds. Data is from this morning. |

---

## API Endpoints — Every Screen Action

### Dashboard
| Action | Endpoint |
|---|---|
| Load metrics | GET /api/v1/dashboard/summary |
| Load attention items | GET /api/v1/dashboard/attention-items |
| Load compliance trend | GET /api/v1/dashboard/trends |
| Load returns mini-calendar | GET /api/v1/returns/calendar?days=30 |
| Generate board pack | POST /api/v1/dashboard/board-pack/export |
| Manual refresh | POST /api/v1/dashboard/refresh |

### Inbox
| Action | Endpoint |
|---|---|
| Load inbox | GET /api/v1/obligations/inbox |
| Mark applicable | POST /api/v1/obligations/{id}/classify |
| Mark not applicable | POST /api/v1/obligations/{id}/classify |

### Obligations Register
| Action | Endpoint |
|---|---|
| Load register | GET /api/v1/obligations?applicability=applicable |
| Search | GET /api/v1/obligations?q=AML |
| Filter by risk | GET /api/v1/obligations?tenantRiskRating=High |
| View gaps | GET /api/v1/obligations/gaps |
| View pending CCO approval | GET /api/v1/obligations/pending-approval |
| Edit classification | PUT /api/v1/obligations/{id}/classify |
| Upload classification evidence | PUT /api/v1/obligations/{id}/classify (with evidenceUrl in body) |
| CCO approve | POST /api/v1/obligations/{id}/approve |
| View history | GET /api/v1/obligations/{id}/history |

### Controls
| Action | Endpoint |
|---|---|
| Load controls | GET /api/v1/controls |
| Create control | POST /api/v1/controls |
| Edit control | PUT /api/v1/controls/{id} |
| View test history | GET /api/v1/controls/{id}/tests |
| Record test result | POST /api/v1/controls/{id}/tests |
| Review test | PUT /api/v1/controls/{id}/tests/{testId}/review |

### Findings
| Action | Endpoint |
|---|---|
| Load findings | GET /api/v1/findings |
| Load open findings | GET /api/v1/findings/open |
| Load overdue findings | GET /api/v1/findings/overdue |
| Raise finding manually | POST /api/v1/findings |
| Assign to owner | PUT /api/v1/findings/{id}/assign |
| Submit remediation + evidence | PUT /api/v1/findings/{id}/remediate |
| CCO close finding | PUT /api/v1/findings/{id}/close |

### Returns
| Action | Endpoint |
|---|---|
| Load calendar | GET /api/v1/returns/calendar?days=30 |
| Load overdue | GET /api/v1/returns/overdue |
| View filing history | GET /api/v1/returns/{id}/instances |
| Upload stage evidence + advance | PUT /api/v1/returns/{id}/instances/{iid}/advance |
| Upload receipt + submit | PUT /api/v1/returns/{id}/instances/{iid}/submit |
| Add new return | POST /api/v1/returns |

### Audit Trail
| Action | Endpoint |
|---|---|
| Load trail | GET /api/v1/audit |
| Filter by subject | GET /api/v1/audit/{subjectType}/{subjectId} |
| Verify hash chain | GET /api/v1/audit/verify |
| Export evidence pack | POST /api/v1/audit/evidence-pack |

### Notifications
| Action | Endpoint |
|---|---|
| Badge count | GET /api/v1/notifications/count |
| Load panel | GET /api/v1/notifications?status=unread |
| Mark as read | PUT /api/v1/notifications/{id}/read |
| Acknowledge | PUT /api/v1/notifications/{id}/acknowledge |
| Mark all read | PUT /api/v1/notifications/mark-all-read |

### Auth
| Action | Endpoint |
|---|---|
| Login | POST /api/v1/auth/login |
| Refresh token | POST /api/v1/auth/refresh |
| Logout | POST /api/v1/auth/logout |
| Validate invite link | GET /api/v1/auth/invite/validate?token=... |
| Accept invite + set password | POST /api/v1/auth/invite/accept |
| Request password reset | POST /api/v1/auth/password/reset-request |
| Reset password | POST /api/v1/auth/password/reset |
| Change password | PUT /api/v1/users/me/password |

### Onboarding + Subscriptions
| Action | Endpoint |
|---|---|
| Check onboarding status | GET /api/v1/onboarding/status |
| Save institution details | POST /api/v1/onboarding/institution |
| Save regulator subscriptions | POST /api/v1/onboarding/regulators |
| Save document types | POST /api/v1/onboarding/document-types |
| Complete onboarding | POST /api/v1/onboarding/confirm |
| View subscriptions | GET /api/v1/subscriptions |
| Add regulator | POST /api/v1/subscriptions/regulators/{abbr} |
| Remove regulator | DELETE /api/v1/subscriptions/regulators/{abbr} |
