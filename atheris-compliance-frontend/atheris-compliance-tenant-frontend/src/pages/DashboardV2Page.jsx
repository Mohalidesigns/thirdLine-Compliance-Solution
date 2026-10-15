import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Tabs, Tab, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, CircularProgress, Alert,
} from '@mui/material';
import { CalendarMonth, Shield, Assessment } from '@mui/icons-material';
import RenditionTab from '../components/dashboard/RenditionTab';
import ControlCoverageTab from '../components/dashboard/ControlCoverageTab';
import RiskHeatmap from '../components/dashboard/RiskHeatmap';
import { api } from '../services/api';

const LEVEL_COLORS = { Critical: 'error', High: 'error', Moderate: 'warning', Medium: 'warning', Low: 'success' };

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ mt: 2 }}>{children}</Box> : null;
}

function BreakdownTable({ title, label, rows, nameKey }) {
  return (
    <Paper variant="outlined">
      <Box sx={{ p: 2, borderBottom: '1px solid #E2E8F0' }}>
        <Typography variant="h6">{title}</Typography>
      </Box>
      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No applicable obligations.</Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>{label}</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Total</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Critical</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">High</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Moderate</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Low</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Gaps</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={`${row[nameKey]}-${i}`} hover>
                  <TableCell>{row[nameKey] || 'Unassigned'}</TableCell>
                  <TableCell align="right">{row.total ?? 0}</TableCell>
                  <TableCell align="right">{row.extreme ?? 0}</TableCell>
                  <TableCell align="right">{row.high ?? 0}</TableCell>
                  <TableCell align="right">{row.medium ?? 0}</TableCell>
                  <TableCell align="right">{row.low ?? 0}</TableCell>
                  <TableCell align="right">
                    <Chip size="small" label={row.gaps ?? 0} color={row.gaps > 0 ? 'error' : 'default'} variant="outlined" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
}

function RiskProfileTab() {
  const profileQuery = useQuery({
    queryKey: ['dashboard', 'v2', 'riskProfile'],
    queryFn: ({ signal }) => api.dashboard.v2.riskProfile({ signal }),
  });

  const profile = profileQuery.data;
  const summary = profile?.summary;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <RiskHeatmap />

      {profileQuery.isError && (
        <Alert severity="error">{profileQuery.error?.message || 'Failed to load risk profile'}</Alert>
      )}

      {profileQuery.isPending ? <CircularProgress size={24} sx={{ m: 2 }} /> : (
        <>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Risk Profile</Typography>
            <Typography variant="caption" color="text.secondary">
              {summary?.totalApplicable ?? 0} applicable obligations — {summary?.gapsCount ?? 0} without a linked control
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
              {(profile?.riskLevels || []).map(level => (
                <Chip key={level.level} color={LEVEL_COLORS[level.level] || 'default'}
                  label={`${level.level}: ${level.count ?? 0} (${level.percentage ?? 0}%)`} />
              ))}
            </Box>
          </Paper>

          <BreakdownTable title="By Area of Focus" label="Area of Focus"
            rows={profile?.byAreaOfFocus || []} nameKey="areaOfFocus" />
          <BreakdownTable title="By Act" label="Act"
            rows={profile?.byAct || []} nameKey="actName" />
        </>
      )}
    </Box>
  );
}

export default function DashboardV2Page() {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 1 }}>Dashboard</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab icon={<CalendarMonth />} iconPosition="start" label="Rendition Tracker" />
        <Tab icon={<Shield />} iconPosition="start" label="Control Coverage" />
        <Tab icon={<Assessment />} iconPosition="start" label="Risk Profile" />
      </Tabs>
      <TabPanel value={tab} index={0}>
        <RenditionTab />
      </TabPanel>
      <TabPanel value={tab} index={1}>
        <ControlCoverageTab />
      </TabPanel>
      <TabPanel value={tab} index={2}>
        <RiskProfileTab />
      </TabPanel>
    </Box>
  );
}
