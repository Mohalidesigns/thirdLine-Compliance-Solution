import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Box,
} from '@mui/material';
import { api } from '../../services/api';

const EMPTY = { text: '', riskId: '' };

export default function AddRequirementDialog({ open, onClose, obligationId, onSaved, onError }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const { data: risks = [] } = useQuery({
    queryKey: ['risks', 'register'],
    queryFn: ({ signal }) => api.risks.register({}, { signal }),
    enabled: open,
  });

  useEffect(() => { if (open) setForm(EMPTY); }, [open]);

  async function handleSave() {
    if (!form.text.trim()) { onError?.('Requirement text is required.'); return; }
    setSaving(true);
    try {
      await api.requirements.create({
        obligationId,
        text: form.text.trim(),
        riskId: form.riskId ? Number(form.riskId) : null,
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
        <Box sx={{ mt: 2 }}>
          <TextField
            select fullWidth size="small" label="Risk (optional)"
            value={form.riskId} onChange={(e) => setForm((f) => ({ ...f, riskId: e.target.value }))}
          >
            <MenuItem value="">No risk</MenuItem>
            {risks.map((r) => <MenuItem key={r.riskId} value={r.riskId}>{r.riskCode} · {r.name}</MenuItem>)}
          </TextField>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Add requirement'}</Button>
      </DialogActions>
    </Dialog>
  );
}