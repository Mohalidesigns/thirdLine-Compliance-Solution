import { Card, CardContent, Box, Typography } from '@mui/material';

/**
 * Bordered card shell shared across register/detail pages.
 * Optional header (title/subtitle + trailing `actions` node) with a ruled divider.
 */
export default function DataCard({
  title, subtitle, actions, children,
  sx, contentSx, noPadding = false,
}) {
  const hasHeader = title || subtitle || actions;
  return (
    <Card
      variant="outlined"
      sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', ...sx }}
    >
      {hasHeader && (
        <Box sx={{
          p: 2, display: 'flex', alignItems: 'center', gap: 1.5,
          borderBottom: '1px solid #EDF2F7',
        }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {title && <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{title}</Typography>}
            {subtitle && (
              <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
            )}
          </Box>
          {actions}
        </Box>
      )}
      {noPadding
        ? children
        : <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 }, ...contentSx }}>{children}</CardContent>}
    </Card>
  );
}
