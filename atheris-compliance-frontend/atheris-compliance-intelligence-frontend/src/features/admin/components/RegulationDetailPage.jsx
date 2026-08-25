import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Grid, Button, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, CircularProgress, Alert,
} from '@mui/material';
import {
  ArrowBack, Description, Gavel, Rule, EventRepeat, Link as LinkIcon, OpenInNew,
} from '@mui/icons-material';
import api from '../../../services/api';
import { ROUTES } from '../../../utils/constants';

const riskColors = { High: '#C53030', Medium: '#DD6B20', Low: '#2D7D46' };

function formatDt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtNaira(v) {
  if (!v) return null;
  const num = Number(v);
  if (Number.isNaN(num)) return null;
  return Number(num).toLocaleString('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
}

function SectionCard({ icon, color, title, count, subtitle, emptyMsg, columns, rows, renderCell }) {
  return (
    <Card sx={{ mb: 3, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '1px solid #EDF2F7' }}>
        <Box sx={{ color }}>{icon}</Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{title}</Typography>
          {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
        </Box>
        <Chip label={count} size="small" sx={{ fontWeight: 700, bgcolor: `${color}14`, color }} />
      </Box>
      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>{emptyMsg}</Typography>
      ) : (
        <TableContainer sx={{ maxHeight: 420 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {columns.map((c) => (
                  <TableCell key={c.key} sx={{ fontWeight: 700, color: '#4A5568', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1, width: c.width }}>
                    {c.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={row.key || i} sx={{ '&:last-child td': { border: 0 }, bgcolor: i % 2 === 0 ? 'transparent' : '#F7FAFC' }}>
                  {columns.map((c) => (
                    <TableCell key={c.key} sx={{ fontSize: '0.75rem', py: 1, verticalAlign: 'top', ...c.sx }}>
                      {renderCell ? renderCell(c.key, row) : row[c.key] ?? '—'}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Card>
  );
}

export default function RegulationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [reg, setReg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.platform.acts.get(id)
      .then(setReg)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }

  if (error || !reg) {
    return (
      <Box>
        <Button startIcon={<ArrowBack />} onClick={() => navigate(ROUTES.ADMIN_ACTS)} sx={{ mb: 2 }}>Back to Acts</Button>
        <Alert severity="error">{error || 'Act not found'}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate(ROUTES.ADMIN_ACTS)} sx={{ mb: 2 }}>Back to Acts</Button>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={8}>
          <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', height: '100%' }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{reg.name}</Typography>
                <Chip label={reg.status || 'Active'} size="small" sx={{ fontWeight: 700, fontSize: '0.65rem', bgcolor: reg.status === 'Superseded' || reg.status === 'Outdated' ? '#FED7D7' : '#E6FFFA', color: reg.status === 'Superseded' || reg.status === 'Outdated' ? '#C53030' : '#2C7A7B', borderRadius: 1 }} />
              </Box>
              {reg.regulatorName && (
                <Typography variant="body2" sx={{ color: '#3182CE', fontWeight: 600, mb: 0.5 }}>
                  <LinkIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                  {reg.regulatorName}
                </Typography>
              )}
              {reg.abbreviation && (
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'Roboto Mono', fontSize: '0.7rem' }}>
                  {reg.abbreviation}
                </Typography>
              )}
              {reg.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, fontSize: '0.82rem' }}>{reg.description}</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', height: '100%' }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.65rem', fontWeight: 700 }}>Coverage</Typography>
              <Grid container spacing={1} sx={{ mt: 0.5 }}>
                {[
                  { label: 'Instruments', value: reg.instrumentCount, color: '#3182CE' },
                  { label: 'Obligations', value: reg.obligationCount, color: '#2D7D46' },
                  { label: 'Sanctions', value: reg.sanctionCount, color: '#C53030' },
                  { label: 'Returns', value: reg.returnCount, color: '#6B46C1' },
                ].map((c) => (
                  <Grid item xs={3} key={c.label}>
                    <Box sx={{ textAlign: 'center', p: 1, borderRadius: 1.5, bgcolor: '#F7FAFC' }}>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: c.color, lineHeight: 1.2 }}>{c.value}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.62rem' }}>{c.label}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <SectionCard
        title="Instruments"
        count={reg.instruments?.length || 0}
        icon={<Description sx={{ fontSize: 20 }} />}
        color="#3182CE"
        emptyMsg="No instruments linked to this act"
        columns={[
          { key: 'sourceTitle', label: 'Title', sx: { maxWidth: 420 } },
          { key: 'nature', label: 'Nature', width: 110 },
          { key: 'areaOfFocus', label: 'Area of Focus', width: 150 },
          { key: 'riskRating', label: 'Risk', width: 80 },
          { key: 'dateIssued', label: 'Issued', width: 100 },
          { key: 'status', label: 'Status', width: 100 },
          { key: '_doc', label: '', width: 70 },
        ]}
        rows={(reg.instruments || []).map((i) => ({ key: i.instrumentId, ...i }))}
        renderCell={(key, row) => {
          if (key === 'sourceTitle') return <Typography sx={{ fontWeight: 600, fontSize: '0.78rem' }}>{row.sourceTitle}</Typography>;
          if (key === 'riskRating') return row.riskRating ? <Typography variant="caption" sx={{ fontWeight: 700, color: riskColors[row.riskRating] }}>{row.riskRating}</Typography> : '—';
          if (key === 'dateIssued') return <Typography sx={{ fontSize: '0.72rem', color: '#718096', whiteSpace: 'nowrap' }}>{formatDt(row.dateIssued)}</Typography>;
          if (key === 'status') return row.status ? <Chip label={row.status} size="small" sx={{ fontWeight: 600, fontSize: '0.62rem', bgcolor: row.status === 'Superseded' ? '#FED7D7' : '#E6F4EA', color: row.status === 'Superseded' ? '#C53030' : '#2D7D46' }} /> : '—';
          if (key === '_doc') {
            if (!row.documentUrl) return '—';
            return (
              <a href={row.documentUrl} target="_blank" rel="noopener noreferrer">
                <OpenInNew sx={{ fontSize: 16, color: '#3182CE' }} />
              </a>
            );
          }
          return row[key] ?? '—';
        }}
      />

      <SectionCard
        title="Obligations"
        count={reg.obligations?.length || 0}
        icon={<Rule sx={{ fontSize: 20 }} />}
        color="#2D7D46"
        subtitle="Extracted compliance obligations for commercial banks"
        emptyMsg="No obligations extracted for this act"
        columns={[
          { key: 'sectionReference', label: 'Section', width: 120 },
          { key: 'statement', label: 'Plain-English Obligation' },
          { key: 'type', label: 'Type', width: 120 },
          { key: 'recurringDeadline', label: 'Deadline', width: 140 },
        ]}
        rows={(reg.obligations || []).map((o) => ({ key: o.obligationId, ...o }))}
        renderCell={(key, row) => {
          if (key === 'statement') return <Typography sx={{ fontSize: '0.75rem', lineHeight: 1.5 }}>{row.statement}</Typography>;
          if (key === 'sectionReference') return row.sectionReference ? <Chip label={row.sectionReference} size="small" variant="outlined" sx={{ fontWeight: 600, fontSize: '0.65rem', fontFamily: 'Roboto Mono' }} /> : '—';
          return row[key] ?? '—';
        }}
      />

      <SectionCard
        title="Sanctions & Penalties"
        count={reg.sanctions?.length || 0}
        icon={<Gavel sx={{ fontSize: 20 }} />}
        color="#C53030"
        subtitle="Fines and enforcement exposure for non-compliance"
        emptyMsg="No sanctions recorded for this act"
        columns={[
          { key: 'sectionReference', label: 'Section', width: 110 },
          { key: 'description', label: 'Violation / Penalty' },
          { key: 'amountNaira', label: 'Amount', width: 120 },
          { key: 'penaltyDetails', label: 'Penalty Breakdown', width: 180 },
          { key: 'riskExplanation', label: 'Impact', width: 180 },
          { key: 'liableRoles', label: 'Liable', width: 150 },
        ]}
        rows={(reg.sanctions || []).map((s) => ({ key: s.sanctionId, ...s }))}
        renderCell={(key, row) => {
          if (key === 'description') return <Typography sx={{ fontSize: '0.75rem', lineHeight: 1.5 }}>{row.description}</Typography>;
          if (key === 'amountNaira') {
            const amt = fmtNaira(row.amountNaira);
            return amt ? <Typography sx={{ fontWeight: 700, color: '#C53030', fontSize: '0.78rem' }}>{amt}{row.amountPerDay ? ' / day' : ''}</Typography> : '—';
          }
          if (key === 'penaltyDetails') {
            if (!row.penaltyDetails) return '—';
            return <Typography sx={{ fontSize: '0.72rem', color: '#B7791F', fontFamily: 'Roboto Mono' }}>{row.penaltyDetails}</Typography>;
          }
          if (key === 'riskExplanation') {
            if (!row.riskExplanation) return '—';
            return <Typography sx={{ fontSize: '0.72rem', color: '#718096', lineHeight: 1.4 }}>{row.riskExplanation}</Typography>;
          }
          if (key === 'liableRoles') {
            if (!row.liableRoles || row.liableRoles.length === 0) return '—';
            return row.liableRoles.map((r, j) => (
              <Chip key={j} label={r} size="small" sx={{ mr: 0.5, mb: 0.5, fontSize: '0.62rem', fontWeight: 600, bgcolor: '#FAF5FF', color: '#6B46C1' }} />
            ));
          }
          return row[key] ?? '—';
        }}
      />

      <SectionCard
        title="Returns & Remittance"
        count={reg.returns?.length || 0}
        icon={<EventRepeat sx={{ fontSize: 20 }} />}
        color="#6B46C1"
        subtitle="Periodic regulatory returns obligations"
        emptyMsg="No returns recorded for this act"
        columns={[
          { key: 'title', label: 'Return', sx: { maxWidth: 220 } },
          { key: 'sectionReference', label: 'Section', width: 110 },
          { key: 'frequency', label: 'Frequency', width: 160 },
          { key: 'responsibleUnit', label: 'Responsible Unit', width: 160 },
          { key: 'responsiblePerson', label: 'Responsible Person', width: 140 },
          { key: 'statutoryBasis', label: 'Statutory Basis' },
        ]}
        rows={(reg.returns || []).map((rt) => ({ key: rt.returnId, ...rt }))}
        renderCell={(key, row) => {
          if (key === 'title') return <Typography sx={{ fontWeight: 600, fontSize: '0.78rem' }}>{row.title}</Typography>;
          if (key === 'sectionReference') return row.sectionReference ? <Chip label={row.sectionReference} size="small" variant="outlined" sx={{ fontWeight: 600, fontSize: '0.65rem', fontFamily: 'Roboto Mono' }} /> : '—';
          if (key === 'frequency') return <Typography sx={{ fontSize: '0.72rem', whiteSpace: 'normal' }}>{row.frequency || '—'}</Typography>;
          if (key === 'responsibleUnit') return <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#553C9A' }}>{row.responsibleUnit || '—'}</Typography>;
          if (key === 'responsiblePerson') return <Typography sx={{ fontSize: '0.72rem', color: '#718096' }}>{row.responsiblePerson || '—'}</Typography>;
          if (key === 'statutoryBasis') return <Typography sx={{ fontSize: '0.72rem', lineHeight: 1.4, color: '#4A5568' }}>{row.statutoryBasis || '—'}</Typography>;
          return row[key] ?? '—';
        }}
      />
    </Box>
  );
}