import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Table, TableHead,
  TableBody, TableRow, TableCell, TableContainer, Paper, TextField, Box,
  Typography, CircularProgress, InputAdornment, Checkbox,
} from '@mui/material';
import { MagnifyingGlassIcon, TL } from 'shared';
import { api } from '../../services/api';

export default function MapReturnModal({ open, onClose, obligationId, initialIds = [], onSaved, onError }) {
  const [returns, setReturns] = useState([]);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected([...(initialIds || [])]);
      setSearch('');
      setLoading(true);
      api.platform.returns?.list()
        .then(d => setReturns(Array.isArray(d) ? d : (d.content || [])))
        .catch(() => onError?.('Failed to load returns.'))
        .finally(() => setLoading(false));
    }
  }, [open, initialIds]);

  async function handleSave() {
    setLoading(true);
    try {
      await api.platform.obligations.linkReturns?.(obligationId, selected);
      onSaved?.();
      onClose();
    } catch (e) { onError?.(e.message || 'Failed to map returns.'); }
    finally { setLoading(false); }
  }

  const toggle = id => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const filtered = returns.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.returnName || r.title || r.returnId || '').toLowerCase().includes(q);
  });

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>Map Returns</DialogTitle>
        <DialogContent sx={{ '&&&': { pt: 2.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Box sx={{ flex: 1 }}>
              <TextField size="small" fullWidth placeholder="Search returns..."
                value={search} onChange={e => setSearch(e.target.value)}
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><MagnifyingGlassIcon size={18} sx={{ color: TL.gray400 }} /></InputAdornment> } }} />
            </Box>
          </Box>
          {loading && returns.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress size={26} /></Box>
          ) : returns.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>No returns available.</Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 320 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Return</TableCell>
                    <TableCell align="right">Select</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map(r => (
                    <TableRow key={r.returnId} hover selected={selected.includes(r.returnId)}
                      onClick={() => toggle(r.returnId)} sx={{ cursor: 'pointer' }}>
                      <TableCell>
                        <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: 'primary.main' }}>{r.returnName || r.title || 'Untitled'}</Typography>
                        {r.frequency && <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>{r.frequency}</Typography>}
                      </TableCell>
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
