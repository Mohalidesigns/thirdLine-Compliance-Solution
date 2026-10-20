import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Alert, Grid,
} from '@mui/material';
import { api } from '../../services/api';

export default function RegulatorFormDialog({ open, onClose, regulator, onSaved }) {
  const [form, setForm] = useState({ name: '', abbreviation: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(regulator
      ? { name: regulator.name || '', abbreviation: regulator.abbreviation || '' }
      : { name: '', abbreviation: '' });
  }, [open, regulator]);

  async function handleSave() {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const saved = regulator
        ? await api.regulators.update(regulator.id, form)
        : await api.regulators.create(form);
      onSaved?.(saved || regulator);
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
          <Grid size={{ xs: 12 }}>
            <TextField label="Abbreviation" fullWidth size="small" value={form.abbreviation}
              onChange={e => setForm(f => ({ ...f, abbreviation: e.target.value }))} />
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