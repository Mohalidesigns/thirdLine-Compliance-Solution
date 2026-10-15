import { useNavigate } from 'react-router-dom';
import { useQuery, useQueries } from '@tanstack/react-query';
import { Box, Chip, Tooltip, Typography } from '@mui/material';
import { TL, tone, RiskBadge } from 'shared';
import api from '../../../../services/api';
import FormattedText from '../../../../components/FormattedText';

/**
 * Shared building blocks for the intel admin detail pages (control / return / sanction),
 * in the Thirdline style. Stays responsive so the same component renders correctly both
 * full-page and inside the 680px `EntityDrillDrawer`.
 */

/** Thirdline card surface (white, 12px radius, gray-100 hairline, shadow-sm). */
export const CARD_SX = {
  bgcolor: '#FFFFFF', border: `1px solid ${TL.gray100}`, borderRadius: '12px', boxShadow: TL.cardShadow,
};

const LABEL_SX = {
  display: 'block', fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.05em', fontSize: '0.625rem', lineHeight: '1rem', color: TL.gray400,
};

/** Titled DataCard-style panel with an optional leading icon, subtitle and header action. */
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
            fontSize: mono ? '0.75rem' : '0.875rem', lineHeight: '1.25rem', wordBreak: 'break-word',
            color: mono ? TL.gray500 : TL.gray700,
            fontFamily: mono ? TL.mono : undefined,
          }}>
            {value || '—'}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

/** Responsive grid of Fields — collapses to one column on small screens / in the drawer. */
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

const ACCENT_TONE = {
  '#2b6cb0': 'blue', '#1a365d': 'blue', '#c53030': 'red', '#e53e3e': 'red', '#dd6b20': 'orange',
  '#d69e2e': 'amber', '#2d7d46': 'green', '#38a169': 'green', '#2f855a': 'green', '#319795': 'teal',
  '#805ad5': 'purple', '#718096': 'gray', '#4a5568': 'gray',
};

/**
 * Thirdline stat card: uppercase 12px gray label, a 32px tinted icon tile top-right and a
 * bold value (or a custom `chip`). `accent` may be a tone name or a legacy hex.
 */
export function StatTile({ icon, label, value, accent = 'blue', chip }) {
  const toneName = ACCENT_TONE[String(accent).toLowerCase()] || accent;
  const t = tone(toneName);
  const iconColor = toneName === 'blue' ? TL.primary : t.dot;
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
            width: 32, height: 32, borderRadius: '8px', bgcolor: t.tile, color: iconColor, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            '& svg': { width: 16, height: 16, fontSize: 16 },
          }}>
            {icon}
          </Box>
        )}
      </Box>
      {chip || (
        <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, lineHeight: '1.75rem', color: toneName === 'blue' ? TL.primary : t.value }}>
          {value || '—'}
        </Typography>
      )}
    </Box>
  );
}

/** Risk badge (Thirdline dot pill), optionally with a `likelihood × impact` tooltip. */
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
      sx={{ fontFamily: TL.mono, fontSize: '0.7rem' }} />
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
    <Typography sx={{ fontSize: '0.875rem', color: TL.gray700 }}>
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
              height: 'auto', py: 0.4, color: TL.primary,
              '& .MuiChip-label': { display: 'block', whiteSpace: 'normal', maxWidth: 420, fontSize: '0.75rem', lineHeight: 1.35, py: 0.25 },
            }}
          />
        );
      })}
    </Box>
  );
}
