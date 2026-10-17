import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Table, TableHead,
  TableBody, TableRow, TableCell, TableContainer, Paper, TextField, Box,
  Typography, CircularProgress, InputAdornment, Checkbox,
} from '@mui/material';
import { MagnifyingGlassIcon, PlusIcon, TL } from 'shared';
import { api } from '../../services/api';

export default function LinkControlsModal({ open, onClose, obligationId, initialIds = [], onSaved, onError }) {
  const [controls, setControls] = useState([]);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected([...(initialIds || [])]);
      setSearch('');
      setLoading(true);
      api.platform.controls?.list()
        .then(d => setControls(Array.isArray(d) ? d : (d.content || [])))
        .catch(() => onError?.('Failed to load controls.'))
        .finally(() => setLoading(false));
    }
  }, [open, initialIds]);

  async function handleSave() {
    setLoading(true);
    try {
      await api.platform.obligations.linkControls?.(obligationId, {
        linkedControlIds: selected,
        changeReason: 'Controls updated',
      });
      onSaved?.();
      onClose();
    } catch (e) { onError?.(e.message || 'Failed to save controls.'); }
    finally { setLoading(false); }
  }

  const toggle = id => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const filtered = controls.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.controlId || c.name || '').toLowerCase().includes(q);
  });

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>Link Controls</DialogTitle>
        <DialogContent sx={{ '&&&': { pt: 2.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Box sx={{ flex: 1 }}>
              <TextField size="small" fullWidth placeholder="Search control..."
                value={search} onChange={e => setSearch(e.target.value)}
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><MagnifyingGlassIcon size={18} sx={{ color: TL.gray400 }} /></InputAdornment> } }} />
            </Box>
            <Button variant="outlined" startIcon={<PlusIcon size={16} />} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
              Add New
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
                    <TableCell align="right">Select</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map(c => (
                    <TableRow key={c.controlId} hover selected={selected.includes(c.controlId)}
                      onClick={() => toggle(c.controlId)} sx={{ cursor: 'pointer' }}>
                      <TableCell>
                        <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: 'primary.main' }}>{c.name || 'Untitled'}</Typography>
                      </TableCell>
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
          <Button variant="outlined" onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={loading || !selected.length}>
            {loading ? <CircularProgress size={18} /> : `Save (${selected.length})`}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
