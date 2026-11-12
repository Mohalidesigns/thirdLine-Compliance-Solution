import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  Box, CircularProgress, Alert, Divider, Typography, Chip, IconButton,
} from '@mui/material';
import { LinkIcon, PlusIcon, TrashIcon } from 'shared';
import { api } from '../../services/api';
import OwnerPicker from '../org/OwnerPicker';
import { AREAS_OF_FOCUS } from '../../utils/areas';
import LinkControlsPicker from './LinkControlsPicker';
import ReturnPicker from './ReturnPicker';
import RegulatorFormDialog from './RegulatorFormDialog';

const EMPTY = {
  instrumentId: '', name: '', tenantRegulatorId: '', requirements: [''], areaOfFocus: '', effectiveDate: '',
  assignedOwnerId: null, linkedControlIds: [], linkedReturnIds: [],
};

function Field({ label, children, sx }) {
  return (
    <Box sx={{ mb: 2, ...sx }}>
      <Typography variant="caption" sx={{ fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary', display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}

export default function CreateObligationDialog({ open, onClose, onSaved, onSnackbar, editing, initial }) {
  const isEditing = !!(editing && initial);
  const obligationId = isEditing ? initial.obligationId : null;

  const { data: instruments = [] } = useQuery({
    queryKey: ['obligations', 'dialog', 'instruments'],
    queryFn: ({ signal }) => api.instruments.list(0, 50, '', { signal }),
    enabled: open,
    select: (d) => (Array.isArray(d) ? d : (d?.content || [])),
  });

  const { data: fetchedRegulators = [] } = useQuery({
    queryKey: ['regulators', 'list'],
    queryFn: ({ signal }) => api.regulators.list({}, { signal }),
    enabled: open,
    select: (d) => (Array.isArray(d) ? d : (d?.content || [])),
  });

  const { data: existingRequirements = [], isSuccess: requirementsReady } = useQuery({
    queryKey: ['requirements', 'obligation', String(obligationId)],
    queryFn: ({ signal }) => api.requirements.forObligation(obligationId, { signal }),
    enabled: open && !!obligationId,
  });

  const initialForm = useMemo(() => {
    if (!isEditing) return { ...EMPTY, requirements: [''] };
    const texts = [...existingRequirements]
      .sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0))
      .map((r) => r.text || '').filter(Boolean);
    return {
      instrumentId: initial.instrumentId ?? '',
      name: initial.title || initial.name || '',
      tenantRegulatorId: initial.tenantRegulatorId ?? '',
      requirements: texts.length ? texts : [''],
      areaOfFocus: initial.areaOfFocus || '',
      effectiveDate: initial.effectiveDate || '',
      assignedOwnerId: initial.assignedOwnerId ?? null,
      linkedControlIds: [...(initial.linkedControlIds || [])],
      linkedReturnIds: [...(initial.linkedReturnIds || [])],
    };
  }, [isEditing, initial, existingRequirements]);

  if (open && isEditing && !requirementsReady) {
    return (
      <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
        <DialogContent sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></DialogContent>
      </Dialog>
    );
  }

  return (
    <ObligationForm
      key={`${open ? 'o' : 'c'}-${isEditing ? `edit-${obligationId}` : 'new'}`}
      open={open}
      onClose={onClose}
      onSaved={onSaved}
      onSnackbar={onSnackbar}
      isEditing={isEditing}
      obligationId={obligationId}
      initialForm={initialForm}
      instruments={instruments}
      fetchedRegulators={fetchedRegulators}
    />
  );
}

function ObligationForm({ open, onClose, onSaved, onSnackbar, isEditing, obligationId, initialForm, instruments, fetchedRegulators }) {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [returnPickerOpen, setReturnPickerOpen] = useState(false);
  const [regulatorAddOpen, setRegulatorAddOpen] = useState(false);
  const [extraRegulators, setExtraRegulators] = useState([]);

  const regulators = useMemo(() => {
    const idOf = (r) => r.id ?? r.tenantRegulatorId;
    const seen = new Set(fetchedRegulators.map(idOf));
    return [...fetchedRegulators, ...extraRegulators.filter((x) => !seen.has(idOf(x)))];
  }, [fetchedRegulators, extraRegulators]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const setRequirement = (idx, value) => setForm(f => {
    const requirements = [...f.requirements];
    requirements[idx] = value;
    return { ...f, requirements };
  });
  const addRequirement = () => setForm(f => ({ ...f, requirements: [...f.requirements, ''] }));
  const removeRequirement = (idx) => setForm(f => {
    const requirements = f.requirements.filter((_, i) => i !== idx);
    return { ...f, requirements: requirements.length ? requirements : [''] };
  });

  const addRegulator = (created) => {
    setRegulatorAddOpen(false);
    if (!created) return;
    setExtraRegulators(prev => [...prev, created]);
    set('tenantRegulatorId', String(created.id ?? created.tenantRegulatorId));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const body = {
        ...form,
        instrumentId: form.instrumentId ? Number(form.instrumentId) : null,
        tenantRegulatorId: form.tenantRegulatorId ? Number(form.tenantRegulatorId) : null,
        effectiveDate: form.effectiveDate || null,
        linkedControlIds: (form.linkedControlIds || []).map(Number),
        obligationTexts: (form.requirements || []).map((t) => t.trim()).filter(Boolean),
      };
      delete body.assignedOwnerId;
      delete body.requirements;
      const saved = isEditing
        ? await api.obligations.update(obligationId, body)
        : await api.obligations.create(body);
      const savedId = isEditing ? obligationId : saved?.obligationId;
      if (savedId && form.assignedOwnerId != null) {
        await api.obligations.assignOwner(savedId, {
          assignedOwnerId: form.assignedOwnerId, changeReason: 'Risk owner set on save',
        });
      }
      const returnIds = (form.linkedReturnIds || []).map(Number);
      if (savedId && returnIds.length > 0) {
        await api.obligations.linkReturns(savedId, returnIds);
      }
      onSaved?.(saved);
      onClose();
    } catch (e) { const msg = e.message || 'Failed to save obligation.'; setError(msg); onSnackbar?.(msg); }
    finally { setSaving(false); }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>{isEditing ? 'Edit Obligation' : 'New Obligation'}</DialogTitle>
        <DialogContent sx={{ '&&': { pt: 2.5 } }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Typography variant="overline" sx={{ display: 'block', color: 'text.secondary', fontWeight: 600, letterSpacing: '0.05em', lineHeight: 2 }}>Basic details</Typography>
          <Field label="Name *">
            <TextField fullWidth size="small" placeholder="e.g. Quarterly regulatory return filing"
              required value={form.name} onChange={e => set('name', e.target.value)} />
          </Field>

          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 600, letterSpacing: '0.05em' }}>Requirements</Typography>
            <Button size="small" variant="outlined" startIcon={<PlusIcon size={15} />} onClick={addRequirement}>
              Add requirement
            </Button>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            One enforceable duty per requirement. These appear on the obligation's Requirements tab and each can be covered by its own controls.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {form.requirements.map((text, idx) => (
              <Box key={idx} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <Box sx={{
                  minWidth: 26, height: 26, mt: 0.5, borderRadius: '50%', bgcolor: 'action.hover',
                  color: 'text.secondary', fontSize: '0.75rem', fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {idx + 1}
                </Box>
                <TextField fullWidth size="small" multiline minRows={1} maxRows={4}
                  placeholder={`Requirement ${idx + 1}`}
                  value={text} onChange={e => setRequirement(idx, e.target.value)} />
                <IconButton size="small" onClick={() => removeRequirement(idx)}
                  disabled={form.requirements.length === 1} title="Remove requirement" sx={{ mt: 0.25 }}>
                  <TrashIcon size={16} />
                </IconButton>
              </Box>
            ))}
          </Box>

          <Divider sx={{ my: 2 }} />
          <Typography variant="overline" sx={{ display: 'block', color: 'text.secondary', fontWeight: 600, letterSpacing: '0.05em', lineHeight: 2 }}>Classification</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <Field label="Area of focus" sx={{ mb: 0 }}>
              <TextField select fullWidth size="small" value={form.areaOfFocus}
                onChange={e => set('areaOfFocus', e.target.value)}>
                <MenuItem value=""><em>Select area</em></MenuItem>
                {AREAS_OF_FOCUS.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>
            </Field>
            <Field label="Effective date" sx={{ mb: 0 }}>
              <TextField fullWidth size="small" type="date" value={form.effectiveDate}
                onChange={e => set('effectiveDate', e.target.value)} />
            </Field>
          </Box>
          <Box sx={{ mt: 2 }}>
            <Field label="Risk owner (accountable for this obligation)" sx={{ mb: 0 }}>
              <OwnerPicker value={form.assignedOwnerId} onChange={id => set('assignedOwnerId', id)}
                label="Risk owner" />
            </Field>
          </Box>
          <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <Field label="Regulator *" sx={{ mb: 0 }}>
              <TextField fullWidth size="small" select value={form.tenantRegulatorId}
                onChange={e => {
                  if (e.target.value === '__add__') { setRegulatorAddOpen(true); return; }
                  set('tenantRegulatorId', e.target.value);
                }}>
                <MenuItem value=""><em>Select regulator</em></MenuItem>
                {regulators.map(r => (
                  <MenuItem key={r.id ?? r.tenantRegulatorId} value={String(r.id ?? r.tenantRegulatorId)}>
                    {r.abbreviation ? `${r.abbreviation} — ${r.name}` : r.name}
                  </MenuItem>
                ))}
                <MenuItem value="__add__" sx={{ color: 'primary.main', fontWeight: 600 }}>+ Add regulator</MenuItem>
              </TextField>
            </Field>
            <Field label="Instrument (optional)" sx={{ mb: 0 }}>
              <TextField fullWidth size="small" select value={form.instrumentId}
                onChange={e => set('instrumentId', e.target.value)}>
                <MenuItem value=""><em>None — standalone obligation</em></MenuItem>
                {instruments.map(ins => (
                  <MenuItem key={ins.instrumentId} value={ins.instrumentId}>
                    {ins.sourceTitle || `Instrument #${ins.instrumentId}`}
                  </MenuItem>
                ))}
              </TextField>
            </Field>
          </Box>

          <Divider sx={{ my: 2 }} />
          <Typography variant="overline" sx={{ display: 'block', color: 'text.secondary', fontWeight: 600, letterSpacing: '0.05em', lineHeight: 2 }}>Controls</Typography>
          <Field label="Linked controls (optional)" sx={{ mb: 0 }}>
            <Button variant="outlined" fullWidth sx={{ justifyContent: 'flex-start' }}
              startIcon={<LinkIcon size={16} />} onClick={() => setPickerOpen(true)}>
              {form.linkedControlIds.length > 0
                ? `Linked controls (${form.linkedControlIds.length})`
                : 'Link controls'}
            </Button>
            {form.linkedControlIds.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                <Chip size="small" label={`${form.linkedControlIds.length} selected`} />
              </Box>
            )}
          </Field>

          <Divider sx={{ my: 2 }} />
          <Typography variant="overline" sx={{ display: 'block', color: 'text.secondary', fontWeight: 600, letterSpacing: '0.05em', lineHeight: 2 }}>Returns</Typography>
          <Field label="Linked returns (optional)" sx={{ mb: 0 }}>
            <Button variant="outlined" fullWidth sx={{ justifyContent: 'flex-start' }}
              startIcon={<LinkIcon size={16} />} onClick={() => setReturnPickerOpen(true)}>
              {form.linkedReturnIds.length > 0
                ? `Linked returns (${form.linkedReturnIds.length})`
                : 'Link returns'}
            </Button>
            {form.linkedReturnIds.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                <Chip size="small" label={`${form.linkedReturnIds.length} selected`} />
              </Box>
            )}
          </Field>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.name}>
            {saving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : (isEditing ? 'Save changes' : 'Create')}
          </Button>
        </DialogActions>
      </Dialog>

      {pickerOpen && <LinkControlsPicker open onClose={() => setPickerOpen(false)}
        initialIds={form.linkedControlIds} onSave={ids => set('linkedControlIds', ids)} />}
      {returnPickerOpen && <ReturnPicker open onClose={() => setReturnPickerOpen(false)}
        obligationContext={{
          obligationId,
          name: form.name,
          tenantRegulatorId: form.tenantRegulatorId || null,
        }}
        initialIds={form.linkedReturnIds} onSave={ids => set('linkedReturnIds', ids)} />}
      {regulatorAddOpen && <RegulatorFormDialog open onClose={() => setRegulatorAddOpen(false)} onSaved={addRegulator} />}
    </>
  );
}