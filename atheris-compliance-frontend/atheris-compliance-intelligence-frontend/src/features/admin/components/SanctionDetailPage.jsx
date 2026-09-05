import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Grid, Button, Chip, CircularProgress, Alert, Paper, Divider,
} from '@mui/material';
import { ArrowBack, Gavel, CheckCircle, Link as LinkIcon } from '@mui/icons-material';
import api from '../../../services/api';
import { ROUTES } from '../../../utils/constants';

const MONO_CHIP_SX = {
  height: 22, borderRadius: '4px',
  fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem',
};

function formatNaira(amount) {
  if (amount == null) return '-';
  const n = Number(amount);
  if (Number.isNaN(n)) return String(amount);
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

function formatDate(d) {
  if (!d) return '-';
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return String(d);
  return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Field({ label, children }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.62rem' }}>
        {label}
      </Typography>
      <Box sx={{ mt: 0.25 }}>{children}</Box>
    </Box>
  );
}

function TextBlock({ label, text, empty }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{label}</Typography>
      {text
        ? <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{text}</Typography>
        : <Typography variant="body2" color="text.secondary">{empty}</Typography>}
    </Box>
  );
}

export default function SanctionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sanction, setSanction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api.platform.sanctions.get(id)
      .then(data => { if (active) setSanction(data); })
      .catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }

  if (error || !sanction) {
    return (
      <Box>
        <Button startIcon={<ArrowBack />} onClick={() => navigate(ROUTES.ADMIN_SANCTIONS)} sx={{ mb: 2 }}>
          Back to Sanctions
        </Button>
        <Alert severity="error">{error || 'Sanction not found'}</Alert>
      </Box>
    );
  }

  const roles = Array.isArray(sanction.liableRoles) ? sanction.liableRoles : [];

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate(ROUTES.ADMIN_SANCTIONS)} sx={{ mb: 2 }}>
        Back to Sanctions
      </Button>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={8}>
          <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', height: '100%' }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                <Gavel sx={{ color: '#C53030' }} />
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {sanction.sanctionType || 'Sanction'}
                </Typography>
                {sanction.severityScore != null && (
                  <Chip size="small" label={`Sev ${sanction.severityScore}`}
                    color={sanction.severityScore > 7 ? 'error' : sanction.severityScore > 4 ? 'warning' : 'default'}
                    sx={{ height: 22, borderRadius: '4px' }} />
                )}
                {sanction.hasBeenEnforced
                  ? <Chip icon={<CheckCircle sx={{ fontSize: 14 }} />} label="Enforced" size="small" color="success"
                      sx={{ height: 22, borderRadius: '4px' }} />
                  : <Chip label="Not enforced" size="small" variant="outlined"
                      sx={{ height: 22, borderRadius: '4px', fontSize: '0.7rem', color: 'text.secondary' }} />}
              </Box>

              {sanction.actName && (
                <Typography variant="body2" sx={{ color: '#3182CE', fontWeight: 600, mb: 0.5 }}>
                  <LinkIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                  {sanction.actName}
                  {sanction.actAbbreviation ? ` (${sanction.actAbbreviation})` : ''}
                </Typography>
              )}
              {sanction.sourceSectionReference && (
                <Chip size="small" variant="outlined" label={sanction.sourceSectionReference} sx={{ ...MONO_CHIP_SX, mb: 1 }} />
              )}

              <Divider sx={{ my: 1.5 }} />

              <TextBlock label="Violation" text={sanction.description} empty="No violation description recorded." />
              <TextBlock label="Penalty" text={sanction.penaltyDetails} empty="No penalty breakdown recorded." />
              <TextBlock label="Impact" text={sanction.riskExplanation} empty="No impact explanation recorded." />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', mb: 2 }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.65rem', fontWeight: 700 }}>
                Exposure
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#C53030', mt: 0.5, mb: 1.5 }}>
                {formatNaira(sanction.sanctionAmountNaira)}{sanction.sanctionAmountPerDay ? ' /day' : ''}
              </Typography>
              <Field label="Personal liability">
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatNaira(sanction.personalLiabilityNaira)}</Typography>
              </Field>
              <Field label="Liable roles">
                {roles.length > 0 ? (
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {roles.map(r => <Chip key={r} size="small" label={r} sx={{ height: 20, borderRadius: '4px', fontSize: '0.7rem' }} />)}
                  </Box>
                ) : <Typography variant="body2" color="text.secondary">-</Typography>}
              </Field>
            </CardContent>
          </Card>

          <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.65rem', fontWeight: 700 }}>
                Enforcement history
              </Typography>
              <Box sx={{ mt: 1 }}>
                <Field label="Most recent enforcement">
                  <Typography variant="body2">{formatDate(sanction.recentEnforcementDate)}</Typography>
                </Field>
                <Field label="Amount enforced">
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatNaira(sanction.recentEnforcementAmount)}</Typography>
                </Field>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.65rem', fontWeight: 700 }}>
          Metadata
        </Typography>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={6} md={3}>
            <Field label="Sanction ID"><Typography variant="body2">{sanction.sanctionId}</Typography></Field>
          </Grid>
          <Grid item xs={6} md={3}>
            <Field label="Act ID"><Typography variant="body2">{sanction.regulationId ?? '-'}</Typography></Field>
          </Grid>
          <Grid item xs={6} md={3}>
            <Field label="Instrument ID"><Typography variant="body2">{sanction.instrumentId ?? '-'}</Typography></Field>
          </Grid>
          <Grid item xs={6} md={3}>
            <Field label="Instrument">
              <Typography variant="body2">{sanction.instrumentTitle || '-'}</Typography>
            </Field>
          </Grid>
          <Grid item xs={6} md={3}>
            <Field label="Created"><Typography variant="body2">{formatDate(sanction.createdAt)}</Typography></Field>
          </Grid>
          <Grid item xs={6} md={3}>
            <Field label="Updated"><Typography variant="body2">{formatDate(sanction.updatedAt)}</Typography></Field>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}
