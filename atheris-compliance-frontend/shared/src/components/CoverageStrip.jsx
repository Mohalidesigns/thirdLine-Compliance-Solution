import { Box, Typography } from '@mui/material';
import { TL } from '../theme/tokens';
import { KpiCard } from './KpiCards';

/**
 * Row of Thirdline stat cards for a detail page. Each tile:
 *   { key, label, value, tone?, color?, icon?, caption? }
 * Tiles are clickable when `onTileClick` is provided (e.g. jump to the matching tab).
 * Laid out with flex so the tiles always split the full row width equally.
 */
export default function CoverageStrip({ items = [], onTileClick, title, sx }) {
  if (!items.length) return null;
  return (
    <Box sx={{ mb: 3, ...sx }}>
      {title && (
        <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color: TL.gray400, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
          {title}
        </Typography>
      )}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, width: '100%' }}>
        {items.map((it) => (
          <Box key={it.key} sx={{ flex: '1 1 0', minWidth: 160 }}>
            <KpiCard kpi={it} onSelect={onTileClick} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}
