import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Chip, Button, CircularProgress, Alert, Tooltip, Divider,
} from '@mui/material';
import { ArrowBack, InfoOutlined, Rule, Warning } from '@mui/icons-material';
import api from '../../../services/api';
import { ROUTES } from '../../../utils/constants';

const INHERENT_RISK_CONFIG = {
  Critical: { color: 'error' },
  Extreme: { color: 'error' },
  High: { color: 'error' },
  Moderate: { color: 'warning' },
  Medium: { color: 'warning' },
  Low: { color: 'success' },
};

const MONO_CHIP = {
  height: 22,
  borderRadius: '4px',
  fontFamily: 'Roboto Mono, monospace',
  fontSize: '0.7rem',
};

function prettify(v) {
  return v ? String(v).replace(/_/g, ' ') : '';
}

function formatDt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function inherentRiskChip(rating, likelihood, impact) {
  const cfg = INHERENT_RISK_CONFIG[rating];
  if (!cfg) {
    return <Chip size="small" label={rating || 'Unrated'} variant="outlined" sx={{ height: 22, borderRadius: '4px' }} />;
  }
  const tip = likelihood || impact ? `${likelihood || '-'} × ${impact || '-'}` : rating;
  return (
    <Tooltip title={tip}>
      <Chip size="small" label={rating} color={cfg.color} sx={{ height: 22, borderRadius: '4px', fontWeight: 600 }} />
    </Tooltip>
  );
}

function SectionHeader({ title }) {
  return (
    <>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>{title}</Typography>
      <Divider sx={{ mb: 2 }} />
    </>
  );
}

function MetaField({ title, value, mono }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
        {title}
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.25, fontFamily: mono ? 'Roboto Mono, monospace' : undefined, fontSize: mono ? '0.78rem' : undefined }}>
        {value || <span style={{ color: '#CBD5E0' }}>—</span>}
      </Typography>
    </Box>
  );
}

export default function ObligationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [obligation, setObligation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.platform.obligations.get(id)
      .then((data) => { if (active) setObligation(data); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  const backButton = (
    <Button startIcon={<ArrowBack />} onClick={() => navigate(ROUTES.ADMIN_OBLIGATIONS)} sx={{ mb: 2 }}>
      Back to Obligations
    </Button>
  );

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }

  if (error || !obligation) {
    return (
      <Box>
        {backButton}
        <Alert severity="error">{error || 'Obligation not found'}</Alert>
      </Box>
    );
  }

  const o = obligation;

  return (
    <Box>
      {backButton}

      {/* Header */}
      <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flexWrap: 'wrap' }}>
          <Rule sx={{ fontSize: 26, color: '#805AD5', mt: 0.25 }} />
          <Box sx={{ flex: 1, minWidth: 240 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {o.title || 'Untitled obligation'}
            </Typography>
            {o.actName && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{o.actName}</Typography>
            )}
          </Box>
          {inherentRiskChip(o.inherentRiskRating, o.inherentLikelihood, o.inherentImpact)}
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1.5 }}>
          {o.obligationNumber != null && (
            <Chip size="small" variant="outlined" label={`#${o.obligationNumber}`} sx={MONO_CHIP} />
          )}
          {o.specificSectionReference && (
            <Chip size="small" variant="outlined" label={o.specificSectionReference} sx={MONO_CHIP} />
          )}
          {o.areaOfFocus && (
            <Chip size="small" variant="outlined" label={o.areaOfFocus}
              sx={{ height: 22, borderRadius: '4px', fontSize: '0.7rem' }} />
          )}
          {o.obligationType && (
            <Chip size="small" variant="outlined" label={prettify(o.obligationType)}
              sx={{ height: 22, borderRadius: '4px', fontSize: '0.7rem' }} />
          )}
        </Box>
      </Paper>

      {/* Verbatim vs Interpreted — side by side on md+ */}
      {(o.description || o.plainEnglishStatement) && (
        <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
          <SectionHeader title={
            <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <InfoOutlined sx={{ fontSize: 16 }} /> Obligation Texts (harmonized)
            </Box>
          } />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                Verbatim (from document)
              </Typography>
              <Box sx={{ mt: 0.75 }}>
                {o.description
                  ? <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{o.description}</Typography>
                  : <Typography variant="body2" sx={{ color: '#CBD5E0' }}>No verbatim text</Typography>}
              </Box>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                Interpreted (plain English)
              </Typography>
              <Box sx={{ mt: 0.75 }}>
                {o.plainEnglishStatement
                  ? <Typography variant="body2" sx={{ lineHeight: 1.6 }}>{o.plainEnglishStatement}</Typography>
                  : <Typography variant="body2" sx={{ color: '#CBD5E0' }}>No interpreted text</Typography>}
              </Box>
            </Box>
          </Box>
        </Paper>
      )}

      {/* Metadata */}
      <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
        <SectionHeader title="Obligation Metadata" />
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 2 }}>
          <MetaField title="Obligation No." value={o.obligationNumber != null ? `#${o.obligationNumber}` : null} mono />
          <MetaField title="Section" value={o.specificSectionReference} mono />
          <MetaField title="Area of Focus" value={o.areaOfFocus} />
          <MetaField title="Obligation Type" value={prettify(o.obligationType)} />
          <MetaField title="Recurring Deadline" value={prettify(o.recurringDeadlineType)} />
          <MetaField title="Deadline (days)" value={o.complianceDeadlineDays != null ? String(o.complianceDeadlineDays) : null} />
          <MetaField title="Control Owner" value={o.controlOwner} />
          <MetaField title="Created" value={formatDt(o.createdAt)} />
        </Box>
      </Paper>

      {/* Inherent risk */}
      <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
        <SectionHeader title={
          <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Warning sx={{ fontSize: 16 }} /> Inherent Risk
          </Box>
        } />
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 2, mb: 2 }}>
          <MetaField title="Likelihood" value={o.inherentLikelihood} />
          <MetaField title="Impact" value={o.inherentImpact} />
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
              Rating
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              {inherentRiskChip(o.inherentRiskRating, o.inherentLikelihood, o.inherentImpact)}
            </Box>
          </Box>
        </Box>
        {o.riskDescription
          ? <Typography variant="body2" sx={{ lineHeight: 1.6, color: 'text.secondary' }}>{o.riskDescription}</Typography>
          : <Typography variant="body2" sx={{ color: '#CBD5E0' }}>No risk description</Typography>}
      </Paper>

      {/* Source */}
      <Paper variant="outlined" sx={{ p: 3 }}>
        <SectionHeader title="Source" />
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2 }}>
          <MetaField title="Act" value={o.actName} />
          <MetaField title="Act Abbreviation" value={o.actAbbreviation} mono />
          <MetaField title="Act ID" value={o.regulationId != null ? String(o.regulationId) : null} mono />
          <MetaField title="Instrument ID" value={o.instrumentId != null ? String(o.instrumentId) : null} mono />
        </Box>
      </Paper>
    </Box>
  );
}
