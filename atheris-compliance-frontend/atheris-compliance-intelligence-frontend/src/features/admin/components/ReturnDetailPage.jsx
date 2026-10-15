import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Button, Chip, CircularProgress, Alert, Divider,
} from '@mui/material';
import {
  ArrowBack, RequestQuote, EventRepeat, Groups, Gavel, Notes, Link as LinkIcon,
} from '@mui/icons-material';
import api from '../../../services/api';

const FREQUENCY_COLOR = {
  Daily: '#C53030',
  Weekly: '#DD6B20',
  Monthly: '#2B6CB0',
  Quarterly: '#2C7A7B',
  Biannual: '#6B46C1',
  Annual: '#2D7D46',
  Adhoc: '#718096',
  'Ad-hoc': '#718096',
  Event: '#805AD5',
};

function formatDt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Field({ label, value, mono }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="caption" color="text.secondary"
        sx={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.62rem', fontWeight: 700 }}>
        {label}
      </Typography>
      <Typography variant="body2"
        sx={{ fontSize: '0.82rem', mt: 0.25, fontFamily: mono ? 'Roboto Mono, monospace' : undefined }}>
        {value || '—'}
      </Typography>
    </Box>
  );
}

function TextBlock({ icon, color, title, body }) {
  return (
    <Card sx={{ mb: 3, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '1px solid #EDF2F7' }}>
        <Box sx={{ color }}>{icon}</Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{title}</Typography>
      </Box>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        {body
          ? <Typography variant="body2" sx={{ fontSize: '0.82rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{body}</Typography>
          : <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>Not recorded</Typography>}
      </CardContent>
    </Card>
  );
}

export default function ReturnDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ret, setRet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api.platform.returns.get(id)
      .then((data) => { if (active) setRet(data); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }

  if (error || !ret) {
    return (
      <Box>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/admin/returns')} sx={{ mb: 2 }}>Back to Returns</Button>
        <Alert severity="error">{error || 'Return not found'}</Alert>
      </Box>
    );
  }

  const freqColor = FREQUENCY_COLOR[ret.frequencyType] || '#718096';

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/admin/returns')} sx={{ mb: 2 }}>Back to Returns</Button>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 2, mb: 3 }}>
        <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
              <RequestQuote sx={{ fontSize: 22, color: '#DD6B20' }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>{ret.title}</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1.5 }}>
              {ret.sectionReference && (
                <Chip size="small" variant="outlined" label={ret.sectionReference}
                  sx={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem', height: 22, borderRadius: '4px' }} />
              )}
              {ret.frequencyType && (
                <Chip size="small" label={ret.frequencyType}
                  sx={{ height: 22, fontWeight: 700, fontSize: '0.65rem', bgcolor: `${freqColor}14`, color: freqColor }} />
              )}
              {ret.frequency && (
                <Chip size="small" variant="outlined" label={ret.frequency} sx={{ height: 22, fontSize: '0.65rem' }} />
              )}
            </Box>
            {ret.actName && (
              <Typography variant="body2" sx={{ color: '#3182CE', fontWeight: 600 }}>
                <LinkIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                {ret.actName}{ret.actAbbreviation ? ` (${ret.actAbbreviation})` : ''}
              </Typography>
            )}
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <Groups sx={{ fontSize: 18, color: '#2C7A7B' }} />
              <Typography variant="caption" color="text.secondary"
                sx={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.65rem', fontWeight: 700 }}>
                Ownership
              </Typography>
            </Box>
            <Field label="Responsible Unit" value={ret.responsibleUnit || 'Unassigned'} />
            <Field label="Responsible Person" value={ret.responsiblePerson} />
            <Divider sx={{ my: 1.5 }} />
            <Field label="Last Filing Date" value={formatDt(ret.filingDate)} />
          </CardContent>
        </Card>
      </Box>

      <TextBlock icon={<EventRepeat sx={{ fontSize: 20 }} />} color="#2B6CB0" title="Deadline" body={ret.deadline} />
      <TextBlock icon={<Gavel sx={{ fontSize: 20 }} />} color="#C53030" title="Statutory Basis" body={ret.statutoryBasis} />
      <TextBlock icon={<Notes sx={{ fontSize: 20 }} />} color="#6B46C1" title="Remarks" body={ret.remarks} />

      <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <Box sx={{ p: 2, borderBottom: '1px solid #EDF2F7' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Record</Typography>
        </Box>
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 },
          display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
          <Field label="Return ID" value={ret.returnId} mono />
          <Field label="Act ID" value={ret.actId} mono />
          <Field label="Instrument ID" value={ret.instrumentId} mono />
          <Field label="Created" value={formatDt(ret.createdAt)} />
        </CardContent>
      </Card>
    </Box>
  );
}
