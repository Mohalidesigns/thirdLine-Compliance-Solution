import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Chip, CircularProgress, Alert } from '@mui/material';
import { DetailHeader, StatusBadge, TL, ScaleIcon, LinkIcon, BanknotesIcon, ClockIcon } from 'shared';
import api from '../../../services/api';
import { ROUTES } from '../../../utils/constants';
import { Section, Field as KitField, FieldGrid, MonoChip } from './detail/detailKit';

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
  return <KitField label={label}>{children}</KitField>;
}

const VALUE_SX = { fontSize: '0.875rem', color: TL.gray700 };

function TextBlock({ label, text, empty }) {
  return (
    <Box sx={{ mb: 2.5, '&:last-child': { mb: 0 } }}>
      <Typography component="span" sx={{ display: 'block', fontSize: '0.625rem', fontWeight: 600, color: TL.gray400, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>
        {label}
      </Typography>
      {text
        ? <Typography sx={{ ...VALUE_SX, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{text}</Typography>
        : <Typography sx={{ fontSize: '0.875rem', color: TL.gray400, fontStyle: 'italic' }}>{empty}</Typography>}
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
        <DetailHeader band title="Sanction" onBack={() => navigate(ROUTES.ADMIN_SANCTIONS)} backLabel="Back to Sanctions" />
        <Alert severity="error">{error || 'Sanction not found'}</Alert>
      </Box>
    );
  }

  const roles = Array.isArray(sanction.liableRoles) ? sanction.liableRoles : [];

  return (
    <Box>
      <DetailHeader
        band
        onBack={() => navigate(ROUTES.ADMIN_SANCTIONS)}
        backLabel="Back to Sanctions"
        title={sanction.sanctionType || 'Sanction'}
        meta={(
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {sanction.severityScore != null && (
              <StatusBadge label={`Sev ${sanction.severityScore}`} dot
                tone={sanction.severityScore > 7 ? 'red' : sanction.severityScore > 4 ? 'orange' : 'gray'} />
            )}
            {sanction.hasBeenEnforced
              ? <StatusBadge label="Enforced" tone="green" />
              : <StatusBadge label="Not enforced" tone="gray" />}
            {sanction.actName && (
              <Typography sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: 'primary.main', fontWeight: 500, fontSize: '0.875rem' }}>
                <LinkIcon size={14} />
                {sanction.actName}
                {sanction.actAbbreviation ? ` (${sanction.actAbbreviation})` : ''}
              </Typography>
            )}
            <MonoChip label={sanction.sourceSectionReference} />
          </Box>
        )}
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 3, alignItems: 'start' }}>
        <Section icon={<ScaleIcon />} title="Violation & Penalty" sx={{ mb: 0 }}>
          <TextBlock label="Violation" text={sanction.description} empty="No violation description recorded." />
          <TextBlock label="Penalty" text={sanction.penaltyDetails} empty="No penalty breakdown recorded." />
          <TextBlock label="Impact" text={sanction.riskExplanation} empty="No impact explanation recorded." />
        </Section>

        <Box>
          <Section icon={<BanknotesIcon />} title="Exposure">
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: '2rem', color: TL.error, mb: 2 }}>
              {formatNaira(sanction.sanctionAmountNaira)}{sanction.sanctionAmountPerDay ? ' /day' : ''}
            </Typography>
            <Box sx={{ display: 'grid', gap: 2 }}>
              <Field label="Personal liability">
                <Typography sx={{ ...VALUE_SX, fontWeight: 600 }}>{formatNaira(sanction.personalLiabilityNaira)}</Typography>
              </Field>
              <Field label="Liable roles">
                {roles.length > 0 ? (
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {roles.map(r => <Chip key={r} size="small" label={r} />)}
                  </Box>
                ) : <Typography sx={{ ...VALUE_SX, color: TL.gray400 }}>-</Typography>}
              </Field>
            </Box>
          </Section>

          <Section icon={<ClockIcon />} title="Enforcement history" sx={{ mb: 0 }}>
            <Box sx={{ display: 'grid', gap: 2 }}>
              <Field label="Most recent enforcement">
                <Typography sx={VALUE_SX}>{formatDate(sanction.recentEnforcementDate)}</Typography>
              </Field>
              <Field label="Amount enforced">
                <Typography sx={{ ...VALUE_SX, fontWeight: 600 }}>{formatNaira(sanction.recentEnforcementAmount)}</Typography>
              </Field>
            </Box>
          </Section>
        </Box>
      </Box>

      <Section title="Metadata" sx={{ mt: 3 }}>
        <FieldGrid min={160}>
          <Field label="Sanction ID"><Typography sx={{ ...VALUE_SX, fontFamily: TL.mono, fontSize: '0.75rem', color: TL.gray500 }}>{sanction.sanctionId}</Typography></Field>
          <Field label="Act ID"><Typography sx={{ ...VALUE_SX, fontFamily: TL.mono, fontSize: '0.75rem', color: TL.gray500 }}>{sanction.regulationId ?? '-'}</Typography></Field>
          <Field label="Instrument ID"><Typography sx={{ ...VALUE_SX, fontFamily: TL.mono, fontSize: '0.75rem', color: TL.gray500 }}>{sanction.instrumentId ?? '-'}</Typography></Field>
          <Field label="Instrument"><Typography sx={VALUE_SX}>{sanction.instrumentTitle || '-'}</Typography></Field>
          <Field label="Created"><Typography sx={VALUE_SX}>{formatDate(sanction.createdAt)}</Typography></Field>
          <Field label="Updated"><Typography sx={VALUE_SX}>{formatDate(sanction.updatedAt)}</Typography></Field>
        </FieldGrid>
      </Section>
    </Box>
  );
}
