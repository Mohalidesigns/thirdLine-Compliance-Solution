import { Box, Typography } from '@mui/material';
import { ExclamationTriangleIcon, ExclamationCircleIcon, TL } from 'shared';

/** Inline client-side lint hints under a field (server lint stays authoritative). */
export default function LintHints({ hints = [], sx }) {
  if (!hints.length) return null;
  return (
    <Box sx={{ mt: 0.5, display: 'flex', flexDirection: 'column', gap: 0.25, ...sx }}>
      {hints.map((h) => {
        const err = h.severity === 'ERROR';
        const Icon = err ? ExclamationCircleIcon : ExclamationTriangleIcon;
        return (
          <Box key={`${h.rule}-${h.message}`} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
            <Box sx={{ color: err ? TL.error : TL.warning, mt: '1px', flexShrink: 0 }}>
              <Icon size={14} />
            </Box>
            <Typography sx={{ fontSize: '0.75rem', color: err ? '#B91C1C' : '#92400E' }}>
              <b>{h.rule}</b> · {h.message}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
