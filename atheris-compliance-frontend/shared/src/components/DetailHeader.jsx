import { Box, Button, Chip, Typography } from '@mui/material';

/**
 * Detail page header: a back action + title row with an optional status chip,
 * a meta line (e.g. regulator link), an optional description and a `right` slot.
 * Icons are passed in as ReactNodes so the shared package stays icon-agnostic.
 */
export default function DetailHeader({
  onBack, backLabel = 'Back', backIcon,
  title, status, statusColor, meta, description, right, sx,
}) {
  return (
    <Box sx={{ mb: 2.5, ...sx }}>
      {onBack && (
        <Button onClick={onBack} startIcon={backIcon} sx={{ mb: 1.5, textTransform: 'none' }}>
          {backLabel}
        </Button>
      )}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{title}</Typography>
            {status && (
              <Chip
                label={status}
                size="small"
                sx={{
                  fontWeight: 700, fontSize: '0.65rem', borderRadius: 1,
                  bgcolor: `${statusColor || '#2C7A7B'}18`, color: statusColor || '#2C7A7B',
                }}
              />
            )}
          </Box>
          {meta && <Box sx={{ mt: 0.5 }}>{meta}</Box>}
          {description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontSize: '0.82rem' }}>
              {description}
            </Typography>
          )}
        </Box>
        {right}
      </Box>
    </Box>
  );
}
