import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, CircularProgress, Alert, IconButton,
} from '@mui/material';
import {
  DetailHeader, CoverageStrip, DataCard, StatusBadge, RiskBadge, TL,
  DocumentTextIcon, ScaleIcon, ClipboardDocumentListIcon, CalendarDaysIcon, LinkIcon, ChevronRightIcon,
} from 'shared';
import api from '../../../services/api';
import { ROUTES } from '../../../utils/constants';

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

function SectionCard({ icon, title, count, subtitle, emptyMsg, columns, rows, renderCell }) {
  return (
    <DataCard
      noPadding
      sx={{ mb: 3 }}
      title={(
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
          <Box component="span" sx={{ color: TL.gray400, display: 'inline-flex' }}>{icon}</Box>
          {title}
        </Box>
      )}
      subtitle={subtitle}
      actions={<StatusBadge label={count} tone="gray" />}
    >
      {rows.length === 0 ? (
        <Typography sx={{ py: 4, textAlign: 'center', fontSize: '0.875rem', color: TL.gray500 }}>{emptyMsg}</Typography>
      ) : (
        <TableContainer sx={{ maxHeight: 420 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {columns.map((c) => (
                  <TableCell key={c.key} sx={{ width: c.width }}>
                    {c.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={row.key || i} hover sx={{ '&:last-child td': { border: 0 } }}>
                  {columns.map((c) => (
                    <TableCell key={c.key} sx={{ verticalAlign: 'top', ...c.sx }}>
                      {renderCell ? renderCell(c.key, row) : row[c.key] ?? '—'}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </DataCard>
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
        <DetailHeader band title="Act" onBack={() => navigate(ROUTES.ADMIN_ACTS)} backLabel="Back to Acts" />
        <Alert severity="error">{error || 'Act not found'}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <DetailHeader
        band
        onBack={() => navigate(ROUTES.ADMIN_ACTS)}
        backLabel="Back to Acts"
        title={reg.name}
        status={reg.status || 'Active'}
        statusTone={reg.status === 'Superseded' || reg.status === 'Outdated' ? 'red' : 'teal'}
        meta={(reg.regulatorName || reg.abbreviation) ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            {reg.regulatorName && (
              <Typography sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: 'primary.main', fontWeight: 500, fontSize: '0.875rem' }}>
                <LinkIcon size={14} />
                {reg.regulatorName}
              </Typography>
            )}
            {reg.abbreviation && (
              <Typography sx={{ fontFamily: TL.mono, fontSize: '0.75rem', color: TL.gray500 }}>
                {reg.abbreviation}
              </Typography>
            )}
          </Box>
        ) : null}
        description={reg.description}
      />

      <CoverageStrip
        title="Coverage"
        items={[
          { key: 'instruments', label: 'Instruments', value: reg.instrumentCount ?? 0, tone: 'blue', icon: <DocumentTextIcon /> },
          { key: 'obligations', label: 'Obligations', value: reg.obligationCount ?? 0, tone: 'green', icon: <ClipboardDocumentListIcon /> },
          { key: 'sanctions', label: 'Sanctions', value: reg.sanctionCount ?? 0, tone: 'red', icon: <ScaleIcon /> },
          { key: 'returns', label: 'Returns', value: reg.returnCount ?? 0, tone: 'purple', icon: <CalendarDaysIcon /> },
        ]}
      />

      <SectionCard
        title="Instruments"
        count={reg.instruments?.length || 0}
        icon={<DocumentTextIcon size={18} />}
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
          if (key === 'sourceTitle') return <Typography sx={{ fontWeight: 500, fontSize: '0.875rem', color: 'primary.main' }}>{row.sourceTitle}</Typography>;
          if (key === 'riskRating') return row.riskRating ? <RiskBadge value={row.riskRating} /> : '—';
          if (key === 'dateIssued') return <Typography sx={{ fontSize: '0.75rem', color: TL.gray500, whiteSpace: 'nowrap' }}>{formatDt(row.dateIssued)}</Typography>;
          if (key === 'status') return row.status ? <StatusBadge label={row.status} tone={row.status === 'Superseded' ? 'red' : 'green'} /> : '—';
          if (key === '_doc') {
            if (!row.documentUrl) return '—';
            return (
              <IconButton size="small" component="a" href={row.documentUrl} target="_blank" rel="noopener noreferrer" title="Open document">
                <ChevronRightIcon size={16} />
              </IconButton>
            );
          }
          return row[key] ?? '—';
        }}
      />

      <SectionCard
        title="Obligations"
        count={reg.obligations?.length || 0}
        icon={<ClipboardDocumentListIcon size={18} />}
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
          if (key === 'statement') return <Typography sx={{ fontSize: '0.875rem', lineHeight: 1.5, color: TL.gray700 }}>{row.statement}</Typography>;
          if (key === 'sectionReference') return row.sectionReference ? <Chip label={row.sectionReference} size="small" variant="outlined" sx={{ fontSize: '0.7rem', fontFamily: TL.mono }} /> : '—';
          return row[key] ?? '—';
        }}
      />

      <SectionCard
        title="Sanctions & Penalties"
        count={reg.sanctions?.length || 0}
        icon={<ScaleIcon size={18} />}
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
          if (key === 'description') return <Typography sx={{ fontSize: '0.875rem', lineHeight: 1.5, color: TL.gray700 }}>{row.description}</Typography>;
          if (key === 'amountNaira') {
            const amt = fmtNaira(row.amountNaira);
            return amt ? <Typography sx={{ fontWeight: 600, color: TL.error, fontSize: '0.875rem', whiteSpace: 'nowrap' }}>{amt}{row.amountPerDay ? ' / day' : ''}</Typography> : '—';
          }
          if (key === 'penaltyDetails') {
            if (!row.penaltyDetails) return '—';
            return <Typography sx={{ fontSize: '0.75rem', color: TL.gray600, fontFamily: TL.mono }}>{row.penaltyDetails}</Typography>;
          }
          if (key === 'riskExplanation') {
            if (!row.riskExplanation) return '—';
            return <Typography sx={{ fontSize: '0.75rem', color: TL.gray500, lineHeight: 1.4 }}>{row.riskExplanation}</Typography>;
          }
          if (key === 'liableRoles') {
            if (!row.liableRoles || row.liableRoles.length === 0) return '—';
            return row.liableRoles.map((r, j) => (
              <Chip key={j} label={r} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
            ));
          }
          return row[key] ?? '—';
        }}
      />

      <SectionCard
        title="Returns & Remittance"
        count={reg.returns?.length || 0}
        icon={<CalendarDaysIcon size={18} />}
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
          if (key === 'title') return <Typography sx={{ fontWeight: 500, fontSize: '0.875rem', color: 'primary.main' }}>{row.title}</Typography>;
          if (key === 'sectionReference') return row.sectionReference ? <Chip label={row.sectionReference} size="small" variant="outlined" sx={{ fontSize: '0.7rem', fontFamily: TL.mono }} /> : '—';
          if (key === 'frequency') return <Typography sx={{ fontSize: '0.875rem', whiteSpace: 'normal', color: TL.gray700 }}>{row.frequency || '—'}</Typography>;
          if (key === 'responsibleUnit') return <Typography sx={{ fontSize: '0.875rem', color: TL.gray700 }}>{row.responsibleUnit || '—'}</Typography>;
          if (key === 'responsiblePerson') return <Typography sx={{ fontSize: '0.875rem', color: TL.gray500 }}>{row.responsiblePerson || '—'}</Typography>;
          if (key === 'statutoryBasis') return <Typography sx={{ fontSize: '0.75rem', lineHeight: 1.4, color: TL.gray600 }}>{row.statutoryBasis || '—'}</Typography>;
          return row[key] ?? '—';
        }}
      />
    </Box>
  );
}