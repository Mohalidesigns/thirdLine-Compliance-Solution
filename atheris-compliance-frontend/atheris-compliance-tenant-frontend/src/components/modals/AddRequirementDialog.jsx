import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
} from '@mui/material';
import { api } from '../../services/api';

const EMPTY = { text: '' };

export default function AddRequirementDialog({ open, onClose, obligationId, onSaved, onError }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setForm(EMPTY); }, [open]);

  async function handleSave() {
    if (!form.text.trim()) { onError?.('Requirement text is required.'); return; }
    setSaving(true);
    try {
      await api.requirements.create({
        obligationId,
        text: form.text.trim(),
      });
      qc.invalidateQueries({ queryKey: ['requirements'] });
      qc.invalidateQueries({ queryKey: ['obligations'] });
      onSaved?.();
      onClose();
    } catch (e) { onError?.(e.message || 'Failed to add requirement.'); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add a requirement</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth size="small" multiline minRows={3} label="Requirement text"
          value={form.text} onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Add requirement'}</Button>
      </DialogActions>
    </Dialog>
  );
}