import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  ToggleButton, ToggleButtonGroup, Chip, CircularProgress, Tooltip,
} from '@mui/material';
import { api } from '../../services/api';
import RiskHeatmap from './RiskHeatmap';

const COLOR_MAP = {
  green: { bg: '#F0FFF4', border: '#38A169', text: '#276749', chip: '#38A169' },
  amber: { bg: '#FFFAF0', border: '#DD6B20', text: '#C05621', chip: '#DD6B20' },
  red: { bg: '#FFF5F5', border: '#E53E3E', text: '#C53030', chip: '#E53E3E' },
};

function PctChip({ pct, color }) {
  const cfg = COLOR_MAP[color] || COLOR_MAP.red;
  return <Chip size="small" label={`${pct}%`} sx={{ bgcolor: cfg.chip, color: '#fff', fontWeight: 700, height: 24 }} />;
}

function CoverageTable({ data }) {
  const navigate = useNavigate();
  if (!data?.rows?.length) return <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No obligations found.</Typography>;
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>{data.dimension}</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">Obligations</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">Covered</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">Gaps</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">Coverage %</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.rows.map((row, i) => (
            <TableRow key={i} hover sx={{ cursor: 'pointer' }}
              onClick={() => navigate(`/obligations?areaOfFocus=${encodeURIComponent(row.name)}`)}>
              <TableCell>{row.name}</TableCell>
              <TableCell align="right">{row.totalObligations}</TableCell>
              <TableCell align="right"><Chip size="small" label={row.covered} color="success" variant="outlined" /></TableCell>
              <TableCell align="right">
                <Chip size="small" label={row.gaps} color={row.gaps > 0 ? 'error' : 'default'} variant="outlined" />
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
  const navigate = useNavigate();
  const [coverage, setCoverage] = useState(null);
  const [coverageBy, setCoverageBy] = useState('areaOfFocus');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.dashboard.v2.controlCoverage(coverageBy).then(setCoverage).catch(() => {}).finally(() => setLoading(false));
  }, [coverageBy]);

  const handleHeatmapCellClick = (impact, likelihood) => {
    navigate(`/obligations?impact=${encodeURIComponent(impact)}&likelihood=${encodeURIComponent(likelihood)}`);
  };

  return (
    <Box>
      {loading ? <CircularProgress size={24} sx={{ m: 2 }} /> : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <RiskHeatmap onCellClick={handleHeatmapCellClick} />

          <Paper variant="outlined">
            <Box sx={{ p: 2, borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">Control Coverage</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ToggleButtonGroup size="small" value={coverageBy} exclusive
                  onChange={(_, v) => { if (v) setCoverageBy(v); }}>
                  <ToggleButton value="areaOfFocus">Domain</ToggleButton>
                  <ToggleButton value="department">Department</ToggleButton>
                </ToggleButtonGroup>
                <PctChip pct={coverage?.summary?.overallCoveragePercentage ?? 0}
                  color={coverage?.summary?.overallCoveragePercentage >= 80 ? 'green' : coverage?.summary?.overallCoveragePercentage >= 60 ? 'amber' : 'red'} />
              </Box>
            </Box>
            <CoverageTable data={coverage} />
          </Paper>
        </Box>
      )}
    </Box>
  );
}
