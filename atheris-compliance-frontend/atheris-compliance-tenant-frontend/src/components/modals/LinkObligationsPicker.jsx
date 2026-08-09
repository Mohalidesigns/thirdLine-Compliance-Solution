import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Checkbox,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Paper, TextField, Box, Typography, CircularProgress, InputAdornment,
} from '@mui/material';
import { Search } from '@mui/icons-material';
import { api } from '../../services/api';

export default function LinkObligationsPicker({ open, onClose, initialIds = [], onSave }) {
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected([...(initialIds || [])]);
      setSearch('');
      setLoading(true);
      api.obligations.register({ size: 1000 })
        .then(res => {
          const items = Array.isArray(res) ? res : (res.content || []);
          setRows(items);
        })
        .catch(() => setRows([]))
        .finally(() => setLoading(false));
    }
  }, [open, initialIds]);

  const toggle = id => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const filtered = rows.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.description || '').toLowerCase().includes(q)
      || String(r.obligationNumber || '').toLowerCase().includes(q)
      || (r.sectionReference || '').toLowerCase().includes(q)
      || (r.regulatorName || '').toLowerCase().includes(q)
      || (r.regulatorAbbreviation || '').toLowerCase().includes(q)
      || (r.sourceTitle || '').toLowerCase().includes(q);
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Link Obligations</DialogTitle>
      <DialogContent dividers>
        <TextField size="small" fullWidth placeholder="Search obligation, section or regulator..."
          value={search} onChange={e => setSearch(e.target.value)} sx={{ mb: 1.5 }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18 }} /></InputAdornment> } }} />
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress size={26} /></Box>
        ) : rows.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>No obligations available.</Typography>
        ) : (
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 320 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Obligation</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Regulator</TableCell>
                  <TableCell padding="checkbox" sx={{ fontWeight: 600, textAlign: 'right' }}>Select</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map(r => (
                  <TableRow key={r.obligationId} hover selected={selected.includes(r.obligationId)}
                    onClick={() => toggle(r.obligationId)} sx={{ cursor: 'pointer' }}>
                    <TableCell>
                      <Typography variant="body2">{r.description || `Obligation #${r.obligationNumber}`}</Typography>
                      <Typography variant="caption" color="text.secondary">{r.sourceTitle || ''}</Typography>
                    </TableCell>
                    <TableCell>{r.regulatorAbbreviation || r.regulatorName || '-'}</TableCell>
                    <TableCell padding="checkbox" sx={{ textAlign: 'right' }}>
                      <Checkbox size="small" checked={selected.includes(r.obligationId)} onChange={() => {}} />
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
