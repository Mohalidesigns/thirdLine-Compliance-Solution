import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  MenuItem, CircularProgress, Alert, Box, Typography,
} from '@mui/material';
import { CloudArrowUpIcon, TL } from 'shared';
import api from '../../../services/api';

export default function UploadDialog({ open, onClose, onSuccess }) {
  const [regulators, setRegulators] = useState([]);
  const [regulatorId, setRegulatorId] = useState('');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      api.platform.regulators.list({ activeOnly: true })
        .then(setRegulators)
        .catch(() => {});
    }
  }, [open]);

  async function handleSubmit() {
    if (!regulatorId || !file) {
      setError('Please select a regulator and upload a PDF');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.platform.instruments.upload(regulatorId, file, title || null);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CloudArrowUpIcon size={20} sx={{ color: TL.primary }} />
        Upload Document
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {error && <Alert severity="error" size="small">{error}</Alert>}
          <TextField
            select label="Regulator" value={regulatorId}
            onChange={(e) => setRegulatorId(e.target.value)} fullWidth required
          >
            {regulators.map((r) => (
              <MenuItem key={r.regulatorId} value={r.regulatorId}>
                {r.name} ({r.abbreviation})
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Document Title (optional)" value={title}
            onChange={(e) => setTitle(e.target.value)} fullWidth
            placeholder="Auto-detected from filename if left empty"
          />
          <Box>
            <Typography sx={{ mb: 0.75, display: 'block', fontSize: '0.625rem', fontWeight: 600, color: TL.gray400, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              PDF File *
            </Typography>
            <Button variant="outlined" component="label" startIcon={<CloudArrowUpIcon size={16} />}>
              {file ? file.name : 'Choose PDF file'}
              <input type="file" hidden accept=".pdf,application/pdf"
                onChange={(e) => setFile(e.target.files[0])} />
            </Button>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="outlined" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={loading || !regulatorId || !file}>
          {loading ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
          Upload & Queue
        </Button>
      </DialogActions>
    </Dialog>
  );
}
