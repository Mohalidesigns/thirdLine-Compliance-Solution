import { Box, Card, CardContent, Chip, Typography } from '@mui/material';
import {
  RequestQuote, Link as LinkIcon, EventRepeat, Groups, Gavel, Notes,
  Schedule, Folder, Person,
} from '@mui/icons-material';
import { formatDate } from 'shared';
import {
  Section, Field, FieldGrid, StatTile, MonoChip, LongTextBlock, InstrumentRef, CARD_SX,
} from './detailKit';

const FREQUENCY_COLOR = {
  Daily: '#C53030', Weekly: '#DD6B20', Monthly: '#2B6CB0', Quarterly: '#2C7A7B',
  Biannual: '#6B46C1', Annual: '#2D7D46', Adhoc: '#718096', 'Ad-hoc': '#718096', Event: '#805AD5',
};

/**
 * Presentational body of a return. Shared by `ReturnDetailPage` (full page) and the
 * entity drawer opened from the Act-detail Returns tab.
 */
export default function ReturnDetailContent({ ret }) {
  if (!ret) return null;
  const freqColor = FREQUENCY_COLOR[ret.frequencyType] || '#718096';

  return (
    <Box>
      <Card sx={{ ...CARD_SX, mb: 2.5 }}>
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25, flexWrap: 'wrap' }}>
            <RequestQuote sx={{ color: '#DD6B20' }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{ret.title}</Typography>
            {ret.frequencyType && (
              <Chip size="small" label={ret.frequencyType}
                sx={{ height: 22, borderRadius: '4px', fontWeight: 700, fontSize: '0.68rem', bgcolor: `${freqColor}18`, color: freqColor }} />
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <MonoChip label={ret.sectionReference} />
            {ret.actName && (
              <Typography variant="body2" sx={{ color: '#3182CE', fontWeight: 600, fontSize: '0.85rem' }}>
                <LinkIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                {ret.actName}{ret.actAbbreviation ? ` (${ret.actAbbreviation})` : ''}
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, mb: 2.5 }}>
        <StatTile icon={<EventRepeat fontSize="small" />} label="Frequency" accent={freqColor}
          value={ret.frequencyType || ret.frequency} />
        <StatTile icon={<Schedule fontSize="small" />} label="Filing Date" accent="#2B6CB0" value={formatDate(ret.filingDate)} />
        <StatTile icon={<Groups fontSize="small" />} label="Responsible Unit" accent="#2C7A7B" value={ret.responsibleUnit || 'Unassigned'} />
        <StatTile icon={<Person fontSize="small" />} label="Responsible Person" accent="#6B46C1" value={ret.responsiblePerson} />
      </Box>

      <Section icon={<Groups fontSize="small" />} title="Ownership">
        <FieldGrid>
          <Field label="Responsible Unit" value={ret.responsibleUnit || 'Unassigned'} />
          <Field label="Responsible Person" value={ret.responsiblePerson} />
          <Field label="Act" value={ret.actName ? `${ret.actName}${ret.actAbbreviation ? ` (${ret.actAbbreviation})` : ''}` : null} />
          <Field label="Section Reference" value={ret.sectionReference} mono />
        </FieldGrid>
      </Section>

      <Section icon={<EventRepeat fontSize="small" />} title="Schedule">
        <FieldGrid>
          <Field label="Frequency Type" value={ret.frequencyType} />
          <Field label="Frequency" value={ret.frequency} />
          <Field label="Filing Date" value={formatDate(ret.filingDate)} />
          <Field label="Deadline" value={ret.deadline} />
        </FieldGrid>
      </Section>

      <LongTextBlock icon={<Gavel fontSize="small" />} title="Statutory Basis" text={ret.statutoryBasis} />
      <LongTextBlock icon={<Notes fontSize="small" />} title="Remarks" text={ret.remarks} />

      <Section icon={<Folder fontSize="small" />} title="Linked Record">
        <FieldGrid>
          <Field label="Instrument"><InstrumentRef id={ret.instrumentId} /></Field>
          <Field label="Recorded" value={formatDate(ret.createdAt)} />
        </FieldGrid>
      </Section>
    </Box>
  );
}
