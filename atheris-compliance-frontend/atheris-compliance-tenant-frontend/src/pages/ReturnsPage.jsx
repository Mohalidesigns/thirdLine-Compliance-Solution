import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  Box, Typography, Chip, Button, CircularProgress, Alert, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Tooltip, TablePagination, TableSortLabel,
  Snackbar, Alert as MuiAlert,
} from '@mui/material';
import {
  PageHeader, KpiCards, FilterBar, StatusBadge,
  ArrowPathIcon, PlusIcon, ArrowUpTrayIcon, ClockIcon, CheckCircleIcon,
  ClipboardDocumentListIcon, ExclamationTriangleIcon,
  PresentationChartLineIcon,
} from 'shared';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { isReadOnly } from '../utils/roles';
import CreateReturnDialog from '../components/modals/CreateReturnDialog';
import ImportDialog from '../components/modals/ImportDialog';
import ReturnRepairDialog from '../components/modals/ReturnRepairDialog';

const IMPORT_ROLES = ['CCO', 'TENANT_ADMIN'];
const DUE_DATE_NEEDED = 'Due date needed';

const STATUS_TONE = {
  'Not Started': 'gray', 'In Progress': 'blue', 'Submitted': 'green',
  'Submitted Late': 'orange', 'Overdue': 'red',
};

function statusBadge(status, label) {
  return <StatusBadge label={label || status} tone={STATUS_TONE[status] || 'gray'} />;
}

function formatDate(d) {
  if (!d) return '-';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isEventDriven(item) {
  const type = (item?.frequencyType || '').toLowerCase().replace(/[\s_-]/g, '');
  if (type === 'eventdriven') return true;
  const f = (item?.frequency || '').toLowerCase().replace(/[\s_-]/g, '');
  return f === 'eventdriven' || f === 'onevent';
}

function noPeriodLabel(item) {
  return isEventDriven(item) ? 'On event' : 'No scheduled period';
}

const COLUMNS = [
  { id: 'returnName', label: 'Return', minWidth: 320, sortField: 'returnName' },
  { id: 'regulator', label: 'Regulator', minWidth: 130, sortField: 'filingRegulator' },
  { id: 'dueDate', label: 'Due Date', minWidth: 150, sortField: 'currentDueDate' },
  { id: 'status', label: 'Status', minWidth: 130, sortField: 'currentStatus' },
  { id: 'actObligation', label: 'Act / Obligation', minWidth: 220 },
];

export default function ReturnsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canImport = IMPORT_ROLES.includes(user?.role);
  const isTenantAdmin = user?.role === 'TENANT_ADMIN';

  const [importOpen, setImportOpen] = useState(false);
  const [repairOpen, setRepairOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [snackbar, setSnackbar] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [frequencyFilter, setFrequencyFilter] = useState('All');
  const [regulatorFilter, setRegulatorFilter] = useState('All');
  const [actFilter, setActFilter] = useState('All');
  const [unlinkedFilter, setUnlinkedFilter] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [sortField, setSortField] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  const hasFilters = search || statusFilter !== 'All' || frequencyFilter !== 'All' || regulatorFilter !== 'All' || actFilter !== 'All' || unlinkedFilter;

  const params = { page, size: rowsPerPage };
  if (search) params.q = search;
  if (statusFilter !== 'All') params.status = statusFilter;
  if (frequencyFilter !== 'All') params.frequency = frequencyFilter;
  if (regulatorFilter !== 'All') params.regulator = regulatorFilter;
  if (actFilter !== 'All') params.act = actFilter;
  if (unlinkedFilter) params.unlinked = 'true';
  if (sortField) params.sort = `${sortField},${sortDir}`;

  const listQuery = useQuery({
    queryKey: ['returns', 'register', params],
    queryFn: ({ signal }) => api.returns.register(params, { signal }),
    placeholderData: keepPreviousData,
  });
  const statsQuery = useQuery({
    queryKey: ['returns', 'stats'],
    queryFn: ({ signal }) => api.returns.stats({ signal }),
  });
  // All acts (not just those already on a return) so the Act filter offers the full list.
  const actsQuery = useQuery({
    queryKey: ['acts', 'options'],
    queryFn: ({ signal }) => api.acts.list({ size: 1000 }, { signal }),
    staleTime: 5 * 60 * 1000,
  });
  // One-off schedule repair preview (dry run). TENANT_ADMIN only; errors (incl. 403) render nothing.
  const repairQuery = useQuery({
    queryKey: ['returns', 'frequency-repair'],
    queryFn: ({ signal }) => api.returns.frequencyRepairPreview({ signal }),
    enabled: isTenantAdmin,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const repairCount = repairQuery.isError ? 0 : (repairQuery.data?.items?.length ?? 0);

  const items = listQuery.data?.content || [];
  const total = listQuery.data?.totalElements || 0;
  const stats = statsQuery.data;
  const actOptions = ((actsQuery.data?.content) || (Array.isArray(actsQuery.data) ? actsQuery.data : []))
    .map(a => a.name).filter(Boolean);
  const loading = listQuery.isPending;
  const error = listQuery.error?.message || '';

  function refresh() { queryClient.invalidateQueries({ queryKey: ['returns'] }); }
  function clearFilters() {
    setSearch(''); setStatusFilter('All'); setFrequencyFilter('All'); setRegulatorFilter('All'); setActFilter('All');
    setUnlinkedFilter(false); setPage(0);
  }
  function applyKpiFilter(type) {
    setPage(0);
    if (type === 'unlinked') { setUnlinkedFilter(v => !v); setStatusFilter('All'); return; }
    setUnlinkedFilter(false);
    if (type === 'overdue') setStatusFilter('Overdue');
    else if (type === 'inProgress') setStatusFilter('In Progress');
    else if (type === 'submitted') setStatusFilter('Submitted');
    else if (type === 'dueDateNeeded') setStatusFilter(DUE_DATE_NEEDED);
    else setStatusFilter('All');
  }

  const KPI_STATUS = { overdue: 'Overdue', inProgress: 'In Progress', submitted: 'Submitted' };
  const kpis = [
    { key: 'total', label: 'Filing Periods', value: stats?.total ?? 0, tone: 'blue', icon: <ClipboardDocumentListIcon /> },
    { key: 'overdue', label: 'Overdue', value: stats?.overdue ?? 0, tone: 'red', icon: <ExclamationTriangleIcon /> },
    { key: 'inProgress', label: 'In Progress', value: stats?.inProgress ?? 0, tone: 'orange', icon: <PresentationChartLineIcon /> },
    { key: 'submitted', label: 'Submitted', value: stats?.submitted ?? 0, tone: 'green', icon: <CheckCircleIcon /> },
  ].map((k) => ({ ...k, active: KPI_STATUS[k.key] != null && KPI_STATUS[k.key] === statusFilter }));
  const opts = (list) => (list || []).map((v) => ({ value: v, label: v }));

  const snackbarEl = (
    <Snackbar open={!!snackbar} autoHideDuration={3000} onClose={() => setSnackbar('')}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <MuiAlert severity="success" variant="filled" onClose={() => setSnackbar('')}>{snackbar}</MuiAlert>
    </Snackbar>
  );

  return (
    <Box>
      <PageHeader
        title="Returns Register"
        subtitle={`${total} return${total !== 1 ? 's' : ''} — track calendar schedules and triggered filing events`}
        actions={(
          <>
            <Tooltip title="Refresh"><IconButton onClick={refresh}><ArrowPathIcon size={18} /></IconButton></Tooltip>
            {canImport && (
              <Button variant="outlined" startIcon={<ArrowUpTrayIcon size={16} />} onClick={() => setImportOpen(true)}>
                Import
              </Button>
            )}
            {!isReadOnly(user?.role) && (
              <Button variant="contained" startIcon={<PlusIcon size={16} />} onClick={() => setCreateOpen(true)}>
                Add Return
              </Button>
            )}
          </>
        )}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}
          action={<Button size="small" onClick={() => listQuery.refetch()}>Retry</Button>}>
          {error}
        </Alert>
      )}

      {isTenantAdmin && repairCount > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}
          action={<Button color="inherit" size="small" onClick={() => setRepairOpen(true)}>Review &amp; repair</Button>}>
          {repairCount} return{repairCount === 1 ? ' needs' : 's need'} schedule fixes (wrong frequency or due date),
          so some periods show as overdue in error.
        </Alert>
      )}

      <KpiCards items={kpis} onSelect={applyKpiFilter} columns={4} />

      <FilterBar
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(0); }, placeholder: 'Search return, act, or regulator...' }}
        filters={[
          { key: 'status', label: 'Status', value: statusFilter, onChange: (v) => { setStatusFilter(v); setPage(0); },
            options: opts(['Not Started', 'In Progress', 'Submitted', 'Submitted Late', 'Overdue', DUE_DATE_NEEDED]), allLabel: 'All', minWidth: 150 },
          { key: 'frequency', label: 'Frequency', value: frequencyFilter, onChange: (v) => { setFrequencyFilter(v); setPage(0); },
            options: opts(['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Semi-Annual', 'Annual', 'Biennial', 'On event']), allLabel: 'All', minWidth: 140 },
          { key: 'regulator', label: 'Regulator', value: regulatorFilter, onChange: (v) => { setRegulatorFilter(v); setPage(0); },
            options: opts(stats?.regulators), allLabel: 'All', minWidth: 150 },
          { key: 'act', label: 'Act', value: actFilter, onChange: (v) => { setActFilter(v); setPage(0); },
            options: opts(actOptions.length ? actOptions : stats?.actNames), allLabel: 'All', minWidth: 200 },
        ]}
        showClear={!!hasFilters}
        onClear={clearFilters}
      />

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : items.length === 0 ? (
        <Paper sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <ClockIcon size={48} sx={{ mb: 1, opacity: 0.3 }} />
          <Typography variant="body1">No returns found.</Typography>
        </Paper>
      ) : (
        <Paper sx={{ overflow: 'hidden' }}>
          <TableContainer>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: 50 }}>#</TableCell>
                  {COLUMNS.map(c => {
                    const active = sortField === c.sortField;
                    return (
                      <TableCell key={c.id} sx={{ minWidth: c.minWidth,
                        cursor: c.sortField ? 'pointer' : 'default', userSelect: 'none' }}
                        onClick={c.sortField ? () => {
                          if (sortField === c.sortField) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                          else { setSortField(c.sortField); setSortDir('asc'); }
                          setPage(0);
                        } : undefined}>
                        {c.sortField
                          ? <TableSortLabel active={active} direction={sortDir}
                              sx={{ '& .MuiTableSortLabel-icon': { opacity: active ? 1 : 0.4 } }}>
                              {c.label}
                            </TableSortLabel>
                          : c.label}
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item, idx) => {
                  const isOverdue = item.hasOverdue;
                  const hasInstance = item.currentInstanceId != null || !!item.currentDueDate;
                  const status = item.currentStatus || (hasInstance ? 'Not Started' : null);
                  const shownStatus = !status ? null
                    : (isOverdue && status !== 'Submitted' && status !== 'Submitted Late') ? 'Overdue' : status;
                  const actOrObligation = item.actName || item.linkedObligationTitle || null;
                  const rowBg = isOverdue ? '#FFF5F5' : 'inherit';
                  return (
                    <TableRow key={item.returnId} hover
                      sx={{ cursor: 'pointer', bgcolor: rowBg, '&:hover': { bgcolor: isOverdue ? '#FEE2E2' : undefined } }}
                      onClick={() => navigate(`/returns/${item.returnId}`)}>
                      <TableCell sx={{ color: 'text.secondary', fontFamily: '"Roboto Mono", monospace', fontSize: '0.75rem' }}>{page * rowsPerPage + idx + 1}</TableCell>

                      {/* Return title */}
                      <TableCell sx={{ minWidth: 320, maxWidth: 400 }}>
                        <Tooltip title={item.returnName || 'Untitled'}>
                          <Typography variant="body2" sx={{ maxWidth: 380, fontWeight: 500, color: 'primary.main', lineHeight: 1.3,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.returnName || 'Untitled'}
                          </Typography>
                        </Tooltip>
                      </TableCell>

                      <TableCell>
                        {item.filingRegulator ? <Chip size="small" label={item.filingRegulator} /> : <Typography variant="body2" color="text.secondary">—</Typography>}
                      </TableCell>

                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {item.currentDueDate ? formatDate(item.currentDueDate)
                            : item.dueDateNeeded && !isEventDriven(item) ? '—'
                              : isEventDriven(item) ? (item.eventTriggerConfigured ? (item.eventTriggerLabel || 'On event') : 'Trigger setup needed')
                                : noPeriodLabel(item)}
                        </Typography>
                        {item.dueDateNeeded && !isEventDriven(item) && (
                          <Box sx={{ mt: 0.25 }}><StatusBadge label={DUE_DATE_NEEDED} tone="amber" /></Box>
                        )}
                      </TableCell>

                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                          {shownStatus
                            ? statusBadge(shownStatus, shownStatus === 'Overdue' ? 'OVERDUE' : undefined)
                            : <StatusBadge label={isEventDriven(item) ? 'On event' : 'No period'} tone="gray" />}
                          {isEventDriven(item) && item.eventFilingCount > 0 && (
                            <StatusBadge label={`${item.eventFilingCount} filing${item.eventFilingCount === 1 ? '' : 's'}`}
                              tone={item.eventOverdueCount > 0 ? 'red' : 'gray'} />
                          )}
                        </Box>
                      </TableCell>

                      <TableCell sx={{ maxWidth: 260 }}>
                        {actOrObligation ? (
                          <Tooltip title={actOrObligation}>
                            <Typography variant="body2" sx={{ maxWidth: 250, lineHeight: 1.3,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {actOrObligation}
                            </Typography>
                          </Tooltip>
                        ) : (
                          <Typography variant="body2" color="text.secondary">—</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage} onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[10, 20, 50]} />
        </Paper>
      )}

      {isTenantAdmin && (
        <ReturnRepairDialog open={repairOpen} onClose={() => setRepairOpen(false)} preview={repairQuery.data} />
      )}
      <CreateReturnDialog open={createOpen} onClose={() => setCreateOpen(false)}
        onSaved={() => { setCreateOpen(false); refresh(); }} onSnackbar={setSnackbar} />
      {canImport && (
        <ImportDialog entityType="returns" entityLabel="returns" open={importOpen}
          itemLabel="Return" contextLabel="Due / Links"
          invalidateKeys={[['returns'], ['obligations'], ['dashboard']]}
          onClose={() => setImportOpen(false)}
          onImported={(r) => setSnackbar(`Imported ${r?.importedRows ?? 0} returns.`)} />
      )}
      {snackbarEl}
    </Box>
  );
}
