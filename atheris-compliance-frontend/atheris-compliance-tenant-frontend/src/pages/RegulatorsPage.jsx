import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Select, MenuItem, FormControl, InputLabel,
  CircularProgress, Alert, Switch, Tooltip,
} from '@mui/material';
import { Add, Edit, Delete, Refresh } from '@mui/icons-material';
import { api } from '../services/api';

const FREQUENCIES = ['immediate', 'daily', 'weekly'];

export default function RegulatorsPage() {
  const [regulators, setRegulators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ platformRegulatorId: null, name: '', abbreviation: '', notificationFrequency: 'immediate', isActive: true });

  async function load() {
    setLoading(true);
    try {
      const data = await api.regulators.list();
      setRegulators(data);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ platformRegulatorId: null, name: '', abbreviation: '', notificationFrequency: 'immediate', isActive: true });
    setDialogOpen(true);
  }

  function openEdit(r) {
    setEditing(r);
    setForm({ platformRegulatorId: r.platformRegulatorId, name: r.name, abbreviation: r.abbreviation, notificationFrequency: r.notificationFrequency || 'immediate', isActive: r.isActive });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await api.regulators.update(editing.id, form);
      } else {
        await api.regulators.create(form);
      }
      setDialogOpen(false);
      await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!confirm('Remove this regulator?')) return;
    try {
      await api.regulators.remove(id);
      await load();
    } catch (err) { setError(err.message); }
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4">Regulators</Typography>
          <Typography variant="body2" color="text.secondary">Manage your regulatory subscriptions</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh"><IconButton onClick={load}><Refresh /></IconButton></Tooltip>
          <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Add Regulator</Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Card>
        <TableContainer component={Paper} elevation={0}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Abbreviation</TableCell>
                <TableCell>Frequency</TableCell>
                <TableCell>Active</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {regulators.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>No regulators subscribed. Click "Add Regulator" to begin.</TableCell></TableRow>
              ) : regulators.map(r => (
                <TableRow key={r.id}>
                  <TableCell sx={{ fontWeight: 500 }}>{r.name}</TableCell>
                  <TableCell>{r.abbreviation}</TableCell>
                  <TableCell><Chip size="small" label={r.notificationFrequency || 'immediate'} /></TableCell>
                  <TableCell><Switch checked={r.isActive} size="small" onChange={async () => { await api.regulators.update(r.id, { ...r, isActive: !r.isActive }); await load(); }} /></TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => openEdit(r)}><Edit fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => handleDelete(r.id)}><Delete fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Regulator' : 'Add Regulator'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth size="small" label="Name" required value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} sx={{ mt: 1, mb: 2 }} />
          <TextField fullWidth size="small" label="Abbreviation" value={form.abbreviation}
            onChange={e => setForm(f => ({ ...f, abbreviation: e.target.value }))} sx={{ mb: 2 }} />
          <TextField fullWidth size="small" label="Platform Regulator ID" type="number"
            value={form.platformRegulatorId || ''}
            onChange={e => setForm(f => ({ ...f, platformRegulatorId: e.target.value ? Number(e.target.value) : null }))}
            helperText="Optional — links to a central platform regulator" sx={{ mb: 2 }} />
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Notification Frequency</InputLabel>
            <Select value={form.notificationFrequency} label="Notification Frequency"
              onChange={e => setForm(f => ({ ...f, notificationFrequency: e.target.value }))}>
              {FREQUENCIES.map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={18} /> : editing ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
