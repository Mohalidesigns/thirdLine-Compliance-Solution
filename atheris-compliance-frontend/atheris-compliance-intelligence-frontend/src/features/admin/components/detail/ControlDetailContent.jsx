import { Box, Typography } from '@mui/material';
import {
  TL, StateBadge, ClipboardDocumentCheckIcon, LinkIcon, ShieldCheckIcon, CalendarDaysIcon, UserCircleIcon,
  Squares2x2Icon, ScaleIcon, EyeIcon, CheckCircleIcon, ClockIcon, QueueListIcon, ClipboardDocumentListIcon,
} from 'shared';
import {
  Section, Field, FieldGrid, StatTile, RiskChip, MonoChip,
  LongTextBlock, LinkedObligationChips, CARD_SX,
} from './detailKit';

function statusChip(status) {
  return <StateBadge value={status || 'Open'} />;
}

function ActLink({ ctl, onActClick }) {
  if (!ctl.actName) return <Typography sx={{ fontSize: '0.875rem', color: TL.gray400 }}>—</Typography>;
  const clickable = onActClick && ctl.actId;
  return (
    <Typography
      onClick={() => clickable && onActClick(ctl.actId)}
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: '0.875rem', fontWeight: 500,
        color: clickable ? 'primary.main' : TL.gray700, cursor: clickable ? 'pointer' : 'default',
        '&:hover': clickable ? { textDecoration: 'underline' } : undefined,
      }}>
      <LinkIcon size={14} />{ctl.actName}
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
      <Box sx={{ ...CARD_SX, p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap', mb: 1.25 }}>
            <ClipboardDocumentCheckIcon size={20} sx={{ color: TL.primary }} />
            <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: '1.75rem', color: TL.textPrimary, fontFamily: TL.mono }}>
              {ctl.controlNumber}
            </Typography>
            <RiskChip rating={ctl.riskLevel} />
            {statusChip(ctl.status)}
            {ctl.controlType && <MonoChip label={ctl.controlType} />}
          </Box>
          <ActLink ctl={ctl} onActClick={onActClick} />
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, mb: 3 }}>
        <StatTile icon={<ShieldCheckIcon />} label="Inherent Risk" accent="red"
          chip={<RiskChip rating={ctl.riskLevel} />} />
        <StatTile icon={<ShieldCheckIcon />} label="Residual Risk" accent="green"
          chip={<RiskChip rating={ctl.residualRiskRating} />} />
        <StatTile icon={<CalendarDaysIcon />} label="Frequency" accent="teal" value={ctl.frequency} />
        <StatTile icon={<UserCircleIcon />} label="Owner" accent="purple" value={ctl.ownerName || ctl.responsibleOfficer} />
      </Box>

      <Section icon={<Squares2x2Icon />} title="Classification">
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

      <Section icon={<ShieldCheckIcon />} title="Risk Assessment" subtitle="Before and after controls (likelihood × impact)">
        <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
          <Box>
            <Typography sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.75rem', color: TL.gray500 }}>
              Inherent
            </Typography>
            <Box sx={{ mt: 1 }}><FieldGrid min={120} gap={1.5}>
              <Field label="Rating" children={<RiskChip rating={ctl.riskLevel} />} />
            </FieldGrid></Box>
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.75rem', color: TL.gray500 }}>
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

      <LongTextBlock icon={<ClipboardDocumentListIcon />} title="Control Statement" text={ctl.complianceControl} points={ctl.points} pointType="control" />
      <LongTextBlock icon={<ScaleIcon />} title="Regulatory Requirement" text={ctl.regulatoryRequirement} />
      <LongTextBlock icon={<EyeIcon />} title="Monitoring Activity" text={ctl.monitoringActivity} />
      <LongTextBlock icon={<CheckCircleIcon />} title="Control Effectiveness Measure" text={ctl.controlEffectivenessMeasure} />

      <Section icon={<QueueListIcon />} title="Linked Obligations"
        subtitle="Obligations this control addresses">
        <LinkedObligationChips ids={linkedIds} />
      </Section>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: TL.gray400 }}>
        <ClockIcon size={16} />
        <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>
          Recorded {ctl.createdAt ? new Date(ctl.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
        </Typography>
      </Box>
    </Box>
  );
}
