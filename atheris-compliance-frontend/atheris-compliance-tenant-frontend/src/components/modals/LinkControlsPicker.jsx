import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Checkbox,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Paper, TextField, Box, Typography, CircularProgress, InputAdornment,
} from '@mui/material';
import { Search } from '@mui/icons-material';
import { api } from '../../services/api';

export default function LinkControlsPicker({ open, onClose, initialIds = [], onSave }) {
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected([...(initialIds || [])]);
      setSearch('');
      setLoading(true);
      api.controls.list({})
        .then(d => setRows(Array.isArray(d) ? d : (d.content || [])))
        .catch(() => setRows([]))
        .finally(() => setLoading(false));
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
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18 }} /></InputAdornment> } }} />
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress size={26} /></Box>
        ) : rows.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>No controls available.</Typography>
        ) : (
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 320 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Control</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Theme / Type</TableCell>
                  <TableCell padding="checkbox" sx={{ fontWeight: 600, textAlign: 'right' }}>Select</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map(c => (
                  <TableRow key={c.controlId} hover selected={selected.includes(c.controlId)}
                    onClick={() => toggle(c.controlId)} sx={{ cursor: 'pointer' }}>
                    <TableCell>
                      <Typography variant="body2">{c.controlNumber} — {c.name}</Typography>
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
      <DialogActions sx={{ justifyContent: 'center' }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => { onSave?.(selected); onClose(); }}>
          Save ({selected.length})
        </Button>
      </DialogActions>
    </Dialog>
  );
}