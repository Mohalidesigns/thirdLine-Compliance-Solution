import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  Box, CircularProgress, Alert, Divider, Typography, Grid, Autocomplete, Chip,
} from '@mui/material';
import { Link as LinkIcon } from '@mui/icons-material';
import { api } from '../../services/api';
import LinkObligationsPicker from './LinkObligationsPicker';

const EMPTY = {
  returnName: '', filingRegulator: '', tenantRegulatorId: '', returnType: '', frequency: '',
  filingDate: '', filingDeadlineOffsetDays: '', filingChannel: '',
  returnOwnerUserId: '', returnOwnerName: '', responsibleUnit: '', responsiblePerson: '',
  linkedObligationIds: [],
};

const FREQUENCIES = ['Monthly', 'Quarterly', 'Semi-Annual', 'Annual'];

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

export default function CreateReturnDialog({ open, onClose, onSaved, onSnackbar }) {
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [regulators, setRegulators] = useState([]);
  const [linksOpen, setLinksOpen] = useState(false);

  useEffect(() => {
    if (open) { setForm({ ...EMPTY }); setError(''); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    api.regulators.list().then(res => {
      const items = Array.isArray(res) ? res : (res.content || []);
      setRegulators(items);
    }).catch(() => setRegulators([]));
  }, [open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.returnName.trim()) { setError('Return name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const body = { ...form };
      if (body.filingDeadlineOffsetDays) body.filingDeadlineOffsetDays = parseInt(body.filingDeadlineOffsetDays, 10);
      if (body.returnOwnerUserId) body.returnOwnerUserId = parseInt(body.returnOwnerUserId, 10);
      if (body.tenantRegulatorId) body.tenantRegulatorId = parseInt(body.tenantRegulatorId, 10);
      else delete body.tenantRegulatorId;
      if (!body.filingDate) delete body.filingDate;
      if (!body.responsibleUnit) delete body.responsibleUnit;
      if (!body.responsiblePerson) delete body.responsiblePerson;
      const created = await api.returns.create(body);
      if (form.linkedObligationIds?.length) {
        await api.returns.linkObligations(created, form.linkedObligationIds.map(Number));
      }
      onSaved?.(created);
      onClose();
    } catch (e) { const msg = e.message || 'Failed to create return.'; setError(msg); onSnackbar?.(msg); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Return</DialogTitle>
      <Divider />
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Typography variant="overline" color="primary" sx={{ fontWeight: 700 }}>Basic details</Typography>
        <Field label="Return Name *">
          <TextField fullWidth size="small" required value={form.returnName}
            onChange={e => set('returnName', e.target.value)} />
        </Field>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Field label="Regulator" sx={{ mb: 0 }}>
            <Autocomplete size="small" freeSolo clearOnEscape
              options={regulators}
              getOptionLabel={(o) => (typeof o === 'string' ? o : (o.abbreviation || o.name))}
              value={regulators.find(r => r.id === form.tenantRegulatorId) || form.filingRegulator || null}
              onChange={(_, val) => {
                if (typeof val === 'string') {
                  set('filingRegulator', val);
                  set('tenantRegulatorId', '');
                } else if (val) {
                  set('filingRegulator', val.abbreviation || val.name);
                  set('tenantRegulatorId', String(val.id));
                } else {
                  set('filingRegulator', '');
                  set('tenantRegulatorId', '');
                }
              }}
              renderInput={(params) => (
                <TextField {...params} fullWidth size="small" placeholder="Search or type regulator name"
                  onChange={e => set('filingRegulator', e.target.value)} />
              )}
            />
          </Field>
          <Field label="Return Type" sx={{ mb: 0 }}>
            <TextField fullWidth size="small" value={form.returnType}
              onChange={e => set('returnType', e.target.value)} />
          </Field>
        </Box>

        <Divider sx={{ my: 2 }} />
        <Typography variant="overline" color="primary" sx={{ fontWeight: 700 }}>Filing schedule</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
          <Field label="Frequency" sx={{ mb: 0 }}>
            <TextField select fullWidth size="small" value={form.frequency}
              onChange={e => set('frequency', e.target.value)}>
              <MenuItem value=""><em>None</em></MenuItem>
              {FREQUENCIES.map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
            </TextField>
          </Field>
          <Field label="Filing Date" sx={{ mb: 0 }}>
            <TextField fullWidth size="small" type="date" value={form.filingDate}
              onChange={e => set('filingDate', e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }} />
          </Field>
          <Field label="Prep offset (days)" sx={{ mb: 0 }}>
            <TextField fullWidth size="small" type="number" value={form.filingDeadlineOffsetDays}
              onChange={e => set('filingDeadlineOffsetDays', e.target.value)} />
          </Field>
        </Box>
        <Box sx={{ mt: 2 }}>
          <Field label="Filing Channel" sx={{ mb: 0 }}>
            <TextField fullWidth size="small" value={form.filingChannel}
              onChange={e => set('filingChannel', e.target.value)} />
          </Field>
        </Box>

        <Divider sx={{ my: 2 }} />
        <Typography variant="overline" color="primary" sx={{ fontWeight: 700 }}>Responsible</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Field label="Responsible Unit" sx={{ mb: 0 }}>
            <TextField fullWidth size="small" value={form.responsibleUnit}
              onChange={e => set('responsibleUnit', e.target.value)} />
          </Field>
          <Field label="Responsible Person" sx={{ mb: 0 }}>
            <TextField fullWidth size="small" value={form.responsiblePerson}
              onChange={e => set('responsiblePerson', e.target.value)} />
          </Field>
        </Box>

        <Divider sx={{ my: 2 }} />
        <Typography variant="overline" color="primary" sx={{ fontWeight: 700 }}>Owner</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Field label="Owner User ID" sx={{ mb: 0 }}>
            <TextField fullWidth size="small" type="number" value={form.returnOwnerUserId}
              onChange={e => set('returnOwnerUserId', e.target.value)} />
          </Field>
          <Field label="Owner Name" sx={{ mb: 0 }}>
            <TextField fullWidth size="small" value={form.returnOwnerName}
              onChange={e => set('returnOwnerName', e.target.value)} />
          </Field>
        </Box>

        <Divider sx={{ my: 2 }} />
        <Typography variant="overline" color="primary" sx={{ fontWeight: 700 }}>Linked Obligations</Typography>
        <Field label="Obligations this return is filed to satisfy">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Button size="small" variant="outlined" startIcon={<LinkIcon />}
              onClick={() => setLinksOpen(true)}>
              {form.linkedObligationIds.length > 0
                ? `Linked obligations (${form.linkedObligationIds.length})`
                : 'Link obligations'}
            </Button>
            {form.linkedObligationIds.map(id => (
              <Chip key={id} size="small" label={`Obligation #${id}`} onDelete={() => set('linkedObligationIds', form.linkedObligationIds.filter(x => x !== id))} />
            ))}
          </Box>
        </Field>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ justifyContent: 'center' }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !form.returnName}>
          {saving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Create Return'}
        </Button>
      </DialogActions>

      <LinkObligationsPicker open={linksOpen} onClose={() => setLinksOpen(false)}
        initialIds={form.linkedObligationIds}
        onSave={ids => set('linkedObligationIds', ids)} />
    </Dialog>
  );
}