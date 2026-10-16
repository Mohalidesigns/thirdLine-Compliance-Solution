import { Chip } from '@mui/material';
import { StatusBadge, RiskBadge, TL } from 'shared';
import {
  RUNBOOK_STATUS_COLOR, EXECUTION_STATUS_COLOR, humanize,
} from '../../pages/runbooks/runbookConstants';

// Small presentational helpers shared by the runbook Library and Detail pages.

const MUI_TO_TONE = {
  success: 'green', warning: 'orange', error: 'red', info: 'blue', primary: 'blue', default: 'gray',
};

export const toneFor = (muiColor) => MUI_TO_TONE[muiColor] || 'gray';

/** Runbook / version status pill (DRAFT, IN_REVIEW, PUBLISHED, SUPERSEDED…). */
export function RunbookStatusBadge({ status, sx }) {
  if (!status) return <StatusBadge label="—" tone="gray" sx={sx} />;
  return <StatusBadge label={humanize(status)} tone={toneFor(RUNBOOK_STATUS_COLOR[status])} sx={sx} />;
}

/** Criticality as a risk badge (dot pill). */
export function CriticalityBadge({ value, sx }) {
  return <RiskBadge value={value ? humanize(value) : null} emptyLabel="—" sx={sx} />;
}

/** Execution status pill. */
export function ExecStatusBadge({ status, sx }) {
  if (!status) return <StatusBadge label="—" tone="gray" sx={sx} />;
  return <StatusBadge label={humanize(status)} tone={toneFor(EXECUTION_STATUS_COLOR[status])} sx={sx} />;
}

/** Mono outlined chip for runbook codes, clause refs and step codes. */
export function CodeChip({ label, sx }) {
  if (!label) return null;
  return (
    <Chip size="small" variant="outlined" label={label}
      sx={{ fontFamily: TL.mono, fontSize: '0.7rem', height: 22, borderRadius: '4px', color: TL.gray600, ...sx }} />
  );
}

export function formatDateTime(d) {
  if (!d) return '—';
  // A bare LocalDate (e.g. a schedule's next run) has no time — don't render UTC midnight as a local time.
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(d))) {
    const [y, m, day] = String(d).split('-').map(Number);
    return new Date(y, m - 1, day).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/** Normalises an error thrown by api.js into a display string. */
export const errMsg = (e, fallback = 'Something went wrong.') => e?.message || fallback;
