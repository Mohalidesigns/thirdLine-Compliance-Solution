import { useState, useEffect } from 'react';
import {
  TextField, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, CircularProgress, Alert, Box, MenuItem,
} from '@mui/material';
import { api } from '../../services/api';

export function QuickAddDepartmentDialog({ open, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setName(''); setError(''); }
  }, [open]);

  const handleSave = async () => {
    if (!name.trim()) { setError('Department name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const created = await api.org.createDepartment({ name: name.trim() });
      onCreated(created);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Add Department</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField label="Name" fullWidth size="small" required autoFocus value={name}
          onChange={e => setName(e.target.value)} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Add Department'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function QuickAddTeamDialog({ open, onClose, departmentId, onCreated }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setName(''); setError(''); }
  }, [open]);

  const handleSave = async () => {
    if (!name.trim()) { setError('Team name is required'); return; }
    if (!departmentId) { setError('Select a department first'); return; }
    setSaving(true);
    setError('');
    try {
      const created = await api.org.createTeam({ name: name.trim(), departmentId: Number(departmentId) });
      onCreated(created);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Add Team</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField label="Team name" fullWidth size="small" required autoFocus value={name}
          onChange={e => setName(e.target.value)} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Add Team'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function QuickAddTitleDialog({ open, onClose, onCreated, departments = [], units = [] }) {
  const [form, setForm] = useState({ name: '', defaultDepartmentId: '', defaultUnitId: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setForm({ name: '', defaultDepartmentId: '', defaultUnitId: '' }); setError(''); }
  }, [open]);

  const deptUnits = form.defaultDepartmentId
    ? units.filter(u => u.departmentId === Number(form.defaultDepartmentId))
    : [];

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Title name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const body = { name: form.name.trim() };
      if (form.defaultDepartmentId) body.defaultDepartmentId = Number(form.defaultDepartmentId);
      if (form.defaultUnitId) body.defaultUnitId = Number(form.defaultUnitId);
      const created = await api.stakeholderTitles.create(body);
      onCreated(created);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Add Title</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="Title name" fullWidth size="small" required autoFocus value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <TextField select label="Default department (optional)" fullWidth size="small" value={form.defaultDepartmentId}
            onChange={e => setForm(f => ({ ...f, defaultDepartmentId: e.target.value, defaultUnitId: '' }))}>
            <MenuItem value="">None</MenuItem>
            {departments.map(d => <MenuItem key={d.departmentId} value={String(d.departmentId)}>{d.name}</MenuItem>)}
          </TextField>
          <TextField select label="Default unit (optional)" fullWidth size="small" value={form.defaultUnitId}
            disabled={!form.defaultDepartmentId}
            onChange={e => setForm(f => ({ ...f, defaultUnitId: e.target.value }))}>
            <MenuItem value="">None</MenuItem>
            {deptUnits.map(u => <MenuItem key={u.teamId} value={String(u.teamId)}>{u.name}</MenuItem>)}
          </TextField>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Add Title'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
