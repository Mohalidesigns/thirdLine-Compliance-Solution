import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, CircularProgress, Alert,
} from '@mui/material';
import { PageHeader, SectionTabs, DataCard, StatusBadge, TL, riskTone } from 'shared';
import RenditionTab from '../components/dashboard/RenditionTab';
import ControlCoverageTab from '../components/dashboard/ControlCoverageTab';
import RiskHeatmap from '../components/dashboard/RiskHeatmap';
import { api } from '../services/api';

const TABS = [
  { key: 0, label: 'Rendition Tracker' },
  { key: 1, label: 'Control Coverage' },
  { key: 2, label: 'Risk Profile' },
];

function TabPanel({ children, value, index }) {
  return value === index ? <Box>{children}</Box> : null;
}

function BreakdownTable({ title, label, rows, nameKey }) {
  return (
    <DataCard title={title} noPadding>
      {rows.length === 0 ? (
        <Typography sx={{ p: 3, fontSize: '0.875rem', color: TL.gray500 }}>No applicable obligations.</Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{label}</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell align="right">High Risk</TableCell>
                <TableCell align="right">Moderate</TableCell>
                <TableCell align="right">Gaps</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={`${row[nameKey]}-${i}`} hover>
                  <TableCell>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: 'primary.main' }}>
                      {row[nameKey] || 'Unassigned'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{row.total ?? 0}</TableCell>
                  <TableCell align="right">{(row.extreme ?? 0) + (row.high ?? 0)}</TableCell>
                  <TableCell align="right">{row.medium ?? 0}</TableCell>
                  <TableCell align="right">
                    <StatusBadge label={row.gaps ?? 0} tone={row.gaps > 0 ? 'red' : 'gray'} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </DataCard>
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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <RiskHeatmap />

      {profileQuery.isError && (
        <Alert severity="error">{profileQuery.error?.message || 'Failed to load risk profile'}</Alert>
      )}

      {profileQuery.isPending ? <CircularProgress size={24} sx={{ m: 2 }} /> : (
        <>
          <DataCard
            title="Risk Profile"
            subtitle={`${summary?.totalApplicable ?? 0} applicable obligations — ${summary?.gapsCount ?? 0} without a linked control`}
          >
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {(profile?.riskLevels || []).map(level => (
                <StatusBadge
                  key={level.level}
                  dot
                  tone={riskTone(level.level)}
                  label={`${level.level}: ${level.count ?? 0} (${level.percentage ?? 0}%)`}
                />
              ))}
            </Box>
          </DataCard>

          <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' } }}>
            <BreakdownTable title="By Area of Focus" label="Area of Focus"
              rows={profile?.byAreaOfFocus || []} nameKey="areaOfFocus" />
            <BreakdownTable title="By Act" label="Act"
              rows={profile?.byAct || []} nameKey="actName" />
          </Box>
        </>
      )}
    </Box>
  );
}

export default function DashboardV2Page() {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <PageHeader
        title="Dashboard"
        subtitle="Rendition tracker, control coverage and risk profile for the current quarter"
      />
      <SectionTabs tabs={TABS} value={tab} onChange={setTab} sx={{ mb: 3 }} />
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
