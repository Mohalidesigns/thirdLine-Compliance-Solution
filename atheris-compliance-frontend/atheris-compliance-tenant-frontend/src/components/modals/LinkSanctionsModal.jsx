import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Table, TableHead,
  TableBody, TableRow, TableCell, TableContainer, Paper, TextField, Box,
  Typography, CircularProgress, InputAdornment, Checkbox,
} from '@mui/material';
import { MagnifyingGlassIcon } from 'shared';
import { api } from '../../services/api';

export default function LinkSanctionsModal({ open, onClose, obligationId, initialIds = [], onSaved, onError }) {
  const [sanctions, setSanctions] = useState([]);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelected([...(initialIds || [])]);
    setSearch('');
    setLoading(true);
    api.sanctions.list({ size: 500 })
      .then((d) => setSanctions(Array.isArray(d) ? d : (d.content || [])))
      .catch(() => onError?.('Failed to load sanctions.'))
      .finally(() => setLoading(false));
  }, [open, initialIds]);

  async function handleSave() {
    setLoading(true);
    try {
      await api.obligations.linkSanctions(obligationId, selected);
      onSaved?.();
      onClose();
    } catch (e) {
      onError?.(e.message || 'Failed to save sanctions.');
    } finally {
      setLoading(false);
    }
  }

  const toggle = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const filtered = sanctions.filter((s) => {
    if (!search) {
      return true;
    }
    const q = search.toLowerCase();
    return (s.description || '').toLowerCase().includes(q)
      || (s.actName || '').toLowerCase().includes(q)
      || (s.penaltyDetails || '').toLowerCase().includes(q);
  });

  const penaltyOf = (s) => s.penaltyDetails || s.sanctionType || '-';

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Link Sanctions</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ mb: 1.5 }}>
          <TextField size="small" fullWidth placeholder="Search sanction or act..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><MagnifyingGlassIcon size={18} /></InputAdornment> } }} />
        </Box>

        {loading && sanctions.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress size={26} /></Box>
        ) : sanctions.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>No sanctions available.</Typography>
        ) : (
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 320 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Sanction</TableCell>
                  <TableCell padding="checkbox" sx={{ textAlign: 'right' }}>Select</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.sanctionId} hover selected={selected.includes(s.sanctionId)}
                    onClick={() => toggle(s.sanctionId)} sx={{ cursor: 'pointer' }}>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {penaltyOf(s)}
                      </Typography>
                      {s.actName && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.actName}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell padding="checkbox" sx={{ textAlign: 'right' }}>
                      <Checkbox size="small" checked={selected.includes(s.sanctionId)} onChange={() => {}} />
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
        <Button variant="contained" onClick={handleSave} disabled={loading}>
          {loading ? <CircularProgress size={18} /> : `Save (${selected.length})`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}