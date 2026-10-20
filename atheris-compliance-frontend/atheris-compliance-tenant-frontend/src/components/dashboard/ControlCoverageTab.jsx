import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  ToggleButton, ToggleButtonGroup, CircularProgress, Alert,
} from '@mui/material';
import { DataCard, StatusBadge, TL } from 'shared';
import { api } from '../../services/api';

// backend colour band → Thirdline badge tone
const TONE_MAP = { green: 'green', amber: 'orange', red: 'red' };

const DIMENSIONS = [
  { value: 'areaOfFocus', label: 'Area of Focus' },
  { value: 'department', label: 'Department' },
  { value: 'act', label: 'Act' },
];

function PctChip({ pct, color }) {
  return <StatusBadge label={`${pct ?? 0}%`} tone={TONE_MAP[color] || 'red'} />;
}

function CoverageTable({ data, dimension }) {
  const navigate = useNavigate();
  if (!data?.rows?.length) {
    return <Typography sx={{ p: 3, fontSize: '0.875rem', color: TL.gray500 }}>No obligations found.</Typography>;
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
            <TableCell>{data.dimension || 'Dimension'}</TableCell>
            <TableCell align="right">Obligations</TableCell>
            <TableCell align="right">Covered</TableCell>
            <TableCell align="right">No Control</TableCell>
            <TableCell align="right">Coverage %</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.rows.map((row, i) => (
            <TableRow key={`${row.name}-${i}`} hover
              sx={drilldown ? { cursor: 'pointer' } : undefined}
              onClick={drilldown ? () => drilldown(row) : undefined}>
              <TableCell>
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: drilldown ? 'primary.main' : TL.gray800 }}>{row.name}</Typography>
              </TableCell>
              <TableCell align="right">{row.totalObligations ?? 0}</TableCell>
              <TableCell align="right"><StatusBadge label={row.covered ?? 0} tone="green" /></TableCell>
              <TableCell align="right">
                <StatusBadge label={row.gaps ?? 0} tone={row.gaps > 0 ? 'red' : 'gray'} />
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

      <DataCard
        noPadding
        title="Control Coverage"
        subtitle={`${summary?.totalCovered ?? 0}/${summary?.totalObligations ?? 0} applicable obligations covered${summary?.totalGaps > 0 ? ` — ${summary.totalGaps} with no control` : ''}`}
        actions={(
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <ToggleButtonGroup size="small" value={coverageBy} exclusive
              onChange={(_, v) => { if (v) setCoverageBy(v); }}>
              {DIMENSIONS.map(d => (
                <ToggleButton key={d.value} value={d.value}>{d.label}</ToggleButton>
              ))}
            </ToggleButtonGroup>
            <PctChip pct={summary?.overallCoveragePercentage ?? 0} color={summary?.overallColor} />
          </Box>
        )}
      >
        {coverageQuery.isPending
          ? <CircularProgress size={24} sx={{ m: 2 }} />
          : <CoverageTable data={coverageQuery.data} dimension={coverageBy} />}
      </DataCard>
    </Box>
  );
}
