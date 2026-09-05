import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  ToggleButton, ToggleButtonGroup, Chip, CircularProgress, Alert,
} from '@mui/material';
import { api } from '../../services/api';

const COLOR_MAP = {
  green: { bg: '#F0FFF4', border: '#38A169', text: '#276749', chip: '#38A169' },
  amber: { bg: '#FFFAF0', border: '#DD6B20', text: '#C05621', chip: '#DD6B20' },
  red: { bg: '#FFF5F5', border: '#E53E3E', text: '#C53030', chip: '#E53E3E' },
};

const DIMENSIONS = [
  { value: 'areaOfFocus', label: 'Area of Focus' },
  { value: 'department', label: 'Department' },
  { value: 'act', label: 'Act' },
];

function PctChip({ pct, color }) {
  const cfg = COLOR_MAP[color] || COLOR_MAP.red;
  return <Chip size="small" label={`${pct ?? 0}%`} sx={{ bgcolor: cfg.chip, color: '#fff', fontWeight: 700, height: 24 }} />;
}

function CoverageTable({ data, dimension }) {
  const navigate = useNavigate();
  if (!data?.rows?.length) {
    return <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No obligations found.</Typography>;
  }
  // only the area filter is supported by the obligations register today
  const drilldown = dimension === 'areaOfFocus'
    ? (row) => navigate(`/obligations?areaOfFocus=${encodeURIComponent(row.name)}`)
    : null;
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>{data.dimension || 'Dimension'}</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">Obligations</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">Covered</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">Gaps</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">Coverage %</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.rows.map((row, i) => (
            <TableRow key={`${row.name}-${i}`} hover
              sx={drilldown ? { cursor: 'pointer' } : undefined}
              onClick={drilldown ? () => drilldown(row) : undefined}>
              <TableCell>{row.name}</TableCell>
              <TableCell align="right">{row.totalObligations ?? 0}</TableCell>
              <TableCell align="right"><Chip size="small" label={row.covered ?? 0} color="success" variant="outlined" /></TableCell>
              <TableCell align="right">
                <Chip size="small" label={row.gaps ?? 0} color={row.gaps > 0 ? 'error' : 'default'} variant="outlined" />
              </TableCell>
              <TableCell align="right"><PctChip pct={row.coveragePercentage} color={row.color} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function ControlCoverageTab() {
  const [coverageBy, setCoverageBy] = useState('areaOfFocus');

  const coverageQuery = useQuery({
    queryKey: ['dashboard', 'v2', 'controlCoverage', coverageBy],
    queryFn: ({ signal }) => api.dashboard.v2.controlCoverage(coverageBy, { signal }),
    placeholderData: keepPreviousData,
  });

  const summary = coverageQuery.data?.summary;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {coverageQuery.isError && (
        <Alert severity="error">{coverageQuery.error?.message || 'Failed to load control coverage'}</Alert>
      )}

      <Paper variant="outlined">
        <Box sx={{ p: 2, borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="h6">Control Coverage</Typography>
            <Typography variant="caption" color="text.secondary">
              {summary?.totalCovered ?? 0}/{summary?.totalObligations ?? 0} applicable obligations covered
              {summary?.totalGaps > 0 ? ` — ${summary.totalGaps} gaps` : ''}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ToggleButtonGroup size="small" value={coverageBy} exclusive
              onChange={(_, v) => { if (v) setCoverageBy(v); }}>
              {DIMENSIONS.map(d => (
                <ToggleButton key={d.value} value={d.value}>{d.label}</ToggleButton>
              ))}
            </ToggleButtonGroup>
            <PctChip pct={summary?.overallCoveragePercentage ?? 0} color={summary?.overallColor} />
          </Box>
        </Box>
        {coverageQuery.isPending
          ? <CircularProgress size={24} sx={{ m: 2 }} />
          : <CoverageTable data={coverageQuery.data} dimension={coverageBy} />}
      </Paper>
    </Box>
  );
}
