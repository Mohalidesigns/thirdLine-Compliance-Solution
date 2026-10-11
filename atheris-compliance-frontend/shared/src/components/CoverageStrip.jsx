import { Box, Card, CardContent, Typography, Tooltip } from '@mui/material';

/**
 * Row of compact stat tiles for a detail page. Each tile:
 *   { key, label, value, color, icon? }
 * Tiles are clickable when `onTileClick` is provided (e.g. jump to the matching tab).
 * Laid out with flex so the tiles always split the full row width equally.
 */
export default function CoverageStrip({ items = [], onTileClick, title, sx }) {
  if (!items.length) return null;
  return (
    <Card variant="outlined" sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', ...sx }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        {title && (
          <Typography variant="caption" color="text.secondary"
            sx={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.65rem', fontWeight: 700 }}>
            {title}
          </Typography>
        )}
        <Box sx={{
          display: 'flex', flexWrap: 'wrap', gap: 1.5,
          mt: title ? 1 : 0, width: '100%',
        }}>
          {items.map((it) => (
            <Tooltip key={it.key} title={onTileClick ? `View ${it.label}` : ''} placement="top">
              <Box
                onClick={onTileClick ? () => onTileClick(it.key) : undefined}
                sx={{
                  flex: '1 1 0', minWidth: 140,
                  textAlign: 'center', py: 2.5, px: 1, borderRadius: 2, bgcolor: '#F7FAFC',
                  border: '1px solid #E2E8F0', minHeight: 104,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  cursor: onTileClick ? 'pointer' : 'default',
                  transition: 'background-color .15s, border-color .15s, transform .15s',
                  '&:hover': onTileClick
                    ? { bgcolor: '#EDF2F7', borderColor: it.color, transform: 'translateY(-2px)' }
                    : undefined,
                }}
              >
                {it.icon && <Box sx={{ color: it.color, opacity: 0.65, mb: 0.5 }}>{it.icon}</Box>}
                <Typography sx={{ fontWeight: 800, color: it.color, lineHeight: 1.1, fontSize: '2rem' }}>
                  {it.value}
                </Typography>
                <Typography color="text.secondary" sx={{ fontSize: '0.8rem', fontWeight: 600, mt: 0.5 }}>
                  {it.label}
                </Typography>
              </Box>
            </Tooltip>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}
