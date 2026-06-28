import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Grid, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TablePagination,
  IconButton, Tooltip, CircularProgress, Alert, Button, TextField,
  InputAdornment,
} from '@mui/material';
import {
  Refresh, CloudUpload, CheckCircle, ErrorOutline, HourglassEmpty,
  PlayArrow, PictureAsPdf, Close, Search,
} from '@mui/icons-material';
import api from '../../../services/api';
import { ROUTES } from '../../../utils/constants';
import UploadDialog from './UploadDialog';

const STAGE_LABELS = [
  { key: 'download', label: 'Download', color: '#3182CE' },
  { key: 'ocr', label: 'Extract Text', color: '#805AD5' },
  { key: 'classify', label: 'Analyze & Tag', color: '#DD6B20' },
  { key: 'publish', label: 'Send Alerts', color: '#2D7D46' },
];

const stageStatusIcon = {
  idle: null,
  pending: <HourglassEmpty sx={{ fontSize: 14 }} />,
  processing: <PlayArrow sx={{ fontSize: 14 }} />,
  completed: <CheckCircle sx={{ fontSize: 14 }} />,
  failed: <ErrorOutline sx={{ fontSize: 14 }} />,
};

const stageStatusColor = {
  idle: '#E2E8F0',
  pending: '#A0AEC0',
  processing: '#3182CE',
  completed: '#2D7D46',
  failed: '#C53030',
};

function formatDt(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function PipelineStages({ stages }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      {STAGE_LABELS.map((st, i) => {
        const status = stages?.[st.key] || 'idle';
        const color = stageStatusColor[status];
        const icon = stageStatusIcon[status];
        return (
          <Box key={st.key} sx={{ display: 'flex', alignItems: 'center' }}>
            <Tooltip title={`${st.label}: ${status}`}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, px: 0.6, py: 0.3, borderRadius: 1, bgcolor: `${color}14` }}>
                {icon && <Box sx={{ color }}>{icon}</Box>}
                <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color, whiteSpace: 'nowrap' }}>
                  {st.label}
                </Typography>
              </Box>
            </Tooltip>
            {i < STAGE_LABELS.length - 1 && (
              <Typography sx={{ color: '#CBD5E0', mx: 0.3, fontSize: '0.6rem' }}>▸</Typography>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

export default function JobQueuePage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [search, setSearch] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);

  function fetchAll() {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page, size: rowsPerPage });
    if (search) params.set('search', search);

    Promise.all([
      api.platform.jobs.list(params.toString()),
      api.platform.pendingDownloads.list('pending'),
      api.platform.regulators.list({ sortBy: 'name', sortDir: 'asc' }),
    ])
      .then(([jobsData, pendings, regsData]) => {
        const regMap = {};
        for (const r of (regsData.content || regsData || [])) {
          regMap[r.regulatorId || r.id] = r.name || r.abbreviation || `Regulator #${r.id}`;
        }
        const items = [];

        for (const job of (jobsData.content || [])) {
          const p = job.payload || {};
          const rid = p.regulator_id;
          const jobTitle = [p.title, p.instrument_title, p.source_url].find(v => v && v.trim());
          items.push({
            id: job.jobId,
            title: jobTitle || (job.lastError ? `Failed: ${job.lastError.substring(0, 60)}` : `Job #${job.jobId}`),
            regulator: regMap[rid] || '—',
            stages: getJobStages(job),
            status: job.status,
            updatedAt: job.updatedAt || job.createdAt,
            _source: 'job',
            _data: job,
          });
        }

        for (const pd of (pendings || [])) {
          items.push({
            id: `pd-${pd.id}`,
            title: pd.title || 'Untitled Document',
            regulator: pd.regulatorName || regMap[pd.regulatorId] || `Regulator #${pd.regulatorId}`,
            stages: { download: 'failed', ocr: 'idle', classify: 'idle', publish: 'idle' },
            status: 'download_failed',
            updatedAt: pd.createdAt,
            _source: 'pending',
            _data: pd,
          });
        }

        if (search) {
          const q = search.toLowerCase();
          setRows(items.filter(i => i.title.toLowerCase().includes(q) || i.regulator.toLowerCase().includes(q)));
        } else {
          setRows(items);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchAll(); }, [page, rowsPerPage, search]);

  async function handlePendUpload(id) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,application/pdf';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        await api.platform.pendingDownloads.upload(id, file);
        fetchAll();
      } catch (err) {
        alert('Upload failed: ' + err.message);
      }
    };
    input.click();
  }

  async function handlePendSkip(id) {
    try {
      await api.platform.pendingDownloads.skip(id);
      fetchAll();
    } catch (err) {
      alert('Skip failed: ' + err.message);
    }
  }

  const filtered = rows;
  const paged = filtered.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Document Pipeline</Typography>
          <Typography variant="body2" color="text.secondary">
            Track documents from download to delivery. Each document moves through 4 stages.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="contained" startIcon={<CloudUpload />} onClick={() => setUploadOpen(true)}>
            Upload Document
          </Button>
          <IconButton onClick={fetchAll}><Refresh /></IconButton>
        </Box>
      </Box>

      <Card sx={{ mb: 3, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {STAGE_LABELS.map((st) => (
              <Box key={st.key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: st.color }} />
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.7rem', color: st.color }}>
                    {st.label}
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', fontSize: '0.6rem', color: '#718096' }}>
                    {st.key === 'download' && 'Fetch PDF from regulator source'}
                    {st.key === 'ocr' && 'Read PDF content into searchable text'}
                    {st.key === 'classify' && 'AI identifies obligations, risks & topics'}
                    {st.key === 'publish' && 'Match to tenants and send notifications'}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>

      <TextField
        size="small" placeholder="Search by document title or regulator..." value={search}
        onChange={(e) => setSearch(e.target.value)} fullWidth sx={{ mb: 2 }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><Search sx={{ color: '#718096', fontSize: 20 }} /></InputAdornment>,
        }}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
      ) : (
        <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, color: '#4A5568', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1 }}>Document</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#4A5568', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1, width: 100 }}>Regulator</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#4A5568', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1 }}>Progress</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#4A5568', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1, width: 120 }}>Updated</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#4A5568', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1, width: 100 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paged.length === 0 ? (
                  <TableRow><TableCell colSpan={5} align="center" sx={{ py: 6, color: '#A0AEC0' }}>
                    {search ? 'No documents match your search' : 'No documents in the pipeline'}
                  </TableCell></TableRow>
                ) : paged.map((item, i) => (
                  <TableRow
                    key={item.id}
                    hover
                    sx={{ cursor: item._source === 'job' ? 'pointer' : 'default', '&:last-child td': { border: 0 }, bgcolor: i % 2 === 0 ? 'transparent' : '#F7FAFC' }}
                    onClick={() => { if (item._source === 'job') navigate(`${ROUTES.ADMIN_PIPELINE}/${item._data.jobId}`); }}
                  >
                    <TableCell>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.82rem' }}>{item.title}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={item.regulator} size="small"
                        sx={{ fontWeight: 700, fontSize: '0.65rem', bgcolor: '#1A365D', color: '#fff', borderRadius: 1 }} />
                    </TableCell>
                    <TableCell>
                      <PipelineStages stages={item.stages} />
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', color: '#718096', whiteSpace: 'nowrap' }}>
                      {formatDt(item.updatedAt)}
                    </TableCell>
                    <TableCell>
                      {item._source === 'pending' ? (
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Tooltip title="Upload PDF">
                            <IconButton size="small" onClick={(e) => { e.stopPropagation(); handlePendUpload(item._data.id); }}>
                              <CloudUpload sx={{ fontSize: 16, color: '#3182CE' }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Skip">
                            <IconButton size="small" onClick={(e) => { e.stopPropagation(); handlePendSkip(item._data.id); }}>
                              <Close sx={{ fontSize: 16, color: '#A0AEC0' }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      ) : (
                        <Tooltip title="View Details">
                          <IconButton size="small">
                            <PictureAsPdf sx={{ fontSize: 16, color: '#718096' }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={filtered.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[10, 20, 50]}
          />
        </Card>
      )}

      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={fetchAll}
      />
    </Box>
  );
}

function getJobStages(job) {
  const status = job.status;
  switch (job.jobType) {
    case 'ocr_document':
      return { download: 'completed', ocr: status, classify: 'idle', publish: 'idle' };
    case 'classify_instrument':
      return { download: 'completed', ocr: 'completed', classify: status, publish: 'idle' };
    case 'evaluate_applicability':
      return { download: 'completed', ocr: 'completed', classify: 'completed', publish: status };
    case 'send_webhooks':
      return { download: 'completed', ocr: 'completed', classify: 'completed', publish: status };
    default:
      return { download: 'idle', ocr: 'idle', classify: 'idle', publish: 'idle' };
  }
}
