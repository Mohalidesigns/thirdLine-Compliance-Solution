import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  CircularProgress, Typography, Box, List, ListItem, ListItemText, IconButton, Tooltip,
} from '@mui/material';
import { UploadFile, Download } from '@mui/icons-material';
import { api } from '../../services/api';

export default function EvidenceUploadModal({ open, onClose, obligationId, evidence = [], onSaved, onError }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setFile(null);
  }, [open]);

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('sourceType', 'obligation');
      fd.append('sourceId', String(obligationId));
      fd.append('description', 'Evidence uploaded from obligation detail');
      await api.evidence.upload(fd);
      setFile(null);
      onSaved?.();
    } catch (e) { onError?.(e.message || 'Upload failed.'); }
    finally { setLoading(false); }
  }

  async function handleDownload(ev) {
    try {
      const { blob, name } = await api.evidence.download(ev.fileId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { onError?.('Failed to download evidence.'); }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Evidence</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Button component="label" variant="outlined" startIcon={<UploadFile />} size="small">
            {file ? file.name : 'Choose file'}
            <input type="file" hidden onChange={e => setFile(e.target.files?.[0] || null)} />
          </Button>
          {file && (
            <Button size="small" variant="contained" onClick={handleUpload} disabled={loading}
              startIcon={loading ? <CircularProgress size={14} /> : null}>
              Upload
            </Button>
          )}
          {file && <Button size="small" color="error" onClick={() => setFile(null)}>Remove</Button>}
        </Box>

        <Typography variant="subtitle2" sx={{ mb: 1 }}>Uploaded ({evidence?.length || 0})</Typography>
        {evidence?.length > 0 ? (
          <List dense disablePadding>
            {evidence.map(ev => (
              <ListItem key={ev.fileId} disableGutters
                secondaryAction={
                  <Tooltip title="Download"><IconButton size="small" onClick={() => handleDownload(ev)}><Download fontSize="small" /></IconButton></Tooltip>
                }>
                <ListItemText primary={<Typography variant="body2" sx={{ fontWeight: 500 }}>{ev.originalName}</Typography>} />
              </ListItem>
            ))}
          </List>
        ) : <Typography variant="body2" color="text.secondary">No evidence uploaded.</Typography>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
