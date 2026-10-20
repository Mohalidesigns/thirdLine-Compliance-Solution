import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Checkbox,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Paper, TextField, Box, Typography, CircularProgress, InputAdornment,
} from '@mui/material';
import { MagnifyingGlassIcon } from 'shared';
import { api } from '../../services/api';

export default function LinkControlsPicker({ open, onClose, initialIds = [], onSave }) {
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    api.controls.list({})
      .then(d => setRows(Array.isArray(d) ? d : (d.content || [])))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (open) {
      setSelected([...(initialIds || [])]);
      setSearch('');
      load();
    }
  }, [open, initialIds]);

  const toggle = id => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const filtered = rows.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.controlNumber || '').toLowerCase().includes(q)
      || (c.name || '').toLowerCase().includes(q)
      || (c.theme || '').toLowerCase().includes(q);
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Link Controls</DialogTitle>
      <DialogContent dividers>
        <TextField size="small" fullWidth placeholder="Search control number, name or theme..."
          value={search} onChange={e => setSearch(e.target.value)} sx={{ mb: 1.5 }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><MagnifyingGlassIcon size={18} /></InputAdornment> } }} />
        {loading ? (
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
  );
}