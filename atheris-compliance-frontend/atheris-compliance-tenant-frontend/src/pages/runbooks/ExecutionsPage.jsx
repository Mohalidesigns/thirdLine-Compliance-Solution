import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Chip, FormControlLabel, IconButton, LinearProgress, Switch, TextField, Tooltip, Typography,
} from '@mui/material';
import {
  ArrowPathIcon, BellIcon, CheckCircleIcon, ClockIcon, EyeIcon, FilterBar, FilterField, KpiCards, PageHeader,
  QueueListIcon, SectionTable, StatusBadge, TL,
} from 'shared';
import { api } from '../../services/api';
import RunbooksNav from '../../components/runbooks/RunbooksNav';
import { DueChip } from '../../components/runbooks/execution/Countdown';
import {
  EXECUTIONS_KEY, execTone, isActiveExecution, outcomeTone, statusLabel,
} from '../../components/runbooks/execution/executionUtils';
import { ACTIVE_EXECUTION_STATUSES, EXECUTION_STATUSES } from './runbookConstants';

const executionPath = (row) => (isActiveExecution(row.status)
  ? `/runbooks/executions/${row.executionId}`
  : `/runbooks/executions/${row.executionId}/summary`);

function ProgressCell({ row }) {
  const total = row.stepsTotal || 0;
  const passed = row.stepsPassed || 0;
  const failed = row.stepsFailed || 0;
  const skipped = row.stepsSkipped || 0;
  const pct = total ? Math.round(((passed + failed + skipped) / total) * 100) : 0;
  return (
    <Box sx={{ minWidth: 150 }}>
      <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{passed}/{total}</Typography>
        {failed > 0 && <Typography variant="caption" sx={{ color: TL.error, fontWeight: 600 }}>{failed} failed</Typography>}
        {skipped > 0 && <Typography variant="caption" color="text.secondary">{skipped} skipped</Typography>}
      </Box>
      <LinearProgress variant="determinate" value={pct} color={failed > 0 ? 'error' : 'primary'}
        sx={{ height: 4, borderRadius: 2, my: 0.5 }} />
      <Typography variant="caption" color="text.secondary">
        {row.evidenceCount ?? 0} evidence item{row.evidenceCount === 1 ? '' : 's'}
      </Typography>
    </Box>
  );
}

const COLUMNS = [
  { id: 'execution', label: 'Execution', minWidth: 280, sortable: true, sortField: 'executionRef', render: (r) => (
    <Box sx={{ minWidth: 0 }}>
      <Chip size="small" label={r.executionRef || `#${r.executionId}`}
        sx={{ fontFamily: TL.mono, fontSize: '0.75rem', height: 22, bgcolor: TL.gray100, mb: 0.5 }} />
      <Tooltip title={`${r.runbookCode || ''} ${r.runbookTitle || ''}`}>
        <Typography variant="caption" sx={{
          display: 'block', color: TL.gray600, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          <Box component="span" sx={{ fontFamily: TL.mono }}>{r.runbookCode}</Box> · {r.runbookTitle || 'Untitled runbook'}
          {r.versionNumber != null ? ` · v${r.versionNumber}` : ''}
        </Typography>
      </Tooltip>
    </Box>
  ) },
  { id: 'operator', label: 'Operator', minWidth: 140, render: (r) => (
    <Box>
      {r.operatorName
        ? <Typography variant="body2">{r.operatorName}</Typography>
        : <Typography variant="body2" color="text.secondary">Unassigned</Typography>}
      {r.triggerType && <Typography variant="caption" color="text.secondary">{statusLabel(r.triggerType)}</Typography>}
    </Box>
  ) },
  { id: 'status', label: 'Status', minWidth: 140, sortable: true, sortField: 'status', render: (r) => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start' }}>
      <StatusBadge label={statusLabel(r.status)} tone={execTone(r.status)} />
      {r.outcome && <StatusBadge label={r.outcome} tone={outcomeTone(r.outcome)} />}
    </Box>
  ) },
  { id: 'due', label: 'Due', minWidth: 150, sortable: true, sortField: 'dueAt', render: (r) => (
    <DueChip dueAt={r.dueAt} startedAt={r.startedAt} createdAt={r.createdAt} completedAt={r.completedAt}
      overdue={r.overdue} active={isActiveExecution(r.status)} />
  ) },
  { id: 'progress', label: 'Progress', minWidth: 160, render: (r) => <ProgressCell row={r} /> },
];

const STATUS_OPTIONS = EXECUTION_STATUSES.map((s) => ({ value: s, label: statusLabel(s) }));

export default function ExecutionsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || 'All');
  const [runbookFilter, setRunbookFilter] = useState(() => searchParams.get('runbookId') || 'All');
  const [overdueOnly, setOverdueOnly] = useState(() => searchParams.get('overdue') === 'true');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [sortField, setSortField] = useState('');
  const [sortDir, setSortDir] = useState('desc');

  const params = { page, size };
  if (search.trim()) params.q = search.trim();
  if (statusFilter !== 'All') params.status = statusFilter;
  if (runbookFilter !== 'All') params.runbookId = runbookFilter;
  if (overdueOnly) params.overdue = true;
  if (from) params.from = from;
  if (to) params.to = to;
  if (sortField) params.sort = `${sortField},${sortDir}`;

  const listQuery = useQuery({
    queryKey: [...EXECUTIONS_KEY, 'list', params],
    queryFn: ({ signal }) => api.runbooks.executions.list(params, { signal }),
    placeholderData: keepPreviousData,
  });
  const statsQuery = useQuery({
    queryKey: [...EXECUTIONS_KEY, 'stats'],
    queryFn: ({ signal }) => api.runbooks.executions.stats({ signal }),
  });
  const runbooksQuery = useQuery({
    queryKey: ['runbooks', 'options'],
    queryFn: ({ signal }) => api.runbooks.list({ page: 0, size: 200, sort: 'runbookCode,asc' }, { signal }),
    staleTime: 5 * 60 * 1000,
  });

  const rows = listQuery.data?.content || [];
  const total = listQuery.data?.totalElements || 0;
  const stats = statsQuery.data || {};
  const runbookOptions = (runbooksQuery.data?.content || []).map((r) => ({
    value: String(r.runbookId), label: `${r.runbookCode} · ${r.title}`,
  }));
  // Keep the URL-provided runbook selectable even before the options load.
  if (runbookFilter !== 'All' && !runbookOptions.some((o) => o.value === runbookFilter)) {
    runbookOptions.unshift({ value: runbookFilter, label: `Runbook #${runbookFilter}` });
  }

  const hasFilters = search || statusFilter !== 'All' || runbookFilter !== 'All' || overdueOnly || from || to;

  const syncUrl = (patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([k, v]) => { if (v == null || v === 'All' || v === false) next.delete(k); else next.set(k, String(v)); });
    setSearchParams(next, { replace: true });
  };
  const setStatus = (v) => { setStatusFilter(v); setPage(0); syncUrl({ status: v }); };
  const setRunbook = (v) => { setRunbookFilter(v); setPage(0); syncUrl({ runbookId: v }); };
  const setOverdue = (v) => { setOverdueOnly(v); setPage(0); syncUrl({ overdue: v }); };

  const clearFilters = () => {
    setSearch(''); setStatusFilter('All'); setRunbookFilter('All'); setOverdueOnly(false); setFrom(''); setTo('');
    setPage(0); setSearchParams(new URLSearchParams(), { replace: true });
  };

  // KPI breakdowns: label → [count, onDrill].
  const byStatus = stats.byStatus || {};
  const activeBreakdown = Object.fromEntries(
    ACTIVE_EXECUTION_STATUSES.filter((s) => byStatus[s]).map((s) => [statusLabel(s), byStatus[s]]),
  );
  const allBreakdown = Object.fromEntries(Object.entries(byStatus).filter(([, n]) => n).map(([s, n]) => [statusLabel(s), n]));
  const outcomes30d = {
    'Passed (30d)': stats.completedPass30d ?? 0,
    'Failed (30d)': stats.completedFail30d ?? 0,
    'Aborted (30d)': stats.aborted30d ?? 0,
  };
  const statusFromLabel = (label) => EXECUTION_STATUSES.find((s) => statusLabel(s) === label);
  const OUTCOME_STATUS = { 'Passed (30d)': 'COMPLETED_PASS', 'Failed (30d)': 'COMPLETED_FAIL', 'Aborted (30d)': 'ABORTED' };

  const kpis = [
    { key: 'active', label: 'Active', value: stats.active ?? 0, tone: 'blue', icon: <QueueListIcon />,
      breakdown: activeBreakdown, active: statusFilter === 'IN_PROGRESS' },
    { key: 'overdue', label: 'Overdue', value: stats.overdue ?? 0, tone: 'red', icon: <ClockIcon />,
      breakdown: allBreakdown, active: overdueOnly },
    { key: 'signoff', label: 'Pending sign-off', value: stats.pendingSignoff ?? 0, tone: 'orange', icon: <CheckCircleIcon />,
      breakdown: outcomes30d, active: statusFilter === 'PENDING_SIGNOFF' },
    { key: 'escalations', label: 'Open escalations', value: stats.openEscalations ?? 0, tone: 'purple', icon: <BellIcon />,
      breakdown: byStatus.ESCALATED ? { Escalated: byStatus.ESCALATED, ...activeBreakdown } : activeBreakdown,
      active: statusFilter === 'ESCALATED' },
  ];

  const onKpiSelect = (key) => {
    setPage(0);
    if (key === 'active') setStatus(statusFilter === 'IN_PROGRESS' ? 'All' : 'IN_PROGRESS');
    if (key === 'overdue') setOverdue(!overdueOnly);
    if (key === 'signoff') setStatus(statusFilter === 'PENDING_SIGNOFF' ? 'All' : 'PENDING_SIGNOFF');
    if (key === 'escalations') setStatus(statusFilter === 'ESCALATED' ? 'All' : 'ESCALATED');
  };
  const onKpiDrill = (key, label) => {
    if (key === 'overdue') setOverdue(true);
    const s = OUTCOME_STATUS[label] || statusFromLabel(label);
    if (s) setStatus(s);
  };

  return (
    <Box>
      <PageHeader
        title="Runbook Executions"
        subtitle={`${total} execution${total === 1 ? '' : 's'} — live runs, SLA countdowns and sign-off`}
        actions={(
          <Tooltip title="Refresh">
            <IconButton onClick={() => queryClient.invalidateQueries({ queryKey: EXECUTIONS_KEY })}>
              <ArrowPathIcon size={18} />
            </IconButton>
          </Tooltip>
        )}
      />
      <RunbooksNav />

      {statsQuery.error && <Alert severity="warning" sx={{ mb: 2 }}>Stats unavailable: {statsQuery.error.message}</Alert>}

      <KpiCards items={kpis} onSelect={onKpiSelect} onDrill={onKpiDrill} columns={4} />

      <FilterBar
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(0); }, placeholder: 'Search ref, runbook or operator…', minWidth: 240 }}
        filters={[
          { key: 'status', label: 'Status', minWidth: 160, value: statusFilter, onChange: setStatus, allLabel: 'All statuses', options: STATUS_OPTIONS },
          { key: 'runbook', label: 'Runbook', minWidth: 220, value: runbookFilter, onChange: setRunbook, allLabel: 'All runbooks', options: runbookOptions },
        ]}
        showClear={!!hasFilters}
        onClear={clearFilters}
      >
        <FilterField label="From" minWidth={150}>
          <TextField size="small" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }}
            sx={{ '& .MuiOutlinedInput-root': { height: 40 } }} />
        </FilterField>
        <FilterField label="To" minWidth={150}>
          <TextField size="small" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }}
            sx={{ '& .MuiOutlinedInput-root': { height: 40 } }} />
        </FilterField>
        <FilterField label="Overdue" minWidth={110}>
          <FormControlLabel sx={{ height: 40, m: 0 }}
            control={<Switch checked={overdueOnly} onChange={(e) => setOverdue(e.target.checked)} />}
            label={<Typography variant="body2">Only</Typography>} />
        </FilterField>
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
          else { setSortField(field); setSortDir(field === 'dueAt' ? 'asc' : 'desc'); }
          setPage(0);
        }}
        onPage={setPage}
        onSize={(s) => { setSize(s); setPage(0); }}
        onRowClick={(r) => navigate(executionPath(r))}
        rowKey={(r) => r.executionId}
        emptyMessage={hasFilters ? 'No executions match these filters.' : 'No executions yet — start one from a published runbook.'}
        actions={(r) => (
          <Tooltip title={isActiveExecution(r.status) ? 'Open console' : 'View summary'}>
            <IconButton size="small" onClick={() => navigate(executionPath(r))}><EyeIcon size={16} /></IconButton>
          </Tooltip>
        )}
      />
    </Box>
  );
}
