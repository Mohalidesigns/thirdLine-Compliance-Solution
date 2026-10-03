import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TablePagination, TextField, CircularProgress, Alert, Chip, Tooltip,
  TableSortLabel, IconButton, Button, MenuItem,
} from '@mui/material';
import { Search, Refresh, Close, FactCheck, Warning, TaskAlt, Category } from '@mui/icons-material';
import api from '../../../services/api';

const RISK_COLOR = {
  Critical: 'error', High: 'error', Moderate: 'warning', Medium: 'warning', Low: 'success',
};

const STATUS_COLOR = { Open: 'warning', Closed: 'success', 'In Progress': 'info' };

const COLUMNS = [
  { id: 'controlNumber', label: 'Control', minWidth: 320, sortField: 'controlNumber' },
  { id: 'theme', label: 'Theme / Area', minWidth: 220, sortField: 'theme' },
  { id: 'riskLevel', label: 'Risk', minWidth: 110, sortField: 'riskLevel' },
  { id: 'status', label: 'Status', minWidth: 110, sortField: 'status' },
  { id: 'actName', label: 'Act', minWidth: 220, sortField: 'actName' },
];

function countOf(map, key) {
  if (!map) return 0;
  return Object.entries(map)
    .filter(([k]) => k.toLowerCase() === key.toLowerCase())
    .reduce((sum, [, v]) => sum + (v || 0), 0);
}

export default function ControlExplorerPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [themeFilter, setThemeFilter] = useState('All');
  const [riskFilter, setRiskFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortField, setSortField] = useState('controlNumber');
  const [sortDir, setSortDir] = useState('asc');

  const reqId = useRef(0);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const hasFilters = search || themeFilter !== 'All' || riskFilter !== 'All' || statusFilter !== 'All';

  const loadStats = useCallback(async () => {
    try {
      const data = await api.platform.controls.stats();
      if (alive.current) setStats(data);
    } catch { /* optional */ }
  }, []);

  const loadRows = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, size: rowsPerPage, sort: `${sortField},${sortDir}` });
      if (search) params.set('q', search);
      if (themeFilter !== 'All') params.set('theme', themeFilter);
      if (riskFilter !== 'All') params.set('riskLevel', riskFilter);
      if (statusFilter !== 'All') params.set('status', statusFilter);
      const data = await api.platform.controls.list(params.toString());
      if (!alive.current || id !== reqId.current) return;
      setRows(data.content || []);
      setTotal(data.totalElements || 0);
    } catch (err) {
      if (!alive.current || id !== reqId.current) return;
      setError(err.message);
    } finally {
      if (alive.current && id === reqId.current) setLoading(false);
    }
  }, [page, rowsPerPage, search, themeFilter, riskFilter, statusFilter, sortField, sortDir]);

  useEffect(() => { loadRows(); }, [loadRows]);
  useEffect(() => { loadStats(); }, [loadStats]);

  function clearFilters() {
    setSearch(''); setThemeFilter('All'); setRiskFilter('All'); setStatusFilter('All'); setPage(0);
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

  const byRisk = stats?.byRiskLevel;
  const byStatus = stats?.byStatus;
  const kpis = [
    { key: 'total', label: 'Total Controls', value: stats?.totalControls ?? 0, color: '#2B6CB0', bg: '#EBF8FF', icon: <FactCheck sx={{ fontSize: 20 }} /> },
    { key: 'high', label: 'High / Critical Risk', value: countOf(byRisk, 'High') + countOf(byRisk, 'Critical'), color: '#E53E3E', bg: '#FFF5F5', icon: <Warning sx={{ fontSize: 20 }} /> },
    { key: 'open', label: 'Open', value: countOf(byStatus, 'Open'), color: '#DD6B20', bg: '#FFFAF0', icon: <Warning sx={{ fontSize: 20 }} /> },
    { key: 'closed', label: 'Closed', value: countOf(byStatus, 'Closed'), color: '#2C7A7B', bg: '#E6FFFA', icon: <TaskAlt sx={{ fontSize: 20 }} /> },
    { key: 'themes', label: 'Themes', value: (stats?.themes || []).length, color: '#805AD5', bg: '#FAF5FF', icon: <Category sx={{ fontSize: 20 }} /> },
  ];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
        <Box>
          <Typography variant="h4">Control Explorer</Typography>
          <Typography variant="body2" color="text.secondary">
            {total} compliance control{total !== 1 ? 's' : ''} — monitoring activities across the regulatory universe
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
        <TextField size="small" placeholder="Search controls..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          slotProps={{ input: { startAdornment: <Search sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} /> } }}
          sx={{ minWidth: 240 }} />
        <TextField select size="small" value={themeFilter}
          onChange={e => { setThemeFilter(e.target.value); setPage(0); }}
          label="Theme" sx={{ minWidth: 200 }}>
          <MenuItem value="All">All themes</MenuItem>
          {(stats?.themes || []).map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={riskFilter}
          onChange={e => { setRiskFilter(e.target.value); setPage(0); }}
          label="Risk level" sx={{ minWidth: 160 }}>
          <MenuItem value="All">All risk levels</MenuItem>
          {(stats?.riskLevels || []).map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
          label="Status" sx={{ minWidth: 160 }}>
          <MenuItem value="All">All statuses</MenuItem>
          {(stats?.statuses || []).map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
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
          <FactCheck sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
          <Typography variant="body1">No controls found.</Typography>
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
                  <TableRow key={row.complianceControlId} hover
                    onClick={() => navigate(`/admin/controls/${row.complianceControlId}`)}
                    sx={{ cursor: 'pointer' }}>
                    <TableCell sx={{ color: 'text.secondary' }}>{(page * rowsPerPage) + idx + 1}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem' }}>
                        {row.controlNumber || '—'}
                      </Typography>
                      {row.controlSummary && (
                        <Tooltip title={row.controlSummary}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', maxWidth: 380,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.controlSummary}
                          </Typography>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {row.theme && <Chip size="small" label={row.theme} sx={{ height: 20, fontSize: '0.65rem' }} />}
                        {row.complianceArea && (
                          <Chip size="small" variant="outlined" label={row.complianceArea} sx={{ height: 20, fontSize: '0.65rem' }} />
                        )}
                        {!row.theme && !row.complianceArea && (
                          <Typography variant="body2" color="text.secondary">—</Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {row.riskLevel
                        ? <Chip size="small" label={row.riskLevel} color={RISK_COLOR[row.riskLevel] || 'default'} sx={{ height: 22 }} />
                        : <Typography variant="body2" color="text.secondary">—</Typography>}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={row.status || 'Open'}
                        color={STATUS_COLOR[row.status] || 'default'} sx={{ height: 22 }} />
                    </TableCell>
                    <TableCell>
                      {row.actName
                        ? <Tooltip title={row.actName}>
                            <Chip size="small" variant="outlined" label={row.actName}
                              sx={{ height: 22, maxWidth: 240, fontSize: '0.65rem' }} />
                          </Tooltip>
                        : <Typography variant="body2" color="text.secondary">—</Typography>}
                    </TableCell>
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
