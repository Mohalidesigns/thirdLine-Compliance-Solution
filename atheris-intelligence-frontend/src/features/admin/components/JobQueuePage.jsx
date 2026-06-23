import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TablePagination,
  IconButton, Tooltip, CircularProgress, Alert, Select, MenuItem,
  FormControl, InputLabel, Drawer, Divider,
} from '@mui/material';
import {
  Refresh, ErrorOutline, CheckCircle, HourglassEmpty, PlayArrow,
  Schedule, Warning, Close, OpenInNew,
} from '@mui/icons-material';
import api from '../../../services/api';

const jobTypeLabels = {
  ocr_document: { label: 'OCR', color: '#3182CE' },
  classify_instrument: { label: 'Classify', color: '#805AD5' },
  evaluate_applicability: { label: 'Applicability', color: '#DD6B20' },
  send_webhooks: { label: 'Webhook', color: '#2D7D46' },
};

const statusConfig = {
  pending: { label: 'Pending', color: '#718096', bg: '#EDF2F7', icon: <HourglassEmpty sx={{ fontSize: 14 }} /> },
  processing: { label: 'Processing', color: '#3182CE', bg: '#EBF8FF', icon: <PlayArrow sx={{ fontSize: 14 }} /> },
  completed: { label: 'Completed', color: '#2D7D46', bg: '#E6F4EA', icon: <CheckCircle sx={{ fontSize: 14 }} /> },
  failed: { label: 'Failed', color: '#C53030', bg: '#FEE2E2', icon: <ErrorOutline sx={{ fontSize: 14 }} /> },
};

function formatDt(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatLocalDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function JobQueuePage() {
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [jobTypeFilter, setJobTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Detail drawer
  const [selectedJob, setSelectedJob] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  function fetchJobs() {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set('page', page);
    params.set('size', rowsPerPage);
    if (jobTypeFilter) params.set('jobType', jobTypeFilter);
    if (statusFilter) params.set('status', statusFilter);

    Promise.all([
      api.platform.jobs.list(params.toString()),
      api.platform.jobs.stats(),
    ])
      .then(([jobsData, statsData]) => {
        setJobs(jobsData.content || []);
        setTotal(jobsData.totalElements || 0);
        setStats(statsData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchJobs(); }, [page, rowsPerPage, jobTypeFilter, statusFilter]);

  function openJobDetail(job) {
    setSelectedJob(job);
    setDrawerOpen(true);
    setDetailLoading(true);
    setDetail(null);
    api.platform.jobs.get(job.jobId)
      .then((data) => setDetail(data))
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Pipeline Jobs</Typography>
          <Typography variant="body2" color="text.secondary">Monitor OCR, classification, applicability, and webhook delivery jobs</Typography>
        </Box>
        <IconButton onClick={fetchJobs}><Refresh /></IconButton>
      </Box>

      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            { label: 'Pending', value: stats.totalPending, color: '#718096', icon: <HourglassEmpty /> },
            { label: 'Processing', value: stats.totalProcessing, color: '#3182CE', icon: <PlayArrow /> },
            { label: 'Completed', value: stats.totalCompleted, color: '#2D7D46', icon: <CheckCircle /> },
            { label: 'Failed', value: stats.totalFailed, color: stats.totalFailed > 0 ? '#C53030' : '#2D7D46', icon: stats.totalFailed > 0 ? <ErrorOutline /> : <CheckCircle /> },
          ].map((s) => (
            <Grid item xs={6} md={3} key={s.label}>
              <Card>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ color: s.color }}>{s.icon}</Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: s.color }}>{s.value}</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {stats && stats.perType && (
        <Grid container spacing={1.5} sx={{ mb: 3 }}>
          {Object.entries(stats.perType).map(([type, statuses]) => {
            const cfg = jobTypeLabels[type] || { label: type, color: '#718096' };
            return (
              <Grid item key={type}>
                <Card variant="outlined" sx={{ px: 1.5, py: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: cfg.color }}>{cfg.label}</Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                    {Object.entries(statuses).map(([st, cnt]) => {
                      const sc = statusConfig[st] || { label: st, color: '#718096', bg: '#EDF2F7' };
                      return (
                        <Chip key={st} size="small" label={`${sc.label}: ${cnt}`} sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, bgcolor: sc.bg, color: sc.color }} />
                      );
                    })}
                  </Box>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Job Type</InputLabel>
          <Select value={jobTypeFilter} label="Job Type" onChange={(e) => { setJobTypeFilter(e.target.value); setPage(0); }}>
            <MenuItem value="">All Types</MenuItem>
            {Object.entries(jobTypeLabels).map(([type, cfg]) => (
              <MenuItem key={type} value={type}>{cfg.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Status</InputLabel>
          <Select value={statusFilter} label="Status" onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}>
            <MenuItem value="">All Statuses</MenuItem>
            {Object.entries(statusConfig).map(([st, cfg]) => (
              <MenuItem key={st} value={st}>{cfg.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      ) : (
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Subject</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>Attempts</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Last Error</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {jobs.length === 0 ? (
                  <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: '#718096' }}>No jobs found</TableCell></TableRow>
                ) : jobs.map((job) => {
                  const typeCfg = jobTypeLabels[job.jobType] || { label: job.jobType, color: '#718096' };
                  const stCfg = statusConfig[job.status] || { label: job.status, color: '#718096', bg: '#EDF2F7', icon: null };
                  return (
                    <TableRow key={job.jobId} hover sx={{ cursor: 'pointer' }} onClick={() => openJobDetail(job)}>
                      <TableCell sx={{ fontSize: '0.75rem', fontFamily: 'Roboto Mono' }}>{job.jobId}</TableCell>
                      <TableCell>
                        <Chip label={typeCfg.label} size="small" sx={{ fontWeight: 700, bgcolor: `${typeCfg.color}18`, color: typeCfg.color, fontSize: '0.65rem' }} />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem' }}>{job.subjectId || '—'}</TableCell>
                      <TableCell>
                        <Chip size="small" icon={stCfg.icon} label={stCfg.label} sx={{ bgcolor: stCfg.bg, color: stCfg.color, fontWeight: 600, fontSize: '0.65rem' }} />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem' }}>
                        <Chip label={job.priority === 1 ? 'HIGH' : 'LOW'} size="small" sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700, bgcolor: job.priority === 1 ? '#FEF3E2' : '#EDF2F7', color: job.priority === 1 ? '#DD6B20' : '#718096' }} />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem' }}>{job.attemptCount}/{job.maxAttempts}</TableCell>
                      <TableCell sx={{ fontSize: '0.7rem', color: '#718096', whiteSpace: 'nowrap' }}>{formatDt(job.createdAt)}</TableCell>
                      <TableCell sx={{ fontSize: '0.7rem', color: '#C53030', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {job.lastError ? (
                          <Tooltip title={job.lastError}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Warning sx={{ fontSize: 12 }} />
                              {job.lastError.substring(0, 50)}...
                            </Box>
                          </Tooltip>
                        ) : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[10, 20, 50]}
          />
        </Card>
      )}

      {/* Job Detail Drawer */}
      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)} sx={{ '& .MuiDrawer-paper': { width: 640, p: 3 } }}>
        {selectedJob && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Job #{selectedJob.jobId}</Typography>
              <IconButton onClick={() => setDrawerOpen(false)}><Close /></IconButton>
            </Box>

            {detailLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
            ) : detail ? (
              <>
                {/* Job Info */}
                <Divider sx={{ mb: 2 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#1A365D' }}>JOB DETAILS</Typography>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={4}>
                    <Typography variant="caption" color="text.secondary">Type</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{jobTypeLabels[detail.jobType]?.label || detail.jobType}</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="caption" color="text.secondary">Status</Typography>
                    <Box sx={{ mt: 0.3 }}>
                      <Chip size="small" icon={statusConfig[detail.status]?.icon} label={statusConfig[detail.status]?.label || detail.status}
                        sx={{ bgcolor: statusConfig[detail.status]?.bg || '#EDF2F7', color: statusConfig[detail.status]?.color || '#718096', fontWeight: 600, fontSize: '0.65rem' }} />
                    </Box>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="caption" color="text.secondary">Priority</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{detail.priority === 1 ? 'HIGH' : 'LOW'}</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="caption" color="text.secondary">Attempts</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{detail.attemptCount}/{detail.maxAttempts}</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="caption" color="text.secondary">Created</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>{formatDt(detail.createdAt)}</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="caption" color="text.secondary">Service</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{detail.createdByService || '—'}</Typography>
                  </Grid>
                  {detail.startedAt && (
                    <Grid item xs={4}>
                      <Typography variant="caption" color="text.secondary">Started</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>{formatDt(detail.startedAt)}</Typography>
                    </Grid>
                  )}
                  {detail.completedAt && (
                    <Grid item xs={4}>
                      <Typography variant="caption" color="text.secondary">Completed</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>{formatDt(detail.completedAt)}</Typography>
                    </Grid>
                  )}
                </Grid>

                {/* Error */}
                {detail.lastError && (
                  <Box sx={{ bgcolor: '#FEE2E2', p: 2, borderRadius: 2, mb: 3 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#C53030', display: 'block', mb: 0.5 }}>ERROR</Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#C53030', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{detail.lastError}</Typography>
                  </Box>
                )}

                {/* Payload */}
                {detail.payload && Object.keys(detail.payload).length > 0 && (
                  <>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#1A365D' }}>PAYLOAD</Typography>
                    <Card variant="outlined" sx={{ p: 2, mb: 3, bgcolor: '#F7FAFC' }}>
                      {Object.entries(detail.payload).map(([key, value]) => (
                        <Box key={key} sx={{ mb: 1, '&:last-child': { mb: 0 } }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#718096' }}>{key}</Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.8rem', wordBreak: 'break-word' }}>
                            {typeof value === 'string' && value.length > 200
                              ? value.substring(0, 200) + '...'
                              : String(value ?? 'null')}
                          </Typography>
                        </Box>
                      ))}
                    </Card>
                  </>
                )}

                {/* Related Instrument */}
                {detail.instrument && (
                  <>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#1A365D' }}>RELATED INSTRUMENT</Typography>
                    <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
                      <Grid container spacing={1.5}>
                        <Grid item xs={12}>
                          <Typography variant="caption" color="text.secondary">Title</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{detail.instrument.sourceTitle}</Typography>
                        </Grid>
                        <Grid item xs={4}>
                          <Typography variant="caption" color="text.secondary">Status</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{detail.instrument.status}</Typography>
                        </Grid>
                        <Grid item xs={4}>
                          <Typography variant="caption" color="text.secondary">Risk</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{detail.instrument.riskRating || '—'}</Typography>
                        </Grid>
                        <Grid item xs={4}>
                          <Typography variant="caption" color="text.secondary">Nature</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{detail.instrument.nature || '—'}</Typography>
                        </Grid>
                        {detail.instrument.dateIssued && (
                          <Grid item xs={4}>
                            <Typography variant="caption" color="text.secondary">Date Issued</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatLocalDate(detail.instrument.dateIssued)}</Typography>
                          </Grid>
                        )}
                        {detail.instrument.aiSummary && (
                          <Grid item xs={12}>
                            <Typography variant="caption" color="text.secondary">AI Summary</Typography>
                            <Typography variant="body2" sx={{ fontSize: '0.8rem', mt: 0.3 }}>{detail.instrument.aiSummary}</Typography>
                          </Grid>
                        )}
                      </Grid>
                    </Card>
                  </>
                )}
              </>
            ) : (
              <Alert severity="warning">Could not load job details</Alert>
            )}
          </Box>
        )}
      </Drawer>
    </Box>
  );
}
