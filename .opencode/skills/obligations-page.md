# obligations-page

Reusable skill for building MUI obligations register/detail pages following the Atheris tenant Obligations Register + Detail pattern. Use for both tenant Obligations Register (`:5174/obligations`) and intel Obligations Explorer (`:5173`).

## Purpose

When to use:
- Tenant **Obligations Register** — per-obligation paginated register (one row per `obligations` row, not per instrument) with owner/control/return workflows.
- Intel **Obligations Explorer** — read-only catalogue over the same `obligation_mappings` / enriched instrument data.
- Any new obligations-family page (e.g. sanctions-joined view, obligations-by-act).

Do NOT use for instrument-only lists (those remain `pending_reviews` / `instruments`) or for controls/returns/sanctions registers (use `frontend-register-page` for those).

## Page Architecture

Every obligations page follows this structure:

```
Stats Cards (4 KPIs, clickable → set filter)
  ↓
Filters Bar (search + 5 dropdowns + Has gap + Clear, init from useSearchParams)
  ↓
Sortable Table (max 5 content cols + 1 actions col, max 6 rendered)
  ↓
Detail Route /obligations/:id (NOT a Drawer) with FormattedText verbatim/interpreted split
```

Register is a **route**, not a drawer. Clicking a row navigates via `navigate('/obligations/${row.obligationId}')`. Detail is a separate page at `/obligations/:id` with back-arrow navigation.

## File Structure

```
src/pages/
  ObligationsRegisterPage.jsx   — register: KPIs + filters + sortable table + create/edit/delete
  ObligationDetailPage.jsx      — detail route: header + FormattedText + sections + modals + single drawer
src/components/
  FormattedText.jsx             — verbatim vs interpreted renderer (see contract below)
  modals/
    CreateObligationDialog.jsx  — create/edit obligation
    RiskAssessmentModal.jsx     — tenant: edit risk
    OwnerModal.jsx              — tenant: assign owner
    LinkControlsModal.jsx       — tenant: link controls
    MapReturnModal.jsx          — tenant: map returns
    GapModal.jsx                — tenant: set gap
    EvidenceUploadModal.jsx     — tenant: upload evidence
src/services/api.js             — api.obligations.register / stats / obligationDetail / remove / create / update
```

Naming: `ObligationsRegisterPage` (plural, register) + `ObligationDetailPage` (singular, detail). Route param is `:id` coerced to `Number(id)` as `obligationId`.

## Layout Spec

### 1. KPI Cards (4, clickable)

```jsx
const kpis = [
  { key: 'total', label: 'Total Obligations', value: stats?.total ?? 0, color: '#2B6CB0', bg: '#EBF8FF' },
  { key: 'highRisk', label: 'High Risk', value: stats?.highRisk ?? 0, color: '#E53E3E', bg: '#FFF5F5' },
  { key: 'gaps', label: 'No Control', value: stats?.gaps ?? 0, color: '#DD6B20', bg: '#FFFAF0' },
  { key: 'underReview', label: 'Under Review', value: stats?.underReview ?? 0, color: '#805AD5', bg: '#FAF5FF' },
];
// Click handlers:
function applyKpiFilter(type) {
  setPage(0);
  if (type === 'highRisk') { setRiskFilter('High'); setStatusFilter('All'); }
  else if (type === 'gaps') { setNoControl(true); setHasGap(false); }
  else if (type === 'underReview') { setStatusFilter('unclassified'); setHasGap(false); setNoControl(false); }
  else { setRiskFilter('All'); setHasGap(false); setNoControl(false); setStatusFilter('All'); }
}
```

Container: `display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2`.
Cards: `Paper variant="outlined" elevation={0} sx={{ p: 2, cursor: 'pointer', borderLeft: '3px solid ${color}', '&:hover': { boxShadow: 1 } }}`.
Values: `Typography variant="h4" sx={{ fontWeight: 700, color }}` + caption label `variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}`.

### 2. Filters Bar

Initialises from URL (dashboard drill-down):

```jsx
const [searchParams] = useSearchParams();
const [riskFilter, setRiskFilter] = useState(searchParams.get('risk') || 'All');
const [regulatorFilter, setRegulatorFilter] = useState(searchParams.get('regulator') || 'All');
const [areaFilter, setAreaFilter] = useState(searchParams.get('areaOfFocus') || 'All');
const [ownerFilter, setOwnerFilter] = useState(searchParams.get('owner') || 'All');
const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'All');
const [hasGap, setHasGap] = useState(searchParams.get('hasGap') === 'true');
const [noControl, setNoControl] = useState(false);
```

Bar: `Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}`.

| Control | Param | Options source |
|---------|-------|----------------|
| Search `TextField size="small"` placeholder `Search obligation, title or regulator...` | `q` | local state |
| Risk `select` | `risk` | `stats.riskLevels` ?? `['Critical','High','Moderate','Low']` |
| Regulator `select` | `regulator` | `stats.regulators` |
| Domain/Area `select` label Domain | `areaOfFocus` | `stats.themes` |
| Owner `select` | `owner` | `stats.owners` |
| Status `select` | `status` | `['All','active','unclassified','under_review']` |
| Has gap `Checkbox` | `hasGap=true` | boolean |
| No Control (via KPI gaps, optional extra filter) | `noControl=true` | boolean |
| Clear `Button startIcon={<Close />}` | — | resets all to `All`/empty + `setPage(0)` |

All onChange handlers call `setPage(0)`. Search leading icon: `slotProps={{ input: { startAdornment: <Search sx={{ mr:1, color:'text.secondary', fontSize:20 }} /> } }}` with `minWidth: 240`.

### 3. Sortable Table (max 5 cols)

Canonical 5 content columns + `#` index + `Actions`:

```jsx
const COLUMNS = [
  { id: 'obligation', label: 'Obligation', minWidth: 280, sortField: 'name' },
  { id: 'regulator', label: 'Regulator', minWidth: 100 },
  { id: 'risk', label: 'Risk', minWidth: 100, sortField: 'tenantRiskRating' },
  { id: 'owner', label: 'Owner', minWidth: 120 },
  { id: 'controls', label: 'Controls', minWidth: 140 },
  { id: 'actions', label: 'Actions', minWidth: 80 },
];
```

Header `#` shows reverse-index `total - (page * rowsPerPage) - idx`. Use `Table stickyHeader size="small"` with `TableHead` bg `#F7FAFC` + `fontWeight: 700`. Sort via `TableSortLabel` on `sortField` cols — currently `name` and `tenantRiskRating`; click toggles `sortDir` (`asc`/`desc`), `sortField` change resets to `asc`, always `setPage(0)`.

Row rendering:
- **Obligation**: `item.name || item.description || 'Untitled obligation'` truncated `maxWidth: 300, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'` inside `Tooltip` with full text.
- **Regulator**: `regulatorAbbreviation` as `Chip sx={{ height:22, fontWeight:600, borderRadius:'4px', bgcolor:'#1A365D', color:'#fff' }}` else `-`.
- **Risk**: `riskChip(tenantRiskRating || inherentRiskRating)` using `RISK_CONFIG` (`Critical/Extreme/High→error, Moderate/Medium→warning, Low→success`, height 22, radius 4px, fallback "Unrated").
- **Owner**: `assignedOwnerName` else `-`.
- **Controls**: `controlCount===0 → Chip "No controls" error + WarningIcon`, `hasGap → Chip "${n} controls" warning`, else `Typography "${n} controls"`.
- **Actions**: `IconButton Edit` + `IconButton Delete color="error"` with `e.stopPropagation()` and `onClick` handlers; Delete confirms `window.confirm` with `obligationNumber` + `description`.

### 4. Detail Route `/obligations/:id` (NOT Drawer)

Pattern from `ObligationDetailPage.jsx:104-696`:

- Param: `const { id } = useParams(); const obligationId = Number(id);`
- Fetch: `api.obligations.obligationDetail(obligationId)` → `GET /obligations/obligation/{id}`.
- Header bar: `IconButton ArrowBack → navigate('/obligations')` on left, `Button PDF` on right (`fetch GET /subscriptions/instruments/{instrumentId}/pdf` with `Authorization: Bearer ${getToken()}` then `window.open(blob)`).
- **Combined header** (`maxWidth: 900`):
  - Chips row: `riskChip(tenantRiskRating || inherentRiskRating)` + `regulatorAbbreviation` + `areaOfFocus` + `recurringDeadlineType` (outlined) + `status` (`STATUS_COLOR: active→success, classified→info, unclassified→warning, under_review→default`).
  - Title: `Typography variant="h6" sx={{ fontWeight: 400 }}` showing `title || name || 'Untitled obligation'` + `sourceTitle` as `body2 color="text.secondary"`.
  - Metadata grid: `display:'grid', gridTemplateColumns:'160px 1fr', gap:'4px 16px'` rows for Applicability (chip), Owner (`controlOwner || assignedOwnerName`), Department (`assignedDepartment`), Section (`sectionReference`), Obligation Type (`obligationType`), Effective Date, Classified By, Classified Date — filter out `-` values. Optional Reasoning block with top border.
- **Obligation Statement** `Paper variant="outlined" sx={{ p:3 }}` with two optional blocks:
  ```jsx
  {selected.description && (
    <><Typography variant="caption" sx={{ fontWeight:600, textTransform:'uppercase', letterSpacing:0.5 }}>Source Text</Typography>
      <FormattedText text={selected.description} points={selected.points} pointType="verbatim" /></>
  )}
  {selected.plainEnglishStatement && (
    <><Typography variant="caption" sx={{ fontWeight:600, textTransform:'uppercase', letterSpacing:0.5 }}>Plain English</Typography>
      <FormattedText text={selected.plainEnglishStatement} points={selected.points} pointType="interpreted" /></>
  )}
  ```
- **Sections** (each `Paper variant="outlined" sx={{ p:3, mb:2 }}` with `SectionHeader` title+action):
  - Linked Controls — preview first 5 as clickable rows (→ drawer single), `View all` + `Link controls` (tenant) actions.
  - Return Required — chip-less list preview, `View all` + `Map return`.
  - Regulatory Sanctions — compact sanction preview, `View all`.
  - Control Gap — `Alert severity="warning"` when `hasGap` else text, action `Identified Gaps`.
  - Evidence — 2-item preview + download, `View all` + `Upload`.
  - Version History — button only, count text.
- **Modals** (tenant): `RiskAssessmentModal`, `OwnerModal`, `LinkControlsModal`, `MapReturnModal`, `GapModal`, `EvidenceUploadModal` — all `open={activeModal==='...'}` with `onSaved={onSaved('...')}` that calls `reload()` + `notify('success', msg)`.
- **Single multi-section Drawer** `anchor="right" PaperProps={{ sx:{ width:480, p:3 }}}` — `drawerSection` ∈ `controls|returns|sanctions|evidence|history`, single `drawerSingleId` for control-detail view (fetches `api.controls.detail(id)`), search field when >3 items.

## FormattedText Contract

`src/components/FormattedText.jsx:1-51`:

```jsx
import FormattedText from '../components/FormattedText';
<FormattedText text={selected.description} points={selected.points} pointType="verbatim" />
<FormattedText text={selected.plainEnglishStatement} points={selected.points} pointType="interpreted" />
```

Props:

| Prop | Type | Notes |
|------|------|-------|
| `text` | `string` | Fallback plain text (`description` or `plainEnglishStatement`) |
| `points` | `Array<{ id, marker, content, level, pointType, children? }>` | Structured points; `pointType` ∈ `verbatim` / `interpreted` |
| `pointType` | `string` | Filter key — component renders only `points.filter(p => p.pointType === pointType)` |

Behaviour:
- If `points` filtered by `pointType` is non-empty → renders `renderPoints()` (structured list), else renders `Typography` with `cleanText(text)`.
- `cleanText(t)` → `t.replace(/^[\s\-"]+/, '')` — strips leading spaces, dashes, quotes.
- `renderPoint(point, depth)`: `prefix = "(${point.marker}) "` where marker wrapped in parentheses, marker in `<strong>`, text weight **normal 400** (`variant="body2" color="text.primary" lineHeight 1.7`), container `Box sx={{ ml: depth * 2, mb: 0.25 }}` where `depth = point.level || 0` (level indent).
- `children` (if present) are rendered as nested `renderPoint` calls (recursive indent). Fallback plain text also uses `cleanText` + `lineHeight 1.7`.

DTO mapping for FormattedText text sources: `description` = verbatim source text, `plainEnglishStatement` = interpreted, `points[].content` (not `text`) holds per-point text, `marker` is the point label, `level` is nesting depth.

## DTO Field Mapping

Tenant register/detail DTOs (from `ObligationService` + `PlatformApiClient`):

| Field | Source | Notes |
|-------|--------|-------|
| `obligationId` | `obligations.id` | PK, route param |
| `obligationNumber` | `obligations.obligation_number` | display + delete confirm |
| `title` / `name` | `obligations.title` | `title \|\| name` with fallback `'Untitled obligation'` |
| `description` | `obligations.description` | **verbatim** source text → `FormattedText pointType="verbatim"` |
| `plainEnglishStatement` / `plain_english_statement` | `obligations.plain_english_statement` | **interpreted** → `FormattedText pointType="interpreted"` |
| `points` | `obligation_points` join | `[{id, marker, content, level, pointType, children}]` |
| `tenantRiskRating` / `inherentRiskRating` | `obligation_classifications.tenant_risk_rating` | register `riskChip(tenant \|\| inherent)` |
| `areaOfFocus` / `theme` | `obligations.area_of_focus` | Domain filter, detail chip |
| `regulationId` → `actName` | `obligations.regulation_id → regulations.act_name` | via `PlatformApiClient.getInstrumentDetail` batch |
| `regulatorAbbreviation` | `platform instruments.regulator_abbreviation` | via `PlatformApiClient.getInstrumentDetail(instrumentId)` |
| `instrumentId` / `sourceTitle` | `obligations.instrument_id → instruments.title` | detail `sourceTitle` + PDF fetch |
| `assignedOwnerName` / `controlOwner` | `obligation_classifications.assigned_owner_name` | Owner col / header |
| `assignedDepartment` | `obligation_classifications.assigned_department` | header |
| `sectionReference` | `obligations.section_reference` | header |
| `obligationType` | `obligations.obligation_type` | header |
| `applicability` / `applicabilityReasoning` | `obligation_classifications` | header chip + reasoning block |
| `status` | `obligation_classifications.status` | header chip (`active`/`unclassified`/`under_review`) |
| `effectiveDate` / `classifiedAt` / `classifiedByName` | `obligation_classifications` + join | header grid |
| `recurringDeadlineType` | `obligations.recurring_deadline_type` | header chip (outlined) |
| `controlCount` / `hasGap` / `gapDescription` | aggregated | Controls col + Gap section |
| `linkedControls` / `linkedReturns` / `sanctions` / `evidence` / `history` | join tables | detail sections + drawer |

Sort fields: `name` (obligation title) and `tenantRiskRating`. Risk display falls back `tenantRiskRating || inherentRiskRating`.

## Data Fetching

**Always use TanStack Query** (never raw `useEffect` + `fetch` without `AbortController`). From `frontend-register-page` skill but with obligations specifics:

```jsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';

// Debounce search 350ms to avoid cancellation noise (AsyncRequestNotUsableException)
const [searchInput, setSearchInput] = useState('');
const [search, setSearch] = useState('');
useEffect(() => {
  const t = setTimeout(() => setSearch(searchInput), 350);
  return () => clearTimeout(t);
}, [searchInput]);

// Stats (separate query, used for KPIs + filter dropdowns)
const { data: stats } = useQuery({
  queryKey: ['obligation-stats'],
  queryFn: () => api.obligations.stats(), // GET /obligations/stats
});

// List — Pageable with sort=field,dir
const { data, isLoading } = useQuery({
  queryKey: ['obligations', page, rowsPerPage, search, riskFilter, regulatorFilter, areaFilter, ownerFilter, statusFilter, hasGap, noControl, sortField, sortDir],
  queryFn: async ({ signal }) => {
    const params = { page, size: rowsPerPage };
    if (search) params.q = search;
    if (riskFilter !== 'All') params.risk = riskFilter;
    if (regulatorFilter !== 'All') params.regulator = regulatorFilter;
    if (areaFilter !== 'All') params.areaOfFocus = areaFilter;
    if (ownerFilter !== 'All') params.owner = ownerFilter;
    if (statusFilter !== 'All') params.status = statusFilter;
    if (hasGap) params.hasGap = 'true';
    if (noControl) params.noControl = 'true';
    if (sortField) params.sort = `${sortField},${sortDir}`;
    return api.obligations.register(params, { signal }); // GET /obligations?page=&size=&q=&risk=&regulator=&areaOfFocus=&owner=&status=&hasGap=&noControl=&sort=
  },
});
const items = data?.content || [];
const total = data?.totalElements || 0;

// Detail route
const { data: selected, isLoading } = useQuery({
  queryKey: ['obligation', obligationId],
  queryFn: ({ signal }) => api.obligations.obligationDetail(obligationId, { signal }), // GET /obligations/obligation/{id}
  enabled: !!obligationId,
});
```

Conventions:
- Wrap fetch calls in `AbortController` via TanStack `signal` to prevent race on unmount.
- `Pageable` sort param is single string `sort=field,dir` (e.g. `sort=name,asc` or `sort=tenantRiskRating,desc`).
- `TablePagination rowsPerPageOptions={[10, 20, 50]}` with `count={total}` + `page` + `rowsPerPage` state.
- Mutations (`create`, `update`, `remove`, `linkControls`, `mapReturn`, `uploadEvidence`) validate server-side and return updated entity for `queryClient.invalidateQueries(['obligations'])`.

API mapping (`src/services/api.js`):
- `api.obligations.register(params, { signal })` → `GET /api/v1/obligations?page=&size=&q=&risk=&regulator=&areaOfFocus=&owner=&status=&hasGap=&noControl=&sort=`
- `api.obligations.stats()` → `GET /api/v1/obligations/stats`
- `api.obligations.obligationDetail(id, { signal })` → `GET /api/v1/obligations/obligation/{id}`
- `api.obligations.create(data)` / `update(id, data)` / `remove(id)` → `POST/PUT/DELETE /api/v1/obligations...`

## Tenant vs Intel Differences

| Aspect | Tenant (`:5174`) | Intel (`:5173`) |
|--------|------------------|-----------------|
| Editability | **Editable**: assign owner, set risk/impact/likelihood, toggle gap, link controls (`PUT /obligations/obligation/{id}/controls`), map returns, upload evidence, delete/create. Uses `CreateObligationDialog` + 6 modals. | **Read-only display-only**: no Edit/Delete/New buttons, no modals, no `IconButton` actions. Detail shows same header + FormattedText + sanction/return/control lists but chips are static. |
| Header actions | PDF via `GET /subscriptions/instruments/{id}/pdf` + Edit modals | PDF via `GET /intelligence/obligations/{id}/pdf` or `GET /admin/instruments/{id}/pdf`; no edit. |
| Regulator source | `regulatorAbbreviation` from `tenant_regulators` snapshot + `platformInstruments` batch | Direct from `instruments.regulator_abbreviation` |
| Status flow | `unclassified → active` via Review Save gate (per-obligation classification) | `Published` instruments already classified; obligations are sealed. |
| Columns | 5 content cols as above; Actions has Edit/Delete | Same 5 content cols; Actions col omitted or shows View only |
| Points | May be empty until points batch generation completes | Same, but always populated after `ToolkitStartupSeeder.generatePointsForToolkit()` |

Tenant reuses `FormattedText` verbatim/interpreted split identically in both apps. Intel Explorer should import the same component.

## Styling Rules

- `Paper variant="outlined"` for KPI cards, filter bar, all detail sections.
- `#F7FAFC` for `TableHead` bg, `fontWeight: 700`.
- `Chip sx={{ height:22, borderRadius:'4px' }}` for risk/regulator/status; regulator chip `bgcolor:'#1A365D', color:'#fff', fontWeight:600`.
- Detail title `variant="h6" sx={{ fontWeight:400 }}` (NOT 700).
- Section captions `variant="caption" sx={{ fontWeight:600, color:'text.secondary', textTransform:'uppercase', letterSpacing:0.5 }}`.
- Table rows `hover` + `sx={{ cursor:'pointer', '&:hover':{ bgcolor:'#F7FAFC' }}}`.
- Detail max width `900`, drawer `width:480`.
- Use `Tooltip` for truncated obligation text and action buttons.

## Checklist

- [ ] 4 KPI cards with correct colours + `applyKpiFilter` handlers
- [ ] Filters init from `useSearchParams` + all 6 filters + Clear
- [ ] Table max 5 content cols (# + Obligation + Regulator + Risk + Owner + Controls) + Actions; sortable `name` + `tenantRiskRating`
- [ ] Row click navigates to `/obligations/:id` (detail route, NOT drawer)
- [ ] Detail route uses `FormattedText` split verbatim (`description`) vs interpreted (`plainEnglishStatement`)
- [ ] FormattedText: `cleanText` + `(${marker})` + `level` indent + `pointType` filter
- [ ] TanStack Query `useQuery` + `signal` + `Pageable sort=field,dir` + `TablePagination 10/20/50`
- [ ] Tenant: editable modals + delete confirm; Intel: read-only (remove mutation UI)
