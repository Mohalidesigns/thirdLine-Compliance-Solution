import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Checkbox,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Paper, TextField, Box, Typography, CircularProgress, InputAdornment,
} from '@mui/material';
import { MagnifyingGlassIcon, PlusIcon } from 'shared';
import { api } from '../../services/api';
import CreateControlDialog from './CreateControlDialog';

export default function LinkControlsPicker({ open, onClose, initialIds = [], onSave }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isPending } = useQuery({
    queryKey: ['controls', 'picker'],
    queryFn: () => api.controls.list({}),
    enabled: open,
  });
  const rows = Array.isArray(data) ? data : (data?.content || []);

  useEffect(() => {
    if (open) {
      setSelected([...(initialIds || [])]);
      setSearch('');
      setCreateOpen(false);
    }
  }, [open, initialIds]);

  const handleCreated = (created) => {
    setCreateOpen(false);
    const id = typeof created === 'object' ? created?.controlId : created;
    if (id) setSelected(prev => prev.includes(id) ? prev : [...prev, id]);
    qc.invalidateQueries({ queryKey: ['controls'] });
  };

  const toggle = id => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const filtered = rows.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.controlNumber || '').toLowerCase().includes(q)
      || (c.name || '').toLowerCase().includes(q)
      || (c.theme || '').toLowerCase().includes(q);
  });

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>Link Controls</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Box sx={{ flex: 1 }}>
              <TextField size="small" fullWidth placeholder="Search control number, name or theme..."
                value={search} onChange={e => setSearch(e.target.value)}
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><MagnifyingGlassIcon size={18} /></InputAdornment> } }} />
            </Box>
            <Button size="small" variant="outlined" startIcon={<PlusIcon size={16} />} sx={{ width: 170, whiteSpace: 'nowrap' }}
              onClick={() => setCreateOpen(true)}>
              Add New Control
            </Button>
          </Box>
          {isPending ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress size={26} /></Box>
          ) : rows.length === 0 ? (
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
                        <Typography variant="body2">{c.name || 'Control'}</Typography>
                      </TableCell>
                      <TableCell>{c.theme || c.controlType || '-'}</TableCell>
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
          <Button variant="contained" onClick={() => { onSave?.(selected); onClose(); }}>
            Save ({selected.length})
          </Button>
        </DialogActions>
      </Dialog>

      {createOpen && <CreateControlDialog open onClose={() => setCreateOpen(false)} onSaved={handleCreated} />}
    </>
  );
}
