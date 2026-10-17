import { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Chip, IconButton,
  Button, Tooltip, Alert, Snackbar,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import {
  PageHeader, KpiCards, DataCard, CardLink, StatusBadge, TL, tone,
  EyeIcon, CheckCircleIcon, BuildingLibraryIcon, ClipboardDocumentCheckIcon, ClipboardDocumentListIcon,
  CloudArrowUpIcon, ArrowUpTrayIcon, XMarkIcon, DocumentTextIcon, DocumentIcon, ArrowPathIcon,
  ExclamationTriangleIcon, ExclamationCircleIcon, CpuChipIcon, UserGroupIcon, QueueListIcon, InboxIcon,
} from 'shared';
import { useAuth } from '../../auth/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import RegulatoryCoverage from './RegulatoryCoverage';

const stageColors = {
  completed: { tone: 'green', color: tone('green').dot },
  processing: { tone: 'blue', color: tone('blue').dot },
  pending: { tone: 'amber', color: tone('amber').dot },
  failed: { tone: 'red', color: tone('red').dot },
  idle: { tone: 'gray', color: TL.gray300 },
};

function PipelineStage({ label, status }) {
  const c = stageColors[status] || stageColors.idle;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c.color, flexShrink: 0 }} />
      <Typography sx={{ color: status === 'idle' ? TL.gray400 : TL.gray600, fontWeight: 500, fontSize: '0.6875rem', whiteSpace: 'nowrap' }}>
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
  const [totalDiscovered, setTotalDiscovered] = useState(0);
  const [regulators, setRegulators] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [regulatorMap, setRegulatorMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState(null);
  const fileInputRefs = useRef({});

  const fetchData = () => {
    Promise.all([
      api.platform.jobs.stats(),
      api.platform.jobs.list('size=15'),
      api.platform.instruments.list('size=15'),
      api.platform.pendingDownloads.list('pending'),
      api.platform.regulators.list({ sortBy: 'name', sortDir: 'asc' }),
      api.platform.tenants.list(),
    ]).then(([statsData, jobsData, instrData, pendData, regData, tenData]) => {
      setStats(statsData);
      setJobs(jobsData.content || []);
      setInstruments(instrData.content || []);
      setTotalDiscovered(instrData.totalElements || 0);
      setPendings(pendData);
      setRegulators(Array.isArray(regData) ? regData : []);
      setTenants(Array.isArray(tenData) ? tenData : []);
      const map = {};
      if (Array.isArray(regData)) regData.forEach(r => { map[r.regulatorId] = r.abbreviation || r.name; });
      setRegulatorMap(map);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 60_000); return () => clearInterval(i); }, []);

  const documents = [
    ...pendings.map(p => ({ ...p, _source: 'pending', _sort: p.discoveredAt })),
    ...jobs.map(j => ({ ...j, _source: 'job', _sort: j.createdAt, title: [j.payload?.title, j.payload?.instrument_title, j.payload?.source_url].find(v => v && v.trim()) || j.lastError || '', sourceUrl: j.payload?.source_url || '', regulatorId: j.payload?.regulator_id })),
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

  const activeRegulators = regulators.filter(r => r.isActive && r.scraperEnabled).length;
  const activeTenants = tenants.filter(t => t.isActive).length;
  const ocrFailed = stats?.perType?.ocr_document?.failed || 0;
  const systemFailures = pendings.length + ocrFailed;
  const awaitingAi = stats?.perType?.classify_instrument?.pending || 0;
  const awaitingTenant = instruments.filter(i => i.status === 'published').length;
  const pipelineQueue = stats?.totalPending || 0;
  const v = (n) => (loading ? '...' : n);

  const kpiRoutes = {
    regulators: '/admin/regulators',
    tenants: '/admin/tenants',
    failures: '/admin/pipeline?tab=system',
    ai: '/admin/pipeline?tab=ai',
    tenant: '/admin/pipeline?tab=tenant',
    queue: '/admin/pipeline',
  };
  const kpis = [
    { key: 'regulators', label: 'Active Regulators', value: v(activeRegulators), tone: 'blue', icon: <BuildingLibraryIcon />,
      caption: loading ? undefined : `of ${regulators.length} regulators` },
    { key: 'tenants', label: 'Active Tenants', value: v(activeTenants), tone: 'green', icon: <CheckCircleIcon />,
      caption: loading ? undefined : `of ${tenants.length} onboarded` },
    { key: 'failures', label: 'System Failures', value: v(systemFailures), tone: systemFailures > 0 ? 'red' : 'green', icon: <ExclamationCircleIcon />,
      caption: loading ? undefined : `${pendings.length} downloads, ${ocrFailed} OCR failed` },
    { key: 'ai', label: 'Awaiting AI', value: v(awaitingAi), tone: awaitingAi > 0 ? 'orange' : 'green', icon: <CpuChipIcon />,
      caption: 'Classification jobs pending' },
    { key: 'tenant', label: 'Awaiting Tenant', value: v(awaitingTenant), tone: awaitingTenant > 0 ? 'blue' : 'green', icon: <UserGroupIcon />,
      caption: 'Published instruments' },
    { key: 'queue', label: 'Pipeline Queue', value: v(pipelineQueue), tone: pipelineQueue > 0 ? 'amber' : 'green', icon: <QueueListIcon />,
      caption: 'Jobs pending across stages' },
  ];

  const tenantStats = [
    { label: 'Active', value: activeTenants },
    { label: 'Licence Types', value: new Set(tenants.map(t => t.licenceType).filter(Boolean)).size },
    { label: 'Subscription Tiers', value: new Set(tenants.map(t => t.subscriptionTier).filter(Boolean)).size },
    { label: 'Regulator Subscriptions', value: tenants.reduce((n, t) => n + (t.regulators?.length || 0), 0) },
  ];

  const emptyRow = (cols, text) => (
    <TableRow><TableCell colSpan={cols} align="center" sx={{ py: 4 }}><Typography sx={{ fontSize: '0.8125rem', color: TL.gray500 }}>{text}</Typography></TableCell></TableRow>
  );

  const quickActions = [
    { label: 'Test Scraper', icon: <EyeIcon size={16} />, to: '/admin/regulators' },
    { label: 'View Pipeline', icon: <ClipboardDocumentCheckIcon size={16} />, to: '/admin/pipeline' },
    { label: 'Review Inbox', icon: <InboxIcon size={16} />, to: '/inbox' },
    { label: 'Upload Document', icon: <DocumentTextIcon size={16} />, to: '/admin/regulators' },
  ];

  return (
    <Box>
      <PageHeader
        title="Dashboard"
        subtitle="Intelligence Hub — compliance monitoring & regulatory horizon scanning"
        actions={(
          <>
            <Button variant="outlined" startIcon={<ArrowPathIcon size={16} />} onClick={() => window.location.reload()}>Refresh</Button>
            <Button variant="contained" startIcon={<ClipboardDocumentListIcon size={16} />}>Run Triage</Button>
          </>
        )}
      />

      {/* Row 1 — KPI Cards */}
      <KpiCards items={kpis} onSelect={(key) => navigate(kpiRoutes[key])} columns={3} />

      {/* Row 1.5 — Pipeline Health */}
      {!loading && <Box sx={{ mb: 3 }}>
        <Alert
          severity={pendings.length > 0 ? 'warning' : 'success'}
          icon={pendings.length > 0 ? <ExclamationTriangleIcon size={20} /> : <CheckCircleIcon size={20} />}
          action={pendings.length > 0 && (
            <Button color="inherit" size="small" onClick={() => navigate('/admin/pipeline?tab=system')}>
              View Failed
            </Button>
          )}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Pipeline Health: {totalDiscovered + pendings.length} discovered &middot; {totalDiscovered} processed &middot; {pendings.length} pending downloads
          </Typography>
        </Alert>
      </Box>}

      {/* Row 2 — Regulatory Coverage Analytics */}
      <RegulatoryCoverage />

      {/* Row 3 — Document Pipeline Table */}
      <DataCard
        title="Document Pipeline"
        subtitle="Latest 20 documents across discovery, OCR, classification and publishing"
        actions={<CardLink onClick={() => navigate('/admin/pipeline')}>View All</CardLink>}
        noPadding
        sx={{ mb: 3 }}
      >
        <TableContainer sx={{ maxHeight: 500 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 48 }}>#</TableCell>
                <TableCell>Document</TableCell>
                <TableCell>Regulator</TableCell>
                <TableCell>Pipeline Progress</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">PDF</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? emptyRow(6, 'Loading...') : documents.length === 0 ? emptyRow(6, 'No documents in pipeline yet') : documents.map((doc, idx) => {
                const stages = getPipelineStages(doc);
                const stageList = [
                  { label: 'Download', status: stages.download },
                  { label: 'OCR', status: stages.ocr },
                  { label: 'Classify', status: stages.classify },
                  { label: 'Publish', status: stages.publish },
                ];
                const regLabel = regulatorMap[doc.regulatorId] || `Reg #${doc.regulatorId}`;
                const hasPdf = doc._source === 'instrument' || (doc._source === 'job' && doc.payload?.pdf_s3_url);
                const statusKey = doc._source === 'pending' ? 'failed' : (doc.status === 'completed' || doc.status === 'published' ? 'completed' : 'pending');
                return (
                  <TableRow key={`${doc._source}-${doc.id || doc.jobId || doc.instrumentId}`} hover>
                    <TableCell sx={{ color: TL.gray400, fontFamily: TL.mono, fontSize: '0.75rem' }}>{idx + 1}</TableCell>
                    <TableCell>
                      {doc.sourceUrl && (
                        <Typography sx={{ fontFamily: TL.mono, fontSize: '0.75rem', color: TL.gray500, maxWidth: 260 }} noWrap>
                          {doc.sourceUrl}
                        </Typography>
                      )}
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: 'primary.main', maxWidth: 260 }} noWrap>
                        {doc.title || 'Untitled'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={regLabel} size="small" />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1.25 }}>
                        {stageList.map(s => (
                          <PipelineStage key={s.label} label={s.label} status={s.status} />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        label={doc._source === 'pending' ? 'Download Failed' : doc.status || doc._source}
                        tone={stageColors[statusKey].tone}
                        sx={{ textTransform: 'capitalize' }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {hasPdf ? (
                        <Tooltip title="View PDF">
                          <IconButton size="small" onClick={() => handlePdfView(doc)}>
                            <DocumentIcon size={16} />
                          </IconButton>
                        </Tooltip>
                      ) : doc._source === 'pending' ? (
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                          <Tooltip title="Upload PDF">
                            <IconButton size="small" onClick={() => handlePendUpload(doc.id)}>
                              <ArrowUpTrayIcon size={16} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Skip">
                            <IconButton size="small" onClick={() => handlePendSkip(doc.id)}>
                              <XMarkIcon size={16} />
                            </IconButton>
                          </Tooltip>
                          <input type="file" accept=".pdf,application/pdf" ref={(el) => { fileInputRefs.current[doc.id] = el; }} style={{ display: 'none' }} onChange={(e) => handlePendFile(doc.id, e)} />
                        </Box>
                      ) : (
                        <Typography component="span" sx={{ fontSize: '0.75rem', color: TL.gray400 }}>—</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </DataCard>

      {/* Row 4 — Tenant Overview + Pending Downloads / Quick Actions */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' }, gap: 3, alignItems: 'start' }}>
        <DataCard
          title="Tenant Overview"
          actions={<CardLink onClick={() => navigate('/admin/tenants')}>Manage Tenants</CardLink>}
          noPadding
        >
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, borderBottom: `1px solid ${TL.gray100}` }}>
            {tenantStats.map((s, i) => (
              <Box key={s.label} sx={{ px: 3, py: 2, borderLeft: i === 0 ? 0 : `1px solid ${TL.gray100}` }}>
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 500, color: TL.gray500, textTransform: 'uppercase', letterSpacing: '0.025em' }} noWrap>
                  {s.label}
                </Typography>
                <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: TL.gray800, mt: 0.25 }}>{loading ? '...' : s.value}</Typography>
              </Box>
            ))}
          </Box>
          <TableContainer sx={{ maxHeight: 320 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Tenant</TableCell>
                  <TableCell>Licence</TableCell>
                  <TableCell>Regulators</TableCell>
                  <TableCell>Tier</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? emptyRow(5, 'Loading...') : tenants.length === 0 ? emptyRow(5, 'No tenants onboarded yet') : tenants.map((t) => (
                  <TableRow key={t.tenantId} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/admin/tenants/${t.tenantId}`)}>
                    <TableCell>
                      <Typography sx={{ fontFamily: TL.mono, fontSize: '0.75rem', color: TL.gray500 }}>#{t.tenantId}</Typography>
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: 'primary.main' }}>{t.legalName || '—'}</Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>
                        Onboarded {t.onboardedAt ? new Date(t.onboardedAt).toLocaleDateString() : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>{t.licenceType || '—'}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {(t.regulatorAbbreviations || []).length > 0
                          ? t.regulatorAbbreviations.slice(0, 3).map((ab, i) => (
                            <Chip key={i} label={ab} size="small" />
                          ))
                          : <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>{(t.regulators || []).length} subscribed</Typography>}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <StatusBadge label={t.subscriptionTier || 'starter'} tone="blue" sx={{ textTransform: 'capitalize' }} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge label={t.isActive ? 'Active' : 'Inactive'} tone={t.isActive ? 'green' : 'red'} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DataCard>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <DataCard
            title={(
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                Pending Manual Downloads
                {pendings.length > 0 && <StatusBadge label={pendings.length} tone="red" />}
              </Box>
            )}
            actions={<CardLink onClick={() => navigate('/admin/pipeline?tab=system')}>View All</CardLink>}
            noPadding
          >
            {loading ? (
              <Typography sx={{ p: 3, fontSize: '0.8125rem', color: TL.gray500 }}>Loading...</Typography>
            ) : pendings.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center', color: TL.gray400 }}>
                <CloudArrowUpIcon size={32} sx={{ mb: 1 }} />
                <Typography sx={{ fontSize: '0.875rem', color: TL.gray700 }}>No pending downloads</Typography>
                <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>Failed PDFs from scraper runs appear here</Typography>
              </Box>
            ) : (
              <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                {pendings.map(pd => (
                  <Box key={pd.id} sx={{ px: 3, py: 1.5, borderBottom: `1px solid ${TL.gray100}`, '&:last-child': { borderBottom: 0 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ fontFamily: TL.mono, fontSize: '0.75rem', color: TL.gray500 }} noWrap>
                          {pd.sourceUrl?.length > 50 ? pd.sourceUrl.slice(0, 50) + '...' : pd.sourceUrl || ''}
                        </Typography>
                        <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: 'primary.main' }} noWrap>
                          {pd.title || 'Untitled Document'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                        <Tooltip title="Upload PDF">
                          <IconButton size="small" onClick={() => handlePendUpload(pd.id)}>
                            <ArrowUpTrayIcon size={16} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Skip">
                          <IconButton size="small" onClick={() => handlePendSkip(pd.id)}>
                            <XMarkIcon size={16} />
                          </IconButton>
                        </Tooltip>
                        <input type="file" accept=".pdf,application/pdf" ref={(el) => { fileInputRefs.current[pd.id] = el; }} style={{ display: 'none' }} onChange={(e) => handlePendFile(pd.id, e)} />
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, mt: 0.75 }}>
                      <Chip label={regulatorMap[pd.regulatorId] || `Reg #${pd.regulatorId}`} size="small" />
                      {pd.discoveredAt && <Chip label={new Date(pd.discoveredAt).toLocaleDateString()} size="small" />}
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </DataCard>

          <DataCard title="Quick Actions">
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
              {quickActions.map(a => (
                <Button key={a.label} variant="outlined" fullWidth startIcon={a.icon} sx={{ justifyContent: 'flex-start' }}
                  onClick={() => navigate(a.to)}>
                  {a.label}
                </Button>
              ))}
            </Box>
          </DataCard>
        </Box>
      </Box>

      <Snackbar open={!!snackbar} autoHideDuration={4000} onClose={() => setSnackbar(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {snackbar ? <Alert severity={snackbar.severity} onClose={() => setSnackbar(null)} variant="filled">{snackbar.message}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}
