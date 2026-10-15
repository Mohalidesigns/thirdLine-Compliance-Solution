import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, TextField, Select, MenuItem,
  Alert, CircularProgress, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TablePagination,
  Chip, Tooltip, Paper, Snackbar, IconButton,
} from '@mui/material';
import {
  PageHeader, DataCard, FilterBar, FilterField, StatusBadge,
  ArrowPathIcon, ArrowUpTrayIcon, CloudArrowUpIcon, EyeIcon,
} from 'shared';
import api from '../../../services/api';

const DOC_TYPES = ['circulars', 'guidelines', 'directives', 'regulations', 'standards', 'frameworks'];

const UploadStatus = Object.freeze({
  PENDING: 'pending', EXTRACTING: 'extracting', EXTRACTED: 'extracted',
  CLASSIFYING: 'classifying', COMPLETED: 'completed', FAILED: 'failed',
});

const STATUS_CONFIG = {
  [UploadStatus.PENDING]:    { label: 'Pending',     tone: 'gray' },
  [UploadStatus.EXTRACTING]: { label: 'Extracting',  tone: 'blue' },
  [UploadStatus.EXTRACTED]:  { label: 'Extracted',   tone: 'purple' },
  [UploadStatus.CLASSIFYING]:{ label: 'Classifying', tone: 'orange' },
  [UploadStatus.COMPLETED]:  { label: 'Completed',   tone: 'green' },
  [UploadStatus.FAILED]:     { label: 'Failed',      tone: 'red' },
};

function StatusChip({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG[UploadStatus.PENDING];
  return <StatusBadge label={cfg.label} tone={cfg.tone} />;
}

function formatDt(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function UploadsPage() {
  const navigate = useNavigate();

  const [regulators, setRegulators] = useState([]);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [regulatorId, setRegulatorId] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [uploading, setUploading] = useState(false);

  const [records, setRecords] = useState([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(20);
  const [fileFilter, setFileFilter] = useState('');
  const [titleFilter, setTitleFilter] = useState('');
  const [regFilter, setRegFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.platform.regulators.list({ sortBy: 'name', sortDir: 'asc' })
      .then(data => setRegulators(Array.isArray(data) ? data : (data.content || [])))
      .catch(() => {});
  }, []);

  const regMap = useMemo(() => {
    const m = {};
    regulators.forEach(r => { m[r.regulatorId] = r.abbreviation || r.name; });
    return m;
  }, [regulators]);

  const fetchRecords = useCallback(() => {
    setTableLoading(true);
    api.platform.uploads.list()
      .then(data => setRecords(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setTableLoading(false));
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (fileFilter && !(r.originalFilename || '').toLowerCase().includes(fileFilter.toLowerCase())) return false;
      if (titleFilter && !(r.title || '').toLowerCase().includes(titleFilter.toLowerCase())) return false;
      if (regFilter && (regMap[r.regulatorId] || '') !== regFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      return true;
    });
  }, [records, fileFilter, titleFilter, regFilter, statusFilter, regMap]);

  const regOptions = useMemo(() => {
    return [...new Set(records.map(r => regMap[r.regulatorId]).filter(Boolean))];
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
      if (regulatorId) formData.append('regulatorId', regulatorId);
      if (documentType) formData.append('documentType', documentType);
      await api.platform.uploads.upload(formData);
      setSuccess('Upload started.');
      setFile(null);
      setTitle('');
      setRegulatorId('');
      setDocumentType('');
      fetchRecords();
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <Box>
      <PageHeader
        title="Upload Document"
        subtitle="Upload a regulatory PDF to extract text and analyse obligations"
        actions={
          <Button variant="outlined" startIcon={<ArrowPathIcon size={16} />} onClick={fetchRecords}>Refresh</Button>
        }
      />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <DataCard title="New Upload" sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <input type="file" accept=".pdf" hidden id="upload-file-input"
            onChange={e => {
              const f = e.target.files[0];
              setFile(f);
              if (f) setTitle(f.name.replace(/\.[^.]+$/, ''));
            }} />
          <FilterField label="File" minWidth={160}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <label htmlFor="upload-file-input" style={{ display: 'flex' }}>
                <Button variant="outlined" component="span" startIcon={<ArrowUpTrayIcon size={16} />}
                  sx={{ height: 40, whiteSpace: 'nowrap', maxWidth: 200, justifyContent: 'flex-start', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {file ? file.name : 'Choose PDF'}
                </Button>
              </label>
              {file && (
                <Button size="small" variant="text" color="error" onClick={() => { setFile(null); setTitle(''); }}
                  sx={{ minWidth: 0, px: 1 }}>
                  Cancel
                </Button>
              )}
            </Box>
          </FilterField>
          <FilterField label="Title" grow>
            <TextField size="small" placeholder="Title" value={title}
              onChange={e => setTitle(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { height: 40 } }} />
          </FilterField>
          <FilterField label="Regulator" minWidth={150}>
            <Select size="small" value={regulatorId} displayEmpty sx={{ height: 40 }}
              onChange={e => setRegulatorId(e.target.value)}>
              <MenuItem value="">Regulator (opt)</MenuItem>
              {regulators.filter(r => r.isActive).map(r => (
                <MenuItem key={r.regulatorId} value={r.regulatorId}>{r.abbreviation}</MenuItem>
              ))}
            </Select>
          </FilterField>
          <FilterField label="Document Type" minWidth={150}>
            <Select size="small" value={documentType} displayEmpty sx={{ height: 40 }}
              onChange={e => setDocumentType(e.target.value)}>
              <MenuItem value="">Type (opt)</MenuItem>
              {DOC_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FilterField>
          <Button variant="contained" onClick={handleSubmit} disabled={uploading || !file}
            sx={{ height: 40, minWidth: 120 }}
            startIcon={uploading ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : <CloudArrowUpIcon size={16} />}>
            {uploading ? 'Uploading' : 'Upload'}
          </Button>
        </Box>
      </DataCard>

      <FilterBar
        search={{ value: titleFilter, onChange: (v) => { setTitleFilter(v); setPage(0); }, placeholder: 'Filter title', label: 'Title' }}
        showClear={!!(titleFilter || regFilter || statusFilter)}
        onClear={() => { setTitleFilter(''); setRegFilter(''); setStatusFilter(''); setPage(0); }}
      >
        <FilterField label="Regulator" minWidth={160}>
          <Select size="small" value={regFilter} displayEmpty sx={{ height: 40 }}
            onChange={e => { setRegFilter(e.target.value); setPage(0); }}>
            <MenuItem value="">All</MenuItem>
            {regOptions.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </Select>
        </FilterField>
        <FilterField label="Status" minWidth={160}>
          <Select size="small" value={statusFilter} displayEmpty sx={{ height: 40 }}
            onChange={e => { setStatusFilter(e.target.value); setPage(0); }}>
            <MenuItem value="">All</MenuItem>
            {statusOptions.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </Select>
        </FilterField>
      </FilterBar>

      <Paper sx={{ overflow: 'hidden' }}>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell sx={{ width: 110 }}>Regulator</TableCell>
              <TableCell sx={{ width: 130 }}>Status</TableCell>
              <TableCell sx={{ width: 170 }}>Uploaded</TableCell>
              <TableCell align="right" sx={{ width: 80 }}>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tableLoading && records.length === 0 ? (
              <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}><CircularProgress /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>No uploads found.</TableCell></TableRow>
            ) : (
              filtered.slice(page * rowsPerPage, (page + 1) * rowsPerPage).map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell><Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 500, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title || r.originalFilename || '—'}</Typography></TableCell>
                  <TableCell><Chip label={regMap[r.regulatorId] || '—'} size="small" /></TableCell>
                  <TableCell>{r.status === 'FAILED' && r.errorMessage ? <Tooltip title={r.errorMessage}><Box component="span"><StatusChip status={r.status} /></Box></Tooltip> : <StatusChip status={r.status} />}</TableCell>
                  <TableCell><Typography variant="caption" color="text.secondary">{formatDt(r.createdAt)}</Typography></TableCell>
                  <TableCell align="right">
                    {r.status === UploadStatus.FAILED ? (
                      <IconButton size="small" disabled aria-label="View"><EyeIcon size={16} /></IconButton>
                    ) : r.status === UploadStatus.COMPLETED && r.instrumentId ? (
                      <Tooltip title="View">
                        <IconButton size="small" onClick={() => navigate(`/admin/instruments/${r.instrumentId}`)}><EyeIcon size={16} /></IconButton>
                      </Tooltip>
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
      </Paper>

      <Snackbar open={!!success} autoHideDuration={4000} onClose={() => setSuccess('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>
      </Snackbar>
    </Box>
  );
}
