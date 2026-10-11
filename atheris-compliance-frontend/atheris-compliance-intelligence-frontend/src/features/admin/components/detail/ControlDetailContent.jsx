import { Box, Typography, Card, CardContent, Grid, Chip, Divider } from '@mui/material';
import { FactCheck, Link as LinkIcon } from '@mui/icons-material';

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

/**
 * Presentational body of a control. Shared by `ControlDetailPage` (full page) and the
 * entity drawer opened from the Act-detail Controls tab. `onActClick` turns the act line
 * into a link when a handler is supplied.
 */
export default function ControlDetailContent({ control, onActClick }) {
  if (!control) return null;
  const ctl = control;

  return (
    <Box>
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
            <Typography variant="body2" sx={{ color: '#3182CE', fontWeight: 600, mb: 1.5, cursor: onActClick && ctl.actId ? 'pointer' : 'default' }}
              onClick={() => onActClick && ctl.actId && onActClick(ctl.actId)}>
              <LinkIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
              {ctl.actName}
            </Typography>
          )}

          <Divider sx={{ mb: 2 }} />

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><Meta label="Theme" value={ctl.theme} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><Meta label="Compliance Area" value={ctl.complianceArea} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><Meta label="Frequency" value={ctl.frequency} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><Meta label="Due Date" value={ctl.dueDate} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><Meta label="Responsible Officer" value={ctl.responsibleOfficer} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><Meta label="Act ID" value={ctl.actId} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><Meta label="Control ID" value={ctl.complianceControlId} /></Grid>
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