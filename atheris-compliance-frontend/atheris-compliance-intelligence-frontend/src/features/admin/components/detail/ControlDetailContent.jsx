import { Box, Card, CardContent, Chip, Typography } from '@mui/material';
import {
  FactCheck, Link as LinkIcon, Shield, EventRepeat, Person, Category,
  Gavel, Visibility, CheckCircle, Schedule, AccountTree, Notes, Rule,
} from '@mui/icons-material';
import {
  Section, Field, FieldGrid, StatTile, RiskChip, MonoChip,
  LongTextBlock, LinkedObligationChips, CARD_SX,
} from './detailKit';

const STATUS_COLOR = { Open: '#DD6B20', 'In Progress': '#2B6CB0', Closed: '#2D7D46' };

function statusChip(status) {
  const s = status || 'Open';
  const color = STATUS_COLOR[s] || '#718096';
  return (
    <Chip size="small" label={s}
      sx={{ height: 22, borderRadius: '4px', fontWeight: 700, fontSize: '0.7rem', bgcolor: `${color}18`, color }} />
  );
}

function ActLink({ ctl, onActClick }) {
  if (!ctl.actName) return <Typography variant="body2" color="text.secondary">—</Typography>;
  const clickable = onActClick && ctl.actId;
  return (
    <Typography variant="body2"
      onClick={() => clickable && onActClick(ctl.actId)}
      sx={{ color: clickable ? '#3182CE' : 'text.primary', fontWeight: 600, fontSize: '0.85rem', cursor: clickable ? 'pointer' : 'default' }}>
      <LinkIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />{ctl.actName}
    </Typography>
  );
}

/**
 * Presentational body of a control. Shared by `ControlDetailPage` (full page) and the
 * entity drawer opened from the Act-detail / Obligation-detail Controls tabs.
 */
export default function ControlDetailContent({ control, onActClick }) {
  if (!control) return null;
  const ctl = control;

  const linkedIds = [
    ...(ctl.obligationId != null ? [ctl.obligationId] : []),
    ...String(ctl.linkedObligationIds || '')
      .split(',').map((s) => s.trim()).filter(Boolean).map(Number).filter((n) => !Number.isNaN(n)),
  ];

  return (
    <Box>
      <Card sx={{ ...CARD_SX, mb: 2.5 }}>
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1.25 }}>
            <FactCheck sx={{ color: '#2B6CB0' }} />
            <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: 'Roboto Mono, monospace' }}>
              {ctl.controlNumber}
            </Typography>
            <RiskChip rating={ctl.riskLevel} />
            {statusChip(ctl.status)}
            {ctl.controlType && <MonoChip label={ctl.controlType} />}
          </Box>
          <ActLink ctl={ctl} onActClick={onActClick} />
        </CardContent>
      </Card>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, mb: 2.5 }}>
        <StatTile icon={<Shield fontSize="small" />} label="Inherent Risk" accent="#C53030"
          chip={<RiskChip rating={ctl.riskLevel} />} />
        <StatTile icon={<Shield fontSize="small" />} label="Residual Risk" accent="#2D7D46"
          chip={<RiskChip rating={ctl.residualRiskRating} />} />
        <StatTile icon={<EventRepeat fontSize="small" />} label="Frequency" accent="#2C7A7B" value={ctl.frequency} />
        <StatTile icon={<Person fontSize="small" />} label="Owner" accent="#6B46C1" value={ctl.ownerName || ctl.responsibleOfficer} />
      </Box>

      <Section icon={<Category fontSize="small" />} title="Classification">
        <FieldGrid>
          <Field label="Theme" value={ctl.theme} />
          <Field label="Compliance Area" value={ctl.complianceArea} />
          <Field label="Control Type" value={ctl.controlType} />
          <Field label="Owner" value={ctl.ownerName} />
          <Field label="Responsible Officer" value={ctl.responsibleOfficer} />
          <Field label="Frequency" value={ctl.frequency} />
          <Field label="Due Date" value={ctl.dueDate} />
          <Field label="Act"><ActLink ctl={ctl} onActClick={onActClick} /></Field>
        </FieldGrid>
      </Section>

      <Section icon={<Shield fontSize="small" />} title="Risk Assessment" subtitle="Before and after controls (likelihood × impact)">
        <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.62rem', color: 'text.secondary' }}>
              Inherent
            </Typography>
            <Box sx={{ mt: 1 }}><FieldGrid min={120} gap={1.5}>
              <Field label="Rating" children={<RiskChip rating={ctl.riskLevel} />} />
            </FieldGrid></Box>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.62rem', color: 'text.secondary' }}>
              Residual
            </Typography>
            <Box sx={{ mt: 1 }}><FieldGrid min={120} gap={1.5}>
              <Field label="Likelihood" value={ctl.residualLikelihood} />
              <Field label="Impact" value={ctl.residualImpact} />
              <Field label="Rating" children={<RiskChip rating={ctl.residualRiskRating} likelihood={ctl.residualLikelihood} impact={ctl.residualImpact} />} />
            </FieldGrid></Box>
          </Box>
        </Box>
      </Section>

      <LongTextBlock icon={<Rule fontSize="small" />} title="Control Statement" text={ctl.complianceControl} points={ctl.points} pointType="control" />
      <LongTextBlock icon={<Gavel fontSize="small" />} title="Regulatory Requirement" text={ctl.regulatoryRequirement} />
      <LongTextBlock icon={<Visibility fontSize="small" />} title="Monitoring Activity" text={ctl.monitoringActivity} />
      <LongTextBlock icon={<CheckCircle fontSize="small" />} title="Control Effectiveness Measure" text={ctl.controlEffectivenessMeasure} />

      <Section icon={<AccountTree fontSize="small" />} title="Linked Obligations"
        subtitle="Obligations this control addresses">
        <LinkedObligationChips ids={linkedIds} />
      </Section>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
        <Schedule sx={{ fontSize: 16 }} />
        <Typography variant="caption">
          Recorded {ctl.createdAt ? new Date(ctl.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
        </Typography>
      </Box>
    </Box>
  );
}
