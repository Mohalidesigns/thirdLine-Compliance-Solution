import { useState } from 'react';
import { Box, IconButton, Menu, MenuItem, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { TL, TONES, tone as toneOf } from '../theme/tokens';
import {
  ChevronDownIcon, DocumentTextIcon, ExclamationTriangleIcon, ClockIcon, CheckCircleIcon,
  InformationCircleIcon, ChartBarIcon, ListBulletIcon,
} from '../icons/heroicons';

/**
 * Register KPI cards (shared by every register/explorer/dashboard page in BOTH apps),
 * rendered as Thirdline `.stat-card`s: uppercase gray label, a 32px tinted icon tile,
 * and a 24px bold value — plus the Atheris breakdown dropdown.
 *
 * `items` = [{ key, label, value, tone?, color?, icon?, caption?, breakdown?, active? }]
 *  - `tone` — 'blue'|'red'|'orange'|'amber'|'yellow'|'green'|'teal'|'purple'|'gray' (or an
 *    alias: primary/danger/warning/success/info). Preferred over `color`.
 *  - `color` — legacy hex; mapped to a matching tone when known, else tinted directly.
 *  - `icon` — a heroicon element (any node; svgs inside are sized to 16px).
 *  - `caption` — small gray line under the value (e.g. "8 critical, 12 high").
 *  - `breakdown` — { label: count }; when it has entries a chevron dropdown is shown.
 *  - clicking the card fires `onSelect(key)`; picking a breakdown entry fires `onDrill(key, label)`.
 *
 * Numeric breakdowns are sorted high→low; non-numeric (e.g. formatted naira) keep insertion order.
 */

const HEX_TONE = {
  '#1a365d': 'blue', '#2b6cb0': 'blue', '#3182ce': 'blue', '#2a4a7f': 'blue', '#4299e1': 'blue',
  '#c53030': 'red', '#e53e3e': 'red', '#9b2c2c': 'red', '#f56565': 'red',
  '#dd6b20': 'orange', '#ed8936': 'orange', '#c05621': 'orange',
  '#d69e2e': 'amber', '#d4af37': 'amber', '#b7791f': 'amber', '#ecc94b': 'yellow',
  '#2d7d46': 'green', '#38a169': 'green', '#2f855a': 'green', '#48bb78': 'green', '#276749': 'green',
  '#319795': 'teal', '#2c7a7b': 'teal', '#38b2ac': 'teal', '#285e61': 'teal',
  '#805ad5': 'purple', '#6b46c1': 'purple', '#9f7aea': 'purple',
  '#718096': 'gray', '#4a5568': 'gray', '#a0aec0': 'gray', '#2d3748': 'gray',
};

const DEFAULT_ICON = {
  blue: DocumentTextIcon, red: ExclamationTriangleIcon, orange: ClockIcon, amber: ClockIcon,
  yellow: ClockIcon, green: CheckCircleIcon, teal: InformationCircleIcon, purple: ChartBarIcon,
  gray: ListBulletIcon,
};

function resolveTone(kpi) {
  let name = kpi.tone;
  if (!name && kpi.color) name = HEX_TONE[String(kpi.color).toLowerCase()];
  if (name || !kpi.color) {
    const key = TONES[name] ? name : ({ primary: 'blue', danger: 'red', error: 'red', warning: 'orange', success: 'green', info: 'teal', neutral: 'gray' }[name] || 'blue');
    const t = toneOf(key);
    return { key, tile: t.tile, icon: key === 'blue' ? TL.primary : t.dot, value: t.value };
  }
  // Unknown legacy hex — tint with it directly.
  return { key: 'blue', tile: alpha(kpi.color, 0.08), icon: kpi.color, value: kpi.color };
}

function sortEntries(breakdown) {
  const entries = Object.entries(breakdown || {});
  const allNumeric = entries.length > 0 && entries.every(([, v]) => typeof v === 'number');
  return allNumeric ? [...entries].sort((a, b) => b[1] - a[1]) : entries;
}

export function KpiCard({ kpi, onSelect, onDrill }) {
  const [anchor, setAnchor] = useState(null);
  const entries = sortEntries(kpi.breakdown);
  const t = resolveTone(kpi);
  const Fallback = DEFAULT_ICON[t.key] || DocumentTextIcon;
  const clickable = !!onSelect;

  return (
    <Box
      onClick={clickable ? () => onSelect(kpi.key) : undefined}
      sx={{
        bgcolor: '#FFFFFF', border: `1px solid ${TL.gray100}`, borderRadius: '12px',
        boxShadow: kpi.active ? `0 0 0 2px ${alpha(TL.primary, 0.18)}` : TL.cardShadow,
        p: '20px', height: '100%', minWidth: 0, cursor: clickable ? 'pointer' : 'default',
        transition: 'box-shadow .15s, border-color .15s',
        '&:hover': clickable ? { borderColor: TL.gray200, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05)' } : undefined,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
        <Typography
          noWrap
          sx={{ fontSize: '0.75rem', fontWeight: 500, color: TL.gray500, textTransform: 'uppercase', letterSpacing: '0.025em', lineHeight: '1rem', minWidth: 0 }}
        >
          {kpi.label}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
          {entries.length > 0 && onDrill && (
            <IconButton
              size="small"
              aria-label={`${kpi.label} breakdown`}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setAnchor(e.currentTarget); }}
              sx={{ p: 0.5 }}
            >
              <ChevronDownIcon size={16} />
            </IconButton>
          )}
          <Box sx={{
            width: 32, height: 32, borderRadius: '8px', bgcolor: t.tile, color: t.icon,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            '& svg': { width: 16, height: 16, fontSize: 16 },
          }}>
            {kpi.icon || <Fallback size={16} />}
          </Box>
        </Box>
      </Box>
      <Typography
        title={typeof kpi.value === 'string' || typeof kpi.value === 'number' ? String(kpi.value) : undefined}
        sx={{ fontSize: String(kpi.value ?? '').length > 11 ? '1.125rem' : '1.5rem', fontWeight: 700, lineHeight: '2rem', color: t.value, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {kpi.value}
      </Typography>
      {kpi.caption && (
        <Typography sx={{ mt: 0.5, fontSize: '0.8125rem', color: TL.gray500, lineHeight: '1.25rem' }} noWrap>
          {kpi.caption}
        </Typography>
      )}
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
              <span style={{ color: TL.gray500, fontWeight: 600 }}>{count}</span>
            </Box>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}

export default function KpiCards({ items = [], onSelect, onDrill, columns, sx }) {
  if (!items.length) return null;
  const cols = columns || Math.min(items.length, 5);
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 3,
        mb: 3,
        gridTemplateColumns: {
          xs: 'repeat(1, 1fr)',
          sm: `repeat(${Math.min(cols, 2)}, minmax(0, 1fr))`,
          lg: `repeat(${cols}, minmax(0, 1fr))`,
        },
        ...sx,
      }}
    >
      {items.map((k) => <KpiCard key={k.key} kpi={k} onSelect={onSelect} onDrill={onDrill} />)}
    </Box>
  );
}
