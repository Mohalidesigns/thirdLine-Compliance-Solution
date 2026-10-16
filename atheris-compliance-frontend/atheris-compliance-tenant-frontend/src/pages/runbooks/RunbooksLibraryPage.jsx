import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, FormControlLabel, IconButton, Snackbar, Switch, Tooltip, Typography,
} from '@mui/material';
import {
  KpiCards, FilterBar, FilterField, SectionTable, PageHeader, TL,
  ArrowPathIcon, PlusIcon, ArrowUpTrayIcon, EyeIcon, CheckCircleIcon, CalendarDaysIcon,
  ExclamationTriangleIcon, ExclamationCircleIcon, BookOpenIcon,
} from 'shared';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import RunbooksNav from '../../components/runbooks/RunbooksNav';
import CreateRunbookDialog from '../../components/runbooks/CreateRunbookDialog';
import LibraryImportDialog from '../../components/runbooks/LibraryImportDialog';
import {
  RunbookStatusBadge, CriticalityBadge, ExecStatusBadge, CodeChip, formatDateTime,
} from '../../components/runbooks/LibraryBadges';
import {
  CATEGORIES, CRITICALITIES, FREQUENCIES, RUNBOOK_STATUSES, AUTHOR_ROLES, APPROVER_ROLES,
  label, humanize,
} from './runbookConstants';

const ALL = 'All';
const MAX_FW_CHIPS = 2;

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? String(d)
    : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Re-keys an enum breakdown ({ PUBLISHED: 3 }) by display label, keeping a label→value map for drill-down. */
function relabel(breakdown, toLabel) {
  const out = {};
  const back = {};
  Object.entries(breakdown || {}).forEach(([k, v]) => {
    const l = toLabel(k);
    out[l] = v;
    back[l] = k;
  });
  return { out, back };
}

const COLUMNS = [
  { id: 'title', label: 'Runbook', minWidth: 360, sortable: true, sortField: 'title', render: (r) => (
    <Box sx={{ minWidth: 0, maxWidth: 480 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
        <CodeChip label={r.runbookCode} />
        <Tooltip title={r.title || ''}>
          <Typography variant="body2" noWrap sx={{ fontWeight: 600, color: 'primary.main', minWidth: 0 }}>
            {r.title || 'Untitled runbook'}
          </Typography>
        </Tooltip>
      </Box>
      <Typography variant="caption" noWrap sx={{ display: 'block', color: TL.gray500, mt: 0.25 }}>
        {[label(CATEGORIES, r.category), label(FREQUENCIES, r.frequency), r.ownerName || 'No owner']
          .filter(Boolean).join(' · ')}
        {r.needsReview ? ' · Review due' : ''}
      </Typography>
    </Box>
  ) },
  { id: 'status', label: 'Status', minWidth: 150, sortable: true, sortField: 'status', render: (r) => (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <RunbookStatusBadge status={r.status} />
        {r.currentVersionNumber != null && (
          <Typography variant="caption" sx={{ color: TL.gray500, fontFamily: TL.mono }}>v{r.currentVersionNumber}</Typography>
        )}
      </Box>
      {r.draftVersionStatus && (
        <Typography variant="caption" sx={{ display: 'block', color: TL.gray500, mt: 0.25 }}>
          {r.draftVersionStatus === 'IN_REVIEW' ? 'Revision in review' : 'Draft'}
          {r.currentVersionNumber != null ? ` v${r.currentVersionNumber + 1}` : ''} pending
        </Typography>
      )}
    </Box>
  ) },
  { id: 'criticality', label: 'Criticality', minWidth: 110, sortable: true, sortField: 'criticality',
    render: (r) => <CriticalityBadge value={r.criticality} /> },
  { id: 'frameworkCodes', label: 'Frameworks', minWidth: 170, render: (r) => {
    const codes = r.frameworkCodes || [];
    if (!codes.length) return <Typography variant="body2" color="text.secondary">Unmapped</Typography>;
    const extra = codes.length - MAX_FW_CHIPS;
    return (
      <Tooltip title={`${codes.join(', ')}${r.clauseCount ? ` — ${r.clauseCount} clauses` : ''}`}>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {codes.slice(0, MAX_FW_CHIPS).map((c) => <Chip key={c} size="small" label={c} sx={{ height: 22 }} />)}
          {extra > 0 && <Chip size="small" variant="outlined" label={`+${extra}`} sx={{ height: 22 }} />}
        </Box>
      </Tooltip>
    );
  } },
  { id: 'lastRun', label: 'Last run', minWidth: 160, render: (r) => {
    if (r.lastExecutionStatus) {
      return (
        <Box>
          <ExecStatusBadge status={r.lastExecutionStatus} />
          <Typography variant="caption" sx={{ display: 'block', color: TL.gray500, mt: 0.25 }}>
            {formatDateTime(r.lastExecutionAt)}
          </Typography>
        </Box>
      );
    }
    if (r.nextRunAt) {
      return (
        <Box>
          <Typography variant="body2">Never run</Typography>
          <Typography variant="caption" sx={{ color: TL.gray500 }}>Next: {formatDate(r.nextRunAt)}</Typography>
        </Box>
      );
    }
    return <Typography variant="body2" color="text.secondary">Never run</Typography>;
  } },
];

export default function RunbooksLibraryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canAuthor = AUTHOR_ROLES.includes(user?.role);
  const canApprove = APPROVER_ROLES.includes(user?.role);

  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [criticality, setCriticality] = useState(ALL);
  const [frequency, setFrequency] = useState(ALL);
  const [frameworkId, setFrameworkId] = useState(ALL);
  const [ownerId, setOwnerId] = useState(ALL);
  const [needsReview, setNeedsReview] = useState(false);
  const [dueWithinDays, setDueWithinDays] = useState(null);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [sortField, setSortField] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [snack, setSnack] = useState(null);

  // Debounce the search box so typing does not fire one request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => { setQ(search.trim()); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const params = { page, size };
  if (q) params.q = q;
  if (category !== ALL) params.category = category;
  if (status !== ALL) params.status = status;
  if (criticality !== ALL) params.criticality = criticality;
  if (frequency !== ALL) params.frequency = frequency;
  if (frameworkId !== ALL) params.frameworkId = frameworkId;
  if (ownerId !== ALL) params.ownerId = ownerId;
  if (needsReview) params.needsReview = true;
  if (dueWithinDays != null) params.dueWithinDays = dueWithinDays;
  if (sortField) params.sort = `${sortField},${sortDir}`;

  const listQuery = useQuery({
    queryKey: ['runbooks', 'list', params],
    queryFn: ({ signal }) => api.runbooks.list(params, { signal }),
    placeholderData: keepPreviousData,
  });
  const statsQuery = useQuery({
    queryKey: ['runbooks', 'stats'],
    queryFn: ({ signal }) => api.runbooks.stats({ signal }),
  });
  const frameworksQuery = useQuery({
    queryKey: ['runbooks', 'frameworks'],
    queryFn: ({ signal }) => api.runbooks.frameworks.list({ signal }),
    staleTime: 10 * 60 * 1000,
  });
  const usersQuery = useQuery({
    queryKey: ['runbooks', 'assignees'],
    queryFn: ({ signal }) => api.runbooks.assignees({ signal }),
    staleTime: 5 * 60 * 1000,
  });

  const rows = listQuery.data?.content || [];
  const total = listQuery.data?.totalElements || 0;
  const stats = statsQuery.data;

  const hasFilters = !!(search || category !== ALL || status !== ALL || criticality !== ALL || frequency !== ALL
    || frameworkId !== ALL || ownerId !== ALL || needsReview || dueWithinDays != null);

  function clearFilters() {
    setSearch(''); setQ(''); setCategory(ALL); setStatus(ALL); setCriticality(ALL); setFrequency(ALL);
    setFrameworkId(ALL); setOwnerId(ALL); setNeedsReview(false); setDueWithinDays(null); setPage(0);
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['runbooks'] });

  const byStatus = useMemo(() => relabel(stats?.byStatus, humanize), [stats]);
  const byCategory = useMemo(() => relabel(stats?.byCategory, (k) => label(CATEGORIES, k)), [stats]);
  const byCriticality = useMemo(() => relabel(stats?.byCriticality, humanize), [stats]);
  const lifecycle = useMemo(() => {
    if (!stats) return { out: {}, back: {} };
    const out = {
      'Active executions': stats.activeExecutions ?? 0,
      Draft: stats.draft ?? 0,
      'In review': stats.inReview ?? 0,
      Deprecated: stats.deprecated ?? 0,
    };
    return { out, back: { Draft: 'DRAFT', 'In review': 'IN_REVIEW', Deprecated: 'DEPRECATED' } };
  }, [stats]);

  const kpis = [
    { key: 'published', label: 'Published', value: stats?.published ?? 0, tone: 'green', icon: <CheckCircleIcon />,
      caption: stats ? `of ${stats.total ?? 0} runbooks` : undefined,
      breakdown: byStatus.out, active: status === 'PUBLISHED',
      drill: (l) => setStatus(byStatus.back[l] || ALL) },
    { key: 'due30', label: 'Due in 30 days', value: stats?.dueIn30Days ?? 0, tone: 'blue', icon: <CalendarDaysIcon />,
      breakdown: byCategory.out, active: dueWithinDays === 30,
      drill: (l) => setCategory(byCategory.back[l] || ALL) },
    { key: 'overdueReviews', label: 'Overdue reviews', value: stats?.overdueReviews ?? 0, tone: 'orange',
      icon: <ExclamationCircleIcon />, breakdown: byCriticality.out, active: needsReview,
      drill: (l) => setCriticality(byCriticality.back[l] || ALL) },
    { key: 'failed', label: 'Failed last run', value: stats?.failedLastRun ?? 0, tone: 'red',
      icon: <ExclamationTriangleIcon />, breakdown: lifecycle.out,
      drill: (l) => {
        if (l === 'Active executions') { navigate('/runbooks/executions'); return; }
        if (lifecycle.back[l]) setStatus(lifecycle.back[l]);
      } },
  ];

  const onKpiSelect = (key) => {
    setPage(0);
    if (key === 'published') { setStatus(status === 'PUBLISHED' ? ALL : 'PUBLISHED'); return; }
    if (key === 'due30') { setDueWithinDays(dueWithinDays === 30 ? null : 30); return; }
    if (key === 'overdueReviews') { setNeedsReview(!needsReview); return; }
    // "Failed last run" has no list filter in the API — sort by recent activity instead.
    if (key === 'failed') { setSortField('updatedAt'); setSortDir('desc'); }
  };
  const onKpiDrill = (key, l) => {
    setPage(0);
    kpis.find((k) => k.key === key)?.drill?.(l);
  };

  const onFilter = (setter) => (v) => { setter(v); setPage(0); };
  const filters = [
    { key: 'category', label: 'Category', minWidth: 160, value: category, onChange: onFilter(setCategory),
      allLabel: 'All categories', options: CATEGORIES },
    { key: 'status', label: 'Status', minWidth: 140, value: status, onChange: onFilter(setStatus),
      allLabel: 'All statuses', options: RUNBOOK_STATUSES.map((s) => ({ value: s, label: humanize(s) })) },
    { key: 'criticality', label: 'Criticality', minWidth: 140, value: criticality, onChange: onFilter(setCriticality),
      allLabel: 'All', options: CRITICALITIES.map((c) => ({ value: c, label: humanize(c) })) },
    { key: 'frequency', label: 'Frequency', minWidth: 140, value: frequency, onChange: onFilter(setFrequency),
      allLabel: 'All', options: FREQUENCIES },
    { key: 'framework', label: 'Framework', minWidth: 160, value: frameworkId, onChange: onFilter(setFrameworkId),
      allLabel: 'All frameworks',
      options: (frameworksQuery.data || []).map((f) => ({ value: f.frameworkId, label: f.code || f.name })) },
    { key: 'owner', label: 'Owner', minWidth: 160, value: ownerId, onChange: onFilter(setOwnerId),
      allLabel: 'All owners',
      options: (usersQuery.data || []).map((u) => ({ value: u.userId, label: u.fullName || u.email })) },
  ];

  const kpiItems = kpis.map(({ drill, ...k }) => k);

  return (
    <Box>
      <PageHeader
        title="Compliance Runbooks"
        subtitle={`${total} runbook${total !== 1 ? 's' : ''} — step-by-step procedures with evidence, mapped to frameworks`}
        actions={(
          <>
            <Tooltip title="Refresh">
              <IconButton onClick={refresh}><ArrowPathIcon size={18} /></IconButton>
            </Tooltip>
            {canApprove && (
              <Button variant="outlined" startIcon={<ArrowUpTrayIcon size={16} />} onClick={() => setImportOpen(true)}>
                Import JSON
              </Button>
            )}
            {canAuthor && (
              <Button variant="contained" startIcon={<PlusIcon size={16} />} onClick={() => setCreateOpen(true)}>
                New Runbook
              </Button>
            )}
          </>
        )}
      />

      <RunbooksNav />

      {statsQuery.error && (
        <Alert severity="warning" sx={{ mb: 2 }}>Runbook statistics are unavailable: {statsQuery.error.message}</Alert>
      )}

      <KpiCards items={kpiItems} onSelect={onKpiSelect} onDrill={onKpiDrill} columns={4} />

      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: 'Search code, title or objective…', minWidth: 240 }}
        filters={filters}
        showClear={hasFilters}
        onClear={clearFilters}
      >
        <FilterField label="Review" minWidth={150}>
          <FormControlLabel
            sx={{ height: 40, m: 0 }}
            control={<Switch size="small" checked={needsReview} onChange={(e) => { setNeedsReview(e.target.checked); setPage(0); }} />}
            label={<Typography variant="body2">Needs review</Typography>}
          />
        </FilterField>
        {dueWithinDays != null && (
          <FilterField label="Due" minWidth={120}>
            <Chip label={`Within ${dueWithinDays} days`} onDelete={() => setDueWithinDays(null)} sx={{ height: 40 }} />
          </FilterField>
        )}
      </FilterBar>

      <SectionTable
        columns={COLUMNS}
        rows={rows}
        total={total}
        page={page}
        size={size}
        loading={listQuery.isPending}
        error={listQuery.error}
        sortField={sortField}
        sortDir={sortDir}
        onSort={(field) => {
          if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
          else { setSortField(field); setSortDir('asc'); }
          setPage(0);
        }}
        onPage={setPage}
        onSize={(s) => { setSize(s); setPage(0); }}
        onRowClick={(r) => navigate(`/runbooks/${r.runbookId}`)}
        rowKey={(r) => r.runbookId}
        emptyIcon={<BookOpenIcon size={32} sx={{ mb: 1 }} />}
        emptyMessage={hasFilters
          ? 'No runbooks match these filters.'
          : 'No runbooks yet — create one or adopt a template from the Templates tab.'}
        actions={(r) => (
          <Tooltip title="Open runbook">
            <IconButton size="small" onClick={() => navigate(`/runbooks/${r.runbookId}`)}>
              <EyeIcon size={16} />
            </IconButton>
          </Tooltip>
        )}
      />

      <CreateRunbookDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <LibraryImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(rb) => {
          setSnack({ severity: 'success', msg: `Imported ${rb?.runbookCode || 'runbook'}.` });
          if (rb?.runbookId != null) navigate(`/runbooks/${rb.runbookId}`);
        }}
      />

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {snack ? <Alert severity={snack.severity} variant="filled" onClose={() => setSnack(null)}>{snack.msg}</Alert> : <span />}
      </Snackbar>
    </Box>
  );
}
