import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  Box, Typography, ToggleButton, ToggleButtonGroup, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import {
  DataCard, StatusBadge, RiskBadge, TL, Squares2x2Icon, ListBulletIcon,
} from 'shared';
import { api } from '../../services/api';

// Thirdline tone palette: green / yellow / orange / red (tile *-50, dot *-500, text *-700)
const BAND_COLORS = {
  Low: { bg: '#F0FDF4', border: '#22C55E', text: '#15803D', badge: '#22C55E', tone: 'green' },
  Moderate: { bg: '#FEFCE8', border: '#EAB308', text: '#A16207', badge: '#EAB308', tone: 'yellow' },
  High: { bg: '#FFF7ED', border: '#F97316', text: '#C2410C', badge: '#F97316', tone: 'orange' },
  Critical: { bg: '#FEF2F2', border: '#EF4444', text: '#B91C1C', badge: '#EF4444', tone: 'red' },
};

function CellBadge({ count, band }) {
  if (!count) return null;
  const cfg = BAND_COLORS[band] || BAND_COLORS.Low;
  return (
    <Box sx={{
      width: 28, height: 28, borderRadius: '50%', bgcolor: cfg.badge, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, fontWeight: 700, mx: 'auto', mt: 0.5,
    }}>
      {count}
    </Box>
  );
}

function GridView({ data, onCellClick }) {
  const impactLevels = data?.impactLevels || [];
  const likelihoodLevels = data?.likelihoodLevels || [];
  const cells = data?.cells || [];
  if (!impactLevels.length || !likelihoodLevels.length) {
    return <Typography sx={{ p: 2, fontSize: '0.875rem', color: TL.gray500 }}>No risk matrix configured.</Typography>;
  }
  const cellMap = {};
  cells.forEach(c => { cellMap[`${c.impact}|${c.likelihood}`] = c; });

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        {Object.entries(BAND_COLORS).map(([band, cfg]) => (
          <Box key={band} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: cfg.border }} />
            <Typography sx={{ fontSize: '0.75rem', color: TL.gray600 }}>{band}</Typography>
          </Box>
        ))}
      </Box>
      <Table sx={{ minWidth: 600 }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ minWidth: 100 }}>Impact \ Likelihood</TableCell>
            {likelihoodLevels.map(l => (
              <TableCell key={l} sx={{ textAlign: 'center', minWidth: 90 }}>{l}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {[...impactLevels].reverse().map(impact => (
            <TableRow key={impact}>
              <TableCell sx={{ fontWeight: 600, color: TL.gray700, bgcolor: TL.gray50 }}>{impact}</TableCell>
              {likelihoodLevels.map(likelihood => {
                const cell = cellMap[`${impact}|${likelihood}`] || {};
                const band = cell.band || 'Low';
                const cfg = BAND_COLORS[band] || BAND_COLORS.Low;
                return (
                  <TableCell key={likelihood} sx={{
                    bgcolor: cfg.bg, border: `1px solid ${TL.gray100}`,
                    textAlign: 'center', cursor: onCellClick ? 'pointer' : 'default', p: 1,
                    '&:hover': { outline: `2px solid ${cfg.border}`, outlineOffset: -2 },
                  }} onClick={() => onCellClick?.(impact, likelihood)}>
                    <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.025em', color: cfg.text, display: 'block' }}>
                      {band.toUpperCase()}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>{cell.score ?? '-'}</Typography>
                    <CellBadge count={cell.count || 0} band={band} />
                    {cell.hasGaps && <Typography variant="caption" sx={{ color: cfg.text, fontWeight: 700 }}>!</Typography>}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

function TableView({ data }) {
  const populated = (data?.cells || []).filter(c => c.count > 0);
  if (!populated.length) {
    return <Typography sx={{ p: 2, fontSize: '0.875rem', color: TL.gray500 }}>No rated obligations yet.</Typography>;
  }
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Impact</TableCell>
            <TableCell>Likelihood</TableCell>
            <TableCell align="right">Score</TableCell>
            <TableCell align="right">Count</TableCell>
            <TableCell>Band</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {populated.map((c, i) => {
            const cfg = BAND_COLORS[c.band] || BAND_COLORS.Low;
            return (
              <TableRow key={`${c.impact}-${c.likelihood}-${i}`} hover>
                <TableCell>{c.impact}</TableCell>
                <TableCell>{c.likelihood}</TableCell>
                <TableCell align="right">{c.score}</TableCell>
                <TableCell align="right">
                  <StatusBadge label={c.count} tone={cfg.tone} />
                </TableCell>
                <TableCell>
                  <RiskBadge value={c.band} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function RiskHeatmap({ onCellClick }) {
  const [view, setView] = useState('grid');
  const [riskView, setRiskView] = useState('inherent');

  const heatmapQuery = useQuery({
    queryKey: ['dashboard', 'v2', 'riskHeatmap', riskView],
    queryFn: ({ signal }) => api.dashboard.v2.riskHeatmap(riskView, { signal }),
    placeholderData: keepPreviousData,
  });

  const data = heatmapQuery.data;
  const summary = data?.summary;

  return (
    <DataCard
      title="Risk Heatmap"
      subtitle={`${summary?.total ?? 0} rated applicable obligations — ${summary?.critical ?? 0} critical, ${summary?.high ?? 0} high`}
      actions={(
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <ToggleButtonGroup size="small" value={riskView} exclusive
            onChange={(_, v) => { if (v) setRiskView(v); }}>
            <ToggleButton value="inherent">Inherent</ToggleButton>
            <ToggleButton value="residual">Residual</ToggleButton>
          </ToggleButtonGroup>
          <ToggleButtonGroup size="small" value={view} exclusive
            onChange={(_, v) => { if (v) setView(v); }}>
            <ToggleButton value="grid" aria-label="Grid view"><Squares2x2Icon size={16} /></ToggleButton>
            <ToggleButton value="table" aria-label="Table view"><ListBulletIcon size={16} /></ToggleButton>
          </ToggleButtonGroup>
        </Box>
      )}
    >

      {heatmapQuery.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>{heatmapQuery.error?.message || 'Failed to load risk heatmap'}</Alert>
      )}

      {heatmapQuery.isPending ? <CircularProgress size={24} sx={{ m: 2 }} /> : (
        view === 'grid'
          ? <GridView data={data} onCellClick={onCellClick} />
          : <TableView data={data} />
      )}
    </DataCard>
  );
}
