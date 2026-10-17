import { Box, Typography } from '@mui/material';

/** Formats a 0..100 metric, or "N/A" when it has no denominator (null). */
export function pctOrNa(value, digits = 1) {
  return value == null ? 'N/A' : `${Number(value).toFixed(digits)}%`;
}

/**
 * How the compliance score is calculated — rendered inside the score tooltip.
 * `breakdown` = metrics.scoreBreakdown: [{ key, label, definition, weight, value, included }].
 */
export default function ScoreBreakdown({ breakdown = [], score }) {
  const counted = breakdown.filter(c => c.included);
  const weightTotal = counted.reduce((s, c) => s + c.weight, 0);
  return (
    <Box sx={{ p: 0.5, maxWidth: 340 }}>
      <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, mb: 0.75 }}>
        Compliance score = weighted average of its components
      </Typography>
      {breakdown.map(c => (
        <Box key={c.key} sx={{ mb: 0.75, opacity: c.included ? 1 : 0.6 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
              {c.label} · weight {c.weight}
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700 }}>
              {c.value == null ? 'N/A — not counted' : pctOrNa(c.value)}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.6875rem', opacity: 0.8 }}>{c.definition}</Typography>
        </Box>
      ))}
      <Typography sx={{ fontSize: '0.6875rem', opacity: 0.8, mt: 1 }}>
        {counted.length > 0
          ? `Σ(value × weight) ÷ ${weightTotal} = ${pctOrNa(score)}. Components with no data are left out and the remaining weights re-normalised.`
          : 'No component has data yet.'}
      </Typography>
    </Box>
  );
}
