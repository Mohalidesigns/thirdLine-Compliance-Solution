import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, TextField, MenuItem, FormControlLabel,
  Alert, CircularProgress, Collapse, Paper, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Checkbox,
  IconButton, Snackbar, Tooltip, Chip, Skeleton, Autocomplete,
} from '@mui/material';
import {
  KeyboardArrowDown, KeyboardArrowUp, ArrowBack,
  Add, Delete, Save, Close, Gavel,
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

const RISK_LEVELS = ['Critical', 'High', 'Moderate', 'Low'];
const APPLICABILITY_OPTIONS = ['applicable', 'not_applicable'];
const IMPACT_RATINGS = ['Critical', 'High', 'Medium', 'Low'];
const LIKELIHOOD_RATINGS = ['Almost Certain', 'Likely', 'Possible', 'Unlikely', 'Rare'];

const INHERENT_RISK_CONFIG = {
  Critical: { color: 'error', label: 'Critical' },
  High: { color: 'error', label: 'High' },
  Moderate: { color: 'warning', label: 'Moderate' },
  Medium: { color: 'warning', label: 'Moderate' },
  Low: { color: 'success', label: 'Low' },
};

function inherentRiskChip(rating, likelihood, impact) {
  const cfg = INHERENT_RISK_CONFIG[rating];
  if (!cfg) return <Chip size="small" label={rating || 'Unrated'} variant="outlined" sx={{ height: 22, borderRadius: '4px' }} />;
  const tip = likelihood || impact ? `${likelihood || '-'} × ${impact || '-'}` : rating;
  return (
    <Tooltip title={tip}>
      <Chip size="small" label={rating} color={cfg.color} sx={{ height: 22, borderRadius: '4px', fontWeight: 600 }} />
    </Tooltip>
  );
}

function formatNaira(amount) {
  if (amount == null) return '-';
  try {
    const n = Number(amount);
    if (Number.isNaN(n)) return String(amount);
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
  } catch { return String(amount); }
}

function ObligationRow({ item, index, onChange, onRemove, owners, onOwnerCreated, returns: returnsList }) {
  const [open, setOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);

  function setOwner(idx, id, name, dept) {
    onChange(idx, 'assignedOwnerId', id);
    onChange(idx, 'assignedOwnerName', name || null);
    onChange(idx, 'assignedDepartment', dept || null);
  }

  const linkedReturns = (item.linkedReturnIds || [])
    .map(id => returnsList.find(r => r.returnId === id))
    .filter(Boolean);

  const titleText = item.title || '';

  return (
    <>
      <TableRow hover sx={{ '& > td': { py: 1 } }}>
        <TableCell sx={{ width: 40, p: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton size="small" onClick={() => setOpen(!open)}>
              {open ? <KeyboardArrowUp fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
            </IconButton>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontFamily: 'Roboto Mono, monospace' }}>
              {item.obligationNumber ?? index + 1}
            </Typography>
          </Box>
        </TableCell>
        <TableCell sx={{ minWidth: 240 }}>
          {editingTitle ? (
            <TextField fullWidth size="small" placeholder="Title (3-8 words)" autoFocus
              value={titleText}
              onChange={e => onChange(index, 'title', e.target.value)}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={e => { if (e.key === 'Enter') setEditingTitle(false); }}
              slotProps={{ htmlInput: { maxLength: 500 } }}
              sx={{ mb: 0.5, '& .MuiInputBase-root': { fontSize: '0.85rem', fontWeight: 600 } }} />
          ) : titleText ? (
            <Typography
              variant="body2"
              onClick={() => setEditingTitle(true)}
              sx={{ fontWeight: 700, lineHeight: 1.3, cursor: 'text', mb: 0.5,
                minHeight: 24, px: 0.5, py: 0.25, borderRadius: '4px',
                color: 'text.primary',
                '&:hover': { bgcolor: 'action.hover' } }}>
              {titleText}
            </Typography>
          ) : null}
          <TextField fullWidth multiline rows={2} size="small"
            placeholder="Verbatim text from document (exact wording)"
            value={item.description || ''}
            onChange={e => onChange(index, 'description', e.target.value)}
            slotProps={{ htmlInput: { maxLength: 500 } }}
            sx={{ '& .MuiInputBase-root': { fontSize: '0.8rem' } }} />
        </TableCell>
        <TableCell sx={{ minWidth: 200 }}>
          <TextField fullWidth multiline rows={2} size="small"
            placeholder="Plain English interpretation"
            value={item.plainEnglishStatement || ''}
            onChange={e => onChange(index, 'plainEnglishStatement', e.target.value)}
            slotProps={{ htmlInput: { maxLength: 250 } }}
            sx={{ '& .MuiInputBase-root': { fontSize: '0.8rem' } }} />
        </TableCell>
        <TableCell sx={{ width: 100 }}>
          <TextField select fullWidth size="small"
            value={item.inherentRiskRating || 'Moderate'}
            onChange={e => onChange(index, 'inherentRiskRating', e.target.value)}
            sx={{ '& .MuiInputBase-root': { fontSize: '0.78rem' } }}>
            {RISK_LEVELS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </TextField>
        </TableCell>
        <TableCell sx={{ width: 80, textAlign: 'center' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title="Include in register">
              <Checkbox checked={item.applicable !== false}
                onChange={e => onChange(index, 'applicable', e.target.checked)} size="small" />
            </Tooltip>
            <IconButton size="small" color="error" onClick={() => onRemove(index)}>
              <Delete fontSize="small" />
            </IconButton>
          </Box>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={5} sx={{ p: 0, border: 0 }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ p: 2, bgcolor: '#F7FAFC' }}>
              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Details</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                  <TextField fullWidth size="small" label="Section Reference"
                    value={item.sectionReference || ''}
                    onChange={e => onChange(index, 'sectionReference', e.target.value)} />
                  <TextField select fullWidth size="small" label="Area of Focus"
                    value={item.areaOfFocus || ''}
                    onChange={e => onChange(index, 'areaOfFocus', e.target.value)}>
                    <MenuItem value=""><em>None</em></MenuItem>
                    {AREAS_OF_FOCUS.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                  </TextField>
                  <TextField select fullWidth size="small" label="Obligation Type"
                    value={item.obligationType || 'other'}
                    onChange={e => onChange(index, 'obligationType', e.target.value)}>
                    {OBLIGATION_TYPES.map(t => <MenuItem key={t} value={t}>{t.replace(/_/g, ' ')}</MenuItem>)}
                  </TextField>
                  <TextField select fullWidth size="small" label="Deadline"
                    value={item.recurringDeadlineType || 'ongoing'}
                    onChange={e => onChange(index, 'recurringDeadlineType', e.target.value)}>
                    {DEADLINE_TYPES.map(t => <MenuItem key={t} value={t}>{t.replace(/_/g, ' ')}</MenuItem>)}
                  </TextField>
                </Box>
              </Paper>

              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>AI Risk Assessment</Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
                  <Chip size="small" label={`AI Likelihood: ${item.inherentLikelihood || '-'}`} variant="outlined" sx={{ height: 22, borderRadius: '4px' }} />
                  <Chip size="small" label={`AI Impact: ${item.inherentImpact || '-'}`} variant="outlined" sx={{ height: 22, borderRadius: '4px' }} />
                  <Chip size="small" label={`AI Risk: ${item.inherentRiskRating || '-'}`} color={INHERENT_RISK_CONFIG[item.inherentRiskRating]?.color || 'default'} sx={{ height: 22, borderRadius: '4px' }} />
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2, mb: 2 }}>
                  <TextField select fullWidth size="small" label="Inherent Likelihood (AI)"
                    value={item.inherentLikelihood || 'Possible'}
                    onChange={e => onChange(index, 'inherentLikelihood', e.target.value)}>
                    {LIKELIHOOD_RATINGS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                  </TextField>
                  <TextField select fullWidth size="small" label="Inherent Impact (AI)"
                    value={item.inherentImpact || 'Medium'}
                    onChange={e => onChange(index, 'inherentImpact', e.target.value)}>
                    {IMPACT_RATINGS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                  </TextField>
                  <TextField select fullWidth size="small" label="Inherent Risk (AI)"
                    value={item.inherentRiskRating || 'Moderate'}
                    onChange={e => onChange(index, 'inherentRiskRating', e.target.value)}>
                    {RISK_LEVELS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                  </TextField>
                </Box>
                <TextField fullWidth multiline rows={2} size="small" label="Risk Description"
                  placeholder="Why this risk rating applies"
                  value={item.riskDescription || ''}
                  onChange={e => onChange(index, 'riskDescription', e.target.value)} />
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mt: 2 }}>
                  <TextField fullWidth size="small" label="Control Owner"
                    placeholder="e.g. Head Compliance"
                    value={item.controlOwner || ''}
                    onChange={e => onChange(index, 'controlOwner', e.target.value)}
                    helperText="Free text or pick: CCO, CRO, CFO, Head Compliance..." />
                  <TextField fullWidth size="small" label="Act Name"
                    placeholder="e.g. BOFIA 2020"
                    value={item.actName || ''}
                    onChange={e => onChange(index, 'actName', e.target.value)} />
                </Box>
                {item.regulationId != null && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Regulation ID: {item.regulationId}
                  </Typography>
                )}
              </Paper>

              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Classification (tenant overrides)</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 2, mb: 2 }}>
                  <TextField select fullWidth size="small" label="Applicability" value={item.applicability || 'applicable'}
                    onChange={e => onChange(index, 'applicability', e.target.value)}>
                    {APPLICABILITY_OPTIONS.map(o => <MenuItem key={o} value={o}>{o.replace(/_/g, ' ')}</MenuItem>)}
                  </TextField>
                  <TextField select fullWidth size="small" label="Risk Rating" value={item.tenantRiskRating || ''}
                    onChange={e => onChange(index, 'tenantRiskRating', e.target.value)}>
                    <MenuItem value=""><em>None (use AI)</em></MenuItem>
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

              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Linked Regulatory Returns</Typography>
                <Autocomplete multiple
                  options={returnsList}
                  value={linkedReturns}
                  getOptionLabel={opt => opt.title || `Return #${opt.returnId}`}
                  isOptionEqualToValue={(opt, val) => opt.returnId === val.returnId}
                  onChange={(_, newValue) => {
                    onChange(index, 'linkedReturnIds', newValue.map(v => v.returnId));
                  }}
                  renderTags={(value, getTagProps) =>
                    value.map((option, i) => {
                      const { key, ...tagProps } = getTagProps({ index });
                      return (
                        <Chip key={option.returnId} label={option.title || `Return #${option.returnId}`}
                          size="small" {...tagProps}
                          sx={{ height: 22, borderRadius: '4px' }} />
                      );
                    })
                  }
                  renderOption={(props, option) => (
                    <li {...props} key={option.returnId}>
                      <Box>
                        <Typography variant="body2">{option.title || `Return #${option.returnId}`}</Typography>
                        <Typography variant="caption" color="text.secondary">{option.frequency || '-'}</Typography>
                      </Box>
                    </li>
                  )}
                  renderInput={params => (
                    <TextField {...params} size="small" placeholder="Link regulatory returns..." />
                  )}
                  slotProps={{ paper: { sx: { maxHeight: 240 } } }}
                  sx={{ '& .MuiAutocomplete-tag': { m: 0.25 } }} />
                {linkedReturns.length === 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    No linked returns
                  </Typography>
                )}
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
  const queryClient = useQueryClient();

  const [obligations, setObligations] = useState([]);
  const [sanctionsOpen, setSanctionsOpen] = useState(true);
  const [snack, setSnack] = useState(null);
  const [changeReason, setChangeReason] = useState('');

  const notify = (severity, message) => setSnack({ severity, message });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['review', reviewId],
    queryFn: ({ signal }) => api.review.get(reviewId, { signal }),
    enabled: !!reviewId,
  });

  const ownersQuery = useQuery({
    queryKey: ['owners'],
    queryFn: ({ signal }) => api.org.owners({}, { signal }),
  });
  const owners = Array.isArray(ownersQuery.data) ? ownersQuery.data : [];

  const returnsQuery = useQuery({
    queryKey: ['returns-list'],
    queryFn: ({ signal }) => api.returns.list({ signal }),
  });
  const returnsList = Array.isArray(returnsQuery.data) ? returnsQuery.data : [];

  useEffect(() => {
    if (data) {
      setObligations((data.obligations || []).map(o => ({
        obligationNumber: o.obligationNumber,
        title: o.title ?? '',
        description: o.description ?? '',
        plainEnglishStatement: o.plainEnglishStatement ?? o.description ?? '',
        sectionReference: o.sectionReference ?? '',
        areaOfFocus: o.areaOfFocus ?? '',
        obligationType: o.obligationType ?? 'other',
        recurringDeadlineType: o.recurringDeadlineType ?? 'ongoing',
        riskDescription: o.riskDescription ?? '',
        inherentLikelihood: o.inherentLikelihood ?? 'Possible',
        inherentImpact: o.inherentImpact ?? 'Medium',
        inherentRiskRating: o.inherentRiskRating ?? 'Moderate',
        controlOwner: o.controlOwner ?? '',
        regulationId: o.regulationId ?? null,
        actName: o.actName ?? '',
        applicable: o.applicable !== false,
        applicability: o.applicability ?? 'applicable',
        applicabilityReasoning: o.applicabilityReasoning ?? '',
        tenantRiskRating: o.tenantRiskRating ?? '',
        riskJustification: o.riskJustification ?? '',
        impactRating: o.impactRating ?? '',
        likelihoodRating: o.likelihoodRating ?? '',
        assignedOwnerId: o.assignedOwnerId ?? null,
        assignedOwnerName: o.assignedOwnerName ?? '',
        assignedDepartment: o.assignedDepartment ?? '',
        hasGap: !!o.hasGap,
        gapDescription: o.gapDescription ?? '',
        linkedReturnIds: o.linkedReturnIds ?? [],
      })));
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (payload) => api.review.save(reviewId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review'] });
      notify('success', 'Saved to Obligation Register.');
      setTimeout(() => navigate('/review'), 1200);
    },
    onError: (err) => notify('error', err.message || 'Failed to save.'),
  });

  const skipMutation = useMutation({
    mutationFn: () => api.review.skip(reviewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review'] });
      notify('success', 'Review skipped.');
      setTimeout(() => navigate('/review'), 1000);
    },
    onError: (err) => notify('error', err.message || 'Failed to skip.'),
  });

  function handleOwnerCreated(owner) {
    queryClient.setQueryData(['owners'], (prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      return arr.some(o => o.ownerId === owner.ownerId) ? arr : [...arr, owner];
    });
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
      title: '',
      description: '',
      plainEnglishStatement: '',
      sectionReference: '',
      areaOfFocus: '',
      obligationType: 'other',
      recurringDeadlineType: 'ongoing',
      riskDescription: '',
      inherentLikelihood: 'Possible',
      inherentImpact: 'Medium',
      inherentRiskRating: 'Moderate',
      controlOwner: '',
      regulationId: null,
      actName: '',
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
      linkedReturnIds: [],
    }]);
  }

  function pdfEndpoint() {
    return data?.instrumentId
      ? `${API_BASE}/subscriptions/instruments/${data.instrumentId}/pdf`
      : null;
  }

  async function handleViewInstrument() {
    const url = pdfEndpoint();
    if (!url) { notify('warning', 'No PDF available for this document yet.'); return; }
    try {
      const token = getToken();
      const res = await fetch(url, {
        signal: AbortSignal.timeout(30000),
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('PDF load failed');
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), '_blank');
    } catch { notify('error', 'Failed to load PDF.'); }
  }

  function handleSave() {
    const payload = {
      changeReason: changeReason || undefined,
      obligations: obligations.map((o, i) => ({
        obligationNumber: o.obligationNumber ?? i + 1,
        title: (o.title || '').trim().slice(0, 500) || undefined,
        description: (o.description || '').trim().slice(0, 500) || undefined,
        plainEnglishStatement: (o.plainEnglishStatement || '').trim().slice(0, 250) || undefined,
        sectionReference: o.sectionReference || undefined,
        areaOfFocus: o.areaOfFocus || undefined,
        obligationType: o.obligationType,
        recurringDeadlineType: o.recurringDeadlineType,
        riskDescription: o.riskDescription || undefined,
        inherentLikelihood: o.inherentLikelihood || undefined,
        inherentImpact: o.inherentImpact || undefined,
        inherentRiskRating: o.inherentRiskRating || undefined,
        controlOwner: (o.controlOwner || '').trim().slice(0, 500) || undefined,
        regulationId: o.regulationId ?? undefined,
        actName: (o.actName || '').trim().slice(0, 500) || undefined,
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
        linkedReturnIds: o.linkedReturnIds?.length ? o.linkedReturnIds : undefined,
      })),
    };
    saveMutation.mutate(payload);
  }

  function handleSkip() {
    skipMutation.mutate();
  }

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="rectangular" height={48} sx={{ mb: 2, borderRadius: 1 }} />
        <Skeleton variant="rectangular" height={120} sx={{ mb: 2, borderRadius: 1 }} />
        <Skeleton variant="rectangular" height={300} sx={{ mb: 2, borderRadius: 1 }} />
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>
      </Box>
    );
  }
  if (isError) {
    return <Box sx={{ p: 3 }}><Alert severity="error">{error?.message || 'Failed to load review.'}</Alert></Box>;
  }
  if (!data) return <Box sx={{ p: 3 }}><Alert severity="error">Not found</Alert></Box>;

  const applicableCount = obligations.filter(o => o.applicable !== false).length;
  const sanctions = Array.isArray(data.sanctions) ? data.sanctions : [];
  const headerActNames = [...new Set([...obligations.map(o => o.actName).filter(Boolean), ...sanctions.map(s => s.actName).filter(Boolean)])].slice(0, 3);
  const isReReview = data.status && data.status !== 'pending';

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <IconButton onClick={() => navigate('/review')}><ArrowBack /></IconButton>
        <Box sx={{ flex: 1, minWidth: 220 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {data.regulatorName || data.regulatorAbbreviation || 'Unknown regulator'}
            {data.regulatorAbbreviation && data.regulatorName && data.regulatorAbbreviation !== data.regulatorName && (
              <Chip size="small" label={data.regulatorAbbreviation} sx={{ height: 22, borderRadius: '4px', bgcolor: '#1A365D', color: '#fff', fontWeight: 600 }} />
            )}
            {isReReview && (
              <Chip size="small" label={`Re-review (previously ${data.status})`} color="warning"
                sx={{ height: 22, borderRadius: '4px' }} />
            )}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Review document — edit obligations and classify before saving to the register
          </Typography>
        </Box>
        <Button variant="contained" size="medium" onClick={handleViewInstrument}
          sx={{ height: 40, bgcolor: '#616161', color: '#fff', '&:hover': { bgcolor: '#424242' } }}>View PDF</Button>
      </Box>

      {(isError || saveMutation.isError || skipMutation.isError) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error?.message || saveMutation.error?.message || skipMutation.error?.message}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
          <Chip label={data.source === 'intel' ? 'Intel' : data.source === 'upload' ? 'Upload' : data.source} color={data.source === 'intel' ? 'default' : 'info'} size="small" sx={{ borderRadius: '4px' }} />
          {data.documentType && <Chip size="small" label={data.documentType} variant="outlined" sx={{ borderRadius: '4px' }} />}
          {data.riskRating && (
            <Chip size="small" label={data.riskRating} color={INHERENT_RISK_CONFIG[data.riskRating]?.color || 'default'} sx={{ height: 22, borderRadius: '4px', fontWeight: 600 }} />
          )}
          {headerActNames.map(a => (
            <Chip key={a} size="small" variant="outlined" label={a} sx={{ height: 22, borderRadius: '4px' }} />
          ))}
          <Typography variant="caption" sx={{ color: 'text.secondary', ml: 1 }}>
            Received {new Date(data.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </Typography>
        </Box>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 1.5 }}>{data.sourceTitle || 'Untitled document'}</Typography>
        {data.sourceReferenceNumber && (
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mb: 2, px: 1, py: 0.5, bgcolor: '#F7FAFC', border: '1px solid #E2E8F0', borderRadius: '6px' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Ref No</Typography>
            <Typography variant="body2" sx={{ fontFamily: "'Roboto Mono', monospace", fontWeight: 600 }}>{data.sourceReferenceNumber}</Typography>
          </Box>
        )}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 2 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">Regulator</Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>{data.regulatorName || data.regulatorAbbreviation || '-'}</Typography>
            {data.regulatorAbbreviation && data.regulatorName && data.regulatorAbbreviation !== data.regulatorName && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>{data.regulatorAbbreviation}</Typography>
            )}
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Risk Rating</Typography>
            <Typography variant="body2">{data.riskRating || '-'}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Document Type</Typography>
            <Typography variant="body2">{data.documentType || '-'}</Typography>
          </Box>
          {headerActNames.length > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary">Act Name</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>{headerActNames.join(', ')}</Typography>
            </Box>
          )}
          {data.dateIssued && (
            <Box>
              <Typography variant="caption" color="text.secondary">Date Issued</Typography>
              <Typography variant="body2">{data.dateIssued}</Typography>
            </Box>
          )}
          {data.dateCommencement && (
            <Box>
              <Typography variant="caption" color="text.secondary">Commencement</Typography>
              <Typography variant="body2">{data.dateCommencement}</Typography>
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
          {data.nature && (
            <Box>
              <Typography variant="caption" color="text.secondary">Nature</Typography>
              <Typography variant="body2">{data.nature}</Typography>
            </Box>
          )}
        </Box>
      </Paper>

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
                <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', width: 40 }}>#</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', minWidth: 240 }}>Obligation</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', minWidth: 200 }}>Interpreted</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', width: 100 }}>Risk</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', width: 80 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {obligations.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: '#A0AEC0' }}>No obligations extracted.</TableCell></TableRow>
              ) : (
                obligations.map((o, i) => (
                  <ObligationRow key={o.obligationNumber ?? i} item={o} index={i}
                    onChange={handleChange} onRemove={handleRemove}
                    owners={owners} onOwnerCreated={handleOwnerCreated}
                    returns={returnsList} />
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Paper sx={{ mb: 2 }}>
        <Box onClick={() => setSanctionsOpen(!sanctionsOpen)}
          sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            px: 2, py: 1.25, bgcolor: sanctions.length > 0 ? '#FFF5F5' : '#F7FAFC', cursor: 'pointer', userSelect: 'none',
            borderBottom: sanctionsOpen ? '1px solid' : 'none', borderColor: 'divider',
            '&:hover': { bgcolor: sanctions.length > 0 ? '#FFF0F0' : '#EDF2F7' } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Gavel sx={{ fontSize: 18, color: sanctions.length > 0 ? '#E53E3E' : '#A0AEC0' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Sanctions {sanctions.length > 0 ? `(${sanctions.length})` : ''}
            </Typography>
            {sanctions.length > 0 && <Chip size="small" color="error" label={`${sanctions.length} sanction${sanctions.length !== 1 ? 's' : ''}`} sx={{ height: 20, borderRadius: '4px' }} />}
          </Box>
          {sanctionsOpen ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
        </Box>
        <Collapse in={sanctionsOpen}>
          {sanctions.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
              <Typography variant="body2" sx={{ color: '#A0AEC0' }}>No sanctions extracted</Typography>
              <Typography variant="caption" color="text.secondary">If the instrument contained penalties, they will appear here after harmonization.</Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC' }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', minWidth: 160 }}>Penalty</TableCell>
                    <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', width: 110 }}>Section</TableCell>
                    <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', minWidth: 140 }}>Liable Roles</TableCell>
                    <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', width: 100 }}>Risk</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sanctions.map((s, idx) => (
                    <TableRow key={idx} hover>
                      <TableCell>
                        <Chip size="small" label={s.sanctionType || 'sanction'} variant="outlined" sx={{ height: 22, borderRadius: '4px', textTransform: 'capitalize' }} />
                        {s.actName && (
                          <Chip size="small" variant="outlined" label={s.actName.slice(0, 18)} sx={{ ml: 0.5, height: 20, borderRadius: '4px', fontSize: '0.65rem' }} />
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: s.amountNaira ? 'Roboto Mono, monospace' : 'inherit', fontSize: s.amountNaira ? '0.82rem' : '0.85rem' }}>
                          {s.amountNaira != null ? formatNaira(s.amountNaira) : (s.penaltyDetails ? s.penaltyDetails.slice(0, 80) : '-')}
                          {s.sanctionAmountPerDay ? ' /day' : ''}
                        </Typography>
                        {s.penaltyDetails && s.amountNaira != null && (
                          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.penaltyDetails.slice(0, 100)}</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {s.sourceSectionReference ? (
                          <Typography variant="body2" sx={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.78rem' }}>{s.sourceSectionReference}</Typography>
                        ) : (
                          <Typography variant="caption" color="text.secondary">-</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {Array.isArray(s.liableRoles) && s.liableRoles.length > 0 ? (
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {s.liableRoles.slice(0, 3).map(r => (
                              <Chip key={r} size="small" label={r} sx={{ height: 20, borderRadius: '4px', fontSize: '0.7rem' }} />
                            ))}
                            {s.liableRoles.length > 3 && <Typography variant="caption" color="text.secondary">+{s.liableRoles.length - 3}</Typography>}
                          </Box>
                        ) : (
                          <Typography variant="caption" color="text.secondary">-</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {s.riskExplanation ? (
                          <Tooltip title={s.riskExplanation}>
                            <Chip size="small" label={s.severityScore != null ? `Sev ${s.severityScore}` : 'Risk'} color={s.severityScore > 7 ? 'error' : s.severityScore > 4 ? 'warning' : 'default'} sx={{ height: 22, borderRadius: '4px' }} />
                          </Tooltip>
                        ) : s.severityScore != null ? (
                          <Chip size="small" label={`Sev ${s.severityScore}`} color="default" sx={{ height: 22, borderRadius: '4px' }} />
                        ) : (
                          <Typography variant="caption" color="text.secondary">-</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Collapse>
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Reason for Update</Typography>
        <TextField fullWidth size="small" label="Reason for update (optional)" value={changeReason}
          onChange={e => setChangeReason(e.target.value)} />
      </Paper>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 2 }}>
        <Button variant="contained" color="error" size="medium" onClick={handleSkip} disabled={skipMutation.isPending}
          startIcon={skipMutation.isPending ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <Close />}
          sx={{ height: 40 }}>Not Applicable</Button>
        <Button variant="contained" size="medium" onClick={handleSave} disabled={saveMutation.isPending || applicableCount === 0}
          startIcon={saveMutation.isPending ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <Save />}
          sx={{ height: 40 }}>{saveMutation.isPending ? 'Saving...' : 'Save to Register'}</Button>
      </Box>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack?.severity || 'info'} onClose={() => setSnack(null)} variant="filled">{snack?.message}</Alert>
      </Snackbar>
    </Box>
  );
}
