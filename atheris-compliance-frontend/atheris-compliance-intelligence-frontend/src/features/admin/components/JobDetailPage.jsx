import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, CircularProgress, Alert } from '@mui/material';
import {
  DetailHeader, KpiCards, DataCard, StatusBadge, RiskBadge, StateBadge, TL,
  ArrowPathIcon, CpuChipIcon, CalendarIcon, Cog6ToothIcon, ClockIcon, CheckCircleIcon,
  ExclamationCircleIcon, EyeIcon, CloudArrowUpIcon, XMarkIcon, LinkIcon,
} from 'shared';
import api from '../../../services/api';
import { ROUTES } from '../../../utils/constants';
import { Field, FieldGrid } from './detail/detailKit';

const jobTypeLabels = {
  ocr_document: { label: 'Extract Text', color: '#3182CE' },
  classify_instrument: { label: 'Analyze & Tag', color: '#805AD5' },
};

const statusConfig = {
  pending: { label: 'Pending', tone: 'gray' },
  processing: { label: 'Processing', tone: 'blue' },
  completed: { label: 'Completed', tone: 'green' },
  failed: { label: 'Failed', tone: 'red' },
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

  const isPending = typeof id === 'string' && id.startsWith('pending-');
  const pendingId = isPending ? id.slice('pending-'.length) : null;

  useEffect(() => {
    setLoading(true);
    setError(null);
    const call = isPending ? api.platform.pendingDownloads.get(pendingId) : api.platform.jobs.get(id);
    call
      .then(setDetail)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, isPending, pendingId]);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }

  if (error) {
    return (
      <Box>
        <DetailHeader band title="Job" onBack={() => navigate(ROUTES.ADMIN_PIPELINE)} backLabel="Back to Pipeline" />
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!detail) {
    return (
      <Box>
        <DetailHeader band title="Job" onBack={() => navigate(ROUTES.ADMIN_PIPELINE)} backLabel="Back to Pipeline" />
        <Alert severity="warning">Not found</Alert>
      </Box>
    );
  }

  if (isPending) {
    return <PendingDetail pd={detail} navigate={navigate} />;
  }

  const typeLabel = jobTypeLabels[detail.jobType]?.label || detail.jobType;
  const monoValue = (v) => <Box component="span" sx={{ fontFamily: TL.mono, fontSize: '0.875rem' }}>{v}</Box>;
  const tiles = [
    { key: 'type', label: 'Type', value: typeLabel, tone: 'blue', icon: <CpuChipIcon /> },
    { key: 'attempts', label: 'Attempts', value: `${detail.attemptCount}/${detail.maxAttempts}`, tone: 'orange', icon: <ArrowPathIcon /> },
    { key: 'created', label: 'Created', value: monoValue(formatDt(detail.createdAt)), tone: 'gray', icon: <CalendarIcon /> },
    { key: 'service', label: 'Service', value: detail.createdByService || '—', tone: 'teal', icon: <Cog6ToothIcon /> },
    ...(detail.startedAt ? [{ key: 'started', label: 'Started', value: monoValue(formatDt(detail.startedAt)), tone: 'blue', icon: <ClockIcon /> }] : []),
    ...(detail.completedAt ? [{ key: 'completed', label: 'Completed', value: monoValue(formatDt(detail.completedAt)), tone: 'green', icon: <CheckCircleIcon /> }] : []),
  ];

  return (
    <Box>
      <DetailHeader
        band
        onBack={() => navigate(ROUTES.ADMIN_PIPELINE)}
        backLabel="Back to Pipeline"
        title={detail.instrument?.sourceTitle || detail.payload?.instrument_title || detail.payload?.title || `Job #${detail.jobId}`}
        status={statusConfig[detail.status]?.label || detail.status}
        statusTone={statusConfig[detail.status]?.tone || 'gray'}
        description={`Job #${detail.jobId} · ${typeLabel} · Priority: ${detail.priority === 1 ? 'HIGH' : 'LOW'}`}
      />

      <KpiCards items={tiles} columns={4} />

      {detail.lastError && (
        <Alert severity="error" icon={<ExclamationCircleIcon size={20} />} sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>Error</Typography>
          <Typography sx={{ fontSize: '0.8125rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{detail.lastError}</Typography>
        </Alert>
      )}

      {detail.payload && Object.keys(detail.payload).length > 0 && (
        <DataCard title="Payload" sx={{ mb: 3 }}>
          {Object.entries(detail.payload).map(([key, value]) => (
            <Box key={key} sx={{ mb: 2, '&:last-child': { mb: 0 } }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: TL.gray500, fontFamily: TL.mono }}>{key}</Typography>
              <Typography sx={{ fontSize: '0.875rem', color: TL.gray700, wordBreak: 'break-word' }}>
                {typeof value === 'string' && value.length > 200
                  ? value.substring(0, 200) + '...'
                  : String(value ?? 'null')}
              </Typography>
            </Box>
          ))}
        </DataCard>
      )}

      {detail.instrument && (
        <DataCard
          title="Related Instrument"
          sx={{ mb: 3 }}
          actions={(
            <Button size="small" variant="outlined" startIcon={<EyeIcon size={16} />}
              onClick={() => navigate(`${ROUTES.ADMIN_INSTRUMENTS}/${detail.instrument.instrumentId}`)}>
              View instrument
            </Button>
          )}
        >
          <Box sx={{ mb: 2.5 }}>
            <Field label="Title" value={detail.instrument.sourceTitle} />
          </Box>
          <FieldGrid min={160}>
            <Field label="Status">{detail.instrument.status ? <StateBadge value={detail.instrument.status} /> : <Typography sx={{ fontSize: '0.875rem', color: TL.gray700 }}>—</Typography>}</Field>
            <Field label="Risk">{detail.instrument.riskRating ? <RiskBadge value={detail.instrument.riskRating} /> : <Typography sx={{ fontSize: '0.875rem', color: TL.gray700 }}>—</Typography>}</Field>
            <Field label="Nature" value={detail.instrument.nature || '—'} />
            {detail.instrument.dateIssued && <Field label="Date Issued" value={formatLocalDate(detail.instrument.dateIssued)} />}
          </FieldGrid>
          {detail.instrument.aiSummary && (
            <Box sx={{ mt: 2.5 }}>
              <Field label="AI Summary" value={detail.instrument.aiSummary} />
            </Box>
          )}
        </DataCard>
      )}
    </Box>
  );
}

/* Detail view for a download that failed (pending_downloads row). */
function PendingDetail({ pd, navigate }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function handleUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,application/pdf';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      setBusy(true);
      try {
        await api.platform.pendingDownloads.upload(pd.id, file);
        setMessage('PDF uploaded and OCR queued.');
      } catch (err) {
        setMessage('Upload failed: ' + err.message);
      } finally {
        setBusy(false);
      }
    };
    input.click();
  }

  async function handleSkip() {
    setBusy(true);
    try {
      await api.platform.pendingDownloads.skip(pd.id);
      setMessage('Marked as skipped.');
    } catch (err) {
      setMessage('Skip failed: ' + err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box>
      <DetailHeader
        band
        onBack={() => navigate(ROUTES.ADMIN_PIPELINE)}
        backLabel="Back to Pipeline"
        title={pd.title || 'Untitled document'}
        status="Download Failed"
        statusTone="red"
        meta={pd.status ? <StatusBadge label={pd.status} tone="gray" /> : null}
        description={`Regulator #${pd.regulatorId}`}
        right={(
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="contained" startIcon={<CloudArrowUpIcon size={16} />} onClick={handleUpload} disabled={busy}>Upload PDF</Button>
            <Button variant="outlined" startIcon={<XMarkIcon size={16} />} onClick={handleSkip} disabled={busy}>Skip</Button>
          </Box>
        )}
      />

      {message && <Alert severity={message.startsWith('Upload failed') || message.startsWith('Skip failed') ? 'error' : 'success'} sx={{ mb: 3 }}>{message}</Alert>}

      <DataCard title="Download Details" sx={{ mb: 3 }}>
        <FieldGrid min={220}>
          <Field label="Source URL">
            {pd.sourceUrl ? (
              <Box component="a" href={pd.sourceUrl} target="_blank" rel="noopener noreferrer"
                sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: TL.primary, fontSize: '0.875rem', wordBreak: 'break-all', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                {pd.sourceUrl} <LinkIcon size={12} />
              </Box>
            ) : <Typography sx={{ fontSize: '0.875rem', color: TL.gray700 }}>—</Typography>}
          </Field>
          <Field label="Discovered" value={formatDt(pd.discoveredAt || pd.createdAt)} mono />
        </FieldGrid>
      </DataCard>

      {pd.errorMessage && (
        <Alert severity="error" icon={<ExclamationCircleIcon size={20} />} sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>Error</Typography>
          <Typography sx={{ fontSize: '0.8125rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{pd.errorMessage}</Typography>
        </Alert>
      )}
    </Box>
  );
}
