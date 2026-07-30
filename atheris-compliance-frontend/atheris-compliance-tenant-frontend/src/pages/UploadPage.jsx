import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, TextField, Select, MenuItem, FormControl,
  Alert, CircularProgress, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TablePagination,
  Chip, Tooltip, Paper,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon, UploadFile, Refresh, ErrorOutline, CheckCircle,
  HourglassEmpty, PlayArrow,
} from '@mui/icons-material';
import { api } from '../services/api';

const UploadStatus = Object.freeze({
  QUEUED: 'queued', PROCESSING: 'processing', COMPLETED: 'completed', FAILED: 'failed', CONFIRMED: 'confirmed',
});

const STATUS_CONFIG = {
  [UploadStatus.QUEUED]:     { label: 'Queued',     icon: <HourglassEmpty sx={{ fontSize: 14 }} />, color: '#A0AEC0', bg: '#EDF2F7' },
  [UploadStatus.PROCESSING]: { label: 'Processing',  icon: <PlayArrow sx={{ fontSize: 14 }} />,      color: '#3182CE', bg: '#EBF4FF' },
  [UploadStatus.COMPLETED]:  { label: 'Completed',   icon: <CheckCircle sx={{ fontSize: 14 }} />,    color: '#38A169', bg: '#F0FFF4' },
  [UploadStatus.FAILED]:     { label: 'Failed',      icon: <ErrorOutline sx={{ fontSize: 14 }} />,   color: '#E53E3E', bg: '#FFF5F5' },
  [UploadStatus.CONFIRMED]:  { label: 'Confirmed',   icon: <CheckCircle sx={{ fontSize: 14 }} />,    color: '#805AD5', bg: '#F3E8FF' },
};

function StatusChip({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG[UploadStatus.QUEUED];
  return (
    <Chip icon={cfg.icon} label={cfg.label} size="small"
      sx={{ fontWeight: 600, fontSize: '0.7rem', bgcolor: cfg.bg, color: cfg.color, '& .MuiChip-icon': { color: cfg.color } }} />
  );
}

function formatDt(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function UploadPage() {
  const navigate = useNavigate();

  const [regulators, setRegulators] = useState([]);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [tenantRegulatorId, setTenantRegulatorId] = useState('');
  const [uploading, setUploading] = useState(false);

  const [records, setRecords] = useState([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(20);
  const [fileFilter, setFileFilter] = useState('');
  const [regFilter, setRegFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.regulators.list()
      .then(data => setRegulators(Array.isArray(data) ? data : (data.content || [])))
      .catch(() => {});
  }, []);

  const regMap = useMemo(() => {
    const m = {};
    regulators.forEach(r => { m[r.id] = r.abbreviation || r.name; });
    return m;
  }, [regulators]);

  const fetchRecords = useCallback(() => {
    setTableLoading(true);
    api.uploads.list(page, rowsPerPage)
      .then(data => setRecords(data.content || []))
      .catch(() => {})
      .finally(() => setTableLoading(false));
  }, [page, rowsPerPage]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (fileFilter && !(r.originalFilename || r.title || '').toLowerCase().includes(fileFilter.toLowerCase())) return false;
      if (regFilter && (regMap[r.tenantRegulatorId] || '') !== regFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      return true;
    });
  }, [records, fileFilter, regFilter, statusFilter, regMap]);

  const regOptions = useMemo(() => {
    return [...new Set(records.map(r => regMap[r.tenantRegulatorId]).filter(Boolean))];
  }, [records, regMap]);

  const statusOptions = useMemo(() => {
    return [...new Set(records.map(r => r.status).filter(Boolean))];
  }, [records]);

  async function handleSubmit() {
    if (!file) { setError('Select a file'); return; }
    setUploading(true);
    setError('');
    setSuccess('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (title) formData.append('title', title);
      if (tenantRegulatorId) formData.append('tenant_regulator_id', tenantRegulatorId);
      await api.uploads.upload(formData);
      setSuccess('Upload started.');
      setTimeout(() => setSuccess(''), 4000);
      setFile(null);
      setTitle('');
      setTenantRegulatorId('');
      fetchRecords();
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>Upload Document</Typography>

      {error && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 1 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Paper sx={{ p: 1.5, mb: 3, display: 'flex', gap: 1, alignItems: 'center' }}>
        <input type="file" accept=".pdf" hidden id="upload-file-input"
          onChange={e => {
            const f = e.target.files[0];
            setFile(f);
            if (f) setTitle(f.name.replace(/\.[^.]+$/, ''));
          }} />
        <label htmlFor="upload-file-input" style={{ display: 'flex' }}>
          <Button variant="outlined" component="span" size="small" startIcon={<UploadFile />}
            sx={{ whiteSpace: 'nowrap', textTransform: 'none', fontSize: '0.78rem', px: 2, minWidth: 0, maxWidth: 160, justifyContent: 'flex-start', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {file ? file.name : 'Choose PDF'}
          </Button>
        </label>
        {file && (
          <Button size="small" variant="text" color="error" onClick={() => { setFile(null); setTitle(''); }}
            sx={{ minWidth: 0, px: 0.5, fontSize: '0.75rem' }}>
            Cancel
          </Button>
        )}
        <TextField size="small" placeholder="Title" value={title}
          onChange={e => setTitle(e.target.value)} sx={{ flex: 1 }} />
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <Select value={tenantRegulatorId} displayEmpty
            onChange={e => setTenantRegulatorId(e.target.value)}>
            <MenuItem value="">Regulator (opt)</MenuItem>
            {regulators.filter(r => r.isActive).map(r => (
              <MenuItem key={r.id} value={r.id}>{r.abbreviation}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button variant="contained" size="small" onClick={handleSubmit} disabled={uploading || !file}
          sx={{ px: 3, width: 120 }}
          startIcon={uploading ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <CloudUploadIcon />}>
          {uploading ? 'Uploading' : 'Upload'}
        </Button>
      </Paper>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
        <Button size="small" variant="outlined" startIcon={<Refresh />} onClick={fetchRecords}>Refresh</Button>
      </Box>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem' }}>Title</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem', width: 90 }}>Regulator</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem', width: 120 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem', width: 120 }}>Uploaded</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem', width: 80 }}>Action</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ p: 0.5 }} />
              <TableCell sx={{ p: 0.5 }}>
                <Select size="small" value={regFilter} displayEmpty onChange={e => { setRegFilter(e.target.value); setPage(0); }}
                  sx={{ fontSize: '0.7rem', width: '100%' }}>
                  <MenuItem value="">All</MenuItem>
                  {regOptions.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                </Select>
              </TableCell>
              <TableCell sx={{ p: 0.5 }}>
                <Select size="small" value={statusFilter} displayEmpty onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
                  sx={{ fontSize: '0.7rem', width: '100%' }}>
                  <MenuItem value="">All</MenuItem>
                  {statusOptions.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </Select>
              </TableCell>
              <TableCell sx={{ p: 0.5 }} />
              <TableCell sx={{ p: 0.5 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {tableLoading && records.length === 0 ? (
              <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}><CircularProgress /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: '#A0AEC0' }}>No uploads found.</TableCell></TableRow>
            ) : (
              filtered.slice(page * rowsPerPage, (page + 1) * rowsPerPage).map((r, i) => (
                <TableRow key={r.id || r.uploadId} hover sx={{ bgcolor: i % 2 === 0 ? 'transparent' : '#F7FAFC' }}>
                  <TableCell><Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title || r.originalFilename || '—'}</Typography></TableCell>
                  <TableCell><Chip label={regMap[r.tenantRegulatorId] || '—'} size="small" sx={{ fontWeight: 600, fontSize: '0.65rem', bgcolor: '#1A365D', color: '#fff' }} /></TableCell>
                  <TableCell>{r.status === 'failed' && r.errorMessage ? <Tooltip title={r.errorMessage}><Box><StatusChip status={r.status} /></Box></Tooltip> : <StatusChip status={r.status} />}</TableCell>
                  <TableCell><Typography variant="caption" color="text.secondary">{formatDt(r.createdAt)}</Typography></TableCell>
                  <TableCell>
                    {r.status === UploadStatus.FAILED ? (
                      <Button size="small" variant="contained" disabled sx={{ fontSize: '0.7rem', py: 0.2 }}>Review</Button>
                    ) : r.status === UploadStatus.COMPLETED ? (
                      <Button size="small" variant="contained" onClick={() => navigate(`/uploads/${r.uploadId}/review`)} sx={{ fontSize: '0.7rem', py: 0.2 }}>Review</Button>
                    ) : (
                      <Typography variant="caption" color="text.secondary">Processing...</Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination component="div" count={filtered.length} page={page} onPageChange={(_, p) => setPage(p)}
        rowsPerPage={rowsPerPage} rowsPerPageOptions={[rowsPerPage]} />
    </Box>
  );
}
