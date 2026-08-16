import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Typography, Button, TextField, MenuItem, FormControl, FormControlLabel,
  Alert, CircularProgress, Collapse, Paper, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Checkbox,
  IconButton, Snackbar, Tooltip, Chip,
} from '@mui/material';
import {
  KeyboardArrowDown, KeyboardArrowUp, ArrowBack, CheckCircle, Download, Visibility,
  Add, Delete, Save, Close,
} from '@mui/icons-material';
import { api, API_BASE, getToken } from '../services/api';
import OwnerPicker from '../components/org/OwnerPicker';

const OBLIGATION_TYPES = [
  'reporting', 'disclosure', 'compliance', 'record_keeping',
  'notification', 'approval', 'audit', 'other',
];

const AREAS_OF_FOCUS = [
  'AML/CFT', 'Corporate Governance', 'Conduct Risk', 'Data Protection',
  'Consumer Protection', 'Cybersecurity', 'Anti-Bribery & Corruption',
  'Capital Market', 'Compliance Risk Management', 'ESG', 'Account Management',
  'Cash Management', 'Financial Reporting',
];

const DEADLINE_TYPES = [
  'monthly', 'quarterly', 'semi_annually', 'annually',
  'one_time', 'ongoing', 'ad_hoc',
];

const RISK_LEVELS = ['Extreme', 'High', 'Medium', 'Low'];
const APPLICABILITY_OPTIONS = ['applicable', 'not_applicable'];
const IMPACT_RATINGS = ['Critical', 'High', 'Medium', 'Low'];
const LIKELIHOOD_RATINGS = ['Almost Certain', 'Likely', 'Possible', 'Unlikely', 'Rare'];

function ObligationRow({ item, index, onChange, onRemove, owners, onOwnerCreated }) {
  const [open, setOpen] = useState(false);

  function setOwner(idx, id, name, dept) {
    onChange(idx, 'assignedOwnerId', id);
    onChange(idx, 'assignedOwnerName', name || null);
    onChange(idx, 'assignedDepartment', dept || null);
  }
  return (
    <>
      <TableRow hover>
        <TableCell sx={{ width: 32 }}>
          <IconButton size="small" onClick={() => setOpen(!open)}>
            {open ? <KeyboardArrowUp fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell sx={{ width: 40, color: 'text.secondary' }}>{index + 1}</TableCell>
        <TableCell>
          <TextField fullWidth size="small" value={item.description || ''}
            onChange={e => onChange(index, 'description', e.target.value)} />
        </TableCell>
        <TableCell sx={{ width: 110 }}>
          <TextField fullWidth size="small" value={item.sectionReference || ''}
            onChange={e => onChange(index, 'sectionReference', e.target.value)} />
        </TableCell>
        <TableCell sx={{ width: 130 }}>
          <FormControl fullWidth size="small">
            <TextField select size="small" value={item.obligationType || 'other'}
              onChange={e => onChange(index, 'obligationType', e.target.value)}>
              {OBLIGATION_TYPES.map(t => <MenuItem key={t} value={t}>{t.replace(/_/g, ' ')}</MenuItem>)}
            </TextField>
          </FormControl>
        </TableCell>
        <TableCell sx={{ width: 110 }}>
          <FormControl fullWidth size="small">
            <TextField select size="small" value={item.recurringDeadlineType || 'ongoing'}
              onChange={e => onChange(index, 'recurringDeadlineType', e.target.value)}>
              {DEADLINE_TYPES.map(t => <MenuItem key={t} value={t}>{t.replace(/_/g, ' ')}</MenuItem>)}
            </TextField>
          </FormControl>
        </TableCell>
        <TableCell sx={{ width: 50, textAlign: 'center' }}>
          <Tooltip title="Include this obligation in the register">
            <Checkbox checked={item.applicable !== false}
              onChange={e => onChange(index, 'applicable', e.target.checked)} size="small" />
          </Tooltip>
        </TableCell>
        <TableCell sx={{ width: 40, textAlign: 'center' }}>
          <IconButton size="small" color="error" onClick={() => onRemove(index)}><Delete fontSize="small" /></IconButton>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={8} sx={{ p: 0, border: 0 }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ p: 2, bgcolor: '#F7FAFC' }}>
              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Obligation Details</Typography>
                <TextField fullWidth multiline rows={2} size="small" label="Obligation description"
                  value={item.description || ''}
                  onChange={e => onChange(index, 'description', e.target.value)} />
                <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                  <TextField size="small" label="Section Reference"
                    value={item.sectionReference || ''}
                    onChange={e => onChange(index, 'sectionReference', e.target.value)} sx={{ flex: 1 }} />
                  <TextField select fullWidth size="small" label="Area of Focus"
                    value={item.areaOfFocus || ''}
                    onChange={e => onChange(index, 'areaOfFocus', e.target.value)} sx={{ width: 220 }}>
                    <MenuItem value=""><em>None</em></MenuItem>
                    {AREAS_OF_FOCUS.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                  </TextField>
                </Box>
              </Paper>

              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Classification</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 2, mb: 2 }}>
                  <TextField select fullWidth size="small" label="Applicability" value={item.applicability || 'applicable'}
                    onChange={e => onChange(index, 'applicability', e.target.value)}>
                    {APPLICABILITY_OPTIONS.map(o => <MenuItem key={o} value={o}>{o.replace(/_/g, ' ')}</MenuItem>)}
                  </TextField>
                  <TextField select fullWidth size="small" label="Risk Rating" value={item.tenantRiskRating || ''}
                    onChange={e => onChange(index, 'tenantRiskRating', e.target.value)}>
                    <MenuItem value=""><em>None</em></MenuItem>
                    {RISK_LEVELS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                  </TextField>
                  <TextField select fullWidth size="small" label="Impact" value={item.impactRating || ''}
                    onChange={e => onChange(index, 'impactRating', e.target.value)}>
                    <MenuItem value=""><em>None</em></MenuItem>
                    {IMPACT_RATINGS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                  </TextField>
                  <TextField select fullWidth size="small" label="Likelihood" value={item.likelihoodRating || ''}
                    onChange={e => onChange(index, 'likelihoodRating', e.target.value)}>
                    <MenuItem value=""><em>None</em></MenuItem>
                    {LIKELIHOOD_RATINGS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                  </TextField>
                  <OwnerPicker value={item.assignedOwnerId} label="Compliance Owner"
                    onOwnerCreated={(owner) => { setOwner(index, owner.ownerId, owner.fullName, owner.departmentName); onOwnerCreated?.(owner); }}
                    onChange={id => { const o = owners.find(x => x.ownerId === id); setOwner(index, id, o?.fullName, o?.departmentName); }} />
                  <TextField fullWidth size="small" label="Department" value={item.assignedDepartment || ''} disabled />
                </Box>
                <TextField fullWidth multiline rows={2} size="small" label="Applicability reasoning / risk justification"
                  value={item.applicabilityReasoning || ''}
                  onChange={e => onChange(index, 'applicabilityReasoning', e.target.value)} />
                <Box sx={{ mt: 1 }}>
                  <FormControlLabel control={
                    <Checkbox size="small" checked={!!item.hasGap}
                      onChange={e => onChange(index, 'hasGap', e.target.checked)} />
                  } label={<Typography variant="body2">Has gap (no control covers this obligation)</Typography>} />
                  {item.hasGap && (
                    <TextField fullWidth multiline rows={2} size="small" label="Gap description"
                      value={item.gapDescription || ''} sx={{ mt: 1 }}
                      onChange={e => onChange(index, 'gapDescription', e.target.value)} />
                  )}
                </Box>
              </Paper>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default function ReviewEditPage() {
  const { reviewId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [obligations, setObligations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ocrOpen, setOcrOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [snack, setSnack] = useState(null);

  const [changeReason, setChangeReason] = useState('');
  const [owners, setOwners] = useState([]);

  const notify = (severity, message) => setSnack({ severity, message });

  useEffect(() => {
    api.org.owners().then(setOwners).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    api.review.get(reviewId)
      .then(res => {
        setData(res);
        setObligations((res.obligations || []).map(o => ({
          ...o,
          applicable: o.applicable !== false,
          applicability: 'applicable',
          applicabilityReasoning: '',
          tenantRiskRating: '',
          riskJustification: '',
          impactRating: '',
          likelihoodRating: '',
          assignedOwnerId: null,
          assignedOwnerName: '',
          assignedDepartment: '',
          hasGap: false,
          gapDescription: '',
        })));
      })
      .catch(err => setError(err.message || 'Failed to load review.'))
      .finally(() => setLoading(false));
  }, [reviewId]);

  function handleOwnerCreated(owner) {
    setOwners(prev => prev.some(o => o.ownerId === owner.ownerId) ? prev : [...prev, owner]);
  }

  function handleChange(idx, field, value) {
    setObligations(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }

  function handleRemove(idx) {
    setObligations(prev => prev.filter((_, i) => i !== idx));
  }

  function handleAdd() {
    setObligations(prev => [...prev, {
      obligationNumber: prev.length + 1,
      description: '',
      sectionReference: '',
      areaOfFocus: '',
      obligationType: 'other',
      recurringDeadlineType: 'ongoing',
      applicable: true,
      applicability: 'applicable',
      applicabilityReasoning: '',
      tenantRiskRating: '',
      riskJustification: '',
      impactRating: '',
      likelihoodRating: '',
      assignedOwnerId: null,
      assignedOwnerName: '',
      assignedDepartment: '',
      hasGap: false,
      gapDescription: '',
    }]);
  }

  function pdfEndpoint() {
    return data?.instrumentId
      ? `${API_BASE}/subscriptions/instruments/${data.instrumentId}/pdf`
      : null;
  }

  async function fetchPdfBlob(url) {
    const token = getToken();
    const res = await fetch(url, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('PDF load failed');
    return await res.blob();
  }

  async function handleViewInstrument() {
    const url = pdfEndpoint();
    if (!url) { notify('warning', 'No PDF available for this document yet.'); return; }
    try {
      const blob = await fetchPdfBlob(url);
      window.open(URL.createObjectURL(blob), '_blank');
    } catch { notify('error', 'Failed to load PDF.'); }
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const payload = {
        changeReason: changeReason || undefined,
        obligations: obligations.map((o, i) => ({
          obligationNumber: o.obligationNumber ?? i + 1,
          description: o.description,
          sectionReference: o.sectionReference,
          areaOfFocus: o.areaOfFocus || undefined,
          obligationType: o.obligationType,
          recurringDeadlineType: o.recurringDeadlineType,
          applicable: o.applicable !== false,
          applicability: o.applicability,
          applicabilityReasoning: o.applicabilityReasoning || undefined,
          tenantRiskRating: o.tenantRiskRating || undefined,
          riskJustification: o.riskJustification || undefined,
          impactRating: o.impactRating || undefined,
          likelihoodRating: o.likelihoodRating || undefined,
          assignedOwnerId: o.assignedOwnerId ?? undefined,
          assignedOwnerName: o.assignedOwnerName || undefined,
          assignedDepartment: o.assignedDepartment || undefined,
          hasGap: o.hasGap,
          gapDescription: o.gapDescription || undefined,
        })),
      };
      await api.review.save(reviewId, payload);
      notify('success', 'Saved to Obligation Register.');
      setTimeout(() => navigate('/review'), 1200);
    } catch (err) {
      notify('error', err.message || 'Failed to save.');
    } finally { setSaving(false); }
  }

  async function handleSkip() {
    setSkipping(true);
    setError('');
    try {
      await api.review.skip(reviewId);
      notify('success', 'Review skipped.');
      setTimeout(() => navigate('/review'), 1000);
    } catch (err) {
      notify('error', err.message || 'Failed to skip.');
    } finally { setSkipping(false); }
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  if (!data) return <Box sx={{ p: 3 }}><Alert severity="error">{error || 'Not found'}</Alert></Box>;

  const applicableCount = obligations.filter(o => o.applicable !== false).length;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton onClick={() => navigate('/review')}><ArrowBack /></IconButton>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {data.regulatorName || data.regulatorAbbreviation || 'Unknown regulator'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Review document — edit obligations and classify before saving to the register
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" size="medium" onClick={handleViewInstrument} startIcon={<Visibility />}
          sx={{ height: 40, bgcolor: '#616161', color: '#fff', '&:hover': { bgcolor: '#424242' } }}>View PDF</Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* Metadata */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Chip label={data.source === 'intel' ? 'Intel' : 'Upload'} color={data.source === 'intel' ? 'default' : 'info'} size="small" />
          <Chip size="small" label={data.documentType || 'Document'} variant="outlined" />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Received {new Date(data.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </Typography>
        </Box>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>{data.sourceTitle || 'Untitled document'}</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 2 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">Regulator</Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>{data.regulatorName || data.regulatorAbbreviation || '-'}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Risk Rating</Typography>
            <Typography variant="body2">{data.riskRating || '-'}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Document Type</Typography>
            <Typography variant="body2">{data.documentType || '-'}</Typography>
          </Box>
          {data.dateIssued && (
            <Box>
              <Typography variant="caption" color="text.secondary">Date Issued</Typography>
              <Typography variant="body2">{data.dateIssued}</Typography>
            </Box>
          )}
          {data.effectiveDate && (
            <Box>
              <Typography variant="caption" color="text.secondary">Effective Date</Typography>
              <Typography variant="body2">{data.effectiveDate}</Typography>
            </Box>
          )}
          {data.publishedAt && (
            <Box>
              <Typography variant="caption" color="text.secondary">Published</Typography>
              <Typography variant="body2">{data.publishedAt}</Typography>
            </Box>
          )}
        </Box>
      </Paper>

      {/* AI Summary */}
      {data.aiSummary && (
        <Paper sx={{ p: 3, mb: 2, borderLeft: '4px solid', borderColor: 'primary.main', bgcolor: '#F8FAFF' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>AI Summary</Typography>
          <Typography variant="body1" sx={{ lineHeight: 1.8, color: 'text.primary' }}>{data.aiSummary}</Typography>
        </Paper>
      )}

      {/* OCR */}
      {data.pdfOcrText && (
        <Paper sx={{ mb: 2 }}>
          <Box onClick={() => setOcrOpen(!ocrOpen)}
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              px: 2, py: 1.25, bgcolor: '#F7FAFC', cursor: 'pointer', userSelect: 'none',
              '&:hover': { bgcolor: '#EDF2F7' } }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Extracted Text</Typography>
            {ocrOpen ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
          </Box>
          <Collapse in={ocrOpen}>
            <Box sx={{ p: 2.5, maxHeight: 400, overflow: 'auto', bgcolor: '#FAFBFD', borderTop: '1px solid', borderColor: 'divider' }}>
              <Typography component="pre" sx={{
                m: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                fontFamily: "'Roboto Mono', 'SFMono-Regular', Consolas, monospace",
                fontSize: '0.8rem', lineHeight: 1.7, color: '#334155',
              }}>
                {data.pdfOcrText}
              </Typography>
            </Box>
          </Collapse>
        </Paper>
      )}

      {/* Obligations */}
      <Paper sx={{ mb: 2 }}>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Obligations ({applicableCount} applicable of {obligations.length})
          </Typography>
          <Button size="small" variant="outlined" startIcon={<Add />} onClick={handleAdd}>Add</Button>
        </Box>
        <TableContainer>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', width: 32 }} />
                <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', width: 40 }}>#</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC' }}>Obligation</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', width: 110 }}>Section</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', width: 130 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', width: 110 }}>Deadline</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', width: 50 }}>Apply</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', width: 40 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {obligations.length === 0 ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: '#A0AEC0' }}>No obligations extracted.</TableCell></TableRow>
              ) : (
                obligations.map((o, i) => (
                  <ObligationRow key={o.obligationNumber ?? i} item={o} index={i}
                    onChange={handleChange} onRemove={handleRemove}
                    owners={owners} onOwnerCreated={handleOwnerCreated} />
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Reason for Update</Typography>
        <TextField fullWidth size="small" label="Reason for update (optional)" value={changeReason}
          onChange={e => setChangeReason(e.target.value)} />
      </Paper>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 2 }}>
        <Button variant="contained" color="error" size="medium" onClick={handleSkip} disabled={skipping}
          startIcon={skipping ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <Close />}
          sx={{ height: 40 }}>Not Applicable</Button>
        <Button variant="contained" size="medium" onClick={handleSave} disabled={saving || applicableCount === 0}
          startIcon={saving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <Save />}
          sx={{ height: 40 }}>{saving ? 'Saving...' : 'Save to Register'}</Button>
      </Box>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack?.severity || 'info'} onClose={() => setSnack(null)} variant="filled">{snack?.message}</Alert>
      </Snackbar>
    </Box>
  );
}
