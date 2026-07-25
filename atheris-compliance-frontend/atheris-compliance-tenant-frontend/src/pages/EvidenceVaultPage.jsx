import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, CardHeader,
  Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Grid, Chip, CircularProgress, Alert,
  TablePagination, Paper, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Tooltip
} from '@mui/material';
import {
  Upload, Download, InsertDriveFile, Image, PictureAsPdf, Description
} from '@mui/icons-material';
import { api } from '../services/api';
import { useTheme } from '@mui/material/styles';

function fileIcon(mime) {
  if (!mime) return <InsertDriveFile />;
  if (mime.startsWith('image/')) return <Image />;
  if (mime.includes('pdf')) return <PictureAsPdf />;
  return <Description />;
}

function formatSize(bytes) {
  if (!bytes) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

export default function EvidenceVaultPage() {
  const [data, setData] = useState({ content: [], totalElements: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [snackbar, setSnackbar] = useState(null);
  const theme = useTheme();

  const loadList = useCallback(() => {
    setLoading(true);
    api.evidence.list(page, rowsPerPage)
      .then(res => setData(res))
      .catch(e => setSnackbar(e.message))
      .finally(() => setLoading(false));
  }, [page, rowsPerPage]);

  useEffect(() => { loadList(); }, [loadList]);

  const handleDownload = async (id) => {
    try {
      const { blob, name } = await api.evidence.download(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) { setSnackbar(e.message); }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Box>
          <Typography variant="h4" sx={{ mb: 0.5 }}>Evidence Vault</Typography>
          <Typography variant="body2" color="text.secondary">Upload and browse all evidence files</Typography>
        </Box>
        <Button variant="contained" startIcon={<Upload />} onClick={() => setUploadOpen(true)}>
          Upload Evidence
        </Button>
      </Box>

      <Card>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : data.content.length === 0 ? (
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <InsertDriveFile sx={{ fontSize: 48, color: theme.palette.action.disabled, mb: 1 }} />
            <Typography color="text.secondary">No evidence files uploaded yet</Typography>
          </CardContent>
        ) : (
          <>
            <TableContainer component={Paper} elevation={0}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>File</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Size</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Source</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Uploaded</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.content.map((f) => (
                    <TableRow key={f.fileId} hover>
                      <TableCell sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {fileIcon(f.mimeType)}
                        <Typography variant="body2" sx={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.originalName}
                        </Typography>
                      </TableCell>
                      <TableCell><Chip label={f.mimeType || '-'} size="small" variant="outlined" /></TableCell>
                      <TableCell>{formatSize(f.fileSize)}</TableCell>
                      <TableCell>
                        {f.sourceType
                          ? <Chip label={`${f.sourceType} #${f.sourceId}`} size="small" variant="outlined" />
                          : '-'}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.description || '-'}
                      </TableCell>
                      <TableCell>{f.createdAt ? new Date(f.createdAt).toLocaleDateString() : '-'}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="Download">
                          <IconButton size="small" onClick={() => handleDownload(f.fileId)}>
                            <Download fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination component="div" count={data.totalElements} page={page}
              onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
              onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              rowsPerPageOptions={[10, 25, 50]} />
          </>
        )}
      </Card>

      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)}
        onSaved={() => { setUploadOpen(false); loadList(); }} onSnackbar={setSnackbar} />

      {snackbar && <Alert severity="error" onClose={() => setSnackbar(null)}
        sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>{snackbar}</Alert>}
    </Box>
  );
}

function UploadDialog({ open, onClose, onSaved, onSnackbar }) {
  const [file, setFile] = useState(null);
  const [sourceType, setSourceType] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setFile(null); setSourceType(''); setSourceId(''); setDescription(''); } }, [open]);

  const handleSave = async () => {
    if (!file) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (sourceType) fd.append('sourceType', sourceType);
      if (sourceId) fd.append('sourceId', sourceId);
      if (description) fd.append('description', description);
      await api.evidence.upload(fd);
      onSaved();
    } catch (e) { onSnackbar(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Upload Evidence</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12}>
            <Button variant="outlined" component="label" fullWidth sx={{ py: 3, borderStyle: 'dashed' }}>
              {file ? file.name : 'Click to select file'}
              <input type="file" hidden onChange={e => setFile(e.target.files[0])} />
            </Button>
          </Grid>
          <Grid item xs={6}>
            <TextField select label="Source type" fullWidth size="small" value={sourceType}
              onChange={e => setSourceType(e.target.value)}>
              <MenuItem value="">None</MenuItem>
              <MenuItem value="control">Control</MenuItem>
              <MenuItem value="finding">Finding</MenuItem>
              <MenuItem value="return_instance">Return</MenuItem>
              <MenuItem value="control_test">Test</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={6}>
            <TextField label="Source ID" fullWidth size="small" type="number" value={sourceId}
              onChange={e => setSourceId(e.target.value)} />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Description" fullWidth size="small" multiline minRows={2} value={description}
              onChange={e => setDescription(e.target.value)} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !file}>
          {saving ? 'Uploading...' : 'Upload'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
