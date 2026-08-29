import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  Box, CircularProgress, Alert, Divider, Typography, Chip,
} from '@mui/material';
import { Link as LinkIcon } from '@mui/icons-material';
import { api } from '../../services/api';
import OwnerPicker from '../org/OwnerPicker';
import LinkObligationsPicker from './LinkObligationsPicker';

const EMPTY = {
  name: '', description: '', theme: '', controlType: '', inherentRisk: '',
  whatItDoes: '', howTested: '', controlOwnerId: null, testFrequency: '',
  testFrequencyDays: '', linkedObligationIds: [],
};

const THEMES = ['IT', 'Financial', 'Operational', 'Compliance', 'Legal'];
const CONTROL_TYPES = ['Preventive', 'Detective', 'Corrective', 'Directive'];
const RISKS = ['Critical', 'High', 'Moderate', 'Low'];
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

export default function CreateControlDialog({ open, onClose, onSaved, onSnackbar }) {
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (open) setForm({ ...EMPTY });
  }, [open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Control name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const body = { ...form };
      if (!body.controlOwnerId) body.controlOwnerId = null;
      if (body.testFrequencyDays) body.testFrequencyDays = parseInt(body.testFrequencyDays, 10);
      body.linkedObligationIds = (body.linkedObligationIds || []).map(Number);
      const created = await api.controls.create(body);
      onSaved?.(created);
    } catch (e) { const msg = e.message || 'Failed to create control.'; setError(msg); onSnackbar?.(msg); }
    finally { setSaving(false); }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>New Control</DialogTitle>
        <Divider />
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Typography variant="overline" color="primary" sx={{ fontWeight: 700 }}>Basic details</Typography>
          <Field label="Control name *">
            <TextField fullWidth size="small" placeholder="e.g. Segregation of duties" required value={form.name}
              onChange={e => set('name', e.target.value)} />
          </Field>
          <Field label="Description">
            <TextField fullWidth size="small" multiline minRows={2} placeholder="What this control covers"
              value={form.description} onChange={e => set('description', e.target.value)} />
          </Field>

          <Divider sx={{ my: 2 }} />
          <Typography variant="overline" color="primary" sx={{ fontWeight: 700 }}>Classification</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
            <Field label="Theme" sx={{ mb: 0 }}>
              <TextField select fullWidth size="small" value={form.theme} onChange={e => set('theme', e.target.value)}>
                <MenuItem value=""><em>Select theme</em></MenuItem>
                {THEMES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>
            </Field>
            <Field label="Control type" sx={{ mb: 0 }}>
              <TextField select fullWidth size="small" value={form.controlType} onChange={e => set('controlType', e.target.value)}>
                <MenuItem value=""><em>Select type</em></MenuItem>
                {CONTROL_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>
            </Field>
            <Field label="Inherent risk" sx={{ mb: 0 }}>
              <TextField select fullWidth size="small" value={form.inherentRisk} onChange={e => set('inherentRisk', e.target.value)}>
                <MenuItem value=""><em>Select risk</em></MenuItem>
                {RISKS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </TextField>
            </Field>
          </Box>

          <Divider sx={{ my: 2 }} />
          <Typography variant="overline" color="primary" sx={{ fontWeight: 700 }}>Execution</Typography>
          <Field label="What it does">
            <TextField fullWidth size="small" multiline minRows={2} placeholder="How this control is executed"
              value={form.whatItDoes} onChange={e => set('whatItDoes', e.target.value)} />
          </Field>
          <Field label="How it's tested">
            <TextField fullWidth size="small" multiline minRows={2} placeholder="How testing is performed"
              value={form.howTested} onChange={e => set('howTested', e.target.value)} />
          </Field>

          <Divider sx={{ my: 2 }} />
          <Typography variant="overline" color="primary" sx={{ fontWeight: 700 }}>Ownership & schedule</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '5fr 3fr', gap: 2 }}>
            <Field label="Owner" sx={{ mb: 0 }}>
              <OwnerPicker value={form.controlOwnerId} onChange={id => set('controlOwnerId', id)} label="Compliance owner" />
            </Field>
            <Field label="Test frequency" sx={{ mb: 0 }}>
              <TextField select fullWidth size="small" value={form.testFrequency} onChange={e => set('testFrequency', e.target.value)}>
                <MenuItem value=""><em>Select frequency</em></MenuItem>
                {FREQUENCIES.map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
              </TextField>
            </Field>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 2, mt: 2 }}>
            <Field label="Frequency days" sx={{ mb: 0 }}>
              <TextField fullWidth size="small" type="number" placeholder="e.g. 90"
                value={form.testFrequencyDays} onChange={e => set('testFrequencyDays', e.target.value)} />
            </Field>
            <Field label="Linked obligations" sx={{ mb: 0 }}>
              <Button variant="outlined" fullWidth sx={{ height: 40, justifyContent: 'flex-start', textTransform: 'none' }}
                startIcon={<LinkIcon />} onClick={() => setPickerOpen(true)}>
                {form.linkedObligationIds.length > 0
                  ? `Linked obligations (${form.linkedObligationIds.length})`
                  : 'Link obligations'}
              </Button>
              {form.linkedObligationIds.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                  <Chip size="small" label={`${form.linkedObligationIds.length} selected`} />
                </Box>
              )}
            </Field>
          </Box>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ justifyContent: 'center' }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.name}>
            {saving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <LinkObligationsPicker open={pickerOpen} onClose={() => setPickerOpen(false)}
        initialIds={form.linkedObligationIds} onSave={ids => set('linkedObligationIds', ids)} />
    </>
  );
}