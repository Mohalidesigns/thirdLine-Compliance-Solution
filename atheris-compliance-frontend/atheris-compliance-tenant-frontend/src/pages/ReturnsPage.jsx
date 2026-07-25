import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Chip, Button, IconButton, Card, CardContent, CardHeader,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Paper,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  CircularProgress, Alert, Breadcrumbs, Link, Grid, Tooltip, Divider,
  TablePagination, Stepper, Step, StepLabel
} from '@mui/material';
import {
  Add, ArrowBack, CheckCircle, RadioButtonUnchecked, Schedule, Link as LinkIcon
} from '@mui/icons-material';
import { api } from '../services/api';
import { useTheme } from '@mui/material/styles';

const STATUS_COLORS = {
  'Not Started': 'default', 'In Progress': 'info', 'Submitted': 'success',
  'Submitted Late': 'warning', 'Overdue': 'error'
};

const STAGE_NAMES = ['Data Gathering', 'Draft', 'Review', 'Sign-off', 'Submitted'];

export default function ReturnsPage() {
  const [view, setView] = useState('list');
  const [detailId, setDetailId] = useState(null);
  const [data, setData] = useState({ content: [], totalElements: 0 });
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [filters, setFilters] = useState({ status: '' });
  const [createOpen, setCreateOpen] = useState(false);
  const [snackbar, setSnackbar] = useState(null);
  const theme = useTheme();

  const loadList = useCallback(() => {
    setLoading(true);
    const p = { page, size: rowsPerPage };
    if (filters.status) p.status = filters.status;
    api.returns.calendar(p).then(res => setData(res))
      .catch(e => setSnackbar(e.message)).finally(() => setLoading(false));
  }, [page, rowsPerPage, filters]);

  useEffect(() => { loadList(); }, [loadList]);

  const loadDetail = useCallback((id) => {
    setLoading(true);
    api.returns.detail(id).then(res => { setDetail(res); setView('detail'); setDetailId(id); })
      .catch(e => setSnackbar(e.message)).finally(() => setLoading(false));
  }, []);

  if (view === 'detail' && detail) {
    return (
      <DetailView
        detail={detail}
        onBack={() => { setView('list'); setDetail(null); setDetailId(null); }}
        onRefresh={() => loadDetail(detailId)}
        onSnackbar={setSnackbar}
        theme={theme}
      />
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Box>
          <Typography variant="h4" sx={{ mb: 0.5 }}>Returns Calendar</Typography>
          <Typography variant="body2" color="text.secondary">Track regulatory filing deadlines and stage workflow</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>
          Add Return
        </Button>
      </Box>

      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', pb: '12px !important' }}>
          <TextField select label="Status" size="small" sx={{ minWidth: 140 }}
            value={filters.status} onChange={e => { setFilters(f => ({ ...f, status: e.target.value })); setPage(0); }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="Not Started">Not Started</MenuItem>
            <MenuItem value="In Progress">In Progress</MenuItem>
            <MenuItem value="Submitted">Submitted</MenuItem>
            <MenuItem value="Submitted Late">Submitted Late</MenuItem>
          </TextField>
        </CardContent>
      </Card>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : data.content.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Schedule sx={{ fontSize: 48, color: theme.palette.action.disabled, mb: 1 }} />
            <Typography color="text.secondary">No returns found</Typography>
          </CardContent>
        </Card>
      ) : (
        <>
          {data.content.map((item) => {
            const isOverdue = item.overdue;
            const isNotStarted = item.status === 'Not Started';
            const isSubmitted = item.status === 'Submitted' || item.status === 'Submitted Late';
            const borderColor = isOverdue ? 'error.main' : isSubmitted ? 'success.main' : isNotStarted ? 'grey.300' : 'info.main';
            return (
              <Card key={item.instanceId} sx={{ mb: 1.5, borderLeft: 4, borderColor, cursor: 'pointer' }}
                onClick={() => loadDetail(item.instanceId)}>
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{item.returnName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.filingRegulator && `${item.filingRegulator} · `}
                        {item.period} · Due {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '-'}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Chip label={item.overdue ? 'OVERDUE' : item.status} size="small"
                        color={item.overdue ? 'error' : STATUS_COLORS[item.status] || 'default'} />
                    </Box>
                  </Box>

                  {/* Stage progress */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                    {item.stages && item.stages.map((s, i) => (
                      <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {s.completed ? (
                          <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
                        ) : (
                          <RadioButtonUnchecked sx={{ fontSize: 16, color: s.name === item.currentStage ? 'info.main' : 'action.disabled' }} />
                        )}
                        <Typography variant="caption"
                          color={s.name === item.currentStage ? 'info.main' : s.completed ? 'text.secondary' : 'text.disabled'}>
                          {s.name}
                        </Typography>
                        {i < item.stages.length - 1 && <Typography variant="caption" color="divider">→</Typography>}
                      </Box>
                    ))}
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                    <Typography variant="caption" color={isOverdue ? 'error.main' : 'text.secondary'}>
                      {isOverdue
                        ? `Overdue by ${Math.abs(item.daysLeft)} days`
                        : isNotStarted
                          ? `Prep starts ${item.prepStartDate ? new Date(item.prepStartDate).toLocaleDateString() : '-'}`
                          : `${item.daysLeft} days left`
                      }
                    </Typography>
                    <Button size="small" variant="outlined" onClick={(e) => { e.stopPropagation(); loadDetail(item.instanceId); }}>
                      {isNotStarted ? 'Start preparation' : isSubmitted ? 'View' : `Advance to ${item.stages?.find(s => s.name === item.currentStage) ? item.stages[item.stages.findIndex(s => s.name === item.currentStage) + 1]?.name : 'next'} `}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            );
          })}
          <TablePagination component="div" count={data.totalElements} page={page}
            onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
            onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[10, 25, 50]} />
        </>
      )}

      <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)}
        onSaved={() => { setCreateOpen(false); loadList(); }} onSnackbar={setSnackbar} />

      {snackbar && <Alert severity="error" onClose={() => setSnackbar(null)}
        sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>{snackbar}</Alert>}
    </Box>
  );
}

function DetailView({ detail, onBack, onRefresh, onSnackbar, theme }) {
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const isSubmitted = detail.status === 'Submitted' || detail.status === 'Submitted Late';
  const currentStageIdx = STAGE_NAMES.indexOf(detail.currentStage);
  const isLastStage = currentStageIdx === STAGE_NAMES.length - 1;
  const nextStage = !isLastStage ? STAGE_NAMES[currentStageIdx + 1] : null;

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link underline="hover" color="inherit" sx={{ cursor: 'pointer' }} onClick={onBack}>Returns Calendar</Link>
        <Typography color="text.primary">{detail.returnName}</Typography>
      </Breadcrumbs>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
            <Box>
              <Typography variant="h5">{detail.returnName} · {detail.period}</Typography>
              <Typography variant="body2" color="text.secondary">
                Due {detail.dueDate ? new Date(detail.dueDate).toLocaleDateString() : '-'}
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

      {/* Stages */}
      <Card sx={{ mb: 2 }}>
        <CardHeader title="Stages" />
        <CardContent>
          <Stepper activeStep={currentStageIdx} orientation="vertical" sx={{ mb: 2 }}>
            {detail.stages && detail.stages.map((stage, i) => (
              <Step key={i} completed={stage.completed} active={stage.current}>
                <StepLabel
                  optional={
                    <Box sx={{ mt: 0.5 }}>
                      {stage.completedAt && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          Completed {new Date(stage.completedAt).toLocaleDateString()}
                          {stage.completedByName && ` by ${stage.completedByName}`}
                        </Typography>
                      )}
                      {stage.evidenceUrl && (
                        <Link href={stage.evidenceUrl} target="_blank" rel="noopener" variant="caption" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
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
                  }>
                  {stage.name}
                </StepLabel>
              </Step>
            ))}
          </Stepper>

          {isSubmitted && detail.submissionEvidenceUrl && (
            <Box sx={{ mt: 2, p: 1.5, bgcolor: 'success.50', borderRadius: 1 }}>
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CheckCircle color="success" fontSize="small" />
                Submitted {detail.submittedDate ? new Date(detail.submittedDate).toLocaleDateString() : ''}
                {detail.daysLate > 0 && ` (${detail.daysLate} days late)`}
              </Typography>
              {detail.submissionEvidenceUrl && (
                <Link href={detail.submissionEvidenceUrl} target="_blank" rel="noopener" variant="caption">
                  View submission receipt
                </Link>
              )}
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

/* ---------- Create Return Dialog ---------- */
function CreateDialog({ open, onClose, onSaved, onSnackbar }) {
  const [form, setForm] = useState({
    returnName: '', filingRegulator: '', returnType: '', frequency: '',
    filingDueDayOfMonth: '', filingDeadlineOffsetDays: '', filingChannel: '',
    returnOwnerUserId: '', returnOwnerName: '',
  });
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    setSaving(true);
    try {
      const body = { ...form };
      if (body.filingDueDayOfMonth) body.filingDueDayOfMonth = parseInt(body.filingDueDayOfMonth, 10);
      if (body.filingDeadlineOffsetDays) body.filingDeadlineOffsetDays = parseInt(body.filingDeadlineOffsetDays, 10);
      if (body.returnOwnerUserId) body.returnOwnerUserId = parseInt(body.returnOwnerUserId, 10);
      await api.returns.create(body);
      onSaved();
    } catch (e) { onSnackbar(e.message); } finally { setSaving(false); }
  };
  useEffect(() => { if (open) setForm({ returnName: '', filingRegulator: '', returnType: '', frequency: '', filingDueDayOfMonth: '', filingDeadlineOffsetDays: '', filingChannel: '', returnOwnerUserId: '', returnOwnerName: '' }); }, [open]);
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Return</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12}><TextField label="Return Name" fullWidth size="small" required value={form.returnName}
            onChange={e => setForm(f => ({ ...f, returnName: e.target.value }))} /></Grid>
          <Grid item xs={6}><TextField label="Regulator" fullWidth size="small" value={form.filingRegulator}
            onChange={e => setForm(f => ({ ...f, filingRegulator: e.target.value }))} /></Grid>
          <Grid item xs={6}><TextField label="Return Type" fullWidth size="small" value={form.returnType}
            onChange={e => setForm(f => ({ ...f, returnType: e.target.value }))} /></Grid>
          <Grid item xs={6}><TextField select label="Frequency" fullWidth size="small" value={form.frequency}
            onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
              <MenuItem value="">None</MenuItem>
              <MenuItem value="Monthly">Monthly</MenuItem>
              <MenuItem value="Quarterly">Quarterly</MenuItem>
              <MenuItem value="Semi-Annual">Semi-Annual</MenuItem>
              <MenuItem value="Annual">Annual</MenuItem>
            </TextField></Grid>
          <Grid item xs={6}><TextField label="Filing Channel" fullWidth size="small" value={form.filingChannel}
            onChange={e => setForm(f => ({ ...f, filingChannel: e.target.value }))} /></Grid>
          <Grid item xs={4}><TextField label="Due Day of Month" fullWidth size="small" type="number" value={form.filingDueDayOfMonth}
            onChange={e => setForm(f => ({ ...f, filingDueDayOfMonth: e.target.value }))} /></Grid>
          <Grid item xs={4}><TextField label="Prep Offset (days)" fullWidth size="small" type="number" value={form.filingDeadlineOffsetDays}
            onChange={e => setForm(f => ({ ...f, filingDeadlineOffsetDays: e.target.value }))} /></Grid>
          <Grid item xs={4}><TextField label="Owner User ID" fullWidth size="small" type="number" value={form.returnOwnerUserId}
            onChange={e => setForm(f => ({ ...f, returnOwnerUserId: e.target.value }))} /></Grid>
          <Grid item xs={12}><TextField label="Owner Name" fullWidth size="small" value={form.returnOwnerName}
            onChange={e => setForm(f => ({ ...f, returnOwnerName: e.target.value }))} /></Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !form.returnName}>
          {saving ? 'Creating...' : 'Create Return'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ---------- Advance Stage Dialog ---------- */
function AdvanceDialog({ open, onClose, instanceId, stageName, nextStageName, onSaved, onSnackbar }) {
  const [form, setForm] = useState({ evidenceUrl: '', completedByName: '' });
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    setSaving(true);
    try {
      await api.returns.advance(instanceId, form);
      onSaved();
    } catch (e) { onSnackbar(e.message); } finally { setSaving(false); }
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

/* ---------- Submit Dialog ---------- */
function SubmitDialog({ open, onClose, instanceId, onSaved, onSnackbar }) {
  const [form, setForm] = useState({ evidenceUrl: '' });
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    setSaving(true);
    try {
      await api.returns.submit(instanceId, form);
      onSaved();
    } catch (e) { onSnackbar(e.message); } finally { setSaving(false); }
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
