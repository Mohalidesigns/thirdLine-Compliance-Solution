---
name: atheris-register-page
description: Build or modify a register/explorer page, detail page, or dashboard in the Atheris compliance codebase (atheris-compliance-tenant-frontend :5174, atheris-compliance-intelligence-frontend :5173, and their Spring Boot backends). Use this whenever work touches an MUI table page, a detail drawer or page, a dashboard section, an admin explorer, a paginated list with filters, or any component that binds to a Spring DTO in this repo — including bugfixes, "show more fields on X", "add a column", "wire up Y", or adding a new entity's UI end to end. Also use when adding a backend admin list/stats/detail endpoint that a page will consume. It carries the page recipe, the per-app conventions that differ in ways that will bite you, a catalogue of verified traps in this codebase, and a script that mechanically catches the single most common defect here.
---

# Atheris register & detail pages

## Why this exists

The dominant defect in this codebase is **silent, not loud**: a component binds to a
field name the DTO does not have, so the cell renders `-`, `0`, or blank. It compiles,
it bundles, it passes review, and it survives until someone looks at real data and asks
why a column is always empty. Six such bugs were found in one pass across pages that had
shipped. A seventh — an entire dashboard — was unreachable for months because nothing
imported it.

So the through-line here is: **the compiler and the bundler tell you almost nothing in
this codebase.** Verification has to be explicit. The script in `scripts/` exists because
that check was worth running by hand six times, and it caught something every time.

## Before you start: which app?

The two frontends look similar and are **not** interchangeable. Getting this wrong
produces code that builds and then fails at runtime, or a needless dependency.

| | `atheris-compliance-tenant-frontend` (:5174) | `atheris-compliance-intelligence-frontend` (:5173) |
|---|---|---|
| TanStack Query | **Yes** — provider in `main.jsx`. Use it. | **No** — not a dependency, no provider. Do NOT add it. |
| Data fetching | `useQuery` / `useMutation`, pass `{ signal }` | raw `useState`/`useCallback`/`useEffect` + race guard |
| api import | `import { api } from '../services/api'` | `import api from '../../../services/api'` (default) |
| api call shape | `api.x.list(paramsObject, { signal })` | `api.platform.x.list(queryString)` |
| Pages live in | `src/pages/` | `src/features/<area>/components/` |
| ESLint | **no config at all** — the build is the only gate | `eslint.config.js`, ~316 pre-existing problems |

The `frontend-register-page` skill says "use TanStack
Query, never raw useEffect". **That applies to the tenant app only.** In intel, follow
`RegulationExplorerPage.jsx`. Adding react-query to intel is a deliberate migration, not
a side effect of adding a page.

## The page recipe

Register/explorer pages follow: **KPI/stat cards → search + filter dropdowns → sortable
paginated table → row click to detail**. Read the nearest existing page and match it
rather than inventing layout. Good references:

- tenant: `src/pages/ReviewEditPage.jsx` is the harmonization reference for how enriched
  obligation data should look; `ReviewInboxPage.jsx` shows the read-only mirror of it.
- intel: `src/features/admin/components/RegulationExplorerPage.jsx` + `RegulationDetailPage.jsx`.

**Five data columns max** (plus a chevron/expander cell and an actions cell). When an
entity has more to show, fold secondary fields into a cell — a bold primary line with a
grey caption and small chips beneath — rather than adding columns. Say in your summary
which sort headers this costs; consolidating a column removes its sort.

**Surfacing enriched obligation text** (the house style, worth matching exactly):
bold `title`; grey caption `plainEnglishStatement`; the verbatim `description` behind an
`InfoOutlined` Tooltip; section as an outlined mono chip (`Roboto Mono, monospace`,
`.7rem`, `height: 22`, `borderRadius: '4px'`); `areaOfFocus` as a chip; risk as a chip
coloured Critical/High = `error`, Moderate/Medium = `warning`, Low = `success`, with a
Tooltip reading `${likelihood} × ${impact}`.

## The five things that will bite you

Each of these was a real, shipped bug here. `references/traps.md` has the full catalogue
with evidence; these are the ones you are most likely to hit today.

1. **Field names drift between DTOs for the same concept.** The sanction amount is
   `amountNaira` on the instruments DTO and `sanctionAmountNaira` on all three
   obligations/sanctions DTOs. Intel's obligation section field is
   `specificSectionReference` where tenant's is `sectionReference`. Copying a working
   block from a sibling page is exactly how a blank column gets shipped. Check
   `references/data-model.md` before you copy anything.

2. **Sorting on a field the service computes throws at runtime.** `actName` is resolved
   in the service for `ObligationMapping`, `SanctionsPenalty` and `RegulatoryReturn` —
   passing `sort=actName` into a `Pageable` raises `PropertyReferenceException` on click.
   Sort on the persisted column (`regulationId` / `actId`) or leave the column unsorted.
   `ComplianceControl` is the exception: `actName` is a real column there.

3. **Only link to query params the target page actually reads.** `ObligationsRegisterPage`
   reads `risk`, `regulator`, `areaOfFocus`, `owner`, `status`, `hasGap` from
   `useSearchParams` — and silently ignores everything else. A link passing `act`,
   `impact` or `likelihood` is a no-op that dumps the unfiltered register, which looks
   like a working feature. Grep the target for `useSearchParams` before adding a
   drill-down.

4. **Stringify by-id TanStack query keys.** `useParams()` yields a string while list rows
   carry JSON numbers, and TanStack hashes `['x', 12]` and `['x', '12']` differently. Use
   `['entity', String(id)]` so a list and its own detail page share cache.

5. **An entity `@Builder.Default` silently overrides the DB column default.** Rows created
   through JPA get the entity's value; the migration's `DEFAULT` never applies. A correct
   default in a migration is no protection. When both exist, make them agree.

## Verify before you claim it works

A green build means the JSX parsed. It does not mean anything renders correctly. Do these:

**1. Check every field you bound against the backing Java types.**

```bash
python3 scripts/check_dto_binding.py \
  --jsx path/to/Page.jsx \
  --java path/to/RowDto.java path/to/DetailDto.java path/to/StatsDto.java
```

Supply **all** backing types — list DTO, detail DTO, stats DTO. Under-supplying them is
the main source of false positives. Remaining hits are one of: a genuine typo (fix it), a
field the service resolves rather than declares (confirm it is actually populated), or
local UI state (ignore). The script exits non-zero when it finds anything, so it can gate
a workflow.

**2. Build the app you touched.** From `atheris-compliance-frontend`:
`npm run build:tenant` / `npm run build:intelligence`. Backend:
`mvn -q clean compile -DskipTests` from `atheris-compliance-backend/atheris-compliance`.
Capture `echo $?` directly — a redirect masks the real exit code.

**3. If you added a route, confirm the page bundles as its own chunk.** A missing route is
invisible otherwise. Grep the import **path** (`pages/Foo'`), never the identifier —
`AppRoutes.jsx` aliases imports, so an identifier grep gives a false positive. That alias
is precisely how a whole dashboard stayed dead while the docs called it active.

**4. Say plainly what you did not verify.** Nothing in this checklist exercises real data.
Given that the failure mode here is "renders silently wrong", a run against a live
database is worth more than any amount of static checking — do not imply you did one.

## Working in parallel

If several agents work at once, give each a disjoint file set and wire the shared files
(`api.js`, `constants.js`, `AppRoutes.jsx`, `Sidebar.jsx`) yourself, pinning the exact API
client shape in each brief. Concurrent builds must not share `dist/` — use
`npx vite build --outDir dist-verify-<name> --emptyOutDir`, then delete it.

## Reference files

- `references/traps.md` — the full verified trap catalogue, with the evidence for each.
  Read it before a bugfix, or when something renders empty and you cannot see why.
- `references/data-model.md` — per-entity field naming across the modules, including the
  drift table. Read it before binding to any DTO or copying a block between pages.
- `scripts/check_dto_binding.py` — the binding checker described above.
- `scripts/grid_codemod.py` — converts legacy `<Grid item xs={..}>` to MUI 7's
  `size={{ xs: .. }}`. Pass it file paths. The repo was migrated in one pass; this is here
  for any file that reintroduces the old API.
