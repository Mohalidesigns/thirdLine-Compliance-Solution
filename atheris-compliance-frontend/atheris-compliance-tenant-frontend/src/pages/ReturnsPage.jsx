import { useState, useEffect } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  Box, Typography, Chip, Button, CircularProgress, Alert, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  TextField, Tooltip, TablePagination, TableSortLabel,
  Snackbar, Alert as MuiAlert, Link, Grid, Skeleton,
  Stepper, Step, StepLabel,
  Dialog, DialogTitle, DialogContent, DialogActions, Collapse,
} from '@mui/material';
import {
  PageHeader, KpiCards, FilterBar, RiskBadge, StatusBadge, TL,
  ArrowPathIcon, PlusIcon, ArrowUpTrayIcon, ClockIcon, CheckCircleIcon, LinkIcon,
  ChevronDownIcon, CalendarIcon, CalendarDaysIcon, ClipboardDocumentListIcon, ExclamationTriangleIcon,
  PresentationChartLineIcon, ExclamationCircleIcon, PencilSquareIcon, QueueListIcon, DocumentTextIcon,
} from 'shared';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { isReadOnly } from '../utils/roles';
import CreateReturnDialog from '../components/modals/CreateReturnDialog';
import ImportDialog from '../components/modals/ImportDialog';
import ReturnRepairDialog from '../components/modals/ReturnRepairDialog';
import EditScheduleDialog from '../components/modals/EditScheduleDialog';
import EventTriggerSetupDialog from '../components/modals/EventTriggerSetupDialog';
import RecordReturnEventDialog from '../components/modals/RecordReturnEventDialog';
import PersonPicker from '../components/common/PersonPicker';
import { Section, Field, FieldGrid, StatTile } from '../components/detailKit';

const IMPORT_ROLES = ['CCO', 'TENANT_ADMIN'];
const SCHEDULE_ROLES = ['CCO', 'TENANT_ADMIN'];
const EVENT_ROLES = ['ANALYST', 'CCO', 'TENANT_ADMIN'];
const DUE_DATE_NEEDED = 'Due date needed';

const STATUS_TONE = {
  'Not Started': 'gray', 'In Progress': 'blue', 'Submitted': 'green',
  'Submitted Late': 'orange', 'Overdue': 'red',
};

function statusBadge(status, label) {
  return <StatusBadge label={label || status} tone={STATUS_TONE[status] || 'gray'} />;
}

const STATUS_ACCENT = {
  'Not Started': '#718096', 'In Progress': '#3182CE', 'Submitted': '#2D7D46',
  'Submitted Late': '#DD6B20', 'Overdue': '#E53E3E',
};

function statusAccent(status) {
  return STATUS_ACCENT[status] || '#2B6CB0';
}

// harmonized with ReviewInboxPage / ObligationsRegisterPage
function inherentRiskChip(rating) {
  if (rating === 'Extreme') return <StatusBadge label="Extreme" tone="red" dot />;
  return <RiskBadge value={rating} />;
}

// Same order as the backend's ReturnStage (Not Started is a stage too — leaving it out shifted
// every "Mark complete → X" label one stage ahead of the real transition).
const STAGE_NAMES = ['Not Started', 'Data Gathering', 'Draft', 'Review', 'Sign-off', 'Submitted'];
const SIGN_OFF_INDEX = STAGE_NAMES.indexOf('Sign-off');
// PUT /returns/instances/{id}/submit is CCO / TENANT_ADMIN only.
const SUBMIT_ROLES = ['CCO', 'TENANT_ADMIN'];
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
  const [uploadLinkItem, setUploadLinkItem] = useState(null);

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

  const KPI_STATUS = { overdue: 'Overdue', inProgress: 'In Progress', submitted: 'Submitted', dueDateNeeded: DUE_DATE_NEEDED };
  const kpis = [
    { key: 'total', label: 'Filing Periods', value: stats?.total ?? 0, tone: 'blue', icon: <ClipboardDocumentListIcon /> },
    { key: 'overdue', label: 'Overdue', value: stats?.overdue ?? 0, tone: 'red', icon: <ExclamationTriangleIcon /> },
    { key: 'inProgress', label: 'In Progress', value: stats?.inProgress ?? 0, tone: 'orange', icon: <PresentationChartLineIcon /> },
    { key: 'submitted', label: 'Submitted', value: stats?.submitted ?? 0, tone: 'green', icon: <CheckCircleIcon /> },
    { key: 'dueDateNeeded', label: 'Due date needed', value: stats?.dueDateNeeded ?? 0, tone: 'amber', icon: <ExclamationCircleIcon /> },
  ].map((k) => ({ ...k, active: KPI_STATUS[k.key] != null && KPI_STATUS[k.key] === statusFilter }));
  const opts = (list) => (list || []).map((v) => ({ value: v, label: v }));

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
      <SendUploadLinkDialog open={uploadLinkItem != null} item={uploadLinkItem}
        onClose={() => setUploadLinkItem(null)} onSnackbar={setSnackbar} />
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
      <PageHeader
        title="Returns Register"
        subtitle={`${total} return${total !== 1 ? 's' : ''} — track calendar schedules and triggered filing events`}
        actions={(
          <>
            <Tooltip title="Refresh">
              <IconButton onClick={refresh}><ArrowPathIcon size={18} /></IconButton>
            </Tooltip>
            {canImport && (
              <Button variant="outlined" startIcon={<ArrowUpTrayIcon size={16} />} onClick={() => setImportOpen(true)}>
                Import
              </Button>
            )}
            {/* POST /returns: analyst, CCO, tenant admin — hidden only for read-only roles */}
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

      <KpiCards items={kpis} onSelect={applyKpiFilter} columns={5} />

      <FilterBar
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(0); }, placeholder: 'Search return, act, or regulator...' }}
        filters={[
          { key: 'status', label: 'Status', value: statusFilter, onChange: (v) => { setStatusFilter(v); setPage(0); },
            options: opts(['Not Started', 'In Progress', 'Submitted', 'Submitted Late', 'Overdue', DUE_DATE_NEEDED]), allLabel: 'All', minWidth: 150 },
          { key: 'frequency', label: 'Frequency', value: frequencyFilter, onChange: (v) => { setFrequencyFilter(v); setPage(0); },
            options: opts(['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Semi-Annual', 'Annual', 'Biennial', 'Event-driven']), allLabel: 'All', minWidth: 140 },
          { key: 'regulator', label: 'Regulator', value: regulatorFilter, onChange: (v) => { setRegulatorFilter(v); setPage(0); },
            options: opts(stats?.regulators), allLabel: 'All', minWidth: 150 },
          { key: 'act', label: 'Act', value: actFilter, onChange: (v) => { setActFilter(v); setPage(0); },
            options: opts(stats?.actNames), allLabel: 'All', minWidth: 200 },
        ]}
        showClear={!!hasFilters}
        onClear={clearFilters}
      />

      {/* Table */}
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
                  <TableCell sx={{ minWidth: 40 }} />
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
                      onSendUploadLink={canRecordEvent && isEventDriven(item) && item.eventTriggerConfigured ? () => setUploadLinkItem(item) : null}
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
  onEditSchedule, onConfigureEvent, onRecordEvent, onSendUploadLink, onOpenEventFiling }) {
  return (
    <>
      <TableRow hover sx={{ cursor: 'pointer', bgcolor: rowBg,
        ...(isOverdue ? { '&:hover': { bgcolor: '#FEE2E2' } } : {}) }}
        onClick={onDetail}>
        <TableCell sx={{ color: 'text.secondary', fontFamily: '"Roboto Mono", monospace', fontSize: '0.75rem' }}>{page * rowsPerPage + idx + 1}</TableCell>
        <TableCell sx={{ minWidth: 300, maxWidth: 380 }}>
          <Tooltip title={item.returnName || 'Untitled'}>
            <Typography variant="body2" sx={{ maxWidth: 340, fontWeight: 500, color: 'primary.main', lineHeight: 1.3,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.returnName || 'Untitled'}
            </Typography>
          </Tooltip>
          <Tooltip title={item.actName || ''}>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', maxWidth: 340, fontSize: '0.75rem',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.actName || 'No act recorded'}
            </Typography>
          </Tooltip>
          <Box sx={{ mt: 0.5 }}>
            <Chip size="small" label={item.frequency || item.frequencyType || 'Ad hoc'} variant="outlined" />
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
            <Typography variant="caption" sx={{ color: TL.gray300 }}>Unassigned</Typography>
          )}
        </TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {item.currentDueDate ? formatDate(item.currentDueDate) : item.dueDateNeeded && !isEventDriven(item) ? (
              <Tooltip title={item.deadlineText ? `Regulator wording: ${item.deadlineText}` : 'No due rule recorded'}>
                <span><StatusBadge label={DUE_DATE_NEEDED} tone="amber" /></span>
              </Tooltip>
            ) : (
              <Typography variant="caption" color="text.secondary">
                {isEventDriven(item) ? (item.eventTriggerConfigured ? item.eventTriggerLabel : 'Trigger setup needed') : noPeriodLabel(item)}
              </Typography>
            )}
            {isEventDriven(item) && item.eventFilingCount > 0 && (
              <Tooltip title={`${item.eventFilingCount} trigger filing(s) · ${item.eventOverdueCount || 0} overdue`}>
                <span><StatusBadge label={`${item.eventFilingCount} filing${item.eventFilingCount === 1 ? '' : 's'}`}
                  tone={item.eventOverdueCount > 0 ? 'red' : 'gray'} /></span>
              </Tooltip>
            )}
            {onEditSchedule && (
              <Tooltip title="Edit schedule">
                <IconButton size="small" onClick={e => { e.stopPropagation(); onEditSchedule(); }}>
                  <CalendarDaysIcon size={16} />
                </IconButton>
              </Tooltip>
            )}
            {onConfigureEvent && !item.eventTriggerConfigured && (
              <Tooltip title={item.eventTriggerConfigured ? 'Edit event trigger' : 'Configure event trigger'}>
                <IconButton size="small" onClick={e => { e.stopPropagation(); onConfigureEvent(); }}>
                  <PencilSquareIcon size={16} />
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
                <Button size="small" variant="outlined" startIcon={<CalendarIcon size={16} />} onClick={e => { e.stopPropagation(); onRecordEvent(); }}>
                  Record event
                </Button>
              </Tooltip>
            )}
            {onSendUploadLink && (
              <Tooltip title="Email an owner a link to upload the event filing themselves">
                <Button size="small" variant="outlined" startIcon={<LinkIcon size={16} />} onClick={e => { e.stopPropagation(); onSendUploadLink(); }}>
                  Send link
                </Button>
              </Tooltip>
            )}
          </Box>
        </TableCell>
        <TableCell>
          {!status ? (
            <StatusBadge label={isEventDriven(item) ? 'Event-driven' : 'No period'} tone="gray" />
          ) : (
            isOverdue && status !== 'Submitted' && status !== 'Submitted Late'
              ? statusBadge('Overdue', 'OVERDUE')
              : statusBadge(status)
          )}
        </TableCell>
        <TableCell>
          <Tooltip title={isExpanded ? 'Hide details' : isEventDriven(item) ? 'Show event filings and linked obligations' : 'Show linked obligations'}>
            <IconButton size="small" onClick={e => { e.stopPropagation(); onExpand(); }}>
              <ChevronDownIcon size={18} sx={{ transition: 'transform .15s', transform: isExpanded ? 'rotate(180deg)' : 'none' }} />
            </IconButton>
          </Tooltip>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={COLUMNS.length + 2} sx={{ py: 0, border: 0, bgcolor: TL.gray50 }}>
          <Collapse in={isExpanded} unmountOnExit>
            <Box sx={{ py: 1.5, pl: 4, pr: 2 }}>
              {isEventDriven(item) ? (
                <>
                  {onConfigureEvent && !item.eventTriggerConfigured && (
                    <Button size="small" variant="outlined" startIcon={<PencilSquareIcon size={16} />} sx={{ mb: 1 }} onClick={onConfigureEvent}>
                      Configure trigger
                    </Button>
                  )}
                  <EventFilings returnId={item.returnId} onOpen={onOpenEventFiling} />
                </>
              ) : item.upcomingInstances && item.upcomingInstances.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.6875rem' }}>
                    Upcoming Periods
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                    {item.upcomingInstances.map(inst => (
                      <Paper key={inst.instanceId} sx={{ px: 1.5, py: 0.75, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>{inst.period || '-'}</Typography>
                        <Typography variant="caption" color="text.secondary">{formatDate(inst.dueDate)}</Typography>
                        {statusBadge(inst.status || 'Not Started')}
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
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.6875rem' }}>
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
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.6875rem' }}>
        Event filings ({filings.length})
      </Typography>
      {filings.length === 0 ? <Typography variant="body2" color="text.secondary">No trigger occurrences recorded yet.</Typography> : (
        <TableContainer component={Paper} sx={{ overflow: 'hidden' }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>Trigger date</TableCell>
              <TableCell>Reference / evidence</TableCell>
              <TableCell>Due date</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Filing</TableCell>
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
                  {f.dueDateAdjusted && <Tooltip title={`Base deadline ${formatDate(f.unadjustedDueDate)} fell on a weekend/federal holiday; moved to next working day.`}><span><StatusBadge label="Adjusted" tone="gray" sx={{ ml: 1 }} /></span></Tooltip>}
                </TableCell>
                <TableCell>{statusBadge(f.status || 'Not Started')}</TableCell>
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
      <Typography variant="body2" sx={{ color: TL.gray400, py: 2 }}>
        No obligations linked to this return.
      </Typography>
    );
  }

  return (
    <Paper sx={{ overflow: 'hidden' }}>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 36 }}>#</TableCell>
              <TableCell sx={{ minWidth: 260 }}>Obligation</TableCell>
              <TableCell sx={{ width: 110 }}>Section</TableCell>
              <TableCell sx={{ width: 140 }}>Area</TableCell>
              <TableCell sx={{ width: 120 }}>Risk</TableCell>
              <TableCell sx={{ width: 120 }}>Act</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {obligations.map((o, i) => (
              <TableRow key={o.obligationId ?? i} hover sx={{ '& > td': { py: 1 } }}>
                <TableCell sx={{ color: 'text.secondary', fontFamily: '"Roboto Mono", monospace', fontSize: '0.75rem' }}>{i + 1}</TableCell>
                <TableCell sx={{ minWidth: 260, maxWidth: 380 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: 'primary.main', lineHeight: 1.3, maxWidth: 330,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {o.title || o.name || <span style={{ color: '#A0AEC0', fontWeight: 400 }}>Untitled obligation</span>}
                  </Typography>
                  {o.plainEnglishStatement ? (
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', maxWidth: 360,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {o.plainEnglishStatement}
                    </Typography>
                  ) : (
                    <Typography variant="caption" sx={{ color: TL.gray300 }}>No interpreted text</Typography>
                  )}
                </TableCell>
                <TableCell>
                  {o.sectionReference ? (
                    <Chip size="small" label={o.sectionReference.slice(0, 24)} variant="outlined"
                      sx={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem' }} />
                  ) : (
                    <Typography variant="caption" color="text.secondary">-</Typography>
                  )}
                </TableCell>
                <TableCell>
                  {o.areaOfFocus ? (
                    <Chip size="small" variant="outlined" label={o.areaOfFocus}
                      sx={{ maxWidth: 130 }} />
                  ) : (
                    <Typography variant="caption" color="text.secondary">-</Typography>
                  )}
                </TableCell>
                <TableCell>{inherentRiskChip(o.inherentRiskRating)}</TableCell>
                <TableCell>
                  {o.actName ? (
                    <Chip size="small" variant="outlined" label={o.actName.slice(0, 22)}
                      sx={{ maxWidth: 110 }} />
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
  const { user } = useAuth();
  const canSubmit = SUBMIT_ROLES.includes(user?.role);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const isSubmitted = detail.status === 'Submitted' || detail.status === 'Submitted Late';
  const currentStageIdx = STAGE_NAMES.indexOf(detail.currentStage);
  const nextStage = currentStageIdx < STAGE_NAMES.length - 1 ? STAGE_NAMES[currentStageIdx + 1] : null;

  return (
    <Box>
      <PageHeader
        title={`${detail.returnName || ''}${detail.period ? ` · ${detail.period}` : ''}`}
        subtitle={(
          <>
            {detail.dueDate ? `Due ${formatDate(detail.dueDate)}` : noPeriodLabel(detail)}
            {detail.filingChannel && ` · Channel: ${detail.filingChannel}`}
            {detail.returnOwnerName && ` · Owner: ${detail.returnOwnerName}`}
          </>
        )}
        onBack={onBack}
        backLabel="Back to Returns Register"
        actions={(onEditSchedule || onEditEventTrigger) ? (
          <>
            {onEditSchedule && (
              <Button variant="outlined" startIcon={<CalendarDaysIcon size={16} />} onClick={onEditSchedule}>
                Edit schedule
              </Button>
            )}
            {onEditEventTrigger && (
              <Button variant="outlined" startIcon={<PencilSquareIcon size={16} />} onClick={onEditEventTrigger}>
                Edit event trigger
              </Button>
            )}
          </>
        ) : null}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {statusBadge(detail.status || 'Not Started')}
          <Chip size="small" variant="outlined" label={detail.frequency || detail.frequencyType || 'Ad hoc'} />
          {detail.filingRegulator && <Chip size="small" variant="outlined" label={detail.filingRegulator} />}
        </Box>
      </PageHeader>

      {/* Headline numbers */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: 2, mb: 2.5 }}>
        <StatTile icon={<CalendarDaysIcon />} label="Due Date"
          value={detail.dueDate ? formatDate(detail.dueDate) : noPeriodLabel(detail)} />
        <StatTile icon={<CheckCircleIcon />} label="Status" accent={statusAccent(detail.status)}
          chip={statusBadge(detail.status || 'Not Started')} />
        <StatTile icon={<ClockIcon />} label="Days Late"
          value={detail.daysLate > 0 ? `${detail.daysLate}` : '—'}
          accent={detail.daysLate > 0 ? '#E53E3E' : '#2D7D46'} />
        <StatTile icon={<ExclamationCircleIcon />} label="Escalation"
          value={detail.escalationLevel > 0 ? `Level ${detail.escalationLevel}` : 'None'}
          accent={detail.escalationLevel > 0 ? '#E53E3E' : '#2B6CB0'} />
      </Box>

      <Section icon={<CalendarIcon />} title="Schedule"
        action={detail.currentStage
          ? <Chip size="small" variant="outlined" label={detail.currentStage} />
          : null}>
        <FieldGrid min={160}>
          <Field label="Frequency" value={detail.frequency || detail.frequencyType} />
          <Field label="Regulator" value={detail.filingRegulator} />
          <Field label="Period" value={detail.period || (isEventDriven(detail) ? 'Event-driven' : '—')} />
          <Field label="Due Date" value={detail.dueDate ? formatDate(detail.dueDate) : '—'} />
          <Field label="Prep Start" value={detail.prepStartDate ? formatDate(detail.prepStartDate) : '—'} />
          <Field label="Filing Channel" value={detail.filingChannel} />
          <Field label="Return Owner" value={detail.returnOwnerName} />
          {detail.deadlineText && <Field label="Regulator Wording" value={detail.deadlineText} />}
        </FieldGrid>
      </Section>

      {(detail.eventTriggerDate || detail.eventTriggerLabel) && (
        <Section icon={<CalendarIcon />} title="Event Trigger">
          <FieldGrid min={160}>
            <Field label="Trigger" value={detail.eventTriggerLabel} />
            <Field label="Trigger Date" value={detail.eventTriggerDate ? formatDate(detail.eventTriggerDate) : '—'} />
            <Field label="Reference" value={detail.eventReference} />
            <Field label="Base Deadline" value={detail.eventUnadjustedDueDate ? formatDate(detail.eventUnadjustedDueDate) : '—'} />
            <Field label="Adjusted">
              {detail.eventDueDateAdjusted
                ? <StatusBadge label="Moved to next working day" tone="gray" />
                : <Typography variant="body2" sx={{ fontSize: '0.85rem', fontWeight: 500 }}>No</Typography>}
            </Field>
            {detail.eventEvidenceFileId && (
              <Field label="Evidence"><EvidenceFileButton fileId={detail.eventEvidenceFileId} /></Field>
            )}
          </FieldGrid>
        </Section>
      )}

      {detail.escalationLevel > 0 && (
        <Section icon={<ExclamationTriangleIcon />} title="Escalation">
          <Alert severity="error">
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Escalated · Level {detail.escalationLevel} · {ESCALATION_ROLE[detail.escalationLevel] || 'Management'}
            </Typography>
            {detail.escalatedAt && (
              <Typography variant="caption">Escalated since {formatDate(detail.escalatedAt)}</Typography>
            )}
          </Alert>
        </Section>
      )}

      <Section icon={<QueueListIcon />} title="Stages"
        action={detail.currentStage
          ? <Chip size="small" variant="outlined" label={detail.currentStage} />
          : null}>
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
                      <LinkIcon size={14} /> Evidence
                    </Link>
                  )}
                  {stage.current && !isSubmitted && i < SIGN_OFF_INDEX && (
                    <Box sx={{ mt: 1 }}>
                      <Button size="small" variant="outlined" onClick={() => setAdvanceOpen(true)}>
                        Mark complete → {STAGE_NAMES[i + 1]}
                      </Button>
                    </Box>
                  )}
                  {stage.current && i === SIGN_OFF_INDEX && !isSubmitted && (
                    <Box sx={{ mt: 1 }}>
                      {canSubmit ? (
                        <Button size="small" variant="contained" color="success" onClick={() => setSubmitOpen(true)}>
                          Sign off &amp; mark as submitted
                        </Button>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Waiting for a CCO to sign off and submit.
                        </Typography>
                      )}
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
              <CheckCircleIcon size={18} sx={{ color: 'success.main' }} />
              Submitted {formatDate(detail.submittedDate)}
              {detail.daysLate > 0 && ` (${detail.daysLate} days late)`}
            </Typography>
            <Link href={detail.submissionEvidenceUrl} target="_blank" rel="noopener" variant="caption">
              View submission receipt
            </Link>
          </Box>
        )}
      </Section>

      {detail.notes && (
        <Section icon={<DocumentTextIcon />} title="Notes">
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: '0.85rem' }}>
            {detail.notes}
          </Typography>
        </Section>
      )}

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
          <Grid size={{ xs: 12 }}><TextField label="Completed by (defaults to you)" fullWidth size="small" value={form.completedByName}
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

/* ───────── Send upload link (public event filing) ───────── */
function SendUploadLinkDialog({ open, item, onClose, onSnackbar }) {
  const [email, setEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setEmail(''); setLink(''); setCopied(false); setError(''); }
  }, [open]);

  if (!item) return null;

  const create = async () => {
    setCreating(true);
    setError('');
    try {
      const res = await api.returns.createUploadLink(item.returnId, {
        recipientEmail: email.trim() || undefined,
      });
      setLink(res.path ? `${window.location.origin}${res.path}` : res.url);
    } catch (e) { setError(e.message); } finally { setCreating(false); }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); }
    catch { onSnackbar('Copy failed — select the link manually.'); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Send event-filing upload link</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Create a secure link the owner can use to record an event filing for
          <strong> {item.returnName}</strong> and attach evidence, without signing in.
        </Typography>
        <PersonPicker mode="link" label="Recipient (optional — defaults to the return owner)"
          value={email} onChange={(v) => setEmail(v || '')} disabled={!!link} />
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        {link && (
          <TextField fullWidth size="small" label="Link" value={link} onFocus={e => e.target.select()}
            slotProps={{ input: { readOnly: true } }} sx={{ mt: 2 }} />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {link
          ? <Button variant="contained" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</Button>
          : <Button variant="contained" onClick={create} disabled={creating}>
              {creating ? 'Creating…' : 'Create link'}
            </Button>}
      </DialogActions>
    </Dialog>
  );
}

