import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Checkbox,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Paper, TextField, Box, Typography, CircularProgress, InputAdornment,
} from '@mui/material';
import { Search, Add } from '@mui/icons-material';
import { api } from '../../services/api';
import CreateReturnDialog from './CreateReturnDialog';

export default function ReturnPicker({ open, onClose, initialIds = [], onSave }) {
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected([...(initialIds || [])]);
      setSearch('');
      setLoading(true);
      api.returns.list()
        .then(d => setRows(Array.isArray(d) ? d : (d.content || [])))
        .catch(() => setRows([]))
        .finally(() => setLoading(false));
    }
  }, [open, initialIds]);

  const toggle = id => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleCreated = () => {
    setCreateOpen(false);
    setLoading(true);
    api.returns.list()
      .then(d => setRows(Array.isArray(d) ? d : (d.content || [])))
      .finally(() => setLoading(false));
  };

  const filtered = rows.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.returnName || '').toLowerCase().includes(q)
      || (r.filingRegulator || '').toLowerCase().includes(q)
      || (r.returnType || '').toLowerCase().includes(q);
  });

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
        <DialogTitle>Map Return Required</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Box sx={{ flex: 1 }}>
              <TextField size="small" fullWidth placeholder="Search return name, regulator or type..."
                value={search} onChange={e => setSearch(e.target.value)}
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18 }} /></InputAdornment> } }} />
            </Box>
            <Button size="small" variant="outlined" startIcon={<Add />} sx={{ width: 170, whiteSpace: 'nowrap' }}
              onClick={() => setCreateOpen(true)}>
              Add New Return
            </Button>
          </Box>

          {loading && rows.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress size={26} /></Box>
          ) : rows.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>No returns configured yet.</Typography>
          ) : filtered.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>No returns match your search.</Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 360 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Return</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Regulator</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Frequency</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Owner</TableCell>
                    <TableCell padding="checkbox" sx={{ fontWeight: 600, textAlign: 'right' }}>Select</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map(r => (
                    <TableRow key={r.returnId} hover selected={selected.includes(r.returnId)}
                      onClick={() => toggle(r.returnId)} sx={{ cursor: 'pointer' }}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{r.returnName}</Typography>
                        {r.status === 'Inactive' && (
                          <Typography variant="caption" color="text.disabled">Inactive</Typography>
                        )}
                      </TableCell>
                      <TableCell>{r.filingRegulator || '-'}</TableCell>
                      <TableCell>{r.returnType || '-'}</TableCell>
                      <TableCell>{r.frequency || '-'}</TableCell>
                      <TableCell>{r.returnOwnerName || '-'}</TableCell>
                      <TableCell padding="checkbox" sx={{ textAlign: 'right' }}>
                        <Checkbox size="small" checked={selected.includes(r.returnId)} onChange={() => {}} />
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
          <Button variant="contained" disabled={!selected.length}
            onClick={() => { onSave?.(selected); onClose(); }}>
            Save ({selected.length})
          </Button>
        </DialogActions>
      </Dialog>

      <CreateReturnDialog open={createOpen} onClose={() => setCreateOpen(false)}
        onSaved={handleCreated} onSnackbar={() => {}} />
    </>
  );
}