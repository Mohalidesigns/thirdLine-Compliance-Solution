import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Table, TableHead,
  TableBody, TableRow, TableCell, TableContainer, Paper, TextField, Box,
  Typography, CircularProgress, InputAdornment, Checkbox, FormControlLabel, Divider,
} from '@mui/material';
import { MagnifyingGlassIcon, PlusIcon } from 'shared';
import { api } from '../../services/api';
import CreateControlDialog from './CreateControlDialog';

export default function LinkControlsModal({ open, onClose, obligationId, initialIds = [], onSaved, onError }) {
  const qc = useQueryClient();
  const [selectedReqs, setSelectedReqs] = useState([]);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isPending } = useQuery({
    queryKey: ['controls', 'picker'],
    queryFn: () => api.controls.list({}),
    enabled: open,
  });
  const controls = Array.isArray(data) ? data : (data?.content || []);

  const { data: reqData, isPending: reqPending } = useQuery({
    queryKey: ['requirements', 'byObligation', String(obligationId)],
    queryFn: ({ signal }) => api.requirements.forObligation(obligationId, { signal }),
    enabled: open && obligationId != null,
  });
  const requirements = reqData || [];

  useEffect(() => {
    if (open) {
      setSearch('');
      setCreateOpen(false);
      setSelected([...(initialIds || [])]);
      setSelectedReqs([]);
    }
  }, [open, initialIds, obligationId]);

  useEffect(() => {
    if (open && Array.isArray(reqData)) {
      const covered = reqData.filter((r) => (r.controls || []).length > 0);
      setSelectedReqs(covered.map((r) => r.requirementId));
    }
  }, [open, reqData]);

  async function handleSave() {
    setSaving(true);
    try {
      await api.obligations.linkControls(obligationId, {
        requirementIds: selectedReqs,
        linkedControlIds: selected,
        changeReason: 'Requirements and controls updated',
      });
      onSaved?.();
      onClose();
    } catch (e) { onError?.(e.message || 'Failed to save controls.'); }
    finally { setSaving(false); }
  }

  const toggle = id => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleReq = id => setSelectedReqs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleCreated = (created) => {
    const id = typeof created === 'object' ? created?.controlId : created;
    if (id) setSelected(prev => prev.includes(id) ? prev : [...prev, id]);
    setCreateOpen(false);
    qc.invalidateQueries({ queryKey: ['controls'] });
  };

  const filtered = controls.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.controlNumber || '').toLowerCase().includes(q)
      || (c.name || '').toLowerCase().includes(q);
  });

  const themeOf = c => c.theme || c.controlType || '-';
  const reqLabel = (r) => `${(r.ordinal ?? 0) + 1}. ${truncate(r.text, 70)}`;

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
        <DialogTitle>Link Controls</DialogTitle>
        <DialogContent dividers>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Requirements</Typography>
          {reqPending ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={20} /></Box>
          ) : requirements.length === 0 ? (
            <Typography color="text.secondary" sx={{ mb: 2 }}>This obligation has no requirements.</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0, mb: 2 }}>
              {requirements.map((r) => (
                <FormControlLabel key={r.requirementId}
                  control={<Checkbox size="small" checked={selectedReqs.includes(r.requirementId)}
                    onChange={() => toggleReq(r.requirementId)} />}
                  label={<Typography variant="body2">{reqLabel(r)}</Typography>} />
              ))}
            </Box>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            The controls you select below will be linked to every requirement you tick above.
          </Typography>

          <Divider sx={{ mb: 2 }} />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Box sx={{ flex: 1 }}>
              <TextField size="small" fullWidth placeholder="Search control number or name..."
                value={search} onChange={e => setSearch(e.target.value)}
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><MagnifyingGlassIcon size={18} /></InputAdornment> } }} />
            </Box>
            <Button size="small" variant="outlined" startIcon={<PlusIcon size={16} />} sx={{ whiteSpace: 'nowrap' }}
              onClick={() => setCreateOpen(true)}>
              Add New Control
            </Button>
          </Box>

          {isPending && controls.length === 0 ? (
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
                        <Typography variant="body2">{c.name || 'Control'}</Typography>
                        <Typography variant="caption" color="text.secondary">{c.controlNumber}</Typography>
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
          <Button variant="contained" onClick={handleSave} disabled={saving || selectedReqs.length === 0}>
            {saving ? <CircularProgress size={18} /> : `Save (${selected.length} control${selected.length === 1 ? '' : 's'} × ${selectedReqs.length} requirement${selectedReqs.length === 1 ? '' : 's'})`}
          </Button>
        </DialogActions>
      </Dialog>

      {createOpen && <CreateControlDialog open onClose={() => setCreateOpen(false)}
        onSaved={handleCreated} onSnackbar={onError} />}
    </>
  );
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}