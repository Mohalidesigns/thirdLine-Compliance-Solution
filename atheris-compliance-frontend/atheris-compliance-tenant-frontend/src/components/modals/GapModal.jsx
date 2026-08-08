import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  CircularProgress, TextField, FormControlLabel, Switch, Typography,
} from '@mui/material';
import { api } from '../../services/api';

export default function GapModal({ open, onClose, obligationId, initial = {}, onSaved, onError }) {
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        hasGap: !!initial.hasGap,
        gapDescription: initial.gapDescription || '',
        changeReason: '',
      });
    }
  }, [open, initial]);

  async function handleSave() {
    setLoading(true);
    try {
      await api.obligations.updateGap(obligationId, {
        hasGap: form.hasGap,
        gapDescription: form.hasGap ? (form.gapDescription || null) : null,
        changeReason: form.changeReason || (form.hasGap ? 'Gap identified' : 'Gap resolved'),
      });
      onSaved?.();
      onClose();
    } catch (e) { onError?.(e.message || 'Failed to save gap.'); }
    finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Control Gap</DialogTitle>
      <DialogContent dividers>
        <FormControlLabel control={
          <Switch checked={!!form.hasGap}
            onChange={e => setForm({ ...form, hasGap: e.target.checked })} />
        } label={<Typography variant="body2">Has gap (no control covers this obligation)</Typography>} />
        {form.hasGap && (
          <TextField size="small" fullWidth multiline rows={3} label="Gap description"
            value={form.gapDescription || ''}
            onChange={e => setForm({ ...form, gapDescription: e.target.value })} sx={{ mt: 2 }} />
        )}
        <TextField size="small" fullWidth multiline rows={2} label="Reason for update (optional)"
          value={form.changeReason || ''} onChange={e => setForm({ ...form, changeReason: e.target.value })} sx={{ mt: 2 }} />
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
