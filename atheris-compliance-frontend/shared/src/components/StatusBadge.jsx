import { Box } from '@mui/material';
import { tone as toneOf, riskTone, statusTone } from '../theme/tokens';

/**
 * Thirdline `.badge` — a rounded-full pill (12px/600, 2px 10px padding) on a *-100 tint,
 * optionally led by a 6px dot (risk badges carry the dot, status badges do not).
 *
 * Props: label (node), tone ('red'|'orange'|'yellow'|'green'|'blue'|'teal'|'purple'|'gray'
 * or a semantic alias like 'danger'/'success'), dot (bool), title (native tooltip), sx.
 */
export default function StatusBadge({ label, tone = 'gray', dot = false, title, sx }) {
  const t = toneOf(tone);
  return (
    <Box
      component="span"
      title={title}
      sx={{
        display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap',
        px: '10px', py: '2px', borderRadius: 9999,
        fontSize: '0.75rem', fontWeight: 600, lineHeight: '1rem',
        bgcolor: t.bg, color: t.fg,
        ...sx,
      }}
    >
      {dot && (
        <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: t.dot, mr: '6px', flexShrink: 0 }} />
      )}
      {label}
    </Box>
  );
}

/** Risk badge with a dot: Critical red · High orange · Moderate/Medium yellow · Low green. */
export function RiskBadge({ value, emptyLabel = 'Unrated', title, sx }) {
  if (!value) return <StatusBadge label={emptyLabel} tone="gray" title={title} sx={sx} />;
  return <StatusBadge label={value} tone={riskTone(value)} dot title={title} sx={sx} />;
}

/** Status badge (no dot), coloured by the shared status vocabulary. */
export function StateBadge({ value, label, emptyLabel = 'Unknown', title, sx }) {
  if (!value) return <StatusBadge label={emptyLabel} tone="gray" title={title} sx={sx} />;
  return <StatusBadge label={label || value} tone={statusTone(value)} title={title} sx={sx} />;
}
