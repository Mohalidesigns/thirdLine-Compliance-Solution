import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, Chip, Button, CircularProgress, Alert, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  TextField, InputAdornment, Grid, Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem, FormControlLabel, Checkbox,
  Snackbar, Tooltip, TablePagination,
} from '@mui/material';
import { Search, Refresh, ArrowBack, Visibility, Edit, History } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { api } from '../services/api';

const RISK_COLORS = { High: 'error', Medium: 'warning', Low: 'success' };
const STATUS_OPTIONS = ['active', 'classified', 'unclassified'];
const RISK_OPTIONS = ['High', 'Medium', 'Low'];

export default function ObligationsRegisterPage() {
  const theme = useTheme();
  const [view, setView] = useState('list'); // list | detail
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [applicability, setApplicability] = useState('');
  const [tenantRiskRating, setTenantRiskRating] = useState('');
  const [hasGap, setHasGap] = useState(false);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  // Detail
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);

  // History dialog
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [snack, setSnack] = useState(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, size: rowsPerPage };
      if (applicability) params.applicability = applicability;
      if (tenantRiskRating) params.tenantRiskRating = tenantRiskRating;
      if (hasGap) params.hasGap = 'true';
      if (status) params.status = status;
      const data = await api.obligations.register(params);
      setItems(data.content || []);
      setTotal(data.totalElements || 0);
    } catch { setError('Failed to load obligations.'); }
    finally { setLoading(false); }
  }, [page, rowsPerPage, applicability, tenantRiskRating, hasGap, status]);

  useEffect(() => { loadList(); }, [loadList]);

  async function openDetail(instrId) {
    setDetailLoading(true);
    setError('');
    try {
      const d = await api.obligations.detail(instrId);
      setDetail(d);
      setView('detail');
    } catch { setError('Failed to load detail.'); }
    finally { setDetailLoading(false); }
  }

  function openEdit() {
    if (!detail) return;
    setEditData({
      applicability: detail.applicability || 'applicable',
      applicabilityReasoning: detail.applicabilityReasoning || '',
      tenantRiskRating: detail.tenantRiskRating || '',
      riskJustification: detail.riskJustification || '',
      riskType: detail.riskType || '',
      impactRating: detail.impactRating || '',
      impactJustification: detail.impactJustification || '',
      likelihoodRating: detail.likelihoodRating || '',
      likelihoodJustification: detail.likelihoodJustification || '',
      assignedOwnerUserId: detail.assignedOwnerUserId || '',
      assignedOwnerName: detail.assignedOwnerName || '',
      assignedDepartment: detail.assignedDepartment || '',
      hasGap: detail.hasGap || false,
      gapDescription: detail.gapDescription || '',
      changeReason: '',
    });
    setEditOpen(true);
  }

  async function handleSaveEdit() {
    setSaving(true);
    try {
      const body = { ...editData };
      if (body.assignedOwnerUserId === '') body.assignedOwnerUserId = null;
      const result = await api.obligations.classify(detail.instrumentId, body);
      setSnack({ severity: 'success', message: 'Classification saved' });
      setEditOpen(false);
      openDetail(detail.instrumentId);
      loadList();
    } catch (e) { setSnack({ severity: 'error', message: e.message }); }
    finally { setSaving(false); }
  }

  async function openHistory(instrId) {
    setHistoryLoading(true);
    try {
      const h = await api.obligations.history(instrId);
      setHistoryItems(h || []);
      setHistoryOpen(true);
    } catch { setSnack({ severity: 'error', message: 'Failed to load history' }); }
    finally { setHistoryLoading(false); }
  }

  const rc = (rating) => RISK_COLORS[rating] || 'default';

  // --- Detail view ---
  if (view === 'detail') {
    if (detailLoading) {
      return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
    }
    if (!detail) return null;
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <IconButton onClick={() => { setView('list'); setDetail(null); }}><ArrowBack /></IconButton>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Obligation Detail</Typography>
        </Box>

        <Card sx={{ mb: 3 }}>
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Chip size="small" label={detail.platformRiskRating || 'Unrated'}
                color={rc(detail.platformRiskRating)} sx={{ fontWeight: 600, minWidth: 60 }} />
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                {detail.regulatorAbbreviation || detail.regulatorName}
              </Typography>
              <Chip size="small" label={detail.documentType || 'Document'} variant="outlined" />
              <Chip size="small" label={detail.status || 'unknown'} variant="outlined" color={detail.status === 'active' ? 'success' : 'default'} />
            </Box>

            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>{detail.sourceTitle}</Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>Your Classification</Typography>
                <Box sx={{ bgcolor: '#F7FAFC', borderRadius: 1, p: 2 }}>
                  <Typography variant="body2"><strong>Applicability:</strong> {detail.applicability || '-'}</Typography>
                  {detail.applicabilityReasoning && <Typography variant="body2" sx={{ mt: 0.5 }}><strong>Reasoning:</strong> {detail.applicabilityReasoning}</Typography>}
                  <Typography variant="body2" sx={{ mt: 0.5 }}><strong>Owner:</strong> {detail.assignedOwnerName || 'Unassigned'} {detail.assignedDepartment ? `(${detail.assignedDepartment})` : ''}</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>Risk Assessment</Typography>
                <Box sx={{ bgcolor: '#F7FAFC', borderRadius: 1, p: 2 }}>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Box><Typography variant="caption" color="text.secondary">Inherent</Typography><Chip size="small" label={detail.inherentRiskRating || '-'} color={rc(detail.inherentRiskRating)} sx={{ display: 'block', mt: 0.3 }} /></Box>
                    <Box><Typography variant="caption" color="text.secondary">Residual</Typography><Chip size="small" label={detail.residualRiskRating || '-'} color={rc(detail.residualRiskRating)} sx={{ display: 'block', mt: 0.3 }} /></Box>
                    <Box><Typography variant="caption" color="text.secondary">Impact</Typography><Typography variant="body2" sx={{ mt: 0.3 }}>{detail.impactRating || '-'} / {detail.likelihoodRating || '-'}</Typography></Box>
                    <Box><Typography variant="caption" color="text.secondary">Risk Type</Typography><Typography variant="body2" sx={{ mt: 0.3 }}>{detail.riskType || '-'}</Typography></Box>
                  </Box>
                  {detail.riskJustification && <Typography variant="body2" sx={{ mt: 1 }}>{detail.riskJustification}</Typography>}
                </Box>
              </Grid>
              {detail.hasGap && (
                <Grid item xs={12}>
                  <Alert severity="warning">Gap identified: {detail.gapDescription || 'No control covers this obligation'}</Alert>
                </Grid>
              )}
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>Linked Controls</Typography>
                <Typography variant="body2">{detail.linkedControlIds?.length > 0 ? `Control IDs: ${detail.linkedControlIds.join(', ')}` : 'None linked'}</Typography>
              </Grid>
            </Grid>
          </Box>
        </Card>

        {detail.obligations?.length > 0 && (
          <Card sx={{ mb: 3 }}>
            <Box sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Extracted Obligations ({detail.obligations.length})</Typography>
              <TableContainer component={Paper} elevation={0}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>#</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Section</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Effective</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {detail.obligations.map(o => (
                      <TableRow key={o.obligationId}>
                        <TableCell>{o.obligationNumber}</TableCell>
                        <TableCell>{o.description}</TableCell>
                        <TableCell>{o.sectionReference || '-'}</TableCell>
                        <TableCell><Chip size="small" label={o.obligationType || '-'} variant="outlined" /></TableCell>
                        <TableCell>{o.effectiveDate ? new Date(o.effectiveDate).toLocaleDateString() : '-'}</TableCell>
                        <TableCell><Chip size="small" label={o.status || 'active'} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Card>
        )}

        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button variant="contained" startIcon={<Edit />} onClick={openEdit}>Edit Classification</Button>
          <Button variant="outlined" startIcon={<History />} onClick={() => openHistory(detail.instrumentId)}>View History</Button>
          {detail.pdfUrl && (
            <Button variant="outlined" href={detail.pdfUrl} target="_blank" startIcon={<Visibility />}>View PDF</Button>
          )}
        </Box>

        {/* History Dialog */}
        <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Classification History</DialogTitle>
          <DialogContent>
            {historyLoading ? <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>
            : historyItems.length === 0 ? <Typography variant="body2" color="text.secondary">No history recorded.</Typography>
            : historyItems.map((h, i) => (
              <Box key={i} sx={{ mb: 2, p: 2, bgcolor: '#F7FAFC', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">Version {h.classificationVersion} — {h.changedAt ? new Date(h.changedAt).toLocaleString() : '-'} — User #{h.changedByUserId}</Typography>
                {h.applicability && <Typography variant="body2">Applicability: {h.applicability}</Typography>}
                {h.tenantRiskRating && <Typography variant="body2">Risk: {h.tenantRiskRating}</Typography>}
                {h.hasGap != null && <Typography variant="body2">Has gap: {h.hasGap ? 'Yes' : 'No'}</Typography>}
                {h.changeReason && <Typography variant="body2" sx={{ fontStyle: 'italic' }}>Reason: {h.changeReason}</Typography>}
              </Box>
            ))}
          </DialogContent>
          <DialogActions><Button onClick={() => setHistoryOpen(false)}>Close</Button></DialogActions>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Edit Classification</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={6}>
                <TextField fullWidth label="Compliance Owner" size="small" value={editData.assignedOwnerName || ''}
                  onChange={e => setEditData({...editData, assignedOwnerName: e.target.value})} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth label="Department" size="small" value={editData.assignedDepartment || ''}
                  onChange={e => setEditData({...editData, assignedDepartment: e.target.value})} />
              </Grid>
              <Grid item xs={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Risk Rating</InputLabel>
                  <Select value={editData.tenantRiskRating || ''} label="Risk Rating"
                    onChange={e => setEditData({...editData, tenantRiskRating: e.target.value})}>
                    <MenuItem value=""><em>None</em></MenuItem>
                    {RISK_OPTIONS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Impact</InputLabel>
                  <Select value={editData.impactRating || ''} label="Impact"
                    onChange={e => setEditData({...editData, impactRating: e.target.value})}>
                    <MenuItem value=""><em>None</em></MenuItem>
                    {['Critical','High','Medium','Low'].map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Likelihood</InputLabel>
                  <Select value={editData.likelihoodRating || ''} label="Likelihood"
                    onChange={e => setEditData({...editData, likelihoodRating: e.target.value})}>
                    <MenuItem value=""><em>None</em></MenuItem>
                    {['Almost Certain','Likely','Possible','Unlikely','Rare'].map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Risk Justification" multiline rows={2} size="small"
                  value={editData.riskJustification || ''}
                  onChange={e => setEditData({...editData, riskJustification: e.target.value})} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Applicability Reasoning" multiline rows={2} size="small"
                  value={editData.applicabilityReasoning || ''}
                  onChange={e => setEditData({...editData, applicabilityReasoning: e.target.value})} />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel control={<Checkbox checked={!!editData.hasGap} onChange={e => setEditData({...editData, hasGap: e.target.checked})} />}
                  label="Has gap (no control covers this obligation)" />
              </Grid>
              {editData.hasGap && (
                <Grid item xs={12}>
                  <TextField fullWidth label="Gap Description" multiline rows={2} size="small"
                    value={editData.gapDescription || ''}
                    onChange={e => setEditData({...editData, gapDescription: e.target.value})} />
                </Grid>
              )}
              <Grid item xs={12}>
                <TextField fullWidth label="Reason for update" size="small" required
                  value={editData.changeReason || ''}
                  onChange={e => setEditData({...editData, changeReason: e.target.value})} />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveEdit} disabled={saving || !editData.changeReason}>
              {saving ? <CircularProgress size={20} /> : 'Save Changes'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  // --- List view ---
  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 0.5 }}>Obligations Register</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {total} active obligation{total !== 1 ? 's' : ''}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <TextField size="small" fullWidth label="Search obligations..." value="" onChange={() => {}}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 20, color: '#CBD5E0' }} /></InputAdornment> }} />
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Risk</InputLabel>
              <Select value={tenantRiskRating} label="Risk" onChange={e => { setTenantRiskRating(e.target.value); setPage(0); }}>
                <MenuItem value="">All</MenuItem>
                {RISK_OPTIONS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select value={status} label="Status" onChange={e => { setStatus(e.target.value); setPage(0); }}>
                <MenuItem value="">All</MenuItem>
                {STATUS_OPTIONS.map(s => <MenuItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Applicability</InputLabel>
              <Select value={applicability} label="Applicability" onChange={e => { setApplicability(e.target.value); setPage(0); }}>
                <MenuItem value="">All</MenuItem>
                <MenuItem value="applicable">Applicable</MenuItem>
                <MenuItem value="not_applicable">Not Applicable</MenuItem>
                <MenuItem value="under_review">Under Review</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <FormControlLabel control={<Checkbox checked={hasGap} onChange={e => { setHasGap(e.target.checked); setPage(0); }} />}
              label={<Typography variant="body2">Has gap</Typography>} sx={{ ml: 1 }} />
          </Grid>
          <Grid item xs={12} sm={3} md={1}>
            <Tooltip title="Refresh"><IconButton onClick={loadList}><Refresh /></IconButton></Tooltip>
          </Grid>
        </Grid>
      </Paper>

      {/* Table */}
      <Card>
        <TableContainer component={Paper} elevation={0}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Obligation</TableCell>
                <TableCell>Regulator</TableCell>
                <TableCell>Risk</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}><CircularProgress size={24} /></TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>No obligations found.</TableCell></TableRow>
              ) : items.map((i, idx) => (
                <TableRow key={i.instrumentId} hover sx={{ cursor: 'pointer' }} onClick={() => openDetail(i.instrumentId)}>
                  <TableCell sx={{ color: 'text.secondary' }}>{total - (page * rowsPerPage) - idx}</TableCell>
                  <TableCell sx={{ fontWeight: 500 }}>
                    {i.sourceTitle}
                    {i.obligationDescription && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{i.obligationDescription}</Typography>}
                  </TableCell>
                  <TableCell>{i.regulatorAbbreviation || '-'}</TableCell>
                  <TableCell>
                    {i.inherentRiskRating ? (
                      <Chip size="small" label={i.inherentRiskRating} color={rc(i.inherentRiskRating)} />
                    ) : i.tenantRiskRating ? (
                      <Chip size="small" label={i.tenantRiskRating} color={rc(i.tenantRiskRating)} />
                    ) : '-'}
                  </TableCell>
                  <TableCell>{i.assignedOwnerName || '-'}</TableCell>
                  <TableCell>
                    <Chip size="small" label={i.status || 'unknown'}
                      color={i.status === 'active' ? 'success' : i.status === 'classified' ? 'info' : 'default'} />
                    {i.hasGap && <Chip size="small" label="Gap" color="warning" sx={{ ml: 0.5 }} />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage} onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[10, 20, 50]} />
      </Card>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {snack ? <Alert severity={snack.severity} onClose={() => setSnack(null)}>{snack.message}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}
