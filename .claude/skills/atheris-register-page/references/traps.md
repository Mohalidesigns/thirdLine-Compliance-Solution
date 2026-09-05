# Verified traps in the Atheris codebase

Every entry here was a real defect found in shipped code, with the evidence that
confirmed it. They are grouped by failure mode, because the mode is what you need to
recognise — the specific instances are already fixed.

## Contents
- [Silent field-name mismatches](#silent-field-name-mismatches)
- [Pagination and list handling](#pagination-and-list-handling)
- [Runtime failures that compile fine](#runtime-failures-that-compile-fine)
- [Defaults that disagree with each other](#defaults-that-disagree-with-each-other)
- [Dead code that looks alive](#dead-code-that-looks-alive)
- [Library API drift](#library-api-drift)
- [Environment](#environment)

---

## Silent field-name mismatches

The signature: a cell always renders `-`, `0`, blank, or an em dash. Nothing errors.

- `InstrumentsPage` drawer read `obl.section`, `obl.type` and `s.type`. The DTO declares
  `sectionReference`, `obligationType`, `sanctionType`. Three columns were permanently
  empty.
- `ReturnsPage` read `item.overcomeCount` — a typo for `overdueCount` — so the overdue
  count always showed 0.
- `ControlsPage` never read `actName`/`actId`, **yet shipped an Act filter dropdown that
  sent `params.actName`**. Users filtered on a column that was never displayed. A filter
  existing is not evidence the field is bound.

Catch these with `scripts/check_dto_binding.py`, supplying every backing type.

## Pagination and list handling

- `InstrumentsPage` fetched server page N, then re-sliced `[N*20 : (N+1)*20]` out of the
  20-item response (empty for any N ≥ 1) and passed `count={items.length}`, which capped
  the pager at one page. **No instrument past the first 20 was reachable.** When the
  backend paginates, render the page as-is and take the count from `totalElements`.
- Local state named the same as a row field shadows it. `ObligationsRegisterPage` had a
  `hasGap` filter state shadowed by a row-scoped `hasGap` inside the table map; the filter
  state is now `hasGapFilter`.

## Runtime failures that compile fine

- **Sorting on a service-resolved field.** `sort=actName` into a `Pageable` raises
  `PropertyReferenceException` for `ObligationMapping`, `SanctionsPenalty` and
  `RegulatoryReturn`, where `actName` is resolved in the service. `ComplianceControl`
  denormalises `actName` as a real column, so it sorts fine. The asymmetry is the trap.
- **Query params nothing reads.** `ObligationsRegisterPage` reads only `risk`, `regulator`,
  `areaOfFocus`, `owner`, `status`, `hasGap`. Drill-downs passing `impact`/`likelihood`
  were silent no-ops showing the unfiltered register — indistinguishable from a working
  filter that matched everything.
- **Unstringified query keys.** `useParams()` gives a string, list rows give JSON numbers,
  and TanStack hashes `['review', 12]` and `['review', '12']` differently — so a list and
  its detail page silently keep two copies of the same resource.
- **Inverted date ranges.** `RenditionTab` computed `qEnd` as
  `new Date(y, floor(month/3) + 3, 0)`, missing the `*3`. In September that requests
  `from=Jul-01, to=May-31`, so the grid read "No rendition data" in **every quarter except
  Q1** — the one quarter where the arithmetic coincidentally works, which is why it
  survived a spot check.

## Defaults that disagree with each other

The `RiskMatrixConfig` case is the template for this whole class:

- The V28 migration's column defaults and `ObligationClassification.computeInherentRisk`
  (the canonical scorer) agreed with each other. The entity's `@Builder.Default` values
  disagreed with both — and won, because rows are created via
  `RiskMatrixConfig.builder()...build()`, so Hibernate writes the entity's values and the
  column defaults never apply.
- Consequences: the entity's likelihood axis (`Very Low..High`) shared **no value** with
  the ratings actually stored (`Rare..Almost Certain`), so every heatmap cell matched
  nothing and rendered 0; and `band_thresholds` had `high == critical == 9`, making the
  **High band mathematically unreachable** since `resolveBand` tests critical first.
- A third, subtler one: `resolveBand` used `>` where `computeInherentRisk` uses `>=`, so
  the two **disagreed at every boundary** — a score of 12 was "High" on the obligation but
  "Moderate" on the heatmap. Fixing thresholds without aligning the operator would have
  left the heatmap banding one level low.

**Rule:** when a default exists in both a migration and an entity `@Builder.Default`, they
must agree, and the entity is what actually takes effect. When two places implement the
same scoring rule, check the comparison operators, not just the numbers.

## Dead code that looks alive

- The whole Dashboard V2 feature — 8 `/dashboard/v2/*` endpoints, a 579-line service, a
  rendition grid, control coverage, risk heatmap and escalation matrix — was unreachable
  because nothing imported `DashboardV2Page.jsx`. AGENTS.md described it as the active
  dashboard.
- **Why nobody noticed:** `AppRoutes.jsx` has
  `const DashboardPage = lazy(() => import('./pages/CcoDashboardPage'))`. Grepping for the
  identifier `DashboardPage` hits that line and looks wired. **Grep the import path**
  (`pages/DashboardV2Page'`) instead.
- The same false-negative bites relative imports: a grep for `dashboard/RiskHeatmap'`
  misses `from './RiskHeatmap'`. Match any path ending in the component name:
  `grep -rE "from '[^']*/Name'"`.

## Library API drift

- 19 files used `<Grid item xs={12} md={6}>` against `@mui/material` 7.3.11, where `Grid`
  IS v2: no `Grid2` directory, and `Grid.d.ts` declares only `container`, `offset`, `size`,
  `spacing`. The legacy props were passed through as unrecognised attributes and ignored
  for layout — silently wrong, never an error.
- **Verify library claims against the installed package** (`node_modules/<pkg>/...d.ts`),
  not from memory of version histories. `scripts/grid_codemod.py` does the conversion.

## Security

- `/dashboard/v2/thresholds` took `tenantId` as a **request param**, so any authenticated
  tenant user could read or overwrite another tenant's thresholds. Tenant identity is
  DB-driven via `TenantIdentityService` — resolve it server-side, the way
  `RiskMatrixSettingsController` does. If an endpoint takes a tenant id from the client,
  treat that as a finding rather than something to satisfy with a hardcoded value.

## Environment

- `atheris-compliance-frontend/package-lock.json` is generated on Windows and pins only
  win32 native binaries, so builds fail on macOS arm64 with "Cannot find native binding"
  (`@rolldown/binding-darwin-arm64`) or a lightningcss error. Fix without touching the
  lockfile, **both packages in one command** — a `--no-save` install reconciles against
  the lockfile and evicts a binding added by a separate earlier call:

  ```bash
  npm install --no-save --no-audit --no-fund \
    @rolldown/binding-darwin-arm64@1.1.5 lightningcss-darwin-arm64@1.32.0
  ```

  Re-apply after any `npm install`. Do not delete `package-lock.json`.
- The tenant frontend has **no ESLint config**, so the build is the only automated gate
  there. `npm run lint` covers the intel app only, which has ~316 pre-existing problems;
  the raw fetch-in-effect idiom trips `react-hooks/set-state-in-effect` by design. Judge
  new intel files against that baseline rather than trying to reach zero.
