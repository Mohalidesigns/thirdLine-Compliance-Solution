import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Table, TableHead,
  TableBody, TableRow, TableCell, TableContainer, Paper, TextField, Box,
  Typography, CircularProgress, InputAdornment, Checkbox,
} from '@mui/material';
import { MagnifyingGlassIcon, PlusIcon } from 'shared';
import { api } from '../../services/api';
import CreateControlDialog from './CreateControlDialog';

export default function LinkControlsModal({ open, onClose, obligationId, initialIds = [], onSaved, onError }) {
  const [controls, setControls] = useState([]);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected([...(initialIds || [])]);
      setSearch('');
      setLoading(true);
      api.controls.list({})
        .then(d => setControls(Array.isArray(d) ? d : (d.content || [])))
        .catch(() => onError?.('Failed to load controls.'))
        .finally(() => setLoading(false));
    }
  }, [open, initialIds]);

  async function handleSave() {
    setLoading(true);
    try {
      await api.obligations.linkControls(obligationId, {
        linkedControlIds: selected,
        changeReason: 'Controls updated',
      });
      onSaved?.();
      onClose();
    } catch (e) { onError?.(e.message || 'Failed to save controls.'); }
    finally { setLoading(false); }
  }

  const toggle = id => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleCreated = (created) => {
    if (created?.controlId) setControls(prev => [...prev, created]);
    setCreateOpen(false);
  };

  const filtered = controls.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.controlNumber || '').toLowerCase().includes(q)
      || (c.name || '').toLowerCase().includes(q);
  });

  const themeOf = c => c.theme || c.controlType || '-';

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>Link Controls</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Box sx={{ flex: 1 }}>
              <TextField size="small" fullWidth placeholder="Search control number or name..."
                value={search} onChange={e => setSearch(e.target.value)}
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><MagnifyingGlassIcon size={18} /></InputAdornment> } }} />
            </Box>
            <Button size="small" variant="outlined" startIcon={<PlusIcon size={16} />} sx={{ width: 170, whiteSpace: 'nowrap' }}
              onClick={() => setCreateOpen(true)}>
              Add New Control
            </Button>
          </Box>

          {loading && controls.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress size={26} /></Box>
          ) : controls.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>No controls available.</Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 320 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Control</TableCell>
                    <TableCell>Theme / Type</TableCell>
                    <TableCell padding="checkbox" sx={{ textAlign: 'right' }}>Select</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map(c => (
                    <TableRow key={c.controlId} hover selected={selected.includes(c.controlId)}
                      onClick={() => toggle(c.controlId)} sx={{ cursor: 'pointer' }}>
                      <TableCell>
                        <Typography variant="body2">{c.controlNumber} — {c.name}</Typography>
                      </TableCell>
                      <TableCell>{themeOf(c)}</TableCell>
                      <TableCell padding="checkbox" sx={{ textAlign: 'right' }}>
                        <Checkbox size="small" checked={selected.includes(c.controlId)} onChange={() => {}} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={loading || !selected.length}>
            {loading ? <CircularProgress size={18} /> : `Save (${selected.length})`}
          </Button>
        </DialogActions>
      </Dialog>

      <CreateControlDialog open={createOpen} onClose={() => setCreateOpen(false)}
        onSaved={handleCreated} onSnackbar={onError} />
    </>
  );
}