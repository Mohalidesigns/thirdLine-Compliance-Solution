import { Box, Typography } from '@mui/material';
import {
  formatDate, TL, StatusBadge, DocumentTextIcon, LinkIcon, CalendarDaysIcon, UserGroupIcon, ScaleIcon,
  ClockIcon, FolderIcon, UserCircleIcon, ClipboardDocumentListIcon,
} from 'shared';
import {
  Section, Field, FieldGrid, StatTile, MonoChip, LongTextBlock, InstrumentRef, CARD_SX,
} from './detailKit';

const FREQUENCY_TONE = {
  Daily: 'red', Weekly: 'orange', Monthly: 'blue', Quarterly: 'teal',
  Biannual: 'purple', Annual: 'green', Adhoc: 'gray', 'Ad-hoc': 'gray', Event: 'purple',
};

/**
 * Presentational body of a return. Shared by `ReturnDetailPage` (full page) and the
 * entity drawer opened from the Act-detail Returns tab.
 */
export default function ReturnDetailContent({ ret }) {
  if (!ret) return null;
  const freqTone = FREQUENCY_TONE[ret.frequencyType] || 'gray';

  return (
    <Box>
      <Box sx={{ ...CARD_SX, p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.25, flexWrap: 'wrap' }}>
            <DocumentTextIcon size={20} sx={{ color: TL.primary }} />
            <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: '1.75rem', color: TL.textPrimary }}>{ret.title}</Typography>
            {ret.frequencyType && <StatusBadge label={ret.frequencyType} tone={freqTone} />}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <MonoChip label={ret.sectionReference} />
            {ret.actName && (
              <Typography sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: 'primary.main', fontWeight: 500, fontSize: '0.875rem' }}>
                <LinkIcon size={14} />
                {ret.actName}{ret.actAbbreviation ? ` (${ret.actAbbreviation})` : ''}
              </Typography>
            )}
          </Box>
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, mb: 3 }}>
        <StatTile icon={<CalendarDaysIcon />} label="Frequency" accent={freqTone}
          value={ret.frequencyType || ret.frequency} />
        <StatTile icon={<ClockIcon />} label="Filing Date" accent="blue" value={formatDate(ret.filingDate)} />
        <StatTile icon={<UserGroupIcon />} label="Responsible Unit" accent="teal" value={ret.responsibleUnit || 'Unassigned'} />
        <StatTile icon={<UserCircleIcon />} label="Responsible Person" accent="purple" value={ret.responsiblePerson} />
      </Box>

      <Section icon={<UserGroupIcon />} title="Ownership">
        <FieldGrid>
          <Field label="Responsible Unit" value={ret.responsibleUnit || 'Unassigned'} />
          <Field label="Responsible Person" value={ret.responsiblePerson} />
          <Field label="Act" value={ret.actName ? `${ret.actName}${ret.actAbbreviation ? ` (${ret.actAbbreviation})` : ''}` : null} />
          <Field label="Section Reference" value={ret.sectionReference} mono />
        </FieldGrid>
      </Section>

      <Section icon={<CalendarDaysIcon />} title="Schedule">
        <FieldGrid>
          <Field label="Frequency Type" value={ret.frequencyType} />
          <Field label="Frequency" value={ret.frequency} />
          <Field label="Filing Date" value={formatDate(ret.filingDate)} />
          <Field label="Deadline" value={ret.deadline} />
        </FieldGrid>
      </Section>

      <LongTextBlock icon={<ScaleIcon />} title="Statutory Basis" text={ret.statutoryBasis} />
      <LongTextBlock icon={<ClipboardDocumentListIcon />} title="Remarks" text={ret.remarks} />

      <Section icon={<FolderIcon />} title="Linked Record">
        <FieldGrid>
          <Field label="Instrument"><InstrumentRef id={ret.instrumentId} /></Field>
          <Field label="Recorded" value={formatDate(ret.createdAt)} />
        </FieldGrid>
      </Section>
    </Box>
  );
}
