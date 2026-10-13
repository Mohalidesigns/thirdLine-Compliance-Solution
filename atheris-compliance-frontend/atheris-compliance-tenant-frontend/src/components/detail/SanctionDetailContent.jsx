import { Box, Card, CardContent, Chip, Typography } from '@mui/material';
import {
  Gavel, CheckCircle, Link as LinkIcon, Paid, Person, Schedule, Folder, WarningAmber,
} from '@mui/icons-material';
import { formatNaira, formatDate, friendlyPenaltyTypes } from 'shared';
import {
  Section, Field, FieldGrid, StatTile, MonoChip, LongTextBlock, CARD_SX,
} from '../detailKit';

/**
 * Presentational body of a tenant sanction, rendered inside the register's `EntityDrawer`.
 * Mirrors the intel sanction detail so the tenant shows every field the platform holds.
 */
export default function SanctionDetailContent({ sanction }) {
  if (!sanction) return null;
  const roles = Array.isArray(sanction.liableRoles) ? sanction.liableRoles : [];
  const penaltyTypes = friendlyPenaltyTypes(sanction.penaltyType);
  const sevColor = sanction.severityScore > 7 ? '#C53030' : sanction.severityScore > 4 ? '#DD6B20' : '#2C7A7B';

  return (
    <Box>
      <Card sx={{ ...CARD_SX, mb: 2.5 }}>
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1.25 }}>
            <Gavel sx={{ color: '#C53030' }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{sanction.sanctionType || 'Sanction'}</Typography>
            {sanction.severityScore != null && (
              <Chip size="small" label={`Severity ${sanction.severityScore}/10`}
                sx={{ height: 22, borderRadius: '4px', fontWeight: 700, fontSize: '0.68rem', bgcolor: `${sevColor}18`, color: sevColor }} />
            )}
            {sanction.hasBeenEnforced
              ? <Chip icon={<CheckCircle sx={{ fontSize: 14 }} />} label="Enforced" size="small" color="success"
                  sx={{ height: 22, borderRadius: '4px', fontWeight: 600, fontSize: '0.68rem' }} />
              : <Chip icon={<WarningAmber sx={{ fontSize: 14 }} />} label="Not enforced" size="small" variant="outlined"
                  sx={{ height: 22, borderRadius: '4px', fontSize: '0.68rem', color: 'text.secondary' }} />}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <MonoChip label={sanction.sourceSectionReference} />
            {sanction.actName && (
              <Typography variant="body2" sx={{ color: '#3182CE', fontWeight: 600, fontSize: '0.85rem' }}>
                <LinkIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                {sanction.actName}{sanction.actAbbreviation ? ` (${sanction.actAbbreviation})` : ''}
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, mb: 2.5 }}>
        <StatTile icon={<Paid fontSize="small" />} label="Maximum exposure" accent="#C53030"
          value={`${formatNaira(sanction.sanctionAmountNaira, { perDay: sanction.sanctionAmountPerDay })}`} />
        <StatTile icon={<Person fontSize="small" />} label="Personal liability" accent="#DD6B20"
          value={formatNaira(sanction.personalLiabilityNaira)} />
        <StatTile icon={<WarningAmber fontSize="small" />} label="Penalty type" accent="#6B46C1" value={penaltyTypes} />
        <StatTile icon={<CheckCircle fontSize="small" />} label="Liable roles" accent="#2C7A7B"
          value={roles.length ? `${roles.length} role${roles.length > 1 ? 's' : ''}` : null} />
      </Box>

      <LongTextBlock icon={<Gavel fontSize="small" />} title="Violation" text={sanction.description} />
      <LongTextBlock icon={<WarningAmber fontSize="small" />} title="Penalty" text={sanction.penaltyDetails} />
      <LongTextBlock icon={<Schedule fontSize="small" />} title="Impact" text={sanction.riskExplanation} />

      <Section icon={<Person fontSize="small" />} title="Liable Roles" subtitle="Persons/roles the penalty attaches to">
        {roles.length ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {roles.map((r) => (
              <Chip key={r} size="small" label={r}
                sx={{ height: 22, borderRadius: '4px', fontSize: '0.72rem', bgcolor: '#EDF2F7' }} />
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>No liable roles recorded.</Typography>
        )}
      </Section>

      <Section icon={<Gavel fontSize="small" />} title="Enforcement History">
        <FieldGrid>
          <Field label="Enforcement basis" value={sanction.hasBeenEnforced ? 'Enforced' : 'Not enforced'} />
          <Field label="Most recent enforcement" value={formatDate(sanction.recentEnforcementDate)} />
          <Field label="Amount enforced" value={formatNaira(sanction.recentEnforcementAmount)} />
        </FieldGrid>
      </Section>

      <Section icon={<Folder fontSize="small" />} title="Linked Record">
        <FieldGrid>
          <Field label="Instrument" value={sanction.instrumentTitle} />
          <Field label="Recorded" value={formatDate(sanction.createdAt)} />
          <Field label="Updated" value={formatDate(sanction.updatedAt)} />
        </FieldGrid>
      </Section>
    </Box>
  );
}