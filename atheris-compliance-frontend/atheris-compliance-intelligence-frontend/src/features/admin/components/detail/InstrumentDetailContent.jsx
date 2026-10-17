import { useState } from 'react';
import {
  Box, Typography, Chip, Button, Collapse, Table, TableHead, TableBody,
  TableRow, TableCell, TableContainer,
} from '@mui/material';
import { DataCard, RiskBadge, StateBadge, TL, ChevronDownIcon } from 'shared';
import { Field, FieldGrid } from './detailKit';

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function riskChip(rating) {
  return <RiskBadge value={rating} />;
}

function statusChip(status) {
  return <StateBadge value={status} />;
}

/**
 * Presentational body of an instrument. Shared by the `InstrumentsPage` detail view and
 * the entity drawer opened from the Act-detail Instruments tab. `row` supplies the values
 * already held by the register (title/risk/regulator); `detail` is `/platform/instruments/{id}`.
 */
export default function InstrumentDetailContent({ row, detail, regulatorLabel }) {
  const [showOcr, setShowOcr] = useState(false);
  const d = { ...(row || {}), ...(detail || {}) };
  const regulator = detail?.regulator || regulatorLabel || '-';

  return (
    <Box>
      <DataCard sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5, flexWrap: 'wrap' }}>
          {riskChip(d.riskRating)}
          <Typography sx={{ fontSize: '0.75rem', color: TL.gray500, fontWeight: 500 }}>{regulator}</Typography>
          {statusChip(d.status)}
          <Chip size="small" label={d.areaOfFocus || 'General'} variant="outlined" />
        </Box>
        <Typography sx={{ fontSize: '1.125rem', fontWeight: 600, lineHeight: '1.75rem', color: TL.textPrimary, mb: 3 }}>{d.sourceTitle}</Typography>
        <FieldGrid min={180}>
          <Field label="Risk Rating">{riskChip(d.riskRating)}</Field>
          <Field label="Regulator" value={regulator} />
          <Field label="Area of Focus" value={d.areaOfFocus || '-'} />
          <Field label="Nature" value={d.nature || '-'} />
          <Field label="Obligations" value={String(detail?.obligations?.length || 0)} />
          <Field label="Confidence" value={d.applicabilityConfidence != null ? `${(d.applicabilityConfidence * 100).toFixed(0)}%` : '-'} />
          {d.dateCommencement && <Field label="Effective Date" value={formatDate(d.dateCommencement)} />}
          <Field label="Published" value={formatDate(d.firstPublishedAt || d.discoveredAt)} />
        </FieldGrid>
      </DataCard>

      {detail?.aiSummary && (
        <DataCard title="AI Summary" sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: '0.875rem', fontStyle: 'italic', color: TL.gray600 }}>{detail.aiSummary}</Typography>
        </DataCard>
      )}

      {detail?.pdfOcrText && (
        <DataCard noPadding sx={{ mb: 3 }}>
          <Box sx={{ px: 2, py: 1 }}>
            <Button size="small" variant="text" onClick={() => setShowOcr(!showOcr)}
              endIcon={<ChevronDownIcon size={16} sx={{ transform: showOcr ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />}>
              {showOcr ? 'Hide' : 'Show'} Raw OCR Text
            </Button>
          </Box>
          <Collapse in={showOcr}>
            <Box sx={{
              p: 2, bgcolor: TL.gray50, color: TL.gray700, borderTop: `1px solid ${TL.gray100}`,
              maxHeight: 400, overflow: 'auto', fontFamily: TL.mono,
              fontSize: '0.75rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {detail.pdfOcrText}
            </Box>
          </Collapse>
        </DataCard>
      )}

      {detail?.sanctions?.length > 0 && (
        <DataCard title="Penalties" sx={{ mb: 3 }}>
          {detail.sanctions.map((s, i) => (
            <Box key={i} sx={{ mb: 1.25, '&:last-child': { mb: 0 } }}>
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: TL.error }}>
                {s.sanctionType}{s.amountNaira ? ` — ₦${s.amountNaira.toLocaleString()}` : ''}
              </Typography>
              {s.liableRoles?.length > 0 && (
                <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>
                  Liable: {s.liableRoles.join(', ')}
                </Typography>
              )}
            </Box>
          ))}
        </DataCard>
      )}

      <DataCard title={`Obligations (${detail?.obligations?.length || 0})`} noPadding>
        {detail?.obligations?.length > 0 ? (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Section</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Deadline</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {detail.obligations.map(obl => (
                  <TableRow key={obl.number} hover>
                    <TableCell>{obl.number}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: 400 }}>{obl.statement}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={obl.sectionReference || '-'} variant="outlined" sx={{ fontFamily: TL.mono, fontSize: '0.7rem' }} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{obl.type || '-'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{obl.recurringDeadline || '-'}</Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.875rem', color: TL.gray500 }}>No specific obligations extracted for this instrument.</Typography>
          </Box>
        )}
      </DataCard>
    </Box>
  );
}
