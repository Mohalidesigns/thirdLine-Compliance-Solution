import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, TextField, Select, MenuItem, FormControl,
  Alert, CircularProgress, Table, TableBody,
  TableCell, TableHead, TableRow, TablePagination,
  Chip, Tooltip, Paper,
} from '@mui/material';
import {
  PageHeader, FilterBar, FilterField, StatusBadge, DataCard, TL,
  CloudArrowUpIcon, ArrowUpTrayIcon, ArrowPathIcon,
} from 'shared';
import { api } from '../services/api';

const UploadStatus = Object.freeze({
  QUEUED: 'queued', PROCESSING: 'processing', COMPLETED: 'completed', FAILED: 'failed', CONFIRMED: 'confirmed',
});

const STATUS_CONFIG = {
  [UploadStatus.QUEUED]:     { label: 'Queued',     tone: 'gray' },
  [UploadStatus.PROCESSING]: { label: 'Processing', tone: 'blue' },
  [UploadStatus.COMPLETED]:  { label: 'Completed',  tone: 'green' },
  [UploadStatus.FAILED]:     { label: 'Failed',     tone: 'red' },
  [UploadStatus.CONFIRMED]:  { label: 'Confirmed',  tone: 'purple' },
};

function StatusChip({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG[UploadStatus.QUEUED];
  return <StatusBadge label={cfg.label} tone={cfg.tone} />;
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
      formData.append('title', title.trim() || file.name.replace(/\.[^.]+$/, ''));
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
      <PageHeader
        title="Upload Document"
        subtitle="Upload a regulatory PDF for extraction, then review its obligations"
        actions={(
          <Button variant="outlined" startIcon={<ArrowPathIcon size={16} />} onClick={fetchRecords}>Refresh</Button>
        )}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <DataCard title="New Upload" sx={{ mb: 3 }} contentSx={{ display: 'flex', gap: 2, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <input type="file" accept=".pdf" hidden id="upload-file-input"
          onChange={e => {
            const f = e.target.files[0];
            setFile(f);
            // the file name is only a placeholder: pre-filling the box glued typed titles onto it
          }} />
        <FilterField label="File" minWidth={160}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <label htmlFor="upload-file-input" style={{ display: 'flex' }}>
              <Button variant="outlined" component="span" startIcon={<ArrowUpTrayIcon size={16} />}
                sx={{ height: 40, whiteSpace: 'nowrap', minWidth: 0, maxWidth: 200, justifyContent: 'flex-start', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
          <TextField size="small" placeholder={file ? file.name.replace(/\.[^.]+$/, '') : 'Title'} value={title}
            onChange={e => setTitle(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { height: 40 } }} />
        </FilterField>
        <FilterField label="Regulator" minWidth={150}>
          <FormControl size="small">
            <Select value={tenantRegulatorId} displayEmpty sx={{ height: 40 }}
              onChange={e => setTenantRegulatorId(e.target.value)}>
              <MenuItem value="">Regulator (opt)</MenuItem>
              {regulators.filter(r => r.isActive).map(r => (
                <MenuItem key={r.id} value={r.id}>{r.abbreviation}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </FilterField>
        <Button variant="contained" onClick={handleSubmit} disabled={uploading || !file}
          sx={{ height: 40, px: 3, minWidth: 120 }}
          startIcon={uploading ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <CloudArrowUpIcon size={16} />}>
          {uploading ? 'Uploading' : 'Upload'}
        </Button>
      </DataCard>

      <FilterBar>
        <FilterField label="Regulator" minWidth={160}>
          <Select size="small" value={regFilter} displayEmpty onChange={e => { setRegFilter(e.target.value); setPage(0); }}
            sx={{ height: 40 }}>
            <MenuItem value="">All</MenuItem>
            {regOptions.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </Select>
        </FilterField>
        <FilterField label="Status" minWidth={160}>
          <Select size="small" value={statusFilter} displayEmpty onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
            sx={{ height: 40 }}>
            <MenuItem value="">All</MenuItem>
            {statusOptions.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </Select>
        </FilterField>
      </FilterBar>

      <Paper sx={{ overflow: 'hidden' }}>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell sx={{ width: 110 }}>Regulator</TableCell>
                <TableCell sx={{ width: 130 }}>Status</TableCell>
                <TableCell sx={{ width: 170 }}>Uploaded</TableCell>
                <TableCell sx={{ width: 110 }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tableLoading && records.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}><CircularProgress /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: TL.gray400 }}>No uploads found.</TableCell></TableRow>
              ) : (
                filtered.slice(page * rowsPerPage, (page + 1) * rowsPerPage).map((r) => (
                  <TableRow key={r.id || r.uploadId} hover>
                    <TableCell><Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'primary.main', fontWeight: 500 }}>{r.title || r.originalFilename || '—'}</Typography></TableCell>
                    <TableCell><Chip label={regMap[r.tenantRegulatorId] || '—'} size="small" /></TableCell>
                    <TableCell>{r.status === 'failed' && r.errorMessage ? <Tooltip title={r.errorMessage}><Box component="span"><StatusChip status={r.status} /></Box></Tooltip> : <StatusChip status={r.status} />}</TableCell>
                    <TableCell sx={{ color: TL.gray500, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{formatDt(r.createdAt)}</TableCell>
                    <TableCell>
                      {r.status === UploadStatus.FAILED ? (
                        <Button size="small" variant="outlined" disabled>Review</Button>
                      ) : r.status === UploadStatus.COMPLETED ? (
                        <Button size="small" variant="contained" onClick={() => navigate('/review')}>Review</Button>
                      ) : (
                        <Typography variant="caption" color="text.secondary">Processing...</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Box>
        <TablePagination component="div" count={filtered.length} page={page} onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage} rowsPerPageOptions={[rowsPerPage]} />
      </Paper>
    </Box>
  );
}
