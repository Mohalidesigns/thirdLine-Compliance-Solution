import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography,
  Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Grid, Chip, CircularProgress, Alert,
  TablePagination, Paper, Table, TableHead, TableBody, TableRow, TableCell,
  Tooltip, Autocomplete
} from '@mui/material';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  PageHeader, TL,
  ArrowUpTrayIcon, ArrowDownTrayIcon, DocumentIcon, DocumentTextIcon, FolderOpenIcon,
} from 'shared';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { isReadOnly } from '../utils/roles';

function fileIcon(mime) {
  if (!mime) return <DocumentIcon size={18} />;
  if (mime.startsWith('image/')) return <DocumentIcon size={18} />;
  if (mime.includes('pdf')) return <DocumentTextIcon size={18} />;
  return <DocumentTextIcon size={18} />;
}

function formatSize(bytes) {
  if (!bytes) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

export default function EvidenceVaultPage() {
  const { user } = useAuth();
  // upload is ANALYST / CCO / TENANT_ADMIN (IT Ops captures evidence inside runbook steps)
  const canUpload = !isReadOnly(user?.role);
  const [data, setData] = useState({ content: [], totalElements: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [snackbar, setSnackbar] = useState(null);

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
      <PageHeader
        title="Evidence Vault"
        subtitle="Upload and browse all evidence files"
        actions={canUpload ? (
          <Button variant="contained" startIcon={<ArrowUpTrayIcon size={16} />} onClick={() => setUploadOpen(true)}>
            Upload Evidence
          </Button>
        ) : null}
      />

      <Paper sx={{ overflow: 'hidden' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : data.content.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <FolderOpenIcon size={40} sx={{ color: TL.gray300, mb: 1 }} />
            <Typography color="text.secondary">No evidence files uploaded yet</Typography>
          </Box>
        ) : (
          <>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>File</TableCell>
                    <TableCell>Size</TableCell>
                    <TableCell>Source</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Uploaded</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.content.map((f) => (
                    <TableRow key={f.fileId} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                          <Box sx={{ color: TL.gray400, display: 'flex', flexShrink: 0 }}>{fileIcon(f.mimeType)}</Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" sx={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'primary.main', fontWeight: 500 }}>
                              {f.originalName}
                            </Typography>
                            <Typography sx={{ fontSize: '0.75rem', color: TL.gray500, fontFamily: TL.mono }}>{f.mimeType || '-'}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatSize(f.fileSize)}</TableCell>
                      <TableCell>
                        {f.sourceType
                          ? <Chip label={`${f.sourceType} #${f.sourceId}`} size="small" variant="outlined" />
                          : '-'}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.description || '-'}
                      </TableCell>
                      <TableCell sx={{ color: TL.gray500 }}>{f.createdAt ? new Date(f.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="Download">
                          <IconButton size="small" onClick={() => handleDownload(f.fileId)}>
                            <ArrowDownTrayIcon size={16} />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            <TablePagination component="div" count={data.totalElements} page={page}
              onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
              onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              rowsPerPageOptions={[10, 25, 50]} />
          </>
        )}
      </Paper>

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
          <Grid size={{ xs: 12 }}>
            <Button variant="outlined" component="label" fullWidth startIcon={<ArrowUpTrayIcon size={16} />} sx={{ py: 3, borderStyle: 'dashed' }}>
              {file ? file.name : 'Click to select file'}
              <input type="file" hidden onChange={e => setFile(e.target.files[0])} />
            </Button>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <TextField select label="Source type" fullWidth size="small" value={sourceType}
              onChange={e => { setSourceType(e.target.value); setSourceId(''); }}>
              <MenuItem value="">None</MenuItem>
              <MenuItem value="control">Control</MenuItem>
              <MenuItem value="finding">Finding</MenuItem>
              <MenuItem value="return_instance">Return</MenuItem>
              <MenuItem value="control_test">Test</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <SourcePicker sourceType={sourceType} value={sourceId} onChange={setSourceId} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField label="Description" fullWidth size="small" multiline minRows={2} value={description}
              onChange={e => setDescription(e.target.value)} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !file}>
          {saving ? 'Uploading...' : 'Upload'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Pick the linked record by what people know it as — a control number/name or a finding
 * reference — instead of typing an internal id. Return periods and tests keep the id field.
 */
function SourcePicker({ sourceType, value, onChange }) {
  const [input, setInput] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => { const t = setTimeout(() => setDebounced(input), 300); return () => clearTimeout(t); }, [input]);
  useEffect(() => { setInput(''); }, [sourceType]);

  const controlsQuery = useQuery({
    queryKey: ['evidence-source', 'controls', debounced],
    queryFn: () => api.controls.register({ q: debounced || undefined, page: 0, size: 20 }),
    enabled: sourceType === 'control',
    placeholderData: keepPreviousData,
  });
  const findingsQuery = useQuery({
    queryKey: ['evidence-source', 'findings'],
    queryFn: () => api.findings.register({ page: 0, size: 200 }),
    enabled: sourceType === 'finding',
    staleTime: 60 * 1000,
  });

  if (sourceType !== 'control' && sourceType !== 'finding') {
    return (
      <TextField label={sourceType ? 'Source ID' : 'Source (choose a type)'} fullWidth size="small" type="number"
        disabled={!sourceType} value={value} onChange={e => onChange(e.target.value)} />
    );
  }
  const options = sourceType === 'control'
    ? (controlsQuery.data?.content || []).map(c => ({ id: String(c.controlId), label: `${c.controlNumber} — ${c.name || ''}` }))
    : (findingsQuery.data?.content || [])
      .filter(f => !debounced || `${f.displayId} ${f.description || ''}`.toLowerCase().includes(debounced.toLowerCase()))
      .map(f => ({ id: String(f.findingId), label: `${f.displayId} — ${(f.description || '').slice(0, 60)}` }));
  const selected = options.find(o => o.id === String(value)) || (value ? { id: String(value), label: `#${value}` } : null);
  return (
    <Autocomplete
      size="small"
      options={options}
      value={selected}
      loading={sourceType === 'control' ? controlsQuery.isFetching : findingsQuery.isFetching}
      filterOptions={x => x}
      isOptionEqualToValue={(o, v) => o.id === v.id}
      onChange={(_, o) => onChange(o ? o.id : '')}
      onInputChange={(_, v, reason) => { if (reason === 'input') setInput(v); }}
      renderInput={params => (
        <TextField {...params} label={sourceType === 'control' ? 'Control' : 'Finding'}
          placeholder={sourceType === 'control' ? 'Search number or name' : 'Search FIND-…'} />
      )}
    />
  );
}
