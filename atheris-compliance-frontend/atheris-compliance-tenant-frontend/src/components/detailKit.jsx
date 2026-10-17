import { Box, Chip, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { TL, RiskBadge } from 'shared';
import FormattedText from './FormattedText';

/**
 * Shared building blocks for the tenant detail pages (control / return / sanction /
 * obligation), in the Thirdline look. Pure presentational — no api/react-query resolvers,
 * because tenant DTOs already carry resolved titles. Stays responsive so the same kit
 * renders full-page and inside drawers.
 */

/** Thirdline card surface: white, 12px radius, gray-100 hairline, shadow-sm. */
export const CARD_SX = {
  bgcolor: '#FFFFFF', border: `1px solid ${TL.gray100}`, borderRadius: '12px', boxShadow: TL.cardShadow,
};

const LABEL_SX = {
  display: 'block', fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.05em', fontSize: '0.625rem', lineHeight: '0.9375rem', color: TL.gray400,
};

/** Titled card with an optional leading icon, subtitle and header action. */
export function Section({ icon, title, subtitle, action, children, sx, contentSx }) {
  return (
    <Box sx={{ ...CARD_SX, overflow: 'hidden', mb: 3, ...sx }}>
      <Box sx={{ px: 3, py: 2, borderBottom: `1px solid ${TL.gray100}`, display: 'flex', alignItems: 'center', gap: 1.25 }}>
        {icon && (
          <Box sx={{ color: TL.gray400, display: 'flex', flexShrink: 0, '& svg': { width: 18, height: 18, fontSize: 18 } }}>
            {icon}
          </Box>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, lineHeight: '1.25rem', color: TL.gray800 }}>{title}</Typography>
          {subtitle && <Typography sx={{ fontSize: '0.75rem', color: TL.gray500, mt: 0.25 }}>{subtitle}</Typography>}
        </Box>
        {action}
      </Box>
      <Box sx={{ p: 3, ...contentSx }}>{children}</Box>
    </Box>
  );
}

/** A single labelled value (10px uppercase gray label + 14px value). Pass `children` for custom render. */
export function Field({ label, value, mono, children }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography component="span" sx={LABEL_SX}>{label}</Typography>
      <Box sx={{ mt: 0.5 }}>
        {children || (
          <Typography sx={{
            fontSize: mono ? '0.75rem' : '0.875rem', lineHeight: '1.25rem', color: mono ? TL.gray500 : TL.gray700,
            wordBreak: 'break-word', fontFamily: mono ? TL.mono : undefined,
          }}>
            {value || '—'}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

/** Responsive grid of Fields — collapses to one column on small screens. */
export function FieldGrid({ children, min = 170, gap = 2.5 }) {
  return (
    <Box sx={{
      display: 'grid', gap,
      gridTemplateColumns: { xs: '1fr', sm: `repeat(auto-fit, minmax(${min}px, 1fr))` },
    }}>
      {children}
    </Box>
  );
}

/** Stat tile in the Thirdline stat-card look: uppercase label, tinted icon tile, bold value (or a custom `chip`). */
export function StatTile({ icon, label, value, accent = TL.primary, chip }) {
  const isNumber = typeof value === 'number';
  return (
    <Box sx={{ ...CARD_SX, p: '20px', height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
        <Typography noWrap sx={{
          fontSize: '0.75rem', fontWeight: 500, color: TL.gray500, textTransform: 'uppercase',
          letterSpacing: '0.025em', lineHeight: '1rem', minWidth: 0,
        }}>
          {label}
        </Typography>
        {icon && (
          <Box sx={{
            width: 32, height: 32, borderRadius: '8px', bgcolor: alpha(accent, 0.08), color: accent, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            '& svg': { width: 16, height: 16, fontSize: 16 },
          }}>
            {icon}
          </Box>
        )}
      </Box>
      {chip || (
        <Typography sx={{
          fontSize: isNumber ? '1.5rem' : '1rem', fontWeight: 700, lineHeight: isNumber ? '2rem' : '1.5rem',
          color: TL.textPrimary, wordBreak: 'break-word',
        }}>
          {value || '—'}
        </Typography>
      )}
    </Box>
  );
}

/** Risk badge (dot pill), optionally with a `likelihood × impact` tooltip. `size` kept for compatibility. */
export function RiskChip({ rating, likelihood, impact }) {
  if (!rating) return <RiskBadge value={null} />;
  const badge = <RiskBadge value={rating} />;
  if (!likelihood && !impact) return badge;
  return <Tooltip arrow title={`${likelihood || '—'} × ${impact || '—'}`}><span>{badge}</span></Tooltip>;
}

/** A single-line mono chip (section refs, codes). */
export function MonoChip({ label }) {
  if (!label) return null;
  return (
    <Chip size="small" variant="outlined" label={label}
      sx={{ fontFamily: TL.mono, fontSize: '0.7rem', color: TL.gray500 }} />
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
        <Typography sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: '0.875rem', color: TL.gray700 }}>{text}</Typography>
      ) : (
        <Typography sx={{ fontStyle: 'italic', fontSize: '0.875rem', color: TL.gray400 }}>Not recorded.</Typography>
      )}
    </Section>
  );
}
