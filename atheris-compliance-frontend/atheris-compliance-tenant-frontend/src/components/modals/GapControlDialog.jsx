import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Paper,
  TextField, InputAdornment, Radio, CircularProgress,
} from '@mui/material';
import { MagnifyingGlassIcon, PlusIcon } from 'shared';
import { api } from '../../services/api';
import CreateControlDialog from './CreateControlDialog';

export default function GapControlDialog({ open, onClose, obligationId, currentControlId, onLinked, onSnackbar }) {
  const [controls, setControls] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected(currentControlId ?? null);
      setSearch('');
      setLoading(true);
      api.controls.register({ size: 200 })
        .then((d) => setControls(Array.isArray(d) ? d : (d.content || [])))
        .catch(() => setControls([]))
        .finally(() => setLoading(false));
    }
  }, [open, currentControlId]);

  const handleLink = async () => {
    setSaving(true);
    try {
      await onLinked(selected);
    } finally { setSaving(false); }
  };

  const handleCreated = async (created) => {
    setCreateOpen(false);
    if (created?.controlId) {
      setControls((prev) => [...prev, created]);
      setSelected(created.controlId);
      await onLinked(created.controlId);
    }
  };

  const filtered = controls.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.controlNumber || '').toLowerCase().includes(q)
      || (c.name || '').toLowerCase().includes(q)
      || (c.theme || '').toLowerCase().includes(q);
  });

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>Control for this obligation</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This gap is remediated by creating a control that covers the obligation. Create a new
            control, or pick an existing one.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
            <TextField fullWidth size="small" placeholder="Search controls…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><MagnifyingGlassIcon size={16} /></InputAdornment> }} />
            <Button variant="outlined" startIcon={<PlusIcon size={16} />} onClick={() => setCreateOpen(true)}>
              New control
            </Button>
          </Box>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
          ) : filtered.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
              No controls yet. Use “New control” to create one covering this obligation.
            </Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 380 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell>Control</TableCell>
                    <TableCell>Owner</TableCell>
                    <TableCell>Theme</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.controlId} hover selected={selected === c.controlId}
                      sx={{ cursor: 'pointer' }} onClick={() => setSelected(c.controlId)}>
                      <TableCell padding="checkbox">
                        <Radio size="small" checked={selected === c.controlId} onChange={() => setSelected(c.controlId)} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'text.secondary' }}>
                          {c.controlNumber || ''}
                        </Typography>
                        <Typography variant="body2">{c.name}</Typography>
                      </TableCell>
                      <TableCell>{c.ownerName || c.controlOwnerName || '-'}</TableCell>
                      <TableCell>{c.theme || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={onClose}>Cancel</Button>
          <Button variant="contained" disabled={selected == null || saving} onClick={handleLink}>
            {saving ? 'Linking…' : 'Link control to obligation'}
          </Button>
        </DialogActions>
      </Dialog>

      {createOpen && (
        <CreateControlDialog open onClose={() => setCreateOpen(false)}
          obligationId={obligationId} onSaved={handleCreated} onSnackbar={onSnackbar} />
      )}
    </>
  );
}