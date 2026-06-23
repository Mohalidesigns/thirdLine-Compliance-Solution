import { useState, useEffect, useRef } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Chip, IconButton,
  Button, Tooltip, Alert, Snackbar,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
} from '@mui/material';
import {
  Visibility, CheckCircle, Schedule, ErrorOutline, LibraryBooks,
  AssignmentTurnedIn, CloudOff, CloudDownload, Close,
  Description, PictureAsPdf, Refresh,
} from '@mui/icons-material';
import { useAuth } from '../../auth/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';

const stageColors = {
  completed: { bg: '#E6F4EA', color: '#2D7D46' },
  processing: { bg: '#EBF8FF', color: '#3182CE' },
  pending: { bg: '#FEF9E7', color: '#D4AF37' },
  failed: { bg: '#FEE2E2', color: '#C53030' },
  idle: { bg: '#EDF2F7', color: '#A0AEC0' },
};

function KpiCard({ title, value, icon, color, loading, onClick }) {
  return (
    <Card sx={{ height: '100%', cursor: onClick ? 'pointer' : 'default', '&:hover': onClick ? { boxShadow: 4 } : {} }} onClick={onClick}>
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
          <Typography variant="body2" sx={{ color: '#718096', fontWeight: 500 }}>{title}</Typography>
          <Avatar sx={{ width: 36, height: 36, bgcolor: `${color}15`, color: color }}>
            {icon}
          </Avatar>
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          {loading ? '...' : value}
        </Typography>
      </CardContent>
    </Card>
  );
}

function Avatar({ sx, children }) {
  return (
    <Box sx={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', ...sx }}>
      {children}
    </Box>
  );
}

function PipelineStage({ label, status }) {
  const c = stageColors[status] || stageColors.idle;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c.color, flexShrink: 0 }} />
      <Typography variant="caption" sx={{ color: c.color, fontWeight: 600, fontSize: '0.6rem' }}>
        {label}
      </Typography>
    </Box>
  );
}

function getPipelineStages(item) {
  if (item._source === 'pending') {
    return { download: 'failed', ocr: 'idle', classify: 'idle', publish: 'idle' };
  }
  if (item._source === 'job') {
    const stages = { download: 'completed', ocr: 'idle', classify: 'idle', publish: 'idle' };
    if (item.jobType === 'ocr_document') stages.ocr = item.status === 'completed' ? 'completed' : item.status;
    if (item.jobType === 'classify_instrument') { stages.ocr = 'completed'; stages.classify = item.status === 'completed' ? 'completed' : item.status; }
    if (item.jobType === 'evaluate_applicability') { stages.ocr = 'completed'; stages.classify = 'completed'; stages.publish = item.status === 'completed' ? 'completed' : item.status; }
    if (item.jobType === 'send_webhooks') { stages.ocr = 'completed'; stages.classify = 'completed'; stages.publish = item.status === 'completed' ? 'completed' : item.status; }
    return stages;
  }
  if (item._source === 'instrument') {
    const stages = { download: 'completed', ocr: 'completed', classify: 'completed', publish: 'completed' };
    if (item.status === 'unclassified' || item.status === 'inst_triage') stages.classify = 'pending';
    if (item.status === 'classified' || item.status === 'under_review') stages.classify = 'completed';
    if (item.status === 'published') stages.publish = 'completed';
    return stages;
  }
  return { download: 'idle', ocr: 'idle', classify: 'idle', publish: 'idle' };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [instruments, setInstruments] = useState([]);
  const [pendings, setPendings] = useState([]);
  const [regulators, setRegulators] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [regulatorMap, setRegulatorMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState(null);
  const fileInputRefs = useRef({});

  useEffect(() => {
    Promise.all([
      api.platform.jobs.stats(),
      api.platform.jobs.list('size=15'),
      api.platform.instruments.list('size=15'),
      api.platform.pendingDownloads.list('pending'),
      api.platform.regulators.list(true),
      api.platform.tenants.list(),
    ]).then(([statsData, jobsData, instrData, pendData, regData, tenData]) => {
      setStats(statsData);
      setJobs(jobsData.content || []);
      setInstruments(instrData.content || []);
      setPendings(pendData);
      setRegulators(Array.isArray(regData) ? regData : []);
      setTenants(Array.isArray(tenData) ? tenData : []);
      const map = {};
      if (Array.isArray(regData)) regData.forEach(r => { map[r.regulatorId] = r.abbreviation || r.name; });
      setRegulatorMap(map);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const documents = [
    ...pendings.map(p => ({ ...p, _source: 'pending', _sort: p.discoveredAt })),
    ...jobs.map(j => ({ ...j, _source: 'job', _sort: j.createdAt, title: j.payload?.title || '', sourceUrl: j.payload?.source_url || '', regulatorId: j.payload?.regulator_id })),
    ...instruments.map(i => ({ ...i, _source: 'instrument', _sort: i.discoveredAt, title: i.sourceTitle, sourceUrl: i.sourceUrl, pdfUrl: i.pdfUrl })),
  ].sort((a, b) => (b._sort || '') > (a._sort || '') ? 1 : -1).slice(0, 20);

  const handlePdfView = async (item) => {
    try {
      let pdfUrl;
      if (item._source === 'instrument') {
        const res = await api.platform.instruments.getPdfUrl(item.instrumentId);
        pdfUrl = res?.pdfUrl;
      } else if (item._source === 'job' && item.jobId) {
        const res = await api.platform.jobs.getPdfUrl(item.jobId);
        pdfUrl = res?.pdfUrl;
      }
      if (pdfUrl) window.open(pdfUrl, '_blank');
      else setSnackbar({ severity: 'warning', message: 'No PDF available for this item.' });
    } catch (err) {
      setSnackbar({ severity: 'error', message: `Failed to load PDF: ${err.message}` });
    }
  };

  const handlePendUpload = (id) => { fileInputRefs.current[id]?.click(); };
  const handlePendFile = async (id, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await api.platform.pendingDownloads.upload(id, file);
      setSnackbar({ severity: 'success', message: 'PDF uploaded successfully. Pipeline will process it.' });
      setPendings(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      setSnackbar({ severity: 'error', message: `Upload failed: ${err.message}` });
    }
    e.target.value = '';
  };
  const handlePendSkip = async (id) => {
    try {
      await api.platform.pendingDownloads.skip(id);
      setSnackbar({ severity: 'info', message: 'Marked as skipped.' });
      setPendings(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      setSnackbar({ severity: 'error', message: `Failed to skip: ${err.message}` });
    }
  };

  useEffect(() => {
    if (!user || user.role !== 'PLATFORM_ADMIN') {
      navigate('/inbox', { replace: true });
    }
  }, [user, navigate]);

  if (!user || user.role !== 'PLATFORM_ADMIN') return null;

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Intelligence Hub Dashboard</Typography>
          <Typography variant="body2" color="text.secondary">Compliance Monitoring & Regulatory Horizon Scanning</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" startIcon={<Refresh />} onClick={() => window.location.reload()}>Refresh</Button>
          <Button variant="contained" size="small" sx={{ bgcolor: '#1A365D' }} startIcon={<AssignmentTurnedIn />}>Run Triage</Button>
        </Box>
      </Box>

      {/* Row 1 — KPI Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard title="Active Regulators" value={regulators.filter(r => r.isActive && r.scraperEnabled).length} icon={<LibraryBooks sx={{ fontSize: 20 }} />} color="#1A365D" loading={loading}
            onClick={() => navigate('/admin/regulators')} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard title="Active Tenants" value={tenants.filter(t => t.isActive).length} icon={<CheckCircle sx={{ fontSize: 20 }} />} color="#2D7D46" loading={loading}
            onClick={() => navigate('/admin/tenants')} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard title="Pipeline Queue" value={stats?.totalPending || 0} icon={<Schedule sx={{ fontSize: 20 }} />} color="#D4AF37" loading={loading}
            onClick={() => navigate('/admin/pipeline')} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard title="Jobs Failed Today" value={stats?.totalFailed || 0} icon={<ErrorOutline sx={{ fontSize: 20 }} />} color={stats?.totalFailed > 0 ? '#C53030' : '#2D7D46'} loading={loading}
            onClick={() => navigate('/admin/pipeline?status=failed')} />
        </Grid>
      </Grid>

      {/* Row 2 — Document Pipeline Table */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>Document Pipeline</Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 500 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Document</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Regulator</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Pipeline Progress</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }} align="center">PDF</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} align="center"><Typography variant="caption" color="text.secondary">Loading...</Typography></TableCell></TableRow>
                ) : documents.length === 0 ? (
                  <TableRow><TableCell colSpan={6} align="center"><Typography variant="caption" color="text.secondary">No documents in pipeline yet</Typography></TableCell></TableRow>
                ) : documents.map((doc, idx) => {
                  const stages = getPipelineStages(doc);
                  const stageList = [
                    { label: 'Download', status: stages.download },
                    { label: 'OCR', status: stages.ocr },
                    { label: 'Classify', status: stages.classify },
                    { label: 'Publish', status: stages.publish },
                  ];
                  const regLabel = regulatorMap[doc.regulatorId] || `Reg #${doc.regulatorId}`;
                  const hasPdf = doc._source === 'instrument' || (doc._source === 'job' && doc.payload?.pdf_s3_url);
                  return (
                    <TableRow key={`${doc._source}-${doc.id || doc.jobId || doc.instrumentId}`} hover>
                      <TableCell sx={{ fontSize: '0.7rem', color: '#718096' }}>{idx + 1}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.8rem', maxWidth: 220 }} noWrap>
                          {doc.title || 'Untitled'}
                        </Typography>
                        {doc.sourceUrl && (
                          <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: '0.6rem', maxWidth: 220 }} noWrap>
                            {doc.sourceUrl}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip label={regLabel} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#EDF2F7', color: '#4A5568' }} />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {stageList.map(s => (
                            <PipelineStage key={s.label} label={s.label} status={s.status} />
                          ))}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={doc._source === 'pending' ? 'Download Failed' : doc.status || doc._source}
                          size="small"
                          sx={{
                            height: 18, fontSize: '0.6rem', fontWeight: 600,
                            bgcolor: stageColors[doc._source === 'pending' ? 'failed' : (doc.status === 'completed' || doc.status === 'published' ? 'completed' : 'pending')].bg,
                            color: stageColors[doc._source === 'pending' ? 'failed' : (doc.status === 'completed' || doc.status === 'published' ? 'completed' : 'pending')].color,
                          }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        {hasPdf ? (
                          <Tooltip title="View PDF">
                            <IconButton size="small" sx={{ width: 24, height: 24 }} onClick={() => handlePdfView(doc)}>
                              <PictureAsPdf sx={{ fontSize: 14, color: '#C53030' }} />
                            </IconButton>
                          </Tooltip>
                        ) : doc._source === 'pending' ? (
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                            <Tooltip title="Upload PDF">
                              <IconButton size="small" sx={{ width: 20, height: 20 }} onClick={() => handlePendUpload(doc.id)}>
                                <CloudDownload sx={{ fontSize: 12, color: '#1A365D' }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Skip">
                              <IconButton size="small" sx={{ width: 20, height: 20 }} onClick={() => handlePendSkip(doc.id)}>
                                <Close sx={{ fontSize: 12, color: '#718096' }} />
                              </IconButton>
                            </Tooltip>
                            <input type="file" accept=".pdf,application/pdf" ref={(el) => { fileInputRefs.current[doc.id] = el; }} style={{ display: 'none' }} onChange={(e) => handlePendFile(doc.id, e)} />
                          </Box>
                        ) : (
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>—</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Row 3 — Bottom */}
      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
              <Box sx={{ p: 2, pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <CloudOff sx={{ fontSize: 20, color: '#C53030' }} />
                <Typography variant="h6" sx={{ fontWeight: 600, flex: 1 }}>
                  Pending Manual Downloads
                  {pendings.length > 0 && (
                    <Chip size="small" label={pendings.length} sx={{ ml: 1, bgcolor: '#FEE2E2', color: '#C53030', fontWeight: 700, fontSize: '0.65rem' }} />
                  )}
                </Typography>
              </Box>
              {loading ? (
                <Typography variant="caption" sx={{ display: 'block', p: 2, color: '#718096' }}>Loading...</Typography>
              ) : pendings.length === 0 ? (
                <Box sx={{ p: 2, textAlign: 'center' }}>
                  <CloudDownload sx={{ fontSize: 32, color: '#A0AEC0', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">No pending downloads</Typography>
                  <Typography variant="caption" color="text.secondary">Failed PDFs from scraper runs appear here</Typography>
                </Box>
              ) : (
                <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                  {pendings.map(pd => (
                    <Box key={pd.id} sx={{ p: 1.5, borderBottom: '1px solid #E2E8F0', '&:last-child': { borderBottom: 0 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.75rem', flex: 1, mr: 1 }} noWrap>
                          {pd.title || 'Untitled Document'}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                          <Tooltip title="Upload PDF">
                            <IconButton size="small" sx={{ width: 24, height: 24 }} onClick={() => handlePendUpload(pd.id)}>
                              <CloudDownload sx={{ fontSize: 14, color: '#1A365D' }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Skip">
                            <IconButton size="small" sx={{ width: 24, height: 24 }} onClick={() => handlePendSkip(pd.id)}>
                              <Close sx={{ fontSize: 14, color: '#718096' }} />
                            </IconButton>
                          </Tooltip>
                          <input type="file" accept=".pdf,application/pdf" ref={(el) => { fileInputRefs.current[pd.id] = el; }} style={{ display: 'none' }} onChange={(e) => handlePendFile(pd.id, e)} />
                        </Box>
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', display: 'block' }}>
                        {pd.sourceUrl?.length > 50 ? pd.sourceUrl.slice(0, 50) + '...' : pd.sourceUrl || ''}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                        <Chip label={regulatorMap[pd.regulatorId] || `Reg #${pd.regulatorId}`} size="small" sx={{ height: 14, fontSize: '0.55rem', bgcolor: '#EDF2F7', color: '#4A5568' }} />
                        <Chip label={pd.discoveredAt ? new Date(pd.discoveredAt).toLocaleDateString() : ''} size="small" sx={{ height: 14, fontSize: '0.55rem', bgcolor: '#EDF2F7', color: '#4A5568' }} />
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Quick Actions</Typography>
              <Grid container spacing={1.5}>
                <Grid item xs={6}>
                  <Button variant="outlined" size="small" fullWidth startIcon={<Visibility />} sx={{ justifyContent: 'flex-start', fontSize: '0.75rem' }}
                    onClick={() => navigate('/admin/regulators')}>
                    Test Scraper
                  </Button>
                </Grid>
                <Grid item xs={6}>
                  <Button variant="outlined" size="small" fullWidth startIcon={<AssignmentTurnedIn />} sx={{ justifyContent: 'flex-start', fontSize: '0.75rem' }}
                    onClick={() => navigate('/admin/pipeline')}>
                    View Pipeline
                  </Button>
                </Grid>
                <Grid item xs={6}>
                  <Button variant="outlined" size="small" fullWidth startIcon={<LibraryBooks />} sx={{ justifyContent: 'flex-start', fontSize: '0.75rem' }}
                    onClick={() => navigate('/inbox')}>
                    Review Inbox
                  </Button>
                </Grid>
                <Grid item xs={6}>
                  <Button variant="outlined" size="small" fullWidth startIcon={<Description />} sx={{ justifyContent: 'flex-start', fontSize: '0.75rem' }}
                    onClick={() => navigate('/admin/regulators')}>
                    Upload Document
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Snackbar open={!!snackbar} autoHideDuration={4000} onClose={() => setSnackbar(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {snackbar ? <Alert severity={snackbar.severity} onClose={() => setSnackbar(null)} variant="filled">{snackbar.message}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}
