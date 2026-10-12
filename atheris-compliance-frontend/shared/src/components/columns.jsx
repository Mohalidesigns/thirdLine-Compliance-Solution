import { Chip, Typography, Box } from '@mui/material';
import { friendlyPenaltyTypes } from './formatters';

/**
 * Per-entity register column definitions shared by the standalone registers and the
 * Act-detail tabs, so a section table shows the SAME columns everywhere.
 *
 * Each column: { id, label, minWidth, maxWidth?, truncate?, sortable, sortField?, render?(row) }.
 * `render` is called with the register DTO row; `sortField` is the backend sort property.
 *
 * Field contracts (the register DTOs must expose these names):
 *   obligation : title, plainEnglishStatement, regulatorAbbreviation, riskRating, hasPoints
 *   sanction   : description, penaltyType[], penaltyDetails, liableRoles[]
 *   return     : title, frequencyType, frequency, deadline, responsibleUnit, responsiblePerson
 *   control    : controlSummary, controlNumber, complianceArea, theme, riskLevel, status, actName
 *   instrument : sourceTitle, sourceReferenceNumber, riskRating, status  (+ regMap[regulatorId])
 */

const RISK_CHIP_COLOR = { Critical: 'error', High: 'error', Moderate: 'warning', Medium: 'warning', Low: 'success' };
const STATUS_CHIP_COLOR = {
  Published: 'success', Triage: 'warning', Superseded: 'default', Withdrawn: 'error',
  Current: 'success', Active: 'success', Outdated: 'warning',
  Open: 'warning', 'In Progress': 'info', 'In Remediation': 'info', Closed: 'success', Remediated: 'success',
};

export function riskChip(risk) {
  if (!risk) return <Chip size="small" label="Unrated" variant="outlined" sx={{ height: 22, borderRadius: '4px' }} />;
  return <Chip size="small" label={risk} color={RISK_CHIP_COLOR[risk] || 'default'} sx={{ height: 22, borderRadius: '4px', fontWeight: 600 }} />;
}

export function statusChip(status) {
  if (!status) return <Chip size="small" label="Unknown" variant="outlined" sx={{ height: 22, borderRadius: '4px' }} />;
  return <Chip size="small" label={status} color={STATUS_CHIP_COLOR[status] || 'default'} sx={{ height: 22, borderRadius: '4px', fontWeight: 600 }} />;
}

const ellipsis = (maxWidth) => ({
  maxWidth, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
});

export function obligationColumns() {
  return [
    { id: 'title', label: 'Obligation', minWidth: 320, maxWidth: 420, truncate: true, sortable: true, sortField: 'title',
      render: (r) => (
        <Typography variant="body2" sx={ellipsis(420)}>
          {r.title || r.plainEnglishStatement || 'Untitled obligation'}
        </Typography>
      ) },
    { id: 'regulatorAbbreviation', label: 'Regulator', minWidth: 120, sortable: true, sortField: 'regulator',
      render: (r) => (r.regulatorAbbreviation
        ? <Chip size="small" label={r.regulatorAbbreviation} sx={{ height: 22, borderRadius: '4px', fontWeight: 600 }} />
        : <Typography variant="body2" color="text.secondary">—</Typography>) },
    { id: 'riskRating', label: 'Risk', minWidth: 100, sortable: true, sortField: 'risk', render: (r) => riskChip(r.riskRating) },
    { id: 'hasPoints', label: 'Points', minWidth: 100, sortable: true, sortField: 'hasPoints',
      render: (r) => (r.hasPoints
        ? <Chip size="small" label="With" color="success" sx={{ height: 22, borderRadius: '4px' }} />
        : <Chip size="small" label="Without" sx={{ height: 22, borderRadius: '4px' }} />) },
  ];
}

export function sanctionColumns() {
  return [
    { id: 'description', label: 'Obligation', minWidth: 340, maxWidth: 380, truncate: true, sortable: true, sortField: 'description',
      render: (r) => <Typography variant="body2" sx={ellipsis(380)}>{r.description || '—'}</Typography> },
    { id: 'penaltyType', label: 'Penalty Type', minWidth: 170, sortable: true, sortField: 'penaltyType',
      render: (r) => <Typography variant="body2" color="text.secondary" sx={ellipsis(180)}>{friendlyPenaltyTypes(r.penaltyType)}</Typography> },
    { id: 'penaltyDetails', label: 'Penalty', minWidth: 280, maxWidth: 300, truncate: true, sortable: true, sortField: 'penaltyDetails',
      render: (r) => <Typography variant="body2" sx={ellipsis(300)}>{r.penaltyDetails || '—'}</Typography> },
    { id: 'liableRoles', label: 'Responsible Party', minWidth: 190, sortable: true, sortField: 'liableRole',
      render: (r) => <Typography variant="body2" color="text.secondary" sx={ellipsis(220)}>{r.liableRoles?.length ? r.liableRoles.join(', ') : '—'}</Typography> },
  ];
}

export function returnColumns() {
  return [
    { id: 'title', label: 'Return', minWidth: 320, maxWidth: 360, truncate: true, sortable: true, sortField: 'title',
      render: (r) => <Typography variant="body2" sx={ellipsis(360)}>{r.title || '—'}</Typography> },
    { id: 'frequencyType', label: 'Frequency', minWidth: 190, sortable: true, sortField: 'frequencyType',
      render: (r) => <Typography variant="body2">{r.frequencyType || r.frequency || '—'}</Typography> },
    { id: 'deadline', label: 'Deadline', minWidth: 200, maxWidth: 260, truncate: true, sortable: true, sortField: 'deadline',
      render: (r) => <Typography variant="body2" sx={ellipsis(260)}>{r.deadline || '—'}</Typography> },
    { id: 'responsibleUnit', label: 'Responsible', minWidth: 200, sortable: true, sortField: 'responsibleUnit',
      render: (r) => (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <Typography variant="body2" sx={ellipsis(220)}>{r.responsibleUnit || 'Unassigned'}</Typography>
          {r.responsiblePerson && <Typography variant="caption" color="text.secondary" sx={ellipsis(220)}>{r.responsiblePerson}</Typography>}
        </Box>
      ) },
  ];
}

export function controlColumns({ withAct = true } = {}) {
  const cols = [
    { id: 'controlNumber', label: 'Control', minWidth: 320, maxWidth: 340, truncate: true, sortable: true, sortField: 'controlNumber',
      render: (r) => <Typography variant="body2" sx={ellipsis(340)}>{r.controlSummary || r.controlNumber || '—'}</Typography> },
    { id: 'theme', label: 'Theme / Area', minWidth: 220, maxWidth: 240, truncate: true, sortable: true, sortField: 'theme',
      render: (r) => <Typography variant="body2" color="text.secondary" sx={ellipsis(240)}>{r.complianceArea || r.theme || '—'}</Typography> },
    { id: 'riskLevel', label: 'Risk', minWidth: 110, sortable: true, sortField: 'riskLevel',
      render: (r) => <Typography variant="body2">{r.riskLevel || r.residualRiskRating || '—'}</Typography> },
    { id: 'status', label: 'Status', minWidth: 110, sortable: true, sortField: 'status',
      render: (r) => <Typography variant="body2">{r.status || 'Open'}</Typography> },
  ];
  if (withAct) {
    cols.push({ id: 'actName', label: 'Act', minWidth: 220, maxWidth: 240, truncate: true, sortable: true, sortField: 'actName',
      render: (r) => <Typography variant="body2" color="text.secondary" sx={ellipsis(240)}>{r.actName || '—'}</Typography> });
  }
  return cols;
}

/**
 * Instruments register. The intel register has no regulator name/abbreviation on the row,
 * so callers may pass a `regMap` (regulatorId -> abbreviation/name) to resolve it client-side.
 */
export function instrumentColumns({ regMap } = {}) {
  const regOf = (r) => (regMap && regMap[r.regulatorId]) || r.regulatorName || r.regulatorAbbreviation || '—';
  return [
    { id: 'sourceTitle', label: 'Title', minWidth: 300, maxWidth: 320, truncate: true, sortable: true, sortField: 'sourceTitle',
      render: (r) => <Typography variant="body2" sx={ellipsis(320)}>{r.sourceTitle || '—'}</Typography> },
    { id: 'sourceReferenceNumber', label: 'Reference No', minWidth: 150, sortable: true, sortField: 'sourceReferenceNumber',
      render: (r) => <Typography variant="body2" sx={{ ...ellipsis(160), fontFamily: 'monospace', fontSize: '0.72rem' }}>{r.sourceReferenceNumber || '—'}</Typography> },
    { id: 'regulator', label: 'Regulator', minWidth: 120, sortable: !!regMap,
      render: (r) => <Typography variant="body2" sx={ellipsis(140)}>{regOf(r)}</Typography> },
    { id: 'riskRating', label: 'Risk', minWidth: 100, sortable: true, sortField: 'riskRating', render: (r) => riskChip(r.riskRating) },
    { id: 'status', label: 'Status', minWidth: 110, sortable: true, sortField: 'status', render: (r) => statusChip(r.status) },
  ];
}