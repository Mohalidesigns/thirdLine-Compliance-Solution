import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Typography, Paper, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TablePagination,
  IconButton, Tooltip, CircularProgress, Alert, Button,
  Tabs, Tab,
} from '@mui/material';
import {
  PageHeader, FilterBar, TL, tone,
  ArrowPathIcon, CloudArrowUpIcon, ArrowUpTrayIcon, CheckCircleIcon, ExclamationCircleIcon, ClockIcon,
  XMarkIcon, UserGroupIcon, QueueListIcon, CpuChipIcon, EyeIcon, ChevronRightIcon,
} from 'shared';
import api from '../../../services/api';
import { ROUTES } from '../../../utils/constants';
import UploadDialog from './UploadDialog';

const TABS = [
  { key: 'all', label: 'All', icon: <QueueListIcon size={16} /> },
  { key: 'system', label: 'System Errors', icon: <ExclamationCircleIcon size={16} /> },
  { key: 'ai', label: 'Awaiting AI', icon: <CpuChipIcon size={16} /> },
  { key: 'tenant', label: 'Awaiting Tenant', icon: <UserGroupIcon size={16} /> },
];

const STAGE_LABELS = [
  { key: 'download', label: 'Download', color: tone('blue').dot },
  { key: 'ocr', label: 'Extract Text', color: tone('purple').dot },
  { key: 'classify', label: 'Analyze & Tag', color: tone('orange').dot },
  { key: 'publish', label: 'Send Alerts', color: tone('green').dot },
];

const stageStatusIcon = {
  idle: null,
  pending: <ClockIcon size={14} />,
  processing: <ArrowPathIcon size={14} />,
  completed: <CheckCircleIcon size={14} />,
  failed: <ExclamationCircleIcon size={14} />,
};

const stageStatusTone = {
  idle: { bg: TL.gray50, fg: TL.gray400 },
  pending: { bg: tone('amber').bg, fg: tone('amber').fg },
  processing: { bg: tone('blue').bg, fg: tone('blue').fg },
  completed: { bg: tone('green').bg, fg: tone('green').fg },
  failed: { bg: tone('red').bg, fg: tone('red').fg },
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
        const st2 = stageStatusTone[status] || stageStatusTone.idle;
        const icon = stageStatusIcon[status];
        return (
          <Box key={st.key} sx={{ display: 'flex', alignItems: 'center' }}>
            <Tooltip title={`${st.label}: ${status}`}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.25, borderRadius: 9999, bgcolor: st2.bg, color: st2.fg }}>
                {icon && <Box sx={{ display: 'flex' }}>{icon}</Box>}
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: 'inherit', whiteSpace: 'nowrap' }}>
                  {st.label}
                </Typography>
              </Box>
            </Tooltip>
            {i < STAGE_LABELS.length - 1 && (
              <ChevronRightIcon size={12} sx={{ color: TL.gray300, mx: 0.25 }} />
            )}
          </Box>
        );
      })}
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
    default:
      return { download: 'idle', ocr: 'idle', classify: 'idle', publish: 'idle' };
  }
}

export default function JobQueuePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') || 'all';
  const [tab, setTab] = useState(['all', 'system', 'ai', 'tenant'].includes(tabParam) ? tabParam : 'all');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [search, setSearch] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);

  useEffect(() => {
    const t = ['all', 'system', 'ai', 'tenant'].includes(tabParam) ? tabParam : 'all';
    setTab(t);
  }, [tabParam]);

  function fetchAll() {
    setLoading(true);
    setError(null);

    const calls = [api.platform.regulators.list({ sortBy: 'name', sortDir: 'asc' })];

    if (tab === 'tenant') {
      calls.push(api.platform.instruments.list('status=published&size=50'));
    } else {
      const params = new URLSearchParams({ page, size: rowsPerPage });
      if (search) params.set('search', search);
      if (tab === 'system') {
        params.set('status', 'failed');
      } else if (tab === 'ai') {
        params.set('status', 'pending,processing');
        params.set('jobType', 'classify_instrument');
      }
      calls.push(api.platform.jobs.list(params.toString()));
      if (tab === 'system') {
        calls.push(api.platform.pendingDownloads.list('pending'));
      } else {
        calls.push(Promise.resolve([]));
      }
    }

    Promise.all(calls)
      .then(([regsData, ...rest]) => {
        const regMap = {};
        for (const r of (regsData.content || regsData || [])) {
          regMap[r.regulatorId || r.id] = r.name || r.abbreviation || `Regulator #${r.id}`;
        }
        const items = [];

        if (tab === 'tenant') {
          const instrData = rest[0];
          for (const inst of (instrData.content || instrData || [])) {
            items.push({
              id: `inst-${inst.instrumentId}`,
              instrumentId: inst.instrumentId,
              title: inst.sourceTitle || 'Untitled',
              regulator: regMap[inst.regulatorId] || '—',
              stages: { download: 'completed', ocr: 'completed', classify: 'completed', publish: 'completed' },
              status: 'published',
              updatedAt: inst.firstPublishedAt || inst.discoveredAt,
              _source: 'instrument',
              _data: inst,
            });
          }
        } else {
          const jobsData = rest[0];
          const pendings = rest[1] || [];

          for (const job of (jobsData.content || [])) {
            const p = job.payload || {};
            const rid = p.regulator_id;
            const jobTitle = [p.title, p.instrument_title, p.source_url].find(v => v && v.trim());
            const fallback = job.lastError
              ? `${job.jobType?.replace(/_/g, ' ')?.replace(/\b\w/g, c => c.toUpperCase())}: ${job.lastError.substring(0, 60)}`
              : `Job #${job.jobId}`;
            items.push({
              id: job.jobId,
              instrumentId: job.subjectId,
              title: jobTitle || fallback,
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
              sourceUrl: pd.sourceUrl || '',
              regulator: pd.regulatorName || regMap[pd.regulatorId] || `Regulator #${pd.regulatorId}`,
              stages: { download: 'failed', ocr: 'idle', classify: 'idle', publish: 'idle' },
              status: 'download_failed',
              updatedAt: pd.createdAt,
              _source: 'pending',
              _data: pd,
            });
          }
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

  useEffect(() => { fetchAll(); }, [tab, page, rowsPerPage, search]);

  const handleTabChange = (_, newTab) => {
    setTab(newTab);
    setPage(0);
    setSearchParams(newTab === 'all' ? {} : { tab: newTab });
  };

  const handleRowClick = (item) => {
    if (item._source === 'instrument') {
      navigate(`/admin/instruments/${item.instrumentId}/tenants`);
    } else if (item._source === 'job') {
      navigate(`${ROUTES.ADMIN_PIPELINE}/${item._data.jobId}`);
    }
  };

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

  const stageDescriptions = {
    download: 'Fetch PDF from regulator source',
    ocr: 'Read PDF content into searchable text',
    classify: 'AI identifies obligations, risks & topics',
    publish: 'Match to tenants and send notifications',
  };

  return (
    <Box>
      <PageHeader
        title="Document Pipeline"
        subtitle="Track documents through every stage of the pipeline."
        actions={(
          <>
            <Button variant="outlined" startIcon={<ArrowPathIcon size={16} />} onClick={fetchAll}>Refresh</Button>
            <Button variant="contained" startIcon={<CloudArrowUpIcon size={16} />} onClick={() => setUploadOpen(true)}>
              Upload Document
            </Button>
          </>
        )}
        sx={{ pb: 0 }}
      >
        <Tabs value={tab} onChange={handleTabChange} sx={{ mb: '-1px' }}>
          {TABS.map(t => (
            <Tab key={t.key} value={t.key} icon={t.icon} iconPosition="start" label={t.label} />
          ))}
        </Tabs>
      </PageHeader>

      {tab === 'all' && (
        <Paper sx={{ mb: 3, p: 3 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 3 }}>
            {STAGE_LABELS.map((st, i) => (
              <Box key={st.key} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <Box sx={{
                  width: 32, height: 32, borderRadius: '8px', bgcolor: TL.gray50, border: `1px solid ${TL.gray100}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  fontSize: '0.8125rem', fontWeight: 700, color: st.color,
                }}>
                  {i + 1}
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: TL.gray800 }}>
                    {st.label}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>
                    {stageDescriptions[st.key]}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Paper>
      )}

      <FilterBar
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(0); }, placeholder: 'Search by document title or regulator...' }}
        showClear={!!search}
        onClear={() => { setSearch(''); setPage(0); }}
      />

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!loading && !error && (
        <Paper sx={{ overflow: 'hidden' }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Document</TableCell>
                  <TableCell sx={{ width: 100 }}>Regulator</TableCell>
                  <TableCell>Progress</TableCell>
                  <TableCell sx={{ width: 120 }}>Updated</TableCell>
                  <TableCell align="right" sx={{ width: 100 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paged.length === 0 ? (
                  <TableRow><TableCell colSpan={5} align="center" sx={{ py: 6, color: TL.gray500 }}>
                    {search ? 'No documents match your search' : 'No documents in this view'}
                  </TableCell></TableRow>
                ) : paged.map((item) => (
                  <TableRow
                    key={item.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handleRowClick(item)}
                  >
                    <TableCell>
                      <Typography sx={{ fontWeight: 500, fontSize: '0.875rem', color: 'primary.main' }}>{item.title}</Typography>
                      {item.sourceUrl && (
                        <Typography
                          component="a"
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          sx={{ fontFamily: TL.mono, fontSize: '0.75rem', color: TL.gray500, textDecoration: 'none', display: 'block', mt: 0.25, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', '&:hover': { color: TL.primary, textDecoration: 'underline' } }}
                        >
                          {item.sourceUrl}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip label={item.regulator} size="small" />
                    </TableCell>
                    <TableCell>
                      <PipelineStages stages={item.stages} />
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.8125rem', color: TL.gray500, whiteSpace: 'nowrap' }}>
                      {formatDt(item.updatedAt)}
                    </TableCell>
                    <TableCell align="right">
                      {item._source === 'pending' ? (
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                          <Tooltip title="Upload PDF">
                            <IconButton size="small" onClick={(e) => { e.stopPropagation(); handlePendUpload(item._data.id); }}>
                              <ArrowUpTrayIcon size={16} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Skip">
                            <IconButton size="small" onClick={(e) => { e.stopPropagation(); handlePendSkip(item._data.id); }}>
                              <XMarkIcon size={16} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      ) : item._source === 'instrument' ? (
                        <Tooltip title="View tenant classifications">
                          <IconButton size="small">
                            <UserGroupIcon size={16} />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Tooltip title="View job details">
                          <IconButton size="small">
                            <EyeIcon size={16} />
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
        </Paper>
      )}

      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={fetchAll}
      />
    </Box>
  );
}
