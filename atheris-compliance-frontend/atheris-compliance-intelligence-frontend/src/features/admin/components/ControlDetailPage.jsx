import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { DetailHeader, RiskBadge, StateBadge, TL, LinkIcon, ClipboardDocumentCheckIcon } from 'shared';
import api from '../../../services/api';
import { Section, Field, FieldGrid } from './detail/detailKit';

function Meta({ label, value }) {
  return <Field label={label} value={value} />;
}

function LongText({ title, text }) {
  return (
    <Section title={title}>
      {text
        ? <Typography sx={{ fontSize: '0.875rem', color: TL.gray700, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{text}</Typography>
        : <Typography sx={{ fontSize: '0.875rem', color: TL.gray400, fontStyle: 'italic' }}>Not recorded.</Typography>}
    </Section>
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
        <DetailHeader band title="Control" onBack={() => navigate('/admin/controls')} backLabel="Back to Controls" />
        <Alert severity="error">{error || 'Control not found'}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <DetailHeader
        band
        onBack={() => navigate('/admin/controls')}
        backLabel="Back to Controls"
        title={(
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.25 }}>
            <ClipboardDocumentCheckIcon size={22} sx={{ color: TL.primary }} />
            <Box component="span" sx={{ fontFamily: TL.mono }}>{ctl.controlNumber}</Box>
          </Box>
        )}
        meta={(
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {ctl.riskLevel && <RiskBadge value={ctl.riskLevel} />}
            <StateBadge value={ctl.status || 'Open'} />
            {ctl.actName && (
              <Typography
                onClick={() => ctl.actId && navigate(`/admin/acts/${ctl.actId}`)}
                sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 0.5, color: 'primary.main', fontWeight: 500,
                  fontSize: '0.875rem', cursor: ctl.actId ? 'pointer' : 'default',
                  '&:hover': ctl.actId ? { textDecoration: 'underline' } : undefined,
                }}>
                <LinkIcon size={14} />
                {ctl.actName}
              </Typography>
            )}
          </Box>
        )}
      />

      <Section title="Details">
        <FieldGrid min={180}>
          <Meta label="Theme" value={ctl.theme} />
          <Meta label="Compliance Area" value={ctl.complianceArea} />
          <Meta label="Frequency" value={ctl.frequency} />
          <Meta label="Due Date" value={ctl.dueDate} />
          <Meta label="Responsible Officer" value={ctl.responsibleOfficer} />
          <Meta label="Act ID" value={ctl.actId} />
          <Meta label="Control ID" value={ctl.complianceControlId} />
        </FieldGrid>
      </Section>

      <LongText title="Compliance Control" text={ctl.complianceControl} />
      <LongText title="Regulatory Requirement" text={ctl.regulatoryRequirement} />
      <LongText title="Monitoring Activity" text={ctl.monitoringActivity} />
      <LongText title="Control Effectiveness Measure" text={ctl.controlEffectivenessMeasure} />
    </Box>
  );
}
