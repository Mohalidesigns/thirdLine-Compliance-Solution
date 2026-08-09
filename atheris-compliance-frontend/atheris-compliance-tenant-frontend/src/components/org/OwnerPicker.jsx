import { useState, useEffect } from 'react';
import {
  TextField, MenuItem, Box, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, CircularProgress, Alert,
} from '@mui/material';
import { Add } from '@mui/icons-material';
import { api } from '../../services/api';
import { QuickAddDepartmentDialog, QuickAddTeamDialog } from './QuickAddDialogs';

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
  const [deptOpen, setDeptOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);

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

  const reload = () => {
    api.org.departments(true).then(setDepartments).catch(() => {});
    api.org.teams().then(setTeams).catch(() => {});
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add New Owner</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="Full name" fullWidth size="small" required value={form.fullName}
            onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
          <TextField label="Email" fullWidth size="small" type="email" value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          <TextField label="Job title" fullWidth size="small" value={form.jobTitle}
            onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))} />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ flex: 1 }}>
              <TextField select label="Department" fullWidth size="small" value={form.departmentId}
                onChange={e => setForm(f => ({ ...f, departmentId: e.target.value, teamId: '' }))}>
                {form.departmentId !== '' && <MenuItem value="">None</MenuItem>}
                {departments.map(d => (
                  <MenuItem key={d.departmentId} value={String(d.departmentId)}>{d.name}</MenuItem>
                ))}
                {departments.length === 0 && <MenuItem value="" disabled>No departments yet</MenuItem>}
              </TextField>
            </Box>
            <Button size="small" variant="outlined" startIcon={<Add />} sx={{ width: 170, whiteSpace: 'nowrap' }}
              onClick={() => { setError(''); setDeptOpen(true); }}>
              {departments.length === 0 ? 'Add department' : 'Add new department'}
            </Button>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ flex: 1 }}>
              <TextField select label="Team" fullWidth size="small" value={form.teamId}
                onChange={e => setForm(f => ({ ...f, teamId: e.target.value }))}>
                {form.teamId !== '' && <MenuItem value="">None</MenuItem>}
                {departmentTeams.map(t => (
                  <MenuItem key={t.teamId} value={String(t.teamId)}>{t.name}</MenuItem>
                ))}
                {departmentTeams.length === 0 && (
                  <MenuItem value="" disabled>
                    {form.departmentId ? 'No teams in this department' : 'Select a department first'}
                  </MenuItem>
                )}
              </TextField>
            </Box>
            <Button size="small" variant="outlined" startIcon={<Add />} sx={{ width: 170, whiteSpace: 'nowrap' }} disabled={!form.departmentId}
              onClick={() => { setError(''); setTeamOpen(true); }}>
              {departmentTeams.length === 0 ? 'Add team' : 'Add new team'}
            </Button>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'center' }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Add Owner'}
        </Button>
      </DialogActions>

      <QuickAddDepartmentDialog open={deptOpen} onClose={() => setDeptOpen(false)}
        onCreated={(d) => { reload(); setForm(f => ({ ...f, departmentId: String(d.departmentId), teamId: '' })); setDeptOpen(false); }} />
      <QuickAddTeamDialog open={teamOpen} onClose={() => setTeamOpen(false)} departmentId={form.departmentId}
        onCreated={(t) => { reload(); setForm(f => ({ ...f, teamId: String(t.teamId) })); setTeamOpen(false); }} />
    </Dialog>
  );
}
