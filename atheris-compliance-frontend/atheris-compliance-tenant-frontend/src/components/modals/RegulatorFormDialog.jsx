import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Select, FormControl, InputLabel, Button, Alert, Grid,
} from '@mui/material';
import { api } from '../../services/api';

const FREQUENCIES = ['immediate', 'daily', 'weekly'];

export default function RegulatorFormDialog({ open, onClose, regulator, onSaved }) {
  const [form, setForm] = useState({ platformRegulatorId: null, name: '', abbreviation: '', notificationFrequency: 'immediate' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(regulator
      ? { platformRegulatorId: regulator.platformRegulatorId ?? null, name: regulator.name || '', abbreviation: regulator.abbreviation || '', notificationFrequency: regulator.notificationFrequency || 'immediate' }
      : { platformRegulatorId: null, name: '', abbreviation: '', notificationFrequency: 'immediate' });
  }, [open, regulator]);

  async function handleSave() {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      if (regulator) await api.regulators.update(regulator.id, form);
      else await api.regulators.create(form);
      onSaved();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{regulator ? 'Edit Regulator' : 'Add Regulator'}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Grid container spacing={2} sx={{ mt: 0.25 }}>
          <Grid size={{ xs: 12 }}>
            <TextField label="Name" fullWidth size="small" required value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <TextField label="Abbreviation" fullWidth size="small" value={form.abbreviation}
              onChange={e => setForm(f => ({ ...f, abbreviation: e.target.value }))} />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <TextField label="Platform Regulator ID" type="number" fullWidth size="small"
              value={form.platformRegulatorId ?? ''}
              helperText="Optional — links to a central platform regulator"
              onChange={e => setForm(f => ({ ...f, platformRegulatorId: e.target.value ? Number(e.target.value) : null }))} />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Notification Frequency</InputLabel>
              <Select value={form.notificationFrequency} label="Notification Frequency"
                onChange={e => setForm(f => ({ ...f, notificationFrequency: e.target.value }))}>
                {FREQUENCIES.map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : regulator ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}