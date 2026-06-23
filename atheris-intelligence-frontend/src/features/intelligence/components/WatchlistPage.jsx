import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Button, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton, Tooltip,
  LinearProgress, Stack, Switch,
} from '@mui/material';
import {
  Visibility, Notifications, NotificationsOff, Delete, TrendingUp,
  Bookmark, Warning, CheckCircle, Schedule,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

const watchFilters = ['All Watches', 'Active', 'Paused', 'Expiring Soon'];

const demoWatches = [
  { id: 301, title: 'Guidelines on ATM Cash Disbursement', regulator: 'CBN', risk: 'High', change: '+2', lastChecked: '2026-06-15', status: 'active', updates: 5, nextReview: '2026-06-22' },
  { id: 302, title: 'Anti-Money Laundering Regulations 2026', regulator: 'NFIU', risk: 'High', change: '+1', lastChecked: '2026-06-14', status: 'active', updates: 3, nextReview: '2026-06-21' },
  { id: 303, title: 'Data Privacy Guidelines for Financial Institutions', regulator: 'NDPC', risk: 'Medium', change: '0', lastChecked: '2026-06-10', status: 'paused', updates: 0, nextReview: '-' },
];

export default function WatchlistPage() {
  const theme = useTheme();
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

  const riskColor = (risk) => ({
    High: theme.palette.error.main,
    Medium: theme.palette.orange?.main || '#DD6B20',
    Low: theme.palette.secondary.main,
  })[risk];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Watchlist</Typography>
          <Typography variant="body2" color="text.secondary">Monitor regulatory instruments relevant to your organization</Typography>
        </Box>
        <Button variant="contained" size="small" startIcon={<Bookmark />}>Add to Watchlist</Button>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Active Watches', value: watches.filter(w => w.status === 'active').length, color: theme.palette.primary.main },
          { label: 'Updates This Week', value: 8, color: theme.palette.secondary.main },
          { label: 'Expiring Soon', value: 1, color: theme.palette.warning.main },
          { label: 'Coverage Score', value: '94%', color: theme.palette.secondary.main },
        ].map((s) => (
          <Grid item xs={6} md={3} key={s.label}>
            <Card>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, color: s.color }}>{s.value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        {watchFilters.map((f) => (
          <Chip
            key={f}
            label={f}
            variant={filter === f ? 'filled' : 'outlined'}
            onClick={() => setFilter(f)}
            sx={{ fontWeight: 600, cursor: 'pointer' }}
          />
        ))}
      </Box>

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Instrument</TableCell>
                <TableCell>Regulator</TableCell>
                <TableCell>Risk</TableCell>
                <TableCell>Changes</TableCell>
                <TableCell>Updates</TableCell>
                <TableCell>Last Checked</TableCell>
                <TableCell>Next Review</TableCell>
                <TableCell align="center">Notify</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((w) => (
                <TableRow key={w.id} hover>
                  <TableCell sx={{ py: 1.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{w.title}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={w.regulator} size="small" sx={{ fontWeight: 700, bgcolor: theme.palette.action.hover }} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: riskColor(w.risk) }}>{w.risk}</Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <TrendingUp sx={{ fontSize: 14, color: w.change.startsWith('+') ? theme.palette.error.main : theme.palette.text.secondary }} />
                      <Typography variant="caption" sx={{ fontWeight: 700, color: w.change.startsWith('+') ? theme.palette.error.main : theme.palette.text.secondary }}>{w.change}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>{w.updates}</Typography>
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', color: theme.palette.text.secondary }}>{w.lastChecked}</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', color: theme.palette.text.secondary }}>{w.nextReview}</TableCell>
                  <TableCell align="center">
                    <Switch size="small" defaultChecked={w.status === 'active'} />
                  </TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={0.5} justifyContent="center">
                      <Tooltip title="View Details">
                        <IconButton size="small"><Visibility sx={{ fontSize: 18 }} /></IconButton>
                      </Tooltip>
                      <Tooltip title="Remove">
                        <IconButton size="small" color="error"><Delete sx={{ fontSize: 18 }} /></IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}
