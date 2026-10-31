import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  Box, CircularProgress, Alert, Divider, Typography,
} from '@mui/material';
import { api } from '../../services/api';
import OwnerPicker from '../org/OwnerPicker';

const EMPTY = {
  name: '', description: '', controlType: '', inherentRisk: '',
  whatItDoes: '', howTested: '', controlOwnerId: null, testerOwnerId: null, testFrequency: '',
};

const CONTROL_TYPES = ['Preventive', 'Detective', 'Corrective', 'Directive'];
const RISKS = ['Critical', 'High', 'Moderate', 'Low'];
const FREQUENCIES = ['Monthly', 'Quarterly', 'Semi-Annual', 'Annual'];

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

export default function CreateControlDialog({ open, onClose, onSaved, onSnackbar, obligationId = null }) {
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
      if (!body.testerOwnerId) body.testerOwnerId = null;
      const created = await api.controls.create(body);
      if (obligationId && created?.controlId) {
        await api.obligations.linkControls(obligationId, {
          linkedControlIds: [created.controlId], changeReason: 'Control created from gap finding',
        });
      }
      onSaved?.(created);
    } catch (e) { const msg = e.message || 'Failed to create control.'; setError(msg); onSnackbar?.(msg); }
    finally { setSaving(false); }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>New Control</DialogTitle>
        <DialogContent sx={{ '&&': { pt: 2.5 } }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Typography variant="overline" sx={{ display: 'block', color: 'text.secondary', fontWeight: 600, letterSpacing: '0.05em', lineHeight: 2 }}>Basic details</Typography>
          <Field label="Control name *">
            <TextField fullWidth size="small" placeholder="e.g. Segregation of duties" required value={form.name}
              onChange={e => set('name', e.target.value)} />
          </Field>
          <Field label="Description">
            <TextField fullWidth size="small" multiline minRows={2} placeholder="What this control covers"
              value={form.description} onChange={e => set('description', e.target.value)} />
          </Field>

          <Divider sx={{ my: 2 }} />
          <Typography variant="overline" sx={{ display: 'block', color: 'text.secondary', fontWeight: 600, letterSpacing: '0.05em', lineHeight: 2 }}>Classification</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
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
          <Typography variant="overline" sx={{ display: 'block', color: 'text.secondary', fontWeight: 600, letterSpacing: '0.05em', lineHeight: 2 }}>Execution</Typography>
          <Field label="What it does">
            <TextField fullWidth size="small" multiline minRows={2} placeholder="How this control is executed"
              value={form.whatItDoes} onChange={e => set('whatItDoes', e.target.value)} />
          </Field>
          <Field label="How it's tested">
            <TextField fullWidth size="small" multiline minRows={2} placeholder="How testing is performed"
              value={form.howTested} onChange={e => set('howTested', e.target.value)} />
          </Field>

          <Divider sx={{ my: 2 }} />
          <Typography variant="overline" sx={{ display: 'block', color: 'text.secondary', fontWeight: 600, letterSpacing: '0.05em', lineHeight: 2 }}>Ownership & schedule</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
            <Field label="Owner (analyst)" sx={{ mb: 0 }}>
              <OwnerPicker value={form.controlOwnerId} onChange={id => set('controlOwnerId', id)} label="Compliance owner" />
            </Field>
            <Field label="Responsible person (tester)" sx={{ mb: 0 }}>
              <OwnerPicker value={form.testerOwnerId} onChange={id => set('testerOwnerId', id)} label="Who performs the test" />
            </Field>
          </Box>
          <Box sx={{ mt: 2 }}>
            <Field label="Test frequency" sx={{ mb: 0 }}>
              <TextField select fullWidth size="small" value={form.testFrequency} onChange={e => set('testFrequency', e.target.value)}>
                <MenuItem value=""><em>Select frequency</em></MenuItem>
                {FREQUENCIES.map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
              </TextField>
            </Field>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.name}>
            {saving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}