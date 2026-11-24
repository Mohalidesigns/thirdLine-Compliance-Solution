import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography,
} from '@mui/material';
import { api } from '../../services/api';

export default function SubmitDraftDialog({ open, instanceId, period, onClose, onSaved, onSnackbar }) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState([]);
  const [evidenceName, setEvidenceName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (open) { setNotes(''); setFiles([]); setEvidenceName(''); setNameTouched(false); setError(''); } }, [open]);

  const nameMissing = files.length > 0 && !evidenceName.trim();

  async function submit() {
    if (files.length === 0) {
      setError('Attach the drafted report before sending it to the CCO.');
      return;
    }
    if (nameMissing) {
      setNameTouched(true);
      setError('Enter an evidence name before sending it to the CCO.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const form = new FormData();
      if (notes.trim()) form.append('notes', notes.trim());
      files.forEach((f) => form.append('files', f));
      form.append('evidenceName', evidenceName.trim());
      await api.returns.submitDraft(instanceId, form);
      queryClient.invalidateQueries({ queryKey: ['evidence', 'source'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onSaved?.();
    } catch (e) { onSnackbar?.(e.message); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Send the draft to the CCO</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Attach the drafted report{period ? ` for ${period}` : ''}. The CCO reviews it and either accepts it
          (the filing completes) or requests changes, in which case it comes back here for revision.
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box>
            <Button variant="outlined" component="label">
              {files.length ? `${files.length} file${files.length > 1 ? 's' : ''} attached` : 'Attach drafted report'}
              <input hidden type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} />
            </Button>
            {files.length > 0 && (
              <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5 }}>
                {files.map((f) => (
                  <Typography key={f.name} component="li" variant="caption" color="text.secondary">
                    {f.name}
                  </Typography>
                ))}
              </Box>
            )}
          </Box>
          <TextField label="Report title" fullWidth size="small" required={files.length > 0}
            value={evidenceName} onBlur={() => setNameTouched(true)}
            error={nameTouched && nameMissing}
            helperText={nameTouched && nameMissing ? 'Report title is required.' : ''}
            onChange={(e) => setEvidenceName(e.target.value)} />
          <TextField label="Cover note (optional)" multiline minRows={2} fullWidth size="small"
            value={notes} onChange={(e) => setNotes(e.target.value)} />
          {error && <Alert severity="error">{error}</Alert>}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving}>
          {saving ? 'Sending…' : 'Send to CCO'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
