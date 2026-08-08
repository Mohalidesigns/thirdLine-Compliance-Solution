import { useState, useEffect } from 'react';
import {
  TextField, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, CircularProgress, Alert,
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
      <DialogActions sx={{ justifyContent: 'center' }}>
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
      <DialogActions sx={{ justifyContent: 'center' }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Add Team'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
