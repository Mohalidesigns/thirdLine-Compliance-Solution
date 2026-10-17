import { Box, Chip, Typography } from '@mui/material';
import {
  formatNaira, formatDate, friendlyPenaltyTypes, TL, StatusBadge,
  ScaleIcon, CheckCircleIcon, LinkIcon, BanknotesIcon, UserCircleIcon, ClockIcon, FolderIcon, ExclamationTriangleIcon,
} from 'shared';
import {
  Section, Field, FieldGrid, StatTile, MonoChip, LongTextBlock, InstrumentRef, CARD_SX,
} from './detailKit';

/**
 * Presentational body of a sanction. Shared by `SanctionDetailPage` (full page) and the
 * entity drawer opened from the Act-detail Sanctions tab, so both render identical fields.
 */
export default function SanctionDetailContent({ sanction }) {
  if (!sanction) return null;
  const roles = Array.isArray(sanction.liableRoles) ? sanction.liableRoles : [];
  const penaltyTypes = friendlyPenaltyTypes(sanction.penaltyType);
  const sevTone = sanction.severityScore > 7 ? 'red' : sanction.severityScore > 4 ? 'orange' : 'teal';

  return (
    <Box>
      <Box sx={{ ...CARD_SX, p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap', mb: 1.25 }}>
            <ScaleIcon size={20} sx={{ color: TL.error }} />
            <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: '1.75rem', color: TL.textPrimary }}>{sanction.sanctionType || 'Sanction'}</Typography>
            {sanction.severityScore != null && (
              <StatusBadge label={`Severity ${sanction.severityScore}/10`} tone={sevTone} dot />
            )}
            {sanction.hasBeenEnforced
              ? <StatusBadge label="Enforced" tone="green" />
              : <StatusBadge label="Not enforced" tone="gray" />}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <MonoChip label={sanction.sourceSectionReference} />
            {sanction.actName && (
              <Typography sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: 'primary.main', fontWeight: 500, fontSize: '0.875rem' }}>
                <LinkIcon size={14} />
                {sanction.actName}{sanction.actAbbreviation ? ` (${sanction.actAbbreviation})` : ''}
              </Typography>
            )}
          </Box>
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, mb: 3 }}>
        <StatTile icon={<BanknotesIcon />} label="Maximum exposure" accent="red"
          value={`${formatNaira(sanction.sanctionAmountNaira, { perDay: sanction.sanctionAmountPerDay })}`} />
        <StatTile icon={<UserCircleIcon />} label="Personal liability" accent="orange"
          value={formatNaira(sanction.personalLiabilityNaira)} />
        <StatTile icon={<ExclamationTriangleIcon />} label="Penalty type" accent="purple" value={penaltyTypes} />
        <StatTile icon={<CheckCircleIcon />} label="Liable roles" accent="teal"
          value={roles.length ? `${roles.length} role${roles.length > 1 ? 's' : ''}` : null} />
      </Box>

      <LongTextBlock icon={<ScaleIcon />} title="Violation" text={sanction.description} />
      <LongTextBlock icon={<ExclamationTriangleIcon />} title="Penalty" text={sanction.penaltyDetails} />
      <LongTextBlock icon={<ClockIcon />} title="Impact" text={sanction.riskExplanation} />

      <Section icon={<UserCircleIcon />} title="Liable Roles" subtitle="Persons/roles the penalty attaches to">
        {roles.length ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {roles.map((r) => (
              <Chip key={r} size="small" label={r} />
            ))}
          </Box>
        ) : (
          <Typography sx={{ fontSize: '0.875rem', color: TL.gray500, fontStyle: 'italic' }}>No liable roles recorded.</Typography>
        )}
      </Section>

      <Section icon={<ScaleIcon />} title="Enforcement History">
        <FieldGrid>
          <Field label="Enforcement basis" value={sanction.hasBeenEnforced ? 'Enforced' : 'Not enforced'} />
          <Field label="Most recent enforcement" value={formatDate(sanction.recentEnforcementDate)} />
          <Field label="Amount enforced" value={formatNaira(sanction.recentEnforcementAmount)} />
        </FieldGrid>
      </Section>

      <Section icon={<FolderIcon />} title="Linked Record">
        <FieldGrid>
          <Field label="Instrument"><InstrumentRef id={sanction.instrumentId} /></Field>
          <Field label="Recorded" value={formatDate(sanction.createdAt)} />
          <Field label="Updated" value={formatDate(sanction.updatedAt)} />
        </FieldGrid>
      </Section>
    </Box>
  );
}
