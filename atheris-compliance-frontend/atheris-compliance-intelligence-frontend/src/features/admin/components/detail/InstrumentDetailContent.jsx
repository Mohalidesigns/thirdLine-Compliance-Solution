import { useState } from 'react';
import {
  Box, Typography, Chip, Button, Collapse, Table, TableHead, TableBody,
  TableRow, TableCell, TableContainer, Paper, Tooltip,
} from '@mui/material';
import { ExpandMore, ExpandLess } from '@mui/icons-material';

const RISK_CONFIG = {
  High: { color: 'error', bg: '#FFF5F5', chip: '#E53E3E' },
  Medium: { color: 'warning', bg: '#FFFAF0', chip: '#DD6B20' },
  Low: { color: 'success', bg: '#F0FFF4', chip: '#38A169' },
};

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function riskChip(rating) {
  const cfg = RISK_CONFIG[rating];
  if (!cfg) return <Chip size="small" label="Unrated" variant="outlined" sx={{ height: 22 }} />;
  return <Chip size="small" label={rating} color={cfg.color} sx={{ height: 22, fontWeight: 600 }} />;
}

function statusChip(status) {
  const colors = { Published: 'success', Triage: 'warning', Superseded: 'default', Withdrawn: 'error' };
  return <Chip size="small" label={status || 'Unknown'} color={colors[status] || 'default'} sx={{ height: 22, fontWeight: 600 }} />;
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
      <Paper sx={{ p: 3, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          {riskChip(d.riskRating)}
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>{regulator}</Typography>
          {statusChip(d.status)}
          <Chip size="small" label={d.areaOfFocus || 'General'} variant="outlined" />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>{d.sourceTitle}</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 2 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">Risk Rating</Typography>
            <Box sx={{ mt: 0.5 }}>{riskChip(d.riskRating)}</Box>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Regulator</Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>{regulator}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Area of Focus</Typography>
            <Typography variant="body2">{d.areaOfFocus || '-'}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Nature</Typography>
            <Typography variant="body2">{d.nature || '-'}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Obligations</Typography>
            <Typography variant="body2">{detail?.obligations?.length || 0}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Confidence</Typography>
            <Typography variant="body2">{d.applicabilityConfidence != null ? `${(d.applicabilityConfidence * 100).toFixed(0)}%` : '-'}</Typography>
          </Box>
          {d.dateCommencement && (
            <Box>
              <Typography variant="caption" color="text.secondary">Effective Date</Typography>
              <Typography variant="body2">{formatDate(d.dateCommencement)}</Typography>
            </Box>
          )}
          <Box>
            <Typography variant="caption" color="text.secondary">Published</Typography>
            <Typography variant="body2">{formatDate(d.firstPublishedAt || d.discoveredAt)}</Typography>
          </Box>
        </Box>
      </Paper>

      {detail?.aiSummary && (
        <Paper sx={{ p: 3, mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>AI Summary</Typography>
          <Typography variant="body2" fontStyle="italic" color="text.secondary">{detail.aiSummary}</Typography>
        </Paper>
      )}

      {detail?.pdfOcrText && (
        <Paper sx={{ mb: 2 }}>
          <Button size="small" onClick={() => setShowOcr(!showOcr)}
            endIcon={showOcr ? <ExpandLess /> : <ExpandMore />} sx={{ px: 2, py: 1 }}>
            {showOcr ? 'Hide' : 'Show'} Raw OCR Text
          </Button>
          <Collapse in={showOcr}>
            <Box sx={{
              p: 2, bgcolor: '#1A1A2E', color: '#E2E8F0',
              maxHeight: 400, overflow: 'auto', fontFamily: 'Roboto Mono, monospace',
              fontSize: '0.75rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {detail.pdfOcrText}
            </Box>
          </Collapse>
        </Paper>
      )}

      {detail?.sanctions?.length > 0 && (
        <Paper sx={{ p: 3, mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Penalties</Typography>
          {detail.sanctions.map((s, i) => (
            <Box key={i} sx={{ mb: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'error.main' }}>
                {s.sanctionType}{s.amountNaira ? ` — ₦${s.amountNaira.toLocaleString()}` : ''}
              </Typography>
              {s.liableRoles?.length > 0 && (
                <Typography variant="caption" color="text.secondary">
                  Liable: {s.liableRoles.join(', ')}
                </Typography>
              )}
            </Box>
          ))}
        </Paper>
      )}

      <Paper>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Obligations ({detail?.obligations?.length || 0})
          </Typography>
        </Box>
        {detail?.obligations?.length > 0 ? (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Section</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Deadline</TableCell>
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
                      <Chip size="small" label={obl.sectionReference || '-'} variant="outlined" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }} />
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
          <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
            <Typography variant="body2">No specific obligations extracted for this instrument.</Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
}