import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  Box, Typography, Paper, Chip, ToggleButton, ToggleButtonGroup, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import { TableChart, GridOn } from '@mui/icons-material';
import { api } from '../../services/api';

const BAND_COLORS = {
  Low: { bg: '#E8F5E9', border: '#4CAF50', text: '#2E7D32', badge: '#4CAF50' },
  Moderate: { bg: '#FFF8E1', border: '#FFC107', text: '#F57F17', badge: '#FFC107' },
  High: { bg: '#FFF3E0', border: '#FF9800', text: '#E65100', badge: '#FF9800' },
  Critical: { bg: '#FFEBEE', border: '#F44336', text: '#C62828', badge: '#F44336' },
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
    return <Typography color="text.secondary" sx={{ p: 2 }}>No risk matrix configured.</Typography>;
  }
  const cellMap = {};
  cells.forEach(c => { cellMap[`${c.impact}|${c.likelihood}`] = c; });

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        {Object.entries(BAND_COLORS).map(([band, cfg]) => (
          <Box key={band} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 14, height: 14, borderRadius: 1, bgcolor: cfg.border }} />
            <Typography variant="caption">{band}</Typography>
          </Box>
        ))}
      </Box>
      <Table sx={{ minWidth: 600 }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', minWidth: 100 }}>Impact \ Likelihood</TableCell>
            {likelihoodLevels.map(l => (
              <TableCell key={l} sx={{ fontWeight: 700, bgcolor: '#F7FAFC', textAlign: 'center', minWidth: 90 }}>{l}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {[...impactLevels].reverse().map(impact => (
            <TableRow key={impact}>
              <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC' }}>{impact}</TableCell>
              {likelihoodLevels.map(likelihood => {
                const cell = cellMap[`${impact}|${likelihood}`] || {};
                const band = cell.band || 'Low';
                const cfg = BAND_COLORS[band] || BAND_COLORS.Low;
                return (
                  <TableCell key={likelihood} sx={{
                    bgcolor: cfg.bg, border: `1px solid ${cfg.border}40`,
                    textAlign: 'center', cursor: onCellClick ? 'pointer' : 'default', p: 1,
                    '&:hover': { outline: `2px solid ${cfg.border}`, outlineOffset: -2 },
                  }} onClick={() => onCellClick?.(impact, likelihood)}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: cfg.text, display: 'block' }}>
                      {band.toUpperCase()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">{cell.score ?? '-'}</Typography>
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
    return <Typography color="text.secondary" sx={{ p: 2 }}>No rated obligations yet.</Typography>;
  }
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Impact</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Likelihood</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">Score</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">Count</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Band</TableCell>
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
                  <Chip size="small" label={c.count} sx={{ bgcolor: cfg.badge, color: '#fff', fontWeight: 700 }} />
                </TableCell>
                <TableCell>
                  <Chip size="small" label={c.band} sx={{ bgcolor: cfg.border, color: '#fff' }} />
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
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h6">Risk Heatmap</Typography>
          <Typography variant="caption" color="text.secondary">
            {summary?.total ?? 0} rated applicable obligations — {summary?.critical ?? 0} critical,{' '}
            {summary?.high ?? 0} high
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <ToggleButtonGroup size="small" value={riskView} exclusive
            onChange={(_, v) => { if (v) setRiskView(v); }}>
            <ToggleButton value="inherent">Inherent</ToggleButton>
            <ToggleButton value="residual">Residual</ToggleButton>
          </ToggleButtonGroup>
          <ToggleButtonGroup size="small" value={view} exclusive
            onChange={(_, v) => { if (v) setView(v); }}>
            <ToggleButton value="grid"><GridOn fontSize="small" /></ToggleButton>
            <ToggleButton value="table"><TableChart fontSize="small" /></ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {heatmapQuery.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>{heatmapQuery.error?.message || 'Failed to load risk heatmap'}</Alert>
      )}

      {heatmapQuery.isPending ? <CircularProgress size={24} sx={{ m: 2 }} /> : (
        view === 'grid'
          ? <GridView data={data} onCellClick={onCellClick} />
          : <TableView data={data} />
      )}
    </Paper>
  );
}
