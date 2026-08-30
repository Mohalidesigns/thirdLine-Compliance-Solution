import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Chip, Button, CircularProgress, Alert, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  TextField, MenuItem, Tooltip, TablePagination, TableSortLabel,
  Snackbar, Alert as MuiAlert, Breadcrumbs, Link, Grid,
  Stepper, Step, StepLabel, Card, CardContent, CardHeader,
  Dialog, DialogTitle, DialogContent, DialogActions, Collapse,
} from '@mui/material';
import {
  Search, Refresh, Close, Add, Schedule, WarningAmber, CheckCircle,
  RadioButtonUnchecked, Link as LinkIcon, ArrowBack, ExpandMore, ExpandLess,
} from '@mui/icons-material';
import { api } from '../services/api';
import CreateReturnDialog from '../components/modals/CreateReturnDialog';

const STATUS_COLORS = {
  'Not Started': 'default', 'In Progress': 'info', 'Submitted': 'success',
  'Submitted Late': 'warning', 'Overdue': 'error',
};

const STAGE_NAMES = ['Data Gathering', 'Draft', 'Review', 'Sign-off', 'Submitted'];
const ESCALATION_ROLE = { 1: 'Analyst', 2: 'Manager', 3: 'CCO' };

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const COLUMNS = [
  { id: 'returnName', label: 'Return', minWidth: 260, sortField: 'returnName' },
  { id: 'actName', label: 'Act', minWidth: 180, sortField: 'actName' },
  { id: 'regulator', label: 'Regulator', minWidth: 130, sortField: 'filingRegulator' },
  { id: 'frequency', label: 'Frequency', minWidth: 100, sortField: 'frequency' },
  { id: 'dueDate', label: 'Due Date', minWidth: 110, sortField: 'currentDueDate' },
  { id: 'status', label: 'Status', minWidth: 110, sortField: 'currentStatus' },
];

export default function ReturnsPage() {
  const [view, setView] = useState('list');
  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);

  const [stats, setStats] = useState(null);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const loadStats = useCallback(async () => {
    try { setStats(await api.returns.stats()); } catch { /* optional */ }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, size: rowsPerPage };
      if (search) params.q = search;
      if (statusFilter !== 'All') params.status = statusFilter;
      if (frequencyFilter !== 'All') params.frequency = frequencyFilter;
      if (regulatorFilter !== 'All') params.regulator = regulatorFilter;
      if (actFilter !== 'All') params.act = actFilter;
      if (sortField) params.sort = `${sortField},${sortDir}`;
      const data = await api.returns.register(params);
      setItems(data.content || []);
      setTotal(data.totalElements || 0);
    } catch (e) { setError(e.message || 'Failed to load returns.'); }
    finally { setLoading(false); }
  }, [page, rowsPerPage, search, statusFilter, frequencyFilter, regulatorFilter, actFilter, sortField, sortDir]);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { loadStats(); }, []);

  const loadDetail = useCallback(async (id) => {
    setLoading(true);
    try {
      const res = await api.returns.detail(id);
      setDetail(res);
      setDetailId(id);
      setView('detail');
    } catch (e) { setSnackbar(e.message); }
    finally { setLoading(false); }
  }, []);

  function clearFilters() {
    setSearch(''); setStatusFilter('All'); setFrequencyFilter('All'); setRegulatorFilter('All'); setActFilter('All');
    setPage(0);
  }

  function applyKpiFilter(type) {
    setPage(0);
    if (type === 'overdue') setStatusFilter('Overdue');
    else if (type === 'inProgress') setStatusFilter('In Progress');
    else if (type === 'submitted') setStatusFilter('Submitted');
    else setStatusFilter('All');
  }

  const kpis = [
    { key: 'total', label: 'Total Returns', value: stats?.total ?? 0, color: '#2B6CB0', bg: '#EBF8FF' },
    { key: 'overdue', label: 'Overdue', value: stats?.overdue ?? 0, color: '#E53E3E', bg: '#FFF5F5' },
    { key: 'inProgress', label: 'In Progress', value: stats?.inProgress ?? 0, color: '#DD6B20', bg: '#FFFAF0' },
    { key: 'submitted', label: 'Submitted', value: stats?.submitted ?? 0, color: '#38A169', bg: '#F0FFF4' },
  ];

  if (view === 'detail' && detail) {
    return (
      <DetailView
        detail={detail}
        onBack={() => { setView('list'); setDetail(null); setDetailId(null); }}
        onRefresh={() => loadDetail(detailId)}
        onSnackbar={setSnackbar}
      />
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
        <Box>
          <Typography variant="h4">Returns Register</Typography>
          <Typography variant="body2" color="text.secondary">
            {total} return{total !== 1 ? 's' : ''} — track filing deadlines and status
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={() => { loadList(); loadStats(); }}><Refresh /></IconButton>
          </Tooltip>
          <Button variant="contained" startIcon={<Add />} size="medium" onClick={() => setCreateOpen(true)}
            sx={{ height: 40, fontWeight: 600, textTransform: 'none' }}>
            Add Return
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* KPI cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 2 }}>
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
          {['All', 'Not Started', 'In Progress', 'Submitted', 'Submitted Late', 'Overdue'].map(s =>
            <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={frequencyFilter} onChange={e => { setFrequencyFilter(e.target.value); setPage(0); }}
          label="Frequency" sx={{ minWidth: 130 }}>
          {['All', 'Monthly', 'Quarterly', 'Semi-Annual', 'Annually', 'Weekly', 'Daily'].map(f =>
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
                  const status = item.currentStatus || 'Not Started';
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
                      onDetail={() => loadDetail(item.currentInstanceId)}
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

      <CreateReturnDialog open={createOpen} onClose={() => setCreateOpen(false)}
        onSaved={() => { setCreateOpen(false); loadList(); loadStats(); }} onSnackbar={setSnackbar} />

      <Snackbar open={!!snackbar} autoHideDuration={3000} onClose={() => setSnackbar('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <MuiAlert severity="success" variant="filled" onClose={() => setSnackbar('')}>{snackbar}</MuiAlert>
      </Snackbar>
    </Box>
  );
}

/* ───────── Return Row (with expandable upcoming instances) ───────── */
function ReturnRow({ item, idx, page, rowsPerPage, isOverdue, isExpanded, rowBg, status, onExpand, onDetail }) {
  return (
    <>
      <TableRow hover sx={{ cursor: 'pointer', bgcolor: rowBg,
        '&:hover': { bgcolor: isOverdue ? '#FEE2E2' : '#F7FAFC' },
        borderLeft: isOverdue ? '3px solid #E53E3E' : '3px solid transparent' }}
        onClick={onDetail}>
        <TableCell sx={{ color: 'text.secondary' }}>{page * rowsPerPage + idx + 1}</TableCell>
        <TableCell>
          <Tooltip title={item.returnName || 'Untitled'}>
            <Typography variant="body2" sx={{ maxWidth: 260, fontWeight: 500,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.returnName || 'Untitled'}
            </Typography>
          </Tooltip>
        </TableCell>
        <TableCell>
          <Tooltip title={item.actName || '-'}>
            <Typography variant="body2" sx={{ maxWidth: 180,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.actName || '-'}
            </Typography>
          </Tooltip>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{item.filingRegulator || '-'}</Typography>
        </TableCell>
        <TableCell>
          <Chip size="small" label={item.frequency || item.frequencyType || '-'}
            variant="outlined" sx={{ height: 22 }} />
        </TableCell>
        <TableCell>{formatDate(item.currentDueDate)}</TableCell>
        <TableCell>
          <Chip size="small"
            label={isOverdue && status !== 'Submitted' && status !== 'Submitted Late' ? 'OVERDUE' : status}
            color={isOverdue && status !== 'Submitted' && status !== 'Submitted Late' ? 'error' : STATUS_COLORS[status] || 'default'}
            sx={{ height: 22 }} />
        </TableCell>
        <TableCell>
          {item.upcomingInstances && item.upcomingInstances.length > 0 && (
            <IconButton size="small" onClick={e => { e.stopPropagation(); onExpand(); }}>
              {isExpanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          )}
        </TableCell>
      </TableRow>
      {/* Expandable upcoming instances */}
      {isExpanded && item.upcomingInstances && item.upcomingInstances.length > 0 && (
        <TableRow>
          <TableCell colSpan={COLUMNS.length + 2} sx={{ py: 0, bgcolor: '#FAFBFC' }}>
            <Collapse in={isExpanded}>
              <Box sx={{ py: 1.5, pl: 4 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 1, display: 'block' }}>
                  Upcoming Periods
                </Typography>
                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                  {item.upcomingInstances.map(inst => (
                    <Paper key={inst.instanceId} variant="outlined" sx={{ px: 1.5, py: 0.75, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>{inst.period}</Typography>
                      <Typography variant="caption" color="text.secondary">{formatDate(inst.dueDate)}</Typography>
                      <Chip size="small" label={inst.status || 'Not Started'}
                        color={STATUS_COLORS[inst.status] || 'default'}
                        sx={{ height: 18, fontSize: '0.65rem' }} />
                    </Paper>
                  ))}
                </Box>
                {item.totalInstances > 1 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    {item.totalInstances} total instance{item.totalInstances !== 1 ? 's' : ''} · {item.overcomeCount || 0} overdue
                  </Typography>
                )}
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/* ───────── Detail View ───────── */
function DetailView({ detail, onBack, onRefresh, onSnackbar }) {
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
              <Typography variant="h5">{detail.returnName} · {detail.period}</Typography>
              <Typography variant="body2" color="text.secondary">
                Due {formatDate(detail.dueDate)}
                {detail.filingChannel && ` · Channel: ${detail.filingChannel}`}
                {detail.returnOwnerName && ` · Owner: ${detail.returnOwnerName}`}
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                <Chip label={detail.status} size="small" color={STATUS_COLORS[detail.status] || 'default'} />
              </Box>
            </Box>
          </Box>
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
          <Grid item xs={12}><TextField label="Evidence URL (optional)" fullWidth size="small" value={form.evidenceUrl}
            onChange={e => setForm(f => ({ ...f, evidenceUrl: e.target.value }))} /></Grid>
          <Grid item xs={12}><TextField label="Completed by name" fullWidth size="small" value={form.completedByName}
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
