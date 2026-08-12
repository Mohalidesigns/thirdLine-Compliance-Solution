import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  Box, CircularProgress, Alert, Divider, Typography, Chip, FormControlLabel, Checkbox,
} from '@mui/material';
import { Link as LinkIcon } from '@mui/icons-material';
import { api } from '../../services/api';
import LinkControlsPicker from './LinkControlsPicker';
import ReturnPicker from './ReturnPicker';

const EMPTY = {
  instrumentId: '', name: '', description: '', obligationType: '',
  recurringDeadlineType: '', effectiveDate: '', hasGap: false, gapDescription: '',
  linkedControlIds: [], linkedReturnIds: [],
};

const OBLIGATION_TYPES = [
  'reporting', 'disclosure', 'compliance', 'record_keeping',
  'notification', 'approval', 'audit', 'other',
];

const DEADLINE_TYPES = [
  'monthly', 'quarterly', 'semi_annually', 'annually',
  'one_time', 'ongoing', 'ad_hoc',
];

function Field({ label, children, sx }) {
  return (
    <Box sx={{ mb: 2, ...sx }}>
      <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}

export default function CreateObligationDialog({ open, onClose, onSaved, onSnackbar, editing, initial }) {
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [returnPickerOpen, setReturnPickerOpen] = useState(false);
  const [instruments, setInstruments] = useState([]);

  useEffect(() => {
    if (open) {
      const base = editing && initial
        ? {
            instrumentId: initial.instrumentId ?? '',
            name: initial.name || '',
            description: initial.description || '',
            obligationType: initial.obligationType || '',
            recurringDeadlineType: initial.recurringDeadlineType || '',
            effectiveDate: initial.effectiveDate || '',
            hasGap: Boolean(initial.hasGap),
            gapDescription: initial.gapDescription || '',
            linkedControlIds: [...(initial.linkedControlIds || [])],
            linkedReturnIds: [...(initial.linkedReturnIds || [])],
          }
        : { ...EMPTY };
      setForm(base);
      setError('');
      api.instruments.list(0, 50, '')
        .then(d => setInstruments(Array.isArray(d) ? d : (d.content || [])))
        .catch(() => setInstruments([]));
    }
  }, [open, editing, initial]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const body = {
        ...form,
        instrumentId: form.instrumentId ? Number(form.instrumentId) : null,
        effectiveDate: form.effectiveDate || null,
        linkedControlIds: (form.linkedControlIds || []).map(Number),
        gapDescription: form.hasGap ? form.gapDescription || null : null,
      };
      const saved = editing && initial
        ? await api.obligations.update(initial.obligationId, body)
        : await api.obligations.create(body);
      const obligationId = editing && initial ? initial.obligationId : saved?.obligationId;
      const returnIds = (form.linkedReturnIds || []).map(Number);
      if (obligationId && returnIds.length > 0) {
        await api.obligations.linkReturns(obligationId, returnIds);
      }
      onSaved?.(saved);
      onClose();
    } catch (e) { const msg = e.message || 'Failed to save obligation.'; setError(msg); onSnackbar?.(msg); }
    finally { setSaving(false); }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>{editing && initial ? 'Edit Obligation' : 'New Obligation'}</DialogTitle>
        <Divider />
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Typography variant="overline" color="primary" sx={{ fontWeight: 700 }}>Basic details</Typography>
          <Field label="Name *">
            <TextField fullWidth size="small" placeholder="e.g. Quarterly regulatory return filing"
              required value={form.name} onChange={e => set('name', e.target.value)} />
          </Field>
          <Field label="Description">
            <TextField fullWidth size="small" multiline minRows={2} placeholder="Additional details"
              value={form.description} onChange={e => set('description', e.target.value)} />
          </Field>

          <Divider sx={{ my: 2 }} />
          <Typography variant="overline" color="primary" sx={{ fontWeight: 700 }}>Classification</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <Field label="Obligation type" sx={{ mb: 0 }}>
              <TextField select fullWidth size="small" value={form.obligationType}
                onChange={e => set('obligationType', e.target.value)}>
                <MenuItem value=""><em>Select type</em></MenuItem>
                {OBLIGATION_TYPES.map(t => <MenuItem key={t} value={t}>{t.replace(/_/g, ' ')}</MenuItem>)}
              </TextField>
            </Field>
            <Field label="Deadline type" sx={{ mb: 0 }}>
              <TextField select fullWidth size="small" value={form.recurringDeadlineType}
                onChange={e => set('recurringDeadlineType', e.target.value)}>
                <MenuItem value=""><em>Select deadline</em></MenuItem>
                {DEADLINE_TYPES.map(t => <MenuItem key={t} value={t}>{t.replace(/_/g, ' ')}</MenuItem>)}
              </TextField>
            </Field>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 2 }}>
            <Field label="Effective date" sx={{ mb: 0 }}>
              <TextField fullWidth size="small" type="date" value={form.effectiveDate}
                onChange={e => set('effectiveDate', e.target.value)} />
            </Field>
            <Field label="Instrument (optional)" sx={{ mb: 0 }}>
              <TextField select fullWidth size="small" value={form.instrumentId}
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
          <Typography variant="overline" color="primary" sx={{ fontWeight: 700 }}>Controls</Typography>
          <Field label="Linked controls (optional)" sx={{ mb: 0 }}>
            <Button variant="outlined" fullWidth sx={{ height: 40, justifyContent: 'flex-start', textTransform: 'none' }}
              startIcon={<LinkIcon />} onClick={() => setPickerOpen(true)}>
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
          <Typography variant="overline" color="primary" sx={{ fontWeight: 700 }}>Returns</Typography>
          <Field label="Linked returns (optional)" sx={{ mb: 0 }}>
            <Button variant="outlined" fullWidth sx={{ height: 40, justifyContent: 'flex-start', textTransform: 'none' }}
              startIcon={<LinkIcon />} onClick={() => setReturnPickerOpen(true)}>
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

          <Box sx={{ mt: 2 }}>
            <FormControlLabel control={
              <Checkbox size="small" checked={form.hasGap} onChange={e => set('hasGap', e.target.checked)} />
            } label={<Typography variant="body2">Has gap — no control covers this</Typography>} />
            {form.hasGap && (
              <Field label="Gap description" sx={{ mt: 1 }}>
                <TextField fullWidth size="small" multiline minRows={2} placeholder="Describe the gap"
                  value={form.gapDescription} onChange={e => set('gapDescription', e.target.value)} />
              </Field>
            )}
          </Box>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ justifyContent: 'center' }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.name}>
            {saving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : (editing && initial ? 'Save changes' : 'Create')}
          </Button>
        </DialogActions>
      </Dialog>

      <LinkControlsPicker open={pickerOpen} onClose={() => setPickerOpen(false)}
        initialIds={form.linkedControlIds} onSave={ids => set('linkedControlIds', ids)} />
      <ReturnPicker open={returnPickerOpen} onClose={() => setReturnPickerOpen(false)}
        initialIds={form.linkedReturnIds} onSave={ids => set('linkedReturnIds', ids)} />
    </>
  );
}