import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Table, TableHead, TableBody, TableRow, TableCell,
  TablePagination, Chip, TextField, MenuItem, Button, IconButton,
  Card, CardContent, CardHeader, TableContainer, Paper, Dialog,
  DialogTitle, DialogContent, DialogActions, CircularProgress, Alert,
  Divider, Grid, Tooltip, Breadcrumbs, Link, Checkbox, FormControlLabel
} from '@mui/material';
import {
  Add, Warning, Schedule
} from '@mui/icons-material';
import { api } from '../services/api';
import { useTheme } from '@mui/material/styles';

const SEV_COLORS = { Critical: 'error', High: 'error', Medium: 'warning', Low: 'success' };
const STATUS_ORDER = ['Open', 'In Remediation', 'Remediated', 'Closed'];

export default function FindingsPage() {
  const [view, setView] = useState('list');
  const [detailId, setDetailId] = useState(null);
  const [data, setData] = useState({ content: [], totalElements: 0 });
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [filters, setFilters] = useState({ status: 'Open', severity: '', overdueOnly: false });
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [remediateOpen, setRemediateOpen] = useState(false);
  const [snackbar, setSnackbar] = useState(null);
  const theme = useTheme();

  const loadList = useCallback(() => {
    setLoading(true);
    const p = { page, size: rowsPerPage };
    if (filters.status) p.status = filters.status;
    if (filters.severity) p.severity = filters.severity;
    if (filters.overdueOnly) p.overdueOnly = true;
    api.findings.register(p).then(res => setData(res))
      .catch(e => setSnackbar(e.message)).finally(() => setLoading(false));
  }, [page, rowsPerPage, filters]);

  useEffect(() => { loadList(); }, [loadList]);

  const loadDetail = useCallback((id) => {
    setLoading(true);
    api.findings.detail(id).then(res => { setDetail(res); setView('detail'); setDetailId(id); })
      .catch(e => setSnackbar(e.message)).finally(() => setLoading(false));
  }, []);

  if (view === 'detail' && detail) {
    return (
      <DetailView
        detail={detail}
        onBack={() => { setView('list'); setDetail(null); setDetailId(null); }}
        onRefresh={() => loadDetail(detailId)}
        onAssign={() => setAssignOpen(true)}
        onRemediate={() => setRemediateOpen(true)}
        assignOpen={assignOpen} setAssignOpen={setAssignOpen}
        remediateOpen={remediateOpen} setRemediateOpen={setRemediateOpen}
        onSnackbar={setSnackbar} theme={theme}
      />
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Box>
          <Typography variant="h4" sx={{ mb: 0.5 }}>Findings</Typography>
          <Typography variant="body2" color="text.secondary">Track and remediate control gaps</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setRaiseOpen(true)}>
          Raise Finding
        </Button>
      </Box>

      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', pb: '12px !important', alignItems: 'center' }}>
          <TextField select label="Status" size="small" sx={{ minWidth: 130 }}
            value={filters.status} onChange={e => { setFilters(f => ({ ...f, status: e.target.value })); setPage(0); }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="Open">Open</MenuItem>
            <MenuItem value="In Remediation">In Remediation</MenuItem>
            <MenuItem value="Remediated">Remediated</MenuItem>
            <MenuItem value="Closed">Closed</MenuItem>
          </TextField>
          <TextField select label="Severity" size="small" sx={{ minWidth: 130 }}
            value={filters.severity} onChange={e => { setFilters(f => ({ ...f, severity: e.target.value })); setPage(0); }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="Critical">Critical</MenuItem>
            <MenuItem value="High">High</MenuItem>
            <MenuItem value="Medium">Medium</MenuItem>
            <MenuItem value="Low">Low</MenuItem>
          </TextField>
          <FormControlLabel control={<Checkbox checked={filters.overdueOnly}
            onChange={e => { setFilters(f => ({ ...f, overdueOnly: e.target.checked })); setPage(0); }} />}
            label={<Typography variant="body2">Overdue only</Typography>} />
        </CardContent>
      </Card>

      <Card>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : data.content.length === 0 ? (
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Warning sx={{ fontSize: 48, color: theme.palette.action.disabled, mb: 1 }} />
            <Typography color="text.secondary">No findings found</Typography>
          </CardContent>
        ) : (
          <>
            <TableContainer component={Paper} elevation={0}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>ID</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Finding</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Sev.</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Owner</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Deadline</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.content.map((row) => {
                    const deadline = row.remediationDeadline ? new Date(row.remediationDeadline) : null;
                    const isOverdue = deadline && deadline < new Date() && row.status !== 'Closed' && row.status !== 'Remediated';
                    return (
                      <TableRow key={row.findingId} hover sx={{ cursor: 'pointer' }}
                        onClick={() => loadDetail(row.findingId)}>
                        <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{row.displayId}</TableCell>
                        <TableCell sx={{ maxWidth: 350, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.description}
                        </TableCell>
                        <TableCell><Chip label={row.severity} size="small" color={SEV_COLORS[row.severity] || 'default'} /></TableCell>
                        <TableCell>{row.assignedToName || '-'}</TableCell>
                        <TableCell>
                          <Typography variant="body2" color={isOverdue ? 'error.main' : 'text.primary'}
                            sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {isOverdue && <Schedule fontSize="inherit" />}
                            {deadline ? deadline.toLocaleDateString() : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={row.status} size="small"
                            color={row.status === 'Closed' ? 'success' : row.status === 'Remediated' ? 'info' : row.status === 'In Remediation' ? 'warning' : 'default'} />
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="View detail">
                            <IconButton size="small" onClick={(e) => { e.stopPropagation(); loadDetail(row.findingId); }}>
                              <Warning fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination component="div" count={data.totalElements} page={page}
              onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
              onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              rowsPerPageOptions={[10, 25, 50]} />
          </>
        )}
      </Card>

      <RaiseDialog open={raiseOpen} onClose={() => setRaiseOpen(false)}
        onSaved={() => { setRaiseOpen(false); loadList(); }} onSnackbar={setSnackbar} />

      {snackbar && <Alert severity="error" onClose={() => setSnackbar(null)}
        sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>{snackbar}</Alert>}
    </Box>
  );
}

function DetailView({ detail, onBack, onRefresh, onAssign, onRemediate, assignOpen, setAssignOpen, remediateOpen, setRemediateOpen, onSnackbar, theme }) {
  const isOpen = detail.status === 'Open';
  const isInRemediation = detail.status === 'In Remediation';
  const isRemediated = detail.status === 'Remediated';
  const isClosed = detail.status === 'Closed';
  const deadline = detail.remediationDeadline ? new Date(detail.remediationDeadline) : null;
  const isOverdue = deadline && deadline < new Date() && !isClosed;

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link underline="hover" color="inherit" sx={{ cursor: 'pointer' }} onClick={onBack}>Findings</Link>
        <Typography color="text.primary">{detail.displayId}</Typography>
      </Breadcrumbs>

      <Card sx={{ mb: 2, borderLeft: 4, borderColor: SEV_COLORS[detail.severity] + '.main' }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="h5">{detail.displayId}</Typography>
                <Chip label={detail.severity} size="small" color={SEV_COLORS[detail.severity] || 'default'} />
                <Chip label={detail.status} size="small"
                  color={isClosed ? 'success' : isRemediated ? 'info' : isInRemediation ? 'warning' : 'default'} />
              </Box>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>{detail.description}</Typography>
              {detail.linkedControlId && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Linked control: CTRL-{String(detail.linkedControlId).padStart(3, '0')}
                </Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {isOpen && <Button variant="outlined" size="small" onClick={onAssign}>Assign</Button>}
              {isInRemediation && (
                <Button variant="contained" size="small" onClick={onRemediate}>Submit Remediation</Button>
              )}
              {isRemediated && (
                <Button variant="contained" color="success" size="small"
                  onClick={async () => { try { await api.findings.close(detail.findingId); onRefresh(); } catch (e) { onSnackbar(e.message); } }}>
                  Close Finding
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
              <Typography variant="body2" color="text.secondary">Deadline: {deadline.toLocaleDateString()}</Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          {/* Timeline */}
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

        <Grid item xs={12} md={4}>
          {/* Details sidebar */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Finding Details</Typography>
              <DetailRow label="Type" value={detail.findingType} />
              <DetailRow label="Trigger" value={detail.triggerReason} />
              {detail.rootCause && <DetailRow label="Root cause" value={detail.rootCause} />}
              <DetailRow label="Created" value={detail.createdAt ? new Date(detail.createdAt).toLocaleDateString() : '-'} />
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Remediation</Typography>
              <DetailRow label="Owner" value={detail.assignedToName || 'Unassigned'} />
              <DetailRow label="Deadline" value={deadline ? deadline.toLocaleDateString() : '-'} />
              {detail.remediationEvidenceUrl && (
                <Box sx={{ mt: 1 }}>
                  <Link href={detail.remediationEvidenceUrl} target="_blank" rel="noopener" variant="body2">View evidence</Link>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <AssignDialog open={assignOpen} onClose={() => setAssignOpen(false)}
        findingId={detail.findingId} onSaved={() => { setAssignOpen(false); onRefresh(); }}
        onSnackbar={onSnackbar} />

      <RemediateDialog open={remediateOpen} onClose={() => setRemediateOpen(false)}
        findingId={detail.findingId} onSaved={() => { setRemediateOpen(false); onRefresh(); }}
        onSnackbar={onSnackbar} />
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
function RaiseDialog({ open, onClose, onSaved, onSnackbar }) {
  const [form, setForm] = useState({
    findingType: '', severity: '', description: '', rootCause: '',
    linkedObligationId: '', linkedControlId: '',
    assignedToUserId: '', assignedToName: '', remediationDeadline: '',
  });
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    setSaving(true);
    try {
      const body = { ...form };
      if (body.linkedObligationId) body.linkedObligationId = parseInt(body.linkedObligationId, 10);
      if (body.linkedControlId) body.linkedControlId = parseInt(body.linkedControlId, 10);
      if (body.assignedToUserId) body.assignedToUserId = parseInt(body.assignedToUserId, 10);
      await api.findings.raise(body);
      onSaved();
    } catch (e) { onSnackbar(e.message); } finally { setSaving(false); }
  };
  const reset = () => setForm({ findingType: '', severity: '', description: '', rootCause: '', linkedObligationId: '', linkedControlId: '', assignedToUserId: '', assignedToName: '', remediationDeadline: '' });
  useEffect(() => { if (open) reset(); }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Raise New Finding</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={6}>
            <TextField select label="Finding type" fullWidth size="small" required value={form.findingType}
              onChange={e => setForm(f => ({ ...f, findingType: e.target.value }))}>
              <MenuItem value="">Select...</MenuItem>
              <MenuItem value="Gap">Gap (no control exists)</MenuItem>
              <MenuItem value="Control Failure">Control failure (test failed)</MenuItem>
              <MenuItem value="Process Weakness">Process weakness</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={6}>
            <TextField select label="Severity" fullWidth size="small" required value={form.severity}
              onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
              <MenuItem value="">Select...</MenuItem>
              <MenuItem value="Critical">Critical</MenuItem>
              <MenuItem value="High">High</MenuItem>
              <MenuItem value="Medium">Medium</MenuItem>
              <MenuItem value="Low">Low</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12}>
            <TextField label="Description" fullWidth size="small" multiline minRows={2} required value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Root cause" fullWidth size="small" multiline minRows={2} value={form.rootCause}
              onChange={e => setForm(f => ({ ...f, rootCause: e.target.value }))} />
          </Grid>
          <Grid item xs={6}>
            <TextField label="Linked Obligation ID" fullWidth size="small" type="number" value={form.linkedObligationId}
              onChange={e => setForm(f => ({ ...f, linkedObligationId: e.target.value }))} />
          </Grid>
          <Grid item xs={6}>
            <TextField label="Linked Control ID" fullWidth size="small" type="number" value={form.linkedControlId}
              onChange={e => setForm(f => ({ ...f, linkedControlId: e.target.value }))} />
          </Grid>
          <Grid item xs={6}>
            <TextField label="Assign to User ID" fullWidth size="small" type="number" value={form.assignedToUserId}
              onChange={e => setForm(f => ({ ...f, assignedToUserId: e.target.value }))} />
          </Grid>
          <Grid item xs={6}>
            <TextField label="Assign to Name" fullWidth size="small" value={form.assignedToName}
              onChange={e => setForm(f => ({ ...f, assignedToName: e.target.value }))} />
          </Grid>
          <Grid item xs={12}>
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
function AssignDialog({ open, onClose, findingId, onSaved, onSnackbar }) {
  const [form, setForm] = useState({ assignedToUserId: '', remediationDeadline: '' });
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    setSaving(true);
    try {
      await api.findings.assign(findingId, {
        assignedToUserId: parseInt(form.assignedToUserId, 10),
        remediationDeadline: form.remediationDeadline,
      });
      onSaved();
    } catch (e) { onSnackbar(e.message); } finally { setSaving(false); }
  };
  useEffect(() => { if (open) setForm({ assignedToUserId: '', remediationDeadline: '' }); }, [open]);
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Assign Finding</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12}>
            <TextField label="User ID" fullWidth size="small" type="number" required value={form.assignedToUserId}
              onChange={e => setForm(f => ({ ...f, assignedToUserId: e.target.value }))} />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Remediation deadline" type="date" fullWidth size="small" required
              InputLabelProps={{ shrink: true }} value={form.remediationDeadline}
              onChange={e => setForm(f => ({ ...f, remediationDeadline: e.target.value }))} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !form.assignedToUserId || !form.remediationDeadline}>
          {saving ? 'Assigning...' : 'Assign'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ---------- Remediate Dialog ---------- */
function RemediateDialog({ open, onClose, findingId, onSaved, onSnackbar }) {
  const [form, setForm] = useState({ remediationNotes: '', evidenceUrl: '' });
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    setSaving(true);
    try {
      await api.findings.remediate(findingId, form);
      onSaved();
    } catch (e) { onSnackbar(e.message); } finally { setSaving(false); }
  };
  useEffect(() => { if (open) setForm({ remediationNotes: '', evidenceUrl: '' }); }, [open]);
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Submit Remediation</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12}>
            <TextField label="Remediation notes" fullWidth size="small" multiline minRows={3} value={form.remediationNotes}
              onChange={e => setForm(f => ({ ...f, remediationNotes: e.target.value }))} />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Evidence URL" fullWidth size="small" value={form.evidenceUrl}
              onChange={e => setForm(f => ({ ...f, evidenceUrl: e.target.value }))} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Submitting...' : 'Submit Remediation'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
