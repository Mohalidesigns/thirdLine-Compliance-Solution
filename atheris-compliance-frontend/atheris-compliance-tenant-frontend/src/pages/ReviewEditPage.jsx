import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, TextField, MenuItem,
  Alert, CircularProgress, Collapse, Paper, Table, TableBody,
  TableCell, TableHead, TableRow, Checkbox,
  IconButton, Snackbar, Tooltip, Chip, Skeleton, Autocomplete,
} from '@mui/material';
import {
  PageHeader, DataCard, RiskBadge, StatusBadge, TL, riskTone,
  ChevronDownIcon, PlusIcon, TrashIcon, DocumentCheckIcon, XMarkIcon, ScaleIcon, EyeIcon,
} from 'shared';
import { api, API_BASE, getToken, pdfErrorMessage } from '../services/api';
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

// eslint-disable-next-line no-unused-vars
function inherentRiskChip(rating, likelihood, impact) {
  const cfg = INHERENT_RISK_CONFIG[rating];
  if (!cfg) return <StatusBadge label={rating || 'Unrated'} tone="gray" />;
  const tip = likelihood || impact ? `${likelihood || '-'} × ${impact || '-'}` : rating;
  return (
    <Tooltip title={tip}>
      <span><RiskBadge value={rating} /></span>
    </Tooltip>
  );
}

const META_LABEL_SX = {
  display: 'block', fontSize: '0.625rem', fontWeight: 600, color: TL.gray400,
  textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: '0.9375rem', mb: 0.5,
};
const META_VALUE_SX = { fontSize: '0.875rem', color: TL.gray700 };

/** Thirdline sub-panel used inside the expanded obligation row. */
function Panel({ title, children, sx }) {
  return (
    <Paper sx={{ overflow: 'hidden', mb: 2, ...sx }}>
      <Typography sx={{ px: 2.5, py: 1.5, fontSize: '0.875rem', fontWeight: 600, color: TL.gray800, borderBottom: `1px solid ${TL.gray100}` }}>
        {title}
      </Typography>
      <Box sx={{ p: 2.5 }}>{children}</Box>
    </Paper>
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
              <ChevronDownIcon size={18} sx={{ transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }} />
            </IconButton>
            <Typography sx={{ color: TL.gray500, fontSize: '0.75rem', fontFamily: TL.mono }}>
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
              sx={{ fontWeight: 500, lineHeight: 1.3, cursor: 'text', mb: 0.5,
                minHeight: 24, px: 0.5, py: 0.25, borderRadius: '6px',
                color: 'primary.main',
                '&:hover': { bgcolor: TL.gray50 } }}>
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
            <Tooltip title="Remove obligation">
              <IconButton size="small" onClick={() => onRemove(index)}>
                <TrashIcon size={16} />
              </IconButton>
            </Tooltip>
          </Box>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={5} sx={{ p: 0, border: 0 }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ p: 2, bgcolor: TL.gray50, borderBottom: `1px solid ${TL.gray100}` }}>
              <Panel title="Details">
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
              </Panel>

              <Panel title="AI Risk Assessment">
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2, alignItems: 'center' }}>
                  <Chip size="small" label={`AI Likelihood: ${item.inherentLikelihood || '-'}`} variant="outlined" />
                  <Chip size="small" label={`AI Impact: ${item.inherentImpact || '-'}`} variant="outlined" />
                  <StatusBadge label={`AI Risk: ${item.inherentRiskRating || '-'}`}
                    tone={INHERENT_RISK_CONFIG[item.inherentRiskRating] ? riskTone(item.inherentRiskRating) : 'gray'} dot />
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
              </Panel>

              <Panel title="Classification (tenant overrides)">
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
              </Panel>

              <Panel title="Linked Regulatory Returns" sx={{ mb: 0 }}>
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
                          size="small" {...tagProps} />
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
              </Panel>
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
      if (!res.ok) throw new Error(await pdfErrorMessage(res));
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), '_blank');
    } catch (e) { notify('error', e.message || 'Failed to load PDF.'); }
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
      <PageHeader
        title={data.regulatorName || data.regulatorAbbreviation || 'Unknown regulator'}
        subtitle="Review document — edit obligations and classify before saving to the register"
        onBack={() => navigate('/review')}
        backLabel="Back to Review Inbox"
        actions={(
          <Button variant="outlined" startIcon={<EyeIcon size={16} />} onClick={handleViewInstrument}>View PDF</Button>
        )}
      >
        {((data.regulatorAbbreviation && data.regulatorName && data.regulatorAbbreviation !== data.regulatorName) || isReReview) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {data.regulatorAbbreviation && data.regulatorName && data.regulatorAbbreviation !== data.regulatorName && (
              <StatusBadge label={data.regulatorAbbreviation} tone="blue" />
            )}
            {isReReview && (
              <StatusBadge label={`Re-review (previously ${data.status})`} tone="amber" />
            )}
          </Box>
        )}
      </PageHeader>

      {(isError || saveMutation.isError || skipMutation.isError) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error?.message || saveMutation.error?.message || skipMutation.error?.message}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <StatusBadge label={data.source === 'intel' ? 'Intel' : data.source === 'upload' ? 'Upload' : data.source} tone={data.source === 'intel' ? 'gray' : 'blue'} />
          {data.documentType && <Chip size="small" label={data.documentType} variant="outlined" />}
          {data.riskRating && (
            INHERENT_RISK_CONFIG[data.riskRating]
              ? <RiskBadge value={data.riskRating} />
              : <StatusBadge label={data.riskRating} tone="gray" />
          )}
          {headerActNames.map(a => (
            <Chip key={a} size="small" variant="outlined" label={a} />
          ))}
          <Typography sx={{ fontSize: '0.75rem', color: TL.gray500, ml: 1 }}>
            Received {new Date(data.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '1.125rem', fontWeight: 600, lineHeight: '1.75rem', color: TL.textPrimary, mb: 1.5 }}>{data.sourceTitle || 'Untitled document'}</Typography>
        {data.sourceReferenceNumber && (
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mb: 2.5, px: 1.25, py: 0.5, bgcolor: TL.gray50, border: `1px solid ${TL.gray200}`, borderRadius: '6px' }}>
            <Typography component="span" sx={{ ...META_LABEL_SX, mb: 0 }}>Ref No</Typography>
            <Typography sx={{ fontFamily: TL.mono, fontSize: '0.75rem', color: TL.gray700 }}>{data.sourceReferenceNumber}</Typography>
          </Box>
        )}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 2.5, pt: 2, borderTop: `1px solid ${TL.gray100}` }}>
          <Box>
            <Typography component="span" sx={META_LABEL_SX}>Regulator</Typography>
            <Typography sx={{ ...META_VALUE_SX, fontWeight: 500 }}>{data.regulatorName || data.regulatorAbbreviation || '-'}</Typography>
            {data.regulatorAbbreviation && data.regulatorName && data.regulatorAbbreviation !== data.regulatorName && (
              <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>{data.regulatorAbbreviation}</Typography>
            )}
          </Box>
          <Box>
            <Typography component="span" sx={META_LABEL_SX}>Risk Rating</Typography>
            <Typography sx={META_VALUE_SX}>{data.riskRating || '-'}</Typography>
          </Box>
          <Box>
            <Typography component="span" sx={META_LABEL_SX}>Document Type</Typography>
            <Typography sx={META_VALUE_SX}>{data.documentType || '-'}</Typography>
          </Box>
          {headerActNames.length > 0 && (
            <Box>
              <Typography component="span" sx={META_LABEL_SX}>Act Name</Typography>
              <Typography sx={{ ...META_VALUE_SX, fontWeight: 500 }}>{headerActNames.join(', ')}</Typography>
            </Box>
          )}
          {data.dateIssued && (
            <Box>
              <Typography component="span" sx={META_LABEL_SX}>Date Issued</Typography>
              <Typography sx={META_VALUE_SX}>{data.dateIssued}</Typography>
            </Box>
          )}
          {data.dateCommencement && (
            <Box>
              <Typography component="span" sx={META_LABEL_SX}>Commencement</Typography>
              <Typography sx={META_VALUE_SX}>{data.dateCommencement}</Typography>
            </Box>
          )}
          {data.effectiveDate && (
            <Box>
              <Typography component="span" sx={META_LABEL_SX}>Effective Date</Typography>
              <Typography sx={META_VALUE_SX}>{data.effectiveDate}</Typography>
            </Box>
          )}
          {data.publishedAt && (
            <Box>
              <Typography component="span" sx={META_LABEL_SX}>Published</Typography>
              <Typography sx={META_VALUE_SX}>{data.publishedAt}</Typography>
            </Box>
          )}
          {data.nature && (
            <Box>
              <Typography component="span" sx={META_LABEL_SX}>Nature</Typography>
              <Typography sx={META_VALUE_SX}>{data.nature}</Typography>
            </Box>
          )}
        </Box>
      </Paper>

      <DataCard
        title={`Obligations (${applicableCount} applicable of ${obligations.length})`}
        actions={<Button size="small" variant="outlined" startIcon={<PlusIcon size={16} />} onClick={handleAdd}>Add</Button>}
        sx={{ mb: 3 }}
        noPadding
      >
        <Box sx={{ overflowX: 'auto' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 40 }}>#</TableCell>
                <TableCell sx={{ minWidth: 240 }}>Obligation</TableCell>
                <TableCell sx={{ minWidth: 200 }}>Interpreted</TableCell>
                <TableCell sx={{ width: 100 }}>Risk</TableCell>
                <TableCell sx={{ width: 80 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {obligations.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: TL.gray400 }}>No obligations extracted.</TableCell></TableRow>
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
        </Box>
      </DataCard>

      <Paper sx={{ mb: 3, overflow: 'hidden' }}>
        <Box onClick={() => setSanctionsOpen(!sanctionsOpen)}
          sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            px: 3, py: 2, cursor: 'pointer', userSelect: 'none',
            borderBottom: sanctionsOpen ? `1px solid ${TL.gray100}` : 'none',
            '&:hover': { bgcolor: TL.gray50 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <ScaleIcon size={18} sx={{ color: sanctions.length > 0 ? TL.error : TL.gray400 }} />
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: TL.gray800 }}>
              Sanctions {sanctions.length > 0 ? `(${sanctions.length})` : ''}
            </Typography>
            {sanctions.length > 0 && <StatusBadge tone="red" label={`${sanctions.length} sanction${sanctions.length !== 1 ? 's' : ''}`} />}
          </Box>
          <ChevronDownIcon size={18} sx={{ color: TL.gray400, transition: 'transform .15s', transform: sanctionsOpen ? 'rotate(180deg)' : 'none' }} />
        </Box>
        <Collapse in={sanctionsOpen}>
          {sanctions.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
              <Typography variant="body2" sx={{ color: TL.gray400 }}>No sanctions extracted</Typography>
              <Typography variant="caption" color="text.secondary">If the instrument contained penalties, they will appear here after harmonization.</Typography>
            </Box>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell sx={{ minWidth: 160 }}>Penalty</TableCell>
                    <TableCell sx={{ width: 110 }}>Section</TableCell>
                    <TableCell sx={{ minWidth: 140 }}>Liable Roles</TableCell>
                    <TableCell sx={{ width: 100 }}>Risk</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sanctions.map((s, idx) => (
                    <TableRow key={idx} hover>
                      <TableCell>
                        <Chip size="small" label={s.sanctionType || 'sanction'} variant="outlined" sx={{ textTransform: 'capitalize' }} />
                        {s.actName && (
                          <Chip size="small" variant="outlined" label={s.actName.slice(0, 18)} sx={{ ml: 0.5 }} />
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500, color: TL.gray700, fontFamily: s.amountNaira ? TL.mono : 'inherit', fontSize: s.amountNaira ? '0.8125rem' : '0.875rem' }}>
                          {s.amountNaira != null ? formatNaira(s.amountNaira) : (s.penaltyDetails ? s.penaltyDetails.slice(0, 80) : '-')}
                          {s.sanctionAmountPerDay ? ' /day' : ''}
                        </Typography>
                        {s.penaltyDetails && s.amountNaira != null && (
                          <Typography sx={{ fontSize: '0.75rem', color: TL.gray500, display: 'block', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.penaltyDetails.slice(0, 100)}</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {s.sourceSectionReference ? (
                          <Typography sx={{ fontFamily: TL.mono, fontSize: '0.75rem', color: TL.gray500 }}>{s.sourceSectionReference}</Typography>
                        ) : (
                          <Typography variant="caption" color="text.secondary">-</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {Array.isArray(s.liableRoles) && s.liableRoles.length > 0 ? (
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {s.liableRoles.slice(0, 3).map(r => (
                              <Chip key={r} size="small" label={r} />
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
                            <span><StatusBadge label={s.severityScore != null ? `Sev ${s.severityScore}` : 'Risk'} tone={s.severityScore > 7 ? 'red' : s.severityScore > 4 ? 'orange' : 'gray'} dot /></span>
                          </Tooltip>
                        ) : s.severityScore != null ? (
                          <StatusBadge label={`Sev ${s.severityScore}`} tone="gray" />
                        ) : (
                          <Typography variant="caption" color="text.secondary">-</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </Collapse>
      </Paper>

      <DataCard title="Reason for Update" sx={{ mb: 3 }}>
        <TextField fullWidth size="small" label="Reason for update (optional)" value={changeReason}
          onChange={e => setChangeReason(e.target.value)} />
      </DataCard>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mb: 2 }}>
        <Button variant="contained" color="error" onClick={handleSkip} disabled={skipMutation.isPending}
          startIcon={skipMutation.isPending ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <XMarkIcon size={16} />}>
          Not Applicable</Button>
        <Button variant="contained" onClick={handleSave} disabled={saveMutation.isPending || applicableCount === 0}
          startIcon={saveMutation.isPending ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <DocumentCheckIcon size={16} />}>
          {saveMutation.isPending ? 'Saving...' : 'Save to Register'}</Button>
      </Box>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack?.severity || 'info'} onClose={() => setSnack(null)} variant="filled">{snack?.message}</Alert>
      </Snackbar>
    </Box>
  );
}
