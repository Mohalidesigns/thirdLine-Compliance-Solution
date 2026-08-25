import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TablePagination, TextField, CircularProgress, Alert, Chip, Tooltip,
  TableSortLabel, IconButton, Button, MenuItem,
} from '@mui/material';
import { Search, Refresh, Close, Balance, Gavel, RequestQuote, Assignment } from '@mui/icons-material';
import api from '../../../services/api';
import { ROUTES } from '../../../utils/constants';

const STATUS_COLOR = { Active: 'success', Superseded: 'default', Outdated: 'warning' };

const COLUMNS = [
  { id: 'name', label: 'Act', minWidth: 300, sortField: 'name' },
  { id: 'regulatorName', label: 'Regulator', minWidth: 180, sortField: 'regulatorName' },
  { id: 'status', label: 'Status', minWidth: 100, sortField: 'status' },
  { id: 'instrumentCount', label: 'Instruments', minWidth: 100, sortField: 'instrumentCount' },
  { id: 'obligationCount', label: 'Obligations', minWidth: 100, sortField: 'obligationCount' },
  { id: 'sanctionCount', label: 'Sanctions', minWidth: 100, sortField: 'sanctionCount' },
  { id: 'returnCount', label: 'Returns', minWidth: 90, sortField: 'returnCount' },
];

export default function RegulationExplorerPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [regulatorFilter, setRegulatorFilter] = useState('All');
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('desc');

  const hasFilters = search || regulatorFilter !== 'All';

  const loadStats = useCallback(async () => {
    try { setStats(await api.platform.acts.stats()); } catch { /* optional */ }
  }, []);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, size: rowsPerPage, sort: `${sortField},${sortDir}` });
      if (search) params.set('q', search);
      if (regulatorFilter !== 'All') params.set('regulatorId', regulatorFilter);
      const data = await api.platform.acts.list(params.toString());
      setRows(data.content || []);
      setTotal(data.totalElements || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search, regulatorFilter, sortField, sortDir]);

  useEffect(() => { loadRows(); }, [loadRows]);
  useEffect(() => { loadStats(); }, []);

  function clearFilters() {
    setSearch(''); setRegulatorFilter('All'); setPage(0);
  }

  function handleSort(field) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setPage(0);
  }

  const kpis = [
    { key: 'total', label: 'Total Acts', value: stats?.totalActs ?? 0, color: '#2B6CB0', bg: '#EBF8FF', icon: <Balance sx={{ fontSize: 20 }} /> },
    { key: 'instruments', label: 'Instruments', value: stats?.totalInstruments ?? 0, color: '#2C7A7B', bg: '#E6FFFA', icon: <Assignment sx={{ fontSize: 20 }} /> },
    { key: 'obligations', label: 'Obligations', value: stats?.totalObligations ?? 0, color: '#805AD5', bg: '#FAF5FF', icon: <Gavel sx={{ fontSize: 20 }} /> },
    { key: 'sanctions', label: 'Sanctions', value: stats?.totalSanctions ?? 0, color: '#E53E3E', bg: '#FFF5F5', icon: <Gavel sx={{ fontSize: 20 }} /> },
    { key: 'returns', label: 'Returns', value: stats?.totalReturns ?? 0, color: '#DD6B20', bg: '#FFFAF0', icon: <RequestQuote sx={{ fontSize: 20 }} /> },
  ];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
        <Box>
          <Typography variant="h4">Act Explorer</Typography>
          <Typography variant="body2" color="text.secondary">
            {total} act{total !== 1 ? 's' : ''} — browse the curated Nigerian compliance universe
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={() => { loadRows(); loadStats(); }}><Refresh /></IconButton>
        </Tooltip>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* KPI cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' }, gap: 2, mb: 2 }}>
        {kpis.map(k => (
          <Paper key={k.key} elevation={0} variant="outlined"
            sx={{ p: 2, borderLeft: `3px solid ${k.color}`, transition: 'box-shadow .2s', '&:hover': { boxShadow: 1 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{k.label}</Typography>
              <Box sx={{ color: k.color, opacity: 0.5 }}>{k.icon}</Box>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: k.color }}>{k.value}</Typography>
          </Paper>
        ))}
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" placeholder="Search acts..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          slotProps={{ input: { startAdornment: <Search sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} /> } }}
          sx={{ minWidth: 240 }} />
        <TextField select size="small" value={regulatorFilter}
          onChange={e => { setRegulatorFilter(e.target.value); setPage(0); }}
          label="Regulator" sx={{ minWidth: 200 }}>
          <MenuItem value="All">All regulators</MenuItem>
          {(stats?.regulators || []).map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
        </TextField>
        {hasFilters && (
          <Button size="small" startIcon={<Close />} onClick={clearFilters}>Clear</Button>
        )}
      </Paper>

      {/* Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : rows.length === 0 ? (
        <Paper sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <Balance sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
          <Typography variant="body1">No acts found.</Typography>
        </Paper>
      ) : (
        <Paper>
          <TableContainer>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', minWidth: 50 }}>#</TableCell>
                  {COLUMNS.map(c => (
                    <TableCell key={c.id} sx={{ minWidth: c.minWidth, fontWeight: 700, bgcolor: '#F7FAFC',
                      cursor: c.sortField ? 'pointer' : 'default', userSelect: 'none' }}
                      onClick={c.sortField ? () => handleSort(c.sortField) : undefined}>
                      {c.sortField
                        ? <TableSortLabel active={sortField === c.sortField} direction={sortField === c.sortField ? sortDir : 'asc'}
                            sx={{ '& .MuiTableSortLabel-icon': { opacity: sortField === c.sortField ? 1 : 0.4 } }}>
                            {c.label}
                          </TableSortLabel>
                        : c.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow key={row.regulationId} hover
                    onClick={() => navigate(`${ROUTES.ADMIN_ACTS}/${row.regulationId}`)}
                    sx={{ cursor: 'pointer' }}>
                    <TableCell sx={{ color: 'text.secondary' }}>{total - (page * rowsPerPage) - idx}</TableCell>
                    <TableCell>
                      <Tooltip title={row.name || 'Untitled act'}>
                        <Typography variant="body2" sx={{ fontWeight: 600, maxWidth: 360,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.name}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      {row.regulatorName
                        ? <Typography variant="body2">{row.regulatorName}</Typography>
                        : <Typography variant="body2" color="text.secondary">-</Typography>}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={row.status || 'Active'}
                        color={STATUS_COLOR[row.status] || 'default'} sx={{ height: 22 }} />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{row.instrumentCount ?? 0}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{row.obligationCount ?? 0}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{row.sanctionCount ?? 0}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{row.returnCount ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage} onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[10, 20, 50]} />
        </Paper>
      )}
    </Box>
  );
}
