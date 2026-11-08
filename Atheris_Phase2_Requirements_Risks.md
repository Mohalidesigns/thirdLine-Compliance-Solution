# Atheris — Phase 2 Design Spec
## Requirements & Risk Register (with risk↔control and requirement↔control mapping)

Status: **draft for sign-off** · Branch: off `chore/consolidate-tenant-migrations` · Date: 2026-11-08

---

## 1. Goal

Promote **Requirements** and **Risks** to first-class entities and enrich the committed
toolkit with their mappings, so a tenant's register is fully populated on onboarding:

- every **obligation** → one or more **requirements** (the distinct enforceable duties);
- a curated **risk** catalogue, each risk linked to the obligations it arises from;
- **controls mapped to both** — requirement↔control and risk↔control;
- existing **obligation↔control**, **returns** and **sanctions** links preserved/enriched.

Compliance is then **derived** from control test results at the requirement level and rolled
up to the obligation — so "a gap" becomes *a requirement with no control*, and a failed control
marks only the duty it covers.

This merges the previously separate "Phase 2 (requirements)" and "Phase 3 (risks)" into one
offline enrichment pass + one seed/schema change.

---

## 2. Design decisions (locked)

| # | Decision | Choice |
|---|----------|--------|
| D1 | Requirement granularity | **AI splits** each obligation into 1..N duties (offline pass, Phase-0 style) |
| D2 | Where requirements/risks live | **Platform seed** (in `compliance_toolkits.json`), pushed to tenant at onboarding |
| D3 | Tenant editability | **Editable + extend** — seeded rows are a starting point; tenant may rename/re-scope, add its own, and adjust mappings |
| D4 | Interpreted vs verbatim text | Requirements are **first-class and self-authored**; they **do not** depend on `obligation_points` |
| D5 | State | **Computed**, never stored (with an optional analyst override) |
| D6 | Enrichment timing | **One-time offline**, output committed to the toolkit JSON; **no AI at seed time** |
| D7 | Existing data | **All** existing obligations get requirements; **all** controls get mapped; risks generated for all |
| D8 | `obligation_points` | **Removed entirely** — requirements **fully replace** points (model, seed, DTOs, UI). No `points` JSONB, no `obligation_points` table, no `FormattedText points` path |
| D9 | Gap definition | A gap exists **per requirement**: **any requirement with no linked control is a gap**, even when the obligation has other covered requirements. Obligation shows a gap if **any** of its requirements has none |
| D10 | Requirement interaction | Requirements are **clickable** — each opens a requirement detail (text, linked controls, state, linked risk, history) |
| D11 | Migration style | **No `ALTER TABLE` anywhere** — already done for tenant; intel V15's three ALTERs are now collapsed in-place (acts moved to V2 before instruments, `act_id` declared inline in V2/V3) |

### Points removal scope (D8)
Delete every `points` surface:
- **Intel:** `ToolkitSeedDoc.ObligationRow.points` + `ControlPoint`, `ObligationMapping.points` JSONB (V3),
  `ControlPoint.java`, `AdminControlService`/`ObligationExplorerService`/`InternalRegulationSeedService`/
  `ClassificationService` point reads, `InternalRegulationSeed`.
- **Tenant:** `ObligationPoint` entity + `ObligationPointRepository` + `ObligationPointParser`,
  `RegulationSeedService` point conversion, `ReviewService` point writes, `ObligationDetailView.points`,
  `Obligation.points` usage; the `V32__create_obligation_points.sql` migration is deleted and its table
  dropped from the schema.
- **Frontend:** `FormattedText` loses its `points`/`pointType` path (text-only), `LongTextBlock` drops
  the points props, `ObligationDetailPage`/`ObligationDetailView` stop passing points.
- **Tests:** `ObligationPointParserTest`, `RegulationSeedServiceConvertPointsTest` deleted.
Requirements carry the per-duty text instead, so nothing is lost visually.

---

## 3. Target model

### 3.1 Platform (intelligence) — canonical

```
regulations ──< obligation_mappings >──┐
                                       │  obligation_requirements (NEW)
                                       ├──> requirements ──< requirement_controls (NEW) >── compliance_controls
                                       │                                              │
risks (NEW) ──< risk_obligations (NEW) ┘                       risk_controls (NEW) ──┘
                                       
returns / sanctions  (enriched: link to the obligation / requirement they relate to)
```

### 3.2 Tenant — mirrors platform, plus tenant-owned rows

```
obligations ──< requirements >── requirement_controls >── controls
                     │                                        │
                     └── risk_id                              └── risk_controls >── risks
risks ──< risk_obligations
obligation_classifications.linked_control_ids = UNION of its requirements' controls  (back-compat)
controls.linked_obligation_ids               = UNION of its requirements' obligations (back-compat)
```

Kept for compatibility (must stay populated): `obligation_classifications.linked_control_ids`
and `controls.linked_obligation_ids` are consumed by `TaskCenterService`, `DashboardV2Service`,
`ComplianceMetricsService`, `FindingService` and the runbooks.

---

## 4. One-time enrichment pass (offline)

New workspace `tools/toolkit-enrichment/` (same pattern as `tools/toolkit-ownership/`:
scripts + committed output, **never** run at app seed time). Isolated — no app risk.

**Inputs:** `compliance_toolkits.json` + `tools/toolkit-ownership/org_vocab.json`.

**Pass (AI, batched, resumable, key from env only):** for each obligation row
(`source`, `sectionRef`, `title`, `plain`, `description`, `riskDescription`, `points`,
`primaryControl`, `additionalControl`) emit:
- `requirements: [{ text, riskCode, controlRefs: ["primary","additional"| explicit text] }]` — 1..N duties;
- the row's contribution to a **global risk catalogue** — deduped by `riskCode`
  (`{ code, name, description, type, areaOfFocus, inherentLikelihood, inherentImpact }`).

**Derived, not invented:** each requirement's controls come from the row's own
`primaryControl`/`additionalControl` (+ points); each risk's controls = the union of its
requirements' controls. So mapping accuracy is inherited from the toolkit row.

**Output:** an enriched `compliance_toolkits.json`:
- new top-level `risks: [...]`;
- each obligation row gains `requirements: [...]`;
- `returns` rows gain `relatedObligationRefs`; `sanctions` rows gain `relatedObligationRefs`
  where derivable;
- `meta.enrichment = { model, generatedAt, counts }`.

**Deliverables to review before any schema work:** `risks.json`, a per-obligation
`requirements.json`, and a `coverage.csv` (obligations with 0/1/N requirements, controls
unmapped). Nothing is committed until signed off.

---

## 5. Platform (intel) changes

### 5.1 Schema (intel **V18+**)

```sql
CREATE TABLE risks (
    risk_id            SERIAL PRIMARY KEY,
    code               VARCHAR(40) NOT NULL UNIQUE,
    name               VARCHAR(300) NOT NULL,
    description        TEXT,
    risk_type          VARCHAR(60),
    area_of_focus      VARCHAR(120),
    inherent_likelihood VARCHAR(40),
    inherent_impact    VARCHAR(40),
    inherent_band      VARCHAR(40),
    source             VARCHAR(30) DEFAULT 'toolkit_seed',
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE obligation_requirements (
    requirement_id   BIGSERIAL PRIMARY KEY,
    obligation_id    BIGINT NOT NULL REFERENCES obligation_mappings(obligation_id) ON DELETE CASCADE,
    ordinal          INT NOT NULL,
    text             TEXT NOT NULL,
    risk_id          INT REFERENCES risks(risk_id),
    source           VARCHAR(30) DEFAULT 'toolkit_seed',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (obligation_id, ordinal)
);

CREATE TABLE requirement_controls (
    requirement_id BIGINT NOT NULL REFERENCES obligation_requirements(requirement_id) ON DELETE CASCADE,
    control_id     INT    NOT NULL REFERENCES compliance_controls(control_id) ON DELETE CASCADE,
    linked_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (requirement_id, control_id)
);

CREATE TABLE risk_controls (
    risk_id    INT NOT NULL REFERENCES risks(risk_id) ON DELETE CASCADE,
    control_id INT NOT NULL REFERENCES compliance_controls(control_id) ON DELETE CASCADE,
    PRIMARY KEY (risk_id, control_id)
);

CREATE TABLE risk_obligations (
    risk_id       INT    NOT NULL REFERENCES risks(risk_id) ON DELETE CASCADE,
    obligation_id BIGINT NOT NULL REFERENCES obligation_mappings(obligation_id) ON DELETE CASCADE,
    PRIMARY KEY (risk_id, obligation_id)
);
```

### 5.2 Import (`ToolkitImportService` / `ToolkitSeedDoc`)
- Extend `ToolkitSeedDoc` with `List<Risk> risks` and `ObligationRow.requirements`.
- Import order (single transaction, same `TransactionTemplate` rollback guard): regulations →
  instruments → obligations → **requirements → risks → mappings** → controls → sanctions →
  returns. Controls import as today; mapping rows are added after both sides exist.
- Idempotent on the existing natural keys; a re-run changes nothing.
- `ToolkitDataRepairService` gains an **idempotent requirements/risks backfill** so an
  already-seeded DB converges without a full re-import (mirrors the risk re-band repair).

### 5.3 Platform → tenant payload
Extend `InternalRegulationSeed` (and `PlatformRegulationSeed` on the tenant side) so each
regulation carries `risks` and per-obligation `requirements` + the control references, exactly
as the tenant already receives `controls`/`returns`/`sanctions`.

---

## 6. Tenant changes

### 6.1 Schema (tenant **V50+**)

```sql
CREATE TABLE risks (
    risk_id            SERIAL PRIMARY KEY,
    risk_code          VARCHAR(40) NOT NULL UNIQUE,
    name               VARCHAR(300) NOT NULL,
    description        TEXT,
    risk_type          VARCHAR(60),
    area_of_focus      VARCHAR(120),
    inherent_likelihood VARCHAR(40),
    inherent_impact    VARCHAR(40),
    inherent_band      VARCHAR(40),
    owner_id           INT REFERENCES owners(owner_id),
    department_id      INT REFERENCES departments(department_id),
    team_id            INT REFERENCES teams(team_id),
    status             VARCHAR(30) DEFAULT 'Active',
    source             VARCHAR(30) DEFAULT 'toolkit_seed',
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE requirements (
    requirement_id  BIGSERIAL PRIMARY KEY,
    obligation_id   BIGINT NOT NULL REFERENCES obligations(obligation_id) ON DELETE CASCADE,
    ordinal         INT NOT NULL,
    text            TEXT NOT NULL,
    risk_id         INT REFERENCES risks(risk_id),
    state_override  VARCHAR(30),
    override_reason TEXT,
    source          VARCHAR(30) DEFAULT 'toolkit_seed',
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (obligation_id, ordinal)
);

CREATE TABLE requirement_controls (
    requirement_id BIGINT NOT NULL REFERENCES requirements(requirement_id) ON DELETE CASCADE,
    control_id     INT    NOT NULL REFERENCES controls(control_id) ON DELETE CASCADE,
    PRIMARY KEY (requirement_id, control_id)
);

CREATE TABLE risk_controls    (risk_id INT ..., control_id INT ..., PRIMARY KEY(risk_id, control_id));
CREATE TABLE risk_obligations (risk_id INT ..., obligation_id BIGINT ..., PRIMARY KEY(risk_id, obligation_id));
```

### 6.2 Modules (per `backend-module-scaffold`)
- **`modules/requirements`** — `Requirement` entity, repo (derived finders + Criteria spec),
  `RequirementService`, thin `RequirementController`, DTOs.
- **`modules/risks`** — `Risk` entity, repo, `RiskService`, thin `RiskController`, DTOs.
- Both: editable by ANALYST/CCO/TENANT_ADMIN (D3).

### 6.3 Seed wiring (`RegulationSeedService` / `SeedLinks`)
- Create requirements from the payload's per-obligation `requirements` (id-stable ordinal).
- Create risks from `risks`; build `requirement_controls`, `risk_controls`, `risk_obligations`.
- **Back-compat:** recompute `obligation_classifications.linked_control_ids` and
  `controls.linked_obligation_ids` as the **union** of requirement links.

### 6.4 Derived compliance state (new `ComplianceStateService` in common or tenant)
- **Control effective** = latest `control_test_results.result == 'Passed'`; untested ⇒ not effective.
- **Requirement state:** no control ⇒ `NO_CONTROL` (**a gap**); all effective ⇒ `COMPLIANT`;
  some ⇒ `PARTIAL`; none effective ⇒ `NON_COMPLIANT`; explicit `state_override` wins.
- **Obligation state:** any `NON_COMPLIANT` ⇒ `NON_COMPLIANT`; **any `NO_CONTROL` ⇒ `GAP`**;
  all `COMPLIANT` ⇒ `COMPLIANT`; else `PARTIAL`.
- **Gap (D9):** defined **per requirement**. A requirement with no linked control is a gap on its
  own; an obligation is flagged a gap if **any** requirement is a gap, even when others are covered.
  The register "no control" filter and the gap-finding flow operate at requirement level.
- Batched (no N+1): one latest-result query per page + one links query per page.

### 6.5 Persistence-critical changes (highest risk)
1. **Review Edit & Save** (`ReviewService`) deletes+recreates obligations → today that would
   wipe requirement↔control links. Convert to an **id-stable upsert keyed on obligation key +
   requirement ordinal**, carrying existing `requirement_controls` forward.
2. **Dedup merges** (`SeedLinkRepairService`, crmp vs topical) must **re-point** requirements,
   `requirement_controls`, `risk_obligations` to the surviving obligation.
3. **`ObligationImportHandler`** projects interpreted text into requirements (1:1 unless a
   split is supplied); **`ControlImportHandler`** keeps writing both union lists.

### 6.6 API
- `GET /obligations/{id}/requirements` (list w/ state) · `GET /requirements/{id}` (detail, D10)
  · `POST/PUT/DELETE /requirements` · `PUT /requirements/{id}/controls`
  · `GET/POST/PUT /risks` · `PUT /risks/{id}/controls` · `PUT /risks/{id}/obligations`.
- Existing `PUT /obligations/{id}/controls` stays, mapping onto a default requirement.
- Register/detail DTOs gain: `requirementCount`, `coveredRequirementCount`, `complianceState`,
  `hasGap` (any requirement uncovered), `riskCode/riskName`.
- Remove all `points` from DTOs (D8).

### 6.7 UI (`atheris-register-page` / `obligations-page` skills)
- **Obligation detail** — new **Requirements** table: text · controls covering · state · gap.
  Each requirement row is **clickable (D10)**, opening a **Requirement detail** panel/page showing:
  full text, linked controls (with their latest test outcome), derived state + override control,
  linked risk, and change history. `FormattedText` renders verbatim/interpreted text only (points removed).
- **Obligations register** — requirement coverage ("3/5 covered") + requirement-aware KPIs;
  "Gap" filter = **any requirement with no control**; row shows a gap badge when any requirement is a gap.
- **New Risks register** (`/risks`) — Risk · Type · Area · Inherent · Controls · Obligations · State.
- Link pickers become requirement-scoped (`LinkControlsPicker`).

---

## 7. Out of scope (later phases)
- Failure-review **tasks** (Phase 4).
- New **dashboards** (Posture / Risk heatmap / Control effectiveness) (Phase 5) — though this
  phase feeds them.

---

## 8. Migrations / reset
- Intel: `V2`/`V3`/`V15` edited in place (acts moved earlier; `act_id` inline; ALTERs removed);
  new tables land in **V18+**. Tenant: `V32__create_obligation_points.sql` **deleted** (points gone),
  new tables in **V50+**. **Zero `ALTER TABLE`** in either module (D11).
- Tenant + intel DBs are **dropped and rebuilt**; you re-onboard (fresh seed produces
  requirements + risks). Prompt before starting backends.

---

## 9. Verification
- **Unit:** point/row→requirement projection; the state rule (all/partial/none/no-control/override);
  union back-compat computation; ReviewService id-stable upsert.
- **Data:** toolkit parity counts (obligations, requirements, risks, mappings) in `meta`;
  `coverage.csv` shows 0 unmapped controls.
- **Live:** fresh seed → requirements + risks present; obligation detail renders requirements;
  risks register renders; a failed control flips only its requirement's state; no N+1 (query
  count check); `err.log` empty.
- **Browser:** obligation detail + risks register at `:5174` (single-page checks).

---

## 10. Open items / risks
1. **AI hardening** — requirement splitting must be resumable and validated (a requirement
   with no enforceable verb is dropped); review `coverage.csv` before committing.
2. **Review re-save** is the single most dangerous change — must be covered by a regression test
   (edit an obligation, links survive).
3. **Control↔risk duplication** vs the existing control `inherent/residual` fields — the risk
   register becomes the heatmap source in Phase 5; control fields stay as the control's own
   outcome (documented, not removed, in this phase).
4. **`riskCode` stability** across enrichment re-runs (needed for idempotent tenant upserts).
5. **DB reset** each phase → re-onboard cost; batch phases where sensible.

---

## 11. Task breakdown
1. Enrichment workspace + AI pass + `coverage.csv` review. *(no app change)*
2. **Points removal** (D8): delete `obligation_points` (tenant) + `points` JSONB (intel) + all
   reads/DTOs/tests + the `FormattedText` points path. Global `grep` for `point` must be clean.
3. Intel schema V18 + `ToolkitSeedDoc`/`ToolkitImportService` + repair backfill.
4. Tenant schema V50 + `requirements`/`risks` modules + seed wiring + union back-compat.
5. `ComplianceStateService` (derived, per-requirement gap) + DTO/register enrichment.
6. Review/SeedLink/Import persistence-safety changes + regression tests.
7. UI: obligation requirements table + **clickable requirement detail** + risks register +
   requirement-scoped linking.
8. Verification + AGENTS.md Done entry.