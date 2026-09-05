import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Grid, Button, Chip, CircularProgress, Alert, Divider,
} from '@mui/material';
import { ArrowBack, FactCheck, Link as LinkIcon } from '@mui/icons-material';
import api from '../../../services/api';

const RISK_COLOR = {
  Critical: 'error', High: 'error', Moderate: 'warning', Medium: 'warning', Low: 'success',
};

const STATUS_COLOR = { Open: 'warning', Closed: 'success', 'In Progress': 'info' };

function Meta({ label, value }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.65rem' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>{value || '—'}</Typography>
    </Box>
  );
}

function LongText({ title, text }) {
  return (
    <Card sx={{ mb: 2, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      <Box sx={{ p: 2, borderBottom: '1px solid #EDF2F7' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{title}</Typography>
      </Box>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        {text
          ? <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{text}</Typography>
          : <Typography variant="body2" color="text.secondary">Not recorded.</Typography>}
      </CardContent>
    </Card>
  );
}

export default function ControlDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ctl, setCtl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    api.platform.controls.get(id)
      .then(data => { if (alive) setCtl(data); })
      .catch(err => { if (alive) setError(err.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }

  if (error || !ctl) {
    return (
      <Box>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/admin/controls')} sx={{ mb: 2 }}>Back to Controls</Button>
        <Alert severity="error">{error || 'Control not found'}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/admin/controls')} sx={{ mb: 2 }}>Back to Controls</Button>

      <Card sx={{ mb: 3, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
            <FactCheck sx={{ color: '#2B6CB0' }} />
            <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: 'Roboto Mono, monospace' }}>
              {ctl.controlNumber}
            </Typography>
            {ctl.riskLevel && (
              <Chip size="small" label={ctl.riskLevel} color={RISK_COLOR[ctl.riskLevel] || 'default'} />
            )}
            <Chip size="small" label={ctl.status || 'Open'} color={STATUS_COLOR[ctl.status] || 'default'} />
          </Box>

          {ctl.actName && (
            <Typography variant="body2" sx={{ color: '#3182CE', fontWeight: 600, mb: 1.5, cursor: ctl.actId ? 'pointer' : 'default' }}
              onClick={() => ctl.actId && navigate(`/admin/acts/${ctl.actId}`)}>
              <LinkIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
              {ctl.actName}
            </Typography>
          )}

          <Divider sx={{ mb: 2 }} />

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}><Meta label="Theme" value={ctl.theme} /></Grid>
            <Grid item xs={12} sm={6} md={3}><Meta label="Compliance Area" value={ctl.complianceArea} /></Grid>
            <Grid item xs={12} sm={6} md={3}><Meta label="Frequency" value={ctl.frequency} /></Grid>
            <Grid item xs={12} sm={6} md={3}><Meta label="Due Date" value={ctl.dueDate} /></Grid>
            <Grid item xs={12} sm={6} md={3}><Meta label="Responsible Officer" value={ctl.responsibleOfficer} /></Grid>
            <Grid item xs={12} sm={6} md={3}><Meta label="Act ID" value={ctl.actId} /></Grid>
            <Grid item xs={12} sm={6} md={3}><Meta label="Control ID" value={ctl.complianceControlId} /></Grid>
          </Grid>
        </CardContent>
      </Card>

      <LongText title="Compliance Control" text={ctl.complianceControl} />
      <LongText title="Regulatory Requirement" text={ctl.regulatoryRequirement} />
      <LongText title="Monitoring Activity" text={ctl.monitoringActivity} />
      <LongText title="Control Effectiveness Measure" text={ctl.controlEffectivenessMeasure} />
    </Box>
  );
}
