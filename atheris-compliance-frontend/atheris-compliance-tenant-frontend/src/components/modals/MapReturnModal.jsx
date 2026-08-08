import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Checkbox,
  FormControlLabel, Typography, CircularProgress, Box,
} from '@mui/material';
import { api } from '../../services/api';

export default function MapReturnModal({ open, onClose, obligationId, initialIds = [], onSaved, onError }) {
  const [returns, setReturns] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected([...(initialIds || [])]);
      setLoading(true);
      api.returns.list()
        .then(d => setReturns(Array.isArray(d) ? d : (d.content || [])))
        .catch(() => onError?.('Failed to load returns.'))
        .finally(() => setLoading(false));
    }
  }, [open, initialIds]);

  async function handleSave() {
    setLoading(true);
    try {
      await api.obligations.linkReturns(obligationId, selected);
      onSaved?.();
      onClose();
    } catch (e) { onError?.(e.message || 'Failed to map returns.'); }
    finally { setLoading(false); }
  }

  const toggle = id => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Map Return Required</DialogTitle>
      <DialogContent dividers>
        {loading && returns.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={26} /></Box>
        ) : returns.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 2 }}>No returns configured yet.</Typography>
        ) : (
          <Box sx={{ maxHeight: 340, overflow: 'auto' }}>
            {returns.map(r => (
              <FormControlLabel key={r.returnId} sx={{ width: '100%', m: 0, py: 0.5 }}
                control={<Checkbox size="small" checked={selected.includes(r.returnId)} onChange={() => toggle(r.returnId)} />}
                label={<Typography variant="body2">{r.returnName}{r.frequency ? ` (${r.frequency})` : ''}</Typography>} />
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={loading}>
          {loading ? <CircularProgress size={18} /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
