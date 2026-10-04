import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  Box, Typography, Table, TableHead, TableBody, TableRow, TableCell,
  TablePagination, Chip, TextField, MenuItem, Button, IconButton, Menu,
  Card, CardContent, CardHeader, TableContainer, Paper, Dialog,
  DialogTitle, DialogContent, DialogActions, CircularProgress, Alert,
  Divider, Grid, Tooltip, Breadcrumbs, Link, Checkbox, FormControlLabel,
  Snackbar, Alert as MuiAlert,
} from '@mui/material';
import {
  Add, Warning, Schedule, UploadFile, Refresh, Close, MoreVert, ArrowDropDown,
} from '@mui/icons-material';
import { api } from '../services/api';
import OwnerPicker from '../components/org/OwnerPicker';
import { useAuth } from '../contexts/AuthContext';
import ImportDialog from '../components/modals/ImportDialog';

const SEV_COLORS = { Critical: 'error', High: 'error', Medium: 'warning', Low: 'success' };
const SEVERITIES = ['Critical', 'High', 'Medium', 'Low'];
const STATUS_OPTIONS = [
  { value: 'active', label: 'All active' },
  { value: 'all', label: 'All' },
  { value: 'Open', label: 'Open' },
  { value: 'In Remediation', label: 'In Remediation' },
  { value: 'Remediated', label: 'Remediated' },
  { value: 'Closed', label: 'Closed' },
];
const IMPORT_ROLES = ['CCO', 'TENANT_ADMIN'];
// Mirrors FindingController @PreAuthorize: raise/assign = ANALYST/CCO/TENANT_ADMIN, close = CCO/TENANT_ADMIN.
const RAISE_ROLES = ['ANALYST', 'CCO', 'TENANT_ADMIN'];
const ASSIGN_ROLES = ['ANALYST', 'CCO', 'TENANT_ADMIN'];
const CLOSE_ROLES = ['CCO', 'TENANT_ADMIN'];
const DEFAULT_FILTERS = { status: 'active', severity: '', overdueOnly: false };

function statusColor(status) {
  if (status === 'Closed') return 'success';
  if (status === 'Remediated') return 'info';
  if (status === 'In Remediation') return 'warning';
  return 'default';
}

function formatDate(d) {
  if (!d) return '-';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isOverdueFinding(f) {
  if (!f?.remediationDeadline || f.status === 'Closed' || f.status === 'Remediated') return false;
  const deadline = new Date(f.remediationDeadline);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return deadline < today;
}

/** Actions available on a finding for the current role (same rules for the row menu and the detail header). */
function availableActions(f, role) {
  const actions = [];
  if (f.status === 'Open' && ASSIGN_ROLES.includes(role)) actions.push('assign');
  if (f.status === 'In Remediation') actions.push('remediate');
  if (f.status === 'Remediated' && CLOSE_ROLES.includes(role)) actions.push('close');
  return actions;
}
const ACTION_LABELS = { assign: 'Assign', remediate: 'Submit Remediation', close: 'Close Finding' };

// KPI card with a dropdown that breaks findings down by severity (same pattern as InstrumentsPage).
function KpiCard({ kpi, bySeverity, onSelect }) {
  const [anchor, setAnchor] = useState(null);
  const breakdown = SEVERITIES.map(s => [s, bySeverity?.[s] ?? 0]);
  return (
    <Paper elevation={0} variant="outlined"
      onClick={() => onSelect(kpi.key)}
      sx={{ p: 2, cursor: 'pointer', borderLeft: `3px solid ${kpi.color}`,
        transition: 'box-shadow .2s', '&:hover': { boxShadow: 1 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{kpi.label}</Typography>
        <IconButton size="small" aria-label={`${kpi.label} breakdown`}
          onClick={e => { e.stopPropagation(); setAnchor(e.currentTarget); }} sx={{ p: 0.25 }}>
          <ArrowDropDown fontSize="small" />
        </IconButton>
      </Box>
      <Typography variant="h4" sx={{ fontWeight: 700, color: kpi.color }}>{kpi.value}</Typography>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}
        onClick={e => e.stopPropagation()}>
        <MenuItem disabled dense>
          <Typography variant="caption">Filter by severity (counts across all findings)</Typography>
        </MenuItem>
        {breakdown.map(([sev, count]) => (
          <MenuItem key={sev} dense onClick={() => { setAnchor(null); onSelect(kpi.key, sev); }}
            sx={{ display: 'flex', justifyContent: 'space-between', gap: 3 }}>
            <span>{sev}</span><strong>{count}</strong>
          </MenuItem>
        ))}
      </Menu>
    </Paper>
  );
}

export default function FindingsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const role = user?.role;
  const canImport = IMPORT_ROLES.includes(role);
  const canRaise = RAISE_ROLES.includes(role);

  const [detailId, setDetailId] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [raiseOpen, setRaiseOpen] = useState(false);
  // { type: 'assign' | 'remediate', findingId } — null when no action dialog is open.
  const [actionDialog, setActionDialog] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [success, setSuccess] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  const params = { page, size: rowsPerPage, status: filters.status };
  if (filters.severity) params.severity = filters.severity;
  if (filters.overdueOnly) params.overdueOnly = true;

  const listQuery = useQuery({
    queryKey: ['findings', 'register', params],
    queryFn: ({ signal }) => api.findings.register(params, { signal }),
    placeholderData: keepPreviousData,
  });
  const statsQuery = useQuery({
    queryKey: ['findings', 'stats'],
    queryFn: ({ signal }) => api.findings.stats({ signal }),
  });
  const detailQuery = useQuery({
    queryKey: ['findings', 'detail', String(detailId)],
    queryFn: ({ signal }) => api.findings.detail(detailId, { signal }),
    enabled: detailId != null,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['findings'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  }
  const onMutationError = (e) => setErrorMsg(e?.message || 'Request failed.');

  const raiseMutation = useMutation({
    mutationFn: (body) => api.findings.raise(body),
    onSuccess: () => { invalidate(); setRaiseOpen(false); setSuccess('Finding raised.'); },
    onError: onMutationError,
  });
  const assignMutation = useMutation({
    mutationFn: ({ findingId, body }) => api.findings.assign(findingId, body),
    onSuccess: () => { invalidate(); setActionDialog(null); setSuccess('Finding assigned.'); },
    onError: onMutationError,
  });
  const remediateMutation = useMutation({
    mutationFn: ({ findingId, body }) => api.findings.remediate(findingId, body),
    onSuccess: () => { invalidate(); setActionDialog(null); setSuccess('Remediation submitted.'); },
    onError: onMutationError,
  });
  const closeMutation = useMutation({
    mutationFn: (findingId) => api.findings.close(findingId),
    onSuccess: () => { invalidate(); setSuccess('Finding closed.'); },
    onError: onMutationError,
  });

  function runAction(action, findingId) {
    if (action === 'close') closeMutation.mutate(findingId);
    else setActionDialog({ type: action, findingId });
  }

  const items = listQuery.data?.content || [];
  const total = listQuery.data?.totalElements || 0;
  const stats = statsQuery.data;
  const listError = listQuery.error?.message || '';

  const hasFilters = filters.status !== DEFAULT_FILTERS.status || filters.severity || filters.overdueOnly;

  function setFilter(patch) { setFilters(f => ({ ...f, ...patch })); setPage(0); }

  function applyKpiFilter(key, severity) {
    const next = { ...DEFAULT_FILTERS };
    if (key === 'open') next.status = 'Open';
    else if (key === 'inRemediation') next.status = 'In Remediation';
    else if (key === 'closed') next.status = 'Closed';
    else if (key === 'overdue') { next.status = 'active'; next.overdueOnly = true; }
    else if (key === 'criticalHigh') { next.status = 'active'; next.severity = 'Critical'; }
    if (severity) next.severity = severity;
    setFilters(next);
    setPage(0);
  }

  const kpis = [
    { key: 'active', label: 'Active', color: '#2B6CB0',
      value: (stats?.open ?? 0) + (stats?.inRemediation ?? 0) + (stats?.remediated ?? 0) },
    { key: 'open', label: 'Open', value: stats?.open ?? 0, color: '#4A5568' },
    { key: 'inRemediation', label: 'In Remediation', value: stats?.inRemediation ?? 0, color: '#DD6B20' },
    { key: 'overdue', label: 'Overdue', value: stats?.overdue ?? 0, color: '#E53E3E' },
    { key: 'criticalHigh', label: 'Critical / High', value: stats?.criticalHigh ?? 0, color: '#C53030' },
    { key: 'closed', label: 'Closed', value: stats?.closed ?? 0, color: '#38A169' },
  ];

  const actionDialogs = (
    <>
      <AssignDialog open={actionDialog?.type === 'assign'} onClose={() => setActionDialog(null)}
        saving={assignMutation.isPending}
        onSave={(body) => assignMutation.mutate({ findingId: actionDialog.findingId, body })} />
      <RemediateDialog open={actionDialog?.type === 'remediate'} onClose={() => setActionDialog(null)}
        saving={remediateMutation.isPending}
        onSave={(body) => remediateMutation.mutate({ findingId: actionDialog.findingId, body })} />
    </>
  );
  const feedback = (
    <>
      <Snackbar open={!!success} autoHideDuration={3000} onClose={() => setSuccess('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <MuiAlert severity="success" variant="filled" onClose={() => setSuccess('')}>{success}</MuiAlert>
      </Snackbar>
      {errorMsg && <Alert severity="error" onClose={() => setErrorMsg(null)}
        sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>{errorMsg}</Alert>}
    </>
  );

  if (detailId != null) {
    if (detailQuery.isPending) {
      return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
    }
    if (detailQuery.error) {
      return (
        <Alert severity="error" sx={{ mt: 2 }}
          action={<Button size="small" onClick={() => setDetailId(null)}>Back</Button>}>
          {detailQuery.error.message || 'Failed to load finding.'}
        </Alert>
      );
    }
    return (
      <>
        <DetailView
          detail={detailQuery.data}
          actions={availableActions(detailQuery.data, role)}
          closing={closeMutation.isPending}
          onAction={(a) => runAction(a, detailQuery.data.findingId)}
          onBack={() => setDetailId(null)}
        />
        {actionDialogs}
        {feedback}
      </>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
        <Box>
          <Typography variant="h4">Findings</Typography>
          <Typography variant="body2" color="text.secondary">
            {total} finding{total !== 1 ? 's' : ''} — track and remediate control gaps
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={invalidate}><Refresh /></IconButton>
          </Tooltip>
          {canImport && (
            <Button variant="outlined" startIcon={<UploadFile />} size="medium" onClick={() => setImportOpen(true)}
              sx={{ height: 40, fontWeight: 600, textTransform: 'none' }}>
              Import
            </Button>
          )}
          {canRaise && (
            <Button variant="contained" startIcon={<Add />} size="medium" onClick={() => setRaiseOpen(true)}
              sx={{ height: 40, fontWeight: 600, textTransform: 'none' }}>
              Raise Finding
            </Button>
          )}
        </Box>
      </Box>

      {listError && (
        <Alert severity="error" sx={{ mb: 2 }}
          action={<Button size="small" onClick={() => listQuery.refetch()}>Retry</Button>}>
          {listError}
        </Alert>
      )}

      {/* KPI cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(6, 1fr)' }, gap: 2, mb: 2 }}>
        {kpis.map(k => <KpiCard key={k.key} kpi={k} bySeverity={stats?.bySeverity} onSelect={applyKpiFilter} />)}
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField select label="Status" size="small" sx={{ minWidth: 150 }}
          value={filters.status} onChange={e => setFilter({ status: e.target.value })}>
          {STATUS_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
        </TextField>
        <TextField select label="Severity" size="small" sx={{ minWidth: 130 }}
          value={filters.severity} onChange={e => setFilter({ severity: e.target.value })}>
          <MenuItem value="">All</MenuItem>
          {SEVERITIES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>
        <FormControlLabel control={
          <Checkbox size="small" checked={filters.overdueOnly} onChange={e => setFilter({ overdueOnly: e.target.checked })} />
        } label={<Typography variant="body2">Overdue only</Typography>} />
        {hasFilters && (
          <Button size="small" startIcon={<Close />} onClick={() => { setFilters(DEFAULT_FILTERS); setPage(0); }}>Clear</Button>
        )}
      </Paper>

      {/* Table */}
      {listQuery.isPending ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : items.length === 0 ? (
        <Paper sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <Warning sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
          <Typography variant="body1">No findings found.</Typography>
        </Paper>
      ) : (
        <Paper>
          <TableContainer>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', minWidth: 340 }}>Finding</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', minWidth: 100 }}>Severity</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', minWidth: 150 }}>Owner</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', minWidth: 120 }}>Deadline</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', minWidth: 160 }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((row) => (
                  <FindingRow key={row.findingId} row={row}
                    actions={availableActions(row, role)}
                    onOpen={() => setDetailId(row.findingId)}
                    onAction={(a) => runAction(a, row.findingId)} />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={total} page={page}
            onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
            onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[10, 25, 50]} />
        </Paper>
      )}

      {canRaise && (
        <RaiseDialog open={raiseOpen} onClose={() => setRaiseOpen(false)}
          saving={raiseMutation.isPending} onSave={(body) => raiseMutation.mutate(body)} />
      )}

      {canImport && (
        <ImportDialog entityType="findings" entityLabel="findings" open={importOpen}
          itemLabel="Finding" contextLabel="Control / Obligation"
          invalidateKeys={[['findings'], ['dashboard']]}
          onClose={() => setImportOpen(false)}
          onImported={(r) => setSuccess(`Imported ${r?.importedRows ?? 0} findings.`)} />
      )}

      {actionDialogs}
      {feedback}
    </Box>
  );
}

/* ---------- Register row ---------- */
function FindingRow({ row, actions, onOpen, onAction }) {
  const [anchor, setAnchor] = useState(null);
  const overdue = isOverdueFinding(row);
  return (
    <TableRow hover onClick={onOpen}
      sx={{ cursor: 'pointer', bgcolor: overdue ? '#FFF5F5' : 'inherit', '& > td': { py: 1 },
        '&:hover': { bgcolor: overdue ? '#FEE2E2' : '#F7FAFC' } }}>
      <TableCell sx={{ minWidth: 340, maxWidth: 460 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Typography variant="body2" sx={{ fontFamily: 'Roboto Mono, monospace', fontWeight: 700 }}>
            {row.displayId}
          </Typography>
          {row.externalReference && (
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'Roboto Mono, monospace' }}>
              {row.externalReference}
            </Typography>
          )}
        </Box>
        <Tooltip title={row.description ? <Box sx={{ whiteSpace: 'pre-wrap' }}>{row.description}</Box> : ''}>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', maxWidth: 440,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.description || '-'}
          </Typography>
        </Tooltip>
        {(row.findingType || row.linkedControlIdentifier) && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
            {row.findingType && (
              <Chip size="small" variant="outlined" label={row.findingType}
                sx={{ height: 22, borderRadius: '4px', fontSize: '0.7rem' }} />
            )}
            {row.linkedControlIdentifier && (
              <Chip size="small" variant="outlined" label={row.linkedControlIdentifier}
                sx={{ height: 22, borderRadius: '4px', fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem' }} />
            )}
          </Box>
        )}
      </TableCell>
      <TableCell>
        <Chip label={row.severity || '-'} size="small" color={SEV_COLORS[row.severity] || 'default'}
          sx={{ height: 22, borderRadius: '4px', fontWeight: 600 }} />
      </TableCell>
      <TableCell>
        <Typography variant="body2" color={row.assignedToName ? 'text.primary' : 'text.secondary'}>
          {row.assignedToName || 'Unassigned'}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color={overdue ? 'error.main' : 'text.primary'}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: overdue ? 600 : 400 }}>
          {overdue && <Schedule fontSize="inherit" />}
          {formatDate(row.remediationDeadline)}
        </Typography>
        {overdue ? (
          <Typography variant="caption" color="error.main">Overdue</Typography>
        ) : row.remediationDeadline && row.status !== 'Closed' && row.status !== 'Remediated' ? (
          <Typography variant="caption" color="text.secondary">{row.slaRemainingDays ?? 0} days left</Typography>
        ) : null}
      </TableCell>
      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Chip label={row.status} size="small" color={statusColor(row.status)}
            sx={{ height: 22, borderRadius: '4px', fontWeight: 600 }} />
          {actions.length > 0 && (
            <>
              <Tooltip title="Actions">
                <IconButton size="small" aria-label={`Actions for ${row.displayId}`}
                  onClick={e => { e.stopPropagation(); setAnchor(e.currentTarget); }}>
                  <MoreVert fontSize="small" />
                </IconButton>
              </Tooltip>
              <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}
                onClick={e => e.stopPropagation()}>
                {actions.map(a => (
                  <MenuItem key={a} dense onClick={() => { setAnchor(null); onAction(a); }}>{ACTION_LABELS[a]}</MenuItem>
                ))}
              </Menu>
            </>
          )}
        </Box>
      </TableCell>
    </TableRow>
  );
}

/* ---------- Detail view ---------- */
function DetailView({ detail, actions, closing, onAction, onBack }) {
  const navigate = useNavigate();
  const isClosed = detail.status === 'Closed';
  const deadline = detail.remediationDeadline ? new Date(detail.remediationDeadline) : null;
  const isOverdue = isOverdueFinding(detail);

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link underline="hover" color="inherit" sx={{ cursor: 'pointer' }} onClick={onBack}>Findings</Link>
        <Typography color="text.primary">{detail.displayId}</Typography>
      </Breadcrumbs>

      <Card sx={{ mb: 2, borderLeft: 4, borderColor: (SEV_COLORS[detail.severity] || 'grey') + '.main' }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="h5">{detail.displayId}</Typography>
                <Chip label={detail.severity} size="small" color={SEV_COLORS[detail.severity] || 'default'} />
                <Chip label={detail.status} size="small" color={statusColor(detail.status)} />
              </Box>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>{detail.description}</Typography>
              {detail.linkedControlId != null && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Linked control: {detail.linkedControlNumber || `CTRL-${String(detail.linkedControlId).padStart(3, '0')}`}
                </Typography>
              )}
              {detail.linkedObligationId != null && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  Linked obligation:{' '}
                  <Link component="button" variant="body2" onClick={() => navigate(`/obligations/${detail.linkedObligationId}`)}>
                    #{detail.linkedObligationId}
                  </Link>
                </Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {actions.includes('assign') && (
                <Button variant="outlined" size="small" onClick={() => onAction('assign')}>Assign</Button>
              )}
              {actions.includes('remediate') && (
                <Button variant="contained" size="small" onClick={() => onAction('remediate')}>Submit Remediation</Button>
              )}
              {actions.includes('close') && (
                <Button variant="contained" color="success" size="small" disabled={closing}
                  onClick={() => onAction('close')}>
                  {closing ? 'Closing...' : 'Close Finding'}
                </Button>
              )}
            </Box>
          </Box>

          {/* SLA */}
          {deadline && !isClosed && (
            <Box sx={{ mt: 2, p: 1.5, bgcolor: isOverdue ? 'error.50' : 'grey.50', borderRadius: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Schedule color={isOverdue ? 'error' : 'action'} />
              <Typography variant="body2" fontWeight={600} color={isOverdue ? 'error.main' : 'text.primary'}>
                SLA: {detail.slaDays} days
                {isOverdue ? ' · OVERDUE' : ` · ${detail.slaRemainingDays} days remaining`}
              </Typography>
              <Typography variant="body2" color="text.secondary">Deadline: {formatDate(detail.remediationDeadline)}</Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardHeader title="Timeline" />
            <CardContent>
              {detail.timeline && detail.timeline.length > 0 ? (
                <Box sx={{ position: 'relative', pl: 3 }}>
                  {detail.timeline.map((evt, i) => (
                    <Box key={i} sx={{ position: 'relative', pb: 2.5, '&:last-child': { pb: 0 },
                      '&::before': i < detail.timeline.length - 1 ? {
                        content: '""', position: 'absolute', left: -5, top: 20, width: 2, height: '100%',
                        bgcolor: 'divider'
                      } : {}
                    }}>
                      <Box sx={{ position: 'absolute', left: -11, top: 2, width: 14, height: 14, borderRadius: '50%',
                        bgcolor: i === detail.timeline.length - 1 && evt.eventType === 'closed' ? 'success.main' : 'primary.main',
                        border: '2px solid', borderColor: 'background.paper' }} />
                      <Typography variant="caption" color="text.secondary">
                        {new Date(evt.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        {evt.actor ? ` · ${evt.actor}` : ''}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.25 }}>{evt.description}</Typography>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">No timeline events</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Finding Details</Typography>
              {detail.externalReference && <DetailRow label="Reference" value={detail.externalReference} />}
              <DetailRow label="Type" value={detail.findingType} />
              <DetailRow label="Trigger" value={detail.triggerReason} />
              {detail.rootCause && <DetailRow label="Root cause" value={detail.rootCause} />}
              <DetailRow label="Created" value={formatDate(detail.createdAt)} />
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Remediation</Typography>
              <DetailRow label="Owner" value={detail.assignedToName || 'Unassigned'} />
              <DetailRow label="Deadline" value={formatDate(detail.remediationDeadline)} />
              {detail.remediationNotes && <DetailRow label="Notes" value={detail.remediationNotes} />}
              {detail.remediationSubmittedAt && <DetailRow label="Submitted" value={formatDate(detail.remediationSubmittedAt)} />}
              {detail.closedAt && <DetailRow label="Closed" value={formatDate(detail.closedAt)} />}
              {detail.remediationEvidenceUrl && (
                <Box sx={{ mt: 1 }}>
                  <Link href={detail.remediationEvidenceUrl} target="_blank" rel="noopener" variant="body2">View evidence</Link>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

function DetailRow({ label, value }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{value || '-'}</Typography>
    </Box>
  );
}

/* ---------- Raise Dialog ---------- */
const EMPTY_RAISE = {
  findingType: '', severity: '', description: '', rootCause: '',
  linkedObligationId: '', linkedControlId: '',
  assignedToOwnerId: null, remediationDeadline: '',
};

function RaiseDialog({ open, onClose, onSave, saving }) {
  const [form, setForm] = useState(EMPTY_RAISE);
  useEffect(() => { if (open) setForm(EMPTY_RAISE); }, [open]);
  const handleSave = () => {
    const body = { ...form };
    if (body.linkedObligationId) body.linkedObligationId = parseInt(body.linkedObligationId, 10);
    if (body.linkedControlId) body.linkedControlId = parseInt(body.linkedControlId, 10);
    onSave(body);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Raise New Finding</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 6 }}>
            <TextField select label="Finding type" fullWidth size="small" required value={form.findingType}
              onChange={e => setForm(f => ({ ...f, findingType: e.target.value }))}>
              <MenuItem value="">Select...</MenuItem>
              <MenuItem value="Gap">Gap (no control exists)</MenuItem>
              <MenuItem value="Control Failure">Control failure (test failed)</MenuItem>
              <MenuItem value="Process Weakness">Process weakness</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <TextField select label="Severity" fullWidth size="small" required value={form.severity}
              onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
              <MenuItem value="">Select...</MenuItem>
              {SEVERITIES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField label="Description" fullWidth size="small" multiline minRows={2} required value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField label="Root cause" fullWidth size="small" multiline minRows={2} value={form.rootCause}
              onChange={e => setForm(f => ({ ...f, rootCause: e.target.value }))} />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <TextField label="Linked Obligation ID" fullWidth size="small" type="number" value={form.linkedObligationId}
              onChange={e => setForm(f => ({ ...f, linkedObligationId: e.target.value }))} />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <TextField label="Linked Control ID" fullWidth size="small" type="number" value={form.linkedControlId}
              onChange={e => setForm(f => ({ ...f, linkedControlId: e.target.value }))} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <OwnerPicker value={form.assignedToOwnerId}
              onChange={id => setForm(f => ({ ...f, assignedToOwnerId: id }))} label="Assign to" />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField label="Remediation deadline" type="date" fullWidth size="small" required
              InputLabelProps={{ shrink: true }} value={form.remediationDeadline}
              onChange={e => setForm(f => ({ ...f, remediationDeadline: e.target.value }))} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !form.findingType || !form.severity || !form.description || !form.remediationDeadline}>
          {saving ? 'Raising...' : 'Raise Finding'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ---------- Assign Dialog ---------- */
function AssignDialog({ open, onClose, onSave, saving }) {
  const [form, setForm] = useState({ assignedToOwnerId: null, remediationDeadline: '' });
  useEffect(() => { if (open) setForm({ assignedToOwnerId: null, remediationDeadline: '' }); }, [open]);
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Assign Finding</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12 }}>
            <OwnerPicker value={form.assignedToOwnerId}
              onChange={id => setForm(f => ({ ...f, assignedToOwnerId: id }))} label="Assign to" />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField label="Remediation deadline" type="date" fullWidth size="small" required
              InputLabelProps={{ shrink: true }} value={form.remediationDeadline}
              onChange={e => setForm(f => ({ ...f, remediationDeadline: e.target.value }))} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => onSave({ ...form })}
          disabled={saving || !form.assignedToOwnerId || !form.remediationDeadline}>
          {saving ? 'Assigning...' : 'Assign'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ---------- Remediate Dialog ---------- */
function RemediateDialog({ open, onClose, onSave, saving }) {
  const [form, setForm] = useState({ remediationNotes: '', evidenceUrl: '' });
  useEffect(() => { if (open) setForm({ remediationNotes: '', evidenceUrl: '' }); }, [open]);
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Submit Remediation</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12 }}>
            <TextField label="Remediation notes" fullWidth size="small" multiline minRows={3} value={form.remediationNotes}
              onChange={e => setForm(f => ({ ...f, remediationNotes: e.target.value }))} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField label="Evidence URL" fullWidth size="small" value={form.evidenceUrl}
              onChange={e => setForm(f => ({ ...f, evidenceUrl: e.target.value }))} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => onSave({ ...form })} disabled={saving}>
          {saving ? 'Submitting...' : 'Submit Remediation'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
