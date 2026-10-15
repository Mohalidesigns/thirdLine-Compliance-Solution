import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton, Tooltip,
  Stack, Switch,
} from '@mui/material';
import {
  PageHeader, KpiCards, FilterBar, RiskBadge, TL,
  EyeIcon, TrashIcon, PresentationChartLineIcon, StarIcon, BellIcon, ClockIcon, ShieldCheckIcon,
} from 'shared';

const watchFilters = ['All Watches', 'Active', 'Paused', 'Expiring Soon'];

const demoWatches = [
  { id: 301, title: 'Guidelines on ATM Cash Disbursement', regulator: 'CBN', risk: 'High', change: '+2', lastChecked: '2026-06-15', status: 'active', updates: 5, nextReview: '2026-06-22' },
  { id: 302, title: 'Anti-Money Laundering Regulations 2026', regulator: 'NFIU', risk: 'High', change: '+1', lastChecked: '2026-06-14', status: 'active', updates: 3, nextReview: '2026-06-21' },
  { id: 303, title: 'Data Privacy Guidelines for Financial Institutions', regulator: 'NDPC', risk: 'Medium', change: '0', lastChecked: '2026-06-10', status: 'paused', updates: 0, nextReview: '-' },
];

export default function WatchlistPage() {
  const [watches, setWatches] = useState([]);
  const [filter, setFilter] = useState('All Watches');

  const [cutoff, setCutoff] = useState(() => Date.now());

  useEffect(() => {
    setWatches(demoWatches);
    setCutoff(Date.now() + 7 * 86400000);
  }, []);

  const filtered = filter === 'All Watches'
    ? watches
    : filter === 'Active'
      ? watches.filter(w => w.status === 'active')
      : filter === 'Paused'
        ? watches.filter(w => w.status === 'paused')
        : watches.filter(w => w.nextReview !== '-' && new Date(w.nextReview) <= new Date(cutoff));

  const changeColor = (change) => (change.startsWith('+') ? TL.error : TL.gray500);

  return (
    <Box>
      <PageHeader
        title="Watchlist"
        subtitle="Monitor regulatory instruments relevant to your organization"
        actions={<Button variant="contained" startIcon={<StarIcon size={16} />}>Add to Watchlist</Button>}
      />

      <KpiCards
        columns={4}
        items={[
          { key: 'active', label: 'Active Watches', value: watches.filter(w => w.status === 'active').length, tone: 'blue', icon: <BellIcon /> },
          { key: 'updates', label: 'Updates This Week', value: 8, tone: 'green', icon: <PresentationChartLineIcon /> },
          { key: 'expiring', label: 'Expiring Soon', value: 1, tone: 'orange', icon: <ClockIcon /> },
          { key: 'coverage', label: 'Coverage Score', value: '94%', tone: 'green', icon: <ShieldCheckIcon /> },
        ]}
      />

      <FilterBar
        filters={[{
          key: 'view', label: 'View', minWidth: 200,
          value: filter === 'All Watches' ? 'All' : filter,
          onChange: (v) => setFilter(v === 'All' ? 'All Watches' : v),
          options: watchFilters.filter(f => f !== 'All Watches').map(f => ({ value: f, label: f })),
          allLabel: 'All Watches',
        }]}
        showClear={filter !== 'All Watches'}
        onClear={() => setFilter('All Watches')}
      />

      <Paper sx={{ overflow: 'hidden' }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Instrument</TableCell>
                <TableCell>Risk</TableCell>
                <TableCell>Changes</TableCell>
                <TableCell>Next Review</TableCell>
                <TableCell align="center">Notify</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((w) => (
                <TableRow key={w.id} hover>
                  <TableCell>
                    <Typography sx={{ fontFamily: TL.mono, fontSize: '0.75rem', color: TL.gray500 }}>{w.regulator}</Typography>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: 'primary.main' }}>{w.title}</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>Last checked {w.lastChecked}</Typography>
                  </TableCell>
                  <TableCell>
                    <RiskBadge value={w.risk} />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: changeColor(w.change) }}>
                      <PresentationChartLineIcon size={16} />
                      <Typography component="span" sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'inherit' }}>{w.change}</Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>{w.updates} updates</Typography>
                  </TableCell>
                  <TableCell sx={{ color: TL.gray500, whiteSpace: 'nowrap' }}>{w.nextReview}</TableCell>
                  <TableCell align="center">
                    <Switch size="small" defaultChecked={w.status === 'active'} />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Tooltip title="View Details">
                        <IconButton size="small"><EyeIcon size={16} /></IconButton>
                      </Tooltip>
                      <Tooltip title="Remove">
                        <IconButton size="small"><TrashIcon size={16} /></IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
