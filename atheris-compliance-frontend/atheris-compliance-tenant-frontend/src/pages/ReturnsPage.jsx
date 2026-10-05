import { useState, useEffect } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  Box, Typography, Chip, Button, CircularProgress, Alert, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  TextField, MenuItem, Tooltip, TablePagination, TableSortLabel,
  Snackbar, Alert as MuiAlert, Breadcrumbs, Link, Grid, Skeleton,
  Stepper, Step, StepLabel, Card, CardContent, CardHeader,
  Dialog, DialogTitle, DialogContent, DialogActions, Collapse,
} from '@mui/material';
import {
  Search, Refresh, Close, Add, Schedule, CheckCircle,
  Link as LinkIcon, ExpandMore, ExpandLess, UploadFile, EditCalendar, Event, Settings as SettingsIcon,
} from '@mui/icons-material';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import CreateReturnDialog from '../components/modals/CreateReturnDialog';
import ImportDialog from '../components/modals/ImportDialog';
import ReturnRepairDialog from '../components/modals/ReturnRepairDialog';
import EditScheduleDialog from '../components/modals/EditScheduleDialog';
import EventTriggerSetupDialog from '../components/modals/EventTriggerSetupDialog';
import RecordReturnEventDialog from '../components/modals/RecordReturnEventDialog';

const IMPORT_ROLES = ['CCO', 'TENANT_ADMIN'];
const SCHEDULE_ROLES = ['CCO', 'TENANT_ADMIN'];
const EVENT_ROLES = ['ANALYST', 'CCO', 'TENANT_ADMIN'];
const DUE_DATE_NEEDED = 'Due date needed';

const STATUS_COLORS = {
  'Not Started': 'default', 'In Progress': 'info', 'Submitted': 'success',
  'Submitted Late': 'warning', 'Overdue': 'error',
};

// harmonized with ReviewInboxPage / ObligationsRegisterPage
const INHERENT_RISK_CONFIG = {
  Critical: { color: 'error' },
  Extreme: { color: 'error' },
  High: { color: 'error' },
  Moderate: { color: 'warning' },
  Medium: { color: 'warning' },
  Low: { color: 'success' },
};

function inherentRiskChip(rating) {
  const cfg = INHERENT_RISK_CONFIG[rating];
  if (!cfg) return <Chip size="small" label={rating || 'Unrated'} variant="outlined" sx={{ height: 22, borderRadius: '4px' }} />;
  return <Chip size="small" label={rating} color={cfg.color} sx={{ height: 22, borderRadius: '4px', fontWeight: 600 }} />;
}

const STAGE_NAMES = ['Data Gathering', 'Draft', 'Review', 'Sign-off', 'Submitted'];
const ESCALATION_ROLE = { 1: 'Analyst', 2: 'Manager', 3: 'CCO' };

function formatDate(d) {
  if (!d) return '-';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isEventDriven(item) {
  const f = (item?.frequency || item?.frequencyType || '').toLowerCase().replace(/[\s_-]/g, '');
  return f === 'eventdriven';
}

// A return with no current filing instance (event-driven, or not yet materialised).
function noPeriodLabel(item) {
  return isEventDriven(item) ? 'Event-driven' : 'No scheduled period';
}

const COLUMNS = [
  { id: 'returnName', label: 'Return (Act + Frequency)', minWidth: 300, sortField: 'returnName' },
  { id: 'regulator', label: 'Regulator', minWidth: 130, sortField: 'filingRegulator' },
  { id: 'responsible', label: 'Responsible Party', minWidth: 170 },
  { id: 'dueDate', label: 'Due Date', minWidth: 110, sortField: 'currentDueDate' },
  { id: 'status', label: 'Status', minWidth: 110, sortField: 'currentStatus' },
];

export default function ReturnsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canImport = IMPORT_ROLES.includes(user?.role);
  const [detailId, setDetailId] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const isTenantAdmin = user?.role === 'TENANT_ADMIN';
  const canEditSchedule = SCHEDULE_ROLES.includes(user?.role);
  const canRecordEvent = EVENT_ROLES.includes(user?.role);
  const [repairOpen, setRepairOpen] = useState(false);
  // Register item whose schedule is being edited (null = dialog closed).
  const [scheduleItem, setScheduleItem] = useState(null);
  // Register row the detail view was opened from (for "Edit schedule" in the header).
  const [detailItem, setDetailItem] = useState(null);
  const [eventSetupItem, setEventSetupItem] = useState(null);
  const [recordEventItem, setRecordEventItem] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [frequencyFilter, setFrequencyFilter] = useState('All');
  const [regulatorFilter, setRegulatorFilter] = useState('All');
  const [actFilter, setActFilter] = useState('All');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [sortField, setSortField] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  const [expandedRow, setExpandedRow] = useState(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [snackbar, setSnackbar] = useState('');

  const hasFilters = search || statusFilter !== 'All' || frequencyFilter !== 'All' || regulatorFilter !== 'All' || actFilter !== 'All';

  const params = { page, size: rowsPerPage };
  if (search) params.q = search;
  if (statusFilter !== 'All') params.status = statusFilter;
  if (frequencyFilter !== 'All') params.frequency = frequencyFilter;
  if (regulatorFilter !== 'All') params.regulator = regulatorFilter;
  if (actFilter !== 'All') params.act = actFilter;
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

  // One-off schedule repair preview (dry run). TENANT_ADMIN only; errors (incl. 403) render nothing.
  const repairQuery = useQuery({
    queryKey: ['returns', 'frequency-repair'],
    queryFn: ({ signal }) => api.returns.frequencyRepairPreview({ signal }),
    enabled: isTenantAdmin,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  // Items cover returns whose type OR due rule changes (one row per return).
  const repairCount = repairQuery.isError ? 0 : (repairQuery.data?.items?.length ?? 0);

  const detailQuery = useQuery({
    queryKey: ['returns', 'detail', String(detailId)],
    queryFn: ({ signal }) => api.returns.detail(detailId, { signal }),
    enabled: detailId != null,
  });

  const items = listQuery.data?.content || [];
  const total = listQuery.data?.totalElements || 0;
  const stats = statsQuery.data;
  const loading = listQuery.isPending;
  const error = listQuery.error?.message || '';

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['returns'] });
  }

  function clearFilters() {
    setSearch(''); setStatusFilter('All'); setFrequencyFilter('All'); setRegulatorFilter('All'); setActFilter('All');
    setPage(0);
  }

  function applyKpiFilter(type) {
    setPage(0);
    if (type === 'overdue') setStatusFilter('Overdue');
    else if (type === 'inProgress') setStatusFilter('In Progress');
    else if (type === 'submitted') setStatusFilter('Submitted');
    else if (type === 'dueDateNeeded') setStatusFilter(DUE_DATE_NEEDED);
    else setStatusFilter('All');
  }

  const kpis = [
    { key: 'total', label: 'Total Returns', value: stats?.total ?? 0, color: '#2B6CB0', bg: '#EBF8FF' },
    { key: 'overdue', label: 'Overdue', value: stats?.overdue ?? 0, color: '#E53E3E', bg: '#FFF5F5' },
    { key: 'inProgress', label: 'In Progress', value: stats?.inProgress ?? 0, color: '#DD6B20', bg: '#FFFAF0' },
    { key: 'submitted', label: 'Submitted', value: stats?.submitted ?? 0, color: '#38A169', bg: '#F0FFF4' },
    { key: 'dueDateNeeded', label: 'Due date needed', value: stats?.dueDateNeeded ?? 0, color: '#B7791F', bg: '#FFFFF0' },
  ];

  const scheduleDialog = canEditSchedule && (
    <EditScheduleDialog open={scheduleItem != null} item={scheduleItem}
      onClose={() => setScheduleItem(null)}
      onSaved={(updated) => {
        setScheduleItem(null);
        if (updated && detailItem && updated.returnId === detailItem.returnId) setDetailItem(updated);
        setSnackbar('Schedule saved.');
      }} />
  );
  const eventDialogs = (
    <>
      {canEditSchedule && <EventTriggerSetupDialog open={eventSetupItem != null} item={eventSetupItem}
        onClose={() => setEventSetupItem(null)} onSaved={() => { setEventSetupItem(null); queryClient.invalidateQueries({ queryKey: ['returns'] }); setSnackbar('Event trigger saved.'); }} />}
      <RecordReturnEventDialog open={recordEventItem != null} item={recordEventItem}
        onClose={() => setRecordEventItem(null)} onSaved={(instance) => {
          setRecordEventItem(null);
          setSnackbar('Event filing created.');
          if (instance?.instanceId) { setDetailItem(null); setDetailId(instance.instanceId); }
        }} />
    </>
  );
  const snackbarEl = (
    <Snackbar open={!!snackbar} autoHideDuration={3000} onClose={() => setSnackbar('')}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <MuiAlert severity="success" variant="filled" onClose={() => setSnackbar('')}>{snackbar}</MuiAlert>
    </Snackbar>
  );

  if (detailId != null) {
    if (detailQuery.isPending) {
      return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
    }
    if (detailQuery.error) {
      return (
        <Alert severity="error" sx={{ mt: 2 }}
          action={<Button size="small" onClick={() => { setDetailId(null); setDetailItem(null); }}>Back</Button>}>
          {detailQuery.error.message || 'Failed to load return instance.'}
        </Alert>
      );
    }
    const detail = detailQuery.data;
    return (
      <>
        <DetailView
          detail={detail}
          onBack={() => { setDetailId(null); setDetailItem(null); }}
          onRefresh={refresh}
          onSnackbar={setSnackbar}
          onEditEventTrigger={canEditSchedule && isEventDriven(detail) ? () => {
            setEventSetupItem({ returnId: detail.returnId, returnName: detail.returnName,
              frequency: detail.frequency, frequencyType: detail.frequencyType,
              deadlineText: detail.deadlineText, eventTriggerLabel: detail.eventTriggerLabel,
              eventDeadlineMode: detail.eventDeadlineMode, eventDeadlineDays: detail.eventDeadlineDays,
              eventDeadlineUnit: detail.eventDeadlineUnit });
          } : null}
          onEditSchedule={canEditSchedule && detail?.returnId != null && !isEventDriven(detailItem || detail)
            ? () => setScheduleItem(detailItem?.returnId === detail.returnId
              ? detailItem
              : { returnId: detail.returnId, returnName: detail.returnName, frequency: detail.frequency, frequencyType: detail.frequencyType })
            : null}
        />
        {scheduleDialog}
        {eventDialogs}
        {snackbarEl}
      </>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
        <Box>
          <Typography variant="h4">Returns Register</Typography>
          <Typography variant="body2" color="text.secondary">
            {total} return{total !== 1 ? 's' : ''} — track calendar schedules and triggered filing events
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={refresh}><Refresh /></IconButton>
          </Tooltip>
          {canImport && (
            <Button variant="outlined" startIcon={<UploadFile />} size="medium" onClick={() => setImportOpen(true)}
              sx={{ height: 40, fontWeight: 600, textTransform: 'none' }}>
              Import
            </Button>
          )}
          <Button variant="contained" startIcon={<Add />} size="medium" onClick={() => setCreateOpen(true)}
            sx={{ height: 40, fontWeight: 600, textTransform: 'none' }}>
            Add Return
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}
          action={<Button size="small" onClick={() => listQuery.refetch()}>Retry</Button>}>
          {error}
        </Alert>
      )}

      {isTenantAdmin && repairCount > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}
          action={<Button color="inherit" size="small" onClick={() => setRepairOpen(true)}
            sx={{ fontWeight: 600, textTransform: 'none' }}>Review &amp; repair</Button>}>
          {repairCount} return{repairCount === 1 ? ' needs' : 's need'} schedule fixes (wrong frequency or due date),
          so some periods show as overdue in error.
        </Alert>
      )}

      {/* KPI cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' }, gap: 2, mb: 2 }}>
        {kpis.map(k => (
          <Paper key={k.key} elevation={0} variant="outlined"
            onClick={() => applyKpiFilter(k.key)}
            sx={{ p: 2, cursor: 'pointer', borderLeft: `3px solid ${k.color}`,
              transition: 'box-shadow .2s', '&:hover': { boxShadow: 1 } }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{k.label}</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: k.color }}>{k.value}</Typography>
          </Paper>
        ))}
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" placeholder="Search return, act, or regulator..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          slotProps={{ input: { startAdornment: <Search sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} /> } }}
          sx={{ minWidth: 260 }} />
        <TextField select size="small" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
          label="Status" sx={{ minWidth: 130 }}>
          {['All', 'Not Started', 'In Progress', 'Submitted', 'Submitted Late', 'Overdue', DUE_DATE_NEEDED].map(s =>
            <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={frequencyFilter} onChange={e => { setFrequencyFilter(e.target.value); setPage(0); }}
          label="Frequency" sx={{ minWidth: 130 }}>
          {['All', 'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Semi-Annual', 'Annual', 'Biennial', 'Event-driven'].map(f =>
            <MenuItem key={f} value={f}>{f}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={regulatorFilter} onChange={e => { setRegulatorFilter(e.target.value); setPage(0); }}
          label="Regulator" sx={{ minWidth: 150 }}>
          <MenuItem value="All">All</MenuItem>
          {(stats?.regulators || []).map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={actFilter} onChange={e => { setActFilter(e.target.value); setPage(0); }}
          label="Act" sx={{ minWidth: 200 }}>
          <MenuItem value="All">All</MenuItem>
          {(stats?.actNames || []).map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
        </TextField>
        {hasFilters && (
          <Button size="small" startIcon={<Close />} onClick={clearFilters}>Clear</Button>
        )}
      </Paper>

      {/* Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : items.length === 0 ? (
        <Paper sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <Schedule sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
          <Typography variant="body1">No returns found.</Typography>
        </Paper>
      ) : (
        <Paper>
          <TableContainer>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', minWidth: 50 }}>#</TableCell>
                  {COLUMNS.map(c => {
                    const active = sortField === c.sortField;
                    return (
                      <TableCell key={c.id} sx={{ minWidth: c.minWidth, fontWeight: 700, bgcolor: '#F7FAFC',
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
                  <TableCell sx={{ minWidth: 40, bgcolor: '#F7FAFC' }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item, idx) => {
                  const isOverdue = item.hasOverdue;
                  const isExpanded = expandedRow === item.returnId;
                  const hasInstance = item.currentInstanceId != null || !!item.currentDueDate;
                  const status = item.currentStatus || (hasInstance ? 'Not Started' : null);
                  const rowBg = isOverdue ? '#FFF5F5' : 'inherit';
                  return (
                    <ReturnRow
                      key={item.returnId}
                      item={item}
                      idx={idx}
                      page={page}
                      rowsPerPage={rowsPerPage}
                      isOverdue={isOverdue}
                      isExpanded={isExpanded}
                      rowBg={rowBg}
                      status={status}
                      onExpand={() => setExpandedRow(isExpanded ? null : item.returnId)}
                      onEditSchedule={canEditSchedule && !isEventDriven(item) ? () => setScheduleItem(item) : null}
                      onConfigureEvent={canEditSchedule && isEventDriven(item) ? () => setEventSetupItem(item) : null}
                      onRecordEvent={canRecordEvent && isEventDriven(item) && item.eventTriggerConfigured ? () => setRecordEventItem(item) : null}
                      onOpenEventFiling={(id) => { setDetailItem(item); setDetailId(id); }}
                      onDetail={() => {
                        if (item.currentInstanceId != null) { setDetailItem(item); setDetailId(item.currentInstanceId); }
                        else if (isEventDriven(item)) setExpandedRow(isExpanded ? null : item.returnId);
                        else if (canEditSchedule && !isEventDriven(item)) setScheduleItem(item);
                        else setSnackbar(item.dueDateNeeded
                          ? 'This return needs a due date before periods can be scheduled.'
                          : 'No filing instance for this return yet.');
                      }}
                    />
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

      {scheduleDialog}
      {eventDialogs}
      {snackbarEl}
    </Box>
  );
}

/* ───────── Return Row (with expandable upcoming instances) ───────── */
function ReturnRow({ item, idx, page, rowsPerPage, isOverdue, isExpanded, rowBg, status, onExpand, onDetail,
  onEditSchedule, onConfigureEvent, onRecordEvent, onOpenEventFiling }) {
  return (
    <>
      <TableRow hover sx={{ cursor: 'pointer', bgcolor: rowBg,
        '&:hover': { bgcolor: isOverdue ? '#FEE2E2' : '#F7FAFC' },
        borderLeft: isOverdue ? '3px solid #E53E3E' : '3px solid transparent' }}
        onClick={onDetail}>
        <TableCell sx={{ color: 'text.secondary' }}>{page * rowsPerPage + idx + 1}</TableCell>
        <TableCell sx={{ minWidth: 300, maxWidth: 380 }}>
          <Tooltip title={item.returnName || 'Untitled'}>
            <Typography variant="body2" sx={{ maxWidth: 340, fontWeight: 700, lineHeight: 1.2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.returnName || 'Untitled'}
            </Typography>
          </Tooltip>
          <Tooltip title={item.actName || ''}>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', maxWidth: 340,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.actName || 'No act recorded'}
            </Typography>
          </Tooltip>
          <Box sx={{ mt: 0.5 }}>
            <Chip size="small" label={item.frequency || item.frequencyType || 'Ad hoc'}
              variant="outlined" sx={{ height: 22, borderRadius: '4px', fontSize: '0.7rem' }} />
          </Box>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{item.filingRegulator || '-'}</Typography>
        </TableCell>
        <TableCell sx={{ maxWidth: 200 }}>
          {item.responsibleUnit || item.responsiblePerson ? (
            <>
              <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.2, maxWidth: 190,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.responsibleUnit || '-'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', maxWidth: 190,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.responsiblePerson || 'Unassigned'}
              </Typography>
            </>
          ) : (
            <Typography variant="caption" sx={{ color: '#CBD5E0' }}>Unassigned</Typography>
          )}
        </TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {item.currentDueDate ? formatDate(item.currentDueDate) : item.dueDateNeeded && !isEventDriven(item) ? (
              <Tooltip title={item.deadlineText ? `Regulator wording: ${item.deadlineText}` : 'No due rule recorded'}>
                <Chip size="small" color="warning" label={DUE_DATE_NEEDED} sx={{ height: 22, fontWeight: 600 }} />
              </Tooltip>
            ) : (
              <Typography variant="caption" color="text.secondary">
                {isEventDriven(item) ? (item.eventTriggerConfigured ? item.eventTriggerLabel : 'Trigger setup needed') : noPeriodLabel(item)}
              </Typography>
            )}
            {isEventDriven(item) && item.eventFilingCount > 0 && (
              <Tooltip title={`${item.eventFilingCount} trigger filing(s) · ${item.eventOverdueCount || 0} overdue`}>
                <Chip size="small" label={`${item.eventFilingCount} filing${item.eventFilingCount === 1 ? '' : 's'}`}
                  color={item.eventOverdueCount > 0 ? 'error' : 'default'} sx={{ height: 20 }} />
              </Tooltip>
            )}
            {onEditSchedule && (
              <Tooltip title="Edit schedule">
                <IconButton size="small" onClick={e => { e.stopPropagation(); onEditSchedule(); }}>
                  <EditCalendar fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {onConfigureEvent && !item.eventTriggerConfigured && (
              <Tooltip title={item.eventTriggerConfigured ? 'Edit event trigger' : 'Configure event trigger'}>
                <IconButton size="small" onClick={e => { e.stopPropagation(); onConfigureEvent(); }}>
                  <SettingsIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {onConfigureEvent && item.eventTriggerConfigured && (
              <Tooltip title={`Edit trigger: ${item.eventTriggerLabel}`}>
                <Button size="small" onClick={e => { e.stopPropagation(); onConfigureEvent(); }}>Edit trigger</Button>
              </Tooltip>
            )}
            {onRecordEvent && (
              <Tooltip title="Record trigger occurrence">
                <Button size="small" variant="outlined" startIcon={<Event />} onClick={e => { e.stopPropagation(); onRecordEvent(); }}>
                  Record event
                </Button>
              </Tooltip>
            )}
          </Box>
        </TableCell>
        <TableCell>
          {!status ? (
            <Chip size="small" variant="outlined" label={isEventDriven(item) ? 'Event-driven' : 'No period'}
              sx={{ height: 22 }} />
          ) : (
          <Chip size="small"
            label={isOverdue && status !== 'Submitted' && status !== 'Submitted Late' ? 'OVERDUE' : status}
            color={isOverdue && status !== 'Submitted' && status !== 'Submitted Late' ? 'error' : STATUS_COLORS[status] || 'default'}
            sx={{ height: 22 }} />
          )}
        </TableCell>
        <TableCell>
          <Tooltip title={isExpanded ? 'Hide details' : isEventDriven(item) ? 'Show event filings and linked obligations' : 'Show linked obligations'}>
            <IconButton size="small" onClick={e => { e.stopPropagation(); onExpand(); }}>
              {isExpanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Tooltip>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={COLUMNS.length + 2} sx={{ py: 0, border: 0, bgcolor: '#FAFBFC' }}>
          <Collapse in={isExpanded} unmountOnExit>
            <Box sx={{ py: 1.5, pl: 4, pr: 2 }}>
              {isEventDriven(item) ? (
                <>
                  {onConfigureEvent && !item.eventTriggerConfigured && (
                    <Button size="small" variant="outlined" startIcon={<SettingsIcon />} sx={{ mb: 1 }} onClick={onConfigureEvent}>
                      Configure trigger
                    </Button>
                  )}
                  <EventFilings returnId={item.returnId} onOpen={onOpenEventFiling} />
                </>
              ) : item.upcomingInstances && item.upcomingInstances.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 1, display: 'block' }}>
                    Upcoming Periods
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                    {item.upcomingInstances.map(inst => (
                      <Paper key={inst.instanceId} variant="outlined" sx={{ px: 1.5, py: 0.75, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>{inst.period || '-'}</Typography>
                        <Typography variant="caption" color="text.secondary">{formatDate(inst.dueDate)}</Typography>
                        <Chip size="small" label={inst.status || 'Not Started'}
                          color={STATUS_COLORS[inst.status] || 'default'}
                          sx={{ height: 18, fontSize: '0.65rem' }} />
                      </Paper>
                    ))}
                  </Box>
                  {item.totalInstances > 1 && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      {item.totalInstances} total instance{item.totalInstances !== 1 ? 's' : ''} · {item.overdueCount || 0} overdue
                    </Typography>
                  )}
                </Box>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 1, display: 'block' }}>
                Linked Obligations
              </Typography>
              <LinkedObligations returnId={item.returnId} />
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

function EventFilings({ returnId, onOpen }) {
  const query = useQuery({
    queryKey: ['returns', 'events', String(returnId)],
    queryFn: ({ signal }) => api.returns.eventFilings(returnId, { signal }),
  });
  if (query.isPending) return <Skeleton height={40} />;
  if (query.isError) return <Alert severity="error">{query.error.message || 'Failed to load event filings.'}</Alert>;
  const filings = query.data || [];
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 1, display: 'block' }}>
        Event filings ({filings.length})
      </Typography>
      {filings.length === 0 ? <Typography variant="body2" color="text.secondary">No trigger occurrences recorded yet.</Typography> : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead><TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Trigger date</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Reference / evidence</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Due date</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Filing</TableCell>
            </TableRow></TableHead>
            <TableBody>{filings.map(f => (
              <TableRow key={f.instanceId} hover>
                <TableCell>{formatDate(f.triggerDate)}{f.triggerLabel ? ` · ${f.triggerLabel}` : ''}</TableCell>
                <TableCell sx={{ maxWidth: 300, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                  {f.reference}
                  {f.evidenceFileId && <EvidenceFileButton fileId={f.evidenceFileId} />}
                </TableCell>
                <TableCell>
                  {formatDate(f.dueDate)}
                  {f.dueDateAdjusted && <Tooltip title={`Base deadline ${formatDate(f.unadjustedDueDate)} fell on a weekend/federal holiday; moved to next working day.`}><Chip size="small" label="Adjusted" sx={{ ml: 1, height: 20 }} /></Tooltip>}
                </TableCell>
                <TableCell><Chip size="small" label={f.status || 'Not Started'} color={STATUS_COLORS[f.status] || 'default'} sx={{ height: 22 }} /></TableCell>
                <TableCell><Button size="small" onClick={() => onOpen(f.instanceId)}>Open</Button></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

function EvidenceFileButton({ fileId }) {
  const query = useQuery({ queryKey: ['evidence', String(fileId)], queryFn: ({ signal }) => api.evidence.detail(fileId, { signal }) });
  const [error, setError] = useState('');
  async function download() {
    setError('');
    try {
      const file = await api.evidence.download(fileId);
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement('a');
      link.href = url; link.download = file.name; link.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e.message || 'Evidence download failed'); }
  }
  return <Tooltip title={error || query.data?.originalName || 'Download trigger evidence'}><Button size="small" onClick={download} disabled={query.isPending || query.isError}>{query.isPending ? 'Loading…' : 'Evidence file'}</Button></Tooltip>;
}

/* ───────── Linked Obligations (lazy — mounted only while expanded) ───────── */
function LinkedObligations({ returnId }) {
  const query = useQuery({
    queryKey: ['returns', 'obligations', String(returnId)],
    queryFn: ({ signal }) => api.returns.linkedObligations(returnId, { signal }),
  });

  if (query.isPending) {
    return (
      <Box sx={{ py: 0.5 }}>
        {[0, 1, 2].map(i => <Skeleton key={i} height={32} sx={{ mb: 0.5 }} />)}
      </Box>
    );
  }

  if (query.error) {
    return (
      <Alert severity="error" sx={{ my: 1 }}
        action={<Button size="small" onClick={() => query.refetch()}>Retry</Button>}>
        {query.error.message || 'Failed to load linked obligations.'}
      </Alert>
    );
  }

  const obligations = query.data || [];
  if (obligations.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: '#A0AEC0', py: 2 }}>
        No obligations linked to this return.
      </Typography>
    );
  }

  return (
    <Paper variant="outlined">
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, bgcolor: '#EDF2F7', width: 36 }}>#</TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: '#EDF2F7', minWidth: 260 }}>Obligation</TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: '#EDF2F7', width: 110 }}>Section</TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: '#EDF2F7', width: 140 }}>Area</TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: '#EDF2F7', width: 120 }}>Risk</TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: '#EDF2F7', width: 120 }}>Act</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {obligations.map((o, i) => (
              <TableRow key={o.obligationId ?? i} hover sx={{ '& > td': { py: 1 } }}>
                <TableCell sx={{ color: 'text.secondary', fontWeight: 600 }}>{i + 1}</TableCell>
                <TableCell sx={{ minWidth: 260, maxWidth: 380 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2, maxWidth: 330,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {o.title || o.name || <span style={{ color: '#A0AEC0', fontWeight: 400 }}>Untitled obligation</span>}
                  </Typography>
                  {o.plainEnglishStatement ? (
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', maxWidth: 360,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {o.plainEnglishStatement}
                    </Typography>
                  ) : (
                    <Typography variant="caption" sx={{ color: '#CBD5E0' }}>No interpreted text</Typography>
                  )}
                </TableCell>
                <TableCell>
                  {o.sectionReference ? (
                    <Chip size="small" label={o.sectionReference.slice(0, 24)} variant="outlined"
                      sx={{ height: 22, borderRadius: '4px', fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem' }} />
                  ) : (
                    <Typography variant="caption" color="text.secondary">-</Typography>
                  )}
                </TableCell>
                <TableCell>
                  {o.areaOfFocus ? (
                    <Chip size="small" variant="outlined" label={o.areaOfFocus}
                      sx={{ height: 22, borderRadius: '4px', fontSize: '0.7rem', maxWidth: 130 }} />
                  ) : (
                    <Typography variant="caption" color="text.secondary">-</Typography>
                  )}
                </TableCell>
                <TableCell>{inherentRiskChip(o.inherentRiskRating)}</TableCell>
                <TableCell>
                  {o.actName ? (
                    <Chip size="small" variant="outlined" label={o.actName.slice(0, 22)}
                      sx={{ height: 22, borderRadius: '4px', fontSize: '0.7rem', maxWidth: 110 }} />
                  ) : (
                    <Typography variant="caption" color="text.secondary">-</Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

/* ───────── Detail View ───────── */
function DetailView({ detail, onBack, onRefresh, onSnackbar, onEditSchedule, onEditEventTrigger }) {
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const isSubmitted = detail.status === 'Submitted' || detail.status === 'Submitted Late';
  const currentStageIdx = STAGE_NAMES.indexOf(detail.currentStage);
  const nextStage = currentStageIdx < STAGE_NAMES.length - 1 ? STAGE_NAMES[currentStageIdx + 1] : null;

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link underline="hover" color="inherit" sx={{ cursor: 'pointer' }} onClick={onBack}>Returns Register</Link>
        <Typography color="text.primary">{detail.returnName}</Typography>
      </Breadcrumbs>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
            <Box>
              <Typography variant="h5">{detail.returnName}{detail.triggerDate ? ` · Trigger ${formatDate(detail.triggerDate)}` : detail.period ? ` · ${detail.period}` : ''}</Typography>
              <Typography variant="body2" color="text.secondary">
                {detail.dueDate ? `Due ${formatDate(detail.dueDate)}` : noPeriodLabel(detail)}
                {detail.filingChannel && ` · Channel: ${detail.filingChannel}`}
                {detail.returnOwnerName && ` · Owner: ${detail.returnOwnerName}`}
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                <Chip label={detail.status || 'Not Started'} size="small" color={STATUS_COLORS[detail.status] || 'default'} />
              </Box>
            </Box>
            {onEditSchedule && (
              <Button variant="outlined" size="small" startIcon={<EditCalendar />} onClick={onEditSchedule}
                sx={{ fontWeight: 600, textTransform: 'none' }}>
                Edit schedule
              </Button>
            )}
            {onEditEventTrigger && (
              <Button variant="outlined" size="small" startIcon={<SettingsIcon />} onClick={onEditEventTrigger}
                sx={{ fontWeight: 600, textTransform: 'none' }}>Edit event trigger</Button>
            )}
          </Box>
          {detail.eventTriggerDate && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Triggered {detail.eventTriggerLabel || 'Event'} on {formatDate(detail.eventTriggerDate)} · {detail.eventReference}
              {detail.eventEvidenceFileId && <> · <EvidenceFileButton fileId={detail.eventEvidenceFileId} /></>}
              {detail.eventUnadjustedDueDate && ` · Base deadline ${formatDate(detail.eventUnadjustedDueDate)}`}
              {detail.eventMetadataJson && <Tooltip title={detail.eventMetadataJson}><Chip size="small" label="Trigger details" sx={{ ml: 1, height: 20 }} /></Tooltip>}
              {detail.eventDueDateAdjusted && ` · adjusted to next working day (${formatDate(detail.dueDate)})`}
            </Alert>
          )}
        </CardContent>
      </Card>

      {detail.escalationLevel > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Escalated · Level {detail.escalationLevel} · {ESCALATION_ROLE[detail.escalationLevel] || 'Management'}
          </Typography>
          {detail.escalatedAt && (
            <Typography variant="caption">Escalated since {formatDate(detail.escalatedAt)}</Typography>
          )}
        </Alert>
      )}

      <Card sx={{ mb: 2 }}>
        <CardHeader title="Stages" />
        <CardContent>
          <Stepper activeStep={currentStageIdx} orientation="vertical" sx={{ mb: 2 }}>
            {detail.stages && detail.stages.map((stage, i) => (
              <Step key={i} completed={stage.completed} active={stage.current}>
                <StepLabel optional={
                  <Box sx={{ mt: 0.5 }}>
                    {stage.completedAt && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        Completed {formatDate(stage.completedAt)}
                        {stage.completedByName && ` by ${stage.completedByName}`}
                      </Typography>
                    )}
                    {stage.evidenceUrl && (
                      <Link href={stage.evidenceUrl} target="_blank" rel="noopener" variant="caption"
                        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                        <LinkIcon fontSize="inherit" /> Evidence
                      </Link>
                    )}
                    {stage.current && !isSubmitted && i < STAGE_NAMES.length - 1 && (
                      <Box sx={{ mt: 1 }}>
                        <Button size="small" variant="outlined" onClick={() => setAdvanceOpen(true)}>
                          Mark complete → {STAGE_NAMES[i + 1]}
                        </Button>
                      </Box>
                    )}
                    {stage.current && i === STAGE_NAMES.length - 1 && !isSubmitted && (
                      <Box sx={{ mt: 1 }}>
                        <Button size="small" variant="contained" color="success" onClick={() => setSubmitOpen(true)}>
                          Mark as submitted
                        </Button>
                      </Box>
                    )}
                  </Box>
                }>{stage.name}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {isSubmitted && detail.submissionEvidenceUrl && (
            <Box sx={{ mt: 2, p: 1.5, bgcolor: 'success.50', borderRadius: 1 }}>
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CheckCircle color="success" fontSize="small" />
                Submitted {formatDate(detail.submittedDate)}
                {detail.daysLate > 0 && ` (${detail.daysLate} days late)`}
              </Typography>
              <Link href={detail.submissionEvidenceUrl} target="_blank" rel="noopener" variant="caption">
                View submission receipt
              </Link>
            </Box>
          )}
        </CardContent>
      </Card>

      <AdvanceDialog open={advanceOpen} onClose={() => setAdvanceOpen(false)}
        instanceId={detail.instanceId} stageName={detail.currentStage} nextStageName={nextStage}
        onSaved={() => { setAdvanceOpen(false); onRefresh(); }} onSnackbar={onSnackbar} />
      <SubmitDialog open={submitOpen} onClose={() => setSubmitOpen(false)}
        instanceId={detail.instanceId}
        onSaved={() => { setSubmitOpen(false); onRefresh(); }} onSnackbar={onSnackbar} />
    </Box>
  );
}

/* ───────── Advance Dialog ───────── */
function AdvanceDialog({ open, onClose, instanceId, stageName, nextStageName, onSaved, onSnackbar }) {
  const [form, setForm] = useState({ evidenceUrl: '', completedByName: '' });
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    setSaving(true);
    try { await api.returns.advance(instanceId, form); onSaved(); }
    catch (e) { onSnackbar(e.message); } finally { setSaving(false); }
  };
  useEffect(() => { if (open) setForm({ evidenceUrl: '', completedByName: '' }); }, [open]);
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Advance Stage</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Mark "{stageName}" complete and advance to "{nextStageName}"
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}><TextField label="Evidence URL (optional)" fullWidth size="small" value={form.evidenceUrl}
            onChange={e => setForm(f => ({ ...f, evidenceUrl: e.target.value }))} /></Grid>
          <Grid size={{ xs: 12 }}><TextField label="Completed by name" fullWidth size="small" value={form.completedByName}
            onChange={e => setForm(f => ({ ...f, completedByName: e.target.value }))} /></Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Advancing...' : `Advance to ${nextStageName}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ───────── Submit Dialog ───────── */
function SubmitDialog({ open, onClose, instanceId, onSaved, onSnackbar }) {
  const [form, setForm] = useState({ evidenceUrl: '' });
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    setSaving(true);
    try { await api.returns.submit(instanceId, form); onSaved(); }
    catch (e) { onSnackbar(e.message); } finally { setSaving(false); }
  };
  useEffect(() => { if (open) setForm({ evidenceUrl: '' }); }, [open]);
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Mark as Submitted</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2 }}>
          After filing on the regulator portal, upload the submission receipt.
        </Typography>
        <TextField label="Submission evidence URL" fullWidth size="small" value={form.evidenceUrl}
          onChange={e => setForm(f => ({ ...f, evidenceUrl: e.target.value }))} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="success" onClick={handleSave} disabled={saving}>
          {saving ? 'Submitting...' : 'Mark as Submitted'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
