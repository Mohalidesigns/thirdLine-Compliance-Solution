import { useNavigate } from 'react-router-dom';
import { useQuery, useQueries } from '@tanstack/react-query';
import { Box, Card, CardContent, Chip, Tooltip, Typography } from '@mui/material';
import { RISK_COLOR } from 'shared';
import api from '../../../../services/api';
import FormattedText from '../../../../components/FormattedText';

/**
 * Shared building blocks for the intel admin detail pages (control / return / sanction).
 * Keeps one visual language across the three, and stays responsive so the same component
 * renders correctly both full-page and inside the 680px `EntityDrillDrawer`.
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

/** Responsive grid of Fields — collapses to one column on small screens / in the drawer. */
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

/**
 * Resolves an instrument id to its title (Option B — frontend resolution). Shows the title,
 * never the id. Instruments have no standalone route, so this is display-only.
 */
export function InstrumentRef({ id }) {
  const q = useQuery({
    queryKey: ['instrument', String(id)],
    queryFn: ({ signal }) => api.platform.instruments.get(id, signal),
    enabled: id != null,
    staleTime: 60_000,
  });
  if (id == null) return <Typography variant="body2" color="text.secondary">—</Typography>;
  return (
    <Typography variant="body2" sx={{ fontSize: '0.85rem', fontWeight: 500 }}>
      {q.data?.sourceTitle || (q.isLoading ? 'Loading…' : '—')}
    </Typography>
  );
}

/**
 * Resolves a list of obligation ids to their titles (Option B — frontend resolution) and
 * renders them as chips linking to the obligation detail. Ids are never shown as text: a
 * chip carries the id only as its navigation target.
 */
export function LinkedObligationChips({ ids }) {
  const navigate = useNavigate();
  const list = [...new Set((ids || []).filter((x) => x != null))];

  const results = useQueries({
    queries: list.map((id) => ({
      queryKey: ['obligation', String(id)],
      queryFn: ({ signal }) => api.platform.obligations.get(id, signal),
      staleTime: 60_000,
    })),
  });

  if (list.length === 0) {
    return <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>No linked obligations.</Typography>;
  }

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
      {list.map((id, i) => {
        const q = results[i];
        const label = q?.data?.title
          || q?.data?.plainEnglishStatement
          || (q?.isLoading ? 'Loading…' : 'Obligation');
        return (
          <Chip
            key={id}
            size="small"
            clickable
            label={label}
            disabled={q?.isLoading}
            onClick={() => navigate(`/admin/obligations/${id}`)}
            sx={{
              height: 'auto', py: 0.4, borderRadius: '4px', bgcolor: '#EDF2F7',
              '& .MuiChip-label': { display: 'block', whiteSpace: 'normal', maxWidth: 420, fontSize: '0.75rem', lineHeight: 1.35, py: 0.25 },
            }}
          />
        );
      })}
    </Box>
  );
}
