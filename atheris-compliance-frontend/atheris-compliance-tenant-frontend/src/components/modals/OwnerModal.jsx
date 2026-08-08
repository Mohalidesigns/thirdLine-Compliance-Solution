import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  CircularProgress, TextField,
} from '@mui/material';
import { api } from '../../services/api';
import OwnerPicker from '../org/OwnerPicker';

export default function OwnerModal({ open, onClose, obligationId, initial = {}, onSaved, onError }) {
  const [ownerId, setOwnerId] = useState(null);
  const [changeReason, setChangeReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setOwnerId(initial.assignedOwnerId ?? null);
      setChangeReason('');
    }
  }, [open, initial]);

  async function handleSave() {
    setLoading(true);
    try {
      await api.obligations.assignOwner(obligationId, {
        assignedOwnerId: ownerId,
        changeReason: changeReason || 'Owner updated',
      });
      onSaved?.();
      onClose();
    } catch (e) { onError?.(e.message || 'Failed to save owner.'); }
    finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Compliance Owner</DialogTitle>
      <DialogContent dividers>
        <OwnerPicker value={ownerId} onChange={setOwnerId} label="Compliance owner" />
        <TextField size="small" fullWidth multiline rows={2} label="Reason for update (optional)"
          value={changeReason || ''} onChange={e => setChangeReason(e.target.value)} sx={{ mt: 2 }} />
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
