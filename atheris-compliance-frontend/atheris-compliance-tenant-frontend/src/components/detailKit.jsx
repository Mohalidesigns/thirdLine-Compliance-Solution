import { Box, Card, CardContent, Chip, Tooltip, Typography } from '@mui/material';
import { RISK_COLOR } from 'shared';
import FormattedText from './FormattedText';

/**
 * Shared building blocks for the tenant detail pages (control / return / sanction /
 * obligation). Pure presentational — no api/react-query resolvers, because tenant DTOs
 * already carry resolved titles. Stays responsive so the same kit renders full-page.
 */

export const CARD_SX = { borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' };

const LABEL_SX = {
  display: 'block', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: 1, fontSize: '0.62rem', color: 'text.secondary',
};

/** Titled card with an optional leading icon, subtitle and header action. */
export function Section({ icon, title, subtitle, action, children, sx, contentSx }) {
  return (
    <Card sx={{ ...CARD_SX, mb: 2.5, ...sx }}>
      <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', gap: 1 }}>
        {icon && <Box sx={{ color: '#2B6CB0', display: 'flex', flexShrink: 0 }}>{icon}</Box>}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{title}</Typography>
          {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
        </Box>
        {action}
      </Box>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 }, ...contentSx }}>{children}</CardContent>
    </Card>
  );
}

/** A single labelled value (upper-case micro label + value). Pass `children` for custom render. */
export function Field({ label, value, mono, children }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography component="span" sx={LABEL_SX}>{label}</Typography>
      <Box sx={{ mt: 0.35 }}>
        {children || (
          <Typography variant="body2" sx={{
            fontSize: '0.85rem', fontWeight: 500, wordBreak: 'break-word',
            fontFamily: mono ? 'Roboto Mono, monospace' : undefined,
          }}>
            {value || '—'}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

/** Responsive grid of Fields — collapses to one column on small screens. */
export function FieldGrid({ children, min = 170, gap = 2 }) {
  return (
    <Box sx={{
      display: 'grid', gap,
      gridTemplateColumns: { xs: '1fr', sm: `repeat(auto-fit, minmax(${min}px, 1fr))` },
    }}>
      {children}
    </Box>
  );
}

/** Compact KPI tile: icon + label + a value or a custom `chip`. */
export function StatTile({ icon, label, value, accent = '#2B6CB0', chip }) {
  return (
    <Card sx={{ ...CARD_SX, height: '100%' }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
          {icon && <Box sx={{ color: accent, display: 'flex', flexShrink: 0 }}>{icon}</Box>}
          <Typography component="span" sx={LABEL_SX}>{label}</Typography>
        </Box>
        {chip || (
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', color: accent, lineHeight: 1.3 }}>
            {value || '—'}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

/** A soft risk chip, optionally with a `likelihood × impact` tooltip. */
export function RiskChip({ rating, likelihood, impact, size = 'small' }) {
  if (!rating) {
    return <Chip size={size} label="Unrated" variant="outlined" sx={{ height: 22, borderRadius: '4px', fontSize: '0.7rem' }} />;
  }
  const color = RISK_COLOR[rating] || '#718096';
  const chip = (
    <Chip size={size} label={rating}
      sx={{ height: 22, borderRadius: '4px', fontWeight: 700, fontSize: '0.7rem', bgcolor: `${color}18`, color }} />
  );
  if (!likelihood && !impact) return chip;
  return <Tooltip arrow title={`${likelihood || '—'} × ${impact || '—'}`}><span>{chip}</span></Tooltip>;
}

/** A single-line mono chip (section refs, codes). */
export function MonoChip({ label }) {
  if (!label) return null;
  return (
    <Chip size="small" variant="outlined" label={label}
      sx={{ height: 22, borderRadius: '4px', fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem' }} />
  );
}

/** Titled long-text card: renders the points list when present, else pre-wrapped prose. */
export function LongTextBlock({ icon, title, text, points, pointType }) {
  const hasPoints = Array.isArray(points) && points.length > 0;
  return (
    <Section icon={icon} title={title}>
      {hasPoints ? (
        <FormattedText points={points} pointType={pointType} />
      ) : text ? (
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: '0.85rem' }}>{text}</Typography>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>Not recorded.</Typography>
      )}
    </Section>
  );
}