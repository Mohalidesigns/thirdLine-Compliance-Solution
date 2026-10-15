import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  CircularProgress, Typography, Box, List, ListItem, ListItemText, IconButton, Tooltip,
} from '@mui/material';
import { ArrowUpTrayIcon, ArrowDownTrayIcon, DocumentTextIcon, TL } from 'shared';
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
      await api.platform.evidence.upload?.(fd);
      setFile(null);
      onSaved?.();
    } catch (e) { onError?.(e.message || 'Upload failed.'); }
    finally { setLoading(false); }
  }

  async function handleDownload(ev) {
    try {
      const { blob, name } = await api.platform.evidence.download?.(ev.fileId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { onError?.('Failed to download evidence.'); }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Evidence</DialogTitle>
      <DialogContent sx={{ '&&&': { pt: 2.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Button component="label" variant="outlined" startIcon={<ArrowUpTrayIcon size={16} />}>
            {file ? file.name : 'Choose file'}
            <input type="file" hidden onChange={e => setFile(e.target.files?.[0] || null)} />
          </Button>
          {file && (
            <Button variant="contained" onClick={handleUpload} disabled={loading}
              startIcon={loading ? <CircularProgress size={14} /> : null}>
              Upload
            </Button>
          )}
          {file && <Button variant="text" color="error" onClick={() => setFile(null)}>Remove</Button>}
        </Box>

        <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color: TL.gray400, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>Uploaded ({evidence?.length || 0})</Typography>
        {evidence?.length > 0 ? (
          <List dense disablePadding>
            {evidence.map(ev => (
              <ListItem key={ev.fileId} disableGutters sx={{ borderBottom: `1px solid ${TL.gray100}`, '&:last-of-type': { borderBottom: 0 } }}
                secondaryAction={
                  <Tooltip title="Download"><IconButton size="small" onClick={() => handleDownload(ev)}><ArrowDownTrayIcon size={16} /></IconButton></Tooltip>
                }>
                <DocumentTextIcon size={16} sx={{ color: TL.gray400, mr: 1 }} />
                <ListItemText primary={<Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: TL.gray700 }}>{ev.originalName}</Typography>} />
              </ListItem>
            ))}
          </List>
        ) : <Typography variant="body2" color="text.secondary">No evidence uploaded.</Typography>}
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
