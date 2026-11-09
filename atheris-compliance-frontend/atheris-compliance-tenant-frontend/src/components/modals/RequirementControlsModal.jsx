import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Table, TableHead,
  TableBody, TableRow, TableCell, TableContainer, Paper, TextField, Box,
  Typography, CircularProgress, InputAdornment, Checkbox,
} from '@mui/material';
import { MagnifyingGlassIcon } from 'shared';
import { api } from '../../services/api';
import CreateControlDialog from './CreateControlDialog';

export default function RequirementControlsModal({ open, onClose, requirementId, initialIds = [], onSaved, onError }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isPending } = useQuery({
    queryKey: ['controls', 'picker'],
    queryFn: () => api.controls.list({}),
    enabled: open,
  });
  const controls = Array.isArray(data) ? data : (data?.content || []);

  useEffect(() => {
    if (open) {
      setSelected([...(initialIds || [])]);
      setSearch('');
      setCreateOpen(false);
    }
  }, [open, initialIds]);

  async function handleSave() {
    setSaving(true);
    try {
      await api.requirements.setControls(requirementId, selected);
      qc.invalidateQueries({ queryKey: ['requirements'] });
      qc.invalidateQueries({ queryKey: ['obligations'] });
      onSaved?.();
      onClose();
    } catch (e) { onError?.(e.message || 'Failed to save controls.'); }
    finally { setSaving(false); }
  }

  const toggle = (id) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleCreated = (created) => {
    const id = typeof created === 'object' ? created?.controlId : created;
    if (id) setSelected((prev) => prev.includes(id) ? prev : [...prev, id]);
    setCreateOpen(false);
    qc.invalidateQueries({ queryKey: ['controls'] });
  };

  const filtered = controls.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.controlNumber || '').toLowerCase().includes(q) || (c.name || '').toLowerCase().includes(q);
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Link controls to this requirement</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth size="small" placeholder="Search controls…" value={search}
          onChange={(e) => setSearch(e.target.value)} sx={{ mb: 2 }}
          InputProps={{ startAdornment: (<InputAdornment position="start"><MagnifyingGlassIcon size={16} /></InputAdornment>) }}
        />
        {isPending ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : (
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 420 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  <TableCell>Control</TableCell>
                  <TableCell>Owner</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.controlId} hover onClick={() => toggle(c.controlId)} sx={{ cursor: 'pointer' }}>
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={selected.includes(c.controlId)} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{c.name || c.controlNumber}</Typography>
                      <Typography variant="caption" color="text.secondary">{c.controlNumber}</Typography>
                    </TableCell>
                    <TableCell><Typography variant="body2" color="text.secondary">{c.controlOwnerName || '—'}</Typography></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setCreateOpen(true)}>New control</Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : `Save (${selected.length})`}
        </Button>
      </DialogActions>
      {createOpen && (
        <CreateControlDialog open onClose={() => setCreateOpen(false)} onSaved={handleCreated} />
      )}
    </Dialog>
  );
}