import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Typography, Table, TableHead, TableBody, TableRow, TableCell,
  TablePagination, Chip, TextField, MenuItem, Button, IconButton,
  Card, CardContent, CardHeader, TableContainer, Paper, Dialog,
  DialogTitle, DialogContent, DialogActions, CircularProgress, Alert,
  Divider, Grid, Tooltip, Breadcrumbs, Link
} from '@mui/material';
import {
  Add, ArrowBack, Edit, History, PlaylistAddCheck,
  Gavel, Visibility, Science
} from '@mui/icons-material';
import { api } from '../services/api';
import { useTheme } from '@mui/material/styles';
import OwnerPicker from '../components/org/OwnerPicker';

const RISK_COLORS = { High: 'error', Medium: 'warning', Low: 'success' };

export default function ControlsPage() {
  const [view, setView] = useState('list');
  const [detailId, setDetailId] = useState(null);
  const [data, setData] = useState({ content: [], totalElements: 0 });
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [filters, setFilters] = useState({ theme: '', residualRisk: '', ownerId: null });
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [recordTestOpen, setRecordTestOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState(null);
  const theme = useTheme();

  const loadList = useCallback(() => {
    setLoading(true);
    const p = { page, size: rowsPerPage };
    if (filters.theme) p.theme = filters.theme;
    if (filters.residualRisk) p.residualRisk = filters.residualRisk;
    if (filters.ownerId) p.ownerId = filters.ownerId;
    api.controls.register(p).then(res => {
      setData(res);
    }).catch(e => {
      setSnackbar(e.message);
    }).finally(() => setLoading(false));
  }, [page, rowsPerPage, filters]);

  useEffect(() => { loadList(); }, [loadList]);

  const loadDetail = useCallback((id) => {
    setLoading(true);
    api.controls.detail(id).then(res => {
      setDetail(res);
      setView('detail');
      setDetailId(id);
    }).catch(e => setSnackbar(e.message))
    .finally(() => setLoading(false));
  }, []);

  if (view === 'detail' && detail) {
    return (
      <DetailView
        detail={detail}
        onBack={() => { setView('list'); setDetail(null); setDetailId(null); }}
        onRefresh={() => loadDetail(detailId)}
        onEdit={() => setEditOpen(true)}
        onRecordTest={() => setRecordTestOpen(true)}
        editOpen={editOpen}
        setEditOpen={setEditOpen}
        recordTestOpen={recordTestOpen}
        setRecordTestOpen={setRecordTestOpen}
        onSnackbar={setSnackbar}
        saving={saving}
        setSaving={setSaving}
      />
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Box>
          <Typography variant="h4" sx={{ mb: 0.5 }}>Controls</Typography>
          <Typography variant="body2" color="text.secondary">Control inventory and testing schedule</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>
          New Control
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', pb: '12px !important' }}>
          <TextField select label="Theme" size="small" sx={{ minWidth: 140 }}
            value={filters.theme} onChange={e => { setFilters(f => ({ ...f, theme: e.target.value })); setPage(0); }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="IT">IT</MenuItem>
            <MenuItem value="Financial">Financial</MenuItem>
            <MenuItem value="Operational">Operational</MenuItem>
            <MenuItem value="Compliance">Compliance</MenuItem>
            <MenuItem value="Legal">Legal</MenuItem>
          </TextField>
          <TextField select label="Residual Risk" size="small" sx={{ minWidth: 140 }}
            value={filters.residualRisk} onChange={e => { setFilters(f => ({ ...f, residualRisk: e.target.value })); setPage(0); }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="High">High</MenuItem>
            <MenuItem value="Medium">Medium</MenuItem>
            <MenuItem value="Low">Low</MenuItem>
          </TextField>
          <OwnerPicker value={filters.ownerId} onChange={id => { setFilters(f => ({ ...f, ownerId: id })); setPage(0); }}
            label="Owner" allowQuickAdd={false} sx={{ minWidth: 200 }} />
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : data.content.length === 0 ? (
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Gavel sx={{ fontSize: 48, color: theme.palette.action.disabled, mb: 1 }} />
            <Typography color="text.secondary">No controls found</Typography>
          </CardContent>
        ) : (
          <>
            <TableContainer component={Paper} elevation={0}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>#</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Owner</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Residual Risk</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Next Test Due</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.content.map((row) => (
                    <TableRow key={row.controlId} hover sx={{ cursor: 'pointer' }}
                      onClick={() => loadDetail(row.controlId)}>
                      <TableCell>{row.controlNumber}</TableCell>
                      <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.name}
                      </TableCell>
                      <TableCell>{row.controlOwnerName || '-'}</TableCell>
                      <TableCell>
                        <Chip label={row.residualRisk || '-'}
                          color={RISK_COLORS[row.residualRisk] || 'default'} size="small" />
                      </TableCell>
                      <TableCell>
                        {row.nextTestDueDate ? (
                          <Typography variant="body2"
                            color={new Date(row.nextTestDueDate) < new Date() ? 'error.main' : 'text.primary'}>
                            {new Date(row.nextTestDueDate).toLocaleDateString()}
                          </Typography>
                        ) : '-'}
                      </TableCell>
                      <TableCell><Chip label={row.status} size="small" color={row.status === 'Active' ? 'success' : 'default'} /></TableCell>
                      <TableCell align="right">
                        <Tooltip title="View detail"><IconButton size="small" onClick={(e) => { e.stopPropagation(); loadDetail(row.controlId); }}><Visibility fontSize="small" /></IconButton></Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
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

      <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)}
        onSaved={() => { setCreateOpen(false); loadList(); }} onSnackbar={setSnackbar} saving={saving} setSaving={setSaving} />

      {snackbar && <Alert severity="error" onClose={() => setSnackbar(null)} sx={{ position: 'fixed', bottom: 24, right: 24 }}>{snackbar}</Alert>}
    </Box>
  );
}

function DetailView({ detail, onBack, onRefresh, onEdit, onRecordTest, editOpen, setEditOpen, recordTestOpen, setRecordTestOpen, onSnackbar, saving, setSaving }) {
  const theme = useTheme();

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link underline="hover" color="inherit" sx={{ cursor: 'pointer' }} onClick={onBack}>Controls</Link>
        <Typography color="text.primary">{detail.controlNumber}</Typography>
      </Breadcrumbs>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4">{detail.name}</Typography>
          <Typography variant="body2" color="text.secondary">{detail.controlNumber}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<History />} onClick={onEdit}>Edit</Button>
          <Button variant="contained" startIcon={<PlaylistAddCheck />} onClick={onRecordTest}>Record Test</Button>
        </Box>
      </Box>

      <Grid container spacing={2}>
        {/* About this Control */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardHeader title="About this Control" />
            <CardContent>
              {detail.whatItDoes && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">What it does</Typography>
                  <Typography variant="body2">{detail.whatItDoes}</Typography>
                </Box>
              )}
              {detail.howTested && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">How it's tested</Typography>
                  <Typography variant="body2">{detail.howTested}</Typography>
                </Box>
              )}
              {detail.description && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Description</Typography>
                  <Typography variant="body2">{detail.description}</Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Linked Obligations */}
          <Card sx={{ mt: 2 }}>
            <CardHeader title="Linked Obligations" />
            <CardContent>
              {detail.linkedObligations && detail.linkedObligations.length > 0 ? (
                <TableContainer component={Paper} elevation={0}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>ID</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Instrument</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {detail.linkedObligations.map((o) => (
                        <TableRow key={o.obligationId}>
                          <TableCell>{o.obligationId}</TableCell>
                          <TableCell>{o.description}</TableCell>
                          <TableCell>{o.instrumentTitle}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="body2" color="text.secondary">No linked obligations</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Control Details</Typography>
              <DetailRow label="Theme" value={detail.theme} />
              <DetailRow label="Type" value={detail.controlType} />
              <DetailRow label="Owner" value={detail.controlOwnerName || 'Unassigned'} />
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Risk Assessment</Typography>
              <DetailRow label="Inherent Risk" value={detail.inherentRisk} chip />
              <DetailRow label="Residual Risk" value={detail.residualRisk} chip />
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Testing</Typography>
              <DetailRow label="Frequency" value={detail.testFrequency || 'Not set'} />
              <DetailRow label="Next test due" value={detail.nextTestDueDate ? new Date(detail.nextTestDueDate).toLocaleDateString() : 'Not scheduled'} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Test History */}
      <Card sx={{ mt: 2 }}>
        <CardHeader title="Test History" />
        <CardContent>
          {detail.testHistory && detail.testHistory.length > 0 ? (
            <TableContainer component={Paper} elevation={0}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Tester</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Result</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Failure Severity</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Review</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Evidence</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {detail.testHistory.map((t) => (
                    <TableRow key={t.testId}>
                      <TableCell>{new Date(t.testDate).toLocaleDateString()}</TableCell>
                      <TableCell>{t.testedByName || t.testedByUserId || '-'}</TableCell>
                      <TableCell>
                        <Chip label={t.result} size="small"
                          color={t.result === 'Passed' ? 'success' : t.result === 'Failed' ? 'error' : t.result === 'Partial' ? 'warning' : 'default'} />
                      </TableCell>
                      <TableCell>{t.failureSeverity || '-'}</TableCell>
                      <TableCell>
                        <Chip label={t.reviewStatus || 'Pending'} size="small"
                          color={t.reviewStatus === 'Accepted' ? 'success' : t.reviewStatus === 'Rejected' ? 'error' : 'default'} />
                      </TableCell>
                      <TableCell>
                        {t.evidenceUrl ? (
                          <Link href={t.evidenceUrl} target="_blank" rel="noopener">View</Link>
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Science sx={{ fontSize: 40, color: theme.palette.action.disabled, mb: 1 }} />
              <Typography variant="body2" color="text.secondary">No tests recorded yet</Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      <EditDialog open={editOpen} onClose={() => setEditOpen(false)} control={detail}
        onSaved={() => { setEditOpen(false); onRefresh(); }} onSnackbar={onSnackbar} saving={saving} setSaving={setSaving} />

      <RecordTestDialog open={recordTestOpen} onClose={() => setRecordTestOpen(false)} controlId={detail.controlId}
        onSaved={() => { setRecordTestOpen(false); onRefresh(); }} onSnackbar={onSnackbar} saving={saving} setSaving={setSaving} />
    </Box>
  );
}

function DetailRow({ label, value, chip }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      {chip ? (
        <Chip label={value || '-'} size="small" color={RISK_COLORS[value] || 'default'} />
      ) : (
        <Typography variant="body2" sx={{ fontWeight: 500 }}>{value || '-'}</Typography>
      )}
    </Box>
  );
}

/* ---------- Create Dialog ---------- */
function CreateDialog({ open, onClose, onSaved, onSnackbar, saving, setSaving }) {
  const [form, setForm] = useState(emptyForm());
  function emptyForm() {
    return { controlNumber: '', name: '', description: '', theme: '', controlType: '',
      whatItDoes: '', howTested: '', controlOwnerId: null, testFrequency: '',
      testFrequencyDays: '', linkedObligationIds: '', inherentRisk: '' };
  }
  const handleSave = async () => {
    setSaving(true);
    try {
      const body = { ...form };
      if (!body.controlOwnerId) body.controlOwnerId = null;
      if (body.testFrequencyDays) body.testFrequencyDays = parseInt(body.testFrequencyDays, 10);
      if (body.linkedObligationIds) {
        body.linkedObligationIds = body.linkedObligationIds.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
      } else { body.linkedObligationIds = []; }
      await api.controls.create(body);
      onSaved();
    } catch (e) { onSnackbar(e.message); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>New Control</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={6}>
            <TextField label="Control Number" fullWidth size="small" required value={form.controlNumber}
              onChange={e => setForm(f => ({ ...f, controlNumber: e.target.value }))} />
          </Grid>
          <Grid item xs={6}>
            <TextField label="Name" fullWidth size="small" required value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Description" fullWidth size="small" multiline minRows={2} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </Grid>
          <Grid item xs={4}>
            <TextField select label="Theme" fullWidth size="small" value={form.theme}
              onChange={e => setForm(f => ({ ...f, theme: e.target.value }))}>
              <MenuItem value="">None</MenuItem>
              <MenuItem value="IT">IT</MenuItem>
              <MenuItem value="Financial">Financial</MenuItem>
              <MenuItem value="Operational">Operational</MenuItem>
              <MenuItem value="Compliance">Compliance</MenuItem>
              <MenuItem value="Legal">Legal</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={4}>
            <TextField select label="Control Type" fullWidth size="small" value={form.controlType}
              onChange={e => setForm(f => ({ ...f, controlType: e.target.value }))}>
              <MenuItem value="">None</MenuItem>
              <MenuItem value="Preventive">Preventive</MenuItem>
              <MenuItem value="Detective">Detective</MenuItem>
              <MenuItem value="Corrective">Corrective</MenuItem>
              <MenuItem value="Directive">Directive</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={4}>
            <TextField select label="Inherent Risk" fullWidth size="small" value={form.inherentRisk}
              onChange={e => setForm(f => ({ ...f, inherentRisk: e.target.value }))}>
              <MenuItem value="">None</MenuItem>
              <MenuItem value="High">High</MenuItem>
              <MenuItem value="Medium">Medium</MenuItem>
              <MenuItem value="Low">Low</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12}>
            <TextField label="What it does" fullWidth size="small" multiline minRows={2} value={form.whatItDoes}
              onChange={e => setForm(f => ({ ...f, whatItDoes: e.target.value }))} />
          </Grid>
          <Grid item xs={12}>
            <TextField label="How it's tested" fullWidth size="small" multiline minRows={2} value={form.howTested}
              onChange={e => setForm(f => ({ ...f, howTested: e.target.value }))} />
          </Grid>
          <Grid item xs={8}>
            <OwnerPicker value={form.controlOwnerId} onChange={id => setForm(f => ({ ...f, controlOwnerId: id }))}
              label="Owner" />
          </Grid>
          <Grid item xs={4}>
            <TextField select label="Test Frequency" fullWidth size="small" value={form.testFrequency}
              onChange={e => setForm(f => ({ ...f, testFrequency: e.target.value }))}>
              <MenuItem value="">None</MenuItem>
              <MenuItem value="Monthly">Monthly</MenuItem>
              <MenuItem value="Quarterly">Quarterly</MenuItem>
              <MenuItem value="Semi-Annual">Semi-Annual</MenuItem>
              <MenuItem value="Annual">Annual</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={4}>
            <TextField label="Frequency Days" fullWidth size="small" type="number" value={form.testFrequencyDays}
              onChange={e => setForm(f => ({ ...f, testFrequencyDays: e.target.value }))} />
          </Grid>
          <Grid item xs={8}>
            <TextField label="Linked Obligation IDs (comma-separated)" fullWidth size="small" value={form.linkedObligationIds}
              onChange={e => setForm(f => ({ ...f, linkedObligationIds: e.target.value }))} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !form.controlNumber || !form.name}>
          {saving ? 'Saving...' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ---------- Edit Dialog ---------- */
function EditDialog({ open, onClose, control, onSaved, onSnackbar, saving, setSaving }) {
  const [form, setForm] = useState({});
  useEffect(() => {
    if (control) {
      setForm({
        name: control.name || '', description: control.description || '', whatItDoes: control.whatItDoes || '',
        howTested: control.howTested || '', controlOwnerId: control.controlOwnerId ?? null, testFrequency: control.testFrequency || '',
        testFrequencyDays: control.testFrequencyDays?.toString() || '',
        linkedObligationIds: control.linkedObligations?.map(o => o.obligationId).join(', ') || '',
        inherentRisk: control.inherentRisk || '',
      });
    }
  }, [control]);
  const handleSave = async () => {
    setSaving(true);
    try {
      const body = { ...form };
      if (!body.controlOwnerId) body.controlOwnerId = null;
      if (body.testFrequencyDays) body.testFrequencyDays = parseInt(body.testFrequencyDays, 10);
      if (body.linkedObligationIds) {
        body.linkedObligationIds = body.linkedObligationIds.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
      } else { body.linkedObligationIds = []; }
      await api.controls.update(control.controlId, body);
      onSaved();
    } catch (e) { onSnackbar(e.message); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Edit Control — {control?.controlNumber}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12}>
            <TextField label="Name" fullWidth size="small" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Description" fullWidth size="small" multiline minRows={2} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </Grid>
          <Grid item xs={12}>
            <TextField label="What it does" fullWidth size="small" multiline minRows={2} value={form.whatItDoes}
              onChange={e => setForm(f => ({ ...f, whatItDoes: e.target.value }))} />
          </Grid>
          <Grid item xs={12}>
            <TextField label="How it's tested" fullWidth size="small" multiline minRows={2} value={form.howTested}
              onChange={e => setForm(f => ({ ...f, howTested: e.target.value }))} />
          </Grid>
          <Grid item xs={8}>
            <OwnerPicker value={form.controlOwnerId} onChange={id => setForm(f => ({ ...f, controlOwnerId: id }))}
              label="Owner" />
          </Grid>
          <Grid item xs={4}>
            <TextField select label="Test Frequency" fullWidth size="small" value={form.testFrequency}
              onChange={e => setForm(f => ({ ...f, testFrequency: e.target.value }))}>
              <MenuItem value="">None</MenuItem>
              <MenuItem value="Monthly">Monthly</MenuItem>
              <MenuItem value="Quarterly">Quarterly</MenuItem>
              <MenuItem value="Semi-Annual">Semi-Annual</MenuItem>
              <MenuItem value="Annual">Annual</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={4}>
            <TextField label="Frequency Days" fullWidth size="small" type="number" value={form.testFrequencyDays}
              onChange={e => setForm(f => ({ ...f, testFrequencyDays: e.target.value }))} />
          </Grid>
          <Grid item xs={8}>
            <TextField label="Linked Obligation IDs (comma-separated)" fullWidth size="small" value={form.linkedObligationIds}
              onChange={e => setForm(f => ({ ...f, linkedObligationIds: e.target.value }))} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
      </DialogActions>
    </Dialog>
  );
}

/* ---------- Record Test Dialog ---------- */
function RecordTestDialog({ open, onClose, controlId, onSaved, onSnackbar, saving, setSaving }) {
  const [form, setForm] = useState({
    testDate: new Date().toISOString().split('T')[0],
    result: '', resultDescription: '', failureDetails: '', failureSeverity: '',
    evidenceUrl: '', remediationRequired: false, remediationOwnerId: null, remediationDeadline: '',
  });
  const handleSave = async () => {
    setSaving(true);
    try {
      const body = { ...form };
      if (!body.remediationOwnerId) body.remediationOwnerId = null;
      if (!body.remediationDeadline) delete body.remediationDeadline;
      await api.controls.recordTest(controlId, body);
      onSaved();
    } catch (e) { onSnackbar(e.message); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Record Test Result</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={6}>
            <TextField label="Test Date" type="date" fullWidth size="small" required
              InputLabelProps={{ shrink: true }} value={form.testDate}
              onChange={e => setForm(f => ({ ...f, testDate: e.target.value }))} />
          </Grid>
          <Grid item xs={6}>
            <TextField select label="Result" fullWidth size="small" required value={form.result}
              onChange={e => setForm(f => ({ ...f, result: e.target.value }))}>
              <MenuItem value="">Select...</MenuItem>
              <MenuItem value="Passed">Passed</MenuItem>
              <MenuItem value="Failed">Failed</MenuItem>
              <MenuItem value="Partial">Partial</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12}>
            <TextField label="Result Description" fullWidth size="small" multiline minRows={2} value={form.resultDescription}
              onChange={e => setForm(f => ({ ...f, resultDescription: e.target.value }))} />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Failure Details" fullWidth size="small" multiline minRows={2} value={form.failureDetails}
              onChange={e => setForm(f => ({ ...f, failureDetails: e.target.value }))} />
          </Grid>
          <Grid item xs={6}>
            <TextField select label="Failure Severity" fullWidth size="small" value={form.failureSeverity}
              onChange={e => setForm(f => ({ ...f, failureSeverity: e.target.value }))}>
              <MenuItem value="">None</MenuItem>
              <MenuItem value="Critical">Critical</MenuItem>
              <MenuItem value="High">High</MenuItem>
              <MenuItem value="Medium">Medium</MenuItem>
              <MenuItem value="Low">Low</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={6}>
            <TextField label="Evidence URL" fullWidth size="small" value={form.evidenceUrl}
              onChange={e => setForm(f => ({ ...f, evidenceUrl: e.target.value }))} />
          </Grid>
          <Grid item xs={6}>
            <OwnerPicker value={form.remediationOwnerId} label="Remediation Owner"
              onChange={id => setForm(f => ({ ...f, remediationOwnerId: id }))} />
          </Grid>
          <Grid item xs={6}>
            <TextField label="Remediation Deadline" type="date" fullWidth size="small"
              InputLabelProps={{ shrink: true }} value={form.remediationDeadline}
              onChange={e => setForm(f => ({ ...f, remediationDeadline: e.target.value }))} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !form.testDate || !form.result}>
          {saving ? 'Saving...' : 'Record Test'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
