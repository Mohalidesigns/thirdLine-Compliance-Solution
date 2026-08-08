import { useState, useEffect } from 'react';
import {
  TextField, MenuItem, Box, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, CircularProgress, Alert, Grid,
} from '@mui/material';
import { Add } from '@mui/icons-material';
import { api } from '../../services/api';

export default function OwnerPicker({
  value, onChange, label = 'Compliance Owner', size = 'small', fullWidth = true,
  allowClear = true, disabled = false, allowQuickAdd = true, helperText, sx, onOwnerCreated,
}) {
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quickOpen, setQuickOpen] = useState(false);

  const loadOwners = () => {
    setLoading(true);
    api.org.owners()
      .then(setOwners)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadOwners(); }, []);

  return (
    <Box>
      <TextField
        select fullWidth={fullWidth} size={size} label={label} disabled={disabled}
        value={value ?? ''} helperText={helperText || error}
        onChange={e => { const v = e.target.value === '' ? null : Number(e.target.value); onChange(v); }}
        error={!!error && !helperText}
        sx={sx}
      >
        {allowClear && owners.length > 0 && <MenuItem value="">None / Unassigned</MenuItem>}
        {owners.map(o => (
          <MenuItem key={o.ownerId} value={o.ownerId}>
            {o.fullName}{o.departmentName ? ` — ${o.departmentName}` : ''}
          </MenuItem>
        ))}
        {owners.length === 0 && <MenuItem value="" disabled>No owners yet</MenuItem>}
      </TextField>
      {allowQuickAdd && (
        <Button size="small" startIcon={<Add />} sx={{ mt: 0.5 }}
          onClick={() => { setError(''); setQuickOpen(true); }}>
          Add new owner
        </Button>
      )}

      <QuickAddOwnerDialog open={quickOpen} onClose={() => setQuickOpen(false)}
        onCreated={(owner) => { onChange(owner.ownerId); onOwnerCreated?.(owner); loadOwners(); setQuickOpen(false); }} />
    </Box>
  );
}

function QuickAddOwnerDialog({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ fullName: '', email: '', jobTitle: '', departmentId: '', teamId: '' });
  const [departments, setDepartments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm({ fullName: '', email: '', jobTitle: '', departmentId: '', teamId: '' });
      setError('');
      api.org.departments(true).then(setDepartments).catch(e => setError(e.message));
      api.org.teams().then(setTeams).catch(() => {});
    }
  }, [open]);

  const departmentTeams = form.departmentId
    ? teams.filter(t => t.departmentId === Number(form.departmentId))
    : teams;

  const handleSave = async () => {
    if (!form.fullName.trim()) { setError('Owner full name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const body = { fullName: form.fullName.trim() };
      if (form.email.trim()) body.email = form.email.trim();
      if (form.jobTitle.trim()) body.jobTitle = form.jobTitle.trim();
      if (form.departmentId) body.departmentId = Number(form.departmentId);
      if (form.teamId) body.teamId = Number(form.teamId);
      const created = await api.org.createOwner(body);
      onCreated(created);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add New Owner</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField label="Full name" fullWidth size="small" required value={form.fullName}
              onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Email" fullWidth size="small" type="email" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Job title" fullWidth size="small" value={form.jobTitle}
              onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))} />
          </Grid>
          <Grid item xs={6}>
            <TextField select label="Department" fullWidth size="small" value={form.departmentId}
              onChange={e => setForm(f => ({ ...f, departmentId: e.target.value, teamId: '' }))}>
              <MenuItem value="">None</MenuItem>
              {departments.map(d => (
                <MenuItem key={d.departmentId} value={d.departmentId}>{d.name}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6}>
            <TextField select label="Team" fullWidth size="small" value={form.teamId}
              onChange={e => setForm(f => ({ ...f, teamId: e.target.value }))}>
              <MenuItem value="">None</MenuItem>
              {departmentTeams.map(t => (
                <MenuItem key={t.teamId} value={t.teamId}>{t.name}</MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Add Owner'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
