import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Checkbox,
  FormControlLabel, Typography, CircularProgress, Box, TextField,
} from '@mui/material';
import { api } from '../../services/api';

export default function LinkControlsModal({ open, onClose, obligationId, initialIds = [], onSaved, onError }) {
  const [controls, setControls] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [changeReason, setChangeReason] = useState('');

  useEffect(() => {
    if (open) {
      setSelected([...(initialIds || [])]);
      setChangeReason('');
      setLoading(true);
      api.controls.list({})
        .then(d => setControls(Array.isArray(d) ? d : (d.content || [])))
        .catch(() => onError?.('Failed to load controls.'))
        .finally(() => setLoading(false));
    }
  }, [open, initialIds]);

  async function handleSave() {
    setLoading(true);
    try {
      await api.obligations.linkControls(obligationId, {
        linkedControlIds: selected,
        changeReason: changeReason || 'Controls updated',
      });
      onSaved?.();
      onClose();
    } catch (e) { onError?.(e.message || 'Failed to save controls.'); }
    finally { setLoading(false); }
  }

  const toggle = id => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Link Controls</DialogTitle>
      <DialogContent dividers>
        {loading && controls.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={26} /></Box>
        ) : controls.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 2 }}>No controls available. Create controls first.</Typography>
        ) : (
          <Box sx={{ maxHeight: 340, overflow: 'auto' }}>
            {controls.map(c => (
              <FormControlLabel key={c.controlId} sx={{ width: '100%', m: 0, py: 0.5 }}
                control={<Checkbox size="small" checked={selected.includes(c.controlId)} onChange={() => toggle(c.controlId)} />}
                label={<Typography variant="body2">{c.controlNumber} — {c.name}</Typography>} />
            ))}
          </Box>
        )}
        <TextField size="small" fullWidth multiline rows={2} label="Reason for update (optional)"
          value={changeReason} onChange={e => setChangeReason(e.target.value)} sx={{ mt: 2 }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={loading || !selected.length}>
          {loading ? <CircularProgress size={18} /> : `Save (${selected.length})`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
