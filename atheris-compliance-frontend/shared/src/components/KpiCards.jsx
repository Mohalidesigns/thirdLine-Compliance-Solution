import { useState } from 'react';
import { Box, Card, CardContent, IconButton, Menu, MenuItem, Typography } from '@mui/material';
import { ArrowDropDown } from '@mui/icons-material';

/**
 * Register KPI cards (shared by every register/explorer page in BOTH apps).
 *
 * `items` = [{ key, label, value, color, icon, breakdown }]
 *  - `breakdown` is a { label: count } map; when it has entries a dropdown chevron is shown.
 *  - clicking the card fires `onSelect(key)` (whole-card filter).
 *  - picking a breakdown entry fires `onDrill(key, label)` (drill into that bucket).
 *
 * Numeric breakdowns are sorted high→low; non-numeric (e.g. formatted naira) keep insertion order.
 */

function sortEntries(breakdown) {
  const entries = Object.entries(breakdown || {});
  const allNumeric = entries.length > 0 && entries.every(([, v]) => typeof v === 'number');
  return allNumeric ? [...entries].sort((a, b) => b[1] - a[1]) : entries;
}

export function KpiCard({ kpi, onSelect, onDrill }) {
  const [anchor, setAnchor] = useState(null);
  const entries = sortEntries(kpi.breakdown);
  const color = kpi.color || '#2B6CB0';

  return (
    <Card
      variant="outlined"
      onClick={() => onSelect && onSelect(kpi.key)}
      sx={{
        cursor: onSelect ? 'pointer' : 'default',
        borderLeft: `4px solid ${color}`,
        '&:hover': { boxShadow: 1 },
        height: '100%',
      }}
    >
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
            {kpi.icon && <Box sx={{ color, opacity: 0.6, display: 'flex', flexShrink: 0 }}>{kpi.icon}</Box>}
            <Typography variant="caption" color="text.secondary" noWrap sx={{ fontWeight: 600 }}>
              {kpi.label}
            </Typography>
          </Box>
          {entries.length > 0 && onDrill && (
            <IconButton
              size="small"
              aria-label={`${kpi.label} breakdown`}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setAnchor(e.currentTarget); }}
            >
              <ArrowDropDown fontSize="small" />
            </IconButton>
          )}
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 700, color, lineHeight: 1.3 }}>
          {kpi.value}
        </Typography>
        <Menu
          anchorEl={anchor}
          open={!!anchor}
          onClose={() => setAnchor(null)}
          onClick={(e) => e.stopPropagation()}
        >
          {entries.map(([label, count]) => (
            <MenuItem
              key={label}
              dense
              onClick={() => { setAnchor(null); if (onDrill) onDrill(kpi.key, label); }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 3, width: '100%' }}>
                <span>{label}</span>
                <span style={{ color: '#718096' }}>{count}</span>
              </Box>
            </MenuItem>
          ))}
        </Menu>
      </CardContent>
    </Card>
  );
}

export default function KpiCards({ items = [], onSelect, onDrill, sx }) {
  if (!items.length) return null;
  const cols = Math.min(items.length, 5);
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        mb: 2,
        gridTemplateColumns: {
          xs: 'repeat(2, 1fr)',
          sm: `repeat(${Math.min(cols, 3)}, 1fr)`,
          md: `repeat(${cols}, 1fr)`,
        },
        ...sx,
      }}
    >
      {items.map((k) => <KpiCard key={k.key} kpi={k} onSelect={onSelect} onDrill={onDrill} />)}
    </Box>
  );
}
