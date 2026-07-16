import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Grid, Button, Chip, CircularProgress, Alert,
  Divider, IconButton, Tooltip,
} from '@mui/material';
import {
  ArrowBack, ErrorOutline, CheckCircle, HourglassEmpty, PlayArrow,
  Warning, OpenInNew,
} from '@mui/icons-material';
import api from '../../../services/api';
import { ROUTES } from '../../../utils/constants';

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

export default function JobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.platform.jobs.get(id)
      .then(setDetail)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }

  if (error) {
    return (
      <Box>
        <Button startIcon={<ArrowBack />} onClick={() => navigate(ROUTES.ADMIN_PIPELINE)} sx={{ mb: 2 }}>Back to Pipeline</Button>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!detail) {
    return (
      <Box>
        <Button startIcon={<ArrowBack />} onClick={() => navigate(ROUTES.ADMIN_PIPELINE)} sx={{ mb: 2 }}>Back to Pipeline</Button>
        <Alert severity="warning">Job not found</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate(ROUTES.ADMIN_PIPELINE)} sx={{ mb: 2 }}>Back to Pipeline</Button>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>Job #{detail.jobId}</Typography>
            <Chip size="small"
              icon={statusConfig[detail.status]?.icon}
              label={statusConfig[detail.status]?.label || detail.status}
              sx={{ bgcolor: statusConfig[detail.status]?.bg || '#EDF2F7', color: statusConfig[detail.status]?.color || '#718096', fontWeight: 600, fontSize: '0.65rem' }}
            />
          </Box>
          <Typography variant="body2" color="text.secondary">
            {jobTypeLabels[detail.jobType]?.label || detail.jobType} &middot;
            Priority: {detail.priority === 1 ? 'HIGH' : 'LOW'}
          </Typography>
        </Box>
        {detail.status === 'failed' && (
          <Button variant="outlined" size="small" color="warning" startIcon={<PlayArrow />}>Retry Job</Button>
        )}
      </Box>

      <Divider sx={{ mb: 2 }} />

      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: '#1A365D' }}>JOB DETAILS</Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary">Type</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{jobTypeLabels[detail.jobType]?.label || detail.jobType}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary">Attempts</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{detail.attemptCount}/{detail.maxAttempts}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary">Created</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'Roboto Mono', fontSize: '0.75rem' }}>{formatDt(detail.createdAt)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary">Service</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{detail.createdByService || '—'}</Typography>
            </CardContent>
          </Card>
        </Grid>
        {detail.startedAt && (
          <Grid item xs={6} md={3}>
            <Card>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="caption" color="text.secondary">Started</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'Roboto Mono', fontSize: '0.75rem' }}>{formatDt(detail.startedAt)}</Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
        {detail.completedAt && (
          <Grid item xs={6} md={3}>
            <Card>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="caption" color="text.secondary">Completed</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'Roboto Mono', fontSize: '0.75rem' }}>{formatDt(detail.completedAt)}</Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {detail.lastError && (
        <Box sx={{ bgcolor: '#FEE2E2', p: 2, borderRadius: 2, mb: 3 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#C53030', display: 'block', mb: 0.5 }}>ERROR</Typography>
          <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#C53030', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{detail.lastError}</Typography>
        </Box>
      )}

      {detail.payload && Object.keys(detail.payload).length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: '#1A365D' }}>PAYLOAD</Typography>
          <Card variant="outlined" sx={{ p: 2, mb: 3, bgcolor: '#F7FAFC' }}>
            {Object.entries(detail.payload).map(([key, value]) => (
              <Box key={key} sx={{ mb: 1.5, '&:last-child': { mb: 0 } }}>
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

      {detail.instrument && (
        <>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: '#1A365D' }}>RELATED INSTRUMENT</Typography>
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
    </Box>
  );
}
