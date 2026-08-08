import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  CircularProgress, TextField, MenuItem,
} from '@mui/material';
import { api } from '../../services/api';

const APPLICABILITY_OPTIONS = ['applicable', 'not_applicable', 'under_review'];

export default function ApplicabilityModal({ open, onClose, obligationId, initial = {}, onSaved, onError }) {
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        applicability: initial.applicability || 'under_review',
        applicabilityReasoning: initial.applicabilityReasoning || '',
        changeReason: '',
      });
    }
  }, [open, initial]);

  async function handleSave() {
    setLoading(true);
    try {
      await api.obligations.classify(obligationId, {
        applicability: form.applicability,
        applicabilityReasoning: form.applicabilityReasoning || null,
        changeReason: form.changeReason || 'Applicability updated',
      });
      onSaved?.();
      onClose();
    } catch (e) { onError?.(e.message || 'Failed to save classification.'); }
    finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Your Classification</DialogTitle>
      <DialogContent dividers>
        <TextField select fullWidth size="small" label="Applicability" value={form.applicability}
          onChange={e => setForm({ ...form, applicability: e.target.value })}>
          {APPLICABILITY_OPTIONS.map(o => (
            <MenuItem key={o} value={o}>{o.split('_').join(' ').replace(/\b\w/g, c => c.toUpperCase())}</MenuItem>
          ))}
        </TextField>
        <TextField size="small" fullWidth multiline rows={3} label="Reasoning" value={form.applicabilityReasoning || ''}
          onChange={e => setForm({ ...form, applicabilityReasoning: e.target.value })} sx={{ mt: 2 }} />
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
